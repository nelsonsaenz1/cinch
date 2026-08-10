import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';
import { PostHog, PostHogProvider } from 'posthog-react-native';
import { useEffect } from 'react';

/**
 * Product analytics.
 *
 * OPTIONAL BY CONSTRUCTION. With no project token the client is never created
 * and every `track()` is a no-op. That is not defensive coding for its own sake:
 * `.env.example` ships the token blank, so a fresh clone has none, and analytics
 * is not load-bearing — nothing about the closet, the stylist or sign-in depends
 * on it. Hard-failing the app because a measurement tool is unconfigured would
 * be the wrong trade. (`lib/supabase.ts` throws for the opposite reason: without
 * it there is no app at all.)
 *
 * WHAT IS DELIBERATELY NOT SENT
 *
 * No email. No display name. No garment photographs, no free-text stylist
 * questions, no plan notes, no calendar titles. The only identifier is the
 * Supabase user UUID, which is already the join key everywhere else and is
 * meaningless outside this system.
 *
 * That is a stricter line than the usual `$set: { email, name }` starter
 * snippet, and it is drawn on purpose. `app.config.ts` declares
 * `NSPrivacyCollectedDataTypeEmailAddress` as collected for **App Functionality**
 * only, and the App Store privacy answers say the same. Sending email to a
 * third-party analytics vendor would make both statements false and would add a
 * "Data Used to Track You" disclosure the app does not currently make. Apple
 * cross-checks the privacy manifest against those answers, and a mismatch is a
 * review hold — so the cost of the convenient version is a rejection, not just
 * an ethical wrinkle.
 *
 * If person-level email is ever genuinely needed, it is a product decision that
 * has to travel with a privacy-manifest change and a listing update. Not a
 * one-line addition here.
 */

const token = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * The client, or null when unconfigured.
 *
 * Constructed once at module load rather than in a hook. It has no React state,
 * it must survive remounts, and the queue it maintains has to outlive any one
 * component — a client rebuilt on re-render drops buffered events.
 */
export const posthog: PostHog | null = token
  ? new PostHog(token, {
      host,
      // Session replay is off. It records the screen, and every screen in this
      // app is either the user's own wardrobe photographs or a stylist
      // conversation. Turning it on is a privacy-manifest change, not a config
      // tweak.
      enableSessionReplay: false,
      // App opened / backgrounded / updated. A client option, not an
      // autocapture one — the provider's autocapture block only governs
      // touches and screens.
      captureAppLifecycleEvents: true,
      // Events are batched; this bounds how long a completed action waits
      // before it is sent. Ten seconds is short enough that a user who
      // immediately backgrounds the app still gets their events flushed on the
      // next launch, and long enough not to make a request per tap.
      flushInterval: 10,
      flushAt: 20,
      // Error visibility (#86): there is no crash reporter in this app, so an
      // uncaught JS exception or unhandled promise rejection otherwise vanishes
      // — nobody sees it unless the user happens to describe the crash.
      //
      // The installed posthog-react-native (4.62, checked in node_modules —
      // see `error-tracking/index.d.ts`) ships its own `captureException` and
      // an `errorTracking.autocapture` option, so this wires into that rather
      // than hand-rolling an `ErrorUtils.setGlobalHandler`. Its own
      // `trackUncaughtExceptions` (error-tracking/utils.js) reads the CURRENT
      // global handler, calls the tracker, then calls the original handler
      // straight after — so the platform's own fatal-error behaviour (the
      // Hermes red box in dev, the native crash in prod) still runs unchanged.
      // Nothing here rethrows, and nothing here can loop: a capture failure
      // is swallowed inside the SDK's own try/catch, not re-thrown into the
      // handler it just installed.
      //
      // Console autocapture is left off — this is exception tracking, not a
      // log pipe, and a wrapped `console.error` would start forwarding
      // component stack traces that may embed garment data logged elsewhere.
      errorTracking: {
        autocapture: { uncaughtExceptions: true, unhandledRejections: true },
      },
    })
  : null;

if (__DEV__ && !token) {
  console.warn(
    'EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is unset — analytics are disabled. ' +
      'Every feature still works; nothing is measured.',
  );
}

/**
 * Which JS bundle is actually running, stamped onto every event.
 *
 * WHY THIS EXISTS. `eas update` reports "Published", and the update server will
 * confirm it serves that update to a client claiming the right channel and
 * runtime — but neither says a single real phone ever ran it. An OTA can be
 * published perfectly and reach nobody, and the failure is silent on both
 * sides. The most common cause is the runtime gate: `app.config.ts` sets
 * `runtimeVersion: { policy: 'appVersion' }`, so an update only ever reaches a
 * build whose app version matches EXACTLY. The day a store build ships as
 * 1.0.1, every update published at 1.0.0 stops arriving, with no error
 * anywhere. Stamping the update id on events turns that from a thing we reason
 * about into a thing we can query: filter to an update id and count devices.
 *
 * SUPER PROPERTIES, NOT AN EVENT. These ride along on every capture — including
 * PostHog's own lifecycle events from `captureAppLifecycleEvents` — so adoption
 * is a filter on data that already exists rather than a bespoke event that has
 * to be joined against everything else.
 *
 * NEVER OMIT A KEY. Super properties persist to local storage across launches,
 * so a key left unset keeps LAST launch's value and quietly lies — exactly
 * backwards, since the interesting case is a device falling back to the
 * embedded bundle. Every field below is therefore always written, with an
 * explicit sentinel instead of a hole.
 *
 * PRIVACY. All of this is build identity: ids the server already assigned and
 * booleans about which bundle loaded. No user, no content, nothing that
 * narrows to a person — so it stays inside the line this file draws above, and
 * needs no privacy-manifest change. `Updates.emergencyLaunchReason` is
 * deliberately NOT sent: it is unbounded SDK error text, and unbounded strings
 * in event properties are the thing this file exists to refuse. The boolean is
 * the signal; if the reason is ever needed it is a bounded enum, not a raw
 * passthrough.
 */
function registerBuildIdentity(client: PostHog): void {
  // `??` is not enough. expo-updates reports some of these as an EMPTY STRING
  // rather than null — `channel` does exactly that in a dev client, verified
  // against live events. An empty string is the worst possible value to store:
  // it survives every null check, renders as a blank cell, and silently matches
  // nothing when filtered, so a query looks answered when it is not.
  const orElse = (value: string | null | undefined, fallback: string): string =>
    value !== null && value !== undefined && value !== '' ? value : fallback;

  client
    .register({
      // The running update, or the bundle compiled into the binary. `updateId`
      // is null on an embedded launch, which is a real state worth naming
      // rather than a missing value.
      update_id: orElse(Updates.updateId, 'embedded'),
      update_channel: orElse(Updates.channel, 'none'),
      runtime_version: orElse(Updates.runtimeVersion, 'unknown'),
      // When the running update was published — lets "how fast does an update
      // roll out" be answered without looking anything up in EAS.
      update_created_at: Updates.createdAt?.toISOString() ?? 'embedded',
      is_embedded_launch: Updates.isEmbeddedLaunch,
      // True when the update failed to load and the app fell back to the
      // embedded bundle. A nonzero count here means a bad publish is being
      // survived silently by users — the one number worth alerting on.
      is_emergency_launch: Updates.isEmergencyLaunch,
      // Whether the updates system is active at all. NOT a reliable dev/prod
      // discriminator — a dev client reports `true` here while reporting an
      // empty channel and a runtime of "1", checked against real events. The
      // honest way to count adoption is to filter `update_id` to the specific
      // update UUID being measured; dev and embedded launches both collapse
      // into the 'embedded' bucket and stay out of that count by construction.
      updates_enabled: Updates.isEnabled,
    })
    // `register` resolves once the SDK's storage bootstrap has run; a rejection
    // here must not take the app down, for the same reason the whole client is
    // optional — analytics is not load-bearing.
    .catch(() => {});
}

// At module load, immediately after the client exists, so the properties are
// queued ahead of the first lifecycle capture rather than racing it.
if (posthog) registerBuildIdentity(posthog);

/**
 * Every event the app may emit.
 *
 * A closed union rather than free strings. PostHog silently accepts anything,
 * so a typo does not fail — it creates a second event that looks real, splits
 * the funnel, and is found weeks later when a number does not add up.
 *
 * snake_case because that is what PostHog's own UI, its SQL surface and every
 * insight builder assume.
 *
 * OFFERS AND STARTS, NOT ONLY COMPLETIONS. Every event in the first version of
 * this union fired on a completion, which produced conversion numerators with
 * no denominators: likes with no impressions, sign-ins with no attempts,
 * activation with no moment. The events marked below as denominators exist to
 * close that, and the rule they follow is the one `paywall_presented` already
 * set — fire when the thing is genuinely OFFERED or genuinely ON SCREEN, never
 * when it was merely requested, fetched or registered.
 */
export type AppEvent =
  /** Garments chosen for import — the top of the activation funnel. */
  | 'clothes_import_selected'
  /** One garment fully uploaded, tagged and saved. */
  | 'clothes_import_completed'
  /**
   * A garment described in words rather than photographed. Properties carry
   * how many candidates came back and whether one was chosen — never the
   * description itself, which is user content and stays on the device.
   */
  | 'garment_search_used'
  /**
   * How the on-device cutout went, per photo. The one number that decides
   * whether a server-side matting fallback is worth paying for.
   */
  | 'cutout_result'
  /** AI tags confirmed or corrected by the user. */
  | 'garment_reviewed'
  /** An outfit liked or dismissed. */
  | 'outfit_reacted'
  /**
   * DENOMINATOR for `outfit_reacted` and `outfit_worn`: a set of outfits
   * genuinely on screen.
   *
   * Fired from the commit that RENDERS plates, not from the query that fetched
   * them. Today has five terminal states above its plates — loading, a failed
   * wardrobe read, the empty-closet ladder, offline-with-nothing, and "nothing
   * today feels right" — and in four of them outfits were fetched or computed
   * and never seen. Counting the fetch would inflate the denominator with
   * exactly the sessions where the product failed to show anything, which is
   * the opposite of what a like rate is for.
   *
   * `count` is how many plates rendered, `surface` is a bounded 'today' |
   * 'reveal', `offline` says whether the set was the stale local one (a like
   * rate should be readable with those sessions excluded). Once per distinct
   * set per mount: a "show me another" swap replaces a plate and counts again,
   * because a new outfit really did arrive in front of the reader.
   */
  | 'outfit_set_viewed'
  /** An outfit recorded as actually worn — the habit metric. */
  | 'outfit_worn'
  /** An outfit placed on a day in the weekly plan. */
  | 'outfit_planned'
  /** The stylist answered a question successfully. */
  | 'stylist_question_answered'
  /** A guided stylist questionnaire tapped through to the end. */
  | 'stylist_questionnaire_completed'
  /**
   * The share sheet was opened for a captured card. `subject` is which
   * artifact ('outfit' | 'packing'); `has_link` is whether the sharer's own
   * invite link made it into the message, which is the difference between a
   * share that can recruit and one that cannot — `myInviteUrl` returns null
   * for a user with no handle and gives up after 1.2s on a cold read.
   */
  | 'outfit_shared'
  /**
   * NUMERATOR ONLY, and deliberately not a funnel denominator: a share sheet
   * that reported an actual send.
   *
   * `outfit_shared` fires when the sheet is asked for, which is the honest
   * maximum, because iOS only calls the completion handler back when
   * `completed || activityType == nil` — pick an activity and then cancel its
   * follow-up and nothing is ever reported. So this UNDERCOUNTS by an unknown
   * amount and may only be read as "at least this many sends", never divided
   * into anything.
   *
   * `activity_type` is Apple's own UIActivityType suffix. Every third-party
   * share extension collapses to 'other': its raw value is the bundle id of an
   * app the user has installed, which is neither bounded nor ours to collect.
   */
  | 'share_completed'
  /**
   * A look, or a whole occasion board, sent out of the app from the event
   * board. `scope` separates the two, `mine` and `locked` carry the board's
   * own state, `has_link` whether the sharer had an invite link to attach.
   * Never the occasion title, never a member's name — the board is other
   * people's content and none of it belongs in an event property.
   *
   * Separate from `outfit_shared` because it is a different artifact (text and
   * a link, no captured card) from a different surface; merging them would
   * make neither of the two countable.
   */
  | 'board_shared'
  /**
   * The invite screen's own share sheet was asked for. `surface` is bounded so
   * a second invite entry point later stays distinguishable from this one.
   */
  | 'invite_shared'
  /**
   * The invite link actually reached the pasteboard.
   *
   * Fired only inside `copyText`'s success branch. It returns false when the
   * write did not happen, and a copy counted that never landed is a referral
   * numerator the recipient side can never match — the exact shape of error
   * that makes K unfalsifiable.
   */
  | 'invite_copied'
  /**
   * An invite link was opened in the app — the K-factor denominator, and the
   * first number in the referral loop that was previously dark end to end.
   *
   * ONE event for both branches with `signed_in` as a property, rather than
   * two events, so "links tapped" stays a single number no matter who taps it.
   * Split into `invite_opened_signed_in` / `_signed_out` and every K query
   * would have to remember to add them back together.
   */
  | 'invite_opened'
  /**
   * `apply_invite` answered. `resolved` is whether there was anybody at the
   * other end: false covers an unknown handle, the user's own link, and a
   * block in either direction — three situations the server deliberately does
   * not distinguish, and this must not pretend to either.
   *
   * A link tapped at a deleted account is a different failure from a link
   * nobody ever tapped, and only the pair `invite_opened` → `invite_converted`
   * can tell them apart. That is the whole reason this carries a boolean
   * rather than firing only on success.
   */
  | 'invite_converted'
  /**
   * A sign-in ATTEMPT, at the moment a method is chosen: the Apple sheet is
   * asked for, or the email route is entered.
   *
   * NOT screen arrival. `useScreenTracking` already emits `$screen` for
   * (auth)/sign-in on every arrival, so an arrival event would be a second
   * name for data that exists — and it could not carry `method`, which is the
   * one split that decides whether the email flow's four extra screens are
   * where people are lost. Arrival is the denominator, this is the first
   * checkpoint, and the two together are the drop-off.
   *
   * `method` is 'apple' | 'email'. One per attempt, so a retry after a failed
   * Apple sheet counts again — attempts are what convert, and PostHog funnels
   * count unique people anyway.
   */
  | 'auth_started'
  /**
   * ACTIVATION: the first time this person's closet can actually dress them.
   *
   * The predicate is `canGenerate()` (features/styling/queries.ts) — a wearable
   * core plus MIN_CLOSET_FOR_OUTFITS pieces — and NOT "finished The Ten". The
   * Ten is one road to a usable closet; raw capture is the other, and a closet
   * built that way is exactly as ready. Marking activation at the guided
   * flow's finish line would have counted the road instead of the arrival, and
   * silently scored every non-guided user as never activated.
   *
   * Emitted through `trackOnce`, so it fires exactly once per person however
   * many times either surface observes the crossing. `route` says which
   * surface saw it first; `pieces` is a count — the input to the closet-size
   * threshold analysis in docs/analytics.md §4, and the reason this event is
   * worth more than a timestamp.
   */
  | 'closet_ready'
  /** A server refusal that offered an upgrade — the paywall funnel's top. */
  | 'paywall_presented'
  /**
   * A paywall that could not be shown — dismissed by the client fail-safe in
   * `use-gate.ts` rather than left as a dead grey sheet. Properties carry the
   * placement and a bounded reason enum (an SDK event name, `no_response`,
   * `silent_render`, `skipped_without_grant`, or `sdk_error`), never the raw
   * error text, which is unbounded.
   */
  | 'paywall_unavailable'
  /**
   * A garment import that never reached `done` — the terminal failure of an
   * upload-queue job, and the counterweight to `clothes_import_selected`.
   * Without it the activation funnel could only say that people stopped
   * importing, never that the app dropped what they imported.
   *
   * `stage` is the `JobStage` it died at (`preparing`, `cutout`, `uploading`,
   * `tagging`); `reason` is a bounded classification produced by
   * `analyticsFailureReason` in `upload-queue.ts`, never `job.error` itself,
   * which is free text written for a human-readable banner. `retryable` says
   * whether the queue will offer another go, which separates "we lost it" from
   * "we paused on it".
   *
   * TERMINAL ONLY. The drain loop re-queues a job that has attempts left, and
   * that transition writes no event: an import that fails twice and then
   * succeeds is a success, and counting its stumbles would make the failure
   * rate a measure of network weather rather than of lost garments.
   */
  | 'clothes_import_failed'
  /**
   * THE WALKTHROUGH — voice intake (docs/design/voice-intake-directive.md §9).
   *
   * These ten answer one question the rest of the union cannot: whether talking
   * is actually faster than photographing. `intake_started` to
   * `intake_committed` for a 30-piece closet, against the photo path's
   * equivalent, is the entire thesis of the reframe in a single duration.
   *
   * NOT ONE OF THESE MAY CARRY TEXT. No transcript, no utterance, no garment
   * name, no colour term the user spoke. A walkthrough is a recording of
   * somebody listing everything they own, and an event property is the easiest
   * place in the app for that to leak. Buckets and counts only — the rule the
   * `EventProps` comment below already sets, applied where it matters most.
   *
   * DENOMINATOR for the whole funnel. Fired when the microphone is genuinely
   * offered at V-01, not when the feature is reachable.
   */
  | 'intake_started'
  /**
   * The recording stopped and is on its way to transcription. `duration_bucket`
   * is a bounded band ('under_1m' | '1_3m' | '3_6m' | '6_12m'), never the raw
   * milliseconds — a duration to the millisecond is close to a fingerprint and
   * the band is all any decision here needs.
   */
  | 'intake_recording_finished'
  /**
   * The parse returned. `garment_bucket` bands the count ('0' | '1_9' |
   * '10_29' | '30_plus'); `unparsed_spans` is how many pieces of speech the
   * model could not turn into a garment, which is the honest measure of how
   * much the parse is missing and the reason V-05 shows them at all.
   */
  | 'intake_parsed'
  /** One procession card accepted as heard. The numerator for trust. */
  | 'intake_card_confirmed'
  /**
   * One card corrected. `field` is which one ('name' | 'kind' | 'colour' |
   * 'fabric' | 'pattern' | 'formality' | 'warmth' | 'quantity') — bounded, and
   * never the old or new value.
   *
   * THE NUMBER THAT JUDGES THE PARSE. Above ~25% of garments edited and the
   * receipt line is carrying the whole experience: people are reading every
   * card because they have learned they cannot trust it, which is slower than
   * photographing and feels worse.
   */
  | 'intake_card_edited'
  /** A card thrown away — the model heard a garment that does not exist. */
  | 'intake_card_rejected'
  /** V-08's optional upgrade taken: a spoken garment given a real photograph.
   *  Watched against `colour_source` moving from 'spoken' to 'measured'. */
  | 'intake_photo_added'
  /**
   * The drafts became garments. `committed` and `held` are the two counts
   * `commit_intake_session` returns — `held` is non-zero exactly when the plan
   * ceiling fired, which makes this the denominator for M-07 and M-08.
   */
  | 'intake_committed'
  /**
   * A walkthrough left unfinished. `state` is where it was abandoned
   * ('recording' | 'transcribing' | 'parsing' | 'reviewing'), and `cursor_bucket`
   * how far through the procession they got.
   *
   * The second of the three numbers that decide this feature: above 20%
   * abandonment inside `reviewing` and the cards are too slow, whatever the
   * intake time says.
   */
  | 'intake_abandoned'
  /**
   * A walkthrough that broke. `cause` is the bounded `error_code` written to
   * `intake_sessions` ('quota_exhausted' | 'transcription_failed' | 'silent' |
   * 'parse_failed' | 'audio_unreadable' | 'drafts_unwritable' | 'offline'),
   * never a provider message.
   *
   * 'silent' and 'parse_failed' are the two worth separating: one means the
   * microphone let the user down, the other means the model did, and they lead
   * to completely different fixes.
   */
  | 'intake_failed';

/*
 * `client_error` WAS HERE, AND WAS DELETED RATHER THAN WIRED.
 *
 * It was declared for "a deliberate, in-app catch that wants a typed event"
 * and never acquired one, which made it the thing this union exists to
 * prevent: a member that reads as measured and is permanently empty.
 *
 * Wiring it would have been worse than deleting it. The client option above
 * turns on `errorTracking.autocapture`, so uncaught exceptions and unhandled
 * rejections already arrive as PostHog's own `$exception`, and the SDK's
 * `captureException` puts a hand-caught error into that SAME stream. A second
 * event name for hand-caught errors would fork error volume across two names
 * that have to be unioned back together in every query, and would put the
 * pressure on each call site to pick the right one.
 *
 * So: a deliberate catch that wants telemetry calls
 * `posthog?.captureException(err)` and lands beside every other error. A
 * failure with a real product meaning gets its own named event with bounded
 * properties instead — which is what `clothes_import_failed`,
 * `paywall_unavailable` and `cutout_result` already are.
 */

/**
 * Bounded, non-identifying properties.
 *
 * Numbers, booleans, short enums. Never a garment name, a question, a note, a
 * city or a file path — those are user content, and user content in an event
 * property is the most common way analytics quietly becomes a data-processing
 * liability.
 */
export type EventProps = Record<string, number | boolean | string | undefined>;

/**
 * Emit an event. Safe to call when analytics are unconfigured.
 *
 * The follow-up this comment used to owe — `clothes_import_failed` with no
 * call site — is paid: `upload-queue.ts` now emits it at each of its eight
 * terminal `stage: 'failed'` transitions, with a bounded `reason` produced by
 * `analyticsFailureReason` in that file rather than the raw `job.error`.
 */
export function track(event: AppEvent, properties?: EventProps): void {
  if (!posthog) return;
  // `undefined` is allowed in EventProps so call sites can write optional
  // fields naturally, but PostHog's JsonType is strict — strip them here once
  // rather than at every call site.
  const clean = properties
    ? Object.fromEntries(
        Object.entries(properties).filter(
          (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
        ),
      )
    : undefined;
  posthog.capture(event, clean);
}

/**
 * Who the current person is, for scoping the once-per-user flags below.
 *
 * Written only by `identifyUser`, which is itself called from exactly one
 * place — the auth subscription in `_layout.tsx`. This is not a second source
 * of identity, it is a local copy of the one that already exists, because
 * `trackOnce` needs the id from outside React and PostHog's own distinct id is
 * an anonymous UUID until `identify` lands.
 */
let currentUserId: string | null = null;

/** Namespace for the once-per-user flags. Same kv-store the queue persists to. */
const ONCE_PREFIX = 'cinch.analytics.once.';

/**
 * Fire an event at most once per person, ever.
 *
 * WHY THIS IS NOT A `useRef` AT THE CALL SITE. `closet_ready` marks a crossing
 * that is observed by a screen the user opens every morning. A ref guards one
 * mount; a module variable guards one launch; neither survives the app being
 * killed, so both would re-emit activation on the second day, the third, and
 * for as long as the closet stays usable — which is forever. The only guard
 * that matches the claim "this person activated" has to outlive the process,
 * so it is written to storage.
 *
 * THREE LAYERS, IN THIS ORDER.
 *
 *  1. `firedOnce`, in memory, so two observers racing inside one launch (The
 *     Ten's stop sheet and Today's first render land in the same second) can
 *     never both get past the check — a storage read is synchronous here, but
 *     the set makes the intent explicit and costs nothing.
 *  2. The user-scoped key, which is the real flag.
 *  3. The anonymous key, read as well as the user-scoped one. `identifyUser`
 *     runs from `onAuthStateChange`, so there is a narrow window on a cold
 *     start where a screen behind the auth gate can render before this file
 *     has been told who it is. An event emitted in that window is attributed
 *     correctly anyway — PostHog merges the anonymous id into the person on
 *     `identify` — but its flag would be filed under 'anonymous', and the next
 *     launch would find the user-scoped key empty and emit a second one.
 *     Reading both closes that. The anonymous key can only ever be written
 *     while no identity exists, so it is written at most once per install.
 *
 * The flag is set BEFORE the capture, matching the review prompt in
 * `features/share/capture-plate.ts`: losing one event to a crash between the
 * two is a smaller error than emitting activation twice for the same person.
 *
 * A storage failure falls through to firing — an unmeasured activation is
 * worse than a possible duplicate, and layer 1 still holds for the session.
 */
const firedOnce = new Set<string>();

export function trackOnce(event: AppEvent, properties?: EventProps): void {
  if (!posthog) return;

  const scoped = `${ONCE_PREFIX}${event}.${currentUserId ?? 'anonymous'}`;
  const anonymous = `${ONCE_PREFIX}${event}.anonymous`;
  if (firedOnce.has(scoped) || firedOnce.has(anonymous)) return;
  firedOnce.add(scoped);

  try {
    if (Storage.getItemSync(scoped) !== null || Storage.getItemSync(anonymous) !== null) return;
    Storage.setItemSync(scoped, '1');
  } catch {
    // kv-store unavailable. Fire anyway; the in-memory set bounds this launch.
  }

  track(event, properties);
}

/**
 * Bind analytics to the signed-in identity, or clear it.
 *
 * Called from the single auth subscription in `_layout.tsx` rather than from a
 * hook, so there is exactly one place that decides who the current person is.
 * `userId` is the Supabase UUID and the only identifier sent.
 */
export function identifyUser(userId: string | null): void {
  currentUserId = userId;
  if (!posthog) return;
  if (userId) {
    posthog.identify(userId);
    return;
  }
  // The once-per-user flags are keyed by user id and live in storage, so the
  // next person to sign in on this device gets their own. Only the in-memory
  // mirror has to be dropped — keeping it would let the previous person's
  // flags suppress the new one's first activation for the rest of the launch.
  firedOnce.clear();
  // `reset` rotates the anonymous id so the next signed-out session is not
  // attributed to the person who just signed out — which matters on a shared
  // device and is the whole reason this is called on SIGNED_OUT.
  posthog.reset();
}

/**
 * Provider wiring.
 *
 * Renders children untouched when unconfigured. Both autocapture surfaces are
 * OFF, each for its own reason:
 *
 * `captureTouches` records the accessibility labels of whatever was tapped,
 * and in this app those labels are garment names — user content.
 *
 * `captureScreens` relies on a NavigationContainer this app does not own:
 * expo-router wraps @react-navigation/native without exposing it, and the
 * SDK's own types say to disable this and capture screens manually for
 * expo-router apps. With it on, every screen records as a bare "index".
 * Screen views come from `useScreenTracking` below instead, which reads the
 * router's pathname — stable route names like /closet and /stylist, and no
 * params, which for the plan screen would include dates.
 */
export function Analytics({ children }: { children: React.ReactNode }) {
  if (!posthog) return <>{children}</>;

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{ captureTouches: false, captureScreens: false }}
    >
      {children}
    </PostHogProvider>
  );
}

/**
 * Manual screen tracking for expo-router. Mount once, inside the router.
 *
 * `$screen_name` is the property PostHog's screen insights read; using
 * `posthog.screen()` keeps these as first-class screen views rather than
 * custom events.
 */
export function useScreenTracking(pathname: string): void {
  useEffect(() => {
    posthog?.screen(pathname);
  }, [pathname]);
}

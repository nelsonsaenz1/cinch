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
  // ── Catalogue Photo V2 (CPV2 §7) ──────────────────────────────────────────
  //
  // Nine events, and the union is where "nine" is enforced. Their properties
  // are bounded buckets built in `features/catalogue/buckets.ts`; NOTHING here
  // may carry a query, a transcript, a brand, a product title, a colour name,
  // an external id or a URL. `tests/catalogue-client.test.ts` reads the
  // emitting module and fails if any call could.
  /** The matcher was offered — typed field, mic, or a walkthrough card. Denominator. */
  | 'catalogue_search_offered'
  /** Somebody actually asked. Denominator for the two below. */
  | 'catalogue_search_started'
  | 'catalogue_search_completed'
  | 'catalogue_family_opened'
  | 'catalogue_colours_selected'
  | 'catalogue_import_started'
  | 'catalogue_import_completed'
  | 'catalogue_search_failed'
  | 'catalogue_search_recovered'
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
   *
   * `source` is 'engine' | 'ai' and is part of the KEY as well as a property.
   * Today enhances in place — the on-device scorer's set paints in about ten
   * milliseconds and the model's re-ranked set replaces it seconds later — and
   * those are two different things shown to the reader, one of which we paid
   * for. The re-rank picks from the same shortlist, so it routinely returns the
   * same plates in the same order and a joined-ids key alone would never see
   * the second set. A like rate that differs sharply between the two sources is
   * the direct read on whether the re-rank is worth paying for; without the
   * split there is no way to ask.
   */
  | 'outfit_set_viewed'
  /** An outfit recorded as actually worn — the habit metric. */
  | 'outfit_worn'
  /** An outfit placed on a day in the weekly plan. */
  | 'outfit_planned'
  /**
   * The plan write was refused or failed — the counterweight to
   * `outfit_planned`, without which the Plan tab could only ever report
   * success. `reason` is bounded by `planFailureReason` (plan/mutations.ts):
   * limit | transport | not_signed_in | unknown.
   */
  | 'outfit_plan_failed'
  /** The Plan tab, on first FOCUS of a launch (see use-tab-visited.ts). */
  | 'plan_opened'
  /**
   * The lifestyle questionnaire saved. `stage` is the closed LIFE_STAGES key
   * (or 'none'), `occasions` is a COUNT with a ceiling of six — never the
   * occasion keys themselves. Which occasions somebody dresses for is a fact
   * about their life, and the count is all any funnel needs.
   */
  | 'style_profile_saved'
  /** The lifestyle questionnaire declined. `step` says how far they looked. */
  | 'style_profile_skipped'
  /**
   * DENOMINATOR for both: the questionnaire genuinely on screen during
   * onboarding. The Settings editor does not fire it — an edit is not an offer.
   */
  | 'style_profile_offered'
  /**
   * "Recreate this look" opened — the denominator for the two below. Fired
   * when the screen mounts, not when a photo is picked.
   */
  | 'recreate_opened'
  /**
   * One inspiration analysed and matched. COUNTS ONLY — `pieces`, `matched`,
   * `gaps`, all bounded by the analysis's own eight-piece ceiling. Never a
   * piece description, colour, or category: what somebody's saved
   * inspiration contains is theirs.
   */
  | 'recreate_analyzed'
  /** A recreated look kept. `pieces` is a count, same rule. */
  | 'recreate_saved'
  /**
   * A hand-composed outfit settled — the /compose screen, born of the app's
   * first support email. `pieces` is a count; `worn` says which of the two
   * doors was taken. Never the pieces.
   */
  | 'own_outfit_composed'
  /**
   * Explore's shop shelf settled a load. `cards` and `kinds` are counts —
   * even the slot NAMES stay out, since which kinds a closet holds is the
   * closest thing this feature knows to closet content.
   */
  | 'explore_shop_feed_loaded'
  /**
   * A shelf item opened the merchant's page. Carries at most `shelf`, a
   * two-value enum ('partner' from the partner shelf; absent from the
   * closet-similarity feed) — never the merchant, kind or title. Both load
   * events share the same bound: counts and the shelf word, nothing else.
   */
  | 'explore_shop_product_opened'
  /**
   * A Pinterest OAuth attempt settled. `outcome` is one of the closed
   * connect codes (connected | canceled | denied | failed | not_configured).
   * Nothing about the Pinterest account: no username, no board, no token —
   * the connection's existence is the only fact recorded.
   */
  | 'pinterest_connect_settled'
  /** The person disconnected Pinterest. The event is the whole payload. */
  | 'pinterest_disconnected'
  /**
   * A board-led inspiration turn settled. `outcome` is 'ok' or a
   * bounded failure code; `relevant` and `outfits` ride along on success.
   * NEVER the question, the board, or anything about a Pin — the same
   * counts-only rule as `recreate_analyzed`, for the same reason.
   */
  | 'stylist_inspiration'
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
   *
   * This and its two outcomes (`auth_completed`, `auth_failed`) fire BEFORE
   * `identifyUser`, so they attach to the anonymous distinct id. That is
   * required, not a flaw: the funnel has to span the moment the identity is
   * created, and PostHog aliases the anonymous id onto the identified one on
   * `identify()`, so it stitches together on its own.
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
   * A REAL purchase or restore completed through a paywall — the funnel's
   * bottom, and the only event in the trio that names money changing hands.
   *
   * Fired from the same branch of `use-gate.ts`'s `settle()` that routes to
   * MB-06, which is the one place a genuine `purchased`/`restored` result is
   * distinguishable from a non-gated dismissal or a campaign skip (both also
   * settle `granted`, neither sets `purchase`). So this can never overcount:
   * it fires exactly when the thanks screen is earned.
   *
   * WHY CLIENT-SIDE WHEN §2.3 OF docs/analytics.md SENDS REVENUE THROUGH THE
   * WEBHOOK: the webhook knows the money but not the moment — Superwall's
   * server event has no idea which placement raised the sheet. Only the
   * client holds both at once. Reconciled revenue stays webhook-truth; this
   * carries the attribution (`placement`, plus `result`:
   * 'purchased' | 'restored') that turns `paywall_presented` into revenue
   * per paywall view instead of a bare impression count.
   */
  | 'paywall_converted'
  /**
   * A qualified promotional path was EVALUATED — shown or not. Fired by
   * `present-promo.ts` every time it runs its qualification checks, before any
   * sheet exists, with `placement`, `eligible`, and a bounded `reason` saying
   * which check decided it (a frequency cap, an existing entitlement, a
   * cooldown — never free text). Historical rows carry
   * `reason: 'import_failure_grace'` from the ten-minute suppression that
   * shipped 09-01 and was reverted 09-03 (ledger A16) — none fire now.
   *
   * THE DENOMINATOR THE FUNNEL HAS ALWAYS LACKED. `paywall_presented` counts
   * sheets that appeared; nothing counted the moments one was considered.
   * Without this, a frequency cap that suppresses nine in ten promotional
   * opportunities is indistinguishable from a placement nobody reaches — the
   * presented count falls and no chart can say whether that is the cap doing
   * its job or the trigger going dark. `paywall_eligible` (eligible: true) →
   * `paywall_presented` should track 1:1; a gap between them is a presentation
   * failure, and the `eligible: false` share by `reason` is the read on
   * whether the caps are tuned or strangling the funnel.
   */
  | 'paywall_eligible'
  /**
   * A visibly-presented paywall resolved 'declined' — the reader saw the offer
   * and closed it. Carries `placement` only.
   *
   * The missing middle outcome. `paywall_presented` opens the trio and
   * `paywall_converted` closes the happy path, but a presentation that ends in
   * neither a conversion nor a `paywall_unavailable` fail-safe was, until now,
   * inferred by subtraction — and subtraction cannot survive an event that
   * drops or a session that dies mid-sheet. VISIBLY-PRESENTED is the bound:
   * a campaign skip or a silent render never fires this, because a decline
   * means a human declined, and that is the number the paywall's design is
   * judged on.
   */
  | 'paywall_dismissed'
  /**
   * The StoreKit trial-eligibility check returned. Fired on evaluation by
   * `trial-eligibility.ts`, with a single bounded `state`:
   * 'eligible' | 'ineligible' | 'unknown'.
   *
   * The 7-day trial on cinch.standard.annual is a REAL StoreKit introductory
   * offer (replacing the old server-side silent trial), which means Apple —
   * not our ledger — decides who may have it: one introductory offer per
   * Apple ID per subscription group, ever. A paywall that promises "7 days
   * free" to somebody StoreKit will charge immediately is a broken promise at
   * the worst possible moment, so the check runs before the promise is made,
   * and this event is the measure of how often each answer comes back.
   * `unknown` is a real state, not a failure bucket: StoreKit can decline to
   * answer (offline, products not yet loaded), and the share of `unknown`
   * decides whether trial copy may ever be shown optimistically.
   */
  | 'trial_eligibility'
  //
  // ── The server-side subscription lifecycle — deliberately NOT here ────────
  //
  // Trial started / trial converted / trial expired, purchase completed,
  // subscription renewed / canceled / expired, entitlement activated: these
  // are SERVER facts, recorded in the `superwall_events` ledger (the
  // `period_type` column carries trial vs normal) and reconciled via SQL —
  // see docs/analytics.md §2a.3 and §7.
  //
  // They are kept out of this union on purpose, and the reason is the same
  // one that makes `paywall_converted` client-side: each side of the wire
  // knows one half. The client knows the moment and the placement; the server
  // knows the money and the truth. A client cannot be trusted to report that
  // a renewal happened (the app may not be running), that a trial converted
  // (Apple bills with no UI involved), or that a subscription expired (the
  // person may have deleted the app) — a client event for any of these would
  // be a number that is wrong by construction, missing exactly the cases that
  // matter. The webhook receives every one of them with svix-id idempotency,
  // the ledger keeps them, and the join back to these client events is the
  // Supabase user id. Adding a client-side `trial_started` to this union
  // would fork the truth into two names, one of which lies.
  //
  /**
   * A garment import that never reached `done` — the terminal failure of an
   * upload-queue job, and the counterweight to `clothes_import_selected`.
   * Without it the activation funnel could only say that people stopped
   * importing, never that the app dropped what they imported.
   *
   * `stage` is the `JobStage` it died at (`preparing`, `cutout`, `uploading`,
   * `writing`, `tagging`); `reason` is a bounded classification produced by
   * `analyticsFailureReason` in `import-failure-classify.ts`, never
   * `job.error` itself, which is free text written for a human-readable
   * banner. `retryable` says whether the queue will offer another go, which
   * separates "we lost it" from "we paused on it". For the row-write
   * classifications — `row_write_failed`, `closet_limit_reached`,
   * `storage_limit_reached` — `code` carries the Postgres/PostgREST error
   * code (`23514`, `PGRST301`, `no_code`, `net_error`): a fixed vocabulary,
   * not free text, added after 2026-09-01 spent a day theorising about a
   * defect whose SQLSTATE the client had discarded (CMO ledger A15).
   *
   * A refused closet slot fires ONCE per batch, not once per photograph:
   * `held` carries how many photographs that single refusal parked (ledger
   * A28 — the 46-events-in-44-seconds shape this replaces).
   *
   * TERMINAL ONLY. The drain loop re-queues a job that has attempts left, and
   * that transition writes no event: an import that fails twice and then
   * succeeds is a success, and counting its stumbles would make the failure
   * rate a measure of network weather rather than of lost garments.
   */
  | 'clothes_import_failed'
  /**
   * A batch of garment-image signings came back with refusals. `requested`
   * and `failed` are COUNTS — never a path, never a URL. Fires once per
   * batch that had any failure. Added 2026-09-03 after a closet rendered
   * blank on every surface with nothing in analytics to show for it.
   */
  | 'image_sign_failed'
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
  /**
   * A tagged garment corrected by hand. `fields` is which ones, sorted, and
   * `verified` says whether this was the review deck or a later edit.
   *
   * THE NUMBER THAT JUDGES THE TAGGER, and the counterpart to
   * `intake_card_edited` for the photographed path rather than the spoken one.
   * An accuracy figure from fixtures says how the model does on photographs
   * somebody chose; this says how it does on the ones people take, which is
   * the only version of the question that decides whether the cheap model
   * stays. `verified` matters because a correction in the deck means the model
   * was wrong, while an edit in item detail is as often somebody changing
   * their mind about what a coat cost.
   *
   * FIELD NAMES ONLY — never the old or new value. A corrected brand or colour
   * is the user's own text about their own possessions.
   */
  | 'item_tag_corrected'
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
  | 'intake_failed'
  /** A compatible EAS update check began on launch or foreground return. */
  | 'update_check_started'
  /** The check completed with a bounded current/available result. */
  | 'update_check_finished'
  /** A compatible update bundle finished downloading. */
  | 'update_downloaded'
  /** The person accepted the restart prompt. */
  | 'update_reload_requested'
  /** A check, download or reload failed; properties contain bounded enums only. */
  | 'update_failed'
  /**
   * A sign-in attempt produced a session.
   *
   * Fired from `features/auth/actions.ts`, not from a screen — the magic-link
   * route completes in a deep-link handler with no screen of its own, and an
   * emit per screen would have missed exactly the path the funnel exists to
   * measure.
   */
  | 'auth_completed'
  /**
   * A sign-in attempt did not produce a session. `reason` is the existing
   * `SignInResult` enum, never an error message — those carry addresses and
   * tokens. `canceled` lives here rather than in its own event: dismissing the
   * Apple sheet is the single most common outcome, and splitting it out makes
   * the funnel harder to read, not easier.
   *
   * `code` (Apple path only, since 2026-08-30) is a bounded diagnostic from
   * the CLOSED set in `sign-in-errors.ts` — the module's own ERR_* enum,
   * `no_identity_token`, or `supabase_<status>` — added because nine users
   * were locked out over ten days and `reason: 'failed'` could not say why.
   * Still never a sentence.
   */
  | 'auth_failed'
  // ── Daily Social (docs/design/daily-social-contract.md §5.6) ──────────────
  //
  // THE FIRST SOCIAL EVENTS THIS TAXONOMY HAS EVER HAD. The 47 that precede
  // them contain no `friend_added`, no `explore_viewed`, no `comment_posted` —
  // so this is where social measurement starts, and it has to be right the
  // first time.
  //
  // Their properties are built by pure functions in
  // `features/daily-social/analytics.ts`, and the rule that governs them is
  // absolute: NO user id, friend id, outfit id or item id in any property,
  // ever. Counts, booleans and short bounded enums only.
  //
  // There is deliberately no `daily_social_look_viewed`, and the absence is
  // the design. An event per friend's look would rebuild a record of who looks
  // at whom, inside a third-party analytics store, which is worse than doing
  // it in the database. `tests/daily-social-feed.test.ts` fails if one appears.
  /** The daily read was opened. `item_count`, and which of the six states. */
  | 'daily_social_opened'
  /** `items_seen` and `reached_end` — whether "finite" actually works. */
  | 'daily_social_completed'
  /** `reaction`: which of the three, and nothing about who or what. */
  | 'daily_social_reacted'
  /** `flag` (the column) and `hidden` — are the four §5.1 controls used? */
  | 'closet_visibility_changed'
  /** `shared`. With a default of off, the number the unit lives or dies on. */
  | 'worn_outfits_sharing_changed'
  /** `reason`: three different emptinesses, one of which is a content problem. */
  | 'daily_social_empty'
  // ── Private groups (internal programme: Private Circles) ──────────────────
  //
  // The Daily Social rule, and one clause stricter. Their properties are built
  // by pure functions in `features/circles/analytics.ts`, and NO id of any
  // kind may appear in one — but neither may a COUNT. A feed's `item_count` is
  // harmless; a group's size is one of the most identifying things about it,
  // because a group is a small closed set of specific people rather than a
  // stream. Where the useful measure is a count, it is taken by counting
  // events: one `circle_invite_sent` per invitation actually written.
  //
  // There is deliberately no `circle_opened` and no `circle_roster_viewed`.
  // Which small rooms a person visits, and how often, is not a thing to
  // reconstruct inside a third-party store.
  /** A group was made. No properties at all. */
  | 'circle_created'
  /** One invitation was written. No properties — the count is the event count. */
  | 'circle_invite_sent'
  /** `reason`: 'group_full' | 'not_mutual'. Blocked and no-longer-mutual are one value. */
  | 'circle_invite_blocked'
  /** `answer`: 'accepted' | 'declined'. Never which group, never who asked. */
  | 'circle_invitation_answered'
  /** Somebody was asked back — the reversibility path. No properties. */
  | 'circle_member_reinvited'
  /** `how`: 'left' | 'removed'. One event, because the pair is only read as a pair. */
  | 'circle_membership_ended'
  /** A group was renamed. No before, no after — both are user content. */
  | 'circle_renamed'
  /** A group was deleted. No size, no age: how big a room was when it closed identifies it. */
  | 'circle_deleted'
  // ── Activity Center (design-refs/ACTIVITY-CENTER-IMPLEMENTATION.md §8) ────
  //
  // The private-groups rule, plus one clause the groups rule did not need: no
  // PAYLOAD. Every property below is built by a pure function in
  // `features/activity-center/analytics.ts`, and not one of them accepts an
  // `ActivityEvent` — an event carries `actor_id`, `subject_id`, `circle_id`
  // and a payload holding a group name, four disclosures one spread away from
  // the wire, so the builders take the two or three bounded values instead and
  // the narrowing is visible in the diff at the call site.
  //
  // NO `item_count`, which is where this is stricter than Daily Social. A
  // feed's count describes a stream; this one would describe how much private
  // traffic one specific person receives, and a shape plus a timestamp plus a
  // device id is identifying in exactly the way `circle_deleted` argues above.
  //
  // There is deliberately no `activity_row_viewed`. An impression per row would
  // rebuild, inside a third-party store, a record of who is in somebody's
  // groups and who reacts to their looks.
  /** The timeline was opened. `had_unseen` (the dot's own boolean) and a latency band. */
  | 'activity_opened'
  /** A row was opened. `event_type`, `was_grouped`, `is_revoked` — three bounded values. */
  | 'activity_item_opened'
  /** `action`: open | accept | decline | dismiss | undo | clear_all | retry, plus a coarse surface. */
  | 'activity_action'
  /** `error_class`: offline | unauthorized | server | unknown. Never the message. */
  | 'activity_failed'
  // ── Saved looks (OUTFIT-SAVING-HANDOFF §6) ────────────────────────────────
  //
  // The handoff writes these dotted — `saved.save_created`. They are underscored
  // here because this union is snake_case throughout and the comment at the top
  // of it says why: that is what PostHog's own UI, its SQL surface and every
  // insight builder assume. The namespace survives as a prefix, one-to-one and
  // reversibly, and `tests/saved-looks-client.test.ts` reads the handoff's table
  // back to prove the mapping is total.
  //
  // Their properties are built by pure functions in
  // `features/saved-looks/analytics.ts` under the Daily Social rule and one
  // clause more: no user, friend, source-owner, look, item, collection or note
  // identifier, name, image URL or free text, AND no raw count — every number
  // below is banded to four values by `countBucket`. A feed's `item_count` is
  // harmless because a feed is other people's content arriving; the exact size
  // of a private collection is an attribute of one person.
  //
  // There is deliberately no `saved_look_opened` per look and no event carrying
  // a collection's ordinal, even though §6's preamble permits the latter. Which
  // private shelves a person visits, and how often, is not a thing to
  // reconstruct inside a third-party store — the same refusal that kept
  // `circle_opened` out of the eight above.
  /** A save landed, or met one that already existed. `was_duplicate` is the database's answer. */
  | 'saved_save_created'
  /** A save was removed. `via` measures OS-07's claim that no action is gesture-only. */
  | 'saved_save_removed'
  /** Undo, inside the five-second window. No properties. */
  | 'saved_confirmation_undo'
  /** DENOMINATOR: the grid was genuinely on screen with cards in it. */
  | 'saved_list_viewed'
  | 'saved_collection_created'
  /** A collection was renamed. No before, no after — both are user content. */
  | 'saved_collection_renamed'
  | 'saved_collection_deleted'
  /** `is_all` only. Never which collection, never its name, never its ordinal. */
  | 'saved_filter_applied'
  /** `availability` and `has_note`. The only read on whether OS-06 is ever reached. */
  | 'saved_detail_viewed'
  /** An unavailable source was SEEN — in the grid or on the detail. */
  | 'saved_source_unavailable_seen'
  | 'saved_plan_created'
  /** `loading` | `offline` | `error`: how often this screen shows no list at all. */
  | 'saved_state_shown'
  | 'saved_retry_tapped'
  /**
   * ── TODAY, REDESIGN 11 ────────────────────────────────────────────────────
   *
   * Thirteen events and a closed allowlist: Today emits these and nothing else.
   * The screen previously sent `outfit_set_viewed` with a plate COUNT; that is
   * gone from this surface, replaced by `plate_viewed` with a position, because
   * a count of somebody's morning is a fact about their wardrobe and a position
   * is a fact about the carousel.
   *
   * Every payload is built by a pure function in `features/today/analytics.ts`
   * and every one of them is a bounded enum or a boolean. Forbidden in all
   * thirteen: user id, garment id, outfit id, image URL or path, garment or
   * outfit name, city, coordinates, precise or coarse location, calendar text,
   * and free text of any kind. `tests/today-analytics.test.ts` walks every
   * builder and every legal enum value rather than trusting this comment.
   */
  | 'today_opened'
  /** Which of the three plates is on screen — a position, never a count. */
  | 'plate_viewed'
  /** Which engine produced the set being read: the device, or the enhancement. */
  | 'outfits_source'
  /**
   * Which of the four truthful weather states the read is in.
   *
   * The STATE only. Never the temperature and never the condition, because a
   * reading plus a timestamp is a location to anybody holding enough of them.
   */
  | 'weather_state'
  | 'wear_started'
  /** Whether the write landed. A failure is retryable, so this can fire twice. */
  | 'wear_result'
  /** Whether a rating was given at all — never which one. */
  | 'rating_set'
  /**
   * `StoreReview.requestReview()` was CALLED after a settled wear — iOS never
   * says whether a card appeared, so this counts asks, not ratings. No
   * properties: the wear it followed is its own event.
   */
  | 'rating_prompt_requested'
  /**
   * Cinch's own recurring review card appeared (components/rating/
   * review-prompt.tsx) — distinct from `rating_prompt_requested`, which is
   * the OS card. No properties.
   */
  | 'review_prompt_shown'
  /** How the card was answered: rate | already | later. Nothing else. */
  | 'review_prompt_action'
  /** Whether the look was kept — never which look. */
  | 'favorite_set'
  /** Show another ran out of genuinely different looks and said so. */
  | 'repeat_exhausted'
  /** Nothing clean and suitable was available. An outcome, not an error. */
  | 'no_viable_combination'
  /** The activation floor was shown: "Start with ten pieces." */
  | 'closet_floor_shown'
  /**
   * Today's standing reveal invitation was drawn — a generating closet whose
   * account has never seen the Reveal. Once per account by construction
   * (`reveal_seen_at` closes it), carrying nothing, the floor's rule.
   */
  | 'reveal_door_shown'

  // ── Redesign 12 · The Reveal ──────────────────────────────────────────────
  //
  // Three additions, all bounded, all built by
  // `features/onboarding/reveal-analytics.ts` — a module with no import of
  // this one, so the node suite can execute every builder and assert the
  // payloads rather than grep the call sites.

  /**
   * Which beat the sequence reached: arriving | computing | counting |
   * settled | cascade | complete | zero. Never a duration, never what drew.
   */
  | 'reveal_phase'
  /**
   * How the reader left: open_today | dismissed | unavailable | purchase |
   * zero_repair | zero_open_today. `dismissed` and `unavailable` stay apart
   * because a refusal and an outage are different facts, even though both
   * land on the same Today with the same free tier intact.
   */
  | 'reveal_exit'
  /**
   * WHICH OF FIVE BUCKETS the outfit count fell into — 0 | 1 | 2-9 | 10-49 |
   * 50+ — and never the count itself. The exact number is a deterministic
   * function of one person's wardrobe with a long tail: 184 is close to
   * unique, and joined to a timestamp it is a fingerprint.
   */
  | 'outfit_count_bucket'

  // ── Redesign 14 · The Closet ──────────────────────────────────────────────
  //
  // Six additions, all bounded, all built by
  // `features/closet/closet-analytics.ts` — a module with no import of this
  // one, so the node suite can execute every builder and assert the payloads
  // rather than grep the call sites.

  /** WHICH rails were on screen: none | worn | outfits | both. */
  | 'closet_viewed'
  /**
   * WHICH KINDS of filter were active: category | search | both. Never the
   * category as text, and never the query — somebody typing a brand or
   * "interview" into their own closet is telling this app about their life.
   */
  | 'closet_filter'
  /**
   * One, many or all — never the number. A wardrobe size is a wealth proxy and
   * a near-unique figure, which is why the bucket travels and the count does
   * not.
   */
  | 'closet_selection'
  /** What was attempted and whether it landed. Never to what. */
  | 'closet_bulk'
  /** Which of the three walls: room | active_full | total_full. */
  | 'closet_capacity_state'
  /** The plans door was opened. No plan, no price, no ceiling. */
  | 'closet_plans_door_opened'

  // ── Redesign 15 · Item detail ─────────────────────────────────────────────
  //
  // Eight additions, all bounded, all built by
  // `features/item/item-analytics.ts` — a module with no import of this one,
  // so the node suite can execute every builder and assert the payloads.
  //
  // Three forbidden things are worth naming here as well as there. THE PRICE
  // VALUE is what somebody paid for a coat, which is income data by another
  // name. A WEAR COUNT is a behavioural fingerprint. And FRIEND IDENTITY is
  // the reason lending reports a bare boolean: who may borrow a piece is a
  // fact about two people and only one of them is here.

  /** The visit. Nothing about the piece — not even whether it has a price. */
  | 'item_detail_viewed'
  /** WHETHER a price was added. Never the number. */
  | 'price_added'
  /** WHETHER lending was turned on. Never for whom, and never to whom. */
  | 'lending_set'
  /** Which maintenance door was used: retag | send_back | view_original. */
  | 'maintenance_action'
  /** WHETHER the listing photograph was removed. */
  | 'listing_photo_removed'
  /** WHETHER storing landed. */
  | 'item_stored'
  /** WHETHER deleting landed. */
  | 'item_deleted'
  /**
   * Why something did not land, as a bounded CAUSE — never the server's
   * message. A raw error string is free text with an unbounded shape, and the
   * one time it carries a row id nobody notices until it is in a warehouse.
   */
  | 'action_failed'

  // ── Redesign 16 · The Stylist ─────────────────────────────────────────────
  //
  // Ten additions, all bounded, all built by
  // `features/stylist/stylist-analytics.ts` — a module with no import of this
  // one, so the node suite can execute every builder and assert the payloads.
  //
  // The forbidden list is led by one thing: THE PROMPT. A stylist question is
  // somebody describing their own life in their own words — a funeral, an
  // interview, a first date — and it is the most sensitive string this app
  // ever holds. It is answered on the device or sent to one bounded model
  // boundary, and it reaches a warehouse under no circumstances.

  /** The desk was opened. Nothing about the person or their closet. */
  | 'stylist_opened'
  /** WHICH of the four doors, by position. Never its label or its intent. */
  | 'door_tapped'
  /** How far into the on-device questionnaire. A step, never an answer. */
  | 'questionnaire_step'
  /** THAT a question was sent. Never the question. */
  | 'chat_sent'
  /** THAT a reply landed. Never the reply. */
  | 'chat_reply_ok'
  /**
   * Why a turn failed: plan_excluded | quota | transport | consent. Four
   * bounded causes with four different remedies, and never the server's
   * message.
   */
  | 'chat_error'
  /** How many plates the reply drew — a property of the reply, not the closet. */
  | 'plates_shown'
  /** THAT a plate was opened. Never which garment. */
  | 'plate_tapped'
  /** WHETHER the quiet chats-left mark was on screen. */
  | 'allowance_mark_shown';

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
 * Person properties — attributes of the PERSON, not of one event.
 *
 * These exist so every event can be segmented by plan, closet size and cohort
 * without any event having to carry them. Same bound as `EventProps`: numbers,
 * booleans and short fixed enums. A count is not a list; `garment_count` is
 * how many garments there are and never which ones.
 *
 * `set` is last-write-wins. `setOnce` lands only if the property is absent, and
 * the distinction is load-bearing for anything a cohort is built on: a value
 * that can never legitimately change must not be overwritable by a later,
 * possibly wrong, derivation — an overwrite there silently rewrites history in
 * every cohort chart already drawn from it.
 *
 * Delegates to the SDK's own `setPersonProperties` rather than re-calling
 * `identify()`. Re-identifying the same person on every plan or closet change
 * builds an alias chain for no reason, and the SDK's version additionally
 * dedupes an unchanged payload in memory — a second guard behind the caller's
 * own, which is the one that survives a remount.
 *
 * The third argument suppresses a feature-flag reload. Every person update
 * would otherwise fire a flags request, and this app evaluates no flags at all;
 * that is a network round trip per plan change bought for nothing.
 */
export type PersonProps = Record<string, number | boolean | string>;

export function setPersonProperties(set: PersonProps, setOnce?: PersonProps): void {
  posthog?.setPersonProperties(set, setOnce, false);
}

/**
 * Bind analytics to the signed-in identity, or clear it.
 *
 * Called from the single auth subscription in `_layout.tsx` rather than from a
 * hook, so there is exactly one place that decides who the current person is.
 * `userId` is the Supabase UUID and the only identifier sent.
 *
 * `signupWeek` is set-once here rather than alongside the other person
 * properties, because this is the one place the account's creation time is
 * already in hand — it rides on the auth session and costs no extra read. It is
 * an ISO week string (`2026-W32`), which is a bucket, not a timestamp: it
 * cohorts a user without pinning them to a moment.
 */
export function identifyUser(userId: string | null, signupWeek?: string | null): void {
  currentUserId = userId;
  if (!posthog) return;
  if (userId) {
    posthog.identify(userId);
    if (signupWeek) setPersonProperties({}, { signup_week: signupWeek });
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

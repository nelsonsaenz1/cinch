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
  /** An outfit recorded as actually worn — the habit metric. */
  | 'outfit_worn'
  /** An outfit placed on a day in the weekly plan. */
  | 'outfit_planned'
  /** The stylist answered a question successfully. */
  | 'stylist_question_answered'
  /** A guided stylist questionnaire tapped through to the end. */
  | 'stylist_questionnaire_completed'
  /** The share sheet was opened for an outfit card. */
  | 'outfit_shared'
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
   * upload-queue job. `stage` is the pipeline step it died at (e.g. `cutout`,
   * `uploading`, `tagging`); `reason` is a short, bounded cause, never the raw
   * error string. No call site exists yet: `upload-queue.ts` and its list UI
   * are out of this change's territory. See the deferred call sites noted in
   * `track`'s doc comment below.
   */
  | 'clothes_import_failed'
  /**
   * A generic JS exception, for manual `catch` blocks that want a typed event
   * rather than reaching for `posthog.captureException` directly. The
   * top-level hook below does NOT emit this — the installed SDK supports
   * native exception autocapture, so uncaught errors and unhandled rejections
   * are captured as PostHog's own `$exception` event instead, the same way
   * `useScreenTracking` below emits `$screen` outside this union. `client_error`
   * stays reserved for a deliberate, in-app `catch`, with only a bounded
   * `name`/`message`/first stack frame — never the full stack or user content.
   */
  | 'client_error';

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
 * FOLLOW-UP OWED: `clothes_import_failed` has no call site yet.
 * `src/features/ingest/upload-queue.ts` is where a job's `stage` actually
 * flips to `'failed'` — see the `update(jobId, { stage: 'failed', error })`
 * calls around lines 286, 305, 687, 705, 805 and 876 — and
 * `src/components/ingest/upload-queue-list.tsx` is the only UI that renders
 * that state (its `Thumb`, `failed`/`job.error`). Both are out of this
 * change's territory (capture/ingest is explicitly excluded), and neither is
 * reachable from any file this change was allowed to touch, so the event is
 * declared here and unwired. The natural fix is one `track('clothes_import_failed',
 * { stage: job.stage, reason: <bounded classification of job.error> })` per
 * terminal `'failed'` transition in `upload-queue.ts` — `reason` should be a
 * short enum classifying the failure, not `job.error` itself, which is
 * free-text meant for the human-readable banner.
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
 * Bind analytics to the signed-in identity, or clear it.
 *
 * Called from the single auth subscription in `_layout.tsx` rather than from a
 * hook, so there is exactly one place that decides who the current person is.
 * `userId` is the Supabase UUID and the only identifier sent.
 */
export function identifyUser(userId: string | null): void {
  if (!posthog) return;
  if (userId) {
    posthog.identify(userId);
    return;
  }
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

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
    })
  : null;

if (__DEV__ && !token) {
  console.warn(
    'EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is unset — analytics are disabled. ' +
      'Every feature still works; nothing is measured.',
  );
}

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
  | 'paywall_presented';

/**
 * Bounded, non-identifying properties.
 *
 * Numbers, booleans, short enums. Never a garment name, a question, a note, a
 * city or a file path — those are user content, and user content in an event
 * property is the most common way analytics quietly becomes a data-processing
 * liability.
 */
export type EventProps = Record<string, number | boolean | string | undefined>;

/** Emit an event. Safe to call when analytics are unconfigured. */
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
 * Sent as a `$set` event rather than a re-`identify()`. Re-identifying the same
 * person on every plan or closet change is how an alias chain gets built for no
 * reason; `$set` is the operation that is actually meant.
 */
export type PersonProps = Record<string, number | boolean | string>;

export function setPersonProperties(set: PersonProps, setOnce?: PersonProps): void {
  if (!posthog) return;
  const hasSet = Object.keys(set).length > 0;
  const hasSetOnce = setOnce !== undefined && Object.keys(setOnce).length > 0;
  if (!hasSet && !hasSetOnce) return;
  posthog.capture('$set', {
    ...(hasSet ? { $set: set } : {}),
    ...(hasSetOnce ? { $set_once: setOnce } : {}),
  });
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
  if (!posthog) return;
  if (userId) {
    posthog.identify(userId);
    if (signupWeek) setPersonProperties({}, { signup_week: signupWeek });
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

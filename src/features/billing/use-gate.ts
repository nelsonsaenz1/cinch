import { usePlacement, useSuperwall, useSuperwallEvents } from 'expo-superwall';
import type { SuperwallEventInfo } from 'expo-superwall';
import { useCallback, useId, useMemo } from 'react';

import { track } from '@/lib/posthog';

import type { PlacementName } from './placements';
import { PAYWALLS_ENABLED } from './superwall';

/**
 * Turning a server refusal into a paywall.
 *
 * The server is the authority and always says no first — `claim_ai_quota` for
 * the AI workloads, the `items_enforce_limit` trigger for closet size. This
 * module never decides whether someone may do a thing; it only decides what to
 * show once the answer is already no.
 */

/** Why the server refused, as far as the paywall is concerned. */
export type Denial =
  /** The plan never included this. Offer an upgrade — "try again tomorrow" is a lie. */
  | { kind: 'plan_excluded' }
  /** The allowance ran out and will come back. */
  | { kind: 'quota_exceeded'; retryAfterSeconds: number | null }
  /** The closet is full for this plan. */
  | { kind: 'closet_full' };

/**
 * Classify an error thrown by a Supabase call, or null if it is not a refusal.
 *
 * Two shapes, because there are two enforcement points:
 *
 * Edge Functions answer 402/`plan_upgrade_required` and 429/`ai_quota_exceeded`
 * with a JSON body. `functions.invoke` does NOT put that body on `data` for a
 * non-2xx — it throws a `FunctionsHttpError` and hangs the original response off
 * `context`, which is why this has to await `.json()` rather than read a field.
 * Miss that and every quota refusal reads as a generic network failure, which is
 * exactly what the stylist did before this existed.
 *
 * PostgREST answers the closet trigger with a plain Postgres error whose message
 * carries the `closet_limit_reached` sentinel raised in migration
 * 20260805160000.
 *
 * A 503 `quota_unavailable` is deliberately NOT a denial. The counter being
 * unreachable is an outage, and showing someone a paywall because the database
 * hiccuped is how you get a refund request.
 */
export async function classifyDenial(error: unknown): Promise<Denial | null> {
  if (!error || typeof error !== 'object') return null;

  const message = 'message' in error ? String(error.message) : '';
  if (message.includes('closet_limit_reached')) return { kind: 'closet_full' };

  const response = (error as { context?: unknown }).context;
  if (!(response instanceof Response)) return null;
  if (response.status !== 402 && response.status !== 429) return null;

  try {
    // `clone()` because the caller may also want to read this body for its own
    // error copy, and a Response body can only be consumed once.
    const body = (await response.clone().json()) as {
      error?: string;
      retryAfterSeconds?: number;
    };

    if (body.error === 'plan_upgrade_required') return { kind: 'plan_excluded' };
    if (body.error === 'ai_quota_exceeded') {
      return { kind: 'quota_exceeded', retryAfterSeconds: body.retryAfterSeconds ?? null };
    }
  } catch {
    // A refusal we cannot parse is still a refusal — the status code alone is
    // enough to know the server said no, and guessing the reason is better than
    // silently doing nothing. 402 is the plan boundary by definition.
    return response.status === 402 ? { kind: 'plan_excluded' } : { kind: 'quota_exceeded', retryAfterSeconds: null };
  }

  return null;
}

/**
 * What became of one gate presentation.
 *
 * Returned so a caller can tell "the user saw the offer and said no" from "the
 * offer never reached the user", which are different things to say back to them.
 * Nothing is obliged to read it — every existing call site fires and forgets,
 * and the fail-safe below does not depend on anyone checking.
 */
export type GateOutcome =
  /** Access granted: purchased, restored, or the campaign let this user through. */
  | 'granted'
  /** A working paywall was shown and the user closed it without buying. */
  | 'declined'
  /**
   * No usable offer reached the user — the paywall failed to load, rendered
   * broken, timed out, or paywalls are not configured in this build. The caller's
   * own refusal copy is the right thing to leave on screen.
   */
  | 'unavailable';

export type Gate = {
  /**
   * Ask Superwall to handle this moment.
   *
   * `onGranted` runs only if access is granted — Superwall calls it after a
   * successful purchase, or immediately when the campaign decides this user
   * should not see a paywall at all. It does NOT run when a gated paywall is
   * dismissed without purchasing, which is what makes this a gate rather than a
   * notification.
   *
   * Resolves with what happened. It never rejects and it never hangs: see the
   * fail-safe contract below.
   */
  present: (
    placement: PlacementName,
    onGranted?: () => void | Promise<void>,
  ) => Promise<GateOutcome>;
};

/**
 * THE FAIL-SAFE CONTRACT, and why it lives here rather than at each call site.
 *
 * A paywall is the only surface in Cinch that Cinch does not draw. It is a
 * WKWebView whose contents come from a dashboard, presented by a native view
 * controller we do not own, over a modal we cannot reach around. When that
 * content is wrong — a paywall left unpublished, a campaign whose products were
 * never attached to a StoreKit configuration — what the user gets is a
 * full-screen sheet of flat grey with no close button on it. There is no back
 * gesture, because it is not a navigation. There is no X, because the X is part
 * of the content that failed to load. The only way out is to force-quit the app.
 *
 * That is not a lost sale. That is a user losing their session, their unsaved
 * capture, and their patience, because a row in someone's dashboard was not
 * flipped to "published". It is also, for exactly the same reason, not fixable
 * at the call site: `capture.tsx` cannot know that the sheet it just triggered
 * came up empty, and even if it could, it has nothing to dismiss it with.
 *
 * So the guarantee is written once, here, and every placement inherits it:
 *
 *   1. WATCH the SDK's own failure stream. Superwall reports a paywall that
 *      could not be found, whose response failed to load, whose web view failed
 *      or timed out or whose renderer died, and — the case that produced this
 *      bug — whose products are missing from the store. Any of those means the
 *      thing on screen cannot be bought from.
 *   2. On any of them, call `dismiss()`. That is the SDK's own programmatic
 *      teardown of whatever it is presenting, and it is the escape hatch the
 *      broken content does not draw for itself.
 *   3. TIME OUT anything that neither presents nor reports. `registerPlacement`
 *      is documented by expo-superwall itself as never resolving on error
 *      ("Native won't resolve the register promise on error"), so awaiting it
 *      alone is a hang by construction.
 *   4. Resolve with `unavailable` so the caller falls back to the refusal copy
 *      it already has, instead of waiting on a promise that will never settle.
 *
 * The failure direction is chosen deliberately. Being wrong in the safe
 * direction costs a sale: a healthy paywall is torn down and the user sees the
 * plain "you have hit your limit" text instead of an offer. Being wrong in the
 * other direction costs the app. So every ambiguity below resolves towards
 * dismissing.
 */

/**
 * Superwall events that mean the thing on screen is not a working paywall.
 *
 * `paywallProductsLoadFail` and `paywallProductsLoadMissingProducts` are the two
 * that catch the live repro: a campaign with zero products still presents, it
 * just presents nothing anyone can buy. `paywallResponseLoadNotFound` catches the
 * unpublished paywall. The webview trio catches a renderer that died or never
 * arrived, which is the literal grey rectangle.
 *
 * A products-load failure is treated as terminal even though the SDK may retry
 * (`paywallProductsLoadRetry`): a paywall with no purchasable product is a dead
 * end whether or not the next attempt succeeds, and the user should not be
 * holding a blank sheet while we find out.
 */
const PAYWALL_BROKEN_EVENTS: ReadonlySet<string> = new Set([
  'paywallResponseLoadFail',
  'paywallResponseLoadNotFound',
  'paywallWebviewLoadFail',
  'paywallWebviewLoadTimeout',
  'paywallWebviewProcessTerminated',
  'paywallProductsLoadFail',
  'paywallProductsLoadMissingProducts',
]);

/**
 * Events that prove a paywall is alive, and so disarm the silence watchdog.
 *
 * Deliberately generous — this list only cancels a TIMER, never a failure. A
 * broken event still tears the sheet down after any of these, so erring towards
 * "alive" here cannot resurrect the trap; it only stops the watchdog from
 * closing a healthy paywall on someone who is reading it slowly.
 */
const PAYWALL_ALIVE_EVENTS: ReadonlySet<string> = new Set([
  'paywallOpen',
  'paywallPageView',
  'paywallWebviewLoadComplete',
  'paywallProductsLoadComplete',
  'shimmerViewComplete',
  'touchesBegan',
  'transactionStart',
  'surveyResponse',
]);

/**
 * Nothing at all has happened since `registerPlacement` was called — no
 * presentation, no skip, no error, no grant. Generous enough to cover a cold
 * config fetch on a bad connection; short enough that nobody is left staring.
 */
const PRESENT_TIMEOUT_MS = 8_000;

/**
 * A paywall was presented and then went silent — never loaded, never opened,
 * never reported a failure. Long, because the cost of being wrong here is
 * closing a working paywall.
 */
const SILENT_RENDER_TIMEOUT_MS = 12_000;

/**
 * How long a dismissal or a skip is given to turn into a grant.
 *
 * Both paths can still resolve `registerPlacement` — a non-gated paywall grants
 * on close, and a skipped placement grants outright — and that resolution is the
 * only thing that runs `onGranted`. Settling the outcome the instant the sheet
 * closed would race it, and could report `declined` for a user the SDK let
 * through. One frame's grace removes the race without anyone noticing a wait.
 */
const GRANT_GRACE_MS = 600;

/** One in-flight presentation. At most one exists: a paywall is modal. */
type Presentation = {
  placement: PlacementName;
  /** Identifies the gate instance that started this one. */
  owner: string;
  settle: (outcome: GateOutcome) => void;
  timer: ReturnType<typeof setTimeout> | null;
  /** True once the paywall has produced any sign of life. */
  alive: boolean;
};

/**
 * The presentation in flight anywhere in the app, or null.
 *
 * MODULE-LEVEL, not a ref, and that is the point. There is one paywall window on
 * iOS and `dismiss()` closes whatever is in it, so a per-screen record of "am I
 * waiting on a paywall" is not enough: Today's trial-expired gate and the
 * stylist's quota gate are different hook instances, and a watchdog belonging to
 * one of them firing `dismiss()` would tear down the other one's perfectly
 * healthy sheet. One window, one record.
 *
 * It also makes the "one at a time" refusal in `present` mean what it says
 * across screens rather than only within one.
 *
 * A plain variable rather than state: every reader is an event callback or a
 * timer, none of them renders, and a re-render per paywall lifecycle event would
 * be waste.
 */
let inFlight: Presentation | null = null;

/**
 * The in-flight presentation, but only if this gate is the one that started it.
 *
 * `usePlacement` already scopes its callbacks by handler id, so a stray event
 * cannot reach the wrong gate — but a LATE one can reach the right gate after
 * its presentation has finished and another screen's has begun. Checking the
 * owner is what stops a trailing `onDismiss` from settling somebody else's
 * paywall.
 */
function owned(ownerId: string): Presentation | null {
  return inFlight && inFlight.owner === ownerId ? inFlight : null;
}

function useSuperwallGate(): Gate {
  /**
   * A stable identity for this gate instance, for the ownership check above.
   *
   * `useId` rather than a counter so it survives Fast Refresh and cannot collide
   * between two gates mounted in the same commit.
   */
  const ownerId = useId();

  const { dismiss } = useSuperwall((state) => ({ dismiss: state.dismiss }));

  const settle = useCallback(
    (target: Presentation, outcome: GateOutcome, reason: string) => {
      // Identity check, not a null check: a timer armed for an earlier
      // presentation must not settle the one that replaced it.
      if (inFlight !== target) return;
      inFlight = null;
      if (target.timer) clearTimeout(target.timer);
      target.timer = null;

      if (outcome === 'unavailable') {
        // THE GUARANTEE. `dismiss()` is a no-op when nothing is presented, so
        // this is safe on the paths where the paywall never appeared, and it is
        // the ONLY exit from one that appeared without a close control.
        void dismiss().catch(() => {
          /* Nothing left to try. Swallowed rather than thrown so a dismissal
             failure cannot also reject the caller's promise — the caller is
             about to be told `unavailable` either way. */
        });
        console.warn(
          `Superwall could not show "${target.placement}" (${reason}). ` +
            'Dismissed so nothing is left on screen; the caller falls back to its own copy.',
        );
      }

      target.settle(outcome);
    },
    [dismiss],
  );

  /** (Re)arm the single watchdog for a presentation. */
  const arm = useCallback(
    (target: Presentation, ms: number, outcome: GateOutcome, reason: string) => {
      if (inFlight !== target) return;
      if (target.timer) clearTimeout(target.timer);
      target.timer = setTimeout(() => settle(target, outcome, reason), ms);
    },
    [settle],
  );

  /**
   * The SDK's whole event stream, which is where the failures actually surface.
   *
   * `usePlacement`'s own `onError` covers presentation errors only; a paywall
   * that presents *successfully* and then fails to load its products or its web
   * view never reaches it. That is precisely the shape of the bug this guards
   * against, so the raw stream has to be read.
   *
   * Every branch is gated on there being a presentation in flight, which is what
   * keeps this inert the rest of the time — several screens hold their own gate,
   * and this subscription is not scoped to one of them.
   */
  useSuperwallEvents({
    onSuperwallEvent: (info: SuperwallEventInfo) => {
      // No owner check: these events are global and describe the one paywall
      // window, whichever gate opened it.
      const target = inFlight;
      if (!target) return;
      const name: string = info.event.event;

      if (PAYWALL_BROKEN_EVENTS.has(name)) {
        settle(target, 'unavailable', name);
        return;
      }

      if (!target.alive && PAYWALL_ALIVE_EVENTS.has(name)) {
        target.alive = true;
        if (target.timer) clearTimeout(target.timer);
        target.timer = null;
      }
    },
  });

  const { registerPlacement } = usePlacement({
    // Fired only when a paywall actually appears — Superwall's campaign can
    // decide to show nothing for a registered placement, and that must not
    // count as an impression or the funnel's top line inflates.
    onPresent: () => {
      const target = owned(ownerId);
      if (!target) return;
      track('paywall_presented', { placement: target.placement });
      // Presented is not the same as rendered. Restart the clock against the
      // sheet that comes up and then does nothing at all.
      if (!target.alive) arm(target, SILENT_RENDER_TIMEOUT_MS, 'unavailable', 'silent_render');
    },
    onDismiss: (_info, result) => {
      const target = owned(ownerId);
      if (!target) return;
      // A purchase or a restore also resolves `registerPlacement`, and that is
      // the path that runs `onGranted`; let it win rather than reporting an
      // outcome the caller's own callback would contradict.
      arm(target, GRANT_GRACE_MS, result.type === 'declined' ? 'declined' : 'granted', result.type);
    },
    onSkip: () => {
      const target = owned(ownerId);
      if (!target) return;
      // No paywall is coming. A skip normally grants — the campaign decided this
      // user should pass — so wait briefly for that resolution rather than
      // calling it unavailable while `onGranted` is still on its way.
      arm(target, GRANT_GRACE_MS, 'unavailable', 'skipped_without_grant');
    },
    onError: (error) => {
      const target = owned(ownerId);
      if (!target) return;
      settle(target, 'unavailable', `sdk_error: ${error}`);
    },
  });

  const present = useCallback(
    async (
      placement: PlacementName,
      onGranted?: () => void | Promise<void>,
    ): Promise<GateOutcome> => {
      // One paywall at a time. A second request while one is in flight would put
      // two settlements on one modal; the honest answer for the newcomer is that
      // it did not get through.
      if (inFlight) return 'unavailable';

      let resolveOutcome!: (outcome: GateOutcome) => void;
      const outcome = new Promise<GateOutcome>((resolve) => {
        resolveOutcome = resolve;
      });

      const target: Presentation = {
        placement,
        owner: ownerId,
        settle: resolveOutcome,
        timer: null,
        alive: false,
      };
      inFlight = target;

      arm(target, PRESENT_TIMEOUT_MS, 'unavailable', 'no_response');

      // NOT awaited. expo-superwall's own source says the native side does not
      // resolve this promise when a paywall errors, so `await registerPlacement`
      // — which is what this function used to do — hangs for the life of the
      // process. The promise is one of several ways the presentation can settle,
      // never the only one.
      void registerPlacement({
        placement,
        feature() {
          void onGranted?.();
        },
      }).then(
        () => settle(target, 'granted', 'feature'),
        (error: unknown) => settle(target, 'unavailable', `register_rejected: ${String(error)}`),
      );

      return outcome;
    },
    [arm, ownerId, registerPlacement, settle],
  );

  // Memoized so the Gate is stable across renders: consumers put it in effect
  // dependency arrays (use-trial-expired.ts), where a fresh object literal per
  // render would re-run the effect every render.
  return useMemo(() => ({ present }), [present]);
}

/**
 * The no-key build.
 *
 * `onGranted` is deliberately NOT called. There is no paywall to buy through, so
 * running it would let a keyless build past a limit the server has already
 * refused — the request would just fail again, and the user would watch it fail
 * twice. Doing nothing leaves the caller's own error copy on screen, which is
 * the honest outcome — and `unavailable` is the exact word for it.
 */
function useDisabledGate(): Gate {
  const present = useCallback(async (): Promise<GateOutcome> => 'unavailable', []);
  return useMemo(() => ({ present }), [present]);
}

/**
 * Picked once, at module load.
 *
 * `usePlacement` throws when there is no provider above it, so the disabled
 * build must never reach it. Branching here rather than inside the hook keeps
 * the call unconditional from React's point of view — a conditional hook call
 * is something the React Compiler (enabled in app.config.ts) rejects outright.
 */
export const useGate: () => Gate = PAYWALLS_ENABLED ? useSuperwallGate : useDisabledGate;

import { usePlacement } from 'expo-superwall';
import { useCallback, useMemo, useRef } from 'react';

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

export type Gate = {
  /**
   * Ask Superwall to handle this moment.
   *
   * `onGranted` runs only if access is granted — Superwall calls it after a
   * successful purchase, or immediately when the campaign decides this user
   * should not see a paywall at all. It does NOT run when a gated paywall is
   * dismissed without purchasing, which is what makes this a gate rather than a
   * notification.
   */
  present: (placement: PlacementName, onGranted?: () => void | Promise<void>) => Promise<void>;
};

function useSuperwallGate(): Gate {
  /**
   * The placement most recently handed to `registerPlacement`, so the
   * analytics event can carry it — `onPresent` receives Superwall's
   * PaywallInfo, which names the paywall but not the placement that opened it.
   *
   * A ref, and knowingly imprecise: if two placements from the same hook
   * instance raced, the second could mislabel the first's presentation. In
   * practice each screen holds its own gate and a paywall is modal, so the
   * race needs two simultaneous denials on one screen to matter — and the
   * cost is one mislabelled analytics row, not misbehaviour.
   */
  const lastPlacement = useRef<PlacementName | null>(null);

  const { registerPlacement } = usePlacement({
    // Fired only when a paywall actually appears — Superwall's campaign can
    // decide to show nothing for a registered placement, and that must not
    // count as an impression or the funnel's top line inflates.
    onPresent: () => {
      track('paywall_presented', { placement: lastPlacement.current ?? 'unknown' });
    },
  });

  const present = useCallback(
    async (placement: PlacementName, onGranted?: () => void | Promise<void>) => {
      lastPlacement.current = placement;
      await registerPlacement({
        placement,
        feature() {
          void onGranted?.();
        },
      });
    },
    [registerPlacement],
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
 * the honest outcome.
 */
function useDisabledGate(): Gate {
  const present = useCallback(async () => {}, []);
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

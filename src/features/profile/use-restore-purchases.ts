import { useQueryClient } from '@tanstack/react-query';
import { useSuperwall } from 'expo-superwall';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { PAYWALLS_ENABLED } from '@/features/billing/superwall';
import type { RestoreOutcome } from '@/features/profile/settings-copy';

/**
 * The Settings page's "Restore purchases" row — App Store Guideline 3.1.1
 * expects a restore path anywhere subscriptions are sold, and a settings list
 * is where people go looking for it after a reinstall or a new phone.
 *
 * Programmatic restore, not a paywall: `useSuperwall` exposes the SDK's
 * `restorePurchases()` directly, so nobody has to summon a paywall they do not
 * want just to reach its restore link.
 */
export type RestorePurchases = {
  /** False in a keyless build — the row should not render at all. */
  available: boolean;
  restoring: boolean;
  restore: () => void;
};

export type RestoreOptions = {
  /**
   * UX-08, without moving the classification for a surface that did not ask
   * for it.
   *
   * Two screens call this hook: Settings (this program's) and `/membership`
   * (MB-08, nobody's in this pass). A restore that succeeds is a success and a
   * restore that finds nothing is recoverable, so neither belongs in a blocking
   * `Alert` — but silently deleting the alerts would leave the membership page
   * with no ending at all, which is a worse failure than the wrong container.
   *
   * So the caller opts in. Pass `onOutcome` and the hook reports instead of
   * interrupting, and the surface renders the toast or the notice band itself.
   * Pass nothing and the alerts are exactly what they were.
   */
  onOutcome?: (outcome: RestoreOutcome) => void;
};

function useSuperwallRestore({ onOutcome }: RestoreOptions = {}): RestorePurchases {
  const restorePurchases = useSuperwall((state) => state.restorePurchases);
  const qc = useQueryClient();
  const [restoring, setRestoring] = useState(false);

  // `onOutcome` is a plain dependency rather than a ref. A ref written during
  // render is what `react-hooks/refs` rejects, and there is nothing to buy here
  // anyway: the only caller passes `useState`'s own setter, which is stable for
  // the life of the screen, so this callback's identity is as steady as it was
  // before the option existed.
  const restore = useCallback(() => {
    if (restoring) return;
    setRestoring(true);
    restorePurchases()
      .then(async (result) => {
        if (result.result === 'restored') {
          // The entitlement flows server-side (App Store Server Notifications →
          // `subscriptions.plan`), so the local row may lag the restore by a
          // beat. Invalidating asks for the fresh answer; usePlan's
          // refetch-on-focus would catch it eventually regardless.
          await qc.invalidateQueries({ queryKey: ['subscription'] });
          if (onOutcome) onOutcome('restored');
          else Alert.alert('Purchases restored', 'Your membership is back on this device.');
        } else if (onOutcome) {
          onOutcome('none');
        } else {
          // Our copy, not `result.errorMessage` — the SDK's message is a
          // StoreKit internals string, and the provider's `restoreFailed`
          // options (billing/superwall.tsx) only dress the in-paywall path.
          Alert.alert(
            'No subscription found',
            "We couldn't find a Cinch subscription on this Apple ID. If you paid on another account, sign in to that one and try again.",
          );
        }
      })
      .catch(() => {
        if (onOutcome) {
          onOutcome('failed');
          return;
        }
        Alert.alert(
          'Could not restore purchases',
          'Something went wrong talking to the App Store. Nothing has changed — try again in a moment.',
        );
      })
      .finally(() => setRestoring(false));
  }, [restoring, restorePurchases, qc, onOutcome]);

  return { available: true, restoring, restore };
}

function useDisabledRestore(_options: RestoreOptions = {}): RestorePurchases {
  return useMemo(() => ({ available: false, restoring: false, restore: () => {} }), []);
}

/**
 * Picked once at module load, same reasoning as `useGate` in
 * billing/use-gate.ts: `useSuperwall` throws with no provider above it, and a
 * keyless build deliberately mounts none — so the disabled build must never
 * reach the hook, and the branch cannot live inside one (the React Compiler
 * rejects conditional hook calls).
 */
export const useRestorePurchases: (options?: RestoreOptions) => RestorePurchases = PAYWALLS_ENABLED
  ? useSuperwallRestore
  : useDisabledRestore;

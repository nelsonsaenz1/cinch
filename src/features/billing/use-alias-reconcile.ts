import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Claim a purchase made before this device had signed in.
 *
 * Audit item 24. Superwall attributes anything bought before `identify()` to an
 * anonymous `$SuperwallAlias:<uuid>` that maps to no Supabase user, so
 * `superwall-webhook` writes no plan and the purchase is queued in
 * `superwall_events` instead. Nothing drained that queue: the person paid, and
 * the app carried on showing them the free tier until their next renewal — up to
 * a year for an annual plan.
 *
 * So at the moment the two identities are joined, the app hands the server the
 * alias it was using a moment earlier, and the server pays out anything owed.
 *
 * ── Why the alias is the app's to send ──────────────────────────────────────
 *
 * The alias is generated on-device by SuperwallKit, kept on-device, and sent to
 * nobody else. The server never learns it any other way — the only place it
 * appears is inside the webhook payload, under a name that means nothing until
 * something connects it to a person. This is that something.
 *
 * The user id is NOT sent: `superwall-reconcile` takes it from the verified JWT,
 * so a caller can only ever claim a purchase for themselves.
 */

/**
 * Remembers the alias already offered for a given user.
 *
 * Not a correctness guard — the server binds each alias exactly once and is the
 * real authority — but without it every cold start of a signed-in install posts
 * an alias that was settled months ago. The key pairs the user with the alias
 * so that a genuinely new alias (a reinstall, a sign-out and back in) is still
 * offered once.
 */
const OFFERED_KEY = 'cinch.aliasReconciledFor';

/** The shape `superwall-reconcile` answers with. */
export type ReconcileOutcome =
  | { ok: true; reconciled: true; plan: string; events: number }
  | { ok: true; reconciled: false; reason: string };

export function useAliasReconcile(): (userId: string, alias: string | null) => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(
    async (userId: string, alias: string | null) => {
      if (!alias) return;

      const marker = `${userId}:${alias}`;
      const offered = await AsyncStorage.getItem(OFFERED_KEY);
      if (offered === marker) return;

      // Written only on a settled answer, never before the call. The other
      // ordering loses the purchase permanently to one dropped connection —
      // and unlike the trial-expired marker, the cost of repeating this is a
      // no-op round trip rather than an unwanted interruption.
      const { data, error } = await supabase.functions.invoke<ReconcileOutcome>(
        'superwall-reconcile',
        { body: { alias } },
      );

      if (error) {
        // Deliberately quiet. The user did not ask for this and has no action to
        // take; the next launch tries again, and the operator view
        // (`superwall_unreconciled`) still lists anything that never settles.
        console.warn('Could not check for an earlier purchase.', error);
        return;
      }

      await AsyncStorage.setItem(OFFERED_KEY, marker);

      if (data?.reconciled) {
        // The plan changed underneath a cache that has a five-minute stale time
        // and is persisted across launches, so nothing would show it until the
        // app was restarted twice.
        await queryClient.invalidateQueries({ queryKey: ['subscription'] });
        console.log(`Applied an earlier anonymous purchase: ${data.plan}.`);
      }
    },
    [queryClient],
  );
}

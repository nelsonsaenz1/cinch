import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLANS } from '@/features/billing/plans';
import {
  clearPaywallOrigin,
  peekPaywallOrigin,
  returnLabelFor,
  type PaywallOrigin,
} from '@/features/billing/paywall-origin';
import { MembershipThanksView } from '@/features/billing/membership-thanks-view';
import { usePlan } from '@/features/billing/use-plan';
import { thanksVerified } from '@/features/membership/membership-surface';

/** Same URL `profile.tsx`'s Membership section already hands a paying user to. */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * MB-06 — "Bought, straight back to the thing they wanted."
 *
 * Pushed by `use-gate.ts` the instant `onDismiss` reports a real `purchased`
 * or `restored` result, never on a silent skip (contract §7, and see the long
 * comment on `Presentation.purchase` there for why that distinction matters —
 * a skip means the user already had access and never bought anything).
 *
 * ── "REACHED EXACTLY ONCE" WAS AN ASSUMPTION, NOT A GUARANTEE ─────────────
 *
 * `/membership-thanks` is a path in the route tree like any other. A typed
 * deep link reaches it, a restored navigation state reaches it, and any
 * `router.push` somebody adds later reaches it — and on every one of those the
 * screen opened with "You're in." and "Your purchase went through", which is a
 * receipt printed from a URL. Navigation is not evidence of a transaction.
 *
 * The evidence is `paywall-origin.ts`'s record, which `settle()` writes on a
 * real purchase or restore and on nothing else. `thanksVerified()` is the one
 * question this screen asks of it; without it the page draws a neutral
 * reconciliation — what the subscription read says, and a way back — and never
 * claims anything was bought.
 */
export default function MembershipThanksScreen() {
  const qc = useQueryClient();
  const plan = usePlan();

  // Read once. A later purchase elsewhere in the app (Settings' own
  // "Upgrade") must not rewrite the origin out from under a thanks screen
  // that is already on the stack — see paywall-origin.ts's own note.
  const [origin] = useState<PaywallOrigin | null>(() => peekPaywallOrigin());
  const verified = thanksVerified(origin);

  // The webhook that fills `subscriptions.plan` and `current_period_end`
  // (`supabase/functions/superwall-webhook`) can genuinely lag the purchase
  // sheet closing by a few seconds. One extra ask for a fresher read beats
  // showing this screen's own five-minute `staleTime` snapshot of "free" to
  // someone who just paid.
  const invalidated = useRef(false);
  useEffect(() => {
    if (invalidated.current) return;
    invalidated.current = true;
    void qc.invalidateQueries({ queryKey: ['subscription'] });
  }, [qc]);

  const goBack = () => {
    clearPaywallOrigin();
    // `router.back()` returns to the exact screen state the purchase
    // interrupted — the stylist's answer still queued, the camera still
    // open — which `router.replace(route)` cannot promise. The route is
    // only the fallback for a cold relaunch mid-purchase, where there is no
    // history to go back to.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // `origin.route` came out of `usePathname()`, so it is a real route by
    // construction — but typed routes only accept literals it can see in the
    // route tree, and a value read at runtime is never one of those. The cast
    // is the narrowest possible: a bad string here lands on `+not-found`,
    // which is a worse screen than "back" and not a crash.
    router.replace((origin?.route ?? '/') as '/');
  };

  // `paid`, not `plan !== 'free'`: the trial fold made a free account read as
  // Pro from the first frame (verification, UX-5).
  const planKnown = !plan.loading && plan.paid;

  /**
   * Clear on the way out, however the reader leaves.
   *
   * `goBack` already clears, but a swipe-back dismisses the screen without
   * touching it — and a record left standing is a later, unrelated visit to
   * this route inheriting a purchase that has already been reported. The
   * origin's own docblock has always described this cleanup; nothing did it.
   */
  useEffect(() => clearPaywallOrigin, []);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center px-gutter">
        <MembershipThanksView
          verified={verified}
          loading={plan.loading}
          planKnown={planKnown}
          planName={`Cinch ${PLANS[plan.ownedPlan].name}`}
          renewsOn={
            plan.currentPeriodEnd
              ? plan.currentPeriodEnd.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : null
          }
          returnLabel={returnLabelFor(origin?.placement ?? null)}
          onBack={goBack}
          onManage={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
        />
      </View>
    </SafeAreaView>
  );
}

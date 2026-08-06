import { useEffect, useRef } from 'react';

import { useSession } from '@/features/auth/use-session';
import { useCapacity } from '@/features/billing/use-capacity';
import { usePlan } from '@/features/billing/use-plan';
import { setPersonProperties } from '@/lib/posthog';

/**
 * Mirror the signed-in user's plan and closet size onto their PostHog person.
 *
 * Without these, the only thing analytics knows about anyone is a UUID — so no
 * chart can be cut by plan, by closet size or by cohort, and most of what
 * `docs/analytics.md` sets out to answer is unrunnable. All three are counts
 * and enums; none of them identify anybody.
 *
 * A NULL-RENDERING COMPONENT, NOT A HOOK, and the reason is mount order rather
 * than taste. `useAnalyticsIdentity()` in `_layout.tsx` runs in `RootLayout`'s
 * own body, which sits OUTSIDE `PersistQueryClientProvider` — and `usePlan` and
 * `useCapacity` are both `useQuery` calls, which throw with no client above
 * them. Putting this work in that hook fails at runtime and compiles fine. As a
 * component it mounts inside the provider tree, where the queries are legal.
 * `SuperwallIdentity` in `features/billing/superwall.tsx` is the same shape for
 * the same reason.
 */
export function AnalyticsProperties() {
  const session = useSession();
  const { plan, trialing, loading: planLoading } = usePlan();
  const { used, loading: capacityLoading } = useCapacity();

  /**
   * The last payload actually sent, as a scalar key.
   *
   * Two separate things make an unguarded effect wrong here, and the ref
   * answers both:
   *
   * `useCapacity` goes stale after sixty seconds and is invalidated after every
   * upload, and `usePlan` refetches on focus. An effect keyed on their values
   * therefore re-runs constantly with identical values — each one a person
   * update sent to PostHog, and person updates are billed events.
   *
   * The user id is IN the key rather than compared separately, so a second user
   * signing in on the same device always sends, even when their plan and closet
   * size happen to match the person who just signed out.
   *
   * Written in an effect, never during render: the React Compiler rejects a ref
   * write in a render path outright.
   */
  const sent = useRef<string | null>(null);

  useEffect(() => {
    // Signed out. Clear the memo so the next sign-in is always a fresh send —
    // `identifyUser(null)` has reset the distinct id by now, and the new person
    // starts with no properties at all.
    if (session.loading || !session.userId) {
      sent.current = null;
      return;
    }

    // WAIT FOR REAL VALUES. `usePlan()` reports `free` and `useCapacity()`
    // reports 0 while their queries are still pending, and a person property is
    // last-write-wins — so sending the placeholders records every user as a
    // free account with an empty closet, and a user who backgrounds the app
    // before the real values land keeps that record. There is no hurry here;
    // the properties attach to every future event either way.
    if (planLoading || capacityLoading) return;

    const key = `${session.userId}|${plan}|${trialing}|${used}`;
    if (sent.current === key) return;
    sent.current = key;

    setPersonProperties({
      plan,
      trialing,
      // Raw, not bucketed. PostHog can bucket a number at query time; a bucket
      // baked in here is a guess about where the interesting boundary sits,
      // made before the data that would tell us exists — and it cannot be
      // undone retroactively.
      garment_count: used,
    });
  }, [session, plan, trialing, used, planLoading, capacityLoading]);

  return null;
}

import { SuperwallProvider, useUser } from 'expo-superwall';
import { useEffect, useRef } from 'react';

import { useSession } from '@/features/auth/use-session';

import { useAliasReconcile } from './use-alias-reconcile';

/**
 * Superwall's iOS key is publishable by construction, exactly like the Supabase
 * anon key: it identifies the project to the paywall service and nothing more.
 * Entitlement state is decided server-side from App Store Server Notifications,
 * so a key lifted out of the `.ipa` buys an attacker a paywall render, not a
 * subscription. It therefore belongs in `EXPO_PUBLIC_*` and in the bundle.
 *
 * Read once at module load. It cannot change during a session, which is what
 * makes the enabled/disabled split below safe to decide at the module level
 * rather than per render.
 */
const iosApiKey = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_IOS;

/**
 * Whether Superwall is configured at all.
 *
 * **Nothing may call an `expo-superwall` hook when this is false.**
 * `useSuperwall` — and therefore `useUser` and `usePlacement` — throws outright
 * with no provider above it, and the disabled branch below deliberately renders
 * none. A keyless checkout is the default for every new contributor
 * (`.env.example` ships the key blank), so an unguarded `usePlacement` crashes
 * the tree on a fresh clone rather than degrading.
 *
 * Mounting the provider unconditionally is NOT the fix: with no key the SDK
 * parks `subscriptionStatus` at `UNKNOWN` forever, so anything waiting on it
 * waits for good.
 *
 * A module constant rather than context, because it is one: it is read from the
 * bundle at import and cannot change while the app runs. That is what lets
 * `use-gate.ts` pick its implementation once at module load instead of calling
 * a hook conditionally, which the React Compiler would reject.
 */
export const PAYWALLS_ENABLED = Boolean(iosApiKey);

/**
 * Bind Superwall's identity to the Supabase one.
 *
 * The id has to be the *Supabase* user id, not a Superwall alias. Entitlements
 * must survive a reinstall and follow the account to a second device, and
 * Superwall's webhooks — which are what will eventually write
 * `subscriptions.plan` — are only joinable if both systems agree on who the
 * user is. Supabase ids are UUIDs, which also satisfies StoreKit's
 * `appAccountToken` requirement; a non-UUID id silently falls back to the
 * anonymous alias.
 */
function SuperwallIdentity() {
  const session = useSession();
  // `refresh` is the SDK's `getUserAttributes`. It is the way to read the alias:
  // `user` is documented null whenever nobody is identified, which is precisely
  // the state whose alias matters, whereas the attributes dictionary carries
  // `aliasId` from SDK init onwards.
  const { identify, signOut, refresh } = useUser();
  const reconcileAlias = useAliasReconcile();

  /**
   * The last id we identified, or null for signed-out.
   *
   * This ref is what makes the effect fire on *transitions* rather than on
   * every resolve, and both halves of that matter:
   *
   * `signOut` is literally the SDK's `reset` — it rotates the on-device alias
   * and clears local paywall assignments. Calling it whenever `userId` is null
   * means calling it on every cold start of a signed-out install: the alias
   * churns each launch, unique-user counts inflate, and anonymous visitors are
   * re-bucketed into a different paywall variant every single time. That is
   * precisely the harm `restorePaywallAssignments` exists to prevent.
   *
   * `identify` needs the same guard for a different reason: `use-session`
   * builds a fresh state object on *every* `onAuthStateChange` event, and
   * Supabase emits `TOKEN_REFRESHED` roughly hourly and on every foreground.
   * Without the ref, each of those re-identifies the same unchanged user.
   */
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (session.loading) return;
    const { userId } = session;

    if (userId) {
      if (identified.current === userId) return;
      identified.current = userId;

      // The alias is read BEFORE `identify`, not after. SuperwallKit only
      // rotates it when moving between two *identified* users, so it would in
      // practice survive — but the ordering that does not depend on that is
      // free, and this is the one moment the anonymous identity still certainly
      // exists. Whatever purchase was made while signed out is filed under this
      // value and under nothing else.
      const anonymous = refresh()
        .then((attributes) => {
          const aliasId = attributes?.aliasId;
          return typeof aliasId === 'string' ? aliasId : null;
        })
        .catch(() => null);

      // `restorePaywallAssignments` makes the SDK hold paywall presentation
      // until the server returns this user's existing variant assignment,
      // rather than showing something now and correcting it after. Worth the
      // wait for an app people reinstall and sign back into.
      identify(userId, { restorePaywallAssignments: true }).catch((error) => {
        // `identify` rejects on its own path when configure failed or timed
        // out — `onConfigurationError` does not cover it, and an unhandled
        // rejection here surfaces as a red box in development.
        console.warn('Superwall identify failed; paywalls stay anonymous.', error);
      });

      // Not awaited against `identify`, and not conditional on it succeeding.
      // The queue on the server was written by Superwall's webhook and is
      // reachable with the alias alone; making the payout depend on a paywall
      // SDK call completing would mean a configure timeout also costs somebody
      // the subscription they bought. Audit item 24.
      void anonymous.then((alias) => reconcileAlias(userId, alias));
      return;
    }

    // Signed out — but only if we were ever signed in. On first resolve of a
    // signed-out launch there is no identity to clear, and clearing it anyway
    // is the alias-churn bug described above.
    if (identified.current === null) return;
    identified.current = null;
    signOut().catch((error) => {
      console.warn('Superwall signOut failed; identity may be stale.', error);
    });
  }, [session, identify, signOut, refresh, reconcileAlias]);

  return null;
}

/**
 * Wraps the app in Superwall, or doesn't.
 *
 * The missing-key branch is deliberate, and is *not* the same call as
 * `lib/supabase.ts`, which throws. Supabase is load-bearing — without it there
 * is no closet and no session, so failing loudly at import time is honest. A
 * paywall is not load-bearing: every feature still works, the user simply is
 * never asked to pay. Hard-failing because monetization is unconfigured would
 * brick every development build for no safety gain.
 */
export function Superwall({ children }: { children: React.ReactNode }) {
  if (!iosApiKey) {
    if (__DEV__) {
      console.warn(
        'EXPO_PUBLIC_SUPERWALL_API_KEY_IOS is unset — paywalls are disabled. ' +
          'Every feature still works; nothing will ever prompt to subscribe.',
      );
    }
    return <>{children}</>;
  }

  return (
    <SuperwallProvider
      apiKeys={{ ios: iosApiKey }}
      options={{
        // Default is info-level across every scope, which ships verbose
        // SuperwallKit logging to TestFlight and the App Store.
        logging: { level: __DEV__ ? 'debug' : 'warn' },
        paywalls: {
          // The Expo SDK's own defaults set this to `false` and deep-merge over
          // anything you pass, so the documented `true` default does not apply
          // here — without this line every placement shows a loading shimmer
          // the first time it fires.
          shouldPreload: true,
          // Otherwise Superwall's stock copy is shown to Cinch users verbatim,
          // in a voice that is not ours.
          restoreFailed: {
            title: 'No subscription found',
            message:
              "We couldn't find a Cinch subscription on this Apple ID. If you paid on another account, sign in to that one and try again.",
            closeButtonTitle: 'OK',
          },
        },
        testModeBehavior: __DEV__ ? 'always' : 'automatic',
      }}
      // A paywall service that is down is a lost sale, not a broken app.
      onConfigurationError={(error) => {
        console.warn('Superwall failed to configure; paywalls are disabled.', error);
      }}
    >
      <SuperwallIdentity />
      {children}
    </SuperwallProvider>
  );
}

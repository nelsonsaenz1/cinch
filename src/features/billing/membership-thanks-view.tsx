import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import {
  THANKS_UNVERIFIED_BODY,
  THANKS_UNVERIFIED_TITLE,
} from '@/features/membership/membership-surface';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * MB-06's body, without the screen chrome around it — split out so
 * `dev-membership.tsx` can render both its states (renewal known, renewal
 * null) side by side without duplicating the layout. `src/app/
 * membership-thanks.tsx` is the only real caller; it supplies live data and
 * wraps this in a `SafeAreaView`.
 *
 * ONE OXBLOOD ACTION — the return button. "Manage" is a plain accent-text
 * row, matching the same control `profile.tsx`'s Membership section already
 * uses to hand a paying user to the App Store; there is no in-app screen
 * that manages a subscription, so this does not invent one. No confetti,
 * per the contract's own last line.
 *
 * ── THE HEADLINE IS A CLAIM ABOUT MONEY ───────────────────────────────────
 *
 * "You're in." and "Your purchase went through" are only drawn where a real
 * purchase or restore was recorded for the presentation that pushed this
 * screen (`verified`). Everything else — a deep link, a restored navigation
 * state — gets a neutral reconciliation of what the subscription read says.
 * The plan card below is a READ either way, so it is honest in both states;
 * only the sentences above and below it were ever the claim.
 */
export type MembershipThanksViewProps = {
  /**
   * A real purchase or restore was recorded for this presentation —
   * `thanksVerified()` over `paywall-origin.ts`, and nothing else.
   *
   * FALSE is not an error and is not drawn as one. It is the screen reached
   * without a transaction behind it (a deep link, a restored navigation
   * state), and what it gets is a reconciliation: what the subscription read
   * currently says, and a way back. No "You're in.", no receipt line, no
   * congratulation — none of which this app is in a position to mean.
   */
  verified: boolean;
  /** True while `subscriptions` is still being (re)read after the purchase. */
  loading: boolean;
  /**
   * False for the narrow window where the purchase succeeded but the row
   * this client can see still reads `free` — the webhook has not landed
   * yet. NEVER draw a plan name that might be stale in this state.
   */
  planKnown: boolean;
  /** "Cinch Pro" / "Cinch Standard". Ignored while `!planKnown`. */
  planName: string;
  /**
   * Formatted renewal date, or `null`. THE HONESTY RULE (contract §7): a
   * null `subscriptions.current_period_end` drops the whole Renews row
   * rather than computing or guessing one. This prop is already the
   * formatted-or-absent value — this component never touches a Date.
   */
  renewsOn: string | null;
  /** From `returnLabelFor` — "Back to the stylist", "Back to the trip", … */
  returnLabel: string;
  onBack: () => void;
  onManage: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-center justify-between px-4 py-3"
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Text variant="label" className="text-muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

export function MembershipThanksView({
  verified,
  loading,
  planKnown,
  planName,
  renewsOn,
  returnLabel,
  onBack,
  onManage,
}: MembershipThanksViewProps) {
  const theme = useTheme();

  return (
    <View>
      <Text variant="title" trim style={{ fontSize: 30, lineHeight: 36 }}>
        {verified ? 'You\u2019re in.' : THANKS_UNVERIFIED_TITLE}
      </Text>

      <Text variant="body" className="mt-2.5" style={{ color: theme.muted }}>
        {loading
          ? 'Confirming with the App Store…'
          : verified
            ? planKnown
              ? `${planName} is active.`
              : "Your purchase went through — Cinch is still confirming the plan on our side. It’ll be here in a moment."
            : planKnown
              ? `${planName} is active on this account.`
              : THANKS_UNVERIFIED_BODY}
      </Text>

      {planKnown ? (
        <Card padding="none" className="mt-5">
          <Row label="Plan" value={planName} />
          {renewsOn ? (
            <>
              <Rule tone="hairline" />
              <Row label="Renews" value={renewsOn} />
            </>
          ) : null}
          <Rule tone="hairline" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage subscription"
            accessibilityHint="Opens your App Store subscriptions"
            onPress={onManage}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="flex-row items-center justify-between px-4 py-3 active:opacity-60">
            <Text variant="label" className="text-muted">
              Manage
            </Text>
            <Text variant="label" className="text-accent">
              In Settings ›
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <Button title={returnLabel} variant="primary" className="mt-6" onPress={onBack} />

      {/* Only where there is a receipt. Promising one for a visit that bought
          nothing is the same lie as the headline, one size smaller. */}
      {verified ? (
        <Text variant="noteSmall" className="mt-3.5 text-center" style={{ color: theme.muted }}>
          A receipt is on its way from Apple.
        </Text>
      ) : null}
    </View>
  );
}

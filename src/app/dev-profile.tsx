import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Profile fixture — `cinch://dev-profile`.
 *
 * Mirrors src/app/profile.tsx (serif masthead with Done, identity row, the
 * "What Cinch has learned" tray card, Membership, Styling switches, People
 * rows, the utility and exit cards, version byline) against hardcoded mock
 * data lifted from the design atlas P-01, so the screen can be judged
 * signed-out. The real screen's data comes from usePlan/useStyleProfile/
 * useAiConsent/useBorrowRequests/a profile-header query, which all hit
 * Supabase or StoreKit — this fixture has no session-dependent hooks.
 * The AI tagging row mirrors the real screen's doorway to /privacy (consent
 * atlas A-06) with a hardcoded "On"; every row and the Done/Edit/Manage
 * actions are no-ops here rather than the real navigation and mutations.
 *
 * The Membership card shows the atlas's renewal date and price. The real
 * screen deliberately cannot (no renewal date or charged price exists
 * client-side — see profile.tsx's planTitle comment); a fixture is the one
 * place the mock's richer line is honest, because it claims nothing about a
 * real subscription.
 *
 * Dev-only, like dev-plate and dev-closet: __DEV__-gated in the auth gate.
 */
const MOCK_NAME = 'Maya Osei';
const MOCK_HANDLE = '@mayaosei';
const MOCK_LEARNED_SENTENCE =
  'Still learning. So far you lean muted, reach for wool, and rarely touch bright colour. Learned from 12 reactions.';
const MOCK_PROGRESS = 46;
const MOCK_PLAN_TITLE = 'Cinch Unlimited';
const MOCK_PLAN_SUBTITLE = 'Renews 4 September · $8.99 / month';
const MOCK_PENDING_ASKS = 2;
const MOCK_VERSION_LINE = 'Cinch 1.0.0 (218)';

/**
 * Same row shape as the real screen's AccountRow — label, glyph, 44pt tap
 * target, `tone="accent"` spent on Delete account alone — minus the loading
 * state (nothing here is ever in flight) and with a no-op press. `external`
 * keeps the real screen's two-glyph promise: chevron means "further in",
 * up-right arrow means "hands you to Safari".
 */
function AccountRow({
  label,
  tone = 'ink',
  detail,
  external = false,
}: {
  label: string;
  tone?: 'ink' | 'accent';
  detail?: string;
  external?: boolean;
}) {
  const theme = useTheme();
  const iconColor = tone === 'accent' ? theme.accent : external ? theme.byline : theme.faint;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {}}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60">
      <Text variant="body" className={tone === 'accent' ? 'text-accent' : 'text-ink'}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {detail ? (
          <Text variant="caption" className="text-muted">
            {detail}
          </Text>
        ) : null}
        <SymbolView
          name={external ? 'arrow.up.right' : 'chevron.right'}
          size={13}
          tintColor={iconColor}
          resizeMode="scaleAspectFit"
        />
      </View>
    </Pressable>
  );
}

export default function DevProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The real screen's masthead: serif page title left, oxblood Done
          right, `pt-5` clearing the sheet grabber. Done goes back when the
          fixture was pushed onto something; via the bare deep link there is
          no history, so it quietly does nothing rather than throwing. */}
      <View className="flex-row items-center justify-between px-gutter pb-1 pt-5">
        <Text variant="title" trim accessibilityRole="header">
          Profile
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={() => {
            if (router.canGoBack()) router.back();
          }}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" className="text-accent">
            Done
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-24">
        {/* Identity row — only the loaded branch. The skeleton and retry
            branches exist to cover a query in flight or failed, and this
            fixture has neither. */}
        <View className="flex-row items-center gap-3.5 px-gutter pb-5 pt-4">
          <Avatar name={MOCK_NAME} size={60} tone="ink" />
          <View className="flex-1">
            <Text variant="title" trim numberOfLines={1}>
              {MOCK_NAME}
            </Text>
            <Text variant="caption" className="mt-1.5 text-muted">
              {MOCK_HANDLE}
            </Text>
          </View>
          {/* The real screen's 32pt bordered pill — `rounded-md`, not a
              capsule, per the type system's borderRadius rule. Opens the edit
              sheet there; a no-op here (the sheet writes to Supabase). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => {}}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            className="h-8 flex-none items-center justify-center rounded-md border border-rule px-3.5 active:opacity-60">
            <Text variant="label" className="text-ink">
              Edit profile
            </Text>
          </Pressable>
        </View>

        <View className="px-gutter">
          {/* The tray card, recessed rather than lifted. The bar is inked by
              hand rather than through ProgressTrack for the same reason as
              the real screen: the primitive's two tones both mean something
              else, and `rule` IS ink at 12%, exactly. */}
          <Card fill="none" border="none" padding="md" className="bg-tray">
            <SectionHeader title="What Cinch has learned" />
            <Text variant="body" className="mt-2.5 text-ink">
              {MOCK_LEARNED_SENTENCE}
            </Text>
            <View className="mt-3.5 flex-row items-center gap-2.5">
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: MOCK_PROGRESS }}
                className="flex-1 overflow-hidden rounded-full"
                style={{ height: 5, backgroundColor: theme.rule }}>
                <View
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${MOCK_PROGRESS}%` }}
                />
              </View>
              <Text variant="caption" className="text-muted">
                {MOCK_PROGRESS}%
              </Text>
            </View>
          </Card>

          {/* Membership, with the atlas's full plan line — see the header
              comment for why the fixture may show a renewal date and price
              the real screen refuses to. Manage opens the App Store's
              subscription list there; nothing of the fixture's exists in the
              App Store, so it is a no-op. */}
          <SectionHeader title="Membership" className="mb-2.5 mt-6" />
          <Card>
            <View
              className="flex-row items-center justify-between gap-3 px-4 py-3.5"
              style={{ minHeight: MIN_TAP_TARGET }}>
              <View className="flex-1 pr-2">
                <Text variant="body">{MOCK_PLAN_TITLE}</Text>
                <Text variant="caption" className="mt-1 text-muted">
                  {MOCK_PLAN_SUBTITLE}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage subscription"
                onPress={() => {}}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                className="active:opacity-60">
                <Text variant="label" className="text-accent">
                  Manage
                </Text>
              </Pressable>
            </View>
          </Card>

          <SectionHeader title="Styling" className="mb-2.5 mt-6" />
          <Card>
            {/* Decorative on the real screen too: local outfit generation has
                no off switch, so the disabled state is faithful, not faked. */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text variant="body">Daily outfit styling</Text>
                <Text variant="caption" className="mt-1 text-muted">
                  Built from your closet, on this phone.
                </Text>
              </View>
              <Switch
                value
                onValueChange={() => {}}
                disabled
                trackColor={{ false: theme.rule, true: theme.ink }}
                accessibilityLabel="Daily outfit styling"
                accessibilityHint="Always on — outfits are generated on this phone, not by AI"
              />
            </View>
            <Rule tone="hairline" />
            {/* The real screen's doorway to Privacy (consent atlas A-06) —
                the switch, honest state line, back-fill and consent record
                live on /privacy now; this row only reports On/Off and leads
                there. A no-op here like every other row. */}
            <AccountRow label="AI tagging" detail="On" />
          </Card>

          <SectionHeader title="People" className="mb-2.5 mt-6" />
          <Card>
            <AccountRow label="Friends" />
            <Rule tone="hairline" />
            <AccountRow label="Borrow requests" detail={`${MOCK_PENDING_ASKS} waiting`} />
            <Rule tone="hairline" />
            <AccountRow label="Blocked people" />
          </Card>

          {/* The utility card — no kicker, per the atlas. Restore purchases
              always renders here: the fixture stands in for the shipping
              build, where Superwall is configured. */}
          <Card className="mt-6">
            <AccountRow label="Restore purchases" />
            <Rule tone="hairline" />
            <AccountRow label="Privacy Policy" external />
            <Rule tone="hairline" />
            <AccountRow label="Support" external />
          </Card>

          {/* The way out, in both weights — Delete account is the only
              critical-coloured thing on the page. Both no-ops: sign-out
              tears down a session this screen never had, and deletion is
              nothing but its mutation. */}
          <Card className="mt-6">
            <AccountRow label="Sign out" />
            <Rule tone="hairline" />
            <AccountRow label="Delete account" tone="accent" />
          </Card>

          {/* Centred, deliberately — the edition mark, not body copy. */}
          <Text variant="caption" className="mt-4 text-center text-byline">
            {MOCK_VERSION_LINE}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

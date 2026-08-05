import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Profile fixture — `cinch://dev-profile`.
 *
 * Mirrors src/app/profile.tsx (masthead, "What Cinch has learned" card, AI
 * styling toggles, Account rows) against hardcoded mock data lifted from the
 * handoff's Frame 09, so the screen can be judged signed-out. The real screen's
 * data comes from useCloset/useStyleProfile/useAiConsent/a profile-header
 * query, which all hit Supabase — this fixture has no session-dependent hooks.
 * The AI-styling switch is locally stateful for a believable screenshot; sign
 * out and delete account are no-ops here rather than the real mutations.
 *
 * Dev-only, like dev-plate and dev-closet: __DEV__-gated in the auth gate.
 */
const MOCK_NAME = 'Mara Kettle';
const MOCK_WEEKS_LABEL = '3 weeks with Cinch';
const MOCK_LEARNED_SENTENCE =
  "Still early. So far: you lean muted, reach for wool, and rarely touch bright colour. Give it another month and I'll know your weekends too.";
const MOCK_PROGRESS = 38;

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2);
  return (letters || '?').toUpperCase();
}

/** Same row shape as the real screen's AccountRow, with a no-op tap target. */
function AccountRow({
  label,
  tone = 'ink',
}: {
  label: string;
  tone?: 'ink' | 'accent';
}) {
  const theme = useTheme();
  const iconColor = tone === 'accent' ? theme.accent : theme.faint;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {}}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60">
      <Text variant="body" className={tone === 'accent' ? 'text-accent' : 'text-ink'}>
        {label}
      </Text>
      <SymbolView name="chevron.right" size={13} tintColor={iconColor} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

export default function DevProfileScreen() {
  const theme = useTheme();
  // Believable interactivity for a screenshot; neither switch calls the real
  // consent grant/revoke mutations.
  const [aiFeaturesOn, setAiFeaturesOn] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-24">
        <View className="flex-row items-center gap-3.5 px-gutter pb-6 pt-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-ink">
            <Text variant="heading" style={{ color: theme.canvas }}>
              {initialsFor(MOCK_NAME)}
            </Text>
          </View>
          <View>
            <Text variant="plate" accessibilityRole="header">
              {MOCK_NAME}
            </Text>
            <Text variant="caption" className="mt-1 text-faint">
              {MOCK_WEEKS_LABEL}
            </Text>
          </View>
        </View>

        <View className="px-gutter">
          <View className="rounded-plate border border-rule bg-surface p-4">
            <Text variant="eyebrow">What Cinch has learned</Text>
            <Text variant="body" className="mt-2.5 text-ink">
              {MOCK_LEARNED_SENTENCE}
            </Text>
            <View className="mt-3.5 flex-row items-center gap-2.5">
              <View className="h-[5px] flex-1 overflow-hidden rounded-full bg-sand">
                <View className="h-full rounded-full bg-accent" style={{ width: `${MOCK_PROGRESS}%` }} />
              </View>
              <Text
                variant="caption"
                className="text-muted"
                style={{ fontFamily: 'InstrumentSerif_400Regular' }}>
                Getting to know you
              </Text>
            </View>
          </View>

          <Text variant="eyebrow" className="mb-2.5 mt-7">
            AI styling
          </Text>
          <View className="overflow-hidden rounded-plate border border-rule bg-surface">
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
            <View className="h-px bg-hairline" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text variant="body">AI features</Text>
                <Text variant="caption" className="mt-1 text-muted">
                  {aiFeaturesOn
                    ? 'Tagging, stylist chat, and outfit write-ups use OpenRouter.'
                    : 'Off — nothing is sent to our AI provider.'}
                </Text>
              </View>
              <Switch
                value={aiFeaturesOn}
                onValueChange={setAiFeaturesOn}
                trackColor={{ false: theme.rule, true: theme.ink }}
                accessibilityLabel="AI features"
                accessibilityHint={
                  aiFeaturesOn ? 'Turns off AI tagging and the stylist chat' : 'Opens the AI consent details'
                }
              />
            </View>
          </View>

          <Text variant="eyebrow" className="mb-2.5 mt-7">
            Account
          </Text>
          <View className="overflow-hidden rounded-plate border border-rule bg-surface">
            <AccountRow label="Privacy" />
            <View className="h-px bg-hairline" />
            <AccountRow label="Support" />
            <View className="h-px bg-hairline" />
            <AccountRow label="Sign out" />
            <View className="h-px bg-hairline" />
            <AccountRow label="Delete account" tone="accent" />
          </View>
          <Text variant="caption" className="mt-3 px-1 text-center text-faint">
            Deleting your account permanently removes your closet, photos, and style profile.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

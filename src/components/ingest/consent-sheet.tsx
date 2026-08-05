import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The first-run AI-processing consent moment — Apple Guideline 5.1.2(i).
 *
 * Matches the handoff's frame 07b: a plain, honest disclosure of exactly what
 * Cinch does with a photo before it does it. The three lines ARE the disclosure
 * — what it does (cleans up, identifies) and what it will never do (sell, share,
 * advertise) — stated plainly rather than buried behind a policy link. Consent
 * is also enforced server-side on every Edge Function call; this is the "ask
 * first" half.
 */
const PROMISES = [
  'Cleans up the photo — removes the background',
  'Identifies the garment, its colours and category',
  'Never sold, never shared, never used to advertise',
];

export function ConsentSheet({
  visible,
  onAccept,
  onDecline,
  busy,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
        <ScrollView contentContainerClassName="px-8 pb-8 pt-10">
          <Text variant="title" trim>
            Before Cinch looks
          </Text>
          <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
            To turn your photos into a wardrobe, Cinch processes each image. Here&apos;s exactly what
            that means.
          </Text>

          <View className="mt-7 gap-4">
            {PROMISES.map((line) => (
              <View key={line} className="flex-row items-center gap-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-light">
                  <SymbolView name="sparkle" size={14} tintColor={theme.accent} resizeMode="scaleAspectFit" />
                </View>
                <Text variant="callout" className="flex-1">
                  {line}
                </Text>
              </View>
            ))}
          </View>

          {/* Withdrawal is real: Profile → "AI features" → Turn off nulls the
              consent record the Edge Functions check. The closet and the
              on-device outfit engine keep working without any AI at all. */}
          <Text variant="label" className="mt-7 text-muted dark:text-muted-dark">
            You can turn AI features off anytime in Profile. Your closet stays, and Cinch keeps
            putting outfits together on your phone — what stops is tagging new pieces and the
            stylist.
          </Text>

          <View className="mt-8 gap-2">
            {/* Ink primary, per the zip — the accent is spent elsewhere. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow processing"
              onPress={onAccept}
              disabled={busy}
              className="h-14 items-center justify-center rounded-plate bg-ink active:opacity-90 dark:bg-ink-dark">
              {busy ? (
                <ActivityIndicator color={theme.canvas} />
              ) : (
                <Text variant="callout" className="font-semibold" style={{ color: theme.canvas }}>
                  Allow processing
                </Text>
              )}
            </Pressable>
            <Button title="Not now" variant="ghost" onPress={onDecline} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

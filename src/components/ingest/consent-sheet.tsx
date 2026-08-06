import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 *
 * PRESENTED AS A BOTTOM SHEET OVER THE DIMMED SCREEN, not a pageSheet. The
 * handoff draws this as a moment INSIDE capture — the stage still visible,
 * dimmed, behind the ask — where a full page reads as being taken somewhere
 * else. A transparent modal with its own scrim and grabber is the cheap 80%
 * of that framing. Tapping the scrim is "Not now": dismissal must never be
 * mistakable for consent.
 */
const PROMISES = [
  'Cleans up the photo — removes the background',
  'Identifies the garment, its colours and category',
  'Never sold, never shared, never used to advertise',
];

/** The scrim over the presenting screen — ink at half strength. */
const SCRIM = 'rgba(28,26,22,0.5)';

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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onDecline();
      }}>
      <View className="flex-1 justify-end" style={{ backgroundColor: SCRIM }}>
        {/* Scrim tap declines. Hidden from assistive tech — the explicit
            "Not now" button below is the accessible way out, and a full-screen
            invisible "button" is noise to a VoiceOver pass. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          disabled={busy}
          onPress={onDecline}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View
          className="rounded-t-plate bg-canvas dark:bg-canvas-dark"
          style={{ maxHeight: '88%' }}>
          {/* The grabber — the sheet's own furniture, saying "this rises over
              capture and drops back into it". */}
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand dark:bg-sand-dark" />
          </View>

          <ScrollView
            contentContainerClassName="px-8 pt-5"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
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

            {/* Below the buttons and centred, per the zip. Withdrawal is real:
                Profile → "AI features" → Turn off nulls the consent record the
                Edge Functions check, and the closet plus the on-device outfit
                engine keep working without any AI at all. */}
            <Text variant="label" className="mt-3 text-center text-muted dark:text-muted-dark">
              You can turn AI features off anytime in Profile.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

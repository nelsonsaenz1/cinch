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

export function ConsentSheet({
  visible,
  onAccept,
  onDecline,
  onDismissed,
  busy,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /**
   * Fired once the sheet has finished LEAVING — not when `visible` flips.
   *
   * This is what makes "Allow processing" open the picker on the first tap.
   * The picker and the describe sheet are both view controllers iOS presents
   * modally, and asking it to present one while this modal is still on its way
   * out is refused outright: the call resolved as though it had been cancelled
   * and the user was left looking at the capture screen, having consented to
   * nothing visible. Whatever was interrupted has to be resumed on the far side
   * of the dismissal, and this is the only signal for that edge.
   */
  onDismissed?: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onDismiss={onDismissed}
      onRequestClose={() => {
        if (!busy) onDecline();
      }}>
      {/* `scrim` is the one dimming value in the system — warm ink at 40%, the
          same wash every other sheet in the app drops over the screen behind
          it. This used to be a hand-written rgba() at 0.5: a second, slightly
          heavier dark that only this sheet knew about. */}
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
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
            contentContainerClassName="px-gutter pt-5"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            <Text variant="title" trim>
              Before Cinch looks
            </Text>
            {/* Tone as an inline style, not a stacked `text-muted`. Two colour
                utilities on one element are resolved by their order in the
                generated stylesheet — which is the order of the palette in
                tailwind.config.js — and not by which one the call site wrote
                last. `muted` happens to sit after `ink` there, so this class
                did win, but it won by accident and a palette reshuffle would
                silently flip it. An inline style is the only tone that holds.*/}
            <Text variant="body" className="mt-3" style={{ color: theme.muted }}>
              To turn your photos into a wardrobe, Cinch processes each image. Here&rsquo;s exactly
              what that means.
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
              {/* Ink primary, per the zip — the accent is spent elsewhere.

                  `rounded-md` and a `minHeight`, not `rounded-plate` and a
                  fixed `h-14`: 20 is the PLATE radius (a card, a photo well),
                  and a button drawn at it reads as a slab rather than a
                  control — every other primary in the app is 12. The fixed
                  height held the box at 56pt however large the label grew,
                  which clipped "Allow processing" at AX sizes; a floor lets it
                  grow instead. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Allow processing"
                onPress={onAccept}
                disabled={busy}
                style={{ minHeight: 52 }}
                className="items-center justify-center rounded-md bg-ink px-5 py-3 active:opacity-90 dark:bg-ink-dark">
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
            {/* `label` is already muted; restating it here stacked a second
                colour utility for no gain. */}
            <Text variant="label" className="mt-3 text-center">
              You can turn AI features off anytime in Profile.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

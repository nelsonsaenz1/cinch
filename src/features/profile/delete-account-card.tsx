import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { spring, useTheme } from '@/theme/tokens';

/**
 * The delete-account confirmation — a bottom card over the Profile sheet, not
 * an Alert chain.
 *
 * The two stacked Alerts this replaces asked the same question twice, which is
 * friction without information. Typing DELETE is *one* step that cannot be
 * cleared on autopilot: it proves the reader parsed the word, where a second
 * "Are you sure?" only proves they can tap twice. The consequences stay
 * enumerated in real counts — naming what disappears is what makes the
 * friction honest rather than a dark pattern in reverse.
 *
 * Mounted only while open (the parent conditionally renders it), so the typed
 * confirmation resets to empty on every fresh opening — a card that reopens
 * pre-armed has defeated its own point.
 */
export function DeleteAccountCard({
  pieceCount,
  paidPlan,
  pending,
  errorText,
  onDelete,
  onClose,
}: {
  /** Real count for the warning, or null when the closet could not be read. */
  pieceCount: number | null;
  /** Whether the account is on a paid plan — gates the subscription clause. */
  paidPlan: boolean;
  pending: boolean;
  /** The mutation's no-rollback copy, surfaced inside the card. */
  errorText: string | null;
  onDelete: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmation, setConfirmation] = useState('');

  // Case-insensitive on purpose, and stated here so it stays that way: the
  // ceremony is reading the word and typing it, not fighting the shift key.
  // `autoCapitalize="characters"` below means most people type it uppercase
  // anyway; refusing "delete" would only punish the ones whose keyboard
  // disagreed.
  const armed = confirmation.trim().toUpperCase() === 'DELETE';

  // Enter on the repo's no-bounce preset. The Modal's own fade covers the
  // scrim and the exit; the card itself rises the last stretch on
  // `spring.smooth`, which also settles instantly under Reduce Motion — that
  // guarantee is baked into the preset, not re-stated here.
  const rise = useSharedValue(64);
  useEffect(() => {
    rise.value = withSpring(0, spring.smooth);
  }, [rise]);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rise.value }],
  }));

  const pieces =
    pieceCount != null && pieceCount > 0
      ? `your ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`
      : // Null means the closet has not loaded (or failed to); zero means it
        // is genuinely empty. Both get "every piece" — the first because the
        // number is unknown, the second because "your 0 pieces" is a count
        // doing the opposite of what counts are for here.
        'every piece in your closet';

  // The mock ends "…and your membership will not be refunded", but deletion
  // does not touch StoreKit at all: the App Store subscription keeps renewing
  // until cancelled in Apple's own UI, which is the sharper fact and the one a
  // paying user actually needs. Free accounts get neither clause — warning
  // someone about a membership they do not have reads as a template.
  const body = `This permanently deletes ${pieces}, every photo you uploaded, your outfit history, and everything Cinch has learned about your style. It cannot be undone.${
    paidPlan
      ? ' Your App Store subscription is separate and keeps billing until you cancel it in your Apple account.'
      : ''
  }`;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onClose();
      }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end">
        {/* Scrim tap keeps the closet. Hidden from assistive tech — the
            explicit "Keep my closet" button is the accessible way out, same
            reasoning as the ConsentSheet's scrim. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          disabled={pending}
          onPress={onClose}
          className="absolute inset-0"
          style={{ backgroundColor: theme.scrim }}
        />

        <Animated.View style={riseStyle}>
          <View
            accessibilityViewIsModal
            className="mx-gutter rounded-plate bg-canvas px-5 pb-4 pt-5"
            style={{ marginBottom: Math.max(insets.bottom, 26) }}>
            <Text variant="title" trim accessibilityRole="header">
              Delete your account?
            </Text>
            <Text variant="callout" className="mt-3 text-ink">
              {body}
            </Text>

            <Text variant="eyebrow" className="mt-4">
              Type DELETE to confirm
            </Text>
            <TextInput
              value={confirmation}
              onChangeText={setConfirmation}
              editable={!pending}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="done"
              accessibilityLabel="Type DELETE to confirm"
              accessibilityHint="Arms the Delete everything button"
              className="mt-2 rounded-md border border-rule bg-surface px-3.5 font-body text-body text-ink"
              style={{ minHeight: 44 }}
              selectionColor={theme.accent}
            />

            {errorText ? (
              // The no-rollback truth, in place — an Alert over this card
              // would stack two modals and detach the error from the button
              // that can finish the job. Live region so VoiceOver hears the
              // failure without hunting for it.
              <Text
                variant="caption"
                accessibilityLiveRegion="polite"
                className="mt-2.5 text-critical">
                {errorText}
              </Text>
            ) : null}

            <View className="mt-4 gap-2.5">
              <Button
                title="Delete everything"
                variant="primary"
                disabled={!armed}
                loading={pending}
                onPress={onDelete}
              />
              {/* The calmer target, full width like the mock — dismissal must
                  never be the smaller thing to hit. */}
              <Button
                title="Keep my closet"
                variant="secondary"
                disabled={pending}
                onPress={onClose}
                haptic={false}
              />
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

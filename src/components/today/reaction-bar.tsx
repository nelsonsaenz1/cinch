import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Dislike reasons, and the feature each one is really about.
 *
 * A bare thumbs-down teaches the learner only that *something* was wrong, and
 * it has to spread that across nine features. One tap on "not my colours"
 * tells it exactly which weight to move, which is the difference between
 * converging in ten reactions and converging in a hundred.
 *
 * Kept to six, all one-tap, because a dislike the user cannot be bothered to
 * qualify is still worth recording — the reason is always optional.
 */
export const DISLIKE_REASONS = [
  { label: 'Too formal', reason: 'too_formal' },
  { label: 'Too casual', reason: 'too_casual' },
  { label: 'Not my colours', reason: 'palette' },
  { label: 'Bad combination', reason: 'combination' },
  { label: 'Wrong for the weather', reason: 'weather' },
  { label: 'Worn too recently', reason: 'freshness' },
] as const;

export type ReactionValue = { liked: boolean; reason?: string };

export function ReactionBar({
  onReact,
  reacted,
  disabled,
}: {
  onReact: (value: ReactionValue) => void;
  /** Set once the user has reacted, so the card can show what it recorded. */
  reacted?: ReactionValue | null;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [askingWhy, setAskingWhy] = useState(false);

  const tap = (style: Haptics.ImpactFeedbackStyle) => {
    // Haptics no-op silently in Low Power Mode and while a camera session is
    // live, so every path here also changes something visible.
    void Haptics.impactAsync(style);
  };

  if (reacted) {
    return (
      <View className="flex-row items-center gap-2 py-1">
        <SymbolView
          name={reacted.liked ? 'heart.fill' : 'hand.thumbsdown.fill'}
          size={15}
          tintColor={reacted.liked ? theme.accent : theme.muted}
          resizeMode="scaleAspectFit"
        />
        <Text variant="label">
          {reacted.liked ? 'Saved to your taste profile' : 'Noted — you will see fewer like this'}
        </Text>
      </View>
    );
  }

  if (askingWhy) {
    return (
      <View className="gap-2 py-1">
        <Text variant="label">What was wrong with it?</Text>
        <View className="flex-row flex-wrap gap-2">
          {DISLIKE_REASONS.map((r) => (
            <Chip
              key={r.reason}
              label={r.label}
              onPress={() => {
                tap(Haptics.ImpactFeedbackStyle.Light);
                onReact({ liked: false, reason: r.reason });
              }}
            />
          ))}
          <Chip
            label="Just not it"
            onPress={() => {
              tap(Haptics.ImpactFeedbackStyle.Light);
              onReact({ liked: false });
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 py-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Like this outfit"
        disabled={disabled}
        onPress={() => {
          tap(Haptics.ImpactFeedbackStyle.Medium);
          onReact({ liked: true });
        }}
        hitSlop={10}
        style={{ minHeight: MIN_TAP_TARGET - 12, minWidth: MIN_TAP_TARGET - 12 }}
        className="items-center justify-center rounded-full border border-hairline px-4 active:opacity-60 dark:border-hairline-dark">
        <SymbolView name="heart" size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not this outfit"
        disabled={disabled}
        onPress={() => {
          tap(Haptics.ImpactFeedbackStyle.Light);
          setAskingWhy(true);
        }}
        hitSlop={10}
        style={{ minHeight: MIN_TAP_TARGET - 12, minWidth: MIN_TAP_TARGET - 12 }}
        className="items-center justify-center rounded-full border border-hairline px-4 active:opacity-60 dark:border-hairline-dark">
        <SymbolView name="xmark" size={15} tintColor={theme.muted} resizeMode="scaleAspectFit" />
      </Pressable>
    </View>
  );
}

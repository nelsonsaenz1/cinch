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

/**
 * Where a reaction has got to.
 *
 * This exists because the bar used to say "Saved to your taste profile" the
 * instant the user tapped, whether or not the write ever reached the server —
 * and the write is an online-only RPC with no queue behind it, so on a bad
 * connection the app was simply lying about having learned something.
 *
 * Optional on `ReactionValue` because the same type is what the bar hands BACK
 * through `onReact`, where a status would be meaningless. An absent status is
 * read as `pending`: the safe reading, since a reaction nobody has confirmed is
 * exactly a reaction in flight.
 */
export type ReactionStatus = 'pending' | 'saved' | 'failed';

export type ReactionValue = { liked: boolean; reason?: string; status?: ReactionStatus };

/**
 * One pill in the reaction row. Unselected it is outlined in the structural
 * rule colour like the rest of the plate grammar; selected it FILLS — oxblood
 * for a love, ink for a pass — the two states the design leans on to say what
 * the user chose. Filled labels take their colour inline (`theme.canvas`), not
 * a className: a `text-*` colour does not reliably beat the variant's own on a
 * dark tile.
 */
function ReactionPill({
  label,
  tone,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  /** Which fill the pill wears once it is the recorded choice. */
  tone: 'accent' | 'ink';
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  const color = selected ? theme.canvas : tone === 'accent' ? theme.ink : theme.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET - 4 }}
      className={[
        'flex-1 items-center justify-center rounded-md px-3 active:opacity-70',
        selected ? (tone === 'accent' ? 'bg-accent' : 'bg-ink') : 'border border-rule',
        disabled && !selected ? 'opacity-40' : '',
      ].join(' ')}>
      <Text variant="label" className="font-medium" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The plate's reaction row: love it, or not — and if not, which of the six
 * things was wrong. Two selection pills at rest, a reason chooser after a pass,
 * and the recorded choice held as a filled pill with an honest status line
 * underneath (saving, saved, or a tap-to-retry when the write never landed).
 */
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
    const status = reacted.status ?? 'pending';

    // Failure is offered as a retry rather than an apology. The reaction is
    // still held in the parent's state, so tapping replays exactly what the
    // user chose, reason and all.
    if (status === 'failed') {
      return (
        <View className="flex-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reaction not saved. Tap to try again."
            onPress={() => {
              tap(Haptics.ImpactFeedbackStyle.Light);
              onReact({ liked: reacted.liked, reason: reacted.reason });
            }}
            style={{ minHeight: MIN_TAP_TARGET - 4 }}
            className="flex-row items-center justify-center gap-2 rounded-md border border-rule px-3 active:opacity-70">
            <SymbolView
              name="arrow.clockwise"
              size={14}
              tintColor={theme.critical}
              resizeMode="scaleAspectFit"
            />
            <Text variant="label" className="font-medium" style={{ color: theme.critical }}>
              Couldn&rsquo;t save — retry
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <View className="flex-row">
          <ReactionPill
            label={reacted.liked ? 'Love it' : 'Not for me'}
            tone={reacted.liked ? 'accent' : 'ink'}
            selected
            disabled
            accessibilityLabel={
              reacted.liked ? 'You loved this outfit' : 'You passed on this outfit'
            }
          />
        </View>
        <Text variant="caption" className="mt-1.5">
          {status === 'pending'
            ? 'Saving…'
            : reacted.liked
              ? 'Saved to your taste profile'
              : 'Noted — you will see fewer like this'}
        </Text>
      </View>
    );
  }

  if (askingWhy) {
    return (
      <View className="flex-1 gap-2">
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
    <View className="flex-1 flex-row gap-2">
      <ReactionPill
        label="Love it"
        tone="accent"
        selected={false}
        disabled={disabled}
        accessibilityLabel="Love this outfit"
        onPress={() => {
          tap(Haptics.ImpactFeedbackStyle.Medium);
          onReact({ liked: true });
        }}
      />
      <ReactionPill
        label="Not for me"
        tone="ink"
        selected={false}
        disabled={disabled}
        accessibilityLabel="Not for me"
        onPress={() => {
          tap(Haptics.ImpactFeedbackStyle.Light);
          setAskingWhy(true);
        }}
      />
    </View>
  );
}

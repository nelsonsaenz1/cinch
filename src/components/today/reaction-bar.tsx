import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

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
 * One of the two fixed pill slots.
 *
 * The slot never unmounts. When a reaction is recorded the unchosen pill fades
 * to zero rather than disappearing, so the row keeps both halves of its width
 * distribution and the chosen pill stays exactly where the thumb left it —
 * the card used to re-lay its whole action row out from under the finger at
 * the precise moment it was confirming the tap. Hidden from VoiceOver while
 * faded: a 0-opacity button is not a control.
 */
function PillSlot({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: motion.duration.fast });
  }, [shown, visible]);

  const style = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    // Layout is an inline style rather than `flex-1 flex-row`: NativeWind's
    // interop is registered for the RN primitives only, so a className on a
    // Reanimated component is silently dropped.
    <Animated.View
      style={[{ flex: 1, flexDirection: 'row' }, style]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

/**
 * The plate's reaction row: love it, or not — and if not, which of the six
 * things was wrong.
 *
 * The composition is deliberately rigid. Two pill slots and the trailing wear
 * action hold their geometry through every state; the status line under them
 * is reserved whether or not there is anything to say; and the reason chooser
 * opens BELOW the row instead of replacing it. So the card's height moves
 * exactly once — when the chooser opens — and never at the moment of a
 * confirmation tap, which is when the layout used to jump.
 *
 * `trailing` is the wear action, passed in rather than composed beside this
 * component: the bar has to be able to hide it while the chooser is open, and
 * it can only do that if it owns the row.
 */
export function ReactionBar({
  onReact,
  reacted,
  disabled,
  trailing,
}: {
  onReact: (value: ReactionValue) => void;
  /** Set once the user has reacted, so the card can show what it recorded. */
  reacted?: ReactionValue | null;
  disabled?: boolean;
  /** The wear action, rendered at the end of the row and hidden while asking. */
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const [askingWhy, setAskingWhy] = useState(false);

  const tap = (style: Haptics.ImpactFeedbackStyle) => {
    // Haptics no-op silently in Low Power Mode and while a camera session is
    // live, so every path here also changes something visible. Best-effort:
    // a rejected haptic must never take the reaction down with it.
    void Haptics.impactAsync(style).catch(() => {});
  };

  // Recording a reason both sends the reaction and closes the chooser. The
  // chooser used to be a whole separate branch of the render, so `reacted`
  // arriving unmounted it for free; now that it is a section of one stable
  // composition it has to be closed on purpose.
  const choose = (reason?: string) => {
    tap(Haptics.ImpactFeedbackStyle.Light);
    setAskingWhy(false);
    onReact({ liked: false, reason });
  };

  const status = reacted ? (reacted.status ?? 'pending') : null;
  const recorded = Boolean(reacted);

  // The one reserved line does double duty: while the chooser is open it asks
  // the question, so the chips are the only thing that adds height and the
  // row above them never moves.
  const statusLine = askingWhy
    ? 'What was wrong with it?'
    : status === 'pending'
      ? 'Saving…'
      : status === 'saved'
        ? reacted!.liked
          ? 'Saved to your taste profile'
          : 'Noted — you will see fewer like this'
        : null;

  return (
    <View>
      {/* ── The action row. Two slots, always; the wear action steps aside
             only while the chooser is open. ── */}
      <View className="flex-row items-start gap-2">
        <View className="flex-1 flex-row gap-2">
          <PillSlot visible={!recorded || Boolean(reacted?.liked)}>
            <ReactionPill
              label="Love it"
              tone="accent"
              selected={Boolean(reacted?.liked)}
              disabled={recorded || disabled}
              accessibilityLabel={reacted?.liked ? 'You loved this outfit' : 'Love this outfit'}
              onPress={
                recorded
                  ? undefined
                  : () => {
                      tap(Haptics.ImpactFeedbackStyle.Medium);
                      onReact({ liked: true });
                    }
              }
            />
          </PillSlot>
          <PillSlot visible={!recorded || !reacted?.liked}>
            <ReactionPill
              label="Not for me"
              tone="ink"
              selected={recorded && !reacted?.liked}
              disabled={recorded || disabled}
              accessibilityLabel={
                recorded && !reacted?.liked ? 'You passed on this outfit' : 'Not for me'
              }
              onPress={
                recorded
                  ? undefined
                  : () => {
                      tap(Haptics.ImpactFeedbackStyle.Light);
                      setAskingWhy(true);
                    }
              }
            />
          </PillSlot>
        </View>
        {askingWhy ? null : trailing}
      </View>

      {/* ── The status line, reserved. A single space holds the line box open
             at any Dynamic Type setting, so nothing below it moves when the
             sentence arrives. Failure is offered as a retry rather than an
             apology: the reaction is still held in the parent's state, so
             tapping replays exactly what the user chose, reason and all. ── */}
      {status === 'failed' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reaction not saved. Tap to try again."
          hitSlop={13}
          onPress={() => {
            tap(Haptics.ImpactFeedbackStyle.Light);
            onReact({ liked: reacted!.liked, reason: reacted!.reason });
          }}
          className="mt-1.5 self-start active:opacity-60">
          <Text
            variant="caption"
            numberOfLines={1}
            accessibilityLiveRegion="polite"
            style={{ color: theme.critical }}>
            Couldn&rsquo;t save — retry
          </Text>
        </Pressable>
      ) : (
        <Text
          variant="caption"
          className="mt-1.5"
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden={!statusLine}
          importantForAccessibility={statusLine ? 'auto' : 'no-hide-descendants'}>
          {statusLine ?? ' '}
        </Text>
      )}

      {/* ── The reason chooser, full width, beneath the row it qualifies. ── */}
      {askingWhy ? (
        <Animated.View
          entering={FadeIn.duration(motion.duration.fast)}
          exiting={FadeOut.duration(motion.duration.fast)}
          // Inline, not `mt-2`: NativeWind classes do not reach Reanimated
          // components in this project.
          style={{ marginTop: 8 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            {DISLIKE_REASONS.map((r) => (
              <Chip key={r.reason} label={r.label} onPress={() => choose(r.reason)} />
            ))}
            <Chip label="Just not it" onPress={() => choose()} />
            {/* The way out. Every other exit from this chooser records a
                dislike, so an accidental "Not for me" was unrecoverable and
                quietly poisoned the learner. Ghost-styled — no ring, no
                ground, muted label — so it reads as an escape rather than as
                a seventh thing that was wrong with the outfit. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Never mind, don't record anything"
              onPress={() => {
                tap(Haptics.ImpactFeedbackStyle.Light);
                setAskingWhy(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{ minHeight: MIN_TAP_TARGET - 12 }}
              className="items-center justify-center rounded-md px-2 active:opacity-60">
              <Text variant="label" className="underline">
                Never mind
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Chip } from '@/components/ui/chip';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

import {
  w3ReactionSpec,
  type W3ReactionKind,
  type W3ReactionState,
} from './reaction-spec';

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

/** The wear action, as the row needs to know it. */
export type WearAction = {
  worn: boolean;
  busy: boolean;
  onPress: () => void;
  /**
   * Whether the frame's one oxblood is spent here. False on T-02, where the
   * occasion interrupt takes the accent and the wear action falls back to ink.
   */
  accent?: boolean;
};

/**
 * One control in the Wave 3 action row.
 *
 * A selected control says so three ways at once — fill, tick, and a changed
 * verb — "so the state does not depend on colour". The tick is a real second
 * channel rather than decoration: at the largest type, in bright sun, or for a
 * reader who cannot distinguish the ink fill from the outline, it is what is
 * left.
 */
function RowControl({
  kind,
  state,
  label,
  stacked,
  accent,
  onPress,
  accessibilityLabel,
}: {
  kind: W3ReactionKind;
  state: W3ReactionState;
  label: string;
  stacked: boolean;
  accent?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const spec = w3ReactionSpec({ kind, state, stacked, accent });
  const color = theme[spec.label];

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={spec.accessibilityState}
      disabled={state === 'unavailable' || !onPress}
      onPress={onPress}
      fill
      style={{ minHeight: spec.minHeight, flexGrow: spec.flex, flexShrink: 1, flexBasis: 0 }}
      contentStyle={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      className={`rounded-md px-3 ${spec.ground}`}>
      {spec.tick ? (
        <SymbolView name="checkmark" size={13} tintColor={color} resizeMode="scaleAspectFit" />
      ) : null}
      {/* Medium: a filled action and a label are the two things the
          constitution allows it for, and every control in this row is one or
          the other. Nothing here is prose. */}
      <Text
        variant="label"
        style={{ color }}
        // Nothing is ellipsised and no scale is capped (audit 59). At the
        // largest type the row stacks and the label takes the lines it needs.
        numberOfLines={stacked ? 2 : 1}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * The failure band — T-15.
 *
 * "The failure sits immediately beneath the row that produced it, not at the
 * top of the screen and not over the plate. Retry is on the same band. Nothing
 * about the layout moves between T-13 and this frame except the band
 * appearing, so a retry never has to be hunted for."
 *
 * Exported because the wear write fails the same way and must fail the same
 * shape — one grammar for "it did not land, and your decision is still here".
 */
export function FailureBand({
  title,
  body,
  retryLabel = 'Retry',
  onRetry,
}: {
  title: string;
  body: string;
  retryLabel?: string;
  onRetry: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      className="mt-2 flex-row items-center gap-3 rounded-md bg-tray p-3">
      <View className="flex-1">
        {/* LABEL (Medium) — it names the state. */}
        <Text variant="label" style={{ color: theme.accent }}>
          {title}
        </Text>
        {/* PROSE (regular) — `note` is `label`'s size in the regular cut. */}
        <Text variant="note">{body}</Text>
      </View>
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={`${retryLabel} — ${title}`}
        onPress={onRetry}
        // 76 × 44, as drawn. The 44 is the floor, and the 76 is what keeps a
        // one-word control from reading as an afterthought beside the sentence.
        style={{ minWidth: 76, minHeight: MIN_TAP_TARGET }}
        contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        className="rounded-md border border-rule px-3">
        <Text variant="label" style={{ color: theme.ink }}>
          {retryLabel}
        </Text>
      </PressableSurface>
    </View>
  );
}

/**
 * The plate's action row: worn, loved, or not — and if not, which of the six
 * things was wrong.
 *
 * Wave 3 sets the order and the weights: the wear action leads at 1.4× the
 * width of the two reactions, all three at 48 pt with 8 pt gaps, stacking at
 * 60 pt at the largest type with nothing removed and nothing ellipsised.
 *
 * The composition is otherwise as rigid as it was. The status line under the
 * row is reserved whether or not there is anything to say, and the reason
 * chooser opens BELOW the row instead of replacing it, so the card's height
 * moves exactly once — when the chooser opens — and never at the moment of a
 * confirmation tap, which is when the layout used to jump.
 */
export function ReactionBar({
  onReact,
  reacted,
  disabled,
  wear,
  stacked = false,
  unavailable = null,
}: {
  onReact: (value: ReactionValue) => void;
  /** Set once the user has reacted, so the card can show what it recorded. */
  reacted?: ReactionValue | null;
  disabled?: boolean;
  /** The wear action. Omitted where there is no day to mark (dev previews). */
  wear?: WearAction | null;
  /** The largest supported type: the three controls stack, in the same order. */
  stacked?: boolean;
  /**
   * The row cannot act — offline, T-09. The sentence is the second channel:
   * "A disabled reaction is greyed and accompanied by a sentence naming the
   * reason — never greyed alone."
   */
  unavailable?: string | null;
}) {
  const [askingWhy, setAskingWhy] = useState(false);

  const tap = (style: Haptics.ImpactFeedbackStyle) => {
    // Haptics no-op silently in Low Power Mode and while a camera session is
    // live, so every path here also changes something visible. Best-effort:
    // a rejected haptic must never take the reaction down with it.
    void Haptics.impactAsync(style).catch(() => {});
  };

  // Recording a reason both sends the reaction and closes the chooser.
  const choose = (reason?: string) => {
    tap(Haptics.ImpactFeedbackStyle.Light);
    setAskingWhy(false);
    onReact({ liked: false, reason });
  };

  const status = reacted ? (reacted.status ?? 'pending') : null;
  const recorded = Boolean(reacted);
  const failed = status === 'failed';

  const loveState: W3ReactionState = unavailable
    ? 'unavailable'
    : reacted?.liked
      ? failed
        ? 'failed'
        : 'selected'
      : 'idle';
  const passState: W3ReactionState = unavailable
    ? 'unavailable'
    : recorded && !reacted?.liked
      ? failed
        ? 'failed'
        : 'selected'
      : 'idle';

  // The verb changes with the state — the third channel. "Love it" is an offer;
  // "Loved" is a record.
  const loveLabel = loveState === 'selected' || loveState === 'failed' ? 'Loved' : 'Love it';

  // The status line, reserved. While the chooser is open it asks the question,
  // so the chips are the only thing that adds height and the row never moves.
  const statusLine = askingWhy
    ? 'What was wrong with it?'
    : status === 'pending'
      ? 'Saving your reaction'
      : status === 'saved'
        ? reacted!.liked
          ? 'Saved to your taste profile'
          : 'Noted — you will see fewer like this'
        : null;

  /**
   * T-09/AX. "The two disabled reactions are removed rather than stacked as
   * inert 60 pt bars, and the sentence that explained the disabling now
   * explains the absence — three dead controls at this size would push the live
   * one off the screen."
   */
  const hideDisabledControls = Boolean(unavailable) && stacked;

  const controls = hideDisabledControls ? null : (
    <View
      className={stacked ? 'gap-2' : 'flex-row items-stretch gap-2'}
      // The row's own geometry, stated once: three controls, 8 pt gaps.
      accessibilityRole="none">
      {wear ? (
        <RowControl
          kind="wear"
          state={unavailable ? 'unavailable' : wear.worn ? 'selected' : 'idle'}
          accent={wear.accent ?? true}
          stacked={stacked}
          label={wear.worn ? 'Worn today' : 'I wore this'}
          accessibilityLabel={wear.worn ? 'Worn today' : 'Mark as worn today'}
          onPress={
            unavailable || wear.busy
              ? undefined
              : () => {
                  void Haptics.selectionAsync().catch(() => {});
                  wear.onPress();
                }
          }
        />
      ) : null}
      <RowControl
        kind="love"
        state={loveState}
        stacked={stacked}
        label={loveLabel}
        accessibilityLabel={
          loveState === 'selected'
            ? 'Loved, selected'
            : loveState === 'unavailable'
              ? 'Love it, unavailable without a connection'
              : 'Love this outfit'
        }
        onPress={
          unavailable || recorded || disabled
            ? undefined
            : () => {
                tap(Haptics.ImpactFeedbackStyle.Medium);
                onReact({ liked: true });
              }
        }
      />
      <RowControl
        kind="pass"
        state={passState}
        stacked={stacked}
        label="Not for me"
        accessibilityLabel={
          passState === 'selected'
            ? 'Not for me, selected'
            : passState === 'unavailable'
              ? 'Not for me, unavailable without a connection'
              : 'Not for me, button'
        }
        onPress={
          unavailable || recorded || disabled
            ? undefined
            : () => {
                tap(Haptics.ImpactFeedbackStyle.Light);
                setAskingWhy(true);
              }
        }
      />
    </View>
  );

  return (
    <View>
      {controls}

      {/* The disabling is never colour alone: the sentence names why the row
          cannot act and what still works. */}
      {unavailable ? (
        <Text variant="note" className={hideDisabledControls ? '' : 'mt-2'}>
          {unavailable}
        </Text>
      ) : failed ? (
        <FailureBand
          title="Not saved"
          body="Your reaction is still here. Cinch will not lose it."
          onRetry={() => {
            tap(Haptics.ImpactFeedbackStyle.Light);
            onReact({ liked: reacted!.liked, reason: reacted!.reason });
          }}
        />
      ) : (
        /* A single space holds the line box open at any Dynamic Type setting,
           so nothing below it moves when the sentence arrives. PROSE, in the
           regular cut: this is a sentence about what happened, not a label. */
        <Text
          variant="note"
          className="mt-1.5"
          numberOfLines={2}
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
                quietly poisoned the learner. */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel="Never mind, don't record anything"
              onPress={() => {
                tap(Haptics.ImpactFeedbackStyle.Light);
                setAskingWhy(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              fill
              style={{ minHeight: MIN_TAP_TARGET - 12 }}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              className="rounded-md px-2">
              <Text variant="label" className="underline">
                Never mind
              </Text>
            </PressableSurface>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

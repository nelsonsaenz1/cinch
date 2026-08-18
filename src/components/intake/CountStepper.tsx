import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace, WalkthroughBand } from '@/components/intake/walkthrough-parts';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { numberWord } from '@/features/onboarding/reveal-copy';
import type { IntakeDraftRow } from '@/features/intake/queries';
import { useTheme } from '@/theme/tokens';

import { slotLabel } from './CorrectionSheet';
import { ProcessionMasthead } from './ProcessionMasthead';

/**
 * PR-03 — the ambiguous quantity.
 *
 * Fires when `parse-closet` returned a plural or a low-confidence count — "a
 * few plain black tees". It is the SAME card as PR-01 — literally: it draws
 * `CardFace`, the same component the ordinary card draws, and adds one blush
 * band carrying the single question the parse could not answer. A separate
 * screen would break the procession's rhythm for a card that is otherwise
 * ordinary, and a hand-built second copy of the card face is how the two drift.
 *
 * THE PRIMARY ACTION CARRIES THE CHOSEN NUMBER — "Keep three" — so the decision
 * is readable without looking back up at the stepper.
 *
 * THE RANGE IS CLAMPED 1–12, exactly as the reducer clamps it, and the minus
 * cell at the floor is disabled WITH ITS REASON rather than silently inert: a
 * hold says "at least one" instead of nothing happening twice.
 */

/** Matches the bounds `procession.ts`'s `ambiguous` case itself clamps to, so
 *  a value this stepper hands up is already exactly what dispatching it would
 *  produce and the two places that care can never quietly disagree. */
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 12;

/** The atlas's stepper cell — 52pt square, above the 44pt floor. */
const CELL = 52;

function clampQuantity(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_QUANTITY), MAX_QUANTITY);
}

export type CountStepperProps = {
  /** The ambiguous draft — its `utterance` is the receipt, its `quantity` the
   *  model's best guess and the stepper's starting value. */
  draft: IntakeDraftRow;
  /** "3 pieces of 23 heard" — the procession's own position figures. */
  index: number;
  total: number;
  canUndo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onDrop: () => void;
  onConfirm: (quantity: number) => void;
  /** Set while the caller writes the sibling rows, so a second tap cannot fire
   *  the split twice. */
  busy?: boolean;
};

export function CountStepper({
  draft,
  index,
  total,
  canUndo,
  onBack,
  onUndo,
  onDrop,
  onConfirm,
  busy = false,
}: CountStepperProps) {
  const insets = useSafeAreaInsets();

  // Re-seeded on the render that receives a NEW ambiguous draft — "adjust state
  // during render, keyed by identity", rather than an effect that would show
  // one frame of the previous garment's count.
  const [seededFor, setSeededFor] = useState(draft.id);
  const [quantity, setQuantity] = useState(() => clampQuantity(draft.quantity));
  const [floorReason, setFloorReason] = useState(false);
  if (draft.id !== seededFor) {
    setSeededFor(draft.id);
    setQuantity(clampQuantity(draft.quantity));
    setFloorReason(false);
  }

  const atFloor = quantity <= MIN_QUANTITY;
  const decrement = () => {
    setFloorReason(false);
    setQuantity((q) => clampQuantity(q - 1));
  };
  const increment = () => {
    setFloorReason(false);
    setQuantity((q) => clampQuantity(q + 1));
  };

  return (
    <View className="flex-1 bg-canvas">
      <ProcessionMasthead
        index={index}
        total={total}
        canUndo={canUndo}
        onBack={onBack}
        onUndo={onUndo}
      />

      <ScrollView contentContainerClassName="px-gutter pb-4" showsVerticalScrollIndicator={false}>
        {/* THE SAME FACE AS THE ORDINARY CARD, drawn by the same component. A
            second copy of the plate, the facts and the quoted utterance is how
            the two cards drift apart, and the whole point of PR-03 is that it
            is an ordinary card with one extra question on it. */}
        <CardFace
          name={draft.name}
          facts={[{ field: 'kind', label: slotLabel(draft.slot) }]}
          utterance={draft.utterance ?? ''}
          onCorrectField={() => {}}
        />

        {/* The one question the parse could not answer, in the band the group
            says everything additive in. Blush, because it is the only thing on
            this card that is waiting on the reader. */}
        <WalkthroughBand
          tone="blush"
          title="How many?"
          body={`Cinch could not tell how many “${draft.utterance}” is. Set the number and they go in as separate pieces.`}
          style={{ marginTop: 12 }}>
          <View
            className="flex-row items-center"
            style={{ marginTop: 14, gap: 16 }}
            accessibilityRole="adjustable"
            accessibilityLabel="How many"
            accessibilityValue={{ min: MIN_QUANTITY, max: MAX_QUANTITY, now: quantity }}
            accessibilityActions={[
              { name: 'increment', label: 'Increase' },
              { name: 'decrement', label: 'Decrease' },
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') increment();
              if (e.nativeEvent.actionName === 'decrement') decrement();
            }}>
            <StepButton
              symbol="minus"
              label="Fewer"
              // Disabled WITH the reason. A hold on the dead cell says why,
              // rather than a tap that appears to do nothing.
              hint={atFloor ? 'At least one' : undefined}
              disabled={atFloor || busy}
              onPress={decrement}
              onLongPress={() => setFloorReason(atFloor)}
            />
            <Text
              variant="display"
              style={{ minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
              {quantity}
            </Text>
            <StepButton
              symbol="plus"
              label="More"
              disabled={quantity >= MAX_QUANTITY || busy}
              onPress={increment}
            />
            {/* The range, stated rather than discovered by pressing into a
                dead cell. `1–12` is exactly what the reducer clamps to. */}
            <Text variant="note" style={{ fontSize: 15 }}>
              {`${MIN_QUANTITY}–${MAX_QUANTITY}`}
            </Text>
          </View>

          <Text variant="note" style={{ fontSize: 15, marginTop: 12 }}>
            {floorReason
              ? 'At least one.'
              : `${quantity} piece${quantity === 1 ? '' : 's'} of ${total} heard`}
          </Text>
        </WalkthroughBand>
      </ScrollView>

      {/* The same decision bar as the ordinary card: the filled action first,
          the peers beneath. There is no Fix here — the one thing this card is
          uncertain about is the number, and the stepper above IS its
          correction. */}
      <View
        className="px-gutter"
        style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 12) + 6 }}>
        {/* The action names the number it will keep. */}
        <Button
          title={`Keep ${numberWord(quantity)}`}
          loading={busy}
          onPress={() => onConfirm(quantity)}
          haptic
          accessibilityHint={`Creates ${quantity} separate cards for this garment`}
          className="self-stretch"
        />
        <Button
          title="Drop"
          variant="secondary"
          onPress={onDrop}
          accessibilityHint="Marks this card dropped. Undo puts it back exactly as it was."
          className="self-stretch"
        />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  label,
  hint,
  disabled,
  onPress,
  onLongPress,
}: {
  symbol: 'minus' | 'plus';
  label: string;
  hint?: string;
  disabled: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      // Never `disabled`: a dead Pressable cannot report why it is dead. The
      // press is a no-op and the hold states the reason.
      onPress={disabled ? undefined : onPress}
      onLongPress={onLongPress}
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 12,
        opacity: disabled ? 0.35 : 1,
      }}
      className="items-center justify-center border border-rule bg-surface active:opacity-60">
      <SymbolView name={symbol} size={16} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

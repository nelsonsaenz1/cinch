import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { IntakeDraftRow } from '@/features/intake/queries';
import { capTrim, leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * V-09 — the ambiguity.
 *
 * Fires when `parse-closet` returned a plural or a low-confidence quantity —
 * "some black t-shirts", "a few pairs of jeans" (§3, V-09). This component
 * only asks the one question the screen exists to ask and hands the answer
 * up; it does not write to `intake_drafts`, does not create the sibling rows
 * the directive describes ("N sibling cards ... inserted at this position in
 * the procession"), and does not dispatch a `ProcessionAction` itself. That
 * write touches more than one draft row at once — which is a session-level
 * concern the not-yet-built `use-procession` hook owns — so this component's
 * only output is a plain number.
 *
 * NO SECOND ACTION. The directive's prose for this state names a headline, the
 * receipt, and a stepper, and nothing else — no back, no skip, no dismiss.
 * Refusal 6 ("exactly one oxblood action per screen") is read here as a floor,
 * not an invitation to add a second, unspecified one just because most other
 * screens in this flow carry one.
 */

/** Matches the bounds `procession.ts`'s `ambiguous` case itself clamps to
 *  (`Math.min(Math.max(Math.round(quantity), 1), 12)`) — so a value this
 *  stepper hands up is already exactly what dispatching it would produce, and
 *  the two places that care about the range can never quietly disagree. */
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 12;

function clampQuantity(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_QUANTITY), MAX_QUANTITY);
}

/** 26px serif, per the directive's literal spec for this headline — one step
 *  below V-06's 30px name and V-08's 26px "Add a photo?" (the same size, in
 *  fact; both are a question this state is asking, not a value it is
 *  stating). No `text-26` step exists in the scale, so the trim is computed
 *  by hand exactly as `GarmentCard`'s 30px name is. */
const HEADLINE_SIZE = 26;
const HEADLINE_LINE_HEIGHT = leading('instrument', HEADLINE_SIZE, 1.08);
const HEADLINE_TRIM = capTrim('instrument', HEADLINE_SIZE, HEADLINE_LINE_HEIGHT);

export type CountStepperProps = {
  /** The ambiguous draft — its `utterance` is the receipt, its `quantity` is
   *  the model's best guess and the stepper's starting value. */
  draft: IntakeDraftRow;
  onConfirm: (quantity: number) => void;
  /** Set while the caller is writing the sibling rows this answer produces,
   *  so a second tap on Confirm cannot fire the split twice. */
  busy?: boolean;
};

export function CountStepper({ draft, onConfirm, busy = false }: CountStepperProps) {
  const insets = useSafeAreaInsets();

  // Re-seeded on the render that receives a NEW ambiguous draft — the same
  // "adjust state during render, keyed by identity" pattern the sheets in
  // this app use, rather than an effect that would show one frame of the
  // previous garment's count. Keying by `draft.id` (not just re-mounting via
  // a `key` prop upstream) means this also behaves correctly if a caller
  // chooses to keep one instance mounted across a walkthrough's several
  // ambiguous stops.
  const [seededFor, setSeededFor] = useState(draft.id);
  const [quantity, setQuantity] = useState(() => clampQuantity(draft.quantity));
  if (draft.id !== seededFor) {
    setSeededFor(draft.id);
    setQuantity(clampQuantity(draft.quantity));
  }

  const decrement = () => setQuantity((q) => clampQuantity(q - 1));
  const increment = () => setQuantity((q) => clampQuantity(q + 1));

  return (
    <View className="flex-1 bg-canvas px-gutter dark:bg-canvas-dark">
      <View className="flex-1 items-center justify-center">
        <Text
          variant="display"
          accessibilityRole="header"
          style={{
            fontSize: HEADLINE_SIZE,
            lineHeight: HEADLINE_LINE_HEIGHT,
            letterSpacing: -0.15,
            textAlign: 'center',
            ...HEADLINE_TRIM,
          }}>
          How many?
        </Text>

        {/* The receipt line, prominent — larger and darker than V-06's
            footnote-weight version, because on this screen it is not a
            provenance note beside a decision, it IS most of the question. */}
        <Text
          variant="callout"
          className="mb-8 mt-3 px-4 text-center italic text-ink dark:text-ink-dark">
          you said: “{draft.utterance}”
        </Text>

        <View
          className="flex-row items-center justify-center gap-6"
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
            disabled={quantity <= MIN_QUANTITY || busy}
            onPress={decrement}
          />
          <Text
            variant="statFigure"
            style={{ minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
            {quantity}
          </Text>
          <StepButton
            symbol="plus"
            label="More"
            disabled={quantity >= MAX_QUANTITY || busy}
            onPress={increment}
          />
        </View>
      </View>

      <View className="pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 10 }}>
        {/* The one oxblood action on this screen (refusal 6). */}
        <Button
          title="Confirm"
          loading={busy}
          onPress={() => onConfirm(quantity)}
          accessibilityHint={`Creates ${quantity} separate cards for this garment`}
          className="w-full"
        />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: MIN_TAP_TARGET,
        height: MIN_TAP_TARGET,
        borderRadius: MIN_TAP_TARGET / 2,
        opacity: disabled ? 0.35 : 1,
      }}
      className="items-center justify-center border border-rule bg-surface active:opacity-60 dark:border-rule-dark dark:bg-surface-dark">
      <SymbolView name={symbol} size={16} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

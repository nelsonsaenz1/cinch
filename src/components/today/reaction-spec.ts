import { MIN_TAP_TARGET } from '@/theme/metrics';

import type { ThemeColors } from '@/theme/tokens';

/**
 * The reaction pill's contract, as data. Audit item 49.
 *
 * The pill has a property none of the other five do: it is a control the user
 * has already committed to. Its comments record the reason the row never
 * unmounts a pill — "the card used to re-lay its whole action row out from
 * under the finger at the precise moment it was confirming the tap" — and the
 * accessibility half of that decision, that a 0-opacity button is not a
 * control and must leave the VoiceOver order.
 *
 * Both are pure functions of (selected, disabled, visible), and both are
 * invisible in a rendered tree: a faded pill and a hidden one look identical
 * in a snapshot and behave completely differently for a screen reader.
 */

export type ReactionTone = 'accent' | 'ink';

export type ReactionPillInput = {
  tone: ReactionTone;
  selected: boolean;
  disabled?: boolean;
};

export type ReactionPillSpec = {
  /** Label colour token. Canvas once chosen, so it reads on the fill. */
  label: keyof ThemeColors;
  /** Ground and ring classes. */
  ground: string;
  minHeight: number;
  /** Dimmed only when refused AND not the recorded choice. */
  dimmed: boolean;
  accessibilityState: { selected: boolean; disabled: boolean };
};

export function reactionPillSpec({
  tone,
  selected,
  disabled = false,
}: ReactionPillInput): ReactionPillSpec {
  return {
    label: selected ? 'canvas' : tone === 'accent' ? 'ink' : 'muted',
    ground: [
      selected ? (tone === 'accent' ? 'bg-accent' : 'bg-ink') : 'border border-rule',
      // The chosen pill never dims: it is a record of what happened, not a
      // control awaiting permission.
      disabled && !selected ? 'opacity-40' : '',
    ]
      .filter(Boolean)
      .join(' '),
    minHeight: MIN_TAP_TARGET - 4,
    dimmed: disabled && !selected,
    accessibilityState: { selected, disabled },
  };
}

/**
 * Whether a slot's contents are reachable by VoiceOver.
 *
 * The slot keeps its width when hidden so the chosen pill does not move, but a
 * pill faded to zero is not a control and must not be focusable — a reader
 * swiping the row would otherwise land on an invisible button.
 */
export function slotAccessibility(visible: boolean): {
  opacity: number;
  accessibilityElementsHidden: boolean;
  importantForAccessibility: 'auto' | 'no-hide-descendants';
  pointerEvents: 'auto' | 'none';
} {
  return {
    opacity: visible ? 1 : 0,
    accessibilityElementsHidden: !visible,
    importantForAccessibility: visible ? 'auto' : 'no-hide-descendants',
    pointerEvents: visible ? 'auto' : 'none',
  };
}

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

// ── Wave 3 · the three-across action row ────────────────────────────────────

/**
 * The row the atlas draws: wear, love, pass — in that order, three controls at
 * 48 pt with 8 pt gaps, "the wear action given 1.4× the width of the others so
 * the dominant action is dominant by size as well as fill". At the largest type
 * they stack at 60 pt, in the same order, with nothing removed.
 *
 * Written as a second function rather than folded into `reactionPillSpec`
 * because that one is a shipped contract with its own test, and its rules are
 * genuinely different: it has no wear slot, no failed state, no stacking, and
 * its selected love pill fills OXBLOOD — which Wave 3 retires, because the
 * frame's single accent is now spent on the wear action.
 */
export type W3ReactionKind = 'wear' | 'love' | 'pass';

/**
 * The font scale at which the row stops sitting across and starts stacking.
 *
 * iOS's Dynamic Type sizes run 0.88 … 1.35 for the standard scale and on past
 * 3.0 for the accessibility sizes. 1.35 is the top of the standard range: at or
 * above it three labelled controls across a 353 pt measure begin to clip, which
 * is exactly the failure audit 59 was raised for ("three equal reactions that
 * clipped above the second type step"). Nothing is capped at this threshold and
 * nothing is removed — only the arrangement changes, which is the one thing the
 * accessibility contract does allow.
 */
export const AX_FONT_SCALE = 1.35;

/**
 * Four states, each of which must be distinguishable without colour:
 *
 *   idle        — outlined (or filled, for the wear action).
 *   selected    — fill + tick + changed verb. Three channels, per audit 59.
 *   failed      — outline in oxblood, with "Not saved" printed on its own band.
 *                 A third state distinct from both idle and saved, so a write
 *                 that never landed can never be mistaken for one that did.
 *   unavailable — a TRAY FILL with a secondary-ink label, never faint text and
 *                 never grey-alone: the row reads as inert by ground, and the
 *                 sentence beneath names the reason.
 */
export type W3ReactionState = 'idle' | 'selected' | 'failed' | 'unavailable';

export type W3ReactionSpec = {
  ground: string;
  label: keyof ThemeColors;
  minHeight: number;
  /** Row weight. 1.4 for the dominant action, 1 for the other two. */
  flex: number;
  /** The second channel on a selected control. */
  tick: boolean;
  accessibilityState: { selected: boolean; disabled: boolean };
};

/** Three across at 48; stacked at 60. Both clear the 44 pt floor. */
export const W3_ROW_HEIGHT = 48;
export const W3_STACKED_HEIGHT = 60;
/** The dominant action's share of the row. */
export const W3_WEAR_WEIGHT = 1.4;

export function w3ReactionSpec({
  kind,
  state,
  stacked = false,
  accent = true,
}: {
  kind: W3ReactionKind;
  state: W3ReactionState;
  stacked?: boolean;
  /**
   * Whether this frame's one oxblood belongs to the wear action. False on the
   * occasion interrupt (T-02), where the accent moves to the interrupt and the
   * wear action falls back to ink — one dominant action, one accent, still.
   */
  accent?: boolean;
}): W3ReactionSpec {
  const minHeight = stacked ? W3_STACKED_HEIGHT : W3_ROW_HEIGHT;
  const flex = kind === 'wear' ? W3_WEAR_WEIGHT : 1;

  if (state === 'unavailable') {
    return {
      ground: 'bg-tray',
      label: 'muted',
      minHeight,
      flex,
      tick: false,
      accessibilityState: { selected: false, disabled: true },
    };
  }

  if (state === 'failed') {
    return {
      ground: 'border border-accent',
      label: 'accent',
      minHeight,
      flex,
      tick: false,
      accessibilityState: { selected: true, disabled: false },
    };
  }

  if (state === 'selected') {
    return {
      ground: 'bg-ink',
      label: 'canvas',
      minHeight,
      flex,
      tick: true,
      accessibilityState: { selected: true, disabled: false },
    };
  }

  // Idle. The wear action is the filled one — it is the day's decision, and the
  // only control on the plate that changes a wear count.
  return {
    ground: kind === 'wear' ? (accent ? 'bg-accent' : 'bg-ink') : 'border border-rule',
    label: kind === 'wear' ? 'canvas' : 'ink',
    minHeight,
    flex,
    tick: false,
    accessibilityState: { selected: false, disabled: false },
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

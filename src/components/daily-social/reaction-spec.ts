/**
 * THE THREE-REACTION CONTROL, AS DATA — DS-06.
 *
 * Beside its component, in the shape `button-spec.ts`, `chip-spec.ts` and
 * `today/reaction-spec.ts` already use: the rules that decide how a control
 * looks and what it announces are pure functions of its inputs, so the node
 * runner can assert them without a renderer. A resting pill and a chosen one
 * are the whole visual contract of this control, and both are invisible in a
 * rendered tree — they look like two Views until you read the props.
 *
 * ── Why this is not `today/reaction-spec.ts` ────────────────────────────────
 *
 * That file is the closest existing primitive and it was read before this one
 * was written. It cannot be reused, for two reasons that are not preferences:
 *
 *   1. **Its floor is 40 pt.** `reactionPillSpec` returns
 *      `MIN_TAP_TARGET - 4`, and this packet's requirement is ≥44. Changing it
 *      would move a shipped control on Today that has its own accepted
 *      geometry and its own test.
 *   2. **Its vocabulary is wear / love / pass**, one of which is dominant, one
 *      of which is a refusal, and both of which are wrong here. These three are
 *      equal and none of them is negative, so there is no weighting to apply
 *      and no `pass` slot to draw.
 *
 * What IS reused is the thing worth sharing: `AX_FONT_SCALE`, the single
 * threshold at which this app stops putting three labelled controls across one
 * measure. A second number for the same decision is how two rows come to break
 * at different type sizes.
 *
 * ── Three channels, minus the one this control does not have ────────────────
 *
 * The house rule (audit 59) is that a selected state must be distinguishable
 * without colour, on three channels: fill, tick, and a changed verb. Two of
 * them are available here. The third is not: the labels are `Sharp`, `Cozy`
 * and `Noted`, fixed by the atlas, and a control whose word changed when
 * pressed would be a fourth reaction appearing out of the first three. So the
 * fill inverts (outline → solid ink) AND a tick appears, and the reader's
 * channel is `accessibilityState.selected`, which is not a visual at all.
 */

import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { MIN_TAP_TARGET } from '@/theme/metrics';

/**
 * The control's height floor. The Apple minimum, taken literally: this is a
 * small control in a row of three and there is nothing else to hit near it.
 *
 * A floor and not a height. Nothing here is a fixed `height`, because a label
 * at AX-XXXL is taller than 44 on its own and a fixed box would clip the word.
 */
export const DAILY_REACTION_MIN_HEIGHT = MIN_TAP_TARGET;

/** The gap between the three, across and stacked. On the 1/8/12/… scale. */
export const DAILY_REACTION_GAP = 8;

export type DailyReactionVisual = {
  /** Ground and ring classes. */
  ground: string;
  /** Label colour token — canvas once chosen, so it reads on the ink fill. */
  label: 'ink' | 'canvas';
  /** The second non-colour channel. See the header for why there is no third. */
  tick: boolean;
  minHeight: number;
  /**
   * Both halves, because the control is both things.
   *
   * `checked` is what the atlas draws (`aria-checked`) and what a `radio` role
   * carries on iOS; `selected` is what the atlas's own "selection without
   * colour" clause names, and what a reader who is not on the radio trait still
   * hears. Neither is derivable from the other in React Native, and the state
   * is the ONLY channel a screen reader has — a chosen chip and a resting one
   * differ in a fill and a tick, and neither of those is audible.
   */
  accessibilityState: { checked: boolean; selected: boolean };
};

export function dailyReactionVisual(selected: boolean): DailyReactionVisual {
  return {
    // ── OXBLOOD, WHERE THIS USED TO SAY INK ─────────────────────────────────
    //
    // The earlier note here argued for ink: "the frame's one accent belongs to
    // the state that stops the page (the offline kicker), and spending it on
    // three chips per card would make a page of looks read as a page of
    // alerts." Redesign 17's accepted frames settle both halves of that
    // differently, and they are the design of record:
    //
    //   · The state that stops the page is no longer oxblood. The recoverable
    //     failures — a circle that would not load, a reaction that did not
    //     save — are drawn on the warning amber at a low alpha, which is the
    //     app's own recoverable-trouble ground. The accent is not spoken for.
    //   · Only ONE chip per card is ever filled, and most cards have none.
    //     What the reader sees on a scroll is their own occasional mark, not a
    //     column of alerts — and `look-reaction-chosen` is precisely the frame
    //     that shows it warm rather than black.
    //
    // The resting chip changes with it: `sand`, the app's recessed tile, in
    // place of an outline. A chip that is a ring and a chip that is a fill are
    // two different objects; a chip that is a quiet tile and a chip that is a
    // warm one are the same object in two states, which is what a reversible
    // choice should look like.
    ground: selected ? 'bg-accent' : 'bg-sand',
    label: selected ? 'canvas' : 'ink',
    tick: selected,
    minHeight: DAILY_REACTION_MIN_HEIGHT,
    accessibilityState: { checked: selected, selected },
  };
}

/**
 * Whether the three stop sitting across a measure and stack.
 *
 * At or above `AX_FONT_SCALE` — the top of iOS's standard range — three
 * labelled controls across a card's measure begin to clip, which is the exact
 * failure audit 59 was raised for. Nothing is capped and nothing is removed at
 * this threshold; only the arrangement changes, which is the one thing the
 * accessibility contract allows.
 */
export function dailyReactionsStacked(fontScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= AX_FONT_SCALE;
}

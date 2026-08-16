import type { VisibilityFlag } from './use-closet-visibility';

/**
 * The words on the visibility screen.
 *
 * Separate from the screen for the reason every copy module in this codebase
 * is: a sentence that makes a promise about who can see something is worth a
 * test, and a test should not have to render React to read it.
 *
 * ── THE ONE THING THIS COPY MUST NOT DO ───────────────────────────────────
 *
 * It must not imply that turning a switch off makes something private from
 * everybody. It does not. These four flags govern exactly one audience —
 * mutual friends — and the public boundary is a different control
 * (`profiles.visibility`, default `'private'`). So every line says "friends",
 * never "people" and never "anyone", and the page's own lead says which
 * audience the whole screen is about before the first switch.
 */

export const VISIBILITY_TITLE = 'What friends can see';

export const VISIBILITY_LEAD =
  'These control what the friends you follow back can see when they open your closet. They do not change anything outside Cinch, and your profile stays private to everyone else.';

export const VISIBILITY_LABELS: Record<VisibilityFlag, string> = {
  closetVisible: 'Your closet',
  piecesVisible: 'Number of pieces',
  wearsVisible: 'Times worn',
  costPerWearVisible: 'Cost per wear',
};

/**
 * The sub-line under each switch: what is true right now, not what the switch
 * would do. A control that describes its own action reads as an instruction;
 * one that describes the world reads as a fact you can change.
 */
export function visibilityState(flag: VisibilityFlag, visible: boolean): string {
  if (flag === 'closetVisible') {
    return visible ? 'Friends can open your closet.' : 'Hidden. Friends see your profile only.';
  }
  const shown: Record<Exclude<VisibilityFlag, 'closetVisible'>, [string, string]> = {
    piecesVisible: ['Friends see how many pieces you own.', 'Hidden.'],
    wearsVisible: ['Friends see how often you wear things.', 'Hidden.'],
    costPerWearVisible: ['Friends see what a piece costs you per wear.', 'Hidden.'],
  };
  const pair = shown[flag as Exclude<VisibilityFlag, 'closetVisible'>];
  return visible ? pair[0] : pair[1];
}

/**
 * Why the three stat switches go inert when the closet is hidden.
 *
 * Not a courtesy: `friend_closet_meta` nulls all three stats behind
 * `case when p.closet_hidden or p.stat_*_hidden`, so with the closet hidden
 * these three already answer null no matter how they are set. Leaving them
 * operable would let someone switch "Times worn" on and change nothing, which
 * is a control that lies. `ToggleRow`'s `overridden` draws exactly this state
 * and keeps the label at full strength while it does.
 */
export const VISIBILITY_OVERRIDDEN_REASON =
  'Your closet is hidden, so friends see none of these.';

/** The row that opens this screen from the privacy index. */
export const VISIBILITY_INDEX_LABEL = 'What friends can see';
export const VISIBILITY_INDEX_DETAIL = 'Closet, pieces, wears, cost per wear';

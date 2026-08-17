/**
 * ── A PLACEHOLDER, AND THE ONE FILE INTEGRATION DELETES ─────────────────────
 *
 * Worker B owns `src/features/daily-social/types.ts` and is writing it in a
 * parallel worktree, so it does not exist here. This lane needs three of its
 * declarations to type its own props, and inventing a second spelling of them
 * in each component is how two files come to disagree about what a reaction is.
 *
 * So they are declared ONCE, here, transcribed verbatim from the packet's
 * stated interface. **On integration, replace the body of this file with**
 *
 *     export * from './types';
 *
 * **or delete it and repoint its importers.** Those importers, all in this
 * lane, are:
 *
 *   · `src/features/daily-social/copy.ts`
 *   · `src/components/daily-social/reaction-spec.ts`
 *   · `src/components/daily-social/reaction-row.tsx`
 *   · `src/components/daily-social/look-card.tsx`
 *
 * Nothing else in the repository imports it, and nothing here adds a field
 * Worker B's file does not have — a placeholder that grows its own surface is a
 * second source of truth wearing a temporary name.
 *
 * `DailyLookPiece` and `DailyLook` are declared for completeness of the wire
 * shape but are deliberately NOT what the components take: a component here
 * receives already-signed image URLs as strings, because resolving a storage
 * path to a signed URL is a query concern (`use-image-urls.ts`) and belongs to
 * Worker B's lane. See `LookCardPiece` in `look-card.tsx` for the boundary.
 */

export type DailyReaction = 'sharp' | 'cozy' | 'noted';

/**
 * The three, in the order they are drawn. Fixed at three by contract §3.5 —
 * "Exactly three reactions. Not four, not a picker, not an emoji tray."
 */
export const DAILY_REACTIONS: readonly DailyReaction[] = ['sharp', 'cozy', 'noted'];

export interface DailyLookPiece {
  itemId: string;
  thumbPath: string | null;
  cutoutPath: string | null;
  platePath: string | null;
}

export interface DailyLook {
  outfitId: string;
  ownerId: string;
  name: string | null;
  wornAt: string;
  pieces: DailyLookPiece[];
}

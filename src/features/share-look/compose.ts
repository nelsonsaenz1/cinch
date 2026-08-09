/**
 * Pure logic for the Share a Look compose flow (S-01…S-03).
 *
 * Kept out of any `.tsx` on purpose (hard rule: the test bundler cannot parse
 * React Native's Flow source, so a test that imports a component fails to
 * build — see `tests/look-plate.test.ts` and `look-layout.ts` for the same
 * reasoning). Everything a screen needs to decide — what the stack looks like
 * after a drag, what the title should say before anyone types one, how many
 * people a caption is about to reach — lives here so it is one testable thing
 * instead of logic re-derived inside a component.
 */

import { MAX_CELLS } from '@/features/event-outfits/look-layout';
import type { Garment } from '@/lib/styling';

// ---------------------------------------------------------------------------
// The stack — S-01 picking, S-02 reordering
// ---------------------------------------------------------------------------

/** "one garment is a piece, not a look" — Compose stays inert below this. */
export const MIN_PIECES_TO_COMPOSE = 2;

/** The plate's own ceiling (`look-layout.ts`), consumed rather than re-typed. */
export const MAX_PIECES = MAX_CELLS;

export function canCompose(stack: readonly Garment[]): boolean {
  return stack.length >= MIN_PIECES_TO_COMPOSE;
}

/**
 * Tap a piece in the picker: adds it to the end of the stack (it becomes the
 * next number) or removes it if it was already in. Silently refuses past the
 * ceiling rather than erroring — the picker has nothing useful to say beyond
 * "six is the ceiling", which is `stackStatusLine` below's job, not this one's.
 */
export function togglePiece(stack: readonly Garment[], piece: Garment): Garment[] {
  const already = stack.some((g) => g.id === piece.id);
  if (already) return stack.filter((g) => g.id !== piece.id);
  if (stack.length >= MAX_PIECES) return [...stack];
  return [...stack, piece];
}

/**
 * Remove one piece from the stack by id. The remaining pieces keep their
 * relative order — renumbering is a consequence of array position, never a
 * separate step that can drift from it.
 */
export function removePiece(stack: readonly Garment[], id: string): Garment[] {
  return stack.filter((g) => g.id !== id);
}

/**
 * Move a piece from one index to another — the drag-to-reorder primitive.
 * Out-of-range indices are a no-op copy rather than a throw: a gesture handler
 * mid-drag can report a transient index no list actually has.
 */
export function moveStackPiece(stack: readonly Garment[], from: number, to: number): Garment[] {
  if (from === to || from < 0 || to < 0 || from >= stack.length || to >= stack.length) {
    return [...stack];
  }
  const next = [...stack];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as Garment);
  return next;
}

/** The S-01 tray's category chips. */
export type PieceCategoryFilter = 'All' | 'Tops' | 'Bottoms' | 'Shoes';

export function matchesCategoryFilter(garment: Garment, filter: PieceCategoryFilter): boolean {
  switch (filter) {
    case 'All':
      return true;
    case 'Tops':
      return garment.category === 'top';
    case 'Bottoms':
      return garment.category === 'bottom';
    case 'Shoes':
      return garment.category === 'footwear';
  }
}

/**
 * The composer's status sentence (grammar reference §2's `statusLine`),
 * adapted to the actual ceiling and floor this flow ships:
 * nothing picked, one piece needing a second, mid-stack, or at the ceiling.
 */
export function stackStatusLine(stack: readonly Garment[]): string {
  if (stack.length === 0) return 'Nothing picked. Two pieces make a look.';
  if (stack.length === 1) return 'One piece is a piece. Add another to post.';
  if (stack.length >= MAX_PIECES) return `${MAX_PIECES} is the ceiling. Remove one to swap.`;
  const lead = stack[0]!;
  const noun = (lead.subcategory ?? lead.category).toLowerCase();
  return `${stack.length} pieces · ${noun} leads the card.`;
}

// ---------------------------------------------------------------------------
// Title generation — S-03
// ---------------------------------------------------------------------------

export function capitalise(word: string): string {
  return word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function dominantColourName(g: Garment): string | null {
  const name = g.colors[0]?.name;
  return name ? capitalise(name) : null;
}

function nounOf(g: Garment): string {
  return capitalise(g.subcategory ?? g.category);
}

/** "Mohair sweater" — the display name a picker cell or stack row prints. */
export function garmentDisplayName(g: Garment): string {
  return nounOf(g);
}

/** "Cream · Everlane" — the muted meta line under a stack row's name. */
export function garmentMetaLine(g: Garment): string {
  const colour = dominantColourName(g);
  return [colour, g.brand].filter((part): part is string => Boolean(part)).join(' · ');
}

/**
 * "The title arrives pre-written from the pieces themselves — two dominant
 * colours, one noun — so the fastest path through the screen is a real name
 * rather than 'Untitled'."
 *
 * Never produces the string "Untitled", at any piece count above zero: a
 * single piece falls back to its own colour and noun ("Cream Sweater") rather
 * than admitting nothing to say, and a closet with no colour data at all
 * falls back to the leading nouns rather than an empty title.
 *
 * Piece order matters here too — the "two dominant colours" are read off the
 * two heaviest garments, not piece one and two of the stack, because the title
 * is describing what the look IS, not the order it stacks in. Stack order
 * stays untouched; this only reads it.
 */
export function titleFromPieces(pieces: readonly Garment[]): string {
  if (pieces.length === 0) return 'A look';

  const byWeight = [...pieces].sort((a, b) => b.visualWeight - a.visualWeight);

  if (pieces.length === 1) {
    const g = byWeight[0]!;
    const colour = dominantColourName(g);
    return colour ? `${colour} ${nounOf(g)}` : nounOf(g);
  }

  const colours: string[] = [];
  for (const g of byWeight) {
    const c = dominantColourName(g);
    if (c && !colours.includes(c)) colours.push(c);
    if (colours.length === 2) break;
  }
  if (colours.length === 2) return colours.join(' & ');
  if (colours.length === 1) return `${colours[0]} & ${nounOf(byWeight[0]!)}`;

  const nouns: string[] = [];
  for (const g of byWeight) {
    const n = nounOf(g);
    if (!nouns.includes(n)) nouns.push(n);
    if (nouns.length === 2) break;
  }
  return nouns.length ? nouns.join(' & ') : 'A look';
}

/** "The mohair with the corduroy skirt, loafers under." — the suggested caption line. */
export function captionFromPieces(pieces: readonly Garment[]): string {
  if (pieces.length === 0) return '';
  const names = pieces.map((g) => (g.subcategory ?? g.category).toLowerCase());
  if (names.length === 1) return names[0]!;
  const [first, ...rest] = names;
  return `The ${first} with the ${rest.join(', ')}.`;
}

/** The on-screen counter cap (S-03's "52 / 140") — stricter than the schema's 280. */
export const CAPTION_DISPLAY_MAX = 140;

// ---------------------------------------------------------------------------
// Audience and wear lines — S-03, S-04
// ---------------------------------------------------------------------------

/**
 * "The audience is stated in people, not in a privacy word" — the only
 * sentence that reliably prevents a post to the wrong room.
 */
export function audienceLine(peopleCount: number): string {
  return peopleCount === 1 ? '1 person can see this' : `${peopleCount} people can see this`;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

export function wordForCount(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "Posted, and four wears counted in Lately." — only printed when the toggle was on. */
export function postedToLatelyLine(pieceCount: number): string {
  const word = pieceCount === 1 ? 'wear' : 'wears';
  return `Posted, and ${wordForCount(pieceCount)} ${word} counted in Lately.`;
}

/**
 * The Ten's slot model — ten generic positions, and nothing else.
 *
 * WHAT THIS FILE USED TO BE, and why it isn't any more.
 *
 * The free closet was ten NAMED positions: 3 tops, 2 bottoms, 1 dress, 2
 * shoes, 1 outerwear, 1 bag. Every tile carried its category word before a
 * photograph existed, a slot could be "declined" and redirected to another
 * kind, and the substitution sheet quoted the count a FINISHED closet would
 * make from a plan nobody had photographed yet.
 *
 * It failed the first real male tester who used it. He added three tops, a
 * hoodie, two pairs of trousers, two pairs of shoes, a watch and one more
 * piece — a good starter closet by any measure — and the grid spent the whole
 * flow telling him he was wrong about his own wardrobe, because it had decided
 * in advance that he owned a dress and a bag.
 *
 * So a slot is now a POSITION and nothing more: an index, and whatever garment
 * landed in it. It has no kind, and it never had any business having one —
 * what a piece IS has always been the classifier's answer, and a position that
 * carries its own opinion can only ever disagree with the tagger. Readiness,
 * the outfit count and the next-best suggestion all read the real wardrobe:
 * see `starter-readiness.ts`.
 *
 * WHAT WENT WITH IT. `plannedTally` — a tally of a PLAN — is gone, along with
 * `declineSlot` / `redirectOptions` / the substitution sheet they fed. A
 * generic empty cell cannot be declined into something else, because it was
 * never asking for anything in particular; "skip this" has no referent when
 * the tile says "Add a piece". The only arithmetic left in the flow is
 * `countOutfits` over garments that genuinely exist.
 */

import { PLANS } from '@/features/billing/plans';
import type { Garment } from '@/lib/styling';

/**
 * A position's life cycle. Two states, where there used to be three: `open`
 * described a slot deliberately declined, and there is no longer anything to
 * decline.
 */
export type TenSlotStatus = 'empty' | 'filled';

export type TenSlot = {
  /** Stable 1..N identity — the grid position, never reassigned. */
  id: number;
  status: TenSlotStatus;
  /** The captured garment's id, once filled. */
  garmentId: string | null;
};

/** How many positions the starter grid draws. The free closet's own size. */
export const TEN_SLOTS = PLANS.free.items;

/**
 * The word an EMPTY tile carries.
 *
 * Generic, and that is the correction: a tile that says "Dress" to somebody
 * who owns none is an icon of a garment the user does not have, which is the
 * exact failure the atlas already forbids for placeholder imagery. A filled
 * tile names its real garment instead — see `TenTile`.
 */
export const EMPTY_SLOT_LABEL = 'Add a piece';

/** Ten empty positions, in the grid's own reading order. */
export function emptyTen(count: number = TEN_SLOTS): TenSlot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    status: 'empty' as const,
    garmentId: null,
  }));
}

/** Positions holding a real garment. The only count this module can make. */
export function filledCount(slots: readonly TenSlot[]): number {
  return slots.filter((s) => s.status === 'filled').length;
}

/** Every position holds a garment. Says nothing about whether they're enough. */
export function isComplete(slots: readonly TenSlot[]): boolean {
  return filledCount(slots) === slots.length;
}

/**
 * The next position Cinch would offer — the recommendation, never a gate.
 * "Order is a suggestion... any slot can be tapped directly."
 */
export function nextSlot(slots: readonly TenSlot[]): TenSlot | null {
  return slots.find((s) => s.status === 'empty') ?? null;
}

/** Fill a position with a garment. No-op on an already-filled one. */
export function fillSlot(
  slots: readonly TenSlot[],
  slotId: number,
  garmentId: string,
): TenSlot[] {
  return slots.map((s) =>
    s.id === slotId && s.status === 'empty' ? { ...s, status: 'filled', garmentId } : s,
  );
}

/**
 * Swap the garment held by ONE position — LP-02's whole mutation.
 *
 * The counterpart to `fillSlot`, and deliberately the narrower of the two: it
 * touches neither `id` nor `status`, so the grid keeps its length, its order
 * and its filled count across a replacement. A photograph taken again for slot
 * three lands in slot three; 7 of 10 is still 7 of 10 afterwards.
 *
 * A no-op on an empty position. An empty slot has no garment to replace, and a
 * replacement that could FILL one would be the second, quieter way to add a
 * piece — the flow already has `fillSlot` for that, and two paths into the same
 * transition is how the count and the queue drift apart.
 */
export function replaceSlot(
  slots: readonly TenSlot[],
  slotId: number,
  garmentId: string,
): TenSlot[] {
  return slots.map((s) => (s.id === slotId && s.status === 'filled' ? { ...s, garmentId } : s));
}

/** The garment ids the grid is currently holding, in position order. */
export function placedIds(slots: readonly TenSlot[]): string[] {
  return slots.flatMap((s) => (s.garmentId ? [s.garmentId] : []));
}

/**
 * Resume from a real wardrobe. "Nothing is ever lost... Returning resumes at
 * the count, not at the start" (free-tier-contract.md §2).
 *
 * EVERY CATEGORY IS PLACED, and this is the second half of the correction.
 * Hydration used to run each garment through a kind map and drop anything the
 * template had no position for — a watch, a hat, an eleventh top — so a reader
 * who closed the app after photographing a watch came back to a grid that had
 * silently forgotten it. Positions are generic now, so there is nothing to
 * match against and nothing to coerce: the first ten garments fill the first
 * ten positions in wardrobe order, whatever they are.
 *
 * A closet larger than the grid still overflows it, and that is honest — the
 * grid draws ten positions and a wardrobe of sixty does not fit in them. What
 * it no longer does is choose WHICH ten by category.
 */
export function hydrateFromWardrobe(
  wardrobe: readonly Garment[],
  count: number = TEN_SLOTS,
): TenSlot[] {
  return emptyTen(count).map((slot, i) => {
    const garment = wardrobe[i];
    return garment ? { ...slot, status: 'filled' as const, garmentId: garment.id } : slot;
  });
}

/**
 * Keep the grid honest against the real closet AFTER hydration — CMO ledger
 * A28 (2026-09-11).
 *
 * Hydration runs once, when the wardrobe first loads; from then on the grid
 * learns about new rows only through `fillSlot`, which `TenCamera` calls once
 * per shot. Read back from production on 2026-09-10, that was a lie the grid
 * told for six minutes: two shutter taps a second apart filed TWO rows into
 * ONE well (three times over), so the tray showed seven filled while the
 * account held ten, the reader kept photographing into wells the server had
 * no room for, and `items_enforce_limit` refused twenty-eight photographs in a
 * row — each one a Vision pass, a cutout and a "couldn't add" toast. The camera
 * now takes one shot per mount (see `TenCamera`), and this is the other half:
 * any garment the wardrobe holds that no well is holding takes the next open
 * well, in wardrobe order, so the count the reader sees is the count the
 * trigger enforces.
 *
 * ADD ONLY, NEVER EMPTY. A well whose garment has left the wardrobe is left
 * alone on purpose: `useWardrobe` filters `pending_tag`, so a photograph that
 * was filed a second ago is absent from the wardrobe until the tagger returns,
 * and emptying its well would blank the tile the reader just filled. The
 * replacement flow (LP-02) archives the outgoing piece deliberately and keeps
 * its tile; the caller skips reconciliation while that flow is open.
 *
 * Returns the SAME array when nothing changes, so a state setter given this
 * result can bail out without a render.
 */
export function reconcileWithWardrobe(
  slots: readonly TenSlot[],
  wardrobeIds: readonly string[],
): readonly TenSlot[] {
  const placed = new Set(placedIds(slots));
  const unplaced = wardrobeIds.filter((id) => !placed.has(id));
  if (unplaced.length === 0) return slots;
  let next = slots;
  for (const id of unplaced) {
    const open = nextSlot(next);
    if (!open) break;
    next = fillSlot(next, open.id, id);
  }
  return next;
}

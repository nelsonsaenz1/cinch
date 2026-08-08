/**
 * The Ten's slot model.
 *
 * The free closet is ten NAMED positions, not a bare counter: 3 tops,
 * 2 bottoms, 1 dress, 2 shoes, 1 outerwear, 1 bag (free-tier-contract.md §2).
 * This module is the single place that tracks which position holds what and
 * turns a decline into a redirect rather than a drop — "declining redirects
 * the slot rather than dropping it" is a rule about STATE, and state belongs
 * in one place.
 *
 * Every arithmetic claim this module can make — a redirect's projected count,
 * the reveal's headline number — is delegated to `outfit-count.ts`. This file
 * never computes `tops * bottoms * shoes` itself.
 */

import {
  COUNTED_KINDS,
  countOutfits,
  EMPTY_TALLY,
  kindOfSlot,
  type CountedKind,
  type Tally,
} from '@/features/closet/outfit-count';
import type { Garment } from '@/lib/styling';

// Re-exported so callers of the slot model don't also need a direct import
// from `outfit-count.ts` for the one type they share.
export type { CountedKind };

/** The two required-but-uncounted positions, alongside the four counted kinds. */
export type TenSlotKind = CountedKind | 'outerwear' | 'bag';

function isCountedKind(kind: TenSlotKind): kind is CountedKind {
  return (COUNTED_KINDS as readonly string[]).includes(kind);
}

/**
 * A position's life cycle.
 *
 * `empty` — nothing photographed yet, kind may still be redirected.
 * `filled` — a garment sits here.
 * `open` — declined and deliberately left empty forever ("keep the slot
 *   open"). Distinct from `empty`: an open slot is settled, not pending, and
 *   does not re-offer itself as the next foregrounded slot.
 */
export type TenSlotStatus = 'empty' | 'filled' | 'open';

export type TenSlot = {
  /** Stable 1..10 identity — the grid position, never reassigned. */
  id: number;
  /** What this position was named at the start of the flow. Never changes. */
  originalKind: TenSlotKind;
  /** What this position counts as now — changes only on a redirect. */
  kind: TenSlotKind;
  status: TenSlotStatus;
  /** The captured garment's id, once filled. */
  garmentId: string | null;
};

/** The word a slot's tile carries, per free-tier-contract.md §2. */
export const SLOT_LABEL: Record<TenSlotKind, string> = {
  tops: 'Top',
  bottoms: 'Bottom',
  dresses: 'Dress',
  shoes: 'Shoes',
  outerwear: 'Outerwear',
  bag: 'Bag',
};

/** The canonical ten, in the grid's own reading order (3 columns). */
export function canonicalTen(): TenSlot[] {
  const kinds: TenSlotKind[] = [
    'tops', 'tops', 'tops',
    'bottoms', 'bottoms',
    'dresses',
    'shoes', 'shoes',
    'outerwear',
    'bag',
  ];
  return kinds.map((kind, i) => ({
    id: i + 1,
    originalKind: kind,
    kind,
    status: 'empty',
    garmentId: null,
  }));
}

/** Every slot the flow considers settled — filled, or declined-and-kept-open. */
export function settledCount(slots: readonly TenSlot[]): number {
  return slots.filter((s) => s.status !== 'empty').length;
}

export function isComplete(slots: readonly TenSlot[]): boolean {
  return settledCount(slots) === slots.length;
}

/**
 * The next slot Cinch would suggest — the recommendation, never a gate.
 * "Order is a suggestion... any slot can be tapped directly." Lowest id among
 * the still-empty positions; callers are free to foreground any slot's id
 * instead when the user taps it directly.
 */
export function nextSlot(slots: readonly TenSlot[]): TenSlot | null {
  return slots.find((s) => s.status === 'empty') ?? null;
}

/**
 * The tally the current PLAN implies — every settled or pending slot counted
 * by its (possibly redirected) kind, an `open` slot counted as nothing.
 *
 * This is deliberately not "what's photographed so far": at slot six, tops
 * one and two are unfilled but still plan to exist, and the substitution
 * sheet's preview counts must reflect the finished closet, not the partial
 * one — that is what makes "a fourth top instead — sixteen outfits" true
 * before a fourth top has been photographed.
 */
export function plannedTally(slots: readonly TenSlot[]): Tally {
  const t: { [K in CountedKind]: number } = { ...EMPTY_TALLY };
  for (const s of slots) {
    if (s.status === 'open') continue;
    if (isCountedKind(s.kind)) t[s.kind] += 1;
  }
  return t;
}

/** The tally of what has actually been photographed — never a projection. */
export function filledTally(slots: readonly TenSlot[]): Tally {
  const t: { [K in CountedKind]: number } = { ...EMPTY_TALLY };
  for (const s of slots) {
    if (s.status !== 'filled') continue;
    if (isCountedKind(s.kind)) t[s.kind] += 1;
  }
  return t;
}

/** Fill a slot with a garment. No-op on an already-filled or open slot. */
export function fillSlot(slots: readonly TenSlot[], slotId: number, garmentId: string): TenSlot[] {
  return slots.map((s) =>
    s.id === slotId && s.status === 'empty' ? { ...s, status: 'filled', garmentId } : s,
  );
}

/** Which named position a real garment's engine slot would settle into. */
function tenKindOf(slot: Garment['slot']): TenSlotKind | null {
  const counted = kindOfSlot(slot);
  if (counted) return counted;
  if (slot === 'outerwear') return 'outerwear';
  if (slot === 'bag') return 'bag';
  return null; // headwear/accessory were never on the ten
}

/**
 * Resume from a real wardrobe. "Nothing is ever lost... Returning resumes at
 * the count, not at the start" (free-tier-contract.md §2) — a closet that
 * already has tagged garments in it (the app was killed mid-flow, or this is
 * a returning free user) fills the matching slots on the way in rather than
 * asking for the same photographs twice.
 *
 * Best-effort and order-stable: garments land in ascending slot-id order
 * within their kind, oldest first, and anything beyond the ten's own count
 * per kind (an eleventh top) simply isn't placed — it is still in the real
 * closet, just not on this list.
 */
export function hydrateFromWardrobe(wardrobe: readonly Garment[]): TenSlot[] {
  const byKind = new Map<TenSlotKind, Garment[]>();
  for (const g of wardrobe) {
    const kind = tenKindOf(g.slot);
    if (!kind) continue;
    const bucket = byKind.get(kind);
    if (bucket) bucket.push(g);
    else byKind.set(kind, [g]);
  }

  const cursors = new Map<TenSlotKind, number>();
  return canonicalTen().map((slot) => {
    const pool = byKind.get(slot.kind);
    const i = cursors.get(slot.kind) ?? 0;
    const garment = pool?.[i];
    if (!garment) return slot;
    cursors.set(slot.kind, i + 1);
    return { ...slot, status: 'filled', garmentId: garment.id };
  });
}

export type RedirectOption =
  | { kind: 'redirect'; to: CountedKind; total: number; recommended: boolean }
  | { kind: 'open'; total: number };

/**
 * Redirect the slot to a different counted kind, or leave it open.
 *
 * A slot that is already filled cannot be declined — nothing in this flow
 * ever implies a photograph gets thrown away (free-tier-contract.md §2,
 * "nothing is ever lost"); the sheet that calls this only ever opens on an
 * empty slot.
 */
export function declineSlot(
  slots: readonly TenSlot[],
  slotId: number,
  decision: { to: CountedKind } | { open: true },
): TenSlot[] {
  return slots.map((s) => {
    if (s.id !== slotId || s.status !== 'empty') return s;
    if ('open' in decision) return { ...s, status: 'open' };
    return { ...s, kind: decision.to };
  });
}

/**
 * Which two counted kinds a declined slot offers itself as, in recommended
 * order. T-04 is the one atlas evidence for this: declining the dress offers
 * a fourth top (recommended) and a third bottom, never a third pair of
 * shoes — the sheet narrows to the two kinds that read as a genuine
 * alternative to what was declined, not to every kind arithmetic could touch.
 *
 * The recommendation is NOT the higher count. T-04's own note: "the third
 * bottom out-counts the fourth top... the recommended option stays
 * recommended because the engine builds better outfits from it, not because
 * it scores higher." There is no build-quality signal in the codebase to
 * compute that from, so this table is the one place that judgment is made —
 * an editorial choice, not a derived one, and the reason it lives beside the
 * arithmetic rather than inside it.
 */
const REDIRECT_TARGETS: Record<TenSlotKind, readonly [CountedKind, CountedKind] | null> = {
  dresses: ['tops', 'bottoms'],
  tops: ['bottoms', 'shoes'],
  bottoms: ['tops', 'shoes'],
  shoes: ['tops', 'bottoms'],
  outerwear: ['tops', 'bottoms'],
  // The bag has no redirect — "Cinch can't style you until the bag is in".
  // Callers keep the Skip control off this slot entirely (see SlotCard); this
  // still resolves sanely if ever asked.
  bag: null,
};

/**
 * Every way this slot could be spent instead, each carrying the count the
 * finished closet would make — computed by `countOutfits`, never a table.
 * "Keep the slot open" is always last and always available.
 */
export function redirectOptions(slots: readonly TenSlot[], slotId: number): RedirectOption[] {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return [];

  const targets = REDIRECT_TARGETS[slot.kind] ?? [];
  const options: RedirectOption[] = targets.map((to, i) => ({
    kind: 'redirect',
    to,
    total: countOutfits(plannedTally(declineSlot(slots, slotId, { to }))),
    recommended: i === 0,
  }));
  options.push({
    kind: 'open',
    total: countOutfits(plannedTally(declineSlot(slots, slotId, { open: true }))),
  });
  return options;
}

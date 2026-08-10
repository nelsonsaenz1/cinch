/**
 * The Ten's copy — one line of reasoning per slot, per free-tier-contract.md
 * §2 ("each slot justifies itself in one sentence, and only while it is the
 * foregrounded slot"). Text lives here, not inside the components, so a
 * redirected slot (a declined dress rendering as a fourth top) reads exactly
 * like a canonical one rather than carrying leftover copy from its old kind.
 */

import type { CountedKind } from '@/features/closet/outfit-count';
import { articleFor, numberWord, ordinalWord } from '@/features/onboarding/reveal-copy';
import { nextSlot, settledCount, type TenSlot, type TenSlotKind } from '@/features/onboarding/ten-slots';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type SlotCopy = {
  /** The short phrase that follows "Slot N · " in the eyebrow and camera title. */
  phrase: string;
  title: string;
  body: string;
};

/**
 * The card content for a slot, given which occurrence of its (current) kind
 * this position is — the 1-based rank among same-kind slots at or before it,
 * from `slotOrdinalWithinKind` below. A redirected slot reads by its new
 * kind and rank, never its original one.
 */
export function slotCopy(kind: TenSlotKind, n: number): SlotCopy {
  switch (kind) {
    case 'tops':
      if (n === 1)
        return {
          phrase: 'a top you wear most',
          title: 'A top you wear most weeks',
          body: 'Three tops is what keeps a week from reading as one outfit worn repeatedly.',
        };
      if (n === 2)
        return {
          phrase: 'a second top',
          title: 'One that goes with the first',
          body: 'Two tops is where outfits start branching — the same trousers read differently under each.',
        };
      if (n === 3)
        return {
          phrase: 'a third top',
          title: 'Something you’d wear to dinner',
          body: 'Two tops you already have go with work. A third that goes out is what stops the evenings repeating.',
        };
      return {
        phrase: `a ${ordinalWord(n)} top`,
        title: 'One more, on its own merits',
        body: 'A fourth top is what a declined slot buys you — not a smaller closet, a different one.',
      };
    case 'bottoms':
      if (n === 1)
        return {
          phrase: 'a bottom',
          title: 'Whatever you reach for most',
          body: 'One bottom already doubles every top on the list.',
        };
      if (n === 2)
        return {
          phrase: 'a second bottom',
          title: 'One that changes the register',
          body: 'A second bottom is what lets the same top go two different places.',
        };
      return {
        phrase: `a ${ordinalWord(n)} bottom`,
        title: 'The one that out-counts the dress',
        body: 'A third bottom multiplies every top you own — that’s why it out-earns a fourth top.',
      };
    case 'dresses':
      if (n === 1)
        return {
          phrase: 'the dress',
          title: 'One outfit that needs only shoes',
          body: 'A whole look that asks nothing else of the list but a pair of shoes.',
        };
      return {
        phrase: `a ${ordinalWord(n)} dress`,
        title: 'Another whole outfit',
        body: 'Every extra dress pairs with both pairs of shoes on its own.',
      };
    case 'shoes':
      if (n === 1)
        return {
          phrase: 'shoes',
          title: 'The pair you put on without thinking',
          body: 'Every top and bottom on this list is about to run through them.',
        };
      if (n === 2)
        return {
          phrase: 'a second pair',
          title: 'One that changes the mood',
          body: 'The second pair changes an outfit without changing the clothes.',
        };
      return {
        phrase: `a ${ordinalWord(n)} pair`,
        title: 'One more foundation',
        body: 'Every pair of shoes multiplies the whole rest of the closet.',
      };
    case 'outerwear':
      return {
        phrase: 'the coat',
        title: 'Whatever you actually leave the house in',
        body: 'It sits over everything else Cinch builds.',
      };
    case 'bag':
      return {
        phrase: 'the last one',
        title: 'The bag you carry most days',
        body: 'Not the good one kept for occasions — the one that’s already by the door.',
      };
  }
}

/** 1-based rank of `slotId` among slots sharing its CURRENT kind, id order. */
export function slotOrdinalWithinKind(slots: readonly TenSlot[], slotId: number): number {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return 1;
  return slots.filter((s) => s.kind === slot.kind && s.id <= slotId).length;
}

/** The word a redirect option names — "a fourth top", "a third bottom". */
export function redirectLabel(slots: readonly TenSlot[], to: CountedKind): string {
  // Rank the hypothetical: how many slots of `to` would exist after adding
  // one more, i.e. the current planned count of that kind plus this one.
  const currentOfKind = slots.filter((s) => s.kind === to && s.status !== 'open').length;
  const copy = slotCopy(to, currentOfKind + 1);
  return copy.phrase;
}

/** T-04's substitution sheet — title and intro, per the slot being declined. */
export function declineCopy(kind: TenSlotKind): { title: string; body: string } {
  if (kind === 'dresses') {
    return {
      title: 'No dress? Spend the slot elsewhere.',
      body: 'A dress is one outfit that needs only shoes, which is why it’s on the list. If you don’t wear them, another top does more for you.',
    };
  }
  const noun = slotCopy(kind, 1);
  return {
    title: `No ${noun.phrase}? Spend the slot elsewhere.`,
    body: `${noun.title} is on the list because ${noun.body.charAt(0).toLowerCase()}${noun.body.slice(1)} If that’s not you, another slot does more.`,
  };
}

/**
 * The line under The Ten's masthead — three moments, and every number in them
 * read from the slot list rather than typed into the sentence
 * (positioning-contract.md §7; the rule this module's siblings already follow
 * at `tour-copy.ts:29`).
 *
 * THE BAG SENTENCE IS CONDITIONAL, and it did not used to be. "Order is a
 * suggestion" (free-tier-contract.md §2) means the last position left standing
 * is whichever one the reader put off, not whichever one the recommended order
 * puts last — so the line that says Cinch cannot style anyone until the bag is
 * in was false for everyone who photographed the bag early and left a top for
 * the end. It now names the bag only when the bag is genuinely what remains.
 */
export function tenProgressLine(slots: readonly TenSlot[]): string {
  const total = slots.length;
  const remaining = total - settledCount(slots);

  if (remaining === total) {
    return (
      `${cap(numberWord(total))} pieces is enough for Cinch to style you properly. ` +
      'Photograph these, in any order.'
    );
  }
  if (remaining === 1 && nextSlot(slots)?.kind === 'bag') {
    return "One left. Cinch can't style you until the bag is in — every outfit it builds finishes with one.";
  }
  // Zero remaining lives behind T-06's stop sheet for a frame or two, but the
  // sheet is a modal and this line is still under it — "0 to go" is not a
  // sentence anyone should be able to catch sight of.
  if (remaining === 0) {
    return `That’s all ${numberWord(total)}. Nothing here is final — you can swap any piece later.`;
  }
  return `${remaining} to go. Nothing here is final — you can swap any piece later.`;
}

/**
 * T-06's stop sheet, both sentences of it.
 *
 * `total` is the free closet — `PLANS.free.items`, passed in rather than read
 * here so this module keeps its one job and its testability. The eleventh is
 * derived from it too: "there's room for an eleventh" is a claim about where
 * the free tier stops, and if the tier ever moves the sentence has to move
 * with it or it becomes a quietly false statement about a limit the database
 * no longer enforces.
 */
export function stopSheetCopy(
  total: number,
  /**
   * What this closet makes, from `countOutfits` — the one number here that is
   * NOT a constant and never may be (positioning-contract.md §3). It is passed
   * through rather than computed because the caller holds the tally.
   */
  count: number,
): { eyebrow: string; title: string; body: string } {
  const word = numberWord(total);
  const next = ordinalWord(total + 1);
  return {
    eyebrow: `${cap(word)} of ${word}`,
    title: `That’s the ${word}. There’s room for ${articleFor(next)} ${next} on a larger closet.`,
    body:
      `Your ${word} make ${count} outfit${count === 1 ? '' : 's'}. ` +
      'Nothing you’ve photographed goes anywhere — you can swap a piece out whenever you like.',
  };
}

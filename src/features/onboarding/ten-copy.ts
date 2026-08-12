/**
 * The Ten's copy — one line of reasoning per slot, per free-tier-contract.md
 * §2 ("each slot justifies itself in one sentence, and only while it is the
 * foregrounded slot"). Text lives here, not inside the components, so a
 * redirected slot (a declined dress rendering as a fourth top) reads exactly
 * like a canonical one rather than carrying leftover copy from its old kind.
 */

import type { CountedKind } from '@/features/closet/outfit-count';
import { articleFor, numberWord, ordinalWord } from '@/features/onboarding/reveal-copy';
import {
  nextSlot,
  settledCount,
  SLOT_LABEL,
  type RedirectOption,
  type TenSlot,
  type TenSlotKind,
} from '@/features/onboarding/ten-slots';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The one title the whole hallway's ten-piece surface carries — TR-05, TR-06,
 * T-01, T-02 and T-04 all print it, so it is written once.
 *
 * It replaced "The Ten", which was the flow's internal name showing through:
 * the atlas titles every frame of this surface "Your first ten", and a screen
 * that names itself after the spec is a screen that assumes the reader has
 * read the spec.
 */
export const TEN_TITLE = 'Your first ten';

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
    // "or pick them from your camera roll" is load-bearing, not a courtesy.
    // The library button has always been there beside the shutter
    // (components/onboarding/ten-camera-chrome.tsx, wired to `pickFromLibrary`
    // in ten-camera.tsx), but the only sentence on the screen said
    // "Photograph these" — so somebody who does not want to stand over their
    // wardrobe with a camera read the first screen of the app as work they
    // had already decided against, and had no way to learn otherwise.
    //
    // The claim is safe to print: the picker runs out of process and needs no
    // permission (app.config.ts suppresses NSPhotoLibraryUsageDescription for
    // exactly this reason), so the sentence cannot lead anyone into a prompt.
    return (
      `${cap(numberWord(total))} pieces is enough for Cinch to style you properly. ` +
      'Photograph them, or pick them from your camera roll — in any order.'
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

// ---------------------------------------------------------------------------
// TR-05 · the two doors
// ---------------------------------------------------------------------------

/**
 * The door choice, drawn as peers.
 *
 * The acceptance criterion the atlas states for this frame is that voice and
 * photography read as EQUAL doors, not primary and fallback — which is a claim
 * about the words as much as the plates. Both lines are the same length, both
 * name what the reader will actually do, and neither promises the other is
 * slower. Kept here rather than in the component for the reason every copy
 * module in this folder exists: the test bundler cannot parse React Native's
 * Flow source, so anything a test reads has to live in a plain `.ts`.
 */
export const FIRST_TEN_DOORS = {
  headline: 'How would you rather do this?',
  body: 'Both get to the same closet. Photographs give Cinch the real garment; speaking gets a lot of pieces in quickly and you fix the details afterwards.',
  photograph: {
    name: 'Photograph them',
    line: 'Ten named slots, one picture each. Cinch cuts each piece out and files it. You can pick from your camera roll instead.',
    /** TR-06 draws the same door with the line cut to its first clause. */
    shortLine: 'Ten named slots, one picture each.',
  },
  voice: {
    name: 'Describe them out loud',
    line: 'Walk your wardrobe and say what is in it. Cinch writes the list, you confirm it card by card, and photographs can come later.',
  },
  /**
   * A statement of fact, not a request — the request is the consent sheet the
   * chosen door raises. It is true of both doors: `capture.tsx` gates its first
   * upload on `ConsentSheet`, and the walkthrough gates the microphone on the
   * system prompt that follows its own Start.
   */
  footer:
    'Whichever you choose, nothing is sent anywhere until you have said yes to it on the next screen.',
} as const;

// ---------------------------------------------------------------------------
// TR-06 · a walkthrough left unfinished
// ---------------------------------------------------------------------------

export type ResumeCardCopy = {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  secondary: string;
};

/**
 * TR-06's single card. There is only ever one unfinished walkthrough, so this
 * is a card and never a list.
 *
 * `weekday` is passed in already formatted. This module must not read a clock:
 * a copy function that calls `new Date()` cannot be photographed twice with the
 * same bytes, and the fixture routes are required to be deterministic.
 */
export function resumeCardCopy(
  heard: number,
  confirmed: number,
  cursor: number,
  weekday: string,
): ResumeCardCopy {
  return {
    eyebrow: 'Unfinished walkthrough',
    title: `${heard} piece${heard === 1 ? '' : 's'} heard, ${confirmed} confirmed`,
    body: `Recorded ${weekday}. Nothing you said has gone anywhere — the rest of the list is still waiting.`,
    // A count, never a bar. The cursor is the same figure `positionLabel`
    // prints at the top of every procession card.
    action: `Carry on from ${cursor} of ${heard}`,
    // Named for what it does, not for what it destroys — the confirm sheet on
    // the other side is where "and nothing is deleted" is stated, because that
    // is where it becomes a decision.
    secondary: 'Start again instead',
  };
}

export const RESUME_HEADLINE = 'Pick up where you left off.';

// ---------------------------------------------------------------------------
// T-04 · the substitution sheet
// ---------------------------------------------------------------------------

/** "a fourth top" → "fourth top", so a sentence can put its own article on. */
function unarticled(phrase: string): string {
  return phrase.replace(/^an?\s+/i, '');
}

/** The label on one option row — "A fourth top", "Keep the slot open". */
export function redirectOptionLabel(slots: readonly TenSlot[], option: RedirectOption): string {
  return option.kind === 'open' ? 'Keep the slot open' : cap(redirectLabel(slots, option.to));
}

/** The right-hand cell of an option row. Always `countOutfits`, never a table. */
export function outfitsCell(total: number): string {
  return `${total} outfit${total === 1 ? '' : 's'}`;
}

/**
 * The sentence that has to be on the sheet rather than in a footnote.
 *
 * The recommended redirect is an editorial judgment (see `REDIRECT_TARGETS` in
 * `ten-slots.ts`), and it is routinely NOT the biggest number on the sheet. A
 * recommendation that shows the smaller figure without saying why reads as
 * either a mistake or a trick, so whenever another option out-counts the
 * recommended one this names it in the open.
 *
 * Only redirects are compared. Keeping the slot open removes a garment from the
 * plan, so it can never out-count a redirect — and "the keeping the slot open
 * out-counts…" is not a sentence.
 */
export function recommendationNote(
  slots: readonly TenSlot[],
  options: readonly RedirectOption[],
): string | null {
  const recommended = options.find((o) => o.kind === 'redirect' && o.recommended);
  if (!recommended || recommended.kind !== 'redirect') return null;
  const bigger = options
    .filter((o): o is Extract<RedirectOption, { kind: 'redirect' }> => o.kind === 'redirect')
    .filter((o) => o.to !== recommended.to && o.total > recommended.total)
    .sort((a, b) => b.total - a.total)[0];
  if (!bigger) return null;

  const rec = redirectLabel(slots, recommended.to);
  const other = redirectLabel(slots, bigger.to);
  return (
    `The ${unarticled(other)} out-counts the ${unarticled(rec)}. ` +
    `The recommendation stays as it is because Cinch builds better outfits from ${rec}, ` +
    'not because it scores higher.'
  );
}

/** The sheet's one filled action — it names the option it will spend. */
export function redirectCtaLabel(slots: readonly TenSlot[], option: RedirectOption): string {
  return option.kind === 'open'
    ? 'Keep the slot open'
    : `Use this slot for ${redirectLabel(slots, option.to)}`;
}

/**
 * The sheet's way out — "Keep the dress slot".
 *
 * Deliberately not the same sentence as "Keep the slot open": one cancels the
 * decline and leaves the position asking for a dress, the other spends the
 * position on nothing. Two different outcomes never share a label.
 */
export function keepSlotLabel(kind: TenSlotKind): string {
  return `Keep the ${SLOT_LABEL[kind].toLowerCase()} slot`;
}

// ---------------------------------------------------------------------------
// T-05 · the camera is switched off
// ---------------------------------------------------------------------------

/**
 * A denied permission is a fork, not a wall.
 *
 * The loudest action is the one that needs no permission at all — the library
 * picker runs out of process, which is why `app.config.ts` suppresses
 * `NSPhotoLibraryUsageDescription`. Settings comes second because it leaves the
 * app, and the voice door is third because it is a different flow entirely.
 */
export const CAMERA_DENIED = {
  headline: 'The camera is switched off for Cinch.',
  body: 'You can turn it back on in Settings, or fill the ten from photographs you already have. Your camera roll needs no permission — the picker runs outside the app.',
  library: 'Choose from your camera roll',
  settings: 'Open Settings',
  voice: 'Describe them out loud instead',
} as const;

/**
 * The closing sentence that names what is kept. Omitted entirely at zero —
 * zero is quiet, and "the no pieces you have photographed are safe" is the kind
 * of sentence a template writes and a person never would.
 */
export function cameraDeniedKeepLine(filled: number): string | null {
  if (filled <= 0) return null;
  if (filled === 1) return 'The piece you have already photographed is safe in your closet.';
  return `The ${numberWord(filled)} pieces you have already photographed are safe in your closet.`;
}

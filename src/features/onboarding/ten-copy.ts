/**
 * The Ten's copy.
 *
 * Text lives here rather than inside the components, for the reason every copy
 * module in this folder exists: `scripts/run-tests.mjs` bundles with esbuild,
 * which cannot parse React Native's Flow source, so a sentence a test has to
 * check must be reachable without importing a component.
 *
 * WHAT CHANGED. This file used to hold one line of reasoning per NAMED slot —
 * "a third top", "the dress", "the bag you carry most days" — plus the whole
 * substitution vocabulary that let a reader decline a slot and spend it
 * elsewhere. The grid no longer names its positions (see `ten-slots.ts`), so
 * none of that copy has a referent: there is no dress slot to decline, and no
 * fourth top to spend it on. What replaces it is ONE adaptive card, written
 * from `starter-readiness.ts` against the garments the classifier actually
 * returned.
 *
 * Every number in every sentence below is passed in from `countOutfits`.
 * Nothing here types a figure into prose (positioning-contract.md §7).
 */

import type { CountedKind } from '@/features/closet/outfit-count';
import { numberWord, ordinalWord, articleFor } from '@/features/onboarding/reveal-copy';
import type { StarterReadiness, StarterSuggestion } from '@/features/onboarding/starter-readiness';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The one title the whole hallway's ten-piece surface carries — TR-05, TR-06,
 * T-01 and T-02 all print it, so it is written once.
 *
 * THE NUMERAL IS DELIBERATE, and it is the one place in the product where the
 * free ten is not spelled out. CX-01/CX-02 write the eyebrow as "Your first
 * 10", and an eyebrow is a label rather than prose — the same register as the
 * "0 of 10 pieces" count, not the same as "ten pieces is enough to begin".
 * House style spells numbers in sentences; this is not a sentence.
 */
export const TEN_TITLE = 'First 10';

/**
 * The one supporting line beneath that title (LP-06's accepted copy table).
 *
 * WHAT IT REPLACED, and why the replacement is not a loss. The line here used
 * to be `tenProgressLine`, which recomputed a sentence per state — "Add ten
 * pieces from your closet…", then "9 to go…", then "That's all ten…". The
 * eyebrow directly above it already prints `3 of 10`, so the progress half of
 * that sentence was the count said twice, and the accepted atlas allows one
 * headline and at most one supporting line before an action. This is that line.
 *
 * NOTHING DRAWS IT ANY MORE. The masthead's own count is the progress and the
 * adaptive SlotCard under the grid is the instruction — this said neither, in
 * the same words on all ten states, above the clothes. The constant stays
 * because it is the accepted copy for the line if a surface ever needs one.
 */
export const TEN_SUPPORT = 'Build the ten pieces you reach for most.';

/**
 * The camera's own title. Generic, like the tile it was opened from.
 *
 * It used to read "Slot 3 · a third top", which was the template telling
 * somebody what to point the camera at before it had seen anything. The
 * position is still named because the reader tapped a specific cell and should
 * be able to see which one they are filling.
 */
export function cameraSlotTitle(slotId: number): string {
  return `Slot ${slotId} · add a piece`;
}

/**
 * What VoiceOver says on a FILLED tile.
 *
 * THE NAME COMES BACK, AND THE POSITION STAYS. The tile spoke the garment's
 * name alone once, which read as a caption on a picture and left the sheet
 * behind it undiscoverable; then it spoke the position alone, which made all
 * ten photographs interchangeable to anyone who could not see them. Neither is
 * the whole label. The accepted correction is both, in this order: the piece
 * first, because that is what the reader is looking for, then `piece N of 10`
 * so they know where in the grid they are, then what the tile is FOR.
 *
 * THE FALLBACK IS THE POSITION ALONE — not "Untitled", not "this piece", and
 * never a guess. A tile is nameless for a real and ordinary reason: the
 * classifier has not finished reading the photograph yet. `Piece 3 of 10` is
 * true from the first frame, and it is the same sentence with its first clause
 * missing rather than a different one.
 *
 * Ten is never typed. `total` is the grid's own length, passed down from the
 * slot list, so a grid of a different size cannot make this sentence lie.
 */
export function filledTileLabel(slotId: number, total: number, name: string | null): string {
  const position = `piece ${slotId} of ${total}`;
  const named = name?.trim();
  return named
    ? `${named}, ${position}, double-tap for actions.`
    : `${cap(position)}, double-tap for actions.`;
}

// ---------------------------------------------------------------------------
// The adaptive card
// ---------------------------------------------------------------------------

/** What one more of a counted kind is CALLED in a sentence. */
const KIND_NOUN: Record<CountedKind, string> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'dress',
  shoes: 'pair of shoes',
};

/** "a top, a bottom and a pair of shoes" — an Oxford-free list of articles. */
function nounList(kinds: readonly CountedKind[]): string {
  const parts = kinds.map((k) => `${articleFor(KIND_NOUN[k])} ${KIND_NOUN[k]}`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export type StarterCardCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

/**
 * The single card beneath the grid — one concise next-best suggestion, chosen
 * from the classified mix rather than from a position in a template.
 *
 * WHY EVERY BRANCH QUOTES A COMPUTED FIGURE. The old card argued for a slot by
 * describing what that kind of garment does in general ("a third bottom
 * multiplies every top you own"). It was true and it was unfalsifiable, which
 * is what made it safe to write in advance. This card makes a claim about THIS
 * closet, so every claim is arithmetic: `outfits` and `projected` both come
 * from `countOutfits`, and the branches that cannot honestly quote a number —
 * the ones where the closet still makes nothing — quote none.
 */
export function starterCardCopy(
  r: StarterReadiness,
  s: StarterSuggestion | null,
): StarterCardCopy {
  if (!s) {
    return {
      eyebrow: 'Ready',
      title: `Your ${plural(r.pieces, 'piece')} make ${plural(r.outfits, 'outfit')}.`,
      body: 'That is enough for Cinch to dress you properly. Nothing here is final — you can swap any piece later.',
    };
  }

  const eyebrow = 'Next';
  const noun = s.kind ? KIND_NOUN[s.kind] : 'piece';

  /**
   * An empty closet gets an invitation, not an instruction.
   *
   * "Add a pair of shoes" was what the gap order produced at zero pieces, and
   * the simulator caught what it printed underneath: "One pair takes this
   * closet to 0 outfits." Shoes alone make nothing, so the direction was
   * arbitrary AND the figure was a promise of no gain — on the very first
   * screen of the app, directly under a masthead that had just said any order
   * is fine.
   */
  if (s.gap === 'start') {
    return {
      eyebrow: 'Start',
      title: 'Start with whatever’s nearest.',
      body:
        'Cinch reads each photograph, names the piece and files it. ' +
        `It builds outfits once ${nounList(['tops', 'bottoms', 'shoes'])} are in — ` +
        'and it will say so as you go. Order is yours.',
    };
  }

  /**
   * NEVER QUOTE A PROJECTION THAT HAS NOT MOVED.
   *
   * One piece can only lift a closet off nought if it is the LAST missing
   * half. When it is not, the gain is genuinely zero and the honest sentence
   * names everything still absent instead of printing a figure that has not
   * changed. `alsoNeeds` is `missingForFirstOutfit`, so this branch cannot
   * disagree with the arithmetic.
   */
  const gains = s.projected > r.outfits;

  if (s.gap === 'footwear') {
    return {
      eyebrow,
      title: 'Add a pair of shoes.',
      body: gains
        ? 'Every outfit Cinch builds finishes on a pair, so nothing you have filed makes one yet. ' +
          `One pair takes this closet to ${plural(s.projected, 'outfit')}.`
        : 'Every outfit Cinch builds finishes on a pair. ' +
          `This closet still needs ${nounList(s.alsoNeeds)} before there is an outfit in it.`,
    };
  }

  if (s.gap === 'core') {
    return {
      eyebrow,
      title: `Add ${articleFor(noun)} ${noun}.`,
      body: gains
        ? 'An outfit is a top with a bottom, or a dress — this closet has one half of that and not the other. ' +
          `${cap(articleFor(noun))} ${noun} takes it to ${plural(s.projected, 'outfit')}.`
        : 'An outfit is a top with a bottom, or a dress. ' +
          `This closet still needs ${nounList(s.alsoNeeds)} before there is an outfit in it.`,
    };
  }

  if (s.gap === 'outfits') {
    return {
      eyebrow,
      title: `Add ${articleFor(noun)} ${noun}.`,
      body:
        `Your ${plural(r.pieces, 'piece')} make ${plural(r.outfits, 'outfit')} so far. ` +
        `${cap(articleFor(noun))} ${noun} takes that to ${plural(s.projected, 'outfit')} — ` +
        'more than any other single piece would.',
    };
  }

  // Shape and arithmetic are both there; only the count is short. No kind is
  // named because none is needed — this is the one moment where a coat, a bag
  // or a watch is genuinely as good as anything else, and pretending otherwise
  // would be the template talking again.
  return {
    eyebrow,
    title: `${cap(numberWord(r.piecesRemaining))} more to go.`,
    body:
      `Your ${plural(r.pieces, 'piece')} already make ${plural(r.outfits, 'outfit')}. ` +
      'Anything counts from here — a coat, a bag, a watch. Cinch files what it sees.',
  };
}

// ---------------------------------------------------------------------------
// Ten filled, and still not enough
// ---------------------------------------------------------------------------

/**
 * The grid is full and the closet still cannot be styled.
 *
 * This state did not exist under the template, because the template GUARANTEED
 * its own success: ten named positions filled in order always produced a top,
 * a bottom and a pair of shoes. Generic positions carry no such guarantee —
 * ten watches is ten pieces — so the flow needs somewhere honest to stand that
 * is neither a reveal it has not earned nor a dead end.
 *
 * It names exactly what is absent and sends the reader to the pieces
 * themselves, where a mis-read garment can be re-read or replaced. It never
 * says "you did this wrong": the most likely cause by far is the classifier
 * reading a hoodie as something else, and that is Cinch's mistake.
 */
export function repairCopy(r: StarterReadiness): { title: string; body: string; action: string } {
  const wants: string[] = [];
  if (!r.hasFootwear) wants.push('a pair of shoes');
  if (!r.hasCore) wants.push(r.tally.tops === 0 ? 'a top' : 'a bottom');

  const named =
    wants.length > 0
      ? `Cinch can’t find ${wants.join(' or ')} in what you’ve filed.`
      : `These ${plural(r.pieces, 'piece')} make ${plural(r.outfits, 'outfit')} — not enough to dress a week from.`;

  return {
    title: 'That’s ten pieces — but not a week of outfits yet.',
    body:
      `${named} ` +
      'If something was read wrong, open the piece and have Cinch read it again, or swap it for another. ' +
      'Nothing you’ve photographed goes anywhere.',
    action: 'Check a piece',
  };
}

// ---------------------------------------------------------------------------
// T-06 · the stop sheet
// ---------------------------------------------------------------------------

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
// LP-02 · replacing the photograph in a filled position
// ---------------------------------------------------------------------------

export type ReplaceSheetCopy = {
  eyebrow: string;
  title: string;
  body: string;
  retake: string;
  library: string;
  edit: string;
  cancel: string;
  /** Spoken when the sheet opens — the slot and the piece, in that order. */
  announcement: string;
};

/**
 * The four-action sheet over a filled tile.
 *
 * FOUR ACTIONS, AND THE THIRD IS THE ONE THAT WAS ALREADY THERE. Tapping a
 * filled tile used to push straight to `/item/{id}`, which is a real and much
 * used path — reading what Cinch decided a piece was, and correcting it. The
 * sheet must not cost anyone that, so `Edit details` is the same push, sitting
 * third: after the two photographic answers, because the reason somebody taps
 * their own photograph is far more often that the photograph is wrong than
 * that the tags are.
 *
 * `name` is the classifier's word for the piece — "Knit", "Coat" — or null
 * while it is still being read. The title falls back to the position, which is
 * the one thing that is true from the first frame.
 */
export function replaceSheetCopy(slotId: number, name: string | null): ReplaceSheetCopy {
  const piece = name ?? 'this piece';
  return {
    eyebrow: `Slot ${slotId}`,
    title: name ?? 'This piece',
    // One sentence, and it is the reassurance rather than an explanation of
    // the buttons underneath — the buttons say what they do.
    body: 'A new photograph goes in this position. Nothing else in the ten moves.',
    retake: 'Retake photo',
    library: 'Choose from library',
    edit: 'Edit details',
    cancel: 'Cancel',
    announcement: `Slot ${slotId}, ${piece}. Replace this photograph.`,
  };
}

/**
 * What to say when a replacement stops short, keyed by the machine's own
 * failure vocabulary (`ten-replace.ts`).
 *
 * Every line states the same fact first — the photograph in the slot did not
 * change — because that is the only thing the reader needs and the only thing
 * they might reasonably fear. `no-room` is the one exception worth a second
 * clause: the piece is still in the closet, and the remedy is not obvious.
 *
 * `no-room` HAS TWO CAUSES AND THEY DO NOT SHARE A REMEDY, which is why this
 * function takes a third argument.
 *
 * Making room for a replacement means archiving the outgoing piece. That write
 * can simply fail — a dropped connection, a server that was busy — and trying
 * again in a moment is exactly the right advice.
 *
 * It can also be pointless. `item_total_limit_for_plan` (migration
 * 20260808190100) counts EVERY row an account holds, stored pieces included, so
 * once the free tier's total is reached, archiving succeeds and the incoming
 * photograph is refused anyway. There is no moment to try again in: the account
 * is full until something is deleted or the plan grows. Telling that reader to
 * wait is the dead end that migration's own comment set out to remove — "telling
 * someone to make room when making room will not help".
 *
 * `storageFull` is `useCapacity().storageFull`, which the screen already holds.
 * No new query, no new column, and nothing is deleted to find out.
 */
export function replaceFailureLine(
  failure: 'cancelled' | 'camera-denied' | 'library-denied' | 'no-room' | 'processing-failed' | 'restore-failed',
  slotId: number,
  /** The account is at its TOTAL ceiling — stored pieces counted. */
  storageFull = false,
): string | null {
  switch (failure) {
    // A cancel is not news. The reader chose it and the grid in front of them
    // already shows the answer.
    case 'cancelled':
      return null;
    case 'camera-denied':
      return `Slot ${slotId} is unchanged. The camera is switched off for Cinch — turn it on in Settings, or choose a photograph from your library instead.`;
    case 'library-denied':
      return `Slot ${slotId} is unchanged. Cinch couldn’t open your photo library.`;
    case 'no-room':
      // The full-account branch is now a PLATE, not a line: `noRoomCopy` below
      // carries the cause and both remedies in Cinch's own type, so all this
      // has to say is the fact every failure line says. The 44-word paragraph
      // it used to be survives verbatim as that plate's announcement, which is
      // what a VoiceOver reader hears in place of the drawn one.
      return storageFull
        ? noRoomCopy(slotId).note
        : `Slot ${slotId} is unchanged. Cinch couldn’t make room for the new photograph — try again in a moment.`;
    case 'processing-failed':
      return `Slot ${slotId} is unchanged. That photograph didn’t make it through — the one you had is still there.`;
    case 'restore-failed':
      return `Slot ${slotId} didn’t change, and the piece that was in it is in Storage rather than your closet. Nothing has been deleted — you can bring it back from Storage.`;
  }
}

export type NoRoomCopy = {
  eyebrow: string;
  headline: string;
  note: string;
  storage: string;
  plans: string;
  /** The whole refusal, in one sentence, for a reader who cannot see the plate. */
  announcement: string;
};

/**
 * The total ceiling, given a door.
 *
 * This used to be `Alert.alert('Nothing changed', …)` carrying a 44-word
 * paragraph — the app's least designed surface, no serif, no tokens, no plate —
 * and it NAMED AN UPGRADE WITH NO WAY TO REACH ONE. It is squarely reachable
 * from onboarding: M-07's ceiling path parks pieces in Storage up to
 * `PLANS.free.storedItems`, which is exactly the total this refusal fires on.
 *
 * NO PRICE AND NO NUMBER. 'See plans' opens `AddGarmentOverLimit`, the
 * placement whose entire contract is a closet the server has already refused,
 * so every figure stays in `plans.ts` and on the paywall that quotes it.
 *
 * The announcement is the old paragraph unchanged. A drawn plate says
 * eyebrow → headline → note → two doors; a spoken one has to say it in prose,
 * and this is the prose it was already saying.
 */
export function noRoomCopy(slotId: number): NoRoomCopy {
  return {
    eyebrow: 'No room',
    headline: 'Your closet and your Storage are both full.',
    note: `Slot ${slotId} is unchanged — nothing has been removed.`,
    storage: 'Open Storage',
    plans: 'See plans',
    announcement:
      `Slot ${slotId} is unchanged. Your closet and your Storage are both full on this plan, ` +
      'so there is nowhere for another photograph to go — delete a piece from Storage, or ' +
      'upgrade for a larger closet. Nothing you’ve photographed has been removed.',
  };
}

/** Spoken after a successful swap. Names the position and what landed in it. */
export function replacedAnnouncement(slotId: number): string {
  return `Slot ${slotId} replaced. Your count hasn’t changed.`;
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
 * slower.
 */
export const FIRST_TEN_DOORS = {
  // CX-01. "How would you rather do this?" asked a preference of somebody who
  // has not done it once. The correction asks the practical question instead,
  // and the recommendation on the catalogue plate answers it for anyone who
  // has no preference yet.
  headline: 'How do you want to add them?',
  /**
   * One line, and it is the only reassurance the frame needs.
   */
  body: 'Any route lands in the same closet.',
  photograph: {
    name: 'Photograph them',
    // "Ten named slots" was the template describing itself, and it was the
    // sentence that set the expectation the grid then failed to meet. Ten
    // pieces, any pieces — which is what the grid now actually does.
    line: 'Ten pieces, one picture each. Cinch cuts each piece out, reads it and files it. You can pick from your camera roll instead.',
    /** TR-06 draws the same door with the line cut to its first clause. */
    shortLine: 'Ten pieces, one picture each.',
  },
  voice: {
    name: 'Describe them out loud',
    line: 'Walk your wardrobe and say what is in it. Cinch writes the list, you confirm it card by card, and photographs can come later.',
  },
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
// T-05 · the camera is switched off
// ---------------------------------------------------------------------------

/**
 * A denied permission is a fork, not a wall.
 *
 * The loudest action still works after camera denial — the system library
 * picker runs out of process and shares only the photos selected. Settings
 * comes second because it leaves the app, and the voice door is third because
 * it is a different flow entirely.
 */
export const CAMERA_DENIED = {
  headline: 'The camera is switched off for Cinch.',
  body: 'You can turn it back on in Settings, or fill the ten from photographs you already have. Choosing from your library needs no permission prompt — the system picker shares only the pictures you choose.',
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

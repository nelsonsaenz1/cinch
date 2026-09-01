import { countOutfits, type Tally } from '@/features/closet/outfit-count';

import { numberWord } from './reveal-copy';

/**
 * The Reveal — what the sequence decides before it draws anything. Redesign 12.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it.
 *
 * ── THE ONE PROMISE ─────────────────────────────────────────────────────────
 *
 * The number is `countOutfits(tallyOf(items))` and nothing else. Not an
 * estimate, not a rounding, not a typed constant, and — the part that is easy
 * to get wrong — not a DIGIT-SHAPED PLACEHOLDER before it resolves. A skeleton
 * of a number is itself a claim: it says "a number is coming and it is about
 * this wide", and on a closet that turns out to make none, that claim was
 * false the whole time it was on screen. So `computing` draws words.
 */

// ---------------------------------------------------------------------------
// The phase machine
// ---------------------------------------------------------------------------

/**
 * Seven phases, in the order the accepted frames run them.
 *
 * `zero` is a TERMINAL phase rather than a variant of `settled`, because the
 * two screens share no composition: one is a number with plates under it and
 * the other is a refusal with two repair doors. Branching inside `settled`
 * would have made a zero the same screen as a twenty-seven with the number
 * changed, which is what the atlas explicitly refuses.
 */
export type RevealPhase =
  | 'arriving'
  | 'computing'
  | 'counting'
  | 'settled'
  | 'plating'
  | 'cascade'
  | 'complete'
  | 'zero';

/** Phases in which a digit may legally be on screen. */
export const DIGIT_PHASES: readonly RevealPhase[] = [
  'counting',
  'settled',
  'plating',
  'cascade',
  'complete',
];

/**
 * Whether this phase is allowed to draw a number.
 *
 * The test that matters is the NEGATIVE one: `arriving` and `computing` must
 * both answer false, so nothing digit-shaped — not the count, not a dash, not
 * a shimmering block the width of two figures — can reach the screen before
 * the arithmetic has resolved.
 */
export function mayDrawDigit(phase: RevealPhase): boolean {
  return (DIGIT_PHASES as readonly string[]).includes(phase);
}

/**
 * The floor under the arrival beat, in milliseconds.
 *
 * It is a FLOOR and not a delay: the wardrobe refetch runs underneath it and
 * usually finishes first. Without it a fast closet flashes the last piece for
 * two frames and the beat reads as a glitch; with it the beat is a beat. The
 * ceiling is the same number — whatever has been tagged by then is the honest
 * count, so a slow tagging pass can never hold the screen hostage.
 */
export const ARRIVAL_FLOOR_MS = 1200;

/** How long the count-up runs, and the gap between cascading plates. */
export const COUNT_UP_MS = 900;
export const CASCADE_STEP_MS = 260;

/** The most plates the cascade ever draws. */
export const MAX_PLATES = 3;

/**
 * The count-up's value at a point in the animation.
 *
 * Every frame is REAL: it is an interpolation toward a resolved number, so the
 * digit on screen at 40% is 40% of a value that already exists, not a guess at
 * one that does not. That is the whole difference between this and a slot
 * machine, and it is why `counting` cannot start until the tally has resolved.
 *
 * Eased so the last few numbers land slowly — a linear ramp reaches the answer
 * and stops dead, which reads as the animation being cut off rather than as
 * arriving.
 */
export function countUpValue(target: number, progress: number): number {
  // NaN is the only non-finite input that means "no idea": it lands on nothing,
  // which is the safe direction. An infinite progress is simply past the end
  // and lands on the answer, because clamping it to zero would make a runaway
  // clock render a count-up that had already finished as though it had not
  // started.
  if (Number.isNaN(progress) || progress <= 0) return 0;
  if (progress >= 1) return target;
  const eased = 1 - Math.pow(1 - progress, 3);
  return Math.round(target * eased);
}

// ---------------------------------------------------------------------------
// The display number's size
// ---------------------------------------------------------------------------

/**
 * The accepted measures: 150pt for one or two digits, 112pt for three, 82pt
 * once plates are on screen, 76pt at an accessibility size.
 */
export const DISPLAY_SIZE = { one: 150, three: 112, withPlates: 82, ax: 76 } as const;

/**
 * How large the number is drawn.
 *
 * A three-digit count STEPS DOWN one notch rather than shrinking to fit or
 * wrapping. Shrink-to-fit makes "184" and "27" different optical sizes on two
 * closets that are equally proud of themselves; wrapping makes a number into
 * two lines, which stops being a number.
 *
 * The AX size wins over everything, because at AX-XXXL the derivation is the
 * hero and the figure is a mark beside it — a 150pt numeral next to 21pt body
 * copy is not a hierarchy, it is a collision.
 */
export function displayFontSize(count: number, hasPlates: boolean, ax: boolean): number {
  if (ax) return DISPLAY_SIZE.ax;
  if (hasPlates) return DISPLAY_SIZE.withPlates;
  return String(Math.max(0, Math.trunc(count))).length >= 3
    ? DISPLAY_SIZE.three
    : DISPLAY_SIZE.one;
}

// ---------------------------------------------------------------------------
// The sentence that derives the number
// ---------------------------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Whether this sentence is spoken in words or set in figures.
 *
 * `numberWord` stops at ninety-nine, and its ceiling is argued rather than
 * arbitrary: past a hundred the words get longer than the figure and stop
 * being readable at a glance. The accepted frame for a large closet spells it
 * anyway — "A hundred and eighty-four outfits from thirty-one pieces" — and
 * that is the one place this build departs from the artifact.
 *
 * THE DEPARTURE, AND WHY. Spelling past ninety-nine would overturn a decision
 * this repo already made and wrote down. Printing "184 outfits from thirty-one
 * pieces" would be worse than either option, because mixing the two registers
 * inside one sentence is precisely what `numberWord`'s own docblock calls out.
 * So a sentence that needs a figure ANYWHERE uses figures THROUGHOUT: "184
 * outfits from 31 pieces." One register per sentence, and the ceiling keeps
 * meaning what it says.
 */
export function usesFigures(...counts: number[]): boolean {
  return counts.some((n) => n > 99);
}

/** A count in whichever register this sentence has settled on. */
function figure(n: number, figures: boolean): string {
  return figures ? String(n) : numberWord(n);
}

/**
 * "four tops, three bottoms, one dress and two pairs of shoes" — the closet
 * said out loud.
 *
 * Shoes are the irregular one and are handled rather than special-cased away:
 * a tally of two means TWO PAIRS, and "two shoes" would be a different and
 * slightly alarming claim. Kinds the closet does not have are absent rather
 * than printed as a zero, which is the same refusal the composition chips make.
 */
export function compositionPhrase(tally: Tally, figures = false): string {
  const parts: string[] = [];
  if (tally.tops) parts.push(`${figure(tally.tops, figures)} top${tally.tops === 1 ? '' : 's'}`);
  if (tally.bottoms)
    parts.push(`${figure(tally.bottoms, figures)} bottom${tally.bottoms === 1 ? '' : 's'}`);
  if (tally.dresses)
    parts.push(`${figure(tally.dresses, figures)} dress${tally.dresses === 1 ? '' : 'es'}`);
  if (tally.shoes)
    parts.push(`${figure(tally.shoes, figures)} pair${tally.shoes === 1 ? '' : 's'} of shoes`);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The full derivation — the number, where it came from, and what it was made
 * of, as ONE sentence.
 *
 * One sentence rather than three, because the count and its reason have to be
 * a single announcement for VoiceOver and a single thought for everybody else.
 * "A number with no derivation is indistinguishable from a slogan" is the
 * atlas's line; a derivation two paragraphs below the number it derives is a
 * footnote, which is the same thing again.
 */
export function derivationLine(pieceCount: number, tally: Tally): string {
  const outfits = countOutfits(tally);
  const figures = usesFigures(outfits, pieceCount);
  const head = `${cap(figure(outfits, figures))} outfit${outfits === 1 ? '' : 's'} from ${figure(pieceCount, figures)} piece${pieceCount === 1 ? '' : 's'}`;
  const composition = compositionPhrase(tally, figures);
  return composition ? `${head} — ${composition}.` : `${head}.`;
}

/**
 * The short form, for once the plates are on screen.
 *
 * The composition clause retires when there is something better to look at.
 * It did its work at the settled beat — it is what made the number evidence
 * rather than an assertion — and leaving it under three outfits would be the
 * page still arguing after it has already been believed.
 */
export function derivationShort(pieceCount: number, tally: Tally): string {
  const outfits = countOutfits(tally);
  const figures = usesFigures(outfits, pieceCount);
  return `${cap(figure(outfits, figures))} outfit${outfits === 1 ? '' : 's'} from ${figure(pieceCount, figures)} piece${pieceCount === 1 ? '' : 's'}.`;
}

/**
 * The derivation for a closet still finishing its tagging.
 *
 * Untagged pieces CANNOT enter the tally — `useWardrobe` does not return them
 * — so the honest thing is to say so rather than to quietly count a smaller
 * closet as the whole one. A reader who photographed ten and is shown a number
 * derived from seven deserves the sentence that explains the gap, and the gap
 * closes on its own within seconds.
 */
export function partialDerivation(readCount: number, untagged: number, tally: Tally): string {
  const outfits = countOutfits(tally);
  const figures = usesFigures(outfits, readCount, untagged);
  const head = `${cap(figure(outfits, figures))} outfit${outfits === 1 ? '' : 's'} from the ${figure(readCount, figures)} piece${readCount === 1 ? '' : 's'} Cinch could read.`;
  const tail = `${cap(figure(untagged, figures))} ${untagged === 1 ? 'is' : 'are'} still waiting on a tag.`;
  return `${head} ${tail}`;
}

/** The untagged chip — a real count of pieces this screen deliberately did not use. */
export function untaggedChip(untagged: number): string | null {
  return untagged > 0 ? `${untagged} untagged` : null;
}

/**
 * The offline mark.
 *
 * Offline changes NOTHING about the arithmetic — the tally, the count and the
 * outfits are all computed on this phone from the wardrobe already on it — so
 * the mark says exactly that and nothing about degraded results. What it does
 * change is that the vendor placement is skipped, because a paywall that
 * cannot reach its own campaign is a spinner.
 */
export const OFFLINE_MARK = 'You’re offline. This was worked out on your phone.';

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const REVEAL_COPY = {
  /** Beat one — the last piece has landed and the count is not known yet. */
  arrivalTitle: 'That’s ten',
  arrivalBody: 'Every one of them photographed by you.',

  /** Beat two — words, because a digit here would be a claim. */
  computingTitle: 'Working out what these make.',
  computingBody: 'Cinch is pairing your pieces on this phone. Nothing leaves it.',

  /** The exit. */
  openToday: 'Open Today',

  /** The zero, which is a result and not an error. */
  zeroTitle: 'Not an outfit yet.',
  zeroRepair: 'Photograph them instead',
  zeroOpenToday: 'Open Today anyway',

  /**
   * The unread zero — pieces exist but have not been read, so the arithmetic
   * had nothing to count YET. A different fact from the honest zero above:
   * that closet cannot make an outfit, this one merely has not been looked at,
   * and telling its owner to photograph again — the thing they just did — is
   * the misdiagnosis this state exists to avoid.
   */
  zeroUnreadTitle: 'Not read yet.',
  /** Tagging is running — the fix is a fresh look, not another photograph. */
  zeroUnreadCheck: 'Check again',
  /** Tagging has never been allowed to run — the fix is the consent door. */
  zeroUnreadConsent: 'Turn on AI tagging',

  /** Cinch-owned context above the vendor sheet. Never a price, never a term. */
  memberContextTrialing: 'The trial has everything open; membership keeps it that way.',
  memberContextFree: 'Everything you just saw stays yours on the free tier.',
} as const;

/**
 * The arrival title, derived rather than typed.
 *
 * "That's ten" is the accepted line and ten is the free tier's own number, so
 * the sentence is built from the count in hand — a closet of nine that somehow
 * reached this screen says "That's nine" rather than a sentence that is wrong
 * about the reader's own morning.
 */
export function arrivalTitle(pieceCount: number): string {
  return `That’s ${numberWord(pieceCount)}`;
}

export function arrivalBody(pieceCount: number): string {
  return `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? '' : 's'} ${pieceCount === 1 ? 'is' : 'are'} in your closet.`;
}

/**
 * The zero body — what this closet actually is, and what would change it.
 *
 * "Ten tops make ten tops" is the accepted line and it is doing real work: it
 * names the SHAPE of the failure rather than its size. A reader told only
 * "no outfits" learns nothing; a reader told that ten of one thing is still one
 * thing knows immediately what to photograph next.
 */
export function zeroBodyLine(pieceCount: number, tally: Tally, missing: number): string {
  const dominant = dominantKind(tally);
  const shape = dominant
    ? `${cap(numberWord(tally[dominant]))} ${dominant} make ${numberWord(tally[dominant])} ${dominant}.`
    : `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? '' : 's'} cannot pair with ${pieceCount === 1 ? 'itself' : 'each other'}.`;
  return `${shape} ${cap(numberWord(missing))} more piece${missing === 1 ? '' : 's'} and this page fills up.`;
}

/**
 * The unread zero's body. Two sentences, chosen by the one fact that decides
 * what happens next: whether the tagger is allowed to run at all.
 *
 * With consent, the state is transient and the sentence says so. Without it,
 * the sentence names the actual blocker — the pieces are photographed and
 * cannot be read — because a reader shown "still being read" while nothing is
 * reading them would be being lied to by omission.
 */
export function unreadBodyLine(pending: number, consented: boolean): string {
  const n = cap(numberWord(pending));
  const p = pending === 1 ? 'piece' : 'pieces';
  const is = pending === 1 ? 'is' : 'are';
  return consented
    ? `${n} ${p} ${is} still being read. The count settles the moment they finish.`
    : `${n} ${p} ${is} photographed but unread — Cinch can’t pair what it hasn’t been allowed to look at.`;
}

/** Whichever kind this closet has most of — the one the sentence is about. */
function dominantKind(tally: Tally): 'tops' | 'bottoms' | 'dresses' | 'shoes' | null {
  const entries = (['tops', 'bottoms', 'dresses', 'shoes'] as const)
    .map((k) => [k, tally[k]] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return entries.length === 1 ? entries[0]![0] : null;
}

// ---------------------------------------------------------------------------
// The zero's rows
// ---------------------------------------------------------------------------

/**
 * What is missing, named as things a person could photograph.
 *
 * The rows used to be a TABLE — "Tops · 10", "Bottoms · 0 — needed" — and the
 * accepted frames replace it with phrases: "A pair of trousers or a skirt",
 * "A second pair of shoes". The phrases are better for the reason the whole
 * zero screen exists: a reader here has just been told the arithmetic came back
 * nothing, and a table asks them to do the arithmetic again to work out what
 * to do. A phrase is already the instruction.
 *
 * Shoes left this list on 2026-09-01, with the arithmetic: an outfit stands
 * without them now, so the only reachable zero is a closet with no dress and
 * a missing half of the separates pair — and those two halves are the only
 * honest rows.
 */
export function missingPhrases(tally: Tally): string[] {
  if (countOutfits(tally) > 0) return [];
  const out: string[] = [];
  if (tally.tops === 0) out.push('A top');
  if (tally.bottoms === 0) out.push('A pair of trousers or a skirt');
  return out;
}

/**
 * How many pieces would turn this closet into at least one outfit.
 *
 * Derived from the phrases rather than typed, so the sentence "Two more pieces
 * and this page fills up" cannot promise a number the rows below it do not
 * list.
 */
export function piecesToFirstOutfit(tally: Tally): number {
  return missingPhrases(tally).length;
}

/**
 * The one line the membership moment is allowed to say about the count.
 *
 * "Twenty-seven outfits" and nothing more. Not a price, not a term, not a
 * comparison, not what membership adds — all of that belongs to campaign
 * 254200, and a second sentence here would be Cinch quoting a product it does
 * not own.
 *
 * It restates the count because the count is the reason this moment exists:
 * somebody has just been told, in a number computed from their own closet,
 * what they own. Saying it once more is the context. Saying anything else is a
 * sales pitch drawn by the wrong party.
 */
export function membershipCountLine(count: number): string {
  const figures = usesFigures(count);
  return `${cap(figure(count, figures))} outfit${count === 1 ? '' : 's'}`;
}

/**
 * When Today is allowed to ask a model anything at all.
 *
 * ── The defect this replaces ───────────────────────────────────────────────
 *
 * `useOutfits` sent the top twelve candidates to `generate-outfits` on EVERY
 * render that produced a shortlist. An ordinary Tuesday — no note, one calendar
 * event, a clear winner in the beam search — cost a model call, twenty seconds
 * of `isEnhancing`, and a re-rank whose only visible effect was different words
 * on outfits the scorer had already chosen.
 *
 * The plan's rule is that a normal morning is local-only, and that AI is asked
 * for exactly three things the deterministic rules genuinely cannot settle.
 * This module is that rule, as a pure function, so it can be tested against
 * fixtures rather than believed.
 *
 * ── The three reasons, and why each is real ────────────────────────────────
 *
 * COMPLEX FREE TEXT. "dinner then drinks, and it might rain" is a sentence the
 * scorer cannot parse — it has no target formality, no occasion, and two
 * different dress codes in one evening. A bare "work" is not complex: the
 * occasion vocabulary already covers it, and asking a model to interpret a word
 * we have a lookup for is paying twice for the same answer.
 *
 * MULTI-EVENT FORMALITY CONFLICT. Two events on one day whose formalities are
 * far apart — a 2 and a 5 — is a genuine conflict about what to wear, and the
 * scorer resolves it by targeting one number, which is a decision it makes
 * silently and cannot explain. One event, or two events at the same register,
 * is not a conflict.
 *
 * MEASURED NEAR-TIE. When the top candidates are within a hair of each other,
 * the ordering is noise: the scorer is saying "these are the same". That is the
 * one case where taste is the tiebreak and a model has something to add. It is
 * MEASURED — a number against the actual scores — not assumed from the fact
 * that several outfits exist.
 *
 * ── What this function deliberately is not ────────────────────────────────
 *
 * It is not a consent check, a quota check or a connectivity check. Those
 * belong to the server and to the query layer and already exist; putting a
 * second copy here would mean two places that can disagree about whether a
 * user has agreed to anything. This answers one question — is there a question
 * worth asking — and nothing else.
 */

import type { OutfitCandidate, StyleContext } from '@/lib/styling';

/** Why the enhancement was requested. Null when it was not. */
export type EnhanceReason = 'complex_note' | 'event_conflict' | 'near_tie';

export type EnhanceDecision = {
  enhance: boolean;
  reason: EnhanceReason | null;
};

/**
 * A note is complex when the scorer has demonstrably not consumed it.
 *
 * `targetOccasion` is set by the deterministic parse when it recognised the
 * note; if it recognised nothing and the person still wrote something
 * substantial, that is the case where the words carry intent nothing has read.
 *
 * The word count is the second half and does the harder work: a recognised
 * occasion plus extra clauses ("work, then a birthday dinner") is still
 * unparsed intent, and the conjunction is the tell.
 */
const MIN_COMPLEX_WORDS = 4;
const CONJUNCTIONS = /\b(then|after|before|and then|but|however|unless|later)\b/i;

export function isComplexNote(note: string | null, targetOccasion: string | null): boolean {
  const text = (note ?? '').trim();
  if (!text) return false;

  const words = text.split(/\s+/).length;

  // Two clauses about two different moments — the shape the scorer flattens
  // into one target and cannot explain afterwards.
  if (CONJUNCTIONS.test(text)) return true;

  // Nothing was recognised, and there is enough here to be worth reading.
  return targetOccasion === null && words >= MIN_COMPLEX_WORDS;
}

/**
 * Two events far enough apart in formality that one outfit must compromise.
 *
 * Two, not one: a single event is what the scorer targets, and it targets it
 * correctly. The gap is what makes it a conflict — a 3 and a 4 are the same
 * outfit, a 2 and a 5 are not.
 */
const CONFLICT_GAP = 2;

export function hasEventConflict(events: readonly { formality: number }[]): boolean {
  if (events.length < 2) return false;
  const formalities = events.map((e) => e.formality);
  return Math.max(...formalities) - Math.min(...formalities) >= CONFLICT_GAP;
}

/**
 * The top candidates are indistinguishable to the scorer.
 *
 * Measured across the candidates that will actually be SHOWN plus the next one
 * down — the question is "is the visible set the right visible set", and a tie
 * between the eleventh and twelfth candidates is not a question anybody is
 * looking at.
 *
 * The threshold is a fraction of the top score rather than an absolute, because
 * scores are a weighted sum whose scale moves with the learned weights; an
 * absolute 0.01 means something different for a user whose weights have
 * doubled.
 */
const NEAR_TIE_FRACTION = 0.02;

export function isNearTie(candidates: readonly OutfitCandidate[], visible: number): boolean {
  const considered = candidates.slice(0, Math.max(visible + 1, 2));
  if (considered.length < 2) return false;

  const top = considered[0]!.score;
  if (top <= 0) return false;

  const last = considered[considered.length - 1]!.score;
  return (top - last) / top <= NEAR_TIE_FRACTION;
}

/**
 * The whole policy, in one pure call.
 *
 * Order matters only for the reason it reports, and the order is
 * most-specific-first: a complex note is a thing the user typed, an event
 * conflict is a thing their calendar says, and a near-tie is a thing the
 * scorer noticed. When two apply, the one the user would recognise wins.
 */
export function shouldEnhanceWithAi({
  context,
  candidates,
  visible,
}: {
  context: Pick<StyleContext, 'note' | 'events' | 'targetOccasion'>;
  candidates: readonly OutfitCandidate[];
  /** How many cards the screen is about to draw. */
  visible: number;
}): EnhanceDecision {
  if (!candidates.length) return { enhance: false, reason: null };

  if (isComplexNote(context.note, context.targetOccasion)) {
    return { enhance: true, reason: 'complex_note' };
  }
  if (hasEventConflict(context.events)) {
    return { enhance: true, reason: 'event_conflict' };
  }
  if (isNearTie(candidates, visible)) {
    return { enhance: true, reason: 'near_tie' };
  }
  return { enhance: false, reason: null };
}

/**
 * CP-03's queue, said the way the frame says it.
 *
 * ── THE BAR IS GONE ───────────────────────────────────────────────────────
 *
 * A `ProgressTrack` used to sit on the capture sheet, filled by
 * `settled / total`. The constitution's refusal is flat — "Progress is a count,
 * never a bar or percentage" — and the frame's annotation is "Queue is a
 * count". Neither the fraction nor the component survives.
 *
 * ── BUT A COUNT IS NOT A ROW OF GENERIC UNITS ─────────────────────────────
 *
 * The first draft of this module printed "1 piece / Ready to review" and
 * "2 pieces / In the queue", and that was rejected as not atlas-exact. The
 * frame draws two side-by-side cards, and the DIFFERENCE BETWEEN THEM IS THE
 * POINT:
 *
 *   · The first card names the garment — "Linen blouse" — because the notice
 *     sits over the captured frame and the user has to be able to tell which
 *     piece it belongs to. A generic "1 piece" throws that away.
 *   · The second card is a semantic remainder — "Two more" — which is what a
 *     person says about the rest of a queue they are not looking at.
 *
 * So one card is an identity and the other is a count, and neither is a bar.
 *
 * Pure on purpose: the whole judgement — which cards exist, how each is worded,
 * what happens at zero — is a function of the queue's own facts, so it is
 * testable without a camera or a render (`tests/w3-g3-queue-count.test.ts`).
 */

export type QueueCard = {
  /**
   * The card's headline: a garment's real name, or a semantic count.
   *
   * Never fabricated. When a finished piece has not been named yet — the tagger
   * has not returned a label — this falls back to a count of pieces rather than
   * inventing a word for a garment nobody has read.
   */
  lead: string;
  /** What that lead is waiting on: "Ready to review" or "In the queue". */
  state: string;
};

/** The facts the cards are built from. Counts, and the first ready name. */
export type QueueFacts = {
  /** How many pieces have finished and are waiting to be reviewed. */
  ready: number;
  /** How many are still being worked — queued or in flight. */
  waiting: number;
  /**
   * The name of the FIRST ready piece, if the tagger has produced one.
   *
   * Null is a real answer and is handled: a piece can be filed and reviewable
   * before it has a name. Nothing here guesses one.
   */
  firstReadyName?: string | null;
};

/**
 * Spelled numbers up to twelve, numerals above.
 *
 * The frame writes "Two more", not "2 more" — a remainder read at a glance is
 * prose, and prose spells its small numbers. Twelve is the ceiling because past
 * it the spelling stops being quicker to read than the digit.
 */
const SPELLED = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
] as const;

function spell(n: number): string {
  return n >= 0 && n < SPELLED.length ? SPELLED[n] : String(n);
}

/** "1 piece" / "3 pieces" — the honest fallback when there is no name. */
function pieces(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

/**
 * The cards CP-03 draws for the queue described by `facts`.
 *
 * ZERO IS QUIET, which is refusal 4 and the reason this returns a list rather
 * than a fixed pair: a queue with nothing finished draws one card, not a card
 * reading "0 pieces". An empty queue draws nothing at all.
 *
 * THE REMAINDER IS THE WAITING COUNT, not "everything except the named piece".
 * If several pieces are already ready, the first is named here and the rest are
 * visible immediately below on the queue rail (`UploadQueueList`), which draws
 * every job with its own name and tick — so nothing is lost by naming one.
 *
 * Negative and fractional inputs are clamped rather than trusted. They cannot
 * arise from the real store, but a count is the one thing on this screen a
 * person is entitled to believe, and "-1 pieces" is a worse failure than a
 * missing card.
 */
export function queueCards(facts: QueueFacts): QueueCard[] {
  const ready = Math.max(0, Math.trunc(facts.ready));
  const waiting = Math.max(0, Math.trunc(facts.waiting));
  const name = facts.firstReadyName?.trim();

  const cards: QueueCard[] = [];

  if (ready > 0) {
    cards.push({
      // The garment, by name, when it has one — otherwise a count, never a
      // placeholder word and never a guess.
      lead: name ? name : pieces(ready),
      state: 'Ready to review',
    });
  }

  if (waiting > 0) {
    cards.push({ lead: `${spell(waiting)} more`, state: 'In the queue' });
  }

  return cards;
}

/**
 * The single sentence VoiceOver hears when the queue changes.
 *
 * §9 asks for "three pieces filed, one ready to review" on change, ONCE, rather
 * than one announcement per card per tick — so the cards are collapsed into one
 * live-region string here, and null when there is nothing to say.
 */
export function queueAnnouncement(facts: QueueFacts): string | null {
  const cards = queueCards(facts);
  if (cards.length === 0) return null;
  return cards.map((c) => `${c.lead}, ${c.state.toLowerCase()}`).join(', ');
}

import type { PinterestBoard, PinterestPin } from '@/features/recreate/pinterest';

/**
 * Board-led inspiration, answered without a model.
 *
 * "Lunch with friends this fall — draw inspiration from my Fall/Winter
 * board" is answered the way `facts.ts` answers counting questions: on
 * device, deterministically, spending nothing. The board and Pin listings
 * come through the `pinterest-api` proxy live; choosing among them is token
 * arithmetic below; the outfit itself comes from the same `generateOutfits`
 * engine every other stylist turn uses. No Pin image or text ever reaches a
 * model — the analysis gate in `features/recreate/sources.ts` is closed, and
 * this file is the design that makes the feature honest anyway: the Pin is
 * shown as EVIDENCE of the mood, the closet answers the occasion, and the
 * copy says "in the spirit of", never "recreated".
 *
 * Everything here is pure so the node suite can prove the selection: the
 * fetching lives in `features/recreate/pinterest.ts`, the orchestration in
 * `use-chat.ts`.
 */

// ---------------------------------------------------------------------------
// Recognizing the ask
// ---------------------------------------------------------------------------

export type InspirationAsk = {
  /** The words the person used for the board, or null for "my pinterest". */
  boardPhrase: string | null;
};

/**
 * A question is an inspiration ask when it reaches for Pinterest or a board
 * by name. Deliberately narrow: "what should I wear to a board meeting" must
 * stay an ordinary styling question, so the bare word "board" only counts in
 * the possessive shapes people actually use for their own boards.
 */
export function parseInspirationAsk(question: string): InspirationAsk | null {
  const q = question.toLowerCase();

  // "my fall/winter board", "my 'date night' board", "the wedding board" —
  // a named board is the strongest signal and carries its own phrase.
  const named = q.match(/\b(?:my|the|our)\s+["'‘’“”]?(.+?)["'‘’“”]?\s+board\b/i);
  if (named?.[1]) {
    const phrase = named[1].trim();
    // "board meeting" never matches here (meeting follows, not precedes),
    // but "my board" alone yields an empty-ish phrase — treat as unnamed.
    if (phrase && phrase !== 'pinterest') return { boardPhrase: phrase };
    return { boardPhrase: null };
  }

  // Unnamed reaches: "from my pinterest", "use my pinterest boards".
  if (/\bpinterest\b/.test(q)) return { boardPhrase: null };

  return null;
}

// ---------------------------------------------------------------------------
// Choosing the board
// ---------------------------------------------------------------------------

const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

/**
 * The board whose name best overlaps the person's phrase, or null when
 * nothing overlaps at all. Exact name containment wins outright; otherwise
 * shared tokens count, ties broken by name for determinism. Null rather than
 * a guess: answering from the wrong board is worse than asking.
 */
export function chooseBoard(boards: PinterestBoard[], phrase: string): PinterestBoard | null {
  if (!boards.length) return null;
  const want = tokens(phrase);
  if (!want.length) return null;
  const phraseNorm = want.join(' ');

  let best: PinterestBoard | null = null;
  let bestScore = 0;
  for (const board of [...boards].sort((a, b) => a.name.localeCompare(b.name))) {
    const nameTokens = tokens(board.name);
    const nameNorm = nameTokens.join(' ');
    let score = 0;
    if (nameNorm === phraseNorm) score = 1000;
    else if (nameNorm.includes(phraseNorm) || phraseNorm.includes(nameNorm)) score = 100;
    else score = want.filter((t) => nameTokens.includes(t)).length;
    if (score > bestScore) {
      best = board;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

// ---------------------------------------------------------------------------
// Choosing the Pin
// ---------------------------------------------------------------------------

/**
 * The question's own vocabulary, expanded just enough to meet Pin text
 * halfway. Closed and tiny on purpose — this is a tiebreaker among Pins the
 * person already curated, not a search engine.
 */
const TERM_EXPANSIONS: Record<string, string[]> = {
  fall: ['fall', 'autumn', 'october', 'september'],
  autumn: ['fall', 'autumn'],
  winter: ['winter', 'cozy', 'coat', 'snow'],
  summer: ['summer', 'beach', 'linen'],
  spring: ['spring'],
  lunch: ['lunch', 'brunch', 'daytime', 'casual'],
  brunch: ['brunch', 'lunch', 'daytime'],
  dinner: ['dinner', 'evening', 'night'],
  date: ['date', 'evening', 'night'],
  work: ['work', 'office', 'business'],
  office: ['office', 'work', 'business'],
  wedding: ['wedding', 'formal', 'guest'],
  party: ['party', 'night', 'going out'],
  casual: ['casual', 'everyday', 'weekend'],
  formal: ['formal', 'elegant', 'dressy'],
};

function questionTerms(question: string): string[] {
  const expanded = new Set<string>();
  for (const t of tokens(question)) {
    expanded.add(t);
    for (const e of TERM_EXPANSIONS[t] ?? []) expanded.add(e);
  }
  return [...expanded];
}

/**
 * Rank the board's Pins against the question. Pins with imagery outrank
 * imageless ones at equal relevance (the card needs a picture to be
 * evidence); id breaks the final tie so the same board and question always
 * choose the same Pin.
 *
 * A zero-overlap board still yields its first image-bearing Pin: the person
 * pointed at this board on purpose, so its top is a better answer than a
 * refusal — the copy just stops claiming occasion relevance in that case
 * (see `pinRelevant`).
 */
export function rankPins(pins: PinterestPin[], question: string): PinterestPin[] {
  const terms = questionTerms(question);
  const score = (pin: PinterestPin): number => {
    const text = tokens([pin.title ?? '', pin.description ?? '', pin.altText ?? ''].join(' '));
    let s = terms.filter((t) => text.includes(t)).length * 10;
    if (pin.imageUrl) s += 1;
    return s;
  };
  return [...pins].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

/** Whether the chosen Pin actually met the question, or is merely the board's top. */
export function pinRelevant(pin: PinterestPin, question: string): boolean {
  const terms = questionTerms(question);
  const text = tokens([pin.title ?? '', pin.description ?? '', pin.altText ?? ''].join(' '));
  return terms.some((t) => text.includes(t));
}

// ---------------------------------------------------------------------------
// The reply
// ---------------------------------------------------------------------------

/** What the bubble shows beside the text. Ephemeral — see `StoredContent`. */
export type PinReference = {
  boardName: string;
  title: string | null;
  pinUrl: string;
  imageUrl: string | null;
};

/**
 * Every way the turn can end, with its sentence. Bounded like every other
 * failure vocabulary in the app; none quotes anything back, and none of the
 * sentences names a Pin or a board the API supplied — the board name the
 * person typed is theirs, so `no_board_match` may echo the PHRASE.
 */
export function inspirationFailureText(
  cause:
    | 'not_connected'
    | 'reconnect'
    | 'no_boards'
    | 'no_board_match'
    | 'board_empty'
    | 'rate_limited'
    | 'offline'
    | 'provider_down',
  boardPhrase: string | null,
): string {
  switch (cause) {
    case 'not_connected':
      return 'Pinterest isn’t connected yet. You can connect it under Privacy & data → Pinterest inspiration, then ask again.';
    case 'reconnect':
      return 'Your Pinterest connection has lapsed. Reconnect it under Privacy & data → Pinterest inspiration and ask again.';
    case 'no_boards':
      return 'Your Pinterest account doesn’t have any boards Cinch can read yet.';
    case 'no_board_match':
      return boardPhrase
        ? `Couldn’t find a board called “${boardPhrase}” on your Pinterest. Name it the way it appears there and I’ll use it.`
        : 'Tell me which board to draw from — “my Fall/Winter board”, say — and I’ll use it.';
    case 'board_empty':
      return 'That board doesn’t have any Pins Cinch can read, so there’s nothing to draw from yet.';
    case 'rate_limited':
      return 'Pinterest is asking for a short pause. Give it a minute and ask again.';
    case 'offline':
      return 'Reaching Pinterest needs the network. Your closet still works — try again when you’re back.';
    case 'provider_down':
      return 'Pinterest can’t be reached right now. Try again in a little while.';
  }
}

/**
 * The success sentence. Honest grading built in: an outfit assembled by the
 * engine is an interpretation in the Pin's spirit, never a recreation — the
 * exact-pieces promise belongs to the photo-analysis flow and is not made
 * here.
 *
 * `boardLabel` is the PERSON'S OWN PHRASE for the board (or null when they
 * said only "my pinterest"), never the API's name for it. This text is
 * persisted into chat history, and the API's board name is API content the
 * no-storage rule keeps out of every table — the ephemeral Pin card is where
 * the real name may appear, and it is never written down.
 */
export function inspirationReplyText(
  boardLabel: string | null,
  relevant: boolean,
  outfitCount: number,
): string {
  const board = boardLabel ? `your “${boardLabel}” board` : 'your board';
  const opening = relevant
    ? `From ${board} — here’s the Pin that fits your ask, with attribution.`
    : `Nothing on ${board} names that occasion, so here’s its top Pin for the mood.`;
  const answer =
    outfitCount > 0
      ? ' Below it: a version in its spirit, built entirely from clothes you own.'
      : ' Your closet doesn’t have enough pieces for a full look yet — nothing here is borrowed or invented.';
  return opening + answer;
}

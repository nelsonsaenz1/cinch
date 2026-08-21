/**
 * The Gap Feed's own derivations, over the one counting function.
 *
 * Directive 3 (docs/design/free-tier-contract.md §"The Gap Feed"). Everything
 * here is pure and reads `rankGaps`/`countOutfits` from `outfit-count.ts` —
 * never reimplements them, never multiplies a tally in a component. See that
 * file's header for why cores are what get counted.
 *
 * ── The "second pair of shoes" question ─────────────────────────────────────
 *
 * The atlas's own copy calls the free tier's eleventh-piece shoe gain "a
 * second pair of shoes" even where the canonical ten already owns two pairs —
 * every other kind's label in the same atlas (`"a third bottom"`,
 * `"a fourth top"`) is the literal `owned + 1` ordinal, and only shoes breaks
 * that pattern (checked against G-01, G-03, G-04, W-01, W-02, W-03, and the
 * shared `tests/outfit-count.test.ts` comment — five independent sources, one
 * inconsistency). This module computes the literal ordinal for every kind,
 * shoes included, so a closet that already owns two pairs is offered "a third
 * pair of shoes" rather than a hardcoded "second" that undercounts what it
 * owns. Flagged in `.redesign/primitive-requests/gap-wall.md`.
 */

import {
  COUNTED_KINDS,
  countOutfits,
  type CountedKind,
  type Gain,
  type Tally,
} from './outfit-count';

export type { CountedKind, Gain, Tally } from './outfit-count';

const ORDINALS = [
  'zeroth',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
] as const;

/** "first", "second", … "twelfth", then "13th", "22nd", … for anything larger. */
export function ordinal(n: number): string {
  if (n >= 0 && n < ORDINALS.length) return ORDINALS[n];
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const NOUN: Record<CountedKind, { singular: string; plural: string }> = {
  tops: { singular: 'top', plural: 'tops' },
  bottoms: { singular: 'bottom', plural: 'bottoms' },
  dresses: { singular: 'dress', plural: 'dresses' },
  shoes: { singular: 'pair of shoes', plural: 'pairs of shoes' },
};

/** The bare noun for a kind — "top", "bottom", "dress", "pair of shoes". */
export function gapNoun(kind: CountedKind, count = 1): string {
  return count === 1 ? NOUN[kind].singular : NOUN[kind].plural;
}

/** "A fourth top", "A third pair of shoes" — computed from what's owned. */
export function gapLabel(tally: Tally, kind: CountedKind): string {
  const position = ordinal(tally[kind] + 1);
  const article = /^[aeiou]/i.test(position) ? 'An' : 'A';
  return `${article} ${position} ${gapNoun(kind)}`;
}

/** The lowercase form for mid-sentence use — "a fourth top". */
export function gapLabelLower(tally: Tally, kind: CountedKind): string {
  const label = gapLabel(tally, kind);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "a bottom", "a pair of shoes" — the bare noun with its indefinite article. */
export function nounWithArticle(kind: CountedKind): string {
  const noun = gapNoun(kind);
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

/**
 * Which owned kind is doing the most duplicating — the plentiful side of an
 * unbalanced closet. Ties break in `COUNTED_KINDS` order, same as `rankGaps`.
 */
export function mostOwnedKind(tally: Tally): CountedKind {
  return [...COUNTED_KINDS].sort((a, b) => tally[b] - tally[a])[0];
}

/**
 * G-05's swap line — "Swap a top for a bottom" — computed from which kind is
 * actually over-represented and which gap actually leads, never a fixed pair
 * of nouns. Null when there's nothing sensible to swap (the plentiful kind has
 * only one piece; storing its only example would leave a category empty).
 */
export function swapAdvice(tally: Tally, addKind: CountedKind): string | null {
  const fromKind = mostOwnedKind(tally);
  if (fromKind === addKind || tally[fromKind] <= 1) return null;
  return `Swap ${nounWithArticle(fromKind)} for ${nounWithArticle(addKind)}`;
}

/**
 * The one-line "why", computed from the real tally rather than written once
 * for the canonical ten. No brand, no product — the shape of the gap only.
 */
export function describeGap(tally: Tally, gain: Gain): string {
  const from = countOutfits(tally);
  const arrow = `${from} outfit${from === 1 ? '' : 's'} → ${gain.total}`;

  switch (gain.kind) {
    case 'shoes': {
      const dressNote = tally.dresses > 0 ? ', including the dress' : '';
      return `${arrow}. Pairs with everything you own${dressNote}.`;
    }
    case 'bottoms': {
      if (tally.tops > 0) {
        return `${arrow}. Your ${tally.tops} ${tally.tops === 1 ? 'top works' : 'tops all work'} over it.`;
      }
      return `${arrow}. Opens outfits your dress alone can’t reach.`;
    }
    case 'tops': {
      if (tally.bottoms > 0) {
        return `${arrow}. Layers over the ${tally.bottoms} ${gapNoun('bottoms', tally.bottoms)} you already own.`;
      }
      return `${arrow}. Needs a bottom or a dress beside it to make anything.`;
    }
    case 'dresses':
      return `${arrow}. Its own pairings with the shoes you already own.`;
  }
}

/**
 * Whether one gap — or a genuine tie of them — dominates the rest.
 *
 * Returns the tied leaders (usually one kind, sometimes two when the maths
 * ties exactly — see the eight-tops closet below) when nothing else in the
 * ranking contributes a third of what they do; null when the feed's ordinary
 * ranked list is the honest rendering.
 *
 * The eight-tops/one-bottom/one-shoe closet from the atlas's G-05 is a
 * genuine, provable tie between "a second bottom" and "a second pair of
 * shoes" — `cores = tops × bottoms × shoes`, and with bottoms = shoes = 1,
 * gaining either one doubles `tops` either way. The atlas's prose nominates
 * the bottom; the arithmetic does not choose between them, so this function
 * doesn't either — it reports both as leaders and the screen features
 * whichever `rankGaps`' declared tiebreak (shoes first) puts on top, which is
 * the same tiebreak every other ranked list in this feature already uses.
 */
export function dominantGaps(ranked: readonly Gain[]): Gain[] | null {
  const [first] = ranked;
  if (!first || first.gain <= 0) return null;

  const leaders = ranked.filter((g) => g.gain === first.gain);
  const rest = ranked.filter((g) => g.gain !== first.gain);
  const restMax = rest.reduce((max, g) => Math.max(max, g.gain), 0);

  // "Nothing else comes close" has to be true before the feed says it: the
  // runner-up must not clear a third of the leader.
  if (restMax > 0 && restMax * 3 > first.gain) return null;
  return leaders;
}

/**
 * A generic garment reference — enough of a real closet item to say what
 * would pair with a new piece, never enough to fabricate one.
 */
export type PairablePiece<T> = { id: string; kind: CountedKind; piece: T };

export type PairingSample<T> = {
  /** Up to `limit` real, owned pieces the new piece would combine with. */
  shown: T[];
  /** How many more exist beyond `shown` — never negative. */
  more: number;
};

/**
 * Which owned pieces a new piece of `kind` would combine with, sampled for
 * display. Shoes pair with tops, bottoms and dresses; bottoms and tops pair
 * with the other half of a core plus shoes; a dress pairs with shoes alone.
 *
 * Never returns more than the closet actually owns — "+4" on screen is
 * `pairablePieces(...).more`, not a number typed once for the canonical ten.
 */
export function pairablePieces<T>(
  kind: CountedKind,
  pieces: readonly PairablePiece<T>[],
  limit = 3,
): PairingSample<T> {
  const relevantKinds: readonly CountedKind[] =
    kind === 'shoes'
      ? ['tops', 'bottoms', 'dresses']
      : kind === 'dresses'
        ? ['shoes']
        : ['shoes', kind === 'tops' ? 'bottoms' : 'tops'];

  const relevant = pieces.filter((p) => relevantKinds.includes(p.kind)).map((p) => p.piece);
  return { shown: relevant.slice(0, limit), more: Math.max(0, relevant.length - limit) };
}

/**
 * G-02's preview rows — up to `limit` real, owned combinations that would
 * complete into an outfit once the gap is filled, plus a marked absence for
 * the missing piece. Never a picture of a garment nobody owns: the "missing"
 * slot is a caller-drawn placeholder, and this function hands back only ids
 * that exist in the closet.
 *
 * `more` is `gain - shown.length`, tied to the real computed gain rather than
 * to how many rows happened to enumerate — the same discipline `pairablePieces`
 * follows for its own "+N" tile.
 */
export function corePreviewRows<T>(
  kind: CountedKind,
  byKind: Partial<Record<CountedKind, readonly T[]>>,
  gain: number,
  limit = 3,
): { shown: T[][]; more: number } {
  const rows: T[][] = [];

  const pushCross = (a: readonly T[], b: readonly T[]) => {
    const total = a.length * b.length;
    const n = Math.min(limit - rows.length, total);
    for (let i = 0; i < n; i++) rows.push([a[Math.floor(i / b.length)]!, b[i % b.length]!]);
  };

  if (kind === 'shoes') {
    pushCross(byKind.tops ?? [], byKind.bottoms ?? []);
    for (const d of byKind.dresses ?? []) {
      if (rows.length >= limit) break;
      rows.push([d]);
    }
  } else if (kind === 'bottoms') {
    pushCross(byKind.tops ?? [], byKind.shoes ?? []);
  } else if (kind === 'tops') {
    pushCross(byKind.bottoms ?? [], byKind.shoes ?? []);
  } else {
    for (const s of byKind.shoes ?? []) {
      if (rows.length >= limit) break;
      rows.push([s]);
    }
  }

  return { shown: rows, more: Math.max(0, gain - rows.length) };
}

/** Every counted kind, in the feed's own declared order — re-exported so callers never re-derive it. */
export { COUNTED_KINDS };

/**
 * AC-02's four sections, and AC-08's collapse.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * It is not ranking. Every function here is a partition of a list that is
 * already in `created_at desc` order, and every partition preserves that order
 * inside itself. Nothing is scored, nothing is promoted, and there is no input
 * that could make one row outrank another of the same age. The design record's
 * "ordering is strictly reverse-chronological" is a property this module has to
 * not break, and the way it does not break it is by never sorting.
 *
 * It is also not a count. A collapsed row says "3 people joined your circles",
 * which is a NUMBER IN A SENTENCE about a set the reader can expand and read in
 * full — not a badge, not a tally against a threshold, and not something any
 * other part of the surface reads. The refusal in §7 is of a count on the entry
 * glyph; the summary line is the atlas's own copy (`group.joined`,
 * `group.reactions`).
 *
 * ── WHY COLLAPSE AT ALL ───────────────────────────────────────────────────
 *
 * Because the alternative to a collapsed month is a long one. §7 bounds the
 * surface at thirty days, so an active reader arrives at a page whose bottom
 * two thirds are individually-uninteresting arrivals and reactions from three
 * weeks ago. Collapsing those into two lines is what keeps the thirty-day
 * window from being the reason the page feels like a feed.
 *
 * No React and no react-native, so the node suite can walk the boundaries
 * directly — which is the whole point, since the boundaries are the part that
 * cannot be tested by waiting.
 */

import {
  groupJoined,
  groupReactions,
  SECTION_EARLIER,
  SECTION_EARLIER_MONTH,
  SECTION_EARLIER_WEEK,
  SECTION_NEW,
} from './copy';
import type { ActivityLine } from './sentence';
import type { ActivityEventType } from './types';

const DAY = 24 * 60 * 60_000;

/**
 * Seven days, and it is §7's number: "AC-08 groups items >7 days".
 *
 * The same constant decides the `Earlier this week` / `Earlier this month`
 * boundary, which is not a coincidence — the section that holds the collapsed
 * rows has to be the section whose rows are old enough to collapse, or the
 * reader meets a summary sitting above the individual rows it summarises.
 */
export const COLLAPSE_AFTER_DAYS = 7;

/**
 * Two days for `Earlier`, so it means today and yesterday.
 *
 * AC-02 draws `Earlier` over rows stamped Tue, Mon and Sun beneath a `New`
 * section stamped 2h and 5h, which reads as "recent but seen". A wider window
 * would swallow `Earlier this week` entirely; a narrower one would put
 * yesterday under a heading that says "this week", which is true and unhelpful.
 */
const EARLIER_DAYS = 2;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between a row and now. Negative clamps to zero. */
export function ageInDays(iso: string, now: Date): number {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / DAY));
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type SectionKey = 'new' | 'earlier' | 'week' | 'month';

export const SECTION_TITLES: Record<SectionKey, string> = {
  new: SECTION_NEW,
  earlier: SECTION_EARLIER,
  week: SECTION_EARLIER_WEEK,
  month: SECTION_EARLIER_MONTH,
};

/**
 * Which section a row belongs to.
 *
 * `New` IS UNSEEN, NOT RECENT, and that is the one non-obvious rule here. A row
 * that arrived an hour ago and has already been looked at is not new; a row
 * from Tuesday that the reader has never opened the page since is. Dating the
 * section instead would mean the heading changed under a reader who did nothing
 * — which is the behaviour that makes an inbox feel like it is moving on its
 * own.
 *
 * A REVOKED ROW IS NEVER NEW. Its subject is gone, so surfacing it at the top
 * of the page under a heading that promises something to do is exactly wrong;
 * it files by age with everything else and says AC-05 when opened.
 */
export function sectionOf(line: ActivityLine, now: Date): SectionKey {
  if (line.event.seenAt === null && !line.event.revokedAt) return 'new';
  const days = ageInDays(line.event.occurredAt, now);
  if (days < EARLIER_DAYS) return 'earlier';
  if (days < COLLAPSE_AFTER_DAYS) return 'week';
  return 'month';
}

// ---------------------------------------------------------------------------
// Collapse
// ---------------------------------------------------------------------------

/**
 * The two types that collapse, and their summary copy.
 *
 * Only these two, and the test is whether a run of them says anything the
 * summary loses. Three arrivals and five reactions are genuinely interchangeable
 * at three weeks' distance — the reader wants the shape, and can expand for the
 * detail. An invitation is not: it names a room the reader may still be deciding
 * about, and a collapsed "2 invitations" would bury the one thing on this
 * surface that is actually a question. A departure is not either: somebody
 * leaving a small group is the kind of fact people notice individually.
 */
const COLLAPSIBLE: Partial<Record<ActivityEventType, (count: number) => string>> = {
  'circle.member.joined': groupJoined,
  'daily.reaction.received': groupReactions,
};

/** How many of a kind it takes before collapsing says less than it costs. */
const MIN_GROUP = 2;

export type ActivityEntry =
  | { kind: 'row'; key: string; line: ActivityLine }
  | {
      kind: 'group';
      key: string;
      /** `group.joined` / `group.reactions`. */
      title: string;
      /** "Priya, Len and Ada · Aug 2–9". */
      subtitle: string;
      /** The rows it stands for, newest first, for the expanded state. */
      lines: ActivityLine[];
    };

export interface ActivitySection {
  key: SectionKey;
  title: string;
  data: ActivityEntry[];
}

/**
 * "Priya, Len and Ada" · "Maya, Theo and 2 others".
 *
 * Three names then a remainder, which is AC-08's own drawing. Nameless actors
 * are dropped rather than rendered as "A Cinch member" — a summary line is not
 * where to spend four words on somebody the reader is not related to — and if
 * every actor is nameless the caller gets an empty string and drops the clause.
 */
export function nameList(names: readonly (string | null)[], shown = 3): string {
  const real = [...new Set(names.flatMap((n) => (n?.trim() ? [n.trim()] : [])))];
  if (real.length === 0) return '';
  if (real.length <= shown) {
    if (real.length === 1) return real[0]!;
    return `${real.slice(0, -1).join(', ')} and ${real[real.length - 1]!}`;
  }
  const rest = real.length - shown;
  return `${real.slice(0, shown).join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/** "Aug 2–9" · "Aug 28 – Sep 3" · "Aug 2" when the run is one day wide. */
export function dateSpan(newestIso: string, oldestIso: string): string {
  const newest = new Date(newestIso);
  const oldest = new Date(oldestIso);
  if (Number.isNaN(newest.getTime()) || Number.isNaN(oldest.getTime())) return '';

  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  const sameDay =
    oldest.getFullYear() === newest.getFullYear() &&
    oldest.getMonth() === newest.getMonth() &&
    oldest.getDate() === newest.getDate();

  if (sameDay) return `${month(newest)} ${newest.getDate()}`;
  // An en dash, tight, when the month is shared; spaced when it is not, because
  // "Aug 28 – Sep 3" needs the air and "Aug 2–9" does not.
  if (oldest.getMonth() === newest.getMonth() && oldest.getFullYear() === newest.getFullYear()) {
    return `${month(oldest)} ${oldest.getDate()}–${newest.getDate()}`;
  }
  return `${month(oldest)} ${oldest.getDate()} – ${month(newest)} ${newest.getDate()}`;
}

/**
 * The subtitle under a collapsed row.
 *
 * `From ` prefixes the reaction group and not the arrival group, which is
 * AC-08's drawing and is grammar rather than decoration: people JOINED (they
 * are the subject), reactions CAME FROM people (they are not).
 */
function groupSubtitle(type: ActivityEventType, lines: readonly ActivityLine[]): string {
  const names = nameList(lines.map((l) => (l.mark.kind === 'person' ? l.mark.name : actorNameOf(l))));
  const span = dateSpan(lines[0]!.event.occurredAt, lines[lines.length - 1]!.event.occurredAt);
  const who = names ? (type === 'daily.reaction.received' ? `From ${names}` : names) : '';
  return [who, span].filter(Boolean).join(' · ');
}

/**
 * The actor's name off a line whose mark is the group glyph.
 *
 * `circle.member.joined` wears the circle mark, so its name is not on the mark
 * — but the summary needs it. It is recoverable from the sentence's first bold
 * run, which `emphasise` guarantees is the actor for every template that has
 * one, and this avoids threading a second lookup table through the grouper for
 * a single field.
 */
function actorNameOf(line: ActivityLine): string | null {
  const bold = line.segments.find((s) => s.bold);
  return bold?.text ?? null;
}

/**
 * The timeline, sectioned, with old runs collapsed.
 *
 * ORDER IS NEVER TOUCHED. Rows enter in `created_at desc` and leave in
 * `created_at desc`; a collapsed group takes the position of the FIRST row it
 * absorbed, so the summary sits exactly where its newest member did. Runs are
 * contiguous by construction — the scan only ever merges adjacent rows of the
 * same type — which means a collapse can never reach past an intervening row of
 * another kind and reorder the page around it.
 */
export function buildSections(
  lines: readonly ActivityLine[],
  now: Date = new Date(),
): ActivitySection[] {
  const buckets: Record<SectionKey, ActivityLine[]> = {
    new: [],
    earlier: [],
    week: [],
    month: [],
  };
  for (const line of lines) buckets[sectionOf(line, now)].push(line);

  const order: SectionKey[] = ['new', 'earlier', 'week', 'month'];

  return order.flatMap((key) => {
    const rows = buckets[key];
    if (rows.length === 0) return [];
    // Only the oldest section collapses. A summary among rows the reader is
    // still deciding about would hide the decision.
    const data = key === 'month' ? collapse(rows) : rows.map(asRow);
    return [{ key, title: SECTION_TITLES[key], data }];
  });
}

const asRow = (line: ActivityLine): ActivityEntry => ({ kind: 'row', key: line.key, line });

/** One pass over a section, merging adjacent runs of a collapsible type. */
function collapse(rows: readonly ActivityLine[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  let i = 0;

  while (i < rows.length) {
    const head = rows[i]!;
    const summary = COLLAPSIBLE[head.event.type];

    if (!summary || head.event.revokedAt) {
      // A revoked row is never absorbed: AC-05 is the only place its
      // disappearance is explained, and a summary would swallow the
      // explanation along with the row.
      out.push(asRow(head));
      i += 1;
      continue;
    }

    let j = i;
    while (j < rows.length && rows[j]!.event.type === head.event.type && !rows[j]!.event.revokedAt) {
      j += 1;
    }

    const run = rows.slice(i, j);
    if (run.length < MIN_GROUP) {
      out.push(asRow(head));
      i += 1;
      continue;
    }

    out.push({
      kind: 'group',
      key: `group:${head.event.type}:${head.key}`,
      title: summary(run.length),
      subtitle: groupSubtitle(head.event.type, run),
      lines: run,
    });
    i = j;
  }

  return out;
}

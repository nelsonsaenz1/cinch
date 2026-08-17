/**
 * One inbox, two sources.
 *
 * ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────
 *
 * `/activity` had a feed before the Activity Center existed: `activity_feed()`
 * (20260810100100), which derives seven kinds — a friend request, a borrow
 * asked for or returned, an occasion invitation, a tally of votes, a
 * compliment — at read time out of five tables the caller already owns rows in.
 * The Activity Center adds seven more, materialised per recipient by the
 * fan-out in 20260820000000. Neither taxonomy contains a single member of the
 * other.
 *
 * They are two DATA SOURCES for ONE SCREEN, and shipping them as two screens
 * would be the worst available outcome: two inboxes, two places to check, two
 * dots, and a reader who has to learn which kind of thing lands where in order
 * to know where to look. Everything the design record says about calmness dies
 * at the moment there are two of them.
 *
 * So they are merged, here, into the section model AC-02 draws — and the merge
 * is a MERGE and not a concatenation, because §7's "ordering is strictly
 * reverse-chronological" is a property of the page rather than of either
 * source. Appending the legacy rows under the new ones would be a ranking, and
 * it would be a ranking by which subsystem wrote the row, which is the least
 * meaningful ordering available.
 *
 * ── WHY THE UNSEEN RULE HAS TO BE TRANSLATED ──────────────────────────────
 *
 * `New` means unseen, and the two sources record "seen" completely differently:
 * `activity_events.seen_at` is per row, while the legacy feed has one
 * `profiles.activity_seen_at` for the whole surface. `hasUnseen` in
 * `features/activity/retention.ts` is the existing comparison, and this file
 * applies it per row rather than inventing a second rule — so a legacy row is
 * New exactly when the existing dot would have counted it, and the two halves
 * of the section agree about what New means.
 *
 * No React, no react-native. `tests/activity-center-grouping.test.ts` walks the
 * interleaving directly.
 */

import type { ActivityLine as LegacyLine } from '@/features/activity/sentence';

import {
  ageInDays,
  SECTION_TITLES,
  type ActivityEntry,
  type ActivitySection,
  type SectionKey,
} from './grouping';

/**
 * A legacy row, on its way through the section model.
 *
 * It keeps its own type rather than being adapted into an `ActivityLine`, and
 * that is deliberate: an adapter would have to invent an `ActivityEvent` for it
 * — an id, a `subject_type`, a `revoked_at` — and every one of those inventions
 * would be a lie that some later reader takes literally. The screen renders it
 * with the component it already had (`components/activity/ActivityRow`), which
 * still owns its answer states, its undo and its retry.
 */
export type MergedEntry = ActivityEntry | { kind: 'legacy'; key: string; line: LegacyLine };

export interface MergedSection {
  key: SectionKey;
  title: string;
  data: MergedEntry[];
}

/** The same boundary `sectionOf` uses, so the two halves cannot disagree. */
const EARLIER_DAYS = 2;
const WEEK_DAYS = 7;

/**
 * Which section a legacy row belongs to.
 *
 * `seenAt` is the surface-wide `profiles.activity_seen_at`; a row is unseen when
 * it happened after it. That is `hasUnseen`'s comparison, applied per row.
 */
function legacySection(line: LegacyLine, seenAt: string | null, now: Date): SectionKey {
  // Lexicographic order on a Postgres timestamptz IS chronological order (fixed
  // width, one zone) — the property `social-graph/queries.ts` leans on in
  // `laterOf` — so no Date parsing is needed for the comparison.
  if (!seenAt || line.row.occurredAt > seenAt) return 'new';
  const days = ageInDays(line.row.occurredAt, now);
  if (days < EARLIER_DAYS) return 'earlier';
  if (days < WEEK_DAYS) return 'week';
  return 'month';
}

/** The timestamp an entry sorts on, whichever kind it is. */
function stampOf(entry: MergedEntry): string {
  switch (entry.kind) {
    case 'row':
      return entry.line.event.occurredAt;
    case 'group':
      // A collapsed run takes the position of its newest member, which is where
      // its first absorbed row was. See `collapse`.
      return entry.lines[0]!.event.occurredAt;
    case 'legacy':
      return entry.line.row.occurredAt;
  }
}

/**
 * Interleave the legacy rows into sections already built from the new ones.
 *
 * A single merge pass per section, both inputs newest-first, so the result is
 * newest-first and the collapsed groups keep the positions `buildSections` gave
 * them. A section that exists only because of legacy rows is created; a section
 * with nothing in it is omitted, so the page never draws an empty heading.
 */
export function mergeLegacy(
  sections: readonly ActivitySection[],
  legacy: readonly LegacyLine[],
  seenAt: string | null,
  now: Date = new Date(),
): MergedSection[] {
  const buckets: Record<SectionKey, MergedEntry[]> = {
    new: [],
    earlier: [],
    week: [],
    month: [],
  };
  for (const line of legacy) {
    buckets[legacySection(line, seenAt, now)].push({ kind: 'legacy', key: line.key, line });
  }

  const existing = new Map(sections.map((section) => [section.key, section]));
  const order: SectionKey[] = ['new', 'earlier', 'week', 'month'];

  return order.flatMap((key) => {
    const mine = existing.get(key)?.data ?? [];
    const theirs = buckets[key];
    if (mine.length === 0 && theirs.length === 0) return [];
    return [{ key, title: SECTION_TITLES[key], data: interleave(mine, theirs) }];
  });
}

/** Both inputs newest-first; one pass, ties resolved in favour of the left. */
function interleave(a: readonly MergedEntry[], b: readonly MergedEntry[]): MergedEntry[] {
  const out: MergedEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (stampOf(a[i]!) >= stampOf(b[j]!)) out.push(a[i++]!);
    else out.push(b[j++]!);
  }
  while (i < a.length) out.push(a[i++]!);
  while (j < b.length) out.push(b[j++]!);
  return out;
}

/** A merged page with nothing on it — AC-01's condition, across both sources. */
export function isEmpty(sections: readonly MergedSection[]): boolean {
  return sections.every((section) => section.data.length === 0);
}

/**
 * Is any row on the page unread?
 *
 * Drives nothing but the `Edit` affordance's absence on an empty page and the
 * screen's own `had_unseen` analytics property. It is a BOOLEAN, and there is
 * deliberately no sibling that returns the length of the `new` section.
 */
export function hasNew(sections: readonly MergedSection[]): boolean {
  return sections.some((section) => section.key === 'new' && section.data.length > 0);
}

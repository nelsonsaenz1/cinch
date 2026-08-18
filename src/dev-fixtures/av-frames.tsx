import { useRouter } from 'expo-router';

import { ActivityBody, type ActivityBodyProps } from '@/components/activity-center';
import {
  describeActivity as describeLegacy,
  type ActivityLine as LegacyLine,
} from '@/features/activity/sentence';
import { NO_SUBJECTS, type ActivityFeedRow, type ActivitySubjects } from '@/features/activity/types';
import { buildSections } from '@/features/activity-center/grouping';
import { mergeLegacy, type MergedSection } from '@/features/activity-center/merge';
import { describeActivity, type ActivityLine } from '@/features/activity-center/sentence';
import type { ActivityActor, ActivityEvent, ActivityEventType } from '@/features/activity-center/types';

/**
 * DEV ONLY · REDESIGN 28 — the timeline the eight `dev-av-*` frames pose.
 *
 * ── WHY THE FIXTURE BUILDS EVENTS AND NOT LINES ───────────────────────────
 *
 * Every row below starts as an `ActivityEvent` (or an `ActivityFeedRow`) and is
 * put through the SAME `describeActivity` and the SAME `buildSections` /
 * `mergeLegacy` the screen calls. Nothing here hand-writes a sentence, a stamp,
 * a section or a segment.
 *
 * That is the whole value of the fixture. A fixture that typed its own copy
 * would photograph a page nobody ships: the sentences are the product of
 * `copy.ts` plus `emphasise`, the sections are the product of the seen rule,
 * and a frame built from hand-typed strings would keep looking correct through
 * exactly the edits that broke the real page.
 *
 * `NOW` is fixed so the stamps and the section boundaries are the same on every
 * run — a screenshot whose "2h" drifts to "3h" overnight cannot be compared to
 * anything.
 */

export const NOW = new Date(2026, 7, 18, 9, 41);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ago = (days: number, hours = 0) =>
  new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

// ---------------------------------------------------------------------------
// The people
// ---------------------------------------------------------------------------

/**
 * Long names on purpose.
 *
 * "Theodora Vasquez-Lindqvist" is the artifact's own fixture name and it is
 * there to make a sentence wrap at default type size. A frame full of short
 * names photographs a row that never wraps, which is the case the layout is
 * least likely to get wrong and least useful to look at.
 */
const ACTORS: Record<string, ActivityActor> = {
  marisol: { name: 'Marisol Whitfield', avatarUrl: null },
  theodora: { name: 'Theodora Vasquez-Lindqvist', avatarUrl: null },
  alexandria: { name: 'Alexandria Rivera', avatarUrl: null },
  jonathan: { name: 'Jonathan Okonkwo', avatarUrl: null },
  priya: { name: 'Priya Nandakumar', avatarUrl: null },
  beatriz: { name: 'Beatriz Santoro', avatarUrl: null },
  christopher: { name: 'Christopher Montgomery', avatarUrl: null },
  /** The authorised-actor fallback. No name resolves, and none is invented. */
  nobody: { name: null, avatarUrl: null },
};

let seq = 0;

function event(
  type: ActivityEventType,
  over: Partial<ActivityEvent> & { occurredAt: string },
): ActivityEvent {
  seq += 1;
  return {
    id: `dev-av-${seq}`,
    type,
    actorId: `u-${seq}`,
    subjectType: type === 'daily.reaction.received' ? 'outfit' : 'circle',
    subjectId: `s-${seq}`,
    circleId: type === 'daily.reaction.received' ? null : `c-${seq}`,
    payload: { circle_name: 'Sunday Roasts', reaction: 'sharp' },
    seenAt: NOW.toISOString(),
    revokedAt: null,
    ...over,
  };
}

const line = (
  type: ActivityEventType,
  actor: ActivityActor,
  over: Partial<ActivityEvent> & { occurredAt: string },
): ActivityLine => describeActivity(event(type, over), actor, NOW);

// ---------------------------------------------------------------------------
// The materialised half
// ---------------------------------------------------------------------------

/** Three unseen and two seen — the atlas's `populated-new-and-earlier`. */
export const MIXED_LINES: ActivityLine[] = [
  line('circle.invite.received', ACTORS.marisol!, { occurredAt: ago(0, 2), seenAt: null }),
  line('daily.reaction.received', ACTORS.theodora!, {
    occurredAt: ago(0, 5),
    seenAt: null,
    payload: { reaction: 'sharp' },
  }),
  line('circle.invite.accepted', ACTORS.alexandria!, { occurredAt: ago(0, 7), seenAt: null }),
  line('circle.member.joined', ACTORS.jonathan!, {
    occurredAt: ago(1, 3),
    payload: { circle_name: 'Thursday Tennis' },
  }),
  line('daily.reaction.received', ACTORS.priya!, {
    occurredAt: ago(1, 8),
    payload: { reaction: 'cozy' },
  }),
];

/** Everything already read — the page with no `New` section and no dots. */
export const SEEN_LINES: ActivityLine[] = [
  line('daily.reaction.received', ACTORS.priya!, {
    occurredAt: ago(0, 4),
    payload: { reaction: 'cozy' },
  }),
  line('circle.member.joined', ACTORS.jonathan!, {
    occurredAt: ago(0, 9),
    payload: { circle_name: 'Thursday Tennis' },
  }),
  line('circle.invite.declined', ACTORS.christopher!, { occurredAt: ago(1, 1) }),
  line('circle.member.left', ACTORS.beatriz!, {
    occurredAt: ago(1, 6),
    payload: { circle_name: 'Thursday Tennis' },
  }),
];

/**
 * The fallback and the revoked row, together.
 *
 * They belong in one frame because they are the two rows that look broken and
 * are not: an actor nobody can resolve renders "A Cinch member" with a neutral
 * mark and NO public lookup, and a withdrawn invitation files by AGE rather
 * than under `New`, so it can never summon a reader to something that is gone.
 */
export const EDGE_LINES: ActivityLine[] = [
  line('daily.reaction.received', ACTORS.theodora!, {
    occurredAt: ago(0, 3),
    seenAt: null,
    payload: { reaction: 'sharp' },
  }),
  line('circle.invite.received', ACTORS.nobody!, {
    occurredAt: ago(0, 6),
    seenAt: null,
    actorId: null,
    payload: {},
  }),
  // Unseen AND revoked. `sectionOf` files it by age regardless.
  line('circle.invite.received', ACTORS.marisol!, {
    occurredAt: ago(1, 2),
    seenAt: null,
    revokedAt: ago(0, 1),
  }),
];

// ---------------------------------------------------------------------------
// The legacy half
// ---------------------------------------------------------------------------

function legacyRow(over: Partial<ActivityFeedRow> & { kind: ActivityFeedRow['kind']; occurredAt: string }) {
  seq += 1;
  return {
    subjectKey: `dev-legacy-${seq}`,
    actorId: `u-legacy-${seq}`,
    itemId: null,
    outfitId: null,
    eventId: null,
    postId: null,
    tally: null,
    ...over,
  } as ActivityFeedRow;
}

const legacyLine = (row: ActivityFeedRow, subjects: Partial<ActivitySubjects> = {}) =>
  describeLegacy(row, { ...NO_SUBJECTS, ...subjects }, NOW);

/** A borrow request and a returned piece — the artifact's `mixed` frame. */
export const LEGACY_LINES = [
  legacyLine(legacyRow({ kind: 'borrow_request', occurredAt: ago(0, 3), itemId: 'i-1' }), {
    actorName: 'Alexandria Rivera',
    garment: 'camel wool overcoat',
  }),
  legacyLine(legacyRow({ kind: 'borrow_returned', occurredAt: ago(1, 5), itemId: 'i-2' }), {
    actorName: 'Jonathan Okonkwo',
    garment: 'charcoal wide trousers',
  }),
];

// ---------------------------------------------------------------------------
// The sections
// ---------------------------------------------------------------------------

/** The screen's own composition, run over fixture data rather than a query. */
export function sectionsFor(
  lines: readonly ActivityLine[],
  legacy: readonly LegacyLine[] = [],
): MergedSection[] {
  // A legacy row is unseen when it is newer than the surface-wide stamp; six
  // hours back puts the borrow request under `New` and the return under
  // `Earlier`, which is the interleaving the mixed frame draws.
  return mergeLegacy(buildSections(lines, NOW), legacy, new Date(NOW.getTime() - 6 * HOUR).toISOString(), NOW);
}

export const POPULATED = sectionsFor(MIXED_LINES, LEGACY_LINES);
export const SEEN_ONLY = sectionsFor(SEEN_LINES);
export const EDGES = sectionsFor(EDGE_LINES);

// ---------------------------------------------------------------------------
// The poser
// ---------------------------------------------------------------------------

/**
 * One `ActivityBody` with the handlers stubbed and the real components under
 * it, so a frame is a screenshot of the shipping page and not of a copy.
 *
 * The write handlers are deliberately inert: a fixture that could accept an
 * invitation would be a fixture that writes to somebody's `circle_members`.
 */
export function AvFrame(props: Partial<ActivityBodyProps> & { status?: ActivityBodyProps['status'] }) {
  const router = useRouter();

  return (
    <ActivityBody
      status="ready"
      sections={POPULATED}
      onBack={() => router.back()}
      onRetry={() => {}}
      {...props}
    />
  );
}

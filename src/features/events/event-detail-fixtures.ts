import type { EventDetailView } from '@/components/events/event-detail-body';

import {
  EVENT_DETAIL_COPY,
  emptyLookBody,
  heroTone,
  logisticsLine,
  posterLine,
  posterLinesAx,
  rosterChips,
} from './event-detail-spec';

/**
 * The six accepted frames of Event Detail, posed inert. Redesign 03.
 *
 * Every callback is a no-op, so these routes cannot answer an invitation,
 * cancel an occasion or remove a guest however hard they are tapped. That seam
 * is what lets the frames be walked and photographed against the artifact
 * without a session, a network, or a single row on the other end.
 *
 * ── WHY THE FACTS ARE THE ARTIFACT'S OWN ──────────────────────────────────
 *
 * "Alexandria's birthday dinner at Contramar", Saturday 12 September, Priya
 * and Marisol and Theo and Alexandria and two more. A fixture invented from
 * `new Date()` or from a placeholder name could not be compared to the PNG at
 * all, which is the only thing acceptance does with it. These are literals on
 * purpose and they are the only place in this slice where one appears; the
 * route's facts all come from the server.
 *
 * ── WHAT IS NOT FAKED ─────────────────────────────────────────────────────
 *
 * The lines. `posterLine`, `logisticsLine`, `rosterChips` and `emptyLookBody`
 * are the REAL functions the route calls, given the artifact's inputs — so a
 * frame cannot drift from the product by having its sentences typed out here.
 * If the spec changes, these six pictures change with it.
 */

const NOOP = () => {};

const BASE = {
  onBack: NOOP,
  onMenu: NOOP,
  onRsvp: NOOP,
  onRetry: NOOP,
  onComments: NOOP,
  onChangeLook: NOOP,
  onPlanLook: null,
  notice: null,
} as const;

/** The artifact's roster, in `useEventMembers`' own row shape. */
const CONTRAMAR_MEMBERS = [
  { userId: 'u-priya', state: 'joined', role: 'member', displayName: 'Priya', username: 'priya' },
  { userId: 'u-marisol', state: 'joined', role: 'member', displayName: 'Marisol', username: 'marisol' },
  { userId: 'u-theo', state: 'joined', role: 'member', displayName: 'Theo', username: 'theo' },
  { userId: 'u-alex', state: 'joined', role: 'host', displayName: 'Alexandria', username: 'alex' },
  { userId: 'u-nina', state: 'joined', role: 'member', displayName: 'Nina', username: 'nina' },
  { userId: 'u-sam', state: 'joined', role: 'member', displayName: 'Sam', username: 'sam' },
] as const;

/** The rehearsal dinner, where only the host has answered. */
const REHEARSAL_MEMBERS = [
  { userId: 'u-theo', state: 'joined', role: 'host', displayName: 'Theo', username: 'theo' },
] as const;

const CONTRAMAR_LINE_INPUT = {
  venueName: 'Contramar',
  dateLine: 'Sat 12 Sep · 8:30 pm',
};

const REHEARSAL_LINE_INPUT = {
  venueName: null,
  dateLine: 'Fri 26 Sep',
};

/**
 * The plate's three wells, with no photographs behind them.
 *
 * `uri: undefined` is not a shortcut — it is what `GarmentImage` is handed for
 * a garment whose picture has not been signed yet, and it draws the same warm
 * grey the artifact's placeholder tiles do. So the fixture photographs the
 * real empty-well treatment rather than an imitation of it.
 */
const TILES = [{ uri: undefined }, { uri: undefined }, { uri: undefined }];

const contramarChips = rosterChips(CONTRAMAR_MEMBERS, { isHost: false, me: null });
const rehearsalChips = rosterChips(REHEARSAL_MEMBERS, { isHost: false, me: null });

/** 01 · Default — going, look planned. */
const DEFAULT_VIEW: EventDetailView = {
  ...BASE,
  loading: false,
  tone: heroTone(CONTRAMAR_LINE_INPUT),
  title: 'Alexandria’s birthday dinner at Contramar',
  line: posterLine(CONTRAMAR_LINE_INPUT),
  linesAx: posterLinesAx(CONTRAMAR_LINE_INPUT),
  plate: { kind: 'ready', tiles: TILES, label: 'Silk slip dress' },
  empty: null,
  chips: contramarChips.chips,
  overflow: contramarChips.overflow,
  noReplies: false,
  logistics: logisticsLine({
    venueAddress: 'Calle Durango 200',
    note: 'table under Priya · bringing the gift',
  }),
  rsvp: { standing: 'going', busy: false },
  failed: false,
  commentCount: 6,
};

/** 02 · Empty — no look, no replies yet. */
const EMPTY_VIEW: EventDetailView = {
  ...BASE,
  loading: false,
  tone: heroTone(REHEARSAL_LINE_INPUT),
  title: 'Marisol & Theo’s rehearsal dinner',
  line: posterLine(REHEARSAL_LINE_INPUT),
  linesAx: posterLinesAx(REHEARSAL_LINE_INPUT),
  plate: { kind: 'empty' },
  // Nothing to change until there is something chosen; the foot offers the
  // planning instead, which is where the frame moves the oxblood.
  onChangeLook: null,
  empty: {
    title: EVENT_DETAIL_COPY.emptyLookTitle,
    body: emptyLookBody({ isMember: true, hostName: 'Theo', venueKnown: false }),
  },
  chips: rehearsalChips.chips,
  overflow: rehearsalChips.overflow,
  noReplies: true,
  logistics: null,
  rsvp: { standing: null, busy: false },
  failed: false,
  onPlanLook: NOOP,
  commentCount: null,
};

/** 03 · Loading — the band paints from the cached name, the rest waits. */
const LOADING_VIEW: EventDetailView = {
  ...BASE,
  loading: true,
  tone: 'accent',
  title: 'Alexandria’s birthday dinner at Contramar',
  line: '',
  linesAx: [],
  plate: { kind: 'loading' },
  onChangeLook: null,
  empty: null,
  chips: [],
  overflow: null,
  noReplies: false,
  logistics: null,
  rsvp: null,
  failed: false,
  commentCount: null,
};

/** 04 · Error — the reply didn’t send. The poster is intact behind it. */
const ERROR_VIEW: EventDetailView = {
  ...DEFAULT_VIEW,
  plate: { kind: 'ready', tiles: TILES, label: null },
  logistics: null,
  rsvp: { standing: null, busy: false },
  failed: true,
  commentCount: null,
};

/** 06 · Largest accessibility text. The same facts; the body recomposes. */
const AX_VIEW: EventDetailView = {
  ...DEFAULT_VIEW,
  chips: rosterChips(
    [
      { userId: 'u-priya', state: 'joined', role: 'member', displayName: 'Priya Raghunathan', username: 'priya' },
      {
        userId: 'u-marisol',
        state: 'joined',
        role: 'member',
        displayName: 'Marisol Delgado-Whitcomb',
        username: 'marisol',
      },
    ],
    { isHost: false, me: null },
  ).chips,
  overflow: null,
  plate: { kind: 'ready', tiles: TILES, label: null },
};

export const EVENT_DETAIL_POSES = {
  '01-default': DEFAULT_VIEW,
  '02-empty': EMPTY_VIEW,
  '03-loading': LOADING_VIEW,
  '04-error': ERROR_VIEW,
  '06-ax': AX_VIEW,
} as const;

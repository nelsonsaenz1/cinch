import type { NewTripView } from '@/components/plan/new-trip-body';
import type { PackingPlateView } from '@/components/plan/packing-plate-body';

import { NEW_TRIP_COPY, plannedColophon, plateDayLabel, tripDatesLine } from './new-trip-spec';
import { TRIP_QUESTIONS } from './trip';

/**
 * The accepted frames, posed inert. Redesign 05.
 *
 * Every callback is a no-op, so these routes cannot search a geocoder, answer a
 * question, spend a placement or write a trip however hard they are tapped.
 * That seam is what lets the frames be walked and photographed against the
 * artifact without a session, a network, or a single row in `trips`.
 *
 * ── WHY THE PLATE'S WELLS ARE EMPTY ──────────────────────────────────────────
 *
 * `tiles` carries no `uri` in any pose. The photographs are private storage
 * objects behind signed URLs, so a fixture that showed real ones would need a
 * session — the exact dependency these files exist to remove — and a bundled
 * stand-in would be a garment nobody owns appearing in a screenshot of somebody
 * else's trip. What the frames are here to check is the GEOMETRY, and the wells
 * hold it whether or not a photograph arrives: that degradation is drawn on
 * purpose rather than by accident, and the tile COUNTS vary across the poses so
 * the short day sits on screen beside the full one.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * There is no paywall pose. The paywall frame is Superwall's own sheet,
 * configured in the dashboard and rendered by the SDK; this codebase does not
 * draw it and must not pretend to. What this repo owns at that moment is the
 * gate — `usePackingAccess`, which fails closed — and the locked plate that
 * carries the `packing_access` placement, both of which already have their
 * fixture at `/dev-packing-questions`.
 */

const noop = () => {};

const START = '2026-09-10';
const END = '2026-09-14';

const RECENTS = ['Copenhagen', 'Marfa', 'Lisbon', 'Mexico City'].map((name) => ({
  key: name,
  name,
  sub: null,
  onPick: noop,
}));

const MATCHES = [
  { key: 'mx', name: 'Mexico City', sub: 'Ciudad de México, Mexico' },
  { key: 'roma', name: 'Mexico City — Roma Norte', sub: 'Neighbourhood' },
  { key: 'mxli', name: 'Mexicali', sub: 'Baja California, Mexico' },
].map((m) => ({ ...m, onPick: noop }));

const chip = (key: string, label: string, selected: boolean) => ({
  key,
  label,
  selected,
  onToggle: noop,
});

/** 01 — the first card, untouched. "Next" is inactive because nothing is chosen. */
const EMPTY: NewTripView = {
  index: 0,
  total: 3,
  question: TRIP_QUESTIONS.destination,
  onBack: null,
  onClose: noop,
  ctaLabel: NEW_TRIP_COPY.next,
  ctaEnabled: false,
  onCta: noop,
  destination: { query: '', onQuery: noop, chosen: false, matches: [], recents: RECENTS },
  placeCard: null,
  shape: null,
};

/** 02 — mid-typing. The matches are up and "Next" rides with them. */
const KEYBOARD: NewTripView = {
  ...EMPTY,
  ctaEnabled: true,
  destination: { query: 'Mexico C', onQuery: noop, chosen: false, matches: MATCHES, recents: [] },
};

/**
 * 03 — the third card, the destination known.
 *
 * The weather mark is present because a climate band resolved for this pose;
 * the fourth pose below drops it, which is what a place whose archive read
 * failed actually looks like. Neither is a placeholder.
 */
const DEFAULT: NewTripView = {
  index: 2,
  total: 3,
  question: TRIP_QUESTIONS.shape,
  onBack: noop,
  onClose: null,
  ctaLabel: NEW_TRIP_COPY.build,
  ctaEnabled: true,
  onCta: noop,
  destination: null,
  placeCard: {
    name: 'Mexico City',
    dates: tripDatesLine(START, END),
    mark: '24° / 15°',
  },
  shape: {
    purposes: [
      chip('warm-city', 'Warm city', true),
      chip('long-dinners', 'Long dinners', true),
      chip('walking', 'A lot of walking', true),
      chip('work', 'Work', false),
      chip('beach', 'Beach', false),
      chip('wedding', 'Wedding', false),
    ],
    companions: [
      chip('solo', 'On my own', false),
      chip('partner', 'With my partner', true),
      chip('friends', 'With friends', false),
      chip('family', 'With family', false),
      chip('work-c', 'With colleagues', false),
    ],
    parts: [
      chip('daytime', 'Daytime', true),
      chip('evening', 'Evening', true),
      chip('gym', 'Gym', false),
      chip('travel', 'Travel days', false),
    ],
    // An account with no friends yet — the common case, and the row is absent
    // rather than drawn empty.
    friends: [],
    arithmetic: 'Two day parts across five days is ten looks.',
  },
};

export const NEW_TRIP_POSES: Record<string, NewTripView> = {
  '01-empty': EMPTY,
  '02-keyboard': KEYBOARD,
  '03-default': DEFAULT,
};

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

const DAYS = 5;

const PLATE_DAYS = [
  { dayIndex: 0, date: START, caption: '24° · travel day', tiles: 3 },
  { dayIndex: 2, date: '2026-09-12', caption: '26°', tiles: 3 },
  // The short day, kept in the poses on purpose: it is what proves the third
  // well keeps its ground rather than the row changing shape.
  { dayIndex: 4, date: END, caption: '21° · travel day', tiles: 1 },
].map((d) => ({
  key: String(d.dayIndex),
  label: plateDayLabel(d.date, d.dayIndex, DAYS),
  caption: d.caption,
  tiles: Array.from({ length: d.tiles }, () => ({})),
}));

export const PACKING_PLATE_POSES: Record<string, PackingPlateView> = {
  /** 04 — the plate arriving. Just over half the four reads have landed. */
  '04-loading': {
    state: 'building',
    destination: 'Mexico City',
    colophon: tripDatesLine(START, END),
    progress: 0.5,
  },
  /** 05 — the read that failed, with the answers preserved and shown. */
  '05-error': {
    state: 'failed',
    answers: [
      { key: NEW_TRIP_COPY.answerWhere, value: 'Mexico City' },
      { key: NEW_TRIP_COPY.answerWhen, value: tripDatesLine(START, END) },
      { key: NEW_TRIP_COPY.answerWhat, value: 'Warm city, long dinners, a lot of walking' },
    ],
    onRetry: noop,
    retrying: false,
    onSaveAndFinishLater: noop,
  },
  /** 06 — "Trip planned", and two clear ways out. */
  '06-planned': {
    state: 'planned',
    destination: 'Mexico City',
    colophon: plannedColophon(START, END, '24°/15°'),
    days: PLATE_DAYS,
    onSeeThisTrip: noop,
    onAllTrips: noop,
    onSwapDay: noop,
    onShare: noop,
  },
};

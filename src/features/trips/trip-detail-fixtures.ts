import type {
  DetailGroup,
  TripDetailBody,
  TripDetailView,
} from '@/components/trips/trip-detail-body';

import { emptyBody, isFullyPacked, packingProgress } from './trip-detail-spec';

/**
 * The nine accepted frames, posed inert. Redesign 06.
 *
 * Every callback is a no-op, so these routes cannot tick a piece, write a note,
 * re-plan or delete a thing however hard they are tapped. That seam is what lets
 * the frames be walked and photographed against the artifact without a session,
 * a network, or a single row in `trips`.
 *
 * ── WHY THE TILES CARRY NO PHOTOGRAPH ────────────────────────────────────────
 *
 * No `uri` in any pose. The photographs are private storage objects behind
 * signed URLs, so a fixture that showed real ones would need a session — the
 * exact dependency these files exist to remove — and a bundled stand-in would
 * be a garment nobody owns appearing in a screenshot of somebody's own trip.
 * What the frames are here to check is the GEOMETRY and the state machine, and
 * the wells hold both whether or not a photograph arrives.
 *
 * The NAMES are real strings because they are the thing the AX frame moves out
 * of the tile and sets at 21pt, and a pose with blank labels would draw that
 * recomposition as an empty column.
 *
 * ── WHY THE PROGRESS IS DERIVED AND NOT TYPED ────────────────────────────────
 *
 * `packingProgress` computes every pose's count from that pose's own tiles.
 * Typing "6 of 9" beside six ticked tiles would let the fixture disagree with
 * the arithmetic the page ships, which is precisely the drift a posed frame is
 * supposed to catch.
 */

const NOOP = () => {};

const piece = (id: string, name: string, checked = false) => ({ id, name, checked });

/** Nine pieces over three days, six of them ticked in the mid-pack poses. */
const DAYS: { key: string; label: string; caption: string | null; names: string[] }[] = [
  {
    key: '0',
    label: 'Thu 10 · arrival',
    caption: 'travel day · 75°',
    names: ['Linen shirt', 'Wide trousers', 'Loafers'],
  },
  {
    key: '2',
    label: 'Sat 12',
    caption: '78°',
    names: ['Silk slip dress', 'Gold heels', 'Beaded clutch'],
  },
  {
    key: '4',
    label: 'Mon 14 · home',
    caption: 'travel day · 71°',
    names: ['Cotton tee', 'Denim jacket', 'White sneakers'],
  },
];

function groups(checkedCount: number): DetailGroup[] {
  let remaining = checkedCount;
  return DAYS.map((day) => ({
    key: day.key,
    label: day.label,
    caption: day.caption,
    tiles: day.names.map((name, i) => {
      const on = remaining > 0;
      if (on) remaining -= 1;
      return piece(`${day.key}-${i}-${name.toLowerCase().replace(/\s+/g, '-')}`, name, on);
    }),
  }));
}

function allIds(list: DetailGroup[]): string[] {
  return list.flatMap((g) => g.tiles.map((t) => t.id));
}

function checkedIds(list: DetailGroup[]): string[] {
  return list.flatMap((g) => g.tiles.filter((t) => t.checked).map((t) => t.id));
}

function plate({
  checkedCount,
  note = '',
  noteFocused = false,
}: {
  checkedCount: number;
  note?: string;
  noteFocused?: boolean;
}): Extract<TripDetailBody, { state: 'plate' }> {
  const list = groups(checkedCount);
  const progress = packingProgress(allIds(list), checkedIds(list));

  return {
    state: 'plate',
    destination: 'Mexico City',
    dates: '10–14 Sep · 4 nights',
    mark: '75° / 59°',
    groups: list,
    progress,
    complete: isFullyPacked(progress),
    note,
    noteFocused,
    onToggle: NOOP,
    onNoteChange: NOOP,
    onNoteFocus: NOOP,
    onNoteBlur: NOOP,
    onReplan: NOOP,
    onSeeTheWeek: NOOP,
  };
}

function page(body: TripDetailBody, deleteOpen = false): TripDetailView {
  return {
    onBack: NOOP,
    // Loading and offline withhold it, matching their frames.
    onMore: body.state === 'loading' || body.state === 'error' ? null : NOOP,
    deleteOpen,
    deleting: false,
    onRequestDelete: NOOP,
    onCancelDelete: NOOP,
    onConfirmDelete: NOOP,
    body,
  };
}

export const TRIP_DETAIL_POSES = {
  '01-default': page(plate({ checkedCount: 0 })),
  '02-progress': page(
    plate({ checkedCount: 6, note: 'Gift for Alexandria goes in the carry-on' }),
  ),
  '03-complete': page(plate({ checkedCount: 9 })),
  '04-keyboard': page(
    plate({
      checkedCount: 6,
      note: 'Gift for Alexandria goes in the carry-on, dress bagged',
      noteFocused: true,
    }),
  ),
  '05-empty': page({
    state: 'empty',
    destination: 'Lisbon',
    dates: '2–8 Nov · 6 nights',
    mark: '63° / 52°',
    body: emptyBody(6),
    onBuild: NOOP,
  }),
  '06-loading': page({ state: 'loading', destination: 'Mexico City' }),
  '07-error': page({
    state: 'error',
    destination: 'Mexico City',
    dates: '10–14 Sep · 4 nights',
    ticked: 6,
    onRetry: NOOP,
    onAllTrips: NOOP,
  }),
  '08-delete': page(plate({ checkedCount: 6 }), true),
  // The AX pose is the mid-pack plate; the fixture route is what passes
  // `large`, so the same view object draws both compositions and the frames
  // cannot drift apart in the pose.
  '09-ax': page(plate({ checkedCount: 6 })),
} as const satisfies Record<string, TripDetailView>;

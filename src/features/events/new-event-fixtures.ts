import type { NewEventView } from '@/components/events/new-event-body';

/**
 * The six accepted New Event frames, posed. Redesign 02, 2026-08-17.
 *
 * INERT BY CONSTRUCTION. Every callback here is a no-op, so `dev-ne-01…06` can
 * be walked, screenshotted and diffed against
 * `design-refs/redesign-2026-08/02-new-event/` without a session, a network
 * call, or one writable row on the other end — the same seam
 * `PEOPLE_SEARCH_POSES` uses, and the reason a drawn state in this repo is one
 * somebody has actually looked at.
 *
 * The fixture data is the artifact's own, deliberately awkward: a name long
 * enough to wrap to two lines at standard size and to three at AX3, and one
 * containing `g`, `y`, `p` and `j` descenders — this is the page with a
 * clipping history, and a fixture of "Dinner" would photograph beautifully and
 * prove nothing.
 */

const NAME = 'Alexandria’s birthday dinner at Contramar';

/** Saturday 12 September. A fixed calendar date, not `new Date()`: a fixture
 *  whose value moves cannot be diffed against a frame. */
const DAY = new Date(2027, 8, 12);
/** 8:30 pm, as minutes from midnight. */
const MINUTES = 20 * 60 + 30;

const GUESTS = [
  'Priya Raghunathan',
  'Marisol Delgado-Whitcomb',
  'Theo Okonkwo-Bassey',
  'Ines Barrantes',
  'Joaquín Perez-Lyle',
];

const IDLE: NewEventView = {
  name: '',
  onChangeName: () => {},
  onCancel: () => {},

  day: null,
  onPickDate: () => {},
  minutes: null,
  onPickTime: () => {},

  venueName: '',
  venueAddress: null,
  onPickVenue: () => {},

  guestNames: [],
  onPickGuests: () => {},

  note: '',
  onEditNote: () => {},

  onCreate: () => {},
  pending: false,
  error: null,
};

function pose(over: Partial<NewEventView>): NewEventView {
  return { ...IDLE, ...over };
}

/** Everything answered — the frame the artifact calls "02 · Default". */
const ANSWERED: Partial<NewEventView> = {
  name: NAME,
  day: DAY,
  minutes: MINUTES,
  venueName: 'Contramar',
  venueAddress: 'Calle Durango 200',
  guestNames: GUESTS,
  note: 'Bringing the gift — nobody wear jeans.',
};

export const NEW_EVENT_POSES = {
  /** 01 — answered. Five rows filled, CTA live. */
  '01-default': pose(ANSWERED),

  /** 02 — naming. The serif is being typed into; only the rows not yet
   *  answered are on screen, and the CTA rides above the keyboard. */
  '02-keyboard': pose({ name: 'Alexandria’s birthday dinner at Contra' }),

  /** 03 — a fresh sheet. Nothing answered, CTA inactive. */
  '03-empty': pose({}),

  /** 04 — creating. The sheet holds its shape, the rows dim, the CTA becomes
   *  a clay fill. No copy is added. */
  '04-loading': pose({ ...ANSWERED, note: '', pending: true }),

  /** 05 — the create failed. Every entry still on screen, the draft still on
   *  disk, and the CTA says so. */
  '05-error': pose({
    ...ANSWERED,
    note: '',
    error: 'Your draft is saved on this device.',
  }),

  /** 06 — the same answered sheet, for the largest accessibility text. The
   *  route reads the real `fontScale`; this pose only supplies the words. */
  '06-ax': pose(ANSWERED),
} as const;

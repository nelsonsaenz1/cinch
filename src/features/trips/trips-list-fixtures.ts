import type { TripsListView } from '@/components/trips/trips-list-body';

import { TRIPS_COPY } from './trips-list-spec';

/**
 * The five accepted frames, posed inert. Redesign 04.
 *
 * Every callback is a no-op, so these routes cannot plan a trip, open one or
 * retry a query however hard they are tapped. That seam is what lets the five
 * frames be walked and photographed against the artifact without a session, a
 * network, or a single row in `trips`.
 *
 * ── WHY THE COLLAGES ARE EMPTY ───────────────────────────────────────────────
 *
 * `tiles` carries no `uri` in any pose. The photographs are private storage
 * objects behind signed URLs, so a fixture that showed real ones would need a
 * session — the exact dependency these files exist to remove — and a bundled
 * stand-in would be a garment nobody owns appearing in a screenshot of their
 * own trips. What the frames are here to check is the GEOMETRY, and the wells
 * hold it whether or not a photograph arrives: that is the degradation the
 * brief asks for, drawn on purpose rather than by accident.
 *
 * The tile COUNTS are the interesting part and they vary on purpose — three,
 * four, two and one across the poses, so the graceful-degradation case is on
 * screen next to the full one rather than described in a comment.
 */

const IDLE: TripsListView = {
  loading: false,
  offline: false,
  next: {
    id: 'tl-mexico-city',
    destination: 'Mexico City',
    dates: '10–14 Sep · 4 nights',
    packed: true,
    tiles: [{}, {}, {}],
  },
  upcoming: [
    {
      id: 'tl-lisbon',
      destination: 'Lisbon',
      dates: '2–8 Nov · 6 nights',
      packed: true,
      tiles: [{}, {}, {}, {}],
    },
    {
      id: 'tl-whistler',
      // The long one, kept in the poses on purpose: it is what proves the
      // serif truncates on the shelf card and wraps above the threshold.
      destination: 'Whistler with Marisol',
      dates: '18–22 Dec · 4 nights',
      packed: false,
      tiles: [{}, {}],
    },
  ],
  past: [
    { id: 'tl-copenhagen', destination: 'Copenhagen', dates: 'May 2026 · 5 nights', tile: {} },
    { id: 'tl-marfa', destination: 'Marfa, Texas', dates: 'March 2026 · 3 nights', tile: {} },
  ],
  laterLabel: TRIPS_COPY.laterThisYear,
  onBack: () => {},
  onPlanTrip: () => {},
  onRetry: () => {},
  // The chevron and the press, drawn as the artifact draws them. The SHIPPED
  // route passes null until Trip Detail exists — see the note on the prop.
  onOpenTrip: () => {},
};

const pose = (over: Partial<TripsListView>): TripsListView => ({ ...IDLE, ...over });

export const TRIPS_LIST_POSES = {
  '01-default': pose({}),
  '02-empty': pose({ next: null, upcoming: [], past: [] }),
  '03-loading': pose({ loading: true }),
  '04-error': pose({ offline: true, past: [] }),
  '05-ax': pose({ past: [] }),
} as const;

export type TripsListPose = keyof typeof TRIPS_LIST_POSES;

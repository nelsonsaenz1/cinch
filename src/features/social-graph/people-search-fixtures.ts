import type { PeopleRow, PeopleSearchView } from '@/components/social/people-search-body';

/**
 * The six accepted People Search frames, posed. Redesign 09, 2026-08-17.
 *
 * INERT BY CONSTRUCTION. Every callback here is a no-op, so `dev-ps-01…06`
 * can be walked, screenshotted and diffed without a session, a network call,
 * or one writable row on the other end — the same seam `CPV2_POSES` and the
 * friend-closet fixtures already use, and the reason a drawn state in this
 * repo is one somebody has actually looked at.
 *
 * The names are the artifact's own: deliberately long, hyphenated and
 * diacritic-free-but-awkward, because the defect this redesign closes only
 * appears when a name is longer than the column it was given. A fixture set
 * of "Ana Lee" would photograph beautifully and prove nothing.
 */

const person = (
  userId: string,
  displayName: string,
  username: string,
  state: PeopleRow['state'],
): PeopleRow => ({
  userId,
  username,
  displayName,
  avatarUrl: null,
  bio: null,
  state,
});

/** The RECENT list at rest — people already in the circle. */
export const RECENT_FIXTURE: PeopleRow[] = [
  person('r1', 'Priya Raghunathan', 'priyar', 'friends'),
  person('r2', 'Marisol Delgado-Whitcomb', 'marisold', 'friends'),
  person('r3', 'Theo Okonkwo-Bassey', 'theook', 'friends'),
];

/** Four live answers to "alex" — the long-name stress the frame specifies. */
export const RESULTS_FIXTURE: PeopleRow[] = [
  person('s1', 'Alexandria Fitzgerald-Moreau', 'alexfm', 'add'),
  person('s2', 'Alex Nakamura-Reyes', 'alexnr', 'add'),
  person('s3', 'Alexa Thibodeaux', 'alexathib', 'add'),
  person('s4', 'Alejandro Villanueva-Cruz', 'alevc', 'add'),
];

const IDLE: PeopleSearchView = {
  query: '',
  onChangeQuery: () => {},
  onCancel: () => {},
  // The frames read "cinch.app/priya". Both halves are fixture — the app's
  // real host is `cinchstyle.com` and the handle belongs to whoever is signed
  // in — so the pose carries a handle and lets `shareSubtitle` derive the
  // line exactly as the shipped screen does.
  shareHandle: 'priya',
  onShare: () => {},
  results: [],
  recent: [],
  loading: false,
  error: null,
  onRetry: () => {},
  onOpenProfile: () => {},
  onAdd: () => {},
  adding: false,
  autoFocus: false,
};

function pose(over: Partial<PeopleSearchView>): PeopleSearchView {
  return { ...IDLE, ...over };
}

/** A transport failure, shaped the way `fetch` actually rejects. */
export const OFFLINE_ERROR = new TypeError('Network request failed');

export const PEOPLE_SEARCH_POSES = {
  /** 01 — at rest. Field empty, two invite rows, recent searches. */
  '01-default': pose({ recent: RECENT_FIXTURE }),

  /** 02 — "alex". Four results, invite rows gone, keyboard up. */
  '02-keyboard': pose({ query: 'alex', results: RESULTS_FIXTURE, autoFocus: true }),

  /** 03 — "alexndria.f". No one by that username; one way out, offered once. */
  '03-empty': pose({ query: 'alexndria.f', results: [], autoFocus: true }),

  /** 04 — waiting. Three skeleton rows, no spinner. */
  '04-loading': pose({ query: 'alex', loading: true, autoFocus: true }),

  /** 05 — the search that did not go out. Nothing was changed. */
  '05-error': pose({ query: 'alex', error: OFFLINE_ERROR }),

  /** 06 — the same page at the largest accessibility text size. */
  '06-ax': pose({ recent: RECENT_FIXTURE }),
} as const;

export type PeopleSearchPose = keyof typeof PEOPLE_SEARCH_POSES;

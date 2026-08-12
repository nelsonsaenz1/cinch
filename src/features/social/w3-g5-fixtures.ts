import type { RequestRowModel } from '@/components/social/friends-page';
import type { SocialProfile } from '@/features/social-graph/types';

/**
 * The people Wave 3 · Group 5's social frames are drawn from.
 *
 * `.ts` and free of React, so the fixture routes stay layout-free and the
 * acceptance tests can read the same names the frames do.
 *
 * EVERY FIELD HERE EXISTS IN THE READ PATH. `SocialProfile` is exactly what
 * `fetchProfiles` selects — `user_id, username, display_name, avatar_url, bio`
 * — so a fixture cannot accidentally pose a field the app could never fetch.
 * That is the point of building them from the domain type rather than from a
 * loose object: correction 23's rule is enforced by the compiler here.
 *
 * No avatar URLs: every fixture face is initials on sand. A frame that has to
 * reach the network to draw itself cannot reproduce its own bytes.
 */

const person = (
  userId: string,
  displayName: string,
  username: string,
  bio: string | null = null,
): SocialProfile => ({ userId, displayName, username, avatarUrl: null, bio });

/** Fixed, so "asked 2 days ago" is spoken the same way on every run. */
export const FR_NOW = new Date('2026-08-12T09:41:00');

export const PRIYA = person('u-priya', 'Priya Raghunathan', 'priyar');

/**
 * The long-name stress case, in situ — 24 characters of name over a
 * 22-character handle. Drawn on the page rather than in a frame of its own,
 * because a collision only happens next to a real action.
 */
export const MARGUERITE = person(
  'u-marguerite',
  'Marguerite Okonkwo-Bell',
  'margueriteokonkwobell',
);

export const ANA = person('u-ana', 'Ana Beltrán', 'anab', 'Vintage denim, mostly');
export const JONAS = person('u-jonas', 'Jonas Weber', 'jweber');
export const SARAH = person('u-sarah', 'Sarah Lindqvist', 'slind');
export const TOMAS = person('u-tomas', 'Tomás Silva', 'tsilva');

export const FR_REQUESTS: RequestRowModel[] = [
  { profile: PRIYA, requestedAt: '2026-08-10T09:00:00', state: 'waiting' },
  { profile: MARGUERITE, requestedAt: '2026-08-05T09:00:00', state: 'waiting' },
];

/**
 * Eighteen friends, so the masthead's count is a real count of this list.
 *
 * The first four are named; the rest are the same anatomy repeated, which is
 * what makes the seven-rows-in-a-viewport claim checkable by scrolling rather
 * than by arithmetic.
 */
export const FR_FRIENDS: SocialProfile[] = [
  ANA,
  JONAS,
  SARAH,
  TOMAS,
  ...[
    ['Bea Lindgren', 'bealind'],
    ['Clara Nwosu', 'claranw'],
    ['Dana Kerr', 'dkerr'],
    ['Elif Demir', 'elifd'],
    ['Frida Holm', 'fridah'],
    ['Greta Sandoval', 'gretas'],
    ['Hana Ito', 'hanaito'],
    ['Iris Vance', 'irisv'],
    ['Juno Park', 'junop'],
    ['Kaya Mbeki', 'kayam'],
    ['Lena Ruiz', 'lenar'],
    ['Mira Adeyemi', 'miraa'],
    ['Nora Lindqvist', 'noral'],
    ['Ottoline Grey', 'ottog'],
  ].map(([name, handle]) => person(`u-${handle}`, name!, handle!)),
];

/** FR-02's failed-accept row — the same person, mid-failure. */
export const FR_FAILED: RequestRowModel[] = [
  { profile: PRIYA, requestedAt: '2026-08-10T09:00:00', state: 'failed' },
];

/** FR-02's set-aside row, with its undo still live. */
export const FR_SET_ASIDE: RequestRowModel[] = [
  { profile: MARGUERITE, requestedAt: '2026-08-05T09:00:00', state: 'dismissed' },
];

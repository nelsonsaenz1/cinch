import type { BlockedUser } from './types';

/**
 * The three blocked people SF-01/02/03 are drawn against, and the clock they
 * are drawn at.
 *
 * `blockedWhen()` takes `now` as a parameter for exactly this: a fixture that
 * read the system clock would print "Blocked in June" until next June and then
 * silently start printing a year, so the frame would stop being the frame
 * somebody reviewed. Pinned, so every run renders identical pixels.
 *
 * The second row has NO display name, which is the atlas's second row: it falls
 * back to the handle. The third is inside the fortnight, so it exercises the
 * relative branch rather than the month one.
 */
export const G6_NOW = new Date('2026-08-12T12:00:00Z');

export const G6_BLOCKED: BlockedUser[] = [
  {
    userId: 'u-daniel',
    blockedAt: '2026-06-14T09:00:00Z',
    profile: {
      userId: 'u-daniel',
      username: 'dokafor',
      displayName: 'Daniel Okafor',
      // Never rendered — `BlockedRow` passes `imageUri={null}` unconditionally,
      // and this value is here to prove it: a blocked person's photograph does
      // not belong on this screen even when the hydrated profile carries one.
      avatarUrl: 'https://example.com/never-used.jpg',
      bio: null,
    },
  },
  {
    userId: 'u-lmartel',
    blockedAt: '2026-04-02T09:00:00Z',
    profile: {
      userId: 'u-lmartel',
      username: 'lmartel',
      displayName: null,
      avatarUrl: null,
      bio: null,
    },
  },
  {
    userId: 'u-katherine',
    blockedAt: '2026-08-04T09:00:00Z',
    profile: {
      userId: 'u-katherine',
      username: 'kvr',
      displayName: 'Katherine Villanueva-Ross',
      avatarUrl: null,
      bio: null,
    },
  },
];

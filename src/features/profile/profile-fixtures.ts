import type {
  ClosetTile,
  FavoriteTile,
  ProfileView,
  RailTile,
} from '@/components/profile/profile-body';

import { PROFILE_COPY, statMarks } from '@/features/profile/profile-spec';

/**
 * Profile — the six accepted frames, posed inert. Redesign 07.
 *
 * The artifact's own data, to the letter, so a fixture route and the frame can
 * be photographed side by side: Priya Raghunathan, `@priyar`, twelve friends,
 * the four most-worn pieces and the four kept looks it names.
 *
 * NO `uri` ON ANY TILE. Signed URLs need a session, and a bundled stand-in
 * would be a garment nobody owns — every well draws its documented fallback,
 * which is exactly what the artifact's grey placeholders are. Every callback is
 * a no-op, so these routes cannot open a paywall, a sheet or a page however
 * hard they are tapped.
 *
 * The plan door's numbers are the app's, not the frame's: the artifact writes a
 * 45-piece free ceiling and there is no such ceiling in `plans.ts`. The free
 * pose uses the real 10, because a fixture that teaches the wrong ceiling is
 * worse than no fixture.
 */

const MOST_WORN: RailTile[] = [
  { id: 'mw-1', name: 'Silk slip dress' },
  { id: 'mw-2', name: 'Wide trousers' },
  { id: 'mw-3', name: 'Linen shirt' },
  { id: 'mw-4', name: 'Gold heels' },
];

const FAVORITES: FavoriteTile[] = [
  { id: 'fav-1', name: 'Contramar dinner', pieceCount: 4, uris: [] },
  { id: 'fav-2', name: 'Sunday market', pieceCount: 3, uris: [] },
  { id: 'fav-3', name: 'Copenhagen day 3', pieceCount: 4, uris: [] },
  { id: 'fav-4', name: 'Rehearsal dinner', pieceCount: 3, uris: [] },
];

const CLOSET: ClosetTile[] = Array.from({ length: 8 }, (_, index) => ({
  id: `closet-${index + 1}`,
  name: `Piece ${index + 1}`,
}));

const IDLE: ProfileView = {
  state: 'ready',

  name: 'Priya Raghunathan',
  handle: '@priyar',
  avatarUrl: null,
  identityFailed: false,
  onRetryIdentity: () => {},
  friends: 12,
  onOpenFriends: () => {},

  menuOpen: false,
  onOpenMenu: () => {},
  onDismissMenu: () => {},
  onEditProfile: () => {},
  onOpenDiary: () => {},
  onOpenSettings: () => {},
  settingsLabel: 'Settings',
  onDone: () => {},

  mostWorn: MOST_WORN,
  favorites: FAVORITES,
  marks: statMarks({ pieces: 84, outfits: 31, avgCostPerWear: 4.1 }),
  learned: 'Still learning. So far you reach for navy and wear denim most weeks.',
  planDoor: {
    line: `Standard · 84 of 150 ${PROFILE_COPY.pieces.toLowerCase()}`,
    tone: 'quiet',
    action: null,
    fill: 84 / 150,
    route: 'manage',
  },
  planUnavailable: false,
  planUnavailableLine: 'Plans are unavailable right now.',
  onPlanDoor: () => {},
  closet: CLOSET,
  onOpenCloset: () => {},
  onOpenItem: () => {},
  onOpenFavorite: () => {},

  onRetry: () => {},
  onAddClothes: () => {},
};

const pose = (over: Partial<ProfileView>): ProfileView => ({ ...IDLE, ...over });

export const PROFILE_POSES = {
  '01-default': pose({}),
  /**
   * The free member's door. Two marks, not three — the artifact drops
   * cost-per-wear here and so does `statMarks`, because a closet this new has
   * few pieces carrying both a price and a wear.
   */
  '02-plan-free': pose({
    marks: statMarks({ pieces: 8, outfits: 9, avgCostPerWear: null }),
    planDoor: {
      line: 'Free · 8 of 10 pieces',
      tone: 'blush',
      action: PROFILE_COPY.upgrade,
      fill: 0.8,
      route: 'paywall',
    },
  }),
  '03-empty': pose({
    state: 'empty',
    friends: 0,
    mostWorn: [],
    favorites: [],
    marks: [],
    learned: null,
    planDoor: null,
    closet: [],
  }),
  '04-loading': pose({
    state: 'loading',
    mostWorn: [],
    favorites: [],
    marks: [],
    learned: null,
    planDoor: null,
    closet: [],
  }),
  '05-error': pose({
    state: 'error',
    mostWorn: [],
    favorites: [],
    marks: [],
    learned: null,
    planDoor: null,
  }),
  '06-ax': pose({}),
} as const;

export type ProfilePose = keyof typeof PROFILE_POSES;

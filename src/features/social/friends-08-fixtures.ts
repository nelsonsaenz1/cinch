import type { FriendsPageProps } from '@/components/social/friends-page';
import type { PresenceFact } from '@/features/social-graph/friends-presence';
import type { SocialProfile } from '@/features/social-graph/types';

/**
 * Friends — the accepted frames, posed inert. Redesign 08.
 *
 * The artifact's own people, so a fixture route and the frame can be
 * photographed side by side. Every callback is a no-op, so these routes cannot
 * accept a request, block anybody, open a paywall or send a report however hard
 * they are tapped.
 *
 * NO IMAGE PATH ON ANY PRESENCE FACT. A signed URL needs a session, and a
 * bundled stand-in would be a garment nobody owns — the wells draw their
 * documented sand ground, which is exactly what the artifact's grey placeholder
 * tiles are.
 */

const person = (id: string, displayName: string, username: string): SocialProfile => ({
  userId: id,
  username,
  displayName,
  avatarUrl: null,
  bio: null,
});

const PRIYA = person('f-priya', 'Priya Raman', 'priyar');
const SENA = person('f-sena', 'Sena Okonkwo', 'senao');
const TOMAS = person('f-tomas', 'Tomas Field', 'tomasf');
const MARA = person('f-mara', 'Mara Ellis', 'maraellis');
const JO = person('f-jo', 'Jo Bannerman', 'job');

const piece = (label: string): PresenceFact => ({
  kind: 'piece',
  label,
  thumbPath: null,
  cutoutPath: null,
  platePath: null,
});

/** Frame 08 — every friend has an authorized piece. */
export const PRESENCE_FULL: ReadonlyMap<string, PresenceFact> = new Map([
  [PRIYA.userId, piece('wool coat')],
  [SENA.userId, piece('linen shirt')],
  [TOMAS.userId, piece('grey knit')],
]);

/**
 * Frame 10 — two of these people revoked, expired or hid what was there.
 *
 * They are simply absent from the map. There is no third value meaning
 * "withheld", which is the whole point: the card cannot tell the reader that
 * anything changed.
 */
export const PRESENCE_PARTIAL: ReadonlyMap<string, PresenceFact> = new Map([
  [PRIYA.userId, piece('wool coat')],
  [SENA.userId, { kind: 'worn_today' }],
]);

const IDLE: FriendsPageProps = {
  query: '',
  onQueryChange: () => {},
  onBack: () => {},
  searchOpen: false,
  onSearchOpen: () => {},
  searching: false,

  searchLoading: false,
  searchError: false,
  searchRetrying: false,
  onRetrySearch: () => {},
  searchRows: [],
  onAddFromSearch: () => {},
  onAcceptFromSearch: () => {},
  onCancelAsk: () => {},
  searchPendingId: null,

  requests: [
    { profile: MARA, requestedAt: '2026-08-16T09:00:00.000Z', state: 'waiting' },
    { profile: JO, requestedAt: '2026-08-15T09:00:00.000Z', state: 'waiting' },
  ],
  requestsError: false,
  requestsRetrying: false,
  onRetryRequests: () => {},
  onAccept: () => {},
  onNotNow: () => {},
  onUndo: () => {},
  onRetryAccept: () => {},

  friends: [PRIYA, SENA, TOMAS],
  presence: PRESENCE_FULL,
  presenceWithheld: false,
  large: false,
  friendsLoading: false,
  friendsError: false,
  friendsRetrying: false,
  onRetryFriends: () => {},
  onOpenFriend: () => {},
  onOverflow: () => {},

  sent: [],

  showEmpty: false,
  canInvite: true,
  onInvite: () => {},

  refreshing: false,
  onRefresh: () => {},
};

const pose = (over: Partial<FriendsPageProps>): FriendsPageProps => ({ ...IDLE, ...over });

export const FRIENDS_08_POSES = {
  '01-default': pose({}),
  '02-resting': pose({ requests: [] }),
  '03-empty': pose({ requests: [], friends: [], presence: new Map(), showEmpty: true }),
  /** Frame 10 — presence gone, silently. Mara and Jo are names and nothing else. */
  '10-presence-revoked': pose({
    requests: [],
    friends: [PRIYA, MARA, JO, SENA],
    presence: PRESENCE_PARTIAL,
  }),
  /** Frame 14 — card-shaped skeletons, no invented copy and no count. */
  '14-loading': pose({ requests: [], friends: [], presence: new Map(), friendsLoading: true }),
  /** Frame 16 — the circle read failed with nothing cached. Never an empty circle. */
  '16-friends-failed': pose({ friends: [], presence: new Map(), friendsError: true }),
  /** Frame 17 — names from cache, every fact withheld, and the page says so. */
  '17-offline': pose({
    requests: [],
    friendsError: true,
    presenceWithheld: true,
  }),
  /** Frame 26 — cards go vertical; nothing is clamped. */
  '26-ax': pose({ large: true, friends: [PRIYA], presence: PRESENCE_FULL }),
} as const;

export type Friends08Pose = keyof typeof FRIENDS_08_POSES;

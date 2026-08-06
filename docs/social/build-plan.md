# Cinch Social — Build Plan and File Ownership Map

Four coder agents, **zero overlapping files**. Every file below has exactly one
owner; an agent MUST NOT create or edit a file outside its list. Where two
agents need the same seam, the seam has one owner and the interface is
pre-declared here (§5) so consumers can code against it before the owner
finishes. Companion doc: `docs/social/architecture.md` (the DDL, RLS matrix,
and grant lines Agent DB implements verbatim).

## 0. Ordering

```
Agent DB  ──────────────►  (migrations, tests, seam types)
        │
        ├──► Agent EVENTS   (independent of GRAPH and OUTFITS)
        ├──► Agent GRAPH    (independent of EVENTS and OUTFITS)
        │
        └──────► Agent OUTFITS-SOCIAL  (imports EVENTS hooks + GRAPH moderation seam)
```

- **DB first.** Its output is standalone (SQL compiles/tests via
  `npm run test:db` with no app code), and it writes the shared TypeScript
  seam file (`src/features/social/db-rows.ts`) **in its first commit**, before
  the migrations are even finished, so the other three can start immediately.
- **EVENTS and GRAPH run in parallel.** Neither imports the other. They
  compile independently: their only new dependencies are `db-rows.ts` and
  pre-existing modules (`@/lib/supabase`, `@/features/closet/use-image-urls`,
  `@/features/billing/*`, `@/components/ui/*`, `@/theme/*`).
- **OUTFITS-SOCIAL last** (or overlapped once the seam files exist on the
  branch): it imports EVENTS' hooks and GRAPH's moderation hook.
- **No compile-time import cycle between EVENTS and OUTFITS.** The event
  detail screen (EVENTS) does **not** import OUTFITS components; the outfit
  board and comments are their own expo-router routes under
  `src/app/event/[id]/`, and EVENTS links to them by **path string**
  (`router.push(\`/event/${id}/outfits\`)`). File-based routing is the
  decoupler — use it.

Type strategy: `src/types/database.ts` and
`supabase/functions/_shared/database.types.ts` are generated
(`npm run gen:types`) and owned by Agent DB, who regenerates them once
migrations are applied to the linked project. Until then, ALL app agents
import row types from the hand-written seam `src/features/social/db-rows.ts`
and cast at the query boundary (`.returns<FriendItemRow[]>()` /
`as unknown as X`), exactly the pattern documented in `src/lib/commands.ts`
for `rpc` calls that predate a regen. Do not fight the generated `Database`
type for tables it doesn't know yet.

---

## 1. Agent DB — schema, tests, types

**Creates**

| File | Contents |
|---|---|
| `src/features/social/db-rows.ts` | The shared row-type seam (§5.1). **Write this file first, verbatim from §5.1.** |
| `supabase/migrations/20260807100000_social_graph_blocks_borrow.sql` | architecture.md Migration A: `user_blocks`, `content_reports`, `blocked_between()`, `is_friend()`, `items.borrowable`, `borrow_requests` + triggers, grants |
| `supabase/migrations/20260807101000_events.sql` | Migration B: enums, `events`, `event_members`, membership helper functions, `handle_new_event`, transition trigger, `borrow_requests.event_id` FK, grants |
| `supabase/migrations/20260807102000_event_outfits_votes_comments.sql` | Migration C: `event_outfit_posts` (composite FK to `outfits(id,user_id)`), `event_outfit_votes`, `event_comments`, report→comment trigger, grants incl. `grant update (hidden)` |
| `supabase/migrations/20260807103000_social_views_grants_realtime_limits.sql` | Migration D: `social_profiles`, `friend_items`, `event_post_items`, `event_vote_counts` views (SELECT-only grants, authenticated only, `security_invoker = false` spelled out); un-park `public_*` view grants to authenticated; three storage policies; realtime publication; rate-limit + event-limit triggers |
| `supabase/tests/05_social_graph_boundary.sql` | per architecture.md §8 |
| `supabase/tests/06_event_boundary.sql` | per architecture.md §8 |
| `supabase/tests/07_social_storage.sql` | per architecture.md §8 |

**Edits**

| File | Change |
|---|---|
| `supabase/tests/03_storage_bucket.sql` | Consciously rewrite the one tripwire that flips: signed-in stranger now sees the public item's `thumb.jpg` (count 1), still zero `original.jpg`. Nothing else in 01–03 changes. |
| `src/types/database.ts` | Regenerate via `npm run gen:types` **after** migrations apply (final step). |
| `supabase/functions/_shared/database.types.ts` | Same regen, same command. |
| `src/features/billing/plans.ts` | Add `eventHosting` copy/number (free 2 · standard 15 · pro 100) mirroring `event_limit_for_plan()`, with the "change one, change the other" comment. (Billing copy lives here; no other agent touches billing files.) |

**Edge functions:** none. This slice needs no server code — venue data is
client-side, invites are inserts, moderation is triggers. `delete-account`
needs no change: every new table cascades from `auth.users`.

**Hard rules (restated from architecture.md §0):** never `to anon`; never a
write grant on any view; never `security_invoker = true` on projection views;
every grant an explicit line; EXECUTE revokes target `public, anon,
authenticated`; `(select auth.uid())` + per-command policies + policy-column
indexes throughout.

**Done when:** `supabase test db` passes all 7 files; `npm run gen:types` diff
committed; `db-rows.ts` matches §5.1 exactly.

---

## 2. Agent EVENTS — event lifecycle + calendar

**Creates**

| File | Contents |
|---|---|
| `src/features/events/types.ts` | Domain types (camelCase) + row→domain mappers (`toEvent`, `toEventMember`), mirroring `closet/queries.ts`'s `toItem` pattern. Exports per §5.2. |
| `src/features/events/queries.ts` | `useMyEvents`, `useEvent`, `useEventMembers`, `useEventInvites` (§5.2). Identity hydration via `social_profiles` view; joined via `event_members` + `events` under RLS. |
| `src/features/events/mutations.ts` | `useCreateEvent`, `useUpdateEvent`, `useCancelEvent`, `useInviteMember`, `useRespondToInvite` (joined/declined), `useLeaveEvent`, `useRemoveMember`. Plain inserts/updates — RLS + triggers are the authority. Handle errcodes: `54000` → "slow down", `check_violation` + `event_limit_reached` → upgrade sheet via `@/features/billing`. |
| `src/features/events/use-event-channel.ts` | The realtime seam (§5.2): one channel per focused event screen, `postgres_changes` on `event_outfit_votes` + `event_comments` filtered `event_id=eq.X`, handlers **invalidate** the query keys in §5.4. Subscribe on focus, remove on blur. |
| `src/features/events/venue-search.ts` | Device-local venue search (MapKit local search via a module in `modules/`, or graceful manual-entry fallback). Returns `{ name, address, meta }` snapshots for the event row. |
| `src/app/event/_layout.tsx` | Stack layout for the event group. |
| `src/app/event/new.tsx` | Create event: title, date/time, party size, occasion/dress code, visibility, venue search, reservation link. |
| `src/app/event/[id]/index.tsx` | Event detail: header, venue card (opens `reservation_url` via `Linking`), roster, RSVP state, **Link by path** to `./outfits` and `./comments` (no imports from event-outfits). Mounts `useEventChannel(id)`. |
| `src/app/event/[id]/invite.tsx` | Invite sheet: search `social_profiles`, insert invites. |
| `src/components/events/EventCard.tsx` | List cell for Plan tab + invites. |
| `src/components/events/RosterRow.tsx` | Member row w/ state chip. |
| `src/components/events/VenueCard.tsx` | Venue + reservation link. |

**Edits**

| File | Change |
|---|---|
| `src/app/(tabs)/plan.tsx` | Calendar integration: events on their dates alongside planned outfits (`useMyEvents`), invite badge, entry to `/event/new` and `/event/[id]`. |

**Imports (does not own):** `db-rows.ts` (DB), `useSignedUrls`/
`stableImageSource` from `@/features/closet/use-image-urls` (existing, no
edits), billing hooks, ui components, theme tokens.

**Done when:** create → invite → accept → detail renders live for two accounts;
compiles with OUTFITS and GRAPH absent.

---

## 3. Agent OUTFITS-SOCIAL — posting, voting, comments

**Creates**

| File | Contents |
|---|---|
| `src/features/event-outfits/types.ts` | Domain types + mappers for posts, votes, tallies, comments, post-items. |
| `src/features/event-outfits/queries.ts` | `useEventPosts(eventId)` (posts + `event_vote_counts` + `event_post_items`, composed into renderable looks), `useMyVote(eventId)`, `useEventComments(eventId, postId?)`. Query keys per §5.4 (must match — `useEventChannel` invalidates them). |
| `src/features/event-outfits/mutations.ts` | `usePostOutfit` (insert `event_outfit_posts` from an existing outfit id), `useDeletePost`, `useCastVote` (delete-then-insert per §2/Migration C — no update path), `useRetractVote`, `useAddComment`, `useDeleteComment`, `useHideComment` (host; updates `hidden` only). Errcode handling: `54000` rate-limit toast, `23505` on vote conflict → refetch-and-retry once, `22023` self-vote. |
| `src/app/event/[id]/outfits.tsx` | The outfit board: posted looks rendered from `event_post_items` (plate/cutout stack, Skia-composed like the existing Plate), vote pill w/ tally, winner treatment once `starts_at` passes, "post your look" CTA. |
| `src/app/event/[id]/post.tsx` | Pick one of MY outfits to post (reads own `outfits` via existing owner RLS — reuse `@/features/styling/queries` read paths, do not edit them), publication-to-audience notice (architecture.md §9.2), caption, submit. |
| `src/app/event/[id]/comments.tsx` | Comment thread (event-level and per-post), report/hide affordances. |
| `src/components/event-outfits/OutfitPostCard.tsx` | A posted look: garment stack, poster identity (from `social_profiles` via EVENTS' member data or its own query), vote state. |
| `src/components/event-outfits/VotePill.tsx` | Tally + cast/retract. |
| `src/components/event-outfits/CommentRow.tsx` | Body, author, report (via GRAPH's `useReportContent`), hidden state for author/host. |
| `src/components/event-outfits/PostComposer.tsx` | Caption + submit. |

**Imports (does not own):** `useEvent`, `useEventMembers`, `useEventChannel`,
`EventDetail`/`EventMember` from `@/features/events/*` (EVENTS);
`useReportContent`, `useBlockUser` from `@/features/social-graph/moderation`
(GRAPH); `db-rows.ts` (DB); `useSignedUrls` (existing).

**Done when:** two accounts in one event can post, vote (one vote per event,
switchable), comment, report→auto-hide at 3, host-hide; votes/comments move
live via the EVENTS channel with the screen open.

---

## 4. Agent GRAPH — follows, friends, friend closets, borrowing

**Creates**

| File | Contents |
|---|---|
| `src/features/social-graph/types.ts` | Domain types + mappers: `SocialProfile`, `FriendItem`, `BorrowRequest`. |
| `src/features/social-graph/queries.ts` | `useFollowing`, `useFollowers` (from `follows`, participant RLS), `useFriends` (mutual intersection hydrated via `social_profiles`), `useFriendRequests` (followers-not-followed-back), `useProfileSearch(username)` (via `public_profiles` + `social_profiles`), `useFriendCloset(userId)` (from `friend_items`, `borrowable` respected per architecture.md §4), `useBorrowRequests` (both directions), `useBlockedUsers`. |
| `src/features/social-graph/mutations.ts` | `useFollow`, `useUnfollow`, `useRequestBorrow` (item, optional eventId, message), `useAnswerBorrow` (approve/decline/returned), `useCancelBorrow`, `useSetBorrowable` (owner updates `items.borrowable` — existing items owner RLS, no new policy). |
| `src/features/social-graph/moderation.ts` | The moderation seam (§5.3): `useReportContent`, `useBlockUser`, `useUnblockUser`. |
| `src/app/friends/_layout.tsx` | Stack for the social group. |
| `src/app/friends/index.tsx` | Friends + requests + search; follow/unfollow; entry to friend closets. |
| `src/app/friends/[userId].tsx` | Friend closet grid: `friend_items` + `useSignedUrls`; non-borrowable items shown without the borrow affordance; borrow sheet → `useRequestBorrow`. |
| `src/app/borrow.tsx` | Borrow inbox/outbox: pending/approved/declined/returned lifecycle. |
| `src/components/social/ProfileRow.tsx` | Identity row + follow state. |
| `src/components/social/FriendItemCard.tsx` | Grid cell honoring `borrowable`. |
| `src/components/social/BorrowRequestRow.tsx` | Request lifecycle row. |
| `src/components/social/BlockedList.tsx` | Blocked users management (App Store UGC requirement). |

**Edits**

| File | Change |
|---|---|
| `src/app/item/[id].tsx` | Owner-facing "Borrowable" toggle (default on) via `useSetBorrowable`; visible state explanation copy. |
| `src/app/profile.tsx` | Entries: Friends, Borrow requests (badge), Blocked users. |

**Imports (does not own):** `db-rows.ts` (DB), `useSignedUrls` (existing),
ui/theme. Does NOT import from `events` or `event-outfits` — event-scoped
borrow entry points live in OUTFITS/EVENTS screens, which call
`useRequestBorrow` with an `eventId`; GRAPH's own surfaces pass `null`.

**Done when:** mutual follow → friend closet renders with images →
non-borrowable item unrequestable → borrow round-trip → block severs
friendship and empties the closet view on refetch; compiles with EVENTS and
OUTFITS absent.

---

## 5. Seam contracts (pre-declared; code against these exactly)

### 5.1 `src/features/social/db-rows.ts` — owner: **Agent DB**

```ts
// Hand-written row shapes for the social tables/views, used until
// `npm run gen:types` regenerates src/types/database.ts. snake_case on
// purpose: these mirror the wire format, and each feature maps to camelCase
// in its own types.ts (the closet/queries.ts pattern).

export type EventVisibility = 'invite_only' | 'friends';
export type EventMemberRole = 'host' | 'attendee';
export type EventMemberState = 'invited' | 'joined' | 'declined' | 'removed';
export type BorrowStatus = 'pending' | 'approved' | 'declined' | 'canceled' | 'returned';
export type ReportSubject = 'profile' | 'item' | 'outfit_post' | 'comment' | 'event';

export interface EventRow {
  id: string; host_id: string; title: string; note: string | null;
  occasion: string | null; dress_code: string | null;
  starts_at: string; ends_at: string | null; party_size: number | null;
  visibility: EventVisibility;
  venue_name: string | null; venue_address: string | null;
  venue_meta: unknown | null; reservation_url: string | null;
  canceled_at: string | null; created_at: string; updated_at: string;
}

export interface EventMemberRow {
  event_id: string; user_id: string; role: EventMemberRole;
  state: EventMemberState; invited_by: string | null;
  created_at: string; updated_at: string;
}

export interface EventOutfitPostRow {
  id: string; event_id: string; user_id: string; outfit_id: string;
  caption: string | null; created_at: string;
}

export interface EventOutfitVoteRow {
  post_id: string; event_id: string; voter_id: string; created_at: string;
}

export interface EventVoteCountRow {
  event_id: string; post_id: string; votes: number;
}

export interface EventCommentRow {
  id: string; event_id: string; post_id: string | null; user_id: string;
  body: string; reported: boolean; hidden: boolean; created_at: string;
}

export interface EventPostItemRow {
  post_id: string; event_id: string; item_id: string; position: number;
  user_id: string; category: string; subcategory: string | null;
  colors: unknown; thumb_path: string | null; cutout_path: string | null;
  plate_path: string | null; borrowable: boolean;
}

export interface BorrowRequestRow {
  id: string; item_id: string; owner_id: string; requester_id: string;
  event_id: string | null; message: string | null; status: BorrowStatus;
  created_at: string; updated_at: string;
}

export interface SocialProfileRow {
  user_id: string; username: string | null; display_name: string | null;
  avatar_url: string | null;
}

export interface FriendItemRow {
  id: string; user_id: string; category: string; subcategory: string | null;
  colors: unknown; pattern: string | null; material: string | null;
  brand: string | null; seasons: string[]; occasions: string[];
  description: string | null; thumb_path: string | null;
  cutout_path: string | null; plate_path: string | null;
  borrowable: boolean; created_at: string;
}

export interface UserBlockRow {
  blocker_id: string; blocked_id: string; created_at: string;
}

export interface FollowRow {
  follower_id: string; followee_id: string; created_at: string;
}
```

### 5.2 `src/features/events` — owner: **Agent EVENTS**

```ts
// types.ts
export interface EventMember {
  userId: string; role: EventMemberRole; state: EventMemberState;
  username: string | null; displayName: string | null; avatarUrl: string | null;
}
export interface EventDetail {
  id: string; hostId: string; title: string; note: string | null;
  occasion: string | null; dressCode: string | null;
  startsAt: Date; endsAt: Date | null; partySize: number | null;
  visibility: EventVisibility;
  venueName: string | null; venueAddress: string | null;
  reservationUrl: string | null; canceledAt: Date | null;
  isHost: boolean;                       // derived vs current user
  myState: EventMemberState | null;      // null = not on roster
}
export interface EventSummary {
  id: string; title: string; startsAt: Date; venueName: string | null;
  myState: EventMemberState | null; isHost: boolean; memberCount: number;
}

// queries.ts
export function useEvent(eventId: string | null): UseQueryResult<EventDetail | null>;
export function useMyEvents(): UseQueryResult<EventSummary[]>;      // upcoming, joined or hosting
export function useEventInvites(): UseQueryResult<EventSummary[]>;  // state === 'invited'
export function useEventMembers(eventId: string): UseQueryResult<EventMember[]>;

// use-event-channel.ts — subscribe while an event screen is focused.
// Invalidates the §5.4 keys on any vote/comment change. No return value.
export function useEventChannel(eventId: string | null): void;
```

### 5.3 `src/features/social-graph/moderation.ts` — owner: **Agent GRAPH**

```ts
import type { ReportSubject } from '@/features/social/db-rows';

export interface ReportInput {
  subject: ReportSubject;
  subjectId: string;            // id in the subject's table
  subjectUserId?: string;       // author, when known (denormalised for triage)
  reason: string;               // <= 100 chars
  details?: string;             // <= 2000 chars
}
export function useReportContent(): UseMutationResult<void, Error, ReportInput>;
export function useBlockUser(): UseMutationResult<void, Error, { userId: string }>;
export function useUnblockUser(): UseMutationResult<void, Error, { userId: string }>;
```

### 5.4 Shared react-query keys (convention, no owner file needed)

`useEventChannel` (EVENTS) invalidates; `event-outfits` queries (OUTFITS)
register under **exactly** these keys:

```ts
['event', eventId]                    // detail            (EVENTS)
['event-members', eventId]            // roster            (EVENTS)
['event-posts', eventId]              // posts+tallies     (OUTFITS)
['event-comments', eventId]           // all comments      (OUTFITS; per-post filtering client-side)
['my-vote', eventId]                  // caller's vote     (OUTFITS)
```

### 5.5 Existing modules reused as-is (nobody edits these)

- `@/features/closet/use-image-urls` — `useSignedUrls(paths)`,
  `stableImageSource(uri)`: works unchanged for friend/event images because
  the new storage policies authorize the signing call.
- `@/lib/supabase` — `supabase`, `getUserId()`.
- `@/features/styling/queries` — OUTFITS reads own outfits through it.
- `@/features/billing/use-plan`, `use-gate` — plan display and upgrade sheets.

---

## 6. Conflict-free checklist (verify before merging any agent)

- [ ] No file appears in two agents' lists (`git diff --name-only` per branch
      must be disjoint; the only shared *directories* are `src/app/event/[id]/`
      and `src/components/`, with disjoint files).
- [ ] EVENTS has zero imports from `event-outfits` or `social-graph`.
- [ ] GRAPH has zero imports from `events` or `event-outfits`.
- [ ] Only DB touches `supabase/**`, `src/types/database.ts`,
      `src/features/social/db-rows.ts`, `src/features/billing/plans.ts`.
- [ ] Only DB's migrations contain `grant`/`revoke`/`create policy` — and no
      grant on a view names any verb but SELECT, no policy says `to anon`,
      no view sets `security_invoker = true`.
- [ ] `supabase test db` green (all 7 test files) before any app branch merges.

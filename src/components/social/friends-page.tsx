import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Pressable, RefreshControl, View, type TextInput } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BLOCKED_ACTION,
  BLOCKED_BODY,
  BLOCKED_TITLE,
  FIND_SOMEONE,
  FRIENDS_FAILED_BODY,
  FRIENDS_FAILED_TITLE,
  INVITE_MUTUAL_NOTE,
  INVITE_TITLE,
  NOBODY_YET_BODY,
  NOBODY_YET_TITLE,
  NO_RESULTS_BODY,
  NO_RESULTS_TITLE,
  OFFLINE_BODY,
  OFFLINE_TITLE,
  REQUESTS_FAILED,
  SENT_HEADING,
  SENT_NOTE,
  TRY_AGAIN,
  WAITING_ON_YOU,
} from '@/components/social/friends-lines';
import {
  CARD_RADIUS,
  FRIEND_CARD_HEIGHT,
  FriendRow,
  RequestRow,
  SearchResultRow,
  SentRow,
  type RequestRowState,
  type SearchRelation,
} from '@/components/social/friend-rows';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Rule } from '@/components/ui/rule';
import { SearchField } from '@/components/ui/search-field';
import { RowSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { GROUPS_TITLE } from '@/features/circles/copy';
import { TwoPersonGlyph } from '@/features/explore/glyphs';
import { type SocialProfile } from '@/features/social-graph/types';
import type { PresenceFact } from '@/features/social-graph/friends-presence';
import { MIN_TAP_TARGET, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Friends, rendered (atlas F-01…F-03, F-05). Render-only on the closet.tsx /
 * use-closet-screen.ts precedent: every derivation and every mutation lives in
 * the route (`src/app/friends/index.tsx`), and `dev-friends` mounts this same
 * component over fixtures — so what a reviewer signs off there is what ships,
 * by construction.
 *
 * One scroll column, one card grammar. Requests sit on top because they are
 * the only thing waiting on the reader; the friends list is the query's name
 * sort and is never re-sorted by activity — ranking friends by how often they
 * post would turn an address book into a feed. Sent stays last: it is the
 * group you can do the least about.
 */

/** The band and the footer card share the accepted frame's 20pt corner. */
const BAND_RADIUS = 20;
/** The gap between friend cards. */
const CARD_GAP = 8;
/** The oxblood tile on the footer card. */
const INVITE_TILE = 46;

export type RequestRowModel = {
  profile: SocialProfile;
  requestedAt: string;
  state: RequestRowState;
};

export type SearchRowModel = { profile: SocialProfile; relation: SearchRelation };

export type FriendsPageProps = {
  query: string;
  onQueryChange: (q: string) => void;
  /** The way back, which the frame draws as a 44pt disc rather than a bar. */
  onBack: () => void;
  /** Search is revealed by its control; the field is unchanged underneath. */
  searchOpen: boolean;
  onSearchOpen: () => void;
  /** ≥2 typed chars — search replaces the sections while true. */
  searching: boolean;

  searchLoading: boolean;
  searchError: boolean;
  searchRetrying: boolean;
  onRetrySearch: () => void;
  searchRows: SearchRowModel[];
  onAddFromSearch: (profile: SocialProfile) => void;
  onAcceptFromSearch: (profile: SocialProfile) => void;
  onCancelAsk: (profile: SocialProfile) => void;
  /** The row whose add/accept is currently in flight, if any. */
  searchPendingId: string | null;

  requests: RequestRowModel[];
  requestsError: boolean;
  requestsRetrying: boolean;
  onRetryRequests: () => void;
  onAccept: (row: RequestRowModel) => void;
  onNotNow: (profile: SocialProfile) => void;
  onUndo: (profile: SocialProfile) => void;
  onRetryAccept: (row: RequestRowModel) => void;

  friends: SocialProfile[];
  /**
   * Redesign 08 — the one authorized fact per friend, keyed by user id.
   *
   * A friend absent from this map draws no presence element at all. Absence is
   * the only expression of "no fact", and it covers revoked sharing, an expired
   * look, a hidden piece, a muted friend and someone who simply never wore
   * anything — all indistinguishable on purpose. See `friends-presence.ts`.
   */
  presence: ReadonlyMap<string, PresenceFact>;
  /**
   * The names are cached and the facts are not shown.
   *
   * A cached presence fact asserts a permission that may already have been
   * withdrawn, so going offline withholds every one of them and says so. Names
   * are identity and do not expire that way, so they stay.
   */
  presenceWithheld: boolean;
  /** Dynamic Type past the threshold: cards stack rather than shrink. */
  large: boolean;
  friendsLoading: boolean;
  friendsError: boolean;
  friendsRetrying: boolean;
  onRetryFriends: () => void;
  onOpenFriend: (profile: SocialProfile) => void;
  onOverflow: (profile: SocialProfile) => void;

  sent: SocialProfile[];
  /** Withdraw an outgoing request. Reuses the same unfollow the search row does. */
  onWithdrawSent?: (profile: SocialProfile) => void;
  /** The outgoing request whose withdrawal is in flight, if any. */
  withdrawingId?: string | null;

  /** F-03 — no friends, no requests, no sent, not searching, queries settled. */
  showEmpty: boolean;
  /** Hidden when the signed-in user has no claimed handle — never share a blank. */
  /**
   * Whether there is an invite link to send at all — false until the account
   * has a handle, because the handle IS the link (atlas 39's first rule).
   */
  canInvite: boolean;
  /** Opens /invite. Replaces the old bare "share your username" message. */
  onInvite: () => void;

  refreshing: boolean;
  onRefresh: () => void;

  /**
   * FR-02's blocked result — shown once, after a block lands from this page.
   *
   * Deliberately unnamed: "You blocked this person" is the whole heading, and
   * printing whose name it was would keep a window open onto someone the user
   * has just closed the door on.
   */
  showBlockedResult?: boolean;
  onManageBlocked?: () => void;

  /**
   * Opens the private-groups list.
   *
   * Optional because three dev fixtures mount this page over static data and
   * have no router to hand it; the link simply does not draw for them.
   */
  onOpenGroups?: () => void;

  /**
   * What the closet the circle can see is allowed to hold, on Free — built in
   * the route from `PLANS.free.items` and never a typed numeral.
   *
   * Optional in the same dialect as `onOpenGroups`: the three dev fixtures
   * mount this page over static data with no `usePlan()` and no router, so
   * both simply do not draw for them. It states a fact where the reader is
   * already thinking about what their friends see — no badge, no lock, no
   * price — and it is absent entirely on a paid or trialing account.
   */
  planNote?: string;
  onSeePlans?: () => void;
};

export function FriendsPage(props: FriendsPageProps) {
  const theme = useTheme();
  const searchRef = useRef<TextInput>(null);

  const openRequestCount = props.requests.filter((r) => r.state !== 'dismissed').length;
  const showRequests = props.requestsError || props.requests.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The compact header the accepted frame draws: a 44pt tray disc for the
          way back, the serif page title, and the search affordance as its
          mirror. `ScreenHeader`'s eyebrow-plus-display masthead is gone with
          it, and so is the `2 requests · 18 friends` line beneath — that line
          was two counts about the reader's own circle, and the redesign's rule
          is that this page states no quantity of anything. `circleLine` stays
          exported for the older fixtures that still pose it. */}
      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={props.onBack}
          className="items-center justify-center bg-tray active:opacity-60"
          style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }}>
          <SymbolView
            name="chevron.left"
            size={17}
            tintColor={theme.ink}
            resizeMode="scaleAspectFit"
          />
        </Pressable>

        <Text variant="plate" trim accessibilityRole="header">
          Friends
        </Text>

        {/* Search is a control rather than a standing field — the frame keeps
            the resting page to its people. The field itself is unchanged and
            still the only way anyone is found; it simply arrives when asked
            for, and the query surviving in state is what keeps a result list
            from vanishing under a stray tap. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find a friend by username"
          onPress={() => {
            props.onSearchOpen();
            searchRef.current?.focus();
          }}
          className="items-center justify-center bg-tray active:opacity-60"
          style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }}>
          <SymbolView
            name="magnifyingglass"
            size={17}
            tintColor={theme.ink}
            resizeMode="scaleAspectFit"
          />
        </Pressable>
      </View>

      {props.searchOpen ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <SearchField
            inputRef={searchRef}
            value={props.query}
            onChangeText={props.onQueryChange}
            placeholder="Find a friend by username"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}

      {/* THE WAY INTO PRIVATE GROUPS. A group is made of "friends you both
          added" and of nobody else, so the surface that lists your mutual
          friends is where the small rooms made out of them belong. */}
      {props.onOpenGroups ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={GROUPS_TITLE}
            onPress={props.onOpenGroups}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="flex-row items-center gap-1.5 active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              {GROUPS_TITLE}
            </Text>
            <SymbolView
              name="chevron.right"
              size={11}
              tintColor={theme.accent}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}

        refreshControl={
          <RefreshControl
            refreshing={props.refreshing}
            onRefresh={props.onRefresh}
            tintColor={theme.muted}
          />
        }>
        {props.showBlockedResult && props.onManageBlocked ? (
          <BlockedResult onManage={props.onManageBlocked} />
        ) : null}

        {props.searching ? (
          <SearchSection {...props} />
        ) : props.showEmpty ? (
          <EmptySection
            canInvite={props.canInvite}
            onInvite={props.onInvite}
            onFindFriend={() => searchRef.current?.focus()}
          />
        ) : (
          <>
            {showRequests ? <RequestsSection {...props} count={openRequestCount} /> : null}
            <FriendsSection {...props} />
            {props.sent.length > 0 ? (
              <SentSection
                sent={props.sent}
                onWithdraw={props.onWithdrawSent}
                withdrawingId={props.withdrawingId}
              />
            ) : null}

            {/* The way in for the invite link, in the resting state as well as
                the empty one. Atlas 39 reaches IV-01 from Friends, and someone
                with two friends is exactly as able to want a third as someone
                with none — the empty state is not the only moment the thought
                occurs. Quiet, at the foot, with no count and no nudge. */}
            {props.canInvite ? <InviteFooter onInvite={props.onInvite} /> : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/**
 * The invite footer — a designed card, not a bare link (brief §8, page 10).
 *
 * The last thing on the page and the only filled oxblood on it: a 46pt tile
 * with a plus, the invitation, and the sentence that says what a friendship
 * here actually is. It routes to `/invite`, which is page 10's own screen —
 * nothing about the link is minted or explained here.
 */
function InviteFooter({ onInvite }: { onInvite: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={INVITE_TITLE}
      accessibilityHint="Opens your invite link"
      onPress={onInvite}
      className="mt-8 flex-row items-center bg-sand active:opacity-60"
      style={{ borderRadius: BAND_RADIUS, padding: 16, gap: 14, minHeight: MIN_TAP_TARGET }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="items-center justify-center"
        style={{
          width: INVITE_TILE,
          height: INVITE_TILE,
          borderRadius: 14,
          backgroundColor: theme.accent,
          flexShrink: 0,
        }}>
        <View style={{ width: 16, height: 2, backgroundColor: theme.canvas, position: 'absolute' }} />
        <View style={{ width: 2, height: 16, backgroundColor: theme.canvas, position: 'absolute' }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="body">{INVITE_TITLE}</Text>
        <Text variant="note">{INVITE_MUTUAL_NOTE}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FR-02 · the blocked result
// ---------------------------------------------------------------------------

/**
 * What a completed block says, IN THE SAFETY PAGE'S OWN WORDS.
 *
 * `BLOCK_EFFECT` is the sentence `BlockedList.tsx` prints above the blocked
 * rows; both surfaces import the one constant from `friends-lines.ts` rather
 * than each writing the policy out. Two sentences for one policy is how a
 * policy stops being one policy — and the second half is the fact this frame
 * exists to carry: the other person is not told.
 *
 * Exported so `dev-w3-g5-fr-02` poses the shipping object rather than a
 * redrawing of it.
 */
export function BlockedResult({ onManage }: { onManage: () => void }) {
  const theme = useTheme();

  return (
    <View className="mt-6 rounded-lg border border-rule bg-surface p-4" accessibilityRole="summary">
      <Text variant="body">
        {BLOCKED_TITLE}
      </Text>
      <Text variant="note" className="mt-1.5">
        {BLOCKED_BODY}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={BLOCKED_ACTION}
        onPress={onManage}
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-1 justify-center active:opacity-60">
        <Text variant="note" style={{ color: theme.ink }}>
          {BLOCKED_ACTION}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * Section headings are 13pt REGULAR secondary with their counts inline (audit
 * 89) — not the app's tracked `eyebrow`, which is Medium and would put a
 * second weight on a page whose only Medium string is a person's name.
 */
function SectionLine({ text, className = '' }: { text: string; className?: string }) {
  return (
    <Text variant="note" accessibilityRole="header" className={className}>
      {text}
    </Text>
  );
}

/**
 * The requests band — redesign 08.
 *
 * A blush plate at the top of the page, present only when something is actually
 * waiting. With nothing waiting it is absent entirely rather than an empty
 * shell, which is what keeps the resting page from looking like it is missing
 * something.
 *
 * A labelled group for VoiceOver, so the band announces as "Waiting on you"
 * once rather than each row re-stating which section it is in.
 */
function RequestsSection(props: FriendsPageProps & { count: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={WAITING_ON_YOU}
      className="bg-blush"
      style={{ borderRadius: BAND_RADIUS, padding: 14, gap: 10, marginBottom: 12 }}>
      <Text variant="eyebrow" accessibilityRole="header" style={{ color: theme.accent }}>
        {WAITING_ON_YOU}
      </Text>
      <View>
        {props.requestsError ? (
          <ErrorState
            compact
            title={REQUESTS_FAILED}
            body="This didn’t load. It doesn’t mean nobody has asked."
            onRetry={props.onRetryRequests}
            retrying={props.requestsRetrying}
          />
        ) : (
          props.requests.map((row, i) => (
            // Layout transitions close the gap when a settled row leaves —
            // the list slides shut instead of snapping.
            <Animated.View
              key={row.profile.userId}
              layout={LinearTransition.duration(220)}
              exiting={FadeOut.duration(160)}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <RequestRow
                profile={row.profile}
                requestedAt={row.requestedAt}
                state={row.state}
                onAccept={() => props.onAccept(row)}
                onNotNow={() => props.onNotNow(row.profile)}
                onUndo={() => props.onUndo(row.profile)}
                onRetry={() => props.onRetryAccept(row)}
                large={props.large}
              />
            </Animated.View>
          ))
        )}
      </View>
    </View>
  );
}

/**
 * The circle — redesign 08.
 *
 * Cards, alphabetical, always. Presence never reorders the list and there is no
 * "active recently" section, so nobody can infer how often a friend posts from
 * where they sit. The sort is `useFriends`'s own, which is by display name.
 *
 * THREE FAILURES, THREE DIFFERENT SENTENCES. A read that failed with names
 * cached is an offline page that keeps its names and withholds every fact; a
 * read that failed with nothing cached says so and never renders as an empty
 * circle; a read still in flight is card-shaped skeletons and no claim at all.
 */
function FriendsSection(props: FriendsPageProps) {
  const cached = props.friends.length > 0;

  if (props.friendsError && cached) {
    return (
      <>
        <OfflineBand onRetry={props.onRetryFriends} retrying={props.friendsRetrying} />
        <FriendCards {...props} />
      </>
    );
  }

  if (props.friendsError) {
    return (
      <ErrorState
        title={FRIENDS_FAILED_TITLE}
        body={FRIENDS_FAILED_BODY}
        onRetry={props.onRetryFriends}
        retrying={props.friendsRetrying}
        retryTitle={TRY_AGAIN}
      />
    );
  }

  if (props.friendsLoading) {
    // Card-shaped skeletons. No invented copy, no count, and no claim that the
    // circle is empty — the one thing a loading friends list must never say.
    return (
      <View style={{ gap: CARD_GAP }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} style={{ height: FRIEND_CARD_HEIGHT, borderRadius: CARD_RADIUS }} />
        ))}
      </View>
    );
  }

  return <FriendCards {...props} />;
}

function FriendCards(props: FriendsPageProps) {
  return (
    <View style={{ gap: CARD_GAP }}>
      {props.friends.map((profile) => (
        <FriendRow
          key={profile.userId}
          profile={profile}
          // Withheld offline, and absent whenever the server did not authorize
          // one. Both arrive here as `undefined` and draw nothing.
          presence={props.presenceWithheld ? null : props.presence.get(profile.userId) ?? null}
          large={props.large}
          onPress={() => props.onOpenFriend(profile)}
          onOverflow={() => props.onOverflow(profile)}
        />
      ))}
      {props.planNote ? <PlanNote note={props.planNote} onSeePlans={props.onSeePlans} /> : null}
    </View>
  );
}

/**
 * The offline band — amber, and every word on it in ink.
 *
 * `warning` is a FILL and the contrast record says ink goes on it, so the band
 * is the token at an alpha. Same construction as the trips shelf and the
 * profile page, so the app's three "this did not load" moments read as one
 * object.
 */
function OfflineBand({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: warningAlpha(0.22),
        borderRadius: BAND_RADIUS,
        padding: 16,
        gap: 10,
        marginBottom: 12,
      }}>
      <Text variant="body" accessibilityRole="header">
        {OFFLINE_TITLE}
      </Text>
      <Text variant="note">{OFFLINE_BODY}</Text>
      <Button
        title={TRY_AGAIN}
        variant="secondary"
        loading={retrying}
        onPress={onRetry}
        className="self-start px-6"
      />
    </View>
  );
}

/**
 * The free-plan note. Quiet, factual, and not a place to sell.
 *
 * No price, no trial copy and no filled button — the page's one oxblood is
 * spent on the invite footer. "See plans" stays a text control in ink, exactly
 * as it shipped.
 */
function PlanNote({ note, onSeePlans }: { note: string; onSeePlans?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ paddingTop: 6, gap: 6 }}>
      <Text variant="note">{note}</Text>
      {onSeePlans ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See plans"
          onPress={onSeePlans}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" style={{ color: theme.ink }}>
            See plans
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Your own outgoing requests — redesign 08.
 *
 * Each one withdrawable, and no read receipt: there is deliberately no
 * indication of whether the other person has seen it, because there is no such
 * fact in the schema and inventing one would be a claim about somebody else's
 * attention. The closing note says what the whole page is built on — nothing
 * moves in either direction until a request is accepted.
 */
function SentSection({
  sent,
  onWithdraw,
  withdrawingId,
}: {
  sent: SocialProfile[];
  onWithdraw?: (profile: SocialProfile) => void;
  withdrawingId?: string | null;
}) {
  return (
    <View style={{ marginTop: 24, gap: CARD_GAP }}>
      <SectionLine text={SENT_HEADING} />
      {sent.map((profile) => (
        <SentRow
          key={profile.userId}
          profile={profile}
          onWithdraw={onWithdraw ? () => onWithdraw(profile) : undefined}
          withdrawing={withdrawingId === profile.userId}
        />
      ))}
      <Text variant="note">{SENT_NOTE}</Text>
    </View>
  );
}

function SearchSection(props: FriendsPageProps) {
  return (
    <>
      <SectionLine text="People" className="mb-2.5 mt-6" />
      <Card>
        {props.searchLoading ? (
          <View className="px-4 py-3.5">
            <RowSkeleton isLast />
          </View>
        ) : props.searchError ? (
          <ErrorState
            compact
            title="Couldn’t search just now."
            body="This is a connection problem, not an answer about who is on Cinch."
            onRetry={props.onRetrySearch}
            retrying={props.searchRetrying}
          />
        ) : props.searchRows.length === 0 ? (
          // Worded so it says nothing about the person. Either claim — that the
          // account exists or that it does not — would leak the existence of a
          // blocked or private profile to whoever typed the handle.
          <View className="px-4 py-3.5" style={{ gap: 4 }}>
            <Text variant="body">{NO_RESULTS_TITLE}</Text>
            <Text variant="note">{NO_RESULTS_BODY}</Text>
          </View>
        ) : (
          props.searchRows.map((row, i) => (
            <View key={row.profile.userId}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <SearchResultRow
                profile={row.profile}
                relation={row.relation}
                pending={props.searchPendingId === row.profile.userId}
                onAdd={() => props.onAddFromSearch(row.profile)}
                onAccept={() => props.onAcceptFromSearch(row.profile)}
                onCancel={() => props.onCancelAsk(row.profile)}
                onOpen={() => props.onOpenFriend(row.profile)}
              />
            </View>
          ))
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// F-03 · No one yet
// ---------------------------------------------------------------------------

/**
 * The empty state says out loud what the product will not do — no
 * suggestions, no contact upload, no discovery. Sharing your own username is
 * the second path, because half of these friendships start as a text message.
 * Centred, unlike the kit's hard-left empties: this is the page's hero state,
 * the whole remaining canvas, not a section inside a card.
 */
function EmptySection({
  canInvite,
  onInvite,
  onFindFriend,
}: {
  canInvite: boolean;
  onInvite: () => void;
  onFindFriend: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 items-center justify-center px-6" accessibilityRole="summary">
      <TwoPersonGlyph size={34} color={theme.muted} />
      <View className="mt-4">
        <Text variant="title" trim className="text-center">
          {NOBODY_YET_TITLE}
        </Text>
      </View>
      {/* FR-02: the empty state leads with what friendship MEANS for privacy
          rather than with an exhortation to invite. Both halves are shipping
          truth — a look is seen where it was shared, and lending is per garment
          (`items.borrowable`), never a standing permission. */}
      {/* No stranger suggestions and no contact-book offer. Two honest routes:
          search for someone you already know, or invite them. */}
      <Text variant="body" className="mt-4 text-center text-muted">
        {NOBODY_YET_BODY}
      </Text>
      {/* The page's ONE oxblood action, and it sits here. Without a claimed
          handle there is no link to send, so the accent is not spent on a
          control that cannot complete — the ink alternative takes its place. */}
      {canInvite ? (
        <>
          <Button title={INVITE_TITLE} variant="primary" onPress={onInvite} className="mt-6" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={FIND_SOMEONE}
            onPress={onFindFriend}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-2 justify-center px-2 active:opacity-60">
            <Text variant="note" style={{ color: theme.ink }}>
              {FIND_SOMEONE}
            </Text>
          </Pressable>
        </>
      ) : (
        <Button title={FIND_SOMEONE} variant="ink" onPress={onFindFriend} className="mt-6" />
      )}
    </View>
  );
}

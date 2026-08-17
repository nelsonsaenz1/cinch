import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Pressable, RefreshControl, View, type TextInput } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BLOCKED_ACTION,
  BLOCKED_BODY,
  BLOCKED_TITLE,
  circleLine,
  EMPTY_BODY,
  EMPTY_TITLE,
  friendsHeading,
  REQUESTS_HEADING,
} from '@/components/social/friends-lines';
import {
  closetAudienceLine,
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
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { ListSkeleton, RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { GROUPS_TITLE } from '@/features/circles/copy';
import { TwoPersonGlyph } from '@/features/explore/glyphs';
import { type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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

export type RequestRowModel = {
  profile: SocialProfile;
  requestedAt: string;
  state: RequestRowState;
};

export type SearchRowModel = { profile: SocialProfile; relation: SearchRelation };

export type FriendsPageProps = {
  query: string;
  onQueryChange: (q: string) => void;
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
  friendsLoading: boolean;
  friendsError: boolean;
  friendsRetrying: boolean;
  onRetryFriends: () => void;
  onOpenFriend: (profile: SocialProfile) => void;
  onOverflow: (profile: SocialProfile) => void;

  sent: SocialProfile[];

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
      <ScreenHeader title="Your circle" backLabel="Back to Lately" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Friends
        </Text>

        {/* FR-01's masthead line: `2 requests · 18 friends`, 13pt regular
            secondary. It replaces the standing paragraph about mutuality — the
            paragraph cost the first viewport a row and a half, and the rule it
            stated is stated again where it is actually needed (the search row's
            "nothing opens until they say yes", and FR-02's empty body).
            Dropped entirely when both counts are zero. */}
        {circleLine(openRequestCount, props.friends.length) ? (
          <Text variant="note" className="mt-2">
            {circleLine(openRequestCount, props.friends.length)}
          </Text>
        ) : null}

        {/* THE WAY INTO PRIVATE GROUPS, AND WHY IT IS HERE.

            A group is made of "friends you both added" and of nobody else —
            the INSERT policy checks mutuality at the invitation and there is no
            other door in. So the surface that lists your mutual friends is the
            surface where the small rooms made out of them belong, and it is the
            place somebody goes when the thought is about their people rather
            than about their clothes.

            Not Explore, which was the other candidate: its "Your circle" link
            is a FOOTER that draws in exactly two of the feed's branches (the
            empty state and the end of a loaded feed), so a Groups link beside
            it would be absent whenever the feed was mid-length — an entry point
            that comes and goes with unrelated data. And not a sixth tab: five
            exist, and a sixth is a navigation rewrite, not a link.

            In the masthead rather than at the foot beside "Invite a friend",
            because that one sits below the whole friends list and a person with
            eighteen friends would never scroll to it looking for a group.

            The word is `GROUPS_TITLE` from the circles copy module — "Groups",
            the customer-facing half of the vocabulary contract. It sits under a
            header that says "Your circle", and the two mean different things on
            purpose: your circle is everyone you have both added, a group is a
            small private room made from a few of them. */}
        {props.onOpenGroups ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={GROUPS_TITLE}
            onPress={props.onOpenGroups}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-3 flex-row items-center gap-1.5 active:opacity-60">
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
        ) : null}

        <SearchField
          inputRef={searchRef}
          value={props.query}
          onChangeText={props.onQueryChange}
          placeholder="Find a friend by username"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-4"
        />
      </View>

      <KeyboardAwareScrollView
        contentContainerClassName="px-gutter pb-24"
        contentContainerStyle={props.showEmpty ? { flexGrow: 1 } : undefined}
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
            {props.sent.length > 0 ? <SentSection sent={props.sent} /> : null}

            {/* The way in for the invite link, in the resting state as well as
                the empty one. Atlas 39 reaches IV-01 from Friends, and someone
                with two friends is exactly as able to want a third as someone
                with none — the empty state is not the only moment the thought
                occurs. Quiet, at the foot, with no count and no nudge. */}
            {props.canInvite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Invite a friend"
                accessibilityHint="Opens your invite link"
                onPress={props.onInvite}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-8 justify-center active:opacity-60">
                <Text variant="label" style={{ color: theme.accent }}>
                  Invite a friend
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
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

function RequestsSection(props: FriendsPageProps & { count: number }) {
  return (
    <>
      <SectionLine text={REQUESTS_HEADING} className="mb-2.5 mt-6" />
      <Card>
        {props.requestsError ? (
          <ErrorState
            compact
            title="Couldn’t load your requests."
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
              />
            </Animated.View>
          ))
        )}
      </Card>
    </>
  );
}

function FriendsSection(props: FriendsPageProps) {
  const theme = useTheme();

  return (
    <>
      <SectionLine text={friendsHeading(props.friends.length)} className="mb-2.5 mt-6" />
      <Card>
        {props.friendsError ? (
          <ErrorState
            compact
            title="Couldn’t load your friends."
            body="This is a connection problem. It doesn’t mean your circle is empty — nothing has changed."
            onRetry={props.onRetryFriends}
            retrying={props.friendsRetrying}
          />
        ) : props.friendsLoading ? (
          // The shared list skeleton, ragged-width, instead of two identical
          // bars: a column of matching bars reads as a loading graphic, a
          // ragged one reads as names about to arrive.
          <View className="-mx-gutter py-2">
            <ListSkeleton count={3} />
          </View>
        ) : props.friends.length === 0 ? (
          // Reachable only with requests or sent on the page (F-03 owns the
          // fully-empty screen), so the way forward is the section above.
          <Text variant="body" className="px-4 py-6 text-muted">
            No friends yet. Accept a request above and your circle starts here.
          </Text>
        ) : (
          props.friends.map((profile, i) => (
            <View key={profile.userId}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <FriendRow
                profile={profile}
                onPress={() => props.onOpenFriend(profile)}
                onOverflow={() => props.onOverflow(profile)}
              />
            </View>
          ))
        )}
      </Card>
      {/* The closing line — the only count that matters: who can see your
          closet (F-02). */}
      {!props.friendsLoading && !props.friendsError && props.friends.length > 0 ? (
        <>
          <Text variant="note" className="mt-4">
            {closetAudienceLine(props.friends.length)}
          </Text>
          {/* And how much of it there can be. The audience line is the one
              sentence on this surface about the reach of what you own, and it
              used to stop exactly where membership starts to matter.

              Ink, not accent — the treatment `BlockedResult` already uses in
              this file. The page's two oxblood controls (the Groups link in the
              masthead, "Invite a friend" at the foot) are spent, and a third
              would make none of them read as the primary one. */}
          {props.planNote ? (
            <>
              <Text variant="note" className="mt-1">
                {props.planNote}
              </Text>
              {props.onSeePlans ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="See plans"
                  onPress={props.onSeePlans}
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="justify-center active:opacity-60">
                  <Text variant="note" style={{ color: theme.ink }}>
                    See plans
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function SentSection({ sent }: { sent: SocialProfile[] }) {
  return (
    <>
      <SectionLine text="Sent" className="mb-2.5 mt-6" />
      <Card>
        {sent.map((profile, i) => (
          <View key={profile.userId}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <SentRow profile={profile} />
          </View>
        ))}
      </Card>
    </>
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
          <Text variant="body" className="px-4 py-3.5 text-muted">
            No one by that username.
          </Text>
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
          {EMPTY_TITLE}
        </Text>
      </View>
      {/* FR-02: the empty state leads with what friendship MEANS for privacy
          rather than with an exhortation to invite. Both halves are shipping
          truth — a look is seen where it was shared, and lending is per garment
          (`items.borrowable`), never a standing permission. */}
      <Text variant="body" className="mt-4 text-center text-muted">
        {EMPTY_BODY}
      </Text>
      {/* The page's ONE oxblood action, and it sits here. Without a claimed
          handle there is no link to send, so the accent is not spent on a
          control that cannot complete — the ink alternative takes its place. */}
      {canInvite ? (
        <>
          <Button title="Invite someone" variant="primary" onPress={onInvite} className="mt-6" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find someone by username"
            onPress={onFindFriend}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-2 justify-center px-2 active:opacity-60">
            <Text variant="note" style={{ color: theme.ink }}>
              Find someone by username
            </Text>
          </Pressable>
        </>
      ) : (
        <Button title="Find a friend" variant="ink" onPress={onFindFriend} className="mt-6" />
      )}
    </View>
  );
}

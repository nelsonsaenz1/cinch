import { useRef } from 'react';
import { Pressable, RefreshControl, View, type TextInput } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { SectionHeader } from '@/components/ui/section-header';
import { ListSkeleton, RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
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

        {/* The standing subtitle — except in F-03, where the empty state's own
            body carries the explanation and saying it twice would be a lecture. */}
        {props.showEmpty ? null : (
          <Text variant="note" className="mt-2">
            A friendship goes both ways. When you both say yes, their closet opens to you and yours
            to them.
          </Text>
        )}

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
// Sections
// ---------------------------------------------------------------------------

function RequestsSection(props: FriendsPageProps & { count: number }) {
  return (
    <>
      <SectionHeader
        title="Asking to be friends"
        trailing={props.count > 0 ? <Text variant="caption">{props.count}</Text> : undefined}
        className="mb-2.5 mt-6"
      />
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
  return (
    <>
      <SectionHeader
        title="Your friends"
        trailing={
          props.friends.length > 0 ? (
            <Text variant="caption">{props.friends.length}</Text>
          ) : undefined
        }
        className="mb-2.5 mt-6"
      />
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
        <Text variant="note" className="mt-4">
          {closetAudienceLine(props.friends.length)}
        </Text>
      ) : null}
    </>
  );
}

function SentSection({ sent }: { sent: SocialProfile[] }) {
  return (
    <>
      <SectionHeader title="Sent" className="mb-2.5 mt-6" />
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
      <SectionHeader title="People" className="mb-2.5 mt-6" />
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
          No one yet
        </Text>
      </View>
      <Text variant="body" className="mt-4 text-center text-muted">
        Cinch doesn’t suggest people. Add someone by their username and, if they add you back,
        you’ll see what they’ve been wearing.
      </Text>
      <Button title="Find a friend" variant="ink" onPress={onFindFriend} className="mt-6" />
      {canInvite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite a friend"
          accessibilityHint="Opens your invite link"
          onPress={onInvite}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-2 justify-center px-2 active:opacity-60">
          <Text variant="label" style={{ color: theme.accent }}>
            Invite a friend
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

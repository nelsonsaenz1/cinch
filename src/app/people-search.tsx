import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, TextInput, useWindowDimensions } from 'react-native';

import {
  PeopleSearchBody,
  type PeopleRow,
  type PeopleSearchView,
} from '@/components/social/people-search-body';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useMyProfile } from '@/features/profile/queries';
import { useFollow } from '@/features/social-graph/mutations';
import {
  INVITE_ROUTE,
  PEOPLE_SEARCH_STACK_SCALE,
} from '@/features/social-graph/people-search-spec';
import { useFollowing, useFriends, useProfileSearch } from '@/features/social-graph/queries';
import { useRecentPeople } from '@/features/social-graph/recent-people';
import type { SocialProfile } from '@/features/social-graph/types';
import { haptics } from '@/lib/haptics';

/**
 * Finding people — the state machine and the mutations. Redesign 09.
 *
 * The drawing is in `components/social/people-search-body.tsx`; this file is
 * only the wiring, which is the split every other rebuilt page in the repo
 * makes and the reason the six accepted frames can be opened as fixtures.
 *
 * ── WHAT THE REDESIGN CHANGED, AND WHAT IT DID NOT ────────────────────────
 *
 * Changed: the page is now a designed surface rather than a field with a list
 * under it — two invite rows that leave the moment typing starts, a recent
 * list, drawn empty and error states, and the overlap defect closed in the
 * row's own layout rather than in the data that happened to fit.
 *
 * Not changed, and deliberately: WHAT can be searched. `useProfileSearch`
 * reads the same `social_profiles`/`public_profiles` projections under the
 * same contract, a friendship is still mutual, a request is still a follow
 * edge, and the privacy layer still decides who is nameable. Nothing here
 * widens a query, caches a person the server would no longer name, or sends
 * a username anywhere. There is no analytics call on this page at all — the
 * one thing a search screen must never emit is what was typed into it.
 *
 * The sheet presentation, and its reasoning, are unchanged: this is a task
 * you complete and dismiss, registered as a `formSheet` in `_layout.tsx`
 * alongside `stylist` and `profile`.
 */
export default function PeopleSearchScreen() {
  const router = useRouter();
  const searchRef = useRef<TextInput>(null);
  const { fontScale } = useWindowDimensions();

  const [query, setQuery] = useState('');

  const search = useProfileSearch(query);
  const friends = useFriends();
  const following = useFollowing();
  const follow = useFollow();
  const terms = useSocialTermsGate();
  const me = useMyProfile();
  const recent = useRecentPeople();

  const friendIds = useMemo(
    () => new Set((friends.data ?? []).map((p) => p.userId)),
    [friends.data],
  );
  const followingIds = useMemo(() => new Set(following.data ?? []), [following.data]);

  /**
   * Where a person stands with you, resolved once for every list on the page.
   *
   * `isSelf` comes from the search itself — a username field is the one place
   * looking yourself up is reasonable, and the row says "You" rather than
   * offering an Add that could only ever fail.
   */
  const rowFor = (profile: SocialProfile & { isSelf?: boolean }): PeopleRow => ({
    ...profile,
    state: profile.isSelf
      ? 'you'
      : friendIds.has(profile.userId)
        ? 'friends'
        : followingIds.has(profile.userId)
          ? 'requested'
          : 'add',
  });

  const addFriend = (row: PeopleRow) => {
    follow.mutate(
      { userId: row.userId },
      {
        onSuccess: () => {
          // The user was waiting on a round trip, which is the whole of this
          // app's rule for a success notification — and it fires here, after
          // the server agreed, never on the tap.
          haptics.success();
          recent.remember(row.userId);
        },
        onError: (err) => {
          if (terms.intercept(err, () => addFriend(row))) return;
          Alert.alert(
            'Could not send that request',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          );
        },
      },
    );
  };

  /**
   * Out to Share — page 10, and the single destination of every invite
   * affordance on this page. Dismiss first, then push: a page opened from
   * inside a sheet would otherwise stack on top of one.
   */
  const openShare = () => {
    router.back();
    router.push(INVITE_ROUTE);
  };

  const openProfile = (row: PeopleRow) => {
    haptics.commit();
    recent.remember(row.userId);
    router.back();
    router.push({ pathname: '/friends/[userId]', params: { userId: row.userId } });
  };

  const view: PeopleSearchView = {
    query,
    onChangeQuery: setQuery,
    onCancel: () => router.back(),
    shareHandle: me.data?.username || null,
    onShare: openShare,
    results: (search.data ?? []).map(rowFor),
    recent: recent.people.map(rowFor),
    // `isLoading` and not `isFetching`: the first answer to a new query is
    // what the skeletons stand in for. A background refetch of a list already
    // on screen must not replace it with grey bars.
    loading: search.isLoading,
    error: search.isError ? search.error : null,
    onRetry: () => void search.refetch(),
    onOpenProfile: openProfile,
    onAdd: addFriend,
    adding: follow.isPending,
    inputRef: searchRef,
    // The sheet exists because the user asked to search; opening it with the
    // keyboard down would make them ask twice.
    autoFocus: true,
  };

  return (
    <>
      <PeopleSearchBody view={view} large={fontScale >= PEOPLE_SEARCH_STACK_SCALE} />
      {terms.sheet}
    </>
  );
}

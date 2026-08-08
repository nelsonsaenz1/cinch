import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';

import {
  BlockConfirmSheet,
  FriendOverflowSheet,
  RemoveFriendDialog,
  ReportSheet,
} from '@/components/social/friend-sheets';
import { FriendsPage, type RequestRowModel } from '@/components/social/friends-page';
import type { RequestRowState, SearchRelation } from '@/components/social/friend-rows';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import { useMutedIds } from '@/features/social-graph/muted';
import { useFollow, useUnfollow } from '@/features/social-graph/mutations';
import {
  useFollowing,
  useFriendRequests,
  useFriends,
  useProfileSearch,
  useSentRequests,
} from '@/features/social-graph/queries';
import { useMyProfile } from '@/features/profile/queries';
import { type SocialProfile } from '@/features/social-graph/types';

/**
 * Requests the recipient has waved off, kept on the device and nowhere else.
 *
 * "Not now" writes nothing to the server, and that is the whole design: the
 * screen's own docblock promises the sender cannot detect being ignored, and
 * a `declined` row or a delete would be detectable. What the recipient gets
 * back is their screen — the row goes, quietly, on this phone. Re-sending
 * after a block or an unfollow produces a new edge and a new id, so a waved
 * request never traps a genuine second approach.
 */
const DISMISSED_KEY = 'cinch.friends.dismissedRequests.v1';

/** The one beat the accepted row holds its confirmation before sliding away. */
const ACCEPTED_BEAT_MS = 1400;
/** How long Undo lives on a waved-off row. */
const UNDO_WINDOW_MS = 5000;
/**
 * The gap between one transparent Modal fading out and the next fading in —
 * iOS refuses to present while a dismissal is still animating, so a follow-on
 * sheet opened in the same commit sometimes never appears.
 */
const SHEET_HANDOFF_MS = 280;

/** The queries' own people sort — named before nameless, then alphabetical. */
function byName(a: SocialProfile, b: SocialProfile): number {
  const an = a.displayName ?? a.username ?? '';
  const bn = b.displayName ?? b.username ?? '';
  if (!an && bn) return 1;
  if (an && !bn) return -1;
  return an.localeCompare(bn);
}

type RequestProfile = SocialProfile & { requestedAt: string };

/**
 * Friends — the circle, its requests, and the door in (atlas F-01…F-05).
 *
 * The vocabulary here is deliberately "friend", never "follow": under the hood
 * a request is one follow edge and accepting is following back (the mutual
 * pair IS the friendship), but the one-way verb belongs to a public-closet
 * phase this screen predates. Requests sit above friends because they are the
 * only thing here that asks for a decision; ignoring one is doing nothing,
 * which is exactly what the product promises the sender can't detect.
 *
 * This file is the state machine and the mutations; the render tree lives in
 * `FriendsPage` (components/social/friends-page.tsx), which `dev-friends`
 * mounts over fixtures.
 */
export default function FriendsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');

  const friends = useFriends();
  const requests = useFriendRequests();
  const sent = useSentRequests();
  const following = useFollowing();
  const search = useProfileSearch(query);
  const myProfile = useMyProfile();
  const follow = useFollow();
  const terms = useSocialTermsGate();
  const unfollow = useUnfollow();
  const block = useBlockUser();
  const report = useReportContent();
  const { isMuted, setMuted } = useMutedIds();

  // -------------------------------------------------------------------------
  // Waved-off requests — local, persisted, silent
  // -------------------------------------------------------------------------

  // Read once on mount, written back on each change. A read that fails leaves
  // the set empty, which shows every request — the safe direction to fail in:
  // a request nobody can see is worse than one somebody has to wave off twice.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids)) setDismissed(new Set(ids.filter((id) => typeof id === 'string')));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const writeDismissed = useCallback((mutate: (next: Set<string>) => void) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      mutate(next);
      void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // The request-row state machine (F-04) — per-row, no toasts, no alerts
  // -------------------------------------------------------------------------

  const [rowStates, setRowStates] = useState<Record<string, RequestRowState>>({});
  // Rows the accepted beat is still holding on screen after the queries have
  // already moved the person to Your friends — the invalidation must not be
  // allowed to snatch the confirmation line away early.
  const [held, setHeld] = useState<Record<string, RequestProfile>>({});
  // Accepts that have finished their beat, keyed userId → that request's
  // `requestedAt`. The timestamp matters: the entry hides only the exact
  // request that was accepted while the cache is stale — a later re-request
  // is a new edge with a new birth, so "either of you can ask again later"
  // stays true in this same session without any cache-watching effect.
  const [settledAccepts, setSettledAccepts] = useState<Record<string, string>>({});

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    };
  }, []);

  const setRowState = useCallback((id: string, state: RequestRowState | null) => {
    setRowStates((prev) => {
      const next = { ...prev };
      if (state === null) delete next[id];
      else next[id] = state;
      return next;
    });
  }, []);

  const armTimer = useCallback((id: string, ms: number, fire: () => void) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        fire();
      }, ms),
    );
  }, []);

  const acceptRequest = useCallback(
    (model: RequestRowModel) => {
      const id = model.profile.userId;
      const row: RequestProfile = { ...model.profile, requestedAt: model.requestedAt };
      // `run` rather than re-entering `acceptRequest`: a useCallback const
      // cannot be referenced from inside its own factory.
      const run = () => {
        setHeld((prev) => ({ ...prev, [id]: row }));
        setRowState(id, 'adding');
        follow.mutate(
          { userId: id },
          {
            onSuccess: () => {
              setRowState(id, 'accepted');
              void qc.invalidateQueries({ queryKey: ['sent-requests'] });
              armTimer(id, ACCEPTED_BEAT_MS, () => {
                setSettledAccepts((prev) => ({ ...prev, [id]: row.requestedAt }));
                setHeld((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setRowState(id, null);
              });
            },
            // The row reverts to unanswered and says so on itself. A failed
            // accept must never leave the user believing a friendship exists.
            //
            // The terms gate is not that kind of failure: it raises the sheet,
            // and the row only falls back to 'failed' if she declines — so
            // agreeing accepts the request she was already accepting.
            onError: (error) => {
              if (terms.intercept(error, run, () => setRowState(id, 'failed'))) return;
              setRowState(id, 'failed');
            },
          },
        );
      };
      run();
    },
    [follow, qc, setRowState, armTimer, terms],
  );

  const notNowRequest = useCallback(
    (profile: SocialProfile) => {
      const id = profile.userId;
      setRowState(id, 'dismissed');
      writeDismissed((next) => next.add(id));
      armTimer(id, UNDO_WINDOW_MS, () => setRowState(id, null));
    },
    [setRowState, writeDismissed, armTimer],
  );

  const undoNotNow = useCallback(
    (profile: SocialProfile) => {
      const id = profile.userId;
      const t = timers.current.get(id);
      if (t) {
        clearTimeout(t);
        timers.current.delete(id);
      }
      writeDismissed((next) => next.delete(id));
      setRowState(id, null);
    },
    [writeDismissed, setRowState],
  );

  /**
   * What the requests card renders: the query's rows plus any the accepted
   * beat is still holding, re-sorted with the queries' own comparator so a
   * held row keeps its place instead of jumping while the cache refetches.
   */
  const requestRows: RequestRowModel[] = useMemo(() => {
    const byId = new Map<string, RequestProfile>();
    for (const row of requests.data ?? []) byId.set(row.userId, row);
    for (const row of Object.values(held)) if (!byId.has(row.userId)) byId.set(row.userId, row);

    return [...byId.values()]
      .filter((row) => {
        if (settledAccepts[row.userId] === row.requestedAt) return false;
        const state = rowStates[row.userId];
        // Dismissed and past its undo window — gone from this device.
        if (dismissed.has(row.userId) && state !== 'dismissed') return false;
        return true;
      })
      .sort(byName)
      .map((row) => ({
        profile: row,
        requestedAt: row.requestedAt,
        state: rowStates[row.userId] ?? 'waiting',
      }));
  }, [requests.data, held, settledAccepts, rowStates, dismissed]);

  // -------------------------------------------------------------------------
  // Search (F-05)
  // -------------------------------------------------------------------------

  const searching = query.trim().replace(/^@/, '').length >= 2;

  // Requests sent from this screen's search, so the After-Add row can state
  // the mutual rule ("Asked · nothing opens until they say yes") rather than
  // the resting "Requested" a pre-existing pending edge gets.
  const [justAsked, setJustAsked] = useState<Set<string>>(() => new Set());
  const [searchPendingId, setSearchPendingId] = useState<string | null>(null);

  const friendIds = useMemo(
    () => new Set((friends.data ?? []).map((p) => p.userId)),
    [friends.data],
  );
  const followingIds = useMemo(() => new Set(following.data ?? []), [following.data]);
  const inboxIds = useMemo(
    () => new Set((requests.data ?? []).map((p) => p.userId)),
    [requests.data],
  );

  const relationFor = useCallback(
    (profile: SocialProfile & { isSelf: boolean }): SearchRelation => {
      if (profile.isSelf) return 'self';
      if (friendIds.has(profile.userId)) return 'friends';
      // They already asked — the same friendship must never be requested
      // twice, so the row offers Accept, not Add. Both edges present means
      // the friends query just hasn't caught up.
      if (inboxIds.has(profile.userId)) {
        return followingIds.has(profile.userId) ? 'friends' : 'accept';
      }
      if (justAsked.has(profile.userId)) return 'asked';
      if (followingIds.has(profile.userId)) return 'requested';
      return 'add';
    },
    [friendIds, inboxIds, followingIds, justAsked],
  );

  const searchRows = useMemo(
    () => (search.data ?? []).map((p) => ({ profile: p, relation: relationFor(p) })),
    [search.data, relationFor],
  );

  const addFromSearch = useCallback(
    (profile: SocialProfile) => {
      const run = () => {
        setSearchPendingId(profile.userId);
        follow.mutate(
          { userId: profile.userId },
          {
            onSuccess: () => {
              setJustAsked((prev) => new Set(prev).add(profile.userId));
              void qc.invalidateQueries({ queryKey: ['sent-requests'] });
            },
            // The mutation has already translated the errcodes (rate limits and
            // the rest) into a sentence; pass it through untouched.
            onError: (err) => {
              if (terms.intercept(err, run)) return;
              Alert.alert(
                'Could not send that request',
                err instanceof Error ? err.message : 'Something went wrong. Try again.',
              );
            },
            onSettled: () => setSearchPendingId(null),
          },
        );
      };
      run();
    },
    [follow, qc, terms],
  );

  const acceptFromSearch = useCallback(
    (profile: SocialProfile) => {
      const run = () => {
        setSearchPendingId(profile.userId);
        follow.mutate(
          { userId: profile.userId },
          {
            onError: (err) => {
              if (terms.intercept(err, run)) return;
              Alert.alert(
                'Could not accept just now',
                err instanceof Error ? err.message : 'Something went wrong. Try again.',
              );
            },
            onSettled: () => setSearchPendingId(null),
          },
        );
      };
      run();
    },
    [follow, terms],
  );

  /** Withdraw a just-sent ask. Silent, like every retreat here. */
  const cancelAsk = useCallback(
    (profile: SocialProfile) => {
      unfollow.mutate(
        { userId: profile.userId },
        {
          onSuccess: () => {
            setJustAsked((prev) => {
              const next = new Set(prev);
              next.delete(profile.userId);
              return next;
            });
            void qc.invalidateQueries({ queryKey: ['sent-requests'] });
          },
          onError: (err) =>
            Alert.alert(
              'Could not cancel that request',
              err instanceof Error ? err.message : 'Something went wrong. Try again.',
            ),
        },
      );
    },
    [unfollow, qc],
  );

  // -------------------------------------------------------------------------
  // The leaving sheets (F-06…F-08)
  // -------------------------------------------------------------------------

  const [overflowFor, setOverflowFor] = useState<
    (SocialProfile & { friendsSince?: string }) | null
  >(null);
  const [blockFor, setBlockFor] = useState<SocialProfile | null>(null);
  const [removeFor, setRemoveFor] = useState<SocialProfile | null>(null);
  const [reportFor, setReportFor] = useState<SocialProfile | null>(null);
  const [reportSent, setReportSent] = useState(false);

  /** One sheet at a time: the overflow fades out fully before its follow-on opens. */
  const afterOverflow = useCallback((open: () => void) => {
    setOverflowFor(null);
    setTimeout(open, SHEET_HANDOFF_MS);
  }, []);

  const openFriend = useCallback(
    (profile: SocialProfile) => {
      router.push({ pathname: '/friends/[userId]', params: { userId: profile.userId } });
    },
    [router],
  );

  const removeFriend = useCallback(() => {
    if (!removeFor) return;
    unfollow.mutate(
      { userId: removeFor.userId },
      {
        onSuccess: () => setRemoveFor(null),
        onError: (err) =>
          Alert.alert(
            'Could not remove',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  }, [removeFor, unfollow]);

  const blockUser = useCallback(() => {
    if (!blockFor) return;
    block.mutate(
      { userId: blockFor.userId },
      {
        onSuccess: () => setBlockFor(null),
        onError: (err) =>
          Alert.alert(
            'Could not block',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  }, [blockFor, block]);

  const submitReport = useCallback(
    ({ reason, blockToo }: { reason: string; blockToo: boolean }) => {
      if (!reportFor) return;
      const userId = reportFor.userId;
      // Block FIRST. Either failure leaves the form open with nothing
      // half-claimed, and a retry is safe end to end (re-blocking is a
      // swallowed 23505). Report-first could show a receipt promising a block
      // that then failed — a lie on a safety surface.
      const run = async () => {
        if (blockToo) await block.mutateAsync({ userId });
        await report.mutateAsync({
          subject: 'profile',
          subjectId: userId,
          subjectUserId: userId,
          reason,
        });
        setReportSent(true);
      };
      run().catch((err: unknown) =>
        Alert.alert(
          'Could not send that report',
          err instanceof Error ? err.message : 'Something went wrong. Try again.',
        ),
      );
    },
    [reportFor, block, report],
  );

  // -------------------------------------------------------------------------
  // Page-level derivations
  // -------------------------------------------------------------------------

  // All of them, because `refresh` refetches all of them — a pull that reports
  // done while one of its queries is still arriving is a lie about the data.
  const refreshing =
    friends.isRefetching || requests.isRefetching || sent.isRefetching || following.isRefetching;
  const refresh = useCallback(() => {
    void friends.refetch();
    void requests.refetch();
    void sent.refetch();
    void following.refetch();
  }, [friends, requests, sent, following]);

  const queriesSettled = !friends.isLoading && !requests.isLoading && !sent.isLoading;
  const showEmpty =
    queriesSettled &&
    !friends.isError &&
    !requests.isError &&
    !sent.isError &&
    !searching &&
    (friends.data ?? []).length === 0 &&
    requestRows.length === 0 &&
    (sent.data ?? []).length === 0;

  const username = myProfile.data?.username ?? '';
  const shareUsername = useCallback(() => {
    if (!username) return;
    void Share.share({ message: `Add me on Cinch — I’m @${username}.` }).catch(() => {});
  }, [username]);

  return (
    <>
      <FriendsPage
        query={query}
        onQueryChange={setQuery}
        searching={searching}
        searchLoading={search.isLoading}
        searchError={search.isError}
        searchRetrying={search.isRefetching}
        onRetrySearch={() => void search.refetch()}
        searchRows={searchRows}
        onAddFromSearch={addFromSearch}
        onAcceptFromSearch={acceptFromSearch}
        onCancelAsk={cancelAsk}
        searchPendingId={searchPendingId}
        requests={requestRows}
        requestsError={requests.isError}
        requestsRetrying={requests.isRefetching}
        onRetryRequests={() => void requests.refetch()}
        onAccept={acceptRequest}
        onNotNow={notNowRequest}
        onUndo={undoNotNow}
        onRetryAccept={acceptRequest}
        friends={friends.data ?? []}
        friendsLoading={friends.isLoading}
        friendsError={friends.isError}
        friendsRetrying={friends.isRefetching}
        onRetryFriends={() => void friends.refetch()}
        onOpenFriend={openFriend}
        onOverflow={(p) => setOverflowFor(p)}
        sent={sent.data ?? []}
        showEmpty={showEmpty}
        canShareUsername={username.length > 0}
        onShareUsername={shareUsername}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <FriendOverflowSheet
        profile={overflowFor}
        onClose={() => setOverflowFor(null)}
        isMuted={overflowFor ? isMuted(overflowFor.userId) : false}
        onViewCloset={() => {
          const p = overflowFor;
          setOverflowFor(null);
          if (p) openFriend(p);
        }}
        onMute={() => {
          if (overflowFor) setMuted(overflowFor.userId, !isMuted(overflowFor.userId));
          setOverflowFor(null);
        }}
        onRemove={() => {
          const p = overflowFor;
          afterOverflow(() => setRemoveFor(p));
        }}
        onReport={() => {
          const p = overflowFor;
          afterOverflow(() => {
            setReportSent(false);
            setReportFor(p);
          });
        }}
        onBlock={() => {
          const p = overflowFor;
          afterOverflow(() => setBlockFor(p));
        }}
      />

      <RemoveFriendDialog
        profile={removeFor}
        onClose={() => setRemoveFor(null)}
        onRemove={removeFriend}
        pending={unfollow.isPending}
      />

      <BlockConfirmSheet
        profile={blockFor}
        onClose={() => setBlockFor(null)}
        onBlock={blockUser}
        pending={block.isPending}
      />

      <ReportSheet
        profile={reportFor}
        onClose={() => {
          setReportFor(null);
          setReportSent(false);
        }}
        onSubmit={submitReport}
        pending={block.isPending || report.isPending}
        sent={reportSent}
        onDone={() => {
          setReportFor(null);
          setReportSent(false);
        }}
      />

      {terms.sheet}
    </>
  );
}

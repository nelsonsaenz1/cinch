import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { BorrowStatus } from '@/features/social/db-rows';

import { useAnswerBorrow, useCancelBorrow } from './mutations';
import { useBorrowRequests, useFriends } from './queries';
import { profileName, socialDb, type BorrowItemPreview, type BorrowThread, type SocialProfile } from './types';

/**
 * The Borrowing page's read model and its verbs.
 *
 * `useBorrowRequests` hands back hydrated threads; this file turns each one
 * into the exact sentence-and-meta pair the page prints, decides which rows
 * have earned silence (a withdrawn ask you never answered, anything settled
 * more than a week), and wraps the two mutations in the page's one behavioural
 * novelty: a five-second window in which a decline, a withdrawal, or a
 * mark-returned has visibly happened but nothing has been sent.
 */

// ---------------------------------------------------------------------------
// Words.
// ---------------------------------------------------------------------------

/**
 * The garment noun a borrow row speaks in: "silk blouse" beats "top", so the
 * subcategory wins when the tagger provided one. Lowercased because it sits
 * mid-sentence. A null item (a block or revoked friendship took the read path
 * away) still needs a noun — "piece" is the neutral one the app already uses.
 */
export function garmentNoun(
  item: Pick<BorrowItemPreview, 'category' | 'subcategory'> | null,
): string {
  return (item ? (item.subcategory ?? item.category) : 'piece').toLowerCase();
}

/**
 * First name only — a borrow row is a note between friends, and friends use
 * first names. `profileName` already resolves display name → username →
 * neutral noun; this only splits when there is a real display name to split,
 * so a username stays whole and "A Cinch member" is never truncated to "A".
 */
export function firstName(
  profile: Pick<SocialProfile, 'username' | 'displayName'> | null,
): string {
  if (!profile) return 'A Cinch member';
  const full = profileName(profile);
  if (profile.displayName) return full.split(/\s+/)[0] || full;
  return full;
}

// ---------------------------------------------------------------------------
// Time, as the rows print it.
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Local midnight — the boundary "yesterday" actually means (explore/timeline.ts). */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar days between two instants, in the user's own zone. */
function calendarDays(iso: string, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
}

/**
 * "10 minutes ago" · "2 hours ago" · "Yesterday" · "Monday" · "14 Jul".
 *
 * Fuller words than explore's `sinceLabel` on purpose: these sit as a row's
 * only meta line, not a caption abbreviation. Day tiers are calendar days, so
 * the string never disagrees with a wall clock across midnight. Weekday names
 * stop at six days back — a bare "Monday" is ambiguous beyond one week, and
 * only pending asks can live that long, so they fall through to a dated form.
 */
function relativeLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const then = at.getTime();
  if (Number.isNaN(then)) return '';

  const days = calendarDays(iso, now);
  if (days <= 0) {
    const elapsed = now.getTime() - then;
    if (elapsed < MINUTE) return 'Just now';
    if (elapsed < HOUR) {
      const m = Math.floor(elapsed / MINUTE);
      return `${m} minute${m === 1 ? '' : 's'} ago`;
    }
    const h = Math.max(1, Math.floor(elapsed / HOUR));
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return at.toLocaleDateString('en-US', { weekday: 'long' });
  return `${at.getDate()} ${at.toLocaleDateString('en-US', { month: 'short' })}`;
}

/**
 * The day a settled row closed: "Today" · "Yesterday" · a weekday name.
 * Settled rows age out after seven days, so a weekday is never ambiguous here.
 */
function dayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const days = calendarDays(iso, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString('en-US', { weekday: 'long' });
}

/** "Lent today" · "Lent yesterday" · "Lent 9 days ago" — elapsed as a fact, never a deadline. */
function lentLabel(iso: string, now: Date): string {
  const days = calendarDays(iso, now);
  if (days <= 0) return 'Lent today';
  if (days === 1) return 'Lent yesterday';
  return `Lent ${days} days ago`;
}

// ---------------------------------------------------------------------------
// Row model.
// ---------------------------------------------------------------------------

/** Every (direction, status) pair a row can render as. `incoming-canceled` is absent: the asker withdrew, and silence is the whole answer. */
export type BorrowRowKind =
  | 'incoming-pending'
  | 'incoming-approved'
  | 'incoming-declined'
  | 'incoming-returned'
  | 'outgoing-pending'
  | 'outgoing-approved'
  | 'outgoing-declined'
  | 'outgoing-canceled'
  | 'outgoing-returned';

export interface BorrowRowModel {
  thread: BorrowThread;
  /** Stable list key — the request id. */
  key: string;
  kind: BorrowRowKind;
  /** The one sentence the row is: "Dana asked for your silk blouse". */
  headline: string;
  /** The small line under it: a time, a day, or a stance ("Sort it out between you"). */
  meta: string;
  /** Settled rows render dimmed, smaller, verbless. */
  settled: boolean;
}

const SETTLED: ReadonlySet<BorrowStatus> = new Set(['declined', 'canceled', 'returned']);

/** How long a settled row stays before the page forgets it. */
const SETTLED_TTL = 7 * DAY;

/**
 * One thread → one row, or null for the rows this page never shows: an
 * incoming request its asker canceled, and anything settled more than a week
 * ago (`updatedAt` is when the status last moved, i.e. when it settled).
 *
 * The status switches are exhaustive over `BorrowStatus` — the DB check
 * constraint allows exactly these five — so a sixth status added later is a
 * compile error here, not a silently blank row.
 */
function toRowModel(thread: BorrowThread, now: Date): BorrowRowModel | null {
  const { request, direction, counterpart, item } = thread;
  const { status } = request;

  if (direction === 'incoming' && status === 'canceled') return null;
  if (SETTLED.has(status) && now.getTime() - new Date(request.updatedAt).getTime() > SETTLED_TTL) {
    return null;
  }

  const name = firstName(counterpart);
  const piece = garmentNoun(item);
  const settled = SETTLED.has(status);
  const base = { thread, key: request.id, settled };

  if (direction === 'incoming') {
    switch (status) {
      case 'pending':
        return {
          ...base,
          kind: 'incoming-pending',
          headline: `${name} asked for your ${piece}`,
          meta: relativeLabel(request.createdAt, now),
        };
      case 'approved':
        return {
          ...base,
          kind: 'incoming-approved',
          headline: `${name} has your ${piece}`,
          meta: lentLabel(request.updatedAt, now),
        };
      case 'declined':
        return {
          ...base,
          kind: 'incoming-declined',
          headline: `You declined ${name}’s ${piece}`,
          meta: dayLabel(request.updatedAt, now),
        };
      case 'returned':
        return {
          ...base,
          kind: 'incoming-returned',
          headline: `Your ${piece} is back`,
          meta: dayLabel(request.updatedAt, now),
        };
      case 'canceled':
        return null; // handled above; keeps the switch exhaustive
    }
  }

  switch (status) {
    case 'pending':
      return {
        ...base,
        kind: 'outgoing-pending',
        headline: `You asked ${name} for her ${piece}`,
        meta: `${relativeLabel(request.createdAt, now)} · no answer yet`,
      };
    case 'approved':
      return {
        ...base,
        kind: 'outgoing-approved',
        headline: `${name} said yes to her ${piece}`,
        meta: 'Sort it out between you',
      };
    case 'declined':
      return {
        ...base,
        kind: 'outgoing-declined',
        headline: `${name} can’t lend her ${piece}`,
        meta: dayLabel(request.updatedAt, now),
      };
    case 'canceled':
      return {
        ...base,
        kind: 'outgoing-canceled',
        headline: 'You withdrew your ask',
        meta: dayLabel(request.updatedAt, now),
      };
    case 'returned':
      return {
        ...base,
        kind: 'outgoing-returned',
        headline: `${name} has her ${piece} back`,
        meta: dayLabel(request.updatedAt, now),
      };
  }
}

export interface BorrowScreenModel {
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => void;
  /**
   * Whether the empty state may honestly say "add friends first". A failed
   * friends read resolves true: the quieter empty copy is the safe wrong
   * answer, a "Find friends" push at someone who has friends is not.
   */
  hasFriends: boolean;
  /** "Asked of you" — newest first. */
  incoming: BorrowRowModel[];
  /** "You asked" — newest first. */
  outgoing: BorrowRowModel[];
}

/**
 * Everything the Borrowing page renders from, in one hook. The friends query
 * rides along only to pick between the two empty states, so its loading gates
 * the page (choosing the wrong empty copy is worse than one more skeleton
 * beat) but its errors do not.
 */
export function useBorrowScreenModel(): BorrowScreenModel {
  const requests = useBorrowRequests();
  const friends = useFriends();

  const { incoming, outgoing } = useMemo(() => {
    const now = new Date();
    const rows = (requests.data ?? [])
      .flatMap((thread) => {
        const row = toRowModel(thread, now);
        return row ? [row] : [];
      })
      // The query already orders newest-first; re-assert it so this file owns
      // the promise. ISO timestamptz strings sort lexicographically.
      .sort((a, b) => (a.thread.request.createdAt > b.thread.request.createdAt ? -1 : 1));

    return {
      incoming: rows.filter((r) => r.thread.direction === 'incoming'),
      outgoing: rows.filter((r) => r.thread.direction === 'outgoing'),
    };
  }, [requests.data]);

  const refetchRequests = requests.refetch;
  const refetchFriends = friends.refetch;
  const refetch = useCallback(() => {
    void refetchRequests();
    void refetchFriends();
  }, [refetchRequests, refetchFriends]);

  return {
    isLoading: requests.isLoading || friends.isLoading,
    isError: requests.isError,
    isRefetching: requests.isRefetching,
    refetch,
    hasFriends: friends.isError ? true : (friends.data?.length ?? 0) > 0,
    incoming,
    outgoing,
  };
}

// ---------------------------------------------------------------------------
// Actions: lend now, everything else five seconds from now.
// ---------------------------------------------------------------------------

/** The statuses a deferred action lands a row in while it waits to be sent. */
export type BorrowLocalStatus = Extract<BorrowStatus, 'declined' | 'canceled' | 'returned'>;

export interface BorrowToast {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

interface DeferredCommit {
  requestId: string;
  status: BorrowLocalStatus;
  timer: ReturnType<typeof setTimeout>;
}

export interface BorrowActions {
  /** Immediate — the lend sheet's confirm button is the guard, not a timer. */
  lend: (thread: BorrowThread) => void;
  lendIsPending: boolean;
  /** Deferred: the row settles in local UI now, the mutation fires in 5s unless undone. */
  decline: (thread: BorrowThread) => void;
  withdraw: (thread: BorrowThread) => void;
  markReturned: (thread: BorrowThread) => void;
  /**
   * Request id → the settled status the page should render it in right now.
   * Overrides persist past a successful commit (the cache catches up on
   * invalidation and agrees) and are removed only by Undo or by failure.
   */
  pendingLocal: Record<string, BorrowLocalStatus>;
  toast: BorrowToast | null;
  dismissToast: () => void;
}

/**
 * The page's verbs. Lend commits on tap. Decline, withdraw and mark-returned
 * are deferred: the row leaves its live state immediately (via
 * `pendingLocal`), an undo toast opens a five-second window, and only when it
 * closes does the mutation fire — Undo restores the row with nothing sent.
 * A second deferred action while one is waiting flushes the first at once.
 * On failure the override is dropped (the row snaps back to the truth) and
 * the toast offers Retry, which re-fires the same commit immediately.
 */
export function useBorrowActions(): BorrowActions {
  const answerBorrow = useAnswerBorrow();
  const cancelBorrow = useCancelBorrow();

  const [pendingLocal, setPendingLocal] = useState<Record<string, BorrowLocalStatus>>({});
  const [toast, setToast] = useState<BorrowToast | null>(null);

  // The one in-flight window. A ref, not state: the unmount cleanup and the
  // flush-on-second-action path both need the current value synchronously.
  const deferredRef = useRef<DeferredCommit | null>(null);
  const mountedRef = useRef(true);

  const answerMutate = answerBorrow.mutateAsync;
  const cancelMutate = cancelBorrow.mutateAsync;

  const send = useCallback(
    (requestId: string, status: BorrowLocalStatus): Promise<void> => {
      if (status === 'canceled') return cancelMutate({ id: requestId }).then(() => undefined);
      return answerMutate({ id: requestId, answer: status }).then(() => undefined);
    },
    [answerMutate, cancelMutate],
  );

  // Retry re-fires the same commit, and a callback cannot close over itself —
  // the ref hands the latest commit to the toast's event handler instead.
  const commitRef = useRef<(requestId: string, status: BorrowLocalStatus) => void>(() => {});

  const commit = useCallback(
    (requestId: string, status: BorrowLocalStatus) => {
      send(requestId, status).catch(() => {
        if (!mountedRef.current) return;
        // Nothing optimistic survives a failure: the row snaps back…
        setPendingLocal((prev) => {
          const { [requestId]: _dropped, ...rest } = prev;
          return rest;
        });
        // …and the toast owns up, with the same commit one tap away.
        setToast({
          message: 'Couldn’t send that. It stayed unanswered.',
          actionLabel: 'Retry',
          onAction: () => {
            setToast(null);
            setPendingLocal((prev) => ({ ...prev, [requestId]: status }));
            commitRef.current(requestId, status);
          },
        });
      });
    },
    [send],
  );

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  /** Close the open window now: clear its timer and fire its mutation. */
  const flush = useCallback(() => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    deferredRef.current = null;
    clearTimeout(deferred.timer);
    commit(deferred.requestId, deferred.status);
  }, [commit]);

  const defer = useCallback(
    (thread: BorrowThread, status: BorrowLocalStatus, message: string) => {
      flush(); // at most one window at a time; the older action is sent, not lost

      const requestId = thread.request.id;
      setPendingLocal((prev) => ({ ...prev, [requestId]: status }));
      setToast({
        message,
        actionLabel: 'Undo',
        onAction: () => {
          const deferred = deferredRef.current;
          if (deferred?.requestId !== requestId) return;
          deferredRef.current = null;
          clearTimeout(deferred.timer);
          setPendingLocal((prev) => {
            const { [requestId]: _dropped, ...rest } = prev;
            return rest;
          });
          setToast(null);
        },
      });
      deferredRef.current = {
        requestId,
        status,
        timer: setTimeout(() => {
          deferredRef.current = null;
          if (mountedRef.current) setToast(null);
          commit(requestId, status);
        }, 5000),
      };
    },
    [flush, commit],
  );

  // Leaving the page must not lose a taken action: an open window commits on
  // unmount (the tap already happened; only the chance to undo expires).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const deferred = deferredRef.current;
      if (!deferred) return;
      deferredRef.current = null;
      clearTimeout(deferred.timer);
      void send(deferred.requestId, deferred.status).catch(() => {
        // Nowhere left to show a toast; the row simply stays live on return.
      });
    };
  }, [send]);

  // Same shape as commitRef: Retry re-invokes the lend it belongs to.
  const lendRef = useRef<(thread: BorrowThread) => void>(() => {});

  const lend = useCallback(
    (thread: BorrowThread) => {
      answerMutate({ id: thread.request.id, answer: 'approved' }).catch(() => {
        if (!mountedRef.current) return;
        setToast({
          message: 'Couldn’t send that. It stayed unanswered.',
          actionLabel: 'Retry',
          onAction: () => {
            setToast(null);
            lendRef.current(thread);
          },
        });
      });
    },
    [answerMutate],
  );

  useEffect(() => {
    lendRef.current = lend;
  }, [lend]);

  const decline = useCallback(
    (thread: BorrowThread) =>
      defer(thread, 'declined', `Declined. ${firstName(thread.counterpart)} won’t be told when.`),
    [defer],
  );

  const withdraw = useCallback(
    (thread: BorrowThread) =>
      defer(thread, 'canceled', `Withdrawn. ${firstName(thread.counterpart)} won’t be told.`),
    [defer],
  );

  const markReturned = useCallback(
    (thread: BorrowThread) => defer(thread, 'returned', 'Returned. Back in your closet.'),
    [defer],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    lend,
    lendIsPending: answerBorrow.isPending,
    decline,
    withdraw,
    markReturned,
    pendingLocal,
    toast,
    dismissToast,
  };
}

// ---------------------------------------------------------------------------
// The lend sheet's one number.
// ---------------------------------------------------------------------------

/**
 * `wear_count` for one of the owner's own garments — the "Yours · 12 wears"
 * line on the lend sheet. A narrow two-column-style read in the
 * `useItemBorrowable` mould rather than a `useCloset` ride-along: the sheet
 * needs one number for one item, not the whole wardrobe. Resolves null (never
 * zero) while unknown or on failure, so the sheet omits the line instead of
 * printing a claim it cannot back.
 */
export function useOwnItemWears(itemId: string | null): number | null {
  const query = useQuery({
    queryKey: ['own-item-wears', itemId],
    enabled: Boolean(itemId),
    queryFn: async (): Promise<number> => {
      if (!itemId) return 0; // `enabled` already guards; this narrows the type
      const { data, error } = await socialDb
        .from('items')
        .select('wear_count')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return Number((data as { wear_count: number } | null)?.wear_count ?? 0);
    },
  });

  return query.data ?? null;
}

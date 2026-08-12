import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { ActivityPage } from '@/components/activity/ActivityPage';
import { useActivityAnswers } from '@/features/activity/answers';
import { useActivity, useMarkActivitySeen } from '@/features/activity/queries';
import { mergeRetained } from '@/features/activity/retention';
import type { ActivityActionId, ActivityLine } from '@/features/activity/sentence';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';

/**
 * Activity — the one page for the seven things that already happen.
 *
 * `cinch://activity`. Reached from the Today tab, which carries the dot; the
 * integrator wires that with `useHasUnseenActivity()` and this screen clears it
 * with `useMarkActivitySeen()`.
 *
 * **What this page will not do**, restated where it can be enforced:
 *
 * - **No counts.** The tab shows a dot, never a number; no row carries an
 *   unread pill. Nothing here is scored.
 * - **No aggregation into strangers.** Every row names a friend you already
 *   have, or an object in your own closet — the SQL guarantees it by filtering
 *   every branch of the union to rows whose subject is you.
 * - **No marking read as a chore.** Opening the page clears the dot. There is
 *   no "mark all read" and no way to write one.
 * - **No infinite history.** Thirty days, bounded in SQL, with no pagination to
 *   reach past it. Older answers live on the object — the event, the item, the
 *   friend.
 */
export default function ActivityScreen() {
  const router = useRouter();

  const activity = useActivity();
  const markSeen = useMarkActivitySeen();
  const terms = useSocialTermsGate();
  const answers = useActivityAnswers({ intercept: terms.intercept });

  // Opening the page IS the gesture that clears the dot — once per mount, and
  // never in response to a render. A ref rather than local state because
  // "have I already fired this" is not something the page renders, and state
  // set from an effect is the thing lint refuses on sight.
  const marked = useRef(false);
  const mark = markSeen.mutate;
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    mark();
  }, [mark]);

  // Answered rows have left the feed by definition — lending flips a request
  // out of `pending`, adding back changes the row's kind, "Not now" writes the
  // dismissal the SQL filters on — so they are merged back at their own place.
  const lines = useMemo(
    () => mergeRetained(activity.lines, answers.retained),
    [activity.lines, answers.retained],
  );

  const navigate = (line: ActivityLine, actionId: ActivityActionId) => {
    const { row } = line;
    if (actionId === 'open-event' && row.eventId) {
      router.push({ pathname: '/event/[id]', params: { id: row.eventId } });
      return;
    }
    if (actionId === 'see-votes' && row.eventId) {
      // The look board, where the votes actually are — not a tally screen.
      router.push({ pathname: '/event/[id]/outfits', params: { id: row.eventId } });
      return;
    }
    if (actionId === 'see-closet' && row.actorId) {
      router.push({ pathname: '/friends/[userId]', params: { userId: row.actorId } });
    }
  };

  return (
    <>
      <ActivityPage
        status={activity.isError ? 'error' : activity.isLoading ? 'loading' : 'ready'}
        lines={lines}
        faces={activity.faces}
        stateOf={answers.stateOf}
        onAnswer={answers.answer}
        onUndo={answers.undo}
        onNavigate={navigate}
        onRetry={activity.refetch}
        isRefetching={activity.isRefetching}
        onRefresh={activity.refetch}
      />
      {terms.sheet}
    </>
  );
}

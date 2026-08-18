import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ActivityBody, ClearAllDialog } from '@/components/activity-center';
import { useToast } from '@/components/ui/toast-host';
import { useActivityAnswers } from '@/features/activity/answers';
import {
  useActivity,
  useActivitySeenAt,
  useMarkActivitySeen as useMarkLegacySeen,
} from '@/features/activity/queries';
import { mergeRetained } from '@/features/activity/retention';
// Aliased at the import, because both taxonomies export a type of each name and
// this file is the one place they meet. `Legacy*` is the AV feed's vocabulary;
// the bare names are the Activity Center's.
import type {
  ActivityActionId as LegacyActionId,
  ActivityLine as LegacyLine,
} from '@/features/activity/sentence';
import {
  activityActionProps,
  activityFailedProps,
  activityItemOpenedProps,
  activityOpenedProps,
  ACTIVITY_EVENTS,
  classifyActivityError,
} from '@/features/activity-center/analytics';
import { UNDO, UNDO_DISMISSED } from '@/features/activity-center/copy';
import { buildSections } from '@/features/activity-center/grouping';
import { hasNew, isEmpty, mergeLegacy } from '@/features/activity-center/merge';
import {
  useClearAllActivity,
  useDismissActivityEvent,
  useMarkActivitySeen,
  useUndoDismissActivityEvent,
} from '@/features/activity-center/mutations';
import { useActivityCenter } from '@/features/activity-center/queries';
import {
  spokenElapsed,
  type ActivityActionId,
  type ActivityLine,
} from '@/features/activity-center/sentence';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/circles/mutations';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';

/**
 * The Activity Center — AC-01 through AC-10, redrawn by REDESIGN 28.
 *
 * `cinch://activity`. Reached by a PUSH from the Daily Social header
 * (`ActivityEntryButton`), never from the tab bar, so it cannot compete for
 * attention with the four destinations that live there. §13.
 *
 * This file is the WIRING — two queries, five mutations, the seen stamp and the
 * analytics. Everything drawn lives in `components/activity-center/
 * activity-body.tsx`, which is what lets the eight `dev-av-*` fixtures pose
 * every state against the same component the app mounts.
 *
 * ── ONE PAGE, TWO SOURCES ─────────────────────────────────────────────────
 *
 * This screen renders the new recipient-scoped `activity_events` rows AND the
 * older derived `activity_feed()` rows, interleaved by timestamp. The two
 * taxonomies do not overlap in a single member — no follow, borrow, vote or
 * compliment in one; no circle or Daily Social reaction in the other — and
 * shipping them as two screens would have been the worst available outcome:
 * two inboxes, two places to check, two dots. `features/activity-center/
 * merge.ts` is where the interleaving lives and argues itself.
 *
 * The legacy rows keep their own component (`components/activity/ActivityRow`)
 * with its answer states, its undo and its retry. Redesign 28 gave that
 * component the merged list's measurements and nothing else.
 *
 * ── WHAT THIS PAGE WILL NOT DO ────────────────────────────────────────────
 *
 * · **No count.** The entry glyph carries a boolean dot; no row carries an
 *   unread pill; `activity_has_unseen()` is an `exists` and there is no number
 *   anywhere between the database and the screen for somebody to render later.
 * · **No ranking.** Sections partition an already-sorted list and never sort.
 *   Collapsed groups take the position of their newest member.
 * · **No read receipts.** `seen_at` is written here and readable by nobody but
 *   its own recipient. Nothing is sent to the actor of any event.
 * · **No "mark all read".** Opening the page is the whole gesture.
 * · **No infinite history.** Thirty days, enforced by the purge job. There is
 *   no pagination to reach past it and no window filter here to disagree with
 *   it, and the colophon at the foot of every state says so.
 */
export default function ActivityScreen() {
  const router = useRouter();
  const toast = useToast();

  // A single `now` for the whole render, so the section boundaries, the stamps
  // and the spoken elapsed labels cannot disagree with each other mid-page.
  const now = useMemo(() => new Date(), []);

  const centre = useActivityCenter(now);
  const legacy = useActivity(now);
  const legacySeen = useActivitySeenAt();

  const markSeen = useMarkActivitySeen();
  const markLegacySeen = useMarkLegacySeen();

  const terms = useSocialTermsGate();
  const answers = useActivityAnswers({ intercept: terms.intercept });

  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const dismiss = useDismissActivityEvent();
  const undo = useUndoDismissActivityEvent();
  const clearAll = useClearAllActivity();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Answered legacy rows have left the feed by definition, so they are merged
  // back at their own place — the arrangement `retention.ts` explains.
  const legacyLines = useMemo(
    () => mergeRetained(legacy.lines, answers.retained),
    [legacy.lines, answers.retained],
  );

  const sections = useMemo(
    () => mergeLegacy(buildSections(centre.lines, now), legacyLines, legacySeen.data ?? null, now),
    [centre.lines, legacyLines, legacySeen.data, now],
  );

  const loading = centre.isLoading || legacy.isLoading;
  const failed = centre.isError || legacy.isError;
  const cached = !loading && failed && !isEmpty(sections);
  const blank = !loading && !failed && isEmpty(sections);

  /**
   * Opening the page IS the gesture that clears the dot — once per mount, and
   * never in response to a render.
   *
   * A ref rather than local state because "have I already fired this" is not
   * something the page renders, and state set from an effect is the thing lint
   * refuses on sight. Both sources are stamped: the two halves of the `New`
   * section have to clear together or the dot outlives the reading of it.
   *
   * NEITHER STAMP REFETCHES THE LIST, deliberately. If it did, every row would
   * come back with a `seen_at` and the `New` heading the reader is looking at
   * would dissolve under them mid-scroll. The rows stay New for the visit that
   * found them, and are Earlier on the next one. The artifact names this
   * exactly: "the transition happens between visits, not under the reader's
   * eyes."
   */
  const marked = useRef(false);
  const stampSeen = markSeen.mutate;
  const stampLegacy = markLegacySeen.mutate;
  useEffect(() => {
    if (marked.current || loading) return;
    marked.current = true;
    stampSeen();
    stampLegacy();
  }, [loading, stampSeen, stampLegacy]);

  /**
   * `activity_opened`, once, when the page has actually resolved.
   *
   * Fired from the commit that has DATA rather than from the mount, for the
   * same reason `outfit_set_viewed` is: an open counted while the read is still
   * in flight is an open whose `had_unseen` is a guess, and the whole value of
   * that boolean is that it says whether anything was waiting.
   */
  const reported = useRef(false);
  const hadUnseen = hasNew(sections);
  useEffect(() => {
    if (reported.current || loading) return;
    reported.current = true;
    if (failed) {
      track(
        ACTIVITY_EVENTS.failed,
        activityFailedProps({ errorClass: classifyActivityError(centre.error), surface: 'activity' }),
      );
      return;
    }
    track(
      ACTIVITY_EVENTS.opened,
      activityOpenedProps({ hadUnseen, latencyMs: Date.now() - now.getTime() }),
    );
  }, [loading, failed, hadUnseen, centre.error, now]);

  const refresh = () => {
    centre.refetch();
    legacy.refetch();
  };

  const retry = () => {
    track(ACTIVITY_EVENTS.action, activityActionProps({ action: 'retry', surface: 'activity' }));
    refresh();
  };

  // -------------------------------------------------------------------------
  // Row handlers
  // -------------------------------------------------------------------------

  /**
   * Open a row's detail.
   *
   * Routed by `pathname` + `params` rather than by pushing `line.href` as a
   * string: typed routes check the first form and cannot check the second, and
   * the whole value of `href` is that it is the DEEP LINK — the thing a URL
   * from outside the app resolves to, and the thing
   * `tests/activity-center-sentence.test.ts` asserts about. Pushing it directly
   * would have made the two forms drift with nothing to catch it.
   */
  const openLine = (line: ActivityLine, wasGrouped: boolean) => {
    if (!line.href) return;
    track(
      ACTIVITY_EVENTS.itemOpened,
      activityItemOpenedProps({
        eventType: line.event.type,
        wasGrouped,
        isRevoked: Boolean(line.event.revokedAt),
      }),
    );
    if (line.event.type === 'circle.invite.received') {
      router.push({ pathname: '/activity/invitation/[id]', params: { id: line.event.id } });
      return;
    }
    if (line.event.type === 'daily.reaction.received') {
      router.push({ pathname: '/activity/reaction/[id]', params: { id: line.event.id } });
    }
  };

  const answerInvitation = (line: ActivityLine, action: ActivityActionId) => {
    const circleId = line.event.circleId;
    if (!circleId) return;
    if (action === 'accept') {
      // §10: `notificationSuccess` on accept, `impactLight` on decline. The
      // house policy names those by intent rather than by strength.
      accept.mutate(
        { circleId },
        { onSuccess: () => haptics.success(), onError: () => haptics.failure() },
      );
      return;
    }
    haptics.commit();
    decline.mutate({ circleId });
  };

  /**
   * Remove one row, with the five-second reversal.
   *
   * `duration: null` because the caller owns the window — the toast host refuses
   * an `onAction` on its own timer, since a reversal the caller cannot honour is
   * worse than no reversal at all. The mutation has already fired (the row is
   * gone optimistically and soft-deleted on the server); Undo un-deletes it,
   * which is a real reversal against a real row rather than a cancelled
   * intention.
   */
  const removeLine = (line: ActivityLine) => {
    dismiss.mutate({ id: line.event.id, eventType: line.event.type });
    toast.show(`${UNDO_DISMISSED} · ${line.spoken}`, {
      actionLabel: UNDO,
      duration: null,
      onAction: () => {
        undo.mutate({ id: line.event.id });
        toast.dismiss();
      },
    });
    // The undo window, owned here because the data layer owns it: the server
    // purges a dismissed row a minute later, and this is the on-screen half.
    setTimeout(() => toast.dismiss(), 5_000);
  };

  const navigateLegacy = (line: LegacyLine, actionId: LegacyActionId) => {
    const { row } = line;
    if (actionId === 'open-event' && row.eventId) {
      router.push({ pathname: '/event/[id]', params: { id: row.eventId } });
      return;
    }
    if (actionId === 'see-votes' && row.eventId) {
      router.push({ pathname: '/event/[id]/outfits', params: { id: row.eventId } });
      return;
    }
    if (actionId === 'see-closet' && row.actorId) {
      router.push({ pathname: '/friends/[userId]', params: { userId: row.actorId } });
    }
  };

  /** The actor's photograph, or nothing — `Avatar` falls back to initials. */
  const faceFor = (line: ActivityLine): string | null =>
    (line.event.actorId ? centre.faces.get(line.event.actorId) : null) ?? null;

  const legacyFaceFor = (line: LegacyLine): string | null =>
    (line.row.actorId ? legacy.faces.get(line.row.actorId) : null) ?? null;

  /**
   * `Edit` / `Done`, and — while editing — the Clear all bar above the colophon.
   *
   * Withheld on an empty, loading or failed page, because a control that edits
   * nothing is a control that teaches the reader it does nothing. Passing
   * `undefined` rather than a flag is what makes that structural: the masthead
   * has no branch for "editable but with nothing to edit".
   */
  const editable = !(blank || loading || (failed && !cached));

  return (
    <>
      <ActivityBody
        status={loading ? 'loading' : failed && !cached ? 'error' : 'ready'}
        sections={sections}
        cached={cached}
        editing={editing}
        onToggleEdit={editable ? () => setEditing((was) => !was) : undefined}
        onBack={() => router.back()}
        onRetry={retry}
        lastUpdated={
          centre.updatedAt ? spokenElapsed(new Date(centre.updatedAt).toISOString(), now) : null
        }
        isRefetching={centre.isRefetching || legacy.isRefetching}
        onRefresh={() => {
          // §10: `impactLight` at the pull threshold. `commit()` is the
          // policy's name for that weight.
          haptics.commit();
          refresh();
        }}
        faceFor={faceFor}
        onOpenLine={openLine}
        onAction={answerInvitation}
        onRemoveLine={removeLine}
        answering={accept.isPending || decline.isPending}
        legacyFaceFor={legacyFaceFor}
        legacyStateOf={answers.stateOf}
        onLegacyAnswer={(line, actionId) => answers.answer(line, actionId)}
        onLegacyNavigate={navigateLegacy}
        onLegacyUndo={(line) => answers.undo(line)}
        onClearAll={() => {
          setConfirming(true);
        }}
      />

      <ClearAllDialog
        visible={confirming}
        pending={clearAll.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          clearAll.mutate(undefined, {
            onSettled: () => {
              setConfirming(false);
              setEditing(false);
            },
          })
        }
      />

      {terms.sheet}
    </>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CorrectionSheet, type CorrectionDraft, type CorrectionField } from '@/components/intake/CorrectionSheet';
import { CountStepper } from '@/components/intake/CountStepper';
import { GarmentCard } from '@/components/intake/GarmentCard';
import { WalkthroughChrome } from '@/components/intake/walkthrough-parts';
import { Button, RouteState, Skeleton, Text } from '@/components/ui';
import { PLANS } from '@/features/billing/plans';
import { commitIntake } from '@/features/intake/actions';
import { intakeCardEdited } from '@/features/intake/analytics';
import { positionLabel } from '@/features/intake/procession';
import { useDrafts, resumeCursor, type IntakeDraftRow } from '@/features/intake/queries';
import { useProcession } from '@/features/intake/use-procession';
import { useBoundedLoad } from '@/lib/use-bounded-load';

/**
 * The procession — V-06, V-07, V-09, V-10, then out to the Reveal.
 *
 * V-08 (the photograph) is deliberately not built here. It is optional by
 * design, never gated, and it belongs to the existing capture pipeline rather
 * than to this screen; the card exposes the affordance and this route routes
 * it. A drawn closet is a finished closet (refusal 2).
 *
 * WHY THE CURSOR COMES FROM THE SERVER AND NOT FROM STATE
 *
 * `intake_sessions.cursor` is written as the user walks (see `use-procession`),
 * so a cold start resumes where they stopped. `resumeCursor()` clamps it
 * against the draft count, which matters because a session can be resumed after
 * the ceiling trimmed the drafts underneath it.
 */

/**
 * The wait, shaped like the card it becomes.
 *
 * The old one was `<Skeleton />` with no class, which Yoga lays out at zero
 * height — the screen was blank, not shimmering. This reserves the garment
 * card's own anatomy (the position line, the big name, the attribute rows, the
 * two answers at the thumb) so the page does not jump when the first draft
 * lands, and so the wait itself says what is coming.
 */
function ReviewSkeleton() {
  return (
    <View className="flex-1 px-gutter pt-6" accessibilityLabel="Reading what you said">
      <Skeleton className="h-3 w-24 rounded-chip" />
      <Skeleton className="mt-6 h-9 w-4/5 rounded-sm" delay={80} />
      <Skeleton className="mt-3 h-9 w-3/5 rounded-sm" delay={160} />
      <View className="mt-10 gap-3">
        <Skeleton className="h-4 w-2/3 rounded-chip" delay={240} />
        <Skeleton className="h-4 w-1/2 rounded-chip" delay={320} />
        <Skeleton className="h-4 w-3/5 rounded-chip" delay={400} />
      </View>
      <View className="mt-auto gap-3 pb-6">
        <Skeleton className="h-12 w-full rounded-chip" delay={480} />
        <Skeleton className="h-12 w-full rounded-chip" delay={560} />
      </View>
    </View>
  );
}

export default function WalkthroughReviewScreen() {
  const router = useRouter();
  const { session } = useLocalSearchParams<{ session?: string }>();
  const sessionId = session ?? null;

  const drafts = useDrafts(sessionId);
  const rows = useMemo(() => drafts.data ?? [], [drafts.data]);

  const procession = useProcession(sessionId, rows, resumeCursor(0, rows.length));

  /**
   * The bound. `empty` is deliberately NOT set: a session whose drafts came
   * back as an empty list is the procession's own "nothing kept" ending, and
   * `procession.finished` already draws it with the count and the way on. An
   * empty state here would replace a designed ending with an apology.
   */
  const load = useBoundedLoad({
    loading: drafts.isPending,
    error: drafts.isError,
    retrying: drafts.isRefetching,
    onRetry: () => void drafts.refetch(),
  });

  /**
   * Deep-linkable, so `back()` is not guaranteed to have anywhere to go. The
   * fallback is the walkthrough's own start rather than the tab bar: somebody
   * who cannot review what they spoke wants to speak it again.
   */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/walkthrough');
  }, [router]);

  const [correcting, setCorrecting] = useState<CorrectionField | null | undefined>(undefined);
  const [committing, setCommitting] = useState(false);

  const draft = procession.draft;

  const onSave = useCallback(
    (next: CorrectionDraft) => {
      procession.dispatch({
        type: 'edit',
        patch: {
          name: next.name,
          slot: next.slot,
          colour_term: next.colourTerm,
          fabric: next.fabric,
          pattern: next.pattern,
          formality: next.formality,
          warmth: next.warmth,
        } as Partial<IntakeDraftRow>,
      });
      intakeCardEdited('name');
      setCorrecting(undefined);
    },
    [procession],
  );

  /**
   * The end of the procession. `commit_intake_session` stops cleanly at the
   * plan ceiling and reports what it held back, which is what makes M-07 a
   * designed screen rather than a check-violation — see the directive's §5.2 on
   * why drafts are staged instead of written straight to `items`.
   *
   * A `held` above zero routes to `/walkthrough/ceiling` — M-07's explainer and
   * M-08's "keep ten for now" picker — instead of straight to `/reveal`. Reveal
   * has no opinion about which pieces are active; that choice belongs to the
   * ceiling screen, and by the time it hands off, the choice has already been
   * made (see `resolveIntakeCeiling`).
   */
  const commit = useCallback(async () => {
    if (!sessionId) return;
    setCommitting(true);
    try {
      const { committed, held } = await commitIntake(sessionId, procession.confirmed);
      router.replace(
        held > 0 ? `/walkthrough/ceiling?session=${sessionId}&committed=${committed}` : '/reveal',
      );
    } finally {
      setCommitting(false);
    }
  }, [sessionId, router, procession.confirmed]);

  /**
   * UX #38 — this screen's three route-level states were full-screen traps.
   *
   * They were three one-liners: an `ErrorState` with a title and nothing else,
   * a bare `<Skeleton />` (which, with no className, is a zero-height view —
   * a genuinely blank screen), and a second title-only `ErrorState`. None of
   * them had a way back, none had a retry, and the middle one had no bound:
   * a `useDrafts` that never settled left a person who had just spoken their
   * whole wardrobe looking at an empty canvas with no exit.
   *
   * `RouteState` supplies the way back at all three, `useBoundedLoad` supplies
   * the bound, and the skeleton below is card-shaped so the wait says what is
   * coming.
   */
  if (!sessionId) {
    return (
      <RouteState
        state="error"
        title="Walkthrough"
        onBack={leave}
        backLabel="Back to the walkthrough"
        // No retry: there is no session id to read, so a second read of
        // nothing would fail identically. The way out is the whole recovery.
        errorCopy={{
          title: 'There’s no walkthrough to review',
          body: 'This screen was opened without a walkthrough behind it. Nothing was lost — start one and the pieces you speak will land here.',
        }}
      />
    );
  }

  if (load.state !== 'content') {
    return (
      <RouteState
        state={load.state}
        title="Walkthrough"
        onBack={leave}
        backLabel="Back to the walkthrough"
        skeleton={<ReviewSkeleton />}
        errorCopy={{
          title: 'Couldn’t read what you said',
          body: 'Cinch couldn’t reach the pieces from this walkthrough just now. They are still saved — this is a connection problem, not lost work.',
        }}
        onRetry={load.retry}
        retrying={load.retrying}
      />
    );
  }

  // ── After the last card ────────────────────────────────────────────────
  if (procession.finished) {
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          {/* The end of the list reads top-down like every other phase of the
              walkthrough, rather than sitting on the floor of the screen: the
              count is the headline, the promise is the line under it, and the
              one action is at the thumb. */}
          <WalkthroughChrome />
          <View className="flex-1 px-gutter">
            <View style={{ marginBottom: 12 }}>
              <Text variant="display" trim accessibilityRole="header">
                {procession.confirmed.length}{' '}
                {procession.confirmed.length === 1 ? 'piece' : 'pieces'} kept.
              </Text>
            </View>
            <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
              {procession.confirmed.length > PLANS.free.items
                ? 'Cinch is holding all of them. Let’s see what they make.'
                : 'Let’s see what they make.'}
            </Text>
          </View>
          <View className="px-gutter">
            <Button
              title={committing ? 'Saving…' : 'See the outfits'}
              onPress={() => void commit()}
              disabled={committing}
              haptic
              className="self-stretch"
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── PR-03 — plural or unsure, before the ordinary card ──────────────────
  if (draft && draft.state === 'ambiguous') {
    const { index, total } = positionLabel(procession.state);
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <CountStepper
            key={draft.id}
            draft={draft}
            index={index}
            total={total}
            canUndo={procession.showUndo && procession.state.undo.length > 0}
            onBack={() => procession.dispatch({ type: 'back' })}
            onUndo={() => procession.dispatch({ type: 'undo' })}
            onDrop={() => procession.dispatch({ type: 'reject' })}
            onConfirm={(quantity) => procession.dispatch({ type: 'ambiguous', quantity })}
          />
        </SafeAreaView>
      </View>
    );
  }

  // ── PR-01 / PR-05 ──────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {draft ? (
          <GarmentCard
            key={draft.id}
            procession={procession.state}
            dispatch={procession.dispatch}
            showUndo={procession.showUndo}
            onCorrect={(field) => setCorrecting(field ?? null)}
            /**
             * CPV2-V01 → CPV2-V02. A push, so the procession's own state
             * machine is untouched and Back returns to this exact card with
             * the confirmed work intact — §8: "Cancel at any depth pops back
             * with nothing changed."
             *
             * WHAT GETS SEARCHED IS THE EXTRACTED WORDS, not the whole
             * sentence. CPV2-V02: "the search field carries the garment words
             * extracted from the utterance, the verbatim utterance is quoted
             * underneath so nothing is silently rewritten."
             *
             * That distinction is the difference between a search and no
             * search. The utterance is "A James Perse men's T-shirt, I have it
             * in black, white and grey" — sent whole, the colour words and the
             * possessive clause become query terms the catalogue has to drop,
             * and the brand-run heuristic in the server parser would read "A
             * James Perse" as the maker. `draft.name` is what the parse
             * produced for exactly this purpose.
             *
             * The utterance still travels, as `said`, to be quoted — and the
             * parsed colour as `colours`, so CPV2-05 opens pre-selected.
             */
            onFindPhoto={() =>
              router.push({
                pathname: '/find-photo',
                params: {
                  path: 'walkthrough',
                  words: draft.name ?? draft.utterance ?? '',
                  said: draft.utterance ?? '',
                  colours: draft.colour_term ?? '',
                },
              })
            }
          />
        ) : null}
      </SafeAreaView>

      {/* V-07 */}
      {draft ? (
        <CorrectionSheet
          visible={correcting !== undefined}
          focusField={correcting ?? undefined}
          initial={{
            name: draft.name,
            slot: draft.slot,
            colourTerm: draft.colour_term,
            fabric: draft.fabric,
            pattern: draft.pattern,
            formality: draft.formality,
            warmth: draft.warmth,
          }}
          onSave={onSave}
          onDismiss={() => setCorrecting(undefined)}
        />
      ) : null}
    </View>
  );
}

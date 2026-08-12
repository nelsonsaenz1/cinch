import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CorrectionSheet, type CorrectionDraft, type CorrectionField } from '@/components/intake/CorrectionSheet';
import { CountStepper } from '@/components/intake/CountStepper';
import { GarmentCard } from '@/components/intake/GarmentCard';
import { Button, ErrorState, Skeleton, Text } from '@/components/ui';
import { PLANS } from '@/features/billing/plans';
import { commitIntake } from '@/features/intake/actions';
import { intakeCardEdited } from '@/features/intake/analytics';
import { positionLabel } from '@/features/intake/procession';
import { useDrafts, resumeCursor, type IntakeDraftRow } from '@/features/intake/queries';
import { useProcession } from '@/features/intake/use-procession';

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
export default function WalkthroughReviewScreen() {
  const router = useRouter();
  const { session } = useLocalSearchParams<{ session?: string }>();
  const sessionId = session ?? null;

  const drafts = useDrafts(sessionId);
  const rows = useMemo(() => drafts.data ?? [], [drafts.data]);

  const procession = useProcession(sessionId, rows, resumeCursor(0, rows.length));

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

  if (!sessionId) return <ErrorState title="No walkthrough to review" />;
  if (drafts.isPending) return <Skeleton />;
  if (drafts.isError) return <ErrorState title="Couldn’t load what you said" />;

  // ── After the last card ────────────────────────────────────────────────
  if (procession.finished) {
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 justify-end">
          <View className="px-gutter">
            <View style={{ marginBottom: 10 }}>
              <Text variant="display">
                {procession.confirmed.length}{' '}
                {procession.confirmed.length === 1 ? 'piece' : 'pieces'} kept.
              </Text>
            </View>
            <Text variant="body" className="text-muted">
              {procession.confirmed.length > PLANS.free.items
                ? 'Cinch is holding all of them. Let’s see what they make.'
                : 'Let’s see what they make.'}
            </Text>
            <View style={{ marginTop: 24 }}>
              <Button
                title={committing ? 'Saving…' : 'See the outfits'}
                onPress={() => void commit()}
                disabled={committing}
                haptic
              />
            </View>
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

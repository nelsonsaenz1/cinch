import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { AnswerChip } from '@/features/plan/trip-questionnaire';
import {
  LIFE_STAGES,
  MAX_DRESS_OCCASIONS,
  lifestyleOccasion,
  occasionOrderFor,
  type LifeStageKey,
} from '@/features/profile/lifestyle';
import {
  useLifestyle,
  useMarkStyleProfilePrompted,
  useSaveLifestyle,
} from '@/features/profile/use-lifestyle';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * The lifestyle questionnaire's whole body — two steps, both closed
 * vocabularies, shared by its three containers:
 *
 *   (auth)/quiz.tsx     — the SIGN-UP step. Every new account meets it right
 *                         after the handoff greeting, before the tour; the
 *                         founder's 2026-08-20 directive moved it here from
 *                         the after-tour offer, which the camera exit could
 *                         skip entirely.
 *   style-profile.tsx   — the once-ever OFFER over the tabs (the safety net
 *                         for accounts that predate the sign-up step) and the
 *                         Settings EDITOR ("What you dress for").
 *
 * The editor grows a back chevron and loses Skip; onboarding is the reverse,
 * and closes on a promise the founder asked for in words: "You can change
 * these anytime in Settings." Both exits stamp the once-ever mark.
 *
 * Set in the trip questionnaire's dialect: eyebrow with the honest "1 of 2",
 * one serif question, `AnswerChip`s (44pt of real geometry), one primary
 * button. Keys, never prose — nothing typed here, nothing free-text on the
 * wire.
 *
 * WHAT THE ANSWERS VISIBLY TOUCH, so the closing promise is true: the day's
 * outfit scoring leans toward the life described and SAYS SO in its
 * reasoning line, the stylist's opening question offers these occasions by
 * name, and the stylist's brief carries one standing sentence about who it
 * is dressing.
 */
export function StyleProfileFlow({
  editor,
  onDone,
}: {
  /** Settings presentation: back chevron, no Skip, no offered event. */
  editor: boolean;
  /** Called after Save or Skip — the container owns where to go next. */
  onDone: () => void;
}) {
  const lifestyle = useLifestyle();
  const save = useSaveLifestyle();
  const markPrompted = useMarkStyleProfilePrompted();

  const [step, setStep] = useState<'stage' | 'occasions'>('stage');
  /**
   * Edits ride OVER the saved answers rather than replacing them — `undefined`
   * means "not touched yet", so the editor opens seeded with what is saved the
   * moment the read lands, with no effect and no seeding race. Onboarding is
   * gated on the profile being empty, so there the saved half is empty by
   * construction.
   */
  const [stageEdit, setStageEdit] = useState<LifeStageKey | null | undefined>(undefined);
  const [occasionsEdit, setOccasionsEdit] = useState<string[] | undefined>(undefined);
  const stage =
    stageEdit !== undefined ? stageEdit : ((lifestyle.lifeStage as LifeStageKey | null) ?? null);
  const occasions = occasionsEdit ?? lifestyle.occasions;

  // The denominator: the questionnaire genuinely on screen as an onboarding
  // ask. The Settings editor is not an offer, so it stays silent.
  useEffect(() => {
    if (!editor) track('style_profile_offered');
    // Once per mount, which is once per offer — the gate never re-offers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSkip = () => {
    // The mark is stamped optimistically and never rolled back — the person
    // has answered "not now", and asking again tomorrow because a write
    // failed tonight is the wrong direction of error. See useMarkToured.
    markPrompted.mutate();
    track('style_profile_skipped', { step });
    onDone();
  };

  const onSave = () => {
    save.mutate({ lifeStage: stage, occasions });
    // WHAT IS MEASURED: which stage key and HOW MANY occasions — bounded, a
    // closed enum and a count with a ceiling of six. Never the occasion list
    // itself; which occasions somebody dresses for is theirs.
    track('style_profile_saved', { stage: stage ?? 'none', occasions: occasions.length });
    onDone();
  };

  const toggleOccasion = (key: string) => {
    const prev = occasions;
    setOccasionsEdit(
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_DRESS_OCCASIONS
          ? prev
          : [...prev, key],
    );
  };

  const atCap = occasions.length >= MAX_DRESS_OCCASIONS;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Your style"
        onBack={editor ? onDone : undefined}
        trailing={
          !editor ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              hitSlop={8}
              style={{ minHeight: 36 }}
              className="justify-center active:opacity-60">
              <Text variant="label" className="text-muted">
                Skip
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-gutter pb-10 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="eyebrow">{step === 'stage' ? '1 of 2' : '2 of 2'}</Text>

        {step === 'stage' ? (
          <>
            <Text variant="title" trim className="mt-3">
              Where is life right now?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Cinch dresses you for the days you actually have. One answer, changeable any time.
            </Text>

            <View className="mt-6 gap-2">
              {LIFE_STAGES.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setStageEdit(s.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: stage === s.key }}
                  accessibilityLabel={`${s.label}. ${s.hint}`}
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className={[
                    'rounded-md border px-4 py-3 active:opacity-60',
                    // The trip chips' rule: a ring, never a fill — fills are
                    // reserved for the action that commits.
                    stage === s.key ? 'border-ink' : 'border-rule',
                  ].join(' ')}>
                  <Text variant="label">{s.label}</Text>
                  <Text variant="note" className="mt-1 text-muted">
                    {s.hint}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text variant="title" trim className="mt-3">
              What do you dress for?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Pick up to {MAX_DRESS_OCCASIONS}. These shape what the stylist reaches for first.
            </Text>

            <View className="mt-6 flex-row flex-wrap gap-2">
              {occasionOrderFor(stage).map((key) => {
                const o = lifestyleOccasion(key);
                if (!o) return null;
                const selected = occasions.includes(key);
                return (
                  <AnswerChip
                    key={key}
                    label={o.label}
                    selected={selected}
                    onPress={() => toggleOccasion(key)}
                  />
                );
              })}
            </View>

            {atCap ? (
              <Text variant="note" className="mt-3 text-muted">
                Six is plenty — deselect one to swap it.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <View className="px-gutter pb-2">
        {step === 'stage' ? (
          <Button title="Continue" disabled={stage === null} onPress={() => setStep('occasions')} />
        ) : (
          <>
            <Button
              title={editor ? 'Save' : 'Save and continue'}
              disabled={occasions.length === 0}
              loading={save.isPending}
              onPress={onSave}
            />
            {/* The founder's closing promise, in the exact words a person can
                act on later. Editor mode omits it — they are already there. */}
            {!editor ? (
              <Text variant="note" className="mt-3 text-center text-muted">
                You can change these anytime in Settings → What you dress for.
              </Text>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

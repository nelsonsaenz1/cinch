import { router, useLocalSearchParams } from 'expo-router';
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
 * The lifestyle questionnaire — who this closet dresses, in two taps' worth
 * of questions.
 *
 * Two doors in, one screen:
 *
 *   ONBOARDING (`offer=1`). Offered once, ever, after the tour or at the
 *   sign-in handoff — the gate is `profiles.style_profile_prompted_at`, the
 *   `toured_at` pattern, and both exits (Save and Skip) stamp it. Pushed
 *   over the destination rather than standing in its way, so answering two
 *   questions never costs somebody the screen they were headed to.
 *
 *   SETTINGS ("What you dress for"). The same screen seeded with the saved
 *   answers, and the header grows the ordinary back chevron. No Skip — an
 *   editor's way out is the back button.
 *
 * Set in the trip questionnaire's dialect deliberately: eyebrow with the
 * honest "1 of 2", one serif question, `AnswerChip`s (44pt of real geometry,
 * not hitSlop), a primary button. The answers are chips because a chip is
 * one tap and this flow's whole promise is that it is shorter than the value
 * it buys.
 *
 * WHAT THE ANSWERS TOUCH, so the screen can promise it honestly: the day's
 * outfit scoring leans toward the life described (occasionRule's soft
 * branch), the stylist's opening question offers these occasions by name,
 * and the stylist's brief carries one sentence about who it is dressing.
 * Keys, never prose — nothing typed here, nothing free-text on the wire.
 */

type StepKey = 'stage' | 'occasions';

export default function StyleProfileScreen() {
  const params = useLocalSearchParams<{ offer?: string }>();
  /**
   * `offer=1` is the once-ever onboarding presentation — pushed OVER the tabs
   * by the handoff or the tour's exit, so both ways out are a dismissal and
   * the reader lands exactly where they were already headed. Without it this
   * is the Settings editor: same sheet, seeded with the saved answers, no
   * Skip (an editor's way out is the back chevron).
   */
  const onboarding = params.offer === '1';

  const lifestyle = useLifestyle();
  const save = useSaveLifestyle();
  const markPrompted = useMarkStyleProfilePrompted();

  const [step, setStep] = useState<StepKey>('stage');
  /**
   * Edits ride OVER the saved answers rather than replacing them — `undefined`
   * means "not touched yet", so the Settings editor opens seeded with what is
   * saved the moment the read lands, with no effect and no seeding race. The
   * onboarding path is gated on the profile being empty, so there the saved
   * half is empty by construction.
   */
  const [stageEdit, setStageEdit] = useState<LifeStageKey | null | undefined>(undefined);
  const [occasionsEdit, setOccasionsEdit] = useState<string[] | undefined>(undefined);
  const stage = stageEdit !== undefined ? stageEdit : ((lifestyle.lifeStage as LifeStageKey | null) ?? null);
  const occasions = occasionsEdit ?? lifestyle.occasions;

  // The denominator: genuinely on screen, during onboarding only. The
  // Settings editor is not an offer, so it stays silent.
  useEffect(() => {
    if (onboarding) track('style_profile_offered');
    // Once per mount, which is once per offer — the gate never re-offers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => router.back();

  const onSkip = () => {
    // The mark is stamped optimistically and never rolled back — the person
    // has answered "not now", and asking again tomorrow because a write
    // failed tonight is the wrong direction of error. See useMarkToured.
    markPrompted.mutate();
    track('style_profile_skipped', { step });
    leave();
  };

  const onSave = () => {
    save.mutate({ lifeStage: stage, occasions });
    // WHAT IS MEASURED: which stage key and HOW MANY occasions — bounded, a
    // closed enum and a count with a ceiling of six. Never the occasion list
    // itself; which occasions somebody dresses for is theirs.
    track('style_profile_saved', { stage: stage ?? 'none', occasions: occasions.length });
    leave();
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
        onBack={onboarding ? undefined : () => router.back()}
        trailing={
          onboarding ? (
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
          <Button
            title="Continue"
            disabled={stage === null}
            onPress={() => setStep('occasions')}
          />
        ) : (
          <Button
            title={onboarding ? 'Save and continue' : 'Save'}
            disabled={occasions.length === 0}
            loading={save.isPending}
            onPress={onSave}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

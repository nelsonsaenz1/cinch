import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { AnswerChip } from '@/features/plan/trip-questionnaire';
import {
  LIFE_STAGES,
  MAX_DRESS_OCCASIONS,
  MAX_STYLE_GOALS,
  STYLE_ADVENTURES,
  STYLE_GOALS,
  lifestyleOccasion,
  occasionOrderFor,
  type StyleAdventureKey,
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
 * The lifestyle questionnaire's whole body — four steps, all closed
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
 * Set in the trip questionnaire's dialect: an honest four-part progress bar,
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
/**
 * One life-stage answer — a ring card in the trip chips' grammar, with UX-07's
 * interpolated compression rather than an `active:` snap. Its own component
 * because `usePressFeedback` is a hook and hooks cannot live in a `.map`.
 */
function StageOption({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const feedback = usePressFeedback();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${hint}`}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}>
      <Animated.View style={feedback.style}>
        <View
          style={{ minHeight: MIN_TAP_TARGET }}
          className={[
            'rounded-md border px-4 py-3',
            // The trip chips' rule: a ring, never a fill — fills are
            // reserved for the action that commits.
            selected ? 'border-ink' : 'border-rule',
          ].join(' ')}>
          <Text variant="label">{label}</Text>
          <Text variant="note" className="mt-1 text-muted">
            {hint}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const STEPS = ['stage', 'occasions', 'goals', 'adventure'] as const;
type Step = (typeof STEPS)[number];

function QuestionProgress({ step }: { step: Step }) {
  const current = STEPS.indexOf(step) + 1;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${current} of ${STEPS.length}`}
      accessibilityValue={{ min: 1, max: STEPS.length, now: current }}
      className="flex-row gap-2">
      {STEPS.map((item, index) => (
        <View
          key={item}
          className={[
            'h-1 flex-1 rounded-full',
            index < current ? 'bg-accent' : 'bg-sand',
          ].join(' ')}
        />
      ))}
    </View>
  );
}

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

  const [step, setStep] = useState<Step>('stage');
  /**
   * Edits ride OVER the saved answers rather than replacing them — `undefined`
   * means "not touched yet", so the editor opens seeded with what is saved the
   * moment the read lands, with no effect and no seeding race. Onboarding is
   * gated on the profile being empty, so there the saved half is empty by
   * construction.
   */
  const [stageEdit, setStageEdit] = useState<LifeStageKey | null | undefined>(undefined);
  const [occasionsEdit, setOccasionsEdit] = useState<string[] | undefined>(undefined);
  const [goalsEdit, setGoalsEdit] = useState<string[] | undefined>(undefined);
  const [adventureEdit, setAdventureEdit] = useState<StyleAdventureKey | null | undefined>(
    undefined,
  );
  const stage =
    stageEdit !== undefined ? stageEdit : ((lifestyle.lifeStage as LifeStageKey | null) ?? null);
  const occasions = occasionsEdit ?? lifestyle.occasions;
  const goals = goalsEdit ?? lifestyle.goals;
  const adventure =
    adventureEdit !== undefined
      ? adventureEdit
      : ((lifestyle.adventure as StyleAdventureKey | null) ?? null);

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
    save.mutate({ lifeStage: stage, occasions, goals, adventure });
    // WHAT IS MEASURED: closed stage/adventure enums and bounded counts. Never
    // the selected occasion or goal lists themselves; those facts are theirs.
    track('style_profile_saved', {
      stage: stage ?? 'none',
      occasions: occasions.length,
      goals: goals.length,
      adventure: adventure ?? 'none',
    });
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
  const goalsAtCap = goals.length >= MAX_STYLE_GOALS;

  const toggleGoal = (key: string) => {
    const prev = goals;
    setGoalsEdit(
      prev.includes(key)
        ? prev.filter((goal) => goal !== key)
        : prev.length >= MAX_STYLE_GOALS
          ? prev
          : [...prev, key],
    );
  };

  const onBack = () => {
    const index = STEPS.indexOf(step);
    if (index > 0) setStep(STEPS[index - 1]!);
    else if (editor) onDone();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Your style"
        onBack={editor || step !== 'stage' ? onBack : undefined}
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
        contentContainerClassName="px-gutter pb-10 pt-8"
        showsVerticalScrollIndicator={false}>
        <QuestionProgress step={step} />

        {step === 'stage' ? (
          <>
            <Text variant="title" trim className="mt-8">
              Where is life right now?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Cinch dresses you for the days you actually have. One answer, changeable any time.
            </Text>

            <View className="mt-6 gap-2">
              {LIFE_STAGES.map((s) => (
                <StageOption
                  key={s.key}
                  label={s.label}
                  hint={s.hint}
                  selected={stage === s.key}
                  onPress={() => setStageEdit(s.key)}
                />
              ))}
            </View>
          </>
        ) : step === 'occasions' ? (
          <>
            <Text variant="title" trim className="mt-8">
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
        ) : step === 'goals' ? (
          <>
            <Text variant="title" trim className="mt-8">
              What should getting dressed do for you?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Pick up to {MAX_STYLE_GOALS}. Cinch will use these as priorities, not just labels.
            </Text>

            <View className="mt-6 gap-2">
              {STYLE_GOALS.map((goal) => (
                <StageOption
                  key={goal.key}
                  label={goal.label}
                  hint={goal.hint}
                  selected={goals.includes(goal.key)}
                  onPress={() => toggleGoal(goal.key)}
                />
              ))}
            </View>

            {goalsAtCap ? (
              <Text variant="note" className="mt-3 text-muted">
                Two priorities keep the stylist focused — deselect one to swap it.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="title" trim className="mt-8">
              How far should Cinch push your style?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Choose the amount of novelty you want in everyday recommendations.
            </Text>

            <View className="mt-6 gap-2">
              {STYLE_ADVENTURES.map((option) => (
                <StageOption
                  key={option.key}
                  label={option.label}
                  hint={option.hint}
                  selected={adventure === option.key}
                  onPress={() => setAdventureEdit(option.key)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View className="px-gutter pb-2">
        {step === 'stage' ? (
          <Button title="Continue" disabled={stage === null} onPress={() => setStep('occasions')} />
        ) : step === 'occasions' ? (
          <Button
            title="Continue"
            disabled={occasions.length === 0}
            onPress={() => setStep('goals')}
          />
        ) : step === 'goals' ? (
          <Button title="Continue" disabled={goals.length === 0} onPress={() => setStep('adventure')} />
        ) : (
          <>
            <Button
              title={editor ? 'Save' : 'Save and continue'}
              disabled={adventure === null}
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

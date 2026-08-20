import { router } from 'expo-router';

import { useTourGate } from '@/features/onboarding/tour-queries';
import { shouldShowTour } from '@/features/onboarding/tour-state';
import { StyleProfileFlow } from '@/features/profile/style-profile-flow';

/**
 * The sign-up quiz — the lifestyle questionnaire as a step of the run.
 *
 * Every account whose profile has never been asked lands here from the
 * handoff (W-14 routes to this before the tour; the AuthGate allowlists it
 * beside `name` and `handoff` for the same signed-in-by-definition reason).
 * The founder's 2026-08-20 directive: the quiz IS onboarding, not an offer
 * the camera exit can skip.
 *
 * On the way out it resumes exactly the funnel the handoff was running:
 * the tour if it is still owed, the tabs otherwise. `replace`, never `push`
 * — a quiz must not sit under the app on the back stack, the tour's own
 * rule. Both exits (Save and Skip inside the flow) stamp the once-ever mark
 * before this fires, so nothing routes back here.
 */
export default function QuizScreen() {
  const tourGate = useTourGate();
  return (
    <StyleProfileFlow
      editor={false}
      onDone={() => router.replace(shouldShowTour(tourGate) ? '/tour' : '/(tabs)')}
    />
  );
}

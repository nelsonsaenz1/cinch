import { router, useLocalSearchParams } from 'expo-router';

import { StyleProfileFlow } from '@/features/profile/style-profile-flow';

/**
 * The lifestyle questionnaire's sheet container — see StyleProfileFlow for
 * the flow itself; this file only decides presentation and the way out.
 *
 *   `offer=1` — the once-ever push over the tabs. The safety net for
 *   accounts that predate the sign-up quiz ((auth)/quiz.tsx): the sign-in
 *   handoff routes such an account through the quiz instead now, so this
 *   path fires only from the tour's tabs exit, and both stamp the same mark.
 *
 *   without it — the Settings editor ("What you dress for"): seeded with the
 *   saved answers, back chevron, no Skip.
 *
 * Both ways out are a dismissal — the reader lands exactly where they were.
 */
export default function StyleProfileScreen() {
  const params = useLocalSearchParams<{ offer?: string }>();
  return <StyleProfileFlow editor={params.offer !== '1'} onDone={() => router.back()} />;
}

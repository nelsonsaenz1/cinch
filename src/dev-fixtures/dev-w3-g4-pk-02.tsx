import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { TripQuestionnaire } from '@/features/plan/trip-questionnaire';

/**
 * PK-02 — questionnaire, four answers, counted.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · PROGRESS IS A COUNT IN THE MASTHEAD — "Packing · 4 of 4" — never a bar and
 *   never a percentage. `ProgressTrack` was deleted from this codebase and
 *   nothing here reintroduces one.
 * · The trip facts are RESTATED UNDER THE QUESTION, so the answer is given in
 *   context. Every fragment is an answer already given, so none of it is a
 *   guess, and the restatement disappears entirely before there is anything to
 *   restate.
 * · Multi-select is carried by RING, TICK AND MEDIUM WEIGHT — three channels,
 *   no fill and no colour. The chips used to be an ink fill, which is what the
 *   constitution reserves for actions; six filled ink chips above one filled
 *   ink button gave the reader no way to tell an answer from the control that
 *   spends it.
 * · Every option is a REAL ANSWER. `DAY_PARTS`' four are things you dress for,
 *   not a "none of these" escape hatch.
 * · The retention line is the honest scope of the collection, and it is true of
 *   this app: `useStartTrip` writes the answered questionnaire to `trips`
 *   before anything is packed, which is what makes reopening a memo after a
 *   timeout possible without asking again.
 *
 * WHAT IS NOT DRAWN, AND WHY
 *
 * · "Skip this one." `trips.parts` is constrained to `array_length between 1
 *   and 4` (migration 20260809100000), so a skipped fourth question produces a
 *   row the database refuses and a bag with no looks to pack. A dead control is
 *   worse than an absent one.
 * · "Deleting the trip deletes them." No per-trip delete exists in any client
 *   path — no control, no mutation, no `.delete()` on `trips`. The row does go
 *   with the account (`user_id … on delete cascade`), which is the privacy
 *   page's claim to make, not this screen's.
 *
 * DETERMINISM: seeded straight onto the last step through the hook's dev-only
 * `devSeed`, so the frame reaches its state without typing and without the
 * destination step's autofocused search field ever mounting. The dates are
 * literals; nothing here reads a clock, a random source or a network. The
 * running arithmetic under the chips is the real `looksSentence` over those
 * literals.
 */
export default function DevW3G4PK02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-1">
        <TripQuestionnaire
          onComplete={() => undefined}
          devSeed={{
            // Index 3 is `shape` — the one multi-select question, and the one
            // the atlas draws.
            index: 3,
            draft: {
              destination: {
                name: 'Lisbon',
                country: 'Portugal',
                admin1: 'Lisbon',
                latitude: 38.72,
                longitude: -9.14,
              },
              companions: 'partner',
              friendIds: [],
              friendNames: [],
              startsOn: '2026-09-09',
              endsOn: '2026-09-15',
              vibes: ['warm-city', 'long-dinners'],
              parts: ['daytime', 'evening'],
            },
          }}
        />
      </View>
    </SafeAreaView>
  );
}

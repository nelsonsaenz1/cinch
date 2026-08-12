import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoticeBand } from '@/components/plan/notice-band';
import { Text } from '@/components/ui/text';

/**
 * PK-04 — four failures, none of which upsells.
 *
 * A COMPARISON FRAME. One of these is on screen at a time in the running app;
 * they are drawn together here so their wording can be compared, which is the
 * atlas's own reason for the composition.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Audit 83's acceptance line: four causes, four forward paths, and NOT ONE of
 *   them mentions a tier, a price or an upgrade — including the membership
 *   failure, which is the one place an upsell would be easiest to justify.
 * · Beyond-forecast produces a SHORTER MEMO rather than a refusal, and says
 *   plainly that no temperature will be invented. That is the app's real
 *   behaviour: `hasForecastFor` decides the horizon and `fetchSeasonalNormals`
 *   is the only fallback, stated as normals rather than presented as a
 *   forecast.
 * · Short closet states the ARITHMETIC that produced the shortfall — the
 *   sentence `shortfallSentence` composes from `PackingResult.unfilled`, never
 *   rounded to a nicer number — and offers both a fix and packing with repeats.
 * · Membership-unknown FAILS OPEN: nothing is charged and nothing is locked.
 * · Timeout confirms the questionnaire survives, which is true rather than
 *   hopeful: `useStartTrip` writes the answers to `trips` the moment the
 *   fourth question is answered, before anything is packed.
 *
 * WHAT IS NOT DRAWN, AND WHY
 *
 * No tier name appears on any of these four notices. That is the atlas's own
 * requirement here, and it also happens to be the only implementable answer:
 * PK-01's gate copy is stopped by D-5, and Claim 9 — which tier gates packing —
 * is unresolved. These four notices need neither, which is why they could be
 * built while the gate could not.
 *
 * DETERMINISM: every figure on this frame is a literal in this file. No clock,
 * no random source, no network, no spinner and no shimmer.
 */
export default function DevW3G4PK04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pb-1 pt-2">
        <Text variant="display" trim accessibilityRole="header">
          When the memo cannot be built
        </Text>
        <Text variant="note" className="mt-2">
          Four causes, four notices. One is on screen at a time, and each one keeps a way forward.
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-3 px-gutter pb-10 pt-4">
        <NoticeBand
          cause="Beyond the forecast"
          title="September is too far out for weather"
          body="Cinch can pack for the first five days and will fill the rest when the forecast reaches them. It will not invent a temperature."
          actions={[{ label: 'Pack the first five days', onPress: () => undefined }]}
        />

        <NoticeBand
          cause="Short closet"
          title="Six nights needs one more bottom"
          body="You have two bottoms active and this trip wants three to avoid repeating on the dressier evening. Adding one from your stored pieces is enough."
          actions={[
            { label: 'Activate a stored piece', onPress: () => undefined },
            { label: 'Pack with repeats', onPress: () => undefined },
          ]}
        />

        <NoticeBand
          cause="Membership unknown"
          title="Cinch cannot confirm your membership"
          body="The store is not answering, so nothing is charged and nothing is locked. If you are a member, this resolves itself when the store replies."
          actions={[{ label: 'Check again', onPress: () => undefined }]}
        />

        <NoticeBand
          cause="Timed out"
          title="Building the memo took too long"
          body="Your trip and your answers are saved. Starting again picks up where it stopped rather than asking the four questions over."
          actions={[{ label: 'Try again', onPress: () => undefined }]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

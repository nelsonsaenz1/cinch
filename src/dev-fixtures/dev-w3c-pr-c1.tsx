import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileCoachingCard } from '@/components/profile/profile-coaching-card';
import { Text } from '@/components/ui/text';

/**
 * PR-C1 — the coaching card, both destinations.
 *
 * Drawn twice because the only difference between them is one accessibility
 * hint and where the tap goes, and the card must look identical either way:
 * "Start mine" is not a different offer to somebody who has already filled in
 * their handle, it is the same offer with a shorter next step.
 *
 * PR-C2 has no fixture, on purpose. It is this screen with the card ABSENT, and
 * a fixture of an absence is a blank page — the thing to check is the real
 * Profile screen on a second visit, which no fixture can pose.
 */
export default function DevW3cPrC1() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16">
        <Text variant="eyebrow" className="px-gutter pt-4">
          PR-C1 · no handle yet — Start mine opens Edit profile
        </Text>
        <ProfileCoachingCard destination="edit-profile" onStart={() => {}} onDismiss={() => {}} />

        <Text variant="eyebrow" className="mt-10 border-t border-rule px-gutter pt-4">
          PR-C1 · identity complete — Start mine opens Add clothes
        </Text>
        <ProfileCoachingCard destination="add-clothes" onStart={() => {}} onDismiss={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}

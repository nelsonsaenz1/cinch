import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { Text } from '@/components/ui/text';

/**
 * TN-C1 — The Ten's opening chooser, with the four routes it was missing.
 *
 * The thing to check is that the four read as PEERS: same plate, same height,
 * same icon well, nothing filled, nothing coloured. And that they are the same
 * four, in the same order, with the same subtitles as `/dev-add-clothes` —
 * which they must be, because both read one table.
 */
export default function DevW3cTnC1() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <FirstTenDoors
        unfinished={null}
        onRoute={() => {}}
        onResume={() => {}}
        onStartAgain={() => {}}
      />
    </SafeAreaView>
  );
}

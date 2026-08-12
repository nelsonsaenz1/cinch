import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { Text } from '@/components/ui/text';

/**
 * CP-04 — camera unavailable, stale native client.
 *
 * The real component with inert actions. The shipping route is
 * `/camera-unavailable`, which cannot be posed here without leaving the
 * fixture — and which is unreachable on a healthy binary by design, since
 * `CAMERA_AVAILABLE` is true and the chooser opens the camera instead.
 */
export default function DevW3G3Cp04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="px-gutter pt-6">
        <Text variant="body" className="font-semibold">
          Close
        </Text>
      </View>
      <View className="mt-8">
        <CameraUnavailable onLibrary={() => {}} onDescribe={() => {}} onHelp={() => {}} />
      </View>
    </SafeAreaView>
  );
}

import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { Text } from '@/components/ui/text';

/**
 * CP-04's own route.
 *
 * It exists rather than the chooser drawing this inline because the frame has a
 * Close and a full page of its own, and because `/capture` cannot serve it: that
 * screen statically imports `CameraView`, which is the very thing a stale binary
 * cannot resolve. This route imports nothing from `expo-camera`, so it is
 * reachable on exactly the builds it is for.
 *
 * Both actions leave for a door that works. "How to update Cinch" goes to Help
 * rather than to the App Store: sending somebody straight out of the app is a
 * bigger jump than the sentence promised, and Help is where the instruction
 * actually lives.
 */
export default function CameraUnavailableScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row justify-start px-gutter pt-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={() => router.back()}
          className="py-1 active:opacity-60">
          <Text variant="body" className="font-semibold">
            Close
          </Text>
        </Pressable>
      </View>

      <View className="mt-8">
        <CameraUnavailable
          onLibrary={() => router.replace('/add-clothes?door=library' as Href)}
          onDescribe={() => router.replace('/add-clothes?door=describe' as Href)}
          onHelp={() => router.replace('/help' as Href)}
        />
      </View>
    </SafeAreaView>
  );
}

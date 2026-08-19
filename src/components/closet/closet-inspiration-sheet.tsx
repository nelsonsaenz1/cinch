import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileCoachingCard } from '@/components/profile/profile-coaching-card';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * A one-time Closet introduction, shown as a sheet rather than inserted into
 * the grid. It uses the same approved fictional profile as Profile itself, so
 * the promise and the eventual surface cannot drift apart.
 */
export function ClosetInspirationSheet({
  visible,
  onStart,
  onDismiss,
}: {
  visible: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close closet inspiration"
          onPress={onDismiss}
          className="absolute inset-0"
          style={{ backgroundColor: theme.scrim }}
        />
        <SafeAreaView
          edges={['bottom']}
          className="max-h-[92%] rounded-t-plate"
          style={{ backgroundColor: theme.canvas }}>
          <View className="items-center pt-2.5" accessibilityElementsHidden>
            <View className="h-1 w-10 rounded-full bg-rule" />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            <View className="px-gutter pb-2 pt-5">
              {/* The eyebrow "Your closet, built out" was struck 2026-08-18 by
                  founder order. It was a label for the sheet rather than a
                  sentence to anybody: it named the surface out loud a beat
                  before the surface said what it was for, and "built out" is
                  a claim about a closet the reader has not filled yet. The
                  title carries the whole top of the sheet now, so it leads
                  rather than answers, and it is drawn at the same size — this
                  is a deletion, not a demotion. */}
              <Text variant="title" trim>
                Make it unmistakably yours
              </Text>
              <Text variant="body" className="mt-4 text-muted">
                Add the pieces you return to, shape a profile around them, and give friends a closet they can recognise at a glance.
              </Text>
            </View>
            <ProfileCoachingCard
              destination="edit-profile"
              onStart={onStart}
              onDismiss={onDismiss}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

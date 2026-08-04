import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { signOut } from '@/features/auth/actions';

/**
 * Profile, analytics, settings.
 *
 * In-app account deletion lives here and is a hard App Store requirement
 * (Guideline 5.1.1(v)) — an app that can create an account but not delete one
 * is rejected. Tracked in OUT-15; not yet wired.
 */
export default function ProfileScreen() {
  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in anytime — your closet stays put.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter pb-6 pt-2">
          <Text variant="display">Profile</Text>
        </View>

        <View className="px-gutter">
          <View className="rounded-card border border-hairline p-5 dark:border-hairline-dark">
            <Text variant="caption">Wardrobe</Text>
            <View className="mt-3 flex-row justify-between">
              <View>
                <Text variant="stat" className="text-title">
                  0
                </Text>
                <Text variant="label">Pieces</Text>
              </View>
              <View>
                <Text variant="stat" className="text-title">
                  0
                </Text>
                <Text variant="label">Total wears</Text>
              </View>
              <View>
                <Text variant="stat" className="text-title">
                  0
                </Text>
                <Text variant="label">Never worn</Text>
              </View>
            </View>
            <Text variant="label" className="mt-4">
              Live stats land once you add your first pieces.
            </Text>
          </View>

          <View className="mt-8">
            <Button title="Sign out" variant="secondary" onPress={confirmSignOut} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

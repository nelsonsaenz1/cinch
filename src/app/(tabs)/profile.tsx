import { useMemo } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { signOut } from '@/features/auth/actions';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { useCloset } from '@/features/closet/queries';
import { useStyleProfile } from '@/features/styling/queries';

// Live on Vercel. These exact URLs also go into App Store Connect, and Apple's
// reviewers must be able to open them without signing in — Vercel's deployment
// protection was on by default and had to be turned off for that reason.
// Swap both if a custom domain is ever pointed at the project.
const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const SUPPORT_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/support';

/**
 * Profile, analytics, settings.
 *
 * In-app account deletion lives here. It is a hard App Store requirement
 * (Guideline 5.1.1(v)): an app that can create an account must let you delete
 * one from inside the app, and a support email or web form does not satisfy it.
 */
export default function ProfileScreen() {
  const closet = useCloset();
  const style = useStyleProfile();
  const deleteAccount = useDeleteAccount();

  const stats = useMemo(() => {
    const items = closet.data ?? [];
    return {
      pieces: items.length,
      wears: items.reduce((sum, i) => sum + i.wearCount, 0),
      neverWorn: items.filter((i) => i.wearCount === 0).length,
    };
  }, [closet.data]);

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in anytime — your closet stays put.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  /**
   * Two steps, and the first one enumerates exactly what disappears.
   *
   * Deletion is irreversible and takes the user's photographs with it, so a
   * single tap is too little friction — but burying it would fail the guideline
   * it exists to satisfy. Naming the consequences is what makes one extra
   * confirmation honest rather than a dark pattern in reverse.
   */
  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      `This permanently deletes your ${stats.pieces} ${
        stats.pieces === 1 ? 'piece' : 'pieces'
      }, every photo you uploaded, your outfit history, and everything Cinch has learned about your style.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'There is no way to recover this.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: () =>
                  deleteAccount.mutate(undefined, {
                    onError: (err) =>
                      Alert.alert(
                        'Could not delete your account',
                        err instanceof Error
                          ? err.message
                          : 'Something went wrong. Nothing has been deleted.',
                      ),
                  }),
              },
            ]),
        },
      ],
    );
  };

  const summary = style.data?.summary ?? [];
  const feedbackCount = style.data?.feedbackCount ?? 0;

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
                  {stats.pieces}
                </Text>
                <Text variant="label">Pieces</Text>
              </View>
              <View>
                <Text variant="stat" className="text-title">
                  {stats.wears}
                </Text>
                <Text variant="label">Total wears</Text>
              </View>
              <View>
                <Text variant="stat" className="text-title">
                  {stats.neverWorn}
                </Text>
                <Text variant="label">Never worn</Text>
              </View>
            </View>
            {stats.pieces === 0 ? (
              <Text variant="label" className="mt-4">
                Live stats land once you add your first pieces.
              </Text>
            ) : null}
          </View>

          {/* What the engine has learned, in the user's own terms. Showing this
              is what makes the personalisation feel like a relationship rather
              than a black box — and gives them somewhere to push back. */}
          <View className="mt-4 rounded-card border border-hairline p-5 dark:border-hairline-dark">
            <Text variant="caption">Your style</Text>
            {feedbackCount < 8 ? (
              <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
                {feedbackCount === 0
                  ? 'React to a few outfits and Cinch will start learning what you actually wear.'
                  : `${8 - feedbackCount} more reactions and Cinch will start recognising your taste.`}
              </Text>
            ) : (
              <View className="mt-3 gap-1.5">
                {summary.map((line) => (
                  <Text key={line} variant="body" className="text-muted dark:text-muted-dark">
                    · You {line}.
                  </Text>
                ))}
                <Text variant="label" className="mt-2">
                  Learned from {feedbackCount} reactions.
                </Text>
              </View>
            )}
          </View>

          <View className="mt-8 gap-3">
            <Button
              title="Privacy policy"
              variant="ghost"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            />
            <Button
              title="Support"
              variant="ghost"
              onPress={() => void Linking.openURL(SUPPORT_URL)}
            />
            <Button title="Sign out" variant="secondary" onPress={confirmSignOut} />
          </View>

          <View className="mt-10 border-t border-hairline pt-6 dark:border-hairline-dark">
            <Button
              title="Delete account"
              variant="ghost"
              onPress={confirmDelete}
              loading={deleteAccount.isPending}
            />
            <Text variant="label" className="mt-2 text-center">
              Permanently deletes your closet, your photos, and your style profile.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

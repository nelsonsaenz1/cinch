import { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { signOut } from '@/features/auth/actions';
import { useAiConsent, useGrantAiConsent, useRevokeAiConsent } from '@/features/auth/use-consent';
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
 * Profile, analytics, settings — a modal off Today's masthead avatar, not a
 * tab. Settings do not deserve one of three permanent slots on the glass bar.
 *
 * In-app account deletion lives here. It is a hard App Store requirement
 * (Guideline 5.1.1(v)): an app that can create an account must let you delete
 * one from inside the app, and a support email or web form does not satisfy it.
 */
export default function ProfileScreen() {
  const closet = useCloset();
  const style = useStyleProfile();
  const deleteAccount = useDeleteAccount();

  const consent = useAiConsent();
  const revokeConsent = useRevokeAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);

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
                    // Never promise a rollback. Deleting an account spans
                    // Storage and Auth, which cannot share a transaction, so a
                    // failure part-way through means photographs really are
                    // gone while the account really does remain. The server
                    // reports exactly how far it got; saying "nothing has been
                    // deleted" here would be a comforting lie about
                    // irreversible data loss. Pressing delete again resumes.
                    onError: (err) =>
                      Alert.alert(
                        'Could not finish deleting your account',
                        err instanceof Error
                          ? `${err.message}\n\nAnything already removed is permanently gone. Tap Delete again to finish the job.`
                          : 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete again to finish the job.',
                      ),
                  }),
              },
            ]),
        },
      ],
    );
  };

  /**
   * The withdrawal the consent sheet promises.
   *
   * One confirmation, not two — unlike deletion this is fully reversible, and
   * friction on the *un-sharing* direction is a dark pattern. What the dialog
   * has to do instead is be accurate about the blast radius, because the fear
   * that stops people withdrawing consent is not knowing what breaks.
   *
   * Both lists below are true as written. Outfit generation is a local beam
   * search over the closet (`src/lib/styling`) and needs neither the network
   * nor the model; only the outfit's name and its written reasoning come from
   * the AI, and without it the engine writes its own from the scoring notes.
   */
  const confirmRevoke = () => {
    Alert.alert(
      'Turn off AI features',
      'Nothing more will be sent to our AI provider.\n\nWhat stops: tagging new pieces automatically, the stylist chat, and the AI rewriting your outfit suggestions.\n\nWhat keeps working: your whole closet, everything already tagged, and outfit suggestions — those are built on your phone and never needed the AI.\n\nYou can turn it back on here whenever you like.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () =>
            revokeConsent.mutate(undefined, {
              onError: (err) =>
                Alert.alert(
                  'Could not turn off AI features',
                  err instanceof Error
                    ? err.message
                    : 'Something went wrong. Your settings have not changed.',
                ),
            }),
        },
      ],
    );
  };

  const summary = style.data?.summary ?? [];
  const feedbackCount = style.data?.feedbackCount ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter pb-6 pt-6">
          <Text variant="display" trim accessibilityRole="header">
            Profile
          </Text>
        </View>

        <View className="px-gutter">
          <View className="rounded-card border border-hairline p-5 dark:border-hairline-dark">
            <Text variant="caption">Wardrobe</Text>
            <View className="mt-3 flex-row justify-between">
              <View>
                <Text variant="stat" className="text-figure">
                  {stats.pieces}
                </Text>
                <Text variant="label">Pieces</Text>
              </View>
              <View>
                <Text variant="stat" className="text-figure">
                  {stats.wears}
                </Text>
                <Text variant="label">Total wears</Text>
              </View>
              <View>
                <Text variant="stat" className="text-figure">
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

          {/* Guideline 5.1.2(i) consent, and its withdrawal. The sheet shown
              before the first upload tells the user this control is here, so
              it has to be findable rather than buried under a submenu.

              While `consent` is still loading we render nothing at all: a
              control that says "off" for a beat and then flips to "on" reads
              as the app having lost the setting. */}
          {consent.data ? (
            <View className="mt-8 rounded-card border border-hairline p-5 dark:border-hairline-dark">
              <Text variant="caption">AI features</Text>
              {consent.data.granted ? (
                <>
                  <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
                    Photos of new pieces go to OpenRouter to be tagged, and the
                    stylist chat and outfit write-ups run there too. Cutouts and
                    the outfit suggestions themselves stay on your phone.
                  </Text>
                  <View className="mt-4">
                    <Button
                      title="Turn off AI features"
                      variant="secondary"
                      onPress={confirmRevoke}
                      loading={revokeConsent.isPending}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
                    Off. Nothing is being sent to our AI provider. Cinch still
                    builds outfits from your closet on this phone — new pieces
                    just arrive untagged, and the stylist chat is unavailable.
                  </Text>
                  {/* Re-granting opens the same full disclosure sheet a new
                      user sees, which is what records a fresh version and
                      timestamp. A bare "turn back on" toggle here would be
                      re-consenting to text the user last read weeks ago. */}
                  <View className="mt-4">
                    <Button
                      title="Turn AI features back on"
                      variant="secondary"
                      onPress={() => setConsentVisible(true)}
                    />
                  </View>
                </>
              )}
            </View>
          ) : null}

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

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => {
          grantConsent.mutate(undefined, {
            onSuccess: () => setConsentVisible(false),
            onError: (err) =>
              Alert.alert(
                'Could not turn AI features back on',
                err instanceof Error
                  ? err.message
                  : 'Something went wrong. Your settings have not changed.',
              ),
          });
        }}
        onDecline={() => setConsentVisible(false)}
      />
    </SafeAreaView>
  );
}

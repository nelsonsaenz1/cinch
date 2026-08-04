import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { signInWithApple } from '@/features/auth/actions';
import { useTheme } from '@/theme/tokens';

/**
 * The one screen a signed-out user ever sees.
 *
 * Sign in with Apple is required by the App Store for any app that offers
 * social login (Guideline 4.8). It also happens to be the least-friction path
 * — no password, no email verification, no "check your inbox" moment before
 * the user can try the product.
 *
 * Email magic link is planned as a fallback for accounts already tied to a
 * non-Apple email, but is deliberately deferred until we have a real reason
 * for it. Not shipping the second option means one clear call to action.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    const result = await signInWithApple();
    setBusy(false);

    if (result.ok) return; // Root layout redirects to (tabs) as soon as the session lands.

    switch (result.reason) {
      case 'canceled':
        // No message — the user chose to back out; do not shame them for it.
        break;
      case 'unavailable':
        Alert.alert(
          'Sign in with Apple is unavailable',
          'This device does not support Sign in with Apple. iOS 13 or later is required.',
        );
        break;
      case 'failed':
        Alert.alert(
          'Could not sign you in',
          result.message ?? 'Please try again in a moment.',
        );
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-1 justify-between px-8 py-10">
        <View className="mt-16">
          <Text variant="display" className="text-title" style={{ fontSize: 56, lineHeight: 58 }}>
            Cinch
          </Text>
          <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
            A personal stylist that works with the clothes you already own.
          </Text>
        </View>

        <View>
          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                theme.scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={999}
              style={{ height: 52, width: '100%' }}
              onPress={onPress}
            />
          ) : (
            // Android will grow an email magic-link path here; iOS-first for MVP.
            <Text variant="body" className="text-center text-muted dark:text-muted-dark">
              Cinch is currently iOS only.
            </Text>
          )}

          <Text variant="caption" className="mt-6 text-center text-muted dark:text-muted-dark">
            By continuing, you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

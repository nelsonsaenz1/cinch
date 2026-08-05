import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { CALLBACK_URL, completeSessionFromUrl } from '@/features/auth/actions';

/**
 * The route `cinch://auth-callback` lands on.
 *
 * Without a file at this path expo-router has nothing to show and falls back to
 * its headerless Unmatched screen — which is what a user tapping their sign-in
 * link used to see while the session was quietly established underneath it.
 *
 * The screen is deliberately thin: it exists to give the exchange somewhere to
 * report from. The root layout's deep-link listener may well have started the
 * same exchange already, and `completeSessionFromUrl` deduplicates by
 * authorization code, so calling it again here returns that same outcome rather
 * than spending the single-use code twice.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const [failure, setFailure] = useState<string | null>(null);

  // The params object is a fresh literal on every render, so an effect keyed on
  // it would re-run forever. One attempt per mount is all this screen ever does.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // expo-router hands over parsed params, not the URL it parsed them from.
    // Rebuilding the canonical callback means the route/scheme check in
    // `completeSessionFromUrl` stays the single place that decides what counts
    // as a legitimate callback.
    const query = new URLSearchParams();
    for (const name of ['code', 'error', 'error_code', 'error_description'] as const) {
      const value = params[name];
      if (typeof value === 'string' && value.length > 0) query.set(name, value);
    }

    void completeSessionFromUrl(`${CALLBACK_URL}?${query.toString()}`).then((result) => {
      if (result.status === 'signed-in') {
        router.replace('/(tabs)');
        return;
      }

      // `ignored` here means the link reached this screen carrying nothing to
      // redeem — a stale or hand-typed URL. There is nothing to sign in with
      // either way, so both non-success cases return the user to sign-in.
      const message =
        result.status === 'failed'
          ? result.message
          : 'That sign-in link was incomplete. Send yourself a new one.';

      setFailure(message);
      Alert.alert('Could not sign you in', message);
      router.replace('/(auth)/sign-in');
    });
  }, [params, router]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-1 items-center justify-center px-gutter">
        {failure === null ? (
          <>
            <ActivityIndicator />
            <Text variant="callout" className="mt-4 text-muted dark:text-muted-dark">
              Signing you in…
            </Text>
          </>
        ) : (
          <Text
            variant="callout"
            className="text-center text-muted dark:text-muted-dark"
            style={{ maxWidth: 320 }}>
            {failure}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

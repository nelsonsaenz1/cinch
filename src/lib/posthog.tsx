import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import PostHog, { PostHogErrorBoundary, PostHogProvider } from 'posthog-react-native';

type PostHogExtra = {
  posthogProjectToken?: string;
  posthogHost?: string;
};

const extra = Constants.expoConfig?.extra as PostHogExtra | undefined;
const projectToken = extra?.posthogProjectToken;
const host = extra?.posthogHost;

if (__DEV__ && !projectToken) {
  console.error(
    'EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
  );
}

/**
 * The single PostHog client for the Expo application. It is undefined when the
 * public build-time token is not configured, so production builds remain usable
 * without analytics.
 */
export const posthog = projectToken
  ? new PostHog(projectToken, {
      ...(host ? { host } : {}),
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: false,
        },
      },
    })
  : undefined;

/**
 * Provides the shared PostHog client to the app when analytics is configured.
 * Call sites that import `posthog` must guard calls with optional chaining.
 */
function ErrorFallback() {
  return (
    <View
      style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}
    >
      <Text>Something went wrong. Please restart the app.</Text>
    </View>
  );
}

export function PostHogRoot({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;

  return (
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary fallback={ErrorFallback}>
        {children}
      </PostHogErrorBoundary>
    </PostHogProvider>
  );
}

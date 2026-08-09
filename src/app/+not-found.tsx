import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * NF-01, NF-02 — a quiet apology and one way home.
 *
 * Anything that is not a route in this app used to redirect blind, the
 * moment it mounted, with nothing ever drawn on screen. Without a route here
 * expo-router falls back to its OWN "Unmatched Route" screen — which ships in
 * RELEASE builds, not just development — and firing any unknown `cinch://`
 * link at the installed app dropped the user onto a black debug page printing
 * the raw URL verbatim, with a "Sitemap" link listing every internal route.
 * That is worse than ugly: the URL is attacker-controlled, so it was a
 * surface for rendering chosen text inside the app's own chrome, and the
 * sitemap volunteered the app's structure to whoever asks.
 *
 * The blind redirect fixed that by showing nothing at all. This screen
 * doesn't reopen the hole — the sentence below is a FIXED string this file
 * owns, never the URL or anything derived from it — so it can afford to
 * actually say something, per the atlas: one serif line, one sentence, one
 * action, the wordmark at the foot. No error code, no cartoon.
 *
 * "Back to Today" always targets `/(tabs)` rather than branching on session
 * state: the root layout's own auth gate (`src/app/_layout.tsx`) already
 * redirects an unauthenticated user from `(tabs)` to sign-in on the very next
 * render, so this screen does not need to know who is signed in to send them
 * somewhere correct.
 */
export type NotFoundShellProps = {
  /** The one serif line — e.g. "This one is not here." */
  sentence: string;
  /** The one sentence under it. */
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function NotFoundShell({
  sentence,
  detail,
  actionLabel = 'Back to Today',
  onAction,
}: NotFoundShellProps) {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-gutter">
        <Text variant="display" trim className="text-center" accessibilityRole="header">
          {sentence}
        </Text>
        <Text variant="body" className="mt-3 text-center text-muted">
          {detail}
        </Text>
        <Button
          title={actionLabel}
          variant="ink"
          onPress={onAction ?? (() => router.replace('/(tabs)'))}
          className="mt-7 px-8"
        />
      </View>

      {/* The wordmark at the foot — the only thing that says which app this
          is. No colophon, no error code. */}
      <View className="items-center pb-6">
        <Text variant="title" trim>
          Cinch
        </Text>
      </View>
    </SafeAreaView>
  );
}

/** NF-01 — the default catch-all: a stale or mistyped link, or none at all. */
export default function NotFound() {
  return (
    <NotFoundShell
      sentence="This one is not here."
      detail="The link may be old, or whoever sent it has taken it down."
    />
  );
}

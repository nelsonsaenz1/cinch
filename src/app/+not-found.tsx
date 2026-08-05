import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/use-session';

/**
 * Anything that is not a route in this app.
 *
 * Without this file expo-router falls back to its own "Unmatched Route" screen
 * — which ships in RELEASE builds, not just development. Firing any unknown
 * `cinch://` link at the installed app dropped the user onto a black debug page
 * printing the raw URL verbatim, with a "Sitemap" link listing every internal
 * route. Verified on a Release build before this existed.
 *
 * That is worse than ugly. The URL is attacker-controlled — anyone can put a
 * `cinch://` link in an email — so it is a surface for rendering chosen text
 * inside the app's own chrome, and the sitemap volunteers the app's structure
 * to whoever asks. A stale or mistyped sign-in link is the innocent version of
 * the same thing, and it should look like the app, not like a crash.
 *
 * There is nothing to show a person here, so it does not try: it sends them
 * where they were going anyway. `Redirect` rather than an effect, so the route
 * is replaced during render and never flashes.
 */
export default function NotFound() {
  const session = useSession();

  // Session hydration is asynchronous; redirecting before it settles would send
  // a signed-in user to the sign-in screen for a frame.
  if (session.loading) return null;

  return <Redirect href={session.userId ? '/(tabs)' : '/(auth)/sign-in'} />;
}

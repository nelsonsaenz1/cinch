import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { completeSessionFromUrl } from './actions';

/**
 * Finish a magic-link sign-in when the link opens the app.
 *
 * Two cases, and missing either one produces a link that "does nothing":
 *
 *  - The app was already running and iOS delivers the URL to a listener.
 *  - The app was cold-started BY the link, in which case no event ever fires
 *    and the URL is only available from `getInitialURL()`.
 *
 * Every incoming URL is offered here, which is safe because
 * `completeSessionFromUrl` acts on `cinch://auth-callback` alone and ignores
 * everything else. The `/auth-callback` screen expo-router mounts for the same
 * link runs the same call; the exchange is deduplicated by authorization code,
 * so whichever arrives second sees the first one's result instead of burning
 * the single-use code.
 *
 * Outcomes are dropped here deliberately: this hook lives in the root layout
 * and has nowhere to render an error. The callback screen owns the progress and
 * failure UI.
 */
export function useDeepLinkAuth() {
  useEffect(() => {
    let cancelled = false;

    const handle = (url: string | null) => {
      if (!url || cancelled) return;
      void completeSessionFromUrl(url);
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

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

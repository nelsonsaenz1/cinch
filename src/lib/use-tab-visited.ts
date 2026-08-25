import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Whether this tab has been LOOKED AT this session — not merely mounted.
 *
 * `NativeTabs` is a UITabBarController: all five tab screens mount together at
 * launch, so a mount `useEffect` runs for every tab the moment the app opens.
 * That is how `stylist_opened` came to fire for people who never left Today
 * (verified live 2026-08-25: five tabs' "opened" events landed within ~1.5s of
 * sign-in, and the actual visits afterwards produced only `$screen`). A page
 * event that fires unseen is not a page event; it is a launch counter wearing
 * the wrong name.
 *
 * Gate the analytics effects on this instead: `false` until the tab first
 * receives focus, `true` from then on — deliberately never back to `false`,
 * because the screens dedupe repeat fires with their own refs and a re-focus
 * is not a second visit. State rather than a ref so the gated effects re-run
 * the moment the visit happens.
 */
export function useTabVisited(): boolean {
  const [visited, setVisited] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisited(true);
    }, []),
  );
  return visited;
}

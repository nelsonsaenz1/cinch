import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * The Closet's one-time invitation to build a profile worth sharing.
 *
 * This has its own install-local key instead of borrowing Profile's coaching
 * key. The two moments do different jobs: Profile explains its settings,
 * while Closet shows the social payoff of adding an identity and wardrobe.
 * Someone who already dismissed one should still see the other once.
 */
const SEEN_KEY = 'cinch.closet.inspiration.seen.v1';

export function useClosetInspiration() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (alive && !seen) setShow(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  return { show, dismiss };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * PR-C1 / PR-C2 — the coaching card is shown ONCE, and once means once.
 *
 * "Shown once, keyed on first Profile visit; 'Not now' and the close control
 * both dismiss permanently." And PR-C2 is explicit about what replaces it:
 * "The coaching card is gone and nothing replaces it — no banner, no dot, no
 * second invitation."
 *
 * AsyncStorage rather than a query or a column, for three reasons. It is the
 * idiom two other one-shot flags in this app already use
 * (`use-trial-expired.ts`, `use-alias-reconcile.ts`); a coaching card is a
 * property of an INSTALL rather than of an account, so a server column would
 * make a reinstall inherit a dismissal from a different phone; and it must
 * resolve without a network round trip, because the alternative is a card that
 * appears a second after the screen does.
 *
 * ── WHY IT STARTS HIDDEN ──────────────────────────────────────────────────
 *
 * `show` is false until the read comes back. The two failure modes are not
 * symmetric: a card that flashes in after a beat is a card that appears to
 * somebody who has already dismissed it, which is the exact thing PR-C2
 * forbids. A card that arrives one frame late costs nothing.
 *
 * A FAILED read is treated as "already seen" for the same reason. If storage is
 * unreadable, the honest options are to show a coaching card to somebody who
 * may have dismissed it, or to skip one for somebody who has not. The second is
 * the smaller harm — the profile screen is fully usable without it.
 */
const SEEN_KEY = 'cinch.profile.coaching.seen.v1';

export function useProfileCoaching() {
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

  /**
   * Hide first, persist after. The write is fire-and-forget: a dismissal that
   * failed to save must still dismiss, because a card that stays on screen
   * after being dismissed is a broken control, and the worst case of a lost
   * write is that it appears once more on a later launch.
   */
  const dismiss = () => {
    setShow(false);
    void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  return { show, dismiss };
}

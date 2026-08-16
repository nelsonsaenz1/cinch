import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { Toast } from '@/components/ui/toast';

/**
 * UX-08 — one toast, mounted once, reachable from anywhere.
 *
 * `components/ui/toast.tsx` is the object; this is the place to put it. Its own
 * docblock explains why it does not time itself out — "the 5-second window is a
 * data-layer fact (the mutation actually fires when it closes), so the timer
 * lives with the mutation, never in chrome that could be unmounted apart from
 * it" — and that is exactly right for the undo toast BR-06 invented it for.
 *
 * But it made every other toast expensive. A screen that wants to say "Copied"
 * has to hold `visible`, hold `message`, render `<Toast>` at the bottom of its
 * own tree, and remember to clear the flag; five of them do, each slightly
 * differently. So the cheap surface stayed unreachable and the expensive one —
 * `Alert.alert` — got used instead, which is a good part of how the audit
 * reached 43 blocking alerts.
 *
 * This host makes the cheap surface the cheap one. `useToast().show('Copied')`
 * is the whole of it, from any depth, with no state and no markup at the call
 * site.
 *
 * ── The undo contract is preserved exactly ───────────────────────────────────
 *
 * `duration: null` opts out of the timer, and the caller closes the toast when
 * its mutation window closes — which is the arrangement the existing undo
 * toasts already have and must keep. The host's default timer is a convenience
 * for the confirmations that have no data-layer window at all, never a
 * replacement for one that does. A toast with an `onAction` and a host timer
 * would be a reversal the user can lose by looking away, so `show` refuses that
 * combination rather than allowing it quietly.
 *
 * ── Announcement ─────────────────────────────────────────────────────────────
 *
 * `Toast` carries `accessibilityRole="alert"`, which is the right role but is
 * not reliably spoken on iOS when the element mounts inside an already-rendered
 * tree — and this host, by design, mounts it inside a tree that has been
 * rendered since launch. So the message is also announced explicitly.
 * `queue: true` because a toast follows an action the user just took, and
 * interrupting VoiceOver mid-sentence to report a success is worse than
 * arriving a beat late.
 *
 * ── The one thing the host cannot do ─────────────────────────────────────────
 *
 * It is mounted at the root of the React tree, and the app's sheets (`profile`,
 * `stylist`, `privacy`, `help`, `diary`, and the modals above them) are NATIVE
 * presentations — UIKit puts them above the root view, not inside it. A toast
 * raised from inside a form sheet therefore appears BEHIND that sheet.
 *
 * That is a property of the presentation, not a bug to route around, and the
 * answer is not to move the host: a confirmation about work done inside a sheet
 * belongs inside that sheet. Those call sites keep rendering their own
 * `<Toast>` local to the sheet, which is exactly what `invite.tsx`, `borrow.tsx`
 * and `event/[id]/outfits.tsx` already do. Use the host for tab-level surfaces;
 * use the component inside a sheet.
 *
 * The existing per-screen `<Toast>` call sites are untouched. This is additive:
 * the component works exactly as it did for anyone who wants to hold their own
 * state, and lanes migrate to the host when they touch a tab-level surface
 * anyway.
 */

/** The default window. Long enough to read a short sentence, short enough not to nag. */
const DEFAULT_DURATION = 4000;

export type ShowToastOptions = {
  /**
   * The trailing verb — "Retry", "View". Both or neither, per `ToastProps`: a
   * label with no handler renders a dead target.
   */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * How long the host holds it open, in ms. `null` means the host never closes
   * it and the CALLER owns the window — see the undo contract above.
   *
   * An `onAction` toast must pass `null`. A reversal on a timer the caller does
   * not control is a reversal the caller cannot honour.
   */
  duration?: number | null;
};

type ToastApi = {
  show: (message: string, options?: ShowToastOptions) => void;
  /** Close the current toast early — for a caller that owns its own window. */
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

type ToastState = { message: string; actionLabel?: string; onAction?: () => void };

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A pending timer outliving the tree would fire `setVisible` on an unmounted
  // host. The host lives for the whole session, so this is belt-and-braces —
  // and it is the kind of leak that only shows up under Fast Refresh, which is
  // where it wastes the most time.
  useEffect(() => clearTimer, [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const show = useCallback<ToastApi['show']>(
    (message, options = {}) => {
      const { actionLabel, onAction, duration = DEFAULT_DURATION } = options;

      if (onAction && duration !== null) {
        throw new Error(
          'A toast with an action must pass duration: null — the caller owns the reversal window. See toast-host.tsx.',
        );
      }

      clearTimer();
      setCurrent({ message, actionLabel, onAction });
      setVisible(true);

      // Queued rather than interrupting: the reader is mid-sentence about the
      // thing they just did. See the header.
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });

      if (duration !== null) {
        timer.current = setTimeout(() => {
          timer.current = null;
          setVisible(false);
        }, duration);
      }
    },
    [clearTimer],
  );

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <Toast
          message={current.message}
          actionLabel={current.actionLabel}
          onAction={
            current.onAction
              ? () => {
                  // Closed before the handler runs: an undo that navigates would
                  // otherwise leave the strip floating over the screen it landed
                  // on. `Toast` keeps itself mounted while it animates out.
                  dismiss();
                  current.onAction?.();
                }
              : undefined
          }
          // Cleared only once it has finished LEAVING, so the message does not
          // blank out mid-animation.
          onDismiss={() => setCurrent(null)}
          visible={visible}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

/**
 * The call-site API.
 *
 * Throws rather than no-opping when the host is missing: a confirmation that
 * silently does not appear is indistinguishable from one that was never wired
 * up, and this is mounted at the root so the only way to hit it is a test tree
 * or a mistake.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastHost>. It is mounted in app/_layout.tsx.');
  return api;
}

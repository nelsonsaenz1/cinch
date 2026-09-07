import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  INVITE_ASK_ANSWERED_KEY,
  inviteAskAnsweredProps,
  shouldOfferInviteAsk,
} from '@/features/invite/ask-spec';
import { track } from '@/lib/posthog';

/**
 * The invite card on Today — see `ask-spec.ts` for why it exists.
 *
 * Wiring only. `shouldOfferInviteAsk` decides; "Share your link" opens the
 * invite screen, which owns the share sheet and the `invite_shared` event,
 * so this hook adds no second way to share. Either answer retires the card:
 * hide first, persist after (`use-trip-reminder.ts`'s contract) — a
 * dismissal that failed to save must still dismiss.
 *
 * Starts hidden until the answered flag resolves, and a failed read counts
 * as answered: late costs nothing, a flash shows a card to somebody who
 * already sent it away, and the invite screen still exists.
 *
 * Does not report the impression — the card component does, on its own
 * mount, because only the mount knows every gate on Today above it passed.
 */
export function useInviteAsk(input: { closetUsable: boolean; pushAskShowing: boolean }) {
  const router = useRouter();
  const [answered, setAnswered] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(INVITE_ASK_ANSWERED_KEY)
      .then((value) => {
        if (alive) setAnswered(value !== null);
      })
      .catch(() => {
        if (alive) setAnswered(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const settle = () => {
    setAnswered(true);
    void AsyncStorage.setItem(INVITE_ASK_ANSWERED_KEY, '1').catch(() => {});
  };

  const share = () => {
    track('invite_ask_answered', inviteAskAnsweredProps('share'));
    settle();
    router.push('/invite');
  };

  const notNow = () => {
    track('invite_ask_answered', inviteAskAnsweredProps('not_now'));
    settle();
  };

  return {
    show: shouldOfferInviteAsk({ ...input, answered }),
    share,
    notNow,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  PUSH_ASK_ANSWERED_KEY,
  PUSH_ASK_PENDING_WRITE_KEY,
  pushAskAnsweredProps,
  shouldOfferPushAsk,
  type PushAskCloset,
} from '@/features/push/ask-spec';
import { PUSH_AVAILABLE } from '@/features/push/native';
import {
  askPushPermission,
  pushPermissionKey,
  usePushPermission,
} from '@/features/push/permission';
import {
  notificationPrefsKey,
  readNotificationPrefs,
  useSetNotificationPrefs,
} from '@/features/push/prefs';
import { track } from '@/lib/posthog';

/**
 * The morning-edit card on Today — see `ask-spec.ts` for why it exists.
 *
 * Wiring only. `shouldOfferPushAsk` decides, `askPushPermission` asks (and
 * registers the token on a grant — the same path the Settings switch takes),
 * and the prefs write is the one the Notifications screen makes when a switch
 * moves on: the WHOLE set, because a partial upsert would reset the other
 * channels to column defaults. `morning_edit` is switched on explicitly even
 * though it defaults on, because `push_claim_morning_edit` reads a ROW — a
 * person with no row is a person the sender never sees.
 *
 * ── THE WRITE IS COMPOSED FROM THE SERVER, AT THE MOMENT OF WRITING ───────
 *
 * Not from a render's closure. A row CAN exist while iOS still reads
 * `undetermined` (switching a default-on channel OFF in Settings writes a row
 * and asks nothing), and a Today cold start can tap "Turn on" before the
 * prefs query has resolved. Either way a stale `undefined` would become a row
 * of defaults written over somebody's choices — the one thing `prefs.ts`
 * promises never to do. So `fetchQuery` reads the truth first, and a read
 * that fails writes nothing.
 *
 * ── A GRANT WHOSE WRITE FAILED IS OWED, NOT FORGOTTEN ─────────────────────
 *
 * After a grant the permission is no longer `undetermined`, so the card
 * cannot come back to retry — and a granted permission with no prefs row is
 * a person who said yes and will never hear from us. The failed write is
 * therefore recorded under `PUSH_ASK_PENDING_WRITE_KEY` and retried on the
 * next Today mount, until it lands.
 *
 * ── WHAT THIS HOOK DOES NOT DO ────────────────────────────────────────────
 *
 * It does not report the impression. `show` is one gate of several the card
 * sits behind on Today (offline, "nothing works today", the pending-consent
 * floor, the tab having been focused), and a hook above those early returns
 * cannot see them. The card component reports its own mount, once per person.
 *
 * Starts hidden until both reads (the permission and the answered flag)
 * resolve, on `use-trip-reminder.ts`'s reasoning: late costs nothing, a flash
 * shows a card to somebody who already answered it. A failed storage read is
 * treated as answered for the same asymmetry — Settings still exists.
 */
export function usePushAsk(closet: PushAskCloset) {
  const qc = useQueryClient();
  const permission = usePushPermission();
  const save = useSetNotificationPrefs();

  const [answered, setAnswered] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  // The render-time `busy` cannot stop a second press dispatched before the
  // re-render commits; the ref can.
  const inFlight = useRef(false);

  /** The full-set write, from the server's row (or the defaults when there is none). */
  const writeMorningEditOn = async (): Promise<void> => {
    const current = await qc.fetchQuery({
      queryKey: notificationPrefsKey,
      queryFn: readNotificationPrefs,
    });
    await save.mutateAsync({ ...current, morning_edit: true });
  };

  useEffect(() => {
    // Nothing to read on a binary that cannot ask — and no reason to touch
    // storage for a card that will never draw.
    if (!PUSH_AVAILABLE) return;
    let alive = true;
    AsyncStorage.getItem(PUSH_ASK_ANSWERED_KEY)
      .then((value) => {
        if (alive) setAnswered(value !== null);
      })
      .catch(() => {
        if (alive) setAnswered(true);
      });

    // The owed write, if the last grant's did not land.
    AsyncStorage.getItem(PUSH_ASK_PENDING_WRITE_KEY)
      .then(async (pending) => {
        if (pending === null) return;
        await writeMorningEditOn();
        await AsyncStorage.removeItem(PUSH_ASK_PENDING_WRITE_KEY);
      })
      .catch(() => {
        // Still owed; the next mount tries again.
      });
    return () => {
      alive = false;
    };
    // Mount only: the retry is a fact about the install, not about a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = shouldOfferPushAsk({
    available: PUSH_AVAILABLE,
    permission: permission.data,
    closet,
    answered,
  });

  /** Hide first, persist after — a dismissal that failed to save must still dismiss. */
  const settle = () => {
    setAnswered(true);
    void AsyncStorage.setItem(PUSH_ASK_ANSWERED_KEY, '1').catch(() => {});
  };

  const notNow = () => {
    if (inFlight.current) return;
    track('push_ask_answered', pushAskAnsweredProps('not_now'));
    settle();
  };

  const turnOn = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    track('push_ask_answered', pushAskAnsweredProps('turn_on'));
    try {
      const result = await askPushPermission();
      qc.setQueryData(pushPermissionKey, result);
      if (result === 'granted') {
        try {
          await writeMorningEditOn();
        } catch {
          await AsyncStorage.setItem(PUSH_ASK_PENDING_WRITE_KEY, '1').catch(() => {});
        }
      }
    } catch {
      // The permission layer never throws for a refusal; anything that does
      // reach here is the module misbehaving, and the card has still been
      // answered. Settings remains the way back in.
    } finally {
      inFlight.current = false;
      setBusy(false);
      settle();
    }
  };

  return { show, busy, turnOn, notNow };
}

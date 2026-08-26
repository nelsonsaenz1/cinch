import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { track } from '@/lib/posthog';

import { evaluateRatingAsk } from './rating-ask-core';

/**
 * The one place the App Store rating sheet may be requested from.
 *
 * Called as the wear-confirmation sheet's settled composition is dismissed —
 * see `rating-ask-core.ts` for why that moment and no other. Imperative
 * rather than a hook because the trigger is a button press, not a state the
 * screen sits in.
 *
 * The short delay lets the sheet's dismissal animation finish first, so the
 * system card does not land on top of a closing surface. Fire-and-forget all
 * the way down: a rating ask that could delay or break the wear flow would
 * cost more than every rating it gathers.
 */
const AFTER_DISMISS_MS = 700;

export function askForRatingAfterWear(): void {
  setTimeout(() => {
    void evaluateRatingAsk(new Date(), {
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      cancelled: () => false,
      request: () => {
        void StoreReview.isAvailableAsync()
          .then((available) => {
            if (!available) return;
            // THE CALL, not the card: iOS decides whether anything appears
            // and never says. The event exists so a ratings delta in App
            // Store Connect can be read against how often we even asked.
            track('rating_prompt_requested');
            return StoreReview.requestReview();
          })
          .catch(() => {
            // A refused or crashed request is a silent non-event by design.
          });
      },
    });
  }, AFTER_DISMISS_MS);
}

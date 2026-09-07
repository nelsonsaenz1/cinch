import Storage from 'expo-sqlite/kv-store';

import type { ReviewPromptIo } from './review-prompt-core';

/**
 * The one kv-store adapter every review-prompt surface shares — the card
 * itself, the moments that arm it (`review-moments.ts`), and the paywall
 * stamps `billing/use-gate.ts` writes so the card never lands on a sheet.
 *
 * Synchronous on purpose: the card decides during render (an adjust-during-
 * render, see `review-prompt.tsx`), and a decision read through a promise
 * would be a decision about the previous render. Every read and write is
 * wrapped, because the store being unavailable must cost at most one extra
 * or one missing ask — never a throw on the root layout.
 */
export const reviewPromptIo: ReviewPromptIo = {
  read(key) {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // A failed write only means one extra ask some later session.
    }
  },
};

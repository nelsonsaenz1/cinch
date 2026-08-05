import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as StoreReview from 'expo-store-review';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { track } from '@/lib/posthog';

/**
 * The share card is authored on a fixed 360 × 640 logical canvas — 9:16, the
 * Stories/TikTok frame. Every coordinate in plate-card.tsx assumes it.
 */
export const CARD_W = 360;
export const CARD_H = 640;

const REVIEW_PROMPTED_KEY = 'cinch.review.prompted-after-share';

/**
 * Capture a mounted `<PlateCard/>` and hand it to the system share sheet.
 *
 * The `width`/`height` passed to `captureRef` are LOGICAL points — view-shot
 * multiplies by the device scale, so 1080 ÷ PixelRatio comes out at exactly
 * 1080 × 1920 pixels on every device. Passing `1080` directly is the mistake
 * that ships blurry share cards: it asks for a 3240px-wide capture on @3x,
 * which iOS renders by resampling. (On the few @2x devices the 360pt view
 * rasterises at 720 wide and is upscaled to 1080 — correct dimensions,
 * slightly soft; @3x devices, i.e. nearly all of them, are exact.)
 */
export async function sharePlate(ref: RefObject<View | null>): Promise<string> {
  const scale = PixelRatio.get();
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: 1080 / scale,
    height: 1920 / scale,
  });

  if (await Sharing.isAvailableAsync()) {
    // Fired when the sheet OPENS. iOS resolves shareAsync on dismissal without
    // saying whether anything was sent, so "shared" here means "reached the
    // share sheet" — the honest maximum the platform reports.
    track('outfit_shared');
    await Sharing.shareAsync(uri, { UTI: 'public.png', mimeType: 'image/png' });
    await maybeRequestReview();
  }

  // The capture URI, so dev tooling can inspect the exact artifact.
  return uri;
}

/**
 * The one review prompt the app ever initiates, fired after the first share.
 * Apple caps `requestReview` at 3 shows per user per 365 days and gives no
 * callback, so the moment has to be chosen once and chosen well — right after
 * the user liked an outfit enough to send it somewhere. Never on launch,
 * never after an error.
 *
 * `shareAsync` resolves on sheet dismissal whether or not the user actually
 * shared — iOS doesn't say. The flag is set regardless so a cancelled sheet
 * can't cause a second ask on some later share.
 */
async function maybeRequestReview(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(REVIEW_PROMPTED_KEY)) return;
    // hasAction first: if StoreKit can't show anything right now, the one
    // shot isn't burned — the next share gets to try again. The flag is set
    // before requestReview so a throw can't cause repeat asks.
    if (await StoreReview.hasAction()) {
      await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, '1');
      await StoreReview.requestReview();
    }
  } catch {
    // A failed review prompt must never surface as a share error.
  }
}

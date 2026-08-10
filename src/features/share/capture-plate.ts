import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import type { RefObject } from 'react';
import { PixelRatio, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { myInviteUrl } from '@/features/invite/my-link';
import { track } from '@/lib/posthog';

import { plateShareMessage, type ShareSubject } from './share-copy';

/**
 * The share card is authored on a fixed 360 × 640 logical canvas — 9:16, the
 * Stories/TikTok frame. Every coordinate in plate-card.tsx assumes it.
 */
export const CARD_W = 360;
export const CARD_H = 640;

const REVIEW_PROMPTED_KEY = 'cinch.review.prompted-after-share';

/**
 * `share_completed`'s `activity_type`, bounded.
 *
 * iOS reports the chosen activity as a reverse-DNS identifier. Apple's own are
 * the fixed `UIActivityType` vocabulary and are safe to record: `Message`,
 * `Mail`, `AirDrop`, `CopyToPasteboard`, `SaveToCameraRoll` and the rest of a
 * list that ships with the SDK. Everything else is the bundle id of a
 * third-party share extension — which is to say, the name of an app the user
 * has installed on their phone. That is neither a bounded enum nor ours to
 * collect (see the privacy note at the top of `lib/posthog.tsx`), so it
 * collapses to 'other'.
 *
 * `null` is a real answer, not a missing one: RN's completion handler fires
 * with `activityType == nil` in cases iOS declines to name.
 */
function boundedActivity(activityType: string | null | undefined): string {
  if (!activityType) return 'unknown';
  const APPLE = 'com.apple.UIKit.activity.';
  return activityType.startsWith(APPLE) ? activityType.slice(APPLE.length) : 'other';
}

/**
 * Capture a mounted card and hand it to the system share sheet, with a message.
 *
 * The `width`/`height` passed to `captureRef` are LOGICAL points — view-shot
 * multiplies by the device scale, so 1080 ÷ PixelRatio comes out at exactly
 * 1080 × 1920 pixels on every device. Passing `1080` directly is the mistake
 * that ships blurry share cards: it asks for a 3240px-wide capture on @3x,
 * which iOS renders by resampling. (On the few @2x devices the 360pt view
 * rasterises at 720 wide and is upscaled to 1080 — correct dimensions,
 * slightly soft; @3x devices, i.e. nearly all of them, are exact.)
 *
 * WHY THIS IS `Share.share` AND NOT `Sharing.shareAsync`
 *
 * `expo-sharing` has no message parameter and no link parameter: a recipient
 * got a PNG with no route back into the app, which is the whole referral loop
 * missing its second half. React Native's `Share` carries a `message` beside
 * the file, so the sharer's invite link travels with the picture.
 *
 * The swap costs nothing on the image side, and this is checkable rather than
 * hopeful. `expo-sharing`'s iOS implementation is
 * `UIActivityViewController(activityItems: [url])`
 * (`node_modules/expo-sharing/ios/SharingModule.swift:21`) — and it never reads
 * `UTI` or `mimeType`, which are declared in `SharingOptions.swift` and used
 * only on Android. React Native builds the same controller from the same kind
 * of `NSURL` (`RCTActionSheetManager.mm:245-279`), so the item iOS receives for
 * the PNG is identical; `message` is a second item added in front of it.
 *
 * THE LINK RIDES IN THE MESSAGE, NOT IN `url`
 *
 * There is exactly one `url` slot and the image is in it. `share-copy.ts`
 * explains the consequence and holds the sentences. The card itself is
 * untouched — its omissions (no URL, no QR, no cost-per-wear) are deliberate
 * and documented in `plate-card.tsx`; the link is in the message, which is not
 * the artifact.
 *
 * `subject` DEFAULTS TO `'outfit'` AND THAT IS A KNOWN GAP. The packing memo
 * shares through this same function from `features/plan/packing-trip.tsx`,
 * which is another unit's file, so it cannot be updated from here. Until it
 * passes `'packing'` the memo ships the outfit sentence, which is true but
 * generic. The default is `'outfit'` rather than something neutral because
 * three of the four call sites are outfits and a neutral default would make
 * both of them vague.
 */
export async function sharePlate(
  ref: RefObject<View | null>,
  subject: ShareSubject = 'outfit',
): Promise<string> {
  const scale = PixelRatio.get();
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: 1080 / scale,
    height: 1920 / scale,
  });

  // Resolved before the sheet is asked for, and bounded to 1.2s inside
  // `myInviteUrl`. A share sheet that waits on the network is a share sheet
  // that reads as broken.
  const link = await myInviteUrl();
  const message = plateShareMessage(subject, link);

  // Fired when the sheet is ASKED FOR. iOS reports completion (see below) but
  // not reliably enough to gate a funnel event on, so "shared" here still means
  // "reached the share sheet" — the honest maximum.
  //
  // `has_link` is the referral half of the question: a share that went out
  // without the sharer's link cannot recruit anybody, and `myInviteUrl` returns
  // null both for a user who never chose a handle and for a cold read that ran
  // out its 1.2s. A K-factor computed against every share rather than against
  // the shares that carried a route back in would be measuring the wrong
  // denominator. The URL itself is never sent — only whether there was one.
  track('outfit_shared', { subject, has_link: link !== null });

  // `result: 'tmpfile'` returns a bare absolute path, not a `file://` URL.
  // `RCTConvert NSURL` (`RCTConvert.mm:79-121`) tries `URLWithString` first,
  // finds no scheme, and falls through to `fileURLWithPath` — so the path
  // arrives at UIActivityViewController as a proper file URL. This is the same
  // string `Sharing.shareAsync` was being handed, unchanged.
  const sheet = Share.share({ message, url: uri });

  // DELIBERATELY NOT AWAITED, and this is the one behavioural difference worth
  // knowing about. React Native's completion handler only calls back when
  // `completed || activityType == nil` (`RCTActionSheetManager.mm:291-296`),
  // which drops one of the four permutations: pick an activity, then cancel its
  // follow-up (tap Mail, then cancel the composer) and the promise never
  // settles. `expo-sharing` fixed exactly this bug on its side and says so in
  // `SharingModule.swift:25-31`.
  //
  // Both callers use the returned promise to unmount the offscreen card and
  // re-enable their share button, so awaiting a promise that can hang forever
  // would wedge the control for the rest of the session. Resolving as soon as
  // the sheet has been asked for is the contract that cannot hang, and it is
  // also more accurate: the capture is finished and the card is free.
  void sheet
    .then((result) => {
      // The review prompt is now gated on a real send rather than on a
      // dismissal. `Sharing.shareAsync` could not tell the difference; this can.
      if (result.action !== 'sharedAction') return;
      // Same beat, same evidence. This rides in the branch that already proves
      // a send rather than being emitted beside it, so the event and the review
      // prompt can never disagree about whether anything was shared. It is a
      // numerator only — the dropped permutation described above means an
      // unknown share of real sends never reaches here, so this may be read as
      // a floor and never divided into `outfit_shared`.
      track('share_completed', {
        subject,
        activity_type: boundedActivity(result.activityType),
      });
      void maybeRequestReview();
    })
    .catch(() => {
      // A failed or cancelled share is not an error the user needs told about.
      // Nothing was promised.
    });

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
 * This used to run on sheet DISMISSAL, because `shareAsync` resolved there and
 * iOS said nothing about whether anything was sent. `Share.share` reports
 * `sharedAction`, so the prompt now follows an actual send — and the flag is
 * still set before the ask, so a throw cannot cause repeat prompts.
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

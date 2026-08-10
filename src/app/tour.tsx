import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';

import { TourFrameView } from '@/features/onboarding/tour-frames';
import { useMarkToured } from '@/features/onboarding/tour-queries';
import { frameAt, nextIndex, type TourExit } from '@/features/onboarding/tour-state';

/**
 * The first-run tour — atlas 36, TR-01…TR-03.
 *
 * Shown on the first launch after sign-in and never again, on any device. It
 * is not in Settings and there is no way back to it: `profiles.toured_at` is
 * written on the way out and nothing in the app reads it except the gate that
 * sends the user here (see `tour-queries.ts`, and the note below on where the
 * gate belongs).
 *
 * WHAT THIS SCREEN DOES NOT DO
 *
 * It collects nothing — no name, no sizes, no style quiz; the closet is the
 * profile. And it raises no permission dialog. The camera on TR-02 and the
 * weather on TR-03 are drawings; the real prompts belong to `capture.tsx` and
 * to the location sheet, at the moment each is needed. This is the atlas's one
 * absolute rule and it is why the frames import no camera and no location.
 *
 * WHERE THE GATE LIVES
 *
 * Not here. A screen that decides whether it should have been opened has
 * already been opened, which on a returning account means a frame of the
 * promise before it replaces itself away. The decision belongs to the flow
 * that hands off to the app; this route assumes it was made.
 */
export default function TourScreen() {
  const router = useRouter();
  const markToured = useMarkToured();
  const [index, setIndex] = useState(0);
  /**
   * One exit per tour. Two taps on "Start with the camera" while the replace
   * is in flight would otherwise stack two navigations, and the second lands
   * on a screen the first has already left.
   */
  const leaving = useRef(false);

  const frame = frameAt(index);

  const advance = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    const next = nextIndex(index);
    if (next != null) setIndex(next);
  }, [index]);

  /**
   * Every way out writes `toured_at` and then leaves — in that order, but
   * without waiting on it. A tour that holds the reader on the last frame
   * while a round trip settles is a worse failure than a tour that runs once
   * more after a write that did not land; `useMarkToured` records that trade
   * and updates the cache up front so nothing bounces back here in the
   * meantime.
   */
  const exit = useCallback(
    (to: TourExit) => {
      if (leaving.current) return;
      leaving.current = true;
      void Haptics.selectionAsync().catch(() => {});
      markToured.mutate();
      // `replace`, never `push`: the tour must not sit under the app on the
      // back stack. The root layout anchors every stack on `(tabs)`, so
      // replacing with `/capture` presents the camera modal over Today —
      // dismissing it lands on the page TR-03 has just described, not back
      // here.
      router.replace(to === 'camera' ? '/capture' : '/(tabs)');
    },
    [markToured, router],
  );

  return (
    <>
      {/* The back gesture would be a fourth, silent way out — one that leaves
          without recording that the tour was seen, so it would run again
          tomorrow. Skip is the honest version of the same intent and it is on
          screen from the first frame. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      {/* The ink ground is a ground, not a dark mode — but the status bar
          glyphs still have to be legible on it. */}
      <StatusBar style={frame.ground === 'ink' ? 'light' : 'dark'} />
      <TourFrameView
        frame={frame}
        index={index}
        onNext={advance}
        onSkip={() => exit('tabs')}
        onCamera={() => exit('camera')}
        onLookAround={() => exit('tabs')}
      />
    </>
  );
}

import { View } from 'react-native';

import { CardSkeletons, WalkthroughBand } from '@/components/intake/walkthrough-parts';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { READING_BACK, readingBackHeadline } from '@/features/intake/walkthrough-copy';

/**
 * V-04 — the recording becomes words.
 *
 * NO PERCENTAGE AND NO SPINNER. Progress is a count everywhere in this group,
 * and here there is nothing honest to count — the transcription is one round
 * trip whose remaining time nobody knows — so what the screen offers instead is
 * a duration estimate in prose and a promise about what happens if the reader
 * leaves. A spinner would be a claim that something is being measured.
 *
 * THE SKELETON ROWS ARE THE PROCESSION CARD'S GEOMETRY, at its radius and a
 * row's height, fading down the stack. They exist so nothing shifts at the swap
 * when the real cards arrive. They do not shimmer: a looping animation on a
 * screen somebody may sit in front of for thirty seconds is movement without
 * information, and it makes this frame impossible to photograph twice.
 *
 * THE SLOW NOTICE IS ADDITIVE. It appears under the same layout rather than
 * replacing the screen, so a slow response never looks like a different
 * failure. The state above it does not change; one tray band arrives.
 */

export function ReadingBack({
  durationMs,
  slow,
  onLeaveRunning,
}: {
  /** The take's measured length. Null drops the figure rather than guessing. */
  durationMs: number | null;
  /**
   * Whether the response has passed `SLOW_NOTICE_AFTER_MS`. A prop, not a timer
   * of this component's own — a component that starts its own clock cannot be
   * photographed in both states.
   */
  slow: boolean;
  onLeaveRunning: () => void;
}) {
  return (
    <View className="flex-1">
      <View className="px-gutter">
        <Text variant="eyebrow">{READING_BACK.eyebrow}</Text>
        <View style={{ marginTop: 6, marginBottom: 12 }}>
          <Text variant="display" trim accessibilityRole="header">
            {readingBackHeadline(durationMs)}
          </Text>
        </View>
        <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
          {READING_BACK.body}
        </Text>
      </View>

      {/* The card's geometry, at a row's height. See `CardSkeletons` for why
          three and why they do not shimmer. */}
      <View className="px-gutter" style={{ paddingTop: 24 }}>
        <CardSkeletons />
      </View>

      <View style={{ flex: 1 }} />

      {slow ? (
        // ADDITIVE. It arrives under a layout that does not otherwise change,
        // because a slow response must never look like a different failure.
        <View className="px-gutter" style={{ paddingBottom: 12, gap: 10 }}>
          <WalkthroughBand
            alert
            title={READING_BACK.slowTitle}
            body={READING_BACK.slowBody}
          />
          {/* The notice is information, not a control: acknowledging it leaves
              the wait exactly where it was, which is why it is a secondary and
              never the frame's filled action. */}
          <Button
            title={READING_BACK.slowAction}
            variant="secondary"
            onPress={onLeaveRunning}
            className="self-stretch"
          />
        </View>
      ) : null}
    </View>
  );
}

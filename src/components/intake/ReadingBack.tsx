import { View } from 'react-native';

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

const SKELETON_OPACITIES = [1, 0.72, 0.48, 0.28];

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
      <View className="px-gutter" style={{ paddingTop: 44 }}>
        <Text variant="eyebrow">{READING_BACK.eyebrow}</Text>
        <View style={{ marginTop: 10, marginBottom: 12 }}>
          <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 36 }}>
            {readingBackHeadline(durationMs)}
          </Text>
        </View>
        <Text variant="note" style={{ fontSize: 16, lineHeight: 25 }}>
          {READING_BACK.body}
        </Text>
      </View>

      <View
        className="px-gutter"
        style={{ paddingTop: 28, gap: 10 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {SKELETON_OPACITIES.map((opacity, i) => (
          <View
            key={i}
            className="border border-rule bg-surface"
            style={{ height: 52, borderRadius: 12, opacity }}
          />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {slow ? (
        <View className="px-gutter" style={{ paddingBottom: 20 }}>
          <View className="bg-tray" style={{ borderRadius: 12, padding: 16 }} accessibilityRole="alert">
            <Text variant="heading" style={{ fontSize: 15 }}>
              {READING_BACK.slowTitle}
            </Text>
            <Text variant="note" style={{ fontSize: 14, lineHeight: 21, marginTop: 3 }}>
              {READING_BACK.slowBody}
            </Text>
          </View>
          <Button
            title={READING_BACK.slowAction}
            variant="ghost"
            onPress={onLeaveRunning}
            className="self-stretch"
          />
        </View>
      ) : null}
    </View>
  );
}

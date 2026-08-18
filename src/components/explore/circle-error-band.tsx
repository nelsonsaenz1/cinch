import { View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { EXPLORE_COPY, LOOK_CARD_RADIUS, WELL_RATIO } from '@/features/explore/explore-spec';
import { useTheme, warningAlpha } from '@/theme/tokens';

/**
 * THE READ FAILED, AND IT IS RECOVERABLE — the accepted `offline-recoverable`
 * frame.
 *
 * ── What this band refuses to claim ─────────────────────────────────────────
 *
 * An empty state describes the data; an error state refuses to. That
 * distinction is the whole reason the shared `ErrorState` exists, and it is
 * kept verbatim here: "This is a connection problem, not an empty circle.
 * Nothing has changed for anyone." A failed read must never be dressed as a
 * quiet day, and the network must never be offered as an explanation for
 * emptiness in the other direction either.
 *
 * ── Why not `ErrorState` or `NoticeBand` ────────────────────────────────────
 *
 * Both were read first. `ErrorState` is a full-page composition — glyph or
 * kicker, headline, body, one retry — and the accepted frame is deliberately
 * NOT full page: the ghost cards below the band are the point, because they
 * say the page is still there and will fill in. `NoticeBand` has the right
 * shape but the wrong ground (tray) and peer actions by contract, and this
 * frame has a filled primary and an outline escape.
 *
 * Amber at 0.16 from `warningAlpha`, `ink` on it. Derived from the palette's
 * own `warning` rather than eyedropped; canvas-on-warning is 2.85:1 and does
 * not clear AA, which is why the label is ink.
 *
 * `alert`, not `summary` — a failure that appears after a wait should be
 * announced rather than merely findable by swiping to it.
 */
export function CircleErrorBand({
  onRetry,
  onBack,
  retrying = false,
}: {
  onRetry: () => void;
  /** The way out that is not a retry. Required: a dead end is not a state. */
  onBack: () => void;
  retrying?: boolean;
}) {
  const theme = useTheme();

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View
        className="rounded-md p-4"
        style={{ backgroundColor: warningAlpha(0.16) }}>
        <Text variant="eyebrow" style={{ color: theme.ink }}>
          {EXPLORE_COPY.offlineCause}
        </Text>
        <Text variant="body" className="mt-2" style={{ color: theme.ink }}>
          {EXPLORE_COPY.offlineBody}
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-2.5">
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={EXPLORE_COPY.offlineRetry}
            busy={retrying}
            onPress={onRetry}
            haptic="selection"
            className="rounded-full px-6"
            style={{ backgroundColor: theme.accent }}
            contentStyle={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
            <Text variant="label" style={{ color: theme.canvas }}>
              {EXPLORE_COPY.offlineRetry}
            </Text>
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={EXPLORE_COPY.offlineBack}
            onPress={onBack}
            className="rounded-full px-6"
            style={{ backgroundColor: theme.canvas }}
            contentStyle={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
            <Text variant="label" style={{ color: theme.accent }}>
              {EXPLORE_COPY.offlineBack}
            </Text>
          </PressableSurface>
        </View>
      </View>

      <Text variant="note" className="mt-3.5">
        {EXPLORE_COPY.offlineFooter}
      </Text>

      {/* THE PAGE IS STILL THERE — three empty wells at the shape a look card
          takes, so the frame reads as content pending rather than content
          gone. They carry no skeleton sweep: a sweep says "arriving", and
          nothing is arriving until the reader retries. Hidden from VoiceOver
          for the same reason a decorative rule is — they say nothing the band
          above has not already said. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mt-5 flex-row gap-3">
        {[0, 1, 2].map((slot) => (
          <View
            key={slot}
            style={{
              flex: 1,
              aspectRatio: 1 / (WELL_RATIO * 2.2),
              borderRadius: LOOK_CARD_RADIUS,
              backgroundColor: theme.tray,
              opacity: 0.6,
            }}
          />
        ))}
      </View>
    </View>
  );
}

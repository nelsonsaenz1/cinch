import { View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { EXPLORE_COPY } from '@/features/explore/explore-spec';
import { useTheme, warningAlpha } from '@/theme/tokens';

/**
 * A REACTION THAT DID NOT SAVE — the accepted
 * `reaction-write-failed-recoverable` frame.
 *
 * ── The sentence is the whole feature ───────────────────────────────────────
 *
 * "Nothing was sent." The mutation is optimistic: the chip moves under the
 * finger and `onError` rolls it back, so what the reader actually saw was
 * their own tap undoing itself. Without a line here that is indistinguishable
 * from a control that ignored them — and, worse, leaves open the possibility
 * that the friend WAS told something. They were not. No row was written, no
 * notification exists on this surface at all, and the strip says so before it
 * offers the retry.
 *
 * ── Amber, not oxblood ──────────────────────────────────────────────────────
 *
 * `warningAlpha` at 0.16 — the app's recoverable-trouble ground, derived from
 * the palette's own `warning` rather than eyedropped, with `ink` on it because
 * canvas-on-warning is 2.85:1 and does not clear AA. Oxblood is the accent and
 * belongs to the chosen reaction on this page; a failed write is not more
 * important than the thing the reader was trying to do.
 *
 * `NoticeBand` was read first and is the wrong object here: its ground is the
 * tray, its actions are peers by contract ("nothing in this band is filled,
 * because a notice is not a thing being sold"), and this strip has exactly one
 * action which is the whole point of it. It also lives INSIDE a card that is
 * already tray, where a tray band would disappear.
 */
export function ReactionFailureStrip({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();

  return (
    <View
      // Every one of these appears after the control that caused it has
      // already moved on, so it is announced rather than merely findable.
      accessibilityLiveRegion="polite"
      className="flex-row flex-wrap items-center justify-between gap-3 rounded-md p-3"
      style={{ backgroundColor: warningAlpha(0.16) }}>
      <Text variant="note" className="min-w-0 flex-1" style={{ color: theme.ink }}>
        {EXPLORE_COPY.reactionFailed}
      </Text>

      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={EXPLORE_COPY.reactionRetry}
        onPress={onRetry}
        haptic="selection"
        className="rounded-md px-4"
        style={{ backgroundColor: theme.accent, flexShrink: 0 }}
        contentStyle={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
        }}>
        <Text variant="label" style={{ color: theme.canvas }}>
          {EXPLORE_COPY.reactionRetry}
        </Text>
      </PressableSurface>
    </View>
  );
}

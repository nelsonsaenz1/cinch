import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { PUSH_ASK_COPY, pushAskShownProps, type PushAskCloset } from '@/features/push/ask-spec';
import { trackOnce } from '@/lib/posthog';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * The morning-edit ask, as a card — the trip reminder's shape exactly
 * (eyebrow, one sentence, accent action, quiet dismissal) so Today has one
 * card idiom and not two. See `features/push/ask-spec.ts`.
 *
 * A component rather than inline JSX for one reason: the impression. This
 * card sits behind every gate Today has (offline, "nothing works today", the
 * pending-consent floor, the closet read, the once-ever flag), and the only
 * thing that knows they ALL passed is the fact that this mounted. So the
 * mount is where `push_ask_shown` fires — gated on `visited`, because
 * `NativeTabs` mounts every tab at launch and a card rendered on an unfocused
 * tab was not seen (`lib/use-tab-visited.ts`). `trackOnce`, so a person who
 * looked at it on three launches before answering is one impression, not
 * three: the denominator A14 is read against.
 *
 * `closet` picks the sentence (A44): the same card draws on the activation
 * floor and above it, and the two must stay one impression each and
 * separable in the numbers — the floor audience is the one the first cut
 * never reached.
 *
 * A mount is not a sighting (A48). The card hands its own y up through
 * `onLayout`, the shop shelf's arrangement exactly, and Today — the only
 * thing that can see the scroll and the viewport — reports `push_ask_seen`
 * when enough of the card has actually been on screen (`pushAskSeen` in
 * `ask-spec.ts`). Shown ≫ seen means the card sits below the fold; seen ≈
 * shown and still unanswered means it was looked at and declined.
 */
export function PushAskCard({
  closet,
  visited,
  ax,
  accent,
  busy,
  onTurnOn,
  onNotNow,
  onLayout,
}: {
  closet: Exclude<PushAskCloset, 'unread'>;
  visited: boolean;
  ax: boolean;
  accent: string;
  busy: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
  /** The card's y within the scroll content, for the "seen" measurement. */
  onLayout?: (y: number) => void;
}) {
  useEffect(() => {
    if (visited) trackOnce('push_ask_shown', pushAskShownProps(closet));
  }, [visited, closet]);

  return (
    <View
      className="mx-gutter rounded-md bg-tray p-3.5"
      style={{ marginTop: 12 }}
      onLayout={onLayout ? (e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.y) : undefined}>
      <Text variant="eyebrow">{PUSH_ASK_COPY.kicker}</Text>
      <Text variant="body" className="mt-1.5" numberOfLines={4}>
        {PUSH_ASK_COPY.line(closet)}
      </Text>
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={PUSH_ASK_COPY.action}
          busy={busy}
          onPress={onTurnOn}
          fill
          style={{ minHeight: ax ? 56 : 44 }}
          contentStyle={{ flex: 1, justifyContent: 'center' }}
          className="mt-1">
          <Text variant="label" style={{ color: accent }}>
            {PUSH_ASK_COPY.action}
          </Text>
        </PressableSurface>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={`${PUSH_ASK_COPY.dismiss}, hide this`}
          disabled={busy}
          onPress={onNotNow}
          fill
          style={{ minHeight: ax ? 56 : 44, minWidth: MIN_TAP_TARGET }}
          // `flex: 1` so the layer fills the 44pt target and the label centres
          // on the same baseline as the action beside it — without it the
          // layer hugs its text and sits at the top of the target.
          contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          className="mt-1 px-2">
          <Text variant="label" className="text-muted">
            {PUSH_ASK_COPY.dismiss}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
}

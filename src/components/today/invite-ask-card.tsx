import { useEffect } from 'react';
import { View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { INVITE_ASK_COPY } from '@/features/invite/ask-spec';
import { trackOnce } from '@/lib/posthog';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * The invite ask, as a card — the morning-edit card's shape exactly (eyebrow,
 * one sentence, accent action, quiet dismissal), so Today keeps one card
 * idiom. See `features/invite/ask-spec.ts`.
 *
 * The impression fires from the mount, gated on `visited` (`NativeTabs`
 * mounts every tab at launch; an unfocused mount was not seen) and through
 * `trackOnce`, so three launches before an answer is one impression — the
 * denominator `invite_ask_answered` is read against.
 */
export function InviteAskCard({
  visited,
  ax,
  accent,
  onShare,
  onNotNow,
}: {
  visited: boolean;
  ax: boolean;
  accent: string;
  onShare: () => void;
  onNotNow: () => void;
}) {
  useEffect(() => {
    if (visited) trackOnce('invite_ask_shown');
  }, [visited]);

  return (
    <View className="mx-gutter rounded-md bg-tray p-3.5" style={{ marginTop: 12 }}>
      <Text variant="eyebrow">{INVITE_ASK_COPY.kicker}</Text>
      <Text variant="body" className="mt-1.5" numberOfLines={4}>
        {INVITE_ASK_COPY.line}
      </Text>
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={INVITE_ASK_COPY.action}
          onPress={onShare}
          fill
          style={{ minHeight: ax ? 56 : 44 }}
          contentStyle={{ flex: 1, justifyContent: 'center' }}
          className="mt-1">
          <Text variant="label" style={{ color: accent }}>
            {INVITE_ASK_COPY.action}
          </Text>
        </PressableSurface>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={`${INVITE_ASK_COPY.dismiss}, hide this`}
          onPress={onNotNow}
          fill
          style={{ minHeight: ax ? 56 : 44, minWidth: MIN_TAP_TARGET }}
          contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          className="mt-1 px-2">
          <Text variant="label" className="text-muted">
            {INVITE_ASK_COPY.dismiss}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
}

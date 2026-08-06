import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { ChatMessage } from '@/features/stylist/use-chat';
import { oklchToHex } from '@/lib/color';
import type { Garment, OutfitCandidate } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

// Corners of a chat bubble — generous everywhere except the corner nearest the
// speaker's own edge, which squares off to point at who's talking (the tail).
const STYLIST_BUBBLE = 'rounded-tl-plate rounded-tr-plate rounded-br-plate rounded-bl-sm';
const USER_BUBBLE = 'rounded-tl-plate rounded-tr-plate rounded-bl-plate rounded-br-sm';

/**
 * A recommended outfit inside a chat turn.
 *
 * Deliberately smaller than the Today card. In conversation the outfit is
 * evidence for what was just said, not the headline — a full-size card would
 * push the reply itself off the screen.
 */
function OutfitStrip({
  outfit,
  resolveImage,
  onPress,
}: {
  outfit: OutfitCandidate;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const pieces = [...outfit.items].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  const label = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Outfit: ${label}`}
      className="mt-2 active:opacity-80">
      <View
        className="flex-row gap-1 overflow-hidden rounded-card bg-tray p-2 dark:bg-tray-dark"
        style={{ height: 88 }}>
        {pieces.map((g) => {
          const uri = resolveImage(g.cutoutPath, g.thumbPath);
          return (
            <View
              key={g.id}
              style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}
              className="items-center justify-center">
              {uri ? (
                <Image
                  source={uri}
                  contentFit="contain"
                  transition={150}
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  className="h-full w-full rounded-md"
                  style={{
                    backgroundColor: g.colors[0] ? oklchToHex(g.colors[0].oklch) : theme.hairline,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text variant="caption" numberOfLines={1} className="mt-1">
        {label}
      </Text>
    </Pressable>
  );
}

export function MessageBubble({
  message,
  resolveImage,
  onPressOutfit,
  onRetry,
}: {
  message: ChatMessage;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPressOutfit?: (outfit: OutfitCandidate) => void;
  /** Re-asks a failed turn in place. Rendered only when the turn is retryable. */
  onRetry?: () => void;
}) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View className="mb-5 items-end px-gutter">
        <View className={`max-w-[85%] bg-ink px-4 py-2.5 dark:bg-ink-dark ${USER_BUBBLE}`}>
          {/* NativeWind can't reliably override a Text variant's built-in ink
              colour once another text-* class (the variant's own text-body)
              is present, so canvas-on-ink goes through the theme facade
              instead of a `text-canvas` className — see repo gotcha on
              light-on-dark tiles. */}
          <Text variant="body" style={{ color: theme.canvas }}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-6 px-gutter">
      {message.pending ? (
        <View
          className={`max-w-[85%] flex-row items-center gap-2 self-start bg-tray px-4 py-3 dark:bg-tray-dark ${STYLIST_BUBBLE}`}>
          <ActivityIndicator size="small" color={theme.muted} />
          <Text variant="label">Looking through your closet…</Text>
        </View>
      ) : (
        <>
          <View
            className={`max-w-[85%] self-start bg-tray px-4 py-2.5 dark:bg-tray-dark ${STYLIST_BUBBLE}`}>
            <Text
              variant="body"
              className={message.failed ? 'text-muted dark:text-muted-dark' : ''}>
              {message.text}
            </Text>
          </View>

          {/* A failed turn that can be re-run offers the run again — the same
              underlined-label grammar as "I'll just type", because both are
              quiet escapes, not celebrations. The muted bubble alone was a
              dead end: the question was gone from the composer and there was
              nothing left to tap. */}
          {message.failed && message.retryable && onRetry ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityHint="Sends the same question again"
              hitSlop={12}
              className="mt-2 self-start">
              <Text variant="label" className="underline">
                Try again
              </Text>
            </Pressable>
          ) : null}

          {message.outfits.map((outfit, i) => (
            <OutfitStrip
              key={`${message.id}-${i}`}
              outfit={outfit}
              resolveImage={resolveImage}
              onPress={() => onPressOutfit?.(outfit)}
            />
          ))}

          {message.followUp ? (
            <Text variant="label" className="mt-3 italic">
              {message.followUp}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useTheme } from '@/theme/tokens';

export type BorrowRequestRowProps = {
  /** Signed URL for the garment thumb — storage paths are not URLs. */
  imageUri?: string;
  /** The whole sentence — "Iris asked for your linen blouse". Composed by the caller. */
  headline: string;
  /** The quiet line under it — a relative time, "Lent 9 days ago", a weekday. */
  meta: string;
  /** A settled row: dimmed, smaller thumb, and the caller passes no actions. */
  settled?: boolean;
  /** A lifecycle write for this row is in flight: the verbs spin/refuse. */
  busy?: boolean;
  /** The filled-ink verb. With a secondary present the two split the width. */
  primaryAction?: { title: string; onPress: () => void };
  /** The outlined verb. Alone, it runs full width. */
  secondaryAction?: { title: string; onPress: () => void };
};

/**
 * One borrow request as a card — BR-01/BR-02's row. Deliberately dumb: the
 * caller composes the sentence, the meta line and at most two verbs, so this
 * file has no opinion about statuses, directions or thread types and none of
 * the lifecycle semantics can drift in here.
 *
 * A settled row renders NO buttons at all — not disabled ones, not invisible
 * ones — so assistive tech has nothing dead to land on. The dim is the atlas's
 * .62 over the whole card, which keeps the settled stack legible as history
 * rather than as broken pending rows.
 */
export function BorrowRequestRow({
  imageUri,
  headline,
  meta,
  settled = false,
  busy = false,
  primaryAction,
  secondaryAction,
}: BorrowRequestRowProps) {
  const theme = useTheme();

  // BR-02: live thumbs are 56 at r10, settled ones 44 at r9 — the settled
  // stack recedes by size as well as by opacity. Neither radius has a token
  // (md is 12), so the atlas values stay inline, the sheet-parts precedent.
  const thumb = settled ? { width: 44, height: 44, borderRadius: 9 } : { width: 56, height: 56, borderRadius: 10 };

  const hasBoth = Boolean(primaryAction && secondaryAction);

  return (
    <Card padding="md" style={settled ? { opacity: 0.62 } : undefined}>
      <View className="flex-row items-center gap-3">
        <View className="items-center justify-center overflow-hidden bg-tray" style={thumb}>
          {imageUri ? (
            <Image
              source={stableImageSource(imageUri)}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <SymbolView
              name="tshirt"
              size={20}
              tintColor={theme.hairline}
              resizeMode="scaleAspectFit"
            />
          )}
        </View>

        <View className="flex-1">
          {/* The atlas's 15px/600 sentence. `callout` is the nearest step (16);
              `font-semibold` follows `body` in tailwind.config.js's
              `fontFamily`, so the class wins deterministically — the same
              stacking direction button.tsx ships on every label. */}
          <Text variant="callout" className="font-semibold">
            {headline}
          </Text>
          {/* 12.5px grey — `note` (13, regular, muted). The atlas draws #8A8578
              here, but `faint` fails AA on small text; `muted` is the settled
              substitution for every secondary line. */}
          <Text variant="note" className="mt-0.5">
            {meta}
          </Text>
        </View>
      </View>

      {/* The verb area. Two verbs split the width, filled beside outlined
          (BR-02's pending row); one verb runs the width alone. No capsules —
          the Button's own radius is the control shape here. */}
      {hasBoth ? (
        <View className="mt-3 flex-row gap-2.5">
          <Button
            title={primaryAction!.title}
            variant="ink"
            loading={busy}
            onPress={primaryAction!.onPress}
            className="flex-1"
          />
          <Button
            title={secondaryAction!.title}
            variant="secondary"
            disabled={busy}
            onPress={secondaryAction!.onPress}
            className="flex-1"
          />
        </View>
      ) : primaryAction || secondaryAction ? (
        <Button
          title={(primaryAction ?? secondaryAction)!.title}
          variant={primaryAction ? 'ink' : 'secondary'}
          loading={busy}
          onPress={(primaryAction ?? secondaryAction)!.onPress}
          className="mt-3"
        />
      ) : null}
    </Card>
  );
}

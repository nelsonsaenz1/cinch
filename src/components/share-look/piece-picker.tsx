import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GarmentCell } from '@/components/today/garment-cell';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import {
  MAX_PIECES,
  garmentDisplayName,
  matchesCategoryFilter,
  togglePiece,
  type PieceCategoryFilter,
} from '@/features/share-look/compose';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

export type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

const FILTERS: PieceCategoryFilter[] = ['All', 'Tops', 'Bottoms', 'Shoes'];

/**
 * S-01 — the Closet's own plate grid at three-up, in numbered selection mode.
 *
 * Deliberately NOT `ClosetGrid`/`ItemCard` (Unit E and D's `components/
 * event-outfits/**` and `(tabs)/closet.tsx` are out of this unit's files):
 * this redraws the same grammar — oat tray, `object-fit: contain`, the
 * hairline well — through `GarmentCell`, the one shared primitive the plate
 * grammar actually promises never to drift, rather than reimplementing plate
 * rendering from scratch.
 *
 * Selection is numbered, not ticked: the badge IS the stack order, so picking
 * and composing are the same act.
 */
export function PiecePicker({
  candidates,
  stack,
  resolveImage,
  onChangeStack,
}: {
  candidates: Garment[];
  stack: Garment[];
  resolveImage: ResolveImage;
  onChangeStack: (next: Garment[]) => void;
}) {
  const [filter, setFilter] = useState<PieceCategoryFilter>('All');

  const visible = useMemo(
    () => candidates.filter((g) => matchesCategoryFilter(g, filter)),
    [candidates, filter],
  );

  const badgeOf = useMemo(() => {
    const map = new Map<string, number>();
    stack.forEach((g, i) => map.set(g.id, i + 1));
    return map;
  }, [stack]);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
            selected={filter === f}
            selectedGround="ink"
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
        {visible.map((g) => (
          <View key={g.id} style={{ width: '33.333%', padding: 5 }}>
            <PieceCell
              garment={g}
              badge={badgeOf.get(g.id) ?? null}
              resolveImage={resolveImage}
              onPress={() => onChangeStack(togglePiece(stack, g))}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The foot tray: the running stack's thumbnails, "N picked", and
 * `Compose` — inert below two pieces (`canCompose`), per S-01's own rule that
 * one garment is a piece, not a look. Kept separate from the wizard's header
 * `Next` (which advances the same step) because the atlas draws both: the
 * header is the step-nav grammar every screen in the flow shares, and this
 * tray is S-01's own — the one place a poster can see the stack she is
 * building without leaving the grid.
 */
export function PickerFooterTray({
  stack,
  resolveImage,
  canCompose,
  onCompose,
}: {
  stack: Garment[];
  resolveImage: ResolveImage;
  canCompose: boolean;
  onCompose: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="flex-row items-center border-t border-hairline bg-canvas dark:border-hairline-dark dark:bg-canvas-dark"
      style={{ gap: 12, paddingTop: 12, paddingBottom: 12 }}>
      <View className="flex-row" style={{ gap: 6 }}>
        {stack.slice(0, 3).map((g) => (
          <View
            key={g.id}
            className="overflow-hidden rounded-md bg-tray dark:bg-tray-dark"
            style={{ width: 36, height: 36 }}>
            <GarmentCell garment={g} uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)} />
          </View>
        ))}
      </View>
      <Text variant="label" className="flex-1" style={{ color: theme.muted }}>
        {`${stack.length} picked`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compose"
        accessibilityHint={canCompose ? undefined : 'Pick at least two pieces first'}
        accessibilityState={{ disabled: !canCompose }}
        disabled={!canCompose}
        onPress={onCompose}
        style={{ minHeight: 44, paddingHorizontal: 20, opacity: canCompose ? 1 : 0.4 }}
        className="items-center justify-center rounded-md bg-ink active:opacity-80">
        <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
          Compose
        </Text>
      </Pressable>
    </View>
  );
}

function PieceCell({
  garment,
  badge,
  resolveImage,
  onPress,
}: {
  garment: Garment;
  badge: number | null;
  resolveImage: ResolveImage;
  onPress: () => void;
}) {
  const theme = useTheme();
  const selected = badge !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={garmentDisplayName(garment)}
      accessibilityState={{ selected }}
      accessibilityHint={
        selected
          ? `Piece ${badge} in the stack. Tap to remove.`
          : `Tap to add to the stack, ${MAX_PIECES} pieces at most.`
      }
      onPress={onPress}
      className="active:opacity-70">
      <View
        className="overflow-hidden rounded-md bg-tray dark:bg-tray-dark"
        style={{
          aspectRatio: 1,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.ink : theme.hairline,
        }}>
        <GarmentCell garment={garment} uri={resolveImage(garment.platePath, garment.cutoutPath, garment.thumbPath)} />
        {selected ? (
          <View
            className="absolute right-1.5 top-1.5 items-center justify-center rounded-full"
            style={{ width: 22, height: 22, backgroundColor: theme.ink }}>
            <Text variant="label" style={{ color: theme.canvas, fontSize: 11, lineHeight: 13 }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" numberOfLines={1} className="mt-1.5">
        {garmentDisplayName(garment)}
      </Text>
    </Pressable>
  );
}

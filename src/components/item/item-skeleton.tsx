import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/theme/tokens';

/**
 * I-03 — the shape of the item page, before the page (Item Detail State Atlas).
 *
 * This replaces the skeleton that lived at the bottom of `app/item/[id].tsx`,
 * and it is here for the same reason that one was: a bare full-screen spinner
 * reads as a stall, and a stall is indistinguishable from a failure. What a
 * person waiting on this screen needs to know is that a garment is coming and
 * roughly how it will be laid out.
 *
 * Which is why EVERY MEASURE HERE TRACKS THE REAL COMPOSITION rather than
 * being chosen to look tidy on its own. Above all the photo block, which holds
 * its full 393:430 hero height from the very first frame: if the placeholder
 * were shorter than the image, the name, the figures and the whole page below
 * them would jump downward the instant the photo decoded, and content that
 * moves under a reading eye reads as a bug, not as arrival. The old version
 * guessed a square inside the gutter and did exactly that.
 *
 * The back disc is LIVE, not a placeholder. A person can decide to leave a
 * screen that has not finished arriving, and the one control on it should not
 * appear only once the data lands.
 *
 * Built from the shared `Skeleton` primitive only. It carries the app's
 * shimmer, its Reduce Motion behaviour and its "hidden from VoiceOver" rule;
 * a second placeholder shape language invented here would drift from every
 * other loading screen within a release.
 *
 * COMPOSITION CONTRACT: render this EDGE TO EDGE — not inside a
 * `SafeAreaView edges={['top']}`, the way the pre-redesign screen wrapped its
 * skeleton. The hero the placeholder stands in for runs under a transparent
 * status bar and must start at y=0 or the jump it exists to prevent comes back
 * as an inset-sized one. The back disc reads `useSafeAreaInsets` itself.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The hero's real proportion — 393pt wide by 430pt tall at the design width. */
const HERO_RATIO = 393 / 430;

/**
 * The chip row's widths, in the atlas's own ragged order. Static per slot, not
 * data: a row of five identical pills reads as a loading graphic, a ragged one
 * reads as tags about to land.
 */
const CHIP_WIDTHS = [86, 70, 64, 78, 60];

/** The three stat cells' flex weights — "Wears", "Cost per wear", "Since last". */
const STAT_CELLS = [
  { flex: 1, figure: 44, label: 36 },
  { flex: 1.4, figure: 70, label: 60 },
  { flex: 1.1, figure: 40, label: 48 },
];

/** "Wears well with" — 88×104 tiles, the rail's real geometry. */
const RAIL_LABEL_WIDTHS = [70, 78, 62];

export type ItemSkeletonProps = { onBack: () => void };

export function ItemSkeleton({ onBack }: ItemSkeletonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark" accessibilityLabel="Loading this piece">
      {/* The hero and the disc are SIBLINGS, not parent and child. `Skeleton`
          sets `importantForAccessibility="no-hide-descendants"` on itself, so a
          back button nested inside it would be invisible to VoiceOver — which
          is precisely the guarantee this frame exists to make. */}
      <View style={{ aspectRatio: HERO_RATIO }}>
        <Skeleton className="h-full w-full" />
      </View>

      {/* Atlas: 56pt down against a 54pt status bar, so two points clear of it
          wherever the real notch lands. On the light placeholder ground the
          disc is ink at 10% with a 45% glyph — the translucent-dark treatment
          the loaded page uses over photography would disappear here. */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        className="absolute h-9 w-9 items-center justify-center rounded-full active:opacity-60"
        style={{
          top: insets.top + 2,
          left: 16,
          backgroundColor: withAlpha(theme.ink, 0.1),
        }}>
        <SymbolView
          name="chevron.left"
          size={15}
          tintColor={withAlpha(theme.ink, 0.45)}
          resizeMode="scaleAspectFit"
        />
      </Pressable>

      {/* Name, then the "Added … · $346" line under it. */}
      <View className="px-gutter pt-5">
        <Skeleton className="h-[30px] w-[250px] rounded-chip" />
        <Skeleton className="mt-2.5 h-3 w-[150px] rounded-chip" delay={120} />
      </View>

      {/* The tag chips — 32pt tall at `rounded-chip`, which is `ui/chip.tsx`'s
          real geometry rather than the atlas's 28pt/14pt pill. The chip is 12
          by a recorded decision (chip.tsx L20-25) and 32 because it pads its
          own touch target, and a placeholder shaped unlike the thing that
          replaces it is this whole component's failure mode. */}
      <View className="flex-row flex-wrap gap-1.5 px-gutter pt-4">
        {CHIP_WIDTHS.map((width, i) => (
          <Skeleton key={i} className="h-8 rounded-chip" style={{ width }} delay={240 + i * 60} />
        ))}
      </View>

      {/* The stat band keeps its own top and bottom rules. They are real — the
          loaded band (`item-stats.tsx`) draws the same `border-y` at the same
          14pt inset — so the placeholder keeps them rather than laying one grey
          slab where a ruled band is about to be. */}
      <View className="mx-gutter mt-5 flex-row border-y border-rule py-[14px] dark:border-rule-dark">
        {STAT_CELLS.map((cell, i) => (
          <View key={i} style={{ flex: cell.flex }}>
            <Skeleton
              className="h-[26px] rounded-chip"
              style={{ width: cell.figure }}
              delay={420 + i * 60}
            />
            <Skeleton
              className="mt-2 h-[9px] rounded-chip"
              style={{ width: cell.label }}
              delay={420 + i * 60}
            />
          </View>
        ))}
      </View>

      {/* The borrowable block — copy, caption and switch in one tray card. */}
      <Skeleton className="mx-gutter mt-4 h-[66px] rounded-lg" delay={600} />

      {/* "Wears well with", as far as the first screenful reaches. 10pt radius
          because that is what the real tile well is set at (`wears-well-with.tsx`),
          not because 10 is on the radius scale — it is not. */}
      <View className="mt-[22px] flex-row gap-2.5 px-gutter">
        {RAIL_LABEL_WIDTHS.map((width, i) => (
          <View key={i}>
            <Skeleton className="h-[104px] w-[88px] rounded-[10px]" delay={660 + i * 60} />
            <Skeleton className="mt-2 h-2.5 rounded-chip" style={{ width }} delay={660 + i * 60} />
          </View>
        ))}
      </View>
    </View>
  );
}

import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/theme/tokens';

/**
 * C-06 — the closet loading (Closet State Atlas).
 *
 * The skeleton mirrors the real populated layout EXACTLY — avatar circle, two
 * name bars, the stat row between its hairlines, chip capsules, then the 2×2
 * grid with caption bars — so nothing shifts when the data lands. No spinner
 * anywhere: the closet is local and this state is usually one frame long.
 *
 * Two tones, both from the atlas: `tray` for the primary shapes and tray
 * thinned over canvas for the secondary bars (the atlas's `#F2EEE5`, derived
 * here rather than retyped). The sweep comes from `ui/skeleton.tsx`'s
 * `Skeleton` primitive — the app's one shimmer convention — with the tone
 * overridden per shape via inline style, which wins over the primitive's
 * default base.
 *
 * This replaces `ClosetGridSkeleton` on the closet screen only; that component
 * stays in `ui/skeleton.tsx` for its other call sites (friends/[userId]).
 *
 * All dimensions are pt-for-px from the atlas at 393pt width, used literally.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Atlas chip capsule widths and grid caption bar widths — varied per slot for
// realism (same reasoning as ui/skeleton.tsx's LABEL_WIDTHS), still static.
const CHIP_WIDTHS = [64, 74, 90, 80] as const;
const CAPTION_WIDTHS = [96, 80, 104, 72] as const;

export function ClosetSkeleton() {
  const theme = useTheme();
  const primary = { backgroundColor: theme.tray };
  const secondary = { backgroundColor: withAlpha(theme.tray, 0.6) };

  return (
    <View accessibilityLabel="Loading your closet">
      {/* Identity row — 66pt avatar circle, name bar, sub-line bar. */}
      <View className="flex-row items-center px-gutter" style={{ paddingTop: 14, gap: 14 }}>
        <Skeleton style={[primary, { width: 66, height: 66, borderRadius: 33 }]} />
        <View className="flex-1">
          <Skeleton style={[primary, { width: 150, height: 20, borderRadius: 5 }]} />
          <Skeleton style={[secondary, { marginTop: 8, width: 110, height: 11, borderRadius: 4 }]} />
        </View>
      </View>

      {/* Stat row — four equal columns between the hairlines. */}
      <View
        className="mx-gutter flex-row border-b border-t border-hairline dark:border-hairline-dark"
        style={{ marginTop: 22, paddingVertical: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="flex-1">
            <Skeleton style={[primary, { width: 40, height: 18, borderRadius: 5 }]} />
          </View>
        ))}
      </View>

      {/* Category chip capsules — first (the active chip's seat) in the
          primary tone, the rest a step lighter, exactly as the atlas draws
          them. */}
      <View className="flex-row px-gutter" style={{ marginTop: 20, gap: 7 }}>
        {CHIP_WIDTHS.map((width, i) => (
          <Skeleton
            key={i}
            style={[i === 0 ? primary : secondary, { width, height: 30, borderRadius: 15 }]}
          />
        ))}
      </View>

      {/* The 2×2 grid — 170pt wells (12pt radius) with caption bars, in the
          real grid's 14pt row / 12pt column gaps. */}
      <View
        className="flex-row flex-wrap px-gutter"
        style={{ marginTop: 18, columnGap: 12, rowGap: 14 }}>
        {CAPTION_WIDTHS.map((width, i) => (
          <View key={i} style={{ width: '48%', flexGrow: 1 }}>
            <Skeleton className="rounded-md" style={[primary, { height: 170 }]} />
            <Skeleton style={[secondary, { marginTop: 8, width, height: 11, borderRadius: 4 }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

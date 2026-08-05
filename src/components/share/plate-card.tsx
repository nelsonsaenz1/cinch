import { useEffect, useMemo } from 'react';
import { Text as RNText, View } from 'react-native';

import { outfitCostPerWear } from '@/components/today/cost-per-wear';
import { GarmentCell } from '@/components/today/garment-cell';
import type { PlateColophon } from '@/components/today/plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import type { Garment } from '@/lib/styling';
import { CARD_H, CARD_W } from '@/features/share/capture-plate';
import { capTrim, leading, tracking } from '@/theme/font-metrics';

/** Order pieces the way a flat-lay reads: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/**
 * The share card is a printed page, and print has no dark mode — it renders
 * on the paper palette regardless of the app's scheme. Values mirror
 * tailwind.config.js light; they are inlined so the card cannot drift with
 * the phone's appearance mid-capture.
 */
const PAPER = {
  canvas: '#FBFAF6',
  tray: '#F0ECE3',
  ink: '#1C1A16',
  muted: '#6B665C',
  rule: 'rgba(28,26,22,0.12)',
};

const X = 32;
const MEASURE = CARD_W - X * 2; // 296

/**
 * The card's geometry is fixed print layout — it must not scale with the
 * phone's Dynamic Type setting, or the colophon rows (14pt apart, zero slack)
 * overlap in the exported PNG. The in-app plate scales; the artifact is set
 * type.
 */
const PRINT = { allowFontScaling: false } as const;

/**
 * The display serif — Instrument Serif, the app's one display face. A single
 * optical master, so nothing special is needed at small sizes the way the
 * didone once demanded.
 */
const serif = (size: number, track: number) => ({
  fontFamily: 'InstrumentSerif_400Regular',
  fontSize: size,
  lineHeight: leading('instrument', size, 1.08),
  letterSpacing: tracking(size, track),
  color: PAPER.ink,
});

const grotesk = (size: number, lineHeight: number, track: number) => ({
  fontFamily: 'HelveticaNeue-Medium',
  fontSize: size,
  lineHeight,
  letterSpacing: track,
  color: PAPER.muted,
  textTransform: 'uppercase' as const,
  fontVariant: ['tabular-nums' as const],
});

function Rule({ y }: { y: number }) {
  return (
    <View
      style={{ position: 'absolute', left: X, top: y, width: MEASURE, height: 1, backgroundColor: PAPER.rule }}
    />
  );
}

/**
 * Three colophon rows: circumstances, palette, economics. The data no
 * competitor computes, printed like a lookbook legend.
 */
function legend(
  items: Garment[],
  extra: PlateColophon,
  occasion: string | null | undefined,
): [string, string | null, string | null] {
  const now = new Date();
  const where = [
    `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} ${now.getFullYear()}`,
    extra.city ?? null,
    extra.feelsLikeC != null ? `Feels ${Math.round(extra.feelsLikeC)}°` : null,
    occasion ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const names = [
    ...new Set(
      items
        .filter((g) => g.visualWeight >= 0.1)
        .map((g) => g.colors[0]?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ].slice(0, 5);

  const cpw = outfitCostPerWear(items);
  const wears = items.reduce((sum, g) => sum + g.wearCount, 0);
  const economics = [
    cpw != null ? `$${cpw.toFixed(2)} / wear` : null,
    `${items.length} pieces`,
    wears > 0 ? `${wears} wears logged` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return [where, names.length > 1 ? names.join(' / ') : null, economics || null];
}

/**
 * The exportable plate — 360 × 640 logical, captured at 1080 × 1920.
 *
 * Same grammar as the in-app plate, recomposed for the Stories frame:
 * masthead, rule, eyebrow, flat-lay, title, rule, colophon, bottom mark.
 * Everything of substance sits inside y = 83…557, the band Instagram's own
 * chrome doesn't cover.
 */
export function PlateCard({
  outfit,
  occasion,
  colophon,
  resolveImage,
  onReady,
}: {
  outfit: StyledOutfit;
  occasion?: string | null;
  colophon: PlateColophon;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  /** Fired once the card is safe to capture. */
  onReady?: () => void;
}) {
  const pieces = useMemo(
    () =>
      [...outfit.candidate.items].sort(
        (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
      ),
    [outfit.candidate.items],
  );

  const [where, palette, economics] = useMemo(
    () => legend(pieces, colophon, occasion),
    [pieces, colophon, occasion],
  );

  const hasImages = pieces.some((g) => resolveImage(g.cutoutPath, g.thumbPath));

  useEffect(() => {
    if (!onReady) return;
    // Swatches paint on the next frame; cutouts come from expo-image's disk
    // cache and need a beat longer. view-shot has no "images settled" signal,
    // so this is a bounded wait, not a guess at network time — by the time a
    // plate is shareable its images were already on screen and cached.
    const t = setTimeout(onReady, hasImages ? 350 : 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: PAPER.canvas }}>
      {/* Masthead */}
      <View style={{ position: 'absolute', left: X, top: 90, width: MEASURE }}>
        <RNText
          {...PRINT}
          style={[serif(28, -0.012), capTrim('instrument', 28, leading('instrument', 28, 1.08))]}>
          Cinch
        </RNText>
      </View>
      <Rule y={112} />
      <View style={{ position: 'absolute', left: X, top: 122, width: MEASURE }}>
        <RNText {...PRINT} style={grotesk(11, 14, 1.1)}>
          The Morning Edit
        </RNText>
      </View>

      {/* Flat-lay */}
      <View
        style={{
          position: 'absolute',
          left: X,
          top: 160,
          width: MEASURE,
          height: 197,
          borderRadius: 20,
          backgroundColor: PAPER.tray,
          padding: 12,
          flexDirection: 'row',
          gap: 6,
          overflow: 'hidden',
        }}>
        {pieces.map((g) => (
          <View key={g.id} style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}>
            <GarmentCell garment={g} uri={resolveImage(g.cutoutPath, g.thumbPath)} paper />
          </View>
        ))}
      </View>

      {/* Title, rule, colophon */}
      <View style={{ position: 'absolute', left: X, top: 380, width: MEASURE }}>
        <RNText
          {...PRINT}
          numberOfLines={1}
          style={[serif(24, -0.011), capTrim('instrument', 24, leading('instrument', 24, 1.08))]}>
          {outfit.name}
        </RNText>
      </View>
      <Rule y={404} />
      {/* One flowing block, not a fixed y per row — when the palette row drops
          out (monochrome look), the rows below close up instead of leaving a
          14px hole in the legend. */}
      <View style={{ position: 'absolute', left: X, top: 414, width: MEASURE }}>
        <RNText {...PRINT} numberOfLines={1} style={grotesk(10, 14, 0.9)}>
          {where}
        </RNText>
        {palette ? (
          <RNText {...PRINT} numberOfLines={1} style={grotesk(10, 14, 0.9)}>
            {palette}
          </RNText>
        ) : null}
        {economics ? (
          <RNText {...PRINT} numberOfLines={1} style={grotesk(10, 14, 0.9)}>
            {economics}
          </RNText>
        ) : null}
      </View>

      {/* Bottom mark — the only centred element on the card: it's a colophon,
          not copy. Kept above Instagram's bottom chrome band. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 517, alignItems: 'center' }}>
        <RNText {...PRINT} style={[grotesk(11, 14, 1.1), { textTransform: 'none' }]}>
          CINCH · cinch.app
        </RNText>
      </View>
    </View>
  );
}

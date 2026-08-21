import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * The miniature sample plate — the empty-closet ladder's centrepiece
 * (atlas T-04/05/06): the happy path in matchbook form, built from bundled
 * sample garments so a brand-new user sees the destination, not an empty tray.
 *
 * Clearly sample data: the images ship with the app (assets/garments — the
 * same licensed set the App Store frames use), the card is a fixed-size
 * illustration rather than live content, and VoiceOver announces it as a
 * sample. Type inside is pinned to 1× — it is a picture of a plate, not a
 * plate, and Dynamic Type scaling belongs to the real copy around it.
 */

/**
 * What still stands between this closet and a first outfit.
 *
 * `canGenerate` gates on two things at once — a top-and-bottom pairing (or a
 * dress) and a numeric floor — so a closet mid-capture can be short of either,
 * both, or neither. Each case is its own rung (T-04 → T-05 → T-06), because
 * the virgin copy over a part-built closet reads as a failed upload.
 */
export type ClosetGap =
  | { kind: 'virgin' }
  | { kind: 'top' }
  | { kind: 'bottom' }
  | { kind: 'both' }
  | { kind: 'count'; remaining: number };

export function closetGap(items: Garment[], minCount: number): ClosetGap {
  if (items.length === 0) return { kind: 'virgin' };

  const has = (slot: Garment['slot']) => items.some((g) => g.slot === slot);
  // `mid_layer` (a knit worn alone) counts as a top, matching `canGenerate`
  // (queries.ts) and the engine's own `knitsMayAnchor` — see either's comment.
  const hasTop = has('base_top') || has('mid_layer') || has('dress');
  const hasBottom = has('bottom') || has('dress');

  if (!hasTop && !hasBottom) return { kind: 'both' };
  if (!hasTop) return { kind: 'top' };
  if (!hasBottom) return { kind: 'bottom' };
  return { kind: 'count', remaining: Math.max(minCount - items.length, 1) };
}

/** The body under "You're almost there" — the atlas's exact variants (T-05/06). */
export function gapBody(gap: ClosetGap): string {
  switch (gap.kind) {
    case 'virgin':
      // "No shopping, ever" outlived the product. See tour-copy.ts:66 — the
      // outfits really are assembled only from clothes the closet already has,
      // which is the claim worth keeping; "ever" is the part that stopped
      // being true.
      return "Photograph your wardrobe once and I’ll build outfits from your real clothes each morning. Your closet first — shopping only when something is genuinely missing.";
    case 'both':
      return 'Once you add a top and a bottom — or a dress — we can begin styling you.';
    case 'top':
      return 'Once you add a top, or a dress, we can begin styling you.';
    case 'bottom':
      return 'Once you add a bottom — or a dress — we can begin styling you.';
    case 'count':
      return `Once you add ${gap.remaining} more ${gap.remaining === 1 ? 'piece' : 'pieces'}, we can begin styling you.`;
  }
}

/**
 * The four sample tiles, at the atlas's own geometry: a 196pt collage, large
 * tiles down the left column, small ones offset right — the real plate's
 * stagger in miniature. The dashed slot replaces the tile whose slot is
 * missing (T-05), or the last tile when only the count is short (T-06).
 */
const TILES = [
  {
    key: 'coat',
    source: require('@/assets/garments/cognac-shearling-coat.jpg'),
    alt: 'Shearling coat',
    left: 0,
    top: 2,
    size: 92,
  },
  {
    key: 'top',
    source: require('@/assets/garments/cream-mohair-sweater.jpg'),
    alt: 'Mohair sweater',
    left: 100,
    top: 0,
    size: 76,
  },
  {
    key: 'bottom',
    source: require('@/assets/garments/charcoal-tailored-trousers.jpg'),
    alt: 'Tailored trousers',
    left: 0,
    top: 100,
    size: 92,
  },
  {
    key: 'count',
    source: require('@/assets/garments/brown-leather-loafers.jpg'),
    alt: 'Penny loafers',
    left: 100,
    top: 84,
    size: 76,
  },
] as const;

/** Which tiles go dashed for a given gap, and what the dashed slot says. */
function dashedLabel(gap: ClosetGap, key: (typeof TILES)[number]['key']): string | null {
  if (gap.kind === 'top' || gap.kind === 'both') {
    if (key === 'top') return 'A top,\nor a dress';
  }
  if (gap.kind === 'bottom' || gap.kind === 'both') {
    if (key === 'bottom') return 'A bottom,\nor a dress';
  }
  if (gap.kind === 'count' && key === 'count') {
    return `${gap.remaining} more\n${gap.remaining === 1 ? 'piece' : 'pieces'}`;
  }
  return null;
}

// Sample-only values, transcribed from the atlas card — not app tokens. The
// palette dots and cost figure are the sample outfit's, fixed by design.
const SAMPLE_DOTS = ['#A45C2E', '#EFE7D8', '#45423E'] as const;
const SAMPLE_COST = '$11.20';

export function SamplePlate({ gap }: { gap: ClosetGap }) {
  const theme = useTheme();

  const missing = TILES.map((t) => dashedLabel(gap, t.key)).filter(Boolean) as string[];
  const a11y = [
    'Sample outfit plate — what your mornings become. Shearling coat, mohair sweater, tailored trousers, penny loafers, $11.20 per wear. Sample data.',
    ...missing.map((m) => `Empty slot: ${m.replace('\n', ' ')}.`),
  ].join(' ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
      style={{
        width: 196,
        borderRadius: 14,
        padding: 10,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.rule,
        shadowColor: '#1C1A16',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}>
      {/* ── Header: the sample look's serif name and its colophon ── */}
      <View className="flex-row items-baseline justify-between gap-1.5">
        {/* Sizes inline over the variant: the miniature is a fixed picture of
            a plate, so the 24px plate scale (and its leading) must not apply. */}
        <Text variant="plate" maxFontSizeMultiplier={1} style={{ fontSize: 14, lineHeight: 18 }}>
          Quiet authority
        </Text>
        <Text
          variant="colophon"
          maxFontSizeMultiplier={1}
          style={{ fontSize: 7, lineHeight: 10, letterSpacing: 1 }}>
          Feels 72°F
        </Text>
      </View>

      {/* ── The collage. Fixed geometry from the atlas; the dashed tile names
             the missing slot in the sample's own frame — proof the uploads
             worked, and exactly what is still needed. ── */}
      <View style={{ height: 196, marginTop: 8 }}>
        {TILES.map((t) => {
          const dashed = dashedLabel(gap, t.key);
          return (
            <View
              key={t.key}
              style={[
                {
                  position: 'absolute',
                  left: t.left,
                  top: t.top,
                  width: t.size,
                  height: t.size,
                  borderRadius: 7,
                  backgroundColor: theme.tray,
                  overflow: 'hidden',
                },
                dashed
                  ? {
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: 'rgba(28,26,22,0.25)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }
                  : {
                      borderWidth: 1,
                      borderColor: theme.hairline,
                      shadowColor: '#1C1A16',
                      shadowOpacity: 0.14,
                      shadowRadius: 7,
                      shadowOffset: { width: 0, height: 3 },
                    },
              ]}>
              {dashed ? (
                // `muted`, not `faint`: this is the dashed tile's only content,
                // not a label duplicated beside an icon — `faint` on canvas is
                // 3.52:1, an AA failure (see cinch-atlas-vs-design-system).
                <Text
                  variant="colophon"
                  maxFontSizeMultiplier={1}
                  className="text-center"
                  style={{ fontSize: 7, lineHeight: 10, letterSpacing: 1, color: theme.muted }}>
                  {dashed}
                </Text>
              ) : (
                <Image
                  source={t.source}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              )}
            </View>
          );
        })}
      </View>

      {/* ── Footer: the sample palette and its cost per wear, ruled off like
             the real plate's. ── */}
      <View
        className="flex-row items-center justify-between"
        style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.rule }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          {SAMPLE_DOTS.map((hex) => (
            <View
              key={hex}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: hex,
                // The cream dot needs the ring to exist against white.
                borderWidth: hex === '#EFE7D8' ? 1 : 0,
                borderColor: theme.rule,
              }}
            />
          ))}
        </View>
        <View className="flex-row items-baseline" style={{ gap: 2 }}>
          <Text variant="statSmall" maxFontSizeMultiplier={1} style={{ fontSize: 12, lineHeight: 15 }}>
            {SAMPLE_COST}
          </Text>
          <Text
            variant="colophon"
            maxFontSizeMultiplier={1}
            style={{ fontSize: 7, lineHeight: 10, letterSpacing: 1 }}>
            / wear
          </Text>
        </View>
      </View>
    </View>
  );
}

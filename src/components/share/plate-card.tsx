import { useEffect, useMemo } from 'react';
import { Text as RNText, View } from 'react-native';

import { outfitCostPerWear } from '@/components/today/cost-per-wear';
import { GarmentCell } from '@/components/today/garment-cell';
import type { PlateColophon } from '@/components/today/plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { CARD_H, CARD_W } from '@/features/share/capture-plate';
import { capTrim, leading, tracking } from '@/theme/font-metrics';

/** Order pieces the way a flat-lay reads: outer layers, then core, then feet. */
const LAYOUT_ORDER: Garment['slot'][] = [
  'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/**
 * The poster is INK — it is the one dark surface the product prints, and it is
 * dark on purpose: a Stories frame is viewed against a black phone, and a cream
 * card blows out next to it. It is also a CAPTURED IMAGE, so it must not read
 * the app's colour scheme at all; every value here is a literal, and nothing in
 * this file may call `useTheme()`.
 */
const INK = {
  ground: '#1C1A16',
  cream: '#F3F0E9',
  /** Small tracked labels — masthead date, eyebrow, footer captions. */
  tan: '#B7A99A',
  /** The italic second line of the outfit title. */
  rose: '#D8B7A6',
  /** The closing line, quietest thing on the card. */
  faint: '#8A8578',
  /** Footer rule, cream at 20%. */
  rule: 'rgba(243,240,233,0.2)',
  /** Edge on a swatch dot, so a near-black colour still reads as a disc. */
  dotEdge: 'rgba(255,255,255,0.15)',
  /** Ground under a cutout photograph — lifted just off the card. */
  tile: '#26231E',
};

/**
 * The handoff authors this frame at 340 × 604; the capture canvas is 360 × 640.
 * Same 9:16 proportion, so every measurement in the mock maps through one
 * scale factor rather than being re-guessed. `z()` is that factor — the numbers
 * passed to it are literally the mock's pixels.
 */
const z = (mockPx: number) => Math.round((mockPx * CARD_W) / 340);

const X = z(26); // the mock's 26px side margin
const MEASURE = CARD_W - X * 2;
const GAP = z(8); // grid gutter

/**
 * The card's geometry is fixed print layout — it must not scale with the
 * phone's Dynamic Type setting, or the footer's two columns collide in the
 * exported PNG. The in-app plate scales; the artifact is set type.
 */
const PRINT = { allowFontScaling: false } as const;

/**
 * The display serif — Instrument Serif, the app's one display face. Its line
 * box floors at 1.30, so the mock's 1.0 leading clamps up; the optical tightness
 * comes back from `capTrim`, never from a hand-written lineHeight.
 */
const serif = (size: number, color: string = INK.cream) => ({
  fontFamily: 'InstrumentSerif_400Regular',
  fontSize: size,
  lineHeight: leading('instrument', size, 1.0),
  letterSpacing: tracking(size, -0.012),
  color,
});

/**
 * Cap-trim for a serif line, with `space` added back on top. The mock's
 * margins are measured from the CAP, so the trim's negative margin and the
 * mock's gap have to be summed — overriding `marginTop` would silently throw
 * the trim away and drop the line by a third of its size.
 */
const trim = (size: number, space = 0) => {
  const t = capTrim('instrument', size, leading('instrument', size, 1.0));
  return { ...t, marginTop: t.marginTop + space };
};

/** The tracked caps the mock sets in Helvetica 600. */
const label = (size: number, track: number, color: string = INK.tan) => ({
  fontFamily: 'HelveticaNeue-Medium',
  fontSize: size,
  lineHeight: leading('helvetica', size, 1.2),
  letterSpacing: tracking(size, track),
  color,
  textTransform: 'uppercase' as const,
  fontVariant: ['tabular-nums' as const],
});

/**
 * The outfit's name, broken the way the mock breaks it: everything but the last
 * word on line one, the last word alone on line two and set in the warm italic.
 * A one-word name keeps its single roman line rather than inventing an orphan.
 */
function titleLines(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [name.trim(), null];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

/**
 * The look's palette as the footer prints it — the real garment colours the
 * engine scored, deduplicated, and limited to the pieces that carry the outfit
 * (a belt does not claim a swatch from the coat).
 */
function paletteDots(pieces: Garment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of pieces) {
    if (g.visualWeight < 0.1) continue;
    const c = g.colors[0];
    if (!c) continue;
    const hex = oklchToHex(c.oklch);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 3) break; // the mock prints three
  }
  return out;
}

/** One garment tile in the grid. */
function Tile({ garment, uri }: { garment: Garment; uri?: string }) {
  const hex = garment.colors[0] ? oklchToHex(garment.colors[0].oklch) : null;
  return (
    <View
      style={{
        flex: 1,
        borderRadius: z(6),
        overflow: 'hidden',
        // A cutout is transparent, so it needs a ground that is not the
        // garment's own colour or the photograph disappears into it.
        backgroundColor: uri ? INK.tile : (hex ?? INK.tile),
      }}>
      {uri ? <GarmentCell garment={garment} uri={uri} paper /> : null}
    </View>
  );
}

/**
 * The exportable poster — 360 × 640 logical, captured at 1080 × 1920.
 *
 * Top to bottom, exactly the handoff's frame 10: masthead (wordmark + date),
 * eyebrow, the big serif title with its italic second line, a 2 × 2 grid of
 * garments filling the middle, then a footer that prints the two numbers no
 * competitor has — the palette and the cost per wear — over a hairline.
 */
export function PlateCard({
  outfit,
  resolveImage,
  onReady,
}: {
  outfit: StyledOutfit;
  /**
   * Circumstances the in-app plate prints in its colophon. The poster does not
   * print them — the handoff's frame carries only the look and its economics —
   * but the props stay on the contract so callers need not special-case it.
   */
  occasion?: string | null;
  colophon?: PlateColophon;
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

  /** Rows of two. Four pieces is the common look and gives the mock's 2 × 2. */
  const rows = useMemo(() => {
    const shown = pieces.slice(0, 6);
    const out: Garment[][] = [];
    for (let i = 0; i < shown.length; i += 2) out.push(shown.slice(i, i + 2));
    return out;
  }, [pieces]);

  const [head, tail] = useMemo(() => titleLines(outfit.name), [outfit.name]);
  const dots = useMemo(() => paletteDots(pieces), [pieces]);
  const cpw = useMemo(() => outfitCostPerWear(pieces), [pieces]);

  const date = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [],
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
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: INK.ground }}>
      {/* ── Masthead: the wordmark, and the day this look was worn ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: X,
          // The mock measures its 24px to the line BOX; the wordmark is
          // cap-trimmed, so the ascender slack the trim took off is added back
          // here — otherwise the whole card rides 6px high against the edge.
          paddingTop: z(24) - trim(z(22)).marginTop,
        }}>
        <RNText {...PRINT} style={[serif(z(22)), trim(z(22))]}>
          Cinch
        </RNText>
        <RNText {...PRINT} style={label(z(9), 0.24)}>
          {date}
        </RNText>
      </View>

      {/* ── The look's name, the largest thing on the card ── */}
      <View style={{ paddingHorizontal: X, paddingTop: z(16), paddingBottom: z(6) }}>
        <RNText {...PRINT} style={label(z(9), 0.24)}>
          Today&apos;s outfit
        </RNText>
        <RNText {...PRINT} numberOfLines={3} style={[serif(z(40)), trim(z(40), z(8))]}>
          {head}
          {tail ? (
            <RNText
              {...PRINT}
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: INK.rose }}>
              {'\n'}
              {tail}
            </RNText>
          ) : null}
        </RNText>
      </View>

      {/* ── The garments, filling whatever height the type leaves ── */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: X,
          paddingTop: z(16),
          paddingBottom: z(8),
          gap: GAP,
        }}>
        {rows.map((row) => (
          <View key={row[0].id} style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
            {row.map((g) => (
              <Tile key={g.id} garment={g} uri={resolveImage(g.cutoutPath, g.thumbPath)} />
            ))}
          </View>
        ))}
      </View>

      {/* ── Footer: the two facts, then the line that explains the product ── */}
      <View style={{ paddingHorizontal: X, paddingTop: z(6), paddingBottom: z(24) }}>
        <View style={{ height: 1, width: MEASURE, backgroundColor: INK.rule }} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingTop: z(16),
          }}>
          <View>
            <RNText {...PRINT} style={label(z(8), 0.18)}>
              Palette
            </RNText>
            <View style={{ flexDirection: 'row', gap: z(6), marginTop: z(7) }}>
              {dots.map((hex) => (
                <View
                  key={hex}
                  style={{
                    width: z(16),
                    height: z(16),
                    borderRadius: z(16) / 2,
                    backgroundColor: hex,
                    borderWidth: 1,
                    borderColor: INK.dotEdge,
                  }}
                />
              ))}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <RNText {...PRINT} style={label(z(8), 0.18)}>
              Cost per wear
            </RNText>
            {/* Honest when there is no price data: a dash, never a made-up
                figure. The label stays so the frame does not reflow. */}
            <RNText {...PRINT} style={[serif(z(26)), trim(z(26), z(3))]}>
              {cpw != null ? `$${cpw.toFixed(2)}` : '—'}
            </RNText>
          </View>
        </View>
        <RNText
          {...PRINT}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: z(11),
            lineHeight: leading('helvetica', z(11), 1.4),
            color: INK.faint,
            marginTop: z(16),
          }}>
          Styled by Cinch — from clothes I already own.
        </RNText>
      </View>
    </View>
  );
}

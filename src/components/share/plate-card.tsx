import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text as RNText,
  View,
  type LayoutChangeEvent,
  type TextLayoutEventData,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { GarmentCell } from '@/components/today/garment-cell';
import type { PlateColophon } from '@/components/today/plate';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { formatTemp } from '@/features/context/weather';
import {
  cardDescription,
  cardPieceOrder,
  cardStack,
  cardStackHeight,
} from '@/features/share/card-layout';
import { CARD_H, CARD_W } from '@/features/share/capture-plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { capTrim, leading, tracking } from '@/theme/font-metrics';

/**
 * The card is PAPER — the same ground the app is printed on, because the whole
 * proposition is a lookbook page, and a lookbook page is not backlit. It is
 * also a CAPTURED IMAGE, so it must not read the app's colour scheme at all:
 * a dark-mode phone would otherwise export a different artifact than a
 * light-mode one from the same outfit. Every value here is a literal, and
 * nothing in this file may call `useTheme()`.
 */
const PAPER = {
  ground: '#F4F0E6',
  /** Wordmark, name, piece list — the things the card asserts. */
  ink: '#1C1A16',
  /** Date, description, weather — the things it merely notes. */
  muted: '#6B665C',
  /** The tagline under "Cinch", quietest thing on the card. */
  faint: '#8A8578',
  /** The hairline over the piece list. */
  rule: 'rgba(28,26,22,0.20)',
  /** Ground under a photograph, so a tile still reads while its image decodes. */
  tile: '#EAE4D6',
  /** Edge on a tile — a pale garment on pale paper needs a boundary. */
  tileEdge: 'rgba(28,26,22,0.10)',
  /** Edge on a swatch dot, so a near-white colour still reads as a disc. */
  dotEdge: 'rgba(28,26,22,0.12)',
};

/**
 * The design canvas is 1080 × 1920; the capture canvas is 360 × 640 logical,
 * which view-shot multiplies by the device scale to land on exactly
 * 1080 × 1920 px at @3x. So the factor is a flat third, and every number below
 * is written as `z(<the atlas's own pixel>)` — the file is meant to be diffed
 * against the atlas, not read as a set of tuned constants.
 *
 * Nothing is rounded on the way through. The atlas's numbers are large, and
 * rounding to whole logical points would throw away a third of the precision
 * the 3× capture is there to keep; fractional font sizes and offsets rasterise
 * correctly.
 */
const z = (designPx: number) => (designPx * CARD_W) / 1080;

/**
 * The card's geometry is fixed print layout — it must not scale with the
 * phone's Dynamic Type setting, or the signature's two columns collide in the
 * exported PNG. The in-app plate scales; the artifact is set type.
 */
const PRINT = { allowFontScaling: false } as const;

/**
 * The display serif. Its line box floors at 1.30, so both display leadings the
 * atlas asks for (0.98 on the name, 1.0 on the signature) clamp up to the same
 * number — which is why `trim()` below can compute the trim from a single
 * ratio and still be exact for both. The optical tightness comes back from
 * `capTrim`, never from a hand-written lineHeight.
 */
const serif = (size: number, track: number, color: string = PAPER.ink) => ({
  fontFamily: 'InstrumentSerif_400Regular',
  fontSize: size,
  lineHeight: leading('instrument', size, 1.0),
  letterSpacing: tracking(size, track),
  color,
});

/**
 * Cap-trim for a serif line, with `space` added back on top. The atlas's
 * margins are measured from the CAP, so the trim's negative margin and the
 * atlas's gap have to be summed — overriding `marginTop` would silently throw
 * the trim away and drop the line by a third of its size.
 */
const trim = (size: number, space = 0) => {
  const t = capTrim('instrument', size, leading('instrument', size, 1.0));
  return { ...t, marginTop: t.marginTop + space };
};

/** The tracked caps the atlas sets in Helvetica 500. */
const label = (size: number, track: number, color: string) => ({
  fontFamily: 'HelveticaNeue-Medium',
  fontSize: size,
  lineHeight: leading('helvetica', size, 1.2),
  letterSpacing: tracking(size, track),
  color,
  textTransform: 'uppercase' as const,
});

/** Corner radius shared by every tile — the atlas's 18px on the 1080 canvas. */
const TILE_RADIUS = z(18);

/**
 * The atlas's `0 26px 52px rgba(28,26,22,.20)`. CSS blur-radius is roughly
 * TWICE iOS's shadowRadius (CSS blurs across the full radius, Core Animation
 * takes it as a standard deviation), so 52 becomes 26 here — passing 52
 * straight through would print a fog instead of a lifted photograph.
 */
const TILE_SHADOW = {
  shadowColor: '#1C1A16',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: z(26) },
  shadowRadius: z(52) / 2,
};

/**
 * The tiny label the plate prints for each garment. Copied from the in-app
 * plate rather than imported so the two surfaces are visibly the same rule —
 * the atlas's requirement is "the same piece names the plate shows", and the
 * day one of them starts printing a brand the divergence has to be a diff.
 */
const labelFor = (g: Garment) => {
  const s = g.subcategory ?? g.category;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * The look's palette as the signature prints it — the real garment colours the
 * tagger extracted, deduplicated, and limited to the pieces that carry the
 * outfit (a belt does not claim a swatch from the coat).
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
    if (out.length >= 4) break; // the atlas prints four
  }
  return out;
}

/**
 * The date, as "WED 6 AUGUST".
 *
 * Composed from three single-field calls rather than one three-field call
 * because the ordering is part of the design: `toLocaleDateString` with all
 * three options returns whatever the device's locale wants — "Wed, 6 August"
 * in en-GB, "Wed, August 6" in en-US — and the card must print the same rail
 * on every phone. `formatToParts` would do the same job in one call but is not
 * reliably implemented across JS engines.
 */
function cardDate(now: Date): string {
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = now.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = now.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday} ${day} ${month}`;
}

/**
 * One garment in the collage — a photograph in a rounded rectangle.
 *
 * WHY PLAIN VIEWS AND NOT SKIA. The in-app plate composes its stack in a Skia
 * canvas, for the alpha-derived shadow. This card is not rendered to a screen —
 * it is rendered off-screen and captured by react-native-view-shot, and a Skia
 * surface is a Metal layer whose contents a UIView snapshot cannot be relied on
 * to include. A card that exports blank is a worse failure than a card whose
 * shadow is a rounded rect, and the share sheet is the app's best
 * advertisement. The atlas's tiles are rectangles anyway, so nothing is lost.
 *
 * The shadow and the clip are two views on purpose: on iOS a layer that clips
 * its contents (`overflow: hidden`) cannot also cast a shadow — the shadow is
 * clipped away with everything else.
 */
function StackTile({
  garment,
  uri,
  style,
}: {
  garment: Garment;
  uri?: string;
  style: ViewStyle;
}) {
  return (
    <View
      style={{
        ...style,
        borderRadius: TILE_RADIUS,
        backgroundColor: PAPER.tile,
        ...TILE_SHADOW,
      }}>
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: TILE_RADIUS,
          overflow: 'hidden',
          backgroundColor: PAPER.tile,
          borderWidth: 1,
          borderColor: PAPER.tileEdge,
        }}>
        {uri ? (
          // COVER, not contain: the atlas's tiles are photographs cropped to
          // their frame, not cutouts floating in one.
          <Image
            source={stableImageSource(uri)}
            contentFit="cover"
            // No fade: view-shot would otherwise capture the garment
            // mid-transition, at partial opacity.
            transition={0}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // The app's own swatch fallback, which is the atlas's rule exactly:
          // a garment without a photograph falls back to its colour, same as
          // everywhere else — the card never ships an empty tile.
          <GarmentCell garment={garment} paper />
        )}
      </View>
    </View>
  );
}

/**
 * The exportable card — 360 × 640 logical, captured at 1080 × 1920.
 *
 * Five bands, top to bottom: the colophon rail (wordmark and date), the name,
 * the collage, the rule and the piece list, and the signature. What the card
 * does NOT carry is as designed as what it does — see the props and the
 * comments at each omission.
 */
export function PlateCard({
  outfit,
  colophon,
  resolveImage,
  onReady,
}: {
  outfit: StyledOutfit;
  /**
   * Circumstances the in-app plate prints in its colophon. The card prints
   * almost none of them: `occasion` is never shown, and of `colophon` only
   * `feelsLikeC` is ever read — the atlas's rule is that nothing on the card
   * identifies who made it or where they were, so the city is dropped. Both
   * props stay on the contract so callers need not special-case this surface.
   */
  occasion?: string | null;
  colophon?: PlateColophon;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  /** Fired once, when the card is safe to capture. */
  onReady?: () => void;
}) {
  const pieces = useMemo(() => cardPieceOrder(outfit.candidate.items), [outfit.candidate.items]);

  /** The collage: role-ranked, five at most, zipped to the atlas's slots. */
  const stack = useMemo(() => cardStack(pieces), [pieces]);
  const stackHeight = useMemo(() => cardStackHeight(stack.length), [stack.length]);

  const dots = useMemo(() => paletteDots(pieces), [pieces]);
  const description = useMemo(() => cardDescription(outfit.reasoning), [outfit.reasoning]);
  const date = useMemo(() => cardDate(new Date()), []);

  /**
   * The name at full size, unless it does not fit in two lines.
   *
   * This is measured rather than guessed — a character count cannot know that
   * "Willow" and "Millimetre" are different widths. The first pass renders
   * uncapped so `onTextLayout` reports the TRUE line count; a third line
   * demotes the size and caps at two, and the cap stays from then on so a
   * pathological name truncates rather than overflowing into the collage.
   */
  const [nameFit, setNameFit] = useState<'measuring' | 'full' | 'small'>('measuring');
  const nameSize = nameFit === 'small' ? z(112) : z(136);
  const nameTrim = trim(nameSize, z(92));

  const onNameLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (nameFit !== 'measuring') return;
    setNameFit(e.nativeEvent.lines.length > 2 ? 'small' : 'full');
  };

  /**
   * The band the collage is scaled into. The atlas gives the stack `flex:1`,
   * which is what guarantees a long name or a long description can never push
   * a tile through the rule below — the block shrinks instead.
   */
  const [band, setBand] = useState<{ width: number; height: number } | null>(null);
  const onBandLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBand((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  /** Uniform fit: `scale` is the effective WIDTH of the composition. */
  const scale = band && stackHeight > 0 ? Math.min(band.width, band.height / stackHeight) : 0;

  const hasImages = pieces.some((g) => resolveImage(g.cutoutPath, g.thumbPath));

  /**
   * `onReady` must fire once per mount, and only when the card is genuinely
   * finished: the collage measured, the name's shrink decision made and
   * re-rendered, and the images given a beat to paint. Listing `onReady` in
   * the deps would restart that last wait every time the parent re-renders
   * with a fresh closure, so it is held in a ref instead.
   */
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  const firedRef = useRef(false);
  // The band, not the block: an outfit with nothing in it would otherwise
  // never produce a scale, and the capture would wait forever rather than
  // export an empty card.
  const measured = (band?.width ?? 0) > 0 && nameFit !== 'measuring';
  useEffect(() => {
    if (!measured || firedRef.current) return;
    // Swatches paint on the next frame; photographs come from expo-image's
    // disk cache and need a beat longer. view-shot has no "images settled"
    // signal, so this is a bounded wait, not a guess at network time — by the
    // time a plate is shareable its images were already on screen and cached.
    const t = setTimeout(() => {
      firedRef.current = true;
      onReadyRef.current?.();
    }, hasImages ? 350 : 80);
    return () => clearTimeout(t);
  }, [measured, hasImages]);

  return (
    <View
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: PAPER.ground,
        paddingTop: z(76),
        paddingBottom: z(76),
        paddingHorizontal: z(80),
      }}>
      {/* ── 1. The colophon rail: the wordmark, and the day this look was worn ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
        <RNText {...PRINT} style={label(z(26), 7 / 26, PAPER.ink)}>
          Cinch
        </RNText>
        <RNText
          {...PRINT}
          style={[label(z(24), 3.4 / 24, PAPER.muted), { fontVariant: ['tabular-nums'] }]}>
          {date}
        </RNText>
      </View>

      {/* ── 2. The name, the largest thing on the card ── */}
      <RNText
        {...PRINT}
        onTextLayout={onNameLayout}
        numberOfLines={nameFit === 'small' ? 2 : undefined}
        style={[serif(nameSize, -2 / 136), nameTrim]}>
        {outfit.name}
      </RNText>

      {/* The stylist's first sentence. Not capped to a line count: the whole
          reason `cardDescription` takes a SENTENCE is to avoid an ellipsis on
          an artifact that leaves the phone, and the collage below is `flex:1`,
          so an extra line costs the tiles a little size and nothing else.
          `marginTop` adds back the descender the name's cap-trim removed —
          without it this line would sit inside the name's descenders. */}
      {description ? (
        <RNText
          {...PRINT}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: z(34),
            lineHeight: leading('helvetica', z(34), 1.42),
            color: PAPER.muted,
            maxWidth: z(760),
            marginTop: z(26) - nameTrim.marginBottom,
          }}>
          {description}
        </RNText>
      ) : null}

      {/* ── 3. The collage — role-sized photographs, staggered so no two edges
             align. Centred in whatever height the type above it leaves. ── */}
      <View
        onLayout={onBandLayout}
        style={{
          flex: 1,
          marginTop: description ? z(44) : z(44) - nameTrim.marginBottom,
        }}>
        {band && scale > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: (band.width - scale) / 2,
              top: (band.height - scale * stackHeight) / 2,
              width: scale,
              height: scale * stackHeight,
            }}>
            {stack.map(({ garment, slot }) => (
              <StackTile
                key={garment.id}
                garment={garment}
                uri={resolveImage(garment.cutoutPath, garment.thumbPath)}
                style={{
                  position: 'absolute',
                  left: slot.x * scale,
                  top: slot.y * scale,
                  width: slot.size * scale,
                  height: slot.size * scale,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* ── 4. The rule and the piece list ── */}
      {/* A hairline is authored in device terms, not scaled: the atlas's 1px on
          the 1080 canvas is a third of a logical point, which survives only at
          @3x and rounds away everywhere else. */}
      <View style={{ height: 1, backgroundColor: PAPER.rule, marginTop: z(36) }} />
      {/* Body order, not the collage's size order — the two are deliberately
          different: the tiles are composed, the list is read. */}
      <RNText
        {...PRINT}
        numberOfLines={2}
        style={{
          fontFamily: 'HelveticaNeue-Medium',
          fontSize: z(27),
          lineHeight: leading('helvetica', z(27), 1.45),
          color: PAPER.ink,
          maxWidth: z(780),
          marginTop: z(30),
        }}>
        {pieces.map(labelFor).join(' · ')}
      </RNText>

      {/* ── 5. The signature — the palette and the weather on the left, the one
             place the app advertises itself on the right. No cost per wear:
             that number is the user's own and stays on the plate in the app,
             never on the artifact that leaves the phone. ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: z(32),
          marginTop: z(40),
        }}>
        <View style={{ gap: z(16) }}>
          <View style={{ flexDirection: 'row', gap: z(12) }}>
            {dots.map((hex) => (
              <View
                key={hex}
                style={{
                  width: z(36),
                  height: z(36),
                  borderRadius: z(36) / 2,
                  backgroundColor: hex,
                  borderWidth: 1,
                  borderColor: PAPER.dotEdge,
                }}
              />
            ))}
          </View>
          {/* No weather, no line. It is never estimated, never a dash, never a
              placeholder — the dots row simply becomes the whole column. */}
          {colophon?.feelsLikeC != null ? (
            <RNText {...PRINT} style={label(z(23), 3.2 / 23, PAPER.muted)}>
              {`Feels ${formatTemp(colophon.feelsLikeC, 'F')}F`}
            </RNText>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <RNText {...PRINT} style={[serif(z(46), 0), trim(z(46))]}>
            Cinch
          </RNText>
          {/* The atlas sets "CLOTHES SHE ALREADY OWNS". The product's own brand
              line is "the clothes you already own", and this card is read by
              strangers rather than by its author, so it is set in the second
              person — the deviation is deliberate, and this is where it lives.
              `marginTop` adds back the descender the cap-trim above removed. */}
          <RNText
            {...PRINT}
            style={[
              label(z(21), 2.6 / 21, PAPER.faint),
              { marginTop: z(8) - trim(z(46)).marginBottom, textAlign: 'right' },
            ]}>
            Clothes you already own
          </RNText>
        </View>
      </View>
    </View>
  );
}

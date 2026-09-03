import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/media/garment-image';
import { GarmentSwatch } from '@/components/media/garment-swatch';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ItemHeroProps = {
  imageUri: string | null;
  /** Accessible description of the garment, e.g. the piece name. */
  label: string;
  onBack: () => void;
  /** Absent = no edit affordance (e.g. while loading). */
  onEdit?: () => void;
  /**
   * True when `imageUri` is a confirmed listing photo rather than the user's
   * own photograph. A shop's product shot is already framed on white, so it is
   * shown contained on white; cropping it to fill would cut the composition the
   * retailer chose. The block's shape, radius and controls never change — only
   * what is inside it (M-11).
   */
  listing?: boolean;
  /**
   * IT-01 / AX — "Hero yields 142 pt".
   *
   * At the largest Dynamic Type the frame gives the block up rather than
   * shrinking any type on the page: 430 becomes 288, which is 142 exactly. The
   * ratio-not-height reasoning below still applies, so it is the RATIO that
   * changes and the block stays the same shape on a mini and a Max.
   */
  stacked?: boolean;
  /**
   * The garment's own colour, when the row carries one — the ground its swatch
   * fallback takes. Audit 2026-09-02 · 46/62.
   */
  swatchHex?: string | null;
};

/**
 * The atlas draws the photo block 393×430 on an iPhone 15 Pro. Kept as a ratio
 * rather than a height, so the block is the same shape on a mini and a Max
 * instead of the same number of points on both.
 */
const HERO_ASPECT = 393 / 430;

/** IT-01 / AX's hero: 430 − 142 = 288, at the same width. */
const HERO_ASPECT_AX = 393 / 288;

/**
 * The block with NO PHOTOGRAPH in it — audit 2026-09-02 · 46.
 *
 * "Item detail gives roughly half the first viewport to an empty beige hero...
 * the primary garment identity/action should not be pushed so far down." At
 * 393/430 the block is 1.09 × the screen width, which on a 393pt frame is
 * ~430pt of an 852pt viewport, and the garment's NAME — the first thing the
 * screen is about — starts below all of it.
 *
 * A photograph earns that space; a swatch does not. So the empty block is 240
 * at the same width and the name arrives inside the first screen. The
 * ratio-not-height reasoning above still holds: it is the ratio that changes,
 * so the block is the same shape on a mini and a Max.
 */
const HERO_ASPECT_EMPTY = 393 / 240;

const DISC = 36;
/** The atlas's inset for the two discs — tighter than the 20 page gutter, because a disc floating on a photograph is measured from the image edge, not from the text measure below it. */
const DISC_INSET = 16;
/** 36pt of disc padded out to the 44pt floor. `BackButton` does the same arithmetic by hand; here it is the arithmetic. */
const DISC_HIT_SLOP = (MIN_TAP_TARGET - DISC) / 2;

/**
 * Straight from the atlas (I-01): warm ink at 45% under the chrome that sits on
 * the photograph. Deliberately NOT `scrim` — scrim's 40% is for dimming a whole
 * layer, and a control has to keep its own edge over a pale garment.
 */
const DISC_ON_PHOTO = 'rgba(28,26,22,0.62)';
/**
 * I-03's pair, for the frame with no photograph in it yet: a light ground
 * cannot carry a canvas-coloured glyph, so the disc inverts.
 *
 * AUDIT 2026-09-02 · 46 · "header actions need reliable contrast". Both halves
 * were too weak to promise it. The tray disc was ink at 10% carrying a glyph at
 * 45% — a 45%-alpha stroke on a pale ground is around 3:1, under AA, on the
 * only way OUT of the screen. And the photo disc was ink at 45%, which is a
 * translucent scrim over arbitrary pixels: a canvas chevron on a pale garment
 * shot composites to near-white on near-white and nothing clamps it.
 *
 * The fix is opacity in both directions rather than a new colour: 62% ink under
 * a canvas glyph is opaque enough that the garment beneath cannot lighten it
 * past the floor, and the tray disc now takes the full `ink` stroke, which is
 * the value the contrast floor was measured against everywhere else in the app.
 * The atlas's 6px backdrop blur is still not a dependency, and now matters
 * less, which is the point.
 */
const DISC_ON_TRAY = 'rgba(28,26,22,0.10)';

/**
 * The photograph that carries the top of item detail.
 *
 * Two things this does NOT draw, both deliberate. There are no pager dots: the
 * atlas puts three under the image, but a garment has exactly one photograph —
 * `imagePath`/`cutoutPath`/`platePath`/`thumbPath` are renditions of the same
 * shot — so dots would be furniture pretending to be content. And there is no
 * "⋯": the atlas says it holds sharing, and item-level sharing does not exist
 * in this app, so the pencil ships alone rather than opening an empty menu.
 *
 * The block holds its full height from the first frame, image or not, which is
 * the whole point of the ratio being on the container rather than the photo —
 * the name and the figures underneath must never jump when the image decodes.
 */
export function ItemHero({
  imageUri,
  label,
  onBack,
  onEdit,
  listing = false,
  stacked = false,
  swatchHex = null,
}: ItemHeroProps) {
  const insets = useSafeAreaInsets();
  /**
   * Whether there is a PHOTOGRAPH under the two floating discs — which is not
   * the same question as whether there is a URL.
   *
   * It starts at the URL's answer so the first frame is not wrong on the
   * ordinary path, and `GarmentImage` corrects it the moment the well settles:
   * a hero whose signed URL expired has a string here and a tray on screen, and
   * a canvas-coloured chevron on a tray is an invisible way back.
   *
   * The cache-key reasoning that used to live here — why the signature is
   * stripped, and why the stripping is conditional on what remains naming a
   * file — moved to `pictureKey` in components/media/media-state.ts, which is
   * now the one copy of it and is under test.
   */
  const [onPhoto, setOnPhoto] = useState(imageUri !== null);

  // The atlas sets both discs 2 below the status bar block. `insets.top` is that
  // block on a real device, where the design's 54 was one phone's worth of it.
  const top = insets.top + 2;

  return (
    <View
      className={
        listing
          ? 'w-full overflow-hidden bg-surface p-5'
          : 'w-full overflow-hidden bg-tray'
      }
      // Keyed off the WELL, like the discs are, so an expired signature gets
      // the short block too rather than 430pt of tray. It settles in the same
      // frame the discs invert, before anything under the hero has been read.
      style={{
        aspectRatio: !onPhoto ? HERO_ASPECT_EMPTY : stacked ? HERO_ASPECT_AX : HERO_ASPECT,
      }}>
      <GarmentImage
        uri={imageUri}
        contentFit={listing ? 'contain' : 'cover'}
        transition={200}
        style={{ width: '100%', height: '100%' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        // The two discs invert with this, which is why the hero reads the WELL
        // rather than the URL: on a hero whose signature expired, `imageUri` is
        // a string and there is no photograph, and a canvas chevron on a pale
        // tray is an invisible way out of the screen.
        onWell={(well) => setOnPhoto(well === 'photograph')}
        // The same considered mark the closet grid draws for a piece whose
        // cutout has not landed (closet/item-card.tsx) — never a broken image,
        // and never an empty rectangle either. Audit 62 made that mark the
        // garment rather than a hanger: its own colour, and the name the screen
        // is about to print underneath.
        fallback={<GarmentSwatch label={label} hex={swatchHex} />}
      />

      {/* Live immediately, per I-03's note: a person can leave a screen that
 hasn't finished arriving. */}
      <HeroDisc
        symbol="chevron.left"
        label="Back"
        side="left"
        top={top}
        onPhoto={onPhoto}
        onPress={onBack}
      />
      {onEdit ? (
        <HeroDisc
          symbol="pencil"
          label="Edit this piece"
          side="right"
          top={top}
          onPhoto={onPhoto}
          onPress={onEdit}
        />
      ) : null}
    </View>
  );
}

/**
 * One of the two floating discs. `full` on a 1:1 box is a circle, which is the
 * sanctioned half of the radius rule — the forbidden shape is a capsule with a
 * label in it (see the borderRadius commentary in tailwind.config.js).
 *
 * `onPhoto` is the whole reason this is a component rather than two literals:
 * the treatment has to invert when there is no photograph under it, and a
 * canvas chevron on a sand placeholder is invisible.
 */
function HeroDisc({
  symbol,
  label,
  side,
  top,
  onPhoto,
  onPress,
}: {
  symbol: React.ComponentProps<typeof SymbolView>['name'];
  label: string;
  side: 'left' | 'right';
  top: number;
  onPhoto: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={DISC_HIT_SLOP}
      className="absolute items-center justify-center rounded-full active:opacity-60"
      style={{
        top,
        left: side === 'left' ? DISC_INSET : undefined,
        right: side === 'right' ? DISC_INSET : undefined,
        width: DISC,
        height: DISC,
        // The atlas backs these with a 6px backdrop blur. expo-blur is not a
        // dependency — same call `closet/selection-bar.tsx` already made and for
        // the same reason: a ground this opaque loses almost nothing without it,
        // and adding a native module is not this component's decision to take.
        backgroundColor: onPhoto ? DISC_ON_PHOTO : DISC_ON_TRAY,
      }}>
      <SymbolView
        name={symbol}
        size={15}
        tintColor={onPhoto ? theme.canvas : theme.ink}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
};

/**
 * The atlas draws the photo block 393×430 on an iPhone 15 Pro. Kept as a ratio
 * rather than a height, so the block is the same shape on a mini and a Max
 * instead of the same number of points on both.
 */
const HERO_ASPECT = 393 / 430;

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
const DISC_ON_PHOTO = 'rgba(28,26,22,0.45)';
/** I-03's pair, for the frame with no photograph in it yet: a light ground cannot carry a canvas-coloured glyph, so the disc inverts. */
const DISC_ON_TRAY = 'rgba(28,26,22,0.10)';
/** I-03's glyph stroke, the same 45% the disc uses over a photo. */
const GLYPH_ON_TRAY = 'rgba(28,26,22,0.45)';

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
export function ItemHero({ imageUri, label, onBack, onEdit, listing = false }: ItemHeroProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const onPhoto = imageUri !== null;

  /**
   * expo-image reloads whenever `source` is a fresh object, and the URLs this
   * screen is handed are signed — the query string rotates while the photograph
   * does not. So the identity is memoised and the cache key is the path with the
   * signature dropped.
   *
   * ── Why the stripping is CONDITIONAL ──────────────────────────────────────
   *
   * Dropping the query unconditionally is wrong for any URL that carries its
   * identity IN the query, and Metro's dev asset server is exactly that:
   * `http://localhost:8081/assets/?unstable_path=.%2Fassets%2Fgarments%2Fcoat.jpg`.
   * Stripping there yields `http://localhost:8081/assets/` for EVERY garment, so
   * expo-image files them all under one key and the first photograph to decode
   * is then served for all of them — which is precisely what `dev-item` showed:
   * a mohair sweater under the title of a shearling coat.
   *
   * So the query is only dropped when what remains still names a file, which is
   * true of the signed storage URLs this screen sees in production
   * (`…/garments/{user}/{item}/cutout.jpg?token=…`) and false of anything whose
   * path ends at a directory. When in doubt the whole URI is the key: an image
   * re-downloaded once an hour is a cost, an image showing the WRONG GARMENT is
   * a bug.
   */
  const source = useMemo(() => {
    if (!imageUri) return undefined;
    const withoutQuery = imageUri.split('?')[0];
    const lastSegment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
    const namesAFile = lastSegment.includes('.');
    return { uri: imageUri, cacheKey: namesAFile ? withoutQuery : imageUri };
  }, [imageUri]);

  // The atlas sets both discs 2 below the status bar block. `insets.top` is that
  // block on a real device, where the design's 54 was one phone's worth of it.
  const top = insets.top + 2;

  return (
    <View
      className={
        listing
          ? 'w-full overflow-hidden bg-surface p-5 dark:bg-surface-dark'
          : 'w-full overflow-hidden bg-tray dark:bg-tray-dark'
      }
      style={{ aspectRatio: HERO_ASPECT }}>
      {source ? (
        <Image
          source={source}
          contentFit={listing ? 'contain' : 'cover'}
          transition={200}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          accessibilityIgnoresInvertColors
        />
      ) : (
        // The same considered mark the closet grid draws for a piece whose
        // cutout has not landed (closet/item-card.tsx) — never a broken image,
        // and never an empty rectangle either.
        <View className="flex-1 items-center justify-center">
          <SymbolView
            name="tshirt"
            size={40}
            tintColor={theme.hairline}
            resizeMode="scaleAspectFit"
          />
        </View>
      )}

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
        tintColor={onPhoto ? theme.canvas : GLYPH_ON_TRAY}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

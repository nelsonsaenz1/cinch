import { Image, type ImageContentPosition } from 'expo-image';
import { View } from 'react-native';

/**
 * The empty closet's grid — the real two-column closet rendered as blank
 * slots, each with a licensed garment photograph ghosted through it. The
 * founder's ask, verbatim: "the blank boxes with example ghosted garments".
 *
 * This is `ui/ghosted-rail.tsx`'s approach applied to the closet grid's own
 * geometry, and every ghosting decision is that component's documented
 * contract, not a new derivation:
 *
 * - **Alpha over `sand`.** Each photo composites at {@link GHOST_ALPHA} inside
 *   a `sand` well, the token for "a tile that needs to sit BACK from the
 *   tray". The photographs' near-white grounds dissolve into sand at this
 *   weight, so only the garment's tonal mass survives — texture, not
 *   inventory that a new user could mistake for her own clothes.
 * - **2pt blur** ({@link GHOST_BLUR}): enough to lose the weave, not the
 *   silhouette. Heavier blur reads as a loading placeholder — the exact thing
 *   this screen is being fixed away from.
 * - **The contrast rule.** Ink (10.9:1 over the worst-case composite) may sit
 *   on these cells; `muted` copy (3.6:1 there) may NOT. Callers overlay serif
 *   ink or opaque fills only, and keep muted body copy on plain canvas.
 * - **No border, no radius change.** Cell geometry tracks the real grid —
 *   `aspect-[4/5] rounded-lg` inside `w-1/2 p-1.5` (see `item-card.tsx` L52
 *   and `ClosetGridSkeleton`) — so when garments arrive, the real cards land
 *   in exactly these frames and the page reads as filling in, not replacing.
 *
 * Hidden from VoiceOver and from touch entirely: announcing decorative
 * garments in an empty closet is the "whose are these?" confusion in audio
 * form, and none of it is tappable.
 *
 * The photographs are drawn only from the licensed set in `assets/garments/`
 * (MANIFEST.md); `require` points at the same bytes the ghosted rail already
 * ships, so no new bundle weight for the first five.
 */

/** Composite weight over the `sand` well — the ghosted rail's documented value. */
const GHOST_ALPHA = 0.22;

/** Points of blur. Silhouette survives; weave and fittings do not. */
const GHOST_BLUR = 2;

/**
 * Four slots — two rows of the real grid. Chosen from the manifest on the
 * rail's own criteria (a vertical garment on a light neutral ground, tonal
 * mass that survives 22%): the coat, the mohair knit, the crochet poncho, the
 * tote. The linen blouse ghosts to almost nothing at this alpha and earns a
 * slot only where an affordance covers it, which no slot here guarantees.
 * Top-left runs outerwear first, the way a wardrobe is hung.
 */
const GHOSTS: { source: number; position: ImageContentPosition }[] = [
  // The coat hangs in the lower half of its frame; centre-cropping it leaves
  // rack and wall, so the crop biases to the bottom (same note as the rail).
  { source: require('@/assets/garments/cognac-shearling-coat.jpg'), position: 'bottom' },
  { source: require('@/assets/garments/cream-mohair-sweater.jpg'), position: 'center' },
  { source: require('@/assets/garments/cream-crochet-poncho.jpg'), position: 'center' },
  { source: require('@/assets/garments/cognac-leather-tote.jpg'), position: 'center' },
];

export function GhostSlotGrid() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-row flex-wrap px-gutter">
      {GHOSTS.map((ghost, i) => (
        <View key={i} className="w-1/2 p-1.5">
          <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-sand dark:bg-sand-dark">
            <Image
              source={ghost.source}
              contentFit="cover"
              contentPosition={ghost.position}
              blurRadius={GHOST_BLUR}
              // Never an `alt` — naming these garments is the confusion this
              // component exists to prevent.
              accessible={false}
              focusable={false}
              style={{ width: '100%', height: '100%', opacity: GHOST_ALPHA }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

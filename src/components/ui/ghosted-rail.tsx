import { Image, type ImageContentPosition } from 'expo-image';
import { View } from 'react-native';

/**
 * The ghosted rail — decorative garment photography set BEHIND an empty
 * state's affordance, so a closet with nothing in it still shows the shape of
 * one that is full.
 *
 * ── Why this is not a picture of clothes ─────────────────────────────────
 *
 * Cinch's whole claim is that it only ever styles garments someone actually
 * owns. A brand-new user opening her closet to a cognac coat and a cream knit
 * has one honest reaction — *whose are these?* — and if she taps one expecting
 * a detail page, the illusion breaks in the worst possible place: the first
 * screen, on the exact promise the product is built on. So these are not
 * placeholder inventory. They are texture: the tonal mass of a full rail,
 * pushed so far back that nothing on it resolves into a garment you could
 * believe is yours, let alone tap.
 *
 * ── How the ghosting is achieved, and why this way ───────────────────────
 *
 * Three things compound, and the palette does most of the work:
 *
 * 1. **Alpha over `sand`, not opacity over the page.** Each photograph sits at
 *    {@link GHOST_ALPHA} inside a `sand` (#EAE5DB) well — the token whose own
 *    note says it is "for a tile that needs to sit BACK from the tray". The
 *    dashed empty rails in front are `tray` (#F0ECE3). Depth is therefore
 *    stated in the design system's own vocabulary rather than invented.
 *
 * 2. **The photographs' backgrounds dissolve for free.** Every image in
 * `assets/garments/` is a single garment on a near-white ground. Compositing
 *    a near-white ground at 22% over sand lands a few points lighter than sand
 *    itself, so no photo rectangle is ever visible — only the garment's tonal
 *    mass, floating in the well. That is why no cutouts and no gradient scrim
 *    are needed: the crop edge simply has nothing to show.
 *
 * 3. **A small blur.** {@link GHOST_BLUR} is deliberately *light* — 2pt, not
 *    the 4–6 the first pass used. Heavy blur was the wrong instinct: it turned
 *    the band into something that read as a loading placeholder, and it threw
 *    away the one thing the band is for, which is silhouette. Two points is
 *    enough that no weave, seam or fitting resolves, while a hanger and a
 *    shoulder line still do.
 *
 * Desaturation and a scrim were the alternatives. Alpha-over-sand *is* a
 * desaturation — 22% of a garment's chroma survives, so the cognac coat
 * arrives at roughly #DBCBB1, inside the warm-neutral palette by construction
 * rather than by a filter that would have to be tuned per image. A scrim was
 * rejected because it needs a gradient (a dependency, or a Skia canvas) to
 * avoid ending in a hard edge, and because it dims the affordance sitting on
 * top of it — the one thing this must not do.
 *
 * ── The contrast rule this band obeys ────────────────────────────────────
 *
 * The app is light-only, so there is exactly one composite to check. Against
 * the cognac coat's mid-tone at 22% over sand (#DBCBB1), ink (#1C1A16) is
 * 10.9:1 — safe. `muted` (#6B665C), which every empty-state body is set in,
 * drops from 5.4:1 on plain canvas to 3.6:1 there, which fails AA — and the
 * coat's darker folds are worse still. **So no body copy may sit over this
 * band.** {@link GHOSTED_RAIL_HEIGHT} is the contract: the caller keeps
 * its prose below it. What may sit on the band is the affordance itself, which
 * is an opaque `tray` fill and occludes rather than composites.
 *
 * ── Accessibility ────────────────────────────────────────────────────────
 *
 * The band is hidden from VoiceOver and from touch entirely. A screen reader
 * announcing decorative garment photographs in an empty closet is precisely
 * the "whose are these?" confusion in audio form, and a tap that does nothing
 * is worse than no tap target at all. Nothing here carries `alt`.
 */

/** Cell geometry, in points. 88×124 is the dashed rail's 52×74 ratio, enlarged. */
const CELL_W = 88;
const CELL_H = 124;
const GAP = 12;

/** How far the band's top sits below the caller's own top edge. */
const TOP = 16;

/** Alternate cells hang this much lower — garments of different lengths, not a filmstrip. */
const STAGGER = 8;

/** Composite weight of each photograph over its `sand` well. See the note above. */
const GHOST_ALPHA = 0.22;

/** Points. Enough to lose the weave, not enough to lose the silhouette. */
const GHOST_BLUR = 2;

/**
 * The band's full height. Exported because it is a contract, not a detail:
 * a caller placing `muted` body copy must place it below this line.
 */
export const GHOSTED_RAIL_HEIGHT = TOP + CELL_H + STAGGER;

/**
 * Five of the eleven licensed photographs in `assets/garments/` (documented in
 * that folder's MANIFEST.md), chosen on two criteria and no others:
 *
 * - **A vertical garment on a light neutral ground.** The boots and the
 *   corduroy skirt are excellent photographs and wrong here — the boots are a
 *   dark studio shot whose ground would ghost into a slab rather than a
 *   silhouette, and the skirt is a cropped flat lay with sunglasses in it.
 *   The overshirt sits at the far left of a landscape frame, so a portrait
 *   centre-crop of it is bare wall.
 * - **Tonal mass that survives 22%.** The linen blouse is white on warm grey
 *   and ghosts to almost nothing, so it takes the centre position — the one
 *   the affordance covers completely.
 *
 * Left to right the rail runs outerwear · knit · shirt · knit · bag, which is
 * how a wardrobe is hung.
 *
 * Bundle cost: these five ship in the binary at ~1.36 MB of the folder's
 * 3.2 MB total. They are not duplicated or inlined — `require` points at the
 * same asset any other screen would use.
 */
const GHOSTS: { source: number; position: ImageContentPosition }[] = [
  // The coat hangs in the lower half of its frame; a centre crop would be rack
  // and wall. Biasing to the bottom keeps the cognac mass, the strongest ghost
  // in the set.
  { source: require('@/assets/garments/cognac-shearling-coat.jpg'), position: 'bottom' },
  { source: require('@/assets/garments/cream-mohair-sweater.jpg'), position: 'center' },
  { source: require('@/assets/garments/white-linen-blouse.jpg'), position: 'center' },
  { source: require('@/assets/garments/cream-crochet-poncho.jpg'), position: 'center' },
  { source: require('@/assets/garments/cognac-leather-tote.jpg'), position: 'center' },
];

/**
 * Renders absolutely, filling the caller's width and bleeding off both screen
 * edges — a rail that carries on past the frame reads as a wardrobe; five
 * cells centred inside the margins read as five things.
 *
 * Paint order does the rest: render this before the content it sits behind and
 * React Native draws it first. No `zIndex` required.
 */
export function GhostedRail() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: GHOSTED_RAIL_HEIGHT,
        flexDirection: 'row',
        // Overflows symmetrically: the row is wider than any phone, and RN
        // children default to flexShrink 0, so the outer cells run off-screen
        // rather than squeezing.
        justifyContent: 'center',
        // Not the default `stretch`: the cells carry their own height and their
        // stagger as a top margin, and stretch would argue with both.
        alignItems: 'flex-start',
        overflow: 'hidden',
      }}>
      {GHOSTS.map((ghost, i) => (
        <View
          key={i}
          className="bg-sand"
          style={{
            width: CELL_W,
            height: CELL_H,
            // The closet cell's own radius (`rounded-lg`). Deliberately no
            // border: a ruled edge is what makes a rectangle read as a card,
            // and a card reads as tappable.
            borderRadius: 16,
            marginTop: TOP + (i % 2 === 1 ? STAGGER : 0),
            marginHorizontal: GAP / 2,
            overflow: 'hidden',
          }}>
          <Image
            source={ghost.source}
            contentFit="cover"
            contentPosition={ghost.position}
            blurRadius={GHOST_BLUR}
            // No `alt`, ever — `alt` is an alias for accessibilityLabel, and
            // naming these garments is the confusion this component exists to
            // prevent.
            accessible={false}
            focusable={false}
            style={{ width: '100%', height: '100%', opacity: GHOST_ALPHA }}
          />
        </View>
      ))}
    </View>
  );
}

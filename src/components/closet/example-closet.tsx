import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

/**
 * The example closet — restored, and now shown for longer than it ever was.
 *
 * ── WHY THIS CAME BACK ────────────────────────────────────────────────────
 *
 * Wave 3's C-05 retired it in as many words: "never illustrated — no empty
 * hangers, no dashed placeholder grid, no exclamation." The reasoning was
 * sound about GHOSTS — a dashed outline of a garment teaches a reader to
 * discount the grid — and it swept up the photographs with them. Those are not
 * the same object. A dashed rectangle shows the shape of a closet; four real
 * photographs show what the product does, which is the one thing an empty
 * screen cannot otherwise say.
 *
 * CX-03/CX-04 supersede that retirement on the founder's call, and go further
 * than the original: the example is no longer only for a closet of nothing. It
 * stays until the tenth piece, because a closet of three is still a closet
 * nobody has seen working yet.
 *
 * ── THE BAND IS THE FREE TIER, NOT THE ENGINE FLOOR ───────────────────────
 *
 * `PLANS.free.items`, never `MIN_CLOSET_FOR_OUTFITS`. Those are 10 and 8, and
 * the difference is deliberate rather than an oversight to reconcile: styling
 * begins at eight because eight is what the engine needs, and the motivation
 * stays until ten because ten is what the reader was asked for. Both are true
 * at nine pieces, and a reader at nine gets a working Today AND a reminder of
 * what a finished closet looks like.
 *
 * ── WHAT IS GUARANTEED ABOUT IT ───────────────────────────────────────────
 *
 * · BUNDLED ONLY. Four `require`d files from `assets/garments`. Nothing here
 *   resolves a URL, reads a row, or touches the closet — it draws identically
 *   offline and on the first launch, which is exactly when it is most likely
 *   to be seen.
 * · INERT. No `Pressable`, no press state, no `onPress` anywhere in the file.
 *   `pointerEvents="none"` on the photographs, so a tap falls through rather
 *   than landing on something that looks like a garment and does nothing.
 * · ONE VOICEOVER STOP. The whole picture is a single labelled image; no cell
 *   is individually focusable, because none of them is a thing to act on.
 * · NO ANALYTICS, NO QUOTA. This component tracks nothing and spends nothing.
 *
 * ── IT SAYS SO, WITHOUT REPEATING ITSELF ───────────────────────────────────
 *
 * The visible `EXAMPLE` label and its VoiceOver summary name the fixture as
 * fiction. A second caption took space from the closet without adding clarity.
 */

/** Photographs the reader does not own, at the two sizes they are drawn. */
type ExampleCell = {
  key: string;
  source: number;
  /** The earned stat a real piece would carry. Full size only. */
  chip: string | null;
};

/**
 * Four of the licensed photographs in `assets/garments/` (see that folder's
 * MANIFEST.md — sourced for exactly this purpose), the same set the sample
 * plate draws from. The chips are sample values, not computations: there is no
 * real item behind any of these four.
 */
const CELLS: readonly ExampleCell[] = [
  { key: 'coat', source: require('@/assets/garments/cognac-shearling-coat.jpg'), chip: 'worn 9×' },
  { key: 'sweater', source: require('@/assets/garments/cream-mohair-sweater.jpg'), chip: '$4.20 / wear' },
  { key: 'trousers', source: require('@/assets/garments/charcoal-tailored-trousers.jpg'), chip: 'in 4 looks' },
  { key: 'loafers', source: require('@/assets/garments/brown-leather-loafers.jpg'), chip: null },
];

/**
 * One VoiceOver stop for the whole picture, in both variants.
 *
 * It names the four garments and then says "Example" last, so a reader who
 * swipes past mid-sentence has still heard what it is before they have heard
 * what is in it.
 */
const GROUPED_LABEL =
  'A cognac shearling coat, a cream mohair sweater, charcoal tailored trousers and brown leather loafers. Example closet, not yours.';

/** The word on the badge, in both variants. */
export const EXAMPLE_LABEL = 'EXAMPLE';

/**
 * The heading over the photographs, in BOTH variants.
 *
 * It was `EXAMPLE_TITLE_COMPACT` and belonged to the 1–9 preview alone, because
 * the full variant "takes its title from the screen". At zero there is no such
 * title above it — the screen's own heading is the reader's name — so the grid
 * arrived unannounced, and an independent review found it could read for a beat
 * as the reader's own closet before the badge underneath explained otherwise.
 *
 * One heading, one badge, and both ABOVE the photographs now: a label that
 * arrives after the thing it labels is a correction, not a caption.
 */
export const EXAMPLE_TITLE = 'What your closet can become';

/** Atlas cell height — the same 196pt the real grid's `ItemCard` uses. */
const FULL_CELL_HEIGHT = 196;

/**
 * The compact tile.
 *
 * Deliberately unlike an owned card: four across at 76pt against the real
 * grid's two across at 196. CX-04 asks for geometry that cannot be mistaken
 * for the closet above it, and size is the difference a reader registers
 * before they have read either label.
 */
const COMPACT_CELL_HEIGHT = 76;

/**
 * The two hand-set micro-labels on this fixture, and the box each one needs.
 *
 * Both are written at a size their variant does not carry, so both inherit a
 * numeric `lineHeight` built for the variant's own size. React Native scales
 * `fontSize` with Dynamic Type and leaves that number alone, so at
 * accessibility sizes the badge read "EXAM" and a chip read "worr" — the word
 * that names this grid as fiction, sliced in half on the one screen where a
 * reader has no closet of their own to compare it against. CI-03 refuses that.
 *
 * `useTypeBox` scales each box by the reader's own setting under the ceiling
 * `Text` applies to these variants, so at the standard size both are the
 * approved design to the pixel.
 */
const BADGE_LINE_HEIGHT = 13;
const CHIP_LINE_HEIGHT = 14;
const HEADING_LINE_HEIGHT = 26;
/** Badge → heading, and heading → photographs. One gap, used twice. */
const HEADING_GAP = 12;

function useTypeBox(base: number): number {
  const { fontScale } = useWindowDimensions();
  return Math.round(base * Math.min(fontScale, MAX_TEXT_SCALE));
}

/** The same, at the tighter ceiling `Text` gives its serif display variants. */
function useDisplayBox(base: number): number {
  const { fontScale } = useWindowDimensions();
  return Math.round(base * Math.min(fontScale, MAX_DISPLAY_SCALE));
}

function ExampleBadge() {
  const theme = useTheme();
  const box = useTypeBox(BADGE_LINE_HEIGHT);
  return (
    <View
      // `rounded-md`, not `rounded-full`: refusal 5 is absolute — `full` is for
      // circles, and this badge is wider than it is tall.
      className="flex-row items-center self-start rounded-md bg-blush"
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: theme.blushRule,
      }}>
      <Text
        variant="colophon"
        style={{ fontSize: 10, lineHeight: box, letterSpacing: 1.2, color: theme.accent }}>
        {EXAMPLE_LABEL}
      </Text>
    </View>
  );
}

function FullCell({ cell }: { cell: ExampleCell }) {
  const theme = useTheme();
  const box = useTypeBox(CHIP_LINE_HEIGHT);
  return (
    <View className="flex-1 overflow-hidden rounded-md bg-tray" style={{ height: FULL_CELL_HEIGHT }}>
      <Image
        source={cell.source}
        contentFit="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
        style={{ width: '100%', height: '100%' }}
      />
      {cell.chip ? (
        <View
          className="absolute rounded-[8px]"
          style={{
            left: 10,
            bottom: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: 'rgba(251,250,246,0.92)',
          }}>
          <Text variant="label" style={{ fontSize: 11, lineHeight: box, color: theme.ink }}>
            {cell.chip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CompactCell({ cell }: { cell: ExampleCell }) {
  return (
    <View
      className="flex-1 overflow-hidden rounded-md bg-tray"
      style={{ height: COMPACT_CELL_HEIGHT }}>
      <Image
        source={cell.source}
        contentFit="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

export type ExampleClosetProps = {
  /**
   * `full` is CX-03, the empty closet. `compact` is CX-04, the preview that
   * sits BELOW a closet that has pieces in it.
   */
  variant?: 'full' | 'compact';
  /**
   * How many more pieces the free ten is waiting on. Compact only, and it
   * comes from the caller because this component reads no closet.
   */
  remaining?: number;
};

/**
 * The progress line above the compact preview — "Add 4 more pieces".
 *
 * Exported so a test can check the sentence without rendering React Native,
 * and so the singular is written once. The number is the caller's arithmetic
 * over `PLANS.free.items`; this only words it.
 */
export function remainingLine(remaining: number): string {
  return `Add ${remaining} more ${remaining === 1 ? 'piece' : 'pieces'}`;
}

export function ExampleCloset({ variant = 'full', remaining }: ExampleClosetProps) {
  const compact = variant === 'compact';
  // Display type, so the ceiling `Text` applies to `title` — capping the box
  // with a different number than the glyph inside it clips from the other side.
  const headingBox = useDisplayBox(HEADING_LINE_HEIGHT);

  return (
    <View className="px-gutter">
      {compact && typeof remaining === 'number' ? (
        <Text variant="label" className="mb-3" style={{ fontSize: 13 }}>
          {remainingLine(remaining)}
        </Text>
      ) : null}

      {/* Badge, then heading, then the grid — the same order in both variants,
          so the reader is told what they are looking at before they look at it.
          The compact preview already worked this way; the full one did not. */}
      <ExampleBadge />
      {/* NO `trim`, and this is a change to the compact variant too.
          `trim`'s margins are a fixed table keyed by variant — −8 top, −9
          bottom, computed for `title`'s own 28px — and they were being applied
          to a line set at 22. Against the 10pt `mt-2.5` that left a 2pt gap
          under the badge and 3pt above the photographs, which is why the badge
          and the heading collided the moment the badge moved above it. The
          trim was survivable while this heading had nothing over it; it is not
          survivable now, and the honest fix is an untrimmed line with real
          gaps rather than a second margin chosen to cancel the first. */}
      <Text
        variant="title"
        style={{ fontSize: 22, lineHeight: headingBox, marginTop: HEADING_GAP }}>
        {EXAMPLE_TITLE}
      </Text>

      {/* The photographs — one grouped, decorative image. Individually
          inaccessible and untappable: nothing here is a garment this account
          owns, so nothing here should announce or open like one. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={GROUPED_LABEL}
        pointerEvents="none"
        style={{ gap: 12, marginTop: HEADING_GAP }}>
        {compact ? (
          <View className="flex-row" style={{ gap: 8 }}>
            {CELLS.map((cell) => (
              <CompactCell key={cell.key} cell={cell} />
            ))}
          </View>
        ) : (
          <>
            <View className="flex-row" style={{ gap: 12 }}>
              <FullCell cell={CELLS[0]} />
              <FullCell cell={CELLS[1]} />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <FullCell cell={CELLS[2]} />
              <FullCell cell={CELLS[3]} />
            </View>
          </>
        )}
      </View>

    </View>
  );
}

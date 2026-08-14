import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

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
 * ── AND IT SAYS SO, TWICE ─────────────────────────────────────────────────
 *
 * A visible `EXAMPLE` label and a sentence naming it as fiction. An unlabelled
 * grid of clothes reads as somebody else's wardrobe already sitting in the
 * account, which is the one confusion this screen cannot afford.
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

/** CX-03 — the sentence under the empty closet's example. */
export const EXAMPLE_CAPTION_FULL = 'An example closet, not yours. Nothing here is saved.';

/** CX-04 — the same promise, shorter, under a closet that has started. */
export const EXAMPLE_CAPTION_COMPACT = 'An example, not your closet. Nothing here is saved.';

/** CX-04's own title. The full variant takes its title from the screen. */
export const EXAMPLE_TITLE_COMPACT = 'What your closet can become';

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

function ExampleBadge() {
  const theme = useTheme();
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
        style={{ fontSize: 10, lineHeight: 13, letterSpacing: 1.2, color: theme.accent }}>
        {EXAMPLE_LABEL}
      </Text>
    </View>
  );
}

function FullCell({ cell }: { cell: ExampleCell }) {
  const theme = useTheme();
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
          <Text variant="label" style={{ fontSize: 11, lineHeight: 14, color: theme.ink }}>
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

  return (
    <View className="px-gutter">
      {compact && typeof remaining === 'number' ? (
        <Text variant="label" className="mb-3" style={{ fontSize: 13 }}>
          {remainingLine(remaining)}
        </Text>
      ) : null}

      {compact ? (
        <>
          <ExampleBadge />
          <Text variant="title" trim className="mt-2.5" style={{ fontSize: 22, lineHeight: 26 }}>
            {EXAMPLE_TITLE_COMPACT}
          </Text>
        </>
      ) : null}

      {/* The photographs — one grouped, decorative image. Individually
          inaccessible and untappable: nothing here is a garment this account
          owns, so nothing here should announce or open like one. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={GROUPED_LABEL}
        pointerEvents="none"
        style={{ gap: 12, marginTop: compact ? 12 : 0 }}>
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

      {!compact ? <View className="mt-3"><ExampleBadge /></View> : null}

      <Text variant="note" className="mt-2">
        {compact ? EXAMPLE_CAPTION_COMPACT : EXAMPLE_CAPTION_FULL}
      </Text>
    </View>
  );
}

import { Image } from 'expo-image';
import { View, type ViewProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { EXAMPLE_BADGE, type ExampleId, EXAMPLE_SUMMARY, type GarmentKey } from '@/features/examples/example-copy';
import { GARMENT_ASSETS } from '@/features/examples/garment-assets';
import { useTheme } from '@/theme/tokens';

/**
 * The frame every example on every surface is drawn inside.
 *
 * ONE COMPONENT, because the rules are one set of rules and six copies of them
 * is six chances to forget one. Everything the handoff calls out is enforced
 * here rather than left to each caller:
 *
 *   * NOT TOUCHABLE. `pointerEvents="none"` on the whole subtree — not a
 *     disabled press handler, which still takes the touch and still lights a
 *     press state before deciding to do nothing.
 *   * ONE ACCESSIBILITY ELEMENT. `accessible` collapses the subtree into a
 *     single node carrying one summary, and `importantForAccessibility=
 *     "no-hide-descendants"` on the content makes sure no image, badge, avatar,
 *     date or caption is separately reachable. An example must never appear in
 *     a rotor list of the reader's own items.
 *   * A VISIBLE LABEL, INSIDE THE CARD. It is drawn, not announced-only, so it
 *     survives a screenshot — which is how most people will encounter these.
 *   * NO MOTION. No shimmer, no pulse, no skeleton geometry. "An example is
 *     finished content, not a loading state", and a placeholder animation is
 *     precisely the thing that would make it read as one.
 *
 * What this component deliberately does NOT do: write anything, query anything,
 * or emit an analytics event. A single `example_shown` impression per section
 * is permitted by the handoff, and it is not fired from here — an impression
 * event belongs to the screen that decided to show the example, and firing it
 * from the frame would count a re-render as a second showing.
 */
export function ExampleCard({
  id,
  /** Sits beside the badge — "A planned week", "Events with looks". */
  title,
  /** The line under the card. Always says the content is not the reader's. */
  caption,
  /** Appended after an em dash on the badge row. PR-C1's "not a real person". */
  badgeSuffix,
  children,
  ...rest
}: {
  id: ExampleId;
  title?: string;
  caption: string;
  badgeSuffix?: string;
  children: React.ReactNode;
} & ViewProps) {
  const theme = useTheme();

  return (
    <View
      // One node, one label. The summary is the atlas's, verbatim.
      accessible
      accessibilityLabel={EXAMPLE_SUMMARY[id]}
      // Inert in both senses: no touch reaches it, and nothing inside it is
      // separately focusable.
      pointerEvents="none"
      importantForAccessibility="yes"
      {...rest}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="overflow-hidden rounded-md border border-hairline"
        style={{ backgroundColor: theme.tray }}>
        {/* The badge row. Inside the card, at the top, so a screenshot of the
            card alone still carries the disclosure. */}
        <View className="flex-row items-start justify-between gap-3 px-4 pt-4">
          <Text variant="eyebrow">
            {badgeSuffix ? `${EXAMPLE_BADGE} — ${badgeSuffix}` : EXAMPLE_BADGE}
          </Text>
          {title ? <Text variant="noteSmall">{title}</Text> : null}
        </View>

        <View className="px-4 pb-4 pt-3.5">{children}</View>
      </View>

      {/* The caption sits under the card rather than in it, the way a plate's
          colophon does — and it repeats the disclosure in a full sentence,
          because the badge is a word and a word is not a claim. */}
      <Text
        variant="noteSmall"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="mt-2.5">
        {caption}
      </Text>
    </View>
  );
}

/**
 * A row of garment photographs — the example's actual content.
 *
 * Photographs, never rectangles: "Example is composed of garment photographs —
 * not rectangles, wireframes or skeletons — and does not shimmer" is a binary
 * acceptance check, and a grey box with a rounded corner is exactly what it
 * exists to refuse.
 *
 * `transition={0}` for the same reason. expo-image's default fade is a real
 * animation on first paint, and on a card labelled "Example" a fade reads as
 * loading. These are bundled assets; there is nothing to wait for.
 */
export function ExampleGarments({
  pieces,
  size = 96,
}: {
  pieces: readonly GarmentKey[];
  size?: number;
}) {
  const theme = useTheme();

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {pieces.map((key) => (
        <View
          key={key}
          className="overflow-hidden rounded-md"
          style={{ width: size, height: size, backgroundColor: theme.canvas }}>
          {/* FIXTURES ONLY. There is deliberately no prop for passing a
              closet photograph in: an example never derives from user data,
              and a component that accepted one would make that a call-site
              decision rather than a property of the component. */}
          <Image
            source={GARMENT_ASSETS[key]}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        </View>
      ))}
    </View>
  );
}

/**
 * A fictional person, as a monogram.
 *
 * "Every fictional person is a monogram avatar in the palette darks." SETTLED —
 * the handoff left licensed portraiture open as decision 2 and the answer is
 * monograms, permanently, not as a placeholder waiting on a photographer.
 *
 * It is the right answer on its own merits. A generated face would be the only
 * asset in this app with no provenance at all, and a licensed portrait of a
 * real person standing in for a fictional one is worse: somebody's actual
 * photograph captioned "not a real person". A monogram is the honest picture of
 * somebody who does not exist.
 */
const MONOGRAM_DARKS = ['#1C1A16', '#6E2B2B', '#4A463E'] as const;

export function ExampleMonogram({ letter, size = 28 }: { letter: string; size?: number }) {
  // Deterministic by letter, so the same fictional person keeps the same colour
  // between renders and between screens.
  const tone = MONOGRAM_DARKS[letter.charCodeAt(0) % MONOGRAM_DARKS.length];

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: tone }}>
      <Text variant="noteSmall" style={{ color: '#FBFAF6' }}>
        {letter}
      </Text>
    </View>
  );
}

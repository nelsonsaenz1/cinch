import { Pressable, View } from 'react-native';

import { GarmentCell } from '@/components/today/garment-cell';
import { Text } from '@/components/ui/text';
import { missingForFirstOutfit, tallyOf } from '@/features/closet/outfit-count';
import { PLANS } from '@/features/billing/plans';
import { numberWord } from '@/features/onboarding/reveal-copy';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { missingPhrase } from './closet-floor-copy';
import { GRID_GAP } from './plate-grid';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * T-10 and T-11 — two ways to have no outfit, told apart.
 *
 * "An empty closet, a closet that cannot yet make a look, and a closet that can
 * but has nothing suitable are three different facts with three different next
 * actions."
 *
 * T-10 · EMPTY. No count is printed — "'0 pieces' is not a sentence anybody
 * should read" — and no commerce is offered, because a closet with nothing in
 * it has no computable gap. The number asked for is the free tier's own
 * (`PLANS.free.items`), never a literal: it is the number The Ten, the tour and
 * this screen all quote, and it must move together with them.
 *
 * T-11 · PARTIAL. The engine's internal floor is never printed as a threshold;
 * the sentence names the two KINDS of garment that would turn this into
 * outfits, which is actionable. The pieces already photographed are shown at
 * full size: this is a closet that is working, not a warning.
 */
export function ClosetFloor({
  items,
  remaining,
  resolveImage,
  onStart,
  onDescribe,
}: {
  items: Garment[];
  /** How many more pieces the engine's floor is waiting on. Derived, never written. */
  remaining: number;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onStart: () => void;
  onDescribe: () => void;
}) {
  const theme = useTheme();
  const empty = items.length === 0;
  const missing = missingPhrase(missingForFirstOutfit(tallyOf(items)));

  const headline = empty
    ? 'Nothing to style from yet.'
    : `${numberWord(items.length)} pieces in. ${numberWord(remaining)} more and Cinch can dress you.`;

  const body = empty
    ? `${numberWord(PLANS.free.items)} pieces is enough for Cinch to style you properly. Photograph them, or pick them from your camera roll — in any order.`
    : missing
      ? `Everything here needs something to go with it. ${capitalise(missing)} is what turns this into outfits.`
      : 'Everything here needs something to go with it.';

  const primary = empty ? 'Start your closet' : missing ? `Add ${missing}` : 'Add more pieces';

  return (
    <View className="px-gutter" style={{ paddingTop: 24 }}>
      {/* The pieces that are already in, at full size. Zero is quiet: with
          nothing photographed there is nothing to show, and an empty tray
          drawn where a closet will be is a picture of failure. */}
      {items.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 24 }}>
          {items.slice(0, 6).map((g) => (
            <View
              key={g.id}
              className="overflow-hidden border border-hairline"
              style={{
                width: 96,
                height: 96,
                borderRadius: TILE_RADIUS_LOCAL,
                backgroundColor: theme.tray,
              }}>
              <GarmentCell garment={g} uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)} />
            </View>
          ))}
        </View>
      ) : null}

      <Text variant="title" trim>
        {headline}
      </Text>
      <Text variant="body" className="mt-3.5 text-muted">
        {body}
      </Text>

      {/* One oxblood, on the door that starts the closet. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primary}
        onPress={onStart}
        style={{ minHeight: 52 }}
        className="mt-7 items-center justify-center rounded-md bg-accent px-6 active:opacity-70">
        <Text variant="label" className="font-medium" style={{ color: theme.canvas }}>
          {primary}
        </Text>
      </Pressable>

      {/* The second intake door, in the same order and weights the hallway
          gives it. Both doors are on the page; neither is hidden behind the
          other. */}
      {empty ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Describe it out loud instead"
          onPress={onDescribe}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-2 items-center justify-center rounded-md border border-rule px-6 active:opacity-70">
          <Text variant="label" className="font-medium" style={{ color: theme.ink }}>
            Describe it out loud instead
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The tile corner, on the scale. Same 12 the plate's own cells carry. */
const TILE_RADIUS_LOCAL = 12;

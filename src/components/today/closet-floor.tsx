import { Pressable, View } from 'react-native';

import { ExampleCard, ExampleGarments } from '@/components/examples/example-card';
import { GarmentCell } from '@/components/today/garment-cell';
import { Text } from '@/components/ui/text';
import { TE_01, TE_02, TE_02_CAPTION } from '@/features/examples/example-copy';
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
 *
 * ── TE-01 / TE-02 — AND WHY THE EXAMPLE COMES FIRST ───────────────────────
 *
 * Both states used to explain in words alone what Today becomes. "An empty
 * Today sells nothing", so each now carries a fictional look built from the
 * owned photographs, labelled on the card, and completely inert — and it sits
 * ABOVE the prose, not below it, because the acceptance check is that the
 * example is visible in the first viewport at 393 pt without scrolling and the
 * real action is still reachable under it.
 *
 * NEITHER EXAMPLE TOUCHES THE CLOSET. The atlas builds TE-02's around the
 * reader's own pieces; the shipped rule is that examples come from the bundled
 * fixture set and never from user data, so both are drawn entirely from
 * `assets/garments`. What separates them is the SHAPE — three pieces against
 * four, matching the real plate at three and at four — and the sentence beside
 * each, which is the part that is genuinely about this reader's closet.
 *
 * The practical consequence is worth stating: rendering an example costs
 * nothing. No image resolves, no row is read, no count is taken. It draws
 * identically offline and on the very first launch, which is exactly when an
 * empty Today is most likely to be looked at.
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
    ? 'See what your closet can do.'
    : // Both clauses open a sentence, and `numberWord` is lowercase for the
      // mid-sentence call sites. This headline had the same fault as the body
      // below it — "three pieces in. two more and Cinch can dress you." — and
      // it is the more visible of the two, since it is set in the serif.
      `${capitalise(numberWord(items.length))} pieces in. ${capitalise(numberWord(remaining))} more ${remaining === 1 ? 'piece opens' : 'pieces open'} your first outfits.`;

  const body = empty
    ? // `capitalise`, not a literal "Ten": the number is `PLANS.free.items`
      // spelled out, so it moves with the free tier the way every other
      // statement of it does. It just happens to open a sentence here, and
      // `numberWord` returns lowercase because most of its call sites are
      // mid-sentence — which is how "ten pieces is enough" shipped.
      `${capitalise(numberWord(PLANS.free.items))} ${Number(PLANS.free.items) === 1 ? 'piece is' : 'pieces are'} enough to begin. Add the clothes you reach for most, and Cinch will turn them into outfits for the day ahead.`
    : missing
      ? `Everything here needs something to go with it. ${capitalise(missing)} is what turns this into outfits.`
      : 'Everything here needs something to go with it.';

  const primary = empty ? 'Start your closet' : missing ? `Add ${missing}` : 'Add more pieces';

  const example = empty ? TE_01 : TE_02;

  return (
    <View className="px-gutter" style={{ paddingTop: 30 }}>
      {/* The example, first — the payoff before the explanation. */}
      <ExampleCard
        id={empty ? 'TE-01' : 'TE-02'}
        caption={empty ? TE_01.caption : TE_02_CAPTION}>
        <ExampleGarments
          pieces={example.pieces}
          // Three-up at 96 and four-up at 74, matching the real plate's own
          // geometry at three and four pieces — "the promise and the product
          // are the same shape".
          size={example.pieces.length > 3 ? 74 : 96}
        />
        <Text variant="plate" className="mt-4">
          {example.name}
        </Text>
        <Text variant="noteSmall" className="mt-2.5">
          {example.reasoning}
        </Text>
      </ExampleCard>

      {/* The pieces that are already in, at full size. Zero is quiet: with
          nothing photographed there is nothing to show, and an empty tray
          drawn where a closet will be is a picture of failure. */}
      {items.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: GRID_GAP,
            marginTop: 24,
            marginBottom: 24,
          }}>
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

      {/* Keep the measure outside the cap-trimmed serif. A margin class on the
          Text competes with the trim's negative optical margin and made this
          headline appear to touch the two-line example caption above it. */}
      <View style={{ marginTop: items.length > 0 ? 8 : 36 }}>
        <Text variant="title" trim>
          {headline}
        </Text>
      </View>
      <Text variant="body" className="mt-4 text-muted">
        {body}
      </Text>

      {/* One oxblood, on the door that starts the closet. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primary}
        onPress={onStart}
        style={{ minHeight: 52 }}
        className="mt-8 items-center justify-center rounded-md bg-accent px-6 active:opacity-70">
        <Text variant="label" style={{ color: theme.canvas }}>
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
          className="mt-3 items-center justify-center rounded-md border border-rule px-6 active:opacity-70">
          <Text variant="label" style={{ color: theme.ink }}>
            Describe it out loud instead
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The tile corner, on the scale. Same 12 the plate's own cells carry. */
const TILE_RADIUS_LOCAL = 12;

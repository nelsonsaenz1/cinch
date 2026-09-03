import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { GarmentSwatch } from '@/components/media/garment-swatch';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { TODAY_COPY } from '@/features/today/today-spec';
import { oklchToHex } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * Today's plate — the full-bleed collage card. Redesign 11.
 *
 * ── WHY THIS IS NOT `plate.tsx` ─────────────────────────────────────────────
 *
 * `components/today/plate.tsx` is still the card the Reveal, Repeat and the
 * share artifact draw, and all three are outside this redesign. Rewriting it
 * would have re-cut two shipping screens and the image people send their
 * friends in order to restyle a third. So Today gets its own card and the old
 * one is left exactly as it is — the redesign's blast radius stops at this
 * screen, which is what the operating contract asks for.
 *
 * ── ONE ELEMENT, NOT THREE ──────────────────────────────────────────────────
 *
 * The collage is a single accessible node labelled with the outfit's name, its
 * pieces in order, and its position. An outfit heard as three separate garments
 * is not an outfit, and the position lives here rather than on the dots so a
 * reader never has to find a decorative row to learn which card they are on.
 */

/** The accepted measures. */
export const PLATE_RADIUS = 26;
export const COLLAGE_HEIGHT = 236;
export const COLLAGE_HEIGHT_AX = 168;

export type TodayPlateView = {
  /** The deterministic name. Never invented at render time. */
  name: string;
  /** "Wool coat, linen shirt, ankle boots" — the pieces, in layout order. */
  piecesLine: string;
  garments: Garment[];
  /** "82°" — the temperature alone — or "As of 7am" when the reading is
   *  dated. Null when none. The condition PHRASE (and its low–high range)
   *  never reaches this card; it lives in the masthead eyebrow (audit 57). */
  weatherMark: string | null;
  /** The condition's SF Symbol, drawn quietly beside the mark. Optional and
   *  null on dated readings — `resolveWeather` owns that refusal. */
  weatherSymbol?: string | null;
  /** Spoken position: "card 2 of 3". */
  positionLabel: string;
  /** Replaces the pieces line while a new context is being composed. */
  applyingLabel?: string | null;
};

/**
 * The tile a piece with no visible photograph takes.
 *
 * AUDIT 2026-09-02 · 62. This was a bare `bg-tray` rectangle: three of them in
 * a row is a card that shows an outfit's NAME and then three blank boxes, which
 * is the state most accounts on Today are actually in (the cutout pipeline
 * needs a native module the Simulator cannot run, and a thumb-only piece is
 * common on device). The swatch is the same one `GarmentCell` and `PlateThumb`
 * draw: the garment's own colour where the engine scored one, and its kind
 * either way, so a collage of un-photographed pieces still reads as an outfit
 * of three particular garments.
 *
 * The rule and the border stay — they are what make the tile read as a filed
 * piece rather than a hole in the card.
 */
function PiecePlaceholder({ garment }: { garment: Garment }) {
  return (
    <View className="h-full w-full overflow-hidden rounded-lg border border-rule">
      <GarmentSwatch
        label={garment.subcategory ?? garment.category}
        hex={garment.colors[0] ? oklchToHex(garment.colors[0].oklch) : null}
      />
    </View>
  );
}

export function TodayPlate({
  view,
  width,
  large = false,
  resolveImage,
}: {
  view: TodayPlateView;
  width: number;
  large?: boolean;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
}) {
  const theme = useTheme();

  const spoken = [view.name, view.piecesLine, view.positionLabel].filter(Boolean).join(', ');

  return (
    <View style={{ width }}>
      <View
        // ONE node. `accessible` collapses the collage, the name and the pieces
        // into a single announcement so an outfit is heard as an outfit.
        accessible
        accessibilityRole="image"
        accessibilityLabel={spoken}
        className="bg-sand"
        style={{ borderRadius: PLATE_RADIUS, overflow: 'hidden' }}>
        <View
          style={{
            height: large ? COLLAGE_HEIGHT_AX : COLLAGE_HEIGHT,
            position: 'relative',
            justifyContent: 'center',
          }}>
          {/* The weather mark. It RIDES the collage at a normal type size,
              where a chip in the corner costs nothing — and STACKS above it at
              an accessibility size, where it does not.

              At AX-XXXL the collage shrinks to 168pt and the mark grows with
              the type, so the absolutely-positioned version covered the first
              garment tile outright: the reader with the largest type was the
              one shown the fewest pieces. The mark is the same words in the
              same order either way; only its box moves.

              Absent entirely when there is no reading — a known-unknown is
              omitted, never estimated, and never shown as a dash. */}
          {view.weatherMark ? (
            <View
              className="bg-canvas"
              style={
                large
                  ? { alignSelf: 'flex-start', marginLeft: 14, marginBottom: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }
                  : {
                      position: 'absolute',
                      top: 14,
                      left: 14,
                      zIndex: 2,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }
              }>
              {/* One row: the glyph, then the number, same ink as the words —
                  a quiet condition mark, not a second accent. The symbol is
                  decorative (the temperature is the fact and the masthead
                  carries the full sentence), so it adds nothing spoken. */}
              <View className="flex-row items-center" style={{ gap: 5 }}>
                {view.weatherSymbol ? (
                  <SymbolView
                    name={view.weatherSymbol as SFSymbol}
                    size={12}
                    tintColor={theme.ink}
                    resizeMode="scaleAspectFit"
                  />
                ) : null}
                <Text variant="label" style={{ color: theme.ink }}>
                  {view.weatherMark}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center justify-center" style={{ gap: 6 }}>
            {view.garments.map((garment) => {
              // WHITE-OUT FIRST. `resolve` is first-hit-wins over the order it
              // is handed, so this argument order IS the preference.
              //
              // This card asked for `thumbPath` first, which is the raw camera
              // frame — the piece on a bedroom floor, in whatever light the
              // photograph was taken in. Set three across on one plate, three
              // different rooms and three different white balances read as a
              // pile rather than an outfit, and the collage's whole job is to
              // read as an outfit.
              //
              // `platePath` (the scale-normalised render) and `cutoutPath`
              // (the background removed) are both white-ground and both
              // consistent with each other, which is why every other surface
              // in the app — the closet grid, item detail, the stylist, the
              // reveal, and the wear sheet THIS card opens into — already
              // prefers them. Today was the last screen putting the thumb
              // first, so an outfit changed appearance between the plate and
              // the confirmation of the same outfit. The raw frame stays as
              // the last fallback: a piece whose cutout never rendered is
              // still better shown than not shown.
              const uri = resolveImage(garment.platePath, garment.cutoutPath, garment.thumbPath);
              return (
                <View
                  key={garment.id}
                  style={{
                    width: Math.min(112, (width - 56) / Math.max(1, view.garments.length)),
                    height: (large ? COLLAGE_HEIGHT_AX : COLLAGE_HEIGHT) - 72,
                  }}>
                  {/* THE SAME PLACEHOLDER FOR ALL FOUR CAUSES.
                      A piece can be missing its photograph because it was never
                      taken, because the file did not load, because the garment
                      is hidden, or because this reader is not authorized to see
                      it. They are drawn identically and deliberately: a distinct
                      "hidden" treatment would be evidence that a hidden garment
                      exists, which is the inference the closet refuses
                      everywhere else.

                      Drawn HERE rather than as the image's own fallback so the
                      placeholder inherits this tile's box. Inside `GarmentImage`
                      it had no width of its own and its border collapsed to a
                      hairline — a card of five hairlines does not read as an
                      outfit, and an outfit that does not look like one is the
                      one thing this collage may not be. */}
                  {uri ? (
                    <GarmentImage
                      uri={uri}
                      contentFit="contain"
                      style={{ flex: 1, minWidth: 0 }}
                      fallback={<PiecePlaceholder garment={garment} />}
                    />
                  ) : (
                    <PiecePlaceholder garment={garment} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 22, paddingTop: 4, gap: 6 }}>
          <Text variant="plate" trim numberOfLines={large ? undefined : 2}>
            {view.name}
          </Text>
          {/* While a context is being applied the old plate stays legible and
              only this line changes — nothing empties, which is the contract. */}
          <Text variant="note" numberOfLines={large ? undefined : 2}>
            {view.applyingLabel ?? view.piecesLine}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The page dots — decorative, and hidden from VoiceOver.
 *
 * Position is spoken by the card itself. A reader who had to find these to
 * learn they were on card two would be worse off than one who heard it in the
 * outfit's own announcement.
 */
export function PlateDots({ count, active }: { count: number; active: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-row items-center justify-center"
      style={{ gap: 6, paddingTop: 14 }}>
      {Array.from({ length: count }, (_, i) => {
        const on = i + 1 === active;
        return (
          <View
            key={i}
            style={{
              width: on ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: on ? theme.ink : theme.ghost,
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * A settled wear — one restrained mark, and the 24 hours it can be undone in.
 *
 * No confetti, no score, no streak. The accepted frame gives a wear exactly
 * this much: a word saying it landed, a sentence saying where it went, and the
 * two things a person might actually want next. Anything louder would be
 * celebrating a reader for getting dressed.
 *
 * Undo is offered only once the write has landed and returned its diary entry.
 * An Undo with nothing to address is a dead control, and drawing one live is
 * the same false promise as a wear button over a connection that cannot write.
 */
export function WornMark({
  entryId,
  undoing,
  large = false,
  onUndo,
  onAddNote,
}: {
  entryId: string | null;
  undoing: boolean;
  large?: boolean;
  onUndo: () => void;
  onAddNote: () => void;
}) {
  return (
    <View className="bg-tray" style={{ borderRadius: 18, padding: 16 }}>
      <Text variant="eyebrow">{TODAY_COPY.wornKicker}</Text>
      <Text variant="body" className="mt-2 text-muted">
        {TODAY_COPY.wornBody}
      </Text>
      {entryId ? (
        <View className="flex-row" style={{ gap: 8, paddingTop: 12 }}>
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel="Undo this wear"
            busy={undoing}
            onPress={onUndo}
            style={{ minHeight: large ? 56 : 44 }}
            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            className="rounded-md px-4">
            <Text variant="label" className="text-muted">
              Undo
            </Text>
          </PressableSurface>
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel="Add a note to today’s diary entry"
            onPress={onAddNote}
            style={{ minHeight: large ? 56 : 44 }}
            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            className="rounded-md px-4">
            <Text variant="label" className="text-muted">
              Add a note
            </Text>
          </PressableSurface>
        </View>
      ) : null}
    </View>
  );
}

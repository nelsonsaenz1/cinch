import { View } from 'react-native';

import { ART, type DoorArtKind } from '@/features/ingest/add-clothes-spec';

/**
 * Redesign 23 — the drawing on a door's tile.
 *
 * The directive's brief for this page is "three equal designed door cards with
 * imagery", and imagery is the one thing on the chooser that is new rather
 * than restyled: the tiles used to be SF Symbols in `ink`, which made four
 * doors that differed only in glyph and never in colour.
 *
 * FOUR RECTANGLE STACKS, NOT FOUR ICONS. Each drawing is the method's own
 * shape at its plainest — three product tiles for the catalogue, a camera
 * body, three overlapping photographs for the library, a five-bar waveform for
 * voice, a 2×2 grid for The Ten — and every one of them is `View`s with a
 * radius and a fill. No SVG library, no asset, no image request, nothing added
 * to package.json, and nothing that can fail to load: the artifact's
 * private-image fallback state has no counterpart here because there is no
 * image to lose.
 *
 * The fills come from `ART` in the spec, which is where the argument for a
 * named illustration table (rather than palette tokens) is written out.
 *
 * DECORATIVE BY CONSTRUCTION. The tile is inside the door's `Pressable`, which
 * carries the accessibility role, label and hint, so VoiceOver reads the door
 * as one node — name then method — and never reaches these. That is the
 * artifact's focus-order requirement, held by composition rather than by a
 * pile of `accessibilityElementsHidden`.
 */
export function DoorArt({ kind }: { kind: DoorArtKind }) {
  switch (kind) {
    case 'catalogue':
      return <Catalogue />;
    case 'camera':
      return <Camera />;
    case 'library':
      return <Library />;
    case 'voice':
      return <Voice />;
    case 'ten':
      return <Ten />;
  }
}

/** Three product tiles on a shelf — the licensed listing, drawn. */
function Catalogue() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      <View style={{ width: 18, height: 31, borderRadius: 3, backgroundColor: ART.clay }} />
      <View style={{ width: 20, height: 42, borderRadius: 4, backgroundColor: ART.bark }} />
      <View style={{ width: 18, height: 26, borderRadius: 3, backgroundColor: ART.tan }} />
    </View>
  );
}

/** A camera body and its hump. */
function Camera() {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <View
        style={{
          width: 16,
          height: 5,
          borderTopLeftRadius: 2,
          borderBottomLeftRadius: 2,
          backgroundColor: ART.stone,
        }}
      />
      <View
        style={{
          width: 47,
          height: 34,
          borderRadius: 6,
          backgroundColor: ART.slate,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: ART.pebble }} />
      </View>
    </View>
  );
}

/**
 * Three photographs in a stack, fanned.
 *
 * Absolutely positioned inside a fixed box rather than laid out with negative
 * margins: the overlap is the drawing, and a negative margin would be the same
 * picture expressed as a value nobody can read off the frame.
 */
function Library() {
  return (
    <View style={{ width: 52, height: 44 }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 6,
          width: 29,
          height: 36,
          borderRadius: 4,
          backgroundColor: ART.linen,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 12,
          top: 2,
          width: 29,
          height: 38,
          borderRadius: 4,
          backgroundColor: ART.bark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 24,
          top: 0,
          width: 28,
          height: 41,
          borderRadius: 4,
          backgroundColor: ART.sage,
        }}
      />
    </View>
  );
}

/** Five bars — a waveform at rest, never animated. This is a door, not a meter. */
const VOICE_BARS: readonly { h: number; fill: string }[] = [
  { h: 14, fill: ART.linen },
  { h: 26, fill: ART.rust },
  { h: 37, fill: ART.oxblood },
  { h: 23, fill: ART.rust },
  { h: 12, fill: ART.linen },
];

function Voice() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {VOICE_BARS.map((bar, i) => (
        <View
          key={i}
          style={{ width: 4, height: bar.h, borderRadius: 2, backgroundColor: bar.fill }}
        />
      ))}
    </View>
  );
}

/** Four pieces in a grid — the guided run at the first ten, in miniature. */
const TEN_TILES: readonly string[] = [ART.tenTan, ART.linen, ART.tenAmber, ART.tenCream];

function Ten() {
  return (
    <View
      style={{
        width: 44,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
      }}>
      {TEN_TILES.map((fill, i) => (
        <View key={i} style={{ width: 20, height: 24, borderRadius: 4, backgroundColor: fill }} />
      ))}
    </View>
  );
}

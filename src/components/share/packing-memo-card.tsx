import { useEffect, useRef } from 'react';
import { Text as RNText, View } from 'react-native';

import { CARD_H, CARD_W } from '@/features/share/capture-plate';
import { cardPieceLines } from '@/features/share/packing-memo-layout';
import { garmentLabel } from '@/features/plan/packing-memo';
import { repeatLabel } from '@/features/plan/packing-math';
import { describeDates, type Trip } from '@/features/plan/trip';
import type { PackedPiece } from '@/features/plan/packing';

/**
 * The packing memo's own share artifact — new for this wave, in the same
 * paper voice as the outfit's `PlateCard` but its own composition: a list
 * read as an itinerary, not a photograph. No atlas draws this card, so its
 * geometry is authored here rather than transcribed from one.
 *
 * SAME RULES AS `PlateCard`, restated because they are load-bearing here too:
 *
 *   - PAPER, not the app's theme. This is a captured image; a dark-mode phone
 *     must export the identical artifact a light-mode one would. Every colour
 *     below is a literal, and nothing here may call `useTheme()`.
 *   - COST-PER-WEAR NEVER APPEARS. §2.5 of the packing contract allows it
 *     inside the app; the share-card ban from `cinch-share-card` is separate
 *     and absolute, and this file has no code path that could print it — the
 *     bag list below prints a name and a repeat count, nothing priced.
 */
const PAPER = {
  ground: '#F4F0E6',
  ink: '#1C1A16',
  muted: '#6B665C',
  faint: '#8A8578',
  rule: 'rgba(28,26,22,0.20)',
};

const z = (designPx: number) => (designPx * CARD_W) / 1080;
const PRINT = { allowFontScaling: false } as const;

const serif = (size: number, color: string = PAPER.ink) => ({
  fontFamily: 'InstrumentSerif_400Regular',
  fontSize: size,
  lineHeight: size * 1.08,
  color,
});

const label = (size: number, track: number, color: string) => ({
  fontFamily: 'HelveticaNeue-Medium',
  fontSize: size,
  lineHeight: size * 1.2,
  letterSpacing: track,
  color,
  textTransform: 'uppercase' as const,
});

const body = (size: number, color: string = PAPER.ink) => ({
  fontFamily: 'HelveticaNeue',
  fontSize: size,
  lineHeight: size * 1.4,
  color,
});

export function PackingMemoCard({
  trip,
  headline,
  items,
  /** Fired once, a beat after mount — long enough for the swatches to paint. */
  onReady,
}: {
  trip: Trip;
  headline: string;
  items: readonly PackedPiece[];
  onReady?: () => void;
}) {
  const names = items.map((p) => `${garmentLabel(p.garment)} ${repeatLabel(p.looks, p.worn)}`);
  const { shown, more } = cardPieceLines(names);

  const firedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  useEffect(() => {
    if (firedRef.current) return;
    const t = setTimeout(() => {
      firedRef.current = true;
      onReadyRef.current?.();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <View
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: PAPER.ground,
        paddingTop: z(76),
        paddingBottom: z(76),
        paddingHorizontal: z(80),
      }}>
      {/* ── The colophon rail ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <RNText {...PRINT} style={label(z(26), 1.9, PAPER.ink)}>
          Cinch
        </RNText>
        <RNText {...PRINT} style={label(z(22), 0.4, PAPER.muted)}>
          {trip.destination.name}
        </RNText>
      </View>

      {/* ── The trip, as a caption ── */}
      <RNText {...PRINT} style={[label(z(22), 0.4, PAPER.muted), { marginTop: z(20) }]}>
        {describeDates(trip.startsOn, trip.endsOn).toUpperCase()}
      </RNText>

      {/* ── The headline — the same sentence the memo opens with in-app ── */}
      <RNText {...PRINT} style={[serif(z(96)), { marginTop: z(28) }]}>
        {headline}
      </RNText>

      {/* ── The bag ── */}
      <View style={{ marginTop: z(56), flex: 1 }}>
        <RNText {...PRINT} style={label(z(24), 0.5, PAPER.muted)}>
          The bag
        </RNText>
        <View style={{ marginTop: z(20), height: 1, backgroundColor: PAPER.rule }} />
        {shown.map((line) => (
          <RNText {...PRINT} key={line} style={[body(z(32)), { marginTop: z(18) }]}>
            {line}
          </RNText>
        ))}
        {more > 0 ? (
          <RNText {...PRINT} style={[body(z(32), PAPER.muted), { marginTop: z(18) }]}>
            +{more} more
          </RNText>
        ) : null}
      </View>

      {/* ── The signature ── */}
      <View>
        <RNText {...PRINT} style={serif(z(46))}>
          Cinch
        </RNText>
        <RNText {...PRINT} style={[label(z(21), 0.3, PAPER.faint), { marginTop: z(6) }]}>
          Clothes you already own
        </RNText>
      </View>
    </View>
  );
}

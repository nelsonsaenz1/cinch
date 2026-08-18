import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { RevealArrival } from '@/components/reveal/reveal-arrival';
import { RevealComputing, RevealCount } from '@/components/reveal/reveal-count';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, type Tally } from '@/features/closet/outfit-count';
import { compositionChips } from '@/features/onboarding/reveal-copy';
import {
  REVEAL_COPY,
  arrivalBody,
  arrivalTitle,
  countUpValue,
  derivationLine,
  derivationShort,
  displayFontSize,
  mayDrawDigit,
  type RevealPhase,
} from '@/features/onboarding/reveal-spec';

/**
 * DEV ONLY · Redesign 12 — the seven beats, one tap apart.
 *
 * The whole point of a cycler here rather than seven routes is that the beats
 * are checked as a SEQUENCE: whether the number arrives without the layout
 * jumping under it, whether the derivation lands with the number rather than
 * after it, and — the one that matters most — whether anything digit-shaped is
 * on screen during `arriving` or `computing`. That last one is invisible in a
 * still and obvious when you step through.
 *
 * Deterministic by construction: the tally is a literal, the count comes from
 * `countOutfits` exactly as the route computes it, and `noImages` resolves
 * every path to undefined so no network is involved.
 */

/** The canonical ten. 3×2×2 + 1×2 = 14 by the same arithmetic the route uses. */
const TALLY: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };
const PIECES = 10;
const COUNT = countOutfits(TALLY);

const noImages = () => undefined;

const PHASES: readonly RevealPhase[] = [
  'arriving',
  'computing',
  'counting',
  'settled',
  'plating',
  'cascade',
  'complete',
];

export default function DevR12Reveal() {
  // The pose is deep-linkable — `cinch:///dev-r12-reveal?phase=cascade`.
  //
  // Not a convenience: `simctl` can open a URL and cannot tap, so a cycler
  // whose only control is a button is a fixture that can be looked at by hand
  // and never photographed. Every accepted state has to be reachable without a
  // finger for the evidence set to be reproducible at all.
  const params = useLocalSearchParams<{ phase?: string }>();
  const linked = (PHASES as readonly string[]).includes(params.phase ?? '')
    ? (params.phase as RevealPhase)
    : 'arriving';

  // The URL is the source of truth; a tap is an override that the URL clears.
  //
  // Seeding `useState` from the param once is not enough: expo-router does not
  // remount a screen when only the query string changes, so every deep link
  // after the first would have been ignored and every capture would have
  // photographed the same frame. Adjusted during render — React's own
  // "adjusting state when a prop changes" pattern — so a new link wins
  // immediately and a tap still works between links.
  const [phase, setPhase] = useState<RevealPhase>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPhase(linked);
  }
  const [progress, setProgress] = useState(0.4);
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  const platesShown = phase === 'cascade' ? 2 : phase === 'complete' ? 3 : 0;
  const hasPlates = platesShown > 0;
  const shown =
    phase === 'counting' ? countUpValue(COUNT, progress) : mayDrawDigit(phase) ? COUNT : 0;

  const picker = (
    <View className="px-gutter pt-4">
      <Text variant="eyebrow">Redesign 12 · Reveal</Text>
      <View className="mt-2 flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {PHASES.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityLabel={p}
            onPress={() => setPhase(p)}
            style={{ minHeight: 44, justifyContent: 'center' }}
            className={p === phase ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
            <Text variant="label">{p}</Text>
          </Pressable>
        ))}
        {phase === 'counting' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Advance the count-up"
            onPress={() => setProgress((v) => (v >= 0.9 ? 0.15 : v + 0.25))}
            style={{ minHeight: 44, justifyContent: 'center' }}
            className="rounded-md bg-blush px-3">
            <Text variant="label">{`${Math.round(progress * 100)}%`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <RevealStage>
      {picker}

      <View style={{ paddingTop: 20 }}>
        {phase === 'arriving' ? (
          <RevealArrival
            otherUris={[]}
            pieceCount={PIECES}
            title={arrivalTitle(PIECES)}
            body={arrivalBody(PIECES)}
            tail={REVEAL_COPY.arrivalBody}
          />
        ) : null}

        {phase === 'computing' ? (
          <RevealComputing
            title={REVEAL_COPY.computingTitle}
            body={REVEAL_COPY.computingBody}
            large={ax}
          />
        ) : null}

        {mayDrawDigit(phase) ? (
          <>
            <RevealCount
              count={shown}
              fontSize={displayFontSize(COUNT, hasPlates, ax)}
              // The composition clause retires once there is something better
              // to look at — it did its work at the settled beat.
              derivation={
                hasPlates ? derivationShort(PIECES, TALLY) : derivationLine(PIECES, TALLY)
              }
              chips={compositionChips(TALLY, true, true)}
              spokenLabel={derivationLine(PIECES, TALLY)}
              large={ax}
              showNumber
            />

            {/* The plate reserves its space before it has anything to put in
                it, so the page does not reflow under somebody already reading. */}
            {phase === 'plating' ? (
              <View style={{ marginTop: 24, height: 260 }} accessibilityElementsHidden />
            ) : null}

            {Array.from({ length: platesShown }, (_, i) => (
              <View key={i} style={{ marginTop: i === 0 ? 24 : 12 }}>
                {i === 0 ? <Text variant="eyebrow">The first one</Text> : null}
                <View style={{ marginTop: i === 0 ? 10 : 0, marginHorizontal: -20 }}>
                  <Plate
                    outfit={FIXTURE_OUTFIT}
                    index={i}
                    colophon={{ city: 'Denver' }}
                    resolveImage={noImages}
                    preview
                  />
                </View>
              </View>
            ))}

            {phase === 'complete' ? (
              <View style={{ marginTop: 20 }}>
                <Button title={REVEAL_COPY.openToday} onPress={() => {}} className="self-stretch" />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </RevealStage>
  );
}

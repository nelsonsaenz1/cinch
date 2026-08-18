import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { RevealCount } from '@/components/reveal/reveal-count';
import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, type Tally } from '@/features/closet/outfit-count';
import {
  compositionChips,
  smallestFix,
  substitutionDerivation,
} from '@/features/onboarding/reveal-copy';
import {
  OFFLINE_MARK,
  REVEAL_COPY,
  derivationLine,
  displayFontSize,
  membershipCountLine,
  missingPhrases,
  partialDerivation,
  piecesToFirstOutfit,
  untaggedChip,
  zeroBodyLine,
} from '@/features/onboarding/reveal-spec';

/**
 * DEV ONLY · Redesign 12 — the nine states that are not the ordinary day.
 *
 * They are drawn together because the failure this fixture exists to catch is
 * any two of them reading the same:
 *
 *   SINGULAR    — one outfit, which is grammatically its own case.
 *   LARGE       — three digits, which step DOWN one notch rather than
 *                 shrinking to fit; and a sentence that switches to figures
 *                 wholesale rather than mixing registers.
 *   PARTIAL     — a count derived from fewer pieces than were photographed,
 *                 saying so rather than quietly counting a smaller closet.
 *   SUBSTITUTION— the dress that stands in for two pieces and counts once.
 *   OFFLINE     — the arithmetic is unchanged, because it was always local.
 *   NO IMAGES   — an unreadable derivative falls back to the sand cell; the
 *                 piece is still named and nothing is invented.
 *   ZERO        — a result, with two doors and no paywall on either.
 *   TRIALING /  — the Cinch-owned line above a sheet Cinch does not own. No
 *   LAPSED        price, no product, no term, no new trial promised.
 */

const noImages = () => undefined;

const CANONICAL: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };
const SINGULAR: Tally = { tops: 1, bottoms: 1, dresses: 0, shoes: 1 };
const LARGE: Tally = { tops: 11, bottoms: 8, dresses: 4, shoes: 8 };
const PARTIAL: Tally = { tops: 3, bottoms: 2, dresses: 0, shoes: 2 };
const TEN_TOPS: Tally = { tops: 10, bottoms: 0, dresses: 0, shoes: 0 };

type Pose =
  | 'singular'
  | 'large'
  | 'partial'
  | 'substitution'
  | 'offline'
  | 'no-images'
  | 'zero'
  | 'trialing'
  | 'lapsed';

const POSES: readonly Pose[] = [
  'singular',
  'large',
  'partial',
  'substitution',
  'offline',
  'no-images',
  'zero',
  'trialing',
  'lapsed',
];

export default function DevR12States() {
  // Deep-linkable — `cinch:///dev-r12-states?pose=partial`. See the sibling
  // fixture for why: `simctl` opens URLs and cannot tap.
  const params = useLocalSearchParams<{ pose?: string }>();
  const linked = (POSES as readonly string[]).includes(params.pose ?? '')
    ? (params.pose as Pose)
    : 'singular';

  // The URL is the source of truth; a tap is an override that the URL clears.
  //
  // Seeding `useState` from the param once is not enough: expo-router does not
  // remount a screen when only the query string changes, so every deep link
  // after the first would have been ignored and every capture would have
  // photographed the same frame. Adjusted during render — React's own
  // "adjusting state when a prop changes" pattern — so a new link wins
  // immediately and a tap still works between links.
  const [pose, setPose] = useState<Pose>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPose(linked);
  }
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  const tally =
    pose === 'singular'
      ? SINGULAR
      : pose === 'large'
        ? LARGE
        : pose === 'partial'
          ? PARTIAL
          : CANONICAL;
  const pieces = pose === 'singular' ? 3 : pose === 'large' ? 31 : pose === 'partial' ? 7 : 10;
  const count = countOutfits(tally);
  const untagged = pose === 'partial' ? 3 : 0;

  return (
    <RevealStage>
      <View className="px-gutter pt-4">
        <Text variant="eyebrow">Redesign 12 · States</Text>
        <View className="mt-2 flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {POSES.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={p}
              onPress={() => setPose(p)}
              style={{ minHeight: 44, justifyContent: 'center' }}
              className={p === pose ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
              <Text variant="label">{p}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* `flex-1`, because `RevealEmpty` lays itself out as a full frame:
          content at the top, the two doors pinned at the bottom. Without a
          height to fill, its own `flex-1` collapses and the headline, the body
          and the rows are squeezed out — which is exactly what the first
          capture of this fixture showed. */}
      <View className="flex-1" style={{ paddingTop: 20 }}>
        {pose === 'zero' ? (
          <RevealEmpty
            headline={REVEAL_COPY.zeroTitle}
            body={zeroBodyLine(10, TEN_TOPS, piecesToFirstOutfit(TEN_TOPS))}
            needs={missingPhrases(TEN_TOPS)}
            fix={smallestFix(TEN_TOPS) ? REVEAL_COPY.zeroRepair : null}
            onFix={() => {}}
            onOpenToday={() => {}}
          />
        ) : pose === 'trialing' || pose === 'lapsed' ? (
          <View className="px-gutter" style={{ paddingTop: 60 }}>
            <Text variant="display" trim>
              {membershipCountLine(countOutfits(CANONICAL))}
            </Text>
            <Text
              variant="note"
              style={{ marginTop: 14, fontSize: ax ? 21 : 15, lineHeight: ax ? 29 : 23 }}>
              {pose === 'trialing'
                ? REVEAL_COPY.memberContextTrialing
                : REVEAL_COPY.memberContextFree}
            </Text>
            <View className="bg-tray" style={{ marginTop: 32, borderRadius: 18, padding: 20 }}>
              <Text variant="eyebrow">Superwall surface</Text>
              <Text variant="note" className="mt-2 text-muted">
                Vendor-owned. Campaign 254200, non-gated. Never drawn by Cinch.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <RevealCount
              count={count}
              fontSize={displayFontSize(count, true, ax)}
              derivation={
                pose === 'substitution'
                  ? substitutionDerivation(CANONICAL, 'tops')
                  : untagged > 0
                    ? partialDerivation(pieces, untagged, tally)
                    : derivationLine(pieces, tally)
              }
              chips={[
                ...compositionChips(tally, false, false),
                ...(untaggedChip(untagged) ? [untaggedChip(untagged)!] : []),
              ]}
              spokenLabel={derivationLine(pieces, tally)}
              offlineMark={pose === 'offline' ? OFFLINE_MARK : null}
              large={ax}
              showNumber
            />
            <View style={{ marginTop: 24 }}>
              <Text variant="eyebrow">The first one</Text>
              <View style={{ marginTop: 10, marginHorizontal: -20 }}>
                {/* Every pose resolves images to undefined: `no-images` is the
                    state the others are checked against, and a fixture that
                    could load a photograph would be checking the network. */}
                <Plate
                  outfit={FIXTURE_OUTFIT}
                  index={0}
                  colophon={{ city: 'Denver' }}
                  resolveImage={noImages}
                  preview
                />
              </View>
            </View>
            <View style={{ marginTop: 20 }}>
              <Button title={REVEAL_COPY.openToday} onPress={() => {}} className="self-stretch" />
            </View>
          </>
        )}
      </View>
    </RevealStage>
  );
}

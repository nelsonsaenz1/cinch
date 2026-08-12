import { View } from 'react-native';

import { Masthead, NothingWorks, nothingWorksReason } from '@/app/(tabs)/index';
import { GapCard } from '@/components/today/gap-card';
import { rankGaps, tallyOf } from '@/features/closet/outfit-count';
import type { WeatherContext } from '@/lib/styling';
import {
  AUTUMN_CLOSET,
  FIXTURE_COLD_NOW,
  W3Frame,
} from '@/components/today/w3-g2-fixtures';

/** A snowing Saturday: −1 °C, wind, and nothing in the closet built for it. */
const SNOW: WeatherContext = {
  feelsLikeC: -1,
  highC: 1,
  lowC: -6,
  precipitationChance: 0.8,
  windKph: 28,
  swing: false,
};

const TALLY = tallyOf(AUTUMN_CLOSET);
const TOP_GAP = rankGaps(TALLY)[0];

/**
 * DEV ONLY · Wave 3 atlas state T-12/AX — nothing works at the largest type
 *
 * No action is removed at this size — the ordering is what changes, never the
 * inventory. The gap card keeps its name and its link; the sentence explaining
 * what one more piece would unlock scrolls, because the link's destination
 * explains it in full.
 */
export default function DevW3G2T12Ax() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 30°F, 80% rain · windy"
        now={FIXTURE_COLD_NOW}
        unseen={false}
        stacked={true}
      />
      <View className="mt-6">
        <NothingWorks reason={nothingWorksReason(AUTUMN_CLOSET, SNOW)} onSeeWorn={() => {}} />
        <GapCard tally={TALLY} gain={TOP_GAP} onOpen={() => {}} />
      </View>
    </W3Frame>
  );
}

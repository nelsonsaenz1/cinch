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
 * DEV ONLY · Wave 3 atlas state T-12 — nothing works — the Gap Feed handoff
 *
 * The refusal is stated as a judgement Cinch is making on the reader's
 * behalf, computed from THIS closet and THIS weather. Correction 08 deletes
 * "Build one anyway": a refusal that can be overridden is not a refusal. The
 * gap card is computed reasoning only — no merchant, no price, no shop word —
 * and it is offered after the closet-first recovery, never before it.
 */
export default function DevW3G2T12() {
  return (
    <W3Frame>
      <Masthead
        city="Denver"
        name="Maya"
        weather="Feels 30°F, 80% rain · windy"
        now={FIXTURE_COLD_NOW}
        unseen={false}
        stacked={false}
      />
      <View className="mt-6">
        <NothingWorks reason={nothingWorksReason(AUTUMN_CLOSET, SNOW)} onSeeWorn={() => {}} />
        <GapCard tally={TALLY} gain={TOP_GAP} onOpen={() => {}} />
      </View>
    </W3Frame>
  );
}

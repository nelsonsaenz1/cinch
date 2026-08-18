import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import {
  DAILY_REACTION_GAP,
  DAILY_REACTION_MIN_HEIGHT,
} from '@/components/daily-social/reaction-spec';
import { FEED_GAP, LOOK_CARD_RADIUS, WELL_RATIO } from '@/features/explore/explore-spec';
import { useTheme } from '@/theme/tokens';

/**
 * THE WAIT, IN THE SHAPE OF THE CARD THAT REPLACES IT — the accepted
 * `loading-skeleton` frame.
 *
 * Every reserved box is the real geometry read from the same constants the
 * real card reads: `WELL_RATIO` for the photograph, `LOOK_CARD_RADIUS` for the
 * corner, `DAILY_REACTION_MIN_HEIGHT` and `DAILY_REACTION_GAP` for the three
 * chips. A placeholder that reserves a shape the real card does not draw is
 * worse than no placeholder at all, because the page reflows at exactly the
 * moment the content lands — which is the one moment the wait was covering.
 *
 * The sweep, the Reduce Motion behaviour and the VoiceOver suppression are all
 * inherited from the shared `Skeleton`. Nothing here is labelled: the section
 * above carries the one "Reading your circle" announcement, and a dozen
 * announced boxes is worse than none.
 *
 * The second card is drawn without its caption block, which is the frame: the
 * fold cuts it, and reserving furniture below the fold buys nothing.
 */
export function LookFeedSkeleton({ count = 2 }: { count?: number }) {
  const theme = useTheme();

  return (
    <View style={{ gap: FEED_GAP }}>
      {Array.from({ length: count }).map((_, card) => (
        <View
          key={card}
          style={{
            backgroundColor: theme.tray,
            borderRadius: LOOK_CARD_RADIUS,
            overflow: 'hidden',
          }}>
          <Skeleton style={{ aspectRatio: 1 / WELL_RATIO }} delay={card * 120} />

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
            {/* The headline, at the serif plate step's height. */}
            <Skeleton className="h-5 w-3/5 rounded-chip" delay={card * 120} />
            {/* The outfit line. */}
            <Skeleton className="mt-2.5 h-3 w-2/5 rounded-chip" delay={card * 120} />

            {card === 0 ? (
              <View
                className="mt-4"
                style={{ flexDirection: 'row', gap: DAILY_REACTION_GAP }}>
                {[0, 1, 2].map((slot) => (
                  <Skeleton
                    key={slot}
                    style={{ flex: 1, minHeight: DAILY_REACTION_MIN_HEIGHT, borderRadius: 12 }}
                    delay={card * 120}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

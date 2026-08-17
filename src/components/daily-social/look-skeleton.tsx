import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonLead } from '@/components/ui/skeleton';
import { GRID_GAP, plateGrid, ROW_RATIO } from '@/components/today/plate-grid';

import { DAILY_REACTION_GAP, DAILY_REACTION_MIN_HEIGHT } from './reaction-spec';

/**
 * THE WAIT, IN THE SHAPE OF THE CARD THAT REPLACES IT.
 *
 * ── Why not `today/plate-skeleton.tsx` ──────────────────────────────────────
 *
 * It was the first reach and it is the wrong shape. `PlateSkeleton` draws
 * Today's plate: a credit line, a ruled footer and a three-across action row at
 * 48 pt with a 1.4-weighted wear slot. A friend's look has none of those — no
 * reasoning line, no wear action, no cost per wear — so reserving them would
 * leave the page reflowing at exactly the moment the looks arrive, which is the
 * one moment the wait was supposed to cover. That is the same argument
 * `skeleton.tsx` records for retiring its own `PlateSkeleton`: "a placeholder
 * that reserves a shape the real card no longer draws is worse than no
 * placeholder at all."
 *
 * So this is the shared `Skeleton` primitive — the sweep, the Reduce Motion
 * behaviour and the VoiceOver suppression all inherited — laid out by
 * `plateGrid()`, the same function `LookCollage` uses. The two cannot disagree
 * about the geometry because they read it from one place.
 */
export function DailyLookSkeleton({
  /** Cards to reserve. Three is a small circle's ordinary day. */
  count = 3,
  /** Cells per card. Five is an ordinary look. */
  pieces = 5,
}: {
  count?: number;
  pieces?: number;
}) {
  const rows = plateGrid(pieces);

  return (
    <View accessibilityLabel="Reading your circle">
      <SkeletonLead label="Reading your circle…" />
      <View className="gap-3 px-gutter">
        {Array.from({ length: count }).map((_, card) => (
          <Card key={card} padding="md">
            {/* The friend's name, at the eyebrow's height. */}
            <Skeleton className="h-3 w-1/3 rounded-chip" delay={card * 120} />
            {/* The look's name, at the serif plate step's. */}
            <Skeleton className="mt-2 h-6 w-3/5 rounded-chip" delay={card * 120} />

            <View style={{ marginTop: 12, gap: GRID_GAP }}>
              {rows.map((cells, rowIndex) => (
                <View
                  key={`row-${rowIndex}`}
                  style={{ flexDirection: 'row', gap: GRID_GAP, aspectRatio: 1 / ROW_RATIO }}>
                  {Array.from({ length: cells }).map((_, cell) => (
                    <Skeleton
                      key={`cell-${rowIndex}-${cell}`}
                      style={{ flex: 1, borderRadius: 12 }}
                      delay={card * 120}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* When it was worn. */}
            <Skeleton className="mt-2.5 h-2.5 w-1/4 rounded-chip" delay={card * 120} />

            {/* The three reactions, at their real floor and their real gap, so
                the card does not grow under the reader when they land. */}
            <View
              className="mt-3.5 border-t border-rule pt-3.5"
              style={{ flexDirection: 'row', gap: DAILY_REACTION_GAP }}>
              {[0, 1, 2].map((slot) => (
                <Skeleton
                  key={slot}
                  style={{ flex: 1, height: DAILY_REACTION_MIN_HEIGHT, borderRadius: 12 }}
                  delay={card * 120}
                />
              ))}
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

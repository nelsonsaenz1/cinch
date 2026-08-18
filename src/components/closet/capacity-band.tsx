import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Plan } from '@/features/billing/plans';
import {
  BAND_RADIUS,
  BAND_TRACK,
  activeLine,
  capacityRemedy,
  capacityTrack,
  storedLine,
  type CapacityState,
} from '@/features/closet/closet-spec';
import { useTheme } from '@/theme/tokens';

/**
 * Capacity, as a designed band rather than a colophon. Redesign 14.
 *
 * ── WHY A BAND AND NOT A SENTENCE ───────────────────────────────────────────
 *
 * It replaced a line of type reading "84 of 150 pieces". That sentence was
 * true and it was unreadable as a QUANTITY: nobody looks at two numerals and
 * feels how much room is left. A track does that in one glance, and it does
 * something the sentence could not — it shows the STORED pieces as part of the
 * same whole, which is the fact that makes storing look like a remedy instead
 * of a filing cabinet.
 *
 * ── TWO SEGMENTS, ONE TRACK ─────────────────────────────────────────────────
 *
 * Active in oxblood, stored in clay, both measured against the TOTAL ceiling.
 * One track rather than two, because they are not two budgets: a stored piece
 * still counts toward the total, and drawing them apart would suggest storing
 * is free.
 *
 * ── THE CLIENT DISPLAYS, THE SERVER DECIDES ─────────────────────────────────
 *
 * Every figure here is a prop. This component computes no ceiling, enforces no
 * limit and gates no action — `useCapacity` reads the counts and `plans.ts`
 * holds the ceilings, and the server refuses over-limit writes regardless of
 * what this draws.
 */
export function CapacityBand({
  plan,
  planName,
  active,
  activeLimit,
  archived,
  total,
  storedLimit,
  state,
  large = false,
  onDoor,
}: {
  plan: Plan;
  /** "Free", "Standard", "Pro" — from `plans.ts`, never typed here. */
  planName: string;
  active: number;
  activeLimit: number;
  /** How many are put away. */
  archived: number;
  /** Active plus archived — how much of the whole closet is spoken for. */
  total: number;
  storedLimit: number;
  state: CapacityState;
  large?: boolean;
  /** Opens the plans placement or the store flow, per the remedy. */
  onDoor: (door: 'plans' | 'store') => void;
}) {
  const theme = useTheme();
  const remedy = capacityRemedy(state, plan);
  const track = capacityTrack({ active, stored: total, storedLimit });

  return (
    <View
      className="bg-tray"
      style={{ borderRadius: BAND_RADIUS, padding: large ? 18 : 14 }}
      // ONE announcement. A band read as "Standard", then "84 of 150 active",
      // then "26 stored, 110 of 450" is three facts about one thing; a reader
      // assembling them by ear is doing work the sighted reader does not.
      accessible
      accessibilityLabel={`${planName}. ${activeLine(active, activeLimit)}. ${storedLine(archived, total, storedLimit)}.${remedy.body ? ` ${remedy.body}` : ''}`}>
      <View className="flex-row items-baseline justify-between">
        <Text variant="eyebrow">{planName}</Text>
        <Text variant="label" style={{ color: theme.ink, fontSize: large ? 19 : 15 }}>
          {activeLine(active, activeLimit)}
        </Text>
      </View>

      {/* The track. Decorative — every number it encodes is already spoken by
          the label above, and a screen reader announcing two nested bars would
          be reading the same fact a third time. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-row overflow-hidden"
        style={{
          marginTop: large ? 14 : 10,
          height: BAND_TRACK,
          borderRadius: BAND_TRACK / 2,
          backgroundColor: theme.sand,
        }}>
        <View style={{ flex: Math.max(0.0001, track.activeFraction), backgroundColor: theme.accent }} />
        <View style={{ flex: Math.max(0.0001, track.storedFraction), backgroundColor: theme.accentWarm }} />
        <View style={{ flex: Math.max(0.0001, 1 - track.activeFraction - track.storedFraction) }} />
      </View>

      <Text
        variant="note"
        style={{ marginTop: large ? 12 : 8, color: theme.muted, fontSize: large ? 17 : 13 }}>
        {storedLine(archived, total, storedLimit)}
      </Text>

      {/* The remedy, and only when there is one. A band with a permanent
          "see plans" under it would be a sales line pretending to be a status
          line. */}
      {remedy.body ? (
        <Text variant="note" style={{ marginTop: 12, color: theme.ink, fontSize: large ? 17 : 13 }}>
          {remedy.body}
        </Text>
      ) : null}

      {remedy.action && remedy.door ? (
        <Pressable
          onPress={() => onDoor(remedy.door!)}
          accessibilityRole="button"
          accessibilityLabel={remedy.action}
          style={{ minHeight: large ? 56 : 44, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" style={{ color: theme.accent }}>
            {remedy.action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

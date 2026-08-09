import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { daysBetween, fromIsoDate, toIsoDate, type IsoDate } from '@/features/plan/trip';
import { useTheme } from '@/theme/tokens';

/**
 * A calendar range, drawn in JS.
 *
 * WHY NOT `@react-native-community/datetimepicker`. It is a native module, and
 * a native module costs a store build — for a wave that otherwise ships over
 * the air, that is the whole release cycle traded for a control this app can
 * draw in a hundred lines. It also draws iOS's own calendar, which is the one
 * component on the screen that would not be Cinch.
 *
 * The interaction is the one every booking site uses and nobody has to be
 * taught: first tap sets the start, second tap sets the end, a tap before the
 * start begins again from there.
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Matches the `trips_length_sane` constraint. A year is not a trip. */
const MAX_TRIP_DAYS = 90;

/** How many months forward you may page. Beyond this nobody is packing yet. */
const MONTHS_AHEAD = 18;

type Cell = { iso: IsoDate; day: number } | null;

/** The days of `month`, padded so the first lands under its weekday. */
function monthGrid(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1, 12);
  // getDay() is Sunday-first; the week here starts on Monday.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();

  const cells: Cell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push({ iso: toIsoDate(new Date(year, month, day, 12)), day });
  }
  return cells;
}

export function DateRangePicker({
  startsOn,
  endsOn,
  onChange,
}: {
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
  onChange: (range: { startsOn: IsoDate | null; endsOn: IsoDate | null }) => void;
}) {
  const theme = useTheme();
  const today = useMemo(() => toIsoDate(new Date()), []);

  const [cursor, setCursor] = useState(() => {
    const from = startsOn ? fromIsoDate(startsOn) : new Date();
    return { year: from.getFullYear(), month: from.getMonth() };
  });

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const monthLabel = new Date(cursor.year, cursor.month, 1, 12).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  /** The first month you may page back to is this one — no packing for the past. */
  const now = new Date();
  const atFirstMonth =
    cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const monthsFromNow = (cursor.year - now.getFullYear()) * 12 + (cursor.month - now.getMonth());
  const atLastMonth = monthsFromNow >= MONTHS_AHEAD;

  const step = (by: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + by, 1, 12);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  function pick(iso: IsoDate) {
    // Nothing chosen, both chosen, or a tap before the start — begin again.
    if (!startsOn || endsOn || iso < startsOn) {
      onChange({ startsOn: iso, endsOn: null });
      return;
    }
    if (daysBetween(startsOn, iso) > MAX_TRIP_DAYS) {
      // Silently restarting would look like a dropped tap. Treat the far date
      // as a new start, which is what somebody scrolling months ahead meant.
      onChange({ startsOn: iso, endsOn: null });
      return;
    }
    onChange({ startsOn, endsOn: iso });
  }

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <MonthStep label="‹" hint="Previous month" disabled={atFirstMonth} onPress={() => step(-1)} />
        <Text variant="body">{monthLabel}</Text>
        <MonthStep label="›" hint="Next month" disabled={atLastMonth} onPress={() => step(1)} />
      </View>

      <View className="mt-4 flex-row">
        {WEEKDAYS.map((d, i) => (
          <View key={`${d}${i}`} className="flex-1 items-center">
            <Text variant="label">{d}</Text>
          </View>
        ))}
      </View>

      <View className="mt-2 flex-row flex-wrap">
        {cells.map((cell, i) => {
          if (!cell) return <View key={`pad${i}`} className="h-11" style={{ width: '14.2857%' }} />;

          const past = cell.iso < today;
          const isStart = cell.iso === startsOn;
          const isEnd = cell.iso === endsOn;
          const inside =
            Boolean(startsOn && endsOn) && cell.iso > startsOn! && cell.iso < endsOn!;
          const selected = isStart || isEnd;

          return (
            <Pressable
              key={cell.iso}
              disabled={past}
              onPress={() => pick(cell.iso)}
              accessibilityRole="button"
              accessibilityState={{ disabled: past, selected }}
              accessibilityLabel={fromIsoDate(cell.iso).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              className="h-11 items-center justify-center active:opacity-60"
              style={{ width: '14.2857%' }}>
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: selected
                    ? theme.accent
                    : inside
                      ? theme.sand
                      : 'transparent',
                }}>
                <Text
                  variant="body"
                  style={{
                    // `muted`, never `faint` — faint is ~3.5:1 on canvas and
                    // fails AA, which is a standing refusal in this app.
                    color: selected ? theme.canvas : past ? theme.muted : theme.ink,
                  }}>
                  {cell.day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MonthStep({
  label,
  hint,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled }}
      className="h-11 w-11 items-center justify-center active:opacity-60">
      <Text variant="title" style={{ color: disabled ? theme.muted : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

import { Pressable, ScrollView, View } from 'react-native';

import { SheetHeader, SheetShell } from '@/components/events/date-sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * Half-hour steps, kept inside the hours plans actually live in. Carried over
 * from the form these constants used to sit inside, rather than re-derived:
 * they are the same three numbers, and the picker is where they belong now
 * that the page around them has been rebuilt.
 */
export const TIME_STEP = 30;
export const TIME_MIN = 6 * 60;
export const TIME_MAX = 23 * 60 + 30;

/**
 * 7:00pm, and not the current minute.
 *
 * The atlas is explicit about it. A picker seeded from `now` is answering a
 * question nobody asked — an occasion being planned at 2pm is very rarely at
 * 2pm — and it also means the value under the finger changes depending on when
 * the sheet was opened, which makes the control unlearnable.
 */
export const DEFAULT_TIME_MINUTES = 19 * 60;

/**
 * "7:00pm" from minutes-from-midnight.
 *
 * Built through `toLocaleTimeString` rather than by hand so a 24-hour locale
 * comes through as "19:00" untouched — there is no dayPeriod to fold — and so
 * the register matches `timeLabel()` on the event surfaces exactly: set close,
 * lowercased. The field button and the row that filled it must read the same
 * or the sheet looks like it answered a different question.
 */
export function formatMinutes(total: number): string {
  const d = new Date();
  d.setHours(Math.floor(total / 60), total % 60, 0, 0);
  return d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
}

/** Every step, 6:00am through 11:30pm. */
const STEPS: number[] = Array.from(
  { length: Math.floor((TIME_MAX - TIME_MIN) / TIME_STEP) + 1 },
  (_, i) => TIME_MIN + i * TIME_STEP,
);

/** Drawn height of one row — over the 44pt floor without hitSlop. */
const ROW_HEIGHT = 48;
/** About seven rows. Tall enough to scan, short enough that the sheet is a
 *  sheet and not a screen. */
const LIST_HEIGHT = 336;

export type TimeSheetProps = {
  visible: boolean;
  /** Minutes from midnight, or null when no time has been set. */
  value: number | null;
  onChange: (minutes: number) => void;
  onClose: () => void;
};

/**
 * What time? — the second picker (§4.2).
 *
 * Same shell and the same title grammar as the date sheet, because they are
 * two halves of one answer. The list opens scrolled to the selection rather
 * than to the top: the default is 7:00pm, which is two thirds of the way down
 * a list that starts at six in the morning, and a picker that opens on a value
 * the user cannot see is a picker with no default at all.
 */
export function TimeSheet({ visible, value, onChange, onClose }: TimeSheetProps) {
  const theme = useTheme();

  const selected = value ?? DEFAULT_TIME_MINUTES;
  const index = Math.max(
    0,
    STEPS.findIndex((minutes) => minutes === selected),
  );
  // Centred, not pinned to the top — the steps either side are the context that
  // makes the selection readable as a position rather than as a lone row.
  const offset = Math.max(0, index * ROW_HEIGHT - (LIST_HEIGHT - ROW_HEIGHT) / 2);

  return (
    <SheetShell visible={visible} onRequestClose={onClose} grabber accessibilityLabel="Pick a time">
      <SheetHeader title="What time?" onDone={onClose} />

      <ScrollView
        style={{ height: LIST_HEIGHT }}
        className="mt-3.5"
        // The initial offset as a prop rather than an imperative scroll: the
        // Modal mounts this list fresh every time the sheet opens, so there is
        // no earlier position to correct and nothing to schedule.
        contentOffset={{ x: 0, y: offset }}
        showsVerticalScrollIndicator={false}>
        {STEPS.map((minutes) => {
          const isSelected = minutes === selected;
          const label = formatMinutes(minutes);

          return (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(minutes)}
              className="justify-center rounded-md px-3.5 active:opacity-60"
              style={{
                height: ROW_HEIGHT,
                ...(isSelected ? { backgroundColor: theme.ink } : null),
              }}>
              {/* Colour inline, never a second `text-*` class over the
                  variant's own `text-ink`. */}
              <Text variant="body" style={isSelected ? { color: theme.canvas } : undefined}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        {/* The last row can sit at the centre of the list like every other one,
            rather than being stuck to the bottom of the scroll. */}
        <View style={{ height: (LIST_HEIGHT - ROW_HEIGHT) / 2 }} />
      </ScrollView>
    </SheetShell>
  );
}

import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/**
 * The date sheet (N-05), and the shell the three occasion sheets share.
 *
 * ── Why the shell lives here ──────────────────────────────────────────────
 *
 * `SheetShell` and `SheetHeader` are exported from this file rather than from
 * a fourth one because this is the sheet the atlas actually draws the shell
 * on: N-05 is where the 24px corners, the rule top border and the grabber are
 * specified, and the time and discard sheets inherit that geometry rather than
 * restating it. Three copies of a sheet chrome drift; a file that exists only
 * to hold twelve lines of chrome is its own kind of tax.
 *
 * ── Which dialect of sheet ────────────────────────────────────────────────
 *
 * The app has two. Route-level `formSheet` (38px radius) is for screens; a
 * hand-built `<Modal>` is for a picker that belongs to a control on the page
 * beneath it. These are pickers inside a form, so they are hand-built, and
 * follow `components/item/item-edit-sheet.tsx` for the mechanics: transparent
 * Modal, a `Pressable` backdrop, an `Animated.View` on `spring.smooth`.
 */

export type SheetShellProps = {
  visible: boolean;
  /** Backdrop tap and hardware back. Dismissing a picker is a safe answer. */
  onRequestClose: () => void;
  /** The 40×4 handle. On the pickers, which are draggable-looking; not on the
   *  discard sheet, which is a question and should not look flickable away. */
  grabber?: boolean;
  /**
   * The sheet contains a TEXT FIELD and must ride above the keyboard.
   *
   * Opt-in, because it is not free and it is not always right. This shell is
   * bottom-anchored (`justify-end` inside a transparent Modal), so when the
   * keyboard came up the sheet stayed exactly where it was and the keyboard
   * covered it — which is the venue bug the founder reported: tap Where, start
   * typing, and both the field and its suggestion list are behind the keys with
   * no way to see what you typed. The date, time and discard sheets have no
   * input in them and must NOT lift: a picker that jumps when a keyboard opens
   * somewhere else in the app is a picker with a bug of its own.
   */
  avoidKeyboard?: boolean;
  accessibilityLabel: string;
  children: React.ReactNode;
};

export function SheetShell({
  visible,
  onRequestClose,
  grabber = false,
  avoidKeyboard = false,
  accessibilityLabel,
  children,
}: SheetShellProps) {
  const insets = useSafeAreaInsets();

  /**
   * Whether the keyboard is currently up, for the ONE measurement that has to
   * change when it is: the home-indicator inset under the sheet.
   *
   * `KeyboardAvoidingView behavior="padding"` lifts the sheet by the keyboard's
   * height, which puts the sheet's bottom edge exactly on the keyboard's top
   * edge — and there is no home indicator there to clear. Keeping the 34pt
   * inset would leave that much dead paper between the last row and the keys,
   * which is the gap that pushes the suggestion list back off the screen at the
   * larger type sizes. Subscribed to only when this shell is avoiding at all,
   * so the sheets with no field in them do no work.
   */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    if (!avoidKeyboard) return;
    // `WillShow`/`WillHide` rather than `DidShow`/`DidHide`: iOS fires the will
    // pair at the START of the animation, so the padding changes in the same
    // frames the keyboard is moving in rather than snapping after it lands.
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [avoidKeyboard]);

  const y = useSharedValue(visible ? 0 : 1);
  useEffect(() => {
    y.value = withSpring(visible ? 0 : 1, spring.smooth);
  }, [visible, y]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * 40 }],
    opacity: 1 - y.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent>
      <Shell avoiding={avoidKeyboard}>
        {/* `scrim` — the one dimming value, and the token's stated job is
            exactly this: sheet backdrops. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onRequestClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,26,22,0.40)' }}
        />

        {/* The animated layer carries the transform and NOTHING else, and the
            paint sits on a plain `View` inside it. `Animated.View` is the one
            place a `className` cannot be trusted in this project — NativeWind's
            interop is registered for the React Native primitives, not for
            Reanimated's wrappers (see button.tsx) — and a sheet whose ground,
            border and padding silently did nothing would be a blank rectangle. */}
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={sheetStyle}>
          <View
            className="w-full border-t border-rule bg-surface px-gutter pt-3.5"
            style={{
              // 24px is not a step on the radius scale and should not become
              // one for a single sheet dialect — the scale's neighbours are 20
              // (plate) and 38 (route sheet), and the atlas is explicit.
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              // The design's 24px floor, raised by the home indicator where
              // there is one. Adding the inset on top of the padding instead
              // would leave 58pt of dead paper under the buttons.
              paddingBottom: keyboardUp ? 24 : Math.max(insets.bottom, 24),
            }}>
            {grabber ? (
              <View
                className="mb-4 self-center rounded-full bg-rule"
                style={{ width: 40, height: 4 }}
              />
            ) : null}
            {children}
          </View>
        </Animated.View>
      </Shell>
    </Modal>
  );
}

/**
 * The bottom-anchored column the sheet sits in — a `KeyboardAvoidingView` when
 * the sheet has a field in it, a plain `View` when it does not.
 *
 * `KeyboardAvoidingScreen` is the app's one docked-composer mechanism
 * (`behavior="padding"`, iOS-only by design) and this is the same job: the
 * whole bottom edge lifts, because nothing inside the sheet scrolls the field
 * into view on its own. The two mechanisms never compound — a shell that
 * avoids does not also inset a scroll view, and the sheets that do not avoid
 * pay nothing at all.
 */
function Shell({ avoiding, children }: { avoiding: boolean; children: React.ReactNode }) {
  return avoiding ? (
    <KeyboardAvoidingScreen className="flex-1 justify-end">{children}</KeyboardAvoidingScreen>
  ) : (
    <View className="flex-1 justify-end">{children}</View>
  );
}

/** The picker title row: the serif question left, `Done` right, baselines aligned. */
export function SheetHeader({ title, onDone }: { title: string; onDone: () => void }) {
  const theme = useTheme();

  return (
    <View className="flex-row items-baseline justify-between">
      <Text variant="plate">{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done"
        hitSlop={12}
        onPress={onDone}
        className="active:opacity-60">
        {/* Oxblood is the whole emphasis — TY-01 took the Medium cut off it.
            Colour is inline rather than a second `text-*` class because
            `variant="body"` already names one and NativeWind resolves two by
            key order rather than by intent. */}
        <Text variant="body" style={{ color: theme.accent }}>
          Done
        </Text>
      </Pressable>
    </View>
  );
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** Midnight local — a calendar day, not an instant. See lib/date.ts on why. */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** The coming Saturday, or today if the weekend has already started. */
function thisWeekend(today: Date): Date {
  const day = today.getDay();
  if (day === 6 || day === 0) return today;
  return addDays(today, 6 - day);
}

/**
 * The grid for one month, Monday-first, padded to whole weeks.
 *
 * `null` is a leading or trailing blank rather than a neighbouring month's
 * day: a grid that shows 31 July inside August invites a tap that silently
 * changes month, and the month row above exists precisely so that navigation
 * is deliberate.
 */
function weeksOf(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  // JS weeks start on Sunday; the atlas's header is M T W T F S S.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, m + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** The letters, hardcoded because the atlas draws letters and not locale
 *  abbreviations — and because a seven-column grid cannot survive a locale
 *  whose short weekday is three characters wide. */
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The selected day's disc. A circle on a 1:1 box — the one shape `rounded-full`
 *  is still allowed on. */
const SELECTED_DISC = 34;

export type DateSheetProps = {
  visible: boolean;
  /** The chosen day, or null for an occasion with no date yet. */
  value: Date | null;
  onChange: (date: Date) => void;
  /** Done, the backdrop and hardware back all land here. */
  onClose: () => void;
};

/**
 * When is it? (N-05)
 *
 * Past days are drawn in `ghost` and cannot be picked — "an occasion in the
 * past is not a thing Cinch can plan a look for" — which is also the one place
 * `ghost` is legitimate as text, since WCAG exempts a disabled control.
 *
 * The month row is an ADDITION, marked as such in the spec. The atlas draws a
 * single unlabelled month with no navigation, which cannot reach a date in the
 * month after it; a picker that can only express the next four weeks is not
 * the design being asked for, it is an omission.
 */
export function DateSheet({ visible, value, onChange, onClose }: DateSheetProps) {
  const theme = useTheme();
  const today = startOfDay(new Date());

  const [month, setMonth] = useState(() => startOfDay(value ?? today));

  /**
   * Re-seed the visible month every time the sheet OPENS, and only then —
   * React's own "adjusting state when a prop changes" pattern, the same one
   * `item-edit-sheet.tsx` uses. An effect would paint a frame of the previous
   * month first; keying on `value` would yank the grid back under a user who
   * had paged forward to look around.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setMonth(startOfDay(value ?? today));
  }

  const pick = (date: Date) => {
    setMonth(date);
    onChange(date);
  };

  const atCurrentMonth = isSameMonth(month, today);

  return (
    <SheetShell visible={visible} onRequestClose={onClose} grabber accessibilityLabel="Pick a date">
      <SheetHeader title="When is it?" onDone={onClose} />

      {/* "The three shortcuts above the grid answer most events without a
          calendar at all." Default chip size — these are a texture above the
          grid, not the grid's equals. */}
      <View className="mt-3.5 flex-row gap-2">
        <Chip
          label="Tonight"
          onPress={() => pick(today)}
          accessibilityHint="Sets the date to today"
        />
        <Chip label="This weekend" onPress={() => pick(thisWeekend(today))} />
        <Chip label="Next week" onPress={() => pick(addDays(today, 7))} />
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <MonthStep
          symbol="chevron.left"
          label="Previous month"
          // There is nothing to go back to: every day before today is
          // unpickable, so a reachable past month would be a page of grey.
          disabled={atCurrentMonth}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        />
        <Text variant="colophon">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <MonthStep
          symbol="chevron.right"
          label="Next month"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        />
      </View>

      <View className="mt-3 flex-row gap-1">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={`${letter}${i}`} className="flex-1 items-center">
            <Text variant="noteSmall">{letter}</Text>
          </View>
        ))}
      </View>

      <View className="mt-1.5 gap-1">
        {weeksOf(month).map((week, w) => (
          <View key={w} className="flex-row gap-1">
            {week.map((day, d) => {
              if (!day) return <View key={d} className="flex-1" />;

              const past = day < today;
              const selected = value !== null && isSameDay(day, value);
              const isToday = isSameDay(day, today);

              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={day.toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  accessibilityState={{ disabled: past, selected }}
                  disabled={past}
                  onPress={() => pick(day)}
                  className={`flex-1 items-center justify-center ${past ? '' : 'active:opacity-60'}`}
                  // 44pt drawn rather than borrowed: vertical hitSlop on a grid
                  // this tight would have adjacent days' targets overlapping.
                  style={{ minHeight: MIN_TAP_TARGET }}>
                  {selected ? (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: SELECTED_DISC,
                        height: SELECTED_DISC,
                        backgroundColor: theme.ink,
                      }}>
                      <Text variant="body" style={{ color: theme.canvas }}>
                        {day.getDate()}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      variant="body"
                      // Today used to be marked by weight; TY-01 marks it with
                      // the ACCENT instead, which is a stronger signal at 11 pt
                      // than a half-step of weight ever was. Past days are
                      // `ghost`. Both inline, for the no-two-colour-classes
                      // reason recorded on the Done action above.
                      style={{
                        ...(past ? { color: theme.ghost } : null),
                        ...(isToday ? { color: theme.accent } : null),
                      }}>
                      {day.getDate()}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </SheetShell>
  );
}

/** One month chevron — the `BackButton` grammar, at the same 36pt disc. */
function MonthStep({
  symbol,
  label,
  onPress,
  disabled = false,
}: {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      className={`h-9 w-9 items-center justify-center rounded-full border border-rule ${
        disabled ? 'opacity-30' : 'active:opacity-60'
      }`}>
      <SymbolView name={symbol} size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

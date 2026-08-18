import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  CELL_MIN_HEIGHT,
  CELL_RADIUS,
  CHIP_BORDER,
  CTA_MIN_HEIGHT,
  CTA_RADIUS,
  DOT,
  DOW_INITIALS,
  SHEET_RADIUS,
  WEEK_COPY,
  WEEK_LENGTH,
  dayAnchor,
  isSameDay,
  jumpLabel,
  monthGrid,
  monthTitle,
  shiftMonths,
  startOfMonth,
  weekdayName,
} from '@/features/plan/plan-week-spec';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The month grid — the long jump. Redesign 01, frame 02.
 *
 * Opens from the month label above the strip, and exists for exactly one
 * reason: swiping is the right gesture for "next week" and a terrible one for
 * "the wedding in March". Everything the strip says about a day, this repeats
 * in miniature — planned days filled blush, occasion days dotted in clay,
 * today ringed in oxblood — so the two surfaces cannot disagree about what a
 * day is, and a legend at the foot names all three rather than leaving the
 * reader to infer them from colour alone.
 *
 * The sheet PICKS; it does not navigate on touch. Tapping a day arms the
 * button at the foot ("Jump to 26 September") and the jump happens there. A
 * grid that dismissed on every touch would make a mis-tap a navigation, and
 * the button is also the only place the choice is stated in words.
 */

export type PlanMonthSheetView = {
  visible: boolean;
  /** The month to open on — the one the strip was showing. */
  anchor: Date;
  /** The day the strip has selected, so the sheet opens with it armed. */
  selected: Date;
  today: Date;
  /** `YYYY-MM-DD` keys. The sheet asks about days, not about outfits. */
  plannedKeys: ReadonlySet<string>;
  eventKeys: ReadonlySet<string>;
  onDismiss: () => void;
  onJump: (d: Date) => void;
};

/** Local, because `@/lib/date`'s `dateKey` is the same three fields. */
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function MonthNav({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: SymbolViewProps['name'];
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center active:opacity-70"
      style={{
        width: MIN_TAP_TARGET,
        height: MIN_TAP_TARGET,
        borderRadius: 14,
        backgroundColor: theme.tray,
        flexShrink: 0,
      }}>
      <SymbolView name={glyph} size={16} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 7 }}>
      {swatch}
      <Text variant="caption">{label}</Text>
    </View>
  );
}

/**
 * The sheet's contents, with the browsed month and the armed day.
 *
 * A separate component so its state can be RESET BY KEY rather than by an
 * effect that calls `setState` on open — reopening on a different week must
 * reopen on that week's month, not on wherever the last visit wandered to, and
 * React's own answer to "reset state when a prop changes" is a new key, not a
 * cascading render. `PlanMonthSheet` below supplies that key.
 */
function MonthSheetContents({ view }: { view: PlanMonthSheetView }) {
  const theme = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(view.anchor));
  const [pick, setPick] = useState(() => dayAnchor(view.selected));

  const cells = monthGrid(month);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.scrim }}>
        {/* The scrim dismisses. A sheet with no way out but a gesture is the
            one modal iOS users reliably get stuck in. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={view.onDismiss}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.canvas,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: 12,
            maxHeight: '86%',
          }}>
          <View className="items-center" style={{ flexShrink: 0 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.sand }} />
          </View>

          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 14, gap: 12, flexShrink: 0 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="plate" trim numberOfLines={1} accessibilityRole="header">
                {monthTitle(month)}
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 8, flexShrink: 0 }}>
              <MonthNav
                label={WEEK_COPY.monthPrev}
                glyph="chevron.left"
                onPress={() => setMonth((m) => shiftMonths(m, -1))}
              />
              <MonthNav
                label={WEEK_COPY.monthNext}
                glyph="chevron.right"
                onPress={() => setMonth((m) => shiftMonths(m, 1))}
              />
            </View>
          </View>

          {/* Seven columns as sevenths with a 3pt inset each side, rather than
              a gap property — it keeps the columns exactly even at any width,
              which a wrapped row with `gap` does not. */}
          <View className="flex-row flex-wrap" style={{ paddingHorizontal: GUTTER - 4, flexShrink: 0 }}>
            {DOW_INITIALS.map((d, i) => (
              <View key={`${d}${i}`} style={{ width: `${100 / WEEK_LENGTH}%`, paddingHorizontal: 3 }}>
                <Text variant="caption" style={{ textAlign: 'center', paddingBottom: 4 }}>
                  {d}
                </Text>
              </View>
            ))}

            {cells.map((date, i) => {
              if (!date) {
                return (
                  <View
                    key={`blank-${i}`}
                    style={{ width: `${100 / WEEK_LENGTH}%`, paddingHorizontal: 3, paddingVertical: 3 }}>
                    <View style={{ minHeight: CELL_MIN_HEIGHT }} />
                  </View>
                );
              }

              const k = key(date);
              const planned = view.plannedKeys.has(k);
              const hasEvent = view.eventKeys.has(k);
              const today = isSameDay(date, view.today);
              const picked = isSameDay(date, pick);

              return (
                <View
                  key={k}
                  style={{ width: `${100 / WEEK_LENGTH}%`, paddingHorizontal: 3, paddingVertical: 3 }}>
                  <Pressable
                    onPress={() => setPick(date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked }}
                    accessibilityLabel={[
                      `${weekdayName(date)} ${date.getDate()}`,
                      today ? WEEK_COPY.legendToday : null,
                      planned ? WEEK_COPY.legendPlanned : null,
                      hasEvent ? WEEK_COPY.legendEvent : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    className="items-center justify-center active:opacity-70"
                    style={{
                      minHeight: CELL_MIN_HEIGHT,
                      gap: 3,
                      paddingVertical: 6,
                      borderRadius: CELL_RADIUS,
                      borderWidth: picked || today ? 2 : CHIP_BORDER,
                      borderColor: picked || today ? theme.accent : planned ? theme.blushRule : theme.tray,
                      backgroundColor: planned ? theme.blush : theme.canvas,
                    }}>
                    <Text variant="callout" style={{ color: today ? theme.accent : theme.ink }}>
                      {String(date.getDate())}
                    </Text>
                    <View
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: DOT / 2,
                        backgroundColor: hasEvent ? theme.accentWarm : 'transparent',
                      }}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 10, gap: 12 }}>
            <View className="flex-row flex-wrap" style={{ gap: 18 }}>
              <Legend
                label={WEEK_COPY.legendPlanned}
                swatch={
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      backgroundColor: theme.blush,
                      borderWidth: CHIP_BORDER,
                      borderColor: theme.blushRule,
                    }}
                  />
                }
              />
              <Legend
                label={WEEK_COPY.legendEvent}
                swatch={
                  <View
                    style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.accentWarm }}
                  />
                }
              />
              <Legend
                label={WEEK_COPY.legendToday}
                swatch={
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      borderWidth: CHIP_BORDER,
                      borderColor: theme.accent,
                    }}
                  />
                }
              />
            </View>

            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={WEEK_COPY.jump(jumpLabel(pick))}
              onPress={() => view.onJump(pick)}
              style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.accent }}
              contentStyle={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: CTA_MIN_HEIGHT,
                paddingHorizontal: 20,
                paddingVertical: 14,
              }}>
              <Text variant="body" numberOfLines={2} style={{ color: theme.canvas, textAlign: 'center' }}>
                {WEEK_COPY.jump(jumpLabel(pick))}
              </Text>
            </PressableSurface>
          </View>
      </SafeAreaView>
    </View>
  );
}

export function PlanMonthSheet({ view }: { view: PlanMonthSheetView }) {
  return (
    <Modal visible={view.visible} transparent animationType="slide" onRequestClose={view.onDismiss}>
      {/* The key is the reset. Opening the sheet on a different week mounts a
          fresh contents with that week's month and day already armed. */}
      <MonthSheetContents key={`${view.anchor.getTime()}:${view.selected.getTime()}`} view={view} />
    </Modal>
  );
}

import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  CARD_RADIUS,
  CHIP_BORDER,
  CHIP_GAP,
  CHIP_RADIUS,
  CHIP_THUMB_HEIGHT,
  CHIP_THUMB_WIDTH,
  CTA_MIN_HEIGHT,
  CTA_RADIUS,
  CTA_SECONDARY_MIN_HEIGHT,
  DOT,
  PLATE_GAP,
  PLATE_ROW,
  PLATE_ROW_AX,
  WEEK_COPY,
  WEEK_LENGTH,
  chipState,
  chipTemp,
  dayHeading,
  dayHeadingAx,
  dayWeatherLine,
  dowInitial,
  dowShort,
  isSameDay,
  monthLabel,
  visibleDays,
  weatherNudge,
  weekdayName,
  type ChipState,
} from '@/features/plan/plan-week-spec';
import { haptics } from '@/lib/haptics';
import type { WeatherContext } from '@/lib/styling';
import { GUTTER, MIN_TAP_TARGET, canvasAlpha, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Plan — the week. The drawn surface. Redesign 01.
 *
 * Split from the route for the reason every other rebuilt page in this repo is:
 * a screen that reaches for `usePlannedWeek` and a forecast at the top cannot
 * be POSED, and a state nobody can open is a state nobody checks. Everything
 * here is a function of the `view` object, so `dev-pw-01…06` draw the six
 * accepted frames out of `plan-week-fixtures.ts` without a session, a network,
 * or a single row on the other end.
 *
 * ── WHAT THE FRAMES ASK FOR ───────────────────────────────────────────────
 *
 * A calendar STRIP, not a list of seven cards. Seven chips across the top,
 * today ringed in oxblood, the selected day filled with it; days already
 * planned carry a thumbnail of what is planned, days with an occasion carry a
 * clay dot, and the weather is a MARK under each chip — "16°" — rather than a
 * sentence anybody has to read. Below it the selected day's plan as one large
 * image-led plate, then the occasion, then the actions.
 *
 * The strip swipes BETWEEN WEEKS, freely, in both directions, and the month
 * label above it follows what the strip is showing. That gesture has no visible
 * affordance, so it also has an `adjustable` role and increment/decrement
 * actions — a swipe nobody can discover is a swipe VoiceOver cannot perform.
 *
 * ── THE PAGER, AND WHY IT IS THREE PAGES ──────────────────────────────────
 *
 * A horizontal `ScrollView` with `pagingEnabled`, holding exactly three pages:
 * the week before, the week shown, the week after. On settle, a page that is
 * not the middle one reports a week change and the strip re-centres without
 * animation, so the reader can keep swiping in one direction forever and the
 * view never has to hold more than twenty-one days.
 *
 * Three pages rather than two is what makes BOTH directions equal, which the
 * brief asks for in as many words — past and future are the same gesture with
 * opposite signs, and neither is a special case in this file.
 *
 * Nothing new was installed for it. `react-native-gesture-handler` and
 * `reanimated` are both already here and both would work; a paging ScrollView
 * is the one that needs no gesture arbitration against the vertical scroll it
 * sits inside, which is the actual difficulty.
 *
 * ── LARGE TYPE ────────────────────────────────────────────────────────────
 *
 * `large` is the accepted AX frame, not a shrunken version of the standard one.
 * The month label becomes a full-width row above the strip; the strip shows
 * THREE chips instead of seven and spells their weekdays out; the chips shed
 * their thumbnail and their weather mark, and the weather joins the day heading
 * instead; the plate takes one short row; and the action pins to the bottom.
 * Nothing is capped, truncated or scaled below its documented size — height is
 * allowed to grow and the page scrolls.
 */

export type PlanWeekDayView = {
  date: Date;
  /** Null wherever the forecast does not reach — see `chipTemp`. */
  weather: WeatherContext | null;
  /** A committed plan exists for this day: blush ground, and a thumbnail. */
  planned: boolean;
  /** The planned outfit's photograph, when there is one to show. */
  thumbUri?: string;
  /** A Cinch occasion falls on this day. */
  hasEvent: boolean;
};

/**
 * What the plate is doing. Four states, and the strip above it stays live in
 * every one of them — the frames are explicit that only the PLATE reports.
 */
export type PlanWeekPlate =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'ready'; tiles: { uri?: string }[]; label: string | null };

export type PlanWeekView = {
  /**
   * Twenty-one days — the week before, the week shown, the week after.
   *
   * One window rather than three fetches: the route asks the SAME queries for a
   * wider date range, so a swipe lands on chips that already carry their
   * thumbnails and their dots instead of populating a beat later.
   */
  days: PlanWeekDayView[];
  /** Where the shown week starts inside `days`. `WEEK_LENGTH` in practice. */
  weekOffset: number;
  selected: Date;
  today: Date;
  plate: PlanWeekPlate;
  occasion: { title: string; line: string | null } | null;
  /**
   * The primary action's words, from `primaryAction` in the spec — "Log this
   * wear" on a day that has happened, "Keep this plan" on one that has not.
   * See that function for why the frame's single label could not be wired
   * literally.
   */
  primaryLabel: string;
  onSelectDay: (d: Date) => void;
  onWeek: (delta: -1 | 1) => void;
  onOpenMonth: () => void;
  onLogWear: () => void;
  onSwap: () => void;
  onPlanDay: () => void;
  onRetry: () => void;
  onOpenCloset: () => void;
};

// ---------------------------------------------------------------------------
// The chip
// ---------------------------------------------------------------------------

type ChipTone = {
  ground: string;
  border: string;
  figure: string;
  quiet: string;
  well: string;
  dot: string;
};

/**
 * The four chip tones, derived rather than eyedropped.
 *
 * The artifact paints eight hexes across these four states and every one of
 * them is a palette token or a token at an alpha — the selected chip's lighter
 * well is canvas at 18% over the oxblood ground, and its weekday letter is
 * canvas at 70%, which is the `canvasAlpha` step the token's own doc names for
 * secondary copy on a dark ground. Typing the artifact's `#8C4A45` instead
 * would be invisible until the accent moved.
 */
function toneFor(state: ChipState, theme: ReturnType<typeof useTheme>): ChipTone {
  switch (state) {
    case 'selected':
      return {
        ground: theme.accent,
        border: theme.accent,
        figure: theme.canvas,
        quiet: canvasAlpha(0.7),
        well: canvasAlpha(0.18),
        dot: theme.canvas,
      };
    case 'today':
      return {
        ground: theme.canvas,
        border: theme.accent,
        figure: theme.accent,
        quiet: theme.accent,
        well: theme.sand,
        dot: theme.accentWarm,
      };
    case 'planned':
      return {
        ground: theme.blush,
        border: theme.blushRule,
        figure: theme.ink,
        quiet: theme.muted,
        well: theme.sand,
        dot: theme.accentWarm,
      };
    default:
      return {
        ground: theme.canvas,
        border: theme.tray,
        figure: theme.ink,
        quiet: theme.muted,
        well: theme.tray,
        dot: 'transparent',
      };
  }
}

function DayChip({
  day,
  state,
  large,
  onPress,
}: {
  day: PlanWeekDayView;
  state: ChipState;
  large: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tone = toneFor(state, theme);
  const temp = chipTemp(day.weather);

  // The whole chip is the target and it already clears 44 in both axes at the
  // seven-across width; the floor is stated anyway so a narrower device or a
  // future eighth chip cannot quietly drop under it.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: state === 'selected' }}
      accessibilityLabel={[
        `${weekdayName(day.date)} ${day.date.getDate()}`,
        state === 'today' ? WEEK_COPY.legendToday : null,
        day.planned ? WEEK_COPY.legendPlanned : null,
        day.hasEvent ? WEEK_COPY.legendEvent : null,
        temp,
      ]
        .filter(Boolean)
        .join(', ')}
      className="items-center active:opacity-70"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: MIN_TAP_TARGET,
        borderRadius: CHIP_RADIUS,
        borderWidth: CHIP_BORDER,
        borderColor: tone.border,
        backgroundColor: tone.ground,
        paddingTop: large ? 12 : 9,
        paddingBottom: large ? 14 : 8,
        paddingHorizontal: large ? 10 : 0,
        gap: large ? 6 : 5,
      }}>
      <Text
        variant={large ? 'callout' : 'caption'}
        numberOfLines={1}
        style={{ color: tone.quiet, letterSpacing: large ? 0 : 0.7 }}>
        {large ? dowShort(day.date) : dowInitial(day.date)}
      </Text>
      <Text variant={large ? 'heading' : 'callout'} style={{ color: tone.figure }}>
        {String(day.date.getDate())}
      </Text>

      {/* At the accessibility sizes the well and the weather mark are GONE —
          the frame's own answer. Three chips carrying a spelled weekday and a
          number is more legible than three carrying a picture too, and the
          weather moves up into the day heading rather than being dropped. */}
      {large ? (
        <View
          style={{
            width: DOT + 1,
            height: DOT + 1,
            borderRadius: (DOT + 1) / 2,
            backgroundColor: day.hasEvent ? tone.dot : 'transparent',
            flexShrink: 0,
          }}
        />
      ) : (
        <>
          <View
            style={{
              width: CHIP_THUMB_WIDTH,
              height: CHIP_THUMB_HEIGHT,
              borderRadius: 8,
              backgroundColor: tone.well,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 3,
              flexShrink: 0,
            }}>
            {day.planned && day.thumbUri ? (
              <GarmentImage
                uri={day.thumbUri}
                contentFit="cover"
                transition={120}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                fallback={<View />}
              />
            ) : null}
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                backgroundColor: day.hasEvent ? tone.dot : 'transparent',
              }}
            />
          </View>
          {/* The mark, not a sentence — and absent rather than estimated
              wherever the forecast does not reach. */}
          <Text variant="caption" numberOfLines={1} style={{ color: tone.quiet, fontSize: 10 }}>
            {temp ?? ' '}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The strip
// ---------------------------------------------------------------------------

function WeekStrip({ view, large }: { view: PlanWeekView; large: boolean }) {
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollView>(null);

  // Three pages of seven, cut straight out of the twenty-one-day window.
  const pages = [0, 1, 2].map((p) => view.days.slice(p * WEEK_LENGTH, (p + 1) * WEEK_LENGTH));

  // The middle page's first day identifies the week on screen. When the route
  // moves the anchor, the strip snaps back to the centre with no animation —
  // the reader's finger has already carried the motion, and animating a second
  // one under it reads as a bounce.
  const anchor = view.days[view.weekOffset]?.date.getTime() ?? 0;

  useEffect(() => {
    if (width > 0) scroller.current?.scrollTo({ x: width, animated: false });
  }, [anchor, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page === 1) return;
    // The tick fires on the WEEK CHANGE and nowhere else — `selection()`
    // grade, which is the intent iOS itself reserves for a value changing
    // under the finger. Selecting a day inside the week is a tap with a
    // visible result and gets none.
    haptics.selection();
    view.onWeek(page === 0 ? -1 : 1);
  };

  const selectedIndex = pages[1]!.findIndex((d) => isSameDay(d.date, view.selected));

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={`${WEEK_COPY.stripLabel} ${monthLabel(view.days[view.weekOffset]!.date)}`}
      accessibilityActions={[
        { name: 'increment', label: WEEK_COPY.nextWeek },
        { name: 'decrement', label: WEEK_COPY.prevWeek },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') {
          haptics.selection();
          view.onWeek(1);
        } else if (e.nativeEvent.actionName === 'decrement') {
          haptics.selection();
          view.onWeek(-1);
        }
      }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
        // The strip owns the horizontal axis; the page owns the vertical one.
        directionalLockEnabled>
        {pages.map((page, i) => (
          <View
            key={page[0]?.date.getTime() ?? i}
            style={{
              width: width || undefined,
              flexDirection: 'row',
              gap: large ? 8 : CHIP_GAP,
              paddingHorizontal: GUTTER - 6,
            }}>
            {visibleDays(page, i === 1 ? Math.max(0, selectedIndex) : 3, large).map((day) => (
              <DayChip
                key={day.date.getTime()}
                day={day}
                large={large}
                state={chipState({
                  date: day.date,
                  selected: view.selected,
                  today: view.today,
                  planned: day.planned,
                })}
                onPress={() => view.onSelectDay(day.date)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/**
 * The image-led plate — two thirds beside a stacked third, edge to edge.
 *
 * Drawn as a row of two columns rather than a grid, because the left tile spans
 * both rows and RN has no `grid-row: span 2`. The sand shows through as the
 * 3pt gaps, which is why the ground is painted once on the container instead of
 * a border on each tile.
 */
function Plate({ tiles, label, large }: { tiles: { uri?: string }[]; label: string | null; large: boolean }) {
  const theme = useTheme();
  const row = large ? PLATE_ROW_AX : PLATE_ROW;
  const height = large ? row : row * 2 + PLATE_GAP;

  const well = (uri: string | undefined, ground: string, style?: object) => (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: ground, overflow: 'hidden', ...style }}>
      <GarmentImage
        uri={uri}
        contentFit="cover"
        transition={140}
        style={{ width: '100%', height: '100%' }}
        fallback={<View />}
      />
    </View>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: PLATE_GAP,
        height,
        backgroundColor: theme.sand,
        flexShrink: 0,
      }}>
      <View style={{ flex: 2, minWidth: 0, backgroundColor: theme.sand, justifyContent: 'flex-end' }}>
        {well(tiles[0]?.uri, theme.sand, { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 })}
        {/* The garment's name, on the photograph. `colophon` already sets the
            tracked caps and the `muted` the contrast pass moved it to — the
            artifact's #8B8375 is not a token and would fail as type anyway. */}
        {label && !large ? (
          <Text variant="colophon" numberOfLines={1} style={{ margin: 12 }}>
            {label}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: PLATE_GAP }}>
        {well(tiles[1]?.uri, theme.tray)}
        {large ? null : well(tiles[2]?.uri, theme.sand)}
      </View>
    </View>
  );
}

/** The empty plate — the garments it COULD hold, drawn as outlines. */
function EmptyPlate({ large }: { large: boolean }) {
  const theme = useTheme();
  const row = large ? PLATE_ROW_AX : 112;
  const outline = {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.canvas,
    borderWidth: 1.5,
    borderColor: theme.sand,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const mark = (w: number, h: number, radius: number) => (
    <View
      style={{ width: w, height: h, borderRadius: radius, borderWidth: 1.5, borderColor: theme.sand }}
    />
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: PLATE_GAP,
        height: large ? row : row * 2 + PLATE_GAP,
        backgroundColor: theme.tray,
        flexShrink: 0,
      }}>
      <View style={{ ...outline, flex: 2 }}>{mark(52, 74, 8)}</View>
      <View style={{ flex: 1, minWidth: 0, gap: PLATE_GAP }}>
        <View style={outline}>{mark(40, 40, 20)}</View>
        {large ? null : <View style={outline}>{mark(46, 30, 6)}</View>}
      </View>
    </View>
  );
}

/** The plate's own wait. The strip above it is live and swipeable throughout. */
function PlateSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: PLATE_GAP,
        height: PLATE_ROW * 2 + PLATE_GAP,
        backgroundColor: theme.tray,
        flexShrink: 0,
      }}>
      <Skeleton className="flex-1" style={{ minWidth: 0 }} />
      <View style={{ flex: 1, minWidth: 0, gap: PLATE_GAP }}>
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </View>
    </View>
  );
}

/**
 * The plate's failure, in the frame's amber band.
 *
 * `warning` is a FILL and the contrast record says INK goes on it, so the band
 * is the token at an alpha and every word on it is `ink`. The artifact's
 * #4A3208 title and #7A5312 badge label are neither palette tokens nor legal
 * as type under `theme/contrast.ts`; ink is darker than both and passes.
 */
function PlateError({ onRetry, onOpenCloset }: { onRetry: () => void; onOpenCloset: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: warningAlpha(0.22),
        paddingHorizontal: 24,
        paddingVertical: 28,
        gap: 12,
        flexShrink: 0,
      }}>
      <View
        className="flex-row items-center self-start"
        style={{
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 9,
          backgroundColor: warningAlpha(0.38),
        }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.warning, flexShrink: 0 }}
        />
        <Text variant="eyebrow" style={{ color: theme.ink }}>
          {WEEK_COPY.errorKicker}
        </Text>
      </View>
      <Text variant="plate" trim>
        {WEEK_COPY.errorTitle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Action label={WEEK_COPY.errorRetry} onPress={onRetry} tone="accent" />
        <Action label={WEEK_COPY.errorEscape} onPress={onOpenCloset} tone="sand" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

function Action({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: 'accent' | 'blush' | 'sand';
}) {
  const theme = useTheme();
  const ground = tone === 'accent' ? theme.accent : tone === 'blush' ? theme.blush : theme.sand;
  const type = tone === 'accent' ? theme.canvas : tone === 'blush' ? theme.accent : theme.ink;

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, borderRadius: CTA_RADIUS, backgroundColor: ground }}
      contentStyle={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: tone === 'accent' ? CTA_MIN_HEIGHT : CTA_SECONDARY_MIN_HEIGHT,
        paddingHorizontal: 20,
        paddingVertical: 14,
      }}>
      <Text variant="body" numberOfLines={2} style={{ color: type, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function PlanWeekBody({ view, large = false }: { view: PlanWeekView; large?: boolean }) {
  const theme = useTheme();
  const selectedDay = view.days.find((d) => isSameDay(d.date, view.selected));
  const weather = selectedDay?.weather ?? null;
  const month = monthLabel(view.days[view.weekOffset]!.date);

  const heading = large ? dayHeadingAx(view.selected, weather) : dayHeading(view.selected);
  const weatherLine = dayWeatherLine(weather);

  return (
    <View className="flex-1 bg-canvas">
      {/* ── Masthead ──────────────────────────────────────────────────────
          At standard size the title and the month pill share a baseline row;
          at the accessibility sizes the pill drops to its own full-width row
          rather than either half truncating. */}
      <View
        style={{
          paddingHorizontal: GUTTER,
          paddingTop: 4,
          paddingBottom: large ? 14 : 12,
          flexDirection: large ? 'column' : 'row',
          alignItems: large ? 'stretch' : 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}>
        <View style={{ flex: large ? undefined : 1, minWidth: 0 }}>
          <Text variant="display" trim accessibilityRole="header">
            {WEEK_COPY.title}
          </Text>
        </View>
        <Pressable
          onPress={view.onOpenMonth}
          accessibilityRole="button"
          accessibilityLabel={`${month}. ${WEEK_COPY.monthSheetLabel}`}
          className="flex-row items-center active:opacity-70"
          style={{
            flexShrink: 0,
            gap: 8,
            minHeight: large ? 60 : MIN_TAP_TARGET,
            paddingHorizontal: large ? 18 : 14,
            paddingVertical: 11,
            borderRadius: large ? 16 : 14,
            backgroundColor: theme.tray,
            justifyContent: large ? 'space-between' : 'center',
          }}>
          <Text variant={large ? 'heading' : 'callout'} numberOfLines={1} style={{ minWidth: 0, flexShrink: 1 }}>
            {month}
          </Text>
          <SymbolView
            name="chevron.down"
            size={large ? 15 : 12}
            tintColor={theme.accent}
            resizeMode="scaleAspectFit"
            style={{ width: large ? 15 : 12, height: large ? 15 : 12, flexShrink: 0 }}
          />
        </Pressable>
      </View>

      <WeekStrip view={view} large={large} />

      {/* ── The day, and its weather ──────────────────────────────────────
          At the accessibility sizes the two become one line (`dayHeadingAx`),
          which is a composition change rather than a truncation: the figure
          survives, the condition word is what goes. */}
      <View
        style={{
          paddingHorizontal: GUTTER,
          paddingTop: 10,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          flexShrink: 0,
        }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="plate" trim numberOfLines={large ? undefined : 1}>
            {heading}
          </Text>
        </View>
        {!large && view.plate.kind === 'loading' ? (
          <Skeleton style={{ width: 78, height: 13, borderRadius: 7, flexShrink: 0 }} />
        ) : !large && weatherLine ? (
          <Text variant="label" numberOfLines={1} style={{ flexShrink: 0 }}>
            {weatherLine}
          </Text>
        ) : null}
      </View>

      {/* ── The plate ─────────────────────────────────────────────────────
          Edge to edge, deliberately: it is the one full-bleed element on the
          page and the frames set it against the gutter on both sides. */}
      {view.plate.kind === 'loading' ? (
        <PlateSkeleton />
      ) : view.plate.kind === 'error' ? (
        <PlateError onRetry={view.onRetry} onOpenCloset={view.onOpenCloset} />
      ) : view.plate.kind === 'empty' ? (
        <EmptyPlate large={large} />
      ) : (
        <Plate tiles={view.plate.tiles} label={view.plate.label} large={large} />
      )}

      {/* ── Below the plate ───────────────────────────────────────────────*/}
      <View style={{ flex: 1, minHeight: 0 }}>
        {view.plate.kind === 'loading' ? (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, gap: 12 }}>
            <Skeleton style={{ height: 15, borderRadius: 8, width: '74%' }} />
            <Skeleton style={{ height: 13, borderRadius: 7, width: '46%' }} />
          </View>
        ) : view.plate.kind === 'empty' ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 10 }}>
            <Text variant="title" trim>
              {WEEK_COPY.emptyTitle(weekdayName(view.selected))}
            </Text>
            {/* Present only when the forecast actually holds a reason. See
                `weatherNudge` — a mild dry day has nothing to say. */}
            {weatherNudge(weather) ? (
              <Text variant="body" className="text-muted" style={{ maxWidth: 300 }}>
                {weatherNudge(weather)}
              </Text>
            ) : null}
          </View>
        ) : view.occasion ? (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 14 }}>
            <View
              className="flex-row"
              style={{
                gap: 12,
                alignItems: large ? 'flex-start' : 'center',
                backgroundColor: theme.blush,
                borderRadius: large ? 18 : CARD_RADIUS,
                paddingHorizontal: large ? 18 : 16,
                paddingVertical: large ? 16 : 14,
                minHeight: MIN_TAP_TARGET,
              }}>
              {large ? null : (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.accentWarm,
                    flexShrink: 0,
                  }}
                />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: large ? 6 : 2 }}>
                {/* At the accessibility sizes the frame leads with the TIME as
                    a tracked eyebrow and lets the title wrap. The artifact
                    paints that eyebrow in clay; clay is `text: false` in
                    theme/contrast.ts (2.98:1), so it is set in `muted`. */}
                {large && view.occasion.line ? (
                  <Text variant="eyebrow">{view.occasion.line}</Text>
                ) : null}
                <Text
                  variant={large ? 'heading' : 'callout'}
                  numberOfLines={large ? undefined : 1}>
                  {view.occasion.title}
                </Text>
                {!large && view.occasion.line ? (
                  <Text variant="label" numberOfLines={1}>
                    {view.occasion.line}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* ── The actions ───────────────────────────────────────────────────
          Pinned to the foot in every frame. One oxblood ground per state — the
          constitution's accent budget — with the second action in blush on a
          planned day and in sand on the failure, where blush would read as a
          second primary. */}
      <View
        style={{
          paddingHorizontal: GUTTER,
          paddingTop: 14,
          paddingBottom: large ? 22 : 0,
          gap: 10,
          flexShrink: 0,
          borderTopWidth: large ? 1 : 0,
          borderTopColor: theme.tray,
        }}>
        {view.plate.kind === 'empty' ? (
          <Action
            label={WEEK_COPY.emptyAction(weekdayName(view.selected))}
            onPress={view.onPlanDay}
            tone="accent"
          />
        ) : view.plate.kind === 'error' ? null : (
          <>
            <Action label={view.primaryLabel} onPress={view.onLogWear} tone="accent" />
            {large ? null : <Action label={WEEK_COPY.swapPlate} onPress={view.onSwap} tone="blush" />}
          </>
        )}
      </View>
    </View>
  );
}

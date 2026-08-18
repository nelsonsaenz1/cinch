import type { PlanWeekDayView, PlanWeekView } from '@/components/plan/plan-week-body';
import type { PlanMonthSheetView } from '@/components/plan/plan-month-sheet';
import type { WeatherContext } from '@/lib/styling';

import { WEEK_COPY, WEEK_LENGTH, addDays, startOfWeek } from './plan-week-spec';

/**
 * The six accepted frames, posed inert. Redesign 01.
 *
 * Every callback is a no-op, so these routes cannot plan a day, log a wear or
 * write a calendar row however hard they are tapped. That seam is what lets the
 * frames be walked and photographed against the artifact without a session, a
 * network, or a forecast.
 *
 * ── WHY THE DATES ARE FROZEN ──────────────────────────────────────────────
 *
 * The artifact draws September 2026 with today on Tuesday the 8th and Saturday
 * the 12th selected. A fixture built from `new Date()` would draw a different
 * week every morning and could not be compared to the PNG at all — so the
 * anchor is a literal, and it is the ONLY place in this slice where one
 * appears. The route's own dates all come from the clock.
 */

/** Tuesday 8 September 2026, at the local-noon anchor the spec works in. */
const TODAY = new Date(2026, 8, 8, 12, 0, 0, 0);
const SELECTED = new Date(2026, 8, 12, 12, 0, 0, 0);

const weather = (feelsLikeC: number, over: Partial<WeatherContext> = {}): WeatherContext => ({
  feelsLikeC,
  highC: feelsLikeC + 3,
  lowC: feelsLikeC - 3,
  precipitationChance: 0,
  windKph: 6,
  swing: false,
  ...over,
});

/**
 * Twenty-one days, the middle seven of which are the artifact's week.
 *
 * The flanking weeks carry plainer days on purpose: they are only ever seen
 * mid-swipe, and dressing them to match would make the fixture look like it
 * had more data than the frame states.
 */
function window(over: Partial<Record<number, Partial<PlanWeekDayView>>> = {}): PlanWeekDayView[] {
  const start = addDays(startOfWeek(TODAY), -WEEK_LENGTH);
  const temps = [15, 16, 17, 18, 17, 16, 15, 17, 16, 19, 18, 18, 18, 15, 16, 14, 15, 17, 18, 19, 18];

  return Array.from({ length: WEEK_LENGTH * 3 }, (_, i) => ({
    date: addDays(start, i),
    weather: weather(temps[i] ?? 17),
    planned: false,
    hasEvent: false,
    ...(over[i] ?? {}),
  }));
}

/** The artifact's default week: Monday and Thursday planned, Saturday's dinner. */
const DEFAULT_DAYS = window({
  7: { planned: true },
  8: { hasEvent: true },
  10: { planned: true },
  12: { hasEvent: true },
});

const IDLE: PlanWeekView = {
  days: DEFAULT_DAYS,
  weekOffset: WEEK_LENGTH,
  selected: SELECTED,
  today: TODAY,
  plate: { kind: 'ready', tiles: [{}, {}, {}], label: 'Silk slip dress' },
  occasion: { title: 'Alexandria’s birthday dinner at Contramar', line: '8:30 pm · 4 friends going' },
  // The frames' Saturday is four days ahead of their Tuesday, so the honest
  // verb there is "Keep this plan" — see `primaryAction` in the spec.
  primaryLabel: WEEK_COPY.keepPlan,
  onSelectDay: () => {},
  onWeek: () => {},
  onOpenMonth: () => {},
  onLogWear: () => {},
  onSwap: () => {},
  onPlanDay: () => {},
  onRetry: () => {},
  onOpenCloset: () => {},
};

const pose = (over: Partial<PlanWeekView>): PlanWeekView => ({ ...IDLE, ...over });

/** Tuesday 15 September — the empty frame's selection, under showers. */
const EMPTY_SELECTED = new Date(2026, 8, 15, 12, 0, 0, 0);

export const PLAN_WEEK_POSES = {
  /** 01 — a planned Saturday with an occasion on it. */
  '01-default': pose({}),

  /** 03 — nothing planned for the selected day; the plate draws the slots. */
  '03-empty': pose({
    days: window({
      14: { planned: true },
      15: { weather: weather(14, { precipitationChance: 0.6 }) },
      18: { planned: true },
    }).map((d) => (d.date.getDate() === 15 ? { ...d, planned: false } : d)),
    selected: EMPTY_SELECTED,
    plate: { kind: 'empty' },
    occasion: null,
  }),

  /** 04 — the plate building. The strip above it is live throughout. */
  '04-loading': pose({ plate: { kind: 'loading' }, occasion: null }),

  /** 05 — the plate could not be read. The strip and the occasion stay usable. */
  '05-error': pose({ plate: { kind: 'error' } }),

  /** 06 — largest accessibility text. Same view; the body recomposes. */
  '06-ax': pose({}),
} as const;

export type PlanWeekPose = keyof typeof PLAN_WEEK_POSES;

/** 02 — the month grid, opened on the artifact's September. */
export const PLAN_MONTH_POSE: PlanMonthSheetView = {
  visible: true,
  anchor: TODAY,
  selected: new Date(2026, 8, 26, 12, 0, 0, 0),
  today: TODAY,
  plannedKeys: new Set(
    [2, 5, 9, 11, 12, 19, 23, 26].map((n) => `2026-09-${String(n).padStart(2, '0')}`),
  ),
  eventKeys: new Set([12, 26].map((n) => `2026-09-${String(n).padStart(2, '0')}`)),
  onDismiss: () => {},
  onJump: () => {},
};

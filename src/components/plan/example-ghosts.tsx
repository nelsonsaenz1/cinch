import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The Plan atlas's example-content sections — P-03's "Example week", P-07's
 * "Example plans", P-10's "Example trips".
 *
 * Each empty state teaches by showing the shape the surface wants to take:
 * a ruled-off section of ghost rows in the REAL layout's geometry, set in the
 * `ghost` voice (tailwind.config.js) so it reads as furniture, not data. Same
 * argument as the closet's GhostSlotGrid, and the same discipline — every
 * section here is decorative: hidden from VoiceOver and from touch entirely,
 * because announcing "Thu, example" to a screen reader would be the app
 * narrating its own wallpaper.
 *
 * The week and plans sections sit under the empty state's copy and run to the
 * bottom of the screen behind a canvas fade (P-03 draws 120pt, P-07 110pt) —
 * the content trails off rather than stopping, which is the visual claim that
 * there would be more if the closet had pieces in it. Skia, same reasoning as
 * GhostSlotGrid: it is already in the bundle, and expo-linear-gradient would
 * be a dependency for one rectangle. The trips section lives INSIDE the
 * membership plate, above its one action, so it gets no fade — a gradient
 * inside a card would read as the card failing to load.
 */

/*
 * WAVE 3 · GROUP 4 — the faint-text debt on this file is CLEARED.
 *
 * The three section eyebrows ("Example week", "Example plans", "Example
 * trips") were set in `text-faint`, which is #8A8578 and 3.52:1 on canvas — an
 * AA failure, and the constitution's flattest rule: NEVER #8A8578 as text. They
 * now take the `eyebrow` variant's own `muted`, which is one step darker at
 * 5.46:1 and not a new voice — tracking, casing and size are unchanged, so the
 * quiet layer stays the quiet layer.
 *
 * The GHOST FURNITURE below them keeps `text-ghost` and `bg-tray`, and that is
 * not the same violation: those bars and labels are not text the reader is
 * being asked to read. They are decorative, the whole section is
 * `pointerEvents="none"` and hidden from VoiceOver, and `ghost` exists for
 * exactly this. The label naming the section is real text; the wallpaper under
 * it is not.
 *
 * `tests/constitution.test.ts` holds a `FAINT_TEXT_DEBT` list with this file on
 * it, and a second test that fails when an entry becomes stale. This file is
 * now stale on that list and its line should be deleted — by the integrator,
 * who owns that test.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The bottom-of-section canvas fade the atlas draws over trailing ghosts. */
function GhostFade({ height }: { height: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}>
      {width > 0 ? (
        <Canvas style={{ width, height }}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={[withAlpha(theme.canvas, 0), theme.canvas]}
            />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}

/** Decorative wrapper: rule on top, invisible to touch and VoiceOver. */
function ExampleSection({ children }: { children: React.ReactNode }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-1 overflow-hidden border-t border-rule">
      {children}
    </View>
  );
}

/** P-03's ghost day rows — bar widths transcribed from the atlas. */
const WEEK_ROWS: { day: string; bar: number }[] = [
  { day: 'Thu', bar: 170 },
  { day: 'Fri', bar: 200 },
  { day: 'Sat', bar: 150 },
  { day: 'Sun', bar: 186 },
  { day: 'Mon', bar: 164 },
];

/**
 * P-03 — under the empty closet's plate. Five ghost day rows in DayRow's own
 * geometry: the 42pt day slot, the swatch trio, the outfit line's bar.
 */
export function ExampleWeek() {
  return (
    <ExampleSection>
      <View className="px-gutter pb-1 pt-4">
        <Text variant="eyebrow">
          Example week
        </Text>
      </View>
      {WEEK_ROWS.map(({ day, bar }) => (
        <View
          key={day}
          className="flex-row items-center border-b border-hairline px-gutter"
          style={{ gap: 14, paddingVertical: 18 }}>
          <View style={{ width: 42 }}>
            <Text variant="callout" className="font-semibold text-ghost">
              {day}
            </Text>
          </View>
          <View className="flex-row" style={{ gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="rounded-sm border border-hairline bg-tray"
                style={{ width: 16, height: 16 }}
              />
            ))}
          </View>
          <View
            className="flex-1 rounded-sm bg-tray"
            style={{ height: 12, maxWidth: bar }}
          />
        </View>
      ))}
      <GhostFade height={120} />
    </ExampleSection>
  );
}

/** P-07's ghost cards — placeholder date, title bar, attendee circles. */
const PLAN_CARDS: { date: string; bar: number; going: number }[] = [
  { date: 'Friday · 7pm', bar: 180, going: 3 },
  { date: 'Sat 23 Aug', bar: 214, going: 2 },
];

/**
 * P-07 — under "Nothing planned together yet". Two ghost event cards in
 * EventCard's plate geometry, with the attendee circles the real card earns
 * once people RSVP.
 */
export function ExamplePlans() {
  return (
    <ExampleSection>
      <View className="px-gutter pb-1 pt-4">
        <Text variant="eyebrow">
          Example plans
        </Text>
      </View>
      {PLAN_CARDS.map(({ date, bar, going }) => (
        <View
          key={date}
          className="mx-gutter mt-2 rounded-plate border border-hairline p-4">
          <Text variant="eyebrow" className="text-ghost">
            {date}
          </Text>
          <View
            className="mt-2 rounded-sm bg-tray"
            style={{ height: 16, maxWidth: bar }}
          />
          <View className="mt-2.5 flex-row" style={{ gap: 6 }}>
            {Array.from({ length: going }, (_, i) => (
              <View
                key={i}
                className="rounded-full bg-tray"
                style={{ width: 22, height: 22 }}
              />
            ))}
          </View>
        </View>
      ))}
      <GhostFade height={110} />
    </ExampleSection>
  );
}

/** P-10's ghost trip rows — the label is the length of trip, the bar the rest. */
const TRIP_ROWS: { label: string; bar?: number }[] = [
  { label: '5 days' },
  { label: 'A weekend', bar: 150 },
];

/**
 * P-10 — inside the membership plate, between the free-tier reassurance and
 * "See membership". What packing produces, sketched at arm's length: no fade,
 * because inside a card a gradient reads as the card failing to load.
 */
export function ExampleTrips() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="border-t border-rule pt-[18px]">
      <Text variant="eyebrow">
        Example trips
      </Text>
      <View className="mt-2.5" style={{ gap: 8 }}>
        {TRIP_ROWS.map(({ label, bar }) => (
          <View
            key={label}
            className="flex-row items-center border border-hairline"
            style={{ gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
            {/* `label`, not `stat`: the atlas sets the ghost length-of-trip in
                the 13px grotesque, and `stat` would put a serif figure here. */}
            <Text
              variant="label"
              className="font-semibold text-ghost"
              style={{ width: 70 }}>
              {label}
            </Text>
            <View
              className="flex-1 rounded-sm bg-tray"
              style={{ height: 12, maxWidth: bar }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

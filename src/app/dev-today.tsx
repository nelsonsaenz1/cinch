import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_ITEMS, FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import {
  Masthead,
  NothingWorks,
  ReducedMasthead,
  nothingWorksReason,
} from '@/app/(tabs)/index';
import { Plate } from '@/components/today/plate';
import { gapBody, SamplePlate, type ClosetGap } from '@/components/today/sample-plate';
import { WeatherStrip } from '@/components/today/weather-strip';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import type { WeatherContext } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * The fixture's day and place, frozen — the eyebrow every state on this route
 * carries.
 *
 * The real screen builds this with `dayLine(city)`, which is `new Date()`
 * formatted. On a route the matrix diffs byte for byte that is a string which
 * changes at every midnight, so the baseline would go red once a day for a
 * reason that has nothing to do with the code. A literal cannot.
 */
const FIXTURE_DAY = 'Thu 7 Aug · Denver';

/**
 * The same instant, as a Date, for the states that render the real `Masthead`
 * rather than a prop-driven eyebrow. 09:41 local is Apple's own screenshot
 * convention and matches the frozen status bar the matrix sets, so the picture
 * agrees with itself. Morning, so the greeting reads "Good morning" forever.
 */
const FIXTURE_NOW = new Date(2026, 7, 6, 9, 41, 0);

/**
 * SUPERSEDED AS THE ATLAS ROUTE, KEPT AS THE COMPONENT BENCH.
 *
 * The IDs on this route are the WAVE 2 Today atlas's (T-01…T-11, S-01…S-10)
 * and they do not mean what the Wave 3 IDs of the same shape mean — Wave 3's
 * T-09 is offline, this file's T-09 is "nothing works". The canonical Wave 3
 * fixtures are one route per state at `cinch://dev-w3-g2-<id>`; those are what
 * the screenshot matrix should photograph, and what the atlas is checked
 * against. Nothing here is renumbered, because renumbering a shipped ID is
 * worse than an obsolete one: this route keeps its own history and stops being
 * authority.
 *
 * DEV ONLY — every Today render side by side at `cinch://dev-today`, keyed
 * to the Today State Atlas's own IDs (T-01…T-11, S-01…S-10).
 *
 * The real screen lives behind auth, a populated closet, a weather fetch and
 * a 15-second re-rank, so most of its states are near-impossible to see on a
 * real device — nobody can walk their own phone offline, fail a wardrobe
 * fetch, and land on a cold day with no coat in one sitting. This stacks all
 * of them with hand-built fixtures, each labelled with its atlas ID, so the
 * whole state space can be judged — and diffed against the atlas — in one
 * screenshot. `D-01…D-12`, the plate's own action-row states, live at
 * `dev-plate` instead: they are reachable by tapping the real component's
 * real buttons, which is a truer preview than a static fork of its JSX.
 *
 * Reuses the production `Masthead` / `ReducedMasthead` / `NothingWorks` /
 * `nothingWorksReason` straight from `(tabs)/index.tsx` rather than
 * re-typing them — a second hand-copied "reduced masthead" here would drift
 * from the real one the moment either changed. Dev-only, like dev-plate /
 * dev-closet: `__DEV__`-gated, and it renders a refusal outside it so it
 * ships nothing.
 *
 * It is also the `today` capture target for the screenshot matrix (audit item
 * 50), which photographs it on three widths and diffs the PNGs byte for byte.
 * That makes determinism a requirement of the route rather than a nicety:
 * every string here is a literal, nothing on it reads the clock, and anything
 * that animates without landing on a final frame is described rather than
 * drawn. The two states that had to give something up for it — T-01/T-03's
 * masthead and T-07's skeleton — say so at their own states below.
 */
export default function DevTodayScreen() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const mildWeather: WeatherContext = {
    feelsLikeC: 12,
    highC: 15,
    lowC: 9,
    precipitationChance: 0.1,
    windKph: 8,
    swing: false,
  };
  const coldWeather: WeatherContext = {
    feelsLikeC: 1,
    highC: 2,
    lowC: -3,
    precipitationChance: 0.2,
    windKph: 30,
    swing: false,
  };

  // T-09a–d's four fixtures, each item set chosen so exactly one of
  // `nothingWorksReason`'s checks fires — the same logic (tabs)/index.tsx
  // runs, read against fixture closets rather than a real one.
  const noTop = FIXTURE_ITEMS.filter((g) => g.slot !== 'base_top');
  const noBottom = FIXTURE_ITEMS.filter((g) => g.slot !== 'bottom');
  const coldNoLayer = FIXTURE_ITEMS.filter((g) => g.slot !== 'outerwear');
  const fallback = FIXTURE_ITEMS;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-16">
        {/* ── 01 · Happy path ─────────────────────────────────────────────── */}
        <StateLabel>01 · Happy path</StateLabel>

        <StateLabel sub>T-01 · a normal day</StateLabel>
        {/* The real masthead, on a frozen clock.
            `dayLine()` and `greetingForNow()` both read `new Date()`, so the
            eyebrow rewords at every midnight and the greeting at noon and
            again at six: a capture taken at 11:59 and one at 12:01 are
            different pictures of unchanged code. `now` pins both. `unseen`
            pins the third moving part — the activity dot is painted off a
            Supabase round trip, so without it the dot's presence depends on
            whether the network beat the shutter.
            Both props default to the live values, so nothing about the real
            Today screen changes; they exist so this one screen can be
            photographed. Same idiom as `Plate`'s `repeat.now`. */}
        <Masthead city="Denver" name="Maya" now={FIXTURE_NOW} unseen={false} />
        <View style={{ marginTop: 6 }}>
          <WeatherStrip weather={mildWeather} events={[]} city="Denver" />
        </View>
        {/* The plate animates on mount and is left alone anyway: its landing is
            a spring per garment, staggered by `landingDelay`, and a spring
            settles on an exact 1 — the last piece is down inside a second, well
            under the dwell the matrix waits out before it fires. `resolveImage`
            returns undefined on purpose, so every cell is the colour-swatch
            fallback rather than a photograph fetched over the asset server:
            nothing on this card is waiting on a byte from anywhere. */}
        <View className="mt-6">
          <Plate
            outfit={FIXTURE_OUTFIT}
            index={0}
            occasion="dinner at 7"
            colophon={{ city: 'Denver', feelsLikeC: mildWeather.feelsLikeC }}
            resolveImage={() => undefined}
            onWear={() => {}}
            onReact={() => {}}
          />
        </View>
        <View className="px-gutter">
          <Text variant="label">
            6 more reactions and Cinch will start recognising your taste.
          </Text>
        </View>

        <StateLabel sub className="mt-8">T-03 · pull-to-refresh failed</StateLabel>
        {/* Real masthead on the frozen clock, as T-01: this state is still
            inside the captured viewport on the widest device. */}
        <Masthead city="Denver" name="Maya" now={FIXTURE_NOW} unseen={false} />
        <View style={{ marginTop: 6 }}>
          <WeatherStrip weather={mildWeather} events={[]} city="Denver" />
        </View>
        <Notice
          message="Couldn’t refresh just now — these are still today’s."
          className="mt-2 px-gutter"
        />

        {/* ── 03 · First run ───────────────────────────────────────────────── */}
        <StateLabel className="mt-10">03 · First run</StateLabel>

        <GapState id="T-04" label="Empty closet (virgin)" gap={{ kind: 'virgin' }} />
        <GapState id="T-05a" label="Missing top" gap={{ kind: 'top' }} />
        <GapState id="T-05b" label="Missing bottom" gap={{ kind: 'bottom' }} />
        <GapState id="T-05c" label="Missing both" gap={{ kind: 'both' }} />
        <GapState id="T-06" label="Below the floor, 3 more pieces" gap={{ kind: 'count', remaining: 3 }} />

        {/* ── 04 · Trouble ─────────────────────────────────────────────────── */}
        <StateLabel className="mt-10">04 · Trouble</StateLabel>

        <StateLabel sub>T-07 · first load — plate skeleton</StateLabel>
        <ReducedMasthead eyebrow={FIXTURE_DAY} />
        {/* Described, not drawn. `PlateSkeleton` is built from `Skeleton`,
            whose highlight band is a `withRepeat(withTiming(1300ms), -1)`
            sweep — it loops for as long as it is mounted and never lands on a
            final frame, so the capture takes whatever position the band was in
            when the shutter fired and two launches disagree by construction.
            There is no settled end state to substitute (a shimmer that has
            stopped is a different graphic), and the loop cannot be stopped
            from this file, so the state gets the same prose treatment T-08
            already has. */}
        <Text variant="label" className="px-gutter" style={{ marginTop: 8 }}>
          (see `PlateSkeleton` in components/ui/skeleton.tsx — the plate&rsquo;s
          own anatomy in placeholder bars: name and colophon, two lines of
          reasoning, the 5:4 garment well, the credit line, the ruled footer)
        </Text>

        <StateLabel sub className="mt-8">T-08 · closet fetch failed</StateLabel>
        <ReducedMasthead eyebrow={FIXTURE_DAY} />
        <Text variant="label" className="px-gutter" style={{ marginTop: 8 }}>
          (see the real component at the `wardrobe.isError` branch of
          (tabs)/index.tsx — muted triangle glyph, outlined retry, hard-left
          composition on the gutter)
        </Text>

        <StateLabel sub className="mt-8">T-09 · nothing works today</StateLabel>
        <ReducedMasthead eyebrow="Wed 6 Aug · Denver" />
        <WeatherStrip weather={coldWeather} events={[]} city="Denver" weatherOnly />
        <View className="mt-4">
          <NothingWorks reason={nothingWorksReason(coldNoLayer, coldWeather)} onSeeWorn={() => {}} />
        </View>

        <StateLabel sub className="mt-8">T-09a–d · the four honest reasons</StateLabel>
        <ReasonCard label="No top / no dress" reason={nothingWorksReason(noTop, mildWeather)} />
        <ReasonCard label="No bottom / no dress" reason={nothingWorksReason(noBottom, mildWeather)} />
        <ReasonCard
          label="Cold day, no warm layer (targetWarmth ≥ 9)"
          reason={nothingWorksReason(coldNoLayer, coldWeather)}
        />
        <ReasonCard label="Fallback (nothing coheres)" reason={nothingWorksReason(fallback, mildWeather)} />

        {/* ── 05 · Offline ─────────────────────────────────────────────────── */}
        <StateLabel className="mt-10">05 · Offline</StateLabel>

        <StateLabel sub>T-10 · offline — showing this morning&rsquo;s set</StateLabel>
        <View className="mx-gutter mt-1.5 flex-row items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accentWarm }} />
          <Text variant="label" className="flex-1 font-medium" style={{ color: theme.canvas }}>
            Offline &mdash; showing this morning&rsquo;s set. Weather and plans may have moved on.
          </Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <ReducedMasthead eyebrow="Last synced 8:12am" />
        </View>
        <View className="mt-5" style={{ opacity: 0.62 }}>
          <Plate
            outfit={FIXTURE_OUTFIT}
            index={0}
            occasion="dinner at 7"
            colophon={{ city: 'Denver', feelsLikeC: mildWeather.feelsLikeC }}
            resolveImage={() => undefined}
            offline
            onWear={() => {}}
            onReact={() => {}}
          />
          <Text variant="caption" className="px-gutter text-center">
            Reactions will sync once you&rsquo;re back online.
          </Text>
        </View>

        <StateLabel sub className="mt-8">T-11 · offline — and nothing to build</StateLabel>
        <View className="mx-gutter mt-1.5 flex-row items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accentWarm }} />
          <Text variant="label" className="flex-1 font-medium" style={{ color: theme.canvas }}>
            Offline &mdash; showing this morning&rsquo;s set. Weather and plans may have moved on.
          </Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <ReducedMasthead eyebrow="Last synced Tue 9:47pm" />
        </View>
        <View className="mt-5">
          <NothingWorks reason={nothingWorksReason(fallback, coldWeather)} onSeeWorn={() => {}} />
        </View>

        {/* ── 06 · Context lines & masthead permutations ──────────────────── */}
        <StateLabel className="mt-10">06 · Context lines</StateLabel>

        <StateLabel sub>S-01 · weather + up to 4 calendar events</StateLabel>
        <WeatherStrip
          weather={mildWeather}
          city="Denver"
          events={[
            { id: '1', title: 'Lunch with Sam', startsAt: 12 * 60 + 30, endsAt: 13 * 60 + 30, formality: 3, occasion: null, indoor: true },
            { id: '2', title: 'Dinner at Bar Ilios', startsAt: 19 * 60, endsAt: 21 * 60, formality: 4, occasion: null, indoor: true },
          ]}
        />

        <StateLabel sub className="mt-4">S-02 · weather unavailable</StateLabel>
        <WeatherStrip weather={null} events={[]} city="Denver" />

        <StateLabel sub className="mt-4">S-03 · usingFallbackLocation</StateLabel>
        <WeatherStrip
          weather={mildWeather}
          events={[]}
          city="Denver"
          usingFallbackLocation
          onEnableLocation={() => {}}
        />

        <StateLabel sub className="mt-4">S-04 · calendar permission not yet asked</StateLabel>
        <WeatherStrip weather={mildWeather} events={[]} city="Denver" onConnectCalendar={() => {}} />

        <StateLabel sub className="mt-4">S-05 · calendarEnabled, zero events</StateLabel>
        <WeatherStrip weather={mildWeather} events={[]} city="Denver" calendarEnabled />

        {/* The only two clock-driven renders left on the route, and the reason
            they are allowed to stay: the live greeting IS the state S-06/S-07
            exist to show, and a frozen copy of it would be a fixture of a
            component nobody ships. They sit at the far end of the scroll, so
            the wording they change with the hour never reaches the captured
            viewport — nothing here reflows anything above it. If the matrix is
            ever taught to photograph the whole scroll, `Masthead` needs an
            injectable `now` first (see the `repeat.now` prop plate.tsx already
            carries for exactly this). */}
        <StateLabel sub className="mt-8">S-06 · greeting, full_name present</StateLabel>
        <Masthead city="Denver" name="Maya" />

        <StateLabel sub className="mt-4">S-07 · greeting, no account name</StateLabel>
        <Masthead city="Denver" name={null} />

        <StateLabel sub className="mt-4">S-08 · reduced masthead</StateLabel>
        <ReducedMasthead eyebrow={FIXTURE_DAY} />

        <StateLabel sub className="mt-8">S-09 · learning line, feedbackCount &lt; 8</StateLabel>
        <View className="px-gutter">
          <Text variant="label">5 more reactions and Cinch will start recognising your taste.</Text>
        </View>

        <StateLabel sub className="mt-4">S-10 · learning line, feedbackCount ≥ 8</StateLabel>
        <View className="px-gutter">
          <Text variant="label">
            Learning from 23 reactions &mdash; it thinks you lean into warm neutrals over pattern.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One rung of the empty-closet ladder (T-04/05/06), atlas-labelled. */
function GapState({ id, label, gap }: { id: string; label: string; gap: ClosetGap }) {
  return (
    <>
      <StateLabel sub className="mt-8">
        {`${id} · ${label}`}
      </StateLabel>
      <ReducedMasthead eyebrow={FIXTURE_DAY} />
      <View className="items-center px-gutter" style={{ paddingTop: 20, paddingBottom: 8 }}>
        <Text variant="colophon" style={{ marginBottom: 10 }}>
          {gap.kind === 'virgin' ? 'What your mornings become' : 'What your mornings become · 4 pieces in'}
        </Text>
        <SamplePlate gap={gap} />
        <View style={{ marginTop: 20 }}>
          <Text variant="title" className="text-center">
            {gap.kind === 'virgin' ? "I can't style\nwhat I can't see" : "You're almost there"}
          </Text>
        </View>
        <Text
          variant="body"
          className="mt-3 text-center text-muted"
          style={{ maxWidth: 264 }}>
          {gapBody(gap)}
        </Text>
      </View>
    </>
  );
}

/** One of T-09a–d's four honest-reason cards. */
function ReasonCard({ label, reason }: { label: string; reason: string }) {
  return (
    <View
      className="mx-gutter mt-2 rounded-md border border-rule bg-surface p-3.5">
      <Text variant="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <Text variant="callout">{reason}</Text>
    </View>
  );
}

/** A small caption marking each stacked state — dev chrome, not app UI. */
function StateLabel({
  children,
  className = '',
  sub = false,
}: {
  children: string;
  className?: string;
  /** A sub-heading for one atlas ID inside a section, set a shade quieter. */
  sub?: boolean;
}) {
  return (
    <View className={`px-gutter ${className}`} style={{ paddingTop: 8, paddingBottom: 4 }}>
      <Text
        variant="colophon"
        className={sub ? 'text-muted' : 'text-accent'}>
        {children}
      </Text>
    </View>
  );
}

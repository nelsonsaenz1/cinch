import { View, type DimensionValue } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { FootCta } from '@/components/plan/new-trip-body';
import {
  ANSWER_CARD_GAP,
  ANSWER_CARD_MIN_HEIGHT,
  ANSWER_CARD_RADIUS,
  BADGE_DOT,
  BADGE_RADIUS,
  CTA_RADIUS,
  CTA_SECONDARY_MIN_HEIGHT,
  NEW_TRIP_COPY,
  PLATE_DAY_GAP,
  PLATE_GAP,
  PLATE_ROW,
  PLATE_ROW_LOADING,
  PLATE_TILES,
  PLATE_TILE_RADIUS,
  type AnswerRow,
} from '@/features/plan/new-trip-spec';
import { GUTTER, MIN_TAP_TARGET, positiveAlpha, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * New Trip — the packing plate. The drawn surface for what comes back.
 * Redesign 05.
 *
 * Three of the eight accepted frames live here: the plate BUILDING, the plate
 * that DIDN'T come back, and "Trip planned" — the completion moment. They are
 * one file because they are one composition seen at three moments: the same
 * destination head, the same three-across day grids, the same pinned foot, with
 * only the ground and the actions changing. Splitting them would have meant
 * keeping three copies of a grid in step.
 *
 * ── PIECES GRIDDED, NOT LISTED ───────────────────────────────────────────────
 *
 * The directive's own words. What this replaced was a memo — a paragraph of
 * prose, then a wrapped grid of packed pieces with a repeat chip on each, then
 * a row of names per day part. Three abstractions of the same suitcase, and the
 * garments were the smallest thing on it. The plate is one abstraction: for
 * every day of the trip, the pieces that day is dressed in, at 82pt, three
 * across, under a band naming the day and what it is for.
 *
 * The bag's own summary and the memo's prose are GONE from the screen. Neither
 * was deleted from the app — `buildSavedMemo` still writes both into the trip
 * row, the share card still sets the headline, and `packing-memo.ts` is
 * untouched, which is why `packing-memo.test.ts` and
 * `packing-memo-deterministic.test.ts` still pass unmodified. What changed is
 * what the screen shows, not what the trip records.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────
 *
 * Not one hex. The failure band is `warningAlpha` with every word on it in
 * `ink`, the same construction the trips shelf's offline band uses and for the
 * same reason: `warning` is a FILL and `theme/contrast.ts` says ink goes on it.
 * The completion badge is `positiveAlpha` on the same terms. The day bands are
 * `accent`; their trailing captions are `muted`, never clay.
 */

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type PlateTile = { uri?: string };

export type PlateDay = {
  key: string;
  /** `Thu 10 · arrival` — from `plateDayLabel`, never composed here. */
  label: string;
  /** The honest caption: "travel day", "60% rain". Null when nothing is known. */
  caption: string | null;
  /** Three across. Short days keep their empty wells; see `DayGrid`. */
  tiles: PlateTile[];
};

export type PackingPlateView =
  | {
      state: 'building';
      destination: string;
      /** `10–14 Sep · 4 nights`. */
      colophon: string | null;
      /** 0–1. Drawn as the CTA's own fill, so waiting has one place on screen. */
      progress: number;
    }
  | {
      state: 'failed';
      /** The answers, preserved and shown — the frame's promise as evidence. */
      answers: AnswerRow[];
      onRetry: () => void;
      retrying: boolean;
      onSaveAndFinishLater: () => void;
    }
  | {
      state: 'planned';
      destination: string;
      /** `10–14 Sep · 4 nights · 24°/15°`. */
      colophon: string | null;
      days: PlateDay[];
      onSeeThisTrip: () => void;
      onAllTrips: () => void;
      /** The two quiet actions the frames keep off the foot. Null hides them. */
      onSwapDay: (() => void) | null;
      onShare: (() => void) | null;
    };

// ---------------------------------------------------------------------------
// The shared parts
// ---------------------------------------------------------------------------

/**
 * A status badge — a mark, a dot, a tinted plate.
 *
 * One component for both the amber failure and the green completion, because
 * they are the same object in two tempers and the frames draw them at identical
 * geometry. `ink` on both grounds: the artifact's #7A5312 and #33562F are
 * neither palette tokens nor legal as type under `theme/contrast.ts`, and ink
 * is darker and passes on either.
 */
function Badge({ label, tone, large }: { label: string; tone: 'warning' | 'positive'; large: boolean }) {
  const theme = useTheme();
  const ground = tone === 'warning' ? warningAlpha(0.35) : positiveAlpha(0.16);
  const dot = tone === 'warning' ? theme.warning : theme.positive;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: ground,
        borderRadius: BADGE_RADIUS,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexShrink: 0,
      }}>
      <View
        style={{
          width: BADGE_DOT,
          height: BADGE_DOT,
          borderRadius: BADGE_DOT / 2,
          backgroundColor: dot,
          flexShrink: 0,
        }}
      />
      <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.ink }}>
        {label}
      </Text>
    </View>
  );
}

/** The destination head — serif over a tracked colophon. */
function PlateHead({
  destination,
  colophon,
  large,
}: {
  destination: string;
  colophon: string | null;
  large: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      {/* NO `trim`: "Whistler with Marisol" wraps, and `trim` subtracts a
          one-line margin from a two-line box. */}
      <Text variant="display" accessibilityRole="header" style={{ paddingBottom: large ? 6 : 3 }}>
        {destination}
      </Text>
      {colophon ? (
        // The artifact sets this in clay, which is `text: false` (2.98:1).
        <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.muted }}>
          {colophon}
        </Text>
      ) : null}
    </>
  );
}

/**
 * One day's pieces, three across.
 *
 * When the day has fewer than three the remaining wells still draw: the frames'
 * geometry is three equal columns, and a row that changed shape with the count
 * would make two days of one trip look like two designs. What degrades is the
 * photograph, not the frame — the same bargain the trips shelf's hero band makes.
 */
function DayGrid({ tiles, height }: { tiles: PlateTile[]; height: number }) {
  const theme = useTheme();
  const grounds = [theme.sand, theme.tray, theme.sand];

  return (
    <View style={{ flexDirection: 'row', gap: PLATE_GAP, height, flexShrink: 0 }}>
      {Array.from({ length: PLATE_TILES }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: grounds[i],
            borderRadius: PLATE_TILE_RADIUS,
            overflow: 'hidden',
          }}>
          <GarmentImage
            uri={tiles[i]?.uri}
            contentFit="cover"
            transition={140}
            style={{ width: '100%', height: '100%' }}
            fallback={<View />}
          />
        </View>
      ))}
    </View>
  );
}

/** The secondary action under the filled one — a tinted fill, never a ghost. */
function SecondaryCta({
  label,
  onPress,
  large,
}: {
  label: string;
  onPress: () => void;
  large: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.blush }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: CTA_SECONDARY_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      <Text variant={large ? 'heading' : 'callout'} style={{ color: theme.accent, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/** The quiet register — an underlined word, in the foot's own grammar. */
function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      contentStyle={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
      <Text variant="label" className="underline">
        {label}
      </Text>
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * The plate, arriving.
 *
 * The geometry lands before the photographs do, so nothing moves when the
 * pieces resolve — that is the whole point of a loading frame and the reason
 * it is drawn from the same constants as the real thing. The wait has ONE
 * expression, the CTA's own clay fill, rather than a spinner somewhere else:
 * the frames put the progress inside the button that will become the next
 * action.
 */
function BuildingBody({
  view,
  large,
}: {
  view: Extract<PackingPlateView, { state: 'building' }>;
  large: boolean;
}) {
  const theme = useTheme();
  const ratio = Math.min(1, Math.max(0, view.progress));

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingHorizontal: large ? 22 : 24, paddingTop: 6, paddingBottom: 18, gap: 8, flexShrink: 0 }}>
        <PlateHead destination={view.destination} colophon={view.colophon} large={large} />
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: 12, flexShrink: 0 }}>
        {(['38%', '46%', '32%'] as const).map((width, i) => (
          <View key={width} style={{ gap: 9 }}>
            <Skeleton style={{ height: 12, width, borderRadius: 6 }} delay={i * 90} />
            <View style={{ flexDirection: 'row', gap: PLATE_GAP, height: PLATE_ROW_LOADING }}>
              <Skeleton style={{ flex: 1, minWidth: 0, borderRadius: PLATE_TILE_RADIUS }} delay={i * 90} />
              <Skeleton style={{ flex: 1, minWidth: 0, borderRadius: PLATE_TILE_RADIUS }} delay={i * 90 + 60} />
              <Skeleton style={{ flex: 1, minWidth: 0, borderRadius: PLATE_TILE_RADIUS }} delay={i * 90 + 120} />
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 8, flexShrink: 0 }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={NEW_TRIP_COPY.packing}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
          style={{
            minHeight: 56,
            borderRadius: CTA_RADIUS,
            // Blush, not sand: the track is the unfilled half of the SAME
            // control, and the frames tint it warm so the fill reads as
            // progress through the button rather than a bar laid over it.
            backgroundColor: theme.blush,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${ratio * 100}%` as DimensionValue,
              backgroundColor: theme.accentWarm,
            }}
          />
          {/* `canvas` on clay: clay is a FILL, and canvas over it is the pair
              the contrast record allows. */}
          <Text variant={large ? 'heading' : 'body'} style={{ color: theme.canvas }}>
            {NEW_TRIP_COPY.packing}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Failed
// ---------------------------------------------------------------------------

/**
 * The plate that did not come back.
 *
 * The band says one true thing and the cards under it PROVE the second: "your
 * answers are still here" is drawn as the answers rather than asserted, so the
 * sentence cannot go stale while the flow keeps them. Both ways out are real —
 * retry re-reads the destination weather, and "Save and finish later" leaves
 * the trip exactly where `useStartTrip` already wrote it.
 */
function FailedBody({
  view,
  large,
}: {
  view: Extract<PackingPlateView, { state: 'failed' }>;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 bg-canvas">
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: warningAlpha(0.22),
          paddingHorizontal: 22,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 12,
          flexShrink: 0,
        }}>
        <Badge label={NEW_TRIP_COPY.errorKicker} tone="warning" large={large} />
        <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 2 }}>
          {NEW_TRIP_COPY.errorTitle}
        </Text>
        <Text variant="body" className="text-muted" style={{ maxWidth: 290 }}>
          {NEW_TRIP_COPY.errorBody}
        </Text>
      </View>

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 20, gap: ANSWER_CARD_GAP, flexShrink: 0 }}>
        {view.answers.map((row) => (
          <View
            key={row.key}
            accessible
            accessibilityLabel={`${row.key}: ${row.value}`}
            style={{
              backgroundColor: theme.blush,
              borderRadius: ANSWER_CARD_RADIUS,
              minHeight: ANSWER_CARD_MIN_HEIGHT,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 14,
              gap: 3,
            }}>
            <Text variant="eyebrow">{row.key}</Text>
            <Text variant={large ? 'body' : 'heading'} numberOfLines={large ? undefined : 2} style={{ paddingBottom: 2 }}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 8, gap: 10, flexShrink: 0 }}>
        <FootCta
          label={view.retrying ? NEW_TRIP_COPY.packing : NEW_TRIP_COPY.tryAgain}
          enabled={!view.retrying}
          onPress={view.onRetry}
          large={large}
        />
        <SecondaryCta
          label={NEW_TRIP_COPY.saveAndFinishLater}
          onPress={view.onSaveAndFinishLater}
          large={large}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Planned
// ---------------------------------------------------------------------------

/**
 * "Trip planned" — the completion moment, and two clear ways out.
 *
 * The success haptic that goes with it is fired by the OWNER of this state, not
 * here: a presentational component that buzzes would buzz again for every dev
 * fixture that poses it, and `haptics.success()` is reserved for an operation
 * that was genuinely in doubt.
 */
function PlannedBody({
  view,
  large,
}: {
  view: Extract<PackingPlateView, { state: 'planned' }>;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingHorizontal: large ? 20 : 22, paddingTop: 2, paddingBottom: 16, gap: 10, flexShrink: 0 }}>
        <Badge label={NEW_TRIP_COPY.planned} tone="positive" large={large} />
        <PlateHead destination={view.destination} colophon={view.colophon} large={large} />
      </View>

      <View style={{ flex: 1, minHeight: 0 }}>
        <View style={{ paddingHorizontal: GUTTER, gap: PLATE_DAY_GAP, flexShrink: 0 }}>
          {view.days.map((day) => (
            <View key={day.key} style={{ gap: 7 }}>
              <View
                style={{
                  flexDirection: large ? 'column' : 'row',
                  alignItems: large ? 'flex-start' : 'baseline',
                  justifyContent: 'space-between',
                  gap: large ? 4 : 10,
                }}>
                {/* The day band is the page's structural accent — §1's "section
                    headers in the area accent, not gray". */}
                <Text variant="eyebrow" style={{ color: theme.accent, minWidth: 0, flexShrink: 1 }}>
                  {day.label}
                </Text>
                {day.caption ? (
                  <Text
                    variant="label"
                    numberOfLines={large ? undefined : 1}
                    style={{ minWidth: 0, flexShrink: 1, textAlign: large ? 'left' : 'right' }}>
                    {day.caption}
                  </Text>
                ) : null}
              </View>
              <DayGrid tiles={day.tiles} height={PLATE_ROW} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 8, gap: 10, flexShrink: 0 }}>
        <FootCta
          label={NEW_TRIP_COPY.seeThisTrip}
          enabled
          onPress={view.onSeeThisTrip}
          large={large}
        />
        <SecondaryCta label={NEW_TRIP_COPY.allTrips} onPress={view.onAllTrips} large={large} />

        {/* The two actions the memo used to spend buttons on. They survive as
            quiet links: the frames give the foot exactly two controls, and a
            third filled one would spend the accent budget a second time. */}
        {view.onSwapDay || view.onShare ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, paddingTop: 2 }}>
            {view.onSwapDay ? <QuietLink label={NEW_TRIP_COPY.swapDay} onPress={view.onSwapDay} /> : null}
            {view.onShare ? <QuietLink label={NEW_TRIP_COPY.share} onPress={view.onShare} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function PackingPlateBody({
  view,
  large = false,
}: {
  view: PackingPlateView;
  large?: boolean;
}) {
  if (view.state === 'building') return <BuildingBody view={view} large={large} />;
  if (view.state === 'failed') return <FailedBody view={view} large={large} />;
  return <PlannedBody view={view} large={large} />;
}

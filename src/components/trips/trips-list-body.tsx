import { SymbolView } from 'expo-symbols';
import { ScrollView, View } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  BADGE_RADIUS,
  BAND_DOT,
  BAND_RADIUS,
  CACHED_THUMB,
  CARD_COLLAGE_ROW_AX,
  CARD_GAP,
  CARD_PAD,
  CARD_PAD_AX,
  CARD_RADIUS,
  CARD_THUMB,
  CARD_THUMB_GAP,
  CARD_THUMB_RADIUS,
  CASE_BORDER,
  CASE_HANDLE_HEIGHT,
  CASE_HANDLE_WIDTH,
  CASE_HEIGHT,
  CASE_RADIUS,
  CASE_STRIPE,
  CASE_STRIPE_HEIGHT,
  CASE_WIDTH,
  CHEVRON,
  COLLAGE_GAP,
  CTA_MIN_HEIGHT,
  CTA_RADIUS,
  EYEBROW_RADIUS,
  EYEBROW_RADIUS_AX,
  HEADER_CTA_RADIUS,
  HEADER_CTA_RADIUS_AX,
  HERO_COLLAGE_ROW,
  HERO_COLLAGE_ROW_AX,
  PAST_ROW_GAP,
  PAST_THUMB,
  PAST_THUMB_RADIUS,
  TRIPS_COPY,
} from '@/features/trips/trips-list-spec';
import { GUTTER, MIN_TAP_TARGET, canvasAlpha, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Trips — the list. The drawn surface. Redesign 04.
 *
 * Split from the route for the reason every other rebuilt page in this repo is:
 * a screen that reaches for the `trips` table, the closet and a batch of signed
 * URLs at the top cannot be POSED, and a state nobody can open is a state
 * nobody checks. Everything here is a function of the `view` object, so
 * `dev-tl-01…05` draw the five accepted frames out of `trips-list-fixtures.ts`
 * without a session, a network or a single row on the other end.
 *
 * ── WHAT THE FRAMES ASK FOR ──────────────────────────────────────────────────
 *
 * 1. A masthead — "Trips" in the serif against a tinted "Plan a trip" pill.
 * 2. "Next up": the soonest trip as a full-bleed card. A three-across band of
 *    packed pieces above an oxblood plate carrying the destination in the
 *    serif, its dates, and a "Packed" badge when the trip actually produced a
 *    list. It bleeds to both edges; it is the only card that does.
 * 3. The rest of the upcoming shelf under its own eyebrow, as blush cards with
 *    a four-square collage, the destination in the serif and the dates beneath.
 * 4. "Where you've been" — the past, in the quieter register: a small tray
 *    well, the destination in the grotesque, the month underneath, hairlines
 *    between.
 * 5. Empty: a drawn suitcase, one line, one filled CTA at the foot.
 * 6. Offline: an amber band over the rows that are already on the device, and
 *    "Try again" at the foot.
 *
 * ── WHAT IT DOES NOT DRAW ────────────────────────────────────────────────────
 *
 * The artifact frames sit in a phone that has a four-tab bar with Trips as one
 * of the tabs. That IA is not this app's — the tabs are Today, Closet, Plan and
 * Explore, and the directive routes this page to `trips/index.tsx` — so the
 * page is pushed and carries a back affordance where the frame's chrome was.
 * That is the one structural difference from the artifact and it is listed in
 * the build report.
 *
 * Nothing here counts anything out loud, and nothing here is gated. Looking at
 * the trips you already have is not the paywall moment; planning a new one is,
 * and that gate lives where it always did, in `PackingTab`.
 *
 * ── LARGE TYPE ───────────────────────────────────────────────────────────────
 *
 * Above `TRIPS_LIST_STACK_SCALE` the page recomposes rather than shrinking, in
 * four places the AX frame draws: the masthead stacks and the pill goes
 * full-width; the hero's colophon drops its tracked caps for a plain line and
 * the badge steps off the plate; the shelf card puts its collage across the top
 * instead of beside the type; and the chevron goes, because at that size the
 * whole card is the target and a 12pt glyph beside it is noise.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────
 *
 * Not one hex here. The artifact's #E3BFB1 date line on the oxblood plate is
 * `canvasAlpha(0.7)` — the step the event poster's band already uses for the
 * same job — and its clay #B08A76 shelf dates are `muted`, because clay is
 * 2.98:1 and `theme/contrast.ts` declares it `text: false`. The amber band is
 * `warningAlpha`, with every word on it in ink.
 */

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type TripTile = { uri?: string };

export type TripCardView = {
  id: string;
  destination: string;
  /** Null when the row never got a usable pair of dates. */
  dates: string | null;
  /** True once the trip actually produced a packing list. */
  packed: boolean;
  tiles: TripTile[];
};

export type PastTripView = {
  id: string;
  destination: string;
  dates: string | null;
  tile: TripTile | null;
};

export type TripsListView = {
  loading: boolean;
  /** The refresh failed and what is drawn is what the device already had. */
  offline: boolean;
  /** The soonest upcoming trip, drawn full-bleed. */
  next: TripCardView | null;
  /** Everything upcoming after that one. */
  upcoming: TripCardView[];
  past: PastTripView[];
  /** "Later this year" or "Later on" — decided by the spec, not here. */
  laterLabel: string;
  onBack: () => void;
  onPlanTrip: () => void;
  onRetry: () => void;
  /**
   * Set now that Trip Detail exists — redesign 06.
   *
   * The artifact draws a chevron on every shelf card, and this page shipped
   * ahead of the page that chevron promises, so the cards were drawn inert and
   * the affordance withheld rather than dead-ending. `trips/[id]` has landed and
   * the route sets this, which turns the cards live and brings the chevron back.
   *
   * The prop stays NULLABLE rather than becoming required: the fixtures pose
   * this page without a router, and null is what "no destination for a press"
   * has to look like there. It is the seam that let the two builds ship in
   * either order, and it costs one branch to keep.
   */
  onOpenTrip: ((id: string) => void) | null;
};

// ---------------------------------------------------------------------------
// The masthead
// ---------------------------------------------------------------------------

function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={TRIPS_COPY.back}
      onPress={onPress}
      hitSlop={8}
      style={{ flexShrink: 0 }}
      contentStyle={{
        width: MIN_TAP_TARGET,
        minHeight: MIN_TAP_TARGET,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
      <SymbolView name="chevron.left" size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </PressableSurface>
  );
}

/** The tinted pill beside the title. Full-width above the threshold. */
function PlanPill({ large, onPress }: { large: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={TRIPS_COPY.plan}
      onPress={onPress}
      style={{
        flexShrink: large ? 1 : 0,
        alignSelf: large ? 'stretch' : 'auto',
        borderRadius: large ? HEADER_CTA_RADIUS_AX : HEADER_CTA_RADIUS,
        backgroundColor: theme.blush,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: MIN_TAP_TARGET,
        paddingHorizontal: large ? 16 : 15,
        paddingVertical: large ? 12 : 8,
      }}>
      <Text variant={large ? 'heading' : 'callout'} style={{ color: theme.accent, textAlign: 'center' }}>
        {TRIPS_COPY.plan}
      </Text>
    </PressableSurface>
  );
}

function Masthead({ view, large, empty }: { view: TripsListView; large: boolean; empty: boolean }) {
  // The pill is absent in the empty and the offline frames — both of those put
  // their one action on the pinned foot instead, and two "Plan a trip" controls
  // on one screen is the accent budget spent twice.
  const pill = !view.loading && !view.offline && !empty;

  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 2,
        paddingBottom: large ? 14 : 12,
        flexShrink: 0,
        gap: large ? 12 : 0,
      }}>
      <BackButton onPress={view.onBack} />

      {/* Above the threshold the pair stops competing for one row: the title
          takes its own line and the pill goes full-width beneath it, which is
          the AX frame's own arrangement. */}
      <View
        style={
          large
            ? { gap: 12 }
            : {
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
              }
        }>
        <Text variant="display" accessibilityRole="header" style={{ minWidth: 0, flexShrink: 1 }}>
          {TRIPS_COPY.title}
        </Text>

        {view.loading ? (
          <Skeleton style={{ width: 106, height: MIN_TAP_TARGET, borderRadius: HEADER_CTA_RADIUS }} />
        ) : pill ? (
          <PlanPill large={large} onPress={view.onPlanTrip} />
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The eyebrows
// ---------------------------------------------------------------------------

/** A section head on a sand plate — the upcoming half's own register. */
function PlateEyebrow({ label, large }: { label: string; large: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: large ? 10 : 8, flexShrink: 0 }}>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: theme.sand,
          borderRadius: large ? EYEBROW_RADIUS_AX : EYEBROW_RADIUS,
          paddingHorizontal: large ? 13 : 12,
          paddingVertical: large ? 8 : 7,
        }}>
        {/* `eyebrow` already carries the tracked caps; only the colour moves,
            and it moves to `accent` because the plate under it is sand. */}
        <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.accent }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** A section head on paper — the past half stays quiet and takes no plate. */
function PaperEyebrow({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 10, flexShrink: 0 }}>
      <Text variant="eyebrow">{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The collages
// ---------------------------------------------------------------------------

/**
 * A well. The ground shows through as the gaps, so it is painted once on the
 * container rather than as a border on each — the same construction the event
 * poster's plate and the Plan week's plate both use.
 */
function Well({ uri, ground }: { uri?: string; ground: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: ground, overflow: 'hidden' }}>
      <GarmentImage
        uri={uri}
        contentFit="cover"
        transition={140}
        style={{ width: '100%', height: '100%' }}
        fallback={<View />}
      />
    </View>
  );
}

/**
 * The hero's band — three across, edge to edge.
 *
 * When the trip has fewer than three pieces the remaining wells still draw:
 * the artifact's geometry is three equal columns and a band that changed shape
 * with the count would make two trips on one shelf look like two designs. What
 * degrades is the photograph, not the frame.
 */
function HeroCollage({ tiles, large }: { tiles: TripTile[]; large: boolean }) {
  const theme = useTheme();
  const grounds = [theme.sand, theme.tray, theme.sand];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: COLLAGE_GAP,
        height: large ? HERO_COLLAGE_ROW_AX : HERO_COLLAGE_ROW,
        backgroundColor: theme.sand,
        flexShrink: 0,
      }}>
      {grounds.map((ground, i) => (
        <Well key={i} uri={tiles[i]?.uri} ground={ground} />
      ))}
    </View>
  );
}

/**
 * The shelf card's square — two by two.
 *
 * Below four pieces the empty quarters keep their ground, for the same reason
 * the hero's band does. Above the threshold the same four pieces become a band
 * across the top of the card instead, because a 64pt square beside 32pt type is
 * a thumbnail next to a headline.
 */
function CardCollage({ tiles, large, size }: { tiles: TripTile[]; large: boolean; size: number }) {
  const theme = useTheme();

  if (large) {
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: COLLAGE_GAP,
          height: CARD_COLLAGE_ROW_AX,
          backgroundColor: theme.sand,
          borderRadius: CARD_THUMB_RADIUS,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
        <Well uri={tiles[0]?.uri} ground={theme.sand} />
        <Well uri={tiles[1]?.uri} ground={theme.tray} />
        <Well uri={tiles[2]?.uri} ground={theme.sand} />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: CARD_THUMB_RADIUS,
        overflow: 'hidden',
        backgroundColor: theme.sand,
        gap: CARD_THUMB_GAP,
        flexShrink: 0,
      }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: CARD_THUMB_GAP }}>
        <Well uri={tiles[0]?.uri} ground={theme.sand} />
        <Well uri={tiles[1]?.uri} ground={theme.tray} />
      </View>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: CARD_THUMB_GAP }}>
        <Well uri={tiles[2]?.uri} ground={theme.tray} />
        <Well uri={tiles[3]?.uri} ground={theme.sand} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------

function HeroCard({
  trip,
  large,
  onOpen,
}: {
  trip: TripCardView;
  large: boolean;
  onOpen: (() => void) | null;
}) {
  const theme = useTheme();

  const plate = (
    <View style={{ backgroundColor: theme.accent, paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: large ? 20 : 18, gap: 8 }}>
      {/* NO `trim`. The destination WRAPS — "Whistler with Marisol" already
          does at the default size — and `trim` is single-line geometry: it
          subtracts a margin sized for one line from a box holding two. A few
          points of tail under the last line is the instruction the frames give
          instead, so the descenders clear the colophon. */}
      <Text variant="display" style={{ color: theme.canvas, paddingBottom: large ? 6 : 3 }}>
        {trip.destination}
      </Text>

      {large ? (
        // The composition change: the tracked caps go, because tracked caps at
        // 20pt-plus are a wall, and the badge steps off the plate onto its own
        // line rather than squeezing the date beside it.
        <View style={{ gap: 8 }}>
          {trip.dates ? (
            <Text variant="callout" style={{ color: canvasAlpha(0.7) }}>
              {trip.dates}
            </Text>
          ) : null}
          {trip.packed ? <PackedBadge large /> : null}
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          {trip.dates ? (
            <Text variant="eyebrow" numberOfLines={1} style={{ color: canvasAlpha(0.7), minWidth: 0, flexShrink: 1 }}>
              {trip.dates}
            </Text>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }} />
          )}
          {trip.packed ? <PackedBadge large={false} /> : null}
        </View>
      )}
    </View>
  );

  const body = (
    <>
      <HeroCollage tiles={trip.tiles} large={large} />
      {plate}
    </>
  );

  if (!onOpen) {
    return (
      <View accessibilityRole="summary" accessibilityLabel={cardLabel(trip)} style={{ flexShrink: 0 }}>
        {body}
      </View>
    );
  }

  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={TRIPS_COPY.open(trip.destination)}
      accessibilityHint={trip.dates ?? undefined}
      onPress={onOpen}
      style={{ flexShrink: 0 }}
      contentStyle={{ flex: 1, minWidth: 0 }}>
      {body}
    </PressableSurface>
  );
}

function cardLabel(trip: TripCardView): string {
  return [trip.destination, trip.dates, trip.packed ? TRIPS_COPY.packed : null].filter(Boolean).join(', ');
}

/** Canvas at 18% — the `canvasAlpha` step for a mark on an oxblood ground. */
function PackedBadge({ large }: { large: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: canvasAlpha(0.18),
        borderRadius: BADGE_RADIUS,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexShrink: 0,
      }}>
      <Text variant={large ? 'callout' : 'colophon'} style={{ color: theme.canvas }}>
        {TRIPS_COPY.packed}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The shelf card
// ---------------------------------------------------------------------------

function ShelfCard({
  trip,
  large,
  ground,
  thumb,
  onOpen,
}: {
  trip: TripCardView;
  large: boolean;
  /** Blush on the upcoming shelf; tray on the offline frame's cached rows. */
  ground: 'blush' | 'tray';
  thumb: number;
  onOpen: (() => void) | null;
}) {
  const theme = useTheme();

  const type = (
    <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: large ? 6 : 4 }}>
      <Text
        variant={large ? 'title' : 'plate'}
        numberOfLines={large ? undefined : 1}
        style={{ minWidth: 0, paddingBottom: large ? 4 : 2 }}>
        {trip.destination}
      </Text>
      {trip.dates ? (
        // The artifact sets this in clay. Clay is `text: false` (2.98:1), so it
        // is `muted` — the same quiet layer, one step down. Tracked caps at the
        // standard size, a plain line above the threshold. The colour goes
        // through `style` rather than a second `text-*` class, which NativeWind
        // would resolve by key order instead of intent.
        <Text variant={large ? 'callout' : 'eyebrow'} style={{ minWidth: 0, color: theme.muted }}>
          {trip.dates}
        </Text>
      ) : null}
    </View>
  );

  const inner = large ? (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      <CardCollage tiles={trip.tiles} large size={thumb} />
      {type}
    </View>
  ) : (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
      <View style={{ alignSelf: 'center', flexShrink: 0 }}>
        <CardCollage tiles={trip.tiles} large={false} size={thumb} />
      </View>
      {type}
      {onOpen ? (
        <SymbolView
          name="chevron.right"
          size={CHEVRON}
          tintColor={theme.accent}
          resizeMode="scaleAspectFit"
          style={{ alignSelf: 'center', flexShrink: 0, marginRight: 6 }}
        />
      ) : null}
    </View>
  );

  const style = {
    borderRadius: CARD_RADIUS,
    backgroundColor: ground === 'blush' ? theme.blush : theme.tray,
  };
  const contentStyle = {
    flex: 1,
    minWidth: 0,
    padding: large ? CARD_PAD_AX : CARD_PAD,
    minHeight: MIN_TAP_TARGET,
  };

  if (!onOpen) {
    return (
      <View accessibilityRole="summary" accessibilityLabel={cardLabel(trip)} style={style}>
        <View style={contentStyle}>{inner}</View>
      </View>
    );
  }

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={TRIPS_COPY.open(trip.destination)}
      accessibilityHint={trip.dates ?? undefined}
      onPress={onOpen}
      style={style}
      contentStyle={contentStyle}>
      {inner}
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// The past
// ---------------------------------------------------------------------------

function PastRow({ trip, last, onOpen }: { trip: PastTripView; last: boolean; onOpen: (() => void) | null }) {
  const theme = useTheme();

  const inner = (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: PAST_ROW_GAP,
        minHeight: MIN_TAP_TARGET,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.tray,
      }}>
      <View
        style={{
          width: PAST_THUMB,
          height: PAST_THUMB,
          borderRadius: PAST_THUMB_RADIUS,
          overflow: 'hidden',
          backgroundColor: theme.tray,
          flexShrink: 0,
        }}>
        <GarmentImage
          uri={trip.tile?.uri}
          contentFit="cover"
          transition={140}
          style={{ width: '100%', height: '100%' }}
          fallback={<View />}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        {/* The past reads in the grotesque, not the serif: the frames use the
            change of face to say "this one is behind you" without a word. */}
        <Text variant="callout" numberOfLines={1} style={{ minWidth: 0 }}>
          {trip.destination}
        </Text>
        {trip.dates ? <Text variant="label">{trip.dates}</Text> : null}
      </View>
    </View>
  );

  if (!onOpen) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={[trip.destination, trip.dates].filter(Boolean).join(', ')}>
        {inner}
      </View>
    );
  }

  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={TRIPS_COPY.open(trip.destination)}
      accessibilityHint={trip.dates ?? undefined}
      onPress={onOpen}
      contentStyle={{ flex: 1, minWidth: 0 }}>
      {inner}
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// Empty, offline, waiting
// ---------------------------------------------------------------------------

/**
 * The drawn suitcase.
 *
 * Four views and no image asset, because the artifact draws it as geometry and
 * a PNG would be a second thing to keep in step with the palette. The handle is
 * a bordered box with its bottom edge removed, which is how the frame draws it
 * too.
 */
function Suitcase() {
  const theme = useTheme();
  const stripe = (
    <View
      style={{
        width: CASE_STRIPE,
        height: CASE_STRIPE_HEIGHT,
        borderRadius: 2,
        backgroundColor: theme.blushRule,
      }}
    />
  );

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center' }}>
      <View
        style={{
          width: CASE_HANDLE_WIDTH,
          height: CASE_HANDLE_HEIGHT,
          borderWidth: CASE_BORDER,
          borderBottomWidth: 0,
          borderColor: theme.sand,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />
      <View
        style={{
          width: CASE_WIDTH,
          height: CASE_HEIGHT,
          borderRadius: CASE_RADIUS,
          borderWidth: CASE_BORDER,
          borderColor: theme.blushRule,
          backgroundColor: theme.blush,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}>
        {stripe}
        {stripe}
        {stripe}
      </View>
    </View>
  );
}

function EmptyBody() {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        paddingHorizontal: 28,
      }}>
      <Suitcase />
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center', paddingBottom: 3 }}>
          {TRIPS_COPY.emptyTitle}
        </Text>
        <Text variant="body" className="text-muted" style={{ textAlign: 'center', maxWidth: 270 }}>
          {TRIPS_COPY.emptyBody}
        </Text>
      </View>
    </View>
  );
}

/**
 * The refresh that did not land.
 *
 * `warning` is a FILL and the contrast record says INK goes on it, so the band
 * is the token at an alpha and every word on it is ink. The artifact's #7A5312
 * and #4A3208 are neither palette tokens nor legal as type under
 * `theme/contrast.ts`; ink is darker and passes.
 */
function OfflineBand({ cached }: { cached: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: warningAlpha(0.22), paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: 12, flexShrink: 0 }}>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: warningAlpha(0.35),
          borderRadius: BAND_RADIUS,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}>
        <View
          style={{
            width: BAND_DOT,
            height: BAND_DOT,
            borderRadius: BAND_DOT / 2,
            backgroundColor: theme.warning,
            flexShrink: 0,
          }}
        />
        <Text variant="eyebrow" style={{ color: theme.ink }}>
          {TRIPS_COPY.offlineKicker}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 2 }}>
        {TRIPS_COPY.offlineTitle}
      </Text>
      <Text variant="body" className="text-muted" style={{ maxWidth: 290 }}>
        {cached ? TRIPS_COPY.offlineBody : TRIPS_COPY.offlineBodyEmpty}
      </Text>
    </View>
  );
}

/** The pinned foot. One filled oxblood, and only on the two frames that have one. */
function FootAction({ label, large, onPress }: { label: string; large: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: large ? 22 : 4, flexShrink: 0 }}>
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.accent }}
        contentStyle={{
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: CTA_MIN_HEIGHT,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
        <Text variant={large ? 'heading' : 'body'} style={{ color: theme.canvas, textAlign: 'center' }}>
          {label}
        </Text>
      </PressableSurface>
    </View>
  );
}

/**
 * Waiting, drawn as the shapes that are coming — never a spinner.
 *
 * The card geometry is held exactly, so nothing moves when the rows land; that
 * is the whole point of the loading frame and the reason it is drawn from the
 * same constants as the real thing.
 */
function WaitingBody() {
  const theme = useTheme();
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: 8, flexShrink: 0 }}>
        <Skeleton style={{ width: 72, height: 26, borderRadius: EYEBROW_RADIUS }} />
      </View>

      <View style={{ flexShrink: 0 }}>
        <View style={{ flexDirection: 'row', gap: COLLAGE_GAP, height: HERO_COLLAGE_ROW }}>
          <Skeleton style={{ flex: 1, minWidth: 0 }} />
          <Skeleton style={{ flex: 1, minWidth: 0 }} delay={80} />
          <Skeleton style={{ flex: 1, minWidth: 0 }} delay={160} />
        </View>
        <View style={{ backgroundColor: theme.tray, paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 18, gap: 10 }}>
          <Skeleton style={{ width: '58%', height: 26, borderRadius: 8 }} />
          <Skeleton style={{ width: '44%', height: 14, borderRadius: 7 }} />
        </View>
      </View>

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 10, flexShrink: 0 }}>
        <Skeleton style={{ width: 104, height: 26, borderRadius: EYEBROW_RADIUS }} />
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: CARD_GAP, flexShrink: 0 }}>
        <Skeleton style={{ height: CARD_THUMB + CARD_PAD * 2, borderRadius: CARD_RADIUS }} />
        <Skeleton style={{ height: CARD_THUMB + CARD_PAD * 2, borderRadius: CARD_RADIUS }} delay={80} />
      </View>

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 10, flexShrink: 0 }}>
        <Skeleton style={{ width: 132, height: 14, borderRadius: 7 }} />
      </View>
      <View style={{ paddingHorizontal: GUTTER, flexShrink: 0 }}>
        <Skeleton style={{ height: PAST_THUMB, borderRadius: PAST_THUMB_RADIUS }} />
        <View style={{ height: 22 }} />
        <Skeleton style={{ height: PAST_THUMB, borderRadius: PAST_THUMB_RADIUS }} delay={80} />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function TripsListBody({ view, large = false }: { view: TripsListView; large?: boolean }) {
  const empty =
    !view.loading && !view.offline && view.next === null && view.upcoming.length === 0 && view.past.length === 0;

  /** The offline frame flattens the shelf: one register, newest intent first. */
  const cached = [view.next, ...view.upcoming].filter((t): t is TripCardView => t !== null);

  const open = (id: string) => {
    const handler = view.onOpenTrip;
    return handler ? () => handler(id) : null;
  };

  return (
    <View className="flex-1 bg-canvas">
      <Masthead view={view} large={large} empty={empty} />

      {empty ? (
        <EmptyBody />
      ) : (
        /*
          `flex: 1, minHeight: 0` is load-bearing, not decoration — the same
          hazard the event poster records: with no flex in a flex column a
          ScrollView measures against its CONTENT rather than the viewport, so
          at the accessibility sizes the page grows past the screen, the scroll
          view believes its frame is that tall, and the foot is clipped with
          nothing to scroll.
        */
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}>
          {view.loading ? (
            <WaitingBody />
          ) : view.offline ? (
            <>
              <OfflineBand cached={cached.length > 0} />
              {cached.length > 0 ? (
                <>
                  <PaperEyebrow label={TRIPS_COPY.cached} />
                  <View style={{ paddingHorizontal: GUTTER, gap: CARD_GAP, flexShrink: 0 }}>
                    {cached.map((trip) => (
                      <ShelfCard
                        key={trip.id}
                        trip={trip}
                        large={large}
                        ground="tray"
                        thumb={CACHED_THUMB}
                        onOpen={open(trip.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <>
              {view.next ? (
                <>
                  <PlateEyebrow label={TRIPS_COPY.nextUp} large={large} />
                  <HeroCard trip={view.next} large={large} onOpen={open(view.next.id)} />
                </>
              ) : null}

              {view.upcoming.length > 0 ? (
                <>
                  <View style={{ height: view.next ? 16 : 0 }} />
                  <PlateEyebrow label={view.laterLabel} large={large} />
                  <View style={{ paddingHorizontal: GUTTER, gap: CARD_GAP, flexShrink: 0 }}>
                    {view.upcoming.map((trip) => (
                      <ShelfCard
                        key={trip.id}
                        trip={trip}
                        large={large}
                        ground="blush"
                        thumb={CARD_THUMB}
                        onOpen={open(trip.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {view.past.length > 0 ? (
                <>
                  <PaperEyebrow label={TRIPS_COPY.past} />
                  <View style={{ paddingHorizontal: GUTTER, flexShrink: 0 }}>
                    {view.past.map((trip, i) => (
                      <PastRow
                        key={trip.id}
                        trip={trip}
                        last={i === view.past.length - 1}
                        onOpen={open(trip.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {/* The foot. Pinned, and drawn only where the frame draws it: the empty
          state's one way forward, and the offline state's one way to retry. The
          default frame's action is the masthead pill, so the foot is absent —
          the accent budget is one filled oxblood per state and it is spent
          exactly once in each. */}
      {empty ? <FootAction label={TRIPS_COPY.plan} large={large} onPress={view.onPlanTrip} /> : null}
      {view.offline ? <FootAction label={TRIPS_COPY.tryAgain} large={large} onPress={view.onRetry} /> : null}
    </View>
  );
}

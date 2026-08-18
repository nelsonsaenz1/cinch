import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { ExampleTrip } from '@/components/plan/plan-examples';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  CHIP_GAP,
  CHIP_GAP_AX,
  CHIP_MIN_HEIGHT,
  CHIP_MIN_HEIGHT_AX,
  CHIP_RADIUS,
  CHIP_RADIUS_AX,
  CHROME_RADIUS,
  CHROME_RADIUS_AX,
  CHROME_TARGET,
  CHROME_TARGET_AX,
  CTA_MIN_HEIGHT,
  CTA_MIN_HEIGHT_AX,
  CTA_RADIUS,
  DOT_CURRENT_WIDTH,
  DOT_GAP,
  DOT_GAP_AX,
  DOT_HEIGHT,
  DOT_HEIGHT_AX,
  DOT_SIZE,
  DOT_SIZE_AX,
  FIELD_DOT,
  FIELD_MIN_HEIGHT,
  FIELD_RADIUS,
  MARK_DOT,
  MARK_RADIUS,
  MATCH_WELL,
  MATCH_WELL_RADIUS,
  NEW_TRIP_COPY,
  PLACE_CARD_RADIUS,
  PLACE_CARD_RADIUS_AX,
  type DotState,
} from '@/features/plan/new-trip-spec';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * New Trip — the stepped card flow. The drawn surface. Redesign 05.
 *
 * Split from the questionnaire's live hooks for the reason every other rebuilt
 * page in this repo is: a screen that reaches for a geocoder, a climate archive
 * and the social graph at the top cannot be POSED, and a state nobody can open
 * is a state nobody checks. Everything here is a function of the `view` object,
 * so `dev-nt-01…05` draw the accepted frames out of `new-trip-fixtures.ts`
 * without a session, a network, or a single row on the other end.
 *
 * ── WHAT THE FRAMES ASK FOR ──────────────────────────────────────────────────
 *
 * 1. Chrome: a 44pt back/close target on the left, three progress dots centred,
 *    and a matching blank on the right so the dots sit on the page's midline
 *    rather than the space left over.
 * 2. One question per card, set in the serif, with nothing above it on the
 *    first card and the answered destination riding above it on the rest.
 * 3. Big targets: a 60pt field, 48pt chips, a 56pt filled CTA on the foot.
 * 4. Imagery where the data allows: the destination's weather mark, drawn only
 *    once there is a real climate band to draw.
 * 5. Above the Dynamic Type threshold the whole reason for one-question-per-card
 *    pays off — the chips stop wrapping and stack full-width, the card scrolls,
 *    and the CTA stays pinned on its own bordered foot.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DRAW ───────────────────────────────────────
 *
 * The default frame carries a "FROM YOUR CALENDAR" block — two events inside
 * the trip window, one pre-checked. `Trip` has no field for an event and the
 * packing engine reads only the vibes, the day parts and the dates, so a
 * checkbox there would toggle nothing: a dead control, which this codebase has
 * a standing rule against (see the withheld chevron in `trips-list-body.tsx`).
 * It is listed in the build report rather than drawn inert.
 *
 * ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────
 *
 * It does not read a plan, present a placement, or decide who may pack. The
 * `PackingAccess` gate is checked in `PackingTab` BEFORE this component is
 * rendered at all, and it fails closed; nothing here can be reached by a free
 * account, so nothing here needs to know what an account is.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────
 *
 * Not one hex. The artifact's #B08A76 eyebrows and dates are `muted`, because
 * clay is 2.98:1 and `theme/contrast.ts` declares it `text: false`. Its
 * #E3CFC4 completed dot is `blushRule`, its #EAE5DB pending dot is `sand`, and
 * the selected chip is `accent` with `canvas` on it.
 */

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type NewTripChip = {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
};

export type NewTripMatch = {
  key: string;
  name: string;
  /** "Ciudad de México, Mexico", or the climate band. Absent is normal. */
  sub: string | null;
  onPick: () => void;
};

/** The answered destination, riding above questions two and three. */
export type NewTripPlaceCard = {
  name: string;
  /** `10–14 Sep · 4 nights`, or null before the dates are answered. */
  dates: string | null;
  /** `24° / 15°`, or null when no climate band resolved. Never a guess. */
  mark: string | null;
};

export type NewTripView = {
  /** 0-based. The dots derive from it; see `progressDots`. */
  index: number;
  total: number;
  /** The serif line. From `TRIP_QUESTIONS`, never composed here. */
  question: string;
  /** Null on the first card, where the chrome draws a close bar instead. */
  onBack: (() => void) | null;
  /** Leaving the first card backwards abandons the flow, as it does today. */
  onClose: (() => void) | null;

  /** The pinned foot. `Next` on the first two cards, the finish on the last. */
  ctaLabel: string;
  ctaEnabled: boolean;
  onCta: () => void;

  /** Card one. Null on every other card. */
  destination: {
    query: string;
    onQuery: (next: string) => void;
    /** True once a geocoder answer was chosen — the field's ring goes accent. */
    chosen: boolean;
    matches: NewTripMatch[];
    recents: NewTripMatch[];
  } | null;

  /** Cards two and three, once there is something true to restate. */
  placeCard: NewTripPlaceCard | null;

  /** Card three. Null on every other card. */
  shape: {
    purposes: NewTripChip[];
    companions: NewTripChip[];
    parts: NewTripChip[];
    /** Empty for an account with no friends yet — never a placeholder row. */
    friends: NewTripChip[];
    /** `looksSentence` — looks ASKED FOR, never pieces predicted. */
    arithmetic: string;
  } | null;
};

// ---------------------------------------------------------------------------
// The chrome
// ---------------------------------------------------------------------------

/**
 * One progress dot.
 *
 * Three states, not two: behind, here, ahead. The frames give the completed
 * steps the rose tint and the pending ones sand, which is the only thing on the
 * page that says how much is left now that the "2 of 4" line is gone. Colour is
 * not carrying it alone — the current dot is also three times as wide — so the
 * position survives a greyscale display and any colour-vision deficiency.
 */
function Dot({ state, large }: { state: DotState; large: boolean }) {
  const theme = useTheme();
  const height = large ? DOT_HEIGHT_AX : DOT_HEIGHT;
  const width =
    state === 'current' ? DOT_CURRENT_WIDTH : large ? DOT_SIZE_AX : DOT_SIZE;
  const background =
    state === 'current' ? theme.accent : state === 'done' ? theme.blushRule : theme.sand;

  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: background }} />;
}

/**
 * The flow's own header — target, dots, and a blank the width of the target.
 *
 * The blank is not padding. Without it the dots centre inside the space LEFT
 * OVER after the back button, which puts them visibly right of the page's
 * midline; the frames centre them on the page.
 */
function Chrome({
  view,
  dots,
  large,
}: {
  view: NewTripView;
  dots: DotState[];
  large: boolean;
}) {
  const theme = useTheme();
  const target = large ? CHROME_TARGET_AX : CHROME_TARGET;
  const onPress = view.onBack ?? view.onClose;
  const isBack = view.onBack !== null;

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: large ? 8 : 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
      {onPress ? (
        <PressableSurface
          fill
          accessibilityRole="button"
          accessibilityLabel={isBack ? NEW_TRIP_COPY.back : NEW_TRIP_COPY.close}
          onPress={onPress}
          hitSlop={8}
          style={{
            width: target,
            height: target,
            borderRadius: large ? CHROME_RADIUS_AX : CHROME_RADIUS,
            backgroundColor: theme.tray,
            flexShrink: 0,
          }}
          contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView
            name={isBack ? 'chevron.left' : 'minus'}
            size={large ? 19 : 17}
            tintColor={theme.ink}
            resizeMode="scaleAspectFit"
          />
        </PressableSurface>
      ) : (
        <View style={{ width: target, height: target, flexShrink: 0 }} />
      )}

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${view.index + 1} of ${view.total}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: large ? DOT_GAP_AX : DOT_GAP }}>
        {dots.map((state, i) => (
          <Dot key={i} state={state} large={large} />
        ))}
      </View>

      <View style={{ width: target, flexShrink: 0 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The question, and the destination riding above it
// ---------------------------------------------------------------------------

function Question({ text, hero, large }: { text: string; hero: boolean; large: boolean }) {
  return (
    <View style={{ paddingHorizontal: large ? 22 : 24, paddingTop: hero ? 24 : 8, paddingBottom: large ? 16 : 14 }}>
      {/*
        NO `trim`. The question WRAPS — "What's happening there?" already does
        at the accessibility sizes — and `trim` is single-line geometry: it
        subtracts a margin sized for one line from a box holding two. A few
        points of tail under the last line is what the frames give instead.
      */}
      <Text variant={hero || large ? 'display' : 'title'} accessibilityRole="header" style={{ paddingBottom: 4 }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The answered destination, with its weather mark.
 *
 * The mark is the brief's "imagery where the data allows": a filled dot and a
 * high/low, drawn ONLY when a real climate band came back. There is no
 * placeholder temperature and no guessed one — a destination whose archive read
 * failed shows the place and the dates, which are answers the user gave.
 */
function PlaceCard({ card, large }: { card: NewTripPlaceCard; large: boolean }) {
  const theme = useTheme();

  const type = (
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text variant={large ? 'title' : 'plate'} numberOfLines={large ? undefined : 2} style={{ paddingBottom: 2 }}>
        {card.name}
      </Text>
      {card.dates ? (
        // The artifact sets this in clay. Clay is `text: false` (2.98:1), so it
        // is `muted` — the same quiet layer, one step down.
        <Text variant={large ? 'callout' : 'eyebrow'} style={{ minWidth: 0, color: theme.muted }}>
          {card.dates}
        </Text>
      ) : null}
      {large && card.mark ? (
        <Text variant="callout" style={{ color: theme.muted }}>
          {card.mark}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 14, flexShrink: 0 }}>
      <View
        style={{
          backgroundColor: theme.blush,
          borderRadius: large ? PLACE_CARD_RADIUS_AX : PLACE_CARD_RADIUS,
          padding: large ? 18 : 14,
          paddingHorizontal: large ? 18 : 16,
          flexDirection: large ? 'column' : 'row',
          alignItems: large ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
        {type}
        {/* Above the threshold the mark has already been folded into the type
            block above — a 12pt-padded pill beside 34pt serif is a stamp on a
            poster, and the AX frame drops it for a plain line. */}
        {!large && card.mark ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              backgroundColor: theme.canvas,
              borderRadius: MARK_RADIUS,
              paddingHorizontal: 12,
              paddingVertical: 9,
              flexShrink: 0,
            }}>
            <View
              style={{
                width: MARK_DOT,
                height: MARK_DOT,
                borderRadius: MARK_DOT / 2,
                backgroundColor: theme.warning,
              }}
            />
            <Text variant="callout">{card.mark}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card one — the one keyboard in the flow
// ---------------------------------------------------------------------------

function DestinationCard({
  destination,
  large,
}: {
  destination: NonNullable<NewTripView['destination']>;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, flexShrink: 0 }}>
        <View
          style={{
            minHeight: FIELD_MIN_HEIGHT,
            borderRadius: FIELD_RADIUS,
            backgroundColor: theme.tray,
            borderWidth: 1.5,
            // The answered field darkens its border rather than growing a
            // checkmark — `ruleStrong`'s own documented job, and the frames
            // take it all the way to `accent` once a place is chosen.
            borderColor: destination.chosen ? theme.accent : 'transparent',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}>
          <View
            style={{
              width: FIELD_DOT,
              height: FIELD_DOT,
              borderRadius: FIELD_DOT / 2,
              borderWidth: 2,
              borderColor: destination.chosen ? theme.accent : theme.muted,
              flexShrink: 0,
            }}
          />
          <TextInput
            value={destination.query}
            onChangeText={destination.onQuery}
            placeholder={NEW_TRIP_COPY.destinationPlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={NEW_TRIP_COPY.destinationLabel}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, minWidth: 0, color: theme.ink, fontSize: large ? 22 : 19 }}
          />
        </View>
      </View>

      {destination.matches.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, flexShrink: 0 }}>
          {destination.matches.map((match, i) => (
            <MatchRow
              key={match.key}
              match={match}
              last={i === destination.matches.length - 1}
              large={large}
            />
          ))}
        </View>
      ) : null}

      {/* "Been before" — the last few real destinations, absent for a first
          trip. Never an invented Lisbon. */}
      {destination.recents.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 22, gap: 12, flexShrink: 0 }}>
          <Text variant="eyebrow">{NEW_TRIP_COPY.beenBefore}</Text>
          <View
            style={{
              flexDirection: large ? 'column' : 'row',
              flexWrap: large ? 'nowrap' : 'wrap',
              gap: large ? CHIP_GAP_AX : 8,
            }}>
            {destination.recents.map((place) => (
              <Chip
                key={place.key}
                chip={{ key: place.key, label: place.name, selected: false, onToggle: place.onPick }}
                ground="blush"
                large={large}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

/** One geocoder answer, drawn with the well the frames put beside it. */
function MatchRow({ match, last, large }: { match: NewTripMatch; last: boolean; large: boolean }) {
  const theme = useTheme();
  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={[match.name, match.sub].filter(Boolean).join(', ')}
      haptic="selection"
      onPress={match.onPick}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: MIN_TAP_TARGET,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.hairline,
      }}>
      <View
        style={{
          width: MATCH_WELL,
          height: MATCH_WELL,
          borderRadius: MATCH_WELL_RADIUS,
          backgroundColor: theme.blush,
          flexShrink: 0,
        }}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant={large ? 'heading' : 'body'} numberOfLines={large ? undefined : 1} style={{ minWidth: 0 }}>
          {match.name}
        </Text>
        {match.sub ? <Text variant="label">{match.sub}</Text> : null}
      </View>
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// The chip — the flow's one repeated target
// ---------------------------------------------------------------------------

/**
 * A purpose, a companion, a day part.
 *
 * SELECTION IS A FILL NOW, which reverses PK-02's ring-and-tick. The one-
 * oxblood-per-screen law that made a filled chip unreadable was repealed by
 * §1 of the directive — "color becomes structural, not ceremonial" — and the
 * frames fill the chosen chips oxblood. The old objection is still answered:
 * `accent` against `tray` is a large luminance step, so the state survives a
 * greyscale display and any colour-vision deficiency, and the label steps up
 * from `callout` to `heading` weight-wise through the variant change at the
 * accessibility sizes. `accessibilityState.selected` carries it to VoiceOver
 * regardless of any of that.
 *
 * 48pt of real geometry, not `hitSlop` — a wrapped grid of chips with
 * overlapping slop is a grid that lies about what was tapped.
 */
function Chip({
  chip,
  ground = 'tray',
  large,
}: {
  chip: NewTripChip;
  /** `blush` for the "been before" row, which is a shortcut rather than a state. */
  ground?: 'tray' | 'blush';
  large: boolean;
}) {
  const theme = useTheme();
  const base = ground === 'blush' ? theme.blush : theme.tray;

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityState={{ selected: chip.selected }}
      accessibilityLabel={chip.label}
      haptic="selection"
      onPress={chip.onToggle}
      style={{
        borderRadius: large ? CHIP_RADIUS_AX : CHIP_RADIUS,
        backgroundColor: chip.selected ? theme.accent : base,
        alignSelf: large ? 'stretch' : 'auto',
        flexShrink: large ? 1 : 0,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        minHeight: large ? CHIP_MIN_HEIGHT_AX : CHIP_MIN_HEIGHT,
        alignItems: large ? 'flex-start' : 'center',
        justifyContent: 'center',
        paddingHorizontal: large ? 18 : 17,
        paddingVertical: large ? 14 : 8,
      }}>
      <Text
        variant={large ? 'heading' : 'callout'}
        style={{ color: chip.selected ? theme.canvas : theme.ink }}>
        {chip.label}
      </Text>
    </PressableSurface>
  );
}

/** A labelled group of chips — the third card's own structure. */
function ChipGroup({
  label,
  note,
  chips,
  large,
}: {
  label: string | null;
  note?: string;
  chips: NewTripChip[];
  large: boolean;
}) {
  if (!chips.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {label ? <Text variant="eyebrow">{label}</Text> : null}
      {note ? <Text variant="label">{note}</Text> : null}
      <View
        style={{
          flexDirection: large ? 'column' : 'row',
          flexWrap: large ? 'nowrap' : 'wrap',
          gap: large ? CHIP_GAP_AX : CHIP_GAP,
        }}>
        {chips.map((chip) => (
          <Chip key={chip.key} chip={chip} large={large} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card three
// ---------------------------------------------------------------------------

/**
 * What's happening there — and, under their own labels, who with and which
 * parts of the day.
 *
 * The frames draw one grid of purpose chips here. Two more groups are on this
 * card because the answers behind them did not go anywhere: `trips.companions`
 * is `not null` and `trips.parts` is constrained to one-to-four entries, so a
 * flow that stopped asking either would write a row Postgres refuses. Asking
 * them here, quietly labelled, is the smallest honest way to keep three dots.
 */
function ShapeCard({ shape, large }: { shape: NonNullable<NewTripView['shape']>; large: boolean }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: 22, flexShrink: 0 }}>
      <ChipGroup label={null} chips={shape.purposes} large={large} />
      <ChipGroup label={NEW_TRIP_COPY.whoWith} chips={shape.companions} large={large} />
      <ChipGroup label={NEW_TRIP_COPY.dayParts} chips={shape.parts} large={large} />
      <ChipGroup
        label={NEW_TRIP_COPY.friends}
        note={NEW_TRIP_COPY.friendsNote}
        chips={shape.friends}
        large={large}
      />

      {/* The running arithmetic — how the flow stays honest about what it is
          about to produce. The LOOK count, and nothing else: a predicted piece
          count would be a promise made before the search that produces it. */}
      <Text variant="body" className="text-muted">
        {shape.arithmetic}
      </Text>

      <Text variant="note">{NEW_TRIP_COPY.retention}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

/**
 * The pinned CTA.
 *
 * Full-width, 56pt, filled — §1's "buttons with presence" — and the disabled
 * state is a real one rather than an opacity: sand ground, `muted` label, and
 * `accessibilityState.disabled` so VoiceOver says so too. `haptic="commit"`
 * fires only when it actually acts, because `PressableSurface` suppresses the
 * tick while disabled.
 */
export function FootCta({
  label,
  enabled,
  onPress,
  large,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  large: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled}
      haptic="commit"
      onPress={onPress}
      style={{
        borderRadius: CTA_RADIUS,
        backgroundColor: enabled ? theme.accent : theme.sand,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: large ? CTA_MIN_HEIGHT_AX : CTA_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
      <Text
        variant={large ? 'heading' : 'body'}
        style={{ color: enabled ? theme.canvas : theme.muted, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function Foot({ view, large }: { view: NewTripView; large: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: large ? 12 : 14,
        paddingBottom: large ? 10 : 8,
        // The AX frame separates the foot from the card, because at that size
        // the last chip sits directly under the button.
        borderTopWidth: large ? 1 : 0,
        borderTopColor: theme.tray,
        flexShrink: 0,
      }}>
      <FootCta label={view.ctaLabel} enabled={view.ctaEnabled} onPress={view.onCta} large={large} />
    </View>
  );
}

export function NewTripBody({
  view,
  dots,
  datePicker,
  large = false,
}: {
  view: NewTripView;
  /** From `progressDots(view.index, view.total)` — computed by the spec, not here. */
  dots: DotState[];
  /**
   * The calendar, handed in rather than built.
   *
   * `DateRangePicker` owns a month grid, a selection gesture and its own state,
   * and none of that is posable from a fixture. Passing it as a slot keeps this
   * file a pure function of `view` — the dev routes hand in an inert stand-in
   * and still draw the real card geometry around it.
   */
  datePicker?: ReactNode;
  large?: boolean;
}) {
  const hero = view.destination !== null && view.placeCard === null;

  return (
    <View className="flex-1 bg-canvas">
      <Chrome view={view} dots={dots} large={large} />

      {/*
        `flex: 1, minHeight: 0` is load-bearing, not decoration — the same
        hazard the event poster and the trips shelf both record: with no flex in
        a flex column a ScrollView measures against its CONTENT rather than the
        viewport, so at the accessibility sizes the card grows past the screen,
        the scroll view believes its frame is that tall, and the pinned foot is
        clipped with nothing to scroll.
      */}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {view.placeCard ? <PlaceCard card={view.placeCard} large={large} /> : null}

        <Question text={view.question} hero={hero} large={large} />

        {view.destination ? (
          <>
            <DestinationCard destination={view.destination} large={large} />
            {/* PL-C3 — what a packed trip looks like, on the card where a
                first-time subscriber is being asked to describe one. Inert and
                labelled: no destination weather call, no closet read, no
                packing computation, and nothing in it is the reader's own data.
                The accepted frames do not draw it; it is kept because the
                correction that put it here is a product rule rather than a
                layout preference, and `tests/example-content.test.ts` pins it.
                Listed in the build report as an addition beyond the frame. */}
            <View style={{ paddingHorizontal: GUTTER, paddingTop: 28 }}>
              <ExampleTrip />
            </View>
          </>
        ) : null}

        {datePicker ? <View style={{ paddingHorizontal: GUTTER }}>{datePicker}</View> : null}

        {view.shape ? <ShapeCard shape={view.shape} large={large} /> : null}
      </ScrollView>

      <Foot view={view} large={large} />
    </View>
  );
}

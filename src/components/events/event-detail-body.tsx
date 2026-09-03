import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentFallback } from '@/components/media/garment-fallback';
import type { Oklch } from '@/lib/color';
import { GarmentImage } from '@/components/media/garment-image';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { initialsFor } from '@/components/ui/avatar';
import {
  CHIP_AVATAR,
  CHIP_AVATAR_AX,
  CHIP_GAP,
  CHIP_MIN_HEIGHT_AX,
  CHIP_RADIUS,
  CHIP_RADIUS_AX,
  CTA_MIN_HEIGHT,
  CTA_MIN_HEIGHT_AX,
  CTA_RADIUS,
  CTA_SECONDARY_MIN_HEIGHT,
  DOT,
  EVENT_DETAIL_COPY,
  FOOT_PAD_BOTTOM,
  HERO_BUTTON,
  HERO_BUTTON_AX,
  HERO_BUTTON_RADIUS,
  HERO_BUTTON_RADIUS_AX,
  HERO_PAD_BOTTOM,
  HERO_PAD_BOTTOM_AX,
  HERO_TEXT_INSET,
  NAV_ROW_MIN_HEIGHT,
  NOTICE_DOT,
  NOTICE_RADIUS,
  OPTION_DOT,
  OPTION_DOT_ACTIVE,
  PLATE_GAP,
  PLATE_ROW,
  PLATE_ROW_AX,
  optionPosition,
  primaryGround,
  type EventHeaderBlock,
  type RosterChip,
  type RosterOverflow,
} from '@/features/events/event-detail-spec';
import { GUTTER, MIN_TAP_TARGET, canvasAlpha, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Event Detail — the poster. The drawn surface. Redesign 03.
 *
 * Split from the route for the reason every other rebuilt page in this repo is:
 * a screen that reaches for an event, its members, its board and a forecast at
 * the top cannot be POSED, and a state nobody can open is a state nobody
 * checks. Everything here is a function of the `view` object, so `dev-ed-01…06`
 * draw the six accepted frames out of `event-detail-fixtures.ts` without a
 * session, a network, or a single row on the other end.
 *
 * ── WHAT THE FRAMES ASK FOR ───────────────────────────────────────────────
 *
 * The event as a POSTER, in this order and nothing between:
 *
 *   1. a warm tinted band — oxblood for a settled evening, clay for one whose
 *      venue nobody has named — carrying the serif event name, with the venue
 *      and the date set small beneath it, and the two round-rect targets that
 *      bracket it: back, and the overflow menu;
 *   2. `Your look` with its `Change` action, then the planned look as the
 *      dominant image plate, edge to edge;
 *   3. `Going`, and the roster as avatar CHIPS;
 *   4. the logistics as ONE quiet line behind a clay bead;
 *   5. the RSVP as two tinted buttons, and one row down into comments and
 *      outfit voting.
 *
 * ── WHAT THE POSTER DOES NOT DRAW, AND WHERE IT WENT ──────────────────────
 *
 * The When and Where rows, the reservation link, `Every option`, `Table talk`,
 * `Invite more people`, and the page's one destructive line. Every one of them
 * survives; none of them is a row on the poster any more. The first two became
 * the line under the name and the quiet line behind the bead; the rest are the
 * overflow menu, which the artifact's own caption places there in as many
 * words ("report lives in the header menu"). The menu is one tap, and the
 * routes behind it are unchanged.
 *
 * ── LARGE TYPE ────────────────────────────────────────────────────────────
 *
 * `large` is the accepted AX frame, not a shrunken version of the standard one.
 * The band's line splits so the venue takes its own row; the plate sheds its
 * third well and takes one row; the chips stop wrapping and stack full-width;
 * the RSVP buttons stack. Nothing is capped, truncated or scaled below its
 * documented size — height is allowed and the middle of the page scrolls.
 *
 * The one departure from the AX frame is a keeping rather than a change: the
 * frame ran out of its 852pt canvas before the logistics line and the comments
 * row, and this draws both, inside the scrolling region. Dropping an
 * affordance at a type size IS the truncation the packet forbids, just spelled
 * with a control instead of an ellipsis.
 *
 * ── COLOUR ────────────────────────────────────────────────────────────────
 *
 * Not one hex here. The artifact paints eleven across the six frames and every
 * one is a palette token or a token at an alpha: the band's translucent
 * buttons and its date line are `canvas` at 14% and 70% over the ground, the
 * failure band is `warning` at 22%, and the plate's four greys are `sand`,
 * `tray` and `canvas`. Clay carries NO type on this page — `theme/contrast.ts`
 * declares `accentWarm` 2.98:1 and `text: false` — so the artifact's clay
 * eyebrows and its clay "6" are set in `muted`, which is the same quiet layer
 * one step darker.
 */

/**
 * One option in the chooser.
 *
 * Two kinds of thing wear the same shape here, and deliberately: a look
 * ALREADY ON THE BOARD (`posted`, which friends can see and vote on) and one
 * the engine has suggested for this occasion (which nobody but the reader can
 * see until she puts it there). They are drawn identically because they are the
 * same question — "is this what I am wearing?" — and the only difference the
 * card states is the one that matters, which is whether anybody else can see it
 * yet.
 */
/**
 * One cell of a look's plate.
 *
 * `uri` alone until UX #62: a garment with no cutout produced an empty sand
 * rectangle, and three of them produced a board where every look was the same
 * picture. The label and the colour are what the well says INSTEAD of the
 * photograph — both facts the route already has on the `Garment` it builds the
 * option from, neither of them invented here.
 */
export type EventLookTile = {
  /** The signed render, in the usual plate → cutout → thumbnail order. */
  uri?: string;
  /** "Shearling coat" — the tagger's word, or the bucket. */
  label: string;
  /** The piece's first colour, for the swatch. Null for an untagged piece. */
  color: { oklch: Oklch } | null;
};

export type EventLookOption = {
  id: string;
  /** The look's own name. Null when nothing has named it. */
  label: string | null;
  tiles: EventLookTile[];
  /** On the board: published through `event_outfit_posts`, and votable. */
  posted: boolean;
  /** Picks so far. Null for a suggestion — a look nobody can see cannot be picked. */
  votes: number | null;
  /** Publish this suggestion. Null once it is on the board, or when it may not be. */
  onAdd: (() => void) | null;
  /** Re-compose a posted look. Null while locked, cancelled, or for a suggestion. */
  onChange: (() => void) | null;
  /** Out of the app — the share sheet. Null when there is nothing to send. */
  onShare: (() => void) | null;
  /** A publish is in flight for this option. */
  busy?: boolean;
};

export type EventLookChooser =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; options: EventLookOption[] };

/** The reader's own standing, as the foot draws it. */
export type RsvpStanding = 'going' | 'declined' | null;

export type EventDetailView = {
  /** The whole poster is waiting. The band still paints from the cached name. */
  loading: boolean;
  tone: 'accent' | 'clay';
  title: string;
  /** The structured header stack — `headerBlock`'s output, composed upstream. */
  header: EventHeaderBlock;
  /**
   * Opens the reservation, when there is one to open — the same URL the
   * overflow menu offers. Makes the band's venue line tappable; null leaves
   * it plain type.
   */
  onReservation: (() => void) | null;

  /** The 1–3 chooser, in Today's grammar. */
  looks: EventLookChooser;
  /** The empty frame's serif headline and its one supporting line. */
  empty: { title: string; body: string | null } | null;

  chips: RosterChip[];
  overflow: RosterOverflow | null;
  /** The empty frame's quiet chip. Drawn only when nobody else has answered. */
  noReplies: boolean;

  logistics: string | null;

  /**
   * The RSVP pair, or null for someone it is not a question for — the host,
   * and anyone reading a cancelled occasion.
   */
  rsvp: { standing: RsvpStanding; busy: boolean } | null;
  /** The last reply failed. The foot becomes the band and one retry. */
  failed: boolean;
  /** `Plan a look` — present when the reader could plan one and has not. */
  onPlanLook: (() => void) | null;
  /** Null hides the row entirely (an invitee has no thread to read yet). */
  commentCount: number | null;

  /** The cancellation band, and anything else the route must not lose. */
  notice: ReactNode | null;

  onBack: () => void;
  onMenu: () => void;
  onRsvp: (response: 'joined' | 'declined') => void;
  onRetry: () => void;
  onComments: () => void;
};

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

/** A 44pt target on the band — canvas at 14%, the `canvasAlpha` step for a
 *  control's ground on a dark field. */
function BandButton({
  label,
  glyph,
  large,
  onPress,
}: {
  label: string;
  glyph: 'chevron.left' | 'ellipsis';
  large: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const size = large ? HERO_BUTTON_AX : HERO_BUTTON;

  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: large ? HERO_BUTTON_RADIUS_AX : HERO_BUTTON_RADIUS,
        backgroundColor: canvasAlpha(0.14),
      }}
      contentStyle={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView
        name={glyph}
        size={large ? 17 : 15}
        tintColor={theme.canvas}
        resizeMode="scaleAspectFit"
      />
    </PressableSurface>
  );
}

function Band({ view, large }: { view: EventDetailView; large: boolean }) {
  const theme = useTheme();
  const ground = view.tone === 'accent' ? theme.accent : theme.accentWarm;

  return (
    <View
      style={{
        backgroundColor: ground,
        paddingBottom: large ? HERO_PAD_BOTTOM_AX : HERO_PAD_BOTTOM,
        flexShrink: 0,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: large ? 4 : 8,
          flexShrink: 0,
        }}>
        <BandButton
          label={EVENT_DETAIL_COPY.back}
          glyph="chevron.left"
          large={large}
          onPress={view.onBack}
        />
        {/* The loading frame draws the back affordance alone: there is nothing
            for a menu to act on until the occasion has landed. */}
        {view.loading ? null : (
          <BandButton
            label={EVENT_DETAIL_COPY.menu}
            glyph="ellipsis"
            large={large}
            onPress={view.onMenu}
          />
        )}
      </View>

      {/*
        THE STRUCTURED HEADER — founder ask, 2026-08-21, superseding the
        03-event-detail brief's flat band with its one squeezed poster line.
        The occasion sits as an eyebrow above the serif name; beneath the name
        a tidy stack: the date-and-time line, the venue (tappable when there
        is a reservation behind it) with its address on the next line, and
        the dress code and party size as quiet marks. The tinted band, its
        `heroTone` logic and the back/ellipsis row are untouched — this is a
        reorganisation inside the existing design system. Place imagery is
        deliberately absent: no image exists in the schema, and maps or place
        photos are native-module territory (deferred; see BUILD-LEDGER).
      */}
      <View style={{ paddingHorizontal: HERO_TEXT_INSET, gap: 10 }}>
        {view.header.eyebrow ? (
          <Text variant="eyebrow" numberOfLines={large ? undefined : 1} style={{ color: canvasAlpha(0.7) }}>
            {view.header.eyebrow}
          </Text>
        ) : null}
        {/*
          NO `trim`. The poster's name WRAPS — it does so at the default size in
          the accepted frame, over two lines — and `trim` is single-line
          geometry: it subtracts a margin sized for one line from a box holding
          two, which pulls the continuation under whatever follows and is
          exactly the failure `detail-layout.ts` was written about. The frames
          replace it with the opposite instruction, a few points of tail under
          the last line so the descenders clear.
        */}
        <Text
          variant="display"
          accessibilityRole="header"
          style={{ color: theme.canvas, paddingBottom: large ? 6 : 4 }}>
          {view.title}
        </Text>

        {view.loading ? (
          <Skeleton style={{ height: 13, width: '58%', borderRadius: 7 }} />
        ) : (
          // One composition at every size — each fact owns its line already,
          // so large type changes the variant, never the arrangement.
          <View style={{ gap: large ? 4 : 2 }}>
            <Text variant={large ? 'callout' : 'label'} style={{ color: canvasAlpha(0.7) }}>
              {view.header.dateLine}
            </Text>
            {view.header.venue ? (
              view.onReservation ? (
                <PressableSurface
                  fill
                  accessibilityRole="link"
                  accessibilityLabel={view.header.venue}
                  accessibilityHint="Opens the reservation"
                  onPress={view.onReservation}
                  hitSlop={8}
                  style={{ alignSelf: 'flex-start' }}
                  contentStyle={{ minHeight: MIN_TAP_TARGET, minWidth: 0, justifyContent: 'center' }}>
                  <Text
                    variant={large ? 'callout' : 'label'}
                    style={{ color: theme.canvas, textDecorationLine: 'underline' }}>
                    {view.header.venue}
                  </Text>
                </PressableSurface>
              ) : (
                <Text variant={large ? 'callout' : 'label'} style={{ color: canvasAlpha(0.7) }}>
                  {view.header.venue}
                </Text>
              )
            ) : null}
            {view.header.address ? (
              <Text variant={large ? 'callout' : 'label'} style={{ color: canvasAlpha(0.7) }}>
                {view.header.address}
              </Text>
            ) : null}
            {view.header.marks ? (
              <Text variant={large ? 'callout' : 'label'} style={{ color: canvasAlpha(0.7) }}>
                {view.header.marks}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/**
 * The look — one tall well beside two stacked ones, edge to edge.
 *
 * Drawn as a row of two columns rather than a grid, because the wide well
 * spans both rows and RN has no `grid-row: span 2`. The ground shows through
 * as the 3pt gaps, which is why it is painted once on the container instead of
 * a border on each well. Same construction as the Plan week's plate, and
 * deliberately so: it is the same object at a different size.
 */
function Plate({
  tiles,
  label,
  large,
}: {
  tiles: EventLookTile[];
  label: string | null;
  large: boolean;
}) {
  const theme = useTheme();
  const row = large ? PLATE_ROW_AX : PLATE_ROW;

  const well = (tile: EventLookTile | undefined, ground: string, absolute = false) => (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: ground,
        overflow: 'hidden',
        ...(absolute ? { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 } : null),
      }}>
      <GarmentImage
        uri={tile?.uri}
        contentFit="cover"
        transition={140}
        style={{ width: '100%', height: '100%' }}
        /*
         * UX #62 — this was `<View />`: a genuinely blank tile.
         *
         * A cell with no piece behind it at all still draws nothing, which is
         * correct — a two-piece look has one empty well by design. A cell that
         * HAS a piece and no photograph now says which piece, on that piece's
         * own colour, so the board reads as looks rather than as a wall of
         * sand rectangles.
         */
        fallback={tile ? <GarmentFallback label={tile.label} color={tile.color} /> : <View />}
      />
    </View>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: PLATE_GAP,
        height: large ? row : row * 2 + PLATE_GAP,
        backgroundColor: theme.sand,
        flexShrink: 0,
      }}>
      <View style={{ flex: 2, minWidth: 0, backgroundColor: theme.sand, justifyContent: 'flex-end' }}>
        {well(tiles[0], theme.sand, true)}
        {/* The look's own name, on the photograph. `colophon` already carries
            the tracked caps and the `muted` the contrast pass moved it to —
            the artifact's #8B8375 is not a token and would fail as type. */}
        {label && !large ? (
          <Text variant="colophon" numberOfLines={1} style={{ margin: 12 }}>
            {label}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: PLATE_GAP }}>
        {well(tiles[1], theme.tray)}
        {large ? null : well(tiles[2], theme.sand)}
      </View>
    </View>
  );
}

/** The empty plate — the garments it COULD hold, drawn as outlines. */
function EmptyPlate({ large }: { large: boolean }) {
  const theme = useTheme();
  const row = large ? PLATE_ROW_AX : PLATE_ROW;
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
    <View style={{ width: w, height: h, borderRadius: radius, borderWidth: 1.5, borderColor: theme.sand }} />
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
      <View style={{ ...outline, flex: 2 }}>{mark(50, 70, 8)}</View>
      <View style={{ flex: 1, minWidth: 0, gap: PLATE_GAP }}>
        <View style={outline}>{mark(38, 38, 19)}</View>
        {large ? null : <View style={outline}>{mark(44, 28, 6)}</View>}
      </View>
    </View>
  );
}

/** The plate's own wait. */
function PlateSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: PLATE_GAP,
        height: PLATE_ROW * 2 + PLATE_GAP,
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

// ---------------------------------------------------------------------------
// The chooser
// ---------------------------------------------------------------------------

/**
 * `Your look`, as a chooser rather than a verdict. The founder's ruling.
 *
 * The poster used to draw ONE dominant plate: whatever the reader had already
 * pinned, or an outline if she had not. That is a record of a decision already
 * made, and the page it sits on is where the decision is supposed to happen —
 * so a reader with nothing planned was shown an empty box and asked to leave.
 *
 * This is Today's grammar, brought here: up to three options, paged full-width,
 * dots beneath. Two things fill it and both come from machinery that already
 * exists — the looks this member has PUT ON THE BOARD (`event_outfit_posts`,
 * votable, visible to every member) and, in whatever slots are left, the
 * on-device beam search run with THIS OCCASION as its context. No new table, no
 * new generator, and no second opinion about what an outfit is.
 *
 * ── WHY A PAGING RAIL AND NOT A GRID ──────────────────────────────────────
 *
 * Three plates side by side at a third of the width each are three thumbnails,
 * and the whole point of the plate is that the clothes are big enough to judge.
 * Today settled this for the same reason and this borrows its answer, including
 * the geometry that makes the paging honest: the page IS the screen width, so a
 * swipe can never come to rest between two cards.
 */
function OptionDots({ count, active }: { count: number; active: number }) {
  const theme = useTheme();
  if (count <= 1) return null;
  return (
    <View
      // Decorative: `optionPosition` is spoken on the card itself, so a reader
      // who cannot see this row has already been told where they are.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 14,
      }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? OPTION_DOT_ACTIVE : OPTION_DOT,
            height: OPTION_DOT,
            borderRadius: OPTION_DOT / 2,
            backgroundColor: theme.ink,
            opacity: i === active ? 1 : 0.22,
          }}
        />
      ))}
    </View>
  );
}

/** One of the chooser's own actions. Quieter than the foot's, always. */
function OptionAction({
  label,
  tone,
  large,
  busy,
  onPress,
}: {
  label: string;
  tone: 'blush' | 'tray';
  large: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      // `commit` for the one that writes a row somebody else will see, and the
      // policy door rather than `expo-haptics` — `tests/haptic-policy.test.ts`
      // refuses the direct import from a product file.
      haptic={tone === 'blush' ? 'commit' : undefined}
      busy={busy}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: CTA_RADIUS,
        backgroundColor: tone === 'blush' ? theme.blush : theme.tray,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: large ? CTA_MIN_HEIGHT_AX : CTA_SECONDARY_MIN_HEIGHT,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
      <Text
        variant={large ? 'heading' : 'callout'}
        style={{
          color: tone === 'blush' ? theme.accent : theme.ink,
          textAlign: 'center',
          minWidth: 0,
        }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

function OptionPage({
  option,
  index,
  total,
  width,
  large,
}: {
  option: EventLookOption;
  index: number;
  total: number;
  width: number;
  large: boolean;
}) {
  const position = optionPosition(index, total);
  const standing = option.posted ? EVENT_DETAIL_COPY.onBoard : EVENT_DETAIL_COPY.suggestion;
  const picks =
    // "Zero is quiet" — the board's own rule, kept here rather than restated:
    // a look with no votes prints no count at all, never "0 votes". The words
    // are the board's own (`voteCountLine`) rather than a second vocabulary for
    // the same number: the sheet this page opens is called Outfit Voting.
    option.votes && option.votes > 0
      ? option.votes === 1
        ? '1 vote'
        : `${option.votes} votes`
      : null;

  return (
    <View style={{ width }}>
      <Plate tiles={option.tiles} label={option.label} large={large} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, gap: 10, flexShrink: 0 }}>
        <View
          // ONE node. `accessible` collapses the position, the name, whether
          // anybody else can see it and the tally into a single announcement —
          // the same thing Today's plate does, and for the same reason: an
          // option heard as four fragments is not an option.
          accessible
          accessibilityRole="text"
          accessibilityLabel={[position, option.label, standing, picks]
            .filter(Boolean)
            .join(', ')}
          style={{
            flexDirection: large ? 'column' : 'row',
            alignItems: large ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: large ? 4 : 12,
          }}>
          <Text variant="colophon" style={{ minWidth: 0, flexShrink: 1 }}>
            {position}
          </Text>
          <Text variant="colophon" style={{ minWidth: 0, flexShrink: 1 }}>
            {[standing, picks].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {option.onAdd || option.onChange || option.onShare ? (
          <View style={{ flexDirection: large ? 'column' : 'row', gap: 10 }}>
            {option.onAdd ? (
              <OptionAction
                label={option.busy ? EVENT_DETAIL_COPY.posting : EVENT_DETAIL_COPY.addOption}
                tone="blush"
                large={large}
                busy={option.busy}
                onPress={option.onAdd}
              />
            ) : null}
            {option.onChange ? (
              <OptionAction
                label={EVENT_DETAIL_COPY.change}
                tone="tray"
                large={large}
                onPress={option.onChange}
              />
            ) : null}
            {option.onShare ? (
              <OptionAction
                label={EVENT_DETAIL_COPY.shareLook}
                tone="tray"
                large={large}
                onPress={option.onShare}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LookChooser({ view, large }: { view: EventDetailView; large: boolean }) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);

  if (view.looks.kind === 'loading') return <PlateSkeleton />;
  if (view.looks.kind === 'empty') return <EmptyPlate large={large} />;

  const options = view.looks.options;
  if (options.length === 0) return <EmptyPlate large={large} />;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== active) setActive(next);
  };

  // A single option is not a carousel: no paging, no dots, nothing to swipe.
  if (options.length === 1) {
    return <OptionPage option={options[0]!} index={0} total={1} width={width} large={large} />;
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}>
        {options.map((option, i) => (
          <OptionPage
            key={option.id}
            option={option}
            index={i}
            total={options.length}
            width={width}
            large={large}
          />
        ))}
      </ScrollView>
      <OptionDots count={options.length} active={active} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

/**
 * One avatar chip.
 *
 * The whole chip is inert — it is a label, not a control — so it states no
 * tap floor for its own sake; the 44pt minimum is the FRAME's measure and is
 * kept because the row of chips has to look like a row of chips.
 */
function Chip({
  initials,
  avatarUrl = null,
  name,
  going,
  quiet,
  large,
}: {
  initials: string | null;
  /**
   * The photograph, when the profile carried one. The disc is the same disc
   * either way — same diameter, same circle, same place in the row — so a chip
   * with a face and a chip with letters sit on one baseline. A URL that fails
   * to decode leaves the initials showing underneath, which is why the image is
   * drawn OVER them rather than instead of them.
   */
  avatarUrl?: string | null;
  name: string;
  going: boolean;
  quiet: boolean;
  large: boolean;
}) {
  const theme = useTheme();
  const avatar = large ? CHIP_AVATAR_AX : CHIP_AVATAR;

  return (
    <View
      accessibilityRole="text"
      // The section is headed "Going", so a chip that is NOT going has to say
      // so out loud — the label above it must never be made to cover somebody
      // who has not answered.
      accessibilityLabel={going ? name : `${name}, still deciding`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: large ? 12 : 8,
        alignSelf: large ? 'stretch' : 'auto',
        backgroundColor: quiet ? theme.tray : theme.blush,
        borderRadius: large ? CHIP_RADIUS_AX : CHIP_RADIUS,
        paddingLeft: initials ? 8 : 14,
        paddingRight: 14,
        paddingTop: large ? 12 : 8,
        paddingBottom: large ? 14 : 8,
        minHeight: large ? CHIP_MIN_HEIGHT_AX : MIN_TAP_TARGET,
      }}>
      {initials ? (
        <View
          style={{
            width: avatar,
            height: avatar,
            borderRadius: avatar / 2,
            backgroundColor: theme.sand,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
          <Text variant={large ? 'callout' : 'caption'} style={{ color: theme.ink }}>
            {initials}
          </Text>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              contentFit="cover"
              transition={120}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          ) : null}
        </View>
      ) : null}
      <Text
        variant={large ? 'heading' : 'label'}
        style={{ color: quiet ? theme.muted : theme.ink, minWidth: 0, flexShrink: 1 }}>
        {name}
      </Text>
    </View>
  );
}

/** The chip row's own wait — the frame's five widths, held as bars. */
const SKELETON_CHIPS = [104, 92, 86, 118, 78] as const;

function Roster({ view, large }: { view: EventDetailView; large: boolean }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, gap: 12, flexShrink: 0 }}>
      {view.loading ? (
        <Skeleton style={{ height: 12, width: 70, borderRadius: 6 }} />
      ) : (
        <Text variant="colophon">{EVENT_DETAIL_COPY.going}</Text>
      )}

      <View
        style={{
          flexDirection: large ? 'column' : 'row',
          flexWrap: large ? 'nowrap' : 'wrap',
          gap: CHIP_GAP,
        }}>
        {view.loading
          ? SKELETON_CHIPS.map((w) => (
              <Skeleton key={w} style={{ height: MIN_TAP_TARGET, width: w, borderRadius: CHIP_RADIUS }} />
            ))
          : (
            <>
              {view.chips.map((chip) => (
                <Chip
                  key={chip.userId}
                  // Initials from the FULL name — "Nelson Saenz" is still "NS"
                  // on the disc — while the pill prints the first name alone.
                  // The founder's ruling is about what is READ, and a monogram
                  // is not a name.
                  initials={initialsFor(chip.name)}
                  avatarUrl={chip.avatarUrl}
                  name={chip.host ? `${chip.firstName} (host)` : chip.firstName}
                  going={chip.going}
                  quiet={!chip.going}
                  large={large}
                />
              ))}
              {view.overflow ? (
                <Chip
                  initials={`+${view.overflow.count}`}
                  name={view.overflow.label}
                  going
                  quiet={false}
                  large={large}
                />
              ) : null}
              {view.noReplies ? (
                <Chip
                  initials={null}
                  name={EVENT_DETAIL_COPY.noReplies}
                  going
                  quiet
                  large={large}
                />
              ) : null}
            </>
          )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

/**
 * One of the foot's controls.
 *
 * `minHeight`, never `height`: the label inside grows with Dynamic Type and a
 * fixed box is where it gets clipped. The frames' 56 and 52 are floors.
 */
function Action({
  label,
  tone,
  large,
  busy,
  selected,
  onPress,
}: {
  label: string;
  tone: 'accent' | 'blush' | 'tray';
  large: boolean;
  busy?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const ground = tone === 'accent' ? theme.accent : tone === 'blush' ? theme.blush : theme.tray;
  const type = tone === 'accent' ? theme.canvas : tone === 'blush' ? theme.accent : theme.ink;

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      // `commit` — the intent iOS reserves for an action that changes something
      // on the other end. Routed through `@/lib/haptics`, which is the only
      // door: `tests/haptic-policy.test.ts` refuses a direct `expo-haptics`
      // import from a product file.
      haptic="commit"
      busy={busy}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, borderRadius: CTA_RADIUS, backgroundColor: ground }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: large
          ? CTA_MIN_HEIGHT_AX
          : tone === 'accent'
            ? CTA_MIN_HEIGHT
            : CTA_SECONDARY_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      <Text
        variant={large ? 'heading' : 'body'}
        style={{ color: type, textAlign: 'center', minWidth: 0 }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * The reply that did not send.
 *
 * `warning` is a FILL and the contrast record says INK goes on it, so the band
 * is the token at an alpha and every word on it is `ink`. The artifact's
 * #7A5312 is neither a palette token nor legal as type under
 * `theme/contrast.ts`; ink is darker and passes.
 */
function FailureBand() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: warningAlpha(0.22),
        borderRadius: NOTICE_RADIUS,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
      <View
        style={{
          width: NOTICE_DOT,
          height: NOTICE_DOT,
          borderRadius: NOTICE_DOT / 2,
          backgroundColor: theme.warning,
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout">{EVENT_DETAIL_COPY.rsvpErrorTitle}</Text>
        <Text variant="note">{EVENT_DETAIL_COPY.rsvpErrorBody}</Text>
      </View>
    </View>
  );
}

/** One tap down — the comments and the outfit votes, and how many are waiting. */
function CommentsRow({ count, onPress }: { count: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={EVENT_DETAIL_COPY.comments}
      accessibilityHint={count > 0 ? `${count} so far` : undefined}
      onPress={onPress}
      style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.blush }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: NAV_ROW_MIN_HEIGHT,
        paddingHorizontal: 18,
        paddingVertical: 12,
      }}>
      <Text variant="callout" style={{ color: theme.accent, minWidth: 0, flexShrink: 1 }}>
        {EVENT_DETAIL_COPY.comments}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* The artifact sets this figure in clay. Clay is `text: false`
            (2.98:1), so it is `muted` — the same quiet layer, one step down. */}
        {count > 0 ? <Text variant="colophon">{String(count)}</Text> : null}
        <SymbolView
          name="chevron.right"
          size={12}
          tintColor={theme.accent}
          resizeMode="scaleAspectFit"
        />
      </View>
    </PressableSurface>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function EventDetailBody({ view, large = false }: { view: EventDetailView; large?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const primary = primaryGround({
    failed: view.failed,
    // "Has a look" now means at least one option is ON THE BOARD. A suggestion
    // the engine produced is not a decision anybody has made, so a poster
    // showing three of them still points its one oxblood at the planning.
    hasLook: view.looks.kind === 'ready' && view.looks.options.some((o) => o.posted),
    canRsvp: Boolean(view.rsvp),
  });

  const logistics = view.loading ? null : view.logistics;

  /** The quiet line and the door down. At AX they ride the scroll instead. */
  const tail = (
    <>
      {logistics ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP_TARGET }}>
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                backgroundColor: theme.accentWarm,
                flexShrink: 0,
              }}
            />
            <Text
              variant="label"
              numberOfLines={large ? undefined : 1}
              style={{ flex: 1, minWidth: 0 }}>
              {logistics}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View className="flex-1 bg-canvas">
      <Band view={view} large={large} />

      {/*
        EVERYTHING BELOW THE BAND SCROLLS. The founder's report, item 6.

        The foot used to be pinned: "Plan a look" and the door down sat in a
        fixed bar under the scroll, and on a real phone they were clipped —
        partly off the bottom edge, with nothing to scroll them into view
        because the bar was not IN the scroll. A pinned bar only works when its
        height is knowable, and this one's is not: it holds up to four controls
        whose labels grow with Dynamic Type.

        So the bar is gone and the foot is the last block of the page. What
        keeps it clear of the home indicator is the content inset below —
        `insets.bottom` for the hardware plus `FOOT_PAD_BOTTOM` for the design —
        rather than a guess at how tall a button is.

        `flex: 1, minHeight: 0` is load-bearing, not decoration — the same
        hazard item detail and LP-09 both record: with no flex in a flex
        column a ScrollView measures against its CONTENT rather than the
        viewport, and at the accessibility sizes the page grows past the screen,
        the scroll view believes its frame is that tall, and the bottom is
        clipped with nothing to scroll.
      */}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + FOOT_PAD_BOTTOM }}
        showsVerticalScrollIndicator={false}>
        {view.notice ? <View style={{ paddingHorizontal: GUTTER, paddingTop: 14 }}>{view.notice}</View> : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: GUTTER,
            paddingTop: 14,
            paddingBottom: 10,
            flexShrink: 0,
          }}>
          {view.loading ? (
            <Skeleton style={{ height: 12, width: 90, borderRadius: 6 }} />
          ) : (
            <Text variant="colophon" style={{ minWidth: 0, flexShrink: 1 }}>
              {EVENT_DETAIL_COPY.yourLook}
            </Text>
          )}
          {/* `Change` moved onto the option it changes. With three of them on a
              rail, one action up here could only ever act on a card the reader
              might not be looking at. */}
        </View>

        <LookChooser view={view} large={large} />

        {view.empty ? (
          <View style={{ paddingHorizontal: 22, paddingTop: 22, gap: 10, flexShrink: 0 }}>
            <Text variant="title" trim>
              {view.empty.title}
            </Text>
            {view.empty.body ? (
              <Text variant="body" className="text-muted" style={{ maxWidth: 300 }}>
                {view.empty.body}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Roster view={view} large={large} />

        {tail}

        {/* ── The foot, in the scroll ─────────────────────────────────────
            One filled oxblood per state — the accent budget — decided once by
            `primaryGround` so no two controls here can both believe they are
            the primary. The rule above it is drawn at every type size now
            rather than only at the accessibility ones: it used to be the seam
            between a pinned bar and the page, and it is now the seam between
            the page's facts and its actions, which is a thing worth marking
            whatever size the type is. */}
        <View
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: 18,
            marginTop: 18,
            gap: 10,
            flexShrink: 0,
            borderTopWidth: 1,
            borderTopColor: theme.tray,
          }}>
        {view.loading ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton style={{ flex: 1, minWidth: 0, height: CTA_MIN_HEIGHT, borderRadius: CTA_RADIUS }} />
              <Skeleton style={{ flex: 1, minWidth: 0, height: CTA_MIN_HEIGHT, borderRadius: CTA_RADIUS }} />
            </View>
            <Skeleton style={{ height: NAV_ROW_MIN_HEIGHT, borderRadius: CTA_RADIUS }} />
          </>
        ) : view.failed ? (
          <>
            <FailureBand />
            <View style={{ flexDirection: 'row' }}>
              <Action label={EVENT_DETAIL_COPY.tryAgain} tone="accent" large={large} onPress={view.onRetry} />
            </View>
          </>
        ) : (
          <>
            {view.onPlanLook ? (
              <View style={{ flexDirection: 'row' }}>
                <Action
                  label={EVENT_DETAIL_COPY.planLook}
                  tone={primary === 'plan' ? 'accent' : 'blush'}
                  large={large}
                  onPress={view.onPlanLook}
                />
              </View>
            ) : null}

            {view.rsvp ? (
              <View style={{ flexDirection: large ? 'column' : 'row', gap: 10 }}>
                <Action
                  label={EVENT_DETAIL_COPY.going}
                  // The fill goes to the standing answer only when the RSVP is
                  // what the foot is FOR. With "Plan a look" above it, both
                  // buttons demote — the empty frame's own arrangement.
                  tone={
                    view.rsvp.standing === 'going'
                      ? primary === 'rsvp'
                        ? 'accent'
                        : 'blush'
                      : 'tray'
                  }
                  selected={view.rsvp.standing === 'going'}
                  busy={view.rsvp.busy}
                  large={large}
                  onPress={() => view.onRsvp('joined')}
                />
                <Action
                  label={EVENT_DETAIL_COPY.decline}
                  tone={
                    view.rsvp.standing === 'declined'
                      ? primary === 'rsvp'
                        ? 'accent'
                        : 'blush'
                      : 'tray'
                  }
                  selected={view.rsvp.standing === 'declined'}
                  busy={view.rsvp.busy}
                  large={large}
                  onPress={() => view.onRsvp('declined')}
                />
              </View>
            ) : null}

            {/* One door down, at every type size. It used to be drawn twice —
                once in the pinned foot and once in the scroll for the
                accessibility sizes, because the bar had no room for it. With
                the foot in the scroll there is exactly one of it and no size
                at which it is missing. */}
            {view.commentCount !== null ? (
              <CommentsRow count={view.commentCount} onPress={view.onComments} />
            ) : null}
          </>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

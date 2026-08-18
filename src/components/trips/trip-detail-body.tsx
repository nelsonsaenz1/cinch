import { SymbolView } from 'expo-symbols';
import { ScrollView, TextInput, View, type DimensionValue } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  BADGE_DOT,
  BADGE_RADIUS,
  BAR_GAP,
  BAR_HEIGHT,
  BAR_RADIUS,
  CHROME_RADIUS,
  CHROME_TARGET,
  CTA_MIN_HEIGHT,
  CTA_MIN_HEIGHT_AX,
  CTA_RADIUS,
  CTA_SECONDARY_MIN_HEIGHT,
  GHOST_BORDER,
  GHOST_ROW,
  GRID_COLUMNS,
  GRID_COLUMNS_AX,
  GROUP_GAP,
  HERO_GAP,
  HERO_PAD_X,
  MARK_BORDER,
  MARK_BORDER_AX,
  MARK_DOT,
  MARK_INSET,
  MARK_INSET_AX,
  MARK_RADIUS,
  MARK_SIZE,
  MARK_SIZE_AX,
  NOTE_BORDER,
  NOTE_DOT,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_HEIGHT_FOCUSED,
  NOTE_RADIUS,
  NOTE_RADIUS_FOCUSED,
  RECEIPT_MARK,
  RECEIPT_RADIUS,
  SHEET_GRABBER_HEIGHT,
  SHEET_GRABBER_WIDTH,
  SHEET_RADIUS,
  TILE_GAP,
  TILE_GAP_AX,
  TILE_PAD,
  TILE_RADIUS,
  TILE_RADIUS_AX,
  TILE_ROW,
  TILE_ROW_AX,
  TILE_ROW_COMPLETE,
  TRIP_DETAIL_COPY,
  type Progress,
} from '@/features/trips/trip-detail-spec';
import {
  GUTTER,
  MIN_TAP_TARGET,
  canvasAlpha,
  positiveAlpha,
  useTheme,
  warningAlpha,
} from '@/theme/tokens';

/**
 * Trip Detail — the drawn surface. Redesign 06.
 *
 * Split from the route for the reason every rebuilt page in this repo is: a
 * screen that reaches for the trip row, the closet, a batch of signed URLs and
 * a local store at the top cannot be POSED, and a state nobody can open is a
 * state nobody checks. Everything here is a function of the `view` object, so
 * `dev-td-01…09` draw the nine accepted frames out of `trip-detail-fixtures.ts`
 * without a session, a network, or a single row in `trips`.
 *
 * ── WHAT THE FRAMES ASK FOR ──────────────────────────────────────────────────
 *
 * 1. A destination hero on blush — the place in the serif, its dates in tracked
 *    caps, a weather mark in a canvas chip beside them.
 * 2. The packing plate as the body: a bar and a count, then the trip's days,
 *    each a tracked oxblood band over a three-across grid of CUTOUTS. Every
 *    tile carries a check mark and is the target that toggles it.
 * 3. A note plate at the foot, which becomes a field when it is tapped.
 * 4. Two quiet actions side by side — Re-plan in blush, Delete trip in tray.
 * 5. Completion recomposes rather than recolours: a "Fully packed" badge enters
 *    the hero, the dates absorb the weather mark, the day captions and the note
 *    leave, and the two quiet actions are replaced by one way onward.
 * 6. Empty, loading, offline and the delete sheet, each in its own composition.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────
 *
 * Not one hex. Four artifact colours are translated rather than transcribed,
 * each because `theme/contrast.ts` forbids the literal:
 *
 *   · #B08A76 clay, the dates line — `muted`. Clay is 2.98:1 and the record
 *     declares it `text: false`: a FILL, never type. It keeps its job as the
 *     progress bar's fill, where it is legal and where the artifact also uses it.
 *   · #33562F, the completion count — `accent`. `positive` is 4.34:1 and is a
 *     dot, a tick or a fill only. The green stays on the BAR and on the badge's
 *     mark, and the completion is announced by the badge entering rather than
 *     by a word changing colour.
 *   · #7A5312 on the offline band — `ink` on `warningAlpha`, the construction
 *     the trips shelf's own offline band and the packing plate both use.
 *   · rgba(251,250,246,.72), the unchecked mark's ground — `canvasAlpha(0.72)`,
 *     which is that exact value expressed as the token it already is.
 *
 * ── LARGE TYPE ───────────────────────────────────────────────────────────────
 *
 * Above the threshold the page recomposes rather than shrinking, in the four
 * places the AX frame draws: the grid drops to TWO columns and moves each
 * piece's name from an overlay inside the tile to a full-size line beneath it;
 * the progress bar becomes a sentence in the hero, because an 8pt bar carries
 * no information at that type size; the weather chip folds into the dates line;
 * and the two actions stack full-width over a hairline instead of sharing a row.
 */

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type DetailTile = {
  /** The closet item id. The tile IS the piece — never a copy of one. */
  id: string;
  /** "Linen shirt", from the reader's own garment. Empty when it is gone. */
  name: string;
  uri?: string;
  checked: boolean;
};

export type DetailGroup = {
  key: string;
  /** `Thu 10 · arrival` — from the spec, never composed here. */
  label: string;
  /** "travel day · 75°", or null. The completion frame drops it entirely. */
  caption: string | null;
  tiles: DetailTile[];
};

type Chrome = {
  onBack: () => void;
  /** The overflow control. Null on the frames that do not draw it. */
  onMore: (() => void) | null;
};

export type TripDetailView = Chrome & {
  /** The delete sheet, drawn over whichever body is behind it. */
  deleteOpen: boolean;
  deleting: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  body: TripDetailBody;
};

export type TripDetailBody =
  | {
      state: 'loading';
      /** Known from the shelf card that was tapped, so the hero paints at once. */
      destination: string;
    }
  | {
      state: 'error';
      destination: string;
      dates: string | null;
      /** How many pieces this device has ticked — the frame's own receipt. */
      ticked: number;
      onRetry: () => void;
      onAllTrips: () => void;
    }
  | {
      state: 'empty';
      destination: string;
      dates: string | null;
      /** `24° / 15°`, or null when the row records no temperature. */
      mark: string | null;
      /** "Six nights. Build the plan and it lands here." */
      body: string;
      onBuild: () => void;
    }
  | {
      state: 'plate';
      destination: string;
      dates: string | null;
      mark: string | null;
      groups: DetailGroup[];
      progress: Progress;
      complete: boolean;
      note: string;
      noteFocused: boolean;
      onToggle: (itemId: string) => void;
      onNoteChange: (note: string) => void;
      onNoteFocus: () => void;
      onNoteBlur: () => void;
      onReplan: () => void;
      onSeeTheWeek: () => void;
    };

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function ChromeButton({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: 'chevron.left' | 'ellipsis';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      fill
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ borderRadius: CHROME_RADIUS, backgroundColor: theme.tray }}
      contentStyle={{
        width: CHROME_TARGET,
        height: CHROME_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <SymbolView name={glyph} size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </PressableSurface>
  );
}

function ChromeRow({ chrome }: { chrome: Chrome }) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
      <ChromeButton label={TRIP_DETAIL_COPY.back} glyph="chevron.left" onPress={chrome.onBack} />
      {chrome.onMore ? (
        <ChromeButton label={TRIP_DETAIL_COPY.more} glyph="ellipsis" onPress={chrome.onMore} />
      ) : (
        // The row keeps its height so the hero does not jump between the
        // loading frame and the one that replaces it.
        <View style={{ width: CHROME_TARGET, height: CHROME_TARGET }} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------

/**
 * The weather chip — a canvas plate on the blush band.
 *
 * The artifact's dot is coloured by CONDITION (amber for the sunny frame,
 * pale blue for the cool one). The trip row records temperatures and a weather
 * SOURCE, never a condition, so a dot that was always amber would be the page
 * asserting sunshine it has no field for. It is drawn in clay instead — a mark
 * that carries the chip's weight without making a claim. Listed as a deviation.
 */
function WeatherChip({ mark }: { mark: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.canvas,
        borderRadius: MARK_RADIUS,
        paddingHorizontal: 11,
        paddingVertical: 8,
        flexShrink: 0,
      }}>
      <View
        style={{
          width: MARK_DOT,
          height: MARK_DOT,
          borderRadius: MARK_DOT / 2,
          backgroundColor: theme.accentWarm,
        }}
      />
      <Text variant="label" style={{ color: theme.ink }}>
        {mark}
      </Text>
    </View>
  );
}

/** The completion badge — `positiveAlpha` under `ink`, per the contrast record. */
function PackedBadge({ large }: { large: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: positiveAlpha(0.16),
        borderRadius: BADGE_RADIUS,
        paddingHorizontal: 11,
        paddingVertical: 7,
        flexShrink: 0,
      }}>
      <View
        style={{
          width: BADGE_DOT,
          height: BADGE_DOT,
          borderRadius: BADGE_DOT / 2,
          backgroundColor: theme.positive,
          flexShrink: 0,
        }}
      />
      <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.ink }}>
        {TRIP_DETAIL_COPY.fullyPacked}
      </Text>
    </View>
  );
}

/**
 * The destination hero.
 *
 * Three compositions rather than one with flags, because the frames draw three:
 * the plate's title over a dates row that holds the weather chip; the
 * completion's badge over a title over a dates line that has ABSORBED the mark
 * (the chip is gone, because the badge is the object the eye should find); and
 * the AX frame's, which absorbs the mark for room and adds the progress
 * sentence the bar can no longer carry.
 */
function Hero({
  destination,
  dates,
  mark,
  badge,
  progressLine,
  large,
}: {
  destination: string;
  dates: string | null;
  mark: string | null;
  badge: boolean;
  /** Set only above the threshold, where the bar becomes a sentence. */
  progressLine: string | null;
  large: boolean;
}) {
  const theme = useTheme();
  // The chip only survives where there is room for it beside the dates.
  const inlineMark = badge || large;
  const line = inlineMark ? [dates, mark].filter(Boolean).join(' · ') : dates;

  return (
    <View
      style={{
        backgroundColor: theme.blush,
        paddingHorizontal: HERO_PAD_X,
        paddingTop: badge ? 14 : large ? 12 : 16,
        paddingBottom: 18,
        gap: HERO_GAP,
        flexShrink: 0,
      }}>
      {badge ? <PackedBadge large={large} /> : null}

      {/* NO `trim`: a long destination wraps, and `trim` subtracts a one-line
          margin from a two-line box — the same note the packing plate's head
          carries for the same reason. */}
      <Text variant="display" accessibilityRole="header" style={{ paddingBottom: large ? 5 : 3 }}>
        {destination}
      </Text>

      {line ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          {/* The artifact sets this in clay, which is `text: false` (2.98:1). */}
          <Text
            variant={large ? 'callout' : 'eyebrow'}
            style={{ color: theme.muted, minWidth: 0, flexShrink: 1 }}>
            {line}
          </Text>
          {!inlineMark && mark ? <WeatherChip mark={mark} /> : null}
        </View>
      ) : null}

      {progressLine ? (
        <Text variant="callout" style={{ color: theme.accent }}>
          {progressLine}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The hero, condensed — the keyboard frame's one-line bar.
 *
 * With the note field up there is room for the place and the count and nothing
 * else, and the frame drops the chrome row with it. The plate keeps scrolling
 * behind: this is the composition that keeps the promise in the artifact's own
 * caption, "the plate scrolls behind it, never covered".
 */
function HeroCondensed({ destination, progressLine }: { destination: string; progressLine: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.blush,
        paddingHorizontal: HERO_PAD_X,
        paddingTop: 10,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}>
      <Text variant="title" numberOfLines={1} style={{ minWidth: 0, flexShrink: 1 }}>
        {destination}
      </Text>
      <Text variant="eyebrow" style={{ color: theme.muted, flexShrink: 0 }}>
        {progressLine}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * The bar and the count.
 *
 * One `progressbar` node carrying both, rather than a bar with a label beside
 * it: to VoiceOver "6 of 9 packed" and the bar are one fact, and announcing
 * them separately makes the reader hear the same number twice. Absent above the
 * threshold — the hero says it in words there instead.
 */
function ProgressRow({ progress, complete }: { progress: Progress; complete: boolean }) {
  const theme = useTheme();
  const label = TRIP_DETAIL_COPY.packed(progress.packed, progress.total);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: progress.total, now: progress.packed }}
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 14,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: BAR_GAP,
        flexShrink: 0,
      }}>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          backgroundColor: theme.sand,
          overflow: 'hidden',
        }}>
        <View
          style={{
            height: BAR_HEIGHT,
            width: `${progress.ratio * 100}%` as DimensionValue,
            // Green only on the FILL. The count beside it stays oxblood: the
            // contrast record makes `positive` a mark and never type.
            backgroundColor: complete ? theme.positive : theme.accentWarm,
          }}
        />
      </View>
      <Text
        variant="eyebrow"
        style={{ color: progress.packed === 0 ? theme.muted : theme.accent, flexShrink: 0 }}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/** The check mark on a tile — a ring when unpacked, a filled tick when packed. */
function CheckMark({
  checked,
  complete,
  large,
}: {
  checked: boolean;
  complete: boolean;
  large: boolean;
}) {
  const theme = useTheme();
  const size = large ? MARK_SIZE_AX : MARK_SIZE;
  const fill = complete ? theme.positive : theme.accent;

  return (
    <View
      style={{
        position: 'absolute',
        top: large ? MARK_INSET_AX : MARK_INSET,
        right: large ? MARK_INSET_AX : MARK_INSET,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: large ? MARK_BORDER_AX : MARK_BORDER,
        borderColor: checked ? fill : theme.sand,
        backgroundColor: checked ? fill : canvasAlpha(0.72),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {checked ? (
        <SymbolView
          name="checkmark"
          size={Math.round(size * 0.5)}
          tintColor={theme.canvas}
          resizeMode="scaleAspectFit"
        />
      ) : null}
    </View>
  );
}

/**
 * One piece, as a cutout you can tick.
 *
 * THE WHOLE TILE IS THE TARGET, not the 26pt mark in its corner. The mark is
 * the state; a 26pt hit area would be under the 44pt floor and would ask
 * somebody holding a shirt in one hand to hit a coin. Every tile is at least
 * 96pt tall, so `fill` drops the redundant `minHeight` rather than granting an
 * exemption.
 *
 * The label lives INSIDE the tile at standard sizes, where the frames put it,
 * and moves to a full line beneath it above the threshold — a 10pt tracked
 * overlay is unreadable at 1.5× and the AX frame draws exactly this change.
 */
function PieceTile({
  tile,
  height,
  radius,
  showName,
  nameBelow,
  complete,
  large,
  ground,
  onToggle,
}: {
  tile: DetailTile;
  height: number;
  radius: number;
  showName: boolean;
  nameBelow: boolean;
  complete: boolean;
  large: boolean;
  ground: string;
  onToggle: ((itemId: string) => void) | null;
}) {
  const theme = useTheme();

  const well = (
    <View
      style={{
        height,
        borderRadius: radius,
        backgroundColor: ground,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        padding: TILE_PAD,
      }}>
      <GarmentImage
        uri={tile.uri}
        contentFit="cover"
        transition={140}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        fallback={<View />}
      />
      {showName && !nameBelow && tile.name ? (
        <Text variant="eyebrow" numberOfLines={2} style={{ color: theme.muted }}>
          {tile.name}
        </Text>
      ) : null}
      <CheckMark checked={tile.checked} complete={complete} large={large} />
    </View>
  );

  const label = tile.checked
    ? TRIP_DETAIL_COPY.unpack(tile.name)
    : TRIP_DETAIL_COPY.pack(tile.name);

  const inner = nameBelow ? (
    <View style={{ gap: 8 }}>
      {well}
      {tile.name ? (
        <Text variant="body" style={{ paddingBottom: 3 }}>
          {tile.name}
        </Text>
      ) : null}
    </View>
  ) : (
    well
  );

  if (!onToggle) {
    return (
      <View style={{ flex: 1, minWidth: 0 }}>
        {inner}
      </View>
    );
  }

  return (
    <PressableSurface
      fill
      // A checkbox, because that is what it is: VoiceOver then reads the state
      // rather than leaving "packed" to be inferred from a mark it cannot see.
      accessibilityRole="checkbox"
      accessibilityState={{ checked: tile.checked }}
      accessibilityLabel={label}
      onPress={() => onToggle(tile.id)}
      style={{ flex: 1, minWidth: 0 }}
      contentStyle={{ minWidth: 0 }}>
      {inner}
    </PressableSurface>
  );
}

/**
 * One day, as a grid.
 *
 * The empty columns still draw when a day has fewer pieces than the grid has
 * places: the frames' geometry is equal columns, and a row that changed shape
 * with the count would make two days of one trip look like two designs. Same
 * bargain, same sentence, as the packing plate and the trips shelf's hero band.
 */
function DayGrid({
  group,
  columns,
  height,
  large,
  complete,
  compact,
  onToggle,
}: {
  group: DetailGroup;
  columns: number;
  height: number;
  large: boolean;
  complete: boolean;
  /** The keyboard frame: no names, no captions — the grid as pure geometry. */
  compact: boolean;
  onToggle: ((itemId: string) => void) | null;
}) {
  const theme = useTheme();
  const grounds = [theme.sand, theme.tray, theme.sand];
  const gap = large ? TILE_GAP_AX : TILE_GAP;
  const radius = large ? TILE_RADIUS_AX : TILE_RADIUS;

  const rows: (DetailTile | null)[][] = [];
  for (let i = 0; i < Math.max(columns, group.tiles.length); i += columns) {
    rows.push(
      Array.from({ length: columns }, (_, c) => group.tiles[i + c] ?? null),
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 3 }}>
        {/* §1's "section headers in the area accent, not gray". */}
        <Text variant="eyebrow" style={{ color: theme.accent }}>
          {group.label}
        </Text>
        {group.caption && !compact ? (
          <Text variant="note" numberOfLines={large ? undefined : 1}>
            {group.caption}
          </Text>
        ) : null}
      </View>

      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((tile, c) =>
            tile ? (
              <PieceTile
                key={tile.id}
                tile={tile}
                height={height}
                radius={radius}
                showName={!compact}
                nameBelow={large}
                complete={complete}
                large={large}
                ground={grounds[c % grounds.length]!}
                onToggle={onToggle}
              />
            ) : (
              <View
                key={`empty-${c}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height,
                  borderRadius: radius,
                  backgroundColor: grounds[c % grounds.length],
                }}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The note
// ---------------------------------------------------------------------------

/**
 * The note — a plate at rest, a field once it is tapped.
 *
 * ONE OBJECT IN TWO STATES, not a plate that swaps for a field: the frames give
 * it the same ground and the same place at the foot, and only its border, its
 * height and its trailing furniture change. Written prose is drawn in `ink`,
 * the placeholder in `muted` — a note somebody typed is content, and the empty
 * invitation is not.
 *
 * The build report lists this as a deviation: `trips` has no note column and
 * this build adds no schema, so what is typed here lives on the device.
 */
function NotePlate({
  note,
  focused,
  onChange,
  onFocus,
  onBlur,
  large,
}: {
  note: string;
  focused: boolean;
  onChange: (note: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  large: boolean;
}) {
  const theme = useTheme();

  if (!focused) {
    return (
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={note || TRIP_DETAIL_COPY.notePlaceholder}
        accessibilityHint={TRIP_DETAIL_COPY.noteLabel}
        onPress={onFocus}
        style={{ borderRadius: NOTE_RADIUS, backgroundColor: theme.tray }}
        contentStyle={{
          minHeight: NOTE_MIN_HEIGHT,
          paddingHorizontal: 16,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <View
          style={{
            width: NOTE_DOT,
            height: NOTE_DOT,
            borderRadius: NOTE_DOT / 2,
            backgroundColor: theme.accentWarm,
            flexShrink: 0,
          }}
        />
        <Text
          variant="body"
          numberOfLines={large ? 3 : 1}
          style={{ color: note ? theme.ink : theme.muted, flex: 1, minWidth: 0 }}>
          {note || TRIP_DETAIL_COPY.notePlaceholder}
        </Text>
      </PressableSurface>
    );
  }

  return (
    <View
      style={{
        borderRadius: NOTE_RADIUS_FOCUSED,
        backgroundColor: theme.tray,
        borderWidth: NOTE_BORDER,
        borderColor: theme.accent,
        minHeight: NOTE_MIN_HEIGHT_FOCUSED,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}>
      <TextInput
        autoFocus
        multiline
        value={note}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={TRIP_DETAIL_COPY.notePlaceholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={TRIP_DETAIL_COPY.noteLabel}
        selectionColor={theme.accent}
        style={{
          flex: 1,
          minWidth: 0,
          color: theme.ink,
          fontSize: 16,
          lineHeight: 22,
          padding: 0,
        }}
      />
      <PressableSurface
        fill
        accessibilityRole="button"
        accessibilityLabel={TRIP_DETAIL_COPY.noteDone}
        onPress={onBlur}
        hitSlop={8}
        contentStyle={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', flexShrink: 0 }}>
        <Text variant="callout" style={{ color: theme.accent }}>
          {TRIP_DETAIL_COPY.noteDone}
        </Text>
      </PressableSurface>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

function PrimaryCta({
  label,
  onPress,
  busy,
  large,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  large: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      busy={busy}
      onPress={onPress}
      style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.accent }}
      contentStyle={{
        minHeight: large ? CTA_MIN_HEIGHT_AX : CTA_MIN_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      {/* `canvas` on `accent` — 9.84:1 inverted, the one pair the record allows. */}
      <Text variant={large ? 'heading' : 'body'} style={{ color: theme.canvas, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * A quiet action — blush under oxblood, or tray under muted.
 *
 * `tone` rather than two components: the frames draw Re-plan and Delete trip at
 * identical geometry and differ only in ground and label colour, which is the
 * page saying "these are the same weight; one of them is warmer". The delete is
 * deliberately NOT `critical` red — the app's rule, stated in
 * `withdraw-consent-sheet.tsx`, is that a destructive action carries the brand
 * red and never iOS red, and here it does not even carry that: the button that
 * OPENS a confirmation is not itself destructive.
 */
function QuietCta({
  label,
  tone,
  onPress,
  large,
}: {
  label: string;
  tone: 'warm' | 'quiet';
  onPress: () => void;
  large: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: large ? undefined : 1,
        minWidth: 0,
        borderRadius: CTA_RADIUS,
        backgroundColor: tone === 'warm' ? theme.blush : theme.tray,
      }}
      contentStyle={{
        minHeight: large ? CTA_MIN_HEIGHT_AX : CTA_SECONDARY_MIN_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      <Text
        variant={large ? 'heading' : 'callout'}
        style={{ color: tone === 'warm' ? theme.accent : theme.muted, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/** The pinned foot. Side by side at standard sizes, stacked over a rule above it. */
function Foot({
  children,
  large,
  ruled = false,
}: {
  children: React.ReactNode;
  large: boolean;
  ruled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: large ? 12 : 14,
        paddingBottom: 8,
        gap: 10,
        flexShrink: 0,
        borderTopWidth: ruled ? 1 : 0,
        borderTopColor: theme.tray,
      }}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Opening.
 *
 * The hero paints its real destination immediately — the shelf card that was
 * tapped already knows it, and it is passed through the route params — so the
 * page arrives as the place you asked for rather than as a grey rectangle that
 * becomes it. Everything the row has yet to answer for is a skeleton at the
 * geometry the real thing will take, so nothing moves when it lands.
 *
 * No overflow control while there is nothing to act on: the frame withholds it,
 * and a menu offering to delete a trip that has not finished loading is a
 * control that can only misfire.
 */
function LoadingBody({
  destination,
  chrome,
  large,
}: {
  destination: string;
  chrome: Chrome;
  large: boolean;
}) {
  return (
    <>
      {/* Back works while the page loads; the overflow does not exist yet. */}
      <ChromeRow chrome={{ onBack: chrome.onBack, onMore: null }} />
      <HeroSkeleton destination={destination} large={large} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: BAR_GAP }}>
        <Skeleton style={{ flex: 1, height: 12, borderRadius: 6 }} />
        <Skeleton style={{ width: 84, height: 12, borderRadius: 6 }} />
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: GROUP_GAP, flexShrink: 0 }}>
        {(['46%', '38%'] as const).map((width, i) => (
          <View key={width} style={{ gap: 9 }}>
            <Skeleton style={{ height: 12, width, borderRadius: 6 }} delay={i * 90} />
            <View style={{ flexDirection: 'row', gap: TILE_GAP }}>
              {[0, 1, 2].map((c) => (
                <Skeleton
                  key={c}
                  style={{ flex: 1, minWidth: 0, height: TILE_ROW, borderRadius: TILE_RADIUS }}
                  delay={i * 90 + c * 60}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />

      <Foot large={large}>
        <Skeleton style={{ height: NOTE_MIN_HEIGHT + 12, borderRadius: NOTE_RADIUS }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Skeleton style={{ flex: 1, height: CTA_SECONDARY_MIN_HEIGHT, borderRadius: CTA_RADIUS }} />
          <Skeleton style={{ flex: 1, height: CTA_SECONDARY_MIN_HEIGHT, borderRadius: CTA_RADIUS }} />
        </View>
      </Foot>
    </>
  );
}

function HeroSkeleton({ destination, large }: { destination: string; large: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.blush,
        paddingHorizontal: HERO_PAD_X,
        paddingTop: 16,
        paddingBottom: 18,
        gap: HERO_GAP,
        flexShrink: 0,
      }}>
      <Text variant="display" accessibilityRole="header" style={{ paddingBottom: large ? 5 : 3 }}>
        {destination}
      </Text>
      <Skeleton style={{ height: 12, width: '48%', borderRadius: 6 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * The plate that would not load.
 *
 * The band says one true thing and the receipt under it PROVES the second. "What
 * you already ticked is safe on this device" is not a reassurance the page
 * offers — it is drawn as the count, read out of the same local store the ticks
 * went into, so the sentence cannot go stale while the store still holds them.
 * The same construction, and the same reasoning, as the New Trip failure frame
 * drawing the preserved answers instead of asserting them.
 */
function ErrorBody({
  view,
  chrome,
  large,
}: {
  view: Extract<TripDetailBody, { state: 'error' }>;
  chrome: Chrome;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <>
      <ChromeRow chrome={{ onBack: chrome.onBack, onMore: null }} />

      <View
        style={{
          backgroundColor: theme.blush,
          paddingHorizontal: HERO_PAD_X,
          paddingTop: 16,
          paddingBottom: 18,
          gap: HERO_GAP,
          flexShrink: 0,
        }}>
        <Text variant="display" accessibilityRole="header" style={{ paddingBottom: 3 }}>
          {view.destination}
        </Text>
        {view.dates ? (
          <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.muted }}>
            {view.dates}
          </Text>
        ) : null}
      </View>

      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: warningAlpha(0.22),
          paddingHorizontal: HERO_PAD_X,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 12,
          flexShrink: 0,
        }}>
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: warningAlpha(0.35),
            borderRadius: BADGE_RADIUS,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}>
          <View
            style={{
              width: BADGE_DOT,
              height: BADGE_DOT,
              borderRadius: BADGE_DOT / 2,
              backgroundColor: theme.warning,
            }}
          />
          <Text variant={large ? 'callout' : 'eyebrow'} style={{ color: theme.ink }}>
            {TRIP_DETAIL_COPY.offlineKicker}
          </Text>
        </View>
        <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 2 }}>
          {TRIP_DETAIL_COPY.errorTitle}
        </Text>
        <Text variant="body" className="text-muted" style={{ maxWidth: 290 }}>
          {TRIP_DETAIL_COPY.errorBody}
        </Text>
      </View>

      {view.ticked > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 20, flexShrink: 0 }}>
          <View
            style={{
              backgroundColor: theme.tray,
              borderRadius: RECEIPT_RADIUS,
              minHeight: NOTE_MIN_HEIGHT,
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            <View
              style={{
                width: RECEIPT_MARK,
                height: RECEIPT_MARK,
                borderRadius: RECEIPT_MARK / 2,
                backgroundColor: theme.accentWarm,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
              <SymbolView
                name="checkmark"
                size={11}
                tintColor={theme.canvas}
                resizeMode="scaleAspectFit"
              />
            </View>
            <Text variant="body" style={{ flex: 1, minWidth: 0 }}>
              {TRIP_DETAIL_COPY.ticked(view.ticked)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 0 }} />

      <Foot large={large}>
        <PrimaryCta label={TRIP_DETAIL_COPY.tryAgain} onPress={view.onRetry} large={large} />
        <QuietCta
          label={TRIP_DETAIL_COPY.allTrips}
          tone="warm"
          onPress={view.onAllTrips}
          large={large}
        />
      </Foot>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

/** A drawn garment — the shape of a piece, never a photograph of somebody's. */
function GhostWell({ shape }: { shape: 'top' | 'round' | 'wide' }) {
  const theme = useTheme();
  const inner =
    shape === 'top'
      ? { width: 38, height: 56, borderRadius: 7 }
      : shape === 'round'
        ? { width: 40, height: 40, borderRadius: 20 }
        : { width: 44, height: 28, borderRadius: 6 };

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        height: GHOST_ROW,
        borderRadius: TILE_RADIUS,
        backgroundColor: theme.tray,
        borderWidth: GHOST_BORDER,
        borderStyle: 'dashed',
        borderColor: theme.sand,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View style={{ ...inner, borderWidth: GHOST_BORDER, borderColor: theme.sand }} />
    </View>
  );
}

/**
 * The trip that exists and was never packed.
 *
 * A real state, not a defensive one: `useStartTrip` writes the row the moment
 * the questionnaire is answered, so a trip somebody planned and abandoned
 * before the plate came back has exactly this shape. The hero is unchanged —
 * it is the same trip — and the only thing missing is the thing the CTA offers.
 */
function EmptyBody({
  view,
  chrome,
  onRequestDelete,
  large,
}: {
  view: Extract<TripDetailBody, { state: 'empty' }>;
  chrome: Chrome;
  onRequestDelete: () => void;
  large: boolean;
}) {
  return (
    <>
      <ChromeRow chrome={chrome} />
      <Hero
        destination={view.destination}
        dates={view.dates}
        mark={view.mark}
        badge={false}
        progressLine={null}
        large={large}
      />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 26, flexShrink: 0 }}>
        <View style={{ flexDirection: 'row', gap: TILE_GAP }}>
          <GhostWell shape="top" />
          <GhostWell shape="round" />
          <GhostWell shape="wide" />
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 26, gap: 10, flexShrink: 0 }}>
        <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 2 }}>
          {TRIP_DETAIL_COPY.emptyTitle(view.destination)}
        </Text>
        <Text variant="body" className="text-muted" style={{ maxWidth: 290 }}>
          {view.body}
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />

      <Foot large={large}>
        <PrimaryCta label={TRIP_DETAIL_COPY.emptyBuild} onPress={view.onBuild} large={large} />
        <QuietCta
          label={TRIP_DETAIL_COPY.delete}
          tone="quiet"
          onPress={onRequestDelete}
          large={large}
        />
      </Foot>
    </>
  );
}

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

function PlateBody({
  view,
  chrome,
  onRequestDelete,
  large,
}: {
  view: Extract<TripDetailBody, { state: 'plate' }>;
  chrome: Chrome;
  onRequestDelete: () => void;
  large: boolean;
}) {
  const columns = large ? GRID_COLUMNS_AX : GRID_COLUMNS;
  const height = view.noteFocused
    ? TILE_ROW - 8
    : large
      ? TILE_ROW_AX
      : view.complete
        ? TILE_ROW_COMPLETE
        : TILE_ROW;

  const progressLine = TRIP_DETAIL_COPY.packed(view.progress.packed, view.progress.total);

  return (
    <>
      {/* The keyboard frame drops the chrome: with a field up there is one
          thing to do, and Done is the way out of it. */}
      {view.noteFocused ? null : <ChromeRow chrome={chrome} />}

      {view.noteFocused ? (
        <HeroCondensed destination={view.destination} progressLine={progressLine} />
      ) : (
        <Hero
          destination={view.destination}
          dates={view.dates}
          mark={view.mark}
          badge={view.complete}
          // Above the threshold the bar becomes this sentence and leaves.
          progressLine={large ? progressLine : null}
          large={large}
        />
      )}

      {!large && !view.noteFocused ? (
        <ProgressRow progress={view.progress} complete={view.complete} />
      ) : null}

      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: large || view.noteFocused ? 14 : 0,
          paddingBottom: 16,
          gap: GROUP_GAP,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        {view.groups.map((group) => (
          <DayGrid
            key={group.key}
            group={{
              ...group,
              // The completion frame drops the day captions: the plate has
              // settled and the caption's job — telling you what is still
              // being decided — is finished.
              caption: view.complete ? null : group.caption,
            }}
            columns={columns}
            height={height}
            large={large}
            complete={view.complete}
            compact={view.noteFocused}
            onToggle={view.onToggle}
          />
        ))}
      </ScrollView>

      {/*
        The completion frame has no note plate and no quiet actions — one way
        onward and nothing else. That is a COMPOSITION change rather than a
        disabled control: the note and the two actions are still reachable, by
        unticking a piece, which is the same gesture that got here.
      */}
      {view.complete ? (
        <Foot large={large}>
          <PrimaryCta
            label={TRIP_DETAIL_COPY.seeTheWeek}
            onPress={view.onSeeTheWeek}
            large={large}
          />
        </Foot>
      ) : (
        <View style={{ flexShrink: 0 }}>
          <View style={{ paddingHorizontal: view.noteFocused ? 16 : GUTTER, paddingTop: 14 }}>
            <NotePlate
              note={view.note}
              focused={view.noteFocused}
              onChange={view.onNoteChange}
              onFocus={view.onNoteFocus}
              onBlur={view.onNoteBlur}
              large={large}
            />
          </View>

          {view.noteFocused ? (
            <View style={{ height: 10 }} />
          ) : (
            <Foot large={large} ruled={large}>
              {large ? (
                <>
                  <QuietCta
                    label={TRIP_DETAIL_COPY.replan}
                    tone="warm"
                    onPress={view.onReplan}
                    large
                  />
                  <QuietCta
                    label={TRIP_DETAIL_COPY.delete}
                    tone="quiet"
                    onPress={onRequestDelete}
                    large
                  />
                </>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <QuietCta
                    label={TRIP_DETAIL_COPY.replan}
                    tone="warm"
                    onPress={view.onReplan}
                    large={false}
                  />
                  <QuietCta
                    label={TRIP_DETAIL_COPY.delete}
                    tone="quiet"
                    onPress={onRequestDelete}
                    large={false}
                  />
                </View>
              )}
            </Foot>
          )}
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The delete sheet
// ---------------------------------------------------------------------------

/**
 * The confirmation, over a scrim.
 *
 * "Cost before action", the rule `withdraw-consent-sheet.tsx` states: what the
 * choice removes is spelled out above the button that does it, in the present
 * tense — and here the second half of that sentence is the LAW of this page.
 * "Your garments stay in the closet" is true because `useDeleteTrip` names one
 * table, and `tests/trip-detail-layout.test.ts` holds it to that. A confirmation
 * that promised it while the mutation swept item ids would be the worst kind of
 * copy: reassuring, and wrong.
 *
 * The scrim cancels. Backing out means "leave the trip exactly as it is", which
 * is the safe and complete answer and the state the reader is already in.
 *
 * Rendered inline rather than through `Modal`: this page is already a pushed
 * route inside a stack, the sheet has no keyboard and no scroll of its own, and
 * an absolute layer keeps the plate visibly behind it — which is what the frame
 * draws. It is hidden from assistive tech's traversal by
 * `accessibilityViewIsModal`, so VoiceOver is trapped in the sheet exactly as
 * a `Modal` would trap it.
 */
function DeleteSheet({
  destination,
  deleting,
  onCancel,
  onConfirm,
  large,
}: {
  destination: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  large: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        backgroundColor: theme.scrim,
      }}>
      <PressableSurface
        fill
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        disabled={deleting}
        onPress={onCancel}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: theme.canvas,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          paddingTop: 12,
          flexShrink: 0,
        }}>
        <View style={{ alignItems: 'center', flexShrink: 0 }}>
          <View
            style={{
              width: SHEET_GRABBER_WIDTH,
              height: SHEET_GRABBER_HEIGHT,
              borderRadius: SHEET_GRABBER_HEIGHT / 2,
              backgroundColor: theme.sand,
            }}
          />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 12, flexShrink: 0 }}>
          <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 3 }}>
            {TRIP_DETAIL_COPY.deleteTitle(destination)}
          </Text>
          <Text variant="body" className="text-muted" style={{ maxWidth: 300 }}>
            {TRIP_DETAIL_COPY.deleteBody}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: 24,
            paddingBottom: 26,
            gap: 10,
            flexShrink: 0,
          }}>
          <PrimaryCta
            label={TRIP_DETAIL_COPY.deleteConfirm}
            onPress={onConfirm}
            busy={deleting}
            large={large}
          />
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={TRIP_DETAIL_COPY.deleteCancel}
            disabled={deleting}
            onPress={onCancel}
            style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.tray }}
            contentStyle={{
              minHeight: large ? CTA_MIN_HEIGHT_AX : CTA_MIN_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}>
            <Text variant={large ? 'heading' : 'body'} style={{ textAlign: 'center' }}>
              {TRIP_DETAIL_COPY.deleteCancel}
            </Text>
          </PressableSurface>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** The destination the sheet names, whichever body is behind it. */
function destinationOf(body: TripDetailBody): string {
  return body.destination;
}

export function TripDetailBodyView({
  view,
  large = false,
}: {
  view: TripDetailView;
  large?: boolean;
}) {
  const theme = useTheme();
  const chrome: Chrome = { onBack: view.onBack, onMore: view.onMore };

  return (
    // `style`, not a class: NativeWind's interop is registered for the RN
    // primitives, and this wrapper forwards props to `KeyboardAvoidingView`
    // through its own component — the trap `tokens.ts` documents for animated
    // grounds applies here for the same reason.
    <KeyboardAvoidingScreen style={{ flex: 1, backgroundColor: theme.canvas }}>
      {view.body.state === 'loading' ? (
        <LoadingBody destination={view.body.destination} chrome={chrome} large={large} />
      ) : view.body.state === 'error' ? (
        <ErrorBody view={view.body} chrome={chrome} large={large} />
      ) : view.body.state === 'empty' ? (
        <EmptyBody
          view={view.body}
          chrome={chrome}
          onRequestDelete={view.onRequestDelete}
          large={large}
        />
      ) : (
        <PlateBody
          view={view.body}
          chrome={chrome}
          onRequestDelete={view.onRequestDelete}
          large={large}
        />
      )}

      {view.deleteOpen ? (
        <DeleteSheet
          destination={destinationOf(view.body)}
          deleting={view.deleting}
          onCancel={view.onCancelDelete}
          onConfirm={view.onConfirmDelete}
          large={large}
        />
      ) : null}
    </KeyboardAvoidingScreen>
  );
}

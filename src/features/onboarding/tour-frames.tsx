import {
  Pressable,
  ScrollView,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { formatTemp } from '@/features/context/weather';
import {
  TOUR_FRAMES,
  TOUR_SAMPLE_FEELS_C,
  TOUR_SAMPLE_ITEM,
  TOUR_SAMPLE_ITEM_CATEGORY,
  TOUR_SAMPLE_ITEM_COLOUR,
  TOUR_SAMPLE_LAST_WORN,
  TOUR_SAMPLE_LOOK,
  TOUR_SAMPLE_SKY,
  TOUR_SAMPLE_WEEKDAY,
  TOUR_UNITS,
  type TourFrame,
} from '@/features/onboarding/tour-copy';
import {
  ACTION_PAD,
  CAMERA_AFTER,
  CAMERA_BEFORE,
  CAMERA_CARD_HEIGHT,
  CAMERA_CARD_HEIGHT_COMPACT,
  CARD_RADIUS,
  CARD_RADIUS_COMPACT,
  CHEVRON_COLUMN,
  CHEVRON_COLUMN_COMPACT,
  CHEVRON_SIZE,
  CLOSET_COLUMNS,
  CLOSET_GAP,
  CLOSET_WELL_HEIGHT,
  CLOSET_WELL_HEIGHT_COMPACT,
  closetCells,
  captionVisible,
  EYEBROW_TRACKING,
  GARMENT_SHAPES,
  HEADLINE_LEADING_RATIO,
  MARK_GAP,
  MARK_HEIGHT,
  MARK_WIDTH,
  MORNING_FOOTER_SIZE,
  MORNING_PAD,
  MORNING_PLATE,
  MORNING_WEATHER_SIZE,
  MORNING_WEEKDAY_SIZE,
  MORNING_WEEKDAY_SIZE_COMPACT,
  MORNING_WELL_HEIGHT,
  MORNING_WELL_HEIGHT_COMPACT,
  PAD,
  PLATE_PAD,
  PLATE_RADIUS,
  PLATE_RADIUS_COMPACT,
  TOUR,
  tourMeasure,
  VIEWFINDER_CORNER,
  VIEWFINDER_INSET,
  VIEWFINDER_STROKE,
  WELL_RADIUS,
  WELL_RADIUS_COMPACT,
  type PlateCell,
  type TourMeasure,
} from '@/features/onboarding/tour-spec';
import { isLastFrame } from '@/features/onboarding/tour-state';
import { leading } from '@/theme/font-metrics';
import { canvasAlpha, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

/**
 * Redesign 20 — the three spreads of the first-run tour (TR-01…TR-03), drawn
 * once and used by both the real route (`src/app/tour.tsx`) and the dev
 * fixtures, so what a reviewer looks at is the screen rather than a redrawing
 * of it.
 *
 * The composition is the redesign: the illustration is at the TOP, above the
 * eyebrow, and the words are set beneath it. Everything this file draws it
 * reads from `tour-copy.ts` (the sentences) and `tour-spec.ts` (the colour, the
 * geometry, the garment shapes and which composition a given text size gets).
 * Nothing here types a hex or a sentence.
 *
 * ── THE RULE THIS FILE EXISTS TO KEEP ───────────────────────────────────────
 *
 * Nothing here raises a permission dialog, reads the camera, or asks for a
 * location. The tour is three pages of print: the camera on TR-02 and the
 * weather on TR-03 are DRAWN — SVG polygons and a formatted sample number — and
 * the real prompts are raised later by the screens that need them. This is the
 * atlas's most absolute rule, the brief's one explicit "keep", and
 * `tests/tour-layout.test.ts` scans this module's imports for it.
 *
 * ── ONE SANS CUT, INCLUDING WHERE THE FRAME DREW TWO ────────────────────────
 *
 * The frames set Skip, both CTAs, the secondary and the sample item's name in a
 * 600 weight. The app has one sans cut and no Medium (TY-01), so the emphasis
 * is rebuilt from SIZE (the CTA label is 17 against the 15 around it), COLOUR
 * (cream on oxblood inside the button, oxblood on paper for the text action)
 * and CASE and SPACE (the eyebrow is uppercase at 11.5 with 16% tracking).
 * Recorded as a deviation from frame, exactly as `run-parts.tsx` records it.
 */

// ---------------------------------------------------------------------------
// The drawn garment
// ---------------------------------------------------------------------------

/**
 * One silhouette, at the size the frame draws it.
 *
 * `preserveAspectRatio="none"` on a 0–100 viewBox is what makes the spec's
 * points the frame's own `clip-path` percentages rather than an approximation
 * of them: both stretch the shape to the box instead of fitting it inside.
 */
function Garment({ cell }: { cell: PlateCell }) {
  return (
    <Svg
      width={cell.width}
      height={cell.height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none">
      <Polygon points={GARMENT_SHAPES[cell.shape]} fill={cell.fill} />
    </Svg>
  );
}

/**
 * A well with a garment in it. `cell.well === null` is the plate's accent.
 *
 * ALWAYS A DIRECT CHILD OF A ROW. `flex: 1` and `height` on one view only agree
 * when the flex axis is horizontal: in a column parent, `flex: 1` expands to
 * `flexBasis: 0` on the MAIN axis, which is the same axis `height` is on, and
 * the basis wins — so the well silently collapses to nothing and takes the
 * garment with it. That is exactly what happened on TR-01 when each well was
 * wrapped in a column cell to fake a grid; `ClosetPlate` builds real rows now.
 */
function Well({ cell, height, radius }: { cell: PlateCell; height: number; radius: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        height,
        borderRadius: radius,
        backgroundColor: cell.well ?? theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <Garment cell={cell} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The three plates
// ---------------------------------------------------------------------------

/**
 * TR-01 — six pieces of a closet in a panel, on the ink ground.
 *
 * The panel is one step up from the ground rather than a card with a border:
 * on ink a hairline reads as a scratch, and the frames separate the plate from
 * the page with tone alone.
 */
function ClosetPlate({ measure }: { measure: TourMeasure }) {
  const compact = measure.plate === 'compact';
  const cells = closetCells(measure.plate);
  const wellHeight = compact ? CLOSET_WELL_HEIGHT_COMPACT : CLOSET_WELL_HEIGHT;

  /**
   * Real rows, not a wrapped basis.
   *
   * The first build laid all six cells into one `flexWrap` row at
   * `flexBasis: 33.333%`, which is wrong twice over. React Native does not
   * subtract `gap` from a percentage basis, so three cells plus two 8pt gaps
   * came to 100% + 16pt and the third wrapped; and each cell was a COLUMN
   * wrapper, which is what collapsed the wells (see `Well`). Chunking into rows
   * of `CLOSET_COLUMNS` fixes both: every well is a direct row child dividing
   * the space left after the gaps, which is what the frame draws and what
   * survives a 320pt screen and an iPad alike.
   */
  const rows: PlateCell[][] = [];
  for (let i = 0; i < cells.length; i += CLOSET_COLUMNS) {
    rows.push(cells.slice(i, i + CLOSET_COLUMNS));
  }

  return (
    <View
      style={{
        backgroundColor: TOUR.inkPanel,
        borderRadius: compact ? PLATE_RADIUS_COMPACT : PLATE_RADIUS,
        padding: compact ? 12 : 16,
        gap: CLOSET_GAP,
      }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: CLOSET_GAP }}>
          {row.map((cell, i) => (
            <Well
              key={`${cell.shape}-${i}`}
              cell={cell}
              height={wellHeight}
              radius={compact ? WELL_RADIUS_COMPACT : WELL_RADIUS}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** The viewfinder's four corner marks. A drawing of a frame, never a preview. */
function ViewfinderCorners() {
  const theme = useTheme();
  const corners = [
    { top: VIEWFINDER_INSET, left: VIEWFINDER_INSET, borderLeftWidth: VIEWFINDER_STROKE, borderTopWidth: VIEWFINDER_STROKE },
    { top: VIEWFINDER_INSET, right: VIEWFINDER_INSET, borderRightWidth: VIEWFINDER_STROKE, borderTopWidth: VIEWFINDER_STROKE },
    { bottom: VIEWFINDER_INSET, left: VIEWFINDER_INSET, borderLeftWidth: VIEWFINDER_STROKE, borderBottomWidth: VIEWFINDER_STROKE },
    { bottom: VIEWFINDER_INSET, right: VIEWFINDER_INSET, borderRightWidth: VIEWFINDER_STROKE, borderBottomWidth: VIEWFINDER_STROKE },
  ] as const;

  return (
    <>
      {corners.map((c, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: VIEWFINDER_CORNER,
            height: VIEWFINDER_CORNER,
            // `ruleStrong` is ink at 28% — the frame draws 35%. It is a
            // decorative mark on a drawing, not a control boundary, so the
            // token is spent rather than a fifth ink alpha typed by hand.
            borderColor: theme.ruleStrong,
            ...c,
          }}
        />
      ))}
    </>
  );
}

/**
 * TR-02 — the transformation, photograph to filed piece.
 *
 * A picture of a shutter and a result card, side by side. The tour never opens
 * the camera and never asks for it; there is no `expo-camera` import in this
 * module's graph and a test scans for one.
 */
function CameraPlate({ measure }: { measure: TourMeasure }) {
  const theme = useTheme();
  const compact = measure.plate === 'compact';
  const height = compact ? CAMERA_CARD_HEIGHT_COMPACT : CAMERA_CARD_HEIGHT;
  const radius = compact ? CARD_RADIUS_COMPACT : CARD_RADIUS;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          height,
          borderRadius: radius,
          backgroundColor: TOUR.well,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <ViewfinderCorners />
        {/* The piece is not square to the frame — a photograph of something
            laid on a table never is, and the tilt is what says "this is the
            before" without a caption. */}
        <View style={{ transform: [{ rotate: '-6deg' }] }}>
          <Garment cell={CAMERA_BEFORE} />
        </View>
      </View>

      <View
        style={{
          width: compact ? CHEVRON_COLUMN_COMPACT : CHEVRON_COLUMN,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {/* Two borders on a rotated square: the frame's own chevron, and one
            fewer SVG than drawing it as a path. It carries no content — the
            sentence it illustrates is the body copy above. */}
        <View
          style={{
            width: CHEVRON_SIZE,
            height: CHEVRON_SIZE,
            borderRightWidth: VIEWFINDER_STROKE,
            borderTopWidth: VIEWFINDER_STROKE,
            borderColor: theme.accent,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>

      <View
        style={{
          flex: 1,
          minWidth: 0,
          height,
          borderRadius: radius,
          backgroundColor: theme.blush,
          borderWidth: 1,
          borderColor: TOUR.cardRule,
          overflow: 'hidden',
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.tray,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Garment cell={CAMERA_AFTER} />
        </View>
        {captionVisible(measure.plate) ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 }}>
            <RNText
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{ fontFamily: 'HelveticaNeue', fontSize: 13.5, color: theme.ink }}>
              {TOUR_SAMPLE_ITEM}
            </RNText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  flexShrink: 0,
                  backgroundColor: TOUR.camel,
                }}
              />
              <RNText
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_TEXT_SCALE}
                style={{
                  fontFamily: 'HelveticaNeue',
                  fontSize: 11.5,
                  color: theme.muted,
                  flexShrink: 1,
                }}>
                {`${TOUR_SAMPLE_ITEM_COLOUR} · ${TOUR_SAMPLE_ITEM_CATEGORY}`}
              </RNText>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The sample weather line — the app's own formatter, never a typed glyph. */
export function tourWeatherLine(): string {
  return `${formatTemp(TOUR_SAMPLE_FEELS_C, TOUR_UNITS)}${TOUR_UNITS} · ${TOUR_SAMPLE_SKY}`;
}

/** TR-03 — the page the habit produces, in miniature. */
function MorningPlate({ measure }: { measure: TourMeasure }) {
  const theme = useTheme();
  const compact = measure.plate === 'compact';

  return (
    <View
      style={{
        backgroundColor: theme.tray,
        borderRadius: compact ? PLATE_RADIUS_COMPACT : PLATE_RADIUS,
        padding: compact ? 12 : 16,
        gap: compact ? 9 : 12,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <RNText
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: compact ? MORNING_WEEKDAY_SIZE_COMPACT : MORNING_WEEKDAY_SIZE,
            color: theme.ink,
            flexShrink: 1,
          }}>
          {TOUR_SAMPLE_WEEKDAY}
        </RNText>
        <RNText
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: MORNING_WEATHER_SIZE,
            color: theme.muted,
            marginLeft: 'auto',
            flexShrink: 0,
          }}>
          {tourWeatherLine()}
        </RNText>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {MORNING_PLATE.map((cell, i) => (
          <Well
            key={`${cell.shape}-${i}`}
            cell={cell}
            height={compact ? MORNING_WELL_HEIGHT_COMPACT : MORNING_WELL_HEIGHT}
            radius={compact ? WELL_RADIUS_COMPACT : WELL_RADIUS}
          />
        ))}
      </View>

      {captionVisible(measure.plate) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <RNText
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: MORNING_FOOTER_SIZE,
              color: theme.muted,
              flexShrink: 1,
            }}>
            {TOUR_SAMPLE_LOOK}
          </RNText>
          {/* The frame sets this in #A39B8B, which is 2.33:1 on the tray. It
              carries a fact about the sample page, so it takes `muted` like
              its neighbour; the hierarchy survives in the size. */}
          <RNText
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: MORNING_FOOTER_SIZE - 0.5,
              color: theme.muted,
              marginLeft: 'auto',
              flexShrink: 0,
            }}>
            {TOUR_SAMPLE_LAST_WORN}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The plate, and the sentence VoiceOver reads instead of it.
 *
 * Every label names the drawing as a sample or an illustration, so nothing on
 * this screen can be mistaken for the reader's own closet, look or history.
 */
const PLATE_LABELS: Record<TourFrame['plate'], string> = {
  closet: 'Sample closet, illustration.',
  transformation: 'Illustration: a photograph becomes a filed piece.',
  morning: 'Sample of the Today page, illustration.',
};

function Plate({ frame, measure }: { frame: TourFrame; measure: TourMeasure }) {
  const inset = frame.plate === 'morning' ? MORNING_PAD : PLATE_PAD;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={PLATE_LABELS[frame.plate]}
      style={{ paddingHorizontal: measure.plate === 'compact' ? PLATE_PAD : inset }}>
      {frame.plate === 'closet' ? <ClosetPlate measure={measure} /> : null}
      {frame.plate === 'transformation' ? <CameraPlate measure={measure} /> : null}
      {frame.plate === 'morning' ? <MorningPlate measure={measure} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

/**
 * The progress marks — three dashes, left-aligned above the action.
 *
 * The `progressbar` wrapper is rendered whether or not the dashes are, because
 * the announcement is not decoration: at the largest text sizes the marks are
 * dropped for room and "Frame 2 of 3" still has to reach VoiceOver.
 */
function Marks({ index, dark, visible }: { index: number; dark: boolean; visible: boolean }) {
  const theme = useTheme();
  const lit = dark ? theme.canvas : theme.ink;
  const spent = dark ? canvasAlpha(0.28) : TOUR.markSpent;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Frame ${index + 1} of ${TOUR_FRAMES.length}`}
      style={
        visible
          ? { flexDirection: 'row', alignItems: 'center', gap: MARK_GAP, paddingHorizontal: PAD }
          : undefined
      }>
      {visible
        ? TOUR_FRAMES.map((f, i) => (
            <View
              key={f.id}
              style={{
                width: MARK_WIDTH,
                height: MARK_HEIGHT,
                borderRadius: MARK_HEIGHT / 2,
                backgroundColor: i === index ? lit : spent,
              }}
            />
          ))
        : null}
    </View>
  );
}

/**
 * The one filled CTA — a full-width oxblood capsule, on both grounds.
 *
 * NOT the house `Button`: the frames draw a 56pt capsule (radius = height / 2)
 * and the constitution's labelled-control radius is 12. That is the same
 * departure redesign 19's `RunButton` already ships, made for the same reason —
 * the artifact decides the radius (DIRECTIVE §1) — and it is why this is a
 * local `Pressable` rather than a new house variant nobody else asked for.
 *
 * The oxblood is spent here on ALL THREE frames, including the ink one. The
 * shipped tour drew a canvas pill on ink because the one-oxblood-per-screen law
 * forbade the accent on a "Next"; that law is repealed.
 *
 * ── HOW THE GROUND IS PAINTED, AND WHY IT IS NOT ON THE PRESSABLE ───────────
 *
 * The house pattern, spelled out in `use-press-feedback.ts` and used by the
 * pill this replaces: the `Pressable` is the hit target and carries only its
 * height, and the GROUND goes on an `Animated.View` with inline OBJECT styles.
 * The first build put the oxblood in a function `style` on the Pressable
 * itself, which is the combination that renders as a bare label — NativeWind's
 * interop is registered on the RN primitives and does not preserve a
 * style-resolver function through them. Object styles on a plain view are
 * unambiguous, and `usePressFeedback` carries the directive's depression with
 * `ReduceMotion.System` built in, so there is no hand-rolled guard to get wrong.
 */
function TourAction({
  label,
  onPress,
  measure,
}: {
  label: string;
  onPress: () => void;
  measure: TourMeasure;
}) {
  const theme = useTheme();
  const press = usePressFeedback();
  const height = Math.max(MIN_TAP_TARGET, measure.ctaHeight);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: height }}>
      <Animated.View
        style={[
          {
            minHeight: height,
            borderRadius: height / 2,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            backgroundColor: theme.accent,
          },
          press.style,
        ]}>
        <RNText
          numberOfLines={2}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: measure.ctaLabelSize,
            color: theme.canvas,
            textAlign: 'center',
          }}>
          {label}
        </RNText>
      </Animated.View>
    </Pressable>
  );
}

/** TR-03's text action. Text, never a second button — the atlas is explicit. */
function TourSecondary({
  label,
  onPress,
  measure,
}: {
  label: string;
  onPress: () => void;
  measure: TourMeasure;
}) {
  const theme = useTheme();
  const press = usePressFeedback();
  const height = Math.max(MIN_TAP_TARGET, measure.secondaryHeight);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: height }}>
      <Animated.View
        style={[
          { minHeight: height, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
          press.style,
        ]}>
        <RNText
          numberOfLines={2}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: measure.ctaLabelSize - 1,
            color: theme.accent,
            textAlign: 'center',
          }}>
          {label}
        </RNText>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Skip — the affordance the brief calls law.
 *
 * One component, two placements: quiet in the top-right corner at the default
 * text sizes, a full row above the action at the accessibility ones. It is
 * never smaller than the tap floor and it is never absent from a frame that
 * `skipVisible` says carries it.
 *
 * The frame sets it in #8A8375, which is `faint` and 3.52:1 on paper — an AA
 * failure on a control's own label. `muted` is one step darker at 5.46:1 and
 * still reads as the quiet thing on the page. On ink the canvas colour held
 * back is the quiet layer, as everywhere else in the app.
 */
function SkipAction({
  onPress,
  dark,
  measure,
  placement,
}: {
  onPress: () => void;
  dark: boolean;
  measure: TourMeasure;
  placement: 'corner' | 'foot';
}) {
  const theme = useTheme();
  const press = usePressFeedback();
  const height = Math.max(MIN_TAP_TARGET, measure.skipHeight);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip the tour"
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{
        minHeight: height,
        alignSelf: placement === 'corner' ? 'flex-end' : 'stretch',
      }}>
      <Animated.View
        style={[
          { minHeight: height, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
          press.style,
        ]}>
        <RNText
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: measure.skipLabelSize,
            color: dark ? canvasAlpha(0.66) : theme.muted,
          }}>
          Skip
        </RNText>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export type TourFrameHandlers = {
  /** TR-01/TR-02's "Next". */
  onNext: () => void;
  /** Skip, from either of the first two frames. Lands on the app. */
  onSkip: () => void;
  /** TR-03's "Start with the camera". */
  onCamera: () => void;
  /** TR-03's "I'll look around first". Lands on the app. */
  onLookAround: () => void;
};

/**
 * One spread of the tour, by index.
 *
 * Everything about a frame that differs — ground, plate, whether Skip is there,
 * which pair of exits the foot carries — is read from `tour-copy.ts`, so a
 * change to the deck is a change to one array and not to this file.
 *
 * ── MOTION ──────────────────────────────────────────────────────────────────
 *
 * Frames change with a cross-fade, keyed on the frame id, and that is the whole
 * of it. Under Reduce Motion the composition is identical and the fade is
 * dropped — nothing here translates, scales or staggers, so there is no second
 * thing to guard.
 */
export function TourFrameView({
  frame,
  index,
  measure: forced,
  onNext,
  onSkip,
  onCamera,
  onLookAround,
}: {
  frame: TourFrame;
  index: number;
  /**
   * DEV FIXTURES ONLY — force a composition the device cannot be asked for.
   *
   * The iOS text slider cannot be set from a deep link and the simulator will
   * not become a 667pt phone mid-session, so a frame nobody can reach on demand
   * is a frame nobody checks. The shipping route never passes this; when it is
   * absent the composition is read from the real window, which is the only
   * thing that decides it in production.
   */
  measure?: TourMeasure;
} & TourFrameHandlers) {
  const theme = useTheme();
  const { fontScale, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const measure = forced ?? tourMeasure({ fontScale, height });

  const dark = frame.ground === 'ink';
  const last = isLastFrame(index);
  const quiet = dark ? canvasAlpha(0.72) : theme.muted;
  const loud = dark ? theme.canvas : theme.ink;
  const headlineSize = measure.headlineSize;

  const skip = frame.skippable ? (
    <SkipAction onPress={onSkip} dark={dark} measure={measure} placement={measure.skip} />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? theme.ink : theme.canvas }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Animated.View
          // Keyed on the frame so the cross-fade fires per beat rather than
          // once on mount. `entering` is simply absent under Reduce Motion —
          // the tree, and therefore the composition, is identical either way.
          key={frame.id}
          entering={reduced ? undefined : FadeIn.duration(220)}
          style={{ flex: 1 }}>
          {skip && measure.skip === 'corner' ? (
            <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>{skip}</View>
          ) : (
            <View style={{ height: 6 }} />
          )}

          <Plate frame={frame} measure={measure} />

          {/* The copy scrolls rather than clamps. At the largest text sizes
              four lines of body become eight, and the accessibility note is
              explicit that nothing is capped, truncated or scaled down —
              which leaves growing the block and letting it move. */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: PAD,
              paddingTop: measure.plate === 'compact' ? 18 : 24,
              paddingBottom: 12,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: measure.eyebrowSize,
                letterSpacing: measure.eyebrowSize * EYEBROW_TRACKING,
                textTransform: 'uppercase',
                // The frame's clay eyebrow survives on ink and does not on
                // paper — see the contrast note in `tour-spec.ts`.
                color: dark ? TOUR.inkEyebrow : theme.muted,
              }}>
              {frame.eyebrow}
            </RNText>

            <RNText
              maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
              style={{
                fontFamily: 'InstrumentSerif_400Regular',
                fontSize: headlineSize,
                // Instrument Serif needs its own line box or iOS slices the
                // ascenders. Never a hand-written lineHeight.
                lineHeight: leading('instrument', headlineSize, HEADLINE_LEADING_RATIO),
                color: loud,
              }}>
              {frame.headline}
            </RNText>

            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: measure.bodySize,
                lineHeight: measure.bodySize * (measure.large ? 1.42 : 1.5),
                color: quiet,
              }}>
              {frame.body}
            </RNText>
          </ScrollView>

          <View style={{ paddingBottom: 10, gap: 8 }}>
            <Marks index={index} dark={dark} visible={measure.marks} />

            <View style={{ paddingHorizontal: ACTION_PAD, gap: 6 }}>
              {skip && measure.skip === 'foot' ? skip : null}
              <TourAction
                label={frame.action}
                onPress={last ? onCamera : onNext}
                measure={measure}
              />
              {frame.secondary ? (
                <TourSecondary
                  label={frame.secondary}
                  onPress={onLookAround}
                  measure={measure}
                />
              ) : null}
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

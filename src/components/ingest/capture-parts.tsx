import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { haptics } from '@/lib/haptics';
import { leading } from '@/theme/font-metrics';
import {
  CAPTURE,
  DECISION,
  PAGE,
  STAGE_ALPHA,
  VIEWFINDER,
  guideHeightFor,
  type FilingRow,
  type RowTone,
} from '@/features/ingest/capture-spec';
import { canvasAlpha, MIN_TAP_TARGET, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Redesign 22's drawing hand.
 *
 * Every part here is presentational and decides nothing: which state the
 * capture route is in, whether a celebration has been earned, what a queue's
 * rows say — all of that is `capture-spec.ts`, which is pure and tested.
 * The route hands these props and they paint.
 *
 * A component file rather than blocks inside `capture.tsx` for the reason
 * `camera-ask.tsx`'s own header gives: the dev fixtures have to draw THE SAME
 * chrome. A capture route cannot mount the real stage in a simulator — there is
 * no camera, and a live preview produces different bytes every frame — so a
 * posed copy in a fixture would be a second implementation of the page, free to
 * drift from the one that ships. One set of parts, two call sites, no drift.
 *
 * `className` is used for layout and for palette grounds. Anything on an
 * `Animated.View` is an inline style: NativeWind's interop is registered for
 * the React Native primitives only, so a class on a Reanimated component is
 * silently dropped — see `use-press-feedback.ts`.
 */

// ---------------------------------------------------------------------------
// The stage — frames 04, 05, 06, 21
// ---------------------------------------------------------------------------

/**
 * The close disc, top left of every dark frame, and of the two light doors.
 *
 * A 44pt circle on the stage and a 44pt rounded square on canvas, which is what
 * frames 04 and 01 draw respectively — the shape follows the ground, because a
 * circle on paper reads as a photograph's crop mark and a square on the stage
 * reads as a button someone forgot to round.
 */
export function CloseDisc({
  onPress,
  tone = 'stage',
  glyph = 'xmark',
  label = 'Close',
}: {
  onPress: () => void;
  tone?: 'stage' | 'canvas';
  glyph?: 'xmark' | 'chevron.left';
  label?: string;
}) {
  const theme = useTheme();
  const press = usePressFeedback();
  const onStage = tone === 'stage';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ width: VIEWFINDER.closeDiameter, height: VIEWFINDER.closeDiameter }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: onStage ? VIEWFINDER.closeDiameter / 2 : 14,
            backgroundColor: onStage ? canvasAlpha(STAGE_ALPHA.chrome) : theme.tray,
          },
          press.style,
        ]}>
        <SymbolView
          name={glyph}
          size={glyph === 'xmark' ? 15 : 17}
          tintColor={onStage ? theme.canvas : theme.ink}
          resizeMode="scaleAspectFit"
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The one pill on the stage — "Flat lay" until something is held, then a count.
 *
 * A LABEL, NOT A CONTROL. The frames draw one pill and never a pressed or
 * alternate state for it, and there is no second capture mode in this app to
 * switch to; drawing it as a button would put a control on the stage that does
 * nothing, which is the thing the whole chrome pass exists to remove. It is a
 * live region because the count in it changes as the shutter is worked, and
 * that change is the only confirmation a shot landed.
 */
export function StagePill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      className="items-center justify-center"
      style={{
        minHeight: VIEWFINDER.pillHeight,
        paddingHorizontal: VIEWFINDER.pillPadding,
        borderRadius: VIEWFINDER.pillHeight / 2,
        backgroundColor: canvasAlpha(STAGE_ALPHA.chrome),
      }}>
      <Text variant="note" style={{ fontSize: 14, color: theme.canvas }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The framing guide — four corner marks, and nothing else.
 *
 * CP-01 drew one dashed rectangle inset from the preview. Frame 04 draws four
 * 34pt Ls at 3pt, which is the same instruction with three-quarters of the ink
 * taken out of it: a dashed box over a live garment is a second rectangle
 * competing with the garment's own edges, and the corners say "fill this" while
 * showing more of the picture.
 *
 * `pointerEvents="none"` throughout, for the reason CP-01's guide gave: a guide
 * that swallowed a tap on the preview would be chrome pretending to be a
 * control. The height comes from `guideHeightFor`, which is what makes frame
 * 21's short device a rule rather than a second component.
 */
export function FramingCorners({ previewHeight }: { previewHeight: number }) {
  const height = guideHeightFor(previewHeight);
  const stroke = canvasAlpha(STAGE_ALPHA.guide);
  const arm = VIEWFINDER.cornerSize;
  const w = VIEWFINDER.cornerStroke;
  const r = VIEWFINDER.cornerRadius;

  const corner = (
    key: string,
    pos: { top?: number; bottom?: number; left?: number; right?: number },
    borders: object,
  ) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        width: arm,
        height: arm,
        borderColor: stroke,
        ...pos,
        ...borders,
      }}
    />
  );

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: VIEWFINDER.guideWidth,
        height,
        // The guide is centred in the preview, and the preview is what the
        // route sizes — so this is a child of it rather than an absolute layer
        // measured against the screen.
        alignSelf: 'center',
      }}>
      {corner('tl', { top: 0, left: 0 }, {
        borderLeftWidth: w,
        borderTopWidth: w,
        borderTopLeftRadius: r,
      })}
      {corner('tr', { top: 0, right: 0 }, {
        borderRightWidth: w,
        borderTopWidth: w,
        borderTopRightRadius: r,
      })}
      {corner('bl', { bottom: 0, left: 0 }, {
        borderLeftWidth: w,
        borderBottomWidth: w,
        borderBottomLeftRadius: r,
      })}
      {corner('br', { bottom: 0, right: 0 }, {
        borderRightWidth: w,
        borderBottomWidth: w,
        borderBottomRightRadius: r,
      })}
    </View>
  );
}

/**
 * The shutter — 76pt, filled canvas, the one bright element on the stage.
 *
 * Disabled rather than absent while the permission is not granted: the frames
 * draw the control row on every dark state, and a shutter that vanishes while
 * iOS's own alert is up would take the row's whole composition with it. The
 * hint says which of the three reasons it is inert for.
 */
export function Shutter({
  onPress,
  disabled,
  busy,
  hint,
}: {
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  hint: string;
}) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled && !busy);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take a photograph"
      accessibilityHint={hint}
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ width: VIEWFINDER.shutter, height: VIEWFINDER.shutter }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: VIEWFINDER.shutter / 2,
            backgroundColor: theme.canvas,
            opacity: disabled ? 0.35 : 1,
          },
          press.style,
        ]}>
        <View
          style={{
            width: VIEWFINDER.shutterInner,
            height: VIEWFINDER.shutterInner,
            borderRadius: VIEWFINDER.shutterInner / 2,
            borderWidth: VIEWFINDER.shutterInnerStroke,
            borderColor: CAPTURE.stage,
            opacity: busy ? 0.5 : 1,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The library door — a 52pt well, and once something is held, the last frame in
 * it with a count badge.
 *
 * THE FRAME DRAWS A PHOTOGRAPH IN THIS WELL and now there genuinely is one to
 * draw: the shot the user just took, held by the queue as a local file URI.
 * That is the shipped `job.localUri` and nothing else — CP-01's version had to
 * leave the well empty because reading the user's most recent library picture
 * needs a permission this door explicitly does not ask for, and that is still
 * true, so the well shows the batch and never the camera roll.
 */
export function LibraryDoor({
  onPress,
  thumbUri,
  count,
  hint,
}: {
  onPress: () => void;
  thumbUri: string | null;
  count: number;
  hint: string;
}) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Choose from library. ${count} held in this batch` : 'Choose from library'
      }
      accessibilityHint={hint}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ width: VIEWFINDER.door, height: VIEWFINDER.door }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: VIEWFINDER.doorRadius,
            overflow: 'hidden',
            backgroundColor: thumbUri ? CAPTURE.stageWell : canvasAlpha(STAGE_ALPHA.door),
            borderWidth: thumbUri ? 0 : 1,
            borderColor: canvasAlpha(STAGE_ALPHA.doorRule),
          },
          press.style,
        ]}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <SymbolView
            name="photo.on.rectangle"
            size={22}
            tintColor={theme.canvas}
            resizeMode="scaleAspectFit"
          />
        )}
      </Animated.View>

      {count > 0 ? (
        // Outside the clipped well, so the badge is a mark ON the door rather
        // than a corner of the photograph. The one place the accent appears on
        // the stage, and it is a count rather than an action.
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute items-center justify-center"
          style={{
            top: -7,
            right: -7,
            minWidth: VIEWFINDER.badgeDiameter,
            height: VIEWFINDER.badgeDiameter,
            borderRadius: VIEWFINDER.badgeDiameter / 2,
            paddingHorizontal: 5,
            backgroundColor: theme.accent,
          }}>
          <Text variant="noteSmall" style={{ fontSize: 12, color: theme.canvas }}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Frame 06's strip — the batch, above the control row.
 *
 * "The strip is the only chrome that grew." Real thumbnails off the queue's own
 * local URIs, never placeholders: this rail's whole job is to prove the shots
 * exist. It is horizontally scrollable by being wider than the screen and is
 * deliberately NOT a ScrollView — a scroll gesture that starts on the strip and
 * ends on the shutter is a shot nobody asked for.
 */
export function HeldStrip({ uris }: { uris: readonly string[] }) {
  if (uris.length === 0) return null;
  return (
    <View
      className="flex-row overflow-hidden"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ gap: VIEWFINDER.stripGap, paddingLeft: 20 }}>
      {uris.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          className="overflow-hidden"
          style={{
            width: VIEWFINDER.stripThumb,
            height: VIEWFINDER.stripThumbHeight,
            borderRadius: VIEWFINDER.stripThumbRadius,
            backgroundColor: CAPTURE.stageWell,
          }}>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Frame 06's "Review 6" pill, in the left slot the library door held.
 *
 * The door does not disappear when this arrives: the frame moves it into the
 * strip's identity (the count badge is on the strip's own first thumbnail) and
 * gives the slot to the forward door. Here the door keeps its slot and this
 * pill takes the row's leading edge underneath it, because the library is a way
 * IN and a screen that removes its own entrances once a batch exists is a
 * screen that has decided the batch is finished on the user's behalf.
 */
export function ReviewPill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const press = usePressFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the review deck for the pieces that have finished filing"
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: VIEWFINDER.reviewPillHeight }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: VIEWFINDER.reviewPillPadding,
            borderRadius: VIEWFINDER.reviewPillHeight / 2,
            backgroundColor: canvasAlpha(STAGE_ALPHA.door),
          },
          press.style,
        ]}>
        <Text variant="body" style={{ fontSize: 15, color: theme.canvas }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** The describe door — the third slot, a mark rather than a word. */
export function DescribeDoor({ onPress }: { onPress: () => void }) {
  const press = usePressFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Describe it instead"
      accessibilityHint="Find a picture of a garment by describing it"
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ width: VIEWFINDER.door, height: VIEWFINDER.door }}>
      <Animated.View
        style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, press.style]}>
        <SymbolView
          name="text.viewfinder"
          size={24}
          tintColor={canvasAlpha(STAGE_ALPHA.quiet)}
          resizeMode="scaleAspectFit"
        />
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The canvas pages — frames 07–10, 14, 17–19
// ---------------------------------------------------------------------------

/** The serif headline and its count subline, on every canvas state. */
export function PageMasthead({
  title,
  sub,
  size = 32,
}: {
  title: string;
  sub?: string | null;
  size?: number;
}) {
  return (
    <View className="px-gutter" style={{ paddingBottom: 14 }}>
      <Text
        variant="title"
        trim
        style={{ fontSize: size, lineHeight: leading('instrument', size, 1.05) }}>
        {title}
      </Text>
      {sub ? (
        <Text variant="note" className="mt-1.5" accessibilityLiveRegion="polite">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One piece, one row — frames 07, 08, 17.
 *
 * THE LADDER IS THE GROUND. The frames separate the four states with four
 * grounds (tray → blush → the pale sand step → amber) and four status inks, and
 * three of those inks fail AA at 13px on their own ground. So the grounds are
 * the frames' and the inks are the contrast record's: `accent` for filed, `ink`
 * for filing, `muted` for waiting and for the amber row. The state is still
 * carried by four distinguishable grounds, and it is still readable, which the
 * frame's own version was not. See `capture-spec.ts`'s dialect note.
 */
export function FilingRowView({ row, imageUri }: { row: FilingRow; imageUri: string | null }) {
  const theme = useTheme();

  const ground: Record<RowTone, string> = {
    filed: theme.tray,
    filing: theme.blush,
    waiting: CAPTURE.rowIdle,
    trouble: warningAlpha(0.2),
  };
  const statusInk: Record<RowTone, string> = {
    filed: theme.accent,
    filing: theme.ink,
    waiting: theme.muted,
    trouble: theme.muted,
  };

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${row.label}. ${row.status}`}
      className="flex-row items-center"
      style={{
        minHeight: PAGE.rowHeight,
        borderRadius: PAGE.rowRadius,
        backgroundColor: ground[row.tone],
        paddingHorizontal: 14,
        gap: 13,
      }}>
      <View
        className="overflow-hidden"
        style={{
          width: PAGE.rowThumbWidth,
          height: PAGE.rowThumbHeight,
          borderRadius: PAGE.rowThumbRadius,
          backgroundColor: CAPTURE.tileFilled,
        }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>

      <Text variant="body" numberOfLines={1} className="flex-1" style={{ fontSize: 15 }}>
        {row.label}
      </Text>

      <Text variant="note" style={{ fontSize: 13, color: statusInk[row.tone] }}>
        {row.status}
      </Text>
    </View>
  );
}

/**
 * The settled grid — frames 09 and 16.
 *
 * Three up at the frames' 9pt gutter, alternating two sand steps so six cells
 * do not read as one slab (the same move `ten-spec.ts` makes across its tray).
 * Photographs where the queue has them; the alternating ground where it does
 * not, rather than a glyph — a placeholder garment drawn inside a grid of real
 * ones is the app inventing a piece.
 */
export function SettledGrid({ uris }: { uris: readonly string[] }) {
  return (
    <View className="flex-row flex-wrap px-gutter" style={{ gap: PAGE.tileGap }}>
      {uris.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          className="overflow-hidden"
          style={{
            // Three up: two gutters shared across three cells, expressed as a
            // percentage so the row reflows under Dynamic Type rather than
            // overflowing a hard-coded width.
            width: `${(100 - 2 * 3.2) / 3}%`,
            height: PAGE.tileHeight,
            borderRadius: PAGE.tileRadius,
            backgroundColor: i % 2 === 0 ? CAPTURE.tileFilled : CAPTURE.tileFilledAlt,
          }}>
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The page's own action stack — one capsule, one tinted second, one quiet third.
 *
 * Local to this page rather than `Button`, and deliberately: the frames draw
 * 56pt capsules at r28 and `Button`'s contract is a 52pt `rounded-md` at r12,
 * which every other screen in the app reads. The directive permits the radius
 * to warm "if the artifacts land there — the artifact decides", and this
 * artifact lands on capsules; changing `button-spec.ts` would land them on
 * thirty screens nobody redesigned. Same settlement, and the same shape, as
 * `TenFoot` in `ten-parts.tsx`.
 *
 * `inverse` is the celebration's palette — canvas capsule on the oxblood page.
 */
export function PageActions({
  primary,
  onPrimary,
  primaryTone = 'accent',
  primaryHint,
  secondary,
  onSecondary,
  secondaryHint,
  quiet,
  onQuiet,
  busy = false,
}: {
  primary: string | null;
  onPrimary?: () => void;
  primaryTone?: 'accent' | 'inverse' | 'tray';
  /** Said to VoiceOver when the label alone does not say what happens next. */
  primaryHint?: string;
  secondary?: string | null;
  onSecondary?: () => void;
  secondaryHint?: string;
  quiet?: string | null;
  onQuiet?: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const primaryPress = usePressFeedback(!busy);
  const secondaryPress = usePressFeedback();
  const quietPress = usePressFeedback();

  const primaryGround =
    primaryTone === 'accent' ? theme.accent : primaryTone === 'inverse' ? theme.canvas : theme.tray;
  const primaryInk = primaryTone === 'accent' ? theme.canvas : theme.accent;

  return (
    <View className="px-gutter" style={{ gap: 6 }}>
      {primary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primary}
          accessibilityHint={primaryHint}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={onPrimary}
          onPressIn={primaryPress.onPressIn}
          onPressOut={primaryPress.onPressOut}
          style={{ minHeight: PAGE.cta }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: PAGE.ctaRadius,
                backgroundColor: primaryGround,
                opacity: busy ? 0.6 : 1,
              },
              primaryPress.style,
            ]}>
            <Text variant="body" style={{ fontSize: 17, color: primaryInk }}>
              {primary}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}

      {secondary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondary}
          accessibilityHint={secondaryHint}
          onPress={onSecondary}
          onPressIn={secondaryPress.onPressIn}
          onPressOut={secondaryPress.onPressOut}
          style={{ minHeight: PAGE.secondary }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: PAGE.secondaryRadius,
                backgroundColor: theme.tray,
              },
              secondaryPress.style,
            ]}>
            <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
              {secondary}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}

      {quiet ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={quiet}
          onPress={onQuiet}
          onPressIn={quietPress.onPressIn}
          onPressOut={quietPress.onPressOut}
          style={{ minHeight: PAGE.quiet }}>
          <Animated.View
            style={[
              { flex: 1, alignItems: 'center', justifyContent: 'center' },
              quietPress.style,
            ]}>
            <Text variant="body" style={{ fontSize: 15, color: theme.accent }}>
              {quiet}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The amber plate — frames 08, 17 and 19, which are three readings of one shape.
 *
 * Eyebrow, sentence, and one or two actions in a row. The eyebrow is `muted`
 * rather than the frames' #8A6A2B: see the contrast note in `capture-spec.ts`.
 * The ground is `warningAlpha`, so the amber is derived from the palette's own
 * `warning` rather than eyedropped as a fourth one nobody can trace.
 */
export function AmberPlate({
  eyebrow,
  body,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  busy = false,
}: {
  eyebrow: string;
  body: string;
  primary: string;
  onPrimary: () => void;
  secondary?: string | null;
  onSecondary?: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const primaryPress = usePressFeedback(!busy);
  const secondaryPress = usePressFeedback();

  return (
    <View
      accessibilityLiveRegion="polite"
      className="px-gutter"
      style={{ paddingTop: 0 }}>
      <View
        style={{
          borderRadius: PAGE.plateRadius,
          backgroundColor: warningAlpha(0.2),
          padding: 17,
          gap: 12,
        }}>
        <Text variant="eyebrow">{eyebrow}</Text>
        <Text variant="body" style={{ fontSize: 15, lineHeight: leading('helvetica', 15, 1.5) }}>
          {body}
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primary}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onPrimary}
            onPressIn={primaryPress.onPressIn}
            onPressOut={primaryPress.onPressOut}
            style={{ minHeight: PAGE.secondary, flex: secondary ? 1 : undefined }}>
            <Animated.View
              style={[
                {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 22,
                  borderRadius: PAGE.secondaryRadius,
                  backgroundColor: theme.accent,
                  opacity: busy ? 0.6 : 1,
                },
                primaryPress.style,
              ]}>
              <Text variant="body" style={{ fontSize: 16, color: theme.canvas }}>
                {primary}
              </Text>
            </Animated.View>
          </Pressable>

          {secondary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secondary}
              onPress={onSecondary}
              onPressIn={secondaryPress.onPressIn}
              onPressOut={secondaryPress.onPressOut}
              style={{ minHeight: PAGE.secondary, flex: 1 }}>
              <Animated.View
                style={[
                  {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 18,
                    borderRadius: PAGE.secondaryRadius,
                    backgroundColor: theme.canvas,
                  },
                  secondaryPress.style,
                ]}>
                <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
                  {secondary}
                </Text>
              </Animated.View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The three decisions — frames 11, 20, 22
// ---------------------------------------------------------------------------

export type Decision = 'keep' | 'fix' | 'drop';

/**
 * Keep · Fix · Drop, as the frames draw them.
 *
 * Oxblood slab, sand slab, bordered outline, 60pt, r16 — and three different
 * widths, because the artifact is explicit that they are "differentiated by
 * shape and weight, not colour alone". `stacked` is frame 20: full width, one
 * per line, same 60pt, which is the composition change AX asks for rather than
 * a scale of the same row.
 *
 * The haptic is spent here rather than at the call site so the vocabulary is
 * one decision: a `selection` tick on all three. The artifact asks for a
 * warning on the Drop CONFIRMATION, and there is no confirmation in this build
 * — see the deviation recorded in `capture-spec.ts`'s header and the build
 * report: Drop carries the shipped skip semantics, which are not destructive,
 * and a warning haptic over a reversible act would teach the wrong reflex.
 */
export function Decisions({
  stacked,
  onKeep,
  onFix,
  onDrop,
  keepLabel = 'Keep',
  fixLabel = 'Fix',
  dropLabel = 'Drop',
  keepHint,
  fixHint,
  dropHint,
  busy = false,
}: {
  stacked: boolean;
  onKeep: () => void;
  onFix: () => void;
  onDrop: () => void;
  keepLabel?: string;
  fixLabel?: string;
  dropLabel?: string;
  keepHint?: string;
  fixHint?: string;
  dropHint?: string;
  busy?: boolean;
}) {
  const theme = useTheme();

  const slab = (
    kind: Decision,
    label: string,
    hint: string | undefined,
    onPress: () => void,
  ) => (
    <DecisionSlab
      key={kind}
      kind={kind}
      label={label}
      hint={hint}
      stacked={stacked}
      busy={busy}
      onPress={onPress}
      theme={theme}
    />
  );

  return (
    <View
      className={stacked ? '' : 'flex-row'}
      style={{ gap: stacked ? 8 : DECISION.gap }}>
      {slab('keep', keepLabel, keepHint, onKeep)}
      {slab('fix', fixLabel, fixHint, onFix)}
      {slab('drop', dropLabel, dropHint, onDrop)}
    </View>
  );
}

function DecisionSlab({
  kind,
  label,
  hint,
  stacked,
  busy,
  onPress,
  theme,
}: {
  kind: Decision;
  label: string;
  hint?: string;
  stacked: boolean;
  busy: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const press = usePressFeedback(!busy);

  const ground =
    kind === 'keep' ? theme.accent : kind === 'fix' ? CAPTURE.tileFilled : theme.canvas;
  const ink = kind === 'keep' ? theme.canvas : kind === 'fix' ? theme.ink : theme.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={() => {
        // The whole haptic budget for the deck, spent here and nowhere else:
        // a selection tick on each of the three. Through the UX-07 policy
        // module, never expo-haptics directly.
        haptics.selection();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{
        minHeight: DECISION.height,
        // Frame 11's widths, and frame 20's stack. `flex` on a stacked child
        // would fight `minHeight`, so the stacked case takes the full width via
        // `alignSelf` instead.
        flex: stacked ? undefined : kind === 'keep' ? DECISION.flexKeep : DECISION.flexOther,
        alignSelf: stacked ? 'stretch' : undefined,
      }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: DECISION.radius,
            backgroundColor: ground,
            borderWidth: kind === 'drop' ? DECISION.dropStroke : 0,
            borderColor: theme.rule,
            opacity: busy ? 0.6 : 1,
          },
          press.style,
        ]}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{ fontSize: stacked ? 19 : 17, color: ink }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The invite line — frame 16, and the shipped condition untouched.
 *
 * "It is a quiet line, never a card, and never universal." One sentence with an
 * inline oxblood action, and the whole line is the tap target because a
 * fourteen-pixel inline link on its own is under the 44pt floor — the same
 * reasoning the consent sheet's policy link records.
 */
export function InviteLine({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Invite someone"
      accessibilityHint="Opens the invite screen"
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="justify-center px-gutter active:opacity-70">
      <Text variant="note" style={{ fontSize: 14, lineHeight: leading('helvetica', 14, 1.5) }}>
        Cinch is better with a friend or two —{' '}
        <Text variant="note" style={{ fontSize: 14, color: theme.accent }}>
          invite someone
        </Text>
        .
      </Text>
    </Pressable>
  );
}

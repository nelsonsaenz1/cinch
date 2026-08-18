import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  filledTileLabel,
  tenBandCopy,
  tenthWellLabel,
  type TenPhase,
} from '@/features/onboarding/ten-copy';
import {
  BAND_HEIGHT,
  BAND_LABEL_SIZE,
  BAND_LABEL_TRACKING,
  BAND_PAD_BOTTOM,
  BAND_PAD_H,
  BAND_PAD_TOP,
  BAND_RADIUS,
  BAND_TRAIL_ON_ACCENT_ALPHA,
  BAND_TRAIL_SIZE,
  PIP_GAP,
  PIP_HEIGHT,
  PIP_RADIUS,
  PLATE_ACTION_HEIGHT,
  PLATE_BODY_SIZE,
  PLATE_EYEBROW_SIZE,
  PLATE_EYEBROW_TRACKING,
  PLATE_HEADLINE_SIZE,
  PLATE_PAD,
  PLATE_RADIUS,
  TEN,
  TITLE_LEADING_RATIO,
  TRAY_GAP,
  TRAY_ROW_GAP,
  TROUBLE_GROUND_ALPHA,
  WELL_RADIUS,
  bandTone,
  pipWidth,
  tenthHeight,
  trayRows,
  wellFillIndex,
  wellHeight,
  wellWidth,
  type TenMeasure,
} from '@/features/onboarding/ten-spec';
import { EMPTY_SLOT_LABEL, type TenSlot } from '@/features/onboarding/ten-slots';
import { leading, tracking } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, canvasAlpha, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Redesign 21 — the parts The Ten is assembled from.
 *
 * `the-ten.tsx` holds the state machine and `ten-body.tsx` composes the page;
 * everything DRAWN is here, so a dev fixture can pose any frame without
 * reaching a network. Colour, geometry and composition all come from
 * `features/onboarding/ten-spec.ts` and every sentence from `ten-copy.ts` —
 * nothing in this file types a hex or a word of prose.
 *
 * ── ONE SANS CUT, INCLUDING WHERE THE FRAMES DREW TWO ───────────────────────
 *
 * The frames set the band label, both CTA labels, the plate eyebrows and the
 * plate actions in a 600 weight. The app has no bold cut and no Medium one —
 * TY-01 deleted every weight from product code and `tests/type-weight.test.ts`
 * enforces it through three separate doors. So that emphasis is rebuilt from
 * SIZE (the CTA label is 17 against the 15 around it), COLOUR (oxblood on paper
 * for an action, cream on oxblood inside a capsule), and CASE and SPACE (the
 * band label is uppercase at 13 with 14% tracking). Recorded as a deviation
 * from frame; the alternative is one screen carrying a weight the other thirty
 * cannot.
 */

// ---------------------------------------------------------------------------
// The masthead
// ---------------------------------------------------------------------------

/**
 * Title, then one line, and nothing else before the clothes.
 *
 * The count that used to sit ABOVE the title as an 11pt eyebrow is gone from
 * here entirely — it is the band directly below, where it has ten pips and a
 * ground that changes. Two elements printing the progress, one of them in a
 * register borrowed from a form label, was the shipped masthead's whole problem.
 */
export function TenMasthead({
  title,
  subtitle,
  measure,
}: {
  title: string;
  subtitle: string | null;
  measure: TenMeasure;
}) {
  return (
    <View>
      <Text
        variant="title"
        trim
        accessibilityRole="header"
        style={{
          fontSize: measure.titleSize,
          // Instrument Serif needs its own line box or iOS slices the ascenders.
          lineHeight: leading('instrument', measure.titleSize, TITLE_LEADING_RATIO),
        }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="note" style={{ fontSize: measure.subSize, marginTop: 6 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The progress band
// ---------------------------------------------------------------------------

/**
 * The count, as a designed band — the brief's own sentence, and the one element
 * on this page that spends colour structurally.
 *
 * THREE GROUNDS, ONE PER TONE (`bandTone`): `tray` while nothing is filed,
 * `blush` while it fills, `accent` once every well is taken. The label and the
 * pips move with the ground rather than being restated on top of it, so the
 * band reads at arm's length as a single object changing state — which is what
 * a progress element is for and what "0 of 10" in grey type was not.
 *
 * THE PIPS ARE NOT THE MESSAGE. They are a second channel on a fact the label
 * beside them already states in words, which is why their contrast against the
 * band is allowed to be quiet: a reader who cannot resolve a 6pt sand pip
 * against a 54pt sand band has `FOUR OF TEN` on the same object at 13pt, and a
 * VoiceOver reader has the whole band in one sentence.
 *
 * The pip width is DERIVED (`pipWidth`) from the measured band rather than
 * fixed, so ten pips and their nine gaps fill the band exactly on every device
 * width — a fixed 30pt pip is the frames' 393pt phone and nothing else.
 */
export function TenBand({
  filled,
  total,
  phase,
  measure,
}: {
  filled: number;
  total: number;
  phase: TenPhase;
  measure: TenMeasure;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const tone = bandTone(filled, total);
  const copy = tenBandCopy(filled, total, phase);

  const ground =
    tone === 'complete' ? theme.accent : tone === 'filling' ? theme.blush : theme.tray;
  const labelColour = tone === 'complete' ? theme.canvas : tone === 'filling' ? theme.accent : theme.muted;
  const trailColour =
    tone === 'complete' ? canvasAlpha(BAND_TRAIL_ON_ACCENT_ALPHA) : theme.muted;
  const litPip = tone === 'complete' ? theme.canvas : theme.accent;

  const inner = width - BAND_PAD_H * 2;
  const pip = inner > 0 ? pipWidth(inner, total) : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // One object to VoiceOver, not twelve. The label, the trailing status and
      // ten pips are three renderings of one fact; read separately they are the
      // same sentence three times, the last of it as "dimmed, dimmed, dimmed".
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={copy.announcement}
      accessibilityValue={{ min: 0, max: total, now: filled }}
      style={{
        minHeight: BAND_HEIGHT,
        borderRadius: BAND_RADIUS,
        backgroundColor: ground,
        paddingHorizontal: BAND_PAD_H,
        paddingTop: BAND_PAD_TOP,
        paddingBottom: BAND_PAD_BOTTOM,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          // `flex: 1` with `minWidth: 0`: without the second, a long count word
          // at a large text size will not shrink below its content and pushes
          // the trailing status off the band rather than wrapping.
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'HelveticaNeue',
            fontSize: BAND_LABEL_SIZE,
            lineHeight: leading('helvetica', BAND_LABEL_SIZE, 1.15),
            letterSpacing: tracking(BAND_LABEL_SIZE, BAND_LABEL_TRACKING),
            color: labelColour,
          }}>
          {copy.label}
        </Text>
        {measure.bandTrailing && copy.trailing ? (
          <Text
            style={{
              flexShrink: 0,
              fontFamily: 'HelveticaNeue',
              fontSize: BAND_TRAIL_SIZE,
              lineHeight: leading('helvetica', BAND_TRAIL_SIZE, 1.15),
              color: trailColour,
            }}>
            {copy.trailing}
          </Text>
        ) : null}
      </View>

      {pip > 0 ? (
        <View style={{ flexDirection: 'row', gap: PIP_GAP, marginTop: 9 }}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={{
                width: pip,
                height: PIP_HEIGHT,
                borderRadius: PIP_RADIUS,
                backgroundColor: i < filled ? litPip : TEN.pipSpent,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// One well
// ---------------------------------------------------------------------------

/**
 * A warm tray well, with the photograph settling into it.
 *
 * FOUR LOOKS, and the frames redraw all four:
 *
 *  - EMPTY: a well one step lighter than the tray with a dashed hairline round
 *    it. Dashed rather than solid because a solid rule at this weight reads as
 *    a tile that is merely blank, and the frames are explicit that an untaken
 *    position should read as an opening. NO GLYPH AND NO WORD, except on the
 *    spanning tenth — which carries one because it is the only well whose shape
 *    a reader has to be told about. An icon of a shirt is never drawn: it is a
 *    picture of a shirt the user does not own.
 *  - FOREGROUNDED: the same well with a clay rule instead of a sand one. Not the
 *    accent — the accent is spent on the band and the capsule, and a third
 *    oxblood on the same screen would make none of them mean anything.
 *  - FILLED: the photograph, full bleed on the deeper sand, no caption. A filled
 *    well is a picture of the garment; the word under it only ever restated the
 *    row it sat in.
 *  - SETTLING: a blush ground and a clay rule while the classifier reads it.
 *
 * THE SETTLE IS THE SHIPPED ONE, reused rather than rebuilt: `FadeIn` on the
 * cutout, KEYED ON THE URI so it plays when the cutout first resolves and never
 * again on a re-render, and guarded by `useReducedMotion` like every other
 * entrance in the app. The well underneath already holds the geometry, so
 * nothing moves while it fades — which is exactly why the reduced-motion frame
 * is compositionally identical to the ordinary one.
 */
export function TenWell({
  slot,
  total,
  width,
  height,
  row,
  foregrounded,
  settling,
  garmentName,
  imageUri,
  label,
  onPress,
}: {
  slot: TenSlot;
  total: number;
  width: number;
  height: number;
  /** Which tray row this well is in — decides its sand step. */
  row: number;
  foregrounded: boolean;
  /** This well's photograph is still being read. */
  settling: boolean;
  garmentName?: string | null;
  imageUri?: string;
  /** Printed inside the well when it is empty. Only the spanning tenth has one. */
  label?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const filled = slot.status === 'filled';

  const ground = settling
    ? theme.blush
    : filled
      ? wellFillIndex(row) === 0
        ? TEN.wellFilled
        : TEN.wellFilledAlt
      : TEN.wellEmpty;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      // FILLED: `Knit, piece 3 of 10, double-tap for actions.` — the piece, then
      // where it sits, then what the well is for. EMPTY: position and status in
      // that order. Ten is never typed; `total` is the grid's own length.
      accessibilityLabel={
        filled
          ? filledTileLabel(slot.id, total, garmentName ?? null)
          : `${label ?? EMPTY_SLOT_LABEL}, slot ${slot.id}, empty${foregrounded ? ', currently suggested' : ''}`
      }
      style={{ width, height }}>
      <View
        className="items-center justify-center overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: WELL_RADIUS,
          backgroundColor: ground,
          borderWidth: 1,
          borderStyle: filled ? 'solid' : 'dashed',
          borderColor:
            settling || foregrounded ? theme.blushRule : filled ? theme.rule : theme.sand,
        }}>
        {filled && imageUri ? (
          <Animated.View
            key={imageUri}
            entering={reduced ? undefined : FadeIn.duration(240)}
            style={{ width: '100%', height: '100%' }}>
            <Image
              source={{ uri: imageUri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ) : null}
        {!filled && label ? (
          <Text
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: 15,
              lineHeight: leading('helvetica', 15, 1.2),
              // Clay is never type (the contrast law): a foregrounded tenth well
              // says so with its rule and its ground, and its word stays legible.
              color: foregrounded ? theme.accent : theme.muted,
            }}>
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The tray
// ---------------------------------------------------------------------------

/**
 * Nine wells in a three-up grid, then one spanning the tray — the hero.
 *
 * REAL ROWS, NEVER A WRAPPED RUN, and `trayRows` is where that is decided. The
 * bug it forecloses is the one `tests/tour-layout.test.ts` pins: a well is sized
 * by width and height together, and a percentage `flexBasis` in a wrapped run
 * overflows by a gap and a half because React Native does not subtract `gap`
 * from a basis. The row width is measured once and every well in it takes an
 * absolute width off that measurement.
 */
export function TenTray({
  slots,
  measure,
  foregroundedId,
  settlingId,
  garmentNames,
  imageUris,
  onSlotPress,
}: {
  slots: readonly TenSlot[];
  measure: TenMeasure;
  foregroundedId: number | null;
  /** The slot whose photograph is being read, if any. */
  settlingId?: number | null;
  garmentNames?: Record<number, string | null>;
  imageUris?: Record<number, string | undefined>;
  onSlotPress?: (slotId: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const rows = trayRows(slots.length, measure);
  const ordinary = width > 0 ? wellWidth(width, measure.columns) : 0;
  const ordinaryHeight = wellHeight(ordinary, measure);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {ordinary > 0
        ? rows.map((row, rowIndex) => {
            const spanning = measure.wideTenth && row.length === 1;
            return (
              <View
                key={rowIndex}
                style={{
                  flexDirection: 'row',
                  gap: TRAY_GAP,
                  marginTop: rowIndex === 0 ? 0 : TRAY_ROW_GAP,
                }}>
                {row.map((index) => {
                  const slot = slots[index]!;
                  return (
                    <TenWell
                      key={slot.id}
                      slot={slot}
                      total={slots.length}
                      row={rowIndex}
                      width={spanning ? width : ordinary}
                      height={spanning ? tenthHeight(ordinaryHeight) : ordinaryHeight}
                      foregrounded={slot.id === foregroundedId}
                      settling={slot.id === settlingId}
                      garmentName={garmentNames?.[slot.id]}
                      imageUri={imageUris?.[slot.id]}
                      label={spanning ? tenthWellLabel(slots.length) : undefined}
                      // Every well is pressable, filled ones included: if the
                      // classifier read a hoodie wrong, the well holding it is
                      // the most obvious thing in the room to tap.
                      onPress={onSlotPress ? () => onSlotPress(slot.id) : undefined}
                    />
                  );
                })}
              </View>
            );
          })
        : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

/**
 * One full-width oxblood capsule, and at most one text action under it.
 *
 * THE GROUND IS ON AN `Animated.View`, NEVER ON THE `Pressable`. The house
 * pattern (`use-press-feedback.ts`) and the reason it is a pattern: a function
 * `style` on the Pressable is what once rendered the tour's CTA as a bare label
 * with no capsule under it, and `tests/tour-layout.test.ts` pins the shape.
 * NativeWind's interop is registered for the RN primitives only, so anything the
 * animated layer needs is an inline style rather than a class.
 */
export function TenFoot({
  measure,
  action,
  secondary,
  disabled = false,
  onAction,
  onSecondary,
}: {
  measure: TenMeasure;
  /** The capsule's label, or null to draw no page action at all. */
  action: string | null;
  secondary: string | null;
  disabled?: boolean;
  onAction: () => void;
  onSecondary: () => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled);
  const quiet = usePressFeedback();

  return (
    <View>
      {action ? (
        <Pressable
          onPress={disabled ? undefined : onAction}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityLabel={action}
          style={{ height: measure.ctaHeight }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: measure.ctaHeight / 2,
                // A disabled capsule takes the deepest sand rather than the
                // accent at an opacity: a dimmed oxblood still reads as the
                // action and invites the press it is refusing.
                backgroundColor: disabled ? theme.sand : theme.accent,
              },
              press.style,
            ]}>
            <Text
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: measure.ctaLabelSize,
                lineHeight: leading('helvetica', measure.ctaLabelSize, 1.2),
                color: disabled ? theme.muted : theme.canvas,
              }}>
              {action}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}

      {secondary ? (
        <Pressable
          onPress={onSecondary}
          onPressIn={quiet.onPressIn}
          onPressOut={quiet.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={secondary}
          style={{ height: measure.secondaryHeight, marginTop: action ? 4 : 0 }}>
          <Animated.View
            style={[
              { flex: 1, alignItems: 'center', justifyContent: 'center' },
              quiet.style,
            ]}>
            <Text
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: measure.secondaryLabelSize,
                lineHeight: leading('helvetica', measure.secondaryLabelSize, 1.2),
                color: theme.accent,
              }}>
              {secondary}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plates
// ---------------------------------------------------------------------------

/**
 * The pill actions the plates carry — a filled one and a quiet one, on a row.
 *
 * Shorter than the page capsule (52 against 56) and still well over the 44pt
 * floor, which is the frames' own hierarchy: a plate's remedy is smaller than
 * the page's action because the page's action is what the reader came for.
 */
function PlateAction({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'filled' | 'quiet';
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ height: PLATE_ACTION_HEIGHT, minWidth: MIN_TAP_TARGET }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 22,
            borderRadius: PLATE_ACTION_HEIGHT / 2,
            backgroundColor: tone === 'filled' ? theme.accent : theme.surface,
          },
          press.style,
        ]}>
        <Text
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: 16,
            lineHeight: leading('helvetica', 16, 1.2),
            color: tone === 'filled' ? theme.canvas : theme.accent,
          }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The trouble plate — the read that failed, the connection that is gone, the
 * camera that is switched off, the session left unfinished.
 *
 * ONE OBJECT FOR FOUR STATES, because the frames draw one: a washed ground, a
 * tracked eyebrow, an editorial headline, one paragraph, and at most two pill
 * actions on a row. What differs between them is `tone` — amber for the two
 * troubles, sand for the two that are merely news — and every word, which comes
 * from the caller.
 *
 * THE EYEBROW IS `muted`, NOT THE FRAME'S AMBER. #8A6A2B is not a palette value
 * and is not reachable from `warning` (#C58A2E) without inventing a second
 * amber; an 11.5pt tracked line is never large text, so the contrast law puts it
 * in `muted` exactly as the tour put its clay one. The plate is still
 * unmistakably a trouble plate: its GROUND carries the amber, where a wash needs
 * no contrast ratio to do its work.
 *
 * The row WRAPS rather than truncates: at accessibility sizes "Back to Today" is
 * wider than half the plate, and a remedy the reader cannot read is not a remedy.
 */
export function TroublePlate({
  tone = 'trouble',
  eyebrow,
  headline,
  body,
  primary,
  secondary,
  measure,
  children,
}: {
  tone?: 'trouble' | 'news';
  eyebrow: string;
  /** Optional: the offline and resume frames lead with the paragraph. */
  headline?: string | null;
  body: string;
  primary?: { label: string; onPress: () => void } | null;
  secondary?: { label: string; onPress: () => void } | null;
  measure: TenMeasure;
  /** Drawn between the eyebrow and the body — the resume frame's thumbnail. */
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={{
        borderRadius: PLATE_RADIUS,
        padding: PLATE_PAD,
        backgroundColor: tone === 'trouble' ? warningAlpha(TROUBLE_GROUND_ALPHA) : theme.tray,
      }}>
      <Text
        style={{
          fontFamily: 'HelveticaNeue',
          fontSize: PLATE_EYEBROW_SIZE,
          lineHeight: leading('helvetica', PLATE_EYEBROW_SIZE, 1.2),
          letterSpacing: tracking(PLATE_EYEBROW_SIZE, PLATE_EYEBROW_TRACKING),
          textTransform: 'uppercase',
          color: theme.muted,
        }}>
        {eyebrow}
      </Text>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      {headline ? (
        <View style={{ marginTop: 8 }}>
          <Text
            variant="title"
            trim
            style={{
              fontSize: PLATE_HEADLINE_SIZE,
              lineHeight: leading('instrument', PLATE_HEADLINE_SIZE, 1.1),
            }}>
            {headline}
          </Text>
        </View>
      ) : null}
      <Text
        variant="body"
        style={{
          marginTop: headline ? 10 : 12,
          fontSize: PLATE_BODY_SIZE,
          lineHeight: leading('helvetica', PLATE_BODY_SIZE, 1.45),
        }}>
        {body}
      </Text>
      {primary || secondary ? (
        <View
          style={{
            marginTop: 16,
            flexDirection: measure.large ? 'column' : 'row',
            flexWrap: measure.large ? 'nowrap' : 'wrap',
            alignItems: measure.large ? 'stretch' : 'center',
            gap: 10,
          }}>
          {primary ? (
            <PlateAction label={primary.label} tone="filled" onPress={primary.onPress} />
          ) : null}
          {secondary ? (
            <PlateAction label={secondary.label} tone="quiet" onPress={secondary.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

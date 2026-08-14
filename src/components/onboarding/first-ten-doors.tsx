import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DoorPlate } from '@/components/ui/door-plate';
import { Text } from '@/components/ui/text';
import {
  INTAKE_ROUTES,
  TEN_RECOMMENDED_BADGE,
  TEN_RECOMMENDED_KEY,
  tenRouteName,
  type IntakeRoute,
} from '@/features/ingest/intake-routes';
import {
  FIRST_TEN_DOORS,
  RESUME_HEADLINE,
  resumeCardCopy,
  TEN_TITLE,
} from '@/features/onboarding/ten-copy';
import { leading } from '@/theme/font-metrics';
import { accentAlpha, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';
import { MAX_TEXT_SCALE } from '@/theme/type-scale';

/**
 * CX-01 — the first thing a new account is asked, rebuilt.
 *
 * ── WHAT THIS REPLACES, AND WHY THE OLD RULE WAS WRONG HERE ───────────────
 *
 * TN-C1 drew four equal `DoorPlate`s and defended it at length: "the doors read
 * as peers… a filled door would make the other read as the consolation." That
 * is a good rule for Add clothes, where the reader has a closet and a habit,
 * and it is the wrong rule for the very first screen. Somebody who has never
 * filed a piece is not choosing between workflows they know — they are being
 * asked to invent a preference before they have one, and four identical plates
 * give them nothing to decide with.
 *
 * The founder's correction stands the screen up as a recommendation with
 * alternatives. Emphasis is by PLACEMENT AND EDGE only: the catalogue plate is
 * larger, first, and outlined in the accent. The other three keep full
 * contrast, full-size targets and their own glyphs — nothing is dimmed to make
 * the recommendation louder, which would be persuasion by handicap.
 *
 * ── WHAT WAS DELETED ──────────────────────────────────────────────────────
 *
 * Roughly seventy words: a paragraph about doors, the mixing note, the
 * catalogue disclosure and the consent footer, all stacked under the plates on
 * a screen whose job is to get one tap. None of the claims are lost. The
 * catalogue disclosure lives on `/find-photo`, which is where somebody is
 * actually typing a brand into a licensed feed, and the consent request is the
 * sheet the chosen door raises one screen later — both were always shown
 * there too. This screen was quoting them in advance.
 *
 * ── WHAT DID NOT CHANGE ───────────────────────────────────────────────────
 *
 * TR-06, the resume branch, is untouched: same card, same ink Resume, same
 * single camera door beneath it. A reader with a half-finished walkthrough is
 * not being asked this question at all, and redesigning their branch was not
 * asked for. `DoorPlate` therefore still has a caller here.
 */

export type UnfinishedWalkthrough = {
  /** How many pieces the parse heard. */
  heard: number;
  /** How many the reader confirmed before leaving. */
  confirmed: number;
  /** The procession cursor — the same figure the card masthead prints. */
  cursor: number;
  /**
   * The day it was recorded, already formatted ("Tuesday").
   *
   * Passed in rather than derived here, and deliberately so: a component that
   * formats a date from a clock cannot be photographed twice with the same
   * bytes, and every fixture in this group has to be deterministic.
   */
  weekday: string;
};

// ---------------------------------------------------------------------------
// Geometry — CX-01's numbers, and the one height it bends at
// ---------------------------------------------------------------------------

/**
 * The frames are drawn at 393×852. The 375×667 cut is the one device class
 * where the composition would otherwise crowd the bottom of the screen, and
 * the correction names the two values it may give back there.
 *
 * A height test rather than a width test: what runs out on an SE is vertical
 * room, and a 375-wide phone with a tall screen has no reason to compress.
 */
const SHORT_SCREEN_HEIGHT = 700;

/** Eyebrow to heading. 24 at 393×852, 20 permitted on the short cut. */
const EYEBROW_GAP = 24;
const EYEBROW_GAP_SHORT = 20;

/** The recommended plate. Never below this, whatever the type size does. */
const PLATE_MIN_HEIGHT = 104;

/** The grouped rows. 72, and 66 permitted on the short cut. */
const ROW_MIN_HEIGHT = 72;
const ROW_MIN_HEIGHT_SHORT = 66;

/** The glyph wells. The plate's is larger because the plate is. */
const PLATE_WELL = 52;
const ROW_WELL = 40;
const WELL_RADIUS = 12;

/** CX-01's accent edge. 1.5 reads as deliberate where 1 reads as a hairline. */
const RECOMMENDED_BORDER_WIDTH = 1.5;

/** The well behind a recommended glyph — accent at 9%. */
const RECOMMENDED_WELL_ALPHA = 0.09;

const PLATE_RADIUS = 20;
const LIST_RADIUS = 16;

// ---------------------------------------------------------------------------
// Dynamic Type — line boxes that grow with the glyphs
// ---------------------------------------------------------------------------

/**
 * THE DEFECT THIS CLOSES, and why it is scoped to this screen.
 *
 * The `Text` variants carry line heights as NUMBERS, computed once from the
 * real font metrics at the variant's own size. React Native scales `fontSize`
 * with the reader's Dynamic Type setting; it does not scale an explicit
 * `lineHeight`. At AX3 the glyphs are roughly twice their design size inside a
 * line box that has not moved, so a wrapped name lands on top of its own
 * subtitle. It is invisible at every ordinary size, because at those sizes the
 * glyphs still fit.
 *
 * That is a property of the shared primitive and it is not being changed
 * tonight. What this screen can do is restate the SAME base values scaled by
 * the SAME multiplier the text is already using, which leaves standard size
 * pixel-identical and makes the accessibility sizes correct.
 *
 * ── The numbers are derived, never typed ──────────────────────────────────
 *
 * `leading()` is the helper `tailwind.config.js` computes these with, called
 * here with the same arguments, so a change to the metrics or to a variant's
 * ratio moves both together. `colophon` is the one line height typed as a
 * literal in the config rather than computed, so it is a literal here too —
 * copying the config's own decision rather than inventing a computation it
 * does not make.
 *
 * ── One cap, and it is the text cap ───────────────────────────────────────
 *
 * `Text` caps non-display variants at `MAX_TEXT_SCALE`. All four roles used on
 * this screen — `door`, `body`, `note`, `colophon` — are non-display (`door`
 * is absent from the `isDisplay` list), so one multiplier serves them all. If
 * a display variant ever appears here it needs `MAX_DISPLAY_SCALE` instead, or
 * its box will grow past glyphs that stopped growing at 1.4.
 */
const BASE_LINE_HEIGHT = {
  /** `door` → `text-heading`. */
  door: leading('helvetica', 20, 1.25),
  /** `body` → `text-body`. */
  body: leading('helvetica', 17, 1.5),
  /** `note` → `text-label`. */
  note: leading('helvetica', 13, 1.4),
  /** `colophon` — typed in the config, not computed. */
  colophon: 14,
} as const;

export type ScaledLeading = Record<keyof typeof BASE_LINE_HEIGHT, number>;

/**
 * The four line heights at this reader's setting.
 *
 * At a scale of 1 every value rounds back to the variant's own, so the
 * standard-size render is unchanged to the pixel — which is what makes this
 * safe to apply to an already-approved frame.
 */
export function scaledLeading(fontScale: number): ScaledLeading {
  const scale = Math.min(fontScale, MAX_TEXT_SCALE);
  return {
    door: Math.round(BASE_LINE_HEIGHT.door * scale),
    body: Math.round(BASE_LINE_HEIGHT.body * scale),
    note: Math.round(BASE_LINE_HEIGHT.note * scale),
    colophon: Math.round(BASE_LINE_HEIGHT.colophon * scale),
  };
}

// ---------------------------------------------------------------------------
// The recommended plate
// ---------------------------------------------------------------------------

function RecommendedPlate({
  route,
  lh,
  onPress,
}: {
  route: IntakeRoute;
  /** The scaled line boxes — see `scaledLeading`. */
  lh: ScaledLeading;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tenRouteName(route)}. ${TEN_RECOMMENDED_BADGE.toLowerCase()}.`}
      accessibilityHint={route.tenLine}
      onPress={onPress}
      className="justify-center bg-surface px-5 active:opacity-80"
      style={{
        minHeight: PLATE_MIN_HEIGHT,
        borderRadius: PLATE_RADIUS,
        borderWidth: RECOMMENDED_BORDER_WIDTH,
        borderColor: theme.accent,
        paddingVertical: 16,
      }}>
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <View
          className="items-center justify-center"
          style={{
            width: PLATE_WELL,
            height: PLATE_WELL,
            borderRadius: WELL_RADIUS,
            backgroundColor: accentAlpha(RECOMMENDED_WELL_ALPHA),
          }}>
          <SymbolView name={route.symbol} size={24} tintColor={theme.accent} />
        </View>

        {/* `flex-1` so the name wraps inside the column at large type rather
            than pushing the well off the plate. */}
        <View className="flex-1">
          {/* `lineHeight` from `scaledLeading`, never a literal: the variant's
              own base value, multiplied by the same capped scale the glyphs
              are using. At scale 1 it rounds back to the variant's number, so
              the standard-size render is unchanged. */}
          <Text variant="door" style={{ lineHeight: lh.door }}>
            {tenRouteName(route)}
          </Text>
          <Text variant="note" style={{ lineHeight: lh.note }}>
            {route.tenLine}
          </Text>
          {/* The word, under the line rather than floated into the corner: at
              an accessibility type size a corner badge either overlaps the
              name or forces it to truncate, and CX-01 forbids truncation.

              COLOUR ONLY. This carried `fontSize: 10, lineHeight: 13,
              letterSpacing: 1.2` — a hand-written line height on top of a
              variant, which `ui/text.tsx` forbids in as many words. The sizes
              carry line heights computed from real font metrics AND they
              scale with Dynamic Type; a literal 13 does not, so at AX3 the
              glyphs grew and the line box did not, and the badge climbed into
              the subtitle above it. `colophon` is already uppercase and
              tracked, so all three overrides were restating it at a size that
              could not grow. */}
          <Text
            variant="colophon"
            style={{ color: theme.accent, marginTop: 6, lineHeight: lh.colophon }}>
            {TEN_RECOMMENDED_BADGE}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The grouped list
// ---------------------------------------------------------------------------

function RouteRow({
  route,
  first,
  minHeight,
  lh,
  onPress,
}: {
  route: IntakeRoute;
  /** The separator rides the row's top, so the first row has none. */
  first: boolean;
  minHeight: number;
  /** The scaled line boxes — see `scaledLeading`. */
  lh: ScaledLeading;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tenRouteName(route)}
      accessibilityHint={route.tenLine}
      onPress={onPress}
      className="active:opacity-70"
      // `minHeight` and not `height`: the row grows with the type size, and a
      // fixed height is how a two-line name gets clipped.
      style={{ minHeight: Math.max(minHeight, MIN_TAP_TARGET) }}>
      {/* Inset separator — it starts where the words start, not at the card's
          edge, which is what makes a grouped list read as one object. */}
      {first ? null : (
        <View
          style={{
            height: 1,
            backgroundColor: theme.hairline,
            marginLeft: 16 + ROW_WELL + 14,
          }}
        />
      )}
      {/*
        `flexGrow` with `flexBasis: 'auto'`, NEVER `flex-1`.

        `flex-1` is `flexGrow:1, flexShrink:1, flexBasis:0%`, and the zero
        basis is the whole defect: a child with no basis contributes NOTHING to
        its parent's intrinsic height, so the Pressable resolved to exactly its
        `minHeight` and the content then grew to fill that — 66pt of box around
        text that needed more, clipped by the grouped card's `overflow-hidden`.
        It looked correct at every ordinary type size, because at those sizes
        the content happened to fit inside 66.

        `flexBasis: 'auto'` makes the child measure itself first, so the row is
        `max(minHeight, intrinsic)` — which is what a minimum was always meant
        to mean.
      */}
      <View
        className="flex-row items-center px-4"
        style={{ flexGrow: 1, flexBasis: 'auto', gap: 14, paddingVertical: 12 }}>
        <View
          className="items-center justify-center bg-sand"
          style={{ width: ROW_WELL, height: ROW_WELL, borderRadius: WELL_RADIUS }}>
          <SymbolView name={route.symbol} size={20} tintColor={theme.ink} />
        </View>
        <View className="flex-1">
          {/* Full ink and the same weight the plate's name carries. The three
              alternatives are not a downgrade of the recommendation; they are
              the same offer in a tighter frame.

              COLOUR ONLY, for the reason the badge above states: this said
              `fontSize: 17` over `variant="body"`, which keeps the variant's
              line box while replacing the size it was computed for. Dynamic
              Type then scaled the glyphs and left the box, so the name grew
              down into its own subtitle. */}
          <Text variant="body" style={{ color: theme.ink, lineHeight: lh.body }}>
            {tenRouteName(route)}
          </Text>
          <Text variant="note" style={{ lineHeight: lh.note }}>
            {route.tenLine}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export function FirstTenDoors({
  unfinished,
  onRoute,
  onResume,
  onStartAgain,
}: {
  /** TR-06 when present, CX-01 when null. */
  unfinished: UnfinishedWalkthrough | null;
  /**
   * One handler for all four, keyed by route. A prop per door would have to
   * grow every time the table does, which is the coupling this replaces.
   */
  onRoute: (key: IntakeRoute['key']) => void;
  onResume: () => void;
  onStartAgain: () => void;
}) {
  const { height, fontScale } = useWindowDimensions();
  const short = height <= SHORT_SCREEN_HEIGHT;
  /**
   * Computed once here and passed down, rather than each component reading the
   * dimensions for itself: the whole screen has to agree about how tall a line
   * is, and three independent reads is three chances to disagree after a
   * rotation or a settings change.
   */
  const lh = scaledLeading(fontScale);

  const resume = unfinished
    ? resumeCardCopy(
        unfinished.heard,
        unfinished.confirmed,
        unfinished.cursor,
        unfinished.weekday,
      )
    : null;

  // Straight off the shared table, in its order — the recommendation is the
  // one the table names, never an index. A reordering of the table moves this
  // screen with it, which is the whole reason the table exists.
  const recommended = INTAKE_ROUTES.find((r) => r.key === TEN_RECOMMENDED_KEY);
  const rest = INTAKE_ROUTES.filter((r) => r.key !== TEN_RECOMMENDED_KEY);

  return (
    <ScrollView contentContainerClassName="px-gutter pb-8" keyboardShouldPersistTaps="handled">
      <Text variant="eyebrow" className="pt-1">
        {TEN_TITLE}
      </Text>
      <View style={{ marginTop: short ? EYEBROW_GAP_SHORT : EYEBROW_GAP, marginBottom: 10 }}>
        <Text variant="display" trim accessibilityRole="header">
          {resume ? RESUME_HEADLINE : FIRST_TEN_DOORS.headline}
        </Text>
      </View>

      {resume ? (
        <>
          {/* One card, never a list: there is only ever one unfinished
              walkthrough, and a list of one is a promise the flow cannot keep. */}
          <View className="rounded-plate border border-rule bg-surface" style={{ padding: 16 }}>
            <Text variant="eyebrow">{resume.eyebrow}</Text>
            <Text variant="heading" className="mb-1" style={{ fontSize: 19, marginTop: 6 }}>
              {resume.title}
            </Text>
            <Text variant="note" style={{ fontSize: 15, lineHeight: 22 }}>
              {resume.body}
            </Text>
            <View style={{ marginTop: 14, gap: 4 }}>
              {/* Ink, not oxblood — carrying on is the obvious thing rather
                  than the persuaded thing. */}
              <Button
                title={resume.action}
                variant="ink"
                onPress={onResume}
                className="self-stretch"
              />
              <Button
                title={resume.secondary}
                variant="ghost"
                onPress={onStartAgain}
                className="self-stretch"
              />
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            {/* TR-06 keeps ONE door under the resume card, and it is the
                camera: the reader already chose voice once and the card above
                is the way back into it. */}
            <DoorPlate
              name={FIRST_TEN_DOORS.photograph.name}
              line={FIRST_TEN_DOORS.photograph.shortLine}
              symbol="camera"
              accessibilityLabel="Photograph them — ten named slots, one picture each"
              onPress={() => onRoute('camera')}
            />
          </View>
        </>
      ) : (
        <>
          {/* No size override, same rule as the two below. */}
          <Text variant="note" style={{ lineHeight: lh.note }}>
            {FIRST_TEN_DOORS.body}
          </Text>

          {recommended ? (
            <View style={{ marginTop: 20 }}>
              <RecommendedPlate
                route={recommended}
                lh={lh}
                onPress={() => onRoute(recommended.key)}
              />
            </View>
          ) : null}

          {/* One white card holding three rows, not three cards: a grouped
              list is one object with three ways out of it, which is exactly
              what these are once the recommendation has been made. */}
          <View
            className="overflow-hidden bg-surface"
            style={{ marginTop: 12, borderRadius: LIST_RADIUS }}>
            {rest.map((route, i) => (
              <RouteRow
                key={route.key}
                route={route}
                first={i === 0}
                minHeight={short ? ROW_MIN_HEIGHT_SHORT : ROW_MIN_HEIGHT}
                lh={lh}
                onPress={() => onRoute(route.key)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

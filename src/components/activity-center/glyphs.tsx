import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/tokens';

/**
 * The Activity Center's three marks.
 *
 * Separate from `components/activity/glyphs.tsx` rather than an extension of
 * it: those four (calendar, hanger, bars, heart) are the AV taxonomy's objects
 * and none of them is a private group. This file draws the group mark the AC
 * frames use — a ring, at 17pt inside a 36pt tray — plus the empty and error
 * heroes at 34pt on bare canvas.
 *
 * ── ON THE ATLAS'S TRAY SHAPE ─────────────────────────────────────────────
 *
 * AC-02 draws the group mark as a ROUNDED SQUARE (12pt radius on a 40pt tile)
 * and the avatar as a circle, which is a real distinction and one worth
 * keeping — a reader scanning a column can tell a room from a person without
 * reading either. It is drawn here at 36pt to match the row height
 * `components/activity/ActivityRow.tsx` already ships, because the two kinds of
 * row sit in the same list and a mark that changed size halfway down the page
 * would be the most visible thing on it.
 *
 * The atlas strokes these in #8A8578, which is `faint` — a 3.5:1 failure on
 * paper and worse behind a stroke. They draw in `muted`, the standing
 * substitution this repository already made for the AV glyphs.
 */

/**
 * The group mark: a ring, on a round tray at the face's own diameter.
 *
 * A ring rather than a cluster of figures. AC-02's own glyph is `◍` — a circle
 * — and the reason it is not three little people is that the roster is exactly
 * what a private group does not show you until you are in it; a mark that drew
 * a crowd would be promising a list the membership policy withholds.
 *
 * ── REDESIGN 28 MADE IT A CIRCLE, AND GREW IT TO 44 ───────────────────────
 *
 * It was a 36pt ROUNDED SQUARE, on the argument that a reader scanning a column
 * should be able to tell a room from a person without reading either. Every
 * frame in redesign 28 draws one column of 44pt discs, and the reason the old
 * argument does not survive is that the distinction it bought was never worth
 * what it cost: the sentence beside the mark names the room in bold in its own
 * first clause, so the shape was a second, weaker copy of a fact already on the
 * row — and it made every group row half a step smaller than its neighbours in
 * a list whose whole rhythm is one repeated disc.
 *
 * `size` so the row can grow it with Dynamic Type (`ROW_AVATAR_AX`) exactly as
 * it grows an `Avatar`, and so the invitation detail can draw it at hero scale.
 */
export function CircleMark({ size = 44 }: { size?: number }) {
  const theme = useTheme();
  const glyph = Math.round(size * 0.39);

  return (
    <View
      // The sentence beside it already names the group. A screen reader told
      // about the mark as well would read the row twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center rounded-full bg-tray"
      style={{ width: size, height: size }}>
      <Svg width={glyph} height={glyph} viewBox="0 0 22 22" fill="none">
        <Circle cx={11} cy={11} r={7.4} stroke={theme.muted} strokeWidth={1.6} />
        <Circle cx={11} cy={11} r={2.4} fill={theme.muted} />
      </Svg>
    </View>
  );
}

/**
 * AC-01's hero. The same ring, at hero scale, on bare canvas.
 *
 * Drawn OPEN and still, never ringing and never a bell with motion lines: the
 * empty state of a calm inbox should not look like a device waiting to go off.
 */
export function ActivityCenterEmptyGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={11} r={7.6} stroke={color} strokeWidth={1.4} />
      <Circle cx={11} cy={11} r={2.6} fill={color} />
    </Svg>
  );
}

/**
 * AC-07's hero — the crossed mark the frame draws (`⤫`), not a warning
 * triangle.
 *
 * A triangle says something is wrong with the reader's data. Nothing is: the
 * read failed and everything is exactly where it was, which is what
 * `ERROR_BODY` says in words.
 */
export function ActivityCenterErrorGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M5.5 5.5 16.5 16.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M16.5 5.5 5.5 16.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * THE DOT. Nine points, oxblood, with a canvas ring so it reads against a
 * photograph.
 *
 * It is the app's entire notion of a badge on this surface and it carries no
 * number, because there is no number in scope to render: `useHasUnseenActivity`
 * returns a boolean and `activity_has_unseen()` is an `exists`, so a count does
 * not exist anywhere between the database and this component.
 *
 * DECORATIVE TO A SCREEN READER. Unread is conveyed as the word "unread" inside
 * each row's own label (`rowAccessibilityLabel`), and the entry button's label
 * says it in words too — colour alone is never the carrier, which is §11's
 * colour-independence rule in the one place it is easiest to break.
 */
export function PresenceDot({ size = 9 }: { size?: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accent,
        borderWidth: 2,
        borderColor: theme.canvas,
      }}
    />
  );
}

/**
 * The row's own unseen mark — redesign 28's warm dot, at the TRAILING edge.
 *
 * ── WHAT MOVED, AND WHY ───────────────────────────────────────────────────
 *
 * It was an 8pt disc in an 8pt gutter at the row's LEADING edge, ahead of the
 * face, with a tinted ground behind the whole row as a second channel for the
 * same fact. Redesign 28 moves it to the trailing edge at nine points and drops
 * the tint. Three reasons, in order of weight:
 *
 *  1. The leading gutter had to be held open on every row, read or unread, so
 *     nothing shifted sideways when a row was seen — which meant every row on
 *     the page paid 8pt of indent for a mark most of them did not carry.
 *  2. The trailing column was freed. The stamp used to live there and now sits
 *     under the sentence (`activity-spec.ts`, `STAMP_PLACEMENT`), so the dot
 *     lands in a column that is otherwise empty and can never collide with a
 *     two-line sentence.
 *  3. The tint is gone because the frames have no tint, and losing it costs
 *     nothing: unseen was never carried by colour alone. It is the word "New"
 *     at the head of the row's composed label — `rowAccessibilityLabel` — which
 *     is the channel that actually satisfies the colour-independence rule.
 *
 * Same nine points as `PresenceDot` on the entry glyph, deliberately: the mark
 * that says "there is something here" is one mark in two places. No ring here,
 * because a row's ground is paper rather than a photograph.
 */
export function UnreadDot({ size = 9 }: { size?: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent }}
    />
  );
}

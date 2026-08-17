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

const MARK = 36;
const GLYPH = 17;
const TRAY_RADIUS = 11;

/**
 * The group mark: a ring, in a rounded-square tray.
 *
 * A ring rather than a cluster of figures. AC-02's own glyph is `◍` — a circle
 * — and the reason it is not three little people is that the roster is exactly
 * what a private group does not show you until you are in it; a mark that drew
 * a crowd would be promising a list the membership policy withholds.
 */
export function CircleMark() {
  const theme = useTheme();

  return (
    <View
      // The sentence beside it already names the group. A screen reader told
      // about the mark as well would read the row twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center bg-tray"
      style={{ width: MARK, height: MARK, borderRadius: TRAY_RADIUS }}>
      <Svg width={GLYPH} height={GLYPH} viewBox="0 0 22 22" fill="none">
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
 * The row's own unread mark — AC-02's 8pt disc in the left gutter.
 *
 * No canvas ring: it sits on the row's tinted ground rather than on a
 * photograph, and a ring there reads as a hole.
 */
export function UnreadDot() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }}
    />
  );
}

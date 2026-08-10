import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { ActivityGlyph } from '@/features/activity/sentence';
import { useTheme } from '@/theme/tokens';

/**
 * The four object marks — calendar, hanger, bars, heart — traced from atlas 32.
 *
 * Separate from `features/explore/glyphs.tsx` rather than an extension of it:
 * those three are drawn on the atlas's 1.4 stroke as *hero* marks at 34pt on
 * bare canvas, and these are 17pt inside a 36pt tray disc at 1.6. The hanger
 * appears in both files at two different weights for that reason, and Explore
 * is read-only to this unit besides.
 *
 * The atlas strokes them in #8A8578. That is `faint`, which is a 3.5:1 failure
 * on paper and worse behind a 1.6pt stroke; these draw in `muted`, the standing
 * substitution. Casing, size and the tray ground are the atlas's exactly.
 */

const MARK = 36;
const GLYPH = 17;

function Calendar({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 22 22" fill="none">
      <Rect x={3} y={4.5} width={16} height={14} rx={2.5} stroke={color} strokeWidth={1.6} />
      <Path d="M3 9h16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M7.5 2.5v3.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M14.5 2.5v3.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function Hanger({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 4 a1.8 1.8 0 1 1 1.8 1.8 v1.4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M11 7.4 L2.8 13.6 a1.3 1.3 0 0 0 .8 2.4 h14.8 a1.3 1.3 0 0 0 .8-2.4 Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Bars({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 22 22" fill="none">
      <Path d="M3.5 18v-6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M8 18V8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12.5 18V4.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M17 18v-8.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function Heart({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 17.5 3.8 10.6a3.9 3.9 0 0 1 5.6-5.4L11 6.7l1.6-1.5a3.9 3.9 0 0 1 5.6 5.4Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The 36pt tray disc that stands in for a face when no single person did it. */
export function ActivityGlyphMark({ glyph }: { glyph: ActivityGlyph }) {
  const theme = useTheme();

  return (
    <View
      // The sentence beside it already names the object; a screen reader that
      // also announced the mark would read the row twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center rounded-full bg-tray"
      style={{ width: MARK, height: MARK }}>
      {glyph === 'calendar' ? <Calendar color={theme.muted} /> : null}
      {glyph === 'hanger' ? <Hanger color={theme.muted} /> : null}
      {glyph === 'bars' ? <Bars color={theme.muted} /> : null}
      {glyph === 'heart' ? <Heart color={theme.muted} /> : null}
    </View>
  );
}

/** The circled exclamation, for AV-04. Oxblood — the page's one accent. */
export function ActivityErrorGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Path d="M11 6.6v5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M11 14.9v.1" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** The bell, for AV-02's empty page. Drawn open, never ringing. */
export function ActivityBellGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 3.5a5.5 5.5 0 0 1 5.5 5.5c0 4.2 1.5 5.4 1.5 5.4H4s1.5-1.2 1.5-5.4A5.5 5.5 0 0 1 11 3.5Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.4 17.2a1.8 1.8 0 0 0 3.2 0"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

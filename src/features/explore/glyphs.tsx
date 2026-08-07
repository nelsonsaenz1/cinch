import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The Lately atlas's three marks, traced stroke for stroke.
 *
 * Not SF Symbols: the atlas draws its own hanger and two-person figure — the
 * same drawings as the tab bar's — and `tshirt` / `person.2` are close cousins,
 * not these. A page whose empty state shows a different garment mark than its
 * own tab icon reads as two apps. Each glyph keeps the atlas's 22-unit grid,
 * 1.4 stroke and round caps; only `size` and `color` vary by placement.
 */

/**
 * The two ink strengths the atlas draws these marks at. Named for placement,
 * because they are two different jobs: a hero glyph headlines an empty page,
 * a fallback sits inside a 76pt well pretending not to be there.
 */
export const HERO_GLYPH_INK = 'rgba(28,26,22,0.28)';
export const FALLBACK_GLYPH_INK = 'rgba(28,26,22,0.22)';

type GlyphProps = {
  size: number;
  color: string;
  strokeWidth?: number;
};

/** The coat hanger — the garment mark. Row fallback at 24, hero empty at 34. */
export function HangerGlyph({ size, color, strokeWidth = 1.4 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 4 a1.8 1.8 0 1 1 1.8 1.8 v1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M11 7.4 L2.8 13.6 a1.3 1.3 0 0 0 .8 2.4 h14.8 a1.3 1.3 0 0 0 .8-2.4 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The two-person figure — the Lately tab's own mark, for the no-friends hero. */
export function TwoPersonGlyph({ size, color, strokeWidth = 1.4 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx={8} cy={7.5} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M2.5 17.5 a5.5 5.5 0 0 1 11 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={15.8} cy={8.3} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M15.8 13.4 a4.6 4.6 0 0 1 3.9 4.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The circled exclamation — the failed read, in oxblood rather than warning amber. */
export function CircledExclamationGlyph({ size, color, strokeWidth = 1.4 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M11 6.6v5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M11 14.9v.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

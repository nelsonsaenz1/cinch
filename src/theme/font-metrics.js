// Font metrics, read directly from the shipped TTFs.
//
// WHY THIS FILE EXISTS
//
// React Native maps `lineHeight` onto an NSParagraphStyle with both minimum and
// maximum line height set. When that value is smaller than the font's own line
// box, CoreText compresses the line — and because glyphs are positioned from the
// baseline, the space is taken off the TOP. Tall ascenders, cap overshoots and
// the tittle on an `i` get sliced flat.
//
// It does not look like clipping. It looks like the layout is slightly wrong, or
// like something above is overlapping the text, which is exactly how it was first
// reported: "the name is being covered by the logo."
//
// The floor is the font's own line box, from the `hhea` table:
//
//     ascent + |descent| + lineGap        (all divided by unitsPerEm)
//
// CoreText reads `hhea` for ascent/descent unless the OS/2 USE_TYPO_METRICS bit
// is set; neither of these faces sets it. Values below were parsed out of the
// binaries in node_modules rather than copied from a specification sheet, so
// they describe the fonts actually being bundled.
//
//   BodoniModa_600SemiBold   unitsPerEm 2000   asc 2250   desc -800   gap 0
//   Archivo_400Regular       unitsPerEm 1000   asc  878   desc -210   gap 0
//
// Bodoni's 1.525 is unusually tall — a didone carries a lot of vertical air —
// and that is the whole reason this bug existed. A 1.2 leading that is perfectly
// safe for a grotesque clips a didone badly.

/** @type {Record<string, {ascent: number, descent: number, leading: number, capHeight: number}>} */
const FACES = {
  // unitsPerEm 2000, hhea asc 2250 / desc -800 / gap 0, sCapHeight 1500
  bodoni: { ascent: 1.125, descent: 0.4, leading: 1.525, capHeight: 0.75 },
  // unitsPerEm 1000, hhea asc 878 / desc -210 / gap 0, sCapHeight 686
  archivo: { ascent: 0.878, descent: 0.21, leading: 1.088, capHeight: 0.686 },
};

/**
 * Smallest line height, in px, that will not clip `face` at `fontSize`.
 * Always round UP; a half-pixel short still slices the ascenders.
 */
function minLineHeight(face, fontSize) {
  const m = FACES[face];
  if (!m) throw new Error(`Unknown face "${face}". Known: ${Object.keys(FACES).join(', ')}`);
  return Math.ceil(fontSize * m.leading);
}

/**
 * The line height to actually ship: your preferred `ratio`, clamped up to the
 * font's floor.
 *
 * Call this instead of writing a number. Asking for tight display leading is a
 * reasonable thing to want — it just cannot go below the floor, and the clamp is
 * the difference between "tight" and "broken".
 */
function leading(face, fontSize, ratio) {
  return Math.max(Math.round(fontSize * ratio), minLineHeight(face, fontSize));
}

/**
 * Letter spacing, expressed as a fraction of the font size.
 *
 * React Native maps `letterSpacing` to NSKern in ABSOLUTE POINTS, not em. A value
 * tuned on a 62px headline is therefore wildly wrong on 16px body text — this is
 * why tracking has to be computed per size rather than shared as a constant.
 *
 * The display sizes here sit at -0.015em, which is what Apple's own New York
 * serif uses at 72pt. The previous hand-typed -1.5px at 62 was -0.024em: 60%
 * tighter than Apple's curve, on a face with much higher stroke contrast, which
 * pushed the thin strokes of adjacent letters into each other.
 */
function tracking(fontSize, ratio) {
  return Number((fontSize * ratio).toFixed(2));
}

/**
 * Negative margins that collapse a line box down to its CAP HEIGHT.
 *
 * `leading()` guarantees the glyphs are never clipped, but it does not give an
 * editorially tight measure: a 64px Bodoni sits inside a 98px box, so a rule
 * drawn 12px under the text reads as 35px under it. Every attempt to fix that by
 * lowering `lineHeight` is the clipping bug again.
 *
 * The fix is the one print and web typographers use — trim the box to the cap
 * height with negative margins, leaving the glyph box itself untouched. This is
 * Capsize's cap-trim, ported to React Native.
 *
 *   bodoni 64 / lh 98  ->  marginTop -24, marginBottom -26  ->  48pt laid out
 *                          which is exactly 0.75 x 64, the cap height.
 */
function capTrim(face, fontSize, lineHeight) {
  const m = FACES[face];
  if (!m) throw new Error(`Unknown face "${face}"`);
  const half = (lineHeight - fontSize * m.leading) / 2; // leftover leading, split
  return {
    marginTop: -Math.round(half + fontSize * (m.ascent - m.capHeight)),
    marginBottom: -Math.round(half + fontSize * m.descent),
  };
}

module.exports = { FACES, minLineHeight, leading, tracking, capTrim };

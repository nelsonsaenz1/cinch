/**
 * sRGB <-> OKLab <-> OKLCH.
 *
 * Why OKLCH and not HSL, which every other closet app uses:
 *
 * HSL is not perceptually uniform. Its "saturation" and "lightness" are
 * algebraic conveniences over RGB, not statements about human vision. Two
 * colours with identical HSL saturation can look wildly different in vividness,
 * and — the part that actually breaks outfit logic — hue *distance* in HSL
 * badly misrepresents perceived difference. The blue region is compressed and
 * the green region stretched, so "these two hues are 40 degrees apart" means
 * something different depending on where on the wheel you are.
 *
 * Every judgement this engine makes is a distance judgement: is this hue near
 * that one, is this value contrast too low, are both of these too vivid to sit
 * together. Those answers are only meaningful in a space where equal numeric
 * steps look like equal perceptual steps. OKLab (Björn Ottosson, 2020) was
 * designed for exactly that and is now in CSS Color 4.
 *
 * Matrices below are Ottosson's published values. Do not "clean up" the
 * digits — the round-trip error grows fast.
 */

export type Rgb = { r: number; g: number; b: number }; // each 0..1
export type Oklab = { L: number; a: number; b: number };

/** L 0..1, C 0..~0.4 in practice, h in degrees 0..360. */
export type Oklch = { L: number; C: number; h: number };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Parse `#rgb`, `#rrggbb`, or the same without the hash. Null if unparseable. */
export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  let full: string;
  if (hex.length === 3) full = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
  else if (hex.length === 6) full = hex;
  else return null;

  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** sRGB electro-optical transfer function — the real piecewise curve, not 2.2. */
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.sqrt(a * a + b * b);
  // Chroma below this is numerically noise; the hue angle of near-grey is
  // meaningless and would otherwise jitter wildly between adjacent greys.
  const h = C < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

export function oklchToOklab({ L, C, h }: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export const hexToOklch = (hex: string): Oklch | null => {
  const rgb = parseHex(hex);
  return rgb ? oklabToOklch(rgbToOklab(rgb)) : null;
};

export const oklchToHex = (c: Oklch): string => toHex(oklabToRgb(oklchToOklab(c)));

/**
 * Shortest angular distance between two hues, 0..180.
 *
 * Always use this rather than subtracting — hue is circular, and the naive
 * difference between 350 and 10 is 340 when the answer is 20.
 */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(((h1 - h2) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Perceptual distance in OKLab. Euclidean here is legitimate precisely because
 * the space is uniform — the same move in CIELAB would need a CIEDE2000
 * correction term.
 */
export function deltaE(a: Oklch, b: Oklch): number {
  const la = oklchToOklab(a);
  const lb = oklchToOklab(b);
  const dL = la.L - lb.L;
  const da = la.a - lb.a;
  const db = la.b - lb.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

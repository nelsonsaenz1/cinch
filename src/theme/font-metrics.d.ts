export type FaceName = 'instrument' | 'helvetica' | 'bodoni' | 'archivo';

export declare const FACES: Record<
  FaceName,
  { ascent: number; descent: number; leading: number; capHeight: number }
>;

/** Smallest line height, in px, that will not clip `face` at `fontSize`. */
export declare function minLineHeight(face: FaceName, fontSize: number): number;

/** Preferred `ratio` leading, clamped up to the font's own line box. */
export declare function leading(face: FaceName, fontSize: number, ratio: number): number;

/** Letter spacing as a fraction of font size (RN wants absolute points). */
export declare function tracking(fontSize: number, ratio: number): number;

/** Negative margins that collapse the line box to the cap height. */
export declare function capTrim(
  face: FaceName,
  fontSize: number,
  lineHeight: number,
): { marginTop: number; marginBottom: number };

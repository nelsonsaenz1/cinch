export type FaceName = 'bodoni' | 'archivo';

export declare const FACES: Record<FaceName, { leading: number; capHeight: number }>;

/** Smallest line height, in px, that will not clip `face` at `fontSize`. */
export declare function minLineHeight(face: FaceName, fontSize: number): number;

/** Preferred `ratio` leading, clamped up to the font's own line box. */
export declare function leading(face: FaceName, fontSize: number, ratio: number): number;

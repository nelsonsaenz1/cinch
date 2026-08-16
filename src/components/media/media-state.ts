/**
 * WHAT A GARMENT WELL IS SHOWING — the arithmetic behind `GarmentImage`.
 *
 * UX-06's refusal is one sentence: "a failed or expired signed URL must never
 * leave a blank unexplained well." Every garment picture in this app is a
 * private storage object behind a signed URL that is re-issued every fifty
 * minutes (`features/closet/use-image-urls.ts`), so there are four ways a well
 * can end up with nothing in it, and only one of them was handled:
 *
 *   1. There is no path at all — no cutout, no plate, no photograph. Every
 *      call site already drew a considered mark for this one.
 *   2. The signing request failed, so the path never became a URL. Indistinguishable
 *      from (1) at the call site, and handled by the same branch.
 *   3. The fetch failed — offline, or a signature that expired between the
 *      render and the request. `<Image>` renders nothing and says nothing.
 *   4. The bytes arrived and would not decode. Same silence.
 *
 * (3) and (4) are the blank wells. They are the same fact to a reader — the
 * photograph is not available — so they collapse into one visible state here
 * rather than into two apologies.
 *
 * Primitives in, primitives out: no React, no `expo-*`, no React Native. The
 * unit test bundler cannot follow React Native's Flow source, and this is the
 * part of the well worth testing.
 */

/**
 * The load's own progress, as `<Image>` reports it.
 *
 * `failed` covers a fetch error, a decode error and an expired signature
 * alike. Distinguishing them would produce three sentences for one outcome,
 * and the outcome is what a reader is looking at.
 */
export type LoadPhase = 'loading' | 'loaded' | 'failed';

/**
 * What the well draws.
 *
 * `waiting` is deliberately NOT the fallback: showing the "no photograph yet"
 * mark for the second before a photograph arrives, then swapping it out, makes
 * every scroll flicker between two truths. A waiting well shows its ground —
 * the tray — which is the geometry the picture is about to occupy.
 */
export type MediaWell = 'photograph' | 'waiting' | 'fallback';

export function mediaWell(uri: string | null | undefined, phase: LoadPhase): MediaWell {
  if (!uri) return 'fallback';
  if (phase === 'failed') return 'fallback';
  return phase === 'loaded' ? 'photograph' : 'waiting';
}

/**
 * The disk-cache identity of a signed URL — and the reset key for the load.
 *
 * Two jobs, one derivation, because they are the same question. expo-image
 * keys its disk cache on the whole URI by default, and a signed URI carries a
 * token that is different on every signing — so the same garment photograph
 * was written to disk under a new key every hour and never once read back.
 * And a `failed` phase that reset on the raw URI would clear itself every
 * fifty minutes when the signer rotated the token, re-requesting an image
 * that has already failed, forever. Both want "is this the same picture?".
 *
 * ── WHY THE STRIPPING IS CONDITIONAL ──────────────────────────────────────
 *
 * Dropping the query unconditionally is wrong for any URL that carries its
 * identity IN the query, and Metro's dev asset server is exactly that:
 * `http://localhost:8081/assets/?unstable_path=.%2Fassets%2Fgarments%2Fcoat.jpg`.
 * Stripping there yields `http://localhost:8081/assets/` for EVERY garment, so
 * expo-image files them all under one key and the first photograph to decode is
 * then served for all of them — a mohair sweater under the title of a shearling
 * coat, which `dev-item` showed before `item-hero.tsx` worked this out.
 *
 * So the query is only dropped when what remains still names a file, which is
 * true of the signed storage URLs this app sees in production
 * (`…/garments/{user}/{item}/cutout.jpg?token=…`) and false of anything whose
 * path ends at a directory. When in doubt the whole URI is the key: an image
 * re-downloaded once an hour is a cost, an image showing the WRONG GARMENT is
 * a bug.
 */
export function pictureKey(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const withoutQuery = uri.split('?')[0];
  const lastSegment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  return lastSegment.includes('.') ? withoutQuery : uri;
}

/**
 * Whether a new URI is a NEW PICTURE or the same one re-signed.
 *
 * The load phase resets on `false` here and survives on `true`, which is what
 * stops a re-signing from flashing a loaded well back to its ground — and what
 * stops a failed well from retrying on a fifty-minute loop.
 */
export function samePicture(a: string | null | undefined, b: string | null | undefined): boolean {
  return pictureKey(a) === pictureKey(b);
}

/**
 * The `source` object for `<Image>` — the URI to fetch, and the stable key to
 * file the bytes under.
 */
export function mediaSource(uri: string | null | undefined) {
  const key = pictureKey(uri);
  return uri && key ? { uri, cacheKey: key } : undefined;
}

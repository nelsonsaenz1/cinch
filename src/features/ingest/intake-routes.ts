// TYPE-ONLY, and load-bearing that it stays that way. `import type` is erased
// by the compiler, so this file still imports nothing at runtime and the node
// test bundler never has to resolve `expo-symbols`. The same split, and the
// same reason, as `camera-copy.ts`.
import type { SymbolViewProps } from 'expo-symbols';

/**
 * AC-C1 / TN-C1 — the four ways in, as one table.
 *
 * ── THE FOUNDER-VISIBLE FAILURE THIS EXISTS TO CLOSE ──────────────────────
 *
 * "The Ten currently opens with two routes, Camera and Voice, while Add clothes
 * offers four. That is the founder-visible failure: the first thing a new user
 * meets is the narrowest door in the app."
 *
 * So the routes live here, in fixed order, and both surfaces read the same
 * table. A door added to one is a door added to both, by construction rather
 * than by anyone remembering — which is exactly what went wrong last time.
 *
 * ── THE ORDER IS FIXED, AND CAMERA IS NOT PREFERRED ───────────────────────
 *
 * Camera, library, catalogue, voice. Same order on every surface that offers
 * intake, and the same order at the capacity ceiling, where all four stay
 * available and capacity settles after acquisition (the v3 correction, and
 * W-02, both preserved). "No route is emphasised by colour, size or position."
 *
 * ── THE CATALOGUE ROUTE'S NAME, AND A REVERSED DECISION ───────────────────
 *
 * The typed door has been renamed twice. It shipped as "Describe it", became
 * "Search for it" after the founder went looking for a search door in the App
 * Store build and could not find one, and went back to "Describe it" under
 * audit 66, on the argument that "Describe it" and "Describe by voice" are one
 * act in two media.
 *
 * AC-C1 supersedes that, and it is right to: the two doors are NOT one act in
 * two media. Voice files the reader's own words. This one searches a licensed
 * product-listing catalogue and returns a shop's photograph — a different
 * source, a different result, and the only one of the four that reaches a
 * third party. "The catalogue is a route, not a hidden feature of a text box."
 * Naming it for what it fetches is what makes the disclosure below travel with
 * the control instead of living in a settings screen.
 */

/** The name the catalogue route carries everywhere. */
export const CATALOGUE_ROUTE_NAME = 'Find a product photo';

export type IntakeRouteKey = 'camera' | 'library' | 'catalogue' | 'voice';

export type IntakeRoute = {
  key: IntakeRouteKey;
  name: string;
  /** The subtitle on Add clothes. */
  line: string;
  /** The subtitle in The Ten, where the target is ten pieces rather than one. */
  tenLine: string;
  /** SF Symbol. Typed as `SymbolView`'s own name union so a typo fails here. */
  symbol: SymbolViewProps['name'];
  accessibilityLabel: string;
};

/** In order. The order IS the contract; nothing may sort or filter this. */
export const INTAKE_ROUTES: readonly IntakeRoute[] = [
  {
    key: 'camera',
    name: 'Camera',
    line: 'Photograph a piece against any wall',
    tenLine: 'Photograph them as you go',
    symbol: 'camera',
    accessibilityLabel: 'Camera — photograph a piece against any wall',
  },
  {
    key: 'library',
    name: 'Photo library',
    line: 'Pick pictures you already have — no permission needed',
    tenLine: 'Ten pictures you already have',
    symbol: 'photo.on.rectangle',
    accessibilityLabel: 'Photo library — pick pictures you already have, no permission needed',
  },
  {
    key: 'catalogue',
    name: CATALOGUE_ROUTE_NAME,
    // NO PASTED LINK. The door now opens `/find-photo`, which takes typed or
    // spoken words and nothing else — the paste field belongs to the older
    // describe sheet, which is no longer what this plate reaches. A subtitle
    // that promised a paste box the destination does not have would be a lie
    // told at the exact moment somebody is deciding which door to use.
    line: 'Say or type a piece and Cinch finds licensed shop photos',
    tenLine: 'Name a piece and pick its shop photo',
    symbol: 'magnifyingglass',
    accessibilityLabel: `${CATALOGUE_ROUTE_NAME} — type a piece or paste a product link and Cinch finds licensed shop photos`,
  },
  {
    key: 'voice',
    name: 'Describe by voice',
    line: 'Say it out loud instead of typing',
    tenLine: 'Say them out loud, one at a time',
    symbol: 'waveform',
    accessibilityLabel: 'Describe by voice — say what you own out loud instead of typing',
  },
] as const;

/**
 * The disclosure, under the four, on every surface that offers them.
 *
 * Two claims, and both are checkable against the code rather than aspirational.
 * The search runs against Datafeedr's licensed product-listing feed and
 * fails closed when nothing matches — there is no open-web fallback anywhere in
 * the path. And nothing typed here reaches a model: the query goes to the feed
 * as a query.
 *
 * It sits WITH the control rather than in a privacy screen, "so the claim
 * travels with the control".
 */
export const CATALOGUE_DISCLOSURE =
  'Product search reads a licensed shop catalogue only. It is not a web search, and nothing you type is sent to an AI model.';

/** The Ten's own addition — route-switching is likely when the target is ten. */
export const TEN_MIXING_NOTE =
  'You can mix routes. Photograph six, find three in a shop, say the last one.';

/**
 * Phrases an intake surface may never carry.
 *
 * "The phrases 'web search', 'search the web' and any AI-model claim are
 * prohibited on intake surfaces." Both halves would be false here, and a false
 * claim about where a photograph came from or where words were sent is the
 * kind that has to be true before it is written, not after somebody checks.
 *
 * Asserted over the rendered copy in `tests/intake-routes.test.ts`.
 */
export const INTAKE_FORBIDDEN_PHRASES = [
  'web search',
  'search the web',
  'searches the web',
  'across the web',
  'AI model',
  'artificial intelligence',
];

/**
 * The primary action on a chosen listing — DS-C3.
 *
 * "The primary action names the flow the user came from — 'my first ten' during
 * onboarding, 'my closet' from Add clothes — and carries the running count, so
 * the return path is legible before the tap."
 *
 * At the ceiling it becomes the store-a-piece action instead: the found garment
 * is HELD, never discarded, which is the v3 rule this app has held since the
 * capacity work. The count is omitted when it is not known rather than guessed
 * — the same refusal the chooser's own capacity line makes.
 */
export function addToFlowLabel({
  origin,
  used,
  limit,
  full = false,
}: {
  origin: 'first-ten' | 'closet';
  used: number | null;
  limit: number | null;
  full?: boolean;
}): string {
  if (full) return 'Add — store a piece to make room';
  const where = origin === 'first-ten' ? 'my first ten' : 'my closet';
  if (used === null || limit === null) return `Add to ${where}`;
  // The count is what the closet will hold AFTER this one, which is the number
  // the reader is deciding about.
  return `Add to ${where} — ${Math.min(used + 1, limit)} of ${limit}`;
}

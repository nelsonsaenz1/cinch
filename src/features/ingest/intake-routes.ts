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
 * ── THE ORDER IS FIXED, AND CATALOGUE LEADS ───────────────────────────────
 *
 * Catalogue, camera, library, voice. Same order on every surface that offers
 * intake, and the same order at the capacity ceiling, where all four stay
 * available and capacity settles after acquisition (the v3 correction, and
 * W-02, both preserved).
 *
 * THIS REVERSES AC-C1's "no route is emphasised by colour, size or position",
 * and only for THE TEN. Corrections CX-01 supersedes it there on a founder
 * call: a first run has nothing in the closet and no photographs taken yet, so
 * offering four peers asks a beginner to pick a workflow before they have one.
 * The catalogue is the fastest route to ten pieces and is now recommended by
 * PLACEMENT AND EDGE — never by dimming the other three, which keep full
 * contrast and full-size targets.
 *
 * Add clothes still draws four peers through `DoorPlate`; a reader arriving
 * there already has a closet and a habit. What the two surfaces share is this
 * table and its ORDER, so a door added to one is added to both.
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
  /**
   * The name in The Ten's chooser, when it differs from `name`.
   *
   * CX-01 words the chooser as instructions to somebody who has never done
   * this — "Take a photo" rather than the noun "Camera". Add clothes keeps the
   * nouns, because a reader who returns there is scanning a list they already
   * know rather than being taught one. Absent means the two agree.
   */
  tenName?: string;
  /** The subtitle in The Ten, where the target is ten pieces rather than one. */
  tenLine: string;
  /** SF Symbol. Typed as `SymbolView`'s own name union so a typo fails here. */
  symbol: SymbolViewProps['name'];
  accessibilityLabel: string;
};

/** In order. The order IS the contract; nothing may sort or filter this. */
export const INTAKE_ROUTES: readonly IntakeRoute[] = [
  {
    key: 'catalogue',
    name: CATALOGUE_ROUTE_NAME,
    // NO PASTED LINK. The door now opens `/find-photo`, which takes typed or
    // spoken words and nothing else — the paste field belongs to the older
    // describe sheet, which is no longer what this plate reaches. A subtitle
    // that promised a paste box the destination does not have would be a lie
    // told at the exact moment somebody is deciding which door to use.
    line: 'Say or type a piece and Cinch finds licensed shop photos',
    tenLine: 'Search by brand and name.',
    symbol: 'sparkle.magnifyingglass',
    /**
     * NO PASTED LINK — the same correction the `line` above already carries.
     * This label still promised a paste box for months after the door stopped
     * opening one: `/find-photo` takes typed or spoken words and nothing else.
     * A VoiceOver reader was the last person in the app being told about a
     * control that is not there, which is the worst place for the claim to
     * survive, because nobody sighted would ever catch it.
     */
    accessibilityLabel: `${CATALOGUE_ROUTE_NAME} — type or say a brand or piece and Cinch finds licensed shop photos`,
  },
  {
    key: 'camera',
    name: 'Camera',
    tenName: 'Take a photo',
    line: 'Photograph a piece against any wall',
    tenLine: 'One picture per piece.',
    symbol: 'camera.fill',
    accessibilityLabel: 'Camera — photograph a piece against any wall',
  },
  {
    key: 'library',
    name: 'Photo library',
    tenName: 'Choose from your library',
    line: 'Pick pictures you already have — no permission needed',
    tenLine: 'Photos you already have.',
    symbol: 'photo.on.rectangle.angled',
    accessibilityLabel: 'Photo library — pick pictures you already have, no permission needed',
  },
  {
    key: 'voice',
    name: 'Describe by voice',
    line: 'Say it out loud instead of typing',
    tenLine: 'Say what you own.',
    symbol: 'mic.fill',
    accessibilityLabel: 'Describe by voice — say what you own out loud instead of typing',
  },
] as const;

/**
 * The one route CX-01 recommends, and the word it wears.
 *
 * A key rather than a boolean on the row: exactly one route may be
 * recommended, and a `recommended: true` field invites a second one.
 */
export const TEN_RECOMMENDED_KEY: IntakeRouteKey = 'catalogue';
export const TEN_RECOMMENDED_BADGE = 'RECOMMENDED';

/** The chooser's own name for a route — `tenName` where it has one. */
export function tenRouteName(route: IntakeRoute): string {
  return route.tenName ?? route.name;
}

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
  'Product search reads a licensed shop catalog only. It is not a web search, and nothing you type is sent to an AI model.';

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

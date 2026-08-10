/**
 * Styling thresholds — the numbers, with nothing else attached.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * `MIN_CLOSET_FOR_OUTFITS` lived in `features/styling/queries.ts` beside
 * `canGenerate`, which is where it is used and reads perfectly well. The
 * problem is who else needs it: `features/help/articles.ts` says the number out
 * loud to a reader ("Cinch starts building outfits at eight pieces"), and
 * `queries.ts` imports `@tanstack/react-query` and `@/lib/supabase`. Importing
 * from there would drag React Native into the article's module graph, and
 * `scripts/run-tests.mjs` bundles that graph with esbuild, which cannot parse
 * React Native's Flow source. One import would take the whole suite down.
 *
 * So the constant moves to a leaf with no imports at all — the same shape
 * `features/billing/plans.ts` has, and for the same reason. `queries.ts`
 * re-exports it so every existing call site is untouched.
 *
 * Until this existed, `tests/piece-counts.test.ts` read `queries.ts` as TEXT
 * and regex-matched the number, because that was the only way to check the
 * article against it. That test can now import both sides and compare them
 * properly.
 *
 * Anything added here must stay import-free. A single import of something
 * React-shaped puts the help article back where it started.
 */

/**
 * Enough of a closet to generate something worth showing.
 *
 * Deliberately NOT the free-tier cap (`PLANS.free.items`, ten). This is the
 * engine's floor — below it there is not enough to combine — while ten is the
 * number the product asks a person for and the number they meet in The Ten,
 * the tour and Today. `features/onboarding/tour-copy.ts` documents that
 * distinction: eight is internal and is never used as an instruction, because
 * asking for eight and then holding a tenth slot open would read as moving the
 * goalposts.
 *
 * `canGenerate` (queries.ts) pairs this with a shape requirement — a top and a
 * bottom, or a dress — so eight jumpers still does not qualify.
 */
export const MIN_CLOSET_FOR_OUTFITS = 8;

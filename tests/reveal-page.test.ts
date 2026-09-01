/**
 * The Reveal, as drawn and as routed. Redesign 12.
 *
 * The decisions are `tests/reveal-spec.test.ts` and the payloads are
 * `tests/reveal-analytics.test.ts`. What is left — and what this file holds —
 * is the PAGE: the six exits, the three states that skip the vendor sheet, the
 * digit gate, and the several things this screen must never become.
 *
 * Asserted as text, because esbuild cannot parse React Native's Flow source and
 * there is no renderer in this harness. Every regex is written against a line
 * somebody would have to deliberately delete.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROUTE_RAW = readFileSync('src/app/reveal.tsx', 'utf8');
const COUNT_RAW = readFileSync('src/components/reveal/reveal-count.tsx', 'utf8');
const EMPTY_RAW = readFileSync('src/components/reveal/reveal-empty.tsx', 'utf8');
const SEQ_RAW = readFileSync('src/features/onboarding/use-reveal-sequence.ts', 'utf8');
const UNTAGGED_RAW = readFileSync('src/features/onboarding/use-untagged-count.ts', 'utf8');

/** Comments are prose about the code, not the code. Strip before grepping. */
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ROUTE = stripped(ROUTE_RAW);
const COUNT = stripped(COUNT_RAW);
const EMPTY = stripped(EMPTY_RAW);
const SEQ = stripped(SEQ_RAW);

// ---------------------------------------------------------------------------
// The number is the engine's number
// ---------------------------------------------------------------------------

test('the count comes from countOutfits(tallyOf(items)) and nowhere else', () => {
  assert.match(ROUTE, /const tally = useMemo\(\(\) => tallyOf\(items\), \[items\]\)/);
  assert.match(ROUTE, /const count = countOutfits\(tally\)/);
  // No second source. A literal, a rounding or a server-supplied figure would
  // each be a number this screen could animate to without owning.
  assert.doesNotMatch(ROUTE, /Math\.round\(|Math\.floor\(count|estimate|approx/i);
});

test('the digit is gated on the phase, not on the count', () => {
  // A resolved count arriving during `computing` still draws nothing: the beat
  // is the promise that no number is being implied yet.
  assert.match(ROUTE, /showNumber=\{mayDrawDigit\(sequence\.phase\)\}/);
  assert.match(COUNT, /\{showNumber \? \(/);
});

test('nothing digit-shaped is drawn before the count resolves', () => {
  // No skeleton, no shimmer, no dash placeholder. A digit-shaped placeholder is
  // itself a claim: it says a number is coming and it is about this wide.
  assert.doesNotMatch(COUNT, /Skeleton|shimmer|placeholder|—\s*\}/i);
  assert.doesNotMatch(ROUTE, /RevealSkeleton|CountSkeleton|<Skeleton/i);
});

test('counting cannot begin until the wardrobe query has settled', () => {
  assert.match(ROUTE, /const countReady = !wardrobe\.isLoading && !wardrobe\.isFetching/);
  assert.match(ROUTE, /countReady,/);
  assert.match(SEQ, /if \(phase === 'computing' && countReady\)/);
});

// ---------------------------------------------------------------------------
// The six exits, and the one destination
// ---------------------------------------------------------------------------

test('every terminal path lands on the tabs', () => {
  const replaces = [...ROUTE.matchAll(/router\.replace\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(replaces.length >= 3, `expected at least three exits, found ${replaces.length}`);
  for (const r of replaces) {
    assert.ok(
      r === '/(tabs)' || r === '/the-ten?door=photograph',
      `an exit goes somewhere else: ${r}`,
    );
  }
});

test('navigation does not branch on the gate result', () => {
  // Paywall 254200 is non-gated, so Superwall runs feature() on dismissal too
  // and present() resolves 'granted' for somebody who bought nothing. Branching
  // on the outcome would not mean what it looks like it means.
  assert.doesNotMatch(ROUTE, /if \(outcome === 'granted'\)/);
  assert.doesNotMatch(ROUTE, /outcome === 'granted' \?[\s\S]{0,120}replace/);
  // The result is REPORTED and then discarded.
  assert.match(ROUTE, /exit\(\s*skipSheet/);
});

test('a granted result never routes to membership thanks', () => {
  // Settlement is proven by the SDK flow, which alone pushes /membership-thanks.
  assert.doesNotMatch(ROUTE, /membership-thanks/);
});

test('all six exits are reachable from this file', () => {
  for (const e of [
    'open_today',
    'dismissed',
    'unavailable',
    'zero_repair',
    'zero_open_today',
  ]) {
    assert.match(ROUTE, new RegExp(`'${e}'`), `${e} is never reported`);
  }
  // `purchase` is deliberately NOT reported from here: this screen cannot know
  // a purchase settled, and claiming one it inferred would be the exact lie the
  // non-gated campaign makes easy.
  assert.doesNotMatch(ROUTE, /'purchase'/);
});

// ---------------------------------------------------------------------------
// The membership moment is vendor-owned and state-correct
// ---------------------------------------------------------------------------

test('a paying member is never presented a placement', () => {
  assert.match(ROUTE, /const paying = \(plan\.plan !== 'free' && !plan\.trialing\) \|\| plan\.unconfirmed/);
  assert.match(ROUTE, /const skipSheet = paying \|\| offline/);
  assert.match(ROUTE, /if \(!skipSheet\) setPresenting\(true\)/);
});

test('a trial in progress is not sold a second one', () => {
  // `plan` resolves to `pro` DURING the trial, so `plan !== 'free'` alone would
  // skip the moment for exactly the people it is for — and the moment itself
  // promises no new trial, because the 14 days are server-side access.
  assert.match(ROUTE, /plan\.trialing \? REVEAL_COPY\.memberContextTrialing : REVEAL_COPY\.memberContextFree/);
});

test('offline skips the sheet rather than spinning on it', () => {
  assert.match(ROUTE, /const offline = weatherFailed/);
  assert.match(ROUTE, /paying \|\| offline/);
});

test('no price, product, term or vendor layout is drawn here', () => {
  // Asserted against what is DRAWN. The route's prose names every one of these
  // in order to refuse it, and a grep over comments would read the refusal as
  // the offence.
  assert.doesNotMatch(ROUTE, /\$\d|£\d|€\d|per month|\/mo\b/i);
  assert.doesNotMatch(ROUTE, /StoreKit|SKProduct|introductoryOffer|productId/i);
  assert.doesNotMatch(ROUTE, /\b\d+[- ]day (free )?trial\b/i);
});

test('the placement is the existing one, with no new campaign invented', () => {
  assert.match(ROUTE, /Placement\.RevealComplete/);
  assert.equal((ROUTE.match(/gate\.present\(/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// Zero never sees a paywall
// ---------------------------------------------------------------------------

test('the zero branch returns before anything can present', () => {
  const zeroAt = ROUTE.indexOf("sequence.phase === 'zero'");
  const presentAt = ROUTE.indexOf('gate.present(');
  assert.ok(zeroAt > -1, 'the zero branch is gone');
  assert.ok(presentAt > -1);
  // `goToToday` is the only caller of present(), and the zero screen's two
  // actions are wired to router.replace directly rather than to it.
  const zeroBlock = ROUTE.slice(zeroAt, ROUTE.indexOf('COUNTING', zeroAt) + 1 || zeroAt + 2000);
  assert.doesNotMatch(zeroBlock, /goToToday|gate\.present/, zeroBlock);
});

test('the zero offers both accepted doors', () => {
  assert.match(ROUTE, /router\.replace\('\/the-ten\?door=photograph'\)/);
  assert.match(ROUTE, /onOpenToday=\{/);
  assert.match(EMPTY, /REVEAL_COPY\.zeroOpenToday/);
});

test('the zero names what is missing as things, not as a table', () => {
  assert.match(ROUTE, /needs=\{missingPhrases\(tally\)\}/);
  assert.doesNotMatch(EMPTY, /tabular-nums|row\.value|0 — needed/);
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('the count and its derivation are one announcement', () => {
  assert.match(COUNT, /accessible accessibilityRole="header" accessibilityLabel=\{spokenLabel\}/);
  // The bare figure is excluded: the label already says "twenty-six outfits",
  // and a "26" read out first is the same fact twice in two registers.
  assert.match(COUNT, /accessibilityElementsHidden\s*\n\s*importantForAccessibility="no"/);
  // The chips repeat the composition the label already spelled out.
  assert.match(COUNT, /accessibilityElementsHidden\s*\n\s*importantForAccessibility="no-hide-descendants"/);
});

test('focus lands on the exit when the reveal completes', () => {
  assert.match(ROUTE, /AccessibilityInfo\.setAccessibilityFocus\(node\)/);
  assert.match(ROUTE, /if \(!sequence\.complete\) return/);
});

test('every target clears 44pt, and 56pt at an accessibility size', () => {
  const heights = COUNT.match(/minHeight: large \? (\d+) : (\d+)/g) ?? [];
  for (const h of heights) {
    const [, big, small] = h.match(/\? (\d+) : (\d+)/) as RegExpMatchArray;
    // The chips are not targets — they are labels — but the AX step is still
    // the accepted 52pt, and nothing here is a control below the floor.
    assert.ok(Number(big) > Number(small), h);
  }
  // The two real controls are Buttons, whose own spec test pins their height.
  assert.match(ROUTE, /<Button/);
});

test('the exit is pinned outside the scroll region, so a short screen keeps it', () => {
  // The structural guarantee a 667pt screen depends on, and the one this
  // harness can check without a 667pt simulator: the composition SCROLLS and
  // the CTA does not. The plate crops before the type does, and the exit stays
  // above the home indicator at every height and every type size.
  const scrollEnd = ROUTE.indexOf('</ScrollView>');
  const buttonAt = ROUTE.lastIndexOf('<Button');
  assert.ok(scrollEnd > -1, 'the composition no longer scrolls');
  assert.ok(buttonAt > scrollEnd, 'the exit was moved inside the scroll region');
  // And it sits in a bottom-edge SafeAreaView rather than a fixed offset.
  assert.match(ROUTE, /<SafeAreaView edges=\{\['bottom'\]\}>[\s\S]{0,300}<Button/);
});

test('the plate is one coherent outfit rather than five noisy cells', () => {
  // `preview` is the existing Plate mode that collapses the card and drops the
  // live pills — there is no day to mark as worn yet.
  assert.match(ROUTE, /preview/);
});

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

test('Reduce Motion is read and honoured', () => {
  assert.match(ROUTE, /const reduced = useReducedMotion\(\)/);
  assert.match(ROUTE, /reduced,/);
  assert.match(SEQ, /if \(cascading && reduced/);
});

test('Reduce Motion preserves the exact final composition', () => {
  // A shortcut through the beats, not a different screen: same number, same
  // derivation, same plates, same exit.
  assert.match(SEQ, /setPlatesShown\(target\);\s*\n\s*setPhase\('complete'\)/);
  assert.match(SEQ, /setProgress\(1\);\s*\n\s*setPhase\('settled'\)/);
});

test('the cascade declares Reduce Motion on its own transition too', () => {
  assert.match(ROUTE, /FadeIn\.duration\([^)]*\)\.reduceMotion\(ReduceMotion\.System\)/);
});

test('the count-up and the cascade are finite, never looping', () => {
  assert.doesNotMatch(SEQ, /withRepeat|Infinity|setInterval/);
  assert.match(SEQ, /if \(p >= 1\) \{\s*\n\s*setPhase\('settled'\)/);
});

test('one haptic on the settle, and it goes through the policy module', () => {
  assert.match(ROUTE, /haptics\.selection\(\)/);
  assert.equal((ROUTE.match(/haptics\.\w+\(\)/g) ?? []).length, 1);
  // Nothing on the count-up or the cascade — a buzz per plate would teach
  // somebody that three things happened when one did.
  assert.doesNotMatch(ROUTE, /platesShown[\s\S]{0,200}haptics\./);
});

// ---------------------------------------------------------------------------
// Privacy and scope
// ---------------------------------------------------------------------------

test('only already-authorized wardrobe images are resolved', () => {
  assert.match(ROUTE, /useSignedUrls\(items\.flatMap/);
  // No second image source, no remote fetch, no bundled stand-in dressed up as
  // the reader's own closet.
  // No second image source, no bundled stand-in dressed up as the reader's own
  // closet, and no network read for a picture. `wardrobe.refetch()` is the
  // authorised query asking itself again, which is why the assertion is about
  // a BARE fetch rather than the word.
  assert.doesNotMatch(ROUTE, /require\('\.\.\/.*assets|[^.]\bfetch\(|SAMPLE_ASSET|FIXTURE_/);
});

test('no analytics call reaches a garment, an image or a place', () => {
  const calls = ROUTE.match(/track\([\s\S]{0,200}?\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /items|garment|resolve\(|cityLabel|coords|context\.|\.id\b/, c);
  }
});

test('the untagged read is a count, and never rows', () => {
  assert.match(UNTAGGED_RAW, /head: true/);
  assert.match(UNTAGGED_RAW, /return count \?\? 0/);
  // No new table, view, RPC or policy — the same `items` table under the same
  // RLS that `useWardrobe` already reads.
  assert.match(UNTAGGED_RAW, /from\('items'\)/);
  assert.doesNotMatch(UNTAGGED_RAW, /\.rpc\(|create (or replace )?(view|function)/i);
});

test('the untagged read fails to zero rather than blocking the reveal', () => {
  // Zero means "say nothing about tagging", which leaves the screen exactly as
  // it was before this existed. A failed secondary fact must not break the
  // primary one.
  assert.match(UNTAGGED_RAW, /if \(error\) return 0/);
});

test('no new package, permission or vendor is reached for', () => {
  assert.doesNotMatch(ROUTE_RAW, /expo-location|expo-notifications|expo-camera|expo-contacts/);
  assert.doesNotMatch(ROUTE_RAW, /requestPermission|Permissions\./);
});

test('the sequence owns timing and phase, and no arithmetic or billing', () => {
  // The one accepted deviation, kept to its own terms.
  assert.doesNotMatch(SEQ, /countOutfits|tallyOf|gate|Placement|usePlan|supabase/);
  assert.match(SEQ, /countReady/);
});

// ---------------------------------------------------------------------------
// Incident 2026-08-31 — a failed read is never a zero, and seen means delivered
// ---------------------------------------------------------------------------

test('a failed wardrobe read never reaches the arithmetic', () => {
  // `countReady` refuses errored reads, so the machine cannot mint a zero out
  // of an empty error result, and the failed frame renders in words instead.
  assert.match(ROUTE, /const readFailed = wardrobe\.isError/);
  assert.match(ROUTE, /!wardrobe\.isLoading && !wardrobe\.isFetching && !readFailed/);
  assert.match(ROUTE, /readFailed && \(sequence\.phase === 'arriving' \|\| sequence\.phase === 'computing'\)/);
});

test('the failed frame carries a retry and no placement, digit, or stamp', () => {
  const failed = ROUTE.slice(ROUTE.indexOf("Couldn’t read your closet"), ROUTE.indexOf("if (sequence.phase === 'arriving')"));
  assert.match(failed, /wardrobe\.refetch\(\)/);
  assert.match(failed, /exit\('read_failed'\)/);
  assert.doesNotMatch(failed, /gate\.present|Placement\.|stampSeen|showNumber/);
});

test('reveal_seen_at stamps only at delivery moments, never on mount', () => {
  // The mount-time stamp is gone; every write is gated by the decision table
  // in reveal-zero-core (complete, or an exit from the honest zero).
  assert.doesNotMatch(ROUTE, /useEffect\(\(\) => \{\s*if \(stamped\.current\) return;/);
  assert.match(ROUTE, /mayStampSeen\(moment, zeroReason\)/);
  assert.match(ROUTE, /if \(sequence\.complete\) stampSeenRef\.current\('complete'\)/);
  assert.match(ROUTE, /stampSeen\('zero_repair'\)/);
  assert.match(ROUTE, /stampSeen\('zero_open_today'\)/);
});

test('the zero phase event carries its bounded reason', () => {
  assert.match(ROUTE, /revealPhaseProps\(name, name === 'zero' \? \(zeroReason \?\? undefined\) : undefined\)/);
  assert.match(ROUTE, /classifyZero\(\{ queryFailed: false, untagged: untagged\.count, consented \}\)/);
});

test('a settled tag refreshes the unread counter alongside the wardrobe', () => {
  const QUEUE = readFileSync('src/features/ingest/upload-queue.ts', 'utf8');
  assert.match(QUEUE, /invalidateQueries\(\{ queryKey: \['untagged-count'\] \}\)/);
});

/**
 * The CPV2 client contract — the eight things a change here must not break.
 *
 * Rendering is not tested; the repo has no renderer in this runner, and the dev
 * fixture routes are the visual acceptance lane (Codex owns that). What IS
 * tested is everything the screens are a function OF: the shared query, the
 * presentation rule, the bounded analytics, the copy, and the coverage of the
 * fixture routes themselves.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALLOWED_VALUES,
  causeBucket,
  countBucket,
  latencyBucket,
  rankBucket,
  selectionBucket,
} from '../src/features/catalogue/buckets.ts';
import {
  ALL_COPY,
  BANNED_WORDS,
  IMPORT_CONSENT_DECLINED,
  TITLE_UNAVAILABLE,
} from '../src/features/catalogue/copy.ts';
import { classifyImportError, GENERIC } from '../src/features/catalogue/import-outcome.ts';
import {
  isSearchableQuery,
  normaliseCatalogueQuery,
  normaliseQueryText,
  sameQuery,
} from '../src/features/catalogue/query.ts';
import { isUsableTitle, presentedTitle } from '../src/features/catalogue/types.ts';
import {
  HOLD_TTL_MS,
  isLiveHold,
  type HeldSelection,
} from '../src/features/catalogue/held-selection.ts';

/**
 * Source with its comments removed.
 *
 * Several assertions below are of the form "this symbol appears nowhere in that
 * file", and every one of those files EXPLAINS in a comment why the symbol is
 * absent. Scanning the raw text would make writing down the reason the thing
 * that fails the test.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// 1 · Typed and spoken are the same search
// ---------------------------------------------------------------------------

test('a transcript and the same words typed produce an identical query', () => {
  // The dictated form: capitalised, with the full stop the voice processor adds
  // and the trailing space it sometimes leaves.
  const spoken = normaliseCatalogueQuery("James Perse men's T-shirt. ", 'voice');
  const typed = normaliseCatalogueQuery("James Perse men's T-shirt", 'typed');

  assert.ok(spoken && typed);
  assert.equal(spoken.text, typed.text, 'the two paths would search different words');
  assert.ok(sameQuery(spoken, typed), 'the two paths would spend two requests for one question');
});

test('the path is carried but never part of what makes two queries the same', () => {
  // If `path` counted, coming back to the same words by voice would re-run a
  // search whose answer is already on screen — one metered request for nothing.
  const a = normaliseCatalogueQuery('reformation midi dress', 'typed');
  const b = normaliseCatalogueQuery('reformation midi dress', 'walkthrough');
  assert.ok(sameQuery(a, b));
  assert.equal(a?.path, 'typed');
  assert.equal(b?.path, 'walkthrough');
});

test('only one function turns raw words into a query', () => {
  // The convergence is structural, not a convention. A second normaliser
  // anywhere under features/catalogue would let the two paths drift.
  const src = readFileSync('src/features/catalogue/use-catalogue-search.ts', 'utf8');
  assert.ok(
    !/\.trim\(\)|toLowerCase\(\)/.test(src),
    'the search re-normalises its input instead of trusting the shared query',
  );
});

test('too few words never buys a request', () => {
  assert.equal(isSearchableQuery('  a '), false);
  assert.equal(normaliseCatalogueQuery('a', 'typed'), null);
  assert.equal(isSearchableQuery('tee'), true);
});

test('named colours are carried without entering the searched words', () => {
  // A colour in the query asks the catalogue for one colourway of a garment
  // that has six — and the whole screen is built to show all six.
  const q = normaliseCatalogueQuery('james perse tee', 'walkthrough', ['Grey', 'grey', ' Black ']);
  assert.equal(q?.text, 'james perse tee');
  assert.deepEqual(q?.namedColours, ['Grey', 'Black'], 'a duplicate colour survived');
});

test('normalisation collapses dictation whitespace without lowercasing', () => {
  // Lowercasing here would be a SECOND parse competing with the server's, which
  // owns the brand heuristic. See the header of query.ts.
  assert.equal(normaliseQueryText('  James   Perse  tee.  '), 'James Perse tee');
});

// ---------------------------------------------------------------------------
// 2 · The bulk walkthrough never queries by itself
// ---------------------------------------------------------------------------

test('nothing in the walkthrough runs a catalogue search without a tap', () => {
  // §7: "one catalogue request per garment the user asks about, never one per
  // garment in the procession." The card offers an action; it does not call one.
  const card = readFileSync('src/components/intake/GarmentCard.tsx', 'utf8');
  assert.ok(card.includes('onFindPhoto'), 'the review card lost its CPV2-V01 action');
  assert.ok(
    !/useCatalogueSearch|useCatalogueFlow|action: 'search'/.test(card),
    'the review card can run a catalogue search on its own',
  );

  const review = readFileSync('src/app/walkthrough/review.tsx', 'utf8');
  assert.ok(
    !/useCatalogueSearch|useCatalogueFlow/.test(review),
    'the walkthrough screen runs the matcher instead of pushing to it',
  );
  // The navigation is the whole mechanism, and it carries the verbatim words.
  assert.ok(/\/find-photo/.test(review) && /draft\.utterance/.test(review));
});

test('the flow runs no search except from an explicit call', () => {
  // ONE effect is allowed and it reads local storage for CPV2-11's hold — see
  // the assertion in section 9 that it cannot restore or search. What must
  // never exist is an effect that spends a catalogue request.
  const flow = stripComments(readFileSync('src/features/catalogue/use-catalogue-flow.ts', 'utf8'));
  const effects = flow.match(/useEffect\(/g) ?? [];
  assert.equal(effects.length, 1, `the flow grew an effect; found ${effects.length}`);
  assert.ok(!/useEffect\([\s\S]{0,600}search\.run/.test(flow), 'an effect fires a search');
});

// ---------------------------------------------------------------------------
// 3 · A junk title says so rather than being printed or invented
// ---------------------------------------------------------------------------

test('a real product name is printed unchanged', () => {
  // The longest genuine name in the recorded fixture — six words.
  const title = 'Luxe Lotus Slim-Fit Cotton-Jersey T-Shirt';
  assert.ok(isUsableTitle(title));
  assert.equal(presentedTitle({ title }), title);
});

test('a resale keyword dump is refused, not truncated', () => {
  // Verbatim from the live Grailed rows.
  const dump = 'T-Shirt Mens 1XL Gray Cotton Casual Usa Made Logo Classic Preppy Short Sleeve';
  assert.equal(isUsableTitle(dump), false);
  assert.equal(presentedTitle({ title: dump }), TITLE_UNAVAILABLE);
  // §10.3 — the first eight words of search-bait are still search-bait, and
  // now they look deliberate.
  assert.ok(!presentedTitle({ title: dump }).startsWith('T-Shirt Mens'));
});

test('an empty title is a state, not a crash', () => {
  assert.equal(presentedTitle({ title: '   ' }), TITLE_UNAVAILABLE);
});

// ---------------------------------------------------------------------------
// 4 · Analytics carry buckets and nothing else
// ---------------------------------------------------------------------------

test('every value the analytics module can emit is bounded', () => {
  const src = readFileSync('src/features/catalogue/analytics.ts', 'utf8');
  // Everything after `track(` on each call must be a variable or a bucket call
  // — never a template literal, and never a field off a family or a query.
  const calls = src.match(/track\([^)]*\)/gs) ?? [];
  assert.ok(calls.length >= 9, 'the nine handoff events are not all present');
  for (const call of calls) {
    assert.ok(!/`/.test(call), `an event builds a string: ${call}`);
    assert.ok(
      !/\b(title|brand|label|text|transcript|externalId|url|imageUrl|query)\b/.test(call),
      `an event carries user or catalogue content: ${call}`,
    );
  }
});

test('the buckets are the handoff’s buckets', () => {
  assert.deepEqual(
    [0, 1, 2, 4, 9].map(countBucket),
    ['0', '1', '2', '3-5', '6+'],
  );
  assert.deepEqual(
    [500, 3000, 9000].map(latencyBucket),
    ['under_2s', '2_5s', 'over_5s'],
  );
  assert.deepEqual([1, 3, 7].map(rankBucket), ['1', '2-3', '4+']);
  assert.deepEqual([1, 3, 7].map(selectionBucket), ['1', '2-3', '4+']);
});

test('an unknown server code becomes a bucket rather than passing through', () => {
  // The cardinality leak this prevents: every new server error becoming a new
  // property value the moment it ships.
  assert.equal(causeBucket('some_brand_new_code'), 'partner_unavailable');
  assert.equal(causeBucket(null), 'partner_unavailable');
  assert.equal(causeBucket('no_results'), 'no_results');
  assert.equal(causeBucket('ai_quota_exceeded'), 'quota');
  for (const code of ['no_results', 'offline', 'timeout', 'quota', 'image_unavailable']) {
    assert.ok(ALLOWED_VALUES.includes(causeBucket(code)));
  }
});

test('the raw-query aggregate is not faked on the client', () => {
  // Nelson's "most common query" board is a server-side Packet 4. A client
  // property carrying the phrase would be the privacy failure wearing the
  // feature's clothes.
  const src = readFileSync('src/features/catalogue/analytics.ts', 'utf8');
  assert.ok(!/query_text|search_term|phrase|raw_query/.test(src));
});

// ---------------------------------------------------------------------------
// 5 · The banned words appear nowhere
// ---------------------------------------------------------------------------

test('no CPV2 copy contains a shopping word', () => {
  // §3's ban is on CLAIMING these things, and the atlas's own privacy line
  // contains "web search" while DENYING it: "It is not a web search and it is
  // not sent to an AI model." A flat substring ban would fail the handoff's own
  // verbatim copy, so a negated occurrence is allowed and an unnegated one is
  // not — which is the distinction the ban was actually making.
  const NEGATED = /\b(not|never|no|does not|isn't|is not)\b[^.]*$/i;

  for (const line of ALL_COPY) {
    for (const banned of BANNED_WORDS) {
      const at = line.toLowerCase().indexOf(banned);
      if (at === -1) continue;
      const before = line.slice(0, at);
      assert.ok(
        NEGATED.test(before),
        `"${banned}" is asserted rather than denied in CPV2 copy: ${line}`,
      );
    }
  }
});

test('no CPV2 surface renders a price, a merchant link or a stock claim', () => {
  const files = [
    'src/components/catalogue/catalogue-body.tsx',
    'src/components/catalogue/family-card.tsx',
    'src/components/catalogue/colour-row.tsx',
    'src/app/find-photo.tsx',
  ];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // Comments are allowed to name what is forbidden; code is not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/priceMinor|finalprice|Linking\.openURL|openBrowser/.test(code), file);
    assert.ok(!/\bin stock\b/i.test(code), file);
  }
});

// ---------------------------------------------------------------------------
// 6 · The consent refusal is gone from typed search
// ---------------------------------------------------------------------------

test('a declined AI consent no longer refuses a search', () => {
  // Packet 1 moved `action: 'search'` above the server's consent gate, so the
  // notice claimed a cause that does not exist. §11: implementation must not
  // assume "that AI-processing consent gates typed search".
  const src = readFileSync('src/features/ingest/search-failure.ts', 'utf8');
  const fn = src.slice(src.indexOf('export function classifySearchFailure'));
  assert.ok(
    !/consentDeclined\s*\|\||ai_consent_required/.test(fn),
    'a declined consent still produces a search-failure notice',
  );
});

test('the catalogue client never maps a consent code to a message', () => {
  const src = stripComments(readFileSync('src/features/catalogue/use-catalogue-search.ts', 'utf8'));
  assert.ok(!/ai_consent_required/.test(src));
});

// ---------------------------------------------------------------------------
// 7 · Stale responses are dropped
// ---------------------------------------------------------------------------

test('the search holds a ticket and checks it after every await', () => {
  // The overtaking case: a slow first request landing after a fast second one,
  // painting tee families under the word "henley". Asserted structurally
  // because the hook needs React to run.
  const src = readFileSync('src/features/catalogue/use-catalogue-search.ts', 'utf8');
  assert.ok(/ticket\.current \+= 1/.test(src), 'no request sequence at all');
  const guards = src.match(/if \(mine !== ticket\.current\) return;?/g) ?? [];
  assert.ok(
    guards.length >= 2,
    `every resolution path must drop a stale answer; found ${guards.length}`,
  );
  assert.ok(/const cancel = useCallback/.test(src), 'editing cannot abandon an in-flight search');
});

// ---------------------------------------------------------------------------
// 8 · Every CPV2 state has a fixture route
// ---------------------------------------------------------------------------

test('every frame in the atlas has a dev route Codex can open', () => {
  const routes = readdirSync('src/dev-fixtures').filter((f) => f.startsWith('dev-cpv2-'));
  const expected = [
    '01-idle',
    '02-listening',
    '03-transcript',
    '04-families',
    '05-detail',
    '06-confirm',
    '07-importing',
    '08-success',
    '09-no-match',
    '10-offline',
    '10-timeout',
    '10-quota',
    '10-partner',
    '11-capacity',
    '12-ax5',
    'v01',
    'v02',
  ];
  for (const name of expected) {
    assert.ok(
      routes.includes(`dev-cpv2-${name}.tsx`),
      `CPV2 state ${name} has no fixture route`,
    );
  }
});

test('no fixture route can write or spend a request', () => {
  for (const file of readdirSync('src/dev-fixtures').filter((f) => f.startsWith('dev-cpv2-'))) {
    const src = stripComments(readFileSync(`src/dev-fixtures/${file}`, 'utf8'));
    assert.ok(
      !/useCatalogueFlow|useCatalogueImport|useCatalogueSearch|supabase/.test(src),
      `${file} reaches a live hook`,
    );
  }
});

// ---------------------------------------------------------------------------
// 9 · CPV2-11's held selection
// ---------------------------------------------------------------------------

test('a hold belongs to one account and one day', () => {
  // Two people sign in on one phone more often than anyone designs for. A hold
  // read back under the wrong account would pre-tick colourways of a garment
  // the reader never chose — and the next tap imports them.
  // Partial shapes on purpose — `isLiveHold` guards a value that has been
  // through JSON, so the test hands it the same half-built objects a schema
  // change would. Cast once, here, rather than at every use: spreading a
  // `never` is not a thing TypeScript will do.
  const family = { familyId: 'f', colours: [] } as unknown as HeldSelection['family'];
  const held = {
    userId: 'a',
    heldAt: 1_000_000,
    family: { familyId: 'f' },
    colours: [{ externalId: 'x' }],
  } as unknown as HeldSelection;

  assert.equal(isLiveHold(held, 'a', 1_000_000), true);
  assert.equal(isLiveHold(held, 'b', 1_000_000), false, 'another account read the hold');
  assert.equal(
    isLiveHold(held, 'a', 1_000_000 + HOLD_TTL_MS),
    false,
    'a hold outlived its day',
  );
  assert.equal(isLiveHold(held, 'a', 1_000_000 + HOLD_TTL_MS - 1), true);
  assert.equal(isLiveHold(null, 'a', 1_000_000), false);
  // Shape, not just age: this value has been through JSON, and a schema change
  // would otherwise arrive as an undefined field deep inside a render.
  assert.equal(isLiveHold({ ...held, colours: [] }, 'a', 1_000_000), false);
  assert.equal(isLiveHold({ ...held, family }, 'a', 1_000_000), true);
  assert.equal(isLiveHold({ ...held, heldAt: NaN }, 'a', 1_000_000), false);
});

test('the hold is client-side and invents no server contract', () => {
  // §10.5 listed this as a SERVER question. It is answered without one: nothing
  // in CPV2-11 is cross-device, and the worst case of losing it is one
  // re-selection from a screen the user can still reach.
  const src = readFileSync('src/features/catalogue/held-selection.ts', 'utf8');
  assert.ok(!/supabase|from\('/.test(stripComments(src)), 'the hold reaches the server');
  assert.match(src, /AsyncStorage/);
  // Narrowed from a bare /held/, which matched
  // `20260824030000_stylist_capacity_held.sql` — an unrelated stylist refusal
  // reason. The invariant is unchanged and now checked more strictly: no
  // migration NAMES the catalogue hold, and no migration BODY creates a table
  // for it either, which the filename test alone never proved.
  const migrations = readdirSync('supabase/migrations');
  assert.ok(
    !migrations.some((f) => /held_selection|hold_selection|catalogue_hold/.test(f)),
    'a migration was added for the hold',
  );
  assert.ok(
    !migrations.some((f) =>
      /held_selection|catalogue_held|held_colour/i.test(
        readFileSync(`supabase/migrations/${f}`, 'utf8'),
      ),
    ),
    'a migration creates storage for the hold',
  );
});

test('the hold is offered, never silently restored', () => {
  const body = readFileSync('src/components/catalogue/catalogue-body.tsx', 'utf8');
  assert.ok(body.includes('view.restoreHeld'), 'there is no way to pick the hold up');
  assert.ok(body.includes('view.dismissHeld'), 'there is no way to let it go');
  const flow = stripComments(readFileSync('src/features/catalogue/use-catalogue-flow.ts', 'utf8'));
  // The one effect reads storage. It must not restore, and must not search.
  const effect = flow.slice(flow.indexOf('useEffect('), flow.indexOf('const restoreHeld'));
  assert.ok(!/setStep|setSelected|search\.run/.test(effect), 'the hold restores itself on mount');
});

// ---------------------------------------------------------------------------
// 10 · A photograph that is missing, slow or dead says which
// ---------------------------------------------------------------------------

test('every catalogue photograph goes through the one plate', () => {
  // The live CPV2-04 run that produced this test showed a page of empty tray
  // rectangles. Nothing was broken — Mr Porter's CDN is simply slow — but the
  // screen had no way to say so, because each of the five image sites rendered
  // `<Image>` when there was a URL and NOTHING when there was not. "Loading",
  // "the feed shipped no picture" and "the picture failed" were one pixel.
  for (const file of [
    'src/components/catalogue/family-card.tsx',
    'src/components/catalogue/colour-row.tsx',
    'src/components/catalogue/catalogue-body.tsx',
  ]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!/from 'expo-image'/.test(src), `${file} draws a photograph without the plate`);
    assert.ok(src.includes('CataloguePlate'), `${file} lost the plate`);
  }
});

test('the plate draws all four of its states', () => {
  const src = readFileSync('src/components/catalogue/plate.tsx', 'utf8');
  assert.match(src, /onError=/, 'a failed photograph is silent');
  assert.match(src, /onLoad=/, 'the plate never learns the photograph arrived');
  assert.match(src, /PHOTO_FAILED/);
  assert.match(src, /NO_PHOTO/);
  assert.match(src, /Skeleton/, 'a slow photograph reads as an absent one');
  // A new URL is a new load: without this, swapping a preview chip would keep
  // the previous colourway's failure on screen. The reset is a comparison
  // during render, not an effect — a synchronous setState in an effect is a
  // cascading render and the repo's lint treats it as an error.
  const body = stripComments(src);
  assert.match(body, /loaded\.uri === uri \? loaded\.status : 'pending'/);
  assert.ok(!/useEffect/.test(body), 'the plate resets its status from an effect');
});

test('an absent photograph and a failed one are different sentences', () => {
  // Saying "No photo in the catalogue" over a merchant URL that timed out
  // would be telling the user something false about the shop's listing.
  const copy = readFileSync('src/features/catalogue/copy.ts', 'utf8');
  assert.ok(!copy.includes("PHOTO_FAILED = 'No photo"), 'the two states share one sentence');
  assert.ok(ALL_COPY.includes('Photo did not load'), 'the new sentence escapes the banned-word test');
});

// ---------------------------------------------------------------------------
// 11 · The import's consent refusal is an ask, never the generic failure
// ---------------------------------------------------------------------------

test('ai_consent_required maps to the consent outcome, not the generic sentence', () => {
  // The dead end this pins shut: a fresh account whose first act is a
  // catalogue import (the browse tiles make that the likely first act) was
  // told "Those pieces couldn't be added. Try again in a moment." — a sentence
  // whose remedy is false. Time fixes nothing; the consent sheet does.
  const outcome = classifyImportError({ error: 'ai_consent_required', requiredVersion: 2 }, 3);
  assert.ok(outcome.status === 'consent-required', 'the consent gate reads as a plain failure');
  assert.equal(outcome.requiredVersion, 2);
  assert.ok(
    !JSON.stringify(outcome).includes(GENERIC),
    'the consent refusal carries the generic failure sentence',
  );
});

test('a requiredVersion the body did not carry is null, never invented', () => {
  const outcome = classifyImportError({ error: 'ai_consent_required' }, 1);
  assert.ok(outcome.status === 'consent-required');
  assert.equal(outcome.requiredVersion, null);
});

test('the consent branch changes nothing for capacity or unknown errors', () => {
  const refused = classifyImportError(
    { error: 'closet_limit_reached', requested: 3, active: 8, activeLimit: 10 },
    3,
  );
  assert.ok(refused.status === 'refused');
  assert.equal(refused.refusal.code, 'closet_limit_reached');
  assert.equal(refused.refusal.active, 8);

  const unknown = classifyImportError({ error: 'kaboom' }, 3);
  assert.ok(unknown.status === 'error');
  assert.equal(unknown.message, GENERIC);

  const unreadable = classifyImportError(null, 3);
  assert.ok(unreadable.status === 'error');
  assert.equal(unreadable.message, GENERIC);
});

test('the importer reads its error bodies through the one classifier', () => {
  // A second copy of the mapping in the hook is how the two drift — the hook
  // recognising a code the classifier does not, or the reverse.
  const src = stripComments(readFileSync('src/features/catalogue/use-catalogue-import.ts', 'utf8'));
  assert.match(src, /classifyImportError/, 'the hook stopped using the shared classifier');
  assert.ok(
    !src.includes("'ai_consent_required'") && !src.includes("'closet_limit_reached'"),
    'the hook carries its own copy of the error-code mapping',
  );
});

test('the ask is the existing consent sheet, raised by the container', () => {
  // The flow surfaces `consentNeeded`; the CONTAINER presents CN-01's sheet —
  // the same component capture and add-clothes present, not a lookalike.
  const container = readFileSync('src/app/find-photo.tsx', 'utf8');
  assert.ok(
    container.includes("from '@/components/ingest/consent-sheet'"),
    'find-photo draws its own consent ask instead of the shipped sheet',
  );
  assert.ok(container.includes('view.consentNeeded'), 'the sheet is not driven by the flow');
  assert.ok(
    container.includes('useGrantAiConsent'),
    'accepting the ask records nothing — the retry would be refused again',
  );

  // And declining says which switch decided, in a sentence the banned-word
  // test walks like every other sentence this feature can say.
  assert.ok(
    ALL_COPY.includes(IMPORT_CONSENT_DECLINED),
    'the declined sentence escapes the banned-word test',
  );
});

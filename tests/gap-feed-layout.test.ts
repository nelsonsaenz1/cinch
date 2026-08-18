/**
 * Redesign 26 — the Gap Feed and its shop, as assertions.
 *
 * Two kinds of test, on the split `storage-layout.test.ts` and
 * `voice-walkthrough-layout.test.ts` use.
 *
 * The FIRST reads `gap-feed-spec.ts`, which is pure data and pure functions,
 * and pins the decisions the screen makes before it draws: which rank word,
 * which noun goes in the marked absence, and what the masthead says when a
 * ceiling is in play.
 *
 * The SECOND reads SOURCE TEXT, which is normally the wrong way to test a UI
 * and is the right way for the properties this page is under LAW about. This
 * screen touches money and it touches privacy, so the assertions worth having
 * are not "does it render" — they are:
 *
 *   · No affiliate URL is constructed anywhere in the app bundle, and no
 *     per-user parameter (clickref, u1, SubID…) appears on this side of the
 *     wire at all. The link arrives decided; the client only opens it.
 *   · The merchant allowlist and the tracking-URL builder are SERVER files and
 *     this wave did not touch them — pinned as byte content, so a future edit
 *     to either has to come with a deliberate change to this test.
 *   · The commission sentence is still rendered whenever a paid row can be on
 *     screen. The artifact's own tray frames omit it; the build refuses, and a
 *     refusal that is not tested is a comment.
 *   · No `fontWeight` and no bold class reaches the redesigned components. The
 *     artifact sets six things in bold; the app has two cuts and neither is
 *     Medium (TY-01 / TY-02).
 *
 * `run-tests.mjs` has no React renderer by design; these are the assertions
 * that survive that, and they are the ones that were otherwise going to be
 * checked by eye once and then never again.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PAID_LINK_LABEL, commissionSentence } from '../src/features/commerce/copy';
import {
  ABSENCE,
  CARD,
  FEED_CARDS,
  GAP_FEED_COPY,
  MAX_MERCHANT_ROWS,
  MERCHANT_ROW,
  TILE,
  TYPE,
  absenceNoun,
  mastheadLine,
  rankEyebrow,
} from '../src/features/closet/gap-feed-spec';

const read = (p: string) => readFileSync(p, 'utf8');

/** Source with comments stripped, so a sentence quoted in a note is not a hit. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const FEED = 'src/app/gap-feed.tsx';
const DETAIL = 'src/app/gap-feed/[kind].tsx';
const PARTS = 'src/components/gap-feed/gap-feed-parts.tsx';
const SHOP_ROW = 'src/components/gap-feed/shop-row.tsx';
const PRODUCT_SHEET = 'src/components/gap-feed/product-sheet.tsx';
const LIMIT_FOOTER = 'src/components/gap-feed/limit-footer.tsx';
const SPEC = 'src/features/closet/gap-feed-spec.ts';
const COMMERCE_COPY = 'src/features/commerce/copy.ts';

/** Every file this redesign drew. */
const DRAWN = [FEED, DETAIL, PARTS, SHOP_ROW, PRODUCT_SHEET, LIMIT_FOOTER] as const;

// ---------------------------------------------------------------------------
// The decisions
// ---------------------------------------------------------------------------

test('the rank eyebrow is words, and answers past the third card', () => {
  assert.equal(rankEyebrow(0), 'Biggest gap');
  assert.equal(rankEyebrow(1), 'Second gap');
  assert.equal(rankEyebrow(2), 'Third gap');
  // The detail route takes its kind from the URL and can be opened on a gap the
  // feed did not list — that must be a word, not a crash and not "undefined".
  assert.equal(rankEyebrow(3), 'A gap');
  assert.equal(rankEyebrow(-1), 'A gap');
});

test('the marked absence says "shoes", never "pair of shoes"', () => {
  // The sentence still says "a pair of shoes"; the 100pt well says "shoes".
  // Neither is wrong about the same garment, and only one of them fits.
  assert.equal(absenceNoun('shoes'), 'shoes');
  assert.equal(absenceNoun('tops'), 'top');
  assert.equal(absenceNoun('bottoms'), 'bottom');
  assert.equal(absenceNoun('dresses'), 'dress');
});

test('the masthead counts the cards actually drawn', () => {
  assert.equal(
    mastheadLine({ activeFull: false, totalFull: false, cards: 1 }),
    'One gap, computed from what you own.',
  );
  assert.equal(
    mastheadLine({ activeFull: false, totalFull: false, cards: 2 }),
    'Two gaps, computed from what you own.',
  );
  assert.equal(
    mastheadLine({ activeFull: false, totalFull: false, cards: 3 }),
    'Three gaps, computed from what you own.',
  );
});

test('the TOTAL ceiling wins the masthead when both are hit', () => {
  // Storing frees an ACTIVE place and moves the total by nothing, so a screen
  // at both limits must not be told that swapping is the way out.
  const both = mastheadLine({ activeFull: true, totalFull: true, cards: 3 });
  assert.match(both, /stored pieces included/);
  assert.doesNotMatch(both, /swapping/i);

  assert.match(
    mastheadLine({ activeFull: true, totalFull: false, cards: 3 }),
    /active shelf is full/,
  );
});

test('the masthead never claims the wear log was consulted', () => {
  // `rankGaps` reads the tally only. A sentence saying otherwise would be a
  // claim about how the advice was produced, which is the one thing this screen
  // cannot get wrong.
  for (const cards of [1, 2, 3]) {
    const line = mastheadLine({ activeFull: false, totalFull: false, cards });
    assert.doesNotMatch(line, /wear|worn|actually wear/i);
  }
});

test('the empty state prints the real piece count, never a spelled one', () => {
  assert.match(GAP_FEED_COPY.empty.body(4), /With 4 pieces/);
  assert.match(GAP_FEED_COPY.empty.body(1), /With one piece/);
  // The artifact spells it ("With four pieces"). A spelled number is a TYPED
  // number: it cannot follow the closet, so the day the count moves the
  // sentence quietly starts lying.
  assert.doesNotMatch(GAP_FEED_COPY.empty.body(4), /four/);
});

test('the read-error copy leads with what did NOT happen', () => {
  assert.match(GAP_FEED_COPY.readError.body, /Nothing has changed/);
  assert.match(GAP_FEED_COPY.readError.body, /safe on the server/);
  // Never the empty state's words: this is the screen somebody opens to check
  // their pieces are still there.
  assert.doesNotMatch(GAP_FEED_COPY.readError.body, /empty|nothing to suggest/i);
});

test('the scroll hint counts what is actually below it', () => {
  assert.equal(GAP_FEED_COPY.scrollHint(1), 'Scroll for the second gap');
  assert.equal(GAP_FEED_COPY.scrollHint(2), 'Scroll for the second and third gap');
});

test('an outfit row caption names every real garment in it', () => {
  assert.equal(GAP_FEED_COPY.detail.rowCaption(['camel coat']), 'With the camel coat');
  assert.equal(
    GAP_FEED_COPY.detail.rowCaption(['camel coat', 'stone trousers']),
    'With the camel coat and the stone trousers',
  );
});

test('a cancelled paywall is a decision, not a failure', () => {
  assert.match(GAP_FEED_COPY.detail.cancelled, /Nothing changed/);
  assert.doesNotMatch(GAP_FEED_COPY.detail.cancelled, /failed|error|sorry|problem/i);
});

// ---------------------------------------------------------------------------
// Money. The link, and the claim.
// ---------------------------------------------------------------------------

/**
 * The two server files that decide what a click is and who may be in it. This
 * wave restyled the screens above them and touched neither, which is a fact
 * about their CONTENT — so it is asserted about their content.
 */
const SERVER_COMMERCE = 'supabase/functions/_shared/commerce.ts';
const SERVER_MERCHANTS = 'supabase/functions/_shared/merchants.ts';

test('the tracking-URL builder still refuses every per-click identity field', () => {
  const source = read(SERVER_COMMERCE);

  // Awin's clickref family and Rakuten's u1 are the fields both networks offer
  // for exactly the attribution being refused. They appear in this file ONLY in
  // its header, explaining that their absence is a decision.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const field of ['clickref', 'clickref2', 'u1', 'pref1', 'subid', 'sid']) {
    assert.doesNotMatch(
      stripped,
      new RegExp(`['"\`]${field}['"\`]`, 'i'),
      `${field} appears in executable code in ${SERVER_COMMERCE}`,
    );
  }

  // The four parameters each network's URL is allowed to carry, and no fifth.
  const setCalls = [...stripped.matchAll(/searchParams\.set\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(setCalls.sort(), ['awinaffid', 'awinmid', 'id', 'mid', 'murl', 'ued'].sort());
});

test('nothing in the app bundle constructs an affiliate link', () => {
  // The whole of the client's job is to open a URL the edge function already
  // decided. A redirector hostname, a publisher id or a `@@@` substitution
  // appearing on this side would mean the link was being built where the user's
  // session lives — which is precisely how identity leaks onto a click.
  for (const file of DRAWN) {
    const source = code(file);
    for (const marker of [
      'awin1.com',
      'linksynergy',
      'anrdoezrs',
      'awinaffid',
      'awinmid',
      '@@@',
      'AWIN_PUBLISHER_ID',
      'RAKUTEN_TRACKING_ID',
      'clickref',
      'SubID',
    ]) {
      assert.ok(
        !source.includes(marker),
        `${file} names ${marker}; affiliate links are built server-side and never here`,
      );
    }
  }
});

test('the only thing the client does with a link is open it, unmodified', () => {
  const sheet = code(PRODUCT_SHEET);
  assert.match(sheet, /Linking\.openURL\(product\.url\)/);
  // No template literal, no concatenation, no query juggling around that url.
  assert.doesNotMatch(sheet, /product\.url\s*\+/);
  assert.doesNotMatch(sheet, /\$\{product\.url\}/);
  assert.doesNotMatch(sheet, /new URL\(/);
});

test('the merchant allowlist is a server file and this wave did not draw it', () => {
  // A screen that could widen the allowlist is a screen that could put an
  // unvetted shop in front of somebody. It lives on the other side of the wire
  // and nothing above imports it.
  const allowlist = read(SERVER_MERCHANTS);
  assert.ok(allowlist.length > 0);

  for (const file of DRAWN) {
    const source = code(file);
    assert.ok(
      !/_shared\/merchants/.test(source),
      `${file} reaches for the merchant allowlist, which is the server's`,
    );
    assert.ok(
      !/allowlist|allowedMerchants|MERCHANT_ALLOWLIST/i.test(source),
      `${file} names an allowlist; the decision is not the client's to hold`,
    );
  }
});

test('the commission sentence survives the artifact omitting it', () => {
  // The tray frames end after the last merchant row. The sentence is a
  // disclosure and it stays — this asserts the component still calls for it,
  // in both the standard and the largest-type forms.
  const tray = code(SHOP_ROW);
  assert.match(tray, /commissionSentence\(paidCount\)/);
  assert.match(tray, /commissionSentenceShort\(paidCount\)/);
  assert.match(tray, /\{commission\}/);

  // And that the function it calls still names all three things.
  const sentence = commissionSentence(1)!;
  for (const clause of ['the gap', 'the match', 'the order']) {
    assert.ok(sentence.includes(clause), `commission sentence dropped "${clause}"`);
  }
});

test('the tray carries no block-level disclosure marker', () => {
  const tray = code(SHOP_ROW);

  // Every `PAID_LINK_LABEL` in this file is either the import or the
  // consequent of a `product.paid ?` branch. Counting is what a block-level
  // marker cannot survive: it would add an occurrence answerable to no row.
  const sites = [...tray.matchAll(/PAID_LINK_LABEL/g)];
  const imports = sites.filter((m) => /^\s*PAID_LINK_LABEL,\s*$/m.test(
    tray.slice(tray.lastIndexOf('\n', m.index!) + 1, tray.indexOf('\n', m.index!)),
  ));
  assert.equal(imports.length, 1, 'the marker is imported exactly once');

  const uses = sites.filter((m) => !imports.includes(m));
  // Three: the spoken VoiceOver label, the standard row's marker, the AX row's.
  assert.equal(uses.length, 3, 'the marker appears somewhere new — check what guards it');

  for (const use of uses) {
    // Every one of them is downstream of a `product.paid` test within the same
    // expression. A block-level marker is by definition one that is not.
    const preceding = tray.slice(Math.max(0, use.index! - 420), use.index!);
    assert.ok(
      /product\.paid \?/.test(preceding),
      `a PAID_LINK_LABEL at ${use.index} is not guarded by product.paid — a block-level marker`,
    );
  }

  // The tray's own eyebrow says what the block IS, and claims nothing about
  // money in either direction.
  assert.doesNotMatch(GAP_FEED_COPY.title, /paid|commission|sponsor/i);
  const eyebrow = read(COMMERCE_COPY).match(/BUY_CLAUSE = '([^']+)'/)?.[1];
  assert.ok(eyebrow);
  assert.doesNotMatch(eyebrow!, /paid|commission|sponsor|ad\b/i);
});

test('the disclosure is never set in a colour that fails contrast', () => {
  // §6 refusal 8 — never abbreviated, greyed, or hidden behind an icon. The
  // artifact sets the marker in `accentWarm` (~2.9:1 on white), which is
  // greying it by another name. `muted` is what ships.
  const tray = code(SHOP_ROW);
  const markerBlocks = tray.split('PAID_LINK_LABEL').slice(1, -1);
  for (const block of markerBlocks) {
    assert.ok(
      !/accentWarm|faint|byline|ghost/.test(block.slice(-320)),
      'the paid-link marker is set in a tone that fails AA',
    );
  }
  assert.equal(PAID_LINK_LABEL, 'Paid link');
});

test('the capacity footer offers no paywall, and its figures are arguments', () => {
  const footer = code(LIMIT_FOOTER);
  // The artifact's "See plans" is not adopted here: the placement fires from
  // the gap DETAIL exactly as shipped, and a second trigger on the feed would
  // not be "as shipped".
  assert.ok(!/See plans/.test(footer), 'a paywall door appeared on the feed');
  assert.ok(!/Placement\./.test(footer));
  assert.ok(!/useGate/.test(footer));
  // Every number in the headline is a parameter.
  assert.match(footer, /\$\{limit\} active pieces/);
  assert.match(footer, /\$\{used\} of \$\{limit\} total pieces/);
});

test('the See-plans placement on the detail is unchanged — key, trigger, routing', () => {
  const detail = code(DETAIL);
  // The one placement, presented by the one sheet, reached by the one button.
  assert.match(detail, /gate\.present\(Placement\.AddGarmentOverLimit\)/);
  assert.equal([...detail.matchAll(/Placement\./g)].length, 1);
  assert.equal([...detail.matchAll(/gate\.present\(/g)].length, 1);
  // The button sets `locked`; the SHEET calls `seePlans`. A button wired
  // straight to the gate would be a different trigger wearing the same label.
  assert.match(detail, /onPress=\{\(\) => setLocked\(true\)\}/);
  assert.match(detail, /onSeePlans=\{seePlans\}/);
});

// ---------------------------------------------------------------------------
// The dialect
// ---------------------------------------------------------------------------

test('no weight reaches any redesigned component', () => {
  // The artifact sets merchant titles, actions, notice headlines and the error
  // title in bold. There are two cuts and neither is Medium (TY-01 / TY-02);
  // the emphasis is carried by size, colour and case instead.
  for (const file of DRAWN) {
    const source = code(file);
    assert.ok(!/fontWeight/.test(source), `${file} declares a fontWeight`);
    assert.ok(!/font-(bold|semibold|medium)/.test(source), `${file} uses a weight class`);
  }
});

test('no accent is spent on a purchase', () => {
  // "Open" is ink on a joined row and ink on a direct one; the sheet's one
  // filled action is `ink`. The oxblood on this page belongs to the eyebrows,
  // the marked absence and the exit that buys nothing.
  const tray = code(SHOP_ROW);
  const actionBlock = tray.slice(tray.indexOf('{action}') - 400, tray.indexOf('{action}'));
  assert.ok(!/theme\.accent/.test(actionBlock), 'the merchant action is drawn in the accent');

  const sheet = code(PRODUCT_SHEET);
  assert.match(sheet, /variant="ink"/);
  assert.ok(!/variant="primary"/.test(sheet), 'the sheet spends oxblood on a purchase');
});

test('the marked absence is drawn, never sourced', () => {
  const parts = code(PARTS);
  const start = parts.indexOf('export function AbsenceWell');
  const end = parts.indexOf('export function GapImagery');
  const well = parts.slice(start, end);

  assert.ok(start >= 0 && end > start);
  // No image of any kind inside the well that stands for a garment nobody owns.
  assert.ok(!/GarmentImage|<Image|source=|uri/.test(well), 'the absence well sources a picture');
  assert.match(well, /borderStyle: 'dashed'/);
  // And it is set in the accent, not the clay the artifact draws — 2.6:1 on
  // blush fails AA, and this is real content rather than a garnish.
  assert.match(well, /theme\.accent/);
  assert.ok(!/accentWarm/.test(well));
});

test('a missing photograph is a designed cell everywhere it can happen', () => {
  // One fact, one treatment: the owned well, the merchant thumbnail and the
  // sheet's picture all fall back to the same words through the same component.
  for (const file of [PARTS, SHOP_ROW, PRODUCT_SHEET]) {
    const source = code(file);
    assert.match(source, /GarmentImage/, `${file} draws a picture without the shared fallback`);
    assert.match(source, /GAP_FEED_COPY\.noPhoto/, `${file} has a well with no designed fallback`);
  }
  assert.equal(GAP_FEED_COPY.noPhoto, 'No photo');
});

test('every tap target on the page clears 44pt', () => {
  const parts = code(PARTS);
  const tray = code(SHOP_ROW);
  const sheet = code(PRODUCT_SHEET);

  assert.match(parts, /minHeight: MIN_TAP_TARGET/);
  assert.match(tray, /minHeight: MIN_TAP_TARGET \+ 12/);
  assert.match(sheet, /minHeight: MIN_TAP_TARGET/);
  // The AX merchant action is its own 48pt block.
  assert.ok(MERCHANT_ROW.axActionHeight >= 44);
});

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

test('three wells fit the card at the page gutter', () => {
  // 393pt device, 20pt gutter each side, 18pt card padding each side, 8pt
  // between wells. If this stops being true the row wraps and the composition
  // — two you own, one you do not — silently becomes a list.
  const inner = 393 - 2 * 20 - 2 * CARD.padding;
  const used = TILE.size * 3 + TILE.gap * 2;
  assert.ok(used <= inner + 1, `three wells need ${used}pt and have ${inner}pt`);
  assert.ok(used > inner - 6, 'the wells no longer fill the card');
});

test('the feed and the tray agree about three', () => {
  // C-01's cap on merchants and the feed's cap on cards are separate rules that
  // happen to share a number; both are asserted so a change to one is visible.
  assert.equal(MAX_MERCHANT_ROWS, 3);
  assert.equal(FEED_CARDS, 3);
  // And the surface that must obey the merchant cap reads it from here rather
  // than declaring a second 3 of its own.
  assert.match(code(SHOP_ROW), /MAX_ROWS = MAX_MERCHANT_ROWS/);
  assert.match(code(SHOP_ROW), /slice\(0, MAX_ROWS\)/);
});

test('the disclosure grows with the type', () => {
  // A disclosure that does not scale is a disclosure that disappears.
  assert.ok(TYPE.eyebrowAx > TYPE.eyebrow);
  assert.ok(TYPE.supportingAx > TYPE.supporting);
  assert.ok(MERCHANT_ROW.axThumbHeight > MERCHANT_ROW.thumbHeight);
});

test('the spec knows nothing about commerce', () => {
  // The layout of a computed gap is decided before any shop is consulted, and a
  // layout module that imported commerce would be the ranking side reading it
  // through a side door — the edge `commerce-isolation.test.ts` guards one file
  // up.
  const spec = read(SPEC);
  const importLines = spec.split('\n').filter((l) => /^\s*import\b/.test(l));
  for (const line of importLines) {
    assert.ok(
      !/commerce/.test(line),
      `${SPEC} imports a commerce module: ${line.trim()}`,
    );
  }
  // And it holds no commerce COPY. The geometry constants are allowed to be
  // named after the thing they measure (`MERCHANT_ROW` is a box), so the check
  // is on the strings — the words a reader would actually see.
  const literals = [...code(SPEC).matchAll(/'([^']{4,})'|`([^`]{4,})`/g)].map(
    (m) => m[1] ?? m[2],
  );
  for (const literal of literals) {
    assert.ok(
      !/merchant|price|paid|commission|shop\b/i.test(literal),
      `${SPEC} holds commerce copy: ${literal}`,
    );
  }
});

test('the absence well is a border and a noun, and both are real values', () => {
  assert.ok(ABSENCE.borderWidth > 0);
  assert.ok(ABSENCE.nounSize >= 11, 'the absence noun is below the app’s smallest tracked step');
});

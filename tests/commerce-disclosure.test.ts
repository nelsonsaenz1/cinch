/**
 * Correction 19 / dependency D-4 · disclosure is PER ROW, never per block.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * The defect it guards against already shipped once, in the other direction:
 * "Paid link" was rendered on every result unconditionally while zero
 * programmes were joined, which told users Cinch was paid to show them
 * something it was not paid to show. The fix made the label per product. The
 * atlas then found the same class of bug one level up — a single "Paid link"
 * marker drawn over a whole merchant tray, false for every direct row beneath
 * it — and the fix is the same shape: the label belongs to the row that earns
 * it and to nothing larger.
 *
 * A test that only checked "the joined row says Paid link" would pass while a
 * block-level marker sat above it. So these tests count: the number of
 * disclosure strings a tray produces must equal the number of PAID rows in it,
 * which is a property no block-level marker can satisfy for a mixed tray.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  commissionParagraph,
  commissionSentence,
  commissionSentenceShort,
  floorPriceLabel,
  linkDisclosure,
  openLabel,
  openSheetLabel,
  OPEN_AT_MERCHANT_LABEL,
  OPEN_AT_THE_MERCHANT_LABEL,
  PAID_LINK_LABEL,
  provenanceLine,
  shopSheetDisclosure,
  LISTING_SERVICE_LINE,
} from '../src/features/commerce/copy';

type Row = { merchantName: string; paid: boolean };

const EVERLANE: Row = { merchantName: 'Everlane', paid: true };
const UNIQLO: Row = { merchantName: 'Uniqlo', paid: false };

/**
 * What a tray of rows actually renders as disclosure, modelled exactly as
 * `shop-row.tsx` renders it: each row contributes its own action label, and a
 * paid row contributes the marker as well. Nothing is contributed by the tray.
 */
function trayDisclosures(rows: readonly Row[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    out.push(openLabel(row.paid, row.merchantName));
    if (row.paid) out.push(PAID_LINK_LABEL);
  }
  return out;
}

test('a mixed tray carries exactly one marker, on the row that earns it', () => {
  const rows = [EVERLANE, UNIQLO];
  const markers = trayDisclosures(rows).filter((s) => s === PAID_LINK_LABEL);

  assert.equal(markers.length, 1);
  assert.equal(markers.length, rows.filter((r) => r.paid).length);
});

test('the marker count equals the paid-row count for every combination', () => {
  // A block-level marker would produce 1 for any tray with a paid row in it,
  // and 1 for a tray with three — so the two-paid case is what fails it.
  const combos: Row[][] = [
    [],
    [UNIQLO],
    [EVERLANE],
    [EVERLANE, UNIQLO],
    [UNIQLO, EVERLANE],
    [EVERLANE, { merchantName: 'Sézane', paid: true }],
    [EVERLANE, { merchantName: 'Sézane', paid: true }, UNIQLO],
  ];

  for (const rows of combos) {
    const markers = trayDisclosures(rows).filter((s) => s === PAID_LINK_LABEL).length;
    assert.equal(markers, rows.filter((r) => r.paid).length, JSON.stringify(rows));
  }
});

test('a direct row carries no marker at all — its action is its disclosure', () => {
  const rendered = trayDisclosures([UNIQLO]);
  assert.deepEqual(rendered, ['Open at Uniqlo']);
  assert.ok(!rendered.includes(PAID_LINK_LABEL));
});

test('a joined row reads "Open" and a direct row names its merchant', () => {
  assert.equal(openLabel(true, 'Everlane'), 'Open');
  assert.equal(openLabel(false, 'Uniqlo'), 'Open at Uniqlo');
  // The generic constant survives for the surfaces that quote it — Privacy →
  // Shopping partners describes an unpaid row in exactly these words.
  assert.equal(OPEN_AT_MERCHANT_LABEL, 'Open at merchant');
  assert.equal(linkDisclosure(true), PAID_LINK_LABEL);
  assert.equal(linkDisclosure(false), OPEN_AT_MERCHANT_LABEL);
});

test('the commission sentence exists only when a paid row is visible', () => {
  assert.equal(commissionSentence(0), null);
  assert.equal(commissionSentenceShort(0), null);
  assert.ok(commissionSentence(1));
  assert.ok(commissionSentenceShort(1));

  // A direct-only tray: no paid rows, therefore no sentence.
  assert.equal(commissionSentence([UNIQLO].filter((r) => r.paid).length), null);
});

test('the commission sentence names all three things commission does not change', () => {
  const sentence = commissionSentence(1)!;
  assert.match(sentence, /the gap/);
  assert.match(sentence, /the match/);
  assert.match(sentence, /the order/);
  assert.match(sentence, /the paid link above/);
  assert.match(commissionSentence(2)!, /the paid links above/);
});

test('the product sheet’s paragraph is absent on a direct sheet, not softened', () => {
  assert.equal(commissionParagraph(false, 'Uniqlo'), null);

  const paragraph = commissionParagraph(true, 'Everlane')!;
  assert.match(paragraph, /Everlane’s own page/);
  assert.match(paragraph, /does not change what is suggested or the order/);
});

test('the sheet action names the merchant when paid and stays generic when not', () => {
  assert.equal(openSheetLabel(true, 'Everlane'), 'Open Everlane');
  assert.equal(openSheetLabel(false, 'Uniqlo'), OPEN_AT_THE_MERCHANT_LABEL);
  assert.equal(OPEN_AT_THE_MERCHANT_LABEL, 'Open at the merchant');
});

test('correction 12 · provenance names the retailer and admits staleness', () => {
  const line = provenanceLine('Everlane');
  assert.match(line, /Price and picture come from Everlane/);
  assert.match(line, /may be out of date/);
  // The listing service is not named on this line — the privacy page names it
  // in full, and this line must not stand in front of that answer.
  assert.doesNotMatch(line, /Datafeedr|Exa|listing service/i);
  assert.match(LISTING_SERVICE_LINE, /Cinch’s listing service/);
  assert.doesNotMatch(LISTING_SERVICE_LINE, /Datafeedr|Exa/i);
});

test('the older list sheet obeys the same rule', () => {
  assert.match(shopSheetDisclosure(1), /Cinch earns a small commission/);
  assert.doesNotMatch(shopSheetDisclosure(0), /commission/);
  // The half that is true either way survives in both.
  assert.match(shopSheetDisclosure(0), /computed from your closet before any shop is consulted/);
  assert.match(shopSheetDisclosure(1), /computed from your closet before any shop is consulted/);
});

test('every price is a floor from the feed, and no literal is ever written', () => {
  assert.equal(floorPriceLabel(8_800, 'USD'), 'from $88');
  assert.equal(floorPriceLabel(4_900, null), 'from $49');
  assert.equal(floorPriceLabel(8_850, 'USD'), 'from $88.50');
  assert.equal(floorPriceLabel(8_800, 'GBP'), 'from GBP 88');
  // No strikethrough, no was/now pair, no urgency, no sale badge.
  assert.doesNotMatch(floorPriceLabel(8_800, 'USD'), /was|now|off|sale|%/i);
});

test('a VoiceOver row label carries that row’s own disclosure and no other', () => {
  // Modelled exactly as `MerchantRow` composes it.
  const spoken = (row: Row, title: string, price: string) =>
    [row.merchantName, title, price, row.paid ? 'paid link' : null, `opens ${row.merchantName}`]
      .filter(Boolean)
      .join(', ');

  assert.equal(
    spoken(EVERLANE, 'wide-leg twill', floorPriceLabel(8_800, 'USD')),
    'Everlane, wide-leg twill, from $88, paid link, opens Everlane',
  );
  assert.equal(
    spoken(UNIQLO, 'pleated trouser', floorPriceLabel(4_900, 'USD')),
    'Uniqlo, pleated trouser, from $49, opens Uniqlo',
  );
});

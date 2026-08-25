/**
 * Joined-programme links, verified by inspecting a GENERATED link — not by
 * reading the builder (awin-joined-programmes-directive.md §1.3).
 *
 * Two properties, both load-bearing for commerce-directive.md §6:
 *
 *   refusal 7 — the click carries no identity. The assertion here is an exact
 *   PARAMETER ALLOWLIST, not a blocklist: a blocklist proves the absence of
 *   the names someone thought of, an allowlist proves the absence of
 *   everything else. `clickref`–`clickref6`, SubID, `pref1`, `u1` and any
 *   future alias all fail the same single check.
 *
 *   publisher identity — every Awin link carries publisher 3030871, the id
 *   the joined-programmes read and the feed downloads authenticate as.
 *
 * Plus the parser that feeds `commerce_joined_programmes`: it is the only
 * writer of the table that decides the `Paid link` label, so its rejections
 * are as important as its acceptances.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trackingUrl, CommerceConfigError } from '../supabase/functions/_shared/commerce.ts';
import { parseJoinedProgrammes } from '../supabase/functions/_shared/joined-programmes.ts';

/** The real ids: Cinch's Awin publisher account, and CICYBELL — the first
 *  joined programme (Awin advertiser 124976). */
const PUBLISHER = '3030871';
const CICYBELL = '124976';
const DESTINATION = 'https://cicybell.example/dresses/wrap-midi?colour=navy';

const IDS = { awinPublisherId: PUBLISHER, rakutenTrackingId: 'AbC123dEf45' };

test('an Awin joined-programme link carries exactly awinmid, awinaffid, ued — nothing else', () => {
  const url = new URL(trackingUrl('awin', CICYBELL, DESTINATION, IDS));

  assert.equal(url.origin + url.pathname, 'https://www.awin1.com/cread.php');
  assert.deepEqual(
    [...url.searchParams.keys()].sort(),
    ['awinaffid', 'awinmid', 'ued'],
    'a parameter outside the allowlist is a click-level identifier until proven otherwise',
  );
  assert.equal(url.searchParams.get('awinmid'), CICYBELL);
  assert.equal(url.searchParams.get('awinaffid'), PUBLISHER, 'the link must earn as publisher 3030871');
  assert.equal(url.searchParams.get('ued'), DESTINATION, 'the destination survives the round trip');
});

test('no parameter NAME resembles a click-level identifier, on either network', () => {
  // Belt to the allowlist's braces: even if the allowlist grows a legitimate
  // parameter later, nothing admitted may pattern-match the identifier
  // families both networks offer (clickref/clickref2–6, SubID, pref1, u1).
  const links = [
    trackingUrl('awin', CICYBELL, DESTINATION, IDS),
    trackingUrl('rakuten', '13867', DESTINATION, IDS),
  ];
  for (const link of links) {
    for (const key of new URL(link).searchParams.keys()) {
      assert.doesNotMatch(
        key,
        /clickref|subid|sub_id|pref|^u1$|^sid$|^ref$|publisher.?ref/i,
        `parameter "${key}" in ${link}`,
      );
    }
  }
});

test('a rakuten link is id, mid, murl — and the tracking id is not the SID', () => {
  const url = new URL(trackingUrl('rakuten', '13867', DESTINATION, IDS));
  assert.equal(url.origin + url.pathname, 'https://click.linksynergy.com/deeplink');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['id', 'mid', 'murl']);
  assert.equal(url.searchParams.get('id'), 'AbC123dEf45');
});

test('a non-https destination or an implausible advertiser id refuses to build', () => {
  // The repo's ambient `node:assert` declaration takes no error-class second
  // argument, so the class check is by hand — and it matters: a refusal that
  // is not a CommerceConfigError would be a crash, not a decision.
  const refuses = (build: () => string, why: string) => {
    try {
      build();
    } catch (err) {
      assert.ok(err instanceof CommerceConfigError, `${why}: threw ${String(err)}`);
      return;
    }
    assert.fail(`${why}: built a link instead of refusing`);
  };

  refuses(() => trackingUrl('awin', CICYBELL, 'http://cicybell.example/x', IDS), 'http destination');
  refuses(() => trackingUrl('awin', 'not an id!', DESTINATION, IDS), 'implausible advertiser id');
  refuses(
    () => trackingUrl('awin', CICYBELL, DESTINATION, { rakutenTrackingId: 'AbC123dEf45' }),
    'missing publisher id must throw, never fall back to an untracked link',
  );
});

// ---------------------------------------------------------------------------
// The joined-programmes parse — sole writer of commerce_joined_programmes
// ---------------------------------------------------------------------------

test('a real-shaped Awin answer parses to id-and-name rows, ids stringified', () => {
  const rows = parseJoinedProgrammes([
    { id: 124976, name: 'CICYBELL', currencyCode: 'USD', primaryRegion: { name: 'United States' } },
    { id: 6789, name: '  Someone Later  ' },
  ]);
  assert.deepEqual(rows, [
    { id: '124976', name: 'CICYBELL' },
    { id: '6789', name: 'Someone Later' },
  ]);
});

test('malformed entries are dropped, never invented', () => {
  const rows = parseJoinedProgrammes([
    null,
    'CICYBELL',
    { id: 124976 },
    { name: 'no id' },
    { id: -3, name: 'negative' },
    { id: 12.5, name: 'fractional' },
    { id: '124976; drop table x', name: 'syntax in a string id' },
    { id: '124976', name: 'string id is fine' },
  ]);
  assert.deepEqual(rows, [{ id: '124976', name: 'string id is fine' }]);
});

test('a non-array body throws rather than reading as "no memberships"', () => {
  // An error page parsed as [] would deactivate every joined programme —
  // the sync treats "cannot read" and "read: none" as different facts.
  assert.throws(() => parseJoinedProgrammes({ error: 'rate limited' }));
  assert.throws(() => parseJoinedProgrammes(undefined));
});

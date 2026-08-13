/**
 * DS-05 — the three notices, and the order that decides between them.
 *
 * The rendering is the easy half. The half that can be wrong is which cause a
 * given state resolves to, and getting it wrong is not cosmetic: telling
 * somebody who has switched processing off that their wifi is the problem is
 * both false and a small insult, and blaming a listing partner for a request
 * that never left the phone is an accusation about a third party.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  classifySearchFailure,
  SEARCH_FAILURE_NOTICES,
  type SearchFailureCause,
} from '../src/features/ingest/search-failure';

const ONLINE = { errorCode: null, online: true, consentDeclined: false };

test('each cause resolves from the state that actually means it', () => {
  assert.equal(classifySearchFailure({ ...ONLINE, online: false }), 'offline');
  assert.equal(classifySearchFailure({ ...ONLINE, errorCode: 'search_failed' }), 'partner_unavailable');
  assert.equal(
    classifySearchFailure({ ...ONLINE, errorCode: 'search_disabled' }),
    'partner_unavailable',
  );
});

test('a declined consent is no longer a reason a search did not happen', () => {
  // It WAS, until Packet 1 moved `action: 'search'` above the server's consent
  // gate. The catalogue matcher is not AI processing — the typed words go to
  // Cinch and to the licensed shop catalogue, which is what the CPV2 privacy
  // line now says on screen. Showing the old notice would be telling somebody
  // their choice blocked something their choice does not block, and CPV2 §11
  // names the assumption directly: implementation must not assume "that
  // AI-processing consent gates typed search".
  //
  // The notice TEXT survives in SEARCH_FAILURE_NOTICES for the DS-05 fixture
  // route; what is gone is any input that selects it.
  assert.equal(classifySearchFailure({ ...ONLINE, consentDeclined: true }), null);
  assert.equal(classifySearchFailure({ ...ONLINE, errorCode: 'ai_consent_required' }), null);
  // And an offline user who has also declined consent is told about the signal,
  // which is the thing that actually stopped them.
  assert.equal(
    classifySearchFailure({ errorCode: 'search_failed', online: false, consentDeclined: true }),
    'offline',
  );
});

test('offline outranks a partner failure — a request that never left says nothing', () => {
  // A search attempted with no signal fails with a transport error, and reading
  // that as "the partner is down" blames somebody else for the user's tunnel.
  assert.equal(
    classifySearchFailure({ errorCode: 'search_failed', online: false, consentDeclined: false }),
    'offline',
  );
});

test('nothing is a DS-05 cause by default', () => {
  assert.equal(classifySearchFailure(ONLINE), null);
  // Four failures with their own true sentences. Folding any of them into "the
  // partner is not answering" would replace an accurate message with a false
  // one — and two of them are not failures of the search at all.
  for (const code of [
    'ai_quota_exceeded',
    'plan_upgrade_required',
    'closet_limit_reached',
    'quota_unavailable',
    'link_no_image',
  ]) {
    assert.equal(classifySearchFailure({ ...ONLINE, errorCode: code }), null, code);
  }
});

test('every notice names its cause, states what is kept, and offers a way on', () => {
  const causes: SearchFailureCause[] = ['offline', 'consent_declined', 'partner_unavailable'];
  for (const cause of causes) {
    const n = SEARCH_FAILURE_NOTICES[cause];
    assert.ok(n.label.length > 0, `${cause} has no label`);
    assert.ok(n.title.length > 0, `${cause} has no title`);
    assert.ok(n.body.length > 0, `${cause} has no body`);
    assert.ok(n.primary.length > 0, `${cause} has no action`);
    // No notice is a dead end and none is a dialog: every one of the three has
    // a real action, which is the DS-05 claim that "every path ends in a filed
    // piece".
  }
});

test('the copy is the atlas’s, verbatim', () => {
  assert.equal(SEARCH_FAILURE_NOTICES.offline.title, 'No connection, so no search');
  assert.match(SEARCH_FAILURE_NOTICES.offline.body, /^Your words are kept on this phone\./);
  assert.equal(SEARCH_FAILURE_NOTICES.offline.primary, 'File it in my words');

  assert.equal(
    SEARCH_FAILURE_NOTICES.consent_declined.title,
    'Reading descriptions needs your say-so',
  );
  assert.match(
    SEARCH_FAILURE_NOTICES.consent_declined.body,
    /Cinch will not send this text anywhere/,
  );
  assert.equal(SEARCH_FAILURE_NOTICES.consent_declined.primary, 'Fill it in myself');
  assert.equal(SEARCH_FAILURE_NOTICES.consent_declined.secondary, 'Review consent');

  assert.equal(
    SEARCH_FAILURE_NOTICES.partner_unavailable.title,
    'The listing partner is not answering',
  );
  assert.match(
    SEARCH_FAILURE_NOTICES.partner_unavailable.body,
    /^Nothing about your closet depends on it\./,
  );
  // The one notice whose filled action is not the filing — a partner that is
  // not answering may answer in a moment — with filing as its peer.
  assert.equal(SEARCH_FAILURE_NOTICES.partner_unavailable.primary, 'Try again');
  assert.equal(SEARCH_FAILURE_NOTICES.partner_unavailable.secondary, 'File it in my words');
});

test('the classifier is pure — it reads no device and no store', () => {
  // It has to be, or the ordering above could only be checked on a phone.
  const src = readFileSync('src/features/ingest/search-failure.ts', 'utf8');
  assert.doesNotMatch(src, /^import /m, 'search-failure.ts must import nothing');
  assert.doesNotMatch(src, /\bfetch\b|supabase|Storage|useConnectivity/);
});

test('the sheet renders one notice, in place of the generic line', () => {
  const src = readFileSync('src/components/ingest/garment-search-sheet.tsx', 'utf8');
  // Exactly one notice on screen: the generic error sentence and the standalone
  // filing offer both stand down while a notice is up, or the sheet would say
  // the same thing twice in two voices.
  assert.match(src, /\{!notice && flow\.errorMessage/);
  // …and so does the standalone filing offer, which the notice already carries
  // in the words its own cause calls for.
  assert.match(src, /\{!notice &&\n\s*flow\.errorMessage &&/);
  // And the link path keeps its own four sentences.
  assert.match(src, /isLink \|\| busy \|\| flow\.preview \|\| flow\.filing/);
});

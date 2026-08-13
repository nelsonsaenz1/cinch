/**
 * Wave 3 · Group 4 · Consent and Privacy — the guards this lane leaves behind.
 *
 * Four kinds of thing are held here, and only the first is about layout:
 *
 *   1. THE CONSENT RECORD IS PINNED. `CONSENT_FACTS` is the wording people
 *      actually agreed to, and the privacy page quotes it back to them as the
 *      wording they saw. CN-01 draws four DIFFERENT sentences and describes
 *      them as "the shared consent-fact records, used verbatim"; they are not.
 *      Applying the drawing would tell every existing user they agreed to
 *      sentences that did not exist when they agreed. So the four are frozen
 *      character-for-character, and any change to them fails the build and
 *      forces the conversation rather than shipping quietly.
 *
 *   2. DISCLOSURES ARE CHECKED AGAINST THE CODE THEY DESCRIBE. The catalogue
 *      cache sentence says "at most twelve" because `MAX_RETAINED_TERMS` is 12,
 *      and the export manifest names `photos.html` because that is the file the
 *      worker writes. Both are read out of the source here, so the day either
 *      changes the sentence stops being true and the suite says so.
 *
 *   3. THE REFUSED SENTENCES STAY REFUSED. Two false claims have been drawn
 *      more than once now — a thirty-day deletion window, and comments
 *      surviving deletion under an anonymous name. Neither may reappear in any
 *      privacy copy, however it is phrased.
 *
 *   4. NO LEGAL SENTENCE IS SET SMALL, AND NONE IS SET FAINT. The group's floor
 *      is 15 pt; `note` is 13 and `noteSmall` is 11. And #8A8578 is 3.52:1 on
 *      canvas — an AA failure the constitution forbids outright.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CONSENT_FACTS as SHEET_FACTS } from '../src/features/auth/consent-facts';
import {
  CONSENT_ASK_FOOTER,
  CONSENT_ASK_LEAD,
  CONSENT_ASK_TITLE,
  CONSENT_FACTS as PAGE_FACTS,
  DELETION_HORIZONS,
  EXPORT_CONTENTS_LINE,
  EXPORT_FIRST_NOTE,
  EXPORT_SAVE_WHILE_LINKS_LAST,
  INDEX_INTRO,
  LINK_HANDLING_ROW,
  MANIFEST_ROWS,
  PRIVACY_TOPICS,
  STORED_ROWS,
  WITHDRAW_CONSEQUENCE,
  WITHOUT_CONSENT_LOST,
  WITHOUT_CONSENT_WORKS,
} from '../src/features/privacy/copy';

// ── 1 · The record ─────────────────────────────────────────────────────────

/**
 * The four sentences, exactly as a shipped user agreed to them.
 *
 * Written out rather than hashed on purpose: a failing hash says "something
 * changed", and what a reviewer needs at that moment is the two texts side by
 * side, because the only correct response to this test failing is to decide
 * whether existing consents survive the change.
 */
const FROZEN_RECORD = [
  ['The photo goes to our AI partner,', ' which returns a category, colour and fabric.'],
  [
    'It only goes to models that are not allowed to learn from it,',
    ' and comes straight back. Your name and your email never go with it.',
  ],
  ['We keep the photo and the tags', ' in your closet. Deleting an item deletes both.'],
  ['We never run face recognition,', ' here or anywhere in Cinch.'],
];

test('the four consent facts are unchanged, word for word', () => {
  assert.equal(SHEET_FACTS.length, FROZEN_RECORD.length);
  SHEET_FACTS.forEach((fact, index) => {
    assert.equal(fact.lead, FROZEN_RECORD[index][0]);
    assert.equal(fact.rest, FROZEN_RECORD[index][1]);
  });
});

test('the sheet and the privacy page quote the same four, by reference', () => {
  // Not "equal strings" — the same objects. Two copies satisfy the re-readable
  // rule only for as long as they agree.
  SHEET_FACTS.forEach((fact, index) => {
    assert.equal(PAGE_FACTS[index], fact);
  });
  assert.ok(PAGE_FACTS.length > SHEET_FACTS.length, 'the page adds facts the sheet cannot');
});

test('CN-01’s drawn facts are not present anywhere in the copy', () => {
  // The atlas's four. If one of these ever appears, somebody has applied the
  // drawing to the record — which is the failure this lane exists to prevent.
  const drawn = [
    'Only the picture you just took is sent',
    'Your closet, your wear history and your friends are not part of the request',
    'The name and the guessed details are filed in your closet',
    'Turning this off later keeps every piece you have already filed',
  ];
  const all = [...PAGE_FACTS.map((f) => `${f.lead}${f.rest}`), CONSENT_ASK_LEAD].join(' ');
  for (const sentence of drawn) {
    assert.ok(!all.includes(sentence), `the drawn fact reached the record: ${sentence}`);
  }
});

test('the ask separates the on-device cutout from the model call', () => {
  // Correction 01. The old lead — "the photo has to leave your phone" —
  // conflated two operations gated by different things.
  assert.match(CONSENT_ASK_LEAD, /on this phone/);
  assert.match(CONSENT_ASK_LEAD, /needs a model/);
  assert.ok(!/the photo has to leave your phone/.test(CONSENT_ASK_LEAD));
  assert.ok(CONSENT_ASK_TITLE.length > 0);
});

test('the ask claims nothing about what a partner keeps', () => {
  // system-safety-contract.md §3: a retention or no-training promise about the
  // AI partner is unshippable until the terms are confirmed in writing.
  assert.match(CONSENT_ASK_FOOTER, /their own terms/);
  assert.ok(!/deleted immediately/i.test(CONSENT_ASK_FOOTER));
  assert.ok(!/never (retains|stored|kept)/i.test(CONSENT_ASK_FOOTER));
});

// ── 2 · Disclosures checked against the code ───────────────────────────────

const catalog = readFileSync('supabase/functions/_shared/catalog.ts', 'utf8');

test('the cache sentence matches MAX_RETAINED_TERMS', () => {
  const declared = /const MAX_RETAINED_TERMS = (\d+)/.exec(catalog);
  assert.ok(declared, 'MAX_RETAINED_TERMS is not where the disclosure thinks it is');
  assert.equal(declared[1], '12', 'the cap moved; "at most twelve" is now false');

  const shopping = PRIVACY_TOPICS.find((t) => t.title === 'Shopping partners');
  const cache = shopping?.sections?.find((s) => s.title === 'What the cache keeps');
  assert.ok(cache, 'the cache section is gone');
  assert.match(cache.body, /twelve/);
  // Correction 03: the old page denied the cache outright. It may never again.
  assert.ok(!/nothing is cached/i.test(cache.body));
});

test('the cache key really is a digest, as the disclosure says', () => {
  assert.match(catalog, /crypto\.subtle\.digest\('SHA-256'/);
});

test('the manifest names the files the worker actually writes', () => {
  const assemble = readFileSync('supabase/functions/build-export/assemble.ts', 'utf8');
  for (const row of MANIFEST_ROWS) {
    assert.ok(assemble.includes(row.name), `${row.name} is not a file build-export writes`);
    assert.ok(EXPORT_CONTENTS_LINE.includes(row.name), `${row.name} is missing from the intro`);
  }
  assert.equal(MANIFEST_ROWS.length, 5);
  // Correction 15's point: the pictures are links, and links stop working.
  assert.match(EXPORT_SAVE_WHILE_LINKS_LAST, /expire/);
});

test('the declined path names what this app really loses', () => {
  // This assertion has been INVERTED, and the inversion is the evidence.
  //
  // It used to read "packing cannot be in the works list", because
  // `packing-brief` refused without consent exactly as the tagger does. The
  // deterministic memo removed that call: `features/plan/packing-memo.ts`
  // composes the prose from the forecast, the closet and the capsule, so
  // packing now works with AI processing switched off. What is checked is the
  // CLIENT, not the Edge Function — the function is still deployed for builds
  // that have not taken the update yet, and its consent gate is still correct
  // for them.
  const hook = readFileSync('src/features/plan/use-packing-brief.ts', 'utf8');
  assert.ok(
    !/supabase|functions\.invoke/.test(hook),
    'the packing memo reaches a server again',
  );
  assert.match(WITHOUT_CONSENT_WORKS, /packing/i);
  assert.ok(
    !/packing/i.test(WITHOUT_CONSENT_LOST),
    'packing is named as lost when it no longer is',
  );
  // CN-02 omits the stylist chat, which stops — and the withdrawal sentence has
  // always said so. Two screens must not disagree about one fact.
  assert.match(WITHOUT_CONSENT_LOST, /stylist chat/i);
  assert.match(WITHDRAW_CONSEQUENCE, /stylist chat/i);
  // Correction 01's real content: the cutout survives a decline.
  assert.match(WITHOUT_CONSENT_WORKS, /cutting it out of its background/i);
});

// ── 3 · The refused sentences ──────────────────────────────────────────────

/** Every user-visible string this module exports, flattened. */
const ALL_COPY = [
  INDEX_INTRO,
  CONSENT_ASK_TITLE,
  CONSENT_ASK_LEAD,
  CONSENT_ASK_FOOTER,
  EXPORT_CONTENTS_LINE,
  EXPORT_SAVE_WHILE_LINKS_LAST,
  EXPORT_FIRST_NOTE,
  WITHOUT_CONSENT_WORKS,
  WITHOUT_CONSENT_LOST,
  WITHDRAW_CONSEQUENCE,
  ...PAGE_FACTS.map((f) => `${f.lead}${f.rest}`),
  ...DELETION_HORIZONS.flatMap((h) => [h.title, h.body]),
  ...MANIFEST_ROWS.flatMap((r) => [r.name, r.body]),
  ...[...PRIVACY_TOPICS, LINK_HANDLING_ROW].flatMap((t) => [
    t.title,
    t.gist,
    t.body ?? '',
    ...(t.sections ?? []).flatMap((s) => [s.title, s.body]),
  ]),
].join('\n');

test('no deletion window is ever promised', () => {
  // `delete-account/index.ts` names "we will process this within 30 days" as a
  // thing that does NOT satisfy Guideline 5.1.1(v). Deletion is immediate, and
  // that immediacy is the whole compliance argument.
  assert.ok(!/thirty days/i.test(ALL_COPY));
  assert.ok(!/\b30 days\b/i.test(ALL_COPY));
  assert.match(DELETION_HORIZONS[0].title, /While you wait/);
  assert.match(EXPORT_FIRST_NOTE, /cannot be undone/i);
});

test('nothing of a deleted account is claimed to survive under another name', () => {
  // Drawn twice now — "a former member" in atlas 38, "shown without your name"
  // in PV-04. Every social table cascades from `auth.users`.
  assert.ok(!/shown without your name/i.test(ALL_COPY));
  assert.match(DELETION_HORIZONS[1].body, /erased, not renamed/);

  // "a former member" DOES appear once, inside the sentence that refutes it —
  // "nothing of yours reappears under 'a former member'" — and a blanket ban on
  // the phrase would delete the refutation along with the claim. So the rule is
  // the one that matters: wherever the phrase appears, it is being denied.
  for (const line of ALL_COPY.split('\n')) {
    if (!/former member/i.test(line)) continue;
    assert.match(
      line,
      /nothing of yours reappears under/,
      `"a former member" is asserted rather than refused: ${line}`,
    );
  }
});

test('the location row does not repeat the drawn claim about the calendar', () => {
  const row = PRIVACY_TOPICS.find((t) => t.title.startsWith('Where you are'));
  assert.ok(row);
  // PV-01 draws "calendar titles never stored", which answers a question nobody
  // asked while leaving the disclosed thing undisclosed: the title is SENT.
  assert.ok(!/never stored/i.test(row.gist));
  assert.match(row.gist, /outfit request/);
  assert.match(row.body ?? '', /title of an event goes to our AI partner/);
});

// ── The index's own shape ──────────────────────────────────────────────────

test('every index row names its category and carries a gist', () => {
  for (const topic of [...PRIVACY_TOPICS, LINK_HANDLING_ROW]) {
    assert.ok(topic.title.length > 0, 'a row with no title');
    assert.ok(topic.gist.length > 0, `${topic.title} has no gist`);
    assert.ok(topic.gist.length <= 96, `${topic.title}'s gist is a paragraph, not a gist`);
    const detail = topic.body ? 1 : 0;
    const sections = topic.sections?.length ? 1 : 0;
    assert.equal(detail + sections, 1, `${topic.title} has both or neither kind of detail`);
  }
});

test('the store card’s four rows are the first four topics, by reference', () => {
  // Not copies. The App Privacy mapping is written against these four, and a
  // second array would drift from the page the listing points at.
  assert.equal(STORED_ROWS.length, 4);
  STORED_ROWS.forEach((row, index) => assert.equal(row, PRIVACY_TOPICS[index]));
});

test('the analytics category is disclosed, and disclosed honestly', () => {
  const row = PRIVACY_TOPICS.find((t) => t.title === 'How the app is used');
  assert.ok(row, 'the page discloses no analytics, and the app ships with some');
  // It ships: the token is set on the production profile.
  assert.match(readFileSync('eas.json', 'utf8'), /EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  // And what it does not send is what `lib/posthog.tsx` refuses to send.
  assert.match(row.body ?? '', /never sent/);
  assert.match(row.gist, /Never a photograph/);
});

// ── 4 · Type size and colour ───────────────────────────────────────────────

/** The screens this lane owns. Comments stripped: a file explaining a rule
 *  must not read as breaking it. */
const SURFACES = [
  'src/components/privacy/privacy-index-page.tsx',
  'src/components/privacy/privacy-page.tsx',
  'src/components/privacy/ai-consent-page.tsx',
  'src/components/privacy/delete-account-page.tsx',
  'src/components/privacy/export-page.tsx',
  'src/components/privacy/withdraw-consent-sheet.tsx',
  'src/components/privacy/backfill-sheet.tsx',
  'src/components/ingest/consent-sheet.tsx',
];

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('no consent or privacy surface sets faint as text', () => {
  const offenders = SURFACES.filter((f) => {
    const src = code(f);
    return (
      /text-faint\b/.test(src) ||
      /color:\s*theme\.faint\b/.test(src) ||
      /placeholderTextColor=\{theme\.faint\}/.test(src)
    );
  });
  assert.deepEqual(offenders, [], `faint as text in:\n${offenders.join('\n')}`);
});

test('no disclosure is set below 15 pt', () => {
  // `note` is 13px and `noteSmall` is 11px. Both are legitimate for metadata —
  // a date beside a thumbnail, the second line of an "Earlier exports" row —
  // and neither may carry a sentence about what leaves the account. The
  // allowance is therefore a count, per file, held at what those metadata uses
  // actually are: raise one and this test asks which sentence shrank.
  const allowance: Record<string, number> = {
    'src/components/privacy/ai-consent-page.tsx': 1,
    'src/components/privacy/export-page.tsx': 1,
  };
  for (const file of SURFACES) {
    const uses = (code(file).match(/variant="note(Small)?"/g) ?? []).length;
    assert.ok(
      uses <= (allowance[file] ?? 0),
      `${file} sets ${uses} thing(s) below 15 pt; ${allowance[file] ?? 0} allowed`,
    );
  }
});

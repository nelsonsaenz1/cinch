/**
 * EVERY WORD THE SAVED-LOOKS FLOW SAYS, HELD TO THE HANDOFF THAT SPECIFIED IT.
 *
 * §7 ends "Verbatim strings appear in the DC refs; keep them in sync." A copy
 * table that drifts from its atlas is the failure nobody notices in review,
 * because both halves look right on their own — so the 47 strings are checked
 * against a transcription of the handoff's own table below.
 *
 * ── AND THE THREE PROMISES THE WORDS THEMSELVES MAKE ──────────────────────
 *
 * · **Nothing implies anybody else can see a save.** No "share", no "public",
 *   no "followers", no "who saved this". The select policy is
 *   `owner_id = auth.uid()` and there is no second read path — not even for the
 *   person whose look it was.
 * · **Nothing says WHICH kind of revocation happened.** Expired, un-shared,
 *   circle changed and hard-deleted are one sentence, because
 *   `can_save_source` returns a boolean and telling the four apart would be four
 *   different disclosures about somebody else's decision.
 * · **Nothing claims the source was affected.** Removing a save removes a save.
 *
 * The count sentences are checked at their boundaries as well, because that is
 * where a headline ships as "The 1 looks inside".
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  COLLECTIONS,
  DELETE_COLLECTION,
  DETAIL,
  EMPTY,
  ERROR,
  NO_IMAGE,
  OFFLINE,
  PLAN,
  REMOVE,
  SAVE,
  SAVED_TITLE,
  SAVE_SHEET,
  UNAVAILABLE,
  allFilterLabel,
  cardAccessibilityLabel,
  collectionCountLine,
  deleteCollectionBody,
  deleteCollectionTitle,
  filterAccessibilityLabel,
  matchedHeader,
  missingHeader,
  planCta,
  provenanceAccessibilityLabel,
  provenanceFrom,
  removeAccessibilityLabel,
  removeBody,
  saveButtonLabel,
  unavailableBody,
  unavailableCountBanner,
  unavailablePrivacyNote,
} from '../src/features/saved-looks/copy.ts';

// ---------------------------------------------------------------------------
// 1 · The handoff's table, verbatim
// ---------------------------------------------------------------------------

test('the fixed strings are the handoff’s §7, word for word', () => {
  assert.equal(SAVED_TITLE, 'Saved');
  assert.equal(EMPTY.title, 'Nothing saved yet');
  assert.equal(EMPTY.body, 'Tap the bookmark on any look to keep it here — just for you.');
  assert.equal(EMPTY.hint, 'Look for this on any outfit');

  assert.equal(SAVE.cta, 'Save look');
  assert.equal(SAVE.savedPill, 'Saved');
  assert.equal(SAVE.toastCreated, 'Saved to your looks');
  assert.equal(SAVE.toastUndo, 'Undo');
  assert.equal(SAVE.toastDuplicate, 'Already in your looks');
  assert.equal(SAVE.toastView, 'View');

  assert.equal(SAVE_SHEET.title, 'Add to a collection?');
  assert.equal(SAVE_SHEET.subtitle, 'Optional — collections stay private to you.');
  assert.equal(SAVE_SHEET.newCollection, 'New collection');
  assert.equal(SAVE_SHEET.dismiss, 'Not now');

  assert.equal(DETAIL.privateHeader, 'Private to you');
  assert.equal(DETAIL.noteLabel, 'Your note');
  assert.equal(DETAIL.savedLabel, 'Saved');
  assert.equal(DETAIL.planCta, 'Plan this look');
  assert.equal(DETAIL.moveCta, 'Move to…');
  assert.equal(DETAIL.removeCta, 'Remove');
  assert.equal(provenanceFrom('Maya’s Daily look'), 'Saved from Maya’s Daily look');

  assert.equal(COLLECTIONS.title, 'Collections');
  assert.equal(COLLECTIONS.section, 'Private collections');
  assert.equal(COLLECTIONS.create, 'New collection');
  assert.equal(
    COLLECTIONS.hint,
    'Swipe a collection, or tap into it, to rename or delete. Deleting a collection keeps its looks in Saved.',
  );
  assert.equal(COLLECTIONS.renameTitle, 'Rename collection');
  assert.equal(COLLECTIONS.nameHint, 'Names are private and visible only to you. 40 characters max.');
  assert.equal(deleteCollectionTitle('Fall layering'), 'Delete “Fall layering”?');
  assert.equal(DELETE_COLLECTION.confirm, 'Delete collection');

  assert.equal(UNAVAILABLE.title, 'This look is no longer available');
  assert.equal(UNAVAILABLE.keep, 'Keep note only');
  assert.equal(UNAVAILABLE.remove, 'Remove save');
  assert.equal(UNAVAILABLE.gridTag, 'Unavailable');
  assert.equal(unavailableCountBanner(1), '1 saved look is no longer available.');

  assert.equal(REMOVE.title, 'Remove this saved look?');
  assert.equal(REMOVE.confirm, 'Remove');
  assert.equal(REMOVE.moveInstead, 'Move to a collection instead');
  assert.equal(
    removeBody('Maya’s Daily'),
    'It leaves your Saved and any collection. The original in Maya’s Daily isn’t affected.',
  );

  assert.equal(PLAN.title, 'Plan this look');
  assert.equal(matchedHeader(2), 'Your closet · 2 matched');
  assert.equal(PLAN.matchedTag, 'Matched from your closet');
  assert.equal(missingHeader(2), 'Not in your closet · 2');
  assert.equal(PLAN.noMatch, 'Nothing similar found');
  assert.equal(PLAN.optional, 'Optional · skip for now');
  assert.equal(PLAN.findSimilar, 'Find similar');
  assert.equal(PLAN.addManual, 'Add manually');
  assert.equal(PLAN.skip, 'Skip');
  assert.equal(planCta(2), 'Create plan with 2 pieces');
  assert.equal(PLAN.ctaNote, 'You can add the missing pieces anytime.');
  assert.equal(PLAN.doneTitle, 'Plan created');
  assert.equal(PLAN.doneOpen, 'Open plan');
  assert.equal(PLAN.doneBack, 'Back to Saved');

  assert.equal(OFFLINE.banner, 'You’re offline. Showing your last synced looks.');
  assert.equal(OFFLINE.imageNotSynced, 'Image not synced');
  assert.equal(NO_IMAGE, 'No image saved');
  assert.equal(ERROR.title, 'Couldn’t load your looks');
  assert.equal(ERROR.body, 'Something went wrong on our end. Your saves are safe.');
  assert.equal(ERROR.retry, 'Try again');
});

test('the two OS-06 sentences name the source owner and nothing else about them', () => {
  assert.equal(
    unavailableBody('Ava'),
    'Ava’s look expired or their sharing changed. You can still keep your note, or remove this save.',
  );
  assert.equal(
    unavailablePrivacyNote('Ava'),
    'We never copied Ava’s garments into your closet, so nothing private was kept beyond your own note.',
  );
});

// ---------------------------------------------------------------------------
// 2 · The promises the words make
// ---------------------------------------------------------------------------

/** Every string this module can produce, with realistic arguments. */
function allStrings(): string[] {
  const objects: Record<string, unknown>[] = [
    SAVE,
    SAVE_SHEET,
    DETAIL,
    COLLECTIONS,
    DELETE_COLLECTION,
    UNAVAILABLE,
    REMOVE,
    PLAN,
    OFFLINE,
    ERROR,
    EMPTY,
  ];
  const fixed = objects.flatMap((group) =>
    Object.values(group).filter((value): value is string => typeof value === 'string'),
  );

  return [
    ...fixed,
    SAVED_TITLE,
    NO_IMAGE,
    allFilterLabel(14),
    provenanceFrom("Maya's Daily look"),
    deleteCollectionTitle('Fall layering'),
    deleteCollectionBody(0),
    deleteCollectionBody(1),
    deleteCollectionBody(6),
    collectionCountLine(1),
    collectionCountLine(6),
    unavailableBody('Ava'),
    unavailablePrivacyNote('Ava'),
    unavailableCountBanner(1),
    unavailableCountBanner(3),
    removeBody("Maya's Daily"),
    matchedHeader(2),
    missingHeader(2),
    planCta(1),
    planCta(2),
    saveButtonLabel(true),
    saveButtonLabel(false),
  ];
}

test('nothing implies that anybody else can see a save', () => {
  // `share` would be the obvious one; the rest are the vocabulary of a public
  // board, which §0 of the handoff refuses outright.
  const forbidden = ['share', 'shared', 'public', 'follower', 'followers', 'everyone', 'anyone can'];
  for (const line of allStrings()) {
    const lowered = line.toLowerCase();
    for (const word of forbidden) {
      assert.ok(
        !new RegExp(`\\b${word}\\b`).test(lowered),
        `"${line}" says "${word}", which promises an audience this feature does not have`,
      );
    }
  }
});

test('nothing says which kind of revocation happened', () => {
  // `can_save_source` returns a boolean. Naming the cause would name somebody
  // else's decision to the person it was made away from.
  const forbidden = ['deleted', 'blocked', 'unfriend', 'removed you', 'expired on'];
  for (const line of allStrings()) {
    const lowered = line.toLowerCase();
    for (const word of forbidden) {
      assert.ok(!lowered.includes(word), `"${line}" names a cause the schema does not distinguish`);
    }
  }
});

test('removing a save never claims to touch the source', () => {
  assert.ok(removeBody('Maya’s Daily').includes('isn’t affected'));
});

// ---------------------------------------------------------------------------
// 3 · The counts, at their boundaries
// ---------------------------------------------------------------------------

test('the delete-collection body rebuilds around its number, and never says "1 looks"', () => {
  assert.equal(deleteCollectionBody(0), 'Nothing is inside it. This can’t be undone.');
  assert.equal(deleteCollectionBody(1), 'The 1 look inside stays in Saved. This can’t be undone.');
  assert.equal(deleteCollectionBody(6), 'The 6 looks inside stay in Saved. This can’t be undone.');
});

test('the unavailable banner agrees with itself at one and at many', () => {
  assert.equal(unavailableCountBanner(1), '1 saved look is no longer available.');
  assert.equal(unavailableCountBanner(3), '3 saved looks are no longer available.');
});

test('the plan CTA is singular at one piece', () => {
  assert.equal(planCta(1), 'Create plan with 1 piece');
});

test('no sentence can ever print undefined or NaN', () => {
  const nonsense = [Number.NaN, -1, Number.POSITIVE_INFINITY];
  for (const n of nonsense) {
    for (const line of [
      allFilterLabel(n),
      deleteCollectionBody(n),
      collectionCountLine(n),
      unavailableCountBanner(n),
      matchedHeader(n),
      missingHeader(n),
      planCta(n),
    ]) {
      assert.ok(!/undefined|NaN|Infinity|-\d/.test(line), `"${line}" printed a non-number`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4 · What VoiceOver hears
// ---------------------------------------------------------------------------

test('the save button carries its state in the label, not only in its fill', () => {
  assert.equal(saveButtonLabel(false), 'Save look');
  assert.equal(saveButtonLabel(true), 'Saved, in your looks');
});

test('"Unavailable" is PREPENDED to a card’s label, never appended', () => {
  const label = cardAccessibilityLabel({
    title: 'Slip dress + boots',
    sourceLabel: "Ava's Daily",
    savedAgo: '3w',
    availability: 'unavailable',
  });
  assert.ok(label.startsWith('Unavailable.'), label);
  // A reader who moves quickly must hear the disqualifying fact before the
  // title, not after the date.
  assert.ok(label.indexOf('Unavailable') < label.indexOf('Slip dress'));
});

test('an available card speaks one sentence with no tag in it', () => {
  assert.equal(
    cardAccessibilityLabel({
      title: 'Rust cord + cream knit',
      sourceLabel: "Maya's Daily",
      savedAgo: '4d',
      availability: 'available',
    }),
    "Rust cord + cream knit, saved from Maya's Daily, 4d.",
  );
});

test('a card with no title still speaks, rather than starting with a comma', () => {
  const label = cardAccessibilityLabel({
    title: null,
    sourceLabel: 'Your outfit',
    savedAgo: '1w',
    availability: 'available',
  });
  assert.ok(label.startsWith('Untitled look,'), label);
});

test('the provenance row is one stop with all three facts, and no middle dot', () => {
  const label = provenanceAccessibilityLabel({
    sourceLabel: 'Maya’s Daily look',
    visibility: 'Visible to your Circle',
    when: 'Aug 3, 2026',
  });
  assert.equal(label, 'Saved from Maya’s Daily look. Visible to your Circle. Aug 3, 2026.');
  assert.ok(!label.includes('·'), 'a drawn separator spoken aloud is silence or the words "middle dot"');
});

test('the destructive control names its target, so it can never be a blind tap', () => {
  assert.equal(
    removeAccessibilityLabel('Rust cord + cream knit'),
    'Remove Rust cord + cream knit from Saved',
  );
  assert.equal(removeAccessibilityLabel(null), 'Remove this saved look from Saved');
});

test('a filter chip says how many it selects, spoken', () => {
  assert.equal(filterAccessibilityLabel('Fall layering', 6), 'Fall layering, 6 looks');
});

// ---------------------------------------------------------------------------
// 5 · The words live here, and not in the components
// ---------------------------------------------------------------------------

test('no component in the unit hard-codes a sentence', () => {
  const dir = 'src/components/saved-looks';
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tsx')) continue;
    const source = readFileSync(`${dir}/${file}`, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    // A JSX text node of more than a few words is prose that escaped the copy
    // module — where a promise about who can see something would go unreviewed.
    for (const [, text] of source.matchAll(/>\s*([A-Z][a-z]+(?:\s+[a-z']+){3,})\s*</g)) {
      assert.fail(`${file} hard-codes "${text.trim()}" — sentences belong in copy.ts`);
    }
  }
});

/**
 * The New Occasion draft store (LP-08).
 *
 * Four rules are worth a test, and they are the four that cost a user
 * something when they are wrong: a draft that round-trips, a version bump that
 * ORPHANS rather than misreads, a key that cannot show one account's typing to
 * another, and clearing that happens on discard and on an acknowledged create
 * — and on nothing else.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createEventDraftStore,
  decodeEventDraft,
  emptyEventDraft,
  encodeEventDraft,
  eventDraftKey,
  fromDraftDay,
  isEventDraftEmpty,
  toDraftDay,
  EVENT_DRAFT_VERSION,
  type DraftStorage,
  type EventDraft,
} from '../src/features/events/event-draft.ts';

function draft(over: Partial<EventDraft> = {}): EventDraft {
  return {
    ...emptyEventDraft(),
    name: 'Priya & Tom’s wedding',
    day: '2026-08-09',
    minutes: 19 * 60,
    placeText: 'The Stanley',
    placeAddress: 'Denver, CO',
    coords: { latitude: 39.74, longitude: -104.99, source: 'mapkit' },
    placeCategory: 'MKPOICategoryRestaurant',
    placeUrl: null,
    placeId: 'mapkit-1',
    dressCode: 'Cocktail',
    note: 'Bring something warm — the terrace gets cold after nine.',
    ...over,
  };
}

/** A Map standing in for AsyncStorage. The reason the store takes its storage
 *  as an argument at all. */
function memory(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
  };
}

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

test('a draft survives encode and decode unchanged', () => {
  const original = draft();
  assert.deepEqual(decodeEventDraft(encodeEventDraft(original)), original);
});

test('the stress content round-trips too — 60-char title, 280-char note, long venue', () => {
  const original = draft({
    name: 'A'.repeat(60),
    note: 'B'.repeat(280),
    placeText: 'The Extremely Long Restaurant Name At The Corner Of Two Long Streets',
  });
  const back = decodeEventDraft(encodeEventDraft(original));
  assert.equal(back?.name.length, 60);
  assert.equal(back?.note.length, 280);
  assert.equal(back?.placeText, original.placeText);
});

test('a local calendar day round-trips without drifting a day through UTC', () => {
  // 23:30 local on the 9th is the 10th in UTC. `toISOString().slice(0,10)`
  // would move the date; this must not.
  const late = new Date(2026, 7, 9, 23, 30);
  assert.equal(toDraftDay(late), '2026-08-09');
  assert.equal(fromDraftDay('2026-08-09')?.getDate(), 9);
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('a wrong version is orphaned, never decoded into the current shape', () => {
  const stale = JSON.stringify({
    v: EVENT_DRAFT_VERSION + 1,
    form: 'event.new',
    savedAt: 0,
    draft: draft(),
  });
  assert.equal(decodeEventDraft(stale), null);
});

test('a draft belonging to another form is refused', () => {
  const other = JSON.stringify({
    v: EVENT_DRAFT_VERSION,
    form: 'event.edit',
    savedAt: 0,
    draft: draft(),
  });
  assert.equal(decodeEventDraft(other), null);
});

test('malformed, empty and absent blobs all come back as "no draft"', () => {
  for (const raw of [null, undefined, '', 'not json', '[]', '{}', '"a string"']) {
    assert.equal(decodeEventDraft(raw), null, `expected ${JSON.stringify(raw)} to be refused`);
  }
});

test('a draft with nothing in it is not a draft', () => {
  assert.equal(decodeEventDraft(encodeEventDraft(emptyEventDraft())), null);
  assert.equal(isEventDraftEmpty(emptyEventDraft()), true);
  assert.equal(isEventDraftEmpty(draft({ ...emptyEventDraft(), name: '   ' })), true);
});

test('coordinates that are merely shaped like coordinates are dropped', () => {
  const bad = encodeEventDraft(
    draft({ coords: { latitude: 900, longitude: 0 } as EventDraft['coords'] }),
  );
  assert.equal(decodeEventDraft(bad)?.coords, null);
});

test('a time with no day, and resolved venue metadata with no text, are not restorable', () => {
  assert.equal(decodeEventDraft(encodeEventDraft(draft({ day: null })))?.minutes, null);
  const placeless = decodeEventDraft(encodeEventDraft(draft({ placeText: '' })));
  // LP-05, all five: nothing resolved outlives the text it resolved from.
  assert.equal(placeless?.placeAddress, null);
  assert.equal(placeless?.coords, null);
  assert.equal(placeless?.placeCategory, null);
  assert.equal(placeless?.placeUrl, null);
  assert.equal(placeless?.placeId, null);
});

test('a draft written before LP-05 restores with no resolved metadata rather than junk', () => {
  // The pre-LP-05 payload, by hand: three of the five fields simply do not
  // exist in it. Reading them as null is what lets the version stay at 1.
  const legacy = JSON.stringify({
    v: EVENT_DRAFT_VERSION,
    form: 'event.new',
    savedAt: 0,
    draft: {
      name: 'Dinner',
      day: null,
      minutes: null,
      placeText: 'The Stanley',
      placeAddress: 'Denver, CO',
      coords: { latitude: 39.74, longitude: -104.99 },
      dressCode: null,
      note: '',
    },
  });

  const back = decodeEventDraft(legacy);
  assert.equal(back?.placeText, 'The Stanley');
  assert.equal(back?.placeAddress, 'Denver, CO');
  assert.equal(back?.placeCategory, null);
  assert.equal(back?.placeUrl, null);
  assert.equal(back?.placeId, null);
  // Its coordinates name no resolver, which is not a gap: that blob predates
  // MapKit, so the pair is a gazetteer pair and the serializer's fallback says
  // so. A restored draft must never GAIN a provenance it never had.
  assert.deepEqual(back?.coords, { latitude: 39.74, longitude: -104.99 });
});

test('a restored draft keeps the resolver its pick was found by', () => {
  // The second route into the create-event write: a MapKit pick typed, left,
  // and restored. The resolver has to survive the disk, or the occasion is
  // written with the wrong provenance an hour after it was picked.
  const back = decodeEventDraft(encodeEventDraft(draft()));
  assert.deepEqual(back?.coords, { latitude: 39.74, longitude: -104.99, source: 'mapkit' });

  // A resolver nobody shipped is dropped rather than trusted — the pair still
  // stands, and it reads as the unstamped pair the fallback already handles.
  const forged = decodeEventDraft(
    encodeEventDraft(
      draft({
        coords: {
          latitude: 39.74,
          longitude: -104.99,
          source: 'foursquare',
        } as unknown as EventDraft['coords'],
      }),
    ),
  );
  assert.deepEqual(forged?.coords, { latitude: 39.74, longitude: -104.99 });
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

test('the key is scoped to the version, the form, and the user', () => {
  assert.equal(eventDraftKey('user-1'), `cinch.draft.v${EVENT_DRAFT_VERSION}.event.new.user-1`);
  assert.notEqual(eventDraftKey('user-1'), eventDraftKey('user-2'));
  assert.notEqual(eventDraftKey('user-1'), eventDraftKey(null));
});

test('one account can never read another account’s draft', async () => {
  const storage = memory();
  const store = createEventDraftStore(storage);

  await store.save('user-1', draft());
  assert.equal(await store.load('user-2'), null);
  assert.notEqual(await store.load('user-1'), null);
});

test('clearing one account leaves the other untouched — the sign-out rule', async () => {
  const storage = memory();
  const store = createEventDraftStore(storage);

  await store.save('user-1', draft());
  await store.save('user-2', draft({ name: 'Dinner' }));
  await store.clear('user-1');

  assert.equal(await store.load('user-1'), null);
  assert.equal((await store.load('user-2'))?.name, 'Dinner');
});

// ---------------------------------------------------------------------------
// Clearing
// ---------------------------------------------------------------------------

test('emptying the form removes the key rather than storing an empty draft', async () => {
  const storage = memory();
  const store = createEventDraftStore(storage);

  await store.save('user-1', draft());
  assert.equal(storage.map.size, 1);

  await store.save('user-1', emptyEventDraft());
  assert.equal(storage.map.size, 0);
});

test('clear is what discard and an acknowledged create both call', async () => {
  const storage = memory();
  const store = createEventDraftStore(storage);

  await store.save('user-1', draft());
  await store.clear('user-1');
  assert.equal(storage.map.size, 0);
  // Idempotent: a second clear on a key that is already gone is not an error.
  await store.clear('user-1');
});

test('a storage fault costs the draft, never the form', async () => {
  const broken: DraftStorage = {
    getItem: () => Promise.reject(new Error('keychain')),
    setItem: () => Promise.reject(new Error('keychain')),
    removeItem: () => Promise.reject(new Error('keychain')),
  };
  const store = createEventDraftStore(broken);

  assert.equal(await store.load('user-1'), null);
  await store.save('user-1', draft());
  await store.clear('user-1');
});

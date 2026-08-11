// tests/occasion.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/events/types.ts
function parseVenueMeta(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { latitude, longitude } = raw;
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
function myMemberState(members, currentUserId) {
  if (!currentUserId) return null;
  return members.find((m) => m.user_id === currentUserId)?.state ?? null;
}
function toEvent(row2, currentUserId) {
  return {
    id: row2.id,
    hostId: row2.host_id,
    title: row2.title,
    note: row2.note,
    occasion: row2.occasion,
    dressCode: row2.dress_code,
    startsAt: row2.starts_at ? new Date(row2.starts_at) : null,
    endsAt: row2.ends_at ? new Date(row2.ends_at) : null,
    partySize: row2.party_size,
    visibility: row2.visibility,
    venueName: row2.venue_name,
    venueAddress: row2.venue_address,
    venueMeta: parseVenueMeta(row2.venue_meta),
    reservationUrl: row2.reservation_url,
    canceledAt: row2.canceled_at ? new Date(row2.canceled_at) : null,
    isHost: currentUserId !== null && row2.host_id === currentUserId,
    myState: myMemberState(row2.event_members, currentUserId)
  };
}

// tests/occasion.test.ts
function row(overrides = {}) {
  return {
    id: "evt-1",
    host_id: "user-1",
    title: "Priya & Tom's wedding",
    note: null,
    occasion: null,
    dress_code: null,
    starts_at: "2026-08-09T16:00:00.000Z",
    ends_at: null,
    party_size: null,
    visibility: "invite_only",
    venue_name: null,
    venue_address: null,
    venue_meta: null,
    reservation_url: null,
    canceled_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    event_members: [],
    ...overrides
  };
}
test("a well-formed coordinate pair survives", () => {
  assert.deepEqual(parseVenueMeta({ latitude: 39.74, longitude: -104.99 }), {
    latitude: 39.74,
    longitude: -104.99
  });
});
test("the extra keys the writer stamps on are dropped, not carried", () => {
  assert.deepEqual(parseVenueMeta({ latitude: 0, longitude: 0, source: "open-meteo" }), {
    latitude: 0,
    longitude: 0
  });
});
test("null island is a real place, not a falsy one", () => {
  assert.notEqual(parseVenueMeta({ latitude: 0, longitude: 0 }), null);
});
test("anything that is not an object is refused", () => {
  for (const raw of [null, void 0, "Denver", 42, true, [39.74, -104.99]]) {
    assert.equal(parseVenueMeta(raw), null, `expected ${JSON.stringify(raw)} to be refused`);
  }
});
test("numeric strings are refused rather than coerced", () => {
  assert.equal(parseVenueMeta({ latitude: "39.74", longitude: "-104.99" }), null);
});
test("a half-written pair is refused", () => {
  assert.equal(parseVenueMeta({ latitude: 39.74 }), null);
  assert.equal(parseVenueMeta({ longitude: -104.99 }), null);
});
test("non-finite coordinates are refused", () => {
  assert.equal(parseVenueMeta({ latitude: NaN, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: Infinity }), null);
});
test("coordinates outside the globe are refused", () => {
  assert.equal(parseVenueMeta({ latitude: 91, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: -91, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: 181 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: -181 }), null);
});
test("the poles and the antimeridian are inside the globe", () => {
  assert.notEqual(parseVenueMeta({ latitude: 90, longitude: 180 }), null);
  assert.notEqual(parseVenueMeta({ latitude: -90, longitude: -180 }), null);
});
test("a dated occasion keeps its instant", () => {
  const event = toEvent(row(), "user-1");
  assert.equal(event.startsAt?.toISOString(), "2026-08-09T16:00:00.000Z");
});
test("an undated occasion stays undated \u2014 never the epoch", () => {
  const event = toEvent(row({ starts_at: null }), "user-1");
  assert.equal(event.startsAt, null);
});
test("a bad venue_meta blob leaves the occasion without coordinates", () => {
  const event = toEvent(
    row({ venue_meta: "nonsense", venue_name: "The Stanley" }),
    "user-1"
  );
  assert.equal(event.venueName, "The Stanley");
  assert.equal(event.venueMeta, null);
});
test("the host flag needs a signed-in caller, not just a matching id", () => {
  assert.equal(toEvent(row(), "user-1").isHost, true);
  assert.equal(toEvent(row(), "user-2").isHost, false);
  assert.equal(toEvent(row(), null).isHost, false);
});

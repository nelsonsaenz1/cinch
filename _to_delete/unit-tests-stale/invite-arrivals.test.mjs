// tests/invite-arrivals.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/explore/timeline.ts
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function sinceLabel(iso, now = /* @__PURE__ */ new Date()) {
  const at = new Date(iso);
  const then = at.getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) {
    const elapsed = now.getTime() - then;
    if (elapsed < MINUTE) return "Just now";
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
    return `${Math.max(1, Math.floor(elapsed / HOUR))}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return at.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

// src/features/invite/arrivals.ts
function str(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function toArrival(raw) {
  const userId = str(raw.user_id);
  if (!userId) return null;
  return {
    userId,
    displayName: str(raw.display_name),
    username: str(raw.username),
    joinedAt: str(raw.joined_at)
  };
}
function arrivalName(arrival) {
  return arrival.displayName ?? (arrival.username ? `@${arrival.username}` : "Someone new");
}
function firstNameOf(name) {
  return name.trim().split(/\s+/)[0] || name.trim();
}
function arrivalSubtitle(arrival, now = /* @__PURE__ */ new Date()) {
  if (!arrival.joinedAt) return null;
  const label = sinceLabel(arrival.joinedAt, now);
  if (!label) return null;
  return `Arrived ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

// tests/invite-arrivals.test.ts
var NOW = /* @__PURE__ */ new Date("2026-08-10T09:41:00Z");
test("a row without a user id is dropped, not rendered blank", () => {
  assert.equal(toArrival({ display_name: "Maya", username: "maya" }), null);
  assert.equal(toArrival({ user_id: "", display_name: "Maya" }), null);
  assert.equal(toArrival({ user_id: 42 }), null);
});
test("nullable columns survive narrowing as nulls", () => {
  const row = toArrival({ user_id: "u1", display_name: null, username: null, joined_at: null });
  assert.deepEqual(row, { userId: "u1", displayName: null, username: null, joinedAt: null });
});
test("the name falls through to the handle, then to a person", () => {
  assert.equal(
    arrivalName({ userId: "u", displayName: "Maya Rahman", username: "maya", joinedAt: null }),
    "Maya Rahman"
  );
  assert.equal(
    arrivalName({ userId: "u", displayName: null, username: "maya", joinedAt: null }),
    "@maya"
  );
  assert.equal(
    arrivalName({ userId: "u", displayName: null, username: null, joinedAt: null }),
    "Someone new"
  );
});
test("the subtitle reads as prose, and is absent rather than guessed", () => {
  const at = (iso) => ({ userId: "u", displayName: null, username: null, joinedAt: iso });
  assert.equal(arrivalSubtitle(at("2026-08-09T09:41:00Z"), NOW), "Arrived yesterday");
  assert.equal(arrivalSubtitle(at("2026-08-07T09:41:00Z"), NOW), "Arrived 3d ago");
  assert.equal(arrivalSubtitle(at("2026-08-10T09:40:30Z"), NOW), "Arrived just now");
  assert.equal(
    arrivalSubtitle({ userId: "u", displayName: "Maya", username: null, joinedAt: null }, NOW),
    null
  );
  assert.equal(arrivalSubtitle(at("not a date"), NOW), null);
});
test("the inviter is addressed by first name, whatever the name is", () => {
  assert.equal(firstNameOf("Sophie Meyer"), "Sophie");
  assert.equal(firstNameOf("  Sophie   Anne Meyer "), "Sophie");
  assert.equal(firstNameOf("@sophie"), "@sophie");
  assert.equal(firstNameOf("Sophie"), "Sophie");
});

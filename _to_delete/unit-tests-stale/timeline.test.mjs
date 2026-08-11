// tests/timeline.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/explore/timeline.ts
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function sinceLabel(iso2, now = /* @__PURE__ */ new Date()) {
  const at2 = new Date(iso2);
  const then = at2.getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((startOfDay(now) - startOfDay(at2)) / DAY);
  if (days <= 0) {
    const elapsed = now.getTime() - then;
    if (elapsed < MINUTE) return "Just now";
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
    return `${Math.max(1, Math.floor(elapsed / HOUR))}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return at2.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
function dayLabel(iso2, now = /* @__PURE__ */ new Date()) {
  const at2 = new Date(iso2);
  if (Number.isNaN(at2.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(at2)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  const weekday = at2.toLocaleDateString("en-US", { weekday: "short" });
  const month = at2.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${at2.getDate()} ${month}`;
}

// tests/timeline.test.ts
function at(y, m, d, h = 0, min = 0) {
  return new Date(y, m, d, h, min);
}
var iso = (d) => d.toISOString();
test("same-day entries keep the clock labels", () => {
  const now = at(2026, 7, 7, 14, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 13, 59)), now), "1 min ago");
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 13, 48)), now), "12 min ago");
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 9, 0)), now), "5h ago");
  assert.equal(sinceLabel(iso(new Date(now.getTime() - 3e4)), now), "Just now");
});
test("calendar yesterday says Yesterday even under 24 elapsed hours", () => {
  const now = at(2026, 7, 7, 9, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 6, 22, 0)), now), "Yesterday");
});
test("two calendar days is 2d ago even at 25 elapsed hours", () => {
  const now = at(2026, 7, 7, 0, 30);
  assert.equal(sinceLabel(iso(at(2026, 7, 5, 23, 30)), now), "2d ago");
});
test("midnight is the boundary in both directions", () => {
  assert.equal(
    sinceLabel(iso(at(2026, 7, 6, 23, 55)), at(2026, 7, 7, 0, 5)),
    "Yesterday"
  );
  assert.equal(
    sinceLabel(iso(at(2026, 7, 7, 0, 5)), at(2026, 7, 7, 23, 55)),
    "23h ago"
  );
});
test("2\u20136 calendar days count, 7 becomes a date", () => {
  const now = at(2026, 7, 7, 12, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 4, 12, 0)), now), "3d ago");
  assert.equal(sinceLabel(iso(at(2026, 7, 1, 23, 0)), now), "6d ago");
  const dated = sinceLabel(iso(at(2026, 6, 31, 12, 0)), now);
  assert.match(dated, /Jul/, `expected a dated label, got "${dated}"`);
  assert.match(dated, /31/, `expected a dated label, got "${dated}"`);
});
test("sinceLabel never contradicts the heading over it", () => {
  const now = at(2026, 7, 7, 9, 0);
  const samples = [
    at(2026, 7, 7, 8, 0),
    at(2026, 7, 6, 23, 59),
    at(2026, 7, 6, 0, 1),
    at(2026, 7, 5, 23, 59),
    at(2026, 7, 3, 12, 0)
  ];
  for (const sample of samples) {
    const heading = dayLabel(iso(sample), now);
    const mark = sinceLabel(iso(sample), now);
    assert.equal(
      mark === "Yesterday",
      heading === "Yesterday",
      `${iso(sample)}: heading "${heading}" vs mark "${mark}"`
    );
  }
});
test("an unparseable timestamp renders as nothing, not NaN", () => {
  assert.equal(sinceLabel("not-a-date"), "");
  assert.equal(dayLabel("not-a-date"), "");
});

// tests/privacy-format.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/privacy/format.ts
function exportStateOf(row2, now = /* @__PURE__ */ new Date()) {
  if (row2.status !== "ready") return row2.status;
  if (row2.expiresAt && new Date(row2.expiresAt).getTime() < now.getTime()) return "expired";
  return "ready";
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1e3) return `${Math.round(bytes)} bytes`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1e3;
  let unit = 0;
  while (value >= 1e3 && unit < units.length - 1) {
    value /= 1e3;
    unit += 1;
  }
  const shown = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${shown} ${units[unit]}`;
}
function shortDate(iso) {
  return new Date(iso).toLocaleDateString(void 0, { day: "numeric", month: "long" });
}
function earlierExportLine(row2, now = /* @__PURE__ */ new Date()) {
  const state = exportStateOf(row2, now);
  const size = row2.bytes != null && row2.bytes > 0 ? formatBytes(row2.bytes) : null;
  const tail = state === "expired" ? "link expired" : state === "ready" ? "emailed to you" : state === "failed" ? "did not finish" : "still being put together";
  return size ? `${size} \xB7 ${tail}` : tail;
}
function sentClause(tagged, listing) {
  if (tagged === 0 && listing === 0) return "No photo has left this phone.";
  const first = tagged === 0 ? "No photo has been sent for tagging." : `${tagged} ${tagged === 1 ? "photo" : "photos"} sent for tagging.`;
  if (listing === 0) return first;
  const second = `${listing} listing ${listing === 1 ? "search" : "searches"}, each of which sends a photo unless you searched by description alone.`;
  return `${first} ${second}`;
}
function consentStatusLine(granted, grantedAt, revokedAt, tagged, listing) {
  const sent = sentClause(tagged, listing);
  if (granted) {
    return grantedAt ? `On since ${shortDate(grantedAt)}. ${sent}` : `On. ${sent}`;
  }
  return revokedAt ? `Off since ${shortDate(revokedAt)}. ${sent}` : `Off. ${sent}`;
}

// tests/privacy-format.test.ts
var NOW = /* @__PURE__ */ new Date("2026-08-10T12:00:00Z");
function row(overrides) {
  return {
    id: "x",
    requestedAt: "2026-08-01T09:38:00Z",
    status: "ready",
    readyAt: "2026-08-01T10:02:00Z",
    bytes: 412e6,
    expiresAt: "2026-08-08T09:38:00Z",
    error: null,
    ...overrides
  };
}
test("a ready export whose expiry has passed reads as expired", () => {
  assert.equal(exportStateOf(row({}), NOW), "expired");
});
test("a ready export still inside its window reads as ready", () => {
  assert.equal(exportStateOf(row({ expiresAt: "2026-08-17T09:38:00Z" }), NOW), "ready");
});
test("a ready export with no expiry recorded is not called expired", () => {
  assert.equal(exportStateOf(row({ expiresAt: null }), NOW), "ready");
});
test("pending and failed are the column\u2019s own values and pass straight through", () => {
  assert.equal(exportStateOf(row({ status: "pending", expiresAt: null }), NOW), "pending");
  assert.equal(exportStateOf(row({ status: "failed" }), NOW), "failed");
});
test("bytes are formatted in the units the Files app uses", () => {
  assert.equal(formatBytes(412e6), "412 MB");
  assert.equal(formatBytes(124e7), "1.2 GB");
  assert.equal(formatBytes(884e3), "884 kB");
  assert.equal(formatBytes(512), "512 bytes");
});
test("a failed export shows no size rather than a measured-looking zero", () => {
  assert.equal(
    earlierExportLine(row({ status: "failed", bytes: null }), NOW),
    "did not finish"
  );
});
test("an expired export still names its real size", () => {
  assert.equal(earlierExportLine(row({}), NOW), "412 MB \xB7 link expired");
});
test("nothing sent says so plainly", () => {
  assert.equal(sentClause(0, 0), "No photo has left this phone.");
});
test("the listing count is never folded into the photo count", () => {
  const line = sentClause(12, 3);
  assert.match(line, /12 photos sent for tagging\./);
  assert.match(line, /3 listing searches/);
  assert.doesNotMatch(line, /15/);
});
test("a single send of either kind is singular", () => {
  assert.match(sentClause(1, 0), /1 photo sent for tagging\./);
  assert.match(sentClause(0, 1), /1 listing search/);
});
test("listing sends are still disclosed when nothing was ever tagged", () => {
  const line = sentClause(0, 3);
  assert.match(line, /No photo has been sent for tagging\./);
  assert.match(line, /3 listing searches/);
});
test("withdrawn consent still reports what was sent while it was on", () => {
  const line = consentStatusLine(false, null, "2026-07-28T00:00:00Z", 12, 3);
  assert.match(line, /^Off since /);
  assert.match(line, /12 photos sent for tagging\./);
});
test("a live consent with no recorded date does not invent one", () => {
  assert.equal(consentStatusLine(true, null, null, 0, 0), "On. No photo has left this phone.");
});

// tests/date.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/lib/date.ts
function dateKey(d) {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// tests/date.test.ts
function inZone(tz, fn) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === void 0) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
test("always returns a zero-padded YYYY-MM-DD", () => {
  for (const tz of ["Pacific/Honolulu", "UTC", "Pacific/Auckland"]) {
    inZone(tz, () => {
      for (const iso of ["2026-01-02T03:04:05Z", "2026-08-04T23:59:59Z", "2026-12-31T00:00:00Z"]) {
        const key = dateKey(new Date(iso));
        assert.match(key, ISO_DATE, `${tz} / ${iso} => ${key}`);
      }
    });
  }
});
test("uses the local calendar date, not the UTC one, at UTC-10", () => {
  inZone("Pacific/Honolulu", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-05T05:00:00Z")), "2026-08-04");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-05T10:00:00Z")), "2026-08-05");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-05T09:59:59.999Z")), "2026-08-04");
  });
});
test("uses the local calendar date, not the UTC one, at UTC+12", () => {
  inZone("Pacific/Auckland", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-04T20:00:00Z")), "2026-08-05");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-04T11:59:59Z")), "2026-08-04");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-08-04T12:00:00Z")), "2026-08-05");
  });
});
test("agrees with the UTC date when the process is in UTC", () => {
  inZone("UTC", () => {
    for (const iso of ["2026-08-04T00:00:00Z", "2026-08-04T23:59:59Z", "2026-02-28T12:00:00Z"]) {
      assert.equal(dateKey(new Date(iso)), iso.slice(0, 10));
    }
  });
});
test("survives a spring-forward DST boundary", () => {
  inZone("America/New_York", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-08T04:59:00Z")), "2026-03-07");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-08T05:00:00Z")), "2026-03-08");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-08T06:59:00Z")), "2026-03-08");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-08T07:00:00Z")), "2026-03-08");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-09T03:59:00Z")), "2026-03-08");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-03-09T04:00:00Z")), "2026-03-09");
  });
});
test("survives a fall-back DST boundary, where a local hour repeats", () => {
  inZone("America/New_York", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-11-01T05:30:00Z")), "2026-11-01");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-11-01T06:30:00Z")), "2026-11-01");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-11-02T04:59:00Z")), "2026-11-01");
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-11-02T05:00:00Z")), "2026-11-02");
  });
});
test("the same instant keys to three different days in three zones", () => {
  const instant = /* @__PURE__ */ new Date("2026-08-05T09:00:00Z");
  const keys = [];
  for (const tz of ["Pacific/Honolulu", "UTC", "Pacific/Auckland"]) {
    inZone(tz, () => keys.push(dateKey(instant)));
  }
  assert.deepEqual(keys, ["2026-08-04", "2026-08-05", "2026-08-05"]);
});
test("handles month and year rollovers in the local zone", () => {
  inZone("Pacific/Auckland", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2026-12-31T12:00:00Z")), "2027-01-01");
  });
  inZone("Pacific/Honolulu", () => {
    assert.equal(dateKey(/* @__PURE__ */ new Date("2027-01-01T05:00:00Z")), "2026-12-31");
  });
});
test("is stable \u2014 the same Date always produces the same key", () => {
  inZone("Europe/London", () => {
    const d = /* @__PURE__ */ new Date("2026-06-15T22:30:00Z");
    assert.equal(dateKey(d), dateKey(d));
    assert.equal(dateKey(d), "2026-06-15");
  });
});

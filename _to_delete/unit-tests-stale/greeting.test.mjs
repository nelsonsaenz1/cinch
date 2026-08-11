// tests/greeting.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/auth/greeting.ts
function greetingForHour(hour) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

// tests/greeting.test.ts
test("morning runs from five to noon", () => {
  assert.equal(greetingForHour(5), "Good morning");
  assert.equal(greetingForHour(9), "Good morning");
  assert.equal(greetingForHour(11), "Good morning");
});
test("afternoon runs from noon to six", () => {
  assert.equal(greetingForHour(12), "Good afternoon");
  assert.equal(greetingForHour(17), "Good afternoon");
});
test("evening covers the rest, small hours included", () => {
  assert.equal(greetingForHour(18), "Good evening");
  assert.equal(greetingForHour(23), "Good evening");
  assert.equal(greetingForHour(0), "Good evening");
  assert.equal(greetingForHour(4), "Good evening");
});

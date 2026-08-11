// tests/auth-email.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/auth/email.ts
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

// tests/auth-email.test.ts
test("a plain address parses", () => {
  assert.equal(isValidEmail("maya@hey.com"), true);
});
test("the atlas\u2019s own malformed example does not parse", () => {
  assert.equal(isValidEmail("maya@hey"), false);
});
test("surrounding whitespace and case do not count against an address", () => {
  assert.equal(isValidEmail("  Maya@Hey.com  "), true);
  assert.equal(normalizeEmail("  Maya@Hey.com  "), "maya@hey.com");
});
test("the empty and hopeless shapes do not parse", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("maya"), false);
  assert.equal(isValidEmail("@hey.com"), false);
  assert.equal(isValidEmail("maya@"), false);
  assert.equal(isValidEmail("maya@hey.c"), false);
  assert.equal(isValidEmail("maya ellison@hey.com"), false);
  assert.equal(isValidEmail("maya@hey com"), false);
});
test("subdomains, plus-tags and long TLDs parse", () => {
  assert.equal(isValidEmail("maya+cinch@mail.hey.com"), true);
  assert.equal(isValidEmail("maya@hey.fashion"), true);
});

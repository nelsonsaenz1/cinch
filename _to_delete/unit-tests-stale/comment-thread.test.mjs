// tests/comment-thread.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/event-outfits/comment-thread.ts
var COMMENT_MAX = 300;
var COUNT_FROM = 240;
function counterLabel(body) {
  if (body.length <= COUNT_FROM) return null;
  return `${body.length} / ${COMMENT_MAX}`;
}
var MENTION = /^@(\S+)\s?/;
function isReplyBody(body) {
  return MENTION.test(body);
}
function mentionOf(body) {
  return body.match(MENTION)?.[1] ?? null;
}
function splitMention(body) {
  const m = body.match(MENTION);
  if (!m) return null;
  return { mention: `@${m[1]}`, rest: body.slice(m[0].length) };
}
function withReplyPrefix(body, replyToFirstName) {
  if (!replyToFirstName) return body;
  return `@${replyToFirstName} ${body}`;
}

// tests/comment-thread.test.ts
test("counterLabel is silent until 240 characters", () => {
  assert.equal(counterLabel(""), null);
  assert.equal(counterLabel("a".repeat(240)), null);
  assert.equal(counterLabel("a".repeat(241)), "241 / 300");
  assert.equal(counterLabel("The tote is the right call".slice(0, 25)), null);
});
test("isReplyBody / mentionOf: a leading @token reads as a reply", () => {
  assert.equal(isReplyBody("@Dana tote it is."), true);
  assert.equal(mentionOf("@Dana tote it is."), "Dana");
  assert.equal(isReplyBody("Both, honestly. Bring the loafers."), false);
  assert.equal(mentionOf("Both, honestly. Bring the loafers."), null);
  assert.equal(isReplyBody("ask dana@example.com"), false);
});
test("splitMention separates the mention from the sentence for styling", () => {
  assert.deepEqual(splitMention("@Dana tote it is."), { mention: "@Dana", rest: "tote it is." });
  assert.equal(splitMention("No mention here"), null);
});
test("withReplyPrefix prepends the target, and is a no-op with none", () => {
  assert.equal(withReplyPrefix("tote it is.", "Dana"), "@Dana tote it is.");
  assert.equal(withReplyPrefix("Both, honestly.", null), "Both, honestly.");
});

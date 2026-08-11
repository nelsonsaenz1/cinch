// tests/push-channels.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// supabase/functions/send-push/channels.ts
var PUSH_CHANNELS = [
  "morning_edit",
  "friend_activity",
  "borrow_requests",
  "event_reminders",
  "votes_comments"
];
var CLAIM_FUNCTION = {
  morning_edit: "push_claim_morning_edit",
  friend_activity: "push_claim_friend_activity",
  borrow_requests: "push_claim_borrow_requests",
  event_reminders: "push_claim_event_reminders",
  votes_comments: "push_claim_votes_comments"
};

// tests/push-channels.test.ts
var SCHEMA = "supabase/migrations/20260810100300_push.sql";
var SENDERS = "supabase/migrations/20260810110100_push_senders.sql";
function channelsInCheckConstraint(sql) {
  const clause = /check\s*\(channel\s+in\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(clause, "push_sends has lost its channel CHECK constraint");
  return [...clause[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}
test("the sender ships exactly the channels the ledger will accept", () => {
  const check = channelsInCheckConstraint(readFileSync(SCHEMA, "utf8"));
  assert.deepEqual(
    [...PUSH_CHANNELS].sort(),
    [...check].sort(),
    `sender has [${PUSH_CHANNELS}], push_sends accepts [${check}]`
  );
});
test("every channel has a preference column of its own name", () => {
  const sql = readFileSync(SCHEMA, "utf8");
  const table = /create table notification_prefs \(([\s\S]*?)\n\);/.exec(sql);
  assert.ok(table, "notification_prefs is not where this test expects it");
  for (const channel of PUSH_CHANNELS) {
    assert.match(
      table[1],
      new RegExp(`\\n\\s*${channel}\\s+boolean`),
      `notification_prefs has no boolean column called ${channel}`
    );
  }
});
test("season in review is still cut", () => {
  assert.ok(
    !PUSH_CHANNELS.includes("season_in_review"),
    "season_in_review is being sent, but atlas 34 is deferred"
  );
});
test("every channel is dispatched to a claim function that exists", () => {
  const sql = readFileSync(SENDERS, "utf8");
  for (const channel of PUSH_CHANNELS) {
    const fn = CLAIM_FUNCTION[channel];
    assert.ok(fn, `${channel} has no claim function`);
    assert.match(
      sql,
      new RegExp(`create function ${fn}\\(\\)`),
      `${channel} dispatches to ${fn}(), which 20260810110100 does not define`
    );
  }
});

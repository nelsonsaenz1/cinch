// tests/invite-rows.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/events/invite-rows.ts
var STANDING = {
  host: "Hosting",
  joined: "Going",
  invited: "Still deciding",
  declined: "Can't make it"
};
function inviteRowFor(friend2, roster) {
  if (!roster) {
    return { ...friend2, standing: null, selectable: true, alreadyInvited: false };
  }
  return {
    ...friend2,
    standing: STANDING[roster.state],
    // Declined is the one already-invited state that stays selectable: asking
    // again is a decision the host makes deliberately, with the decline still
    // printed on the row rather than hidden by a fresh checkbox.
    selectable: roster.state === "declined",
    alreadyInvited: true
  };
}
function buildInviteRows(friends, roster) {
  const byUser = new Map(roster.map((r) => [r.userId, r]));
  return friends.map((f) => inviteRowFor(f, byUser.get(f.userId)));
}
function partitionInviteRows(rows) {
  return {
    alreadyInvited: rows.filter((r) => r.alreadyInvited),
    yourFriends: rows.filter((r) => !r.alreadyInvited)
  };
}
function filterInviteRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (r) => r.name.toLowerCase().includes(q) || (r.username ?? "").toLowerCase().includes(q)
  );
}
function everyoneAlreadyInvited(rows) {
  return rows.length > 0 && rows.every((r) => r.alreadyInvited);
}
function standingSummary(rows) {
  const going = rows.filter((r) => r.standing === "Going").length;
  const deciding = rows.filter((r) => r.standing === "Still deciding").length;
  const declined = rows.filter((r) => r.standing === "Can't make it").length;
  const numWord = (n) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][n] ?? String(n);
  const clauses = [];
  if (going > 0) clauses.push(`${numWord(going)} ${going === 1 ? "is" : "are"} going`);
  if (deciding > 0) clauses.push(`${numWord(deciding)} still deciding`);
  if (declined > 0) clauses.push(`${numWord(declined)} can\u2019t make it`);
  if (clauses.length === 0) return "";
  const sentence = clauses.join(", ") + ".";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
function joinNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
function sendResultTitle(outcomes) {
  const total = outcomes.length;
  const sent = outcomes.filter((o) => o.ok).length;
  if (sent === total) {
    return sent === 1 ? "One invitation sent." : `${countWord(sent)} invitations sent.`;
  }
  return `${sent} of ${total} went out`;
}
function sendResultBody(outcomes) {
  const sentNames = outcomes.filter((o) => o.ok).map((o) => o.name);
  if (sentNames.length === 0) return "";
  const names = joinNames(sentNames);
  return sentNames.length === 1 ? `${names} is on the list.` : `${names} are on the list.`;
}
function failedSends(outcomes) {
  return outcomes.filter((o) => !o.ok);
}
var COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
function countWord(n) {
  return COUNT_WORDS[n] ?? String(n);
}

// tests/invite-rows.test.ts
var friend = (userId, name, username = null) => ({
  userId,
  name,
  username
});
test("a plain friend gets a checkbox, never a word", () => {
  const rows = buildInviteRows([friend("1", "Deji Okonkwo", "deji")], []);
  assert.equal(rows[0].selectable, true);
  assert.equal(rows[0].standing, null);
  assert.equal(rows[0].alreadyInvited, false);
});
test("going and still-deciding print a word, never a checkbox", () => {
  const roster = [
    { userId: "1", state: "joined" },
    { userId: "2", state: "invited" }
  ];
  const rows = buildInviteRows(
    [friend("1", "Ada M\xE1rquez"), friend("2", "Hana Petrova")],
    roster
  );
  assert.equal(rows[0].standing, "Going");
  assert.equal(rows[0].selectable, false);
  assert.equal(rows[1].standing, "Still deciding");
  assert.equal(rows[1].selectable, false);
});
test("declined is the one already-invited row that stays selectable", () => {
  const rows = buildInviteRows(
    [friend("1", "Sena Ruiz")],
    [{ userId: "1", state: "declined" }]
  );
  assert.equal(rows[0].standing, "Can't make it");
  assert.equal(rows[0].selectable, true);
  assert.equal(rows[0].alreadyInvited, true);
});
test("the host row is a word, never removable, never a checkbox", () => {
  const rows = buildInviteRows([friend("1", "You")], [{ userId: "1", state: "host" }]);
  assert.equal(rows[0].standing, "Hosting");
  assert.equal(rows[0].selectable, false);
});
test("partition: already-invited and your-friends never overlap", () => {
  const rows = buildInviteRows(
    [friend("1", "Ada"), friend("2", "Deji")],
    [{ userId: "1", state: "joined" }]
  );
  const { alreadyInvited, yourFriends } = partitionInviteRows(rows);
  assert.equal(alreadyInvited.length, 1);
  assert.equal(alreadyInvited[0].userId, "1");
  assert.equal(yourFriends.length, 1);
  assert.equal(yourFriends[0].userId, "2");
});
test("filter matches name or username, case-insensitively, over the fetched list only", () => {
  const rows = buildInviteRows(
    [friend("1", "Nora Lindqvist", "nora"), friend("2", "Noor Bakhtiari", "noorb")],
    []
  );
  assert.deepEqual(
    filterInviteRows(rows, "no").map((r) => r.userId).sort(),
    ["1", "2"]
  );
  assert.deepEqual(filterInviteRows(rows, "NORA").map((r) => r.userId), ["1"]);
  assert.deepEqual(filterInviteRows(rows, "quinn"), []);
});
test("an empty query returns every row", () => {
  const rows = buildInviteRows([friend("1", "Ada"), friend("2", "Deji")], []);
  assert.equal(filterInviteRows(rows, "").length, 2);
  assert.equal(filterInviteRows(rows, "   ").length, 2);
});
test("everyoneAlreadyInvited: false with zero friends, true only when every row has a standing", () => {
  assert.equal(everyoneAlreadyInvited([]), false);
  const partlyInvitable = buildInviteRows(
    [friend("1", "Ada"), friend("2", "Deji")],
    [{ userId: "1", state: "joined" }]
  );
  assert.equal(everyoneAlreadyInvited(partlyInvitable), false);
  const allInvited = buildInviteRows(
    [friend("1", "Ada"), friend("2", "Deji")],
    [
      { userId: "1", state: "joined" },
      { userId: "2", state: "invited" }
    ]
  );
  assert.equal(everyoneAlreadyInvited(allInvited), true);
});
test("standingSummary matches the atlas sentence shape", () => {
  const rows = buildInviteRows(
    [friend("1", "A"), friend("2", "B"), friend("3", "C"), friend("4", "D"), friend("5", "E"), friend("6", "F")],
    [
      { userId: "1", state: "joined" },
      { userId: "2", state: "joined" },
      { userId: "3", state: "joined" },
      { userId: "4", state: "joined" },
      { userId: "5", state: "invited" },
      { userId: "6", state: "declined" }
    ]
  );
  assert.equal(standingSummary(rows), "Four are going, one still deciding, one can\u2019t make it.");
});
test("standingSummary omits empty clauses and is quiet on nothing to say", () => {
  const rows = buildInviteRows([friend("1", "A")], [{ userId: "1", state: "joined" }]);
  assert.equal(standingSummary(rows), "One is going.");
  assert.equal(standingSummary([]), "");
});
test("joinNames: the house join, no Oxford comma, singular and empty handled", () => {
  assert.equal(joinNames([]), "");
  assert.equal(joinNames(["Deji"]), "Deji");
  assert.equal(joinNames(["Deji", "Iris"]), "Deji and Iris");
  assert.equal(joinNames(["Deji", "Iris", "Noor"]), "Deji, Iris and Noor");
});
test("sendResultTitle and body: every send worked", () => {
  const outcomes = [
    { userId: "1", name: "Deji", ok: true },
    { userId: "2", name: "Iris", ok: true },
    { userId: "3", name: "Noor", ok: true }
  ];
  assert.equal(sendResultTitle(outcomes), "Three invitations sent.");
  assert.equal(sendResultBody(outcomes), "Deji, Iris and Noor are on the list.");
  assert.equal(failedSends(outcomes).length, 0);
});
test("sendResultTitle and body: a partial failure names who made it, not just a count", () => {
  const outcomes = [
    { userId: "1", name: "Deji", ok: true },
    { userId: "2", name: "Iris", ok: true },
    { userId: "3", name: "Noor", ok: false }
  ];
  assert.equal(sendResultTitle(outcomes), "2 of 3 went out");
  assert.equal(sendResultBody(outcomes), "Deji and Iris are on the list.");
  const failed = failedSends(outcomes);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].name, "Noor");
});
test("a single successful send is grammatically singular", () => {
  const outcomes = [{ userId: "1", name: "Deji", ok: true }];
  assert.equal(sendResultTitle(outcomes), "One invitation sent.");
  assert.equal(sendResultBody(outcomes), "Deji is on the list.");
});

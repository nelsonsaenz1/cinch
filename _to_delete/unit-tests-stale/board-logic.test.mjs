// tests/board-logic.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/event-outfits/board-logic.ts
function favouriteId(looks2, previousId) {
  const withVotes = looks2.filter((l) => l.votes > 0);
  if (withVotes.length === 0) return null;
  const max = Math.max(...withVotes.map((l) => l.votes));
  const leaders = withVotes.filter((l) => l.votes === max);
  if (leaders.length === 1) return leaders[0].id;
  if (previousId && leaders.some((l) => l.id === previousId)) return previousId;
  return null;
}
function applyPickMove(looks2, move) {
  if (move.fromPostId === move.toPostId) return [...looks2];
  return looks2.map((look) => {
    let votes = look.votes;
    if (move.fromPostId === look.id) votes -= 1;
    if (move.toPostId === look.id) votes += 1;
    return votes === look.votes ? look : { ...look, votes };
  });
}
function joinWithAnd(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
function pickLine(count, iVoted, otherNames) {
  if (count <= 0) return null;
  return { count, iVoted, otherNames: [...otherNames] };
}

// tests/board-logic.test.ts
var looks = (...votes) => votes.map((v, i) => ({ id: `l${i + 1}`, votes: v }));
test("favouriteId: a board with no votes crowns nothing", () => {
  assert.equal(favouriteId(looks(0, 0, 0), null), null);
  assert.equal(favouriteId([], null), null);
});
test("favouriteId: a clear leader is crowned regardless of history", () => {
  assert.equal(favouriteId(looks(3, 2, 2), null), "l1");
  assert.equal(favouriteId(looks(1, 5, 2), "l1"), "l2");
});
test("favouriteId: an initial tie crowns nobody", () => {
  assert.equal(favouriteId(looks(3, 3, 1), null), null);
});
test("favouriteId: a tie holds the crown where it was", () => {
  assert.equal(favouriteId(looks(3, 3, 1), "l1"), "l1");
});
test("favouriteId: the crown is dropped once its holder is no longer tied for the lead", () => {
  const withHistory = favouriteId(looks(2, 5, 1), "l1");
  assert.equal(withHistory, "l2");
});
test("favouriteId: a tie the previous crown is not part of stays uncrowned", () => {
  assert.equal(favouriteId(looks(4, 4, 1), "l3"), null);
});
test("applyPickMove: casting a first pick only increments the joined card", () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: null, toPostId: "l2" });
  assert.deepEqual(
    after.map((l) => l.votes),
    [3, 3]
  );
  assert.equal(after[0], before[0]);
});
test("applyPickMove: moving a pick decrements the left card and increments the joined one, in the same pass", () => {
  const before = looks(3, 2, 0);
  const after = applyPickMove(before, { fromPostId: "l1", toPostId: "l3" });
  assert.deepEqual(
    after.map((l) => l.votes),
    [2, 2, 1]
  );
});
test("applyPickMove: retracting only decrements the card left", () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: "l1", toPostId: null });
  assert.deepEqual(
    after.map((l) => l.votes),
    [2, 2]
  );
});
test("applyPickMove: a no-op move (same card) changes nothing and keeps every reference", () => {
  const before = looks(3, 2);
  const after = applyPickMove(before, { fromPostId: "l1", toPostId: "l1" });
  assert.deepEqual(after, before);
  assert.equal(after[0], before[0]);
  assert.equal(after[1], before[1]);
});
test('joinWithAnd: no Oxford comma, "and" only before the last name', () => {
  assert.equal(joinWithAnd([]), "");
  assert.equal(joinWithAnd(["Mel"]), "Mel");
  assert.equal(joinWithAnd(["Mel", "Tom"]), "Mel and Tom");
  assert.equal(joinWithAnd(["Mel", "Tom", "Priya"]), "Mel, Tom and Priya");
  assert.equal(joinWithAnd(["Dana", "Ben", "Tom", "Priya"]), "Dana, Ben, Tom and Priya");
});
test("pickLine: zero is quiet \u2014 no line at all when nobody has picked", () => {
  assert.equal(pickLine(0, false, []), null);
});
test('pickLine: "you" is carried separately from the joined rest', () => {
  const line = pickLine(3, true, ["Dana", "Ben"]);
  assert.deepEqual(line, { count: 3, iVoted: true, otherNames: ["Dana", "Ben"] });
});

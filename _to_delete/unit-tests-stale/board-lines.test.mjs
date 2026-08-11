// tests/board-lines.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/boards/board-lines.ts
function atNoon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}
var longMonth = (d) => d.toLocaleDateString(void 0, { month: "long" });
function isDatedBoard(board) {
  return board.startsOn != null && board.endsOn != null;
}
function formatBoardRange(startsOn, endsOn) {
  const a = atNoon(startsOn);
  const b = atNoon(endsOn);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === b.getDate()) return `${a.getDate()} ${longMonth(a)}`;
  if (sameMonth) return `${a.getDate()}\u2013${b.getDate()} ${longMonth(b)}`;
  if (sameYear) return `${a.getDate()} ${longMonth(a)} \u2013 ${b.getDate()} ${longMonth(b)}`;
  return `${a.getDate()} ${longMonth(a)} ${a.getFullYear()} \u2013 ${b.getDate()} ${longMonth(b)} ${b.getFullYear()}`;
}
var plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function wearLine(wornCount) {
  return wornCount > 0 ? `worn ${wornCount}\xD7` : "never worn";
}
function plateMeta(boardName, wornCount) {
  const wear = wearLine(wornCount);
  return boardName ? `${boardName} \xB7 ${wear}` : wear;
}
function plateTitle(plate2) {
  const name = plate2.name?.trim();
  if (name) return name;
  const occasion = plate2.occasion?.trim();
  return occasion ? occasion : null;
}
var allChipLabel = (total) => `All ${total}`;
function plateCountsByBoard(plates) {
  const counts = {};
  for (const plate2 of plates) {
    if (!plate2.boardId) continue;
    counts[plate2.boardId] = (counts[plate2.boardId] ?? 0) + 1;
  }
  return counts;
}
function platesOnBoard(plates, boardId) {
  return boardId === null ? [...plates] : plates.filter((p) => p.boardId === boardId);
}
function pieceCount(plates) {
  return distinctPieces(plates).length;
}
function distinctPieces(plates) {
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const plate2 of plates) {
    for (const id of plate2.itemIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}
function boardSummary(input) {
  const dates = isDatedBoard(input) ? formatBoardRange(input.startsOn, input.endsOn) : null;
  if (input.plateCount === 0) {
    return ["No plates yet", dates].filter(Boolean).join(" \xB7 ");
  }
  return [
    plural(input.plateCount, "plate", "plates"),
    dates,
    `${plural(input.pieceCount, "piece", "pieces")} in all`
  ].filter(Boolean).join(" \xB7 ");
}
var boardPlateCountLabel = (count) => plural(count, "plate", "plates");
var BOARD_NAME_MAX = 60;
function boardDraftProblem(draft2) {
  const name = draft2.name.trim();
  if (!name) return "empty-name";
  if (name.length > BOARD_NAME_MAX) return "long-name";
  const set = Number(draft2.startsOn != null) + Number(draft2.endsOn != null);
  if (set === 1) return "half-range";
  if (set === 2 && draft2.endsOn < draft2.startsOn) return "backwards-range";
  return null;
}

// tests/board-lines.test.ts
var month = (y, m) => new Date(y, m - 1, 15, 12).toLocaleDateString(void 0, { month: "long" });
test("a plate that has not been worn says so in words", () => {
  assert.equal(wearLine(0), "never worn");
  assert.notEqual(wearLine(0), "worn 0\xD7");
});
test("a worn plate prints the count it actually has", () => {
  assert.equal(wearLine(1), "worn 1\xD7");
  assert.equal(wearLine(6), "worn 6\xD7");
});
test("the meta line leads with the board, then the count", () => {
  assert.equal(plateMeta("Work", 6), "Work \xB7 worn 6\xD7");
  assert.equal(plateMeta("Weekends", 0), "Weekends \xB7 never worn");
});
test("a plate in All carries the count alone", () => {
  assert.equal(plateMeta(null, 2), "worn 2\xD7");
  assert.equal(plateMeta(null, 0), "never worn");
});
test("a plate is called what it was named, or what it was planned for", () => {
  assert.equal(plateTitle({ name: "Monday standard", occasion: "work" }), "Monday standard");
  assert.equal(plateTitle({ name: null, occasion: "Dinner, Alfama" }), "Dinner, Alfama");
  assert.equal(plateTitle({ name: "   ", occasion: "Flying" }), "Flying");
});
test("an unnamed, occasionless plate is never given a name", () => {
  assert.equal(plateTitle({ name: null, occasion: null }), null);
  assert.equal(plateTitle({ name: "", occasion: "  " }), null);
});
test("a board is dated only when both ends are set", () => {
  assert.equal(isDatedBoard({ startsOn: "2026-09-14", endsOn: "2026-09-19" }), true);
  assert.equal(isDatedBoard({ startsOn: null, endsOn: null }), false);
  assert.equal(isDatedBoard({ startsOn: "2026-09-14", endsOn: null }), false);
  assert.equal(isDatedBoard({ startsOn: null, endsOn: "2026-09-19" }), false);
});
test("a range inside one month says the month once", () => {
  assert.equal(formatBoardRange("2026-09-14", "2026-09-19"), `14\u201319 ${month(2026, 9)}`);
});
test("a range across months names both, and across years carries the years", () => {
  assert.equal(
    formatBoardRange("2026-09-28", "2026-10-03"),
    `28 ${month(2026, 9)} \u2013 3 ${month(2026, 10)}`
  );
  assert.equal(
    formatBoardRange("2026-12-28", "2027-01-03"),
    `28 ${month(2026, 12)} 2026 \u2013 3 ${month(2027, 1)} 2027`
  );
});
test("a single-day board is one date, not a range of one", () => {
  assert.equal(formatBoardRange("2026-09-14", "2026-09-14"), `14 ${month(2026, 9)}`);
});
var plate = (id, boardId, itemIds) => ({
  id,
  boardId,
  itemIds
});
var SET = [
  plate("p1", "work", ["trousers", "blouse", "loafers", "tote"]),
  plate("p2", "evening", ["coat", "trousers", "loafers"]),
  plate("p3", "weekends", ["skirt", "sweater", "loafers"]),
  plate("p4", "lisbon", ["blouse", "skirt", "tote"]),
  plate("p5", null, ["sweater", "trousers"])
];
test("the leading chip carries the size of the whole set", () => {
  assert.equal(allChipLabel(14), "All 14");
  assert.equal(allChipLabel(0), "All 0");
});
test("board counts ignore the plates that sit in All", () => {
  assert.deepEqual(plateCountsByBoard(SET), { work: 1, evening: 1, weekends: 1, lisbon: 1 });
});
test("All is every kept plate, a board is only its own", () => {
  assert.equal(platesOnBoard(SET, null).length, 5);
  assert.deepEqual(
    platesOnBoard(SET, "work").map((p) => p.id),
    ["p1"]
  );
  assert.deepEqual(platesOnBoard(SET, "nowhere"), []);
});
test("pieces in all are counted once each, however many looks share them", () => {
  assert.equal(pieceCount(SET), 7);
  assert.deepEqual(distinctPieces(SET.slice(0, 2)), [
    "trousers",
    "blouse",
    "loafers",
    "tote",
    "coat"
  ]);
});
test("the board summary drops the fragments it has nothing behind", () => {
  assert.equal(
    boardSummary({ plateCount: 4, pieceCount: 11, startsOn: "2026-09-14", endsOn: "2026-09-19" }),
    `4 plates \xB7 14\u201319 ${month(2026, 9)} \xB7 11 pieces in all`
  );
  assert.equal(
    boardSummary({ plateCount: 3, pieceCount: 7, startsOn: null, endsOn: null }),
    "3 plates \xB7 7 pieces in all"
  );
});
test("an empty board says so rather than printing a zero", () => {
  assert.equal(
    boardSummary({ plateCount: 0, pieceCount: 0, startsOn: null, endsOn: null }),
    "No plates yet"
  );
  assert.equal(
    boardSummary({ plateCount: 0, pieceCount: 0, startsOn: "2026-09-14", endsOn: "2026-09-19" }),
    `No plates yet \xB7 14\u201319 ${month(2026, 9)}`
  );
});
test("one of anything is singular", () => {
  assert.equal(
    boardSummary({ plateCount: 1, pieceCount: 1, startsOn: null, endsOn: null }),
    "1 plate \xB7 1 piece in all"
  );
  assert.equal(boardPlateCountLabel(1), "1 plate");
  assert.equal(boardPlateCountLabel(6), "6 plates");
});
var draft = (over) => ({
  name: "Lisbon",
  startsOn: null,
  endsOn: null,
  ...over
});
test("a board needs a name and nothing else", () => {
  assert.equal(boardDraftProblem(draft({})), null);
  assert.equal(boardDraftProblem(draft({ name: "   " })), "empty-name");
  assert.equal(boardDraftProblem(draft({ name: "x".repeat(61) })), "long-name");
  assert.equal(boardDraftProblem(draft({ name: "x".repeat(60) })), null);
});
test("dates are optional together \u2014 a half range is refused before the round trip", () => {
  assert.equal(boardDraftProblem(draft({ startsOn: "2026-09-14" })), "half-range");
  assert.equal(boardDraftProblem(draft({ endsOn: "2026-09-19" })), "half-range");
  assert.equal(boardDraftProblem(draft({ startsOn: "2026-09-14", endsOn: "2026-09-19" })), null);
});
test("a range that ends before it starts is refused", () => {
  assert.equal(
    boardDraftProblem(draft({ startsOn: "2026-09-19", endsOn: "2026-09-14" })),
    "backwards-range"
  );
  assert.equal(boardDraftProblem(draft({ startsOn: "2026-09-14", endsOn: "2026-09-14" })), null);
});

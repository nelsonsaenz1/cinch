// tests/intake-procession.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/intake/procession.ts
var UNDO_DEPTH = 3;
function initProcession(drafts, cursor) {
  return {
    drafts,
    cursor: Math.min(Math.max(cursor, 0), drafts.length),
    undo: []
  };
}
function currentDraft(state) {
  return state.drafts[state.cursor] ?? null;
}
function positionLabel(state) {
  return {
    index: Math.min(state.cursor + 1, state.drafts.length),
    total: state.drafts.length
  };
}
function isFinished(state) {
  return state.drafts.length > 0 && state.cursor >= state.drafts.length;
}
function confirmedCount(state) {
  return state.drafts.filter((d) => d.state === "confirmed").length;
}
function processionReducer(state, action) {
  switch (action.type) {
    case "confirm":
      return advance(state, { state: "confirmed" });
    // NOT a delete. The row stays, marked rejected, which is what makes this
    // undoable and what keeps the count in "23 pieces" honest about how many
    // things were actually heard.
    case "reject":
      return advance(state, { state: "rejected" });
    // An edit implies the card is now right, so it confirms too. Making someone
    // correct a card and THEN confirm it is a second tap for no information —
    // the correction is the confirmation.
    case "edit":
      return advance(state, { ...action.patch, state: "confirmed" });
    case "ambiguous":
      return advance(state, {
        quantity: Math.min(Math.max(Math.round(action.quantity), 1), 12),
        state: "confirmed"
      });
    // Step back WITHOUT changing anything. Distinct from undo: this is
    // navigation (the swipe-right gesture), and the card it lands on keeps
    // whatever state it already had.
    case "back":
      return state.cursor <= 0 ? state : { ...state, cursor: state.cursor - 1 };
    case "undo": {
      const [entry, ...rest] = state.undo;
      if (!entry) return state;
      return {
        cursor: entry.cursor,
        // Restored by id rather than by index: an undo that assumed position
        // would write the old draft over whatever happens to sit there now.
        drafts: state.drafts.map((d) => d.id === entry.draft.id ? entry.draft : d),
        undo: rest
      };
    }
  }
}
function advance(state, patch) {
  const draft2 = state.drafts[state.cursor];
  if (!draft2) return state;
  return {
    cursor: state.cursor + 1,
    drafts: state.drafts.map((d) => d.id === draft2.id ? { ...d, ...patch } : d),
    undo: [{ cursor: state.cursor, draft: draft2 }, ...state.undo].slice(0, UNDO_DEPTH)
  };
}

// src/features/intake/buckets.ts
function durationBucket(ms) {
  const minutes = ms / 6e4;
  if (minutes < 1) return "under_1m";
  if (minutes < 3) return "1_3m";
  if (minutes < 6) return "3_6m";
  return "6_12m";
}
function garmentBucket(count) {
  if (count <= 0) return "0";
  if (count < 10) return "1_9";
  if (count < 30) return "10_29";
  return "30_plus";
}
function cursorBucket(cursor, total) {
  if (total <= 0 || cursor <= 0) return "none";
  const share = cursor / total;
  if (share < 0.34) return "early";
  if (share < 0.67) return "half";
  return "most";
}

// tests/intake-procession.test.ts
function draft(ordinal, over = {}) {
  return {
    id: `d${ordinal}`,
    session_id: "s1",
    user_id: "u1",
    ordinal,
    utterance: `utterance ${ordinal}`,
    name: `garment ${ordinal}`,
    slot: "base_top",
    colour_term: "navy",
    colour_oklch: null,
    fabric: null,
    pattern: null,
    formality: null,
    warmth: null,
    quantity: 1,
    confidence: 0.9,
    state: "pending",
    image_path: null,
    // Required since the row type became the generated one — the migrations
    // reached production on 2026-08-10 and `gen:types` picked the table up.
    created_at: "2026-08-10T00:00:00Z",
    ...over
  };
}
var three = () => initProcession([draft(0), draft(1), draft(2)], 0);
test("confirm marks the card and moves on", () => {
  const s = processionReducer(three(), { type: "confirm" });
  assert.equal(s.drafts[0].state, "confirmed");
  assert.equal(s.cursor, 1);
  assert.equal(currentDraft(s)?.id, "d1");
});
test("reject marks rather than deletes", () => {
  const s = processionReducer(three(), { type: "reject" });
  assert.equal(s.drafts.length, 3, "the row survives");
  assert.equal(s.drafts[0].state, "rejected");
  assert.equal(confirmedCount(s), 0);
});
test("an edit confirms as well \u2014 the correction IS the confirmation", () => {
  const s = processionReducer(three(), { type: "edit", patch: { name: "cardigan" } });
  assert.equal(s.drafts[0].name, "cardigan");
  assert.equal(s.drafts[0].state, "confirmed");
  assert.equal(s.cursor, 1, "and does not leave the reader on the card they just fixed");
});
test("undo restores the previous card exactly and steps back to it", () => {
  const rejected = processionReducer(three(), { type: "reject" });
  const restored = processionReducer(rejected, { type: "undo" });
  assert.equal(restored.cursor, 0);
  assert.equal(restored.drafts[0].state, "pending", "the rejection is gone, not merely re-flagged");
  assert.equal(restored.undo.length, 0);
});
test("undo restores by id, not by position", () => {
  let s = three();
  s = processionReducer(s, { type: "confirm" });
  s = processionReducer(s, { type: "confirm" });
  s = processionReducer(s, { type: "confirm" });
  s = processionReducer(s, { type: "undo" });
  assert.equal(s.drafts[0].state, "confirmed");
  assert.equal(s.drafts[1].state, "confirmed");
  assert.equal(s.drafts[2].state, "pending");
});
test("the undo stack is bounded to three", () => {
  let s = initProcession([0, 1, 2, 3, 4].map((n) => draft(n)), 0);
  for (let i = 0; i < 5; i += 1) s = processionReducer(s, { type: "confirm" });
  assert.equal(s.undo.length, UNDO_DEPTH);
});
test("undo on an empty stack is a no-op, not a crash", () => {
  const s = three();
  assert.deepEqual(processionReducer(s, { type: "undo" }), s);
});
test("back steps without changing any card state", () => {
  const confirmed = processionReducer(three(), { type: "confirm" });
  const stepped = processionReducer(confirmed, { type: "back" });
  assert.equal(stepped.cursor, 0);
  assert.equal(stepped.drafts[0].state, "confirmed", "back does not undo");
});
test("back at the first card is a no-op", () => {
  const s = three();
  assert.deepEqual(processionReducer(s, { type: "back" }), s);
});
test("the procession finishes past the last card and then stops moving", () => {
  let s = three();
  for (let i = 0; i < 3; i += 1) s = processionReducer(s, { type: "confirm" });
  assert.ok(isFinished(s));
  assert.equal(currentDraft(s), null);
  const again = processionReducer(s, { type: "confirm" });
  assert.equal(again.cursor, 3);
  assert.equal(again.undo.length, s.undo.length);
});
test('the count reads "n of total" and never overruns it', () => {
  let s = three();
  assert.deepEqual(positionLabel(s), { index: 1, total: 3 });
  for (let i = 0; i < 3; i += 1) s = processionReducer(s, { type: "confirm" });
  assert.deepEqual(positionLabel(s), { index: 3, total: 3 });
});
test("quantity is clamped to the drafts CHECK", () => {
  const high = processionReducer(three(), { type: "ambiguous", quantity: 99 });
  assert.equal(high.drafts[0].quantity, 12);
  const low = processionReducer(three(), { type: "ambiguous", quantity: 0 });
  assert.equal(low.drafts[0].quantity, 1);
});
test("a resumed cursor past the end is clamped, not trusted", () => {
  const s = initProcession([draft(0), draft(1)], 99);
  assert.equal(s.cursor, 2, "the finished position, not past it");
  const negative = initProcession([draft(0), draft(1)], -4);
  assert.equal(negative.cursor, 0);
});
test("duration buckets band the recording rather than reporting it", () => {
  assert.equal(durationBucket(3e4), "under_1m");
  assert.equal(durationBucket(2 * 6e4), "1_3m");
  assert.equal(durationBucket(4 * 6e4), "3_6m");
  assert.equal(durationBucket(11 * 6e4), "6_12m");
});
test("garment buckets separate the sizes the thesis is argued in", () => {
  assert.equal(garmentBucket(0), "0");
  assert.equal(garmentBucket(9), "1_9");
  assert.equal(garmentBucket(29), "10_29");
  assert.equal(garmentBucket(30), "30_plus");
});
test("cursor buckets never reveal how many garments someone owns", () => {
  assert.equal(cursorBucket(0, 40), "none");
  assert.equal(cursorBucket(10, 40), "early");
  assert.equal(cursorBucket(20, 40), "half");
  assert.equal(cursorBucket(39, 40), "most");
  assert.equal(cursorBucket(3, 0), "none", "a zero total cannot divide");
});

// tests/activity-sentence.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/explore/timeline.ts
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function sinceLabel(iso, now = /* @__PURE__ */ new Date()) {
  const at = new Date(iso);
  const then = at.getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) {
    const elapsed = now.getTime() - then;
    if (elapsed < MINUTE) return "Just now";
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
    return `${Math.max(1, Math.floor(elapsed / HOUR))}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return at.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

// src/features/activity/sentence.ts
var GLYPH_FOR = {
  event_invite: "calendar",
  borrow_returned: "hanger",
  votes: "bars",
  compliment: "heart"
};
var ACTIONS = {
  "add-back": { id: "add-back", label: "Add back", tone: "solid", role: "answer" },
  "not-now": { id: "not-now", label: "Not now", tone: "outline", role: "answer" },
  lend: { id: "lend", label: "Lend it", tone: "solid", role: "answer" },
  "not-this-time": {
    id: "not-this-time",
    label: "Not this time",
    tone: "outline",
    role: "answer"
  },
  "open-event": { id: "open-event", label: "Open the event", tone: "outline", role: "destination" },
  "see-votes": { id: "see-votes", label: "See the votes", tone: "outline", role: "destination" },
  "see-closet": { id: "see-closet", label: "See her closet", tone: "outline", role: "destination" }
};
var ANSWER_COPY = {
  "add-back": { pending: "Adding back\u2026", done: "Added back \xB7 her closet is open to you" },
  "not-now": { pending: "Putting it away\u2026", done: "Not now \xB7 nothing was sent" },
  lend: { pending: "Lending\u2026", done: "Lent \xB7 she has been told" },
  "not-this-time": { pending: "Answering\u2026", done: "Not this time \xB7 she has been told" }
};
function answerCopy(id) {
  return ANSWER_COPY[id] ?? null;
}
var NEUTRAL_GARMENT = "piece";
var NEUTRAL_NAME = "A Cinch member";
var DAY2 = 24 * 60 * 6e4;
function startOfDay2(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function occasionWhen(iso, now = /* @__PURE__ */ new Date()) {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const days = Math.round((startOfDay2(at) - startOfDay2(now)) / DAY2);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 7) return at.toLocaleDateString("en-US", { weekday: "long" });
  return `${at.getDate()} ${at.toLocaleDateString("en-US", { month: "short" })}`;
}
function friendCount(tally) {
  if (tally === null || !Number.isFinite(tally) || tally < 1) return null;
  const n = Math.floor(tally);
  const words = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const word = n <= 9 ? words[n - 1] : String(n);
  return `${word} friend${n === 1 ? "" : "s"}`;
}
function name(subjects) {
  return subjects.actorName || NEUTRAL_NAME;
}
function garment(subjects) {
  return subjects.garment || NEUTRAL_GARMENT;
}
function segmentsFor(row2, subjects, now) {
  const who = { text: name(subjects), bold: true };
  switch (row2.kind) {
    case "follow_in":
      return [who, { text: " wants to be friends. Adding back opens your closet to each other." }];
    case "follow_back":
      return [who, { text: " added you back. Her closet is open to you." }];
    case "borrow_request": {
      const when = occasionWhen(subjects.eventStartsAt, now);
      return [who, { text: ` asked to borrow the ${garment(subjects)}${when ? ` for ${when}` : ""}.` }];
    }
    case "borrow_returned":
      return [who, { text: ` returned the ${garment(subjects)}. It is back in your closet.` }];
    case "event_invite": {
      const when = occasionWhen(subjects.eventStartsAt, now);
      const title = subjects.eventTitle;
      const head = title ? [who, { text: " invited you to " }, { text: title, bold: true }] : [who, { text: " invited you to an occasion" }];
      return [...head, { text: `${when ? `, ${when}` : ""}.` }];
    }
    case "votes": {
      const count = friendCount(row2.tally);
      const subject = count ? `${count} voted` : "Friends voted";
      const title = subjects.eventTitle;
      return title ? [{ text: `${subject} on your look for ` }, { text: title, bold: true }, { text: "." }] : [{ text: `${subject} on your look.` }];
    }
    case "compliment":
      return [
        who,
        {
          text: subjects.garment ? ` called your ${subjects.garment} a good call.` : " called your look a good call."
        }
      ];
  }
}
function actionsFor(row2) {
  switch (row2.kind) {
    case "follow_in":
      return row2.actorId ? [ACTIONS["add-back"], ACTIONS["not-now"]] : [];
    case "follow_back":
      return row2.actorId ? [ACTIONS["see-closet"]] : [];
    case "borrow_request":
      return [ACTIONS.lend, ACTIONS["not-this-time"]];
    case "event_invite":
      return row2.eventId ? [ACTIONS["open-event"]] : [];
    case "votes":
      return row2.eventId ? [ACTIONS["see-votes"]] : [];
    case "borrow_returned":
    case "compliment":
      return [];
  }
}
function describeActivity(row2, subjects, now = /* @__PURE__ */ new Date()) {
  const segments = segmentsFor(row2, subjects, now);
  return {
    key: `${row2.kind}:${row2.subjectKey}`,
    row: row2,
    mark: GLYPH_FOR[row2.kind] ? { kind: "glyph", glyph: GLYPH_FOR[row2.kind] } : { kind: "person", name: subjects.actorName },
    segments,
    elapsed: sinceLabel(row2.occurredAt, now),
    actions: actionsFor(row2),
    spoken: segments.map((s) => s.text).join("")
  };
}

// src/features/activity/retention.ts
function mergeRetained(feed, retained) {
  if (retained.length === 0) return [...feed];
  const live = new Set(feed.map((line2) => line2.key));
  const orphans = retained.filter((line2) => !live.has(line2.key));
  if (orphans.length === 0) return [...feed];
  const merged = [];
  let i = 0;
  let j = 0;
  while (i < feed.length && j < orphans.length) {
    const a = feed[i];
    const b = orphans[j];
    if (a.row.occurredAt >= b.row.occurredAt) {
      merged.push(a);
      i += 1;
    } else {
      merged.push(b);
      j += 1;
    }
  }
  while (i < feed.length) merged.push(feed[i++]);
  while (j < orphans.length) merged.push(orphans[j++]);
  return merged;
}
function hasUnseen(newestOccurredAt, seenAt) {
  if (!newestOccurredAt) return false;
  if (!seenAt) return true;
  return newestOccurredAt > seenAt;
}

// src/features/activity/types.ts
var ACTIVITY_KINDS = [
  "follow_in",
  "follow_back",
  "borrow_request",
  "borrow_returned",
  "event_invite",
  "votes",
  "compliment"
];

// tests/activity-sentence.test.ts
var NOW = new Date(2026, 7, 6, 9, 41);
var NONE = {
  actorName: null,
  garment: null,
  eventTitle: null,
  eventStartsAt: null
};
function row(kind, over = {}) {
  return {
    kind,
    subjectKey: "s-1",
    actorId: "u-1",
    occurredAt: new Date(NOW.getTime() - 2 * 36e5).toISOString(),
    itemId: null,
    outfitId: null,
    eventId: null,
    postId: null,
    tally: null,
    ...over
  };
}
var say = (line2) => line2.spoken;
test("a friend request says what adding back will do", () => {
  const line2 = describeActivity(row("follow_in"), { ...NONE, actorName: "Sam Okafor" }, NOW);
  assert.equal(
    say(line2),
    "Sam Okafor wants to be friends. Adding back opens your closet to each other."
  );
  assert.deepEqual(line2.segments[0], { text: "Sam Okafor", bold: true });
  assert.equal(line2.segments.filter((s) => s.bold).length, 1);
});
test("a mutual follow is news, not a request", () => {
  const line2 = describeActivity(row("follow_back"), { ...NONE, actorName: "Mara Whitfield" }, NOW);
  assert.equal(say(line2), "Mara Whitfield added you back. Her closet is open to you.");
  assert.deepEqual(
    line2.actions.map((a) => a.label),
    ["See her closet"]
  );
});
test("a borrow names the garment, and its occasion only when there is one", () => {
  const subjects = {
    ...NONE,
    actorName: "Nora Lindqvist",
    garment: "shearling coat",
    eventStartsAt: new Date(2026, 7, 7, 19).toISOString()
  };
  assert.equal(
    say(describeActivity(row("borrow_request", { itemId: "i-1", eventId: "e-1" }), subjects, NOW)),
    "Nora Lindqvist asked to borrow the shearling coat for tomorrow."
  );
  assert.equal(
    say(
      describeActivity(
        row("borrow_request", { itemId: "i-1" }),
        { ...subjects, eventStartsAt: null },
        NOW
      )
    ),
    "Nora Lindqvist asked to borrow the shearling coat."
  );
});
test("an invitation bolds the occasion as well as the host", () => {
  const line2 = describeActivity(
    row("event_invite", { eventId: "e-1" }),
    {
      ...NONE,
      actorName: "Mara Whitfield",
      eventTitle: "Sunday lunch",
      eventStartsAt: new Date(2026, 7, 14, 13).toISOString()
    },
    NOW
  );
  assert.equal(say(line2), "Mara Whitfield invited you to Sunday lunch, 14 Aug.");
  assert.deepEqual(
    line2.segments.filter((s) => s.bold).map((s) => s.text),
    ["Mara Whitfield", "Sunday lunch"]
  );
});
test("votes are aggregated per look and name no voter", () => {
  const line2 = describeActivity(
    row("votes", { actorId: null, eventId: "e-1", postId: "p-1", tally: 3 }),
    { ...NONE, eventTitle: "Wednesday supper" },
    NOW
  );
  assert.equal(say(line2), "Three friends voted on your look for Wednesday supper.");
  assert.deepEqual(line2.mark, { kind: "glyph", glyph: "bars" });
  assert.deepEqual(
    line2.actions.map((a) => a.label),
    ["See the votes"]
  );
});
test('one vote is one friend, not "1 friends"', () => {
  const line2 = describeActivity(
    row("votes", { actorId: null, eventId: "e-1", tally: 1 }),
    { ...NONE, eventTitle: "Wednesday supper" },
    NOW
  );
  assert.equal(say(line2), "One friend voted on your look for Wednesday supper.");
});
test("a missing tally drops the count rather than estimating one", () => {
  const line2 = describeActivity(
    row("votes", { actorId: null, eventId: "e-1", tally: null }),
    { ...NONE, eventTitle: "Wednesday supper" },
    NOW
  );
  assert.equal(say(line2), "Friends voted on your look for Wednesday supper.");
  assert.equal(friendCount(null), null);
  assert.equal(friendCount(0), null);
  assert.equal(friendCount(12), "12 friends");
});
test("a compliment on an outfit does not pretend to name a garment", () => {
  assert.equal(
    say(describeActivity(row("compliment"), { ...NONE, actorName: "Sam Okafor" }, NOW)),
    "Sam Okafor called your look a good call."
  );
  assert.equal(
    say(
      describeActivity(
        row("compliment", { itemId: "i-1" }),
        { ...NONE, actorName: "Sam Okafor", garment: "shearling coat" },
        NOW
      )
    ),
    "Sam Okafor called your shearling coat a good call."
  );
});
test("an unresolved name or garment still makes a true sentence", () => {
  const line2 = describeActivity(row("borrow_request", { itemId: "i-1" }), NONE, NOW);
  assert.equal(say(line2), "A Cinch member asked to borrow the piece.");
  assert.ok(!say(line2).includes("undefined"));
  assert.ok(!say(line2).includes("null"));
});
test("every kind produces a sentence, with no exclamation marks", () => {
  for (const kind of ACTIVITY_KINDS) {
    const line2 = describeActivity(row(kind, { itemId: "i-1", eventId: "e-1", tally: 2 }), NONE, NOW);
    assert.ok(line2.spoken.length > 0, kind);
    assert.ok(!line2.spoken.includes("!"), kind);
    assert.equal(line2.key, `${kind}:s-1`);
  }
});
test("initials when a person did it, the object glyph when the app reports it", () => {
  const person = ["follow_in", "follow_back", "borrow_request"];
  for (const kind of person) {
    assert.deepEqual(
      describeActivity(row(kind), { ...NONE, actorName: "Nora Lindqvist" }, NOW).mark,
      { kind: "person", name: "Nora Lindqvist" },
      kind
    );
  }
  const glyphs = [
    ["event_invite", "calendar"],
    ["borrow_returned", "hanger"],
    ["votes", "bars"],
    ["compliment", "heart"]
  ];
  for (const [kind, glyph] of glyphs) {
    assert.deepEqual(
      describeActivity(row(kind), { ...NONE, actorName: "Nora Lindqvist" }, NOW).mark,
      { kind: "glyph", glyph },
      kind
    );
  }
});
test('"Decline" does not exist on a friend request \u2014 the second button is "Not now"', () => {
  const line2 = describeActivity(row("follow_in"), { ...NONE, actorName: "Sam Okafor" }, NOW);
  assert.deepEqual(
    line2.actions.map((a) => a.label),
    ["Add back", "Not now"]
  );
  for (const kind of ACTIVITY_KINDS) {
    const labels = describeActivity(row(kind, { eventId: "e-1" }), NONE, NOW).actions.map(
      (a) => a.label
    );
    assert.ok(!labels.includes("Decline"), kind);
  }
});
test('"Not now" says nothing was sent; the borrow answers say she was told', () => {
  assert.equal(answerCopy("not-now")?.done, "Not now \xB7 nothing was sent");
  assert.match(answerCopy("not-this-time")?.done ?? "", /she has been told/);
  assert.match(answerCopy("lend")?.done ?? "", /she has been told/);
  assert.equal(answerCopy("add-back")?.done, "Added back \xB7 her closet is open to you");
  assert.equal(answerCopy("open-event"), null);
});
test("the affirmative is solid and there is never more than one per row", () => {
  for (const kind of ACTIVITY_KINDS) {
    const actions = describeActivity(row(kind, { eventId: "e-1" }), NONE, NOW).actions;
    assert.ok(actions.length <= 2, kind);
    assert.ok(actions.filter((a) => a.tone === "solid").length <= 1, kind);
  }
});
test("compliments and returns carry nothing at all", () => {
  for (const kind of ["compliment", "borrow_returned"]) {
    assert.deepEqual(describeActivity(row(kind, { itemId: "i-1" }), NONE, NOW).actions, [], kind);
  }
});
test("a destination with no id to reach is not offered", () => {
  assert.deepEqual(describeActivity(row("event_invite", { eventId: null }), NONE, NOW).actions, []);
  assert.deepEqual(describeActivity(row("votes", { eventId: null }), NONE, NOW).actions, []);
  assert.deepEqual(describeActivity(row("follow_back", { actorId: null }), NONE, NOW).actions, []);
});
test("an occasion says today, tomorrow, a weekday, then a date", () => {
  assert.equal(occasionWhen(new Date(2026, 7, 6, 20).toISOString(), NOW), "today");
  assert.equal(occasionWhen(new Date(2026, 7, 7, 20).toISOString(), NOW), "tomorrow");
  assert.equal(occasionWhen(new Date(2026, 7, 9, 20).toISOString(), NOW), "Sunday");
  assert.equal(occasionWhen(new Date(2026, 7, 14, 13).toISOString(), NOW), "14 Aug");
  assert.equal(occasionWhen(new Date(2026, 7, 13, 20).toISOString(), NOW), "13 Aug");
  assert.equal(occasionWhen(new Date(2026, 7, 4, 20).toISOString(), NOW), "4 Aug");
  assert.equal(occasionWhen(null, NOW), null);
});
test("the elapsed label speaks Lately\u2019s clock", () => {
  assert.equal(describeActivity(row("follow_in"), NONE, NOW).elapsed, "2h ago");
  assert.equal(
    describeActivity(row("follow_in", { occurredAt: new Date(2026, 7, 5, 20).toISOString() }), NONE, NOW).elapsed,
    "Yesterday"
  );
});
function line(key, occurredAt) {
  return describeActivity(row("follow_in", { subjectKey: key, occurredAt }), NONE, NOW);
}
test("an answered row that has left the feed goes back where it was", () => {
  const a = line("a", "2026-08-06T09:00:00Z");
  const b = line("b", "2026-08-06T07:00:00Z");
  const c = line("c", "2026-08-06T05:00:00Z");
  const merged = mergeRetained([a, c], [b]);
  assert.deepEqual(
    merged.map((l) => l.key),
    ["follow_in:a", "follow_in:b", "follow_in:c"]
  );
});
test("a retained row still in the feed is not duplicated", () => {
  const a = line("a", "2026-08-06T09:00:00Z");
  const b = line("b", "2026-08-06T07:00:00Z");
  assert.deepEqual(
    mergeRetained([a, b], [b]).map((l) => l.key),
    ["follow_in:a", "follow_in:b"]
  );
  assert.deepEqual(mergeRetained([a, b], []).map((l) => l.key), ["follow_in:a", "follow_in:b"]);
});
test("the dot is a boolean, and an empty feed never lights it", () => {
  assert.equal(hasUnseen(null, null), false);
  assert.equal(hasUnseen(null, "2026-08-06T09:00:00Z"), false);
  assert.equal(hasUnseen("2026-08-06T09:00:00Z", null), true);
  assert.equal(hasUnseen("2026-08-06T09:00:00Z", "2026-08-06T08:00:00Z"), true);
  assert.equal(hasUnseen("2026-08-06T09:00:00Z", "2026-08-06T09:00:00Z"), false);
  assert.equal(hasUnseen("2026-08-06T09:00:00Z", "2026-08-06T10:00:00Z"), false);
});

// tests/notification-channels.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/push/channels.ts
var MORNING_EDIT_SLOTS = [
  { value: "06:30:00", label: "6:30" },
  { value: "07:00:00", label: "7:00" },
  { value: "07:30:00", label: "7:30" },
  { value: "08:00:00", label: "8:00" }
];
var DEFAULT_MORNING_EDIT_TIME = "07:30:00";
function morningEditLabel(value) {
  return MORNING_EDIT_SLOTS.find((slot) => slot.value === value)?.label ?? "7:30";
}
function normalizeMorningEditTime(raw) {
  if (!raw) return DEFAULT_MORNING_EDIT_TIME;
  const hhmm = raw.slice(0, 5);
  const match = MORNING_EDIT_SLOTS.find((slot) => slot.value.slice(0, 5) === hhmm);
  return match ? match.value : DEFAULT_MORNING_EDIT_TIME;
}
function morningEditDescription(at) {
  return `One notification at ${morningEditLabel(at)}am, when the day\u2019s look is ready to read. Nothing else arrives in the morning.`;
}
var NOTIFICATION_CHANNELS = [
  {
    key: "morning_edit",
    group: "cinch",
    // Frozen at the default slot. `morningEditDescription` is what the screen
    // renders; this is what Unit X's sender is checked against, and the test
    // holds the two together.
    description: morningEditDescription(DEFAULT_MORNING_EDIT_TIME),
    title: "Morning edit",
    defaultOn: true
  },
  {
    key: "friend_activity",
    group: "cinch",
    title: "Friend activity",
    description: "When someone you added adds you back, or adds a piece to their closet.",
    defaultOn: true
  },
  {
    key: "borrow_requests",
    group: "cinch",
    title: "Borrow requests",
    description: "When a friend asks for something of yours, and when they return it.",
    defaultOn: true
  },
  {
    key: "event_reminders",
    group: "cinch",
    title: "Event reminders",
    description: "The evening before an event you are going to, once.",
    defaultOn: true
  },
  {
    key: "votes_comments",
    group: "friends",
    title: "Votes and comments",
    description: "When friends weigh in on a look you asked about.",
    defaultOn: false
  }
];
var DEFAULT_NOTIFICATION_PREFS = {
  ...Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [channel.key, channel.defaultOn])
  ),
  morningEditAt: DEFAULT_MORNING_EDIT_TIME
};
function prefsFromRow(row) {
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  return {
    morning_edit: row.morning_edit,
    friend_activity: row.friend_activity,
    borrow_requests: row.borrow_requests,
    event_reminders: row.event_reminders,
    votes_comments: row.votes_comments,
    morningEditAt: normalizeMorningEditTime(row.morning_edit_at)
  };
}
function rowFromPrefs(prefs) {
  return {
    morning_edit: prefs.morning_edit,
    friend_activity: prefs.friend_activity,
    borrow_requests: prefs.borrow_requests,
    event_reminders: prefs.event_reminders,
    votes_comments: prefs.votes_comments,
    morning_edit_at: prefs.morningEditAt
  };
}
function allChannelsOff(prefs) {
  return NOTIFICATION_CHANNELS.every((channel) => !prefs[channel.key]);
}

// tests/notification-channels.test.ts
var MIGRATION_DEFAULTS = {
  morning_edit: true,
  friend_activity: true,
  borrow_requests: true,
  event_reminders: true,
  votes_comments: false
};
var MIGRATION_TIME_SLOTS = ["06:30", "07:00", "07:30", "08:00"];
test("every channel has a column, and every column has a channel", () => {
  const keys = NOTIFICATION_CHANNELS.map((c) => c.key).sort();
  assert.deepEqual(
    keys,
    Object.keys(MIGRATION_DEFAULTS).sort(),
    "the channel table and notification_prefs must name the same set of channels"
  );
});
test("the defaults are the atlas rule: on by default, except votes", () => {
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal(
      channel.defaultOn,
      MIGRATION_DEFAULTS[channel.key],
      `${channel.key}: the table says ${channel.defaultOn}, the migration says ${MIGRATION_DEFAULTS[channel.key]}`
    );
  }
  const off = NOTIFICATION_CHANNELS.filter((c) => !c.defaultOn).map((c) => c.key);
  assert.deepEqual(off, ["votes_comments"]);
});
test("Season in review is not a channel, and neither is anything for marketing", () => {
  const keys = NOTIFICATION_CHANNELS.map((c) => c.key);
  assert.ok(!keys.includes("season_in_review"));
  const prose = NOTIFICATION_CHANNELS.map((c) => `${c.title} ${c.description}`).join(" ");
  assert.ok(!/season/i.test(prose), "no channel may mention a season while atlas 34 is deferred");
  assert.ok(!/offer|tip|deal|discount|come back/i.test(prose));
});
test("the morning edit never promises to carry the day\u2019s look", () => {
  const morning = NOTIFICATION_CHANNELS.find((c) => c.key === "morning_edit");
  assert.ok(morning);
  assert.ok(
    !/with the day’s look|with the day's look/.test(morning.description),
    "the morning edit may not claim to contain the look"
  );
  assert.equal(
    morning.description,
    "One notification at 7:30am, when the day\u2019s look is ready to read. Nothing else arrives in the morning."
  );
});
test("the printed description carries whatever hour the reader chose", () => {
  assert.match(morningEditDescription("06:30:00"), /at 6:30am,/);
  assert.match(morningEditDescription("08:00:00"), /at 8:00am,/);
  const morning = NOTIFICATION_CHANNELS.find((c) => c.key === "morning_edit");
  assert.equal(
    morning?.description,
    morningEditDescription(DEFAULT_MORNING_EDIT_TIME),
    "the frozen table entry must be the default slot rendered through the same function"
  );
});
test("the four send times are the four the database will accept", () => {
  assert.deepEqual(
    MORNING_EDIT_SLOTS.map((s) => s.value.slice(0, 5)),
    MIGRATION_TIME_SLOTS
  );
  assert.equal(DEFAULT_MORNING_EDIT_TIME, "07:30:00");
  assert.deepEqual(
    MORNING_EDIT_SLOTS.map((s) => s.label),
    ["6:30", "7:00", "7:30", "8:00"]
  );
});
test("a time from the server is coerced to a slot, never printed raw", () => {
  assert.equal(normalizeMorningEditTime("07:00:00"), "07:00:00");
  assert.equal(normalizeMorningEditTime("07:00"), "07:00:00");
  assert.equal(normalizeMorningEditTime("06:30:00+00"), "06:30:00");
  assert.equal(normalizeMorningEditTime("09:15:00"), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(normalizeMorningEditTime(null), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(normalizeMorningEditTime(void 0), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(morningEditLabel("07:30:00"), "7:30");
});
test("no row means the defaults, not silence", () => {
  assert.deepEqual(prefsFromRow(null), DEFAULT_NOTIFICATION_PREFS);
  assert.deepEqual(prefsFromRow(void 0), DEFAULT_NOTIFICATION_PREFS);
  assert.equal(allChannelsOff(DEFAULT_NOTIFICATION_PREFS), false);
});
test("a row round-trips through the app\u2019s casing without losing a field", () => {
  const row = {
    morning_edit: false,
    morning_edit_at: "08:00:00",
    friend_activity: true,
    borrow_requests: false,
    event_reminders: true,
    votes_comments: true
  };
  assert.deepEqual(rowFromPrefs(prefsFromRow(row)), row);
});
test("NP-02 is every channel false, computed over the table", () => {
  const off = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const channel of NOTIFICATION_CHANNELS) off[channel.key] = false;
  assert.equal(allChannelsOff(off), true);
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal(
      allChannelsOff({ ...off, [channel.key]: true }),
      false,
      `${channel.key} on should keep the quiet note away`
    );
  }
});

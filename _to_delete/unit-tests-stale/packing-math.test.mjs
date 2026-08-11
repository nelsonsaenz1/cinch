// tests/packing-math.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/plan/trip.ts
var VIBES = [
  { key: "warm-city", label: "Warm city", phrase: "a warm city", formality: 3 },
  { key: "work", label: "Work", phrase: "work", formality: 4 },
  { key: "long-dinners", label: "Long dinners", phrase: "long dinners", formality: 4 },
  { key: "beach", label: "Beach", phrase: "the beach", formality: 2 },
  { key: "wedding", label: "Wedding", phrase: "a wedding", formality: 5 },
  { key: "walking", label: "A lot of walking", phrase: "a lot of walking", formality: 2 }
];
var DAY_PARTS = [
  { key: "daytime", label: "Daytime", title: "Day", phrase: "daytime", formalityOffset: 0 },
  { key: "evening", label: "Evening", title: "Night", phrase: "evenings", formalityOffset: 1 },
  { key: "gym", label: "Gym", title: "Gym", phrase: "the gym", formalityOffset: -2 },
  {
    key: "travel",
    label: "Travel days",
    title: "Travel",
    phrase: "travel days",
    formalityOffset: -1
  }
];
var toIsoDate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
var fromIsoDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
};
var addDays = (iso, n) => {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
};
function daysBetween(startsOn, endsOn) {
  const ms = fromIsoDate(endsOn).getTime() - fromIsoDate(startsOn).getTime();
  return Math.max(1, Math.round(ms / 864e5) + 1);
}
function formatDateRange(startsOn, endsOn) {
  const a = fromIsoDate(startsOn);
  const b = fromIsoDate(endsOn);
  const month = (d) => d.toLocaleDateString(void 0, { month: "short" });
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth ? `${a.getDate()}\u2013${b.getDate()} ${month(b)}` : `${a.getDate()} ${month(a)} \u2013 ${b.getDate()} ${month(b)}`;
}
var describeDates = (startsOn, endsOn) => {
  const days = daysBetween(startsOn, endsOn);
  return `${formatDateRange(startsOn, endsOn)} \xB7 ${days} ${days === 1 ? "day" : "days"}`;
};

// src/features/plan/packing-math.ts
var looksForPart = (days, part) => part === "travel" ? Math.min(2, days) : days;
var looksFor = (days, parts) => parts.reduce((total, part) => total + looksForPart(days, part), 0);
var LOOK_ORDER = ["travel", "gym", "daytime", "evening"];
function lookSchedule(startsOn, days, parts) {
  const wanted = LOOK_ORDER.filter((p) => parts.includes(p));
  const looks = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const date = addDays(startsOn, dayIndex);
    for (const part of wanted) {
      if (part === "travel" && !isTravelDay(dayIndex, days)) continue;
      looks.push({ dayIndex, date, part });
    }
  }
  return looks;
}
var isTravelDay = (dayIndex, days) => dayIndex === 0 || dayIndex === days - 1;
var WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
];
var spellOut = (n) => WORDS[n] ?? String(n);
var word = spellOut;
var sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function looksSentence(days, parts) {
  const looks = looksFor(days, parts);
  const partCount = parts.length;
  return `${sentenceCase(word(partCount))} day ${partCount === 1 ? "part" : "parts"} across ${word(days)} ${days === 1 ? "day" : "days"} is ${word(looks)} ${looks === 1 ? "look" : "looks"}.`;
}
function repeatLabel(days, worn) {
  return worn ? "worn" : `\xD7${days}`;
}

// tests/packing-math.test.ts
test("K-03: two day parts across four days is eight looks", () => {
  assert.equal(looksFor(4, ["daytime", "evening"]), 8);
});
test("K-05 promises the same eight looks K-03 counted", () => {
  const parts = ["daytime", "evening"];
  const schedule = lookSchedule("2026-09-12", 4, parts);
  assert.equal(schedule.length, looksFor(4, parts));
});
test("travel days are two, however long the trip is", () => {
  for (const days of [2, 3, 4, 7, 14]) {
    assert.equal(looksForPart(days, "travel"), 2, `${days}-day trip`);
  }
  assert.equal(looksForPart(1, "travel"), 1);
});
test("every other part is one look per day", () => {
  for (const part of ["daytime", "evening", "gym"]) {
    assert.equal(looksForPart(6, part), 6, part);
  }
});
test("adding travel to four days adds two looks, not four", () => {
  const without = looksFor(4, ["daytime", "evening"]);
  const with_ = looksFor(4, ["daytime", "evening", "travel"]);
  assert.equal(with_ - without, 2);
});
test("the schedule is day-major and starts on the first day", () => {
  const looks = lookSchedule("2026-09-12", 4, ["daytime", "evening"]);
  assert.equal(looks[0].date, "2026-09-12");
  assert.equal(looks[0].dayIndex, 0);
  assert.equal(looks[1].dayIndex, 0, "both of day one come before day two");
  assert.equal(looks[2].dayIndex, 1);
  assert.equal(looks.at(-1).date, "2026-09-15");
});
test("a travel look lands only on the first and last day", () => {
  const looks = lookSchedule("2026-09-12", 4, ["daytime", "travel"]);
  const travelDays = looks.filter((l) => l.part === "travel").map((l) => l.dayIndex);
  assert.deepEqual(travelDays, [0, 3]);
});
test("a look is worn in the order the day happens, not the order it was asked", () => {
  const looks = lookSchedule("2026-09-12", 2, ["evening", "daytime", "gym", "travel"]);
  const firstDay = looks.filter((l) => l.dayIndex === 0).map((l) => l.part);
  assert.deepEqual(firstDay, ["travel", "gym", "daytime", "evening"]);
});
test("the first and last day are travel days whether or not travel was tapped", () => {
  assert.ok(isTravelDay(0, 4));
  assert.ok(isTravelDay(3, 4));
  assert.ok(!isTravelDay(1, 4));
  assert.ok(!isTravelDay(2, 4));
});
test("an unasked-for part never produces a look", () => {
  const looks = lookSchedule("2026-09-12", 3, ["daytime"]);
  assert.ok(looks.every((l) => l.part === "daytime"));
  assert.equal(looks.length, 3);
});
test("K-03: 12\u201315 September is four days", () => {
  assert.equal(daysBetween("2026-09-12", "2026-09-15"), 4);
  const line = describeDates("2026-09-12", "2026-09-15");
  assert.ok(line.startsWith("12\u201315 "), line);
  assert.ok(line.endsWith(" \xB7 4 days"), line);
  assert.match(line, /^12–15 \S+ · 4 days$/, line);
});
test("a single day is one day, not zero", () => {
  assert.equal(daysBetween("2026-09-12", "2026-09-12"), 1);
  assert.ok(describeDates("2026-09-12", "2026-09-12").endsWith("1 day"));
});
test("a range spanning two months says both", () => {
  const s = formatDateRange("2026-08-30", "2026-09-02");
  assert.ok(s.includes("30"), s);
  assert.ok(s.includes("2"), s);
  assert.notEqual(s.split(" ").length, 3, s);
});
test("dates survive a timezone that would push them onto another day", () => {
  for (const iso of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
    assert.equal(toIsoDate(fromIsoDate(iso)), iso);
  }
});
test("addDays crosses month and year ends", () => {
  assert.equal(addDays("2026-09-12", 3), "2026-09-15");
  assert.equal(addDays("2026-08-30", 3), "2026-09-02");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-09-12", 0), "2026-09-12");
});
test("daysBetween and lookSchedule agree about how long a trip is", () => {
  const days = daysBetween("2026-08-30", "2026-09-02");
  const looks = lookSchedule("2026-08-30", days, ["daytime"]);
  assert.equal(looks.length, days);
  assert.equal(looks.at(-1).date, "2026-09-02");
});
test("K-03 prints its arithmetic exactly as the atlas writes it", () => {
  assert.equal(
    looksSentence(4, ["daytime", "evening"]),
    "Two day parts across four days is eight looks."
  );
});
test("the sentence agrees with the number it describes", () => {
  for (const days of [1, 2, 5, 9]) {
    for (const parts of [["daytime"], ["daytime", "evening"], ["daytime", "evening", "travel"]]) {
      const n = looksFor(days, parts);
      assert.ok(
        looksSentence(days, parts).includes(` is ${n === 1 ? "one" : wordish(n)} look`),
        `${days} days \xD7 ${parts.length} parts \u2192 ${n}: ${looksSentence(days, parts)}`
      );
    }
  }
});
function wordish(n) {
  return [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty"
  ][n] ?? String(n);
}
test("one of anything is singular", () => {
  assert.equal(looksSentence(1, ["daytime"]), "One day part across one day is one look.");
});
test("K-05: repeat counts read \xD73 and \xD74, and the worn piece has no count", () => {
  assert.equal(repeatLabel(3, false), "\xD73");
  assert.equal(repeatLabel(4, false), "\xD74");
  assert.equal(repeatLabel(1, true), "worn");
});
test("the chips are the six vibes and four day parts the atlas draws", () => {
  assert.deepEqual(
    VIBES.map((v) => v.label),
    ["Warm city", "Work", "Long dinners", "Beach", "Wedding", "A lot of walking"]
  );
  assert.deepEqual(
    DAY_PARTS.map((p) => p.label),
    ["Daytime", "Evening", "Gym", "Travel days"]
  );
});
test("the memo labels a day part differently from its chip", () => {
  const evening = DAY_PARTS.find((p) => p.key === "evening");
  assert.equal(evening.label, "Evening");
  assert.equal(evening.title, "Night");
});

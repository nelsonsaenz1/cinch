// tests/invite-link.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/invite/link.ts
var INVITE_HOST = "cinchstyle.com";
var INVITE_PATH = "i";
function bareHandle(handle) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}
function inviteUrl(handle) {
  return `https://${INVITE_HOST}/${INVITE_PATH}/@${bareHandle(handle)}`;
}
function inviteUrlForDisplay(handle) {
  return `${INVITE_HOST}/${INVITE_PATH}/@${bareHandle(handle)}`;
}
function shareTitle(displayName) {
  return `${displayName} added you on Cinch`;
}
function shareMessage() {
  return "I\u2019m on Cinch \u2014 a closet you actually use. This link adds us both, with nothing to accept.";
}
function handleFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  const segments = scheme === "cinch" ? [parsed.hostname, ...parsed.pathname.split("/")].filter(Boolean) : parsed.pathname.split("/").filter(Boolean);
  if (scheme === "https" || scheme === "http") {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== INVITE_HOST) return null;
  } else if (scheme !== "cinch") {
    return null;
  }
  if (segments.length !== 2) return null;
  const [first, second] = segments;
  if (first.toLowerCase() !== INVITE_PATH && first.toLowerCase() !== "invite") return null;
  const handle = bareHandle(decodeURIComponent(second));
  return /^[a-z0-9_.]{2,30}$/.test(handle) ? handle : null;
}

// src/features/share/share-copy.ts
var OPENING = {
  // Provable: the composer scores garments the user owns
  // (`src/features/styling/queries.ts` filters by `user_id`) and assembles them
  // on device (`src/lib/styling/generate.ts`).
  outfit: "Everything in this is already mine. Cinch worked out what goes with what.",
  // "What repeats" is the memo card's own second column — `repeatLabel` at
  // `src/features/plan/packing-math.ts`, printed by `packing-memo-card.tsx`.
  packing: "The whole bag for this trip. Cinch worked out the days, and what repeats."
};
var CLOSET_LINE = "The closet it came out of is on Cinch:";
function plateShareMessage(subject, inviteUrl2) {
  const opening = OPENING[subject];
  if (!inviteUrl2) return opening;
  return `${opening}

${CLOSET_LINE} ${inviteUrl2}`;
}
function possessive(name) {
  return `${name}\u2019s`;
}
function lookShareMessage({
  posterName,
  mine,
  occasionTitle
}) {
  const who = mine ? "My look" : posterName ? `${possessive(posterName)} look` : "A look";
  const where = occasionTitle ? `for ${occasionTitle}` : "on the board";
  return `${who} ${where}. Everyone at the table gets one pick.`;
}
function boardShareMessage(occasionTitle) {
  if (!occasionTitle) return "The board\u2019s closed and the picks are in.";
  return `${occasionTitle} \u2014 the board\u2019s closed and the picks are in.`;
}

// tests/invite-link.test.ts
test("the link is built from the handle, with the @ kept", () => {
  assert.equal(inviteUrl("sophie"), "https://cinchstyle.com/i/@sophie");
  assert.equal(inviteUrl("@Sophie"), "https://cinchstyle.com/i/@sophie");
});
test("bareHandle strips the sigil and folds case", () => {
  assert.equal(bareHandle("@Sophie"), "sophie");
  assert.equal(bareHandle("  sophie "), "sophie");
  assert.equal(bareHandle("@@sophie"), "sophie");
});
test("the share title is the sentence the landing page prints", () => {
  assert.equal(shareTitle("Sophie"), "Sophie added you on Cinch");
});
test("the real universal link parses, with or without the @", () => {
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@sophie"), "sophie");
  assert.equal(handleFromUrl("https://cinchstyle.com/i/sophie"), "sophie");
  assert.equal(handleFromUrl("https://www.cinchstyle.com/i/@sophie"), "sophie");
  assert.equal(handleFromUrl("https://CinchStyle.com/i/@Sophie"), "sophie");
});
test("the custom scheme parses, including the tolerated spelling", () => {
  assert.equal(handleFromUrl("cinch://i/@sophie"), "sophie");
  assert.equal(handleFromUrl("cinch://invite/sophie"), "sophie");
});
test("a percent-encoded handle is decoded", () => {
  assert.equal(handleFromUrl("https://cinchstyle.com/i/%40sophie"), "sophie");
});
test("another host is never an invite, however much it looks like one", () => {
  assert.equal(handleFromUrl("https://evil.example/i/@sophie"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com.evil.example/i/@sophie"), null);
  assert.equal(handleFromUrl("https://notcinchstyle.com/i/@sophie"), null);
});
test("a path that is not an invite is not an invite", () => {
  assert.equal(handleFromUrl("https://cinchstyle.com/privacy"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com/"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com/i/"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com/x/@sophie"), null);
});
test("a segment that cannot be a handle is rejected rather than looked up", () => {
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@a"), null, "too short");
  assert.equal(handleFromUrl(`https://cinchstyle.com/i/@${"a".repeat(31)}`), null, "too long");
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@so phie"), null, "space");
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@sophie!"), null, "punctuation");
});
test("a trailing segment does not get to disguise a working link", () => {
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@so/phie"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@sophie/extra"), null);
  assert.equal(handleFromUrl("https://cinchstyle.com/i/@sophie/"), "sophie");
});
test("rubbish in, null out \u2014 never a throw", () => {
  assert.equal(handleFromUrl(""), null);
  assert.equal(handleFromUrl("not a url"), null);
  assert.equal(handleFromUrl("javascript:alert(1)"), null);
  assert.equal(handleFromUrl("mailto:hello@mail.cinchstyle.com"), null);
});
test("the card prints the address without the scheme", () => {
  assert.equal(inviteUrlForDisplay("sophie"), "cinchstyle.com/i/@sophie");
  assert.equal(inviteUrlForDisplay("@Sophie"), "cinchstyle.com/i/@sophie");
  assert.match(inviteUrl("sophie"), /^https:\/\//);
});
var EVERY_SHARE_STRING = () => [
  shareMessage(),
  plateShareMessage("outfit", "https://cinchstyle.com/i/@sophie"),
  plateShareMessage("packing", "https://cinchstyle.com/i/@sophie"),
  plateShareMessage("outfit", null),
  lookShareMessage({ posterName: "Dana", mine: false, occasionTitle: "Ana\u2019s dinner" }),
  lookShareMessage({ posterName: null, mine: true, occasionTitle: null }),
  boardShareMessage("Ana\u2019s dinner")
];
test("no share string prints a count as a constant", () => {
  for (const line of EVERY_SHARE_STRING()) {
    assert.doesNotMatch(line, /\d/, `a digit reached a share message: ${line}`);
    assert.doesNotMatch(
      line,
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\b outfits?\b/i,
      `a spelled-out outfit count reached a share message: ${line}`
    );
  }
});
test("no share string shouts", () => {
  for (const line of EVERY_SHARE_STRING()) {
    assert.doesNotMatch(line, /!/, `an exclamation mark reached a share message: ${line}`);
    assert.doesNotMatch(line, new RegExp("\\p{Extended_Pictographic}", "u"), `an emoji reached a share message: ${line}`);
  }
});
test("the invite message is first person and carries no URL of its own", () => {
  assert.doesNotMatch(shareMessage(), /cinchstyle\.com/);
  assert.match(shareMessage(), /^I’m on Cinch/);
});
test("a captured card carries the sharer\u2019s link inside the message", () => {
  const url = "https://cinchstyle.com/i/@sophie";
  assert.ok(plateShareMessage("outfit", url).includes(url));
  assert.ok(plateShareMessage("packing", url).includes(url));
  assert.notEqual(plateShareMessage("outfit", url), plateShareMessage("packing", url));
});
test("no handle means one sentence less, not a hole in the sentence", () => {
  const line = plateShareMessage("outfit", null);
  assert.doesNotMatch(line, /null|undefined|cinchstyle/);
  assert.equal(line, "Everything in this is already mine. Cinch worked out what goes with what.");
});
test("a shared look names the poster possessively, and never \u201CDana look\u201D", () => {
  assert.equal(
    lookShareMessage({ posterName: "Dana", mine: false, occasionTitle: "Ana\u2019s dinner" }),
    "Dana\u2019s look for Ana\u2019s dinner. Everyone at the table gets one pick."
  );
  assert.match(lookShareMessage({ posterName: null, mine: true, occasionTitle: null }), /^My look/);
  assert.equal(
    lookShareMessage({ posterName: null, mine: false, occasionTitle: null }),
    "A look on the board. Everyone at the table gets one pick."
  );
});
test("the board share states the close, and counts nothing", () => {
  assert.equal(
    boardShareMessage("Ana\u2019s dinner"),
    "Ana\u2019s dinner \u2014 the board\u2019s closed and the picks are in."
  );
  assert.equal(boardShareMessage(null), "The board\u2019s closed and the picks are in.");
});

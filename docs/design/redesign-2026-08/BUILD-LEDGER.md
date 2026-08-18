# Build ledger — redesign 2026-08

Two tables, and the difference between them is the whole point of the file.

**Built** below is the shipped record: one row per page built from an
accepted Claude Design artifact, and a page in THAT table is DONE — built to
frame, verified (typecheck · tests · lint · simulator against the artifact),
committed, and shipped. The watcher and the fleet check it before building;
a page listed there is never built twice from the same artifact.

**Accepted artifacts** below it is the design-status shelf: frames that have
been approved and imported into `design-refs/` and have NOT been built. A
row there is a claim about a set of files in this repository and about
nothing else — no implementation, no commit of app code, no OTA, no
simulator. Moving a page from the second table to the first is what shipping
it means.

## Built and shipped

| Page | Artifact set | Commit | Shipped | Simulator |
|---|---|---|---|---|
| 09-people-search | design-refs/redesign-2026-08/09-people-search/ (7 files) | d20fc8f | OTA 01a01257-7648-7bcf-985b-d4f23aa3c6a6 · runtime 18938ff9 · 2026-08-17 | default + keyboard frames matched; long-name truncation verified |
| 02-new-event | design-refs/redesign-2026-08/02-new-event/ (7 files) | b61e20d | OTA 01a0126e-3674-7cc5-98d9-02f4a50fcee7 · runtime 18938ff9 · 2026-08-17 | default frame matched; AX3 wraps clean, CTA clears home indicator |
| 01-plan-week | design-refs/redesign-2026-08/01-plan-week/ (7 files) | 13d0545 | OTA 01a01287-f49d-71bf-b848-460948b28c9e · runtime 18938ff9 · 2026-08-17 | default + month-sheet frames matched; strip, dots, thumbnails, weather marks live |
| 03-event-detail | design-refs/redesign-2026-08/03-event-detail/ (7 files) | 3edbf82 | OTA 01a012a0-294b-7f3a-9734-a5bfc1cc5b30 · runtime 18938ff9 · 2026-08-17 | default poster frame matched; band, plate, chips, logistics line, RSVP pair live |
| 04-trips-list | design-refs/redesign-2026-08/04-trips-list/ (6 files) | c47f5ea | OTA 01a012ba-7d4d-72ab-8674-b60a279e99f8 · runtime 18938ff9 · 2026-08-17 | default frame matched; hero plate, shelf cards, past rows live; new /trips route |
| 05-new-trip | design-refs/redesign-2026-08/05-new-trip/ (9 files) | 8fa9afb | OTA 01a012d5-654e-7c78-acfd-785e0aa90cfa · runtime 18938ff9 · 2026-08-17 | default step + planned frames matched; PackingAccess gate zero-diff |
| 06-trip-detail | design-refs/redesign-2026-08/06-trip-detail/ (10 files) | d5e8d20 | OTA 01a012ee-0d0e-70a5-8f32-1ba44772ea1a · runtime 18938ff9 · 2026-08-18 | progress frame matched; checkable tiles, note, delete sheet live; trips.note migration adopted from colliding session |
| 07-profile | design-refs/redesign-2026-08/07-profile/ (7 files) | 070b913 | OTA 01a0130e-f4fe-76fd-8f69-7252f0454591 · runtime 18938ff9 · 2026-08-18 | all six frames matched at standard and AX-XXXL; rails, marks, quiet plan door and bled closet grid live; no tab bar (Profile stays the Today form sheet) |
| 08-friends-list | design-refs/redesign-2026-08/08-friends-list/ (29 files) | 340fe50 | OTA 01a0134e-4307-7caf-961c-78eb7605c17b · runtime 18938ff9 · 2026-08-18 | default, presence-revoked, resting, empty, loading, friends-failed and offline matched at standard; AX-XXXL matched after fixing a request-row collapse. ZERO backend change — the existing daily-social views already enforce every rule. pgTAP committed but UNEXECUTED: GitHub Actions is blocked on account billing and this machine has no Docker |
| 13-wear-confirm | design-refs/redesign-2026-08/13-wear-confirm/ (29 files) | 4b26cd1 | OTA 01a0141d-5b1d-7b81-9038-d396a759a068 · group 15be378d-f1ac-4f55-819b-30fa028e78a2 · runtime 18938ff9 · 2026-08-18 | fifteen states matched at standard and AX-XXXL on 932pt and 852pt — default, five rating states, favourite, the override note, confirming, settled, settled-idempotent, network, offline, signed-out, rejected, long name and many garments. ZERO backend and ZERO native change, verified against production. Three simulator defects found and fixed (invisible heart, a header the frames do not have, five states no capture could reach). 667pt not captured |
| 12-reveal | design-refs/redesign-2026-08/12-reveal/ (31 files) | 3453c35 | OTA 01a013fc-09bb-7d42-ad3c-f455b5cdf092 · group 7add9969-063a-42d8-86c9-b1c30207df5d · runtime 18938ff9 · 2026-08-18 | sixteen states matched at standard and AX-XXXL on 932pt and 852pt — the seven beats, and singular, large, partial-tagging, substitution, offline, missing-image, zero, trialing and lapsed-free. ZERO backend and ZERO native change. Two simulator defects found and fixed (collapsed zero copy, ignored deep link). The artifact's own digits are wrong in two frames — see below. 667pt not captured |
| 11-today | design-refs/redesign-2026-08/11-today/ (31 files) | 833b7c5 | OTA 01a013d3-cf4d-7bfa-af9a-9b946102932b · group 310fcb32-d9b3-4959-b7cf-a493886d93b1 · runtime 18938ff9 · 2026-08-18 | the day, the chips and four weather states, the wear flow, the four refusals and the floor matched at standard and AX-XXXL on 932pt and 852pt. ZERO backend and ZERO native change. Two AX defects found and fixed in the simulator (collapsed image placeholder, weather mark covering the first tile at AX). 667pt not captured — see below |
| 10-invite-share | design-refs/redesign-2026-08/10-invite-share/ (24 files) | 169d5d3 | OTA 01a0136e-1520-71c1-8743-7f5cac6e5935 · group 9d5d98ec-1244-42c2-8bc6-61aa4ae828c0 · runtime 18938ff9 · 2026-08-18 | default, empty, link-failed, arrivals-failed, offline, no-handle, share-unavailable, copied and copy-unavailable matched at standard; AX-XXXL matched after enlarging the row avatar to stop the monogram clipping. ZERO backend change. QR variant (frame 23, marked extra/opt-in) deliberately not built |

## Accepted artifacts — imported, not built

Design accepted and the files are in the repository. Nothing in this table
has been implemented or shipped; the app is unchanged by their presence.
Every PNG in every set is 790×1708 and was imported byte-for-byte from the
accepted bundle.

| Page | Directive brief | Artifact set | Files | Imported | Build status |
|---|---|---|---|---|---|
| 17-explore | §3 · 17 Explore (Daily Social) | design-refs/redesign-2026-08/17-explore/ | 1 HTML + 15 PNG | 2026-08-18 | not built |
| 18-welcome-sign-in | §3 · 18 Welcome / Sign-in | design-refs/redesign-2026-08/18-welcome-sign-in/ | 1 HTML + 8 PNG | 2026-08-18 | not built |
| 19-auth-run | §3 · 19 Email + code + name | design-refs/redesign-2026-08/19-auth-run/ | 1 HTML + 21 PNG | 2026-08-18 | not built |
| 20-tour | §3 · 20 Tour | design-refs/redesign-2026-08/20-tour/ | 1 HTML + 10 PNG | 2026-08-18 | not built |
| 21-the-ten | §3 · 21 The Ten | design-refs/redesign-2026-08/21-the-ten/ | 1 HTML + 19 PNG | 2026-08-18 | not built |
| 22-capture | §3 · 22 Capture | design-refs/redesign-2026-08/22-capture/ | 1 HTML + 22 PNG | 2026-08-18 | not built |

Pages 12–16 have no accepted artifact in the repository yet, so 17–22
arriving before them is expected rather than a gap in this table.

### 13-wear-confirm — what was wrong, and what the captures caught

**The backend claim was checked, not taken.** The handoff says no new schema,
RPC, RLS policy or grant is expected. Verified against production rather than
against the migration file: `wear_outfit_tx` is **security-invoker** (so RLS
authorises every row against the caller — a definer function here would make
the client's guard the only guard), granted to `authenticated` alone, and
`public_outfits` carries `(id, user_id, name, occasion, created_at)` while
`friend_worn_outfits` carries `(id, user_id, name, worn_at)`. Neither has ever
carried `wear_rating` or `favorited_at`. Zero migrations, zero pgTAP changes,
nothing to deploy before the client.

**Three things were genuinely wrong, not merely plain.**

1. *The sheet vanished on success.* It closed the instant the transaction
   returned, leaving the reader on Today with no evidence anything was written.
   It now holds the settled composition, and `closeWearSheet` is the single
   path out — so a reset cannot be half-done and leave the NEXT wear looking
   already logged.
2. *One error string for five failures.* A session that ended and a connection
   that dropped got the same body and the same "Try again" — a control that
   would fail identically for the first. `wearErrorView` tells them apart,
   routes signed-out to sign-in, and separates a connection that was never
   there from one that dropped mid-write.
3. *The taste policy was an inline ternary.* `tests/today-polish-phase-a` had to
   read it back out with a regex and evaluate it through `new Function`. It is
   now `tasteSignal`, executed directly by two suites.

**The haptic moved, and Today went silent.** The committed-wear buzz now fires
in the sheet, with the state transition the reader sees — buzz, line and
VoiceOver announcement land together. `src/app/(tabs)/index.tsx` came OFF the
direct-haptics debt list in `tests/haptic-policy.test.ts` as a result.

**Two accepted-artifact conflicts, resolved and recorded.**

| Conflict | Resolution |
|---|---|
| 27 frames draw Cancel BELOW the CTA; the VoiceOver overlay numbers it 2, before the collage | The drawn frames win — they are what was accepted 27 times and what the evidence is compared against. RN core offers no supported way to reorder VoiceOver independently of layout. The cost is small: `onRequestClose` is wired, so a two-finger scrub dismisses from ANY element, which is a stronger guarantee than being second in the list |
| Frame 01 shows "Optional" and frame 09 shows "Skip if you like" for the SAME state (nothing chosen) | One hint, "Optional". A third string would be a difference the reader could see and the app could not explain. "Cleared" remains distinct, because it marks a rating that was taken back |

**The captures caught three defects.** A sand heart on a sand row was an
invisible control — the row's resting ground moved to `tray` so the glyph
exists at all. A drawn "Log today's outfit" header the accepted frames do not
have, removed (it is the modal's announcement, not a heading). And five states
— every rating and the favourite — that no non-interactive capture could reach,
because `simctl` opens URLs and cannot tap. The sheet now takes two documented
test-only seeds defaulting to exactly what opening gives you, with a test
asserting the shipping route passes neither.

**One deviation carried from the artifact, one added.** Carried: the heart fills
oxblood on blush rather than a warmer clay, because clay on blush fails the
contrast floor against the sand resting state. Added: the section eyebrow stays
the repo's `muted` rather than the frame's clay — `accentWarm` measures 2.98:1
and the constitution test caught exactly this on page 10.

**Two blockers, unresolved and not worked around.** The 667pt capture could not
be taken, for the third time and the same reason: a freshly created iPhone SE
simulator's development client will not connect to Metro without a tap on its
"Open in Cinch?" alert. What stands in is deterministic rather than a promise —
`collageHeight(667, false)` is asserted to tighten to 118pt, both actions are
pinned outside the scroll region, and the AX-XXXL captures exercise the same
tightening on a real device. Reduce Motion and VoiceOver are likewise asserted
rather than photographed, because neither shows in a still: the tests pin
`animationType={reduced ? 'fade' : 'slide'}`, that `reduced` is read exactly
twice so nothing else branches on it, and every role, label, state and the full
element order.

GitHub Actions run **32119445676** (commit `4b26cd1`) reports all three jobs —
`database`, `functions`, `check` — as `failure` with ZERO steps and no
retrievable log. That is the account-level billing block, external to this
change, not a code failure. The same gates ran locally and are green:
typecheck, lint, 2843 unit tests, styling and typography smoke.

### 12-reveal — the artifact's numbers, and why the engine won

Two accepted frames draw a count that does not follow from the composition
printed beside it:

| Frame | Composition drawn | Digit drawn | `countOutfits` |
|---|---|---|---|
| 05 · count settled | 4 tops, 3 bottoms, 1 dress, 2 pairs of shoes | 27 | **26** |
| 23 · large count | 11 tops, 8 bottoms, 4 dresses, 8 pairs of shoes | 184 | **736** |

The build follows `countOutfits(tallyOf(items))`. Honouring an illustrative
digit over the engine would break the single promise this screen exists to keep
— its own handoff says the number comes only from the engine and nothing is
estimated — and the number, the derivation and the composition chips are now
all computed from one tally, so they cannot disagree at all.

**"No digit before the arithmetic resolves" is now a named rule with a test.**
`mayDrawDigit(phase)` answers false for `arriving`, `computing` and `zero`, and
`computing` draws words instead. A digit-shaped placeholder is itself a claim,
and `tests/reveal-spec.test.ts` walks 256 generated closets asserting every
renderable digit is the engine's and is bounded by it at every frame of the
count-up.

**One register per sentence — the one deliberate departure from the frames.**
Frame 23 spells "A hundred and eighty-four". `numberWord` stops at ninety-nine
by an argued decision written into its own docblock: past a hundred the words
get longer than the figure. Printing "736 outfits from thirty-one pieces" would
mix registers inside one sentence, which that same docblock calls worse than
either option. So a sentence needing a figure anywhere uses figures throughout.

**Partial tagging was silently wrong before this.** `useWardrobe` filters to
tagged pieces — correctly, since a piece with no slot cannot enter an outfit —
so somebody who photographed ten and saw a number derived from seven had
nothing on screen to explain the gap. `useUntaggedCount` is a HEAD count on the
same `items` table under the same RLS: no new table, view, RPC or policy, no
rows, no ids, and it fails to zero so a failed secondary fact cannot break the
primary one.

**The membership moment is state-correct.** A paying member is never presented
a placement, and `plan.trialing` is folded into that test because `plan`
resolves to `pro` during the trial — reading the plan alone would have skipped
the moment for exactly the people it is for. `unconfirmed` counts as paying on
K-06's rule. Offline skips it too. Cinch draws one line about the count and one
sentence about access; no price, product, term, StoreKit string or vendor
layout, and no line promises a new trial, because the 14 days are server-side
access and there are zero Apple introductory offers. Navigation does not branch
on the outcome: on a non-gated campaign `present()` resolves `granted` for
somebody who bought nothing, so a granted result never implies purchase and
never routes to thanks. The zero path presents nothing at all.

**Analytics: the count never travels.** The exact outfit count is a
deterministic function of one wardrobe with a long tail — 736 is close to
unique, and joined to a timestamp it is a fingerprint — so it travels only as
one of five buckets. `tests/reveal-analytics.test.ts` executes every builder
across every legal input and asserts no unbounded string, identifier-shaped
key, uuid, path or url comes out.

**Two defects the simulator caught.** The zero screen's headline, body and rows
collapsed to nothing inside a container with no height for its own `flex-1` to
fill; and every deep link after the first was ignored, because expo-router does
not remount a screen when only the query string changes and the pose was seeded
into `useState` once. Both fixed — the second is why the fixtures are
deep-linkable at all, which is what made a reproducible evidence set possible:
`simctl` opens URLs and cannot tap, so a cycler driven only by buttons can be
looked at by hand and never photographed.

**Two blockers, unresolved and not worked around.** The 667pt capture could not
be taken, for the same reason as page 11: a freshly created iPhone SE
simulator's development client will not connect to Metro without a tap on its
"Open in Cinch?" alert, and this session cannot tap one. What stands in is
structural rather than a promise — `tests/reveal-page.test.ts` asserts the
composition scrolls, the exit does NOT, and the exit sits in a bottom-edge
`SafeAreaView` rather than at a fixed offset, which is what a short screen
actually depends on. The Deno edge checks are uninformative here rather than
failing: zero `supabase/` files are in this commit, and `deno check` still
cannot resolve `npm:@supabase/server` against this machine's `node_modules`.

GitHub Actions is still refusing to start jobs, unchanged since 2026-08-17. Run
**32116402538** (commit `3453c35`) reports all three jobs — `database`,
`functions`, `check` — as `failure` with ZERO steps and no retrievable log,
which is the account-level billing block rather than a broken test. All the
same gates ran locally and are green: typecheck, lint, 2773 unit tests, the
styling and typography smoke runs.

### 11-today — three contradictions, resolved rather than papered over

The accepted frames and repo truth disagreed in three places, and all three
were reported before any code was written rather than after:

**The occasion chip could not have worked.** The composer it replaces fed
`StyleContext.note`, which is read by the outfit-naming hash and by the
enhancement gate and by no scorer. Typing "dinner" re-rolled three NAMES and
changed no outfit. The chips land on `targetOccasion` and `targetFormality`
instead — the two fields `occasionRule` and `resolveTargetFormality` already
read — so the row now does what it appears to promise.

**"Start with ten pieces" was not true.** Today gated on `canGenerate`, whose
floor is eight and whose own docblock says eight "is internal and is never used
as an instruction". A closet of eight got outfits under copy quoting ten; a
closet of nine got nothing. The gate moved to `belowActivationFloor`
(`PLANS.free.items`, ten) and the sentence is BUILT from
`numberWord(TODAY_ACTIVATION_FLOOR)` rather than quoted, so it cannot drift
again. `MIN_CLOSET_FOR_OUTFITS` is unchanged and still governs the stylist,
packing and the help article — it answers a different question.

**There was no stale weather state.** `resolveWeather` now separates `ok`,
`stale`, `off` and `unavailable`. A dated reading keeps its words and gains an
hour rather than being dropped; `off` and `unavailable` stay apart because a
permission not given and a reading not gettable would blame different things.

**Deliberate departures from the frames.** The reaction bar is not drawn: the
accepted frames have none and the specified VoiceOver order has no slot for
one. Taste learning survives through the wear sheet's rating and favourite,
which still call `useReactToOutfit`. `components/today/plate.tsx` is untouched
because Reveal, Repeat and the share artifact all still draw it, so Today got
its own card and the blast radius stopped at this screen.

**Analytics.** Thirteen events, and `outfit_set_viewed` removed from this route
— it carried a COUNT of plates, which this page forbids, and `plate_viewed`
carries a POSITION instead. Every payload is built by a module with no PostHog
import so `tests/today-analytics.test.ts` executes each builder across every
legal input rather than grepping call sites. `weather_state` reports which of
four states and never the reading.

**Two blockers, unresolved and not worked around.** The 667pt capture the brief
asked for could not be taken: a freshly created iPhone SE simulator's
development client would not connect to Metro without a tap on its "Open in
Cinch?" alert, and this session has no way to tap one. What was photographed
instead is 932pt and 852pt at both type sizes, and
`tests/today-redesign-11.test.ts` pins the three things a short screen actually
depends on — the floor's `ScrollView`, the collage shrinking to 168pt at AX,
and both plate lines dropping their `numberOfLines` clamp. The sixteen Deno
edge checks also could not run: `deno check` cannot resolve
`npm:@supabase/server` against this machine's `node_modules` and rewrites
`deno.lock` when it tries. Zero edge-function files are in this commit, so the
gate is uninformative here rather than failing; `deno.lock` was reverted.

GitHub Actions is still refusing to start jobs, unchanged since 2026-08-17.
Run **32112558582** (commit `833b7c5`) reports all three jobs — `database`,
`functions`, `check` — as `failure` with ZERO steps and no retrievable log,
which is what the account-level billing block looks like from here rather than
a test that broke. The same three gates were run locally and are green:
typecheck, lint, 2689 unit tests, the styling and typography smoke runs.

**One release-log wart, recorded rather than hidden.** A stray production
update was published with the message `"x"` while recovering the group id for
this table. Its code is byte-identical to the release either side of it — same
commit, clean tree — so no client behaviour differs, and the branch head was
republished with the correct message immediately after.

### 10-invite-share — the block guard the roster was missing

The redesign-10 audit found that `invite_arrivals()` filtered neither blocking
nor current friendship, so a person the inviter later blocked kept a row — with
their display name and handle — on the inviter's private Invite / Share page.
Everywhere else in the schema a block means mutual invisibility; this one read
did not ask.

Fixed by `supabase/migrations/20260823000000_invite_arrivals_respects_blocks.sql`,
applied to production as ledger version `20260818055848`. It is a `create or
replace` of the identical signature adding one predicate — `not
public.blocked_between((select auth.uid()), p.user_id)` — through the schema's
one definition of "blocked", which is already symmetric. No table, column,
index, policy or type moved, the returned columns are unchanged, and no
generated type or client code changed, so **no OTA was warranted**: the shipped
JS bundle is byte-identical.

**The semantics, stated so they can be argued with.** Blocked in either
direction → absent. Deletion requested → absent, unchanged. Unfriended →
RETAINED, deliberately: an arrival is a fact about the caller's own link and
stays true after a friendship ends, and a row that vanished when a friendship
ended would prove exactly the thing this page's contract says an arrival never
proves. Profile visibility → considered and declined as a second, unasked
semantic change.

**Impact at deploy: zero rows.** `user_blocks` was empty and no profile carried
an `invited_by`, measured read-only before the change, so this is a lock fitted
before the door is used.

**Verification.** `supabase/tests/24_invite_arrivals_blocks.sql` adds 12 pgTAP
assertions (both block directions, unfriended retention, non-blocked retention,
missing fields as nulls, mid-deletion, anon denied, a different caller's empty
roster) — committed and, like `23_friends_presence.sql`, NEVER EXECUTED: this
machine has no Docker for `supabase test db`, and every GitHub Actions run since
2026-08-17 fails to start with "recent account payments have failed or your
spending limit needs to be increased". What was done instead, and is weaker: the
predicate was proven read-only against production over synthetic rows before
deploy, and the live function was verified after deploy by definition and
privilege inspection plus a null-caller execution — no user row was read or
returned at any point.

### 10-invite-share — the QR variant, and why it is absent

Frame 23 draws an optional QR card and the artifact marks it "extra, opt-in"
— it "earns its space only in person". It was not built. Doing so with only
`react-native-svg` means hand-writing a QR encoder: version selection, the
Reed-Solomon error correction, the mask evaluation. A code that renders but
scans wrong, or scans to the wrong string, is worse than no code at all, and
nothing on this page depends on it. The other 22 frames are implemented.

### 08-friends-list — why this set replaced an earlier one

The first export of this page was REJECTED at review: it drew a friend's
activity count, which the privacy contract does not permit a friend row to
state. All eight of its files left the directory in the same commit that added
the corrected set, so nothing can be built from the rejected frames by mistake
— four (`-ax`, `-error`, `-limited`, `-requests`) have no counterpart in the
corrected bundle and were DELETED, and four (the artifact, `-default`,
`-empty`, `-loading`) kept their names and were REPLACED byte-for-byte.

The corrected bundle imported here passed privacy QA: 28 frames covering the
mutual-only model, blocked-user invisibility, share-visibility rules, the
request and report flows, and presence marks that carry no count. It was built on
2026-08-18 and now appears in the shipped table above.

**What the build did NOT need.** The artifact's own shipping note called for a
new security-definer RPC over a new view. It was not built, because repo truth
says it is unnecessary: `friend_worn_outfits` → `friend_worn_outfit_items` →
`friend_items` already enforce mutual friendship, both directions of blocking,
the owner's opt-in, the non-retroactive boundary, the seven-day window,
`closet_hidden` and archived-item omission — all in SQL, all verified against
production before a line was written. No migration, view, function, policy or
column was added, so there was no backend deploy to sequence ahead of the OTA.

**What could not be verified.** `supabase/tests/23_friends_presence.sql` (14
assertions) is committed and has never been executed. `npm run test:db` needs a
local Supabase stack and this machine has no Docker runtime; CI would run it,
but every GitHub Actions run since 2026-08-17 has failed to start with "recent
account payments have failed or your spending limit needs to be increased".
Both are outside this build's authority to fix — one is an install, the other is
money. The predicates the file asserts were instead confirmed by reading the
live view definitions in production, which is weaker evidence than an executed
test and is recorded here as such.

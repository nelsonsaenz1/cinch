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

## Accepted artifacts — imported, not built

Design accepted and the files are in the repository. Nothing in this table
has been implemented or shipped; the app is unchanged by their presence.
Every PNG in every set is 790×1708 and was imported byte-for-byte from the
accepted bundle.

| Page | Directive brief | Artifact set | Files | Imported | Build status |
|---|---|---|---|---|---|
| 10-invite-share | §3 · 10 Invite / Share page | design-refs/redesign-2026-08/10-invite-share/ | 1 HTML + 23 PNG | 2026-08-18 | DESIGN ACCEPTED · not built |
| 17-explore | §3 · 17 Explore (Daily Social) | design-refs/redesign-2026-08/17-explore/ | 1 HTML + 15 PNG | 2026-08-18 | not built |
| 18-welcome-sign-in | §3 · 18 Welcome / Sign-in | design-refs/redesign-2026-08/18-welcome-sign-in/ | 1 HTML + 8 PNG | 2026-08-18 | not built |
| 19-auth-run | §3 · 19 Email + code + name | design-refs/redesign-2026-08/19-auth-run/ | 1 HTML + 21 PNG | 2026-08-18 | not built |
| 20-tour | §3 · 20 Tour | design-refs/redesign-2026-08/20-tour/ | 1 HTML + 10 PNG | 2026-08-18 | not built |
| 21-the-ten | §3 · 21 The Ten | design-refs/redesign-2026-08/21-the-ten/ | 1 HTML + 19 PNG | 2026-08-18 | not built |
| 22-capture | §3 · 22 Capture | design-refs/redesign-2026-08/22-capture/ | 1 HTML + 22 PNG | 2026-08-18 | not built |

Pages 11–16 have no accepted artifact in the repository yet, so 17–22
arriving before them is expected rather than a gap in this table.

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

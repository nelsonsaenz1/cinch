# Wave 3 working notes (source: uploads/cinch-wave-3-claude-design-handoff.pdf)

Deliverable per group: annotated .dc.html atlas named `Wave 3 - Design · <Group>.dc.html`,
plus component/state inventory, transition notes, accessibility + largest-Dynamic-Type
stress frames for EVERY screen, analytics placement map, deviation ledger, acceptance
checklist mapped to audit item numbers, and a [CLAIM] list for missing product facts.

## Constitution
Canvas #FBFAF6 · surface #FFFFFF · tray #F0ECE3 · sand #EAE5DB · page ground #EFEBE1
Ink #1C1A16 · secondary #6B665C · NEVER #8A8578 as text · accent oxblood #6E2B2B (one per frame)
Display: Instrument Serif, one weight. UI: Helvetica Neue regular; Medium only for labels
and filled actions; never synthesised bold.
Radius 2/4/8/12/16/20/38 — labelled controls 12, never capsules. Spacing 1/8/12/20/24/28/44.
Targets 44 pt. Motion fast 140 / base 220 / slow 380; one bouncy moment per delight.
Shadow: single contact shadow, warm ink 0/5/11 @16%.
Frames 393×852, radius 44.
Annotate every line under 16 px as LABEL (Medium) or PROSE (regular).

## Refusals
Progress is a count, never a bar or percentage. Prices/temps/counts printed when known or
omitted — never estimated, never a dash. Nothing silently lost. Zero is quiet. No hidden
close, no delayed dismissal, no labelled capsule, no faint text.
Positioning line: "Your closet first. Shop only when something is genuinely missing."
Commerce only in the Gap Feed recommendation and an opted-in friend's piece; "Paid link"
adjacent to every affiliate action.
No fifth Add Clothes door (Lookup stays reserved/undrawn). Never renumber existing states.

## Group order and audit trace
1. First-run hallway — audit 100. DONE: `Wave 3 - Design · First-Run Hallway.dc.html`
2. Today + plate — 56, 57, 58, 59. DONE: `Wave 3 - Design · Today and Plate.dc.html`
3. Closet 60-63 · Item 64,65 · Add Clothes 66,67 · Capture 68,69 · Describe 70,71 · Review 72.
   DONE: `Wave 3 - Design · Closet and Intake.dc.html` (C-01..08, IT-01..04, AC-01..03, CP-01..05,
   DS-01..05, RV-01..03, three AX stress frames)
4. Consent 73,74 · Privacy 75,76 · Diary 77,78 · Plan 79,80 · Packing 81,82,83.
   DONE: `Wave 3 - Design · Consent, Privacy, Diary, Plan, Packing.dc.html`
   (CN-01..04, PV-01..04, WD-01..03, PL-01..03, PK-01..04, AX for CN-01 and PK-01)
   New claims: 7 backup purge schedule, 8 sent-log retention, 9 which tier gates packing.
5. Gap Feed 84-87 · Friends 88,89 · Activity 90,91 · Event detail 92 · Comments 93,94 ·
   Look Board 95,96 · Share a Look 97 · Saved 98.
   DONE: `Wave 3 - Design · Gap Feed and Social.dc.html`
   (GF-01..04, FR-01..02, AV-01..02, EV-01..03, CM-01..02, LB-01..02, SL-01..02, SV-01..02,
   AX for GF-02 and SL-01). New claims: 10 look piece limit, 11 comment-closing rule.
6. Safety 99 · Profile/notifications/help/paywall (settled row + prose systems).
   DONE: `Wave 3 - Design · Safety, Profile, Help, Membership.dc.html`
   (SF-01..03, PR-01..02, NT-01..02, HP-01..02, MB-08..09, AX for SF-02 and PR-01)
   Includes the audit-100 positioning sweep table and the wave-wide roll-up (all 6 atlases,
   all 11 open claims). ALL SIX GROUPS COMPLETE.

## Product truth read from the codebase
PLANS.free: 10 active items, 30 stored, promise 3 outfits/week, 2 hosted events.
PLANS.standard: 150/450, "a fresh outfit every day", stylist 30/mo, 15 events, $7.99 / $59.
PLANS.pro: 1000/3000, unlimited, 100 events, $14.99 / $119. Prices are HINTS; paywall reads
StoreKit and formats in device locale.
The Ten slot model: 3 tops, 2 bottoms, 1 dress, 2 shoes, 1 outerwear, 1 bag; decline
redirects rather than drops; "keep the slot open" always last.
Outfit counts always via countOutfits(); every printed count carries its derivation.
Walkthrough failure causes: denied, silent, unparsed, offline, signed_out.
Procession: confirm/reject/edit/ambiguous(1-12)/back/undo, undo depth 3, nothing deleted.

## Open [CLAIM]s so far
1. Model-provider retention wording (TR-07).
2. RESOLVED in drawing: Standard (MB-01), Pro (MB-06), both-on-one-sheet (MB-07) all drawn.
   Still open: which the Superwall first-run placement is configured to sell.
3. Whether a trial precedes the first-run charge, and its length.
4. Listing-partner attribution wording (DS-03).
5. Retention window for an unprocessed capture (CP-05).
6. Behaviour at the stored-pieces ceiling (C-07).

Full handoff text extracted to `scraps/wave3-handoff.txt` — read it for groups 4-6 directives.

# Build ledger — redesign 2026-08

One row per page built from an accepted Claude Design artifact. A page in
this table is DONE: built to frame, verified (typecheck · tests · lint ·
simulator against the artifact), committed, and shipped. The watcher and
the fleet check this file before building — a page listed here is never
built twice from the same artifact.

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

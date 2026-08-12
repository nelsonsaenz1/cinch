# Wave 3 visual acceptance matrix

Atlas snapshot: `docs/design/wave-3-final/`  
Claude Design project: `03328f6a-428a-4586-8e80-a13b01009238`  
Exported: v2 2026-08-12T14:30:58.331Z; eight visual sources byte-identical to v1  
Verdict: 138 frames, finalized; v1's 139 was a confirmed bookkeeping error; implementation ready except D-1, D-2, D-5  
Visual reviewer: Codex (Claude Code generates artifacts and must not grade them)

## Acceptance protocol

Every implemented state requires: governing atlas ID; canonical route/fixture; app commit; device/OS/runtime/build; Dynamic Type and Reduce Motion setting; screenshot or recording path/hash; relevant interaction result; automated checks; Codex verdict; exact discrepancy and re-review artifact when rejected.

Primary geometry is the atlas's 393×852 pt class. Representative narrow and wide devices, every drawn AX state at maximum supported Dynamic Type, and Reduce Motion where motion exists are separate evidence—not substitutes for the primary frame.

## Group 1 — First-Run Hallway (38 frames)

Source: `Wave 3 - Design · First-Run Hallway.dc.html`  
P1 state: implementation active, except D-5 surfaces.

| Spine | State IDs | Current gate |
|---|---|---|
| Tour / doorway | TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-07 | P1 |
| The Ten | T-01, T-02, T-04, T-05, T-06, T-02/AX | P1 |
| Voice walkthrough | V-01, V-02, V-03, V-04, V-05, V-13a, V-13b, V-13c, V-13d, V-13e | P1 |
| Procession | PR-01, PR-03, PR-05, M-07 | P1 |
| Reveal | R-02, R-04, R-05 | P1 |
| Paywall / purchase | MB-01 (retired/non-shipping), MB-06 (retired/non-shipping), MB-07 (shipping form), MB-04, MB-05, MB-01/AX | D-5 boundary; no implementation or visual verdict until terms/products authority is resolved. Retired exploration frames are never routes. |
| Landing | TD-00, TD-00/AX | Canonical rendering belongs to Group 2; first-run transition belongs to P1 |

## Group 2 — Today and Plate (15 frames)

Source: `Wave 3 - Design · Today and Plate.dc.html`  
P1 state: implementation active.

| State IDs | Current gate |
|---|---|
| T-01, T-02, T-03, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15 | P1 |
| T-01/AX, T-12/AX, T-09/AX | P1 max-Dynamic-Type evidence required |

## Group 3 — Closet and Intake (31 frames)

Source: `Wave 3 - Design · Closet and Intake.dc.html`  
P1 state: implementation active.

| Surface | State IDs | Current gate |
|---|---|---|
| Closet | C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, C-01/AX | P1 |
| Item | IT-01, IT-02, IT-03, IT-04, IT-01/AX | P1 |
| Add Clothes | AC-01, AC-02, AC-03 | P1 |
| Capture | CP-01, CP-02, CP-03, CP-04, CP-05 | P1 |
| Describe | DS-01, DS-02, DS-03, DS-04, DS-05 | P1 |
| Review | RV-01, RV-02, RV-03, RV-01/AX | P1 |

## Group 4 — Consent, Privacy, Diary, Plan, Packing (20 frames)

Source: `Wave 3 - Design · Consent, Privacy, Diary, Plan, Packing.dc.html`  
State: pending P2.

| Surface | State IDs | Current gate |
|---|---|---|
| Consent | CN-01, CN-02, CN-03, CN-04, CN-01/AX | P2 |
| Privacy | PV-01, PV-02, PV-03, PV-04 | P2 |
| Wear diary | WD-01, WD-02, WD-03 | P2 |
| Plan | PL-01, PL-02, PL-03 | P2 |
| Packing | PK-01, PK-02, PK-03, PK-04, PK-01/AX | D-5 affects the selling/terms gate; D-3 downgrade behavior is repository-safe |

## Group 5 — Gap Feed and Social (21 frames)

Source: `Wave 3 - Design · Gap Feed and Social.dc.html`  
State: pending P3; Group 5 source audit confirmed all 21 approved states are present and no visual content changed.

| Surface | State IDs | Current gate |
|---|---|---|
| Gap Feed | GF-01, GF-02, GF-03, GF-04, GF-02/AX | P3; D-4 repository-safe |
| Friends | FR-01, FR-02 | P3; D-4 applies to the opted-in friend commerce row |
| Activity | AV-01, AV-02 | P3 |
| Event | EV-01, EV-02, EV-03 | D-1/D-2 affected states blocked |
| Comments | CM-01, CM-02 | D-1 blocked |
| Look Board | LB-01, LB-02 | D-1/D-2 blocked |
| Share a Look | SL-01, SL-02, SL-01/AX | D-2 affects locked-board behavior |
| Saved | SV-01, SV-02 | P3 |

## Group 6 — Safety, Profile, Help, Membership (13 frames)

Source: `Wave 3 - Design · Safety, Profile, Help, Membership.dc.html`  
State: pending P4.

| Surface | State IDs | Current gate |
|---|---|---|
| Safety | SF-01 (= BL-01), SF-02 (= BL-02), SF-03, SF-02/AX | P4 |
| Profile | PR-01, PR-02, PR-01/AX | P4; D-4 applies to suggestions state |
| Notifications | NT-01, NT-02 | P4 |
| Help | HP-01, HP-02 | HP-01 ready; HP-02 touches D-3 and D-5 terms |
| Membership | MB-08, MB-09 | D-3 policy is repository-safe; D-5 terms remain blocked |

## Codex verdict register

| Packet | Artifact manifest | Machine evidence | Visual verdict | Open discrepancies | Accepted revision |
|---|---|---|---|---|---|
| P1 / Groups 1–3 | Pending | Pending | Not reviewed | — | — |
| P2 / Group 4 | Pending | Pending | Not reviewed | — | — |
| P3 / Group 5 | Pending | Pending | Not reviewed | — | — |
| P4 / Group 6 | Pending | Pending | Not reviewed | — | — |
| PD1 / comment closure | Founder decision pending | — | Not reviewed | D-1 | — |
| PD2 / board lock | Founder decision pending | — | Not reviewed | D-2 | — |
| PD5 / StoreKit terms | Founder decision pending | — | Not reviewed | D-5 | — |

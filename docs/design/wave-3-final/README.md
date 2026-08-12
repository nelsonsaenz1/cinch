# Wave 3 — final visual atlas bundle (v3)

Claude Design project id: 03328f6a-428a-4586-8e80-a13b01009238
Export timestamp (UTC): 2026-08-12T14:57:51.388Z
Supersedes v2 (2026-08-12T14:30:58.331Z). Change in v3: AC-03 only, in Group 3 — the capacity frame now renders the shipping W-02 flow (all four intake doors available at the ceiling; capacity resolved after acquisition). Frame counts unchanged. D-1/D-2/D-5 unchanged. All other seven files byte-identical to v2.

## Atlas frame counts (verified: count of `class="frame"` in each file)
| Atlas | Frames |
| --- | --- |
| Wave 3 - Design · First-Run Hallway.dc.html | 38 |
| Wave 3 - Design · Today and Plate.dc.html | 15 |
| Wave 3 - Design · Closet and Intake.dc.html | 31 |
| Wave 3 - Design · Consent, Privacy, Diary, Plan, Packing.dc.html | 20 |
| Wave 3 - Design · Gap Feed and Social.dc.html | 21 |
| Wave 3 - Design · Safety, Profile, Help, Membership.dc.html | 13 |
| **Total** | **138** |

## Verdicts
VISUAL ATLAS VERDICT = FINALIZED
IMPLEMENTATION READINESS = READY EXCEPT LISTED DEPENDENCIES (D-1 server-side comment closure, D-2 board lock enforcement, D-5 StoreKit terms across surfaces; D-3 downgrade policy and D-4 per-row merchant state cleared by repository truth — see WAVE-3-DEPENDENCY-LEDGER.md)

## AC-03 correction record
Authority: src/app/add-clothes.tsx (W-02 standing rule and live copy), src/app/capture.tsx (held capture, settle after acquisition, resume after room), src/features/ingest/use-capture.ts (acquire versus commit), docs/design/refacing/AC-HANDOVER.md, .redesign/escalations.md. Runtime truth outranks atlas copy. Acquiring is not adding: D-3 still refuses the over-ceiling add or restore, and the held input survives until the user decides. Vocabulary follows the repository: active pieces. No tier, price, upgrade, StoreKit term or D-5 claim appears on AC-03.

## Authority
Byte-preserving copies of the Claude Design project-root sources. The project-root sources remain authoritative; this bundle is a snapshot for implementation reference only. Verify with:

    shasum -a 256 -c MANIFEST.sha256

## Contents
- Wave 3 - Design · First-Run Hallway.dc.html — 252235 bytes — 38 frames
- Wave 3 - Design · Today and Plate.dc.html — 132467 bytes — 15 frames
- Wave 3 - Design · Closet and Intake.dc.html — 242073 bytes — 31 frames
- Wave 3 - Design · Consent, Privacy, Diary, Plan, Packing.dc.html — 188023 bytes — 20 frames
- Wave 3 - Design · Gap Feed and Social.dc.html — 212100 bytes — 21 frames
- Wave 3 - Design · Safety, Profile, Help, Membership.dc.html — 132979 bytes — 13 frames
- WAVE-3-BRIEF-NOTES.md — 4516 bytes
- WAVE-3-DEPENDENCY-LEDGER.md — 4912 bytes
- MANIFEST.sha256
- README.md

# Wave 3 visual acceptance matrix

Last reconciled: 2026-08-14 10:00 EDT

Atlas snapshot: `docs/design/wave-3-final/`

Claude Design project: `03328f6a-428a-4586-8e80-a13b01009238`

Atlas count: 138 frames (`38 + 15 + 31 + 20 + 21 + 13`)
Status: finalized source, implemented in the shipping tree, and subsequently refined through founder review.

## Source authority

The v6 snapshot is the final Wave 3 design authority. Earlier v1–v5 exports remain historical checkpoints. The original 139-frame completion report was a bookkeeping error, not a missing frame. Shipping runtime truth and later accepted correction packets supersede aspirational atlas copy when the two conflict.

## Acceptance protocol

For a material visual change, retain:

- route/state and governing design ID;
- device, OS, runtime/build, Dynamic Type, and Reduce Motion state;
- screenshot or recording path;
- automated checks and fingerprint result;
- independent visual verdict and exact correction when rejected.

Claude Code may implement and produce artifacts. Codex owns independent visual acceptance and release gating. A same-runtime visual correction may ship OTA only after fingerprint equality is proven.

## Group disposition

| Group | Frames | Repository disposition |
|---|---:|---|
| First-Run Hallway | 38 | Implemented; later intake, trial, camera and catalogue corrections supersede conflicting early exploration states |
| Today and Plate | 15 | Implemented; later greeting, example-first, spacing and copy corrections accepted |
| Closet and Intake | 31 | Implemented; Catalogue Photo V2, native intake, identity-first empty state and example hierarchy are the current authority |
| Consent, Privacy, Diary, Plan, Packing | 20 | Implemented; current repository privacy and deterministic packing truth supersede model-dependent draft copy |
| Gap Feed and Social | 21 | Implemented under repository/server truth for comments, boards, events and merchant disclosure |
| Safety, Profile, Help, Membership | 13 | Implemented; current StoreKit/Superwall terms and founder decisions supersede unresolved D-5 placeholders |

## Latest accepted correction packet

| Surface | Artifact/evidence | Verdict |
|---|---|---|
| Zero-piece Closet identity | `/tmp/cinch-ci01-402x874-top.png` | Accepted: real avatar/name/handle/bio/edit action precede the empty closet payoff |
| Centred metrics | Same CI-01 artifact and `src/components/closet/stat-row.tsx` | Accepted: four equal-width columns; each figure and label centred |
| Example hierarchy | `/tmp/cinch-ci01-402x874-scroll.png` | Accepted after correction: `EXAMPLE` badge, heading, grid, then 26pt separation before starter card |
| Partial Closet regression | `/tmp/cinch-cx04-compact-example-regression.png` | Accepted: compact 1–9 preview retains correct order and real spacing |
| Accessibility type | `/tmp/cinch-ci03-ax3-402x874-top.png` | Accepted: scaled line boxes prevent sliced figures, labels and badge text |
| Fresh sign-in wordmark | `/tmp/cinch-auth-wordmark-after.png` | Accepted: metric-derived 52px line box reveals the full 40px Instrument Serif wordmark without changing safe-area position |

The exact 375×667 capture for the latest Closet packet was unavailable in the Claude simulator session. The responsive path is test-covered and the 402×874 standard/AX artifacts passed, but this record does not pretend the unavailable screenshot exists.

## Machine evidence at current checkpoint

- `node scripts/run-tests.mjs`: 1,540 pass, 0 fail.
- `npm run typecheck`: clean.
- Scoped ESLint over the correction files: clean.
- `npm run check:fingerprint`: unchanged at `e8e5a192fd890077ed538d1926cd0e7ef12a6534`.
- Commit `2a1e07d` equals `origin/main`.
- Production iOS OTA: update `01a0007d-6de3-756a-8048-79f0d210c28c`, group `16abd111-6d79-42bb-80cd-f3760d1bdc17`.

## Open visual validation debt

- Representative real-device camera/photo calibration remains blocked on a permissioned real-photo corpus, recorded in `docs/deterministic-ai-evidence.md`.
- Device-only Apple Speech/Vision behavior is implementation-complete but should be exercised on supported hardware when that evidence is required.
- App Store approval/publication state is external operational state and must be read live rather than inferred here.

No application source, configuration, dependency, entitlement, backend contract, or release state is changed by this matrix reconciliation.

# Cinch implementation and release ledger

Last reconciled: 2026-08-14 10:00 EDT
Coordinator: Codex  
Scope: durable implementation and release evidence. Historical turn-by-turn coordination remains available in Git history and is not repeated here.

## Current checkpoint

| Area | Current state | Evidence |
|---|---|---|
| Application source | `main` at `2a1e07d`, pushed to `origin/main` | `git rev-parse HEAD`; `git rev-parse origin/main` |
| Latest product packet | Empty Closet identity/profile header, centred stat strip, example hierarchy, starter spacing, and corrected auth wordmark | `2a1e07d`; simulator artifacts under `/tmp/cinch-ci*` and `/tmp/cinch-auth*` |
| Automated checks | 1,540 tests pass; typecheck clean; scoped lint clean | Independent Codex run on 2026-08-14 |
| Production runtime | `e8e5a192fd890077ed538d1926cd0e7ef12a6534` | `fingerprint.json`; `npm run check:fingerprint` |
| Latest production iOS OTA | Update `01a0007d-6de3-756a-8048-79f0d210c28c`, group `16abd111-6d79-42bb-80cd-f3760d1bdc17`, commit `2a1e07d` | EAS publish receipt and `eas update:list --branch production --limit 1` |
| Native build baseline | Build 34 fingerprint recorded from commit `dd4a21d` | `9c4a8b1`; `fingerprint.json` |
| Working tree before this cleanup | Only four documentation records were dirty; no application/runtime file was dirty | `git status --short` on 2026-08-14 |

## Governing source hierarchy

1. Shipping implementation, production configuration, database policies, and live runtime evidence.
2. Final Wave 3 atlas snapshot in `docs/design/wave-3-final/`.
3. Repository tests, evidence ledgers, decisions, and runbooks.
4. Exact Expo SDK 57 and current first-party vendor documentation.

When an old plan or atlas statement conflicts with shipping truth, shipping truth wins and the record is corrected. Credentials, legal acceptance, banking, 2FA, and irreversible Apple actions remain founder-only.

## Wave 3 implementation state

- The authoritative atlas contains 138 frames: `38 + 15 + 31 + 20 + 21 + 13`. The earlier 139-frame report was a bookkeeping error.
- The dependency-free Wave 3 implementation and the subsequent D-1/D-2/D-5 product decisions were integrated in the repository before the current checkpoint.
- Later founder reviews produced additional accepted corrections for Today, Closet, Plan/Trips, Profile, intake, catalogue search, typography, and example-first discovery.
- The latest Closet zero state renders the account's real identity shell first, then four centred equal-width metrics, then a clearly labelled inert example, then the setup action.
- The current acceptance summary is maintained in `docs/ops/wave3-visual-acceptance-matrix.md`.

## Deterministic AI programme

Implementation packets are committed and pushed:

| Packet | Commit | Outcome |
|---|---|---|
| Catalogue Photo V2 | `6144665` | Licensed catalogue matcher and shared typed/voice query path |
| Control plane and demand aggregate | `c1786fb` | Workload configuration, truthful attempts, privacy-safe demand counters |
| Packing and Today | `0a0014b` | Deterministic packing memo and local-first Today policy |
| Voice parser and stylist facts | `37915e6` | Deterministic parsing and grounded factual tools |
| Tagging contract | `1c10306` | Brand-evidence rules, validators, deterministic descriptions |
| Native boundary | `694607f` | Local Apple Vision/Speech module boundary and capability handling |
| Evaluation/control-plane completion | `82051a6`, `d25a1a8` | Closed old caller gaps and added versioned evaluation harness |

The authoritative evidence is `docs/deterministic-ai-evidence.md`. The code programme is implemented. Remaining validation debt is explicit rather than hidden: the garment-vision calibration corpus has `0/40` permissioned real photographs, and device-only Apple Speech/Vision paths still require representative real-device evidence. Those gaps do not justify inventing results or configuring a rescue model without measurements.

## Service evidence

| Service | Recorded state |
|---|---|
| Expo / EAS | Production runtime and latest OTA verified above; update targets the exact pushed commit |
| Supabase | Deterministic-AI migrations replayed from empty; pgTAP and production readbacks recorded in `docs/deterministic-ai-evidence.md` |
| Superwall / StoreKit | Four products connected and in Apple review as last verified in `docs/app-store/superwall-launch-directive.md`; no price or product mutation occurred in this cleanup |
| Resend | Commerce alert and export email delivery verified with message IDs in `docs/commerce/health-runbook.md` |
| Catalogue | Catalogue Photo V2 and Datafeedr path implemented; privacy-safe demand aggregate deployed |
| PostHog | Aggregate/correction telemetry excludes raw query, transcript, image URL, product title, and identity by contract and tests |
| Sentry | Explicitly deferred by founder; not a launch dependency at this checkpoint |

## Release boundaries

- JS/TS-only changes may ship by OTA only when `npm run check:fingerprint` matches `fingerprint.json`.
- Native dependencies, permissions, entitlements, config plugins, or Apple framework changes require a new EAS runtime/build.
- A successful OTA receipt is not evidence that a different runtime received it.
- Protected operational evidence is committed intentionally in documentation-only commits, never mixed accidentally into product changes.

## Apple state

This documentation reconciliation does not mutate or re-submit anything in App Store Connect. Repository evidence records subscription products in review and native Build 34 as the current fingerprint baseline. Exact approval/publication status must be read from App Store Connect at the time a release decision is made; it is not inferred from an old local ledger.

## Remaining validation, not hidden implementation work

- Collect permissioned representative garment photographs and run the versioned vision evaluation corpus.
- Exercise on-device Apple Speech/Vision paths on supported hardware when that evidence is required.
- Re-read live App Store Connect status before any submission, expedited-review, or publication action.

No application change is authorized or performed by this ledger reconciliation.

## 2026-08-31 · OTA to 1.2.1 build 45 — runtime 813c6d34

Update `01a05513-1b78-7b26-90b3-20ece33f5cbb`, channel `production`, published
via the gated rail at `82815c1` (main == origin/main). Carries, in one batch:
stylist doors signing fix (wells wear real garments), closet rail/grid caption
spacing, Today's reveal door (+ `profiles.reveal_seen_at`, applied to prod),
Apple sign-in bounded `code` + second-failure email steer, OTP paste control,
`/compose` (compose-your-own + wear_outfit_tx), Explore doors row + the
C-03-gated shop shelf.

Two honest notes. (1) The keyed-Release sim boot gate was NOT run — this
session cannot attach a simulator; the founder ordered the release regardless.
No change in the batch touches bootstrap or provider order (the 8/26 outage
class). Watch `update_id` adoption + crash-free in PostHog. (2) A first publish
attempt landed on runtime `92a3035b` and was refused by the rail post-publish:
the working directory's node_modules had been silently converted to a deno
symlink layout (12:19 that day), which added ~60 phantom native dirs to the
fingerprint. That update is an inert orphan — no binary carries that runtime —
and the fix was `rm -rf node_modules && npm ci`, after which the workdir
reproduced `813c6d34`/168 sources exactly. If fingerprints ever drift again,
check `node_modules/.deno` first.

Rollback: `eas update:republish` the prior good update on `production`, or
`eas update:rollback`. Prior update on this runtime predates 2026-08-30.

## 2026-08-31 · 1.2.2 build 46 — submitted, waiting for review

EAS build 48ef276b (commit `5b3b2ba`, fingerprint/runtime `ccfa8345`,
recorded in fingerprint.json at `875235c`). Embeds the full 08-31 OTA batch
natively so a NEW install's first session runs the fixed code (an OTA only
lands on relaunch — the Apple sign-in steer and the reveal door are
first-session features). ASC: version b58dc5c3, build 67c76709 attached,
review submission bdda1528 WAITING_FOR_REVIEW since 01:18Z, releaseType
AFTER_APPROVAL. Metadata pushed via eas metadata:push: review notes rewritten
for this build's contents (Pinterest paragraph held for 1.3.0 — the flow is
dark until their trial clears), Sep-1 prices, first releaseNotes, v3
screenshot set (5, all COMPLETE). OTA channel for the 1.2.1 fleet remains
`813c6d34` / update 01a05513; future OTAs after 46 goes live must target
`ccfa8345`.

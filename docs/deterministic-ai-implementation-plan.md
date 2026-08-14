# Cinch deterministic AI implementation plan

Status: implementation complete; retained as the historical execution contract

Owner: Claude Code implements; Codex verifies, coordinates, and owns simulator/release acceptance.
Priority: complete every workstream without mixing it into an unfinished Catalogue Photo V2 checkpoint.

Completion note — 2026-08-14: Catalogue Photo V2 and deterministic-AI Packets
1–6b are committed and pushed (`6144665` through `d25a1a8`). Production
migrations/functions, native build boundary, automated checks, and the versioned
evaluation harness are recorded in `docs/deterministic-ai-evidence.md`. This
plan is no longer an active task list. Its remaining items are validation debt,
not hidden implementation: `0/40` permissioned real garment photographs for
vision calibration and representative real-device evidence for device-only
Apple Speech/Vision paths. No rescue model is selected until measured quality
supports that decision.

## Outcome

Cinch uses deterministic code for facts, arithmetic, parsing, ranking, image measurements, retrieval, and repeatable copy. AI remains only where perception, speech recognition fallback, open-ended taste, or ambiguous language genuinely requires it. Cheap primary models are protected by deterministic semantic validation and a stronger-model rescue only when validation fails. Normal screens never wait on AI when a correct local result already exists.

No new paid service is approved. Reuse Apple Vision/Speech, Datafeedr, Open-Meteo, Supabase, PostHog, and OpenRouter. A new package, vendor, recurring charge, or new external data recipient requires founder approval.

## Current truth and source hierarchy

1. Shipping code and production Supabase configuration/telemetry.
2. The accepted Catalogue Photo V2 handoff and current CPV2 implementation.
3. This plan.
4. Exact Expo SDK 57 documentation, current Supabase changelog/docs, and current Apple framework documentation.
5. Older design and architecture notes only when they do not conflict with the above.

If a public claim conflicts with runtime truth, runtime wins and the claim must be corrected. If a proposed deterministic path lowers measured quality, preserve the existing AI path and report the failed acceptance case rather than shipping a regression.

## Starting state and protected work

- Repository: `/Users/nelsonsaenz/cinch`, branch `main`.
- Catalogue Photo V2 closed at `6144665` before this programme began; this line is retained as the historical sequencing rule that prevented mixed release packets.
- Never edit or stage `docs/commerce/health-runbook.md`, `docs/ops/cinch-implementation-release-ledger.md`, or `docs/ops/wave3-visual-acceptance-matrix.md` unless Nelson separately authorizes it.
- Preserve unrelated user work and the byte-exact local environment files.
- Do not reset, discard, rewrite, or hide existing changes.

## Invariants

- Typed and single-item voice catalogue queries share one normalized deterministic Datafeedr path.
- Bulk voice never searches the catalogue automatically; only an explicit review-card action searches one item.
- No raw search query, transcript, image URL, signed URL, product title, or user identity enters PostHog or a global aggregate.
- AI consent remains enforced server-side before personal data reaches OpenRouter.
- Every model-selected item id is checked against ids supplied by Cinch.
- A deterministic fast path does not spend AI quota.
- No AI model calculates counts, dates, prices, cost-per-wear, weather, or database facts.
- No second model is used merely to review the first. Escalation is allowed only after deterministic validation rejects or marks the primary result low-confidence.
- Native dependency, permission, entitlement, Expo config-plugin, or Apple framework changes require a new runtime/store build. Do not publish them as an OTA-only change.

## Workstream 0 — baseline and execution ledger

1. Finish CPV2 and leave a clean committed/pushed checkpoint.
2. Capture the baseline commands, test count, lint warning baseline, fingerprint, production AI configuration, and aggregate `ai_calls` metrics.
3. Create a durable checklist/evidence file for this program with packets, changed files, commands, migrations, deployed functions, runtime/fingerprint, and unresolved acceptance cells.
4. Read the exact Expo SDK 57 docs before any Expo code or configuration change.
5. Read the current Supabase changelog and relevant Edge Functions/database/RLS documentation before backend or schema changes.

Acceptance:

- Baseline is reproducible from a clean checkout.
- Existing CPV2 acceptance remains green.
- Protected/user-owned files are absent from every staged diff.

## Workstream 1 — AI control plane and observability

### Configuration

- Add distinct workloads for `voice_transcription`, `closet_parsing`, and `packing_brief`; stop accounting them as `tagging` or `stylist_chat`.
- Move hard-coded ASR and closet-parser model choices into server-owned configuration.
- Make every OpenRouter/ASR caller read the configured timeout.
- Record actual provider attempts, including retries, in `ai_calls.attempts`.
- Add primary model, optional rescue model, max tokens, timeout, enabled state, and validator policy without exposing write access to clients.
- Preserve fail-closed AI consent, quota, and provider data-collection routing.

### Accounting

- Record ASR success/failure, latency, model, attempts, and available token/cost data without recording transcripts or audio paths.
- Record packing and parsing under their own workloads.
- Add operational aggregate queries for count, success rate, p50/p95 latency, cost, rescue rate, and validator-rejection rate.

### Migration/security

- Use the repository's imperative migration workflow and `supabase migration new`.
- New exposed tables require explicit grants and RLS. Prefer private/internal aggregation surfaces.
- Run migration replay, pgTAP, advisors, generated types, and a production readback after deployment.

Acceptance:

- Every provider call creates one truthful logical ledger record.
- A retried request records the real attempt count.
- Changing model/timeout configuration requires no app release.
- No transcript, prompt, signed URL, or raw user content appears in operational telemetry.

## Workstream 2 — privacy-safe catalogue demand aggregate

Build the aggregate Nelson requested so common demand and weak queries become measurable without storing raw user phrases.

- Derive only canonical, allow-listed fields after query parsing/catalogue resolution: recognized catalogue brand, fixed garment class, audience bucket, and optional broad color family.
- Store an order-free intent key/hash and daily counters: searches, zero-result searches, family opens, import attempts, successful imports, and latency bucket.
- Never store the raw sentence or unknown free-form fragments.
- Keep user identity out of the aggregate. Prevent one client from inflating counters through existing quota/idempotency boundaries.
- Provide founder queries for top demand, worst zero-result intents, and highest import conversion.
- Only promote an intent into the public/golden regression set after a privacy threshold; founder operational inspection can read the private aggregate.

Acceptance:

- `James Perse men's T-shirt` is represented as canonical structured intent, never recoverable sentence text.
- Word order and punctuation cannot create a second intent.
- Search, zero-result, and import-success counters reconcile against request fixtures.
- Static tests prohibit raw-query columns/properties.

## Workstream 3 — deterministic packing memo

- Keep `buildPackingList`, real forecast, seasonal normals, formality targets, packed-piece counts, and unfilled looks as authorities.
- Replace the live `packing-brief` model dependency with a pure deterministic memo builder.
- Generate the headline, spec fragments, observation, gaps, and per-day-part notes only from proven trip, weather, and packed-result fields.
- Remove unsupported cultural/restaurant/local-style claims rather than guessing them.
- Make memo generation synchronous/offline once trip, closet, and cached weather are present.
- Retire or disable the old Edge Function safely; update privacy/help/capacity copy and tests so they no longer claim packing sends data to AI or spends stylist quota.

Acceptance fixtures:

- Forecast available; seasonal normals fallback; no weather; rain gap; formal-event gap; thin closet; fully covered trip; repeated pieces; unfilled looks.
- Same input produces byte-identical structured memo output.
- No OpenRouter request or AI quota claim occurs from packing.

## Workstream 4 — stable deterministic Today policy

- Keep the local beam search and learned affinities as the visible outfit authority.
- Add a pure `shouldEnhanceWithAi` policy. Normal morning generation is local-only.
- AI may be requested only for a complex free-text note, a multi-event formality conflict, or a measured near-tie that deterministic rules cannot distinguish.
- Once cards are visible, late AI output may enrich bounded prose but must not reorder or replace the garments under the user.
- Deterministic names/reasoning come from verified scoring notes and existing `explain`/swap logic.
- A failed/disabled/declined enhancement leaves the same complete outfit experience without retries.

Acceptance:

- Ordinary Today makes zero AI calls.
- Explicit complex-note, multi-event conflict, and near-tie fixtures take the enhancement branch.
- No late response reshuffles visible cards.
- Offline and consent-declined states retain real outfits and truthful copy.

## Workstream 5 — deterministic closet voice parser with AI fallback

- Build a pure parser over normalized clauses and the shared fixed lexicons.
- Handle quantities, known colors, garment nouns/slots, materials, simple patterns, conjunctions, punctuation, and straightforward corrections.
- Preserve exact transcript spans as receipt lines.
- Emit confidence and unconsumed spans. Never guess an absent color; leave it unresolved for review rather than inventing the likely value.
- Send only ambiguous/unconsumed spans and the minimum relational context to the configured parsing model.
- Merge model fallback results through the same deterministic semantic validator and exact-span proof.
- Do not claim AI quota for a completely deterministic parse; account only when fallback is called.

Acceptance fixtures include at least 50 cases:

- Simple singular/plural lists, multiword colors, quantities, brands/materials, self-corrections, repeated garments, relative phrases, unfinished speech, unknown nouns, and adversarial invented spans.
- Clear lists return without OpenRouter.
- Relative/ambiguous language reaches fallback once.
- Every returned garment maps to a verbatim span or is visibly refused.

## Workstream 6 — deterministic stylist tools

- Add a closed, deterministic intent router before `stylist-chat`.
- Implement grounded tools/templates for counts, color distribution, most/least worn, unworn pieces, cost-per-wear, wear history/date lookup, closet gaps, and shoes/pieces compatible with an outfit.
- Use database/RLS or already-loaded local data as appropriate; do not send a closet to AI to calculate a fact.
- Open-ended advice continues to use AI, but receives compact structured facts and preassembled outfit candidates.
- Cache stable closet facts/digests by closet revision.
- Unknown or ambiguous questions go to the model; obvious factual questions never do.

Acceptance fixtures include at least 30 questions with paraphrases and negative cases. Every numeric/date answer must reconcile with database fixtures. The model is never asked to perform arithmetic already available in tool output.

## Workstream 7 — deterministic garment/photo pipeline

### Existing native foundation

Extend the existing local Expo module rather than adding another vendor.

- Apple Vision OCR for visible labels/wordmarks.
- Apple Vision image feature prints for similarity ranking.
- Deterministic blur, exposure, framing/coverage, and subject-confidence checks.
- Per-user duplicate detection using a non-reversible visual fingerprint; never a global cross-user photo index.
- Existing Apple Vision foreground lift, plate normalization, and local color extraction remain authoritative.

### Tagging contract

- Limit the vision model to fields requiring semantic perception: category/subcategory, material uncertainty, pattern, fit, warmth/formality/occasion judgments.
- Brand is accepted only when local OCR/catalogue evidence or an explicit user correction supports it.
- Build deterministic semantic validators: category/subcategory compatibility, solid-pattern scale, water-resistance evidence, enum membership, score ranges, and contradiction handling.
- Generate the final short garment description from validated fields instead of asking the model for prose.
- A semantic rejection invokes the configured rescue model once; otherwise it becomes `needs_review` with no repeated verification loop.

### Photo-to-catalogue fast path

- OCR a visible label locally.
- Query Datafeedr deterministically with OCR-supported brand plus validated garment class/color.
- Download only bounded candidate thumbnails and rank with local feature-print distance.
- If confidence clears the calibrated threshold, show those licensed candidates without vision AI.
- If OCR/catalogue/similarity is inconclusive, preserve the current consent-gated photo vision fallback.

Acceptance:

- Plain-background garment, hanger, flat lay, mirror/person, multiple objects, blurred/dark/overexposed photo, visible label, invisible label, duplicate upload, exact catalogue match, near match, and no match.
- No new photo or biometric information enters analytics.
- A local match never spends AI quota.
- User correction always outranks OCR/model inference.

## Workstream 8 — local-first short voice recognition

- Implement a custom Expo/Swift module using `SFSpeechRecognizer` with on-device recognition required for the short catalogue-query path.
- Detect locale/support/authorization and expose bounded states to React Native.
- When on-device recognition is unavailable, offer the existing consent-gated Whisper/OpenRouter fallback; do not silently transmit audio.
- Keep bulk closet walkthrough audio on the proven Whisper path until representative evaluation shows local recognition meets the garment-vocabulary bar.
- Update permission copy, privacy disclosure, config, native tests, and support diagnostics.

Acceptance:

- Supported device transcribes a short query without upload.
- Unsupported locale/device and denied permission have truthful recovery.
- Cloud fallback happens only after the existing AI/audio disclosure and consent path.
- This packet produces a new EAS runtime/build; it is never labelled OTA-only.

## Workstream 9 — evaluation, cascade, and quality gates

Build versioned evaluation harnesses rather than choosing models by price tables.

- Garment vision: 40–50 permissioned real photos with hand-verified tags. Use private/authenticated storage references; never commit personal images or signed URLs.
- Closet parsing: at least 50 transcript fixtures.
- Stylist: at least 30 factual/open-ended prompts with grounded expected facts and qualitative rubric.
- Packing: at least 20 deterministic scenarios.
- Catalogue: current James Perse fixture plus promoted high-demand/zero-result canonical intents.

Measure category/field accuracy, user-correction rate, semantic rejection, rescue rate, p50/p95 latency, success rate, tokens, and cost. The primary cheap model remains only if it clears the workload-specific quality bar. Rescue occurs once after deterministic rejection/low-confidence; a rescue failure degrades or asks for review, never loops.

If fewer than 40 permissioned real user photographs exist, complete the harness and use every available representative photo, but record the missing sample count as an explicit founder/input blocker rather than pretending catalogue images prove camera-photo quality.

## Packet order and release boundaries

1. CPV2 closure and clean checkpoint.
2. Control plane + aggregate.
3. Packing + Today deterministic behavior.
4. Voice parser + stylist tools.
5. Tagging validators/description and non-native photo fast paths.
6. Native OCR/feature prints/image-quality + Apple Speech.
7. Evaluation tuning, full regression, production migrations/functions.
8. OTA for same-runtime packets only after fingerprint/runtime proof.
9. New EAS build for native packets; install and exercise the production/TestFlight build.

Each packet ends with changed files, exact checks, migration/function evidence, deviations, rollback, and a clean committed/pushed checkpoint. Do not batch unverified migrations or deploy a later packet over a failing earlier one.

## Final acceptance

- Full automated suite, TypeScript, Expo lint at or better than baseline, Deno checks, migration replay, pgTAP, advisors, and fingerprint/build checks pass.
- Real-device tests cover camera, OCR, feature matching, duplicate detection, local speech, fallback consent, and garment import.
- Production readback proves workload config, accounting, aggregates, and deployed Edge Function versions.
- AI privacy/help/export copy matches the final data flows.
- No paid vendor or unapproved dependency was added.
- Same-runtime changes have a verified EAS Update receipt; native changes have a verified EAS build installed.
- Repository changes are scoped, committed, pushed, and protected/user-owned files remain untouched.

## Stop conditions

Stop and report rather than guess if implementation requires a new paid vendor, new external data recipient, unavailable Apple capability, unapproved user-photo reuse, destructive migration, legal/privacy change beyond the approved flows, or a quality gate that cannot pass with available representative data. Do not weaken tests, fabricate evidence, or call a partial native implementation shipped.

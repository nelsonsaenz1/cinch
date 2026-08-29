# Claude Code directive — build and publish Pinterest Style Inspiration

Run this entire program in **Claude Code with the exact Opus 5 model at High
effort**. Verify the active model before changing files. Do not silently fall
back to Sonnet, Fable, an older Opus model, or a lower effort setting.

This is an end-to-end execution directive, not a planning request. Inspect,
design, implement, test, integrate, deploy, build, submit, and publish. Do not
pause for routine approvals or ask the founder to choose implementation details
you can resolve from the repository, current first-party documentation, and
runtime evidence.

## Mission

Ship **Style Inspiration** in Cinch:

> A person connects Pinterest, chooses a board such as Fall/Winter Clothing,
> asks the Stylist for an occasion-specific look, sees the Pin that inspired the
> answer, and receives a wearable version assembled from garments she actually
> owns.

Example:

> “I’m going to lunch with friends this fall. Draw inspiration from my
> Fall/Winter board.”

Cinch should select a relevant inspiration, show it with clear Pinterest
attribution and a source link, then show one or more honest closet versions.
The closet is authoritative. Missing pieces remain visible as gaps. Cinch never
claims ownership of a garment that is not in the account and never silently
turns the request into shopping.

When the feature is complete, publish the exact feature-bearing version to the
App Store. Do not release the currently approved binary as a proxy for this
work if it does not contain the feature.

## Operating mode

- Work autonomously from start to finish.
- Use internal Claude Code workers where useful, but keep one integration and
  release owner.
- Make decisions from current repo truth and first-party documentation.
- Keep a durable task/evidence ledger so another session can resume without
  repeating work.
- Finish coherent vertical slices; test each slice; continue immediately.
- Preserve user-owned and unrelated work.
- Do not report completion from a plan, mock, disabled button, fake API, local
  fixture, self-reported test result, successful upload, or queued build.
- Do not bulk-merge stale branches or worktrees.
- Do not add a new vendor, paid service, permission, entitlement, analytics
  recipient, public data surface, or copied trade dress unless the feature
  demonstrably requires it and current authority and policy permit it.

## Authority

You may, without further routine approval:

- inspect all Cinch source, docs, configuration, tests, local worktrees, and
  current authenticated service state;
- design the complete feature in the existing Cinch visual language;
- modify application, server, database, tests, documentation, privacy copy,
  analytics contracts, and release records;
- create additive migrations and owner-private RLS;
- deploy verified Supabase migrations and Edge Functions;
- configure existing authorized Pinterest, Supabase, Expo/EAS, Superwall, and
  App Store Connect resources required by this feature;
- commit scoped changes, push `main`, publish compatible previews, produce a
  fresh production iOS build, submit it, and release the approved
  feature-bearing version;
- reconcile intended local Cinch work before the final release.

Only stop for an actually unavailable credential or access path, 2FA requiring
the founder, a legal agreement that must be accepted, a material Pinterest or
Apple policy conflict, a new financial commitment, destructive production data
change, or a material privacy/security decision not already inherent in this
directive. Exhaust safe in-scope alternatives first. Report exact evidence and
the single smallest founder action required.

## Current repository state

- Repository: `/Users/nelsonsaenz/cinch`
- Governing branch: `main`
- Current observed local/remote baseline before this directive: `b4386f3`
- Expo SDK: 57. Read the exact current versioned documentation at
  `https://docs.expo.dev/versions/v57.0.0/` before writing application code.
- Current app version in `app.config.ts`: `1.2.1` at the time this directive was
  written. Verify live truth; do not assume it remains current.
- App Store Connect app ID: `6798479578`
- iOS bundle ID: `com.nelsonsaenz.cinch`
- Production EAS channel: `production`
- Release scripts: `scripts/release-ota.mjs`, `npm run check:fingerprint`,
  `npm run build:store`, and `npm run submit:latest`.

### Existing uncommitted work to preserve and integrate

At directive creation the main workspace contained the scoped OTP paste fix:

- `src/app/(auth)/code.tsx`
- `src/features/auth/auth-run-spec.ts`
- `tests/auth-run-layout.test.ts`

It adds a permission-safe native Paste control and formatted-code
normalization. Tests and typecheck passed. Inspect the diff, preserve it, and
commit it separately or include it deliberately in the final release. Do not
discard it.

The product/design/implementation plan created for this feature is:

- `docs/design/pinterest-style-inspiration-plan.md`

Read it, correct it when shipping truth requires, and keep its definition of
done intact.

## Source hierarchy

1. Shipping implementation, production configuration, live database policies,
   and live App Store/EAS/Pinterest state.
2. `docs/design/pinterest-style-inspiration-plan.md` and this directive.
3. Current Cinch design system, accepted screen atlases, tests, release ledgers,
   and privacy architecture.
4. Exact Expo SDK 57 documentation and current Pinterest, Apple, Supabase, and
   EAS first-party documentation.
5. Older plans and historical handoffs.

When sources conflict, shipping truth and current first-party policy win.
Document the deviation rather than silently following stale prose.

## Existing foundation — extend it, do not rebuild it

Cinch already contains most of the hard product machinery:

- `src/app/recreate.tsx` — the production “Recreate a look” flow.
- `src/features/recreate/use-recreate.ts` — user-selected inspiration image,
  private upload, bounded analysis, and failure states.
- `supabase/functions/analyze-inspiration/` — extracts bounded garment pieces
  from one user-supplied outfit image without receiving the closet.
- `src/features/recreate/match.ts` — deterministic on-device matching against
  the real wardrobe, with honest thresholds and gaps.
- `src/features/recreate/save-look.ts` — saves only real garment IDs.
- `src/features/stylist/` and `src/app/(tabs)/stylist.tsx` — intent handling,
  questionnaire, chat, local facts, grounded responses, and the current
  Recreate entry door.
- `src/lib/styling/` — deterministic outfit generation and ranking.
- Existing owner-private storage/RLS, AI consent, quota, analytics, and deletion
  mechanisms.

The implementation should turn inspiration into a provider-neutral source
contract. `Saved photo` and `Pinterest` should feed the same honest closet
matcher and result composition instead of creating parallel styling engines.

## Product requirements

### Core flow

1. The person opens Style Inspiration from the Stylist or the current Recreate
   entry.
2. She can keep using a saved screenshot/photo without Pinterest.
3. She can connect Pinterest using official OAuth and minimum read scopes.
4. She chooses the relevant board. Do not import the entire account silently.
5. She asks naturally for an occasion, season, weather, or formality.
6. Cinch retrieves a relevant Pin from the chosen board.
7. Cinch shows one attributed inspiration card linked to the original Pin.
8. Cinch shows `Your closet version`, using only garments actually owned.
9. It can offer a closer interpretation and a more casual/formal alternative
   when real closet inventory supports them.
10. She can save the look, wear it now where the existing wear flow supports
    that action, refine the request, or choose another inspiration.
11. She can disconnect Pinterest and delete all Cinch-held connection material.

### Truth rules

- Pinterest supplies inspiration, never closet inventory.
- The app distinguishes exact/close/interpretive matches.
- A low-confidence garment is a visible gap, not a recommendation.
- No public Pin feed, follower mechanics, counts, badges, or Pinterest-like UI.
- No shopping unless the person separately and explicitly asks for shopping.
- No brands inferred from logos.
- No full closet, garment photographs, board data, Pin data, token, or user
  identity enters analytics.
- No Pin is presented without clear attribution and a link to its source.

## Design requirements

Use Cinch’s current paper, oxblood, serif-title, restrained-card language. Do not
copy Pinterest’s red, masonry grid, controls, or trade dress.

The inspiration is evidence, not the page’s dominant product:

- one compact Pin reference card;
- the closet version is the primary content;
- garment tiles use existing Cinch media components and missing-image behavior;
- copy remains minimal and conversational;
- navigation and primary action are obvious;
- touch targets are at least 44pt;
- Dynamic Type, AX-XXXL, VoiceOver, Reduce Motion, short screens, and keyboard
  states are first-class.

Design and implement every meaningful state:

- not connected, connecting, canceled, denied, connected, expired, revoked,
  reconnecting, disconnecting, and disconnected;
- board loading, empty, inaccessible secret board, partial page, pagination,
  rate limit, offline, and provider outage;
- no relevant Pin, unavailable/deleted Pin, video-only Pin, missing metadata,
  and source-link failure;
- empty closet, partial closet, all matched, partial match, no credible match,
  slow garment images, and missing garment images;
- save/wear pending, success, failure, retry, idempotent repeat, and session
  expiration;
- account deletion and provider revocation outcomes.

Use realistic test fixtures and produce standard-size and AX-XXXL screenshots
for the final evidence packet. Inspect the actual rendered app rather than
accepting source code as visual proof.

## Pinterest implementation and policy

Use only current official Pinterest APIs and OAuth. Never scrape Pinterest,
reuse browser cookies, collect Pinterest credentials, or automate engagement.

At the time this directive was written, Pinterest’s official documentation
required authenticated API access and read scopes for boards/Pins. Its Developer
Guidelines also generally prohibited storing information obtained through the
API and sharing API information with third parties. Re-read the current rules
before implementation and design within them.

Required behavior:

- minimum scopes: public `boards:read` and `pins:read` unless current docs use
  different names;
- secret-board scopes only through a separate explicit consent if supported;
- app secret and code exchange stay server-side;
- OAuth state is random, expiring, user-bound, single-use, and consumed
  atomically;
- access/refresh tokens are encrypted, server-only, redactable, revocable, and
  absent from logs, analytics, exports, and client persistence;
- refresh is race-safe and idempotent;
- Pinterest response validation, pagination, 401/403/404/429, and provider
  outages have bounded typed outcomes;
- fetch board and Pin content live when current policy prohibits storage;
- do not persist board names, Pin titles/descriptions, image URLs, or other API
  content unless current Pinterest authorization expressly permits it;
- disconnect revokes upstream access where supported and deletes Cinch-held
  secrets;
- account deletion covers every connection artifact.

Do not send Pinterest API data or Pin imagery to OpenRouter or any other third
party unless Pinterest has expressly authorized that precise processing path.
Do not interpret “no model training” as blanket permission to transmit the data
for inference. If third-party processing is not authorized, use a compliant
local/on-device approach that is demonstrably adequate, or keep the existing
user-selected screenshot path as the honest supported analysis route. Never
fake an automated board analysis.

If a Pinterest developer application or credential is absent, use existing
authorized browser/dashboard access to create or configure it where permitted,
prepare the exact OAuth demo and application evidence Pinterest requires, and
continue every implementation task that does not depend on approval. Only
surface the blocker when no authorized path exists.

## Data, privacy, and security

- Use the smallest additive schema and the repository’s existing owner-private
  RLS patterns.
- No new public projection or friend access.
- pgTAP must prove owner-only access, unrelated-user refusal, anon refusal,
  OAuth-state expiry/single use, and deletion.
- Secrets are never in `EXPO_PUBLIC_*`, client bundles, git, test fixtures, logs,
  screenshots, or completion reports.
- No user-provided Pin or board content enters PostHog. Analytics may contain
  only closed event names, provider state, bounded outcome codes, latency bands,
  and counts that cannot reveal the content.
- Respect existing AI-processing consent. Any new data recipient or processing
  purpose must be disclosed before first transfer and reflected in the privacy
  policy/App Store privacy answers.
- Preserve the model/closet boundary: the model may receive an expressly
  authorized inspiration image, but never the closet. Matching remains local.
- Rate and cost controls use existing AI workload/config/quota/accounting
  patterns. Do not create unlimited spend.
- Add idempotency and cleanup for failed OAuth, failed imports, failed saves,
  partial writes, retries, disconnect, and account deletion.

## Implementation sequence

Proceed continuously without waiting for approval between these phases.

### 1. Orient and baseline

- Read `AGENTS.md`, `CLAUDE.md`, this directive, the design plan, current design
  tokens/atlases, existing recreate/stylist/privacy/release code, and exact
  first-party docs.
- Inspect all local worktrees/folders and current remote state.
- Record the active Opus 5 High model.
- Run baseline typecheck, tests, scoped lint, Deno checks, and fingerprint.
- Preserve the OTP paste work.

### 2. Freeze the product/design contract

- Produce a concise route/component/state/data/analytics/test map.
- Use the existing visual system; do not block on decorative redesign work.
- Add or update durable design fixtures for every state needed for QA.

### 3. Build the provider-neutral foundation

- Refactor Recreate only as much as needed to accept inspiration sources without
  regressing saved photos.
- Add the Style Inspiration entry, source choice, and complete local flow.
- Keep matching and save/wear paths grounded in real garment IDs.

### 4. Build official Pinterest connection

- Implement server-side OAuth, encrypted token lifecycle, live board/Pin reads,
  typed errors, attribution, source links, disconnect, and deletion.
- Add the smallest safe migrations/functions/RLS/tests.
- Configure existing authorized service secrets without printing them.

### 5. Integrate with Stylist

- Recognize natural inspiration requests and resolve occasion, season, weather,
  and formality using existing deterministic/local facts.
- Retrieve a relevant allowed inspiration from the selected board.
- Produce the closet version through the existing matcher/engine.
- Render one source Pin plus one or more real closet answers and honest gaps.
- Preserve quota semantics and chat history behavior.

### 6. Verify and harden

- Unit, integration, contract, pgTAP, Deno, typecheck, lint, full test suite, CI,
  iOS bundle, and fingerprint.
- Real OAuth round trip with an authorized test account.
- Clean-account and returning-account flows.
- Standard and AX-XXXL simulator/product screenshots.
- VoiceOver order, Reduce Motion, short screen, offline/retry/revoked/delete.
- Inspect analytics/logs for forbidden content and credentials.
- Inspect dependency, permission, entitlement, privacy, and native fingerprint
  changes.
- Review the full diff and remove dead fixtures, debug logging, fake data, and
  accidental unrelated edits.

### 7. Integrate and deploy backend

- Reconcile intended local work only; preserve protected/unrelated changes.
- Commit coherent scoped changes with inspectable history.
- Push `main`; require clean `main == origin/main`.
- Deploy verified production migrations/functions and perform production
  readbacks.
- Verify provider configuration and privacy/delete behavior in production.

### 8. Produce the feature-bearing App Store release

First read live App Store Connect and EAS state. The founder reports that a new
version was approved for manual publication. Do not assume the local ledger is
current.

This feature is a material functional addition. Do not use EAS Update to add it
to a binary Apple reviewed without it. Apple’s current App Review Guideline
2.5.2 and Expo’s own update guidance govern. Embed the feature in a fresh native
binary/version, submit that exact binary for review, and release only the
feature-bearing version.

- If the approved version/build does not embed Style Inspiration, hold it. Do
  not press release merely because it is approved.
- Create the next valid App Store version/build number from final clean `main`.
- Calculate and record the final fingerprint/runtime.
- Build production iOS through EAS with the production environment.
- Auto-submit through the configured production path where supported.
- Update App Store metadata, review notes, privacy answers, and integration
  disclosures so they match the actual feature.
- Never accept a new Apple legal agreement or complete 2FA for the founder.
- Wait for the exact build to finish processing and complete App Review.
- Only then release it according to the intended manual/automatic release
  setting.
- Verify live Ready for Sale/Distribution status, version, build number,
  TestFlight/App Store state, EAS build URL/id, channel, runtime, fingerprint,
  and production backend state.
- Use OTA afterward only for compatible fixes, never to introduce this feature
  after review.

## Required tests and evidence

At minimum, preserve evidence for:

- existing Recreate behavior unchanged;
- saved photo and Pinterest source selection;
- OAuth success/cancel/deny/state mismatch/replay/expiry/revocation/refresh;
- boards and Pins pagination, empty, deleted, unauthorized, secret, 429, and
  provider outage;
- natural Stylist prompt → relevant inspiration → closet-only result;
- full/partial/no-match outcomes and no invented garment IDs;
- no shopping without explicit shopping intent;
- save/wear idempotency and failure recovery;
- offline behavior and no stale-source misrepresentation;
- disconnect, token revocation, and account deletion;
- owner-only RLS and no public/social leakage;
- no Pinterest or closet content in analytics/logs;
- Dynamic Type, VoiceOver, Reduce Motion, and touch-target requirements;
- no copied Pinterest trade dress;
- production migrations/functions readback;
- clean `main == origin/main`;
- feature-bearing App Store build approved and live.

## Completion packet

Return one final evidence packet containing:

1. exact Opus 5 model and High effort evidence;
2. final product/design deviations and reasons;
3. commits and `main == origin/main` proof;
4. changed files, migrations, functions, schemas, permissions, dependencies,
   recipients, and privacy disclosures;
5. complete test/CI/Deno/pgTAP/bundle/accessibility/visual results;
6. Pinterest app/access tier, approved use, scopes, OAuth redirect, live
   connection proof, and policy-compliant data lifecycle;
7. production migration/function/RLS deployment and readback evidence;
8. final Expo fingerprint/runtime/channel and any OTA receipts used only for
   post-review fixes;
9. EAS production build URL, ID, app version, build number, submit receipt, and
   processing result;
10. App Store Connect version/build status and live Ready for Sale/Distribution
    proof;
11. rollback and support procedure;
12. every remaining limitation or blocker, with no euphemisms.

## Definition of done

Done means a real user can connect Pinterest, choose the intended board, ask the
Stylist for an occasion look, receive an attributed inspiration and honest
closet version, save or wear it, disconnect/delete cleanly, and use the feature
in the exact production binary Apple approved and the App Store is distributing.

Anything less is partial. Do not publish the old approved version, delete this
directive, or claim completion until the feature-bearing build itself is live.

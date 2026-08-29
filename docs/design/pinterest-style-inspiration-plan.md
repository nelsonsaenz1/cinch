# Pinterest Style Inspiration — product, design, implementation, and release plan

Status: **planned; implementation and release gated**  
Written: 2026-08-29  
Owner: Cinch  
Primary existing surface: `Recreate a look`

## Outcome

A person can connect Pinterest, choose a board such as Fall/Winter Clothing,
and ask the Stylist for an occasion-specific look. Cinch uses a relevant Pin as
the visual reference, then answers from garments the person actually owns. The
result clearly separates the inspiration from the closet version, names honest
gaps, and links back to Pinterest.

The feature extends the shipped `Recreate a look` pipeline. It does not replace
the on-device closet matcher or send the wardrobe to a model.

## Product contract

### Primary moment

“I am going to lunch with friends this fall. Show me something that feels like
my Fall/Winter board, using my own closet.”

### Primary action

`Wear this version` / `Save this look`, depending on whether the request is for
today or later.

### Promise

- Pinterest supplies inspiration, not inventory.
- The closet remains the source of truth.
- Exact matches, interpretations, and missing pieces are labeled honestly.
- No shopping result appears unless the person explicitly asks to shop.
- Pinterest is optional. The existing saved-photo flow remains available.

### Non-goals

- No Pinterest scraping, cookie/session reuse, or password collection.
- No feed clone, public inspiration profile, social ranking, or engagement
  automation.
- No training or fine-tuning on Pinterest content.
- No silent import of a whole Pinterest account.
- No claim that an outfit is an exact recreation when it is only similar.

## Design plan

### Entry points

1. Stylist door: evolve `Recreate a look` into `Style inspiration` while
   preserving the saved-photo entry.
2. Stylist composer: requests such as “lunch with friends this fall” can use a
   connected board when the user has enabled it.
3. Profile or Privacy & data: `Pinterest inspiration` connection, selected-board
   state, disconnect, and data-use explanation.

### End-to-end flow

1. Explain the feature in one screen: selected boards only, read-only access,
   closet matching stays local.
2. Connect through Pinterest OAuth with the minimum read scopes.
3. Fetch boards live and let the person choose one for this request/session.
4. In Stylist, combine occasion, season, weather, and formality with the chosen
   board to retrieve a relevant Pin.
5. Show a compact, attributed Pin card linked to its Pinterest source.
6. Show `Your closet version` beneath it, using the existing deterministic
   matcher and real garment imagery.
7. Offer save/wear, another inspiration, or refine the request.

### Required states

- Not connected; connecting; OAuth canceled; OAuth denied; expired/revoked
  token; service unavailable.
- Boards loading; no boards; secret-board permission absent; board empty;
  pagination; rate limited.
- Pin loading; Pin unavailable/deleted; missing description; unsupported video;
  no relevant Pin.
- Closet empty/partial; all pieces matched; partial match; no credible match;
  missing garment images.
- Offline: cached closet remains visible, but Pinterest retrieval is described
  as unavailable; no stale Pin is represented as current.
- Disconnect and account deletion: access is revoked and Cinch-held connection
  material is removed.
- Dynamic Type through AX-XXXL, VoiceOver order, Reduce Motion, short devices,
  and 44pt minimum controls.

### Visual direction

- Keep Cinch’s paper, oxblood, serif-title system. Do not imitate Pinterest’s
  grid, red, controls, or trade dress.
- One Pin is evidence, not a feed: compact reference card first, closet answer
  dominant below it.
- Attribution is visible and the source opens in Pinterest/the browser.
- The inspiration image is never cropped or filtered in a way that obscures it.

## Implementation plan

### Existing truth to preserve

- `src/app/recreate.tsx` already handles a user-selected inspiration image.
- `supabase/functions/analyze-inspiration` converts that image to bounded garment
  pieces without receiving the closet.
- `src/features/recreate/match.ts` matches those pieces against the wardrobe on
  device and refuses low-confidence substitutions.
- `src/features/recreate/save-look.ts` saves only the user’s garment IDs; the
  inspiration image is not copied into an outfit.

### Architecture

1. Add a provider-neutral inspiration boundary around the existing recreate
   flow so `saved photo` and `Pinterest` are sources, not separate matchers.
2. Keep Pinterest credentials and code exchange server-side. Use the existing
   `cinch` URL scheme/browser session if supported by current Expo SDK 57; do
   not add a native dependency merely for OAuth.
3. Request only `boards:read` and `pins:read`; secret-board scopes are a separate,
   explicit consent only if the product genuinely supports them.
4. Call Pinterest live for boards and Pins. Do not persist API response content
   unless Pinterest grants a specific exception. Cache only where current
   Pinterest terms explicitly permit it.
5. Keep tokens encrypted, server-only, revocable, and excluded from logs,
   analytics, client storage, exports, and error messages.
6. Keep Pinterest titles, descriptions, URLs, Pin IDs, board names, and image
   contents out of analytics. Record only bounded workflow facts such as
   connected, board-fetch outcome, recommendation outcome, and match counts.
7. Preserve the local deterministic closet matcher. Never send the full closet
   or garment photographs to Pinterest or another provider.

### Pinterest-content analysis gate

Pinterest’s current Developer Guidelines generally prohibit storing API data
and sharing API information with a third party. Therefore:

- **Allowed baseline:** live board/Pin browsing with attribution, plus the
  existing user-selected screenshot/photo route.
- **Automated image interpretation:** implement only after Pinterest provides
  explicit authorization for this use and for any named processor receiving
  Pin imagery. Otherwise API-provided Pin images may not be sent to OpenRouter
  or another model provider.
- If Pinterest authorizes local-only derivation but not third-party processing,
  the implementation must use a measured on-device method and may not claim
  parity with the existing vision analyzer until evaluated.

The full connected-board promise is not “done” while this gate is unresolved.

### Data and security

- One owner-only connection record, minimal token metadata, encrypted token
  material, expiry, scopes, and revocation state.
- One-time, expiring OAuth state bound to a Cinch user and consumed atomically.
- No public views, friend access, advertising use, or cross-user aggregation.
- RLS/pgTAP for every new table and RPC. Service-role access is narrow and
  auditable.
- Disconnect revokes upstream access when available and deletes local secrets.
- Account deletion includes every Pinterest connection artifact.
- Rate limits, token refresh races, retries, idempotency, and provider downtime
  are explicit rather than generic network failures.

### Test and acceptance matrix

- Unit: intent-to-board retrieval, deterministic metadata ranking where used,
  match honesty, token/expiry state, copy/state reducers.
- Contract: Pinterest response parsing, pagination, rate limits, revoked access,
  unavailable Pins, and strict log redaction.
- Database: owner-only RLS, OAuth-state single use/expiry, deletion, no public
  projection.
- Client integration: connect/cancel/deny/reconnect/disconnect; select board;
  stylist request; all/partial/no match; save/wear; offline recovery.
- Privacy: no Pin data, board names, URLs, images, tokens, prompts, or garment
  identity in analytics or logs.
- Accessibility: VoiceOver reading order and labels, Dynamic Type, Reduce
  Motion, and touch targets.
- Release: full tests/typecheck/lint/Deno/pgTAP/CI; real-device OAuth round trip;
  production readback; fingerprint; clean `main == origin/main`.

## Execution plan

### Phase 0 — unblock and freeze the contract

- Confirm Pinterest app Trial/Standard access, client ID/secret, registered
  redirect URI, and the exact approved use case.
- Obtain written Pinterest authorization before third-party AI processing of
  API-provided imagery.
- Update Cinch privacy disclosures and App Store privacy answers if Pinterest
  becomes a new recipient/source.
- Preserve the current uncommitted OTP paste fix and unrelated work.

#### Phase 0 status — verified 2026-08-29, baseline `b4386f3`

Phase 0 is **not clear**, and the two Pinterest bullets above are blocked on a
founder action rather than on engineering. Verified, not assumed:

- **No Pinterest developer application or credential exists anywhere.** Searched
  `.env`, `.env.local`, `.env.example`, both `eas.json` build environments, and
  all 24 Supabase Edge Function secrets (`supabase secrets list`): no
  `PINTEREST_*` name of any kind. `grep -ri pinterest` over the tree returns
  only prose — marketing docs, this plan, the directive — plus two incidental
  lines: `pinterest.com` as an allowed host in
  `supabase/functions/garment-search/policy.ts:123`, and a comment in
  `supabase/functions/_shared/plans.ts:109`. No OAuth client, no registered
  redirect URI, no code.
- **The credential cannot be obtained from inside this program.** Creating a
  Pinterest developer app requires accepting the Pinterest Developer Agreement.
  That is a legal agreement, which this plan's own stop conditions and the
  directive's both name as a hard stop. No authorized in-scope path exists to
  exhaust first.
- **The analysis gate below therefore remains unresolved for the same reason.**
  Without express Pinterest authorization, API-supplied Pin imagery may not be
  sent to OpenRouter, which is the processor `analyze-inspiration` uses. The
  connected-board promise cannot be honestly built, let alone shipped.

Baseline gates at this commit, for whoever resumes:

- `tsc --noEmit` — clean.
- `npm test` — 3596 tests, 3595 pass, 1 skipped, 0 fail.
- `npm run check:fingerprint` — unchanged, `813c6d3413ced400fea427cbf693e9f737c4ca29`.
- Live EAS: latest production build is **1.2.1 build 45**, FINISHED, commit
  `ba5bda1`, runtime `813c6d34`, channel `production`.
- The OTP paste fix is preserved and committed on its own as
  `Auth · a native paste target for the code screen…`; `expo-clipboard@57.0.1`
  was already a direct dependency, so it moves no fingerprint.

**Nothing downstream of Phase 0 has been built.** Phase 1 was deliberately not
started: a source-neutral refactor whose only selectable source is the existing
saved photo would add a one-option chooser to a shipped flow, degrading it for
no user gain while the second source stays legally gated. Build it when Phase 0
clears, not before.

Release position: **build 45 stays held.** It does not contain this feature and
must not be released as a proxy for it.

### Phase 1 — provider-neutral product foundation

- Refactor the existing recreate feature behind a source-neutral contract.
- Add the Style Inspiration entry and saved-photo path without regressing the
  current feature.
- Complete all UI states and tests that do not require Pinterest credentials.

### Phase 2 — official Pinterest connection

- Implement OAuth, token protection/refresh/revocation, live board and Pin reads,
  pagination, selection, attribution, and disconnect.
- Deploy migrations/functions only after local replay, pgTAP, Deno checks, and
  privacy review pass.

### Phase 3 — stylist retrieval and closet answer

- Route occasion/season/weather/formality requests to a selected board.
- Retrieve one relevant Pin, derive an allowed bounded inspiration contract,
  run the existing on-device matcher, and render the closet version.
- Save/wear only real garment IDs.

### Phase 4 — integrated verification

- Run the full automated suite and clean-account/device flows.
- Verify real Pinterest OAuth and selected-board retrieval with a permitted test
  account.
- Inspect analytics/log payloads and delete/disconnect behavior.
- Compare standard and AX-XXXL product renders against the accepted design.

### Phase 5 — backend and store release

- Deploy verified production migrations/functions and perform readbacks.
- Because this is a material new feature, embed it in a fresh iOS build/version
  and submit that binary for App Review. Do not use OTA to introduce the feature
  into an already-reviewed binary.
- Hold the currently approved version; do not manually release it as a proxy for
  this feature.
- After Apple approves the feature-bearing build, verify the intended build,
  version, runtime, fingerprint, products, privacy metadata, and release setting;
  then release it and confirm Ready for Sale/Distribution.
- OTA remains available only for compatible fixes that do not introduce the
  feature after review.

## Stop conditions

Stop rather than improvise for missing Pinterest access/credentials, absent
authorization for API-content processing, legal/privacy conflict, new paid
vendor, unexpected permission/entitlement, destructive migration, Apple legal
agreement, 2FA, or release state that does not identify the exact approved
feature-bearing build.

## Definition of done

The feature is done only when a real account can connect, choose the intended
board, make an occasion request, receive an attributed Pin and honest closet
version, save/wear the result, disconnect/delete cleanly, pass every privacy and
quality gate, and the exact feature-bearing binary is approved and live in the
App Store. A mock, screenshot-only fallback, unconfigured OAuth surface, OTA-only
feature injection, or self-reported test result is not completion.

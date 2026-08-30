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

Release position: **build 45 stays held.** It does not contain this feature and
must not be released as a proxy for it.

#### Phase 1 status — SHIPPED to `main` 2026-08-30 (commit `15050a5`)

The founder overrode the initial judgment call and directed the foundation to
be built ahead of the credential. What landed, all green
(`tsc` clean, 3603 node tests, fingerprint unmoved at `813c6d34`):

- `src/features/recreate/sources.ts` — the provider-neutral source contract.
  The candidate union splits on **custody** (`local` = a file Cinch holds and
  may analyze; `remote` = a provider's picture: displayable and linkable,
  never copied, uploaded, or sent to a model). Attribution is orthogonal to
  custody. `PROVIDER_ANALYSIS_AUTHORIZED` is false for every provider;
  `tests/recreate-sources.test.ts` fails if that flips without an
  authorization on file, and separately fails if a provider source is ever
  offerable while uncleared for processing.
- `src/features/recreate/pick-inspiration.ts` — the picker half, keeping
  native imports out of the tested rules.
- `use-recreate.ts` — phases carry the full candidate; `mayAnalyze` narrows
  before the upload so a remote picture cannot reach Storage; new bounded
  failure `unauthorized_source`. `recreate_analyzed` gains `source`, a
  provider name from a closed set (still counts-only).
- Pinterest sits in the registry as `unavailable: 'not_configured'` — a fact,
  not a flag — so `sourceChoiceNeeded()` is false and **no chooser is drawn**;
  the shipped saved-photo flow is behaviourally unchanged.
- The stylist door is re-labelled `Recreate a look` → `Style inspiration`
  (key/route stay `recreate`).

Phase 1 remainder that stays open: no runtime render verification (standard /
AX-XXXL screenshots, VoiceOver pass) — this session cannot attach a simulator;
run the sim QA pass from an attended session before any release carrying the
re-label. No OTA was published for the same reason
(`cinch-keyed-release-boot-check`: keyed Release sim boot before every OTA).

**Phases 2–5 remain blocked on the Phase 0 founder action above** — the
Pinterest developer application (a legal agreement Cinch's operator must
accept) and the written processing authorization. Everything buildable without
them has been built.

#### Phase 0 update — 2026-08-30: the application exists

The founder created the Pinterest developer app in-session (the form was
prepared by the agent; the founder completed the reCAPTCHA and pressed
Submit, which is where the Developer Agreement binds):

- **App id (OAuth client id): `1606419`**, name "Cinch", company Cinch.
- Submitted with: Consumer experience → Pinner App → Pinners →
  **reads "Yes, mine"** (the authenticated user's own boards/pins only),
  privacy policy `https://cinchstyle.com/privacy`.
- **Status: Trial access pending** — Pinterest reviews connect requests. The
  app secret shows "Unavailable while trial access pending", and even
  dashboard-generated Production Limited tokens answer
  `{"code":3,"message":"Your application consumer type is not supported"}`
  (verified live 2026-08-30). Nothing on Cinch's side can accelerate this.
- Redirect URI registered and DOM-verified exact:
  `https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/pinterest-oauth/callback`

#### Phases 2–3 status — BUILT AND DEPLOYED 2026-08-30 (commit `7b90c11`)

- Migration `20260830120000_pinterest_connection` applied to production;
  its 14 pgTAP assertions re-proven against the live schema via rolled-back
  DO blocks (local Docker cannot run on this machine — recorded limitation).
- `pinterest-oauth` (verify_jwt off; /start·/callback·/disconnect) and
  `pinterest-api` deployed via the brew CLI `--use-api` rail. Production
  readbacks: bogus-state callback → 302 `cinch://pinterest-callback?error=expired`;
  unauthenticated /start and pinterest-api → 401.
- Secrets set: `PINTEREST_TOKEN_KEY` (fresh 32-byte AES key),
  `PINTEREST_CLIENT_ID=1606419`. **`PINTEREST_CLIENT_SECRET` is absent** —
  it does not exist until Pinterest grants trial access; until then /start
  answers 503 `not_configured` and the app says the source isn't available.
- Client: connection lifecycle + live fetchers (`features/recreate/pinterest.ts`),
  deterministic board/Pin selection (`features/stylist/inspiration.ts`),
  a zero-spend stylist turn with an EPHEMERAL attributed Pin card (Pin
  content never enters chat_messages — the persisted sentence may echo only
  the person's own words), PD-05 Privacy & data → Pinterest inspiration,
  `pinterest-callback` deep-link route.
- Privacy policy at cinchstyle.com/privacy updated and DEPLOYED (live
  readback: "Last updated 30 August 2026", Pinterest section + processor-table
  row) — disclosure published before any first transfer, per Phase 0.
- The analysis gate stays closed: no Pin imagery touches OpenRouter anywhere;
  the closet version comes from the deterministic engine. The connected-board
  flow therefore does not claim parity with the vision analyzer.

#### Release picture — corrected 2026-08-30

Build 45 (1.2.1) was **released by the founder on 2026-08-28 21:36 UTC** and
is live (iTunes lookup readback). The hold recorded above is moot. The
feature ships in the NEXT version; it must not be OTA'd into 1.2.1 (App
Review 2.5.2 / this plan's own rule), even though the fingerprint (813c6d34)
would technically reach it.

#### What still gates the release

1. **Pinterest trial approval** (Pinterest's own review; nothing to do here).
2. Then: read the app secret from the dashboard → `supabase secrets set
   PINTEREST_CLIENT_SECRET` → real OAuth round trip with a test account.
3. Sim QA from an ATTENDED session: keyed Release boot, standard + AX-XXXL
   screenshots, VoiceOver order, Reduce Motion.
4. Version bump (1.3.0 — material feature), store build, submit with updated
   review notes + privacy answers (Pinterest as a data source is disclosed;
   no new "collected" category — board/Pin content is not collected, the
   connection credential is server-side), App Review, release.

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

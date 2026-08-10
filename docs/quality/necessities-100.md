# The 100 necessities — pre-submission gate (2026-08-06)

Every item an app of this kind must have, verified against Cinch as of `main@38150ea`.
Sources: founder field reports, four read-only audits (backend, App-Store readiness,
tech stack, Fable product gate — all 2026-08-06), competitive research (Whering, Indyx,
Acloset, Bluesky source), and the field guide (`docs/design/field-guide-content.md`).

Status legend:
- ✅ **VERIFIED** — exists, matches design, connected, works (with today's evidence)
- 🔧 **FIX WAVE** — actionable now; assigned to the current agent army
- 📋 **FOUNDER** — needs the founder's hands (dashboard/credentials/decision)
- ⏳ **FAST-FOLLOW** — deliberately after first submission, with reasoning

## A · Identity & auth (1–10)
1. ✅ Welcome screen sells the product in one screen (01, live-verified; hero recomposed today)
2. ✅ Sign in with Apple (real `AppleAuthenticationButton`, gated by availability)
3. ✅ Email OTP/magic-link sign-in, end-to-end proven (signup→Resend ~0.5s→session)
4. ✅ Branded auth emails (serif masthead; impressed a hostile reviewer)
5. ✅ Session survives force-quit; keychain storage with honest failure alerts (fixed today)
6. ✅ PKCE wrong-device copy, deduplicated code exchange
7. ✅ Redirect allow-list locked to `cinch://auth-callback`
8. ✅ Account deletion in-app (Profile → Delete account; resumable edge function) — 5.1.1(v)
9. 🔧 Deleted user's avatar must be purged (new `avatars` bucket not covered by delete-account)
10. ✅ Terms & Privacy links on welcome; live at www.cinchstyle.com (DNS fixed today)

## B · Ingest & capture (11–22)
11. ✅ Live camera viewfinder with permission requested on entry (fixed today, founder report)
12. ✅ Denied-permission designed state with Open Settings; Library/Describe stay usable
13. ✅ Camera-roll multi-select via PHPicker (no plist key; 60-item batch cap)
14. ✅ AI-processing consent sheet (07b verbatim), server-enforced consent version
15. ✅ Consent resumes the intercepted action (double-tap bug fixed today)
16. ✅ Progress rail "Processing N of M" with named per-item states (07a verbatim)
17. ✅ Failure taxonomy: retryable vs terminal; dismissible banners; capped retries; no immortal jobs
18. ✅ Describe-import flows through the same queue with visible progress (fixed today)
19. 🔧 Paste-a-product-URL import (the category's #1 cold-start gap; `garment-search` fn has an SSRF-guarded import path to build on)
20. ✅ Tagging works in production (first successful E2E 2026-08-06; accurate on live test)
21. ✅ Review deck "Is this right?" slides (08), signed images (fixed today), safe-area correct
22. ✅ Confirm-the-rest shortcut; gaps admitted quietly on-card (toned down today)

## C · Closet (23–34)
23. ✅ Closet-as-profile: stats row, identity, style chips, rails, live category filter (03a)
24. ✅ FOLLOWERS stat in header (built today; honest row-count, taps to /friends)
25. ✅ Profile editing: name, @handle claim with live availability, bio, avatar (built today)
26. ✅ Ghost-slot empty state under "Add your closet" (03c + founder direction)
27. ✅ "Reading your wardrobe…" resolves (root-caused twice today: hung auth await; false-empty)
28. ✅ Grid for populated-but-unworn closets; LATEST PIECES fallback rail (fixed today)
29. ✅ Item names derived ("Cream sweater", not "sweater"); singular "1 PIECE" (fixed today)
30. ✅ Item detail: spec row, cost-per-wear honesty ("Add price"), SUITS/COLOURS (04)
31. 🔧 Item deletion — DOES NOT EXIST anywhere; privacy claim was removed rather than lie. Must exist before strangers upload photos of their belongings
32. 🔧 Re-tag affordance after initial review (tagger correction is our competitive edge; `force` param exists server-side)
33. 🔧 Grid image polish: `recyclingKey` (recycled-cell flicker), placeholder strategy
34. ⏳ Pagination for 200+ item closets (breaks worst for best users; no launch-week closet will hit it — fast-follow with signed-URL windowing)

## D · Today & styling (35–44)
35. ✅ Morning plates with reasoning, palette, cost-per-wear colophon (02a)
36. ✅ Love / Not-for-me / I-wore-this reactions live
37. ✅ Honest empty state at zero items (02b verbatim)
38. ✅ Honest building state at 1–7 items with count + missing ingredient (fixed today)
39. ✅ "Nothing works" honest state (02c); offline state (02d) — in code, sim-verified compositions
40. ✅ Stylist ✦ entry in EVERY masthead state (fixed today — was absent in 5 of 6)
41. ✅ Styling engine: deterministic, weather-aware, OKLCH palette math (the real IP; smoke-tested in CI)
42. ✅ generate-outfits function live and answering (proven today)
43. ⏳ Wear diary / browsable worn-log history (the Letterboxd spine; data already recorded — `worn_at` exists. Highest-leverage fast-follow; too structural for tonight)
44. ⏳ Season in Review artifact (editorial recap; reuses share frame)

## E · Stylist chat (45–48)
45. ✅ Chat with real model, closet-grounded, "only your clothes" honesty (06; live 200 today)
46. ✅ Input rises above keyboard; text unclipped (fixed today)
47. ✅ Quota by tier, server-enforced; consent-gated
48. ✅ Refusal copy when gated (legible, not broken-looking)

## F · Plan & events (49–58)
49. ✅ Week strip + Events toggle (05); no state renders blank (fixed today — was the paywall overlay)
50. ✅ Event cards: attendees, weather, status labels (LOOK SET / NEEDS A LOOK / PACKING)
51. ✅ Event detail: YOUR LOOK, WHO'S WEARING WHAT, stylist observation (05b)
52. ✅ Event creation with keyboard-safe inputs (fixed today)
53. ✅ Voting/one-pick boards; comments; borrowing with `borrowable`
54. 🔧 Report affordance on outfit POSTS (comments/profiles have it; posts don't — 1.2 gap)
55. 🔧 Block leak: blocked user's content still visible inside shared events (`blocked_between` missing from event-content read policies)
56. ⏳ Vote optimistic-feel (shadow overlay pattern; delete+insert+2 invalidations today — works, feels slow)
57. ⏳ Push notifications (invited/asked-to-borrow/plate-ready; taste-capped) — needs native module + build; REQUIRED fast-follow, the retention gap
58. ⏳ Invite links / universal links (the growth door; needs associatedDomains + web renderer)

## G · Packing (59–63)
59. ✅ Questionnaire-first (5 steps, chips, one keyboard); camera entry removed (founder ask)
60. ✅ Destination brief: real forecast + closet-grounded suggestions (packing-brief live, 200 today)
61. ✅ Full closet browsable after suggestions
62. ✅ Hard paid gate that fails closed; locked plate; honest CTA when paywall unavailable (fixed today)
63. ✅ No auto-firing paywall can ever cover the tab again (fixed today)

## H · Social & Explore (64–72)
64. ✅ Explore tab: friends' new additions, day-grouped, plate grammar (built today)
65. ✅ Friend search among reachable graph; Add/Requested/Friends states
66. ✅ Three designed cold-start empties; own items fill day one
67. ✅ Friends-only privacy model enforced by views/RLS (verified: anon sees nothing)
68. ✅ Friend closets via projections; originals never shared (derivative filenames only)
69. ✅ Blocks sever follows server-side; block/report on comments & profiles
70. 📋 Stranger discovery decision: username claim now exists (today), but private-by-default means search only finds existing edges. Founder call: ship as invite-shaped, or add public-handle lookup
71. 📋 UGC gate: content-filter + terms-gate migrations and sheet wiring are the OTHER session's in-flight work — must land and be verified before submission
72. ⏳ Save-a-friend's-plate to private board; owner-only acknowledgment counts (post-launch, on-brand)

## I · Billing (73–80)
73. ✅ Four products in ASC at READY_TO_SUBMIT; entitlements mapped
74. ✅ Placements registered as code contract; campaigns live incl. `packing_access` (created today)
75. ✅ Gate layer fails safe: broken paywall auto-dismissed, watchdogs, GateOutcome signal (fixed today)
76. ✅ Server-side quota backstop: free tier excluded from gated calls regardless of client
77. ✅ Trial: 14-day full access; `effective_plan()` returns pro during trial
78. 📋 THE launch blocker: paywall 252860 unpublished (`products: []`, `published_at: null`) — Superwall support ticket ready in docs/superwall/support-request.md; alternatively rebuild paywall fresh via API and accept losing the saved design
79. 📋 Superwall product period drift (month/year vs ASC ONE_MONTH/ONE_YEAR) — cosmetic copy risk
80. 📋 Pricing reflection before launch: hard free-tier tagging caps are the category's #1 complaint generator ("you locked the closet I built"); own doc already concludes cost isn't the constraint

## J · Platform, quality & ops (81–100)
81. ✅ CI: typecheck, lint, unit, styling smoke, bundle, pgTAP vs real Postgres, Deno checks — green on current runtimes
82. ✅ RLS on all 29 tables; explicit grants; definer-view pattern audited clean today
83. ✅ Storage: originals never public; derivative-only sharing
84. 🔧 `garments` bucket caps (no file_size_limit/MIME today; avatars bucket has them)
85. 🔧 `ai_calls` audit log silently broken (inserts fail unchecked; zero rows despite live traffic) — cost blindness
86. 🔧 Crash/error visibility: none exists. Minimum tonight: PostHog error events for JS exceptions + broken-paywall/import-failed AppEvents
87. ✅ Analytics: 12-event closed union, null-safe client, replay off
88. 🔧 Dynamic Type: XXL clips titles/labels/chips on first-run surfaces (Fable screenshots)
89. ✅ No secrets in repo/env-public; dev routes walled in production; privacy manifest verified against generated plist
90. ✅ Permission plist scheme verified via real prebuild (motion present; suppressed keys absent)
91. ✅ Export compliance declared (`ITSAppUsesNonExemptEncryption: false`) — no ASC prompt
92. ✅ Marketing site live with CSP; apex `cinchstyle.com` is now primary and answers directly — `status=200 hops=0`, including on `/.well-known/apple-app-site-association` (verified 2026-08-10). The apex-308s-to-www state recorded here was fixed; see `docs/design/www-redirect-directive.md`
93. 🔧 Listing copy: cost-per-wear is NOT a moat (Whering/Indyx ship it) — reposition to "votes on real closets"; Privacy/Support URLs → cinchstyle.com
94. 🔧 Prune dead hosted-paywall page + its CSP block from web/
95. 📋 Delete orphaned Cloudflare Worker "cinch" (fails every push; steps in stack report)
96. 📋 Supabase Pro before launch (free tier pauses after 7 idle days; no backups)
97. 📋 Auth leaked-password protection toggle (one switch in dashboard)
98. 📋 Key rotations: service_role, Resend, PostHog; move .p8 out of Downloads
99. 📋 ASC final assembly: attach build to version, attach 4 IAPs to the version, product review screenshots, DSA trader status, Paid Apps agreement/banking
100. 📋 Demo account with populated closet (~12 tagged pieces) + entitlement that cannot lapse mid-review; founder device pass via TestFlight before we submit together

**Scoreboard at synthesis time: 68 ✅ · 13 🔧 (army dispatched) · 11 📋 (founder) · 8 ⏳ (deliberate fast-follows, each with a reason).**
The ⏳ items are scoped OUT of this submission deliberately: each is either structural
(diary, pagination, push) or growth-loop (invites, review) work that would destabilize
a same-day build, and none blocks review or the first hundred users.

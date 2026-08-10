# Tech stack

What Cinch runs on, what it costs, and why each choice beat the alternative.

Two constraints shaped every pick. First, **Claude Code has to be able to drive
it** — a service with an official MCP server is one you can configure, query and
debug from the terminal; one without is a dashboard you have to babysit.
Second, **nothing gets a monthly bill until it is doing work**. The stack below
costs **$25/month at launch** and only grows when revenue does.

| Layer | Pick | Cost at launch | Agent integration |
| --- | --- | --- | --- |
| Database + auth | Supabase | $25 (Pro) | Official MCP |
| Paywall + subscriptions | **Superwall** | $0 to $10K MAR | MCP + Skill + Editor MCP + CLI |
| Model access | OpenRouter → Gemini Flash + Claude | ~$0.0005/garment | n/a (server-side) |
| Analytics | PostHog | $0 | Official plugin + MCP |
| Email | Resend | $0 | Official plugin + MCP |
| Org hub | Notion | $0 | Official MCP |
| Accounting | Wave → QuickBooks | $0 | None → official MCP |
| Deep links + attribution | Branch (when needed) | $0 | None |
| Creator marketing | *deferred* | $0 | None |

---

## Paywall and subscriptions — Superwall

**Superwall replaces RevenueCat outright.** It is not a paywall layer that sits
on top of a subscription backend — it *is* the subscription backend, and the
infrastructure half is free at unlimited scale.

### What's free, forever, at any volume

- **Entitlements API** — synced server-side from App Store Server Notifications
  V2 and Google RTDN
- **Purchase API and receipt validation** — server-event-driven rather than
  client-receipt-validation-based
- **Webhook API** — server-pushed events standardized across App Store, Play
  Store and Stripe
- **Query API** — raw SQL access
- **Revenue analytics**
- Cross-platform entitlement reconciliation, refunds, family sharing and
  billing retries, handled automatically

No per-event fees. No revenue thresholds on any of it.

### What costs money

One meter: **paywall-attributed revenue (MAR)**. Free to $10K/month, then **1%
of that revenue and only that revenue**. There are no feature tiers — every
capability is available on the free plan; the meter is the entire pricing model.

This is strictly cheaper than the alternative. RevenueCat charges 1% of **all
tracked subscription revenue** past $10K/mo regardless of how the user
subscribed. Superwall charges 1% of only the revenue its own paywalls
converted. An app doing $50K/month with half its revenue attributed to
Superwall paywalls pays $250/month; the same app on RevenueCat pays
substantially more for a narrower product.

### The agent surface, which is the real reason

Superwall has the deepest AI-tooling story of anything in this stack:

- **Superwall MCP** (`https://superwall-mcp.superwall.com/mcp`) — manages
  organizations, projects, iOS/Android/web apps, entitlements, products linked
  to App Store Connect, paywall templates, campaigns with A/B tests, webhooks,
  event delivery inspection and secret rotation. OAuth in the browser, no API
  key handling. Install with:

  ```bash
  claude mcp add superwall --transport http https://superwall-mcp.superwall.com/mcp
  ```

- **Superwall Skill** — live docs plus authenticated API access and hands-on
  paywall editor control for coding agents
- **Editor MCP** — connects an agent to the paywall currently open in the
  visual editor, for design edits
- **Superwall CLI** — SDK setup, product/campaign management, analytics queries
- **Superwall Agents** — experiment analysis, setup inspection, automated
  reports

**Expo is a first-class supported platform** alongside iOS, Android, Flutter,
React Native, Unity and Web — so this drops into the existing app rather than
forcing a native module detour.

### Confirmed configuration

Tiers and prices come from [`ai-models-and-tiers.md`](ai-models-and-tiers.md); the
reasoning for each number lives there, not here.

**Two entitlements.** `standard` and `pro`.

**Four products**, to be created in App Store Connect first and then referenced
from Superwall:

| Product | Price | Entitlement |
| --- | --- | --- |
| `cinch.standard.monthly` | $7.99/mo | `standard` |
| `cinch.standard.annual` | $59/yr | `standard` |
| `cinch.pro.monthly` | $14.99/mo | `pro` |
| `cinch.pro.annual` | $119/yr | `pro` |

**No App Store introductory offers on any of them.** The 14-day trial is an
*app-side grant*, not a StoreKit trial — full access from first launch with no
purchase, and the paywall appears on day 15. This is a deliberate fork:

- A StoreKit introductory offer requires the user to subscribe at signup and
  bills them on day 14. It converts better per-impression, but it asks for a
  commitment before they have photographed a single garment.
- The grant model lets someone fill their closet first. That matters here
  specifically because the app is worthless until the closet is populated, and
  the tier doc's own argument — *"someone who has photographed 80 garments has
  done the work; they convert"* — only holds if they can do that work before
  paying.

The cost is that trial state has to be tracked server-side rather than by
StoreKit. **What shipped is an end date, not a start date, and it is set by the
database rather than by the client:** `subscriptions.trial_ends_at`, written
`now() + interval '14 days'` by the `handle_new_subscription()` trigger on
`auth.users` insert
(`supabase/migrations/20260805160000_membership_tiers.sql:77`). Nothing on the
client sets it. It is read by `effective_plan()` in the same migration, which
folds the trial in — a user whose `trial_ends_at` is in the future resolves to
`pro`, everyone else to their stored `plan` — so no caller has to remember the
trial exists.

Two consequences worth stating, because both have already caused confusion:

- **Superwall does not read it.** Trials live in Postgres, not in
  `device.activeEntitlements`, so a trialing account still matches every
  campaign audience. The gate is the app's, not the dashboard's; the paywall
  copy branches on `trialing` instead (`src/features/billing/context-lines.ts`).
- **An end date is the safer shape.** Storing a start and adding fourteen days
  at read time means every reader has to agree on the length; storing the end
  means the length is decided once, at signup, and a change to the policy cannot
  retroactively shorten a live trial.

Trial state must not live on the device — reinstalling to reset the clock has to
fail, and a server-side column on a row keyed to `auth.users` is what makes that
true.

**Downgrade is non-destructive.** Above the new cap the closet goes read-only;
garments are never deleted. Deleting a user's wardrobe because they cancelled is
a one-star review that never goes away.

### The one real gap

RevenueCat has LTV and MRR metrics that Superwall's dashboard doesn't
replicate — Superwall's analytics are revenue- and paywall-scoped rather than
cohort-financial. If those specific numbers matter, RevenueCat can run in
**observer mode** alongside, which stays inside its free tier as long as you're
under $10K tracked revenue. Don't set that up pre-emptively; wait until you
actually miss the metric. PostHog will cover most cohort questions anyway.

---

## Database and auth — Supabase, unchanged

Already load-bearing: `supabase/migrations/` holds the schema, row level
security *is* the authorization model, `supabase/tests/` proves the RLS and
storage policies hold, and four Edge Functions (`tag-item`,
`generate-outfits`, `stylist-chat`, `delete-account`) run the server side. Auth
is Apple Sign In through Supabase. There is no case for moving.

The [official Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp)
is already connected — applies migrations, runs SQL, deploys Edge Functions,
generates TypeScript types, reads logs, runs security advisors. The most
valuable integration here, because the database is where the irreversible
mistakes live.

**Cost.** Free tier for development; **Pro ($25/mo)** before launch — the free
tier pauses projects after a week idle and keeps only 7 days of backups,
neither acceptable once a real user's wardrobe is in there.

---

## Model access — keep OpenRouter, change the model

The architecture is already right and it is why this line item stays tiny:
outfit generation is a deterministic on-device engine, and the model does
exactly two jobs — reading a photograph of a garment (`tag-item`) and writing
one sentence about a look the engine already chose (`stylist-chat`). Every
garment is tagged **once**, at add time. Nothing scales with daily use.

**Change which model `tag-item` calls.** For vision, per-token price is the
wrong metric — **image tokenization dominates**. The same 1024×1024 photo costs
roughly 258–1,120 tokens on Gemini versus ~1,334 on Claude, and per-image cost
across providers spans more than 10×: **Gemini ≈$0.0005 vs Claude ≈$0.0040**.

- **`tag-item` → Gemini 3.1 Flash-Lite** ($0.125/$0.75 per 1M) or **Gemini 3
  Flash** ($0.50/$3.00) if tagging accuracy needs headroom. Garment tagging is
  structured extraction against a Zod schema — a cheap vision model is the
  correct tool. At ~$0.0005/garment, onboarding a 100-item closet costs five
  cents.
- **`stylist-chat` → Claude Haiku 4.5** ($1/$5 per 1M) or Sonnet. The one place
  a human reads model prose directly, and the input is a short shortlist, not a
  wardrobe.

**Deadline:** Gemini 2.5 Flash-Lite retires **16 October 2026**. If anything
pins it, that's a hard date.

**Router.** OpenRouter charges
[5.5% plus $0.80 on credit purchases](https://ofox.ai/blog/openrouter-pricing-hidden-markup-breakdown-2026/),
with BYOK free for the first 1M requests/month. That fee is on *top-ups*, not
per call — negligible at this volume, and it buys a 400+ model catalog and
config-only model swaps.

Worth knowing: **Vercel AI Gateway passes provider pricing through at cost with
zero markup**, including BYOK. Both are OpenAI-compatible endpoints, so
switching is a base-URL change. At current volume the difference is pennies —
not worth the churn now, but it's the fallback if OpenRouter's fees ever
matter.

---

## Analytics — PostHog

All three major platforms now ship official MCP servers, so **integration no
longer differentiates them**:

- PostHog — `mcp.posthog.com/mcp` plus an [official Claude Code plugin](https://github.com/posthog/posthog-for-claude)
  with `/posthog:flags`, `/posthog:insights`, `/posthog:errors`,
  `/posthog:experiments`
- Mixpanel — [`mcp.mixpanel.com/mcp`](https://docs.mixpanel.com/docs/mcp),
  OAuth, funnels/retention/replay in natural language
- Amplitude — [`mcp.amplitude.com/mcp`](https://amplitude.com/docs/amplitude-ai/amplitude-mcp),
  OAuth, reads *and writes* charts, dashboards, experiments and cohorts

PostHog wins on the things that are actually different:

1. **Free tier bundle** — 1M events/month, 5,000 session replays, 1M
   feature-flag requests, 1,500 survey responses, **unlimited seats**. Mixpanel
   free is ~1M events with no flags or replay; Amplitude free is 10K MTU.
2. **Feature flags** are how you ship a change to the styling engine's scoring
   weights to 10% of users instead of everyone. The engine learns from thumbs —
   a bad weight change is a slow, quiet regression, and a flag is the rollback.
3. **React Native session replay is GA**, not beta, and the RN/Flutter SDKs
   record in screenshot mode. This is how you debug the camera and tagging
   flow — the highest-friction screen in the app.
4. **Expo has first-party PostHog docs** and the **EAS CLI automates the
   setup** — installs the SDK, creates the org and project, configures env
   vars.
5. **Native error tracking** ships in the same `@posthog/react-native-plugin`
   that powers replay, closing a gap nothing else here covers.

Mixpanel remains the better call for a PM-led team that wants the lowest
learning curve and doesn't need flags. That isn't this team.

---

## Email — Resend

Free 3,000/month; $20/mo at 50K. There is an
[official Claude Code plugin](https://resend.com/claude-code) bundling the MCP
server and every Resend skill — 10 tool groups across emails, contacts,
broadcasts, domains, webhooks, segments and API keys, and it writes React Email
templates directly. `docs/email-templates/` already exists; this maintains it.

The alternatives are the wrong shape or not ready:

- **Instantly** is B2B cold outreach — sequences to prospects who never asked to
  hear from you. Cinch's email is transactional (auth, receipts, deletion) and
  lifecycle. Wrong tool, and no official MCP.
- **Loops** prices **per contact** ($49/mo at 5K), which punishes exactly the
  free-user growth a consumer app wants. Its MCP is **announced but not
  shipped** — API and CLI skills only for now.
- **Customer.io** does have an official OAuth MCP exposing its full API
  surface, but it's an enterprise-shaped lifecycle platform and overkill here.

Resend now ships Broadcasts, so start with one vendor and add a marketing ESP
only if lifecycle email becomes a real motion with an owner.

---

## Accounting — Wave now, QuickBooks when it earns it

Correcting an earlier claim: **both major options do have official MCP
servers.** Intuit shipped an official QuickBooks Online MCP (early preview,
October 2025) — a Node package with ~20 tools covering CRUD on customers,
vendors, invoices, bills, payments and estimates. Xero has an official
vendor-hosted MCP. Wave has neither.

That said, agent access to your books is a capability worth wanting *less* than
most — read-only questions are useful, write access to ledgers is a category of
mistake you cannot casually undo. It shouldn't drive the choice at this stage.

**QuickBooks Solopreneur** is $20/month (Intuit raised prices 1 May 2026; QBO
runs $20–$275). **Wave** has a free tier plus **Wave Pro at $19/month**, and
under ~$100K revenue it's hard to beat.

**Decision:** Wave (free) until revenue is real. Move to QuickBooks Online when
you run payroll, incorporate and need clean books for an accountant, or your
CPA wants to work in the file. Do it *before* your first real tax year, not
during it — and at that point the MCP becomes a genuine bonus.

---

## Deep links and attribution — Branch, when you need it

A gap not in the original list. The app already has social surface area —
`react-native-view-shot`, `expo-sharing`, and public projection views
(`public_outfits`, `public_profiles`, `public_like_counts`) — which means shared
outfits will want deep links that survive the App Store round trip. And the
moment you pay a creator, you need to know whether they drove installs.

**Branch** is the indie-appropriate pick: a genuinely free tier, a lightweight
SDK, and best-in-class deep linking and web-to-app flows. AppsFlyer is the
enterprise leader but charges ~$0.07/conversion (≈$350/month at 5,000 installs);
Adjust has no freemium tier and is priced for mid-to-large enterprise; Tenjin is
the other free indie option but is attribution-only.

None of these have MCP servers. Add Branch when you ship outfit sharing or
start paying for installs — whichever comes first. Not before.

---

## Creator marketing and UGC — buy neither, yet

**Growi.io** is a creator/affiliate CRM: discovery, campaign tracking,
attribution and payouts across 120+ countries, with mobile-app tracking for
installs and subscription milestones. **SideShift** is a UGC creator
marketplace — 500K+ US creators, templated briefs, automated contracting and
payment, TikTok and Meta ad-manager integrations — at **$199/mo (5 creators),
$299/mo (15), $999/mo (unlimited)**.

Both are good at what they do. Neither does anything for you right now:

- SideShift Starter is **$2,388/year for the right to hire 5 creators**. At that
  volume, pay 5 creators directly and keep the difference. The platform earns
  its fee on *throughput* — many videos, fast, feeding paid ad spend you're
  already running. You have no paid ad spend.
- Growi manages a creator program you don't have. It starts paying for itself
  somewhere north of ~10 creators or affiliates tracked and paid recurringly.
- **Neither has an MCP server.** (The `growi-mcp-server` on GitHub is **GROWI**,
  an unrelated open-source wiki by growilabs — not growi.io. Easy to conflate;
  they are different companies.)

**Decision:** launch on App Store optimization and organic short-form. Buy
SideShift Starter when you commit to a *continuous* UGC ad cadence with budget
behind it — the 7-day trial makes that a cheap test then. Add Growi when
tracking and paying creators costs real hours per week.

---

## Organization hub — Notion

**Notion** over Google Docs on integration grounds, and over Linear on cost:

- The **Notion MCP** creates and updates pages *and databases*, queries data
  sources, manages comments, moves pages. A roadmap, bug list and release
  checklist are databases, not documents. Free for one person; ~$12/user/mo
  when a second joins. Already connected in this project's session.
- The **Google Drive MCP** is read-oriented — search, read, check permissions,
  create files. Fine for pulling in a spec, weak at maintaining structured
  state.
- **Linear** is arguably the better fit for tickets written against a codebase,
  with cycle-based planning and a real roadmap view. But its **official MCP
  requires a paid plan (Standard or higher)** for OAuth apps, which makes it a
  worse deal than Notion at one seat. Revisit when there's a second engineer.

Keep engineering docs in the repo (`docs/`, `README.md`, `AGENTS.md`) where they
version with the code. Notion holds what doesn't belong in git: roadmap, launch
checklist, App Store review notes, creator outreach lists.

---

## What this costs

**At launch: $25/month** — Supabase Pro, and nothing else. Superwall's entire
subscription infrastructure is free at unlimited scale; PostHog, Resend and
Notion are free-tier; Wave is free; Branch and the creator tools are deferred
behind specific, observable triggers rather than bought on spec.

**First real cost step** is Superwall's 1% past $10K/month in *paywall-attributed*
revenue — a bill that only arrives on the far side of $120K attributed ARR, and
one you're happy to pay.

## Sources

**Superwall:** [Pricing](https://superwall.com/pricing) · [Superwall MCP](https://superwall.com/docs/dashboard/guides/superwall-mcp) · [Migrating from RevenueCat](https://superwall.com/docs/dashboard/guides/migrating-from-revenuecat-to-superwall) · [Using RevenueCat with Expo](https://superwall.com/docs/expo/guides/using-revenuecat) · [New pricing announcement](https://superwall.com/blog/superwalls-new-pricing-more-aligned-generous-and-transparent) · [RevenueCat vs Superwall: which — or both?](https://theswiftk.it.com/blog/revenuecat-vs-superwall-ios-paywalls)

**Analytics:** [PostHog MCP for Claude Code](https://posthog.com/docs/model-context-protocol/claude-code) · [posthog-for-claude](https://github.com/posthog/posthog-for-claude) · [PostHog mobile session replay](https://posthog.com/docs/session-replay/mobile) · [Expo: Using PostHog](https://docs.expo.dev/guides/using-posthog/) · [Mixpanel MCP](https://docs.mixpanel.com/docs/mcp) · [Amplitude MCP](https://amplitude.com/docs/amplitude-ai/amplitude-mcp) · [Free tier comparison 2026](https://agentdeals.dev/analytics-free-tier-comparison-2026)

**Models:** [OpenRouter fees itemized](https://ofox.ai/blog/openrouter-pricing-hidden-markup-breakdown-2026/) · [Vercel AI Gateway vs OpenRouter](https://vercel.com/i/vercel-ai-gateway-vs-openrouter) · [Cheapest vision LLM APIs 2026](https://www.clawrouters.com/blog/cheapest-vision-multimodal-llm-api-2026) · [Image token cost by model](https://blog.roboflow.com/image-token-cost-vlm/) · [Gemini 3.1 Flash-Lite pricing](https://pricepertoken.com/pricing-page/model/google-gemini-3.1-flash-lite)

**Email:** [Resend Claude Code plugin](https://resend.com/changelog/resend-claude-code-plugin) · [Resend MCP](https://resend.com/docs/mcp-server) · [Loops MCP (not yet shipped)](https://loops.so/agents/mcp) · [Customer.io MCP](https://www.usecarly.com/blog/customer-io-mcp/) · [Loops vs Resend pricing models](https://xmit.sh/versus/loops-vs-resend)

**Accounting:** [QuickBooks MCP guide](https://deepledger.ai/blog/quickbooks-mcp-server-guide) · [QuickBooks vs Xero vs Wave 2026](https://hustlerslibrary.com/quickbooks-vs-xero-vs-freshbooks-vs-wave-full-comparison-2026/)

**Attribution & creator:** [Best MMPs 2026](https://splitmetrics.com/blog/best-mobile-measurement-partners-mmps/) · [AppsFlyer vs Adjust vs Branch](https://www.techmagnate.com/blog/adjust-vs-appsflyer-vs-branch-tools-comparison/) · [SideShift pricing](https://www.launchpointhq.com/blog/sideshift-reviews-pricing-alternatives) · [Growi for mobile apps](https://www.growi.io/solutions/for-mobile-apps)

**Org hub:** [Best PM software with MCP 2026](https://www.goodday.work/blog/best-project-management-software-with-mcp-integration/)

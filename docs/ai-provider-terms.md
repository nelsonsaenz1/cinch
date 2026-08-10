# What our AI provider does with what we send it

Written to close the standing blocker in `docs/design/system-safety-contract.md` §3:
*"treat any retention or training claim as unshippable until provider terms are
confirmed in writing."*

Everything below was retrieved from OpenRouter's own documentation, privacy
policy, terms of service, and public API on **2026-08-10**, and read against the
code as it stands on that date. Where a fact could not be established from a
public document, it is listed in **What remains unverified** rather than assumed.

The single most important structural fact, stated once here because every
section depends on it: **OpenRouter is a router, not a model provider.** A
request naming `z-ai/glm-5.2` is served by one of roughly thirty independent
companies, chosen per request by OpenRouter's default price-based load
balancer. "Our AI partner" is not one company unless our code pins it, and our
code does not pin it.

---

## 1. What we send, and when

Five functions call the provider. All five use the one credential
`OPENROUTER_API_KEY` and the endpoint `https://openrouter.ai/api/v1/chat/completions`.

### 1.1 `tag-item` — a photograph of a garment

`supabase/functions/tag-item/index.ts`

- **Trigger:** once per garment, from the client's upload queue, at concurrency 3.
- **What leaves:** a **signed URL to the user's own photograph**, valid 300
  seconds (`SIGNED_URL_TTL_SECONDS`), pointing at the private `garments` bucket;
  plus `TAG_SYSTEM_PROMPT` and the literal string `Catalogue this garment.`
- **The image itself:** prepared on-device by `src/lib/image.ts` —
  long edge ≤ **1024 px**, JPEG quality **0.8**. The consent sheet's phrase "at
  reduced resolution" is accurate and verifiable in that file.
- **The URL carries an identifier.** The object path is
  `` `${userId}/${itemId}/original.jpg` `` (`src/features/ingest/upload-queue.ts:653`),
  so the signed URL contains the user's account UUID, the item UUID, and the
  Supabase project host. It is not a name, an email, or a location — but it is a
  stable pseudonymous per-user identifier, visible to whoever fetches the image.
- **Server-side gate:** the call is refused unless
  `profiles.ai_consent_version >= current_ai_consent_version()`.
- Model comes from `ai_config` at call time (`workload = 'tagging'`).

### 1.2 `garment-search`, `match` action — the same photograph, plus a web search

`supabase/functions/garment-search/index.ts` (`matchListing`, ~line 679) and
`supabase/functions/garment-search/provider.ts`

- **What leaves:** a signed URL to `cutout_path ?? thumb_path ?? image_path`
  — the user's own photograph — plus a one-line descriptor built from the
  garment's tags and the model's own earlier description (capped at 500 chars),
  plus the brand name if the user supplied one.
- **This request also runs OpenRouter's web plugin**, pinned to Exa:

  ```ts
  plugins: [{ id: 'web', engine: 'exa', max_results: …, search_prompt: 'Shopping results for this garment:' }]
  ```

  So a search query derived from the user's garment is executed by **Exa**, a
  third party that is not the model provider and not OpenRouter. This matters
  for retention (see §2.5).
- When a brand-scoped search returns nothing, the function runs the **same
  photograph through a second, unscoped call**.

### 1.3 `generate-outfits` — text, including calendar event titles

`supabase/functions/generate-outfits/index.ts`

- **What leaves:** the shortlisted outfit candidates as text (item colours and
  names, fit scores, notes), and the context block built by `describeContext`:
  - weather, **including the city name** when known;
  - **`Today:` followed by each calendar event's start time, its title verbatim,
    and a formality score** (`index.ts:75`);
  - the user's free-text note, quoted.
- Calendar event titles are the most sensitive text this app transmits. The
  privacy copy already discloses this (`src/features/privacy/copy.ts:98`).

### 1.4 `stylist-chat` — text

`supabase/functions/stylist-chat/index.ts`

- **What leaves:** the closet digest (≤ 4k chars), weather and city, the tapped
  brief (occasion / silhouette / mood), the assembled outfit shortlist, up to
  **8** prior conversation turns, and the user's message.

### 1.5 `packing-brief` — text (fifth call site, worth recording)

`supabase/functions/packing-brief/index.ts`

- Sends trip destination and country, dates, and closet content. It has **no
  `ai_config` row of its own** — it borrows `workload = 'stylist_chat'`
  (`index.ts:55`), so its model, and therefore its provider exposure, is
  whatever the stylist's is.

### 1.6 What is *not* sent

Verified by reading the request bodies in `_shared/openrouter.ts` and
`garment-search/provider.ts`:

- No `user` field, no end-user id parameter, no email, no name.
- Headers are constant: `HTTP-Referer: https://cinch.app`, `X-Title: Cinch`.
- Error text written to `ai_calls.error` is URL-redacted before storage
  (`redactUrls`), so signed URLs do not land in our own operational logs.
- The only identifier that reaches the provider is the one embedded in the
  signed image URL (§1.1).

---

## 2. What the provider says

All quotes retrieved **2026-08-10**.

### 2.1 OpenRouter's own logging default

Source: <https://openrouter.ai/docs/guides/privacy/data-collection>

> "OpenRouter does not store your prompts or responses, *unless* you opt in to
> one or both of the following:"

The two opt-ins, both named on that page:

> "**Private Input & Output Logging:** Make your prompts and completions visible
> in your logs for debugging, comparing model responses, and optimizing prompts.
> OpenRouter does not access or use this data. For organizations, only admins can
> view logged data. Off by default. Enable it in your Observability settings."

> "**OpenRouter Use of Inputs/Outputs:** Allow OpenRouter to use your prompt and
> completion data to improve the product. In exchange, you receive a 1% discount
> on all model usage. Off by default. Enable it in your Privacy settings."

Exact locations of the settings, per that page:
- Input & Output Logging → **Observability settings**, `https://openrouter.ai/workspaces/default/observability`
- OpenRouter Use of Inputs/Outputs → **Privacy settings**, `https://openrouter.ai/workspaces/default/settings`

One carve-out on the same page, which prevents an unqualified "never stores"
claim:

> "*Anonymous Input Categorization: OpenRouter samples a small number of prompts
> for categorization to power our reporting and model ranking. If you are not
> opted in to OpenRouter use of inputs/outputs, any categorization of your
> prompts is stored completely anonymously and never associated with your account
> or user ID. The categorization is done by model with a zero-data-retention
> policy.*"

And metadata is always kept:

> "OpenRouter does store metadata (e.g. number of prompt and completion tokens,
> latency, etc) for each request. … This metadata does not include the content of
> your prompts or responses, only information about the request itself."

There is **no per-request parameter that disables OpenRouter's own logging** —
because it is off by default and is an account/workspace toggle, not a request
field. The per-request controls that exist are about *provider routing* (§2.3, §2.4).

### 2.2 Training

Source: <https://openrouter.ai/privacy> (Last Updated: **July 6, 2026**)

> "OpenRouter does not use your Inputs or Outputs for model training."

> "Some Model Providers may use your Inputs and Outputs for model training or
> improvement."

> "We do not control, and are not responsible for, LLMs' handling of your Inputs
> or Outputs, including for use in their model training."

> "Model Providers process your Inputs to generate Outputs and may, depending on
> their own terms and data practices, retain and use your Inputs and Outputs for
> their own purposes, such as model training and improvement. We contractually
> require Model Providers to comply with applicable data protection laws, but the
> Model Provider's own terms govern their independent use of your data to the
> extent permitted by our agreements."

Source: <https://openrouter.ai/terms> (Last Updated: **July 29, 2026**)

> "Some Models may store or train on your Inputs for improving their own large
> language models and may allow you to opt-out of model training, as described in
> their Model Terms."

Source: <https://openrouter.ai/docs/guides/privacy/provider-logging>

> "On your account settings page, you can set whether you would like to allow
> routing to providers that may train on your data (according to their own
> policies). There are separate settings for paid and free models."

> "Wherever possible, OpenRouter works with providers to ensure that prompts will
> not be trained on, but there are exceptions. If you opt out of training in your
> account settings, OpenRouter will not route to providers that train. This
> setting has no bearing on OpenRouter's own policies and what we do with your
> prompts."

### 2.3 The data-policy routing control

Source: <https://openrouter.ai/docs/features/provider-routing#requiring-providers-to-comply-with-data-policies>

The control is the `data_collection` field inside the request's `provider`
object, with an account-wide equivalent:

| Field | Type | Default | Description |
|---|---|---|---|
| `data_collection` | `"allow"` \| `"deny"` | `"allow"` | Control whether to use providers that may store data. |

> "`allow`: (default) allow providers which store user data non-transiently and
> may train on it"
> "`deny`: use only providers which do not collect user data"

> "Some model providers may log prompts, so we display them with a **Data Policy**
> tag on model pages. This is not a definitive source of third party data
> policies, but represents our best knowledge."

> "This is also available as an account-wide setting in your privacy settings
> [openrouter.ai/settings/privacy]. You can disable third party model providers
> that store inputs for training."

**What it governs, precisely:** which *providers OpenRouter will route to*. It
does not change OpenRouter's own handling, and it does not bind a provider we
have already reached.

### 2.4 Zero Data Retention

Source: <https://openrouter.ai/docs/guides/features/zdr>

> "Zero Data Retention (ZDR) means that a provider will not store your data for
> any period of time."

> "OpenRouter has privacy settings that, when enabled, only allow you to route to
> endpoints that have a Zero Data Retention policy. You can enforce ZDR globally,
> per model group, per guardrail, or per request."

> "Providers that do not retain your data are also unable to train on your data.
> However we do have some endpoints & providers who do not train on your data but
> *do* retain it (e.g. to scan for abuse or for legal reasons)."

Per-request form (`provider.zdr`), from
<https://openrouter.ai/docs/features/provider-routing#zero-data-retention-enforcement>:

> "When `zdr` is set to `true`, the request will only be routed to endpoints that
> have a Zero Data Retention policy. When `zdr` is `false` or not provided, it has
> no effect on routing."

> "The request-level `zdr` parameter operates as an 'OR' with your account-wide
> and guardrail ZDR settings — if any of them is enabled, ZDR enforcement is
> applied. The request-level parameter can only ensure ZDR is enabled, not
> override account-wide or guardrail enforcement."

Account-level ZDR is **five separate toggles**, not one
(`https://openrouter.ai/settings/privacy`): Anthropic, OpenAI, Google, SpaceXAI,
and **Non-frontier** ("Removes all other non-ZDR endpoints"). Every model Cinch
uses today falls under *Google* or *Non-frontier*.

Two limits that bear directly on us:

> "ZDR enforcement only applies to provider routing for inference requests. It
> does not apply to plugins and tools you choose to enable, such as web search.
> These may be operated by third-party services with their own data retention
> policies. Review the data policies of any plugins or tools you enable if you
> have strict data retention requirements."

> "OpenRouter has taken the stance that in-memory caching of prompts is *not*
> considered 'retaining' data, and we therefore allow endpoints/models with
> implicit caching to be hit when a ZDR routing policy is in effect."

And OpenRouter's own posture, same page:

> "OpenRouter itself has a ZDR policy; your prompts are not retained unless you
> specifically opt in to prompt logging."

Fallback stance when a provider's policy is unclear:

> "If OpenRouter is not able to establish or ascertain a clear policy for a
> provider or endpoint, we take a conservative stance and assume that the
> endpoint both retains and trains on data and mark it as such."

### 2.5 Retention periods, per setting

| Setting | What is kept | For how long | Source |
|---|---|---|---|
| Default (nothing opted in) | Metadata only — token counts, latency, cost | Not stated as a fixed period; governed by "Personal Data Retention" ("as long as is reasonably necessary to comply with our business and legal obligations") | privacy policy §7; data-collection doc |
| Default, prompt content | Not stored, except anonymous sampled categorization (done by a ZDR model, never tied to the account) | Not stated | data-collection doc |
| **Input & Output Logging** (opt-in) | Full prompts and completions, in an isolated GCS project, AES-256 at rest | "Data is retained for a **minimum of 3 months**, and may be retained beyond 3 months at OpenRouter's discretion unless you request deletion." | <https://openrouter.ai/docs/guides/features/input-output-logging> |
| **OpenRouter Use of Inputs/Outputs** (opt-in, 1% discount) | Prompts and completions, used to improve the product; terms grant "a worldwide, perpetual, irrevocable, non-exclusive, royalty-free, fully paid right and license" | Perpetual by the licence's own words | terms of service; data-collection doc |
| Downstream provider | Whatever that provider's own terms say | Varies per provider; not controlled by OpenRouter unless ZDR routing is enforced | privacy policy; ZDR doc |
| Web-search plugin (Exa) | Search queries and page fetches | Not covered by OpenRouter's ZDR enforcement at all | ZDR doc warning |

### 2.6 Images specifically

This is the one that matters most, because `tag-item` and `garment-search` send
photographs of people's clothes.

Source: <https://openrouter.ai/privacy>, heading **"Image, Audio, and Video Data"**:

> "Image, audio, and video data submitted through the Service is transmitted to
> the applicable Model Provider for inference. **We do not persist image, audio or
> video files beyond the duration necessary to route the request, except as
> required for abuse detection, security, billing, or legal compliance.** Model
> Providers' retention practices vary; check the applicable provider's data
> practices."

Also relevant, from the same policy's collection section:

> "Certain Models available through our Service accept image, audio or video
> Inputs, or generate image, audio or video Outputs. If you submit image, audio or
> video files through the Service, including voice recordings and other depictions
> of identifiable individuals those [files may constitute biometric information]"

Terms of service, on what an Input is:

> "You may provide input into the Services, which may include images, data, text,
> and other types of work ('Input') and receive an output from the Services based
> on your Input ('Output')"

Two consequences worth stating plainly:

1. OpenRouter's image commitment is **stronger than its text commitment in
   shape** (an affirmative "we do not persist") but is **qualified by four
   exceptions** — abuse detection, security, billing, legal compliance. It is
   therefore not "deleted the moment the tags come back."
2. It says nothing about the downstream provider, which is the party that
   actually fetches and processes the picture. The docs on image inputs
   (<https://openrouter.ai/docs/guides/overview/multimodal/image-understanding>)
   describe URL and base64 forms and say nothing about retention either way.

### 2.7 Which providers actually serve the models Cinch uses

Live `ai_config`, read from the production database on **2026-08-10**:

| Workload | `model_id` | max_tokens | params |
|---|---|---|---|
| `tagging` | `google/gemini-3.1-flash-lite` | 1024 | `{"temperature":0.2}` |
| `outfit_generation` | `google/gemini-3.1-flash-lite` | 3072 | `{"temperature":0.7}` |
| `stylist_chat` | `z-ai/glm-5.2` | 8192 | `{"temperature":0.8}` |
| `garment_search` | `qwen/qwen3-vl-235b-a22b-instruct` | 2048 | `{"temperature":0.2}` |

(`docs/ai-models-and-tiers.md` recommends a different stack — `qwen3-vl-32b`,
`openai/gpt-oss-120b`. Those recommendations were **not** applied; the table
above is what production actually calls. `packing-brief` rides on the
`stylist_chat` row.)

Endpoint-level provider exposure, computed on **2026-08-10** by diffing
`https://openrouter.ai/api/v1/models/{id}/endpoints` against
`https://openrouter.ai/api/v1/endpoints/zdr` (the ZDR list OpenRouter publishes
and says is "automatically updated when there are changes to a provider's data
policy"):

| Model | On the ZDR list | **Not** on the ZDR list |
|---|---|---|
| `google/gemini-3.1-flash-lite` | Google Vertex (global, global/flex, global/priority, us) | **Google AI Studio** (×3 tiers) |
| `qwen/qwen3-vl-235b-a22b-instruct` | DeepInfra, Novita, Parasail, Venice | **Alibaba** |
| `z-ai/glm-5.2` | AkashML, BaseTen, CoreWeave, Crusoe, Decart, DeepInfra, DigitalOcean, Fireworks, Inceptron, Morph, Novita, Parasail, Phala, Sail Research, SiliconFlow, Together, Venice, Wafer, Z.AI | **Alibaba, Ambient, AtlasCloud, Baidu, Cloudflare, Friendli, GMICloud, StreamLake** |

Read that last row carefully. With no routing restrictions set, a stylist
message today may be served by any of roughly thirty companies, ten of whose
endpoints are not on OpenRouter's zero-retention list, several of which are
outside the US. The same is true of a garment photograph reaching Alibaba's
endpoint for `qwen3-vl`, and of a garment photograph reaching Google AI Studio
rather than Vertex.

Per-provider privacy and terms URLs for all 101 providers are published at
`https://openrouter.ai/api/v1/providers` (fields `privacy_policy_url`,
`terms_of_service_url`, `headquarters`) — the starting point if we ever need to
read one provider's terms in full.

---

## 3. What is configured today

Read from `supabase/functions/_shared/openrouter.ts` and
`supabase/functions/garment-search/provider.ts` on 2026-08-10.

**The request body sets:**

- `model`, `messages`, `max_tokens`
- `...params` — from `ai_config.params`; today that is only `temperature`
- `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`
- `usage: { include: true }`
- `plugins: [{ id: 'web', engine: 'exa', max_results, search_prompt }]` — **garment-search only**

**Headers:** `Authorization`, `Content-Type`, `HTTP-Referer: https://cinch.app`,
`X-Title: Cinch`.

**The request body does not set:**

- **no `provider` object at all** — therefore
- **no `provider.data_collection: 'deny'`** (the documented default is `"allow"`,
  i.e. "allow providers which store user data non-transiently and may train on it")
- **no `provider.zdr: true`**
- **no `provider.only` / `provider.order` / `provider.ignore`** — nothing pins
  which company receives the bytes
- no `provider.require_parameters`, no `max_price`, no `sort`

**Therefore, today, our privacy posture is inherited entirely from OpenRouter
account/workspace settings that no one in this repo has verified**, and from
OpenRouter's default price-based load balancing across every endpoint listed in
§2.7. Nothing in the code narrows it.

Two things the code *does* do well, and which are ours to claim: the image is
downscaled to 1024 px before it leaves the phone, and provider error text is
URL-redacted before it reaches `ai_calls.error`.

---

## 4. What we may therefore claim

### Sentences the evidence supports today, exactly as written

About our own behaviour (verifiable in this repo — these were always safe):

- "The photo is sent at reduced resolution." (1024 px long edge, JPEG 0.8)
- "We don't send your name, your email, or your location with it."
- "We keep the photo and tags in your closet; deleting an item deletes both."
- "We never run face recognition."
- "We never sell your photos or advertise against them."

About the provider (new, and each one is the *most* we may say):

- "OpenRouter does not use your inputs or outputs to train models." — their
  privacy policy states this as a flat commitment about themselves.
- "OpenRouter does not store the content of prompts or responses by default;
  storing them is an opt-in setting." — their documentation states this; note
  the qualifier *by default*, which must survive any rewrite.
- "OpenRouter says it does not keep image files beyond the time needed to route
  the request, except where needed for abuse detection, security, billing, or
  legal compliance." — the exceptions are part of the claim, not a footnote to
  be trimmed.
- "OpenRouter passes the request to a model provider, and that provider's own
  terms govern what it does with the data." — their words, near-verbatim.

### Sentences we may NOT print

- ❌ "It is deleted once the tags come back." — contradicted by the four
  exceptions in the image clause, and unknowable for the downstream provider.
- ❌ "They don't keep it." — unqualified, and false for at least some endpoints
  we can currently be routed to.
- ❌ "It is not used to train models." — true of OpenRouter, **not** established
  of the provider that receives the image. OpenRouter's own words: "Some Model
  Providers may use your Inputs and Outputs for model training or improvement."
- ❌ "Under our agreement the photo is not retained and is not used to train
  models." — there is no such agreement. We are on standard terms; no DPA, no
  enterprise agreement, and no ZDR/data-collection restriction is set in code.
- ❌ **"It goes to one AI partner."** — currently live in
  `src/features/auth/consent-facts.ts:43` and `src/app/dev-capture.tsx:391`. With
  no `provider` pin, a `z-ai/glm-5.2` request can be served by any of ~30
  companies. This sentence is a factual claim about routing, and routing does not
  support it. **Flagged, not changed** — copy edits are out of scope for this
  document, but this line should not survive a privacy review unchanged.
- ❌ "Nothing is attached to the photo." — the signed URL path embeds the user's
  account UUID and the item UUID. "No name, email, or location" is true;
  "nothing attached" is not.
- ❌ Anything implying the web-search feature is covered by the same protections
  — OpenRouter states in terms that ZDR enforcement "does not apply to plugins
  and tools", and `garment-search` runs Exa on every match.

### The honest short paragraph, if one is needed today

> The photo goes to OpenRouter, which passes it to a model provider to read.
> OpenRouter does not use it to train models and does not keep image files
> beyond routing the request, except where it needs to for abuse, security,
> billing, or the law. What the model provider does with it is governed by that
> provider's own terms, not by anything Cinch can enforce for you.

That paragraph is defensible on today's configuration. Every stronger sentence
requires §6 to be done first.

---

## 5. What remains unverified

Each item is an action, with the person who must do it.

1. **The OpenRouter privacy settings, read by a human.** Log in at
   `https://openrouter.ai/settings/privacy` and record, with a screenshot and a
   date: (a) the model-training toggle for **paid** models, (b) the same for
   **free** models, (c) each of the five per-model-group ZDR toggles, and in
   particular **Google** and **Non-frontier**, which are the two that cover every
   model we run. *Do not assume any of these are on — the documented defaults for
   training routing are permissive (`data_collection` default `"allow"`).*
2. **The observability settings.** At
   `https://openrouter.ai/workspaces/default/observability`, confirm **Input &
   Output Logging is off**, and at `https://openrouter.ai/workspaces/default/settings`
   confirm **"OpenRouter Use of Inputs/Outputs" (the 1% discount) is off**. Both
   are documented as off by default, but "documented as off by default" is not
   "verified off on our account" — and the 1% discount toggle grants a perpetual
   licence, so it is the single most damaging one to have on unnoticed.
3. **Whether any guardrail is set on the API key.** Guardrails carry their own
   `enforce_zdr_google` / `enforce_zdr_other` fields and can differ from account
   settings. Check under the workspace's guardrails.
4. **Exa's retention for the web plugin.** OpenRouter explicitly disclaims plugin
   coverage. Someone must read Exa's terms (linked from
   `https://openrouter.ai/docs/guides/features/plugins/web-search`) and decide
   whether `garment-search`'s match flow can be described honestly without a
   named third party in the sentence.
5. **Whether we want a DPA.** OpenRouter's privacy policy says: "If you have a
   Data Processing Agreement with us, the terms of that agreement and our
   separate agreements with Model Providers govern how your data is handled."
   Emailing `support@openrouter.ai` to ask whether a DPA is available on our plan
   is the only route to a written, Cinch-specific commitment — which is what the
   §3 blocker literally asked for.
6. **Whether Google Vertex vs Google AI Studio can be pinned.** Vertex endpoints
   for `gemini-3.1-flash-lite` are on the ZDR list and AI Studio's are not. If
   `provider.zdr: true` is set (or `only: ['google-vertex']`), tagging photos stop
   reaching the non-ZDR path. This is a code change, not a finding, and belongs to
   whoever picks up the recommendation below.
7. **`docs/ai-models-and-tiers.md` is stale** on the model list — production runs
   `google/gemini-3.1-flash-lite` and `z-ai/glm-5.2`, not the recommended stack.
   Any future privacy statement keyed to a model name will drift the same way,
   which is an argument for never naming a model in user-facing copy.

---

## 6. Recommendation on the standing blocker

**Do not lift it yet — but it is now one small code change and one dashboard
screenshot away from being liftable, rather than an open question.**

Reasoning:

- The §3 blocker exists because nobody could show that photos are neither
  retained nor trained on. That is now *documented* for OpenRouter itself
  (no training, no default storage, no image persistence beyond routing subject
  to four exceptions) — but it is still **undocumented and currently unrestricted
  for the downstream provider**, which is the party that actually reads the
  picture. §2.7 shows real non-ZDR endpoints in the live routing pool for all
  three configured models.
- Set `provider: { zdr: true, data_collection: 'deny' }` on every call in
  `_shared/openrouter.ts` (and in `garment-search/provider.ts`), and the routing
  pool collapses to endpoints OpenRouter publishes as zero-retention. At that
  point the stronger sentence — "the provider that reads your photo does not
  retain it" — rests on a request parameter that lives in our own source code and
  can be re-verified by reading one file, which is a far better footing than a
  dashboard toggle. Watch for two side effects: `qwen3-vl-235b` loses only
  Alibaba, but `glm-5.2` loses ten endpoints including several cheap ones, so
  expect a price and availability change; and `garment-search`'s Exa plugin is
  explicitly **not** covered, so that flow needs its own sentence either way.
- Until that ships and items 1–2 of §5 are verified in writing, the softened
  copy in `system-safety-contract.md` §3 remains the correct shipping copy — with
  the exception noted in §4 that **"It goes to one AI partner" is itself an
  unsupported claim** and should be softened in the same pass, not restored.

Suggested order: verify the dashboard (§5.1–5.3, ~10 minutes) → set the routing
parameters in code → re-run this document's §2.7 diff → then, and only then,
rewrite the consent sheet.

---

## Addendum — the routing pin was attempted, and reverted unverified

*2026-08-10, by the integrator, after this document was written.*

The recommended change — `provider: { data_collection: 'deny' }` on both
OpenRouter call sites — **was written, then reverted before shipping.** It is
still the right change. It could not be verified from here, and that is the
whole of why it did not ship.

**What was tried.** OpenRouter's public endpoints API,
`GET /api/v1/models/{author}/{slug}/endpoints`, was queried for all three
models in live `ai_config`:

| Model | Endpoints returned | `data_policy` |
|---|---|---|
| `google/gemini-3.1-flash-lite` | 7 | `null` on every one |
| `z-ai/glm-5.2` | 32 | `null` on every one |
| `qwen/qwen3-vl-235b-a22b-instruct` | 5 | `null` on every one |

**The public API does not expose per-endpoint data policy.** So there is no way
from outside the account to confirm that a qualifying endpoint survives the
filter for each model. If none does, OpenRouter rejects the request and
**tagging — the app's primary function — stops for everybody**, including the
people on TestFlight right now.

That is a loud failure rather than a silent one, and it is one line to revert.
It is still not a change to make while nobody is watching the graphs.

### How to enable it safely, in order

1. Sign in to OpenRouter and check the two account toggles by hand:
   **Observability → Input & Output Logging** and **Privacy → the 1% discount
   data-use option.** Both are documented as off by default. The discount
   toggle is the dangerous one — it grants a perpetual licence.
2. On the same account, read each model's endpoint list **with the data policy
   visible** (the dashboard shows it; the public API does not) and confirm at
   least one endpoint per model has training disabled.
3. Add `provider: { data_collection: 'deny' }` to the request body in
   `supabase/functions/_shared/openrouter.ts` and
   `supabase/functions/garment-search/provider.ts`.
4. Deploy **`tag-item` only**, tag one real garment, and check `ai_calls` for a
   row with `succeeded = true`. A `404` mentioning data policy means step 2 was
   wrong for that model.
5. Deploy the rest, then update the copy — `src/features/auth/consent-facts.ts`
   carries the sentence and a comment pointing back here.

### The claim that was fixed anyway

`"It goes to one AI partner and comes straight back"` shipped in the consent
sheet and on the privacy page and was **false regardless of routing** — the
provider is a router, and with no pin the count is on the order of thirty
companies, not one. It now reads *"It goes out to be read and comes straight
back. Your name and your email never go with it."* — true under the
configuration actually deployed, and it stays true after the pin lands.

A third transcription of these facts was also found in
`src/app/dev-capture.tsx` and replaced with an import, so the fixture cannot
show a reviewer words the app does not say.

---

## Addendum 2 — the pin is set (2026-08-10)

The founder chose to ship it with eyes on the graphs, which is the mitigation
the previous addendum said was missing. `provider: { data_collection: 'deny' }`
is now live on both call sites and all five functions are deployed:
`tag-item` (first, alone, per the procedure), then `generate-outfits`,
`stylist-chat`, `packing-brief`, `garment-search`.

**It still could not be pre-verified, and that has not changed.** Both the
model-level and endpoint-level public APIs were checked again: `data_policy`
is absent from `/models` and `null` on every endpoint from
`/models/{id}/endpoints`. OpenRouter does not publish this outside the
account. So the deployment is the experiment.

### The query that tells you

```sql
select workload, model_id, succeeded, error, created_at
  from ai_calls
 where created_at > now() - interval '2 hours'
 order by created_at desc
 limit 50;
```

A failure caused by this change is a **provider/data-policy error** — an
OpenRouter 404 whose body mentions no endpoints matching the data policy. That
is unambiguous and it is not something the app produced before.

### Reverting

One line in each file, then redeploy the affected functions. **The consent
sentence goes back with it** — `src/features/auth/consent-facts.ts` now claims
routing is restricted, and that claim is only true while these two lines are
in place. They ship and revert together, and the comment in that file says so.

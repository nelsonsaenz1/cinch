# Model selection and membership tiers

Prices are live OpenRouter list prices pulled from `https://openrouter.ai/api/v1/models`
on **2026-08-05**. Re-pull before acting on this; the catalogue moves weekly.

Token volumes are the repo's own estimates from `20260803183000_pick_models.sql`,
with one correction: **reasoning models bill their reasoning tokens as
completion tokens.** The original estimate of 800 output tokens per generation
assumed visible output only. Real figures used here are 2,000 out for outfit
generation and 1,200 for chat.

There is no measured data to check this against yet — `ai_calls` is empty. Once
real traffic lands, that table replaces every estimate in this document.

---

## What the workloads actually are

Worth being precise, because it changes which model is right:

- **`tag-item`** — one vision call per photograph, structured output against
  `tagSchema`. The image goes as a signed URL, not base64. This is a
  *perception* task: name the garment, its colour, fabric, pattern, formality.
- **`generate-outfits`** — **not** combinatorial search. The beam search runs
  on-device; the model receives a shortlist and **re-ranks** it. That is why the
  prompt is only ~6k tokens and why a mid-size model is enough.
- **`stylist-chat`** — one call per message, bounded to 8 history turns and a
  4k-char digest.

The re-rank framing is the single most important cost fact in the app. You are
not paying a frontier model to think from scratch; you are paying it to put ten
candidates in order and say why.

---

## Recommended stack

| Workload | Current | Recommended | Per-call | Change |
|---|---|---|---|---|
| tagging | `qwen/qwen3-vl-235b-a22b-instruct` | `qwen/qwen3-vl-32b-instruct` | $0.000281 | **3.0× cheaper** |
| outfit_generation | `deepseek/deepseek-v4-flash-0731` | `openai/gpt-oss-120b` | $0.000573 | **16.8× cheaper** |
| stylist_chat | `z-ai/glm-5.2` | `openai/gpt-oss-120b` | $0.000389 | **17.2× cheaper** |

### Why these

**`qwen/qwen3-vl-32b-instruct`** ($0.104 / $0.416 per M) — same family and same
training recipe as the 235B currently configured, so `TAG_SYSTEM_PROMPT` and
`tagSchema` transfer without a rewrite. Supports strict `structured_outputs`,
which is non-negotiable: `completeStructured` will fail against a model that
does not. 131k context.

Two alternates worth putting in the same eval:

- `google/gemini-2.5-flash-lite` — $0.000270/item, 1M context. Google's vision
  is strong on fine-grained attribute extraction, which is exactly this task.
- `qwen/qwen3.5-flash-02-23` — $0.000176/item, **4.7× cheaper than current**,
  1M context. The aggressive pick.

**Do not** take the absolute cheapest vision models (`google/gemma-3-4b-it`,
`nex-agi/nex-n2-mini`, ~$0.0001/item). Garment tagging is the app's foundation —
every bad tag poisons every outfit built from that piece, forever, and the user
never sees why. A 4B model will confidently call charcoal "black" and miss
fabric entirely. Saving $0.00018 per item is not worth a closet full of subtly
wrong metadata.

**`openai/gpt-oss-120b`** ($0.037 / $0.170 per M) — an open-weight MoE reasoning
model at roughly a fiftieth of GLM-5.2's input price. For a *re-ranking* task
with a strict output schema this is comfortably sufficient, and the 17× saving
is the difference between "AI cost is a line item" and "AI cost is a rounding
error". Alternates: `z-ai/glm-4.7-flash` (8.2× cheaper, same family as current,
lowest-risk swap) and `deepseek/deepseek-v4-flash-0731` (10.4×, 1M context).

### You cannot pick these from a table

The prices are facts. The quality ranking is not — it depends on your garment
photos, your prompt, and your schema. Before switching:

1. Freeze 40–50 real garment photos with hand-written correct tags.
2. Run each candidate, score exact-match on category/colour/formality.
3. Keep the cheapest model that clears your bar, not the cheapest overall.

`ai_config` exists precisely so this is an `UPDATE`, not a release:

```sql
update ai_config set model_id = 'qwen/qwen3-vl-32b-instruct', updated_at = now()
 where workload = 'tagging';
update ai_config set model_id = 'openai/gpt-oss-120b', max_tokens = 4096, updated_at = now()
 where workload in ('outfit_generation', 'stylist_chat');
```

Raise `max_tokens` when moving to a reasoning model — reasoning tokens count
against it, and a truncated response fails schema validation.

---

## Unit economics

Assumes Apple's Small Business Program (15%, first $1M/yr), ~800 KB stored per
garment, and Supabase Pro overage rates ($0.021/GB storage, $0.09/GB egress).

### Ongoing month, recommended stack

| | Free | Standard $7.99 | Pro $14.99 |
|---|---|---|---|
| Items stored | 30 | 150 | 400 |
| New items/mo | 3 | 10 | 25 |
| Outfit generations | 13 | 45 | 90 |
| Stylist messages | 0 | 30 | 150 |
| **AI cost** | $0.0083 | $0.0403 | $0.1170 |
| **Storage + egress** | $0.0048 | $0.0241 | $0.0643 |
| **Total COGS** | **$0.013** | **$0.064** | **$0.181** |
| Net revenue | — | $6.79 | $12.74 |
| **Margin** | — | **99.1%** | **98.6%** |

One-off onboarding tagging: $0.008 (30 items) / $0.042 (150) / $0.112 (400).

### The finding

**AI is not your cost problem.** A heavy Pro user costs eighteen cents a month.
A thousand free users cost thirteen dollars. At these prices the entire COGS
question is settled and the real constraints are acquisition, conversion and
churn.

Which means: **do not design tiers around protecting margin.** Design them
around demonstrating value and creating a reason to upgrade. You can afford to
be generous, and generosity is worth more than the pennies it costs.

### Abuse ceiling — the one number that matters

The pre-tier global quotas (400 tagging, 80 generations, 60 chats per day) allow one determined account to run:

| Stack | Monthly COGS at full quota | Margin at $14.99 |
|---|---|---|
| Recommended | $2.51 | 80.3% |
| **Current** | **$35.83** | **−181%** |

On today's models a single scripted account **loses you $23/month**. The
recommended stack turns that into a survivable $2.51. This is the strongest
argument for the swap — stronger than the average-case saving, which is already
negligible either way.

Even so, tie quotas to tier rather than leaving one global ceiling.

---

## Recommended tier structure

### Free — $0
- **30 garments**
- **3 outfit suggestions per week**
- No stylist
- Full closet, cost-per-wear, wear tracking, share cards

30 is chosen deliberately. Below ~20 garments the beam search repeats itself and
the app looks broken — a free tier that makes the product look bad is worse than
no free tier. 30 is a capsule wardrobe: enough that the styling genuinely works,
far short of a real closet (a typical adult owns well over 100 pieces). The wall
arrives when they try to add their actual wardrobe, which is the right moment.

Three suggestions a week, not daily. The habit you are selling is *every
morning*; the free tier should make its absence felt.

### Standard — $7.99/mo, $59/yr
- **150 garments**
- **Daily outfit**, unlimited re-rolls
- **30 stylist messages/month**
- Weekly planning

This is the tier most people should land on. 150 covers a real wardrobe.

### Pro — $14.99/mo, $119/yr
- **Unlimited garments** (soft cap 1,000, see below)
- Unlimited outfits
- **Unlimited stylist**
- Priority tagging queue

"Unlimited" should mean a soft cap of ~1,000 items enforced quietly, with a
human in the loop above it. At 1,000 items you are still only at $0.28 in
tagging — the cap is not about cost, it is about the difference between a
customer and a scraper.

### Enforced ceilings (shipped)

The product promise above and the enforced ceiling are two different numbers,
and the gap between them is deliberate. `claim_ai_quota` does not refund a unit
when the provider call then fails — a refund path hands an attacker a free retry
loop — so a ceiling set exactly at the promise would spend a free user's whole
week on one flaky network.

| | free | standard | pro |
|---|---|---|---|
| Closet size | 30 | 150 | 1000 |
| Tagging | 60 / month | 400 / month | 1500 / month |
| Outfit generation | 5 / week | 15 / day | 60 / day |
| Stylist | none | 30 / month | 100 / day |
| **Worst-case COGS/mo** | **$0.03** | **$0.38** | **$2.78** |

Tagging is monthly rather than daily, which is the one non-obvious choice.
Photographing a wardrobe is a one-sitting event, so a daily cap has to be large
enough for a complete import — and a daily cap that large, repeated thirty
times, is the most expensive thing an abusive account can do. A monthly bucket
sized for one full import plus re-tags gives onboarding all the room it needs
and closes that door.

The free-tier number is the one to watch. It is the only line that scales with
people who never pay: 10,000 honest free accounts is ~$300/month of exposure at
the recommended models, and ~$2,600/month at the models configured today. That
is the argument for swapping models *before* opening the free tier, not after.

Definitions live in `supabase/functions/_shared/plans.ts`; closet size is
enforced in the database by `item_limit_for_plan()` because items are inserted
by the client.

### Mechanics worth having

- **14-day full-access trial**, not a crippled free tier at signup. Someone who
  has photographed 80 garments has done the work; they convert. Someone capped
  at 30 during onboarding never gets far enough to care.
- **Annual at ~2 months free.** Subscription churn in the first 90 days is the
  thing that kills apps like this, and an annual plan converts a retention
  problem into an acquisition problem.
- **Per-tier quotas** in `PLAN_LIMITS` (in `_shared/plans.ts`), keyed off the user's plan rather
  than one global ceiling.
- **Grandfather the item count on downgrade.** Never delete someone's garments
  because they cancelled — make the closet read-only above the new cap instead.
  Deleting user data on downgrade is how you earn a one-star review that never
  goes away.

### Price sensitivity

$7.99 sits below the reflexive $9.99 comparison and above the $4.99 band that
reads as unserious. If you would rather test one price, test **$9.99 Standard /
$19.99 Pro** — the margin is 99% either way, so this is purely a question of what
the market bears, and you should find that out with a live experiment rather
than a spreadsheet.

---

## Before any of this ships

- [ ] Build the tagging eval set (40–50 photos, hand-written tags)
- [ ] Re-pull OpenRouter prices — this document ages fast
- [ ] Set a hard spend cap on the OpenRouter account itself
- [x] Per-tier limits shipped — `_shared/plans.ts` + migration 20260805160000
- [x] `subscriptions.plan` + `effective_plan()` read in `enforceAiQuota`
- [ ] Watch `ai_calls` for the first real month, then replace every estimate here

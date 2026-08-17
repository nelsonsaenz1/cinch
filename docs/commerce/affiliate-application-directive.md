# Directive — apply Cinch to 1,000+ apparel affiliate programmes, and shepherd them to approval

**Written 2026-08-17. For a Cowork agent driving Nelson's logged-in Chrome.**
**Networks:** Rakuten Advertising (priority), Awin (volume).
**Prime references, read before starting:** `docs/commerce/network-ids-directive.md`
(account facts, the clickref refusal, how credentials travel),
`docs/commerce/awin-us-apparel-targets.csv` (3,008 US apparel advertisers),
`docs/commerce/merchant-allowlist.md` (the 82 merchants the app will actually name).

---

## 0 · Mission, and the one sentence of honesty it rests on

Cinch's shop suggestions and listing links earn nothing until affiliate
programmes approve us. The mission is **≥1,000 submitted applications across
Rakuten and Awin, and the highest approval rate the account can honestly earn.**

The honesty: **approval is the merchant's decision, not ours.** No agent can
"make sure" a third party says yes. What an agent CAN do — and what every
section below exists to do — is remove every reason to say no: a complete,
professional publisher profile before the first application goes out; a pitch
that says what Cinch is in two sentences; a follow-up loop so no application
dies of silence; resubmission where a decline permits it; and escalation
through network support for the merchants that matter most. Auto-approving
merchants (a large minority on both networks) land within days regardless.
Everything else is probability, maximized.

**Success criteria** (report against these, in this order):

1. Publisher profiles on both networks complete per §2 — before any application.
2. ≥1,000 applications submitted within 10 calendar days, per the tranche order
   in §4/§5 — priority merchants first, volume after.
3. Every application recorded in the ledger (§6) the day it is sent.
4. Follow-up loop (§7) executed on days 3, 7, and 14 — statuses refreshed,
   permitted resubmissions sent, support tickets opened for stalled priority
   merchants.
5. Rakuten tracking ID + API credentials captured and stored per §3 — this is
   worth more than 500 applications, do not skip it to chase the number.

---

## 1 · Ground rules — read twice, they protect the account

- **Nelson logs in.** The agent never enters credentials, never answers a
  CAPTCHA, never accepts a new terms-of-service or programme agreement without
  showing it to Nelson first. If a login expires mid-run, stop and ask.
- **Pace like a person.** Submit in batches of ~25 with pauses, cap around
  **100–150 applications per network per day**, spread across the day. A
  thousand applications fired in an hour reads as a bot and risks the publisher
  account itself — the account is worth more than the schedule. If either
  network shows any warning, rate-limit, or unusual-activity notice: **halt
  that network entirely** and report; do not resume until Nelson says so.
- **Never enable click-level tracking identifiers** — `clickref`,
  `clickref2`–`clickref6`, SubID, "publisher reference", under any name, on
  either network. This is `commerce-directive.md` §6 refusal 7: the click
  carries no user identity to the merchant or the network. Leave every such
  field empty in every application and every settings page you touch.
- **Do not report advertiser IDs by hand-copying them into chat.** Joined
  programmes are read by engineering from
  `GET /publishers/3030871/programmes?relationship=joined` (Awin) and the
  Rakuten reporting API. The ledger (§6) tracks *applications*; the API is the
  truth for *approvals*.
- Rakuten **Client ID / Client Secret are credentials** — they go into
  Supabase Edge Function secrets (project `dugizuswuebrmcmvinmi`) as
  `RAKUTEN_CLIENT_ID` / `RAKUTEN_CLIENT_SECRET`, entered in the Supabase
  dashboard directly, never pasted into chat or the ledger. The tracking ID is
  public by construction and may be written down anywhere.

---

## 2 · Phase A — harden both publisher profiles BEFORE any application

Merchants approve or decline on the profile. Thirty minutes here moves the
approval rate on all thousand applications. On **both** networks, verify or
complete:

| Field | Value to enter |
|---|---|
| Publisher / business name | Cinch |
| Website | `https://cinchstyle.com` |
| Property type | **Mobile app** (add "content/blog" only if the network requires a second) |
| App listing | App Store: `Cinch: Outfit Planner & Closet` — link the live store page |
| Promotional method | Contextual in-app recommendations (see pitch below) |
| Incentives / loyalty / cashback | **No** — Cinch pays users nothing and runs no rewards |
| Coupon/deal site | **No** |
| Sub-affiliates | **No** |
| Email marketing | **No** (transactional email only, no promotional blasts) |
| Traffic region | United States |

**The canonical pitch** — use verbatim wherever a description or "how will you
promote us" box appears; trim from the end if a field is shorter:

> Cinch is an iOS wardrobe app: users photograph their own closet and Cinch
> plans daily outfits from clothes they already own. When an outfit needs a
> piece the user doesn't own — a gap the app has detected in their real
> wardrobe — Cinch recommends a specific matching product from a curated
> retailer. Links are contextual, one product per gap, shown only at the moment
> of a detected need. No coupons, no cashback, no incentivized clicks, no
> email blasts — high-intent apparel traffic from users actively deciding what
> to buy next.

If a profile field asks for monthly traffic/audience: answer truthfully at
current scale ("newly launched, paid user acquisition beginning this month")
— overclaiming is the one thing that gets a publisher account terminated later.

---

## 3 · Phase B — Rakuten first (it holds the retailers that matter)

Per `network-ids-directive.md` §1: Gap, Old Navy, J.Crew, Madewell, Nordstrom,
Macy's, Levi's, Uniqlo, Abercrombie, Anthropologie, Free People and the rest of
the broad US apparel catalogue live on **Rakuten**, not Awin. Awin US apparel is
two broad names and a long tail. Rakuten outranks Awin; do it first.

### 3.1 Capture the three values (before applications, while the dashboard is fresh)

1. **Tracking ID** — publisher dashboard → link/tracking settings. It is an
   **11-character case-sensitive alphanumeric** string. ⚠️ It is NOT the SID:
   if what you found is 4–8 digits, that's the SID — keep looking. Sanity check:
   exactly 11 chars, mixed letters and digits. Record it in the report (public).
2. **Client ID + Client Secret** — Rakuten Developer Portal → add an
   application → copy both into Supabase → Edge Functions → Secrets
   (`RAKUTEN_CLIENT_ID`, `RAKUTEN_CLIENT_SECRET`). Never into chat.
3. Confirm with Nelson that both secrets show as set in Supabase before moving on.

### 3.2 Apply — priority tranche, then the sweep

Advertiser directory → filter: United States, Apparel/Fashion categories.

**Tranche R1 (apply individually, with the pitch, same day):** every broad
multi-category US retailer present — search for each by name: Gap, Old Navy,
Banana Republic, J.Crew, Madewell, Nordstrom, Nordstrom Rack, Macy's,
Bloomingdale's, Levi's, Uniqlo, Abercrombie & Fitch, Hollister, American Eagle,
Aerie, Anthropologie, Free People, Urban Outfitters, Everlane, Aritzia, Express,
Banana Republic Factory, Saks OFF 5TH, DSW, Steve Madden, ASOS, Boohoo, H&M,
Mango, Lands' End, L.L.Bean, Eddie Bauer, Carhartt, Dickies, New Balance, ALDO,
Kohl's, JCPenney, Target (if present). Any that are absent, note in the ledger
as "not on network".

**Tranche R2 (the sweep):** every remaining US apparel advertiser whose
catalogue spans more than one garment slot — a brand selling tops AND bottoms
AND outerwear can fill an arbitrary wardrobe gap; a socks-only boutique cannot.
Apply top-of-directory downward, 25 at a time, within the daily cap.

### 3.3 What "multi-slot" means when judging a directory row

Open the advertiser's site link only when the name is ambiguous. Thirty seconds:
does the nav show at least two of {tops, bottoms, outerwear, dresses, shoes}?
Yes → apply. One product category or clearly non-apparel (the sector field is
self-classified and imperfect) → skip, ledger it as "skipped: single-slot".

---

## 4 · Phase C — Awin sweep (volume lives here)

Account: publisher `3030871`, approved, API token valid. Directory → Advertiser
Directory → filter United States + sectors Clothing / Clothing Accessories /
Jewellery. The committed CSV (`awin-us-apparel-targets.csv`, 3,008 rows) is the
map — work from it rather than re-deriving the list, and mark each row's
disposition in the ledger.

**Tranche A1 (first, individually):** `30347` lululemon (US), `33371` Vuori —
the only two broad US names on the network.

**Tranche A2:** every CSV advertiser whose `link_status` is `online` AND whose
catalogue is multi-slot (same 30-second judgment as §3.3). Expect this to be
several hundred to ~1,500 of the 3,008 — this tranche plus Rakuten R2 is where
the 1,000-application target is met.

**Tranche A3 (only if the target still isn't met):** single-slot brands in
categories the gap engine actually asks for (outerwear, denim, dresses, shoes —
see `SLOT_QUERY` in `supabase/functions/gap-shop-match/policy.ts` for the
verified slots). Never apply to `offline` rows; ledger them as "skipped: offline".

Application note: the §2 pitch, verbatim, wherever Awin offers a message field;
many Awin applications are one click with no message — that's fine.

---

## 5 · The pacing calendar (adjust only downward)

| Day | Work |
|---|---|
| 1 | §2 profiles both networks · §3.1 Rakuten values · Tranche R1 |
| 2 | Tranche R2 first ~150 · Tranche A1 |
| 3–9 | Alternate R2 / A2 at ≤150/network/day · day-3 follow-up (§7) on day 4 |
| 7 | Day-7 follow-up pass |
| 10 | Target check: if <1,000 submitted, open Tranche A3 · report |
| 14 | Day-14 follow-up pass · final report |

---

## 6 · The ledger — one row per application, written the same day

Maintain `docs/commerce/application-ledger.csv`:

```
date,network,advertiser_id,advertiser_name,tranche,status,status_date,follow_up_due,notes
2026-08-18,rakuten,,Gap,R1,applied,2026-08-18,2026-08-21,
2026-08-18,awin,30347,lululemon (US),A1,applied,2026-08-18,2026-08-21,
```

`status` ∈ applied · approved · declined · declined-resubmittable ·
not-on-network · skipped: single-slot · skipped: offline. Commit the CSV to the
repo at the end of each working day (it contains no secrets). The ledger is the
agent's memory across sessions — a fresh session starts by reading it, never by
re-applying.

---

## 7 · The approval-shepherding loop (this is the "make sure" machinery)

On days 3, 7, and 14 after each application batch:

1. **Refresh statuses** from each network's programme/partnership page; update
   the ledger.
2. **Approved** → nothing to do here; engineering reads approvals via API (§8).
3. **Declined with a reason** → if the network allows resubmission and the
   reason is fixable (incomplete profile, missing property, unclear promotion
   method), fix the named thing and resubmit ONCE. Ledger:
   `declined-resubmittable`. Never resubmit a flat decline more than once —
   repeated reapplication is how publisher accounts get flagged.
4. **Priority merchants (R1/A1) silent past 14 days** → open a ticket with the
   network's publisher support asking for review status, referencing the
   application date. One ticket per merchant, ever. Draft the ticket, show
   Nelson, send on his approval.
5. **Anything asking questions back** (some merchants email or message through
   the platform) → draft the answer from the §2 pitch and current truth, show
   Nelson, send on approval. An unanswered merchant question is a self-inflicted
   decline; this step outranks new applications on any day it occurs.

---

## 8 · Handoff to engineering — what happens as approvals land

The agent's job ends at approvals; these are the tripwires to tell engineering
(the main Claude Code session) about, so nothing waits:

- **First Rakuten approval** → engineering wires the Product Search API using
  the stored `RAKUTEN_CLIENT_ID`/`RAKUTEN_CLIENT_SECRET` + tracking ID, and the
  `links_paid` counter in `commerce_health_report()` should start moving.
- **First Awin approval** → `commerce_joined_programmes` gains its first row
  (via the API read), which is the stated condition for scheduling the dormant
  `sync-feeds` function (`docs/commerce/sync-feeds-dormant.md`).
- **Any approval of an 82-allowlist merchant** (`merchant-allowlist.md`) →
  flag it by name: those are the merchants `gap-shop-match` will actually
  surface, so each one directly widens what users see.
- Weekly: `select jsonb_pretty(commerce_health_report());` — `monetisation.
  joined_programmes` is the single number this whole directive exists to move.

---

## 9 · Stop conditions — halt and ask Nelson, no exceptions

- Any network warning, unusual-activity notice, or rate-limit message.
- Any CAPTCHA, login wall, or two-factor prompt.
- Any new terms-of-service, programme agreement with non-standard clauses, or
  any request for tax/banking/identity information (these exist — W-9 and
  payment setup are Nelson-only tasks; note them in the report as blockers).
- Any field asking to enable click-level tracking identifiers (§1) — do not
  fill it, note which merchant asked.
- The ledger and the dashboard disagree about what was already submitted.

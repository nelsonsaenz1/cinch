# Cinch email program

Everything a scheduled task (or a human) needs to run Cinch's email without asking
anyone a question. Set up 2026-09-01. **Nothing in this program sends itself — every
send is a draft until Nelson presses the button.** That rule is in §7 and it is not
negotiable by an agent.

---

## 1. The three streams

| Stream | Cadence | Trigger | Audience | Its one job |
|---|---|---|---|---|
| **Welcome** | Once per person | 24h after signup | The individual | Get garment #1 into the closet |
| **The Dispatch** | Weekly | Scheduled task | Both segments, split copy | Keep the app in mind; drive the invite loop; carry the Pro ask |
| **Release note** | ~Monthly | A build goes live on the App Store | Both segments, one copy | Make a shipped version feel like an event |

**Frequency cap: no person receives more than 2 Cinch emails in any 7 days.** If a
release note goes out in a given week, that week's Dispatch is skipped, not stacked.
The Welcome email does not count against the cap.

---

## 2. Audience — segments and who is in them

Resend plan allows **3 segments total**. In use:

| Segment | ID | Size | Who |
|---|---|---|---|
| **Cinch — Active closet** | `94ebb650-fba3-4f93-938f-582acbaff748` | 17 | ≥1 garment in the closet |
| **Cinch — No closet yet** | `2ecfd8fc-37d8-4406-8e80-5fbf67950933` | 19 | Signed up, zero garments |
| General | `ebce2c42-6916-4f2c-bfc8-19e21a3624b3` | 0 | Legacy, unused |

**36 real contacts imported out of 47 auth users.** The gap is 11 internal accounts,
permanently excluded — never import these:

```
qa-closet-recut-verify@cinchstyle.com   sim-test@cinchstyle.com
sim-test+ja@cinchstyle.com              sim-test+j00@cinchstyle.com
simtestf31@cinchstyle.com               fixture-ada@cinchstyle.com
launch-probe@mail.cinchstyle.com        hello@mail.cinchstyle.com
demo@cinch.app                          lisa.2wxrklc.paid@icloud.com
                                        lisa.2wxrkclc.paid@icloud.com
```

`nelsonsaenz1@yahoo.com` is deliberately in **Active closet** as a seed — Nelson
receives every broadcast alongside the list.

**13 of the 36 are Apple private relay** (`@privaterelay.appleid.com`). They are
imported and will be sent to. They forward only while `hello@mail.cinchstyle.com` is
registered under **Sign in with Apple → Email Communication** at developer.apple.com.
Nelson confirmed this is done on 2026-09-01. **Before the first broadcast, send one test
to a single relay address and confirm delivery** — a 36% bounce on a new domain's first
send is very hard to undo.

### Keeping segments current

Segment membership is a snapshot, not a live query. Re-sync weekly before the Dispatch:

```sql
-- Active closet
select lower(u.email) as email,
       initcap(split_part(coalesce(nullif(p.display_name,''),
              nullif(u.raw_user_meta_data->>'full_name',''),''),' ',1)) as first_name
from auth.users u
left join profiles p on p.user_id = u.id
where u.email is not null and u.email <> ''
  and u.email not in ( /* the 11 internal accounts above */ )
  and (select count(*) from items i where i.user_id = u.id) > 0;

-- No closet yet: same, with = 0
```

Import with `create-contact-import`, `onConflict: upsert`, the matching `segmentIds`.
A person who crosses from 0 → 1 garment must be **removed from No-closet-yet** as well
as added to Active closet — upsert alone will not do it (`remove-contact-from-segment`).

If `first_name` comes back as an email prefix (`sydneyshack1`, `koribuchanan`) or
garbage (`Nhithz`, `Hhu`), replace it with a clean given name or the literal string
`there` — templates render `Hi {{{FIRST_NAME}}}` with no fallback, so an empty value
prints "Hi  —".

---

## 3. Assets

| Asset | Where | Notes |
|---|---|---|
| `welcome.html` | `docs/marketing/email/` + Resend template `cinch-welcome` (**published**, id `730e4d83…`) | Transactional. Send with `send-email`, passing variables. |
| `dispatch.html` | `docs/marketing/email/` | **The repo file is canonical.** Resend template `cinch-dispatch` exists for preview only. |
| `release.html` | `docs/marketing/email/` | Three entries instead of two, plus a version eyebrow. |
| Draft Dispatch No. 01 | Resend broadcasts `dd6c8ce6…` (Active) / `864e0059…` (No closet) | Written 2026-09-01, unsent. |

**Sender:** `Cinch <hello@mail.cinchstyle.com>` · reply-to the same · domain
`mail.cinchstyle.com` verified, sending + receiving enabled. Replies land in the Resend
inbox — read it, that is where Savannah's two emails came from.

### Variable syntax — the one trap

- **Templates** (`send-email`) accept `{{{FIRST_NAME}}}` only. Pipe fallbacks are a
  422 error.
- **Broadcasts** accept `{{{FIRST_NAME|there}}}`. Always use the pipe form in a
  broadcast; when copying `dispatch.html` into one, swap the plain form for the pipe form.
- `{{{RESEND_UNSUBSCRIBE_URL}}}` is automatic and must stay in every send.

---

## 4. The weekly Dispatch — the recipe

**Run:** Tuesday morning. **Output:** two broadcast drafts, one per segment. **Never
sends.**

### Step 1 — gather

1. `git -C /Users/nelsonsaenz/cinch log --since="8 days ago" --stat` — what actually
   shipped. Only user-visible changes qualify; a refactor is not news.
2. The latest CMO briefing in `docs/marketing/cmo-briefings/` — it already names what
   shipped and what is broken.
3. The Resend inbox (`list-received-emails`) — a user question is the best possible
   Entry One, because "you asked for this" outperforms "we built this."
4. Check `docs/ops/cinch-implementation-release-ledger.md` for what is **live** versus
   merged. Something in git and not yet OTA-published must not be announced.

### Step 2 — fill the six slots

| Slot | Rule |
|---|---|
| `HEADLINE` | A sentence, not a label. "You asked for this one." not "Cinch Weekly #4". Under 45 characters. |
| `LEDE` | One sentence. Continues from "Hi Name — " so it starts lowercase. Names the reader's situation. |
| `ENTRY_ONE` | Kicker `New` / `Fixed` / `Better`. Something that shipped **and is live**. Lead with the user benefit; the mechanism can follow. |
| `ENTRY_TWO` | Kicker `Try this`. One feature from the bank in §5 that the cohort probably has not found. Rotate — never repeat inside 8 weeks. |
| `INVITE_LINE` | Always present. Vary the phrasing weekly. K is 0.08; this block is the cheapest growth lever in the business. |
| `OFFER_LINE` | Always present. Must match live ASC pricing (§6). Soften for the No-closet cohort — lead with what is free. |

### Step 3 — split by cohort

**Active closet** — assumes a working closet. Talk about depth: what changed, what to
try next, who to invite.

**No closet yet** — the only real goal is garment #1. Entry One should be "photograph
ten things" almost every week, phrased differently. Entry Two is the payoff that
follows. Do not describe features they cannot reach yet.

### Step 4 — build

Read `dispatch.html`, substitute the variables, swap `{{{FIRST_NAME}}}` →
`{{{FIRST_NAME|there}}}`, write both filled files to
`docs/marketing/email/draft-dispatch-NN-<cohort>.html`, and create two broadcasts with
`create-broadcast`. Post the two subject lines and preview URLs to Nelson. **Stop there.**

---

## 5. Feature bank for Entry Two

Rotate. Everything here is live as of 2026-09-01 — verified against the route table.

**Active closet cohort**
- Compose your own outfit (`/compose`) — pick pieces yourself, still counts as a wear
- The Plan tab — Week / Events / Packing behind one toggle
- Packing lists for a trip — tell it where you are going
- The wear diary and cost-per-wear
- Repeat an outfit you already loved (`/repeat-outfit`)
- The Stylist tab — ask for something specific
- Saved looks (`/saved`)
- The gap feed — what your closet is actually missing (`/gap-feed`)
- Borrowing from a friend's closet (`/borrow`)
- Events — plan an outfit around something on the calendar
- The Reveal — the outfit count for your closet
- Weather-aware suggestions for your actual location

**No closet yet cohort**
- Photograph ten pieces (the perennial Entry One)
- Automatic background removal and tagging
- The Reveal's number
- The Today tab's morning answer
- Inviting a friend so you do it together

### Never advertise
- **Pinterest inspiration** — shipped end to end but dark until Pinterest's trial
  clears. Do not mention it in any email until the release ledger says it is live.
- **The shop shelf / "where to buy"** — gated behind `show_where_to_buy` (C-03).
- Anything merged but not OTA-published.

---

## 6. Pricing, as of 2026-09-01 — verify against ASC before every send

| Product | Price | Intro offer |
|---|---|---|
| `cinch.standard.annual` | **$39.99/yr** | **7-day free trial, 175 territories** |
| `cinch.standard.monthly` | $4.99/mo | none |
| `cinch.pro.annual` | $79.99/yr | none |
| `cinch.pro.monthly` | $9.99/mo | none |

**The trial exists on exactly one product.** Any email that says "seven days free" must
point at Standard Annual. If Nelson moves the offer or changes the paywall default,
`OFFER_LINE` changes the same day.

---

## 7. Hard rules

1. **An agent never sends.** Create drafts, report the preview URLs, stop. Sending,
   scheduling a send, and `send-broadcast` are Nelson's, every time.
2. **Never claim a feature that is not live** — check the release ledger, not the git log.
3. **Never remove the unsubscribe block** or the "you are getting this because you have a
   Cinch account" line.
4. **Never email the 11 internal accounts.**
5. **Respect the 2-in-7-days cap.**
6. **Do not invent user quotes or numbers.** If a Dispatch cites a customer, the email
   must exist in the Resend inbox.
7. **Seed test first.** Before any broadcast to a segment, `send-email` the same content
   to `nelsonsaenz1@yahoo.com` and one relay address.

---

## 8. Measurement

**Open and click tracking are OFF** on `mail.cinchstyle.com`. Until they are on, the
only readable signals are deliveries, bounces and unsubscribes — no open rate, no CTR.
Turning both on in the Resend domain settings is a two-minute job and should happen
before Dispatch No. 01 goes out, otherwise the first send teaches us nothing.

What to read after each send: delivered / bounced / unsubscribed (`get-email-metrics`,
`list-broadcast-recipients`), then the app-side outcome the email was meant to cause —
for the No-closet cohort, how many of the 19 hold ≥1 garment 72h later.

---

## 9. Setting up the welcome email

There is no trigger yet. The lightest version, needing no code:

> **Daily scheduled task, 10:00 ET.** Query for profiles created between 24 and 48 hours
> ago, excluding the internal accounts. For each, `send-email` with template
> `cinch-welcome`, passing `FIRST_NAME`. Log who was sent to so nobody gets it twice.

```sql
select lower(u.email) email,
       initcap(split_part(coalesce(nullif(p.display_name,''),
              nullif(u.raw_user_meta_data->>'full_name',''),''),' ',1)) first_name
from auth.users u left join profiles p on p.user_id = u.id
where u.created_at between now() - interval '48 hours' and now() - interval '24 hours'
  and u.email is not null and u.email <> ''
  and u.email not in ( /* the 11 internal accounts */ );
```

The sturdier version is a Supabase `pg_cron` job hitting an edge function, so it keeps
working when nobody is watching. Worth doing once volume justifies it.

---

## 10. Open engineering asks this program surfaced

1. **Turn on open + click tracking** on the domain. Two minutes. Blocks all measurement.
2. **Universal links only cover `/i/*`** (invite links) in
   `web/.well-known/apple-app-site-association`. Every email CTA therefore opens the App
   Store page rather than the app. Adding `/open`, `/closet`, `/membership` to the AASA
   components would let email land people inside the app — the single biggest
   conversion improvement available to this program.
3. **Build the welcome trigger** (§9).
4. **`push_tokens` is 0.** Email is currently the only re-engagement channel that exists.
5. **Resend segment cap is 3** on the current plan. A third useful cohort — expiring
   trials, say — needs an upgrade or a rotation strategy.

---

## 11. Re-engagement No. 01 — the first Cinch email with a way in

Drafted 2026-09-03, unsent. This is ledger row **A32**: the 29 conversion notes of
09-02 delivered 29/29 and produced **zero** in-app events in the following 15 hours,
and the reason the nightly gave is that the message contained no link of any kind.

### The link, and why it is `/closet`

`/closet` is a **real route inside the app** (`src/app/(tabs)/closet.tsx`). A universal
link only opens the app; expo-router then resolves the path against its own route
table, and an unclaimed path lands on `+not-found`. Claiming a path the app already
answers is what makes this a **web deploy only — no binary, no OTA**:

| piece | file | state |
|---|---|---|
| AASA component `/closet` | `web/.well-known/apple-app-site-association` | written |
| rewrite `/closet` → `/api/open` | `web/vercel.json` | written |
| fallback page for anyone without the app | `web/api/open.js` | written |

The entitlement (`applinks:cinchstyle.com`, `app.config.ts:207`) is host-scoped and
already in the shipped build-47 source, so no new binary is needed for a **path**
addition. **Not verified:** no one has ever recorded a real iPhone opening any
`cinchstyle.com` universal link into the app — not `/i/*` either. Until someone taps
one on a phone, the app-opening half of this is unproven and the fallback page is what
carries the campaign.

### `APP_LIVE` is not set in Vercel — the invite doorway sends iPhones to a waitlist

Found while building this. `web/api/invite.js` gates its store link behind
`process.env.APP_LIVE === '1'`. Fetched 2026-09-03 with an iPhone user agent, the live
`/i/<handle>` page renders CTA **"Join the list" → `cinchstyle.com/#waitlist`**, even
though `itunes.apple.com/lookup?id=6798479578` returns `resultCount: 1`. Every invite
tap since launch has landed on a waitlist instead of the App Store. **`web/api/open.js`
deliberately does not read that flag.** Setting `APP_LIVE=1` in the Vercel environment
is a one-line fix and should ship with the `/closet` deploy.

### Audience — 29, reconciled against Resend and Supabase on 2026-09-03

Exactly the 29 who received the 09-02 conversion note. Exclusions checked and clean:
none of the 29 is an internal account, none bounced (09-02 batch: 29 sent, 29
delivered, 0 bounced, 0 complained, 0 unsubscribed), none is suppressed, none is
unsubscribed. The one suppressed relay address in the account
(`t5p8cw987n@privaterelay.appleid.com`, bounce 08-31, **pre-dating** the Apple relay
registration of 09-01 23:26Z) was already outside this batch.

Split by closet progress, from `items` per `auth.users.id`:

| cohort | rule | n | subject |
|---|---|---|---|
| **kept** | ≥1 garment | 13 | `Your {n} piece(s) is/are still there` |
| **start** | 0 garments | 16 | `It only takes ten photos` |

Three of the 29 are `%saenz%` family (`avasaenz06`, `karencsaenz`, `colesaenz5`) and
two of those sit at the top of the **kept** cohort (21 and 14 garments). Per
METHODOLOGY they are not internal and the founder ruling is still open, so they are
**included** — but every result off this send must be printed family-excluded (26)
as well as family-included (29), or the read is contaminated.

### Sending shape, and why it is not a broadcast

Sent as 29 personalised one-offs (`send-batch-emails`), not a broadcast, because the
per-person garment count is the whole lever in the **kept** copy and a broadcast cannot
carry it. The cost is that the hosted `{{{RESEND_UNSUBSCRIBE_URL}}}` is unavailable to
one-off sends, so unsubscribe is handled by an RFC-8058 `List-Unsubscribe:
<mailto:hello@mail.cinchstyle.com?subject=UNSUBSCRIBE>` header plus a visible
reply-UNSUBSCRIBE line. **Replies land in the Resend inbox and must be read and
converted into a manual suppression within one business day — the email promises it.**

### Measurement — and the trap that would break the link

**Do not turn on click tracking for this send.** Resend click tracking rewrites every
`href` to a tracking host. iOS matches a universal link against the URL that was
*tapped* and does not follow redirects into one, so a rewritten link would open Safari
and never open the app — it would defeat the entire point of the campaign. Open
tracking (a pixel) does not touch links and may be enabled if an opens number is
wanted, with the usual Gmail/Yahoo proxy caveat.

What to read instead, in order: Resend `delivered` / `bounced` / `unsubscribed`; then
in-app events keyed on the 29 recipients' `distinct_id`s (which are their
`auth.users.id`s — 27 of the 29 resolve in PostHog); then `subscriptions` and
`asc_notifications` for a purchase. **Click evidence will not exist for this send, by
design. Do not substitute open rate for it.**

### Frequency cap

These 29 received an email on 09-02. This send is their **second in 7 days** — the cap
in §1 is then spent, and the week's Dispatch must skip this cohort entirely.

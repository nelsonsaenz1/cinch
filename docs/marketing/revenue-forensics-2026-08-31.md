# Revenue forensics — where the money went

**2026-08-31 · triggered by: "friends downloaded the app and paid for it and it's not showing up"**

## The finding

**No money is missing, because no money was ever charged.** Not to your friends, not to
anyone. Six independent systems agree, and one of them is Apple's own accounting.

This is not a reporting gap. Cinch has never completed a production purchase.

## The evidence — six systems, no disagreement

| Source | What it says | Why it's trustworthy |
|---|---|---|
| **ASC Payments & Financial Reports**, Aug 2026 | *"There is no data available for August, 2026."* | Apple's ledger of what it owes you. Not privacy-thresholded. |
| **ASC Sales & Trends**, Jul 31–Aug 30 | App Units **38**; In-App Purchases **no data**; Sales **no data** | Financial reporting, not the Analytics module that hides small numbers behind "Not Enough Data" |
| **Apple App Store Server Notifications** (`asc_notifications`, 7 rows) | 2 × `TEST` (Sandbox + **Production**, both 8/26) and 5 × `DID_RENEW` — **every one `environment = Sandbox`**, all from a single `original_transaction_id` `2000001226897794` | First-hand, cryptographically verified, direct from Apple to your endpoint |
| **Superwall**, 30 days | 69 users · 4.35% paywall rate · **0 total conversions · 0 initial conversions · $0** | Independent of your database |
| **`superwall_events`** (5 rows) | All `renewal`, all the same sandbox transaction, all `outcome = stale`, none reconciled | Written *before* the plan decision, so even a refused event lands |
| **`subscriptions`** (44 rows) | 42 `free`, 1 `standard` (yours, 8/26), 1 `pro` (the documented phantom, 8/7) | — |

**The pipe is provably alive.** A sandbox `DID_RENEW` arrived and was written to the
database at **01:27 UTC today**, and the *Production* `TEST` notification succeeded on
8/26 23:53. So this is not a broken webhook concealing real revenue. The endpoint works.
Nothing is coming through it.

## Why your friends believe they paid

Two mechanisms, both real, both in the code.

### 1. Everyone is given the top tier free, automatically, with no payment step

The signup trigger `handle_new_subscription`:

```sql
insert into public.subscriptions (user_id, plan, trial_ends_at)
values (new.id, 'free', now() + interval '14 days')
```

Every account gets a 14-day trial on creation. No card, no paywall, no tap.

Then `src/features/billing/use-plan.ts:123`:

```ts
const plan: Plan = foldPlan(trialing ? 'pro' : (data?.plan ?? 'free'), sdkPlan);
```

**A trialing user is rendered as `pro`** — the $14.99/mo top tier. So a friend downloads,
signs up, and is instantly inside full Pro with everything unlocked. **33 accounts are in
this state right now.** Only **5 users have seen a paywall in the last 21 days.** Most of
them never encountered a purchase screen at all; they experienced "I have the paid app."

### 2. One person did buy — in the sandbox

Transaction `2000001226897794`, `cinch.standard.monthly`, renewing daily since 8/27.
**Sandbox purchases charge nothing.** They occur on TestFlight builds and sandbox Apple
IDs, and the confirmation sheet looks almost identical to a real one — the only tell is a
small "[Environment: Sandbox]" line. If any friend installed via TestFlight rather than
the App Store, this is exactly what they saw and it was never going to bill them.

`plan-fold.ts` then honours the SDK's entitlement and shows them as paid, which is correct
behaviour for a real purchase and indistinguishable for a sandbox one.

**Ask each friend two questions:** did you install from the App Store or from a TestFlight
invite, and does your Apple receipt email exist? No receipt = no purchase.

## The actual revenue problem

Stated plainly: **Cinch gives away its most expensive tier, automatically, to everyone who
signs up, and the only route to the paywall is through a feature that is currently broken.**

There is no configuration in which a normal user can pay you right now.

- The trial is granted server-side in Postgres, not as a StoreKit intro offer. All four
  products show **Trial Period: None**. Apple therefore never sees a trial, never runs a
  trial→paid conversion, and never charges anyone at the end of one.
- The paywall's main trigger is the Reveal, which dies between phases `zero` and
  `counting` (see tonight's briefing). `paywall_presented` last fired 8/30, once.
- **33 trials expire between Sep 1 and Sep 14** — 12 of them on Sep 11 alone. On expiry
  these users silently drop from Pro to free with no purchase prompt, having never been
  asked for money.

| Expires | Users |
|---|---|
| Sep 1 | 1 |
| Sep 3 | 4 |
| Sep 4 | 3 |
| Sep 9 | 2 |
| Sep 10 | 1 |
| **Sep 11** | **12** |
| Sep 12 | 3 |
| Sep 13 | 3 |
| Sep 14 | 4 |

## Fix list, in order

1. **Accept the updated Apple Developer Program License Agreement.** ASC is showing:
   *"the Account Holder must review and accept the updated agreement"* — this blocks
   submitting new builds and updates. Nothing else on this list can ship until it's done.
   Minutes of work, and it is currently the hard gate.
2. **Decide what the trial is.** Today it is a silent gift of the top tier. Either drop the
   auto-trial to `standard` and make `pro` require the paywall, or convert it to a real
   StoreKit introductory offer with a card on file. The growth plan's trial→paid maths
   (25.5% at ≤4d vs 42.5% at 17–32d) assumes the second; none of it can happen while the
   trial is a server-side gift Apple never sees.
3. **Fix the Reveal `zero → counting` break.** It is the only paywall trigger with volume.
4. **Add a paywall path that does not depend on the Reveal** — trial day 10/12/14, or
   completion of the Ten — so a second route to the ask exists.
5. **Tell the friends.** They are not subscribers, they were never charged, and they lose
   Pro when their trial ends. Better they hear it from you than from the app going quiet.

## Things this ruled out

- Money held or blocked by Apple: **no.** Paid Apps Agreement Active (Aug 5, 2026 – Aug 5,
  2027), bank account Active, W-9 Active.
- Broken products or unresolvable prices: **no.** All four Active in Superwall with prices
  resolving — $7.99 / $59 / $14.99 / $119. **The Standard-monthly blank-price bug is fixed**;
  this supersedes the note in `cinch-monetization-state`.
- A webhook silently dropping real purchases: **no.** The endpoint received and recorded a
  notification at 01:27 UTC today.

## Unread tonight

- **Supabase edge function logs** — `query_logs` returned "Backend error" on every attempt,
  so per-request webhook logs are unread, not clean. The DB tables cover the same ground
  (`superwall_events` is written before the plan decision), but a request that never
  arrived leaves no trace in either.
- `src/features/billing/plan-fold.ts:36` cites Superwall **project 28319**; the live
  application is **52618**. Almost certainly a stale comment — 69 users are flowing into
  52618, so the SDK key is pointed correctly — but worth correcting before it misleads.

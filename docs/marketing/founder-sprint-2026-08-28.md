# Founder sprint — Thu 2026-08-28

Three workstreams, one page each. Everything an agent could do is done (ratings
targets pulled from production, v1.2.1 staged and building, this plan). What
remains on each is marked **YOU**.

---

## 1 · Ratings before the Sep 1 featuring window (deadline: 4 days)

The app has **0 ratings**. The featuring window opens Monday. The in-app ask
(shipped 8/25) fires only after a settled wear — too slow. Personal asks are
the whole play.

**The link to send** (opens the App Store review sheet directly):

```
https://apps.apple.com/app/id6798479578?action=write-review
```

**YOU — send five texts today.** Targets, warmest first, with a draft each.
Rewrite in your own voice; the shape that works is one specific sentence about
*their* closet, then the ask, then the link.

| Who | Why them | Draft |
|---|---|---|
| **Ava** (avasaenz06@gmail.com, 21 pieces, finished the Reveal) | Family; the app told her her closet makes 50+ outfits | "You've got the biggest closet on Cinch — 21 pieces. Would you leave it a rating? Takes 20 seconds and it decides whether Apple features us Monday. [link]" |
| **Jay** (jaysaenz99@yahoo.com, 12 pieces) | Family, early adopter (8/13) | "Cinch is up for Apple featuring Monday and ratings are what they look at. You were one of the first ten people on it — 20-second rating? [link]" |
| **Omar** (omaramara1905@icloud.com, 19 pieces, finished the Reveal 8/21) | Most engaged non-family user | "You ran the whole first-ten flow start to finish — that makes you one of about three people who've seen the best part. A rating would genuinely change what happens Monday. [link]" |
| **Aysha** (aysha2006192@gmail.com, 17 pieces) | Engaged, but her pieces are stuck untagged (she never saw the consent ask — our bug, fixed yesterday) | "Heads up — your Cinch closet got stuck half-read because of a bug on our side. Fixed now: update the app, open it, and turn on AI tagging when it asks. And if it works — a rating would mean a lot. [link]" |
| **Sadie** (sadielemkau@icloud.com, 9 pieces) | Real outside user | "You're one of the first people ever on Cinch. Apple looks at ratings when they pick apps to feature, and we have almost none — 20 seconds? [link]" |

Also: **Karen** (signed up 8/25, no items yet) can rate without a closet —
a sixth easy ask.

Do **not** rate it yourself from your own developer account.

---

## 2 · ASO rename — status: executing, one approval left

Decided 8/10 in `docs/app-store-listing.md`, unshipped since. Name and
subtitle are version-scoped, so the rename needed a new version and a new
build. All in motion as of this morning:

| Step | State |
|---|---|
| v1.2.1 version bump + fingerprint re-take (runtime `813c6d34`) | committed, pushed (`215a132`…`ba5bda1`) |
| EAS build 45 | building (EAS `068054d7`), auto-submits to ASC |
| ASC version 1.2.1 created | done (`2421dbb5`) |
| **App name → `Cinch: Outfit Planner & Closet`** | staged on the editable app info — goes live when 1.2.1 releases |
| Subtitle | already correct in ASC (`Capsule Wardrobe, Packing List`) |
| Keywords (100/100 chars) + What's New | staged on 1.2.1 |
| Attach build 45 + submit for review (auto-release) | scripted, runs when Apple finishes processing the build |
| Post-release OTA for the new runtime | owed after 1.2.1 ships — new runtime `813c6d34` starts from its embedded bundle |

**YOU:** nothing, unless the review submission needs a human answer (App Review
messages land in your ASC inbox/email). 1.2.1 also carries everything since
build 44: the consent gate, the unread-zero Reveal, the boot-crash fix, the
rating ask, and the lifestyle/style-goals profile work found in the tree
(its migration was already live in production; it ships with this train).

---

## 3 · Week-4 gate (~Sep 7) and the IG sprint

**Where it stands:** the gate needs one post >10K views **and** ≥20 ASC
referrals. Best post: 41 views. Referrals: 3 lifetime. The gate will not pass
on trajectory — but the agreed criteria (`content-operating-system.md` §9) say
a week-4 miss means *"formats are wrong, rewrite them"*, *not* kill. Kill is
week 12. The honest diagnosis is different from either: **the plan was
28 posts/week and the actual output was ~1/week — the test has not been run.**
"Commit to 12 weeks or don't start" was the deal.

**The decision (YOU, this week — it is binary):**

- **A — Run the test for real.** One 2-hour capture session (below), then the
  7-post IG week (below), IG-first per the 8/26 resource call (only channel
  that has ever moved: 2→5 followers). Hold the $3K until a format shows a
  signal, per plan.
- **B — Concede organic won't be run** (honest if the hours don't exist), skip
  to the week-12 fallback now: put the $3K into Apple Search Ads on the *new*
  listing title once 1.2.1 is live, and measure install→trial→paid directly.
  Paid on a 0%-converting funnel was the reason to hold — but the funnel's
  blocking defect (the Reveal) shipped fixed yesterday, so this is no longer
  incoherent, just earlier than planned.

Choosing neither is the only wrong option; it re-runs weeks 1–3.

### If A — the capture session (2 hrs, once, reused all quarter)

Nine clips, your phone, real closet, clean status bar, 1080×1920:
The Ten (4× speed) · The Reveal · Today · Closet scroll · Cost-per-wear ·
Occasion end-to-end · Packing · Borrow request · Stylist answer.

### If A — the 7-post IG week (formats from the content OS, ready to shoot)

| Day | Format | Hook (first line on screen) | Build |
|---|---|---|---|
| Fri | The math | "Ten pieces. Watch the number." | The Ten at 4× → the Reveal count-up. Cut at the number settling. |
| Sat | The specific number | "I photographed my whole closet. I actually wear 31 things." | Closet scroll + cost-per-wear stat cards. |
| Sun | The comment magnet | "Is re-wearing an outfit twice in one week actually bad?" | Today screen cycling three looks from the same pieces. Ask in caption. |
| Mon | The straight demo | "This app tells me what to wear before I'm out of bed." | 15s: open → weather line → Wear this. |
| Tue | Cost-per-wear | "This $340 coat has cost me $170 per wear." | CPW screen on the worst offender in the closet. |
| Wed | The comparison | "Everyone said use Whering. This screen is why I didn't." | The Reveal vs. a plain grid; no disparagement, one screen. |
| Thu | The math (repeat winner slot) | "Two more pieces and this page fills up." | The zero→count repair loop — the honest-zero copy IS the hook. |

Captions: one sentence, one question, `#capsulewardrobe #outfitplanner
#digitalcloset #whattowear #ootd` (rotate 3–5, never more). Post at 11am or
7pm ET. Friday: read the numbers, keep the best format, cut the worst.

**YOU:** the A/B call, and if A: the capture session + posting (or hand both
to the $450/mo editor the content OS already budgets — the VA listing offer in
§10 still stands).

---

## Passive watch (no action)

First consent-gated onboarding already happened in the wild this morning:
gracie.kirk03@gmail.com signed up 8/28, answered the sheet (v2), both items
tagged immediately. The zero-path defect did not recur.

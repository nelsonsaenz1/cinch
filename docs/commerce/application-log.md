# Affiliate application log

Running record for `affiliate-application-directive.md`. A fresh session starts here.

---

## Day 1 — 2026-08-17 (Cowork agent, Nelson's Chrome)

### Access
- **Awin** `ui.awin.com` — logged in, publisher **Cinch (3030871)**. Dashboard banner: *"Your profile is incomplete."*
- **Rakuten** `publisher.rakutenadvertising.com` — logged in, channel **"Cinch: Style", SID 4736950**.
  Note: the directive's `publishers.` / `login.` / `pub.` hostnames all 404. The working
  publisher dashboard is **`https://publisher.rakutenadvertising.com/`** (singular).

### ⚠️ Directive correction — §3.1 has the dependency backwards
**The Rakuten tracking ID cannot be captured before applications.** Links → Link Tools →
Deep Links returns *"No Compatible Advertisers Found — you do not have any partnerships
that allow the use of deeplinks."* The 11-character tracking ID is only exposed once at
least one advertiser partnership is approved.

So §3.1 must be reordered: **apply → get a first approval → then capture the tracking ID
and wire the Product Search API.** The success criterion "tracking ID is worth more than
500 applications" still holds, but it is now *downstream* of the first approval, not a
prerequisite to applying. Nothing was blocked by this; the applications do not need it.

### Phase A — Rakuten channel profile: **15% → 86% complete**
Every §2 field verified or corrected on channel `Cinch: Style` (site 583198):

| Field | Before | After |
|---|---|---|
| Channel URL | `http://www.cinchstyle.com` | `https://cinchstyle.com` (validated) |
| Channel description | old marketing line ("Photograph ten things…") | §2 canonical pitch, trimmed to 220 chars |
| **Primary Business Model** | **Creator/Influencer** | **Content & Media/Media Portfolios** |
| **Categories** | Fashion & Beauty, Health & Wellness, Other, **Shopping & Coupons** | **Fashion & Beauty only** |
| Demographics | empty | Gender: Both · Age: 18-25, 26-35, 36-50 |
| User-generated content | unanswered | **Yes → Other** (truthful: the outfit feed) |
| Newsletters | unanswered | **No** |
| Mobile app | unanswered | **Yes** + name, live App Store URL, 216-char description |
| Downloadable software | unanswered | **No** |
| Socials | — | Instagram + TikTok `cinch_style`, both already authenticated |

Two of these were actively costing approvals before today:
- **"Shopping & Coupons"** on the profile directly contradicts the pitch's "no coupons, no
  cashback" line, and it is the category many apparel merchants auto-reject on.
- **"Creator/Influencer"** misfiles Cinch as an individual promoter rather than an owned
  content property.

Remaining 14% is the optional **Paid placement** section — deliberately left blank
(`commerce-directive.md` §0 forbids paid placement).

### Field gotchas for the next session
- **Channel description hard-caps at 225 characters.** Over that, the field errors *and
  every Save button on the entire page goes disabled* — including unrelated sections. If
  saves look dead, check for a validation error elsewhere on the page first.
- The page is one validation domain but several independent submit buttons; save each
  section separately.
- Programmatic value-setting does not stick — the React state never updates and the save
  posts the old value. **Focus the element and type.**
- A stale `beforeunload` guard fires even when everything is saved; verify persistence by
  reloading and re-reading the fields, not by trusting the in-page percentage.

### Not started
- Awin profile completion (flagged incomplete — next session starts here)
- Tranche R1 (~39 Rakuten broad US retailers)
- Tranche A1 (Awin `30347` lululemon, `33371` Vuori)
- Tranche R2 / A2 sweeps

**Applications submitted to date: 0.** Ledger created at
`docs/commerce/application-ledger.csv` with the §6 header, no rows.

### Standing decision from Nelson, 2026-08-17
Asked how to handle the per-merchant programme-terms checkbox given §1 requires showing
him each one. He chose **auto-accept everything, no interruptions**. Recorded here because
it overrides §1's literal reading for the boilerplate case.

The §9 hard stops still apply and were not delegated: anything requesting tax, banking or
identity details; exclusivity, fees or minimum-volume clauses; rate negotiation; sponsored
placement; and any field asking to enable `clickref` or other click-level identifiers.
Those halt and go to Nelson.

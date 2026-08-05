# App Store Connect — listing copy and submission answers

Everything App Store Connect asks for, drafted and within Apple's character
limits. Paste as-is; the limits are noted so edits stay legal.

---

## Identity

| Field | Value | Limit |
|---|---|---|
| App Name | `Cinch: AI Closet & Stylist` | 30 (uses 26) |
| Subtitle | `Outfits from clothes you own` | 30 (uses 28) |
| Bundle ID | `com.nelsonsaenz.cinch` | — |
| SKU | `cinch-ios-001` | — |
| Primary category | Lifestyle | — |
| Secondary category | Shopping | — |
| Price | Free | — |

**Why Lifestyle and not Shopping as primary:** the app does not sell anything at
launch. Listing a non-commerce app under Shopping invites a reviewer to look for
a store that is not there.

---

## Keywords

```
wardrobe,outfit,ootd,capsule,fashion,packing,clothes,organizer,weather,daily,mix,match,digital
```

93 of 100 characters. Deliberately excludes "closet", "stylist" and "AI" —
those already appear in the app name and subtitle, which Apple indexes
separately, so repeating them wastes the budget.

---

## Promotional text

*170 characters. Editable any time without a new build — use it for seasonal
messaging.*

```
Photograph what you own. Cinch builds outfits that suit the weather, your plans, and the way you actually dress — and learns your taste every time you react.
```

---

## Description

*4,000 character limit. This draft is ~1,750.*

```
Cinch turns the clothes you already own into outfits worth wearing.

Photograph each piece and Cinch identifies it — what it is, its colours, how formal it is, how warm it is. That becomes your digital closet. From there it does the part that is actually hard: working out what goes with what.

BUILT ONLY FROM WHAT YOU OWN
Every suggestion is assembled from your real wardrobe. Nothing is imagined, nothing is a catalogue photo, and nothing is a piece you would have to go and buy first.

IT UNDERSTANDS A WHOLE DAY
A client dinner at seven and drinks at ten are not the same dress code. Cinch finds the one outfit that carries you through both — and tells you the single piece to lose on the way. Type "dinner then drinks after" and it works it out, or connect your calendar and it reads the day for you.

DRESSED FOR THE ACTUAL WEATHER
Cinch uses the apparent temperature where you are, not just the forecast high. It knows a light jacket is not enough at four degrees in a strong wind, and it will not put suede shoes on you in the rain.

REAL COLOUR SENSE
Cinch judges colour the way a stylist does. It knows navy and camel work, that charcoal next to navy looks like a mistake rather than a choice, and that two loud colours need a third piece to calm them down.

IT LEARNS YOU
Like an outfit, skip it, or say why it is wrong — too formal, not your colours, worn too recently. Cinch adjusts from the very first reaction, and shows you in plain English what it thinks it has learned, so you can tell it when it is wrong.

PACK WITHOUT OVERPACKING
Tell Cinch where you are going and for how long. It reads the forecast at your destination and works out the smallest set of clothes that still gives you a different outfit every day — from what you already own.

ASK IT ANYTHING
"Dinner at 7, drinks after?" "What am I missing?" The stylist answers using only your real clothes, and tells you honestly when you do not own the right thing rather than inventing something.

WORKS WITHOUT SIGNAL
Outfit building runs entirely on your iPhone. On a plane, in a basement, or with no bars at all, Cinch still dresses you from the closet it has already downloaded. Naming and rewriting outfits is the only part that waits for a connection.

PRIVATE BY DEFAULT
Cinch never reads your photo library — iOS hands it only the pictures you tap. Your closet is private to your account. There is no advertising and no tracking across other apps. You can delete your account, and everything in it, from inside the app.
```

---

## What's New (version 1.0)

```
First release.
```

---

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy` |
| Support URL | `https://cinch-nelsonsaenz1-3579s-projects.vercel.app/support` |
| Marketing URL | `https://cinch-nelsonsaenz1-3579s-projects.vercel.app` |

All three are live and reachable without a login — Vercel's deployment
protection was on by default and returned 302 to everything, including to
Apple's reviewers.

---

## Age rating

Answer **None** to every content question. Result: **4+**.

One that is easy to get wrong: the questionnaire asks about *unrestricted web
access*. Cinch opens only two fixed URLs (its own privacy and support pages) via
`Linking.openURL`, and has no in-app browser, so the answer is **No**.

---

## App privacy (must match `app.config.ts` exactly)

Apple cross-checks these answers against the compiled `PrivacyInfo.xcprivacy`.
A mismatch is a review hold, so the two must be filled in from the same list.

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Photos or Videos | Yes | Yes | No | App Functionality, Product Personalization |
| Other User Content | Yes | Yes | No | App Functionality, Product Personalization |
| Coarse Location | Yes | **No** | No | App Functionality |
| Email Address | Yes | Yes | No | App Functionality |
| Name | Yes | Yes | No | App Functionality |
| User ID | Yes | Yes | No | App Functionality |

"Other User Content" covers the free-text plans and calendar event titles that
go to the model. It is the easiest one to forget, because it is not a field
users think of as content.

Answer **No** to "Do you or your third-party partners use data for tracking?"

---

## Export compliance

The app uses only HTTPS. Answer:

- Uses encryption: **Yes**
- Qualifies for exemption: **Yes** — standard encryption only, via the operating system
- Result: no CCATS filing, no annual self-classification report

Set `ITSAppUsesNonExemptEncryption: false` in `app.config.ts` to stop App Store
Connect asking on every single upload.

---

## Notes for App Review

```
SIGNING IN
Sign in with Apple, or with any email address. Please use any Apple ID — no demo
account is needed and no invite code is required. The email option sends a
sign-in link that opens the app back up via the cinch:// scheme.

IMPORTANT — SEEDING A CLOSET
Cinch styles you from clothes you own, so a brand-new account starts empty and
the Today tab will say it needs about ten pieces before it can build outfits.

To see the app working end to end, tap "Add clothes" on the Today tab and select
any 10-12 photos of clothing from the simulator or device library. Tagging takes
a few seconds per item. Once tagged, the Today tab shows three complete outfits
with reasoning.

If it is easier, a pre-populated demo account is available on request — contact
nelsonsaenz1@yahoo.com and we will provide credentials within a few hours.

PERMISSIONS
Location and Calendar are both optional and the app is fully functional without
either. Declining location falls back to a default city, which the app states on
screen. Camera is used only to photograph garments.

AI PROCESSING
Garment photos are sent to OpenRouter for identification. The user is asked to
consent in-app before the first image is ever sent (Guideline 5.1.2(i)), and the
consent sheet names the processor and the data categories.

ACCOUNT DELETION
Profile tab, bottom of the screen, "Delete account". Deletion is immediate and
removes all uploaded photos and data.
```

---

## Screenshots

Required for **6.9"** (1320 × 2868) and **6.5"** (1242 × 2688). Up to 10 each;
3–5 is plenty.

Planned set, in order:

1. **Today** — three outfits, weather strip, real garment collage
2. **Multi-event** — the swap note visible: *"At 22:00, drop the camel merino sweater"*
3. **Closet** — the grid full of cutouts
4. **Review deck** — a garment mid-swipe with AI tags
5. **Stylist** — a chat turn with recommended outfits inline
6. **Plan** — the packing list, "5 pieces covers 5 days"

**Blocked until the app runs on a device.** Screenshot 3 in particular needs
real background-removed cutouts, which require the native Vision module and
cannot be produced in the Simulator (OUT-9).

---

## Submission checklist

- [x] Privacy policy URL, live and public
- [x] Support URL, live and public
- [x] In-app account deletion (Guideline 5.1.1(v))
- [x] AI processing consent (Guideline 5.1.2(i))
- [x] Hand-written purpose strings for camera, location, calendar
- [x] Privacy manifest with real collected-data types
- [x] `eas.json` build profiles
- [x] `ITSAppUsesNonExemptEncryption: false`
- [ ] Apple Developer Program enrollment ($99/yr)
- [ ] Apple Team ID → `eas.json`
- [ ] App Store Connect app record + `ascAppId` → `eas.json`
- [ ] App icon at 1024×1024, no alpha channel
- [ ] Screenshots
- [ ] A real device test pass

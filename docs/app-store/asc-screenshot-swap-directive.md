# Directive — Claude Cowork: replace the App Store screenshots and submit

**Written 2026-08-18. For Claude Cowork operating a browser against App Store
Connect. The founder will not be available mid-task: read this whole document
before the first click, then finish without asking him anything that this
document already answers.**

**App:** Cinch · ASC app id `6798479578` · bundle `com.nelsonsaenz.cinch` · team `THR27ADF4P`
**ASC URL:** https://appstoreconnect.apple.com/apps/6798479578/distribution

---

## 0 · What is true when you start

- **Version 1.1.0, build 41** was submitted to App Review on **2026-08-18**
  (EAS submission `0a229e4b-152c-436b-a9c6-449da3fc5fc2`). Depending on when
  you run, the version is `Waiting for Review`, `In Review`, `Accepted`, or
  already `Ready for Distribution`. **Your first job is to find out which** —
  the whole path branches on it (§2).
- The screenshots currently in ASC show the **old design**. The app was fully
  redesigned in August 2026; the live set no longer looks like the product.
  That is the defect you are here to fix.
- The founder will hand you a folder of finished PNGs (he will say where —
  typically `~/Downloads`). The files are named in display order:
  `01-*.png`, `02-*.png`, … Their content was produced by Claude Design from
  `docs/app-store/screenshot-design-directive-v3.md`; you do not judge or edit
  the images, you ship them.

### Preconditions — check before anything else, stop if one fails

1. **You are signed in to App Store Connect** in the browser you control, as
   the account that owns team `THR27ADF4P`. If you land on a sign-in page,
   STOP and tell the founder to sign in (and complete 2FA) himself, then
   resume. **Never type an Apple ID password or a 2FA code yourself, even if
   given one.**
2. The PNG folder exists and contains at least 5 and at most 10 images per
   size class, and you can read the pixel dimensions of each (Finder's
   Get Info, or the upload dialog will tell you by rejecting them).

### Accepted pixel sizes (portrait)

| Slot in ASC | Accepted dimensions |
|---|---|
| iPhone 6.9" Display | `1290 × 2796` or `1320 × 2868` |
| iPhone 6.5" Display | `1242 × 2688` or `1284 × 2778` |

Since 2025 Apple requires only the largest iPhone size and derives the rest,
but if the founder's folder contains a 6.5" set as well, upload it — a real
render beats Apple's downscale. **If an image is any other size, do not
resize it yourself in some browser tool — report the exact filename and its
dimensions back to the founder and continue with the ones that fit.**

---

## 1 · What you will NOT touch

Screenshots and (if provided in the folder as a `whats-new.txt`) the What's
New text. Nothing else. Explicitly out of bounds, no matter what you see:

- App name, subtitle, keywords, description, promotional text
  (they are managed from `docs/app-store-listing.md`, by a different process).
- Pricing, in-app purchases, subscriptions.
- App icon, age rating, review notes, contact info.
- TestFlight, users, agreements, banking.

If a dialog asks you to accept a **new Apple developer agreement / terms**,
STOP and report — that acceptance is the founder's alone.

---

## 2 · Find the version state, then take the matching path

My Apps → Cinch → **App Store** tab. Look at the version list on the left.

### Path A — version 1.1.0 shows `Prepare for Submission` or `Rejected`
The metadata is editable. Go straight to §3, replace the screenshots on
**this** version, then §4 submit.

### Path B — version 1.1.0 shows `Waiting for Review`
Metadata is locked while queued, and the queue position is worth little.
1. Open the version page, find the **"Remove from Review"** control
   (sometimes under the ⋯ / "Cancel Submission" in the newer submission UI).
2. Confirm. State returns to an editable one (`Prepare for Submission` /
   `Developer Rejected` — both fine).
3. Verify **build 41** is still attached to the version. If removing from
   review detached it, re-attach: version page → Build section → ＋ →
   select **1.1.0 (41)**.
4. Continue to §3, then §4 re-submit. The round trip costs queue time only;
   nothing else is lost.

### Path C — version 1.1.0 shows `In Review`
Do NOT interrupt an active review. STOP, report the state, and tell the
founder: "the review is running; the moment it lands (Accepted or Rejected) I
can swap the screenshots — Accepted means I'll ship them with a metadata-only
update on a new version." Then, if he is unavailable, check back hourly and
proceed by Path D (if it accepts) or Path A (if rejected).

### Path D — version 1.1.0 is `Accepted` / `Ready for Distribution` / released
Screenshots can no longer change on a released version, but a **new version
with no new build** carries them:
1. Version list → ＋ ("New version"). Version number: `1.1.1`.
2. What's New: use `whats-new.txt` from the founder's folder if present,
   otherwise: `Design refinements throughout the app.`
3. Attach the **existing build 41** (a metadata-ish version still needs a
   build attached; reusing 41 is allowed as long as it has not been released
   under a previous version — if ASC refuses every available build, STOP and
   report, because that means a new binary is needed and only the repo-side
   session can build one).
4. Continue to §3, then §4.

---

## 3 · Replace the screenshots

On the editable version page, **App Previews and Screenshots** section:

1. Select the **iPhone 6.9" Display** tab.
2. **Delete every existing screenshot** in that slot first (hover → ⋯ →
   Delete, or select-all → Delete All). A mixed old/new gallery is worse than
   either set alone.
3. Upload the new PNGs **in filename order** — `01` first. Drag all at once;
   ASC preserves file order poorly when dragged in bulk, so **verify the
   order after upload** and drag-reorder the thumbnails until they match the
   filename sequence exactly.
4. If the folder has a 6.5"-sized set, repeat 1–3 on the **iPhone 6.5"
   Display** tab. If not, leave whatever ASC shows there (it derives from
   the 6.9" set).
5. **iPad tabs: do not touch.** Cinch ships to iPhone; if ASC demands iPad
   screenshots at submit time, STOP and report rather than uploading
   stretched iPhone images.
6. **Save** (top right). ASC silently discards unsaved uploads on
   navigation — save before leaving the page, and re-open the page once to
   confirm the set survived.

---

## 4 · Submit, verify, report

1. On the version page press **Add for Review** / **Submit for Review**
   (wording varies by ASC's current UI). Answer only what the form asks;
   advertising-identifier (IDFA) answer is **No** unless the form pre-filled
   otherwise from the previous submission — do not change a pre-filled answer.
2. Confirm the final state reads **Waiting for Review**.
3. Report back to the founder, in one message: which path (A–D) you took,
   how many screenshots landed in each size slot, the version and build
   submitted, the final state, and a screenshot of the version page as proof.

**Done means: the new images are saved on the submitted version and the
version says Waiting for Review.** Anything less, say exactly which step
stopped you and what the screen said.

---

## 5 · Known traps

- ASC's session expires ~30 min idle. If you get bounced to sign-in
  mid-task, your saved work survives; stop and have the founder sign in again.
- The upload spinner can sit for minutes on 8MB PNGs. Wait; do not re-drag
  the same file, or you will get duplicates to clean up.
- "Add for Review" hides when a required field is missing — the page shows a
  red badge naming the section. Screenshots you just replaced are usually
  not it; look for it before assuming the button is broken.
- Do not edit anything under **In-App Purchases and Subscriptions** on the
  version page, but if the section lists the four `cinch.*` subscriptions,
  leave them listed — removing them would unship the paywall's products.

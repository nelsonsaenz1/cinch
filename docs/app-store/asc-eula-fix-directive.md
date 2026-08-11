# Directive — clear the EULA-link rejection

**Owner:** the App Store Connect agent. **App:** Cinch, ASC id `6798479578`.
**Urgency:** this is the only thing between us and review. It is a metadata
edit — **no new build, no code change, no re-upload.**

---

## 1 · What Apple said

> The submission offers auto-renewable subscriptions but does not include a
> functional link to the Terms of Use (EULA) in the app's metadata.

Guideline 3.1.2. Apple requires, for auto-renewing subscriptions, functional
links to **both** the Terms of Use and the Privacy Policy in the app's
metadata — and App Store Connect has a dedicated field for the privacy policy
but **none for the Terms of Use**. It therefore has to live in the App
Description. That is the entire defect.

Note the wording of the rejection: *"This is an automated message. The review
of this submission cannot proceed."* This was a pre-review gate. **No human
opened the app.** Nothing else was assessed, so nothing else was cleared.

## 2 · What is already correct — do not re-fix these

- `https://cinchstyle.com/terms` is live (HTTP 200) and, as of 2026-08-10,
  contains the subscription terms Apple requires behind that link: price,
  auto-renewal, the 24-hour cancellation window, how to cancel via Apple ID,
  and the refund route. It was added hours before the rejection; before that
  the page had no billing section at all.
- `https://cinchstyle.com/privacy` is live and the Privacy Policy URL field in
  ASC is already populated.
- The **in-app** half of 3.1.2 already passes: the Superwall paywall's footer
  has working Terms and Privacy links pointing at those same two URLs, plus a
  Restore control. Verified in the paywall document. Do not change the paywall.

## 3 · The change

The App Description was **3991 characters against a 4000 limit** — nine
characters of headroom, not enough for the link. The text below is the
corrected description at **3998 characters**: six sentences reworded to be
shorter, and the Terms line appended. **No claim, feature or promise was
removed.** The trims were:

| Was | Now |
|---|---|
| That is all Cinch needs before it can dress you. | That is all Cinch needs to dress you. |
| You don't have to photograph your whole wardrobe first. | You needn't photograph your whole wardrobe first. |
| Dinner at seven and drinks at ten are not the same dress code. | ...aren't the same dress code. |
| There is no advertising and no tracking across other apps. | No advertising, and no tracking across other apps. |
| You can delete your account, and everything in it, from inside the app. | ...in it, in the app. |
| Not a score, not a percentage — a sentence. | Not a score or a percentage — a sentence. |

### Steps

1. App Store Connect → Cinch → the **1.0** version.
2. It is in **Rejected** state, which locks metadata. Return it to editable
   first — usually a "Remove this version from review" / "Prepare for
   Submission" action. **This is the step that blocked automation:**
   `eas metadata:push` reported *"Store configuration is synced"* and silently
   did not apply the description, because the version was locked. Do not trust
   a tool's success message here; re-read the field after saving.
3. Replace the **Description** field, in full, with the text in §4.
4. Save. Re-open the field and confirm the last line is the Terms line and the
   character count is 3998.
5. Resubmit the same build. **Do not upload a new binary** — see §5.

## 4 · The description, verbatim

Paste everything between the markers, and nothing else.

<<<BEGIN DESCRIPTION>>>
Ten pieces. That is all Cinch needs to dress you.

Photograph ten things you already own — three tops, two bottoms, a dress, two pairs of shoes, a coat and a bag. Don't wear dresses? Say so, and that position becomes another top or bottom. Cinch identifies each piece: what it is, its colours, how formal it is, how warm it is.

Then it does the arithmetic: tops times bottoms times shoes, plus dresses times shoes. It counts what your ten actually make, shows you the number, and dresses you in the first one.

You needn't photograph your whole wardrobe first. Ten pieces is a wardrobe, and the ten-piece closet is free.

BUILT ONLY FROM WHAT YOU OWN
Every outfit is assembled from garments in your own closet. Cinch never invents a piece, and never suggests one you would have to go and buy — there is no shop in it. A garment's picture is your photograph, or, if you chose it, the retailer's own shot of a piece you told Cinch you own.

THE MATHS RUNS ON YOUR PHONE
Outfits are assembled and scored on your iPhone, in milliseconds, from your real garments — which is why Cinch still dresses you on a plane, or with no bars at all. Colour is judged in OKLCH, a perceptual colour space. Hue distance, chroma and lightness contrast are what decide that navy and camel work. Colour carries more weight than any other rule.

A language model never sees your closet. It sees a shortlist of a dozen outfits the maths already built, re-ranks them on your taste, and writes the sentence underneath.

EVERY OUTFIT COMES WITH ITS REASON
Not a score or a percentage — a sentence. Why this coat, on this day, over this knit.

DRESSED FOR THE ACTUAL WEATHER
Cinch uses the apparent temperature where you are, not the forecast high. It knows a light jacket is not enough at four degrees in a strong wind, and it will not put suede shoes on you in the rain.

IT UNDERSTANDS A WHOLE DAY
Dinner at seven and drinks at ten aren't the same dress code. Type "dinner then drinks after" and Cinch finds the one outfit that carries both — or connect your calendar and it reads the day for you.

IT LEARNS YOU
Like an outfit, skip it, or say why it is wrong — too formal, not your colours, worn too recently. Cinch adjusts from the first reaction, and shows you in plain English what it has learned.

PACK WITHOUT OVERPACKING
Tell Cinch where you are going and for how long. It reads the forecast there and works out the smallest set of clothes that still gives you a different outfit every day — and says so plainly when a day can't be filled.

ASK THE STYLIST ANYTHING
"Dinner at 7, drinks after?" "What am I missing?" It tells you when you don't own the right thing rather than inventing one.

STILL TORN? ASK YOUR FRIENDS
Post the dinner, the wedding, the trip. Invite the people going. Everyone shares a couple of options from their own closet, votes and comments, and each person walks in wearing the look their friends helped them choose. Nobody is ranked against anybody else.

BORROW FROM EACH OTHER
Browse a friend's closet, find the black clutch they never wear, and ask to borrow it. They lend it or say not this time — one tap either way, private between the two of you.

SEE YOUR OWN STORY
Cinch records every wear: your most-worn pieces, the ones sitting untouched, and what you spend per wear.

NOTHING VANISHES BY ACCIDENT
Taking a piece out of rotation is reversible: Storage keeps the photograph and every wear you logged, and you can bring it back. Removing one is separate and deliberate, and says so before it deletes anything.

PRIVATE BY DEFAULT
Cinch never reads your photo library — iOS hands it only the pictures you tap. Garment photos go to an AI partner to be identified, and — if you ask — to be matched against a product listing. Cinch asks before the first one is sent. Your closet stays private until you share it with a friend. No advertising, and no tracking across other apps. You can delete your account, and everything in it, in the app.

Terms of Use: https://cinchstyle.com/terms
<<<END DESCRIPTION>>>

## 5 · Hard limits on this task

- **Do not upload or select a different build.** The rejection is metadata
  only. Changing the binary restarts processing for no reason.
- **Do not touch the paywall, the IAP products, or their prices.** Standard
  $7.99/mo · $59/yr, Pro $14.99/mo · $119/yr. The description, the terms page
  and the review notes all quote these; changing one silently breaks three.
- **Do not add a custom EULA in App Information.** It is the tidier long-term
  answer and it gets its own review — introducing a new variable while
  unblocking a submission is how one rejection becomes two. Revisit after
  approval.
- **Do not edit any other metadata field**, including keywords, subtitle,
  promo text and screenshots. One change, one cause, one result.
- If ASC will not accept 3998 characters, report the exact error rather than
  improvising cuts. The copy is load-bearing and several sentences are
  claim-traced to shipped behaviour.

## 6 · Before you press resubmit — read this

Clearing this rejection does not return us to where we were. It moves the
build from an automated gate to a **human reviewer**, and the binary now in
ASC contains a voice-intake flow that has been verified at its first screen
and at its backend and **nowhere in between** — the recording screen, the
parse animation, the card procession and four failure branches have never been
watched running.

Fixing the description is safe and should be done now. **Whether to resubmit is
the founder's call**, and it should be made knowing that a Guideline 2.1
rejection for a feature that dead-ends costs more than this one did.

## 7 · Report back

State what you **verified**, not what you set: the character count after
saving, the last line of the field, and the version's state. If the field did
not take, say so — the last tool that touched this claimed success and had not
changed anything.

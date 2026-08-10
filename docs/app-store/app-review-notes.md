# App Review notes — Cinch 1.0

Paste the block under **THE BLOCK** into App Store Connect →
*[version] → App Review Information → Notes*. Everything outside that block is
for us, not for Apple.

The Demo Account fields (*Sign-in required* → username/password) must be left
**unchecked / empty**. Cinch has no password. Filling those boxes with anything
would hand the reviewer a credential that cannot work, and "the demo account
you supplied does not work" is its own rejection. The notes below tell them
what to do instead, which is what that field is for when an app has no
password-based login.

---

## THE BLOCK

```
HOW TO SIGN IN

Cinch has no passwords, so there is no demo account to supply.

Please tap "Continue with Apple" on the first screen and use your own
Apple ID. This creates a fresh, empty account instantly and needs no
email, no code, and no password. It is the fastest way in and it is a
normal, supported path for every user.

The other option is email: enter any address you can read, and a
six-digit code arrives in a few seconds. Both paths reach the same app.

WHAT TO DO FIRST

A brand-new account starts with an empty closet, so the app will look
sparse until it has some clothes in it. The first run walks you through
adding ten pieces.

You do NOT need to photograph real clothing. On the "add a piece"
screen you can:
  - pick any images from the simulator or device photo library, or
  - search for a garment by description and pick a picture from the web

Ten pieces is enough for Cinch to start building outfits. Once they are
in, open the Today tab and Cinch will put outfits together from them and
explain why each one works.

WHAT IS FREE AND WHAT IS PAID

The app is fully usable without paying. The free tier keeps ten pieces
in rotation, thirty stored, and a few outfits each week. Nothing is
locked behind a trial.

Subscriptions are auto-renewing, sold only through In-App Purchase, and
offered in two tiers, each monthly or annual:
  Standard  $7.99/month or $59/year
  Pro       $14.99/month or $119/year

The subscription screen appears in two places: after the first set of
outfits is revealed, and from Profile → Membership. It can be dismissed
and the app keeps working. Terms of Use and Privacy Policy links, and a
Restore Purchases control, are on that screen.

To reach it directly: Profile tab (bottom right) → Membership.

ACCOUNT DELETION

Profile → Delete account. This permanently deletes the account and all
of its data from our servers. It is not a deactivation.

ABOUT THE AI

Outfit suggestions, garment tagging and the written reason for each
outfit are produced by machine-learning models we call through a
third-party API provider. No account data is used to train anyone's
models. This is disclosed in the privacy policy at
https://cinchstyle.com/privacy.

SOCIAL FEATURES

Cinch has optional friend features — shared closets, comments and
borrowing. A new account has no friends and no shared content, so these
screens will be empty on review. Reporting and blocking are available
from any user's profile and from any comment.

CONTACT

hello@mail.cinchstyle.com — we will answer within a few hours if
anything blocks the review.
```

---

## Why each part is there

**Sign in with Apple, first.** Sign-in is a six-digit code emailed to the
address the user types. Supabase has no email test-OTP facility — only
`sms_test_otp`, and it is null — so there is no way to hand a reviewer a
fixed code. Apple sign-in is enabled server-side (`external_apple_enabled`)
and in paid-signing builds (`app.config.ts` `usesAppleSignIn`), so it is a
real path, and it is the only one that needs nothing from us. If a reviewer
tries the email field, waits for a code at an address they do not own, and
gives up, that is a Guideline 2.1 rejection for a fully working app.

**"You do not need to photograph real clothing."** The first run asks for ten
garments. A reviewer sitting at a desk with a simulator has no wardrobe to
photograph, and an app that appears to demand one before it does anything is
an app that looks broken. The camera-roll and web-search routes both exist;
this sentence is what stops the reviewer from concluding otherwise.

**The empty-closet warning.** Under ten pieces the outfit engine has nothing
to combine (`MIN_CLOSET_FOR_OUTFITS` is eight, and the product asks for ten).
A reviewer who opens Today first sees an empty state and may score the app as
incomplete. Naming it in advance costs one sentence.

**Prices spelled out.** Guideline 3.1.2 wants length, price and renewal
disclosed. They are on the paywall, but repeating them here means the
reviewer never has to hunt, and it lets them confirm the IAP products they
see in App Store Connect match what the app shows.

**"It can be dismissed and the app keeps working."** The paywall is
`non_gated` in Superwall. Reviewers routinely test whether a paywall traps
them; saying so up front pre-empts the question.

**Account deletion, with the path.** Guideline 5.1.1 requires in-app deletion
and reviewers look for it specifically. Three words save them the hunt.

**Empty social screens, explained.** Every friend surface is empty on a fresh
account. Unexplained empty screens read as unfinished features.

## Numbers to re-check before pasting

These came from `src/features/billing/plans.ts` on 2026-08-10. If the IAP
prices in App Store Connect differ from `$7.99 / $59 / $14.99 / $119`, the
block is wrong and must be corrected — a price mismatch between the notes,
the paywall and the store is worse than saying nothing.

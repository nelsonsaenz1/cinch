# Largest-Dynamic-Type walk — audit items 38–43, 55

**Run 2026-08-11** against a clean Metro session (cache cleared, dev client
bundling from `localhost:8081`, 3355 modules — *not* the OTA bundle), on
Cinch iPhone 17 Pro / iOS 26.5, at
`content_size accessibility-extra-extra-extra-large` (AX5, the maximum).

Screenshots referenced below were captured with `xcrun simctl io … screenshot`.

---

## Confirmed failure, fixed and re-verified

### The Today empty state's primary action was unreachable

`src/app/(tabs)/index.tsx` — the empty-closet branch's ScrollView carried
`contentContainerStyle={{ paddingBottom: 48 }}`. 48pt does not clear the
floating Liquid Glass tab bar, and the element it hid was the branch's
**primary action**: the "Add your clothes" button that an empty first-run
closet exists to offer.

| | Before | After |
| --- | --- | --- |
| AX5 | Button trapped behind the glass bar; label illegible, and inside the bar's touch area | Fully visible and clear of the bar |
| Default | Content does not scroll at all, so the button sat permanently in the occluded strip and **never appeared** | Visible |

The default-size case is the worse of the two and the one a normal QA pass
would miss: because the content fits without scrolling, there is no scroll to
reveal what is hidden. The button was simply absent from the screen.

Fixed by matching Closet's `paddingBottom: 96`, which is the value already
proven against this tab bar. Re-verified at AX5 after the change.

**Not a Dynamic-Type-only bug** — it was present at every text size. Large
type is what made it visible, which is the argument for doing this pass at
all.

---

## Retracted: the "header collides with the settings gear" finding

Plan's `11–17 AUG` eyebrow appeared to run underneath a round gear control at
the top right, on Plan and on Today. It does — but **the gear is
`expo-dev-client`'s floating dev-menu button, not app chrome.** Tapping it
opened the Expo dev menu ("Runtime version: 1.0.0 / Reload / Go home /
Tools"), which is what identified it.

It does not exist in a release build, and no app code was changed for it.

**Method note for the next person running this walk:** a development build
paints controls the shipped app does not have. Anything at the screen edges
must be attributed before it is treated as a defect — tap it and see what it
does. Fixing the app's header padding to accommodate a dev-only overlay would
have made the release build wrong to fit a debug artifact.

---

## What this walk could NOT cover, and why

**The signed-in simulator account has an empty closet.** Verified directly:

```sql
select count(*) from items where user_id = '195a2399-…';  -- no rows
```

So every data-bearing surface rendered its empty state, and the screens where
truncation actually bites were never exercised:

- the closet grid (garment names, wear counts, price, cost per wear)
- item detail (`item-stats.tsx`'s three-figure band — the case §2 of the
  type-weight spec specifically warns wraps first)
- the Today plate with a real outfit
- event cards, comment rows, friend rows, the diary

Closing that gap needs a populated account with real images, which is setup
work, not a code change. It should not be done by seeding production.

## The `numberOfLines={1}` audit

96 call sites; **76 render dynamic content** rather than a fixed literal. The
full list is reproducible with a scan for `numberOfLines={1}` plus the
interpolation on the following lines.

Almost all are names and titles in list rows — a garment name in a grid cell,
a friend's handle in a row, an event title on a card. Single-line truncation
with an ellipsis is correct there: the full value is one tap away on the
detail screen, and VoiceOver reads the whole string regardless of
`numberOfLines`, so nothing is hidden from assistive technology.

The sites worth a second look are the ones where truncation would hide a
**figure** rather than a name, because a truncated number is not obviously
truncated:

- `components/closet/item-card.tsx:224, :231, :235` — wear count, price, cost
  per wear
- `components/closet/rail-card.tsx:103` — cost per wear
- `components/closet/insight-card.tsx:42` — the worn/total line

**None of these were changed**, because none could be demonstrated on device
with an empty closet, and the brief for this pass is to fix only what is
objectively shown to fail. They are the first thing to check once a populated
account exists — or, better, to cover with the component snapshots of audit
items 49/50, which can feed a deliberately long name and a four-figure price
without needing a device at all. That is the cheaper and more repeatable
route, and it is why the two items belong together.

## Reproducing the setup

```bash
xcrun simctl ui <UDID> content_size accessibility-extra-extra-extra-large
xcrun simctl ui <UDID> content_size            # confirm
xcrun simctl openurl <UDID> "com.nelsonsaenz.cinch://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
xcrun simctl io <UDID> screenshot --type=png shot.png
```

Set the content size **before** launching. And check Metro's log for a
`Bundled … (N modules)` line — without it the dev client may have booted its
cached OTA bundle instead of your working tree, which is the trap that makes a
verification walk verify the wrong code.

---

## The data-bearing pass — closed, with a fixture

**Run 2026-08-11**, after the first walk found the account empty.

`src/app/dev-truncation.tsx` (`__DEV__`-only, at `/dev-truncation`) renders the
REAL ItemCard, ItemStats, RailCard and InsightCard — not copies — with the
widest honest values each can take: a four-figure coat, a four-digit wear
count, and the longest colour+subcategory pair a tagger can write. No
production data, no credentials, deterministic.

### Fixed

| Site | At AX5, before | After |
| --- | --- | --- |
| `item-card.tsx:224–235` — wears, price, cost per wear | The meta row grew **wider than the card**: the left card's meta collided with the right card's and ran off the screen edge | Contained; ellipsizes inside the tile |
| `item-stats.tsx` — the three-figure band | "$1,295.00" wrapped mid-number into "$1,295.0" over "0", pushing that cell's label out of line | One line, shrinking to 0.7 to hold the whole number |

`numberOfLines={1}` does nothing until something constrains the width — that is
the lesson. Each Text reported its full intrinsic width to the row, so the row
grew instead of the text ellipsizing. `shrink` is what constrains it.

### Clean at AX5

- `insight-card.tsx:42` — the "86%" figure is intact; only the sentence beside
  it ellipsizes, which is a sentence, not a figure.
- `rail-card.tsx:103` — cost per wear ellipsizes within its card.

### Open, and needing a design decision rather than a fix

Containing the ItemCard meta converts the overflow into truncated **figures** —
"1284…", "$1.01 /…" — and at AX5 even an ordinary "12 wears" is cut. A
truncated number does not look truncated: "1284…" could be 12,840.

`flex-wrap` on the row fixes it and was **backed out**: on the simulator it also
wrapped at the DEFAULT text size, changing the single-line meta the atlas draws
for every ordinary user. That is a design decision, not a defect fix. It needs
the founder's eye or an atlas — the options are stacking the two figures at
large sizes only, dropping the "/ wear" unit, or accepting the truncation.

## Audit item 50 — the matrix, and what is not yet true about it

`scripts/screenshot-matrix.mjs` captures four named screens × three device
widths at a chosen Dynamic Type size, against a committed-or-not baseline, with
an exact-hash diff.

**Proven:** 12/12 captures across narrow/standard/wide; the dev client copied
to the two simulators that lacked it so all three run the same binary; the
status bar frozen at 9:41 so runs are byte-comparable at all (without it every
screenshot differs on the clock and the diff is worthless); a clean run
reporting `12 unchanged, 0 changed` and exiting 0.

**NOT yet true:** the captures are of Superwall's "Test Mode Active" sheet, not
of the app. A dev build sets `testModeBehavior: 'always'`, and the sheet covers
every cold launch. The harness reported "12 unchanged" while having photographed
nothing — which is the most important thing this exercise found, and why the
warning now sits at the top of the script rather than in a doc.

Two smaller defects the same investigation exposed, both fixed:

- `cinch://plan` parses "plan" as the **host**, so expo-router never sees a
  path and the app stayed where it was. Two screens had identical hashes, which
  is what caught it. The links are `cinch:///plan` now.
- Nothing was comparable at all until the status bar was frozen.

**To finish it:** blank `EXPO_PUBLIC_SUPERWALL_API_KEY_IOS` in `.env`. Passing
it empty on the command line is not enough — Expo's dotenv load re-exports the
`.env` value over the inherited one. That is a change to a local developer
environment, so this session did not make it.

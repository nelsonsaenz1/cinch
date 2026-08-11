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

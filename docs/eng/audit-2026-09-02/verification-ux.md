# Verification — UX directive merge (bed2c47 → 1b85923)

Hostile falsification pass over the seven merged UX clusters (A, B, C, D1, D2, E, F)
plus the images commit. Brief: find what a green suite cannot see.

**Scope:** 8 merge commits (clusters A, B, C, D1, D2, E, F, G) plus the images commit,
every branch based at `bed2c47`, ~220 files. Cluster E (`18b259f`) landed mid-pass and is
included; the gates below were re-run after it.

## Gates — re-run at HEAD `1b85923`, real output

| gate | result |
| --- | --- |
| `npm run typecheck` | clean, exit 0 |
| `npm test` | **3872 tests · 3871 pass · 0 fail · 1 skipped** · 1.9 s · exit 0 |
| `npm run lint` | **0 errors, 0 warnings**, exit 0 |

The lint result is a genuine improvement, not a suppression: baseline was 6 warnings,
and `git diff bed2c47..HEAD` adds **no** `eslint-disable`, no `@ts-ignore`, no
`@ts-expect-error`, and no change to `eslint.config.js` / `tsconfig.json` /
`package.json`. `react-hooks/rules-of-hooks` and `exhaustive-deps` are on and clean,
so "a hook called conditionally" and "an effect whose deps changed meaning" are
mechanically excluded for the whole merge. A scripted scan of every changed
`src/` + `supabase/` file found **zero unused imports**. One type escape was added:
`name={glyph as never}` (`sheet-parts.tsx:7796` in diff) for `SymbolView`; all five
glyph names in `DOORS` are real SF Symbols, so it is latent rather than live.

---

# CONFIRMED

## UX-1 (S1) — a trialing account's Membership page shows a **downgrade** table headed "WHAT A MEMBERSHIP ADDS"

`src/components/membership/membership-body.tsx:317-327` and
`src/components/membership/upgrade-body.tsx:175-185`

Both pages build the comparison as:

```
(['standard','pro'] as const)
  .filter((tier) => tier !== plan)          // membership-body; upgrade-body uses surface.plan
  .map((tier) => <DeltaTable rows={planDelta(plan, tier)} … />)
```

`usePlan()` folds a live trial on a **free** row up to `pro`
(`src/features/billing/use-plan.ts:197`), and `membershipSurface()` deliberately
preserves that — `surface.plan === 'pro'` for a trialing account, asserted at
`tests/membership-surface.test.ts:113-115`. So for the 31 trialing accounts the
filter removes the **Pro** plate and renders exactly one table:
`planDelta('pro','standard')`.

Executed (scratchpad harness over the real `PLANS`):

```
KICKER: WHAT A MEMBERSHIP ADDS · STANDARD
  Active pieces    1,000 → 150     VoiceOver: "Active pieces. Now 1,000. On Standard, 150."
  Stored pieces    3,000 → 450
  Outfits          Unlimited → A fresh outfit every day
  Stylist          Unlimited → 5 chats a month
  Packing memos    Included → Not included
```

Every row is a **loss**, drawn with `row.to` in the oxblood accent
(`membership-parts.tsx:324-326`), under a kicker that promises an addition. The one
tier a trialing account might actually buy — Pro — is filtered out and never shown.

**Scenario:** any of the 31 gifted trials (A27, ending 2026-09-03 14:00Z) opens
Settings → Membership, or Profile → Membership → the upgrade route, today.

**Why the suite cannot see it:** `tests/membership-surface.test.ts:273-289` exercises
`planDelta('free', …)` and `planDelta('pro','pro')` only. The `TRIALING` fixture
(`:60-65`) exists and correctly asserts `surface.plan === 'pro'`, but no test feeds
that value into the page's tier filter. The resolver is right; the two call sites use
the wrong tier as the "from".

**Shape of the fix (not applied):** the comparison's "from" tier is the tier the
account *owns*, which for `kind === 'trialing'` is `free`, not `surface.plan`.

## UX-2 (S1) — Today's membership row tells a **paying** member their trial is ending

`src/features/billing/upsell-bubble.ts:116` · `src/components/today/upsell-bubble.tsx:137`
· call site `src/app/(tabs)/index.tsx:2217-2223`

Both the copy resolver and the component derive "already paying" as
`plan !== 'free' && !trialing`. Cluster A added `PlanState.paid`
(`use-plan.ts:203`) precisely because that expression is wrong for a paid row that
still carries a future `trial_ends_at`, and `tests/membership-surface.test.ts:135-142`
pins the corrected rule ("a paid row with a stale trial date is paying, not trialing").
The Today row never received it — `UpsellBubbleInput` (`upsell-bubble.ts:96-103`) has
no `paid` field, and `index.tsx` passes `planState.plan` / `planState.trialing` only.

Consequence for `plan='pro'|'standard'`, `paid=true`, `trialing=true`:
`upsellBubbleFor` skips the paying branch (because `trialing`), falls into the trial
branch, and returns

> **"N days left in your trial"** — "After it, the closet styles from 10 active pieces
> and the stylist and trip packing pause. Nothing you have added goes anywhere."

`UpsellRow`'s own guard `paying = plan !== 'free' && !trialing` (`:137`) is the same
broken expression, so it does not suppress it either. The component's docblock says
this is the one state it must not reach: *"leaving an upgrade offer over a receipt is
the one state this must not reach."*

**Scenario:** a gifted-trial account that **converts today**. From the moment the
purchase lands until 2026-09-03 14:00Z, every Today open shows a paying member a
notice that their access is about to be reduced. That is the exact cohort the A27
conversion is aimed at.

**Why the suite cannot see it:** the input type has no `paid`, so
`tests/upsell-bubble.test.ts` cannot express the case; every `trialing: true` fixture
there is `plan: 'pro'` with no paid row behind it.

## UX-3 (S1) — Profile hides **"Manage"** from a paying member with a stale trial date

`src/features/profile/membership-copy.ts:44`

```ts
const paidPlan = !input.trialing && input.plan !== 'free';
```

`paidPlan` gates the App Store hand-off. Same input shape (`:20-26`) — no `paid`. For
the converted-trial account above, Profile renders title **"Pro trial"** and
`paidPlan: false`, so **the only in-app route to manage or cancel the subscription
disappears** for a person who is being billed. This is a functional dead end, not a
copy problem; the app has no other in-app subscription-management surface
(`membership-thanks-view.tsx:22-24`).

## UX-4 (S2) — Settings' membership row calls a paying member "trialing"

`src/features/billing/membership-row.ts:126-138`, input type `:56-69`

`membershipRowFor` branches on `input.trialing` **before** it looks at anything else
and has no `paid` input. Same account, same window: Settings reads
*"Cinch Pro · Trial through 3 September · 1,000 active pieces"* while
`/membership` (which does use `membershipSurface`) reads *"paid, manageable, through
<period end>"*. Two surfaces disagreeing about one account is the literal defect
`membership-surface.ts:6-13` was written to close — cluster A closed it on the two
membership pages and left it open on the Settings row, Profile and MB-06.

Note `settings.tsx:170-175` **does** correctly use `plan.paid` for the delete card's
subscription clause, with a comment naming this exact hazard. The row two lines above
it does not.

## UX-5 (S2) — `membership-thanks` names the wrong tier, using the banned expression

`src/app/membership-thanks.tsx:84`

```ts
const planKnown = !plan.loading && plan.plan !== 'free';
```

`planKnown`'s documented job (`membership-thanks-view.tsx:50-54`) is to suppress a
plan name during the webhook-lag window: *"NEVER draw a plan name that might be stale
in this state."* The trial fold defeats it — `plan.plan` is already `pro` because of
the trial, so `planKnown` is true from the first frame. A gifted-trial account that
buys **Standard** sees, during the lag: *"Cinch Pro is active."* plus a Plan row
reading **Pro**. Reached on a deep link it says *"Cinch Pro is active on this
account"* to an account that owns nothing.

MB-06's own verification logic is otherwise correct and worth recording as clean:
`thanksVerified()` (`membership-surface.ts:279-281`) is true only where
`paywall-origin.ts` holds a record, and `use-gate.ts:335-344` writes that record in
exactly one place — `outcome === 'granted' && target.purchase`, i.e. a real
`purchased`/`restored` from `onDismiss`, never on a silent skip. `clearPaywallOrigin`
runs on unmount (`membership-thanks.tsx:94`) as well as on the button. **Item 4's
"success only on purchased/restored" requirement is met.**

## UX-6 (S1) — `ErrorState`'s View→ScrollView change renders it at **zero height** and clips it away

`src/components/ui/error-state.tsx:143-149` (now `<ScrollView className="flex-1">`)

Caller `src/app/notifications.tsx:82` → `:93` renders the non-compact `ErrorState` as
a direct child of a `ScrollView` whose content container has **no `flexGrow: 1`**
(`contentContainerClassName="px-gutter pb-24 pt-6"`). In an unbounded column,
`flex-1` resolves to `flexBasis: 0%` with no free space to grow into → height 0. The
old code was also `flex-1`, but an RN `View` does not clip overflow on iOS, so the
title, body and retry drew outside the zero box and were visible. `UIScrollView`
clips.

**Scenario:** any device, **default text size**, the notification-preferences read
fails → blank page under the header. No error copy, **no retry, no recovery except
backing out.** This is a default-size regression the directive did not ask for.

Two more callers have the same `flex-1`-in-an-unflexed-parent shape and are reached by
tapping a push notification (so there is no stack to swipe back to):
`src/app/activity/reaction/[id].tsx:148` and
`src/app/activity/invitation/[id].tsx:161`. Whether Yoga stretches those particular
parents is version-dependent, but the **clipping** change is unconditional at all
three.

The fix belongs in the callers (`flex-1` on the wrapper), not the component.

Cleared callers (bounded-height parent, or `compact` → still a plain View): `review.tsx:421`,
`wall-swap.tsx:67`, `borrow.tsx:204`, `item/[id].tsx:436`, `event/[id]/outfits.tsx:475`,
`event/[id]/post.tsx:203`, `route-state.tsx:91`, `(tabs)/plan.tsx:824`,
`(tabs)/closet.tsx:275`, `repeat-outfit.tsx:257`, `plan.tsx:699`, `plan.tsx:925`,
`packing-tab.tsx:268`, `event/[id]/comments.tsx:398`/`:410`. **No caller puts it in a flex row.**

## UX-7 (S2) — nested vertical ScrollView swallows pull-to-refresh on Diary's error state

`src/features/diary/diary-page.tsx:148-175`

The parent ScrollView owns the `RefreshControl` and does set `flexGrow: 1` on the
error branch, so it sizes correctly — but `ErrorState` is now a vertical ScrollView
inside a vertical ScrollView. The inner one claims the pan and bounces, so the outer
`RefreshControl` can no longer be pulled from the error state. No RN warning fires
(that warning is `VirtualizedList`-in-ScrollView only), so nothing surfaces it.

## UX-8 (S2) — the Explore fashion gate drops whole legitimate apparel departments

`src/features/explore/shop-feed.ts` (client) and
`supabase/functions/garment-search/fashion-gate.ts` (**deployed**)

The category veto is read **first and unconditionally** (`shop-feed.ts:417-419`), so a
merchant breadcrumb that mixes an apparel word with a vetoed word loses the whole
family. Proven by executing the shipped predicate against a 133-row corpus:
**50 of 104 real garments dropped.** A selection, each with the veto term and its line:

| product | merchant category | veto | line |
| --- | --- | --- | --- |
| Performance Golf Polo | Sporting Goods > Golf > Apparel | `sporting` | `:336` |
| Insulated Ski Jacket | Ski Equipment & Clothing | `equipment` | `:337` |
| Occasion Party Dress / Cocktail Gown | Occasion & Party Dresses | `party` | `:344` |
| Leather Biker Jacket | Motorcycle Jackets | `motorcycle` | `:287` |
| Wool **Car Coat** | Coats & Jackets > Car Coats | `car` | `:286` |
| Tailored **Office Trousers** | Office & Workwear | `office` | `:315` |
| Chef Jacket | Kitchen & Chef Apparel | `kitchen` | `:269` |
| **Art Print Tee** | Art & Graphic Tees | `art` | `:339` |
| Cotton Bath Robe | Home > Bath > Robes | `home` | `:262` |
| Sheer Hosiery / Compression Sock | Health & Beauty > Hosiery | `health` | `:322` |
| Suede **Belt Bag** / Canvas **Storage Bag** | Bags & Storage | `storage` | `:341` |
| **Pool Slides** | Swimwear > Pool & Beach | `pool` | `:347` |
| Band Tour Hoodie | Music > Apparel | `music` | `:319` |

Three are pure lexical accidents rather than category errors, and each deletes a whole
merchant or genre:

- **`Silk Shirt` under `Home & Away Collection`** → `home`. A common seasonal collection name.
- **`House of Sunny Knit Top` under `House of Sunny`** → `house`. A brand-named category kills that brand's entire catalogue.
- **`Lawn Kurta Shirt` under `Lawn Collection`** → `lawn`. "Lawn" is a fabric; this removes essentially all South-Asian womenswear.

`hosiery` is in `GENERIC_FASHION_CATEGORY_WORDS` (`:253`) but can never fire under
`Health & Beauty > Hosiery`, because the veto loop returns first.

### UX-8b — the **title** veto kills "bottle green"

`NON_APPAREL_TITLE_WORDS` is applied to the title even when the category proves
apparel (`:458-460`). `'bottle'` at `:396` drops **"Bottle Green Merino Coat"** and
**"Bottle Green Wool Scarf"** — a standard British colour name. The file's own header
(`:355-359`) claims the list was pruned of exactly this hazard ("blanket scarf",
"stand collar", "frame" were considered and dropped); `bottle` slipped through the
same reasoning. Also dropped: `Pillow Talk Pink Cardigan` (`pillow :390`),
`Magnet Buckle Leather Belt` (`magnet :395`), `Ornament Print Silk Blouse`
(`ornament :384`), `Rug Tapestry Knit Jumper` (`rug :371`).

### UX-8c — garments with no merchant category are dropped wholesale

`agreedValue` (`features/catalogue/families.ts:607-611`) returns `null` when a family's
rows disagree on category — common across merchants. With `category = null` the gate
needs `productClass`, and `CLASS_NOUNS` (`_shared/garment-lexicon.ts:63-83`) has no
entry for kimono, bralette, bandeau, balaclava, espadrille, mule, wallet, sock,
tights, hosiery, cufflink, waistcoat, cravat, sarong, dungarees or boiler suit. All
**dropped** at `shop-feed.ts:464`. (`gilet`, `anorak`, `trench`, `clog` are in the
lexicon and survive; `mac` and `wellington` do not.) A brand-led title with no garment
noun — `Ganni SS26 Look 12` — passes with a category and is dropped without one.

## UX-9 (S2) — the gate admits non-fashion, systematically, on plurals

Proven with the same harness. `NON_APPAREL_TITLE_WORDS` (`:360-397`) is 36 terms of
which 32 are **singular only**, while merchant titles are overwhelmingly plural or
pack-quantified. Under an `Accessories` category, **17 of 18** pluralised junk titles
are admitted:

> Scented Candle Holders · Sock Ornaments Set · Blackout Curtains · Phone Chargers
> Bundle · Ceramic Mugs Gift Set · Memory Foam Pillows · Beach Towels 2-Pack · Fridge
> Magnets Pack · Bath Rugs · Wall Decals · Table Lamps · Vinyl Posters · Water Bottles
> 3-Pack · Car Bumpers · Jigsaw Puzzles · USB Adapters · Cabinets and Shelving

Only `Coat Racks` was caught, because `racks` is one of four plurals in the list.
Singular non-fashion also survives where the category is generic: **Silicone Phone
Case**, **Leather Dog Collar**, **Car Seat Cover** (Accessories is a *generic fashion*
word, `:248`, and `car` is vetoed only in the category, never in the title);
**Canvas Tote for Laptop** and **Silicone Oven Gloves** pass on `class === slot`
(`:462`) with the category never consulted.

The category veto has the same hole: `Sports & Outdoors` is **unknown** (only
`sporting` is listed), so `Sporting Goods > Golf > Apparel` is nuked while
`Sports & Outdoors > Cycling` sails through — and the `Cycling Jersey` under it is
then dropped anyway for having no class. Inconsistent in both directions on one
product family. Same for `Decors`, `Offices`, `Automotives`, `Storages`, `Walls & Windows`.

**Unicode:** `wordsOf` (`:401-404`) documents turning `'Home & Garden > Décor'` into
words. It does not — there is no NFKD normalisation (unlike `normaliseQuery`,
`_shared/catalog.ts:432-441`). `"Décor"` → `" d cor "` → verdict **unknown**, veto
missed. `"DECOR"` → correctly non-fashion. Accented category text bypasses the veto.

**The partner shelf bypasses the gate entirely.** `partnerShelfCards`
(`shop-feed.ts:661-683`) applies no fashion gate; `partnerFeed` on the server
(`index.ts:771-840`) filters by merchant id and slot and never calls
`isFashionFamily`. Anything in that merchant set reaches the shelf marked `paid: true`.

## UX-10 (S2) — the client/server gate mirror is real, but the drift test only guards a quarter of it

**Good news, proven:** all four word lists are byte-identical between
`src/features/explore/shop-feed.ts` and
`supabase/functions/garment-search/fashion-gate.ts` — 70 category labels, 21 generic
words, 86 non-fashion words, 36 title words, same terms, same order. `diff` of the two
list regions shows only doc-comment lines. `wordsOf`, `containsWord`, `categoryVerdict`
and the predicate body are also identical today.

**The gap:** `tests/explore-shop-feed.test.ts:463-470` compares **only the four
`export const` blocks**. The matching *rules* — `wordsOf`, `containsWord`,
`categoryVerdict`, `isConfidentFashion`'s body — are not compared. The two copies can
diverge on word-boundary, case or ordering semantics with the suite green, and the
server copy is already deployed.

One live asymmetry: `fashion-gate.ts:285` types `slot` as `BrowsableSlot` (9 values,
including `jewelry`); `shop-feed.ts:453` types it as `ShopFeedSlot` (8, no `jewelry`,
`:32-40`). A `jewelry` family can pass the server gate and can never pass the client's.
Proven: `Gold Signet Ring` / `Jewellery` browsed under `accessory` fails
`class === slot` at `:462`.

Also **READ**: the stated rationale for the server copy is false. `index.ts:678-679`
and `fashion-gate.ts:13-15` justify it as keeping hat racks out of "a browse answer
cached for seven days for everybody". Caching happens at **row** level inside
`searchCatalogue` → `catalog_lookups` (`_shared/catalog-store.ts:176-187`), called from
`searchFamilies` (`catalog-provider.ts:122-126`) — *before* grouping and *before* the
filter at `index.ts:683`. The cache still stores the hat racks; the gate runs
per-request on the way out. The server copy buys no cache economy.

## UX-11 (S2) — Compose's measured footer re-introduces a pattern this repo explicitly banned, and flashes on every mount

`src/app/compose.tsx:61,138-172`

- `footerHeight` initialises to **0**, so on first paint `paddingBottom = 16` while the
  absolutely-positioned footer already occupies ~210–250pt (tray `minHeight` 88 + two
  buttons + margins + `insets.bottom`). The bottom rows sit under an opaque
  `bg-canvas` panel until `onLayout` lands. **One-frame flash on every mount, every
  device, at default size.**
- **`scrollIndicatorInsets` is never set** — grep confirms neither `contentInset` nor
  `scrollIndicatorInsets` appears in the file. The indicator runs the full height and
  terminates behind the footer.
- **`tests/new-occasion-geometry.test.ts:117`** asserts
  `doesNotMatch(src, /footerHeight/, 'the footer is being measured again')` on the
  neighbouring screen, with the rationale that a footer should be a sibling of the
  scroll in one flex column so nothing needs measuring.
  `tests/explore-layout.test.ts:348` bans `onLayout` for the same reason. Compose
  adopts the banned shape — and **has no test file of its own**
  (`grep -rn "compose.tsx" tests/` returns nothing), so the ban does not reach it.

Cleared on the same file: no `onLayout` loop (footer height does not depend on
`footerHeight`, and React bails on an identical `setState`); safe-area counted exactly
once (`edges` went `['top','bottom']` → `['top']`, `insets.bottom` lives only in the
footer's own padding, which `onLayout` measures); re-measure on Dynamic Type change
works.

## UX-12 (S3) — the Closet's AX chip wrap creates overlapping touch targets, against `chip.tsx`'s own written rule

`src/app/(tabs)/closet.tsx:1065-1076`

The wrapped branch keeps the default `size="compact"` chip: `minHeight: 32` +
`hitSlop {top:8,bottom:8}` (`components/ui/chip-spec.ts:93-97`) at `gap: CHIP_GAP` = 8.
Two wrapped rows are 8pt apart and each row's slop reaches 8pt into that gap, so both
rows claim the whole inter-row gap. `chip.tsx:64-70` states this verbatim —
*"overlapping slop between wrapped rows makes the boundary a coin toss"* — and
prescribes `size="tap"` (44pt real geometry) for wrapped rows, which is what New
Occasion uses. `closet.tsx:100-111`'s own comment cites audit 61's *"hit regions do not
overlap."* The wrapped branch also drops `minHeight: CHIP_ROW_HEIGHT` and
`alignItems: 'center'`.

### UX-12b — and the Closet now changes composition at two different thresholds

`closet.tsx:17,1031` wraps the chips at `AX_FONT_SCALE` = **1.35**
(`components/today/reaction-spec.ts:87`), while `ClosetGrid` breaks to one column at
`AX_STACK_SCALE` = **1.5** (`components/closet/closet-grid.tsx:58,82`).
`features/closet/dynamic-type.ts` exists to forbid exactly this: *"Three screens
changing composition at three different thresholds is three different apps."* Compose,
New Event and People Search all use 1.5; only the Closet chips and `CapacityBand` use
1.35 — which is iOS `xxxLarge`, the top of the **standard** range, reachable without
ever opening Accessibility settings. No hysteresis at the boundary.

**Default size is unchanged** — the rail still scrolls horizontally at 1.0.

## UX-13 (S3) — read-only chips lost their VoiceOver grouping and their role

`src/components/ui/chip.tsx:126` — `const Frame = onPress ? Pressable : View;`

The comment claims *"the role was already reported honestly as `text`… Nothing else
changes."* Both halves are wrong for the no-handler case: `Pressable` renders with
`accessible={true}` by default, a bare `View` does not, and `accessibilityRole` alone
does not make a View an accessibility element on iOS. On item detail — where four of
five tags are read-only — each chip's label and count were previously **one** VoiceOver
stop with a role; they are now **two ungrouped stops with none**. Default text size,
VoiceOver on. The touch-target concern behind the change is real; the remedy should
have been `accessible` + `accessibilityRole="text"` on the View.

## UX-14 (S3) — People Search's title *shrinks* as the reader increases text size

`src/components/social/people-search-body.tsx:101-102, 265-268`

`large` fires at `PEOPLE_SEARCH_STACK_SCALE` = `AX_STACK_SCALE` = 1.5; `Text` caps
display variants at `MAX_DISPLAY_SCALE` = 1.4.

| fontScale | drawn title |
| --- | --- |
| 1.0 (default) | 31 pt |
| 1.49 | 43.4 pt |
| **1.50** | **30.8 pt** |
| 3.0 (AX5) | 30.8 pt |

At the threshold the title drops ~13pt in one step and, from AX1 up, is **smaller than
at 100%** and never grows again. The rewritten assertion in
`tests/people-search-layout.test.ts` pins the constant `TITLE_SIZE_COMPACT = 22`, so
the inversion is asserted *into* the contract rather than caught by it.

**Default size is unchanged** (`TITLE_SIZE` 31, `marginTop: 20` both as shipped) — the
24→20 change touches only the `large` branch.

## UX-15 (S3) — F-AN-1 is only half fixed: `explore_shop_feed_loaded` still fires from inside the queryFn

`src/features/explore/use-shop-feed.ts:74` and `use-partner-feed.ts:48`

The **launch-firing** half is fixed: `(tabs)/explore.tsx:281-288` now gates both
queries on `visited && showWhereToBuy.data === true`. The **once-per-visit** half is
not — `track()` still sits inside the `queryFn`, so the event fires on first fetch, on
any refetch after `staleTime = 30 min`, on any `queryKey` change (the key includes
`slots` and `palette`, so **adding a garment refires it**), and on the explicit
`refetch()` behind `/shop`'s "Try again" (`shop.tsx:69-70`).
`tests/tab-visit-gating.test.ts:98-105` documents this as the intended design.

**Undeclared property.** `posthog.tsx:308-313` declares this event as carrying `cards`
and `kinds` and says *"even the slot NAMES stay out"*. `use-partner-feed.ts:48` emits
**`shelf: 'partner'`** on it, which that declaration does not mention; `kinds` is never
present on the partner emission. One event name now carries two disjoint property
shapes, so any funnel on it mixes two shelves. (`EventProps` is
`Record<string, number|boolean|string|undefined>` — only the event *name* is typed, so
nothing would fail if a call site added `merchant` or `title`.)

**Measurement blind spot.** `use-shop-feed.ts:68-70` computes `cards` *after*
`confidentShelf`, which returns `[]` below `MIN_CONFIDENT_CARDS = 4`
(`shop-feed.ts:609-614`). So `cards` can only ever be `0` or `≥4` — the exact regime
UX-8/UX-9 are about (1–3 survivors) is analytically invisible, reported as a clean
zero indistinguishable from "the catalogue returned nothing."

## UX-16 (S3) — `/shop` is registered and reachable, but only through a doubly-conditional door

- **Typed routes: registered.** `/shop` appears in `.expo/types/router.d.ts:9,10,11`
  (`hrefInputParams`, `hrefOutputParams`, `href`), regenerated 2026-09-02 23:09.
- **Way back: yes.** `shop.tsx:51` renders `ScreenHeader … backLabel="Back to Explore"`,
  which defaults to `router.back()`, plus `fullScreenGestureEnabled`.
- **Exactly one navigation exists:** `(tabs)/explore.tsx:903`
  `onSeeMore={() => router.push('/shop')}`. Nothing else in `src/` pushes it.

But `ShopShelf` returns `null` at `cards.length === 0` (`shop-shelf.tsx:47`), and the
"See more" control renders **only when `total > cards.length`** (`shop-shelf.tsx:101`),
i.e. only when closet + partner exceed `EXPLORE_SHELF_CAP = 6`. With the partner feed
empty — which `index.ts:788-791` does deliberately whenever `AWIN_PUBLISHER_ID` is
unset ("fail the shelf closed") — and the closet feed yielding 4–6 gated cards, the
shelf renders **with no door** and `/shop` is unreachable from the UI while remaining a
valid typed route. Given how aggressively UX-8 shows the gate culling cards, this is a
live configuration, not a hypothetical.

`explore_shop_product_opened` is clean: four call sites
(`shop-shelf.tsx:55,56`, `partner-shop-section.tsx:34`, `shop-feed-section.tsx:35`),
emitted set `{'partner', absent}` exactly matches the declaration at
`posthog.tsx:315-320`. No undeclared value, no unreachable declared value — though the
two `/shop`-only sites are unreachable whenever the door above is hidden.

## UX-17 (S3) — `cardTitle` prints raw merchant text: unescaped entities, shouting caps, unbounded length

`shop-feed.ts:476-481` = `isUsableTitle(title) ? title.trim() : fashionCategoryLabel(category)`.
Executed:

| input | rendered |
| --- | --- |
| `'&amp; Other Stories Linen Shirt'` | printed raw — the card reads `&amp; Other Stories Linen Shirt` |
| `'<b>Linen Shirt</b>'` | printed raw |
| `'LINEN SHIRT'` | `LINEN SHIRT` — no case normalisation |
| 400 `'A'` characters, category `Clothing` | the full 400-char string, verbatim |
| `null` title | **throws `TypeError: Cannot read properties of null (reading 'trim')`** |

The 400-char case is unreachable via browse (server bounds at `MAX_TITLE_CHARS = 120`,
`title-bound.ts:30`) but **is reachable via the partner shelf**: `index.ts:826` emits
`title: row.title` straight from `catalog_products` with no `boundTitle`, and
`partnerShelfCards` (`:667`) checks only the 8-word rule. Neither
`shop-shelf.tsx:89-91` nor `shop-feed-section.tsx:66-68` sets `numberOfLines`.
`useShopFeed` does no runtime validation of `data.families`, so a malformed row throws
inside the queryFn.

**"Catalog name unavailable" is fixed on the shelf path** and still live elsewhere.
`TITLE_UNAVAILABLE` (`features/catalogue/copy.ts:130`) is produced only by
`presentedTitle`. None of `shop-feed.ts`, `shop-shelf.tsx`, `shop-feed-section.tsx` or
`partner-shop-section.tsx` imports it (pinned by
`tests/explore-shop-feed.test.ts:352-366`), so the keyed-sim-build sighting recorded at
`FINDINGS.md:100` is genuinely fixed for `/shop` and the Explore shelf. It is **still
reachable** on the catalogue screens: `components/catalogue/family-card.tsx:48` and
`components/catalogue/catalogue-body.tsx:116,355,423,510,575`.

## UX-18 (S3) — merge seam: cluster C's directive-#35 work on the Today membership card was discarded by cluster F

`src/components/today/upsell-bubble.tsx` · `src/app/(tabs)/index.tsx`

Of the nine files touched by two clusters, **eight merged cleanly** (verified
line-by-line against each branch's own diff). One did not. Cluster C (`9ca28e8`) gave
`TodayUpsell` a `placement: 'floating' | 'inline'` prop and an `{ax ? … : …}` split at
the call site, answering directive #35 ("the membership card covers the outfit and the
tab bar at accessibility sizes"). Cluster F (`483a2ce`) rewrote the file into an
always-inline tray row. F merged after C and every one of C's added lines is absent
from HEAD.

**This is not a defect** — F's row is unconditionally inline, which subsumes #35 more
completely than C's threshold did — and it is **consistent**: no dead `placement` prop
survives on either side, and no `AX_FONT_SCALE` import was orphaned. It is recorded
because the merge log credits #35 to cluster C, and the code that answers it is
cluster F's.

## UX-19 (S4) — dead code with a live test: `isManageablePlan`

`src/features/billing/manage-membership.ts:181-183` has **no production caller**
(cluster A moved the decision into `membershipSurface.manageable`), but
`tests/membership-row.test.ts:19,183-185` still pins it. Its docblock — *"Free never
reaches this page"* — is now false, since the free account is exactly who
`/membership`'s comparison branch is for. A rule that is dead but tested looks alive.

## UX-20 (S4) — `membership_upgrade` now serves first purchases, and `placements.ts` still says otherwise

`src/app/membership.tsx:97` and `src/app/membership-upgrade.tsx:37` both present
`Placement.MembershipUpgrade` for **free and trialing** accounts.
`src/features/billing/placements.ts:160-191` still documents it as *"the second
placement no server has refused anything for, and unlike `reveal_complete` the person
on the other side of it is already paying."*

Functionally safe — campaign 101571's audience is "no active Pro entitlement", so a
free account matches, and paywall 254200 carries all four products. But
`membership_upgrade` impressions now mix first purchases with Standard→Pro deltas, and
the placement's own contract was not updated to say so.

## UX-21 (S1, legal surface) — the AI consent record is now collapsed by default, under a sentence that says it is not

`src/components/privacy/ai-consent-page.tsx:141` and `:215-247` · `src/components/ui/disclosure.tsx:90`

The page intro still reads, verbatim:

> `You agreed to this on ${fullDate(grantedAt)}. **The wording below is the same wording you saw then.**`

What is below it is now `CONSENT_SUMMARY` — **three sentences written on 2026-09-02
that no account has ever agreed to** (`ai-consent-page.tsx:205-212`, copy at
`features/privacy/copy.ts:450-463`). All eight `CONSENT_FACTS`, including the four
character-frozen sentences a shipped user actually consented to, are inside
`<Disclosure label="The exact wording">` with **no `defaultOpen`**, and `Disclosure`
defaults `defaultOpen = false` (`disclosure.tsx:90`). They are invisible until tapped.

Behind the tap: *"The photo goes to our AI partner…"*, *"It only goes to models that
are not allowed to learn from it… Your name and your email never go with it."*, *"We
keep the photo and the tags in your closet. Deleting an item deletes both."*, *"We
never run face recognition, here or anywhere in Cinch."* — plus the four
three-doors/catalog/web-search facts.

The file's **own docblock** (`:25-27`) still cites the atlas rule it now breaks: *"the
withdrawal screen shows the original wording, not a summary of it."* `copy.ts:447`
acknowledges the move ("puts it one tap down"); nobody updated the intro sentence or
the docblock.

**Why the suite cannot see it:** `tests/w3-g4-consent-privacy.test.ts` — **untouched by
this merge** — is entirely (a) assertions on *imported constants* from
`features/privacy/copy.ts` and `features/auth/consent-facts.ts`, and (b) regex over
raw source text via `code(path)` (`:296-301`). It never mounts a component.
`assert.equal(fact.lead, FROZEN_RECORD[index][0])` passes exactly as before while the
sentence is invisible to a reader. This is the precise failure mode the brief asked
for: a green test over text nobody can see.

The same shape applies to `delete-account-page.tsx:97-116`, where `DELETION_HORIZONS`
moved behind a `Disclosure` under two new summary constants.

## UX-22 (S1) — The Ten's Library door leaves a permanent camera hole with no route to the OS prompt

`src/components/onboarding/ten-camera.tsx:277` · `:318` · `:323` ·
`src/components/onboarding/ten-camera-chrome.tsx:140-165, :214` · `src/app/the-ten.tsx:825`

New account, camera `undetermined`. The reader taps a slot's **Library** action →
`<TenCamera start="library">`. The `unasked` guard is explicitly skipped for
`start !== 'library'` (`:277`), so **`CameraAsk` never renders**. The mount effect
auto-opens the picker once (`autoPicked` ref, `:234-239`). The reader **cancels** it.
Now:

- `access` stays `'unasked'` forever — nothing asks.
- `access === 'blocked'` is false and `live` is false, so `stage={null}` (`:318`) and
  `TenCameraChrome` draws its ink well with corner guides: **a camera hole**.
- The shutter is `disabled` at `opacity 0.35` (`ten-camera-chrome.tsx:140-165`) with no
  hint explaining why.
- The sheet foot still instructs *"Frame one garment against a plain background, then
  shoot."* (`ten-camera-chrome.tsx:214`) — an instruction to use a permanently dead
  control.
- **There is no path from this screen to the OS prompt.** Only Library (re-opens the
  picker) and Cancel do anything.

**This is a regression this merge introduced.** Pre-merge, `useCameraAccess`'s mount
effect requested unconditionally regardless of `start`, so the state always resolved to
granted-or-blocked. `useCameraGate` (`features/ingest/use-camera-access.ts:143-177`)
asks for nothing by design — correct for a pre-permission pattern — and the
`start !== 'library'` carve-out means nothing else asks either. Same shape reachable
from `the-ten.tsx:872` and `:887`.

**Cleared on the same file:** grant → usable camera in the same session works with no
remount (`ten-camera.tsx:82` → `:277` stops firing → `DeferredCameraView` mounts at
`:309-317`); `'blocked'` / `canAskAgain:false` correctly offers `EmptyState` + Open
Settings (`:297-307`), as does `capture.tsx:1473-1521`; there is **no dismissal latch**
on the ask card; no entry auto-requests on mount anywhere; `CameraAsk`'s three
`PageActions` Pressables all carry their own `style` and satisfy the pressable-shape
rule.

## UX-23 (S2) — `Disclosure`'s `summary` is silently dropped by `variant="link"`, and two privacy screens ship dead copy

`src/components/ui/disclosure.tsx:134-145` (link branch) vs `:125-129` (row branch)

The `row` branch renders `summary` as visible text and as `accessibilityHint`
(`:116`). The `link` branch references it **nowhere** — no render, no hint. The type
comment (`:59`) says "`variant="row"` only", but nothing enforces it, and both authors
in this merge got it wrong:

- `src/components/privacy/closet-visibility-page.tsx:133` —
  `summary="Who sees it, when it starts, and what stays out."`
- `src/components/privacy/delete-account-page.tsx:101` —
  `summary="The exact detail, table by table."`

Both strings are unreachable. The directive's own shape is *"short headline → one-line
consequence → optional detail behind a disclosure"*; on these two privacy screens the
one-line consequence does not exist.

## UX-24 (S2) — three new user-facing privacy constants bypass the refused-sentence guard

`src/features/privacy/copy.ts:450` (`CONSENT_SUMMARY`), `:656`
(`DELETE_SUMMARY_WHAT`), `:658` (`DELETE_SUMMARY_REMAINS`) vs
`tests/w3-g4-consent-privacy.test.ts:184-207`

`ALL_COPY` in that test is built as *"every user-visible string this module exports,
flattened"* and is what the no-thirty-day-window and no-"former member" / no-"shown
without your name" checks run over. The merge added three exported user-facing
constants to the module and **none is in `ALL_COPY`**. `DELETE_SUMMARY_REMAINS`
("Two things, stripped of your name: a report someone filed about you, and one row of
our AI usage ledger…") is the compression closest to the refused claim shape; it
happens to be accurate against `DELETION_HORIZONS[2]`, but the guard would not have
caught it if it were not.

## UX-25 (S3) — the new `Disclosure` primitive has zero test coverage

Nothing under `tests/` imports `src/components/ui/disclosure.tsx` or matches
`<Disclosure`. **No assertion anywhere states that consent or deletion text is visible
by default on any surface** — which is what let UX-21 through UX-24 land green.

## UX-26 (S3) — the welcome line differs from the positioning contract

`src/app/(auth)/sign-in.tsx:516-517` vs `docs/design/positioning-contract.md:40`

Shipped: `You don’t have to photograph your whole closet. Ten pieces is a wardrobe.`
Contract (Activation row): `You don't have to photograph your whole closet. **Ten pieces is a wardrobe.**`

Two differences, confirmed by hexdump:
1. **Apostrophe** — contract `don't` is U+0027; shipped `don’t` is U+2019. The app's
   convention is curly, so the *contract* is the outlier — but they do not match
   character-for-character, which is what "verbatim" means here.
2. **Emphasis** — the contract bolds the second sentence; the shipped line renders it
   as plain text in the same run. §3 calls that clause "the approved constant-safe
   line", so the emphasis is doing work.

Sentence text, word order and both trailing periods are otherwise identical; the JSX
line break collapses to one space, so the rendered string is right.

Minor, same block: it is set at `fontSize: 12` in `rgba(243,240,233,0.5)`
(`:511-514`) — about 4.7:1 on the dark ground. Passes AA by a hair, at a size well
under the group's stated floors.

## UX-27 (S4) — two assertions rewritten with no explanatory note

`tests/friends-list-layout.test.ts:396` and `:412`

- `assert.equal(INVITE_MUTUAL_NOTE, 'Cinch only shows people you’re both friends with.')`
  → `'Cinch only shows mutual friends — people who follow you back.'`
- `assert.match(NOBODY_YET_BODY, /only ever shows people you’re both friends with/)`
  → `/only shows mutual friends/`

Not materially weaker (substring-regex → substring-regex; the sibling is still an exact
`assert.equal`), but the directive required an agent that changes a pinned test to say
so, and every other changed test file in this merge carries a
`CHANGED/AMENDED 2026-09-02` block quoting the old rule. These two do not.


# CLUSTER E — the bounded loading/error contract (`18b259f`)

Merged mid-pass and falsified separately. The pure state machine (`src/lib/bounded-load.ts`)
is sound and its unit tests are honest about *it*. Everything that fails is in the two
layers those tests do not touch: **the hook that owns the clock (zero tests)** and the
**13 of 18 routes that hand-roll the branches instead of using `RouteState`**. Two of
the states the cluster adds render as a blank screen.

## UX-28 (S1) — `RouteState state="error"` with no `errorCopy` renders a blank screen, and the unit test asserts the opposite

`src/components/ui/route-state.tsx:84,90-112` · `src/lib/bounded-load.ts:141-148`

`boundedErrorCopy('error', undefined)` returns **`null`** (`bounded-load.ts:146`). Back in
`route-state.tsx` the chain is
`copy ? <ErrorState/> : state === 'empty' ? … : <View className="flex-1">{skeleton}</View>`,
so `error` with no copy falls into the **skeleton** arm and renders
`<View className="flex-1">{undefined}</View>` — header, then nothing. No message, no retry.

`tests/bounded-load.test.ts:137-138` documents the opposite: *"No wording for an error
just means `ErrorState`'s own defaults."* It does not. This is a latent trap in the exact
component whose docblock (`route-state.tsx:17-29`) calls a route-level unreadable state
*"the defect this component exists to make unwritable"*. All five current callers happen
to pass `errorCopy`; the sixth will not.

**Repro:** `<RouteState state="error" title="X" onBack={fn} />`.

## UX-29 (S1) — a retry from the `error` state is **unbounded**, and its only control is disabled

`src/lib/use-bounded-load.ts:70` (`const waiting = loading && !error;`) and `:92-97`
(`if (!waiting) return;`)

In react-query v5 a query in `error` has `isPending === false`, so `loading` is false, and
`refetch()` leaves `status === 'error'` until it settles. Therefore:

1. state `error` → the reader taps Try again → `retry()` (`:99-103`) clears `expired`,
   bumps `attempt`, calls `refetch()`
2. `waiting` is still **false** → the effect returns early → **no timer is armed**
3. `retrying` = `isRefetching` = true → `error-state.tsx:105` `disabled={retrying}`

If that retry hangs — the captive-portal case this whole cluster exists for — the route
sits on a disabled "Trying…" forever. **The clock bounds only the first wait.** Affects
every call site: `repeat-outfit.tsx:70`, `board/[id].tsx:67`, `saved.tsx:52`,
`diary.tsx:101`, `friends/[userId].tsx:551`, `event/[id]/index.tsx:178`, `trips/*`,
`saved-looks/*`, `walkthrough/*`, `activity/*`, `privacy/export.tsx:42`.

**Repro:** fail the first read, tap Try again, black-hole the socket. The same sequence
from a *timeout* does re-arm — that asymmetry is the tell.

## UX-30 (S1) — cluster C ↔ cluster E collision: the new `timeout` state renders a zero-height, invisible error on Board and Saved

Same mechanism as UX-6, reached by a state cluster E added. Cluster C made `ErrorState`'s
full-screen variant a `ScrollView className="flex-1"`, and the component's own prop docs
state the hazard: *"Drops the `flex-1` centring (which needs a flex parent and collapses
to nothing without one)"* (`error-state.tsx:20-23`; `empty-state.tsx:21-26` repeats it).

Both boards pages supply exactly that parent:

- `src/components/boards/board-page.tsx:106` outer `ScrollView contentContainerClassName="pb-12"` (no `flexGrow`) → `:148` `<View className="pt-4">` → `:149` `<ErrorState>`
- `src/components/boards/saved-page.tsx:108` → `:180` `<View className="pt-4">` → `:181` `<ErrorState>`

`src/features/diary/diary-page.tsx:151-153` shows the fix applied *there*
(`contentContainerStyle={{ flexGrow: 1 }}` gated on the state) and **not** here.

**Repro:** open `/board/<id>` with the network black-holed; after 6 s the masthead stays
and nothing else appears.

## UX-31 (S2) — Board's masthead asserts "No plates yet" *during* the timeout

`src/components/boards/board-page.tsx:140` — `{!loading && !error ? <Text>{summary}</Text> : null}`

That gate came from main's AUDIT-100 #61; cluster E added a third non-content state to the
same component and did not add it to the gate. On timeout the props are
`loading=false, error=false, timedOut=true` (`board/[id].tsx:137-139`), so the gate passes
and `boardDetailLine` prints **"No plates yet"** (`features/boards/board-lines.ts:240`) —
directly above the invisible error from UX-30. `saved-page.tsx:122` got it right
(`!loading && !error && !timedOut && summary`). The two files disagree.

## UX-32 (S2) — `saved_state_shown` is now corrupted: slow-but-successful reads report `error`

`src/app/saved-looks/index.tsx:129,181-185` · `src/features/saved-looks/analytics.ts:86,205-206`

`resolveSavedListState` is now fed `failed: load.failed`, and `load.failed` **includes
timeout**. So:

- any read slower than 6 s that then **succeeds** emits `saved_state_shown {state:'error'}`
  — and the props type allows only `'loading' | 'offline' | 'error'`; there is no
  `'timeout'` member to distinguish it;
- a retry from a timeout flips `kind` error → loading → populated, **re-firing**
  `stateShown('loading')` and possibly `('error')` each time. Before E, a retry from
  `isError` kept `kind === 'error'`, so nothing re-fired;
- `saved_retry_tapped` — described in its own declaration as *"the numerator for whether
  recovery works"* — now mixes timeout-retries into the failure-retry population.

Net effect: Saved Looks' error rate inflates for every reader on a slow link, silently.

## UX-33 (S2) — "NOTHING IS CANCELLED" is false at every call site

`src/lib/use-bounded-load.ts:29-34` promises the query is *"untouched and still in flight"*
and that a late landing *"falls straight through to `content`"*. Every site wires `onRetry`
to `query.refetch()`, and v5's `refetch()` defaults to `cancelRefetch: true` — it discards
the in-flight fetch and starts a new one. Tapping Try again 6.1 s into a 7 s read throws
that read away and restarts the clock at zero.

Compounding it: `retrying` is `isRefetching` = `isFetching && !isPending`, which is
**false for the entire timeout state** (the query is still pending). So `ErrorState`'s
"Trying…" can never render there, the button stays enabled and labelled "Try again", and
it can be tapped repeatedly — each tap cancelling and restarting the request.

## UX-34 (S2) — the garment swatch's ink flip fails contrast on **57 of 104** wardrobe colours

`src/lib/color/swatch.ts:52-56,85` (`INK_FLIP_L = 0.55`, `LIGHT_INK = '#FFFFFFCC'`,
`DARK_INK = '#1C1A16AA'`) · `src/components/media/garment-fallback.tsx:114`

Running the repo's own OKLab math over the full `NAMED` table
(`src/lib/color/families.ts:107-230`), compositing the alpha and computing WCAG ratios —
the label is `variant="caption"` = 11 px, so AA needs 4.5:1:

- **57 of 104 fall below 4.5:1**
- **10 fall below 3:1**, the floor even for large text

| ratio | colour | hex | L |
| --- | --- | --- | --- |
| 2.41 | magenta | `#c22b7d` | 0.554 |
| 2.45 | copper | `#a3603a` | 0.557 |
| 2.53 | burnt orange | `#b35c22` | 0.569 |
| 2.65 | steel | `#6c7c8c` | 0.579 |
| 2.67 | fuchsia | `#cf3a8e` | 0.594 |
| 2.68 | emerald | `#1f8a5c` | 0.563 |

The failures cluster just above the flip point, where neither 80 %-white nor 67 %-black
works. `tests/garment-swatch.test.ts:51` is titled *"the ink flips on perceptual lightness,
so type passes on any hue"* but asserts only that the two inks **differ** — it never
computes a ratio. (The light/dark question is moot: `src/theme/palette.ts:114` is
`dark: light`.)

**Repro:** a friend's closet or a trip collage holding a magenta or copper piece with no cutout.

## UX-35 (S2) — trips: offline, error and timeout collapse into one state, and the cached-rows line is lost

`src/app/trips/index.tsx:137-139` sets `offline: load.failed`;
`src/components/trips/trips-list-body.tsx:829-843` replaces **all three** strings on
`timedOut`, including the `cached ? TRIPS_COPY.offlineBody : offlineBodyEmpty` branch. So
on a timeout **with cached rows present**, the band says *"Cinch is still waiting to hear
back…"* while a list renders beneath a `PaperEyebrow label={TRIPS_COPY.cached}` with
nothing explaining why those rows are stale. The lost line is the one
`src/lib/query-client.ts:67-75` names as the reason `trips` is persisted at all.

`src/app/trips/[id].tsx:206` — `load.failed || !row` — funnels **deleted-trip**, **error**
and **timeout** into one `ErrorBody`.

## UX-36 (S3) — `useBoundedLoad` returns a fresh object every render, killing two `useMemo`s

`src/lib/use-bounded-load.ts:107` returns an object literal. Two call sites put it straight
into a dependency array: `src/app/trips/index.tsx:169` and `src/app/trips/[id].tsx:277-294`.
Both memos now recompute on **every** render, rebuilding every `TripTile` array (and
therefore every `Well` / `GarmentFallback`) each time. The previous dep was the react-query
result, which is materially more stable. `retry` is also a fresh callback whenever
`onRetry` is an inline arrow — which it is at 14 of the 18 sites.

## UX-37 (S3) — the same commit ships two competing bounds, in a file it edits

`BOUNDED_TIMEOUT_MS = 6_000` (`src/lib/bounded-load.ts:56`) vs
`STALL_DEADLINE_MS = 10_000` (`src/features/plan/use-stalled.ts:58`), still used at
`src/features/plan/packing-tab.tsx:240` — **a cluster-E file** — and
`src/app/(tabs)/plan.tsx:574`. Worse, `useStalled` (`use-stalled.ts:40-48`) has precisely
the bug `use-bounded-load.ts:20-27` says the `attempt` counter was invented to fix: no
attempt dep, so a retry that leaves `loading` true never re-arms the timer.

## UX-38 (S3) — Activity detail routes render error and timeout into the same collapsing wrapper

`src/app/activity/invitation/[id].tsx:160-166` and `src/app/activity/reaction/[id].tsx:147-153`
wrap a non-compact `ErrorState` in `<View style={{ paddingHorizontal: 20, paddingTop: 8 }}>`
— no flex. Same zero-height mechanism as UX-6/UX-30. The wrapper predates E; E newly routes
`timeout` into it, doubling the ways to reach a blank screen. (Secondary: the wrapper's 20 pt
plus `ErrorState`'s own `px-gutter` double-inset the copy.)

## UX-39 (S3) — the hook and `RouteState` have no tests at all

`tests/bounded-load.test.ts` is 145 lines against the React-free reducer. Every finding
above (UX-28, 29, 33, 36) lives in `use-bounded-load.ts` or `route-state.tsx`, neither of
which has a single test. The commit's claim that the tests pin *"that a skeleton ends"* is
not what `boundedState({ loading: true, expired: true })` shows — `expired` is an **input**
there, and the thing that produces it is untested.

## UX-40 (PLAUSIBLE, S3) — the swatch's visible garment names are invisible to VoiceOver

`GarmentFallback` is decorative by default (`src/components/media/garment-fallback.tsx:106-109`,
`spoken` defaults false) and **no caller passes `spoken`**. The aggregate labels the
containers carry — `cardLabel(trip)` (`trips-list-body.tsx:494,615`), plate-card's
`[title, meta]` (`plate-card.tsx:55`), the event option's label
(`event-detail-body.tsx:673`) — do not include the piece names. Before finding #62 the
tiles were blank so nothing was lost; now a sighted reader gets "Shearling coat / Boots /
Linen shirt" and a VoiceOver reader gets "Lisbon, 3–7 May". Needs a device to confirm.

Related, PLAUSIBLE: at AX sizes the 2-line `caption` inside `overflow-hidden` tiles
(`garment-fallback.tsx:110-121`, `maxFontSizeMultiplier` unset) will clip. And
`garmentKindLabel` returns `"Untagged piece"` (`:84`) where `pieceLabelOf`
(`features/boards/queries.ts:88-93`) returns `null` for the same condition — so four
untagged pieces on a trip card read "Untagged piece" ×4, which is the
indistinguishability #62 set out to fix, restated in words.

## Cluster E — what holds up

- **Late arrival is correct.** The render-phase reset (`use-bounded-load.ts:86-90`) clears
  `expired` in the same commit `waiting` flips, so a read landing at t=7 s goes
  timeout → content with no intermediate frame. A late error goes timeout → error (error
  outranks). No stale error over loaded data; no slow success overwriting an acted-on error.
- **Precedence during react-query's `retry: 2`** (`src/lib/query-client.ts:28`) is honest:
  status stays `pending` through both backoffs, so the route shows skeleton → (6 s) timeout
  → error. **No skeleton-and-error-together window and no blank window** at any of the 18
  converted routes (all walked).
- **Timer lifecycle** is otherwise right: deps `[waiting, timeoutMs, attempt]`, no
  per-render restart, `clearTimeout` on unmount, no setState-after-unmount, query-key
  changes reset via the `waiting` flip. The only hole is UX-29.
- **`RouteState` itself does not nest scroll views** — `SafeAreaView flex-1` → `ScreenHeader`
  → `ErrorState`. The nesting damage is entirely at hand-rolled sites (UX-30, UX-38). No
  `FlashList`/`VirtualizedList` nesting anywhere.
- **`goBack` into an empty stack is NOT a dead end.** `src/app/_layout.tsx:50` declares
  `unstable_settings = { anchor: '(tabs)' }`, so a cold-start deep link builds
  `[(tabs), <route>]` and a bare `router.back()` lands on the tabs. The seven bare sites
  (`activity/invitation/[id].tsx:134`, `activity/reaction/[id].tsx:128`, `diary.tsx:129`,
  `friends/[userId].tsx:804`, `privacy/export.tsx:91`, `trips/[id].tsx:297`,
  `trips/index.tsx:146`) are inconsistent with the ten that consult `canGoBack()`, but not
  broken. Every `replace` fallback target exists as a route. The one factually wrong
  string is pre-existing: `walkthrough/ceiling.tsx:104`'s hint *"Returns to your review"*,
  when review reaches ceiling via `router.replace` (`walkthrough/review.tsx:138`).
- **`garment-fallback` degrades correctly** on null / blank / garbage colour and
  whitespace-only labels (`swatch.ts:68-77`, `garment-fallback.tsx:98-101`).
- **Merge cleanliness:** only three files were touched by both E and main
  (`board-page.tsx`, `saved-looks/state-screens.tsx`, `ui/index.ts`) and all three merged
  textually correctly. The two real collisions are **semantic, not textual** — UX-30
  (cluster C's `ErrorState`) and UX-31 (main's masthead gate) — which is exactly the class
  of seam a merge tool cannot see.


---

# CLEARED — checked and correct

- **Item 3, the closet capacity band.** `useCapacityStateReport()` is called
  unconditionally in the screen body at `(tabs)/closet.tsx:169`, above every branch,
  and reports on focus via `useTabVisited()` regardless of scroll
  (`:1222-1241`). The band itself (`CapacityBandRow`, `:1243`) is drawing only, in the
  `SecondaryInsights` footer (`:927`). `closet_plans_door_opened` **and**
  `gate.present(Placement.AddGarmentOverLimit)` both still fire from the band's door
  (`:1275-1279`). The docblocks at `:166-169`, `:813-819` and `:1210-1221` name this
  exact hazard and close it. **This one was done right.**
- **Single-fire analytics.** `today_opened` (`index.tsx:972-978`), `closet_viewed`
  (`closet.tsx:866-875` — the effect runs *before* the `rails === 'none'` early return,
  so it fires for an empty closet too) and `stylist_opened`
  (`(tabs)/stylist.tsx:261-268`) each have exactly one emission site, each ref-latched
  and focus-gated. `paywall_presented` has one site (`use-gate.ts:432`).
- **Item 2, the once-per-open latch.** It survives the rewrite. `claimUpsellBubble()`
  is claimed inside `UpsellRow`'s lazy `useState` initialiser
  (`upsell-bubble.tsx:127-130`), the gate half holds no state, and there is exactly one
  `<TodayUpsell>` in the tree (`index.tsx:2217`). `resetUpsellBubble` has no
  production caller. Failure modes are all in the safe direction: a transient
  `unconfirmed` unmounts the row and spends the slot, so it shows *less* often, never
  twice. `Placement.RepeatUpsell` is never presented automatically — both call sites
  (`index.tsx:1959` RepeatExhausted, `:2222` the row) are user taps, unchanged.
- **A paid account does not see the Today row** — `upsellBubbleFor` returns `null` for
  `plan !== 'free' && !trialing`. The failure is the *trialing-and-paid* case only (UX-2).
- **MB-06's purchase gate** — see UX-5's closing paragraph.
- **The membership comparison offers exactly one primary door.** A free account gets
  one oxblood `PLANS_CTA` button (`membership-body.tsx:225-232`), a tinted back
  action, and a restore row; `declined` renders `NOTHING_STARTED` and asks nothing
  again; `unavailable` renders `UPGRADE_UNAVAILABLE_LINE` with a `TRY_AGAIN` retry.
  Both pages render both outcomes (`membership-body.tsx:206-221`,
  `upgrade-body.tsx:192-213`).
- **Merge seams.** Nine files were touched by two clusters each
  (`closet.tsx`, `index.tsx`, `privacy/pinterest.tsx`, `board-page.tsx`,
  `rail-card.tsx`, `saved-looks/state-screens.tsx`, `sheet-parts.tsx`,
  `upsell-bubble.tsx`, `ui/index.ts`). Eight merged with both sides intact — verified
  by replaying each branch's added and removed lines against HEAD. `pinterest.tsx`'s
  hand-resolved conflict is correct: D1's `Disclosure` and C's `px-gutter` both landed
  (`:147`, `:154`). Only `upsell-bubble.tsx` lost a side (UX-18). No duplicated
  control, no dead prop, no orphaned import anywhere in the merge.
- **`explore.tsx` / `shop.tsx` do not double-render the shelves.** Explore uses the
  compact `ShopShelf`; `/shop` uses `ShopFeedSection` + `PartnerShopSection`. They
  share a query key, so navigating between them does not refetch or refire.
- **Client/server gate lists are byte-identical** (UX-10's good half).
- **`sheet-parts.tsx` Composer.** `maxFontSizeMultiplier={MAX_TEXT_SCALE}` (`:794`) is
  on the `TextInput`, but every `Text` already carries the identical 1.8 ceiling from
  `components/ui/text.tsx:195` — so it *removes* an inconsistency rather than capping
  the input against its labels. `maxHeight: 110 * Math.min(fontScale, 1.8)` (`:801`) is
  exactly 110 at default. The send button is 44×44 at every size.
- **`new-event-body.tsx` keyboard footer.** `KeyboardAvoidingView behavior="padding"`
  with `keyboardVerticalOffset` **0**, never overridden
  (`components/ui/keyboard-aware-scroll-view.tsx:46-55`), plus
  `automaticallyAdjustKeyboardInsets`. No hardcoded header height, no notch
  assumption; footer clearance is `Math.max(insets.bottom, 26)`.
- **`DoorCard`'s new glyph regime.** `doorRegime`
  (`features/stylist/stylist-spec.ts:522-524`) requires **every** door to resolve, so
  the now-unguarded `<Image source={{uri}}>` can never receive `undefined`. The
  five-wells → five-glyph-plates change at default size is real, and is audit item 11,
  i.e. asked for.
- **Item 8, copy discipline: clean.** A sweep of every added line in `src/` and
  `supabase/` for `!` used as punctuation (excluding `!=` and prefix negation), inside
  string literals and as bare JSX text, found **zero**. The only `!` in added quoted
  text is inside doc-comments quoting code. A sweep for `user`/`users`/`User` inside
  added user-facing string literals found **zero** — every hit is a comment.
- **Item 8, weakened tests: none found.** All 24 changed test files were diffed and
  classified. 7 are additions only. The other 17 all carry an explicit
  `CHANGED/AMENDED/REPLACES 2026-09-02` block quoting the old assertion, and most are
  net *stronger* (`camera-availability` adds a `doesNotMatch`; `closet-content-first`
  adds `doesNotMatch(/<CapacityBandRow/)` plus a whole new analytics-population test;
  `upsell-bubble` adds `deepEqual(Object.keys(UPSELL_COPY), ['cta','close'])`;
  `private-circles-copy` adds `about.length === 2`; `event-lines` adds a compile-forced
  `onBack` check and a deep-link `goBack` check). The one deleted whole test —
  `'the free refusal carries no upsell'` — is a real handoff: `NO_MEMBERSHIP_LINE` is
  genuinely deleted from `src/`, and `tests/membership-surface.test.ts:145,169,171,246,263,299-305`
  covers the rule. The only undocumented rewrite is UX-27.
- **`tests/camera-availability.test.ts` was strengthened, not weakened** — the exact
  `assert.equal` on `CAMERA_UNAVAILABLE_BODY` was updated to the new copy and a
  `doesNotMatch(/the other three/)` was added; the other four `assert.equal`s are
  untouched.
- **Item 9, the `Disclosure` primitive itself is correctly built.**
  `accessibilityRole="button"` (`:114`, `:135`), `accessibilityState={{ expanded }}`
  (`:117`, `:137`), `accessibilityLabel`, `minHeight: MIN_TAP_TARGET` on both variants.
  **Collapsed content is unmounted, not merely hidden** (`:148-150`), so it is out of
  the VoiceOver tree entirely — no reading of text a sighted reader cannot see. Reduce
  Motion is honoured by nulling the layout animation outright
  (`layout={reduceMotion ? undefined : LinearTransition…}`, `:110`); there is no
  `LayoutAnimation` anywhere in `src/`. It complies with the pressable-shape rule and
  `tests/pressable-shape.test.ts:28-41` **does** cover the file (it walks all of
  `src/**/*.tsx`): the shape here is `Animated.View` *wrapping* a `Pressable`, the
  documented-safe direction, and both Pressables carry their own style anyway. The
  defects are in how it is used (UX-21, UX-23), not in the component.
- **Camera: no auto-request on mount anywhere.** `useCameraGate` derives four states
  purely from the expo permission object with no latch and no first-launch memory
  (`use-camera-access.ts:143-177`); `request` is only ever called from a tap;
  `AppState 'active'` re-reads (`:151-156`). The walkthrough requests microphone only,
  from a tap. The one broken entry is the Library door (UX-22).
- **No fixed `height:` on a text-bearing container** and **no new `numberOfLines`** were
  introduced anywhere in the seven AX target files. The only added `height:` values are
  the two non-text door wells.

---

# WHAT THE SUITE CANNOT SEE — structural note

The suite is **entirely static source-regex**: 240 test files, **zero `render(` calls
anywhere in `tests/`**. Every assertion is `assert.match(readFileSync(...))` or a call
into a pure spec module. So by construction the suite cannot observe Yoga layout,
ScrollView clipping, `onLayout` timing, gesture conflicts, hit-region overlap, or
anything a component *renders* as opposed to *contains*.

Concretely, for the findings above:

- `tests/daily-social-ax.test.ts:176` and `private-circles-ax.test.ts:160` assert the
  literal string `accessibilityRole="alert"` exists in `error-state.tsx`. It still
  does — on a container that renders at **zero height** at the notifications call site
  (UX-6). *No test asserts a single ErrorState call site's layout context;* the
  component changed shape and 15 callers were never re-examined.
- **No test opens `src/app/compose.tsx`.** The measured-footer pattern it introduces is
  explicitly banned on the neighbouring screen, and that ban is scoped by filename
  (UX-11).
- `tests/closet-content-first.test.ts:83-89` checks only the *source order* of
  `<CategoryChipsRow`; it never evaluates the `if (ax)` branch, the gap, or the chip
  size (UX-12).
- `tests/membership-surface.test.ts` pins the resolver exhaustively and never renders
  the pages, so the tier-filter bug (UX-1) is invisible; `UpsellBubbleInput` has no
  `paid` field, so UX-2 is inexpressible.
- `tests/explore-shop-feed.test.ts:463-470` compares four word lists and no matching
  rule (UX-10).
- `tests/people-search-layout.test.ts` asserts the compact constant exists, which pins
  the inversion *into* the contract (UX-14).

- `tests/w3-g4-consent-privacy.test.ts` — **untouched by this merge** — asserts on
  imported constants and on raw source text, never on a render, so the frozen consent
  record passes identically whether it is on screen or behind a tap (UX-21). Its
  `ALL_COPY` sweep does not include the three new constants (UX-24).
- **Nothing under `tests/` imports `disclosure.tsx`** — the primitive that hid the
  consent record has no test at all (UX-25).

---

# RANKED SUMMARY

| # | sev | finding | file:line |
| --- | --- | --- | --- |
| UX-1 | **S1** | trialing account shown a **downgrade** table headed "what a membership adds" | `membership-body.tsx:317-327`, `upgrade-body.tsx:175-185` |
| UX-2 | **S1** | Today tells a **paying** member their trial is ending | `upsell-bubble.ts:116`, `upsell-bubble.tsx:137` |
| UX-3 | **S1** | Profile hides "Manage" from a paying member — no other in-app route | `membership-copy.ts:44` |
| UX-6 | **S1** | ErrorState renders at zero height and is clipped: no copy, no retry, **default size** | `error-state.tsx:143`, `notifications.tsx:82` |
| UX-21 | **S1** | AI consent record collapsed by default, under "the wording below is the same wording you saw then" | `ai-consent-page.tsx:141,215-247`, `disclosure.tsx:90` |
| UX-22 | **S1** | The Ten's Library door + cancelled picker = camera hole, dead shutter, no route to the OS prompt (**regression**) | `ten-camera.tsx:277,318,323` |
| UX-4 | S2 | Settings calls a paying member "trialing"; disagrees with /membership | `membership-row.ts:126` |
| UX-5 | S2 | membership-thanks names the wrong tier via the banned expression | `membership-thanks.tsx:84` |
| UX-7 | S2 | nested ScrollView kills pull-to-refresh on Diary's error state | `diary-page.tsx:148-175` |
| UX-8 | S2 | fashion gate drops 50/104 real garments, incl. "bottle green", "car coat", "office trousers" | `shop-feed.ts:417,458`; deployed twin |
| UX-9 | S2 | gate admits 17/18 pluralised non-fashion titles | `shop-feed.ts:360-397` |
| UX-10 | S2 | drift test guards the word lists but not the matching rules | `explore-shop-feed.test.ts:463-470` |
| UX-11 | S2 | Compose footer: first-paint flash, no indicator inset, banned pattern, untested file | `compose.tsx:61,138-172` |
| UX-23 | S2 | `Disclosure` drops `summary` in `variant="link"`; two privacy screens ship dead copy | `disclosure.tsx:134-145` |
| UX-24 | S2 | three new privacy constants bypass the refused-sentence `ALL_COPY` guard | `copy.ts:450,656,658` |
| UX-12 | S3 | AX chip wrap overlaps touch targets; two composition thresholds on one screen | `closet.tsx:1065-1076` |
| UX-13 | S3 | read-only chips lost VoiceOver grouping and role | `chip.tsx:126` |
| UX-14 | S3 | People Search title **shrinks** as text size grows | `people-search-body.tsx:101,265` |
| UX-15 | S3 | F-AN-1 half fixed; undeclared `shelf` prop; `cards` can only be 0 or ≥4 | `use-shop-feed.ts:74`, `use-partner-feed.ts:48` |
| UX-16 | S3 | `/shop` unreachable whenever the shelf holds ≤6 cards | `shop-shelf.tsx:47,101` |
| UX-17 | S3 | raw merchant titles: unescaped entities, caps, unbounded via the partner shelf | `shop-feed.ts:476-481` |
| UX-18 | S3 | merge seam: cluster C's #35 work discarded by F (outcome fine, credit wrong) | `upsell-bubble.tsx` |
| UX-25 | S3 | the new `Disclosure` primitive has zero test coverage | `components/ui/disclosure.tsx` |
| UX-26 | S3 | welcome line differs from the contract (apostrophe glyph, dropped emphasis) | `sign-in.tsx:516` |
| UX-28 | **S1** | `RouteState state="error"` with no `errorCopy` renders a blank screen; the unit test asserts the opposite | `route-state.tsx:84,90-112`, `bounded-load.ts:146` |
| UX-29 | **S1** | a retry from `error` is **unbounded** and its only control is disabled — the hang case the cluster exists for | `use-bounded-load.ts:70,92-97` |
| UX-30 | **S1** | C↔E collision: the new `timeout` state is a zero-height invisible error on Board and Saved | `board-page.tsx:148`, `saved-page.tsx:180` |
| UX-31 | S2 | Board's masthead prints "No plates yet" during the timeout; Saved's gate is right, Board's is not | `board-page.tsx:140` |
| UX-32 | S2 | `saved_state_shown` reports `error` for slow-but-successful reads, and retries double-count | `saved-looks/index.tsx:129,181-185` |
| UX-33 | S2 | "NOTHING IS CANCELLED" is false — `refetch()` defaults to `cancelRefetch: true` at every site | `use-bounded-load.ts:29-34` |
| UX-34 | S2 | swatch ink fails AA on 57 of 104 wardrobe colours (10 below 3:1); the test never computes a ratio | `lib/color/swatch.ts:52-56,85` |
| UX-35 | S2 | trips: offline/error/timeout collapse into one state; the cached-rows line is lost | `trips-list-body.tsx:829-843`, `trips/[id].tsx:206` |
| UX-36 | S3 | `useBoundedLoad` returns a fresh object, killing two `useMemo`s on the trips screens | `use-bounded-load.ts:107` |
| UX-37 | S3 | two competing bounds ship together (6 s vs 10 s), the older one with the bug the newer says it fixed | `bounded-load.ts:56` vs `use-stalled.ts:58` |
| UX-38 | S3 | Activity detail routes render error/timeout into a collapsing wrapper | `activity/*/[id].tsx:147,160` |
| UX-39 | S3 | `use-bounded-load.ts` and `route-state.tsx` have no tests at all | — |
| UX-40 | PLAUS. | the swatch's visible garment names are invisible to VoiceOver (`spoken` never passed) | `garment-fallback.tsx:106-109` |
| UX-19 | S4 | dead `isManageablePlan` with a live test and a now-false docblock | `manage-membership.ts:181` |
| UX-20 | S4 | `membership_upgrade` now serves first purchases; its contract was not updated | `placements.ts:160-191` |
| UX-27 | S4 | two assertions rewritten with no explanatory note | `friends-list-layout.test.ts:396,412` |

**Two clusters to fix first.**

**1 — membership truth (UX-1…UX-5).** One defect with five faces. Cluster A introduced
`PlanState.paid` and the rule that *"no page may ask `plan !== 'free'` again and get its
own answer"* (`membership-body.tsx:165-166`), then applied it to two of the six surfaces
that ask. `grep -rn "plan !== 'free'" src/` still returns `membership-thanks.tsx:84`,
`membership-copy.ts:44`, `upsell-bubble.ts:116` and `upsell-bubble.tsx:137`, and
`membership-row.ts` has no `paid` input at all. All five land on the **29 gifted trials
converting at 2026-09-03 14:00Z** — the one cohort whose money pages have to be right
today. UX-3 is the sharpest: a paying member loses their only in-app route to manage or
cancel.

**2 — blank screens (UX-6, UX-28, UX-29, UX-30, UX-38).** Cluster C turned `ErrorState`
into a `ScrollView`; cluster E routed a new `timeout` state through the same component
across 18 routes. Neither cluster could see the other, and the suite renders nothing, so
four separate paths now end on a header over an empty page — one of them
(`notifications.tsx`) at **default text size**, on an unchanged caller, with no retry and
no recovery but backing out. UX-29 is the same family from the other end: the one state
the bound was written to prevent is the one state it does not bound.

Neither cluster is unsound in design. Both were merged without a pass over the callers
they changed the contract for, and a source-regex suite is structurally incapable of
noticing that.

## Method

- Per-cluster file-overlap map, then a line-by-line replay of every branch's added and
  removed lines against `HEAD` for each of the nine two-cluster files.
- Scripted scans of the whole merge for unused imports, added `eslint-disable` /
  `@ts-ignore` / `@ts-expect-error` / `as any`, and lint-config relaxation.
- Executed the shipped predicates rather than reading them: `planDelta('pro','standard')`
  over the real `PLANS`; `isConfidentFashion` over a 133-row corpus with the four word
  lists extracted from source at runtime; the OKLab/WCAG math over the full `NAMED` table;
  a byte-level diff of the client and deployed server gates.
- `npm run typecheck`, `npm test`, `npm run lint` re-run at `1b85923` after cluster E landed.
- Nothing under `src/`, `supabase/`, `tests/` or `scripts/` was modified. Throwaway
  harnesses live in the session scratchpad only.

# Verification — second pass over the UX repairs (`1b85923` → `2862e66`)

Hostile falsification of the repairs claimed for `docs/eng/audit-2026-09-02/verification-ux.md`
(40 findings, 11 S1). Commits under test:

| commit | claim |
| --- | --- |
| `02e5f59` | membership `owned`/`paid` on six surfaces; ErrorState `flexGrow`; RouteState default error copy; `useBoundedLoad({fetching})`; board/saved gates; swatch pill; consent record open; **Ten library-cancel → ask**; fashion-gate rewrite both sides |
| `6ea8eb8` | test import fix |
| `44f4745` | `fetching: <query>.isFetching` threaded into the bounded-load call sites |
| `43c2f9a` | `TRAILING_WORDS` + "a title that names a garment must be that garment" (head noun), both gates |
| `f6ed63d`, `2862e66` | audit log |

## Gates — real output at `2862e66`

| gate | result |
| --- | --- |
| `npm run typecheck` | clean, **exit 0** |
| `npm test` | **3873 tests · 3872 pass · 0 fail · 1 skipped** · 1.88 s · **exit 0** |
| `npm run lint` | no errors, no warnings, **exit 0** |

Green, and green over three of the defects below. The suite is still 100 % static
source-regex plus pure-module calls; nothing added in these commits changed that.

**The deployed server gate was verified, not assumed.** `mcp__supabase__get_edge_function
garment-search` returns a bundle containing `TRAILING_WORDS`, `NFKD`, `word === 'accessories'`
and the literal `titleNamesGarment && !isGarmentWord(head)`, and no longer contains
`'bottle'`. The redeploy claim in `FINDINGS.md` is true — which means **V2-3 and V2-4 below
are live in production right now**, on the browse path as well as the shelf.

---

# CONFIRMED

## V2-1 (S1) — UX-22 was never repaired. The code claimed for it does not exist.

`src/components/onboarding/ten-camera.tsx:277` · commit message of `02e5f59` ·
`docs/eng/audit-2026-09-02/FINDINGS.md:118`

Both the commit message ("The Ten's Library door recovers into the camera ask after a
cancelled picker (UX-22)") and the audit log ("Ten library-cancel → ask") record this as
repaired. Executed:

```
$ git diff 1b85923 HEAD -- src/components/onboarding/ten-camera.tsx
(no output)
$ grep -rn "libraryDismissed" src/
(no matches)
```

`ten-camera.tsx` is byte-identical to its pre-repair state; `libraryDismissed` does not
appear anywhere in `src/`. The guard is still

```ts
// ten-camera.tsx:277
if (access === 'unasked' && start !== 'library') {
```

and its comment still asserts the thing UX-22 falsified: *"`start === 'library'` never
reaches here… there is nothing to ask permission for."* The auto-pick effect
(`:234-239`) is unchanged, so a cancelled picker still leaves `access === 'unasked'`,
`stage={null}` (`:318`), a disabled shutter, the sheet foot still instructing the reader
to "shoot", and **no path from that screen to the OS prompt**. The S1 is live and
unchanged, and it is now recorded as closed in two places.

**Scenario:** unchanged from UX-22 — new account, camera undetermined, tap a slot's
**Library**, cancel the picker.

## V2-2 (S1, **new regression introduced by the UX-32 repair**) — a Saved Looks timeout now draws the **empty state**

`src/app/saved-looks/index.tsx:131` · `src/features/saved-looks/states.ts:106-117` ·
render at `:264-268`

The repair changed `failed: load.failed` → `failed: load.state === 'error'` so that a
timeout stops inflating `saved_state_shown{state:'error'}`. It fixed the metric by
breaking the screen. Walked with the shipped resolver:

| `load.state` | `loading` | `failed` | `offline` | `resolveSavedListState` | rendered |
| --- | --- | --- | --- | --- | --- |
| `skeleton` | true | false | false | `loading` | skeleton (`:264`) |
| **`timeout`** | **false** | **false** | **false** | **`empty`** (`states.ts:116`, `savedCount === 0`) | **"nothing kept yet" (`:268`)** |
| `error` | false | true | — | `error` | `SavedErrorState` (`:266`) |

On a first read that has not returned, `saves.isError` is false and `rows` is `[]`, so
`offline` is false too and nothing rescues it. The screen tells a reader with a full
shelf that they have kept nothing, six seconds into an unfinished read — the exact claim
`isSavedListEmpty`'s own docblock forbids (`states.ts:121-126`: *"neither `offline` nor
`error` knows more than that it could not read — none of the three is entitled to an
empty state's claim"*). `SavedErrorState`'s `timedOut` prop at `:267` is now unreachable:
`kind === 'error'` can no longer be produced by a timeout, so `BOUNDED_TIMEOUT_COPY`
never renders on this route.

Before the repair the timeout drew the correct screen with the wrong analytics label.
Now it draws the wrong screen. This is strictly worse than UX-32.

**Repro:** open `/saved-looks` with the network black-holed on an account that has saves.

**Why the suite cannot see it:** `resolveSavedListState` is a pure module and is tested
exhaustively — with `failed` as an *input*. Nothing tests the mapping from `load.state`
to that input.

## V2-3 (S1, **new regression**, DEPLOYED) — the head-noun rule drops ordinary merchant titles: 13 of 20 real ones

`src/features/explore/shop-feed.ts:493-506, 576` · `supabase/functions/garment-search/fashion-gate.ts:404` (**live**)

```ts
if (titleNamesGarment && !isGarmentWord(head)) return false;
```

`headWord` walks back from the end of the title past `TRAILING_WORDS` (colours, sizes,
pack words) and pure digits, and `isGarmentWord` accepts only keys of
`FASHION_CATEGORY_LABELS`. The set of words a merchant actually puts *after* the garment
noun is far larger than `TRAILING_WORDS`: fabrics, fits, finishes, necklines, washes,
measurements and marketing suffixes. Every one of them now deletes the product.

Executed against the shipped predicate (harness in the session scratchpad, 95 rows):

| dropped | head noun |
| --- | --- |
| `Chelsea Boots Black Leather` | `leather` |
| `Denim Jacket Mid Wash` | `wash` |
| `Cotton Shirt Long Sleeve` | `sleeve` |
| `Trousers Slim Fit` | `fit` |
| `Polo Shirt Pique` | `pique` |
| `Wool Coat Navy Melton` | `melton` |
| `Leather Jacket UK 12` | `uk` |
| `Silk Scarf 90x90` / `Silk Scarf 90cm` | `90x90` / `90cm` (not `/^\d+$/`) |
| `Wide Leg Jeans 32 Inseam` | `inseam` |
| `Puffer Jacket Water Repellent` | `repellent` |
| `Merino Sweater Crew Neck` | `neck` |
| `Oxford Shirt Button Down` | `down` |
| `Cropped Trousers Ankle Length` | `length` |
| `Bomber Jacket Reversible` | `reversible` |
| `Cotton Dress Sleeveless` | `sleeveless` |
| `T-Shirt Bra` | `bra` — **not a key in `FASHION_CATEGORY_LABELS`** |

**13 of the 20** realistic titles in the probe set were dropped. Two of the twelve titles
the coordinator named — `Silk Scarf 90cm` and `T-Shirt Bra` — are in that set; the other
ten behave correctly.

The rule is also asymmetric in a way that will surprise: `Sports Bra` **passes** (no
garment word anywhere in the title, so `titleNamesGarment` is false and the head is never
checked) while `T-Shirt Bra` **fails**. Adding a garment word to a title makes the gate
stricter, not looser.

This is live on both copies; `garment-search` is deployed with it, so it culls the
browse answer as well as the Explore shelf, and `use-shop-feed.ts`'s `cards` metric
(0 or ≥4 only, UX-15) cannot see the difference between this and an empty catalogue.

## V2-4 (S2, **new regression**, DEPLOYED) — pet apparel now passes the category gate

`src/features/explore/shop-feed.ts:521-532` (mirror `fashion-gate.ts:358-380`)

The UX-8 repair reordered `categoryVerdict` to garment nouns → generic fashion words →
veto → `accessories`. The **generic** loop now runs *before* the veto loop, so any
non-fashion department whose leaf says "Apparel" or "Clothing" reads as fashion and the
department word never fires:

| category | verdict | result |
| --- | --- | --- |
| `Pet Supplies > Dog Apparel` | **fashion** (`apparel` at generic, `pet` never reached) | `Dog Coat` **admitted** |
| `Pet Supplies > Dog Clothing` | **fashion** | `Dog Coats` **admitted** |
| `Pets > Pet Apparel` | **fashion** | `Cat Sweater` **admitted** |

Under the old veto-first order all three were refused. The same hole is open for any
`<vetoed department> > … > Apparel` breadcrumb. Live on the deployed gate.

## V2-5 (S2) — UX-5 is fixed for the deep link and **not** for the scenario it was written about

`src/app/membership-thanks.tsx:84` (fixed) vs `:105` (unchanged)

```ts
const planKnown = !plan.loading && plan.paid;      // repaired
planName={`Cinch ${PLANS[plan.plan].name}`}         // still the FOLDED plan
```

`plan.plan` is `foldPlan(serverPlan, sdkPlan)` and `foldPlan` takes the **higher** of the
two (`plan-fold.ts:27-30`). Enumerating the reachable `usePlan` states (harness over the
real `derive` in `use-plan.ts:191-204`):

| row / trial / SDK | `plan` | `paid` | thanks says |
| --- | --- | --- | --- |
| free, trial live, SDK **standard** | **pro** | **true** | **"Cinch Pro is active."** |

That is UX-5's own scenario verbatim — *"a gifted-trial account that buys Standard sees,
during the lag: Cinch Pro is active"* — and it still says Pro. The repair only closes the
half where nothing was bought (`paid === false` → `planKnown` false → the honest
"still confirming" sentence, which is a genuine improvement over the old
`plan !== 'free'`).

The same state is wrong on three more surfaces, and they now agree with each other on
the wrong tier (executed, one row per distinct `(plan, paid, trialing)`):

| surface | drawn for that account |
| --- | --- |
| Settings row (`membership-row.ts`) | `Cinch Pro — 1,000 active pieces` |
| MB-08 (`membership-body.tsx`) | masthead **Pro**, manageable |
| MB-09 (`upgradeSurface`) | kind **`at-top`** → *"already on Pro"* refusal — **hides the Standard→Pro upgrade from someone who can make it** |
| Profile (`planDoorFor`) | `route: 'none'`, no action — no door at all |

Given `cinch-superwall-webhook-gap` (the plan write is still unproven against a real
transaction), this window is not necessarily seconds long.

## V2-6 (S2) — "NOTHING IS CANCELLED" is still false on the retry path, and the first-load timeout's button now issues no request at all

`src/lib/use-bounded-load.ts:55-56, 82`

```ts
const retryOut = error && fetching;
const waiting  = (loading && !error) || retryOut;
…
if (fetching && !error) return;   // skip onRetry
```

The guard fires only while `error` is false. React-query v5 keeps `status: 'error'`
through a `refetch()` of a failed query, so during a **retry that hangs** both `error`
and `fetching` are true, the guard does not fire, `onRetry()` runs, and
`refetch({cancelRefetch: true})` throws the in-flight retry away and restarts the clock —
exactly UX-33, in the one state a reader is most likely to tap twice. Walked:

| step | `loading` | `error` | `fetching` | state | tap does |
| --- | --- | --- | --- | --- | --- |
| first load hangs | T | F | T | `skeleton` → 6 s → **`timeout`** | resets clock, **no refetch** |
| lands late | F | F | F | `content` | — |
| error → tap | F | T | T | **`skeleton`** (was: error + "Trying…") | refetch |
| that retry hangs | F | T | T | 6 s → **`timeout`** ✓ (UX-29 fixed) | **cancels + restarts** ✗ |
| retry fails | F | T | F | `error` ✓ | — |
| content → background refetch | F | F | T | `content` ✓ — no skeleton, no timeout | — |

Two things follow that the docblock does not say:

1. **A hung first read can no longer be re-issued.** The only control on the timeout
   screen now re-arms a 6 s clock over a request that may never settle. The captive-portal
   case the cluster exists for is precisely the case where a fresh request is the thing
   that would work, and it is the case where the button now does nothing to the network.
2. **A retry from `error` replaces the error page with a full skeleton** (`loading: loading || retryOut`, `:87`).
   That is a new visual behaviour at all thirteen wired routes; `retrying: retrying || retryOut`
   (`:98`) therefore never reaches an `ErrorState` on that path, so "Trying…" is dead code there.

Neither `use-bounded-load.ts` nor `route-state.tsx` has a single test (UX-39 unchanged) —
and this is now the most intricate module in the repair.

## V2-7 (S2) — **four** call sites are still half-bounded, not five, and two of them cannot be fixed at the call site

`src/app/saved.tsx:52` · `src/app/board/[id].tsx:67` ·
`src/app/activity/invitation/[id].tsx:124` · `src/app/activity/reaction/[id].tsx:119`

Seventeen `useBoundedLoad` call sites exist in `src/` (not 18). `44f4745` wired `fetching`
into 13. The four above still pass none, so `retryOut` is permanently false there and
**UX-29 is live on them exactly as written**: a retry from `error` arms no timer, and if
it hangs the route sits on a disabled "Trying…" forever.

- `saved.tsx` and `board/[id].tsx` read a composed `useLookbook()`, whose returned object
  (`src/features/boards/use-lookbook.ts:52-63`) exposes `loading`, `error`, `retrying`
  and `refetch` and **no `isFetching`**. Fixing these needs a change to the hook, which
  is why they were skipped; the commit does not say so.
- The two activity routes compose `loading` from two queries
  (`event.isLoading || invitations.isLoading`) and pass `error: event.isError` only.

Board and Saved are the two routes UX-30/UX-31 were about, so the cluster's flagship
screens are the ones left unbounded.

## V2-8 (S2) — UX-8's three named lexical accidents are **not** fixed, and two more real garments are still dropped

Executed over the corpus in UX-8 (25 rows): 19 now pass, **6 still drop**.

| title | category | why it still drops |
| --- | --- | --- |
| `Silk Shirt` | `Home & Away Collection` | no garment noun in the **category**; `home` vetoes |
| `House of Sunny Knit Top` | `House of Sunny` | `house` vetoes |
| `Lawn Kurta Shirt` | `Lawn Collection` | `lawn` vetoes |
| `Tailored Office Trousers` | `Office & Workwear` | `workwear` is in neither list; `office` vetoes |
| `Art Print Tee` | `Art & Graphic Tees` | **`tee`/`tees` is not a key in `FASHION_CATEGORY_LABELS`**; `art` vetoes |
| `Rug Tapestry Knit Jumper` | `Knitwear` | **`jumper` is not a key**, so `titleNamesGarment` is false and the `!titleNamesGarment && containsWord(title,'rug')` arm fires |

The repair's rule is "a garment word in the **category** beats a department word". It
cannot reach a category that contains no garment word — which is what all three of
UX-8's "pure lexical accidents" were. `tee`, `tees`, `jumper` and `bra` are all absent
from the 26-noun expansion, and each absence is now load-bearing twice over: once for
`categoryVerdict` and once for the new head-noun rule.

## V2-9 (S2) — UX-21 is half-repaired; the sentence it contradicts is unchanged, and the sibling screen was not touched

`src/components/privacy/ai-consent-page.tsx:224` · `:141` · `:25-27` ·
`src/components/privacy/delete-account-page.tsx:97`

`Disclosure` does honour `defaultOpen` when uncontrolled (`disclosure.tsx:90,98` —
`useState(defaultOpen)`, `isControlled` false with no `open` prop), it is `variant="row"`
so the `summary` renders, and the record inside is verbatim: one `<Text>` per
`CONSENT_FACTS` entry, `fact.lead` + `fact.rest`, unmodified. That half is real.

What is not repaired:

- The intro still reads *"…**The wording below is the same wording you saw then.**"*
  (`:141`) and what is immediately below it is still `CONSENT_SUMMARY` — three sentences
  written on 2026-09-02 that no account agreed to. The repair's own comment concedes it:
  *"The summary still leads; the record still follows."*
- The file docblock (`:25-27`) still cites the atlas rule the page breaks: *"the
  withdrawal screen shows the original wording, not a summary of it."*
- `delete-account-page.tsx:97` — the same shape UX-21 flagged — did **not** get
  `defaultOpen`. `DELETION_HORIZONS` is still one tap down.
- UX-23 (`variant="link"` silently drops `summary`) and UX-24 (`ALL_COPY`) are untouched;
  UX-25 stands — nothing under `tests/` imports `disclosure.tsx`.

## V2-10 (S3) — the drift test guards less than before, and the new head-noun test certifies only the cases that work

`tests/explore-shop-feed.test.ts:450-477` (four blocks) and `:478-501` (new)

- The mirror test still compares **only** `FASHION_CATEGORY_LABELS`,
  `GENERIC_FASHION_CATEGORY_WORDS`, `NON_FASHION_CATEGORY_WORDS`,
  `NON_APPAREL_TITLE_WORDS`. `43c2f9a` added a **fifth shared list**, `TRAILING_WORDS`
  (`shop-feed.ts:476`, `fashion-gate.ts:322`), and it is not in the loop. The two copies
  are byte-identical today — verified — and can now diverge silently on 117 words.
- `wordsOf`, `containsWord`, `headWord`, `isGarmentWord`, `categoryVerdict` and the
  predicate body are still uncompared (UX-10 unchanged). They are identical today; I
  diffed them.
- The new test's four drops are the four the author already had in hand
  (`Rotating Shoe Rack Tower`, `Shoe Care Kit`, `Sock Ornaments Set`,
  `Canvas Tote for Laptop`) and its three keeps —
  `Chelsea Boot Black`, `Silk Blouse in Navy`, `Merino Sweater - Oatmeal, M` — are all
  trailing-**colour/size** cases, i.e. exactly the class `TRAILING_WORDS` covers. Not one
  keep exercises a fabric, fit, finish or measurement suffix, which is the entire failure
  set in V2-3. The test asserts the rule works on the inputs the rule was written from.

## V2-11 (S3) — `MembershipSurface.owned`'s paid branch is unreachable, and is wrong where it would be reached

`src/features/membership/membership-surface.ts:82-89, 113`

```ts
owned: input.paid ? input.plan : 'free',
```

Both consumers sit inside branches that are only rendered for non-paid accounts:
`membership-body.tsx:319,322` under `surface.comparison` (true only for `trialing`/`free`)
and `upgrade-body.tsx:177,180` under `kind === 'plans'` (same two). Executed over every
distinct reachable `(plan, paid, trialing)`, the comparison column is `free→standard` /
`free→pro` in every row that draws one and `-` in every paid row. **`owned` is provably
the constant `'free'` at both call sites**, so the ternary's true arm is dead.

That matters because the true arm is also wrong: for the V2-5 account it yields `'pro'`
for someone who owns Standard. The field's docblock promises "the tier the account
OWNS"; what it computes is "the folded plan, when paying". A future call site that trusts
the docblock inherits V2-5.

UX-1 itself is **fixed** — the trialing account now gets two tables built from `free`
(4 rows and 5 rows, all gains), and the Pro plate is no longer filtered out.

## V2-12 (S3) — Saved Looks analytics: the timeout retry is now invisible, and `loading` re-fires on every retry

`src/app/saved-looks/index.tsx:118-122, 184-188` · `src/lib/use-bounded-load.ts:82`

- `saved_retry_tapped` is tracked **inside `onRetry`**. `retry()` skips `onRetry` whenever
  `fetching && !error` — which is the whole first-load-timeout state. So every retry
  tapped from a timeout is now uncounted, on the event whose own declaration calls it
  *"the numerator for whether recovery works"*.
- `stateShown` is keyed on `state.kind` (`:188`). A retry from `error` now passes through
  `skeleton` (V2-6), so `saved_state_shown{state:'loading'}` re-fires on every retry and
  `{state:'error'}` re-fires when it fails again. UX-32's second bullet is unchanged.
- Combined with V2-2, a timeout now emits **nothing at all** (`kind: 'empty'` is not in
  the three tracked states and `drawsGrid` is false), so the timeout regime is
  analytically invisible rather than mislabelled.

## V2-13 (S3) — UX-9 residuals: 17 of 18 plural junk titles now drop; five singular non-garments still pass

Executed. Dropped by the plural-aware `containsWord` + head-noun rule: `Scented Candle
Holders`, `Sock Ornaments Set`, `Blackout Curtains`, `Phone Chargers Bundle`, `Ceramic
Mugs Gift Set`, `Memory Foam Pillows`, `Beach Towels 2-Pack`, `Fridge Magnets Pack`,
`Bath Rugs`, `Wall Decals`, `Table Lamps`, `Vinyl Posters`, `Car Bumpers`, `Jigsaw
Puzzles`, `USB Adapters`, `Cabinets and Shelving`, `Coat Racks`. That is a real fix.

Still admitted under `Accessories`:

| title | why |
| --- | --- |
| `Water Bottles 3-Pack` | `bottle` was removed from `NON_APPAREL_TITLE_WORDS` for "bottle green" (UX-8b) and nothing replaced it |
| `Silicone Phone Case` | `case` is in no list; `phone` is a **category** veto word only |
| `Leather Dog Collar` | `collar` and `dog` are in no title list |
| `Car Seat Cover` | `cover`/`seat` in no list; `car` is category-only |
| `Silicone Oven Gloves` | `gloves` is a garment word → `titleNamesGarment`, head `gloves` → passes on `class === slot` |

`Hat Rack`, `Shoe Rack`, `Shoe Racks 2-Pack`, `Rotating Shoe Rack Tower`,
`Bag of 3 Mugs` and `Tote for Laptop` all correctly drop.

## V2-14 (S3) — the partner shelf still bypasses the gate entirely

`src/features/explore/shop-feed.ts:781` — `partnerShelfCards` applies no
`isConfidentFashion`, unchanged. The server twin (`index.ts` `partnerFeed`) still filters
by merchant id and slot and never calls `isFashionFamily`. UX-8's closing paragraph is
untouched, and it is the one path that reaches the shelf marked `paid: true`. UX-17's
unbounded-title hazard rides the same path.

## V2-15 — UX-34 is genuinely and completely fixed (with two notes)

`src/components/media/garment-fallback.tsx:113-128`

Recomputed over the full 104-entry `NAMED` table, compositing correctly — RN applies
`opacity` to the whole rendered group, so **both** the pill ground and the ink are drawn
at 0.94 over the swatch:

```
text-on-pill: below 4.5:1 = 0    below 3:1 = 0
worst 14.21:1 (white #f7f7f5) … best 14.78:1 (black)
```

Every wardrobe colour clears AA for 11 px type by a factor of three. Two notes, neither
an AA failure:

- **The pill is invisible on pale grounds.** Pill-vs-swatch is below 3:1 on **48 of 104**
  colours (worst 1.03 on `white`). On those the label simply looks like ink on the tile,
  which is what it already did and which already passed — cosmetic only.
- **The pill will clip at accessibility sizes.** `maxFontSizeMultiplier` is unset on
  screen (`:123`), the tile parent is `overflow-hidden` (`:110`), and `lines` defaults to
  2. In a 74 pt tile the pill's own `px-2 py-0.5` sits inside the parent's `px-1.5`, so it
  cannot overflow horizontally (text wraps and truncates at 2 lines) — but at AX5
  (11 pt × 3.0, two lines ≈ 80 pt plus the pill's padding) the rounded ground itself is
  clipped by the tile. UX-40's related note is unchanged, and **`spoken` is still passed
  by no caller** (7 call sites checked), so the VoiceOver half of UX-40 stands.

## Cleared — checked and correct

- **UX-1.** `owned` is `'free'` in both comparison branches; a trialing account now gets
  both plates built as gains. Executed against the real `PLANS`/`planDelta`.
- **UX-2.** `upsellBubbleFor` returns `null` on `paid` first (`upsell-bubble.ts:117`) and
  `UpsellRow`'s `paying = paid` (`upsell-bubble.tsx:144`); `(tabs)/index.tsx:2219` wires
  it. The once-per-session slot is not spent, because `claimUpsellBubble()` is behind the
  `next &&` short-circuit.
- **UX-4.** `membershipRowFor` branches on `input.trialing && !input.paid` (`:127`); the
  Settings row and `/membership` now agree in every reachable state except V2-5's.
- **UX-3, module level.** `membershipCopyFor` reads `paid` first. Worth recording that
  UX-3's user-facing claim was overstated: `membership-copy.ts` has exactly two callers
  (`src/app/privacy/delete.tsx:39` and a dev fixture) and neither draws a "Manage" row.
  Profile's real membership surface is `planDoorFor` (`profile-spec.ts:316-338`), which
  takes **no `paid`** and was not touched; it has never had a Manage control. The only
  in-app manage hand-off is `/membership` and `/membership-thanks`, both already
  `paid`-aware.
- **UX-6 / UX-30 / UX-38's zero-height half.** `style={{flexGrow:1}}` with the default
  `flexBasis: auto` makes the ScrollView size to its content in an unflexed parent, so it
  draws instead of clipping to nothing. Confirmed at `notifications.tsx:93`
  (`px-gutter pb-24 pt-6`, no flexGrow), `board-page.tsx:149` and `saved-page.tsx:181`
  (`<View className="pt-4">`), `activity/*/[id].tsx:148/161` (`paddingTop: 8`),
  `repeat-outfit.tsx:257` (`mt-2`), `friends-page.tsx:667`, `invite-page.tsx:155`.
  In bounded parents with one grower (`route-state.tsx:87`, `(tabs)/plan.tsx:823`,
  `(tabs)/closet.tsx:274`, `event/[id]/comments.tsx:397,409`) the rendered result is
  identical to `flex-1`: content height plus all free space. **No caller has a second
  flex sibling**, so the basis change cannot redistribute space anywhere.
- **`bounces={false}` is not harmful on Plan or Closet.** It disables rubber-band
  overscroll only; a ScrollView whose content exceeds its frame still scrolls. Both
  callers give it a bounded `flex-1 pb-24` parent, so the AX-size "scroll to reach Try
  again" that directive #35 added still works.
- **UX-7, for the case it was written about.** Diary's error branch sets
  `contentContainerStyle={{flexGrow:1}}` (`diary-page.tsx:151-153`) so the inner
  ErrorState is exactly viewport height with shorter content — not scrollable — and
  `bounces={false}` lets the pan reach the outer `RefreshControl`.
- **UX-28.** `boundedErrorCopy('error', undefined)` now returns `BOUNDED_ERROR_COPY`
  (`bounded-load.ts:149,154`) and `tests/bounded-load.test.ts:135-141` asserts it. The
  blank-screen arm is unreachable.
- **UX-31.** `board-page.tsx:140` is now `!loading && !error && !timedOut`; it matches
  `saved-page.tsx:122`. The two files agree.
- **UX-29's first half.** Where `fetching` *is* passed (13 sites), a retry that hangs
  now arms the clock and reaches `timeout`. Walked above.
- **Background refetch over content** does not produce a skeleton or a timeout at any
  site: `retryOut` needs `error`, and `loading` is `isPending`.
- **Client/server gate parity.** All five shared lists and every matching rule are
  byte-identical between `shop-feed.ts` and `fashion-gate.ts` today, and the deployed
  bundle carries the same rules. Only doc-comments differ.

---

# PLAUSIBLE — needs a device

## V2-P1 — the same `flexGrow` change can push the retry off-screen at AX sizes in a **bounded** parent

`error-state.tsx:151-152` · `(tabs)/plan.tsx:823` · `(tabs)/closet.tsx:274` · `route-state.tsx:90`

`flexBasis: auto` means the ErrorState's base size is its **content** height. RN's default
`flexShrink` is `0`. So in a bounded flex column where the content is taller than the free
space, the item keeps its content height and overflows its parent instead of being clamped
to the free space and scrolling internally — which is what `flexBasis: 0` used to
guarantee. If that happens, the inner ScrollView's frame equals its content, it is not
scrollable, and the retry sits below the visible area with no gesture to reach it: the
exact directive-#35 defect the comment above the change says it fixes.

The uncertainty is Yoga's treatment of `RCTScrollView`'s intrinsic height, which is the
same uncertainty that decides whether the UX-6 fix works at all — the two are the same
mechanism read in opposite directions. Worth one AX5 pass over Plan's week failure and
Closet's read failure on a short device (SE).

## V2-P2 — UX-7 returns at accessibility sizes

Same mechanism. Once the ErrorState's content outgrows the diary viewport the inner
ScrollView becomes scrollable, `bounces={false}` no longer releases the pan, and the outer
`RefreshControl` is unreachable again. Default size is fine.

## V2-P3 — `Disclosure`'s `defaultOpen` is initial state only

`disclosure.tsx:98`. If `ai-consent-page` is ever re-rendered with a different
`defaultOpen`, or the record is toggled shut and the reader navigates back within the same
mount, the open state persists as the reader left it. Correct for a disclosure; noted only
because "open by default" is now a legal claim about the screen.

---

# RANKED SUMMARY

| # | sev | finding | file:line | what I ran |
| --- | --- | --- | --- | --- |
| V2-1 | **S1** | UX-22 never repaired; `ten-camera.tsx` untouched, `libraryDismissed` absent, and it is logged as fixed twice | `ten-camera.tsx:277` | `git diff 1b85923 HEAD --`, `grep -rn libraryDismissed src/` |
| V2-2 | **S1** | **new**: a Saved Looks timeout now renders the **empty** state; `SavedErrorState`'s `timedOut` is unreachable | `saved-looks/index.tsx:131,268`, `states.ts:116` | walked the resolver over the three `load.state` values |
| V2-3 | **S1** | **new, DEPLOYED**: head-noun rule drops 13/20 ordinary merchant titles (fabric/fit/finish/measurement suffixes); `T-Shirt Bra` fails while `Sports Bra` passes | `shop-feed.ts:576`, `fashion-gate.ts:404` | 95-row corpus through the shipped predicate |
| V2-4 | S2 | **new, DEPLOYED**: `Pet Supplies > Dog Apparel` reads as fashion — generic loop runs before the veto | `shop-feed.ts:521-532` | same corpus |
| V2-5 | S2 | UX-5 unfixed for its own scenario: trial + Standard purchase still names **Pro** on thanks, Settings, MB-08, and is refused the upgrade by MB-09 | `membership-thanks.tsx:105`, `plan-fold.ts:27` | enumerated every reachable `usePlan` state |
| V2-6 | S2 | UX-33 half-true: a retry tapped during a retry-timeout still cancels; and a hung first read can no longer be re-issued at all | `use-bounded-load.ts:55,82,87` | react-query v5 state table, walked |
| V2-7 | S2 | **four** sites still half-bounded (UX-29 live); two of them can't be fixed without changing `useLookbook` | `saved.tsx:52`, `board/[id].tsx:67`, `activity/*/[id].tsx:124,119` | enumerated all 17 call sites |
| V2-8 | S2 | UX-8's three named lexical accidents still drop, plus `Office & Workwear`, `Art & Graphic Tees` (`tee` missing), `Rug… Jumper` (`jumper` missing) | `shop-feed.ts:521-532,576` | 25-row UX-8 corpus |
| V2-9 | S2 | UX-21 half-fixed: summary still leads, intro sentence and docblock unchanged, `delete-account-page.tsx` not touched | `ai-consent-page.tsx:141,224,25-27`; `delete-account-page.tsx:97` | read `Disclosure`'s controlled/uncontrolled path |
| V2-10 | S3 | drift test still guards 4 of 5 lists and no rules; `TRAILING_WORDS` is a new unguarded shared list; the new head-noun test's keeps are all trailing-colour cases | `explore-shop-feed.test.ts:450-501` | diffed both copies region by region |
| V2-11 | S3 | `MembershipSurface.owned`'s paid arm is unreachable at both consumers and wrong where it would be reached | `membership-surface.ts:113` | enumeration; comparison column `-` on every paid row |
| V2-12 | S3 | `saved_retry_tapped` now misses every timeout retry; `stateShown('loading')` re-fires on every retry | `saved-looks/index.tsx:118,188`, `use-bounded-load.ts:82` | traced `retry()` |
| V2-13 | S3 | UX-9: 17/18 junk titles now drop; `Water Bottles 3-Pack`, `Phone Case`, `Dog Collar`, `Car Seat Cover`, `Oven Gloves` still pass | `shop-feed.ts:411-448` | corpus |
| V2-14 | S3 | partner shelf still ungated, client and server | `shop-feed.ts:781` | read |
| V2-P1 | PLAUS. | `flexBasis: auto` + `flexShrink: 0` can overflow a bounded parent at AX sizes and strand the retry | `error-state.tsx:151` | reasoning only — needs an SE at AX5 |
| V2-P2 | PLAUS. | UX-7 returns once the error content outgrows the diary viewport | `diary-page.tsx:148-153` | same |
| — | ✓ | **UX-34 fixed outright**: 0/104 below 4.5:1, worst 14.21:1 | `garment-fallback.tsx:113-128` | recomputed WCAG over `NAMED`, group opacity composited |
| — | ✓ | UX-1, UX-2, UX-4, UX-28, UX-31, UX-29 (13 sites), UX-6/30/38 zero-height, UX-7 default size | — | above |

**Three things to fix first.**

1. **V2-1** — the Ten's camera hole is an unrepaired S1 that two records say is closed.
   Nothing else on this list is a lie in the log.
2. **V2-2 and V2-3** are both regressions the repair introduced, both green under the
   suite, and V2-3 is deployed. V2-3 is culling normal apparel out of a shelf whose only
   metric (`cards`) reports 0 or ≥4, so it will not appear in PostHog as anything but an
   empty catalogue.
3. **V2-6** — the bounded-load hook is now the most intricate module in the merge and is
   the only one with no test at all. The `fetching` change is correct in three of the six
   walked transitions and changes visible behaviour in two more.

## Method

- Read `verification-ux.md` in full, then `git show` of each of the five repair commits.
- Executed the shipped modules rather than reading them: an esbuild bundle (the same
  toolchain `scripts/run-tests.mjs` uses) over `membershipSurface`, `upgradeSurface`,
  `membershipRowFor`, `membershipCopyFor`, `upsellBubbleFor`, `planDoorFor` and
  `planDelta`, driven by a faithful reimplementation of `usePlan`'s own derivation
  (`use-plan.ts:191-204`) across `rowPlan × paidLapsed × trialing × sdkPlan`, deduplicated
  to the distinct `(plan, paid, trialing)` triples, plus a `loading`/`unconfirmed` sweep.
- A 95-row title corpus through the shipped `isConfidentFashion`: UX-8's 25 garments,
  UX-9's 18 plural junk titles and 5 singular non-garments, the coordinator's 12, 15
  new-misfire probes, and 20 ordinary merchant titles built to end in fabric/fit/finish/
  measurement words.
- WCAG ratios recomputed over the 104-entry `NAMED` table in Python, compositing the
  group `opacity` onto both the pill ground and the ink.
- Region-by-region diff of `shop-feed.ts` against `fashion-gate.ts`, and a content check
  of the **deployed** `garment-search` bundle via the Supabase MCP.
- `npm run typecheck`, `npm test`, `npm run lint` re-run at `2862e66`; output above.
- Nothing under `src/`, `supabase/`, `tests/` or `scripts/` was modified. Harnesses live
  in the session scratchpad only.

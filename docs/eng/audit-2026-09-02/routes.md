# Route & screen inventory — 2026-09-02

Scope: `src/app` (expo-router ~57.0.13, expo ~57.0.13, RN 0.86.2, `experiments.typedRoutes: true`,
`experiments.reactCompiler: true` — `app.config.ts:622`). Audit only; no files under `src/`, `supabase/`,
`tests/`, `scripts/` were modified. Method: exhaustive `rg`/`find` over `src/app`, `src/features`,
`src/components`, `web/`; cross-checked against the generated `.expo/types/router.d.ts`; verified with
a full `npx tsc --noEmit -p .` run (0 errors — see §4).

---

## 1. Route inventory

`src/app` contains **88 files**: 6 layouts, 1 catch-all (`+not-found.tsx`), and **81 screen routes**.

### Layouts (no path of their own)

| File | Scope |
|---|---|
| `src/app/_layout.tsx` | Root `Stack` — anchors on `(tabs)` (`unstable_settings.anchor`), owns the auth gate, and is the single place every screen's presentation (`modal` / `formSheet` / default card) is declared (see §7) |
| `src/app/(auth)/_layout.tsx` | Plain `Stack`, `headerShown:false` |
| `src/app/(tabs)/_layout.tsx` | `NativeTabs` — 5 tabs: Today, Closet, Stylist, Plan, Explore |
| `src/app/event/_layout.tsx` | `Stack`, registers `new`, `[id]/comments`, `[id]/invite` as `formSheet` overrides |
| `src/app/friends/_layout.tsx` | Plain `Stack`, `headerShown:false` |
| `src/app/groups/_layout.tsx` | Plain `Stack`, `headerShown:false` |

### Screens (81), file → route path

Route groups `(auth)` and `(tabs)` are invisible in the path (both resolve at the un-grouped path,
confirmed in `.expo/types/router.d.ts`, e.g. `${'/(auth)'}/code | /code`).

**(auth) — 7:** `code.tsx`→`/code`, `email.tsx`→`/email`, `handoff.tsx`→`/handoff`, `name.tsx`→`/name`,
`phone.tsx`→`/phone`, `quiz.tsx`→`/quiz`, `sign-in.tsx`→`/sign-in`

**(tabs) — 5:** `index.tsx`→`/`, `closet.tsx`→`/closet`, `explore.tsx`→`/explore`, `plan.tsx`→`/plan`,
`stylist.tsx`→`/stylist`

**Root singles — 33:** `activity.tsx`→`/activity`, `add-clothes.tsx`→`/add-clothes`,
`auth-callback.tsx`→`/auth-callback`, `borrow.tsx`→`/borrow`, `camera-unavailable.tsx`→`/camera-unavailable`,
`capture.tsx`→`/capture`, `compose.tsx`→`/compose`, `diary.tsx`→`/diary`, `find-photo.tsx`→`/find-photo`,
`gap-feed.tsx`→`/gap-feed`, `help.tsx`→`/help`, `invite-arrival.tsx`→`/invite-arrival`, `invite.tsx`→`/invite`,
`membership-thanks.tsx`→`/membership-thanks`, `membership-upgrade.tsx`→`/membership-upgrade`,
`membership.tsx`→`/membership`, `notifications.tsx`→`/notifications`, `people-search.tsx`→`/people-search`,
`pinterest-callback.tsx`→`/pinterest-callback`, `privacy.tsx`→`/privacy`, `profile.tsx`→`/profile`,
`recreate.tsx`→`/recreate`, `repeat-outfit.tsx`→`/repeat-outfit`, `reveal.tsx`→`/reveal`, `review.tsx`→`/review`,
`saved.tsx`→`/saved`, `settings.tsx`→`/settings`, `storage.tsx`→`/storage`, `style-profile.tsx`→`/style-profile`,
`the-ten.tsx`→`/the-ten`, `tour.tsx`→`/tour`, `wall-swap.tsx`→`/wall-swap`, `+not-found.tsx`→ catch-all

**Nested/dynamic — 41:**
`activity/invitation/[id].tsx`, `activity/reaction/[id].tsx`,
`board/[id].tsx`,
`diary/[id].tsx`,
`event/[id]/index.tsx`→`/event/[id]`, `event/[id]/comments.tsx`, `event/[id]/invite.tsx`,
`event/[id]/outfits.tsx`, `event/[id]/post.tsx`, `event/new.tsx`,
`friends/index.tsx`→`/friends`, `friends/[userId].tsx`, `friends/blocked.tsx`,
`gap-feed/[kind].tsx`,
`groups/index.tsx`→`/groups`, `groups/[circleId]/index.tsx`→`/groups/[circleId]`,
`groups/[circleId]/invite.tsx`, `groups/[circleId]/manage.tsx`, `groups/create.tsx`,
`help/[id].tsx`, `help/write.tsx`,
`item/[id].tsx`,
`privacy/ai.tsx`, `privacy/delete.tsx`, `privacy/export.tsx`, `privacy/pinterest.tsx`, `privacy/visibility.tsx`,
`saved-looks/index.tsx`→`/saved-looks`, `saved-looks/[saveId].tsx`,
`saved-looks/collections/index.tsx`→`/saved-looks/collections`,
`saved-looks/collections/[collectionId].tsx`, `saved-looks/collections/new.tsx`,
`trips/index.tsx`→`/trips`, `trips/[id].tsx`,
`walkthrough/index.tsx`→`/walkthrough`, `walkthrough/ceiling.tsx`, `walkthrough/review.tsx`

This matches `.expo/types/router.d.ts` exactly — every file above appears in the generated
`hrefInputParams`/`hrefOutputParams` union, and nothing appears there that isn't a file above.

---

## 2 & 3. Reachability graph, orphans, dev-fixture guarding

### Navigation call sites found (production `src/`, excluding `src/dev-fixtures`)

| Kind | Count |
|---|---|
| `router.push(...)` | 160 |
| `router.replace(...)` | 72 |
| `router.navigate(...)` | 4 |
| `router.dismissTo(...)` | 4 |
| `<Link href>` | 2 (`src/features/explore/new-addition-row.tsx:221`, plus `Link.MenuAction` in `(tabs)/explore.tsx:495` which isn't a navigation link) |
| `<Redirect href>` | 0 — none in the codebase |
| `Linking.openURL(...)` | 20 — **all external** (App Store subscriptions, Apple/OpenTable reservation URLs, `cinchstyle.com/privacy`, gap-feed/partner-shop merchant URLs, write-review URL). None targets an in-app `cinch://` route. |

Of the 248 `router.*` calls, every literal and object-form `pathname` resolves to one of the 81 screens
above; the 21 calls using an `as Href` cast (`src/app/settings.tsx:194`, `src/app/capture.tsx:291-293`,
`src/app/the-ten.tsx` ×8, `src/app/profile.tsx` ×3, `src/app/add-clothes.tsx` ×4,
`src/app/camera-unavailable.tsx:42-44`, `src/app/(tabs)/index.tsx:2174`, `src/app/(tabs)/stylist.tsx:312`)
were traced by hand to their source constant/prop and also resolve to real routes
(e.g. `door.action.href` ← `src/features/stylist/stylist-spec.ts:99` = `/recreate`;
`INVITE_ROUTE` ← `src/features/social-graph/people-search-spec.ts:28` = `/invite`;
`PACKING_HREF` ← `src/features/boards/packing-handoff.ts:59` = `/(tabs)/plan`).

Every screen is reachable from at least one call site **except**:

- **`/phone`** (`src/app/(auth)/phone.tsx`) — no `router.push`/`Link` anywhere targets `/phone`. Confirmed
  intentional: `PHONE_SIGN_IN_ENABLED = false` in `src/features/auth/auth-run-spec.ts:248` hides the
  welcome screen's phone door; `src/features/auth/actions.ts:324-325` documents "no user can reach this
  in a shipping build." The route file itself is still compiled into the bundle and is reachable by a
  hand-typed `cinch://phone` deep link. Matches the standing memory note
  (`cinch-phone-signin-pending-flip.md`): shipped dark pending Twilio toll-free approval.
- **`/repeat-outfit`** (`src/app/repeat-outfit.tsx`) — no internal navigation call targets it either.
  The file's own header comment (`src/app/repeat-outfit.tsx:36-46`) says so explicitly: reachable "only
  by hand" via `cinch://repeat-outfit?itemIds=…`, built for a lock-screen notification (P-04) that has
  never shipped — confirmed separately: no `addNotificationResponseReceivedListener` /
  `getLastNotificationResponse` call exists anywhere in `src/` (`expo-notifications` is installed and
  used only for local-preference reads/writes in `src/features/push/`, not for tap-to-navigate).

No other screen is orphaned. `/auth-callback` and `/pinterest-callback` have no internal `router.push`
either, but that's correct for OAuth-callback landing screens — they're reached only by the external
redirect (`cinch://auth-callback`, `cinch://pinterest-callback` — `src/features/recreate/pinterest.ts:60`),
which is the intended entry point.

### Dev fixtures — genuinely disconnected, not just runtime-guarded

`src/dev-fixtures/` holds **281 files** (incl. `dev-screens.tsx`, an index of every fixture) and
`src/components/dev/` holds 2 more (`fixtures.ts`, `ten-fixtures.ts`). A repo-wide search
(`rg "dev-fixtures"` outside that folder, and `rg "components/dev/(fixtures|ten-fixtures)"` outside
that folder) returns **zero hits** — nothing in `src/app`, `src/features`, or `src/components` imports
from either directory.

This isn't accidental — it's an enforced pattern, and it's the right one:

- The fixtures used to live under `src/app/dev-*.tsx` (205 files, 22,592 lines per the commit history)
  and shipped into the production bundle every time, mitigated only by a runtime bounce.
- They now live outside the router root entirely, mounted back in only via symlinks from
  `scripts/dev-fixtures.mjs on` for local review, and unmounted with `... off` before commit/build. The
  symlinks are deliberately **not** git-ignored (so `git status` nags if left mounted) and the script is
  deliberately **not** wired into `package.json` (so it never touches the native-build fingerprint).
- `find src/app -type l` confirms **no symlinks are currently mounted** — the working tree audited here
  ships zero dev routes.
- `src/app/_layout.tsx:150-165` still carries a defence-in-depth guard
  (`segments[0]?.startsWith('dev-')` → bounce to `/(tabs)` or `/(auth)/sign-in` unless `__DEV__`), in case
  a fixture is ever re-mounted and forgotten. It is currently unreachable dead code (no route it could
  fire on exists), and the test suite says so on purpose:
  `tests/dev-route-exclusion.test.ts:84-91` ("the release-build guard is kept even though it is now
  unreachable").
- Enforcement is by filesystem-fact tests, not convention: `tests/dev-route-exclusion.test.ts` asserts
  (a) the router root registers no `dev-*` file at any depth, (b) the fixtures still exist outside it,
  (c) no production source imports a fixture, and (d) the mount helper only ever deletes symlinks.
  `tests/dev-route-index.test.ts` keeps `dev-screens.tsx`'s own index from going stale against the
  fixture directory's actual contents.

**Conclusion for §3: this is the correctly-built version of "dev-fixture routes reachable only in dev,"
verified rather than assumed.** The two real orphans are `/phone` and `/repeat-outfit`, both documented,
both intentional-for-now.

---

## 4. Dangling navigation targets

**None found.** Two independent checks:

1. `npx tsc --noEmit -p .` — **0 errors.** With `typedRoutes: true`, every non-cast `router.push`/
   `router.replace`/`Link href` call is type-checked against the generated `ExpoRouter.__routes` union
   in `.expo/types/router.d.ts`; a typo'd or deleted-screen target would be a compile error. It isn't.
2. The 21 `as Href`-cast call sites (which bypass that type check by construction) were traced by hand
   (§2) to real routes — none is dangling either.

No stale references to a deleted screen were found (e.g. no `/piece`, no old `/lately`, no leftover
`/friends.tsx`-style path).

---

## 5. Duplicate route pairs

**None exist in the current tree.** Checked every name the task flagged as a candidate
(`activity`, `diary`, `friends`, `gap-feed`, `help`, `privacy`, `saved-looks`) plus `groups`, `trips`,
`walkthrough`, `event`: for each, either a flat `name.tsx` exists (`activity.tsx`, `diary.tsx`,
`gap-feed.tsx`, `help.tsx`, `privacy.tsx`) **or** a `name/index.tsx` exists (`friends/index.tsx`,
`saved-looks/index.tsx`, `groups/index.tsx`, `trips/index.tsx`, `walkthrough/index.tsx`) — never both.
The apparent "pair" in each case is the flat file next to a same-named **directory** that holds only
dynamic/nested children (`diary.tsx` + `diary/[id].tsx`, `help.tsx` + `help/[id].tsx` + `help/write.tsx`,
etc.), which is not a collision.

Confirmed this isn't just luck: `node_modules/expo-router/build/getRoutesCore.js:398` throws
`"The route files "<a>" and "<b>" conflict on the route "<path>". Remove or rename one of these files."`
at route-graph build time if a flat file and a same-path `index.tsx` ever coexist — expo-router v57 does
not silently pick a winner, it fails the build. Since `.expo/types/router.d.ts` generated cleanly and
`tsc` passes, no such conflict exists right now. If one is ever introduced, it will fail loudly (metro
bundling / `expo start`), not silently drop a screen.

---

## 6. Universal links (AASA) vs. expected app paths

`web/.well-known/apple-app-site-association` (served with `Content-Type: application/json` per
`web/vercel.json`):

```json
{
  "applinks": {
    "details": [{
      "appIDs": ["THR27ADF4P.com.nelsonsaenz.cinch"],
      "components": [{ "/": "/i/*", "comment": "Invite links only. Everything else on this domain stays in the browser." }]
    }]
  }
}
```

Only **`/i/*`** is a universal link. Comparing against every candidate the task named:

| Path | Exists on the web? | Exists as an app route? | AASA-covered? |
|---|---|---|---|
| `/i/*` | Yes — `web/vercel.json` rewrites `/i/:handle` → `/api/invite?handle=:handle` (`web/api/invite.js:2,261` builds the link as `cinchstyle.com/i/@handle`, and the app's own invite parser at `src/features/invite/link.ts:111-129` accepts `cinch://i/@sophie` and `cinch://invite/sophie` as the custom-scheme equivalent) | Handled via `useInviteDeepLink` (`src/app/_layout.tsx:141`), not a file route | Yes |
| `/open` | No | No | N/A — hypothetical, not built |
| `/closet` | No | Yes, as `(tabs)/closet.tsx` (in-app only, not a web path) | Not applicable/needed |
| `/membership` | No | Yes, as `membership.tsx` (in-app only) | Not applicable/needed |

There is no email-CTA flow in this codebase that links to `cinchstyle.com/open`, `/closet`, or
`/membership` — grepped `web/`, `supabase/functions/*/mail.ts`, and `supabase/migrations/`
for `cinchstyle.com` and found only `hello@mail.cinchstyle.com` (the support/build-export/commerce-health
sender address) and the invite link. **The AASA's single component matches the site's single real route
exactly** — nothing is under- or over-declared. If `/open`, `/closet`, or `/membership` email CTAs are
built later, they'll need both a `web/api/*` handler (the CSP is `default-src 'none'`, so each needs its
own server-rendered function like `invite.js`) and a new AASA `components` entry, or they'll open Safari
instead of the app.

---

## 7. Per-screen header / back affordance, modal & formSheet presentations

The whole app renders with `headerShown:false` (`src/app/_layout.tsx:365`, and every nested `_layout`)
— **there is no native header anywhere**; every screen supplies its own back/close control or relies on
its presentation type's native dismissal. `fullScreenGestureEnabled:true` is set app-wide, so a swipe from
anywhere on a pushed card (not just the left edge) pops it.

**Presentation types, as declared in `src/app/_layout.tsx` (root) and `src/app/event/_layout.tsx`:**

| Presentation | Screens |
|---|---|
| `modal` | `add-clothes`, `capture` |
| `fullScreenModal` | `review`, `walkthrough/index`, `walkthrough/review` |
| `formSheet` (full-height, `sheetAllowedDetents:[1]`, grabber visible, 38pt radius) | `profile`, `settings`, `recreate`, `style-profile`, `privacy`, `help` (and its children `help/[id]`, `help/write` inherit it), `notifications`, `diary` (and `diary/[id]` inherits), `people-search`, `saved-looks/collections/new`, `saved-looks/collections/[collectionId]` |
| `formSheet` (event group, `event/_layout.tsx`) | `event/new` (30pt radius), `event/[id]/comments` (30pt), `event/[id]/invite` (0.75/1 detents, 38pt) |
| default card | everything else (≈60 screens), including all `(tabs)`, all `(auth)` except handoff/name (see below), `activity*`, `board/[id]`, `diary/[id]` — wait, inherits sheet — `friends/*`, `groups/*`, `item/[id]`, `trips/*`, `saved-looks/index`, `saved-looks/[saveId]`, `the-ten`, `tour`, `reveal`, `membership*`, `wall-swap`, `walkthrough/ceiling` |

All `formSheet` screens are natively swipe-to-dismiss (grabber visible) regardless of whether they also
draw an explicit close/back control — not a stuck-user risk, though a VoiceOver user depends on an
explicit control since a swipe gesture isn't independently discoverable; worth a follow-up a11y pass but
out of scope here.

**Screens with no back/exit control of any kind found (by design, verified individually):**

- **`src/app/(auth)/name.tsx`** — no back control, and the file says why (line ~38): "the account exists
  by now," it's a forced step after account creation.
- **`src/app/(auth)/quiz.tsx`** — exits only via its own Save/Skip inside the questionnaire flow; a
  `router.replace`, never sits under anything on the back stack.
- **`src/app/tour.tsx`** — has an explicit `onSkip` (line 137) wired to `exit('tabs')`; not stuck.
- **`src/app/walkthrough/ceiling.tsx`** — genuinely has **no exit affordance on either of its two phases**
  (`WalkthroughChrome` is rendered with no `exit` prop at both call sites, lines 112 and 192; the
  component's own doc comment at `src/components/intake/walkthrough-parts.tsx:54` says the exit slot is
  "omitted entirely on phases that have none"). It is not registered with an explicit stack presentation
  in `_layout.tsx` either (unlike sibling `walkthrough/index` and `walkthrough/review`, both
  `fullScreenModal`), so it uses the default card + swipe-back, but it's reached via `router.replace`
  from `walkthrough/review.tsx:85`, which leaves nothing underneath to swipe back to. The only way
  forward is `confirm()` (line 79) → `resolveIntakeCeiling` → `router.replace('/reveal')`; if that call
  throws, the `try/finally` clears the loading flag but there is no `catch` and no error UI, so a failed
  confirm leaves the reader on a screen with a re-enabled button and no explanation, still with no way
  back. This matches the file's own framing ("M-07 is a beat, not a screen someone navigates away from
  and back to") — a deliberate forced-progression design, not an oversight, but worth flagging since a
  network failure here has no recovery path other than retrying the same action.
- **`src/app/repeat-outfit.tsx`** — worse: the **success** state (pieces found) has a `"Show another"`
  button (line 210) that calls `router.replace('/')`, which does function as an exit even though the
  label reads like it should show a different outfit rather than leave. But the **empty/not-found**
  state (`pieces.length === 0`, lines 231-235 — wardrobe loaded and the item ids from the deep link don't
  match anything currently in the closet) and the **loading** state render with **no button of any
  kind** — no back, no home, nothing. A user opening a stale or malformed `cinch://repeat-outfit`
  deep link with no matching item ids is stranded on a screen reading "This outfit isn't in your closet
  any more." with zero way to leave except the OS-level app-switcher.

Every other screen checked (formSheet/modal group, plus a spot-check of `+not-found.tsx` — has an
explicit "Back to Today" button, `reveal.tsx` — four separate primary-action exits to `/(tabs)`,
`invite-arrival.tsx` — `toCloset`/`toCapture` exits, `auth-callback.tsx`/`pinterest-callback.tsx` — always
resolve to either a signed-in destination or back to sign-in) has a working way out.

---

## Top 15 findings

1. **`src/dev-fixtures/` (281 files) and `src/components/dev/{fixtures,ten-fixtures}.ts` are completely
   disconnected from the app** — zero imports from anywhere outside those folders, confirmed by full-repo
   grep. This is intentional and enforced by `tests/dev-route-exclusion.test.ts` (filesystem-fact tests)
   and mounted only via symlinks from `scripts/dev-fixtures.mjs` for local review; none are mounted in
   this working tree (`find src/app -type l` → empty).
2. **`/repeat-outfit` (`src/app/repeat-outfit.tsx`) has no back/exit control at all in its
   empty/not-found and loading states** (lines ~213-235) — a stale or malformed deep link
   (`cinch://repeat-outfit?itemIds=…`) strands the user with no way out except the app switcher. The
   success state's exit button is labeled "Show another" but actually does `router.replace('/')`
   (line 210).
3. **`/walkthrough/ceiling` (`src/app/walkthrough/ceiling.tsx:112,192`) has no exit affordance on either
   phase** — `WalkthroughChrome` is rendered with no `exit` prop, by design ("a beat, not a screen…"),
   but a failed `resolveIntakeCeiling()` call (line 79-87) has no `catch`/error UI, leaving the reader on
   a re-enabled button with no explanation and still no way back.
4. **`/phone` (`src/app/(auth)/phone.tsx`) is an orphan route** — no `router.push`/`Link` targets it
   anywhere; gated off via `PHONE_SIGN_IN_ENABLED = false` in
   `src/features/auth/auth-run-spec.ts:248`. Matches the standing memory note
   (`cinch-phone-signin-pending-flip.md`, shipped dark pending Twilio approval) — the file still ships in
   the binary and is reachable by a hand-typed `cinch://phone`.
5. **`/repeat-outfit` is also an orphan from the in-app navigation graph**, not just from its own UI — no
   internal `router.push`/`Link` reaches it either; the file's own comment
   (`src/app/repeat-outfit.tsx:36-46`) says it's reachable "only by hand," built for a P-04 lock-screen
   notification that was never wired up.
6. **No push-notification tap handler exists anywhere in `src/`** — `rg` for
   `addNotificationResponseReceivedListener`/`getLastNotificationResponse` returns zero hits.
   `expo-notifications` (`package.json:35`) is installed and used only for reading/writing local
   preferences (`src/features/push/`), never for tap-to-navigate. This is the root cause behind finding 5.
7. **No dangling navigation targets exist** — `npx tsc --noEmit -p .` passes with 0 errors under
   `typedRoutes: true`, which type-checks every non-cast `router.push`/`replace`/`Link href` against the
   generated route union; the 21 `as Href`-cast call sites were traced by hand and all resolve to real
   routes too.
8. **No duplicate flat-file/`index.tsx` route pairs exist** in the current tree (checked `activity`,
   `diary`, `friends`, `gap-feed`, `help`, `privacy`, `saved-looks`, `groups`, `trips`, `walkthrough`,
   `event` — every one is flat-only or directory-only, never both). Confirmed this isn't accidental:
   `node_modules/expo-router/build/getRoutesCore.js:398` throws a hard build error on a real collision —
   expo-router v57 does not silently pick a winner between `x.tsx` and `x/index.tsx`.
9. **The AASA (`web/.well-known/apple-app-site-association`) covers exactly one component, `/i/*`**,
   which exactly matches the site's one real dynamic route (`web/vercel.json`'s `/i/:handle` rewrite to
   `web/api/invite.js`). The task's hypothesized `/open`, `/closet`, `/membership` universal-link paths
   do not exist anywhere in the codebase (no web page, no AASA entry, no email CTA referencing them) —
   they're not under-covered, they're simply not built yet.
10. **Every screen renders with `headerShown:false`** (`src/app/_layout.tsx:365` and all nested
    `_layout.tsx` files) — there is no native header anywhere in the app; every screen supplies its own
    back/close control or relies on `formSheet`'s native swipe-dismiss.
11. **11 screens use `formSheet` presentation** (`profile`, `settings`, `recreate`, `style-profile`,
    `privacy`, `help`, `notifications`, `diary`, `people-search`,
    `saved-looks/collections/new`, `saved-looks/collections/[collectionId]`, plus `event/new`,
    `event/[id]/comments`, `event/[id]/invite` in the event group) — all natively swipe-dismissable via
    a visible grabber, which is not a discoverable affordance for VoiceOver users without an explicit
    control (flagged, not scored — out of this audit's scope).
12. **2 screens use `modal`** (`add-clothes`, `capture`) and **3 use `fullScreenModal`**
    (`review`, `walkthrough/index`, `walkthrough/review`) — `walkthrough/ceiling`, despite being the
    third screen in the same walkthrough flow, is notably *not* given an explicit presentation and falls
    through to the default card (see finding 3).
13. **All `Linking.openURL` calls (20 total) target external URLs only** — App Store subscriptions,
    reservation platforms, the privacy-policy page, and gap-feed/partner-shop merchant links. None opens
    an in-app `cinch://` route, so there's no internal-navigation risk from that surface.
14. **`.expo/types/router.d.ts`'s generated route union matches the filesystem exactly** — every one of
    the 81 screens appears in it, and nothing else does, confirming the type-checker's route graph is
    current (not stale from a prior build).
15. **`/auth-callback` and `/pinterest-callback` are correctly deep-link-only screens** (no internal
    `router.push` targets either, by design — they're OAuth-callback landing pages reached via
    `cinch://auth-callback` / `cinch://pinterest-callback`), and both resolve deterministically to either
    a signed-in destination or a fallback (`/(auth)/sign-in` or the closet) with no possibility of hanging
    indefinitely on a normal response.

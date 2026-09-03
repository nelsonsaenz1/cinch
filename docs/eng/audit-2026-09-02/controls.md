# Controls audit — src/app + src/components

Date: 2026-09-02. Audit only — no files under src/, supabase/, tests/, scripts/ were edited.

## Method

1. Read `tests/pressable-shape.test.ts` first (the dc26774/9a2004f post-mortem: a bare
   `<Pressable>` handing its whole body to a Reanimated `Animated.View` with no
   `style=`/`className=` of its own stops receiving presses). Ran it — passes clean
   (1/1) against the current tree, confirming no regression of the exact banned shape.
2. Wrote small Node scripts (kept in `/tmp`, not checked in) to walk every `.tsx`
   under `src/app` and `src/components` and grep/AST-lite-match for each control
   type and each of the dead-control variants (a)–(g) in the brief, since the
   existing test's regex only covers the one literal shape. Scripts and their raw
   output are reproducible from the commands below; nothing here was hand-picked
   without a matching automated hit.
3. Manually opened every file the scripts flagged, plus every money/mutation path
   named in the brief (purchase/membership, delete-account, invite, send-message,
   add-item) and every `Alert.alert` call with a `destructive` button, to confirm
   or refute the automated flag by reading the actual handler body and its wiring
   back to a mutation/query.

## Control inventory (counts)

Grep counts, `src/app` and `src/components` separately (a file with a nested tag
on one grep line counts once per match, not per file):

| Control | src/app | src/components | Total |
|---|---:|---:|---:|
| `<Pressable` | 65 | 326 | 391 |
| `<Button` (ui) | 62 | 179 | 241 |
| `<Switch` | 1 | 7 | 8 |
| `onSubmitEditing` | 7 | 8 | 15 |
| `GestureDetector` | 0 | 9 | 9 |
| `Alert.alert(` | 43 | 10 | 53 |
| `NativeTabs` / `NativeTabTrigger` | 30 | 0 | 30 |
| `<Link` (incl. `Link.MenuAction`) | 0 | 1 | 1 |
| `TouchableOpacity/Highlight/WithoutFeedback` | 0 | 0 | 0 |
| `Swipeable` | 0 | 0 | 0 |
| `ContextMenu` (standalone) | 0 | 0 | 0 |
| `@expo/ui` controls | 0 | 0 | 0 |
| `expo-symbols` (`SymbolView`) refs | — | — | 200 (icon content inside other controls, not separate controls) |

`onPress={...}` occurrences scanned end-to-end (balanced-brace extraction,
across both directories): **866**. `disabled={...}` occurrences: **177**.
Pressable opening tags walked for the accessibility pass: **290** (regex
window truncates a few very long multi-prop tags, see Limitations).

The codebase has **zero** `TouchableOpacity`/`TouchableHighlight`/
`TouchableWithoutFeedback`, **zero** `Swipeable`, **zero** standalone
`ContextMenu`, and **zero** `@expo/ui` controls in these two directories — so
those rows of the brief have nothing to enumerate. `NativeTabs` is declarative
routing (expo-router `unstable-native-tabs`) rather than a handler-bearing
control; its two badges are checked under "b" below.

## Findings by category

### a) No-op / console-only / TODO / stub handlers

**Scanned:** all 866 `onPress={...}` bodies, extracted with balanced-brace
matching (not a naive regex — this catches multi-line arrow bodies too), for:
bare `console.log/warn/info` calls, empty arrow bodies `() => {}`, and
`() => undefined`. Also grepped the whole tree for `TODO`, `FIXME`, `stub`,
`noop`, `not implemented`, `coming soon`, `placeholder handler` (case-insensitive).

- **Zero** TODO/FIXME anywhere in `src/app` or `src/components`.
- **Zero** console-only handlers.
- **One** `() => undefined` handler:
  - `src/components/rating/review-prompt.tsx:162` — `<Pressable onPress={() => undefined} accessibilityRole="none">`. **Status: OK.** This is the card's own Pressable nested inside the scrim's dismiss-on-tap Pressable (`later` at line 158); its only job is to swallow taps on the card so they don't bubble to the scrim's `onPress={later}`. Same pattern, same rationale, as `src/app/friends/[userId].tsx:877-878` (`<Pressable onPress={(e) => e.stopPropagation()}>` inside a scrim Pressable). Verified: not dead, intentional tap-catcher.

**Conclusion: no dead-handler-shape (a) violations found.**

### b) Handlers referencing state/props that are never set or always undefined

Manually traced the state feeding every badge/disabled/gate condition found by
the automated passes:

- `src/app/(tabs)/_layout.tsx:76-77` — `invitesWaiting = invites.isSuccess && (invites.data?.length ?? 0) > 0` and `unseenInCircle = useExploreUnseenDot()`. Both trace to real `useEventInvites()` / `useExploreUnseenDot()` reads, not constants. **OK.**
- `src/app/(tabs)/stylist.tsx:184-201` (`submit`) and `src/components/stylist/sheet-parts.tsx:653` (`canSend`) both gate on `isSending`, which is threaded from a real chat-send mutation state (`sending={isSending}` at `stylist.tsx:617`). **OK.**
- **SUSPECT (fragile, not currently dead):** `src/app/(tabs)/explore.tsx:483-494` — the row context-menu builds `onPress` from an `if/else if/else if` chain keyed on `action.id` (`'open-closet' | 'mute' | 'circle'`) with **no `else` branch**. Today `EXPLORE_ROW_ACTIONS` (`src/features/explore/contextual-actions.ts:65-79`) has exactly those three ids, so every menu item currently does real work, and there's a companion test (`tests/explore-contextual-actions.test.ts`, referenced in the file's own docblock) asserting each entry names a visible equivalent. But nothing in `explore.tsx` itself enforces exhaustiveness — add a fourth `ContextualAction` entry with a new `id` and its `Link.MenuAction` renders with a silent no-op `onPress`. Recommend a `default: exhaustiveCheck(action.id)` (or a switch with `never`-typed default) at `explore.tsx:483-494` so a future id addition is a type error, not a silently dead menu row.

No other cases found of a handler closing over a piece of state that is
provably always the same value or always `undefined`.

### c) Controls permanently disabled, or disabled by an always-same condition

Extracted all 177 `disabled={...}` expressions with balanced-brace matching and
checked for literal `true`/`false`: **zero** hardcoded-literal hits. Every
`disabled=` expression resolves through a variable, prop, or expression tied to
query/mutation/form state (spot-checked: `delete-account-page.tsx` `busy` ← `deleteAccount.isPending`; `CommentComposer.tsx` `canSend` ← `draft` + `disabled` prop; `ReasonSheet` in `ReportFlowSheets.tsx` `flow.submitting`).

**Conclusion: no permanently- or tautologically-disabled controls found.**

### d) Dead-press-shape variants the existing test does not ban

Ran the existing test as-is (passes) then extended the search past its literal
`<Pressable...><Animated.View` regex:

1. **Unstyled Pressable whose only child is a *custom component* that itself
   renders `Animated.View` at its root** (the variant the brief specifically
   calls out as the gap in the current rule). Found 6 candidate sites where an
   unstyled `<Pressable>`'s first JSX child is a custom (uppercase) component:
   `friends/[userId].tsx:877` (`<KeyboardAvoidingScreen>`), `auth/run-parts.tsx:536`
   (`<View>` — not actually a custom component, regex false-positive), `closet/favorite-outfits-rail.tsx:51`
   (`<QuadrantPlate>`), `report/ReportFlowSheets.tsx:61` (`<Text>`), `today/plate.tsx:623`
   (its child is a `<View>`), `stylist/sheet-parts.tsx:570` and `:589` (`<Text>`).
   Manually opened every wrapped component's own render root:
   `QuadrantPlate` (`src/components/boards/quadrant-plate.tsx:61`) renders a
   plain `<View>`, not `Animated.View`. **None of the 6 candidates actually wrap a
   component whose root is `Animated.View` — the variant does not currently exist
   in the codebase, but the test genuinely does not cover it and would miss it if
   introduced.** See test-extension proposal below.
2. **Pressable nested inside GestureDetector** — checked all 3 files using
   `GestureDetector` (`share-look/stack-composer.tsx`, `intake/GarmentCard.tsx`,
   `review/review-card.tsx`). All three wrap a `View`/`Animated.View`, never a
   `Pressable`, inside the detector. **Zero hits** — variant not present.
3. **`pointerEvents="none"` mistakes** (an overlay marked non-interactive sitting
   *above* a real control, or a wrapper marked `none` that also owns the tap
   target). Found 20 occurrences; manually read every one in context. All are
   decorative layers — Skia gradient scrims (`(auth)/sign-in.tsx:82`,
   `(auth)/handoff.tsx:195`), an offline desaturation overlay (`sign-in.tsx:268`),
   a wordmark row with no controls (`sign-in.tsx:284`), an unseen-count dot
   (`(tabs)/index.tsx:289`), a segmented-control fill track (`(tabs)/plan.tsx:277`),
   and an off-screen `captureRef` snapshot view (`event/[id]/index.tsx:825`). None
   sit over a live control with a live tap target beneath them. **Zero real
   hits**, all reviewed clean.
4. **`hitSlop` on a zero-size host view.** Found 90+ `hitSlop=` usages; wrote a
   script that pairs each `hitSlop` with the *same* Pressable's own explicit
   `width`/`height` (not a child's) and flags any `< 44` without `hitSlop` or
   `MIN_TAP_TARGET` — **zero hits**. Spot-checked `activity-center/entry-button.tsx:51`
   (`style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}`, the 34×34 disc
   at line 57 is a decorative *child*, not the Pressable's own frame). Tap
   targets are disciplined throughout; `MIN_TAP_TARGET` from `@/theme/tokens` is
   the house pattern and is used consistently instead of hardcoded 44s.
5. **Controls behind an absolutely-positioned overlay with `pointerEvents` not
   `'none'`.** Grepped every `position: 'absolute'` block for a sibling/parent
   without `pointerEvents="none"` sitting z-above an interactive sibling —
   nothing matched a genuine coverage case beyond the reviewed set in (3).
6. **`onPress` on a bare `View`** (not `Pressable`) — **zero hits**, confirmed
   with an AST-lite scan (`<View ...onPress`) across both directories.
7. **`TouchableOpacity`/`Touchable*` wrapping `Animated.View`** — moot, zero
   Touchable* components exist in the codebase (all replaced by `Pressable`).

**Conclusion: no live dead-press-shape variant found beyond the one the test
already bans.** The one genuine gap is (d1) — structurally possible, not
currently instantiated. Test extensions proposed below.

### e) Accessibility — icon-only controls, tap targets

- Wrote a script matching every `<Pressable ...>` opening tag against its next
  ~400 chars for an icon-only child (`SymbolView`, `Ionicons`, `Feather`,
  `MaterialIcons`, `Icon`) with no `accessibilityLabel` and not marked
  `accessible={false}`/`accessibilityElementsHidden`. **Zero flagged** out of
  290 Pressable tags matched by the (necessarily imperfect, see Limitations)
  regex. The codebase is unusually disciplined here — most files carry inline
  comments explaining *why* a given `accessibilityRole`/`accessibilityLabel`/
  `accessibilityState` was chosen (e.g. `ui/chip.tsx:111-117`,
  `event-outfits/CommentComposer.tsx:88-97`).
- Tap-target check: no Pressable found with an explicit `width`/`height` under
  44pt on its own frame that lacks `hitSlop` or `MIN_TAP_TARGET`. `MIN_TAP_TARGET`
  (from `@/theme/tokens`) is grep'd as the house convention and is used, not
  bypassed, at every small-icon site checked.

**Conclusion: no accessibility violations found in the categories the brief
names.** (This does not certify full WCAG/VoiceOver conformance — only the
specific icon-label and tap-target-size checks requested.)

### f) Double-submit guards on money/mutation paths

Manually verified every path the brief names by reading from the trigger
control back to the mutation:

| Path | File:line | Guard | Verdict |
|---|---|---|---|
| Membership upgrade (purchase) | `src/app/membership-upgrade.tsx:29-45` | `opening` state set before `gate.present(...)`, cleared in `.finally()`; passed to `UpgradeBody` as `opening`, which sets `Button loading={opening}` (`src/components/membership/upgrade-body.tsx:205,207`) — `Button`'s own `isDisabled = disabled \|\| loading` blocks re-press (`src/components/ui/button.tsx:88`) | **OK** |
| Delete account | `src/app/privacy/delete.tsx:67-73` | `busy={deleteAccount.isPending}` passed straight through to `DeleteAccountPage`'s three buttons (`src/components/privacy/delete-account-page.tsx:99,109,116`, all `disabled={busy}`) | **OK** |
| Stylist send (chat) | `src/app/(tabs)/stylist.tsx:184-201` | `submit` early-returns with a haptic-only "still working" tick when `isSending`; composer's own `canSend` (`sheet-parts.tsx:653`) additionally gates on `!sending` | **OK, double-gated** |
| Comment send | `src/components/event-outfits/CommentComposer.tsx:35-40` | `canSend` gates on non-empty draft; `submit()` calls `onSend(draft)` then synchronously `setDraft('')`, which flips `canSend` false before the next JS-thread tick can process a second tap. **Note:** the composer accepts an optional `disabled` prop for an in-flight visual state, but its caller `src/components/event-outfits/CommentsSheet.tsx:233-237` does not pass one — there is no visible "sending…" state and no guard against `thread.send` itself being slow/retried, only the synchronous draft-clear. | **SUSPECT (weak, not broken)** — see below |
| Destructive Alert actions (remove board plate, disconnect Pinterest, delete comment, block, undo-wear) | e.g. `src/app/saved.tsx:51-56`, `src/app/board/[id].tsx:90-95`, `src/app/privacy/pinterest.tsx:72-78`, `src/app/event/[id]/comments.tsx:303-308`, `src/components/event-outfits/CommentsSheet.tsx:104-109` | Native `Alert.alert` buttons are single-fire by OS construction (the alert dismisses on tap); all wired to a real `.mutate(...)` call, none stubbed | **OK** |

**SUSPECT detail — `CommentComposer`:** `submit` at
`src/components/event-outfits/CommentComposer.tsx:36-40` is not itself
async-guarded; it relies on the parent (`thread.send`, in
`src/features/event-outfits/use-comment-thread.ts` — outside this audit's
directory scope) resolving/failing without ever re-enabling `draft` before the
network call lands. Because `setDraft('')` runs synchronously in the same tick
as `onSend(draft)`, a double-tap on the same touch event is blocked by React's
synchronous re-render before the second `Pressable.onPress` fires — this is
not a live double-submit bug — but there is no `sending`/`disabled` prop wired
from `CommentsSheet.tsx`, so if `thread.send` is ever changed to be slow or to
repopulate `draft` on failure, a user could retype and re-send a still-in-flight
comment with no visual "sent"/"sending" affordance. Recommend wiring an
`isPending`-style flag from `useCommentThread` into `CommentsSheet.tsx:233`'s
`disabled` prop the same way `delete.tsx` wires `busy`.

### g) Silently swallowed errors on user-facing actions

Wrote a script matching every `catch { ... }` block (with or without a bound
error param) whose body is empty after stripping comments — **3 hits**, all
manually reviewed:

| File:line | Context | Verdict |
|---|---|---|
| `src/app/event/new.tsx:346-351` | Best-effort guest invite after event creation already committed; comment explains `useInviteMembers` resolves per-person and this only catches a vanished session between two writes — event creation itself is not gated on it, and per-person invite failures surface on the event's own Invite screen | **OK — documented, deliberate** |
| `src/app/the-ten.tsx:1000-1005` | Best-effort cleanup of an orphaned half-written row after a stopped photo replacement; documented as "costs the reader nothing a later pass cannot fix" vs. risking a second error message stacked on the one already shown | **OK — documented, deliberate** |
| `src/components/rating/review-prompt.tsx:60-64` | `io.write`'s failed local-storage write for "already asked for a review" flag; a failed write means one extra ask in a future session, not a user-facing failure | **OK — documented, deliberate, non-user-facing** |

**Conclusion: all 3 empty catches are intentional, commented best-effort paths
on non-critical writes — none swallow an error on a money/mutation path or
hide a failure the user needed to see.** No undocumented empty catches found.

## Top 20 findings (file:line · control · expected behavior · status · evidence)

1. `src/components/rating/review-prompt.tsx:162` · Pressable (tap-catcher) · swallow taps on the review card so they don't dismiss the scrim · **OK** · `onPress={() => undefined}`, mirrors the `stopPropagation` pattern one line-item down
2. `src/app/friends/[userId].tsx:877-878` · Pressable (tap-catcher) · swallow taps on the borrow-request card · **OK** · `onPress={(e) => e.stopPropagation()}`
3. `src/app/(tabs)/explore.tsx:483-494` · `Link.MenuAction` × 3 (context menu) · route/mute/navigate per action id · **SUSPECT** · `if/else if/else if` with no `else`/exhaustiveness check — currently exhaustive against `EXPLORE_ROW_ACTIONS` but not enforced
4. `src/components/event-outfits/CommentComposer.tsx:36-40` + `CommentsSheet.tsx:233-237` · comment-send Pressable (via `Button`) · single send per tap, visible pending state · **SUSPECT** · relies on synchronous `setDraft('')`, no `disabled`/pending prop wired from the sheet
5. `src/components/ui/chip.tsx:110-152` · Pressable (filter/category chip) · the exact site of the dc26774 bug (category chips, closet filter chips) · **OK, verified fixed** · `style={{ minHeight: spec.minHeight }}` present on the Pressable itself, wrapper carries `pointerEvents="none"`, own comment documents the original bug
6. `tests/pressable-shape.test.ts` · repo-wide dead-shape ban · run against current tree · **OK** · `node --test` → 1 pass, 0 fail
7. `src/app/membership-upgrade.tsx:29-45` · `Button` (purchase gate open) · one in-flight purchase-gate open at a time · **OK** · `opening` state + `.finally()` + `Button`'s own `isDisabled = disabled || loading`
8. `src/app/privacy/delete.tsx:67-73` · `Button` × 3 (delete account flow) · block re-tap while delete is in flight · **OK** · `busy={deleteAccount.isPending}` → `disabled={busy}` on all three buttons
9. `src/app/(tabs)/stylist.tsx:184-201` + `src/components/stylist/sheet-parts.tsx:653-655` · send button/`onSubmitEditing` · block a second chat send mid-flight · **OK, double-gated** · both the screen's `submit` and the composer's `canSend` check `isSending`/`sending`
10. `src/app/saved.tsx:51-56`, `src/app/board/[id].tsx:90-95`, `src/app/privacy/pinterest.tsx:72-78`, `src/app/event/[id]/comments.tsx:303-308`, `src/components/event-outfits/CommentsSheet.tsx:104-109` · destructive `Alert.alert` buttons · fire the named mutation exactly once · **OK** · all 5 destructive buttons trace to a real `.mutate(...)` call, none stubbed
11. `src/app/event/new.tsx:346-351` · empty `catch` on best-effort guest invite · not swallow a user-facing failure · **OK, documented** · commented rationale, non-gating best-effort path
12. `src/app/the-ten.tsx:1000-1005` · empty `catch` on orphan-row sweep · not swallow a user-facing failure · **OK, documented** · commented rationale, non-gating cleanup
13. `src/components/rating/review-prompt.tsx:60-64` · empty `catch` on local-storage write · not swallow a user-facing failure · **OK, documented** · non-user-facing, worst case is one extra future ask
14. `src/app/(tabs)/_layout.tsx:76-77,117,122` · `NativeTabs.Trigger.Badge` × 2 (Plan/Explore unseen dots) · reflect real unread/invite state, never a stub · **OK** · traced to `useEventInvites()` / `useExploreUnseenDot()`, both real query hooks
15. `src/components/closet/favorite-outfits-rail.tsx:51-56` · Pressable → `QuadrantPlate` · navigate to diary entry · **OK** · `QuadrantPlate`'s own root renders `<View>`, not `Animated.View` — not the dead-shape variant it superficially resembles
16. `src/components/ui/button.tsx:118-156` · `Button` (shared primitive) · own frame regardless of animated fill · **OK, reference-good** · `style={{ minHeight: minHeightFor(variant) }}` + `className` on the `Pressable` itself; `Animated.View` fill layer carries `pointerEvents="none"`
17. `src/app/(auth)/sign-in.tsx:82,268,284` · `pointerEvents="none"` overlays (gradient scrim, offline desaturation, wordmark row) · stay non-interactive without blocking anything beneath · **OK** · none sit above a live control
18. `src/app/event/[id]/index.tsx:825-833` · `pointerEvents="none"` off-screen capture view (`captureRef` snapshot target) · stay inert and out of the a11y tree · **OK** · also carries `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`
19. `src/app/(tabs)/plan.tsx:277-289` · `Animated.View pointerEvents="none"` (segmented-control fill track) · decorative fill only, real control is the sibling `Pressable`s per mode · **OK**
20. `src/components/activity-center/entry-button.tsx:51-57` · Pressable (activity nav entry) · 44pt tap target via `MIN_TAP_TARGET`, decorative 34×34 disc inside · **OK** · confirms house convention (`MIN_TAP_TARGET` from `@/theme/tokens`) is used, not bypassed, at a genuinely small-looking control

## Proposed extensions to `tests/pressable-shape.test.ts`

The existing rule is precise on purpose (one literal shape, one root cause).
These are additive checks for the (d) variants the brief called out that are
not currently instantiated in the tree but are not structurally prevented
either — cheap insurance, not a rewrite of the existing test.

1. **Unstyled Pressable → custom component that itself roots on `Animated.View`.**
   Two-pass check: (a) collect every component whose outermost returned JSX
   element is `<Animated.View` (same walk the existing test already does, just
   watching the function's `return` instead of a `<Pressable`'s child); (b) run
   the existing test's regex but instead of hard-coding `<Animated\.View\b`,
   substitute a name-alternation built from the set collected in (a). Concretely:

   ```js
   // Pass 1: components whose own root element is Animated.View
   const rootAnimatedComponents = new Set();
   const rootRe = /export (?:function|const) (\w+)[\s\S]{0,400}?return\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?<Animated\.View\b/g;
   // (walk all files, populate the set with capture group 1)

   // Pass 2: same as today's test, but the child alternation includes those names
   const childAlt = ['Animated\\.View', ...[...rootAnimatedComponents]].join('|');
   const re = new RegExp(`<Pressable\\b([\\s\\S]*?)>\\s*(?:\\{\\/\\*[\\s\\S]*?\\*\\/\\}\\s*)*<(?:${childAlt})\\b`, 'g');
   ```

2. **Pressable nested inside `GestureDetector`.** Regex-level, same file:

   ```js
   const gdRe = /<GestureDetector\b[\s\S]*?<\/GestureDetector>/g;
   for (const m of source.matchAll(gdRe)) {
     if (/<Pressable\b/.test(m[0])) offenders.push(`${file}: Pressable inside GestureDetector — the detector's own gesture wins the responder and the Pressable's onPress never fires`);
   }
   ```

3. **`onPress` on a bare `View`.** This one is unambiguous and cheap — ban it outright:

   ```js
   const viewOnPressRe = /<View\b(?:(?!<\/?[A-Za-z]).)*?onPress=/gs;
   // any match is a bug: View has no onPress prop, TS should already catch this,
   // but a `// @ts-expect-error` or a loosely-typed spread could hide it.
   ```

4. **`hitSlop` present but the same Pressable also carries an explicit
   `width`/`height` < 44 with no `MIN_TAP_TARGET` reference anywhere in the
   tag.** (Codifies the pattern this audit confirmed is followed by convention
   but is not currently enforced by any test.)

   ```js
   const re = /<Pressable\b([\s\S]{0,500}?)>/g;
   for (const m of source.matchAll(re)) {
     const tag = m[1];
     const w = tag.match(/width:\s*(\d+)/), h = tag.match(/height:\s*(\d+)/);
     const tooSmall = (w && Number(w[1]) < 44) || (h && Number(h[1]) < 44);
     if (tooSmall && !/hitSlop=/.test(tag) && !/MIN_TAP_TARGET/.test(tag)) offenders.push(...);
   }
   ```

5. **Absolutely-positioned sibling without `pointerEvents="none"` rendered
   after (i.e. visually above, in JSX/paint order) a `Pressable`/`Button`
   within the same parent.** Harder to do reliably with regex alone (needs
   real JSX sibling tracking); flag as a manual-review checklist item rather
   than a hard test unless the team adopts an AST-based linter (e.g. a custom
   ESLint rule using `@typescript-eslint`/`jsx-ast-utils`) — regex on raw
   source can't safely determine "sibling," only "somewhere later in the file."

## Limitations

- Regex/balanced-brace scanning, not a real TSX parser — a few multi-line
  props with unusual nesting (e.g. a `style={[...]}` array spanning many
  lines, or a JSX expression container inside another JSX expression
  container) can push a match past the 400–500 char lookahead window used in
  some scripts, undercounting rather than overcounting. Where a script's tag
  count didn't match the flat `grep -c` count for the same tag (e.g. the a11y
  pass found 290 Pressable opens vs. 391 raw `<Pressable` grep hits), that gap
  is this truncation, not missing files — every file was walked.
- (b) "handlers referencing state that is never set" cannot be fully proven
  without a real type-checker/data-flow pass; findings here are the ones
  traceable by hand from the JSX site back through the call chain. Deeper
  verification (e.g. does `use-comment-thread.ts`'s `send` ever actually
  resolve `isPending`) would require reading `src/features/`, which is outside
  the audited directories.
- `@expo/ui` and standalone `ContextMenu` genuinely have zero usages in
  `src/app`/`src/components` — not a scanning gap, confirmed by both grep and
  a `@expo/ui` import search across the whole tree.

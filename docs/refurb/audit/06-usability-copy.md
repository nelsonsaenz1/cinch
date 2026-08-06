# 06 — Usability, friction and interface copy

Read against `docs/refurb/CHARTER.md`. Every finding cites `file:line` and carries
one of the charter's classifications. Nothing here proposes a new page; every
proposed state is an empty/error/loading/permission/confirmation state, a sheet,
or an inline change inside the locked inventory.

Walked as a demanding user: sign-in → first capture → review → Today →
stylist → closet → item → plan (week / events / packing) → event create →
invite → board → comments → Lately → friends → borrow → profile → settings.

**Three root causes account for most of what follows.** They are named once here
and referenced by number rather than restated per finding.

- **R1 — There is no toast layer.** Every confirmation in the app is either a
  blocking `Alert`, or a state change on the control that was tapped, or
  nothing. `src/components/today/plate.tsx:407-412` says so out loud
  ("there is no toast layer to say more"). Wherever a mutation has no visible
  control to change, it is silent. This is the single largest source of
  "did that work?" in the app.
- **R2 — Mutation pending/error state is per-hook, not per-row.** `isPending`
  from one `useMutation` is read by every row on the screen, so acting on one
  item visibly disables its siblings; and several call sites pass `onSuccess`
  without `onError`, so failures are indistinguishable from no-ops.
- **R3 — The review deck has one entrance, and it self-destructs.** Detailed in
  E1.

---

## A. Global / navigation

- [fix inconsistency] `src/app/(tabs)/_layout.tsx:77` — the fourth tab is
  labelled **Explore**, but the screen it opens is titled **Lately**
  (`src/app/(tabs)/explore.tsx:144`) and the charter's locked inventory names
  the tab "Lately". A user taps a word and arrives at a different word. Fix:
  change the trigger label to `Lately`. Leave the route id, the file name and
  the `person.2` symbol alone — the label is the only user-facing string.
  Benefit: the tab bar stops disagreeing with the page it opens.

- [add missing state] Global, caused by **R1** — there is no non-blocking
  confirmation surface, so the app's choices are "interrupt with an Alert" or
  "say nothing". Proposal inside the locked inventory: one shared
  `<Notice>` component (a `label`-sized line on `tray`, `accessibilityLiveRegion="polite"`,
  auto-dismiss ~2.5s, respects Reduce Motion) mounted inline at the top of the
  scroll content on Today, Plan and Closet. Not a floating overlay, not a new
  page — the same grammar as Today's offline banner
  (`src/app/(tabs)/index.tsx:664-671`), which already proves the pattern.
  Benefit: unblocks the six silent-mutation findings below without an Alert.

- [fix inconsistency] `src/app/(tabs)/index.tsx:173-186` vs
  `src/app/(tabs)/closet.tsx:296-300` — Profile is reached from Today by an ink
  avatar disc labelled "Profile", and from Closet by an `ellipsis` glyph
  labelled "Account and settings". Same destination, two affordances, two names.
  Fix: keep both entry points but give the Closet control the label
  `Profile and settings`, and see F1 for turning that ellipsis into the menu it
  looks like. Benefit: one destination reads as one destination.

- [preserve exactly] `src/app/+not-found.tsx` — silent redirect rather than a
  debug page. Correct, and the reasoning in the docblock should survive the
  refurbishment untouched.

---

## B. Sign-in and first run

- [minor polish] `src/app/(auth)/sign-in.tsx:667-675` — after the link is sent,
  the only control is **"Use a different address"**. It returns to the email
  field with the address still populated, so it is also the resend path — but it
  does not say so, and a user waiting on a slow inbox has no visible way to send
  again. Fix: keep the control, add a second quiet line above it:
  `Nothing yet? Check the spam folder, or send it again.` and change the control
  label to `Send it again`, with a smaller `Use a different address` beneath.
  Benefit: removes the app's only hard wait with no exit.

- [minor polish] `src/app/(auth)/sign-in.tsx:663-666` — "We sent a sign-in link
  to you@example.com. Open it on this device and you are in." The last clause is
  the one line on this screen that slips out of register. Fix:
  `Open it on this device to finish signing in.` Benefit: matches the quiet,
  complete-sentence voice the rest of the sheet holds.

- [preserve exactly] `src/app/(auth)/sign-in.tsx:42-48`,
  `src/app/auth-callback.tsx:59-66` — every sign-in failure is named, including
  the keychain case. This is the most complete error handling in the app.

---

## C. Today — "get today's plate"

- [add missing state] `src/app/(tabs)/index.tsx:752-762` — the plans field
  commits on blur or submit and **nothing acknowledges it**. `committedNote`
  silently re-runs the engine; the user types "dinner at 7 then drinks",
  taps away, and the screen gives no sign the sentence was read. Fix: on
  commit, render a `caption` line under the tray pill:
  `Styling for “dinner at 7 then drinks”.` with a hitSlop'd `×` to clear it.
  Benefit: the app's single most differentiating input stops feeling inert.

- [minor polish] `src/app/(tabs)/index.tsx:758` — placeholder
  `"What's on today? Tell Cinch"`. The imperative tail is the one growth-hack
  cadence on the screen. Fix: `What's on today?` Benefit: the field asks a
  question instead of issuing an instruction.

- [add missing state] `src/app/(tabs)/index.tsx:520-530` + `505-518` — a
  pull-to-refresh whose re-rank fails for any reason **other** than a quota
  refusal produces nothing at all: `classifyDenial` returns falsy, the effect
  returns, the spinner retracts, the same outfits sit there. The user asked
  explicitly and got silence. Fix: in the `else` of that branch, show the
  shared `<Notice>`: `Couldn't refresh just now — these are still today's.`
  Benefit: an explicit request always gets an answer, which is already this
  screen's stated principle in its own comment.

- [add missing state] `src/app/(tabs)/index.tsx:491-503` — `handleWear` passes
  `onSuccess` and **no `onError`** (**R2**). A failed wear leaves the pill
  reading "I wore this" forever, and `wear_count`/cost-per-wear silently do not
  move. Compare `handleReact` at `:454-489`, which correctly settles to
  `'failed'`. Fix: mirror the reaction pattern — hold per-outfit wear status,
  and on error render the pill as `Couldn't log — retry`, exactly as
  `src/components/today/reaction-bar.tsx:127-149` already does. Benefit: the
  numbers the whole product is about stop failing invisibly.

- [fix friction] `src/app/(tabs)/index.tsx:782` +
  `src/components/today/plate.tsx:551` — `wearing={wear.isPending}` is the
  **global** mutation flag (**R2**), so tapping "I wore this" on the first plate
  disables and spins the wear button on every other plate at once. Fix: pass
  `wearing={wear.isPending && wearingKey === key}`, tracking the in-flight key in
  the same `useState` shape `wornIds` already uses. Benefit: acting on one look
  stops freezing the other two.

- [fix friction] `src/components/today/reaction-bar.tsx:176-201` — tapping
  "Not for me" replaces both pills with the six-reason chooser and there is **no
  way back**. The only exits are picking a reason or "Just not it", both of which
  record a dislike. An accidental tap is unrecoverable. Fix: add a seventh,
  quieter control to the chip row — `Never mind`, `onPress={() => setAskingWhy(false)}`
  — set as a ghost chip so it does not read as a seventh reason.
  Benefit: an accidental tap stops poisoning the taste model.

- [fix friction] `src/components/today/reaction-bar.tsx:152-173` — once recorded,
  the pill is `disabled` with no undo. Reactions train the learner, so a mis-tap
  is permanent and the user can see that it is. Fix: while `status === 'saved'`,
  keep the caption line but make it tappable for ~10s:
  `Saved to your taste profile · Undo`. Requires a delete path in
  `useReactToOutfit`; if that is out of scope for this program, record the
  rejection and instead lengthen the `pending` window so the tap can be
  cancelled before it is sent. Benefit: the one irreversible tap on the home
  screen gets the same courtesy every destructive action elsewhere gets.

- [add missing state] `src/features/context/use-style-context.ts:132-162` — the
  location permission alert is fired **on Today's first mount**, with no in-app
  rationale before it. The app only explains itself *after* a refusal
  (`src/components/today/weather-strip.tsx:61-78`), and iOS asks once. Fix: add
  a pre-permission line to the weather strip when the status is still
  `undetermined` — same grammar as the calendar prompt directly below it:
  `Cinch reads the forecast where you are, and nothing else. Turn on location`
  — and only call `requestForegroundPermissionsAsync` from that tap. Benefit:
  the app stops spending its single location prompt before the user knows what
  Cinch is.

- [fix friction] `src/features/context/use-style-context.ts:116` —
  `calendarEnabled` is component-local `useState(false)`. The grant is **forgotten
  on every mount**, so today's events never appear after a cold start and the
  "Use today's plans to sharpen these" invitation reappears forever to a user who
  already granted it. Fix: seed the state from
  `Calendar.getCalendarPermissionsAsync()` in an effect on mount (and re-read on
  `AppState` foreground, exactly as `use-camera-access.ts:64-69` does). Benefit:
  the calendar feature actually works past the session it was granted in, and the
  app stops nagging for something it already has.

- [add missing state] `src/components/today/weather-strip.tsx:95-113` — the
  calendar CTA goes straight to the OS alert with no statement of what is read.
  Fix: keep the one-line CTA, and on tap present a small confirmation before the
  system prompt — reuse the `ConsentSheet` grammar, three lines:
  `Reads today's events only`, `Titles are read on this phone`,
  `Never sent anywhere, never stored`. Benefit: the second-most-declined
  permission in the app gets the same honesty the AI consent moment gets.

- [fix friction] `src/app/(tabs)/index.tsx:437` — `offline` requires
  `shown.length > 0`. An offline user whose local engine produces nothing falls
  through to `nothingWorks` (`:709`, `:768`) and is told
  "Nothing today feels right" — a claim about her wardrobe, over a network
  failure. This is the exact class of bug the file's own comments at `:546-548`
  and `:189-194` exist to prevent, missed in one branch. Fix: test
  `weatherFailed` before `nothingWorks`, and when both hold show the offline
  banner over the `NothingWorks` card rather than the card alone.
  Benefit: the app stops blaming the closet for the network.

- [improve interaction] `src/components/today/plate.tsx:440-443` — sharing a
  plate is **long-press only**, discoverable solely through
  `accessibilityHint`. A sighted user has no way to learn it exists. Fix: keep
  the long-press, and print the affordance once in the plate's credit line row
  as a `colophon`: `Hold to share`, shown only on the first plate
  (`index === 0`) and only until the first successful share
  (persisted flag). Benefit: the app's built-in growth surface stops being
  invisible without adding chrome to every card.

- [add missing state] `src/components/today/plate.tsx:404-414` — a failed share
  capture answers with an error **haptic and a `console.warn`**, nothing on
  screen (**R1**). Fix: route it through the shared `<Notice>`:
  `Couldn't make the image. Try again in a moment.` Benefit: the user who felt
  the shutter haptic learns why nothing happened.

- [preserve exactly] `src/app/(tabs)/index.tsx:236-302` — `nothingWorksReason`
  and `buildingCloset`. These read the actual wardrobe and say what is missing.
  Best copy in the app; do not touch.

---

## D. Capture — "add a garment"

- [fix friction] `src/app/capture.tsx:255-264` + `:620-627` — **declining AI
  consent silently kills the action with no explanation.** `guarded()` opens the
  sheet and holds `pendingAction`; `onDecline` closes the sheet, clears the
  pending action, and returns the user to the capture screen where *nothing
  happened*. Tap "Library" → read the disclosure → tap "Not now" → the picker
  never opens and no line of text explains why. This is a dead end at the top of
  the activation funnel. Fix: on decline, render a persistent line in the
  progress sheet (`:494`, the `total === 0` branch):
  `AI processing is off, so Cinch can't cut out or tag photos yet. Turn it on
  here or in Profile.` with a `Turn it on` secondary button re-opening the sheet.
  Benefit: the highest-consequence "nothing happened" in the app becomes a state.

- [fix inconsistency] `src/app/capture.tsx:558-560` — the failure banner renders
  `failed[0]?.error` verbatim, which is a server or transport string. The one
  place in the app where raw machine text is shown to the user, on the screen
  where the voice matters most. Fix: map to a small vocabulary in
  `upload-queue.ts` (`Cinch couldn't read that photo.` /
  `That upload didn't finish.` / `AI processing is off, so this one stayed
  untagged.`) and keep `job.error` for logging only. Benefit: the import screen
  stops speaking in two registers.

- [fix friction] `src/app/capture.tsx:447-474` + `:121-140` — while
  `access === 'checking'` the shutter is live and falls through to `takePhoto()`
  (`use-capture.ts:128-147`), which fires **a second** camera permission request.
  A user who taps the shutter during the first alert gets a confusing double-ask.
  Fix: extend the `disabled` condition to `access !== 'granted' || shooting`, and
  the dimmed opacity likewise. Benefit: one permission conversation, not two.

- [minor polish] `src/app/capture.tsx:581-583` — `Dismiss` with hint
  "Clears this notice. The pieces stay in your closet, untagged." The hint is the
  honest sentence; the label is the generic one. Fix: label it
  `Leave them untagged` and keep the hint. Benefit: the consequence is on the
  button rather than only in the screen-reader text.

- [preserve exactly] `src/app/capture.tsx:154-213` — the deferred-resume
  machinery around modal dismissal. Fragile, correct, and the comment explains
  exactly why. Do not refactor.

---

## E. Review deck

- [fix friction] **E1 — the review deck is unreachable.** Verified by grep:
  the only navigation to `/review` in the whole app is
  `src/app/capture.tsx:592`, a button that appears only while a live queue batch
  has `doneCount > 0` — and `src/app/capture.tsx:325-330` **clears settled jobs
  on unmount**, so the button is gone the moment the user leaves. After that,
  `cinch://review` is the only entrance, which is not an entrance. Meanwhile
  `src/app/item/[id].tsx:514` promises "It goes back in the review deck to be
  confirmed", pointing at a screen the user cannot open, and
  `src/features/closet/queries.ts:150-172` maintains a real queue nobody can see.

  **Proposed re-entry, inside the locked inventory (no new page):** turn the
  Closet masthead's `ellipsis` (`src/app/(tabs)/closet.tsx:295-299`) into the
  menu it already looks like, with three items:
  `Review tags (7)` · `Select pieces` · `Profile and settings`. The count comes
  from a `select('id', { head: true, count: 'exact' })` variant of
  `useReviewQueue`, and the row is omitted entirely when the count is zero — so
  a settled closet sees exactly what it sees today. This is one route
  (`/review`, already registered), one existing control, and it simultaneously
  fixes the hidden long-press in F1.
  Benefit: the tagging-correction loop — the thing that makes the styling engine
  accurate — stops being a one-shot the user can miss forever.

- [fix friction] `src/app/review.tsx:161-197` — a right-swipe writes
  `user_verified` immediately and there is **no undo**. `unresolve()` exists at
  `:131-137` but is reachable only from the failure path. A mis-swipe on a
  garment the tagger got wrong is silently accepted and never asked about again.
  Fix: after each confirm, show a `caption` line under the progress row for ~5s:
  `Confirmed. Undo` — tapping calls `unresolve(id)` and a
  `useVerifyItem` patch back to `user_verified: false`. Benefit: the deck's
  "under two seconds per item" speed stops costing accuracy.

- [minor polish] `src/app/review.tsx:420` — `Confirm the 7 Cinch is sure about`
  is a ghost button, i.e. the quietest variant available, for the action that
  saves the most taps in the app. Fix: keep the copy exactly, promote to
  `variant="secondary"` so it reads as a control rather than a footnote.
  Benefit: the shortcut is findable by the user it was built for.

- [preserve exactly] `src/app/review.tsx:437-454` and
  `src/components/review/review-card.tsx:484-521` — the persistent failure banner
  with a retry, and the swipe-plus-buttons duality for VoiceOver. Both are model
  implementations of what the rest of the app should do.

---

## F. Closet and item detail

- [fix friction] `src/app/(tabs)/closet.tsx:219-231` — **selection mode is
  long-press only, with no hint anywhere on the screen.** There is no
  `accessibilityHint` on the tiles, no caption, no menu item. Bulk removal is
  effectively undiscoverable. Fix: add `Select pieces` to the ellipsis menu
  proposed in E1 (it sets `picked` to an empty `Set`, which
  `SelectionBar` already handles — `selection-bar.tsx:35`, `nothingPicked`), and
  add `accessibilityHint="Hold to select several"` to the grid tiles.
  Benefit: one hidden gesture becomes a named control without a new page.

- [reject] `src/app/(tabs)/closet.tsx:524-533` — a permanently `disabled` "Edit"
  on FAVOURITE PIECES with `accessibilityHint="Coming soon"`. Reason for
  rejection of the current state: a control that can never be pressed is a
  promise the app breaks on every scroll, and the charter's decision test #4
  fails. Fix: remove the affordance until `items.is_favourite` lands; the SEAM
  comment at `:143-149` is the record that it returns.
  Benefit: nothing on screen is inert.

- [fix friction] `src/app/(tabs)/closet.tsx:288-294` — the search toggle resets
  `query` **and** `category` on both open and close. A user who filters to
  "Shoes" inside search and then closes search loses the filter she can also set
  outside search — the same `category` state, discarded for no reason. Fix: clear
  `query` only. Benefit: the two views stop fighting over one piece of state.

- [fix inconsistency] `src/app/item/[id].tsx:125-131` — item detail loads with a
  bare centred `ActivityIndicator` while every other screen in the app
  (review, stylist, plan, event, profile, explore, friend closet) draws a
  skeleton of its own shape. Fix: a skeleton — square photo well, title bar,
  2×2 stat grid — using the existing `Skeleton` primitive.
  Benefit: the last spinner in the app is retired.

- [fix inconsistency] `src/app/item/[id].tsx:148-155` — the missing-item state is
  a bare `<Text>` plus a ghost `Back`, unlike every other absence in the app,
  which uses `EmptyState`. Fix:
  `<EmptyState symbol="hanger" title="This piece is gone" body="It's no longer in your closet — it may have been removed from another device." actionTitle="Back to closet" onAction={...} />`.
  Benefit: one grammar for absence.

- [preserve exactly] `src/app/(tabs)/closet.tsx:238-269` and
  `src/app/item/[id].tsx:200-226` — the removal confirmations name both
  consequences in the sentence being agreed to. Exemplary; copy this shape
  wherever a destructive confirm is added.

---

## G. Stylist

- [fix friction] `src/features/stylist/use-chat.ts:394-405` exposes `clear()`,
  and `src/app/stylist.tsx:146` destructures only
  `{ messages, ask, retry, isSending }` — **`clear` is never wired to anything.**
  The thread is persisted and rehydrated (`use-chat.ts:65-80`), so a
  conversation from three weeks ago is what greets the user every time she opens
  the sheet, and there is no way to start a new one. The opening composition
  (greeting, four doors, questionnaire) at `stylist.tsx:278-302` is therefore
  reachable exactly once per account. Fix: add a quiet control to
  `StylistHeader` (`stylist.tsx:39-56`), right-aligned, `label` variant:
  `New question`, calling `clear()`. Benefit: the stylist's whole opening
  experience — the four scripted doors, the on-device questionnaire — becomes
  re-enterable instead of a one-time event.

- [fix inconsistency] `src/app/stylist.tsx:356-369` — the questionnaire shows
  `2 of 4` and an "I'll just type" escape, but **no Back**. The app's other
  questionnaire (`src/features/plan/trip-questionnaire.tsx:209-220`) has one.
  Two scripted flows, two different contracts. Fix: add the same underlined
  `Back` control beside the position line, wired to a `back()` on
  `useQuestionnaire`. Benefit: a mis-tapped answer costs one tap, not the flow.

- [minor polish] `src/app/stylist.tsx:297-300` — "Or just say it — the stylist
  answers with clothes you own, and says so when you do not own the right
  thing." The negative clause is the awkward half. Fix:
  `Or just say it. The stylist answers with clothes you own — and tells you plainly when you don't own the right thing.`
  Benefit: two clean sentences instead of one that runs out of breath.

- [preserve exactly] `src/app/stylist.tsx:219-231` — the "your closet didn't
  load" branch, with its explicit refusal to tell a full-wardrobe user to start
  photographing.

---

## H. Plan — week, events, packing

- [fix friction] `src/app/(tabs)/plan.tsx:374-386` — `planning={planOutfit.isPending}`
  is the global mutation flag (**R2**), so committing Tuesday's outfit spins and
  disables **all seven** day rows (`day-row.tsx:84-95`, `:169-171`). Fix: track
  the in-flight `dateKey` and compare per row. Benefit: the week stops freezing
  whole to commit one day.

- [add missing state] `src/app/(tabs)/plan.tsx:382-385` +
  `src/features/plan/mutations.ts:105-110` — `usePlanOutfit` is called with **no
  `onError`** and the hook itself defines only `onSuccess` (**R2**). A failed plan
  produces no checkmark, no message, nothing — indistinguishable from a tap that
  missed. Fix: `onError` → shared `<Notice>`:
  `That day didn't save. Check your connection and try again.` Benefit: the
  primary action of the Week tab stops failing invisibly.

- [fix friction] `src/app/(tabs)/plan.tsx:346-357` — "Couldn't plan this week"
  renders **inside** the success branch, has no retry button, and the `ScrollView`
  it sits in (`:346`) carries **no `RefreshControl`**. There is no way to try
  again except switching tabs and back. A genuine dead end. Fix: replace the
  hand-rolled block with `<ErrorState title="Couldn't plan this week" body={…} onRetry={retryWeek} retrying={…} />`
  — the same component the branch two levels up already uses at `:328-334`.
  Benefit: an error state with a way out, and one fewer bespoke composition.

- [minor polish] `src/app/(tabs)/plan.tsx:341` — "Add about ten pieces to get
  started." "To get started" is the one growth-hack cadence in Plan. Fix:
  `Add about ten pieces and the week lays itself out.` Benefit: describes the
  result rather than the funnel.

- [improve interaction] `src/app/(tabs)/plan.tsx:235-259` — "+ New event" and
  "Invite friends" share one ink container separated by a 25%-opacity hairline,
  so the primary action is ambiguous at a glance and the secondary reads as part
  of the same button. Fix: keep "New event" as the full-width ink control; move
  "Invite friends" out as a quiet `label` link beneath it, in the same grammar as
  Lately's "Your circle" row (`explore.tsx:344-358`). Benefit: one primary
  action per surface, which is the app's own rule everywhere else.

- [preserve exactly] `src/app/(tabs)/plan.tsx:180-197` and
  `src/features/plan/packing-tab.tsx:71-97` — the failure-then-loading-then-absence
  ordering, and the "CTA is never allowed to dead-end" replacement line. Both are
  the standard the rest of the app should be held to.

---

## I. Events — create, invite, board, comments

- [fix friction] `src/app/event/[id]/index.tsx:436-437` — **the only way to leave
  an occasion is to tap a pill that reads "Going".** `StatePill` is described in
  its own docblock (`:66-76`) as "a standing state, not an action", is styled as
  an ink status fill, and its `accessibilityLabel` is just `"Going"` — yet
  pressing it opens a destructive confirm. A control that looks like a badge and
  behaves like Leave is both undiscoverable and, once discovered, alarming.
  Fix: keep the pill inert as a status, and put the exit where the host's exit
  already lives — a quiet `critical` text link at the foot of the page beside
  `Cancel this occasion` (`:627-638`), reading `Leave this occasion`.
  Benefit: the state reads as a state, and the destructive action reads as one.

- [add missing state] `src/app/event/new.tsx:125` + `:369-376` — "Plan it" is
  disabled at 40% opacity when `title` is blank or the reservation URL is
  malformed, with **no line saying which**. The URL case does print a message
  (`:300-303`); the empty-title case, which is the common one, prints nothing.
  Fix: under the disabled button, a `caption`:
  `Give it a name and Cinch can plan it.` shown only when
  `title.trim().length === 0`. Benefit: the form stops refusing without saying why.

- [fix inconsistency] `src/app/event/[id]/comments.tsx:118` says reports are
  "reviewed within 24 hours"; `src/app/event/[id]/outfits.tsx:210` says the same;
  `src/app/friends/index.tsx:93` and `src/app/friends/[userId].tsx:94` say
  "Thank you — we review every report." Two different promises for one action,
  one of which is a concrete SLA. Fix: standardise on the non-SLA sentence in all
  four places — `Thank you. Every report is reviewed.` Benefit: one promise, and
  one the operator can keep.

- [consolidate into component] The report flow is four hand-built `Alert.alert`
  calls with a spread of `REPORT_REASONS` — `friends/index.tsx:80-104`,
  `friends/[userId].tsx:80-105`, `event/[id]/comments.tsx:104-126`,
  `event/[id]/outfits.tsx:196-218`. Each produces a six-button stacked iOS alert,
  and each writes its own success/error copy. Fix: one `useReportFlow()` hook
  exposing `report(subject, subjectId, subjectUserId)`, owning the reason list,
  the alert, and both outcome messages. Benefit: the moderation vocabulary and
  its promises can no longer drift, which is the exact failure
  `moderation.ts:26-38` documents having already happened once.

- [fix inconsistency] `src/app/friends/index.tsx:27` re-declares
  `REPORT_REASONS` locally instead of importing the canonical export at
  `src/features/social-graph/moderation.ts:41-47`, which the other three call
  sites use. Identical today; drift-prone by construction, and the moderation
  docblock explicitly says "Screens import it; none declares its own."
  Fix: delete the local const, import the shared one. Subsumed by the
  consolidation above if that lands.

- [add missing state] `src/app/friends/index.tsx:266-307` — a friend request has
  **Accept** and, via the row's option menu, Report and Block. There is no
  "Not now". The docblock at `:29-38` argues that ignoring is doing nothing, which
  is right about the sender — but it leaves the recipient with a row she cannot
  clear, forever. Fix: add `Not now` to `requestOptions` (`:132-139`), dismissing
  the row locally (a persisted `Set` of dismissed ids), writing nothing to the
  server so the sender still cannot detect it. Benefit: the promise to the sender
  is kept and the recipient gets her screen back.

- [minor polish] `src/app/friends/[userId].tsx:161-168` — the overflow menu marks
  **Block** destructive but not **Unfriend**, though both end the friendship and
  both are irreversible in the same way. Fix: `style: 'destructive'` on Unfriend.
  Benefit: consistent weighting of consequence.

- [preserve exactly] `src/app/event/[id]/index.tsx:270-282` — the back row drawn
  in every branch, loading and failed included, with the comment explaining why.
  Every screen in the app should be held to this.

---

## J. Lately, friends and borrowing

- [fix inconsistency] Cross-cutting gendered copy. The social slice writes every
  other user as "she"/"her": `src/app/(tabs)/explore.tsx:243-245`, `:276`, `:310`;
  `src/app/friends/index.tsx:334`; `src/app/friends/[userId].tsx:110`, `:138`,
  `:183` ("Her closet"), `:276`; `src/app/event/[id]/outfits.tsx:231`
  ("Her looks, picks and comments"). A user with a male or non-binary friend
  reads copy that is simply wrong about the person on screen, and the header
  "Her closet" is wrong on a named page. Fix: degender throughout —
  `Her closet` → `Their closet` (or, better on that header, the person's own
  name, which the screen already has at `[userId].tsx:39`);
  `when she adds you back, her closet opens to you and yours to her` →
  `when they add you back, their closet opens to you and yours to them`;
  `She won't be able to find you…` → `They won't be able to find you…`.
  Benefit: the app stops asserting a fact about the user's friends that it
  cannot know.

- [minor polish] `src/app/friends/[userId].tsx:226` — the empty state instructs
  "Pull down on the Friends list to refresh", i.e. an action on a **different
  screen**. This screen has its own `RefreshControl` (`:244-246`) but the empty
  branch renders instead of the list, so there is nothing to pull. Fix:
  `Their closet is empty, or it isn't open to you right now.` plus
  `actionTitle="Try again"` wired to `closet.refetch()`. Benefit: the instruction
  points at a control that exists on the screen giving it.

- [preserve exactly] `src/components/social/BlockedList.tsx:14-28` and
  `:66-74` — the refusal to let a failed fetch render as "No one is blocked."
  This is the correct reading of a safety surface.

- [preserve exactly] `src/app/borrow.tsx:130-146` — loading, empty and error are
  three distinct states with the reasoning recorded inline.

---

## K. Profile and settings

- [add missing state] `src/app/profile.tsx:521-523` — Privacy and Support open
  external URLs via `Linking.openURL` with the same chevron affordance as the
  in-app rows above and below them. No indication the user is leaving the app.
  Fix: swap the chevron for `arrow.up.right` on those two rows only.
  Benefit: the row's glyph tells the truth about where it goes.

- [minor polish] `src/app/profile.tsx:511-514` — "Blocked users" navigates to
  `/friends?blocked=1`, a page whose display title is **Friends**, then scrolls
  to the bottom. The arrival reads as a mis-navigation for the second it takes to
  scroll. Fix: keep the route (it is the right call — no fourth page), but change
  the row label to `Blocked users, in Friends` — or, cheaper and better, have the
  Friends screen render its `colophon` header as `Blocked` when the param is set
  (`friends/index.tsx:174`). Benefit: the destination confirms the request.

- [preserve exactly] `src/app/profile.tsx:230-308` — the two-step account
  deletion, and above all the refusal to promise a rollback at `:251-257`. The
  best-written error copy in the codebase.

- [preserve exactly] `src/features/profile/edit-profile-sheet.tsx:137-150` — the
  discard-changes confirm on a page sheet that is one swipe from gone.

---

## L. Cross-cutting copy notes

- [preserve exactly] British spelling is **consistently** applied — "Colours"
  (`item/[id].tsx:469`), "Favourite pieces" (`closet.tsx:520`), "recognising"
  (`index.tsx:798`, `profile.tsx:205`), "categorising"
  (`capture.tsx:299-302`). No mixed-register findings. Leave it alone.
- [preserve exactly] No exclamation marks anywhere in user-facing strings —
  verified by grep across `src/`. The voice rule is being held.
- [preserve exactly] Garment labels capitalise per the approved frames —
  `src/components/today/plate.tsx:57-60`, with the reasoning attached.
- [minor polish] `src/app/(tabs)/closet.tsx:878-881` — "worn counts,
  cost-per-wear, the lot." "The lot" is the one colloquialism in the app's copy,
  and it lands on the empty-closet screen, which is the first thing a new user
  reads. Fix: `Add a few pieces and this fills with your real wardrobe — what you
  wear, and what it costs you to wear it.` Benefit: keeps the editorial register
  without the idiom.
- [minor polish] `src/app/(tabs)/index.tsx:251` — "Cinch couldn't build an outfit
  that holds together from what's in your closet right now. One more layer, or a
  pair of shoes, usually unlocks it." "Unlocks it" is product-speak inside
  otherwise excellent copy. Fix: `…usually fixes it.`

---

## M. Missing necessary states, summarised against the charter's allowed list

| State | Where it is missing | Finding |
|---|---|---|
| Permission explanation — location | Today, before the OS alert | C, `use-style-context.ts:132-162` |
| Permission explanation — calendar | Weather strip CTA | C, `weather-strip.tsx:95-113` |
| Permission persistence — calendar | Grant forgotten every mount | C, `use-style-context.ts:116` |
| Confirmation — plans note accepted | Today's tray pill | C, `index.tsx:752-762` |
| Confirmation — wear logged / failed | Today's plate | C, `index.tsx:491-503` |
| Confirmation — day planned / failed | Plan week | H, `plan.tsx:382-385` |
| Confirmation — refresh failed | Today pull-to-refresh | C, `index.tsx:520-530` |
| Confirmation — share failed | Plate long-press | C, `plate.tsx:404-414` |
| Explanation — consent declined | Capture | D, `capture.tsx:255-264` |
| Explanation — form disabled | New occasion | I, `event/new.tsx:125` |
| Retry — week could not be planned | Plan week | H, `plan.tsx:346-357` |
| Re-entry — review deck | Everywhere | E1 |
| Re-entry — new stylist conversation | Stylist sheet | G, `use-chat.ts:394` |
| Undo — confirmed review card | Review deck | E, `review.tsx:161-197` |
| Undo — recorded reaction | Today's plate | C, `reaction-bar.tsx:152-173` |
| Dismissal — friend request | Friends | I, `friends/index.tsx:266-307` |
| Blocked-user visibility | **Present and correct** | `BlockedList.tsx` |
| Report flow completeness | Present; four copies, two promises | I |

---

## State recovery on background / foreground

- **Capture — recovers.** `src/features/ingest/queue-store.ts` persists jobs;
  `capture.tsx:107-110` rehydrates and calls `drainQueue()` on mount, and
  `upload-queue.ts` re-drives rows stuck at `pending_tag`. The unmount sweep
  (`capture.tsx:325-330`) correctly runs only when nothing is in flight. This is
  the best-recovered flow in the app — and the one whose recovery is invisible,
  because of E1.
- **Review — partially recovers.** `resolvedIds`, `confirmedCount` and
  `skippedCount` are component state, so backgrounding long enough for a remount
  restarts the sitting's ordinal at "1 of N" and re-presents skipped cards. The
  server-side truth (`user_verified`) is correct, so nothing is lost — but the
  progress line lies about position. Low severity; note only.
- **Event creation — does not recover.** `src/app/event/new.tsx:105-118` holds
  title, venue, address, reservation URL and dress code in plain `useState` with
  no draft persistence. A long form, a phone call, and it is gone.
  [add missing state] Fix: persist the draft to the queue store's MMKV/AsyncStorage
  under one key, restore on mount, clear on successful create. Benefit: the app's
  longest form stops being the app's most fragile one.
- **Trip questionnaire — recovers within the session.** Deliberately hoisted to
  `PlanScreen` state (`plan.tsx:96`, `packing-tab.tsx:103-108`) so switching to
  Week does not discard five answers. Correct; does not survive a process kill,
  which is acceptable.
- **Stylist — over-recovers.** The thread is persisted and rehydrated
  (`use-chat.ts:65-80`) with no way to end it. See G.
- **Today — recovers.** Persisted query cache
  (`_layout.tsx:224-231`) means a cold start with no signal still dresses the
  user. `calendarEnabled` is the one piece of state that should persist and does
  not (C).

---

## Top 10 friction fixes, ranked by how often a real user hits them

1. **Wire the calendar permission to persist** —
   `use-style-context.ts:116`. Every user, every cold start, forever: today's
   events silently vanish and the app re-asks for something it already has.
2. **Give the review deck a re-entry point** — E1, via the Closet ellipsis menu.
   Every user who imports more than one batch. Currently a one-shot they will
   miss, and it degrades the tagging accuracy the whole engine rests on.
3. **Explain a declined AI consent instead of doing nothing** —
   `capture.tsx:255-264`. Hit by every user who reads the disclosure and
   hesitates, at the top of the activation funnel, with zero feedback.
4. **Confirm the plans note was read** — `index.tsx:752-762`. Every user who
   uses the app's single most differentiating input, every day.
5. **Add the shared `<Notice>` and wire wear / plan / refresh failures to it** —
   `index.tsx:491-503`, `plan.tsx:382-385`, `index.tsx:520-530`. Daily actions
   whose failures are currently indistinguishable from no-ops.
6. **Scope the pending flags per row** — `index.tsx:782`, `plan.tsx:374-386`.
   Hit every time a user marks a look worn or plans a day, which is the core
   loop of two of the four tabs.
7. **Un-hide the selection gesture and the share gesture** —
   `closet.tsx:219-231`, `plate.tsx:440-443`. Two features most users will never
   discover exist; one of them is the app's growth surface.
8. **Give "Couldn't plan this week" a retry** — `plan.tsx:346-357`. Less
   frequent, but a total dead end when it lands, on a tab with no other exit.
9. **Let the stylist start a new conversation** — `use-chat.ts:394`,
   `stylist.tsx:146`. Hit on the second visit and every visit after, and it
   hides the entire designed opening.
10. **Degender the social copy** — J. Hit by every user with a friend who is not
    a woman, on the first sentence they read about that person.

Honourable mentions, high-value but lower-frequency: undo on a confirmed review
card (E), leaving an occasion via a control that looks like one (I), and
persisting the new-occasion draft (state recovery).

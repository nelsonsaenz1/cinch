# Cinch — Outfit Saving (private) · Implementation Handoff

Feature area: **Saved looks**. Fourth build, after Daily Social, Private Circles, Activity Center.
Job: keep promising looks privately, return to them easily, turn a saved look into a plan from the owner's own closet.

Platform: React Native + Expo SDK 57, Apple HIG. **No new vendor, package, permission, data recipient, public board, follower/collab surface, or social-sharing path** is introduced by this feature. Everything below reuses existing Cinch primitives (auth session, Supabase client, closet/plan modules, haptics).

Design refs: `design-refs/html/OS-*.dc.html` (interactive) and `design-refs/png/OS-*/` (stills). Screen index:

| Ref | Screen |
|---|---|
| OS-01 | Empty Saved (first-run) |
| OS-02 | Save affordance + confirmation; duplicate-save |
| OS-03 | Populated grid + collection filters (long title, no-image, partial data) |
| OS-04 | Saved-look detail — visible provenance + private metadata |
| OS-05 | Create / rename / delete collection (keyboard, delete confirm) |
| OS-06 | Source no longer available (detail + inline grid tile) |
| OS-07 | Remove confirmation (swipe + button alternative, action sheet) |
| OS-08 | Transform saved look → Plan / closet, with manual fallback |
| OS-09 | Loading (skeleton) / offline / error+retry |
| OS-10 | Dynamic Type AX-XXXL (detail + list) |

---

## 1. Routes

All routes live under the existing Saved tab (root of the 4th tab bar item). Expo Router paths:

| Route | Screen | Notes |
|---|---|---|
| `/saved` | OS-01 / OS-03 / OS-09 | List root. Renders empty, populated, or loading/offline/error per query state. |
| `/saved/[saveId]` | OS-04 / OS-06 | Saved-look detail. OS-06 is the same route when the source resolves to `unavailable`. |
| `/saved/collections` | OS-05a | Manage collections (modal push). |
| `/saved/collections/new` | OS-05b | Create sheet (form sheet presentation). |
| `/saved/collections/[collectionId]/edit` | OS-05b/5c | Rename + delete. |
| `/saved/[saveId]/plan` | OS-08 | Closet-match → create plan (modal, `presentation:'modal'`). |
| Save action | OS-02 | Not a route — invoked from Daily/Circle/Activity look surfaces via shared `SaveLookButton`. Presents confirmation toast + optional `AddToCollectionSheet`. |

The **save affordance itself is owned by the source surfaces** (Daily, Circles, event look). This feature contributes the button component and the sheet; it does not add a route there.

## 2. Components

Reusable (new, private to Saved unless noted):

- `SaveLookButton` — shared, mounted on look surfaces. Props: `sourceRef`, `saved:boolean`. Emits `onSave`/`onUndo`. Handles duplicate state (renders "Saved" pill, tapping opens the existing save).
- `SaveConfirmationToast` — transient banner ("Saved to your looks" / "Undo"; "Already in your looks" / "View").
- `AddToCollectionSheet` — optional post-save sheet; list of collections + "New collection".
- `SavedGrid` / `SavedGridCard` — 2-col grid; card variants: image, no-image, unavailable.
- `CollectionFilterBar` — horizontal chips (All + collections).
- `SavedDetail` — hero, `ProvenanceRow`, `PrivateMetadataCard`, action buttons.
- `ProvenanceRow` — source avatar + "Saved from {source}", visibility + date. Read-only.
- `UnavailableNotice` — OS-06 banner + "Keep note only" / "Remove save".
- `CollectionList` / `CollectionEditor` — manage/create/rename; `DeleteCollectionSheet`.
- `RemoveSaveSheet` — OS-07 action sheet (Remove / Move to collection instead / Cancel).
- `PlanFromSave` — OS-08 matcher: `MatchedRow`, `MissingGarmentRow` (Find similar / Add manually / Skip), `CreatePlanBar`.
- `SavedStates` — skeleton, `OfflineBanner`, `ErrorRetry`.

All components consume Dynamic Type via `useScaledType()` and respect `AccessibilityInfo.isReduceMotionEnabled`.

## 3. Data contract

A **save is a private pointer + a snapshot of display fields**, never a copy of the source's private garment data. One row per save, owned by one user.

```
saved_look {
  id: uuid (pk)
  owner_id: uuid            // == auth.uid(); the ONLY principal
  source_type: enum('own_outfit','daily_look','event_look')
  source_id: uuid           // reference to the source record
  source_owner_id: uuid     // whose look it was (for provenance display + access recheck)
  collection_id: uuid | null

  // Snapshot (display only — safe to retain if source disappears):
  snap_title: text | null
  snap_image_url: text | null      // may be null → "no image" card
  snap_source_label: text          // "Maya's Daily look", "Your outfit", "Jordan's event"
  snap_source_visibility: text     // "Visible to your Circle", "Event look", "Private"
  snap_saved_at: timestamptz

  // Private, owner-authored:
  note: text | null
  created_at, updated_at

  // Derived at read time, never stored:
  // availability: 'available' | 'unavailable'
}

collection {
  id, owner_id, name (<=40 chars), created_at, updated_at
}
```

Rules encoded here:
- The snapshot holds only fields the owner could already see when saving. **No garment-level rows, sizes, links, or closet items are copied into `saved_look`.** Turning a save into a plan (OS-08) reads the *owner's own* closet only.
- `availability` is computed on read by re-checking access to `source_id` for `owner_id` (see §5). It is never persisted, so a revoked source can never be served as available from cache.

### GraphQL/RPC surface (reuses existing Supabase client)
- `savedLooks(collectionId?)` → list with `availability` resolved server-side.
- `savedLook(id)` → detail incl. `availability`.
- `createSave(sourceType, sourceId)` → validates access, dedupes, returns existing on duplicate.
- `deleteSave(id)`, `updateSaveNote(id, note)`, `moveSave(id, collectionId|null)`.
- `createCollection/renameCollection/deleteCollection` (delete keeps member saves; sets their `collection_id=null`).
- `planFromSave(id)` → returns match candidates from owner's closet (no writes until confirm), then `createPlan(...)` (existing Plan module).

## 4. RLS / access matrix

Every table: RLS **on**, default deny. Principal is `auth.uid()`.

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `saved_look` | `owner_id = auth.uid()` | `owner_id = auth.uid()` **AND** `can_access(source_type, source_id, auth.uid())` | `owner_id = auth.uid()` (note/collection only) | `owner_id = auth.uid()` |
| `collection` | `owner_id = auth.uid()` | `owner_id = auth.uid()` | `owner_id = auth.uid()` | `owner_id = auth.uid()` |

`can_access(...)` is a `SECURITY DEFINER` function reusing the **existing** Daily/Circle/event visibility predicates:
- `own_outfit` → source owned by `auth.uid()`.
- `daily_look` → look is currently friend-visible to `auth.uid()` under Private Circles rules (not expired, not revoked).
- `event_look` → `auth.uid()` currently has access to that event.

There is no read path to another user's `saved_look` or `collection`. There is no group/collaborator role. Saving an inaccessible or revoked look fails the insert policy → surfaced as OS-06 messaging on the source surface, never a silent write.

## 5. Source revocation & deletion semantics

`availability` is resolved on **every** list/detail read by calling `can_access` against the live source.

| Event | Effect on save | User-facing |
|---|---|---|
| Source still accessible | `available` | Normal detail (OS-04). |
| Daily look expired / un-shared / Circle changed | `unavailable`; snapshot + note retained | OS-06 detail; OS-06 grid tile "Unavailable"; OS-03/06 count banner. |
| Source hard-deleted | `unavailable` (source row gone) | Same as above. Image may fall back to "Preview unavailable". |
| Owner deletes their own save | Row deleted | OS-07 confirm → removed from Saved + collection; source untouched. |
| Owner deletes a collection | Collection row deleted; member saves keep `collection_id=null` | OS-05c copy: "The N looks inside stay in Saved." |
| Owner picks "Keep note only" (OS-06) | Save retained as unavailable; note kept | Stays visible as unavailable. |

Guarantees: a save can never resurrect access to a look the owner has lost — reads re-check, and the stored snapshot exposes nothing beyond what was visible at save time. Deleting the source does not delete the owner's private note.

## 6. Private analytics map

Product analytics for this feature. **No user, friend, source-owner, look, item, collection, or note identifiers, names, image URLs, or free text are ever sent.** Counts and enums only; collection identity is reduced to its ordinal position, never its name.

| Event | Properties (allowed) |
|---|---|
| `saved.save_created` | `source_type` enum, `had_image` bool, `was_duplicate` bool |
| `saved.save_removed` | `source_type` enum, `via` enum(`swipe`,`button`,`detail`) |
| `saved.confirmation_undo` | — |
| `saved.list_viewed` | `save_count_bucket` enum(`0`,`1-5`,`6-20`,`21+`), `has_collections` bool |
| `saved.collection_created` | `collection_count_bucket` |
| `saved.collection_renamed` | — |
| `saved.collection_deleted` | `member_count_bucket` |
| `saved.filter_applied` | `is_all` bool (never the collection name/id) |
| `saved.detail_viewed` | `availability` enum, `has_note` bool |
| `saved.source_unavailable_seen` | `source_type` enum |
| `saved.plan_started` | `matched_bucket`, `missing_bucket` |
| `saved.plan_created` | `pieces_used_bucket`, `had_missing` bool |
| `saved.plan_missing_action` | `action` enum(`find_similar`,`add_manual`,`skip`) |
| `saved.state_shown` | `state` enum(`loading`,`offline`,`error`) |
| `saved.retry_tapped` | — |

No new data recipient. Events go only to the existing analytics sink already used by Cinch.

## 7. Copy table

| Key | String |
|---|---|
| `saved.title` | Saved |
| `saved.empty.title` | Nothing saved yet |
| `saved.empty.body` | Tap the bookmark on any look to keep it here — just for you. |
| `saved.empty.hint` | Look for this on any outfit |
| `save.cta` | Save look |
| `save.saved_pill` | Saved |
| `save.toast.created` | Saved to your looks |
| `save.toast.undo` | Undo |
| `save.toast.duplicate` | Already in your looks |
| `save.toast.view` | View |
| `save.sheet.title` | Add to a collection? |
| `save.sheet.subtitle` | Optional — collections stay private to you. |
| `save.sheet.new` | New collection |
| `save.sheet.dismiss` | Not now |
| `detail.private_header` | Private to you |
| `detail.note_label` | Your note |
| `detail.saved_label` | Saved |
| `detail.plan_cta` | Plan this look |
| `detail.move_cta` | Move to… |
| `detail.remove_cta` | Remove |
| `provenance.from` | Saved from {source} |
| `collections.title` | Collections |
| `collections.section` | Private collections |
| `collections.new` | New collection |
| `collections.hint` | Swipe a collection, or tap into it, to rename or delete. Deleting a collection keeps its looks in Saved. |
| `collection.rename.title` | Rename collection |
| `collection.name.hint` | Names are private and visible only to you. 40 characters max. |
| `collection.delete.title` | Delete "{name}"? |
| `collection.delete.body` | The {n} looks inside stay in Saved. This can't be undone. |
| `collection.delete.confirm` | Delete collection |
| `unavailable.title` | This look is no longer available |
| `unavailable.body` | {name}'s look expired or their sharing changed. You can still keep your note, or remove this save. |
| `unavailable.privacy_note` | We never copied {name}'s garments into your closet, so nothing private was kept beyond your own note. |
| `unavailable.keep` | Keep note only |
| `unavailable.remove` | Remove save |
| `unavailable.grid_tag` | Unavailable |
| `unavailable.count_banner` | {n} saved look is no longer available. |
| `remove.title` | Remove this saved look? |
| `remove.body` | It leaves your Saved and any collection. The original in {source} isn't affected. |
| `remove.confirm` | Remove |
| `remove.move_instead` | Move to a collection instead |
| `plan.title` | Plan this look |
| `plan.matched_header` | Your closet · {n} matched |
| `plan.matched_tag` | Matched from your closet |
| `plan.missing_header` | Not in your closet · {n} |
| `plan.no_match` | Nothing similar found |
| `plan.optional` | Optional · skip for now |
| `plan.find_similar` | Find similar |
| `plan.add_manual` | Add manually |
| `plan.skip` | Skip |
| `plan.cta` | Create plan with {n} pieces |
| `plan.cta_note` | You can add the missing pieces anytime. |
| `plan.done.title` | Plan created |
| `plan.done.open` | Open plan |
| `plan.done.back` | Back to Saved |
| `state.offline` | You're offline. Showing your last synced looks. |
| `state.image_not_synced` | Image not synced |
| `state.no_image` | No image saved |
| `state.error.title` | Couldn't load your looks |
| `state.error.body` | Something went wrong on our end. Your saves are safe. |
| `state.retry` | Try again |

Verbatim strings appear in the DC refs; keep them in sync.

## 8. Motion & haptic table

Respect Reduce Motion: when enabled, replace all slide/scale transitions with an instant cross-fade (≤100 ms opacity) and disable the confirmation toast slide.

| Interaction | Motion | Haptic |
|---|---|---|
| Save look | Toast slides down 300 ms ease-out (RM: fade) | `notificationAsync(Success)` |
| Duplicate save | Toast (info variant), no success chime | `impactAsync(Light)` |
| Undo save | Toast dismiss, card removal fade | `impactAsync(Light)` |
| Open add-to-collection sheet | Sheet up 300 ms (RM: fade) | none |
| Add to / move collection | Row check fill 150 ms | `selectionAsync()` |
| Open detail | Standard push | none |
| Remove (confirm) | Card collapse 200 ms (RM: instant) | `notificationAsync(Warning)` on sheet open; `impactAsync(Medium)` on confirm |
| Delete collection (confirm) | Sheet, list reflow 200 ms | `notificationAsync(Warning)` / `Medium` on confirm |
| Create plan | Success screen fade-in | `notificationAsync(Success)` |
| Missing garment action | none | `selectionAsync()` |
| Pull-to-refresh | System spinner | system |
| Error retry | Skeleton swap | `impactAsync(Light)` |

No looping/auto-playing motion anywhere. Skeleton shimmer is disabled under Reduce Motion (static 70% opacity).

## 9. Accessibility & Dynamic Type

- Full Dynamic Type incl. AX1–AX5 (AX-XXXL shown in OS-10): grids collapse to a single scrolling column; action rows stack to full-width buttons; provenance wraps to two lines; hit targets stay ≥44pt. No text is clipped or truncated at max size (titles wrap; `text-wrap: pretty`).
- VoiceOver:
  - Save button: label "Save look" / "Saved, in your looks" (state in label, not just visual).
  - Card: "{title}, saved from {source}, {date}" as one label; "unavailable" prepended when applicable.
  - Provenance row: read-only, grouped, exposes source + visibility + date.
  - Confirmation toast: `AccessibilityInfo.announceForAccessibility` "Saved to your looks"; Undo focusable for the toast lifetime.
  - Destructive actions announce role `button` + trait `destructive`; confirm sheets move focus to the title.
- **Every gesture has a visible control.** Swipe-to-remove (OS-07) is mirrored by the ••• row menu and the detail "Remove" button. There is no action reachable only by gesture.
- Contrast: oxblood `#7A2E3A` on paper `#F5F1EA` and destructive `#B02D3A` meet WCAG AA for text; secondary `#8A8175` used only for ≥14px non-essential metadata.
- Respects `prefers-reduced-motion` / Reduce Motion and Bold Text (weights step up one).
- Safe areas: top inset honored by nav/large-title; bottom inset by tab bar, action bars (OS-08), and sheets. Keyboard (OS-05) uses `KeyboardAvoidingView`; form sheet lifts above the keyboard; Cancel/Save stay reachable.

## 10. State transitions

**List (`/saved`)**
`loading → { empty | populated | offline(cached) | error }`; `error --retry--> loading`; `offline --reconnect--> loading`. Filter is a client-side facet over the loaded set; changing it never refetches.

**Save action**
`idle --tap--> validating --ok--> saved(toast) [+ optional sheet]`; `validating --duplicate--> already-saved(toast→View)`; `validating --no-access--> blocked(inline error, no write)`; `saved --undo(≤5s)--> idle`.

**Detail (`/saved/[saveId]`)**
`loading → { available | unavailable }`; `available --remove--> confirm → removed(pop)`; `unavailable --keep-note--> unavailable`; `unavailable --remove--> removed(pop)`.

**Collection editor**
`view → editing(name) → { saved | cancelled }`; `editing --delete--> confirm → { deleted(members detached) | cancelled }`.

**Plan (`/saved/[saveId]/plan`)**
`matching → review(matched/missing)`; per-missing `unresolved → { find_similar | added_manually | skipped }`; `review --create--> created(success)`; `--cancel--> dismiss (no writes)`.

Every confirm/sheet has an explicit Cancel that returns to the prior state with no side effects.

## 11. Tests

**Unit / logic**
- `can_access` returns false for expired daily look, un-shared look, revoked Circle, past event; true for own outfit.
- `createSave` dedupe: second save of same `(owner, source)` returns existing id, no new row.
- `deleteCollection` detaches members (`collection_id=null`), never deletes saves.
- `availability` never read from cache; recomputed each read.
- Analytics emitter strips/omits any identifier field; only enum/bucket/bool pass a schema guard.

**RLS (integration)**
- User B cannot select/update/delete User A's `saved_look` or `collection`.
- Insert with an inaccessible `source_id` is rejected by policy.
- Snapshot never contains garment rows (schema assertion: no FK from `saved_look` to garments).

**UI / a11y**
- Empty, populated, long-title, no-image, unavailable, offline, error render without overflow at Default and AX-XXXL.
- Swipe-remove and button-remove reach the same confirm and the same result.
- VoiceOver labels present for save button (both states), cards, provenance, destructive actions.
- Reduce Motion disables toast slide and skeleton shimmer.
- Duplicate-save shows info toast, not success.
- Keyboard: rename Save/Cancel reachable with keyboard open; safe-area bottom respected.

**E2E**
- Save from a legitimate Daily look → appears in Saved → open detail → Plan → create plan with partial matches → success.
- Save then Undo within 5s removes it.
- Source revoked between save and revisit → detail shows OS-06, note retained, "Remove save" works.

## 12. Deviations

- **PNG stills bundle multiple states per screen** (e.g. OS-02 shows affordance + confirmation + duplicate side by side) for review economy; each is a distinct runtime state, not a single screen.
- Entry animations (sheet-up, keyboard-up) are present in the interactive DC refs but **removed from the still exports** so captures are deterministic; production uses the motion in §8.
- Device chrome (status bar glyphs, home indicator) in refs is illustrative; production uses the OS status bar and `SafeAreaView`.
- Images are striped placeholders — production uses the source's already-visible image (or the no-image card).
- "Move to…" and "Find similar" open existing pickers not fully drawn here; they reuse current Cinch closet/collection pickers.

## 13. Native vs. runtime classification

| Concern | Classification | Detail |
|---|---|---|
| Navigation | Runtime (JS) | Expo Router; existing tab host. |
| Data / persistence | Runtime | Supabase client + RLS (existing). No new local DB. |
| Haptics | Native bridge (existing) | `expo-haptics`, already a dependency. No new permission. |
| Dynamic Type / Bold Text | Native → runtime | Read via existing accessibility hooks; layout in JS. |
| Reduce Motion | Native → runtime | `AccessibilityInfo`; gating in JS. |
| VoiceOver | Native | RN accessibility props. |
| Safe area / keyboard | Native → runtime | `react-native-safe-area-context`, `KeyboardAvoidingView` (existing). |
| Image loading | Runtime | Existing image component; offline cache reuses current policy. |
| Analytics | Runtime | Existing sink; no new SDK. |
| Plan creation | Runtime | Existing Plan module. |

Nothing here requires a new native module, permission, entitlement, or config plugin. **No new vendor, package, permission, data recipient, public board, or social-sharing assumption is introduced.**

# Cinch — Activity Center — Implementation Mapping

Private, recipient-scoped inbox of meaningful social changes. Ships **after** Daily Social and Private Circles. Calm by design: no engagement mechanics.

Platform: React Native · Expo SDK 57 · expo-router. Apple HIG compliant.

**Hard constraints honored (nothing added):** no new vendor, package, permission, data recipient, public graph, or notification permission. No push-notification entitlement is requested by this feature; Activity is pull/refresh + realtime on the existing Circles channel. No red numeric badge, no bell chrome, no count, no public activity, no read receipts/views/followers, no algorithmic ranking. Ordering is strictly reverse-chronological.

---

## 1. Screen inventory → design refs

| ID | State | HTML | PNG |
|----|-------|------|-----|
| AC-01 | Entry point + empty ("all caught up") | `html/AC-01.dc.html` | `png/AC-01/` |
| AC-02 | Quiet populated timeline (mixed private activity) | `html/AC-02.dc.html` | `png/AC-02/` |
| AC-03 | Circle invitation detail + action | `html/AC-03.dc.html` | `png/AC-03/` |
| AC-04 | Daily reaction detail + action | `html/AC-04.dc.html` | `png/AC-04/` |
| AC-05 | Item revoked / no longer available | `html/AC-05.dc.html` | `png/AC-05/` |
| AC-06 | Loading (skeleton) | `html/AC-06.dc.html` | `png/AC-06/` |
| AC-07 | Offline / error / retry | `html/AC-07.dc.html` | `png/AC-07/` |
| AC-08 | Grouped older state | `html/AC-08.dc.html` | `png/AC-08/` |
| AC-09 | Accessibility — Dynamic Type AX‑XXXL | `html/AC-09.dc.html` | `png/AC-09/` |
| AC-10 | Clear‑all destructive confirmation | `html/AC-10.dc.html` | `png/AC-10/` |

---

## 2. Routes (expo-router)

```
app/
  (tabs)/daily/                     # Daily Social (existing)
    _layout.tsx                     # header renders <ActivityEntryButton/> (no badge)
  activity/
    index.tsx        AC-01/02/06/07/08  route: /activity
    invitation/[id].tsx  AC-03/05      route: /activity/invitation/:id
    reaction/[id].tsx    AC-04/05      route: /activity/reaction/:id
```

- Entry is a **push** from the Daily Social header (native back label "Daily"), not a tab. Keeps Activity out of the primary nav so it never competes for attention.
- All items are **deep-linkable**: `cinch://activity`, `cinch://activity/invitation/:id`, `cinch://activity/reaction/:id`. A deep link to a revoked item resolves to AC-05, never a dead end.
- Back / cancel: system swipe-back + visible back button everywhere. Detail screens dismiss to `/activity`. AC-10 sheet dismisses on Cancel or backdrop tap.

## 3. Components

| Component | Used by | Notes |
|-----------|---------|-------|
| `ActivityEntryButton` | Daily header | Avatar/glyph, no permanent badge. Renders a single 9px oxblood presence dot **only** when `unseenCount > 0`; dot is boolean, never a number. Clears on screen open. |
| `ActivityScreen` | AC-01/02/06/07/08 | `SectionList`, pull-to-refresh, reverse-chron sections. |
| `ActivityRow` | AC-02/08 | Left presence gutter (unread dot), leading glyph/avatar, title, subtitle, trailing timestamp. Whole row is the tap target → detail. |
| `InlineInviteRow` | AC-02 | Invitation with inline Accept/Decline (visible buttons, not swipe). |
| `GroupedRow` | AC-08 | Collapsed summary ("3 people joined your circles") with chevron → expanded list. |
| `SectionHeader` | all | New / Earlier / Earlier this week / Earlier this month. |
| `EmptyState` | AC-01 | "You're all caught up." |
| `SkeletonRow` | AC-06 | Static blocks; pulse suppressed under Reduce Motion. |
| `ErrorState` | AC-07 | Offline banner + retry; shows last-cached list underneath when available. |
| `InvitationDetail` | AC-03/05 | Accept/Decline/Dismiss; reversibility copy. |
| `ReactionDetail` | AC-04/05 | View in Daily Social / Mute sender. |
| `EditModeBar` + `RowDismissAction` | AC-02/08/10 | "Edit" reveals per-row Remove and the "Clear All" affordance — the **explicit visible alternative** to swipe-to-dismiss and long-press. |
| `ClearAllSheet` | AC-10 | HIG action sheet, destructive confirm. |

## 4. Data states (per screen)

`idle → loading (AC-06) → ready | empty (AC-01) | error (AC-07)`. Realtime insert prepends to the New section. `ready` rows carry `seenAt`; opening the screen stamps `seenAt` on all currently-New rows (drives presence dot, not a count). Referenced-entity fetch can independently resolve to `revoked` (AC-05) without failing the list.

---

## 5. Event taxonomy (recipient events only)

Activity rows are generated **only** from explicit private actions that create a legitimate event for one recipient. No derived, public, or aggregate signals.

| `event_type` | Producer action | Recipient | Row template |
|--------------|-----------------|-----------|--------------|
| `circle.invite.received` | A owner invites B to a private circle | B | "{A} invited you to {circle}" (+ Accept/Decline) |
| `circle.invite.accepted` | B accepts A's invite | A (inviter) | "{B} accepted your invitation to {circle}" |
| `circle.invite.declined` | B declines | A (inviter) | "{B} declined your invitation" (quiet, no CTA) |
| `circle.member.joined` | Member joins a circle you're in | existing members | "{B} joined {circle}" |
| `circle.member.left` / `circle.self.left` | Member leaves / you leave | remaining members / you | "{B} left {circle}" |
| `daily.reaction.received` | Someone reacts to a look **you** shared in Daily Social | owner of the look | "{A} reacted "{text}" to a look you shared" |
| `outfit.saved.shared` *(gated)* | Future: a save/share explicitly directed at you | recipient | Emitted **only if** that future feature creates a legitimate recipient event. Feature-flagged off until then. |

**Not events (explicitly excluded):** views, opens, screenshots, follows, public likes, trending, "people you may know," anything algorithmically ranked, anything visible to non-recipients.

---

## 6. RLS recipient matrix (Postgres row-level security)

Table `activity_events (id, recipient_id, event_type, actor_id, subject_type, subject_id, circle_id, payload jsonb, created_at, seen_at, dismissed_at, revoked_at)`.

**Golden rule:** a row exists for, and is readable by, exactly one `recipient_id`. Activity is materialized per-recipient at write time (fan-out on insert), so read RLS is a single-column check.

```sql
alter table activity_events enable row level security;

-- SELECT: only the recipient, and only live rows
create policy ae_select on activity_events for select
  using (recipient_id = auth.uid() and dismissed_at is null);

-- UPDATE: recipient may mark seen / dismiss own rows only
create policy ae_update on activity_events for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- INSERT: server/service role only (fan-out from validated domain actions);
-- no client-authored events.
create policy ae_insert on activity_events for insert to service_role with check (true);

-- DELETE: recipient (clear-all / dismiss) or retention job (service role)
create policy ae_delete on activity_events for delete
  using (recipient_id = auth.uid());
```

| Actor | Can read | Can write | Can delete |
|-------|----------|-----------|------------|
| Recipient | own live rows | `seen_at`, `dismissed_at` on own rows | own rows |
| Any other user | ❌ none | ❌ | ❌ |
| Service role | (for fan-out only) | insert validated events; set `revoked_at` | retention purge |

Fan-out targets are computed from validated **circle membership / ownership at action time**, never from a public graph. An invite event is written to the invitee; an acceptance event to the inviter; a reaction event to the look's owner. No cross-recipient reads are possible.

---

## 7. Retention, deletion, revocation

- **Seen semantics:** `seen_at` set on screen open; drives the entry presence dot only. No read receipt is ever sent to any other user.
- **Dismiss:** per-row `dismissed_at` (soft delete, recipient-only). Reversible via Undo toast for 5 s, then hard-deleted by the purge job.
- **Clear all (AC-10):** hard-deletes all of the recipient's rows. Explicitly **not** reversible — copy states this. Pending invitations remain valid in Circles (clearing the *notice* ≠ declining the *invite*).
- **Retention:** rows auto-expire 30 days after `created_at` (nightly purge). AC-08 groups items >7 days and notes auto-clearing.
- **Revocation (AC-05):** when a referenced subject is deleted/withdrawn (invite rescinded, shared look removed, circle deleted), the domain action sets `revoked_at` on dependent events. Revoked rows render as inert AC-05 with a Dismiss-only affordance and a short provenance line, then expire on the normal schedule. Deep links to revoked subjects resolve to AC-05.
- **Account/circle deletion cascades:** deleting a circle or leaving cascades `revoked_at`/delete to dependent recipient events.

## 8. Analytics minimization

Product analytics may record **that** a class of thing happened, never **what**. Enforced by an allow-list serializer; the raw event payload never reaches analytics.

| Logged | Never logged |
|--------|--------------|
| `event_type` (enum), coarse `surface` (activity/detail) | actor/recipient identity or handle |
| booleans: `had_unseen`, `was_grouped`, `is_revoked` | reaction text / transcript |
| action taken (enum: open/accept/decline/dismiss/clear_all/retry) | circle name, look title, product title |
| latency buckets, error class | any raw query, free text, or subject_id |

No PII, no free text, no identifiers leave the device un-hashed for analytics. Analytics is a distinct code path from the RLS-scoped data; it cannot widen the data recipient set.

## 9. Copy table

| Key | String |
|-----|--------|
| `nav.title` | Activity |
| `empty.title` | You're all caught up |
| `empty.body` | When someone in your circles invites you or reacts to a look you shared, it'll appear here — only for you. |
| `footer.privacy` | Only you can see your activity. It comes from people in your circles and never from public feeds. |
| `invite.row` | {name} invited you to the circle {circle}. |
| `invite.accept` / `invite.decline` | Accept / Decline |
| `invite.reversible` | Accepting is reversible — you can leave the circle at any time from its settings. |
| `invite.accepted` | {name} accepted your invitation to {circle}. |
| `reaction.row` | {name} reacted "{text}" to a look you shared. |
| `reaction.view` | View in Daily Social |
| `reaction.mute` | Mute reactions from {name} |
| `reaction.privacy` | Reactions are private to you. No one can see whether you've opened this. |
| `revoked.title` | No longer available |
| `revoked.body` | This invitation to {circle} was withdrawn or has expired. There's nothing left to accept. |
| `revoked.dismiss` | Dismiss |
| `loading.status` | Loading your activity… |
| `offline.banner` | You're offline. Showing your last saved activity. |
| `error.title` | Couldn't refresh |
| `error.body` | We couldn't reach Cinch just now. Check your connection and try again. |
| `error.retry` | Retry |
| `group.joined` | {count} people joined your circles |
| `group.reactions` | {count} reactions to your looks |
| `retention.note` | Activity older than 30 days is grouped, then cleared automatically. |
| `clear.title` | Clear all activity? |
| `clear.body` | This permanently removes every item from your Activity. Pending invitations stay in your circles. This can't be undone. |
| `clear.confirm` / `clear.cancel` | Clear All Activity / Cancel |
| `undo.dismissed` | Removed · Undo |

## 10. Motion & haptic table

| Interaction | Motion | Haptic |
|-------------|--------|--------|
| Screen push/pop | Native iOS slide (HIG default) | none |
| New row arrives (realtime) | Fade + 8px settle, 220 ms ease-out | none (calm; no arrival buzz) |
| Presence dot appears | Cross-fade 150 ms | none |
| Accept invitation | Row collapses 200 ms, success toast | `notificationSuccess` |
| Decline / Dismiss | Row height collapse 180 ms | `impactLight` |
| Undo toast | Slide up 200 ms, auto-dismiss 5 s | none |
| Pull-to-refresh | Native `RefreshControl` | `impactLight` at threshold |
| Clear-all confirm (destructive) | Sheet spring in; list fades to purge | `notificationWarning` on present, `impactMedium` on confirm |
| Retry tap | Skeleton cross-fade | none |
| **Reduce Motion ON** | All translate/scale → opacity-only cross-fades; skeleton pulse frozen; refresh spinner static | unchanged |

## 11. Accessibility

- **Dynamic Type:** full support incl. AX‑XXXL (AC-09). Rows reflow from horizontal to vertical stacks; action buttons become full-width and stacked; nav large-title scales and wraps. Touch targets stay ≥ 44 pt at every size.
- **VoiceOver:** each row is one element with a composed label + hint, e.g. label "Maya invited you to the circle Sunday Roasts, 2 hours ago, unread," hint "Double-tap to open." Inline Accept/Decline exposed as separate actions and via the VoiceOver **rotor custom actions** (so no gesture is required to reach dismiss). Section headers use `accessibilityRole="header"`. Presence dot is decorative (`accessibilityElementsHidden`); unread conveyed in the row label as text, not color alone. Loading uses `accessibilityLiveRegion="polite"` / `role="status"`.
- **Gesture alternatives (required):** swipe-to-dismiss and long-press each have a visible equivalent — "Edit" mode reveals per-row Remove buttons and the Clear All control; detail screens carry the same actions as tappable buttons.
- **Contrast:** oxblood `#7B2D2D` on warm paper `#F4F0EA` ≈ 7.4:1; body text `#2B2622` ≈ 12:1; secondary `#8A8178` used only ≥ 15 px. All meet WCAG AA (AAA for body).
- **Color independence:** unread = dot **plus** row-label text + subtle tint, never color alone. Destructive = label wording + placement, not red alone.
- **Focus order & safe areas:** logical top-to-bottom order; content respects top notch and bottom home-indicator insets (`useSafeAreaInsets`); keyboard N/A (no text entry in this feature) — if a future mute-note field is added it uses `KeyboardAvoidingView` with the sheet.

## 12. Tests

- **Unit:** row-template rendering per `event_type`; grouping logic (>7d collapses, thresholds); seen/dismiss/revoke reducers; analytics serializer strips all disallowed fields (property test: no payload string escapes the allow-list).
- **RLS (integration, pgTAP):** recipient reads only own rows; non-recipient read returns 0; client insert denied; recipient can update seen/dismiss but not others'; delete scoped to self; revoked rows hidden per policy.
- **E2E (Detox):** entry from Daily → open clears presence dot (no count ever rendered); accept/decline invite + Undo; deep link to revoked item lands on AC-05; offline shows cached list + retry recovers; clear-all confirm purges and is not undoable; pending invite survives clear-all.
- **A11y (jest-axe / RN a11y + manual VoiceOver pass):** AX‑XXXL snapshot has no clipping and ≥44pt targets; every actionable row reachable and operable via VoiceOver rotor with no swipe; contrast assertions; Reduce Motion disables transforms.
- **Snapshot/visual:** the 10 AC refs as baseline images.

## 13. Deviations & decisions

- **Entry as pushed screen, not a tab.** Deliberate — keeps Activity out of the primary nav so it can't act like an engagement surface. If product wants it in the tab bar later, the presence dot rule (boolean, clears on open, never a number) still holds.
- **Presence dot instead of any badge.** The one concession to "something changed" is a single boolean dot on the entry glyph. It is not the iOS app-icon red badge and carries no count.
- **No push notifications.** This feature requests no notification permission. Delivery is in-app refresh + the existing Circles realtime channel. If OS notifications are ever desired they are a separate, separately-permissioned project — out of scope here per constraints.
- **`outfit.saved.shared` shipped disabled.** Included in the taxonomy for forward-compatibility but feature-flagged off; it emits only if/when a future save/share feature creates a genuine recipient-directed event.
- **Reaction "Mute sender"** reuses existing Circles mute; no new data recipient or setting store.
- **30-day retention + auto-clear** chosen to keep the surface calm and bounded; tune via server config, no client change.

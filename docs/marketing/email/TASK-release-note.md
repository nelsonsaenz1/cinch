---
name: cinch-release-note
description: Draft the release-note email when a new Cinch build goes live on the App Store. Drafts only — never sends.
---

# Cinch — release note

When a version actually reaches customers, it gets one email that makes it feel like an
event. Roughly monthly. **Quality bar: if you cannot name three things a user will
notice, this is not a release note — skip it and let the weekly Dispatch carry the
news.**

**Trigger:** a build reaches `READY_FOR_SALE` **and** the OTA is published to the live
runtime. Either Nelson runs this by hand, or a daily checker runs Step 1 and only
proceeds on a version change.
**You never send.** Draft, report, stop.

---

## STEP 0 — Load the rules

Read `/Users/nelsonsaenz/cinch/docs/marketing/email/PROGRAM.md`. Binding.

---

## STEP 1 — Confirm it is actually live

Two independent checks — both must pass:

1. **App Store Connect.** From a logged-in tab:
   `/iris/v1/apps/6798479578/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,appVersionState&limit=3`
   The newest version must read `READY_FOR_SALE`. `PENDING_DEVELOPER_RELEASE` and
   `WAITING_FOR_REVIEW` do not count.
2. **The release ledger** — `docs/ops/cinch-implementation-release-ledger.md`. Confirm
   the OTA for this runtime is published. A binary that is approved but whose OTA has
   not shipped means users do not have the code yet.

If the newest live version already has a release note in
`docs/marketing/email/` (`draft-release-*.html`), stop — it has been covered.

If either check fails, stop and report. **Announcing a version people cannot install is
the single worst thing this program can do.**

---

## STEP 2 — Find the three things

`git -C /Users/nelsonsaenz/cinch log <last-released-tag-or-date>..HEAD --stat`, then
pick the three changes a user would actually notice. Rank by how visible they are, not
by how hard they were to build.

For each, write the benefit in the user's language, not the commit's. Compare:

> ✗ `outfits = (tops × bottoms + dresses) × max(shoes, 1)` — shoes no longer gate cores
> ✓ Cinch used to refuse to count a single outfit until you had photographed shoes.
>   That was our arithmetic being wrong, not your closet.

If a change fixes something that was visibly broken, say so plainly. Users already knew;
pretending otherwise reads as evasion and costs more trust than the bug did.

Check `list-received-emails` — if a user reported one of these, that is your lead item,
and "you asked for this" is the strongest line in the email.

### Never advertise
Pinterest inspiration (dark until Pinterest's trial clears) · the shop shelf / "where to
buy" (gated behind `show_where_to_buy`, C-03) · anything merged but not OTA-published.

---

## STEP 3 — Build the drafts

`docs/marketing/email/release.html`. Slots: `VERSION`, `RELEASE_DATE`, `HEADLINE`,
`LEDE`, three × `ENTRY_{ONE,TWO,THREE}_{KICKER,TITLE,BODY}`, `CTA_LABEL`, `CTA_URL`,
`INVITE_LINE`, `INVITE_URL`, `OFFER_LINE`, `OFFER_CTA`, `OFFER_URL`.

Kickers: `New` · `Better` · `Fixed`.

Then, exactly as in the weekly task:

- Swap `{{{FIRST_NAME}}}` → `{{{FIRST_NAME|there}}}` (broadcasts take the pipe
  fallback, templates do not).
- Keep `{{{RESEND_UNSUBSCRIBE_URL}}}` and the account-explanation line.
- Confirm `OFFER_LINE` against live ASC pricing — PROGRAM.md §6.
- Write `draft-release-<version>-active.html` / `-nostart.html` plus `.txt` twins.
- `create-broadcast` twice, from `Cinch <hello@mail.cinchstyle.com>`:
  - `Cinch <version> — Active closet`, segment `94ebb650-fba3-4f93-938f-582acbaff748`
  - `Cinch <version> — No closet yet`, segment `2ecfd8fc-37d8-4406-8e80-5fbf67950933`
- Validate: tag balance, and no leftover `{{{…}}}` beyond `FIRST_NAME|there` and
  `RESEND_UNSUBSCRIBE_URL`.

**Cohort A (No closet yet)** gets the same three items but a different frame: they have
never used any of it, so the release is evidence the app is being looked after, and the
CTA stays "Add your first ten."

---

## STEP 4 — Suppress that week's Dispatch

Two emails per person per 7 days. A release note **replaces** the week's Dispatch, it
does not stack with it. Append a line to `docs/marketing/email/sent-log.md`:

```
2026-10-04  Release 1.3.0 drafted — Dispatch for week of 10-04 SKIPPED
```

The weekly task reads that file and stands down.

---

## STEP 5 — Report, then stop

Both subject lines, both preview URLs, the three items and why you chose them, the live
version number with the evidence for both liveness checks, and anything you left out
because it is not live. Then stop. Nelson sends.

---

## Standing constraints

1. **Never send.**
2. **Never announce a version that is not `READY_FOR_SALE` with its OTA published.**
3. **Fewer than three user-visible changes → no release note.** Let the Dispatch do it.
4. **Never email the 11 internal accounts** (listed in PROGRAM.md §2).
5. **Never invent a quote, a number, or a customer.**
6. Name a bug plainly when you fixed one. That is the house voice.

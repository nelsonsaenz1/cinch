# Superwall support request — paywall cannot be published (`save+promote` → `NOT_FOUND`)

Draft prepared 2026-08-06. Send via the Superwall dashboard's support/intercom widget or
support@superwall.com. Everything below is non-sensitive — no keys or secrets are included.

---

**Subject:** Paywall 252860 cannot be published — `save+promote` fails with `NOT_FOUND` at version 0

Hi — we're blocked from launching and can't publish a paywall. Every publish attempt fails inside your
own editor's `save+promote` endpoint, so this doesn't look like something we can fix from our side.

**Account details**

| | |
| --- | --- |
| Organization | 26053 |
| Project | 28319 ("Cinch") |
| Application | 52618 ("Cinch", bundle `com.nelsonsaenz.cinch`) |
| Paywall | 252860 ("Cinch — Membership", identifier `cinch-membership`) |

**What happens**

Clicking **Publish** opens a correctly-scoped confirmation dialog (targeting our "Limits & trial"
campaign, "No active entitlement — free, or trial lapsed", 100% of users). Confirming it starts the
5-step save and then halts:

- **Attempt 1** — halted at `Save failed 02 / 05`. Step 01 "Preparing snapshot" ✓, step 02 "Uploading
  assets" ✓, step 03 **"Validating paywall" ✗ `NOT_FOUND`**. Steps 04 "Publishing version" and 05
  "Finalizing" never ran.
- **Attempt 2** (via the Retry button) — halted *earlier*, at `Save failed 00 / 05`, with step 01
  **"Preparing snapshot" ✗ `NOT_FOUND`**.

Console error on both attempts:

```
save+promote failed TRPCClientError: NOT_FOUND
  at .../editor/sha/7943cad5dc00/assets/index-78812575.js
```

It regressed between attempts rather than recovering, so it doesn't appear to be transient.

**Current state via your API** (`GET /v2/paywalls/252860`, unchanged across all attempts)

```json
{
  "id": 252860,
  "identifier": "cinch-membership",
  "paywall_url": "https://user-content.superwalleditor.com/runtime/sha/0722115e7f10/store/document/ZF5HKA-BF19nEzVZ4MKyK",
  "status": "active",
  "version": 0,
  "products": [],
  "feature_gating": "gated",
  "created_at": "2026-08-05T20:44:52.735Z",
  "updated_at": "2026-08-05T20:44:52.735Z",
  "published_at": null,
  "archived": false
}
```

**Our hypothesis, in case it saves you time**

`NOT_FOUND` fires at both "Preparing snapshot" and "Validating paywall" — both steps that need to
re-fetch the stored block-editor document behind `paywall_url`
(`.../store/document/ZF5HKA-BF19nEzVZ4MKyK`). The editor itself renders the paywall perfectly from its
own loaded state, so the document content exists; it's the server-side lookup that resolves to nothing.

Two supporting signals:

1. `updated_at` has **never** moved off `created_at` (2026-08-05T20:44:52.735Z), even though the
   document has been fully built out and edited since — the API record doesn't seem to track document
   edits at all.
2. `products` reads `[]` from the API while the editor's Products panel correctly shows all four
   attached (`standardMonthly` → `cinch.standard.monthly`, `standardAnnual` →
   `cinch.standard.annual`, `proMonthly` → `cinch.pro.monthly`, `proAnnual` → `cinch.pro.annual`),
   with prices resolving live in the preview.

Both are consistent with the API record and the editor document having become unlinked.

**What we've already ruled out**

- Not a products problem — all four exist, are correctly priced, and are mapped to entitlements
  (55809 standard, 55806 pro). `ios.products_imported` and `entitlement.product_has_entitlement` both
  pass in `run_doctor`.
- Not a permissions problem — the same session can write other settings successfully (we set the
  application's Apple App ID via the API without issue).
- Not a partial publish — the failure is atomic and halts before "Publishing version", so nothing
  inconsistent has landed.
- Not a config gap elsewhere — App Store Connect API key, ASSN URLs (both Production and Sandbox), the
  webhook endpoint, and the campaign placements are all configured and verified.

**What we need**

Either a repair of the link between paywall 252860 and its editor document so `save+promote`
succeeds, or guidance on the correct way to recover — if the fix is to rebuild into a fresh paywall
we'd like to know before we do it, since it means redoing the design.

This is currently our only launch blocker; the app binary is already uploaded to App Store Connect.

Thanks.

---

## Addendum — "Copy error" payload (captured 2026-08-06)

The failure toast's **Copy error** button was clicked on the live editor tab. The full clipboard
payload is, verbatim and in its entirety:

```
NOT_FOUND
```

That is the whole thing — 9 bytes. The button carries no tRPC path, request id, or stack beyond what
the console already showed, so there is no richer context available from our side.

The tab's console holds seven identical entries, all of the form:

```
save+promote failed TRPCClientError: NOT_FOUND
  at Kc.from (https://superwall.com/editor/sha/7943cad5dc00/assets/index-78812575.js:50:36315)
  at https://superwall.com/editor/sha/7943cad5dc00/assets/index-78812575.js:50:41194
```

## Addendum — duplicate-and-publish test (2026-08-06)

We duplicated 252860 within the same application (`POST /v2/paywalls/252860/duplicate`, no target
application) to see whether a fresh record would publish. The result isolates the fault to 252860's
stored document.

**The duplicate — paywall 253192, "Cinch — Membership (publish test)" — came out empty.** Opening it
in the editor shows a blank device preview and a Layout panel reading "Add an element to get started";
the browser console logs four `NetworkError: A network error occurred.` exceptions on load. None of
the design copied across, even though the source renders perfectly in its own editor tab. The
duplicate API response carried `paywall_url`
`.../runtime/sha/f2e704135ad3/store/document/7fiw1SdWsMoVDTZjxrRzl`, but nothing readable is behind it.

**The empty duplicate saves and promotes perfectly.** Clicking Save ran the same 5-step pipeline and
completed all five — including step 01 "Preparing snapshot" and step 03 "Validating paywall", the two
steps that fail on 252860. It was saved twice (second time after switching Feature Gating to Gated),
and both saves succeeded.

Each successful save visibly rewrites the record in ways 252860 has never shown:

| | 252860 (original) | 253192 (duplicate) |
| --- | --- | --- |
| `updated_at` vs `created_at` | identical, never moved | moves on every save (14:49:01 → 14:50:41 → 14:52:12) |
| `paywall_url` runtime sha | `0722115e7f10` (stale build) | `7943cad5dc00` — matches the current editor build |
| document id | `ZF5HKA-BF19nEzVZ4MKyK`, unchanged since creation | a **new** id written on each save |
| `preview_url` | `null` | regenerated on each save |
| `feature_gating` | `gated` | followed the editor, `non_gated` → `gated` |

**What this tells us**

1. It is **not** account-, application- or platform-level. `save+promote` works end to end for a
   different paywall in the same application, same session, same browser, minutes apart.
2. `feature_gating` and the design both live in the editor document, not the API record — and a
   successful save writes a brand-new document and repoints `paywall_url` at it. 252860 has never had
   that happen, which means **no save has ever succeeded on it**, right back to creation.
3. The duplicate arriving empty is independent corroboration that 252860's stored document cannot be
   read server-side. The editor renders it from its own loaded state; your server-side copy produced
   nothing.

So the design of 252860 currently exists only in the browser tab that has it open. We have deliberately
not reloaded, retried, or otherwise disturbed that tab.

**Revised ask:** please repair the link between paywall 252860 and its editor document
(`.../store/document/ZF5HKA-BF19nEzVZ4MKyK`), or recover that document's content, so a save can write
through. Duplicating is not a viable workaround for us — it loses the design entirely.

Paywall 253192 was created purely as this test. It is an empty draft, attached to no campaign, and can
be discarded.

# Superwall support request — publish fails at "Preparing snapshot" with NOT_FOUND

**Paste everything below the line into the support chat widget.**
Written 2026-08-06. Delete this file once resolved.

> **Stale, read as a dated record only (noted 2026-08-10).** The paste below is
> left verbatim because it is a support-chat transcript. Two things in it are no
> longer true: there are now **four** campaigns, not two, and they point at
> paywall **254200** ("Cinch Membership v3"), not 253377. Do not take "that
> paywall is the one that should go live" from this file — see
> `docs/design/paywall-publish-runbook.md`.

---

Hi — I can't publish or save any paywall in the new (Public Beta) editor. Every
attempt halts at step 1 of 5 with "Save failed — Preparing snapshot:
NOT_FOUND".

Account details:

- Org 26053, project Cinch (28319), iOS app 52618 (com.nelsonsaenz.cinch)
- Failing paywall: "Cinch — Membership", id 252860
- **Reproduces on a completely blank, freshly created paywall** (id 253192,
  "Cinch — Membership (publish test)") — so it isn't the document content
- First observed ~15:00 UTC on 2026-08-06; persists across retries, hard
  reloads, and ~1+ hours

Browser console signature on every attempt:

```
save+promote failed TRPCClientError: NOT_FOUND
    at Kc.from (https://superwall.com/editor/sha/7943cad5dc00/assets/index-78812575.js:50:36315)
```

each preceded by four uncaught `NetworkError: A network error occurred.`
exceptions (they appear to come from a worker context; the requests never show
in the page's network log).

Update, later on 2026-08-06 (~22:50 UTC): reproduced a third time on paywall
id 253377 ("Cinch Membership", identifier cinch-membership-v2) — created fresh
through the v2 API with four products attached, content built through the
editor's own agent relay (Connect Agent / superwall-editor skill), all four
products resolving prices correctly in preview. Save still halts at
"01 Preparing snapshot: NOT_FOUND" (Copy error yields only the string
NOT_FOUND). So the failure is independent of: document content, document age,
how the paywall was created, and whether products are attached. Both of our
campaigns (100436, 100596) now point at 253377 — the moment publish works for
this account, that paywall is the one that should go live.

Possibly related: throughout the same day, the editor's screenshot service was
consistently timing out (get_screenshot via the editor MCP agent, and the
editor's own snapshot renders), and your session-replay ingest
(`ingest.maple.dev/v1/sessionReplays/blob`) was returning 503. Your status page
showed all components operational.

Two questions:

1. Can you unblock save/publish for this account, or confirm whether this is a
   known incident with the beta editor's snapshot pipeline?
2. Separately, your doctor endpoint reports `webhook.has_active_endpoint:
   active_endpoint_count: 0` while the webhook API lists an enabled endpoint
   (`ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf`). Which should we trust? (We have not
   created a second endpoint to avoid double deliveries.)

Thanks — happy to provide a HAR file or screen recording if useful.
Contact: nelsonsaenz1@yahoo.com

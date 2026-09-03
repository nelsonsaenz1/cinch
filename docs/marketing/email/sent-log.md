# Cinch email send log

One line per Dispatch or release note that was drafted or sent. The weekly task reads
this file to honour the 2-emails-per-person-per-7-days cap: if a release note was
drafted in the current week, the Dispatch stands down.

Format: `YYYY-MM-DD  <what>  <status>`

2026-09-01  Dispatch No. 01 (Active closet + No closet yet)  DRAFTED, unsent
2026-09-01  Dispatch No. 01 (Active closet)  SENT 23:17Z to 13 deliverable recipients (relay addresses excluded, see relay-pending.md)
2026-09-01  Dispatch No. 01 (No closet yet)  SENT 23:17Z to 10 deliverable recipients (relay addresses excluded, see relay-pending.md)
2026-09-01  Savannah reply + Pro-year grant (transactional)  SENT 23:08Z, delivered
2026-09-01  Relay seed tests x2 (dispatch copies)  BOUNCED — Apple Private Email Relay does not accept mail.cinchstyle.com; see relay-pending.md
2026-09-01  Apple Private Email Relay registered (both domains) — post-reg seed DELIVERED; incident resolved
2026-09-01  Dispatch No. 01 relay redelivery — 13 personalized one-offs SENT 23:39Z (Madison had the seed); Zainab spot-checked delivered; all 14 contacts restored to segments
2026-09-02  A7 never-charged trial note — 21 emails SCHEDULED for 14:00Z (10am ET), per-person expiry dates, covers the full Sep-11 cliff cohort incl. relay users
2026-09-02  A27 CONVERSION: 21 scheduled never-charged notes CANCELLED; 29 amended conversion notes queued for 14:00Z (Sep-3 wind-down + membership offer); all live gifted trials shortened to <= 2026-09-03T14:00Z in subscriptions
2026-09-03  Re-engagement No. 01 seeds x3 (nelsonsaenz1@yahoo.com only)  SENT 12:07–12:1xZ, all delivered. Seeds 1–2 carried a card that overflowed a 375px viewport (`width="600"` with only `max-width`, inherited from dispatch.html); seed 3 is the corrected build and is what ships. **dispatch.html and release.html still carry the unfixed width — they were sent that way on 09-01.**
2026-09-03  Re-engagement No. 01 (29 prior recipients, two cohorts)  DRAFTED, unsent — awaiting founder approval AND the /closet web deploy. Payload built, audience reconciled, seeds delivered. See PROGRAM.md §11.
2026-09-03  Re-engagement No. 01  ALL 29 SCHEDULED for 22:00Z (16 start + 13 kept), each confirmed by read-back. **Resend ingestion lag of ~3-4 minutes is real and was mistaken for failure**: the first kept batch returned 200 at 13:06:5xZ, 404'd on `get-email` and was absent from `list-emails` for four minutes, then appeared with a `Sent` timestamp of 13:10:2xZ (the ingestion time, not the write time). Two further writes were made during that window — a retry batch of 6 and one single send — and both are duplicates that must be cancelled. **Lesson for this program: after `send-batch-emails`, wait 5 minutes before concluding a write failed. Never retry on a 404 read-back alone.**
2026-09-03  Re-engagement No. 01 duplicate cleanup  DONE 13:1xZ — all 7 duplicate ids cancelled and verified `status: canceled` (01a06763-07b6/07b7/07b8-553b/07b8-5b7c/07b9/07ba/836b). Final roster re-read in full: **29 scheduled, 13 kept + 16 start, exactly one per recipient, all 2026-09-03T22:00:00Z.** Keepers are the 01a06760-* / 01a06761-* / 01a0675c-e-f-* sets.

## After the 22:00Z send — what to collect

1. Resend: `delivered` / `bounced` / `unsubscribed` per recipient (`list-emails`, `get-email-metrics`). **There will be no click data — click tracking is deliberately OFF because Resend link-rewriting would break the universal link.** Do not print an open rate in its place.
2. Web: hits on `/closet` are the only proxy for a tap. No analytics on the marketing site (ledger A5, Vercel Web Analytics still off), so this is currently unreadable — worth noting as the gap it is.
3. App: events keyed on the 29 recipients' `distinct_id`s (= their `auth.users.id`; 27 of 29 resolve in PostHog). Baseline to beat: **0 events from any recipient since 2026-09-02 06:59:20Z.**
4. Purchase: `subscriptions.plan <> 'free'`, `asc_notifications` with `environment='Production'` and a subscription type, non-sandbox `superwall_events`. Baseline: none exist.
5. Print every figure **family-included (29) and family-excluded (26)** — avasaenz06, karencsaenz and colesaenz5 are in the audience by founder ruling 09-03, and two of them are top-of-cohort.
6. Replies: read the Resend inbox and convert any UNSUBSCRIBE reply into a manual suppression within one business day. The email promises exactly that.

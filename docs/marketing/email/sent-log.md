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

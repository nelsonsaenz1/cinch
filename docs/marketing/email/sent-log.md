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

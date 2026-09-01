---
name: cinch-daily-welcome
description: Send the day-1 welcome email to people who signed up for Cinch yesterday. The only Cinch stream authorised to send without review.
---

# Cinch — day-1 welcome

Every morning, the people who made a Cinch account yesterday get one email whose only
job is to get a first garment into the closet. 19 of 36 accounts have never added one;
this task exists to shrink that number.

**Schedule:** daily, 10:00 ET.
**Volume:** typically 0–5 people. Often zero. Zero is a normal, successful run.

---

## ⚠️ This is the one stream that sends

Nelson authorised automatic sending for the welcome email specifically, because it is
one-per-person, expected, and triggered by the recipient's own signup. **That
authorisation covers this task and nothing else.** You may not send a Dispatch, a
release note, a broadcast, or any other message from this task.

**LIVE = false** until Nelson flips it.

While `LIVE = false`, do everything below except the send: build the exact recipient
list, render one full preview, and report what *would* have gone out. Nelson flips this
line to `true` in this file once he has seen a clean dry run.

---

## STEP 1 — Build the recipient list

Supabase project `dugizuswuebrmcmvinmi`:

```sql
select u.id,
       lower(u.email) as email,
       initcap(split_part(coalesce(nullif(p.display_name,''),
              nullif(u.raw_user_meta_data->>'full_name',''),''),' ',1)) as first_name,
       (select count(*) from items i where i.user_id = u.id) as items
from auth.users u
left join profiles p on p.user_id = u.id
where u.created_at between now() - interval '48 hours'
                       and now() - interval '24 hours'
  and u.email is not null and u.email <> ''
  and u.email not in (
    'qa-closet-recut-verify@cinchstyle.com','sim-test@cinchstyle.com',
    'sim-test+ja@cinchstyle.com','sim-test+j00@cinchstyle.com',
    'simtestf31@cinchstyle.com','fixture-ada@cinchstyle.com',
    'launch-probe@mail.cinchstyle.com','hello@mail.cinchstyle.com',
    'demo@cinch.app','lisa.2wxrklc.paid@icloud.com','lisa.2wxrkclc.paid@icloud.com');
```

Then filter:

- **Drop anyone already in `sent-welcome.log`** (see Step 4). Never send twice. The log
  is pre-seeded with every account that existed on 2026-09-01, so the program starts
  clean and no established user ever receives a "welcome, here is how to begin".
- **Drop anyone with ≥10 garments.** They are past onboarding; a welcome email reads as
  if nobody is paying attention. Verified hazard: on 2026-09-01 this window returned
  Savannah (108 items), who was mid-conversation with Nelson at the time.
- **Drop anyone who has emailed us.** Check `list-received-emails` for their address. A
  person in a live thread with the founder must not receive an automated welcome.
- **Clean `first_name`.** Email prefix (`sydneyshack1`) or garbage (`Nhithz`, `Hhu`) →
  a real given name, or the literal `there`. The template has no fallback; an empty
  value renders "Hi  —".
- **Note who already has items.** They still get the welcome — it covers more than
  cataloguing — but swap `STEP_ONE_*` for the variant in Step 3 so you are not telling
  someone with a closet to go build one.

---

## STEP 2 — Stop conditions

Abort the whole run, send nothing, and report, if any of these is true:

- **More than 15 recipients.** Cinch gets a handful of signups a day. Fifteen means the
  date window broke, the suppression log was lost, or something upstream is wrong.
  A too-wide send cannot be taken back.
- Any address is not a plausible personal email, or is on the internal-accounts list.
- The Resend domain `mail.cinchstyle.com` is not `verified` / sending enabled
  (`list-domains`).
- The `cinch-welcome` template is not published (`get-template cinch-welcome`).

---

## STEP 3 — Send

Template `cinch-welcome` (id `730e4d83-d19f-47a4-b7a9-bd3e27b45069`, published).
From `Cinch <hello@mail.cinchstyle.com>`, reply-to the same.
One `send-email` per person. Pass `FIRST_NAME`; every other variable has a good
fallback baked in, so override only for the case below.

**If the person already has ≥1 garment**, override these three so the email is not
telling them to do something they have done:

- `STEP_ONE_KICKER`: `Nicely started`
- `STEP_ONE_TITLE`: `You have already got pieces in.`
- `STEP_ONE_BODY`: `Keep going to ten — that is the point where Cinch can start building
  outfits properly and the Reveal has a real number to show you.`

**Seed on the first live run only:** send one copy to `nelsonsaenz1@yahoo.com` first and
confirm it renders before sending to anyone else.

**Apple private relay:** `@privaterelay.appleid.com` addresses forward only while
`hello@mail.cinchstyle.com` is registered under Sign in with Apple → Email
Communication. Registered as of 2026-09-01. If a relay address hard-bounces, stop
sending to relay addresses and tell Nelson immediately — repeated bounces damage the
domain's reputation and it is slow to recover.

---

## STEP 4 — Log and report

Append one line per successful send to
`docs/marketing/email/sent-welcome.log`:

```
2026-09-02T14:03Z  savannahswanson76@gmail.com  Savannah  items=0  id=<resend-email-id>
```

**This file is the only thing preventing duplicate sends. Read it before every run and
write to it after every send.** If it is missing, do not assume nobody has been emailed
— abort and ask Nelson.

Report: how many were eligible, how many were sent, how many were suppressed as already
sent, any bounces or errors, and — if `LIVE = false` — the full rendered preview of one
email.

---

## Standing constraints

1. **This task sends the welcome email and nothing else.**
2. **Never send to the same person twice.** The log is authoritative.
3. **Never exceed 15 recipients in one run** — abort instead.
4. **Never email the 11 internal accounts.**
5. **Never remove the unsubscribe block** or the account-explanation line.
6. Zero eligible people is a normal outcome. Report it in one line and finish.
7. If anything is ambiguous, send nothing and ask. An unsent email costs a day; a wrong
   send costs the domain.

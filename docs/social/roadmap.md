# Cinch Social — Roadmap

Companion to [product-spec.md](./product-spec.md). Opinionated sequencing: the founder
wants to launch soon, so the MVP is the smallest slice that delivers the magic —
**"my friends and I planned our outfits for Thursday's dinner together"** — with the
full UGC-compliance set (which Apple will not let us defer), and nothing else.

Effort figures are rough build-time for the current team shape (one engineer + agents),
assuming the dormant schema and the Plate component library are reused as specced. They
exclude App Review turnaround.

---

## Phase 0 — Substrate (prerequisite, ~1 week)

Ships no visible feature; unblocks everything.

- Username claim UI (schema already enforces format/uniqueness — `profiles.username`).
- Friend model on the existing `follows` table: request/accept = edge + reciprocal edge;
  Requests inbox; friend list in Profile. Invite-link tokens (works pre-signup — this is
  the growth door and must be solid).
- Block table + enforcement plumbing (every later query filters through it — building it
  first is 10× cheaper than retrofitting).
- New member-scoped tables: `events`, `event_members`, `event_looks`,
  `event_look_reactions`, `event_comments`, `reports`, `blocks` — per the spec's privacy
  map: owner/member-only base tables, explicit projections for every cross-user read,
  `command_log`-pattern write RPCs. `items.is_borrowable` column lands now (default
  true) even though borrowing UI comes later — retrofitting a default-true flag after
  closets are shared is a consent problem; before, it's a migration.

**Gate to proceed:** RLS test suite covers every new projection (the repo already has
`supabase/tests` precedent).

## Phase 1 — MVP: Occasions (~3–4 weeks) → ship it

The launch cut. Spec sections 3.1–3.5, 5, 7, 8.

- Create occasion (invite-only only — defer even "friends can request"), invite friends
  + invite link, join/decline, occasion on the Plan calendar.
- Occasion detail: guest row, per-attendee look bands, coordination colophon (static
  palette line only — no AI call).
- Pin a look from Today's plates / saved outfits / hand-built. "Ask the stylist" with
  event context included **only if** it's a context-snapshot change to the existing
  generation call (it is — the pipeline already takes occasion/formality context);
  attendee-aware suggestions explicitly deferred.
- Voting (one movable signed pick per board), the five compliments, comments, lock +
  winning look + crown moment, "plan it" via existing `plan_outfit_tx`.
- **Full UGC compliance set (launch-blocking, Apple 1.2):** report on every content
  type, block (with shared-event choice), server-side text filter on all UGC fields,
  moderation queue + 24h process + published contact, social EULA gate, 16+ gate,
  deletion cascade. Budget a real week for this; it is a third of the phase and
  non-negotiable.
- Notifications: invites, first look, picks/compliments (digested), comments, lock.
- Activity sheet (minimal list, grouped by occasion).

**Deliberately cut from MVP and why:**

- *Borrowing* — the second-best idea in the feature; cutting it hurts, but it needs
  friend-closet browsing (a whole new privacy projection + storage policy) and its own
  request lifecycle. The dinner loop stands alone without it; borrowing makes a perfect
  "what's new" release two weeks later.
- *Friend-closet browsing* — only exists to serve borrowing; travels with it.
- *One-way follows / public closets / feed* — the dormant tables keep sleeping. Growth
  surface, not magic; would triple the moderation surface at launch.
- *Recap* — painful cut, it's the best growth artifact, but it needs the multi-party
  consent flow done right and the event loop must exist before recaps have material.
  First fast-follow.
- *Resy/OpenTable anything* beyond the pasted members-only link.
- *Occasion-mate friend requests from event links* — MVP event links are for the host's
  actual friends; keep the stranger-adjacent path out of the first review cycle.

**MVP success signal:** % of created occasions that reach ≥2 members with ≥1 look each,
and votes per look. If occasions are created but nobody pins, the mirror step is too
heavy — fix that before building anything else.

## Phase 2 — Fast-follow: Borrowing + Recap (~2–3 weeks)

Two releases, order per founder taste:

- **2a — The Recap** (~1 week): consent flow, composed table plate on the existing
  share pipeline, morning-after notification. Every recap shared to Instagram is an ad
  with real people in real clothes — ship this before spending a dollar on marketing.
- **2b — Borrowing** (~1.5–2 weeks): friend profile + friend-closet projection
  (presentation columns + size, borrowable filter), "Not for lending" tagging UI +
  closet sweep + kill-switch, borrow request lifecycle (extend the dormant
  `item_inquiries` pattern), on-loan ribbons, borrowed-item stylability in the composer
  and event looks.
- Also in Phase 2: attendee-aware "ask the stylist" (palette/formality of pinned looks
  folded into the generation context — same quota, no new gate).

## Phase 3 — The wider platform (~4+ weeks, sequence by data)

- One-way follows + public closets: wake the dormant `public_*` machinery, follow
  button, a restrained lookbook feed (reverse-chron plates from followed closets — no
  ranking algorithm; the Plate is a magazine, not a feed). Revisit the fourth tab
  ("Circle") only here.
- "Friends can request" event visibility; occasion-mate friend requests (rate-limited).
- Reservation-link parsing (prefill venue/time from pasted Resy/OpenTable share URLs);
  partner-API investigation.
- Wedding/trip occasion types with multi-day support (leans on the Plan tab's existing
  packing mode — "the trip is an occasion" is a natural extension).
- Recap archive; evaluate pro-tier archive depth with real data.
- Moderation tooling upgrade if volume demands (queue UI, trusted-flagger weighting,
  image moderation for avatars if not launched initials-only).

## Explicit non-goals (permanent unless re-decided)

- Public events, event discovery, maps, "near you" — rejected on safety grounds.
- Matching strangers by reservation — rejected permanently (spec §7.1).
- Cross-attendee ranking / best-dressed anything — rejected as anti-thesis (spec §5).
- Anonymous votes or reactions; downvotes.
- In-app payments for borrowing/selling (the `item_inquiries` stance: connect people,
  never touch the money — keeps Guideline 3.1.1 away).
- Streaks and engagement-bait notifications.

---

## Open questions for the founder

1. **Recap consent default** — spec says unanswered = excluded (safest). Accept the
   engagement cost, or default-include with pre-event blanket consent at join time?
2. **Age gate** — 16+ for social keeps the rating sane; comfortable telling younger
   users no? (Under-16 keeps the whole solo app.)
3. **Moderation SLA** — who answers the report queue within 24h at launch? (Founder
   phone + email alert is acceptable at launch scale, but it must be someone's name.)
4. **Occasion-mates** (non-friend co-attendees via link): current spec gives them
   in-event visibility only and one friend-request. Too closed? Too open?
5. **Logistics retention** — venue/reservation pruned 30 days post-event. Right number?
6. **Naming** — "Occasions" is the working name for the feature; the event screen
   idiom ("the table," "the mirror," "the crown") needs a taste pass from you.
7. **Sizes to friends** — default-on only for borrowable items (spec §3.6). Comfortable,
   or default-off?
8. **MVP timing vs. current release blockers** — Occasions Phase 1 is ~4–5 weeks
   including Phase 0. Ship the solo app first (current blockers: Apple approval,
   Supabase Pro, screenshots, item deletion) and follow with social, or hold launch
   for it? Recommendation: ship solo first; social is a v1.1 that gives launch users a
   reason to invite friends and press a second story to tell.

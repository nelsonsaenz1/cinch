# Cinch Social — Product Specification

**Working name:** Occasions (the feature set: events, friends, shared styling, borrowing)
**Status:** Product design — pre-architecture. Companion doc: [roadmap.md](./roadmap.md)
**Reads before this doc:** `docs/design-directive.md` (product brief), the Plate design direction,
`supabase/migrations/20260803210000_styling_learning_social.sql` and
`20260804200000_public_boundary_tenant_integrity_and_commands.sql` (the dormant social substrate).

---

## 1. The idea, restated as a product

A woman has a dinner for four at Rosemary's on Thursday. Today, Cinch styles her alone.
After this ships, she posts the dinner to her Cinch calendar, her three friends join it,
each of them pins a couple of outfit options from her own closet, everyone helps everyone
pick, and each woman walks in Thursday night wearing *her* winning look — chosen with her
friends, coordinated against what the others are wearing, possibly wearing a borrowed
piece from a friend's closet.

The core insight that shapes every decision below: **Cinch outfits are made of clothes the
user actually owns.** That makes this social layer unlike Instagram or Pinterest — nothing
posted is aspirational; everything is wearable *tonight*. The social loop is not "admire,"
it is "help me decide" and "lend me that." Every mechanic below is built to serve
decision-making and lending, not audience-building.

### The three loops

1. **The Occasion loop** (the magic, the MVP): event → friends join → each posts outfit
   options → friends vote and comment → a winning look per attendee → everyone shows up
   coordinated. Then the recap: a shareable lookbook plate of what the table actually wore.
2. **The Friends loop:** mutual friends can browse each other's closets — "does Dana own
   a black clutch?" — and request to borrow anything not tagged *Not for lending*.
3. **The Follow loop** (later): one-way follows of public closets; the existing dormant
   `follows` / `closet_likes` / `public_*` machinery. This is the growth surface, not the
   launch surface.

---

## 2. The social graph: one-way follows, mutual friends

**Decision: one substrate, two relationships.** The dormant `follows` table (one-way
edges, follower/followee, counts already denormalised onto `profiles`) is the only graph
table. On top of it:

- **Follow** (one-way): "I subscribe to her public lookbook." Grants nothing private —
  only what the `public_*` projection views already serve. Deferred to Phase 3.
- **Friend** (mutual): both edges exist (`A→B` and `B→A`). Friendship is what unlocks
  everything intimate: closet browsing, borrowability, event invitations, seeing who is
  attending an event.

**Why mutual-friends-on-top-of-follows rather than a separate friendship table:**

1. It designs *with* the dormant schema, not against it. A friend check is a two-edge
   existence test on a table that already exists, is already indexed both directions, and
   already maintains counts.
2. It gives the product both relationships from day one of Phase 3 without a migration:
   accepting a "friend request" is just following back. Declining is just… not.
3. It matches the mental model women already have from Instagram: follow is cheap and
   public-ish; "close friends" is the real circle. Cinch's friends *are* the close-friends
   ring, and the app never needs a separate "unfriend" concept — unfollowing dissolves it.
4. Asymmetric edge-cases resolve sensibly: if Dana unfollows Maria, Maria's one-way follow
   of Dana silently degrades to public-only visibility. No awkward "friendship ended"
   notification (and we deliberately never send one — see §8).

**In the UI, the app never says "follow" during MVP.** MVP ships friends only, made via
invite links (see §4.1); the verb is "add a friend." The one-way vocabulary appears only
when public closets ship.

### Friend request flow (MVP)

- **Add by invite link/QR** — primary path, works for friends not yet on Cinch (this is
  the growth loop: "join Cinch so we can plan Thursday"). A link encodes a short-lived
  invite token; opening it after signup creates my edge toward you and prompts you to
  accept (create the reciprocal edge) or ignore.
- **Add by username** — search over `public_profiles` (username, display name, avatar
  only). Sends a friend request = creates my edge; the app shows "Requested" until
  reciprocated. Recipient gets a request in an **Requests** inbox, can Accept / Ignore /
  Block. Ignore is silent. Requests from blocked users never surface.
- **Privacy defaults:** profiles stay `visibility = 'private'`. A private profile is
  findable by exact username only if the user enables "Let friends find me by username"
  (default ON — it exposes username/display-name/avatar to exact-match lookup, nothing
  else; the architecture agent should serve this via a dedicated lookup view or RPC, not
  by widening `public_profiles`). Turning it off makes invite links the only door.

---

## 3. Screens and flows

Cinch keeps its three-tab shell (Today · Closet · Plan) for MVP. Social enters through
surfaces that already exist:

- **Plan** is the calendar; occasions live on it. (The founder's framing — "on the
  calendar, customers can post an event" — matches the app: Plan already renders the week
  as day rows.)
- **Profile** (modal off the masthead) gains **Friends** and **Requests**.
- New routes: `/occasion/[id]`, `/occasion/[id]/look/[lookId]`, `/friend/[userId]`,
  `/friend/[userId]/closet`, `/borrow` (inbox). All pushed screens or sheets — no fourth
  tab until the follow feed exists (Phase 3, and only if usage argues for it).

### 3.1 Create an occasion (from Plan or Today)

Entry points: the `+` on a Plan day row → "Plan an occasion"; also from the Today
screen's "tell Cinch about your day" affordance when the day note looks like an event.

A single sheet, Plate-styled (serif title, 1px rules, no wizard):

| Field | Notes |
| --- | --- |
| Title | "Dinner at Rosemary's" — free text, required |
| Date & time | Prefilled from the day row tapped |
| Venue | Free-text name + optional city. **Optional by design** — an occasion is valid with no location at all |
| Reservation link | Optional paste field for an OpenTable/Resy/anything URL. MVP stores and renders it as a tappable link for members only. No API integration at MVP (see §10) |
| Occasion type | dinner · drinks · wedding · party · trip · other — feeds the styling engine's formality/occasion features |
| Dress code note | Optional free text ("cocktail-ish", "she said wear color") |
| Visibility | **Invite only** (default) · Friends can request. There is no public option. See §7 |

On create: the occasion lands on the creator's Plan calendar (an `outfit_calendar`-style
entry pointing at the event) and she is dropped into the invite step.

**Data note for architecture:** new tables — `events` (creator, title, starts_at, venue
fields, type, dress note, visibility, reservation_url, state), `event_members` (event,
user, role host/guest, status invited/joined/declined, joined_at). All member-scoped;
nothing about an event is ever served through a public view. Writes should follow the
`command_log` idempotency pattern (`create_event_tx`).

### 3.2 Invite & join

- **Invite friends:** picker over the host's friends list. Invitees get a push + an entry
  on their own Plan tab ("Thursday — Dinner at Rosemary's · invited by Maria") rendered as
  a ghosted day-row entry until accepted.
- **Invite link:** per-event tokenized link/QR for friends not yet on Cinch or not yet
  friends. Joining via event link does **not** create a friendship — the two women are
  "occasion-mates" with visibility scoped to that event only (see §7.3). The link is
  revocable by the host; regenerating invalidates the old one. Token joins are capped
  (default 20 members/event) and the host approves link-joins when visibility is
  invite-only? — **No:** holding the link *is* the invitation for invite-only events;
  the host controls distribution and can remove anyone. "Friends can request" adds a
  request-to-join path for the host's friends who can see the occasion exists.
- **Joining** asks one thing: "Add this to your Plan?" — on yes, the event appears on the
  member's own calendar. Declining an invite is silent to other guests; the host sees
  "declined" only as the absence from the guest list (no red "Maria declined" moment).
- **Leaving:** any member can leave; her looks and comments are removed with her (see §8).

### 3.3 Occasion detail — "the table"

Route: `/occasion/[id]`. The screen is a Plate-grammar page, top to bottom:

1. **Masthead:** title in the didone serif, then the colophon line in the Plate idiom —
   `THU 12 FEB · ROSEMARY'S · NEW YORK · 7:00` — 1px rule beneath. Reservation link, if
   present, is a quiet text link here (members only).
2. **The guests:** avatar row. Tapping a guest who is a friend → her profile/closet;
   an occasion-mate → a minimal card (name, avatar, her looks in this event only).
3. **The looks:** the heart of the screen. Grouped **by attendee** — each guest gets a
   horizontal band ("Maria is deciding · 2 looks") of her outfit-option plates. This
   grouping is load-bearing: it frames everything as *helping each person decide*, not as
   a contest between people (see §5).
4. **Coordination strip:** a quiet, data-driven Cinch touch — the engine reads the pinned
   looks and prints an observation in the colophon voice: `PALETTE SO FAR — OXBLOOD,
   CREAM, BLACK` or "Three of four in dresses." Never prescriptive, never "you clash."
5. **Your move:** sticky footer CTA — "Pin a look" if you haven't; "See votes on your
   looks" if you have.

States: pre-anyone-posting (empty state invites the first pin: "Be the first to the
mirror"), day-of (voting closes, winners shown), post-event (the Recap, §6).

### 3.4 Pinning a look (outfit-idea posting)

"Pin a look" opens the poster's own outfit sources, reusing existing machinery:

- **From Today's plates** — this morning's generated outfits.
- **From saved/worn outfits** — her `outfits` history.
- **Ask the stylist** — runs the existing generation pipeline with the event's context
  (date, weather at venue city if given, occasion type, dress-code note) as the context
  snapshot. **Phase 2+:** the prompt additionally sees *what other attendees have pinned*
  (palette + formality only, never their private closet data) so it can aim for harmony —
  "the table is wearing dark florals; here's your rust slip dress." This consumes the
  poster's existing `outfit_generation` quota (§9).
- **Build by hand** — the manual composer from the closet.

A pinned look is a snapshot: the plate image (existing Skia plate render), item list,
name, and an optional one-line note from the poster ("option A — comfy shoes"). Max **3
active looks per member per occasion** — enough for a real decision, few enough that
friends actually vote. Pinning more retires the oldest (poster chooses which to retire).

The poster can mark one look "leaning this way," retire looks, and finally **"This is the
one"** — which locks her decision, crowns her winning look, and (optionally, one tap)
plans it onto that date on her calendar via the existing `plan_outfit_tx`.

**Data note:** `event_looks` (event, member, outfit snapshot: item_ids + rendered plate
path + name + note, state active/retired/chosen). The plate render for a look is copied
into event-scoped storage at pin time so a member later deleting a garment doesn't break
the board; storage path is member-readable only.

### 3.5 Look detail, voting, comments

Route: `/occasion/[id]/look/[lookId]` — the plate full-bleed, the poster's note, then:

- **The vote:** every *other* member gets **one pick per attendee's board** — "which of
  Maria's three should Maria wear?" A pick is movable until the board locks. Displayed on
  each look as a count plus the voters' avatars (votes are **signed** — anonymity invites
  cruelty via absence; small groups can infer anyway; signed picks are social warmth:
  "Dana picked this one").
- **Compliment reactions** (unlimited, positive-only): a fixed vocabulary of five, in the
  stylist's voice — **That's the one** · **So you** · **Chic** · **Bold** · **Obsessed**.
  No down-reactions of any kind, no 👎, no laughing emoji (the classic drive-by weapon).
- **Comments:** plain threaded-one-level text comments per look. 500-char cap. This is
  where "wear the gold hoops with it" happens — and where borrowing starts ("I have a
  wrap that would go with this — want it?"). Full moderation surface applies (§8).
- **Locking:** a board locks when the poster chooses, or automatically at event start.
  At lock, the pick-leader is the **winning look**, presented as a crowned plate —
  `THE LOOK · CHOSEN BY THE TABLE` in the colophon. The poster can override the vote
  (it's her body and her night); the UI then says `HER CALL` instead — equally
  celebrated. Overriding must never read as defying friends.

### 3.6 Friend profile & friend-closet browsing

`/friend/[userId]` — name, avatar, style tags, and two shelves: **Recent looks** (plates
she has explicitly shared to friends — *not* her private Today history) and **Her
closet**.

`/friend/[userId]/closet` — the closet grid, friend-visible edition. Browsable by
category like one's own closet, with a **Borrowable** filter. Every garment shows:
cutout/thumb image, category, colors, brand, **size**, and its borrowable status.

**What a friend never sees:** purchase price, cost-per-wear, wear counts, "never worn"
flags, AI tags, original photos (derivatives only — same rule the public boundary already
enforces). The data moat is *hers*; her friends get presentation + size. Size is shown
**only on borrowable items** (it exists to answer "will it fit me"), and there is a
profile-level switch "Show sizes to friends" (default on) for anyone who prefers not.

**Data note for architecture:** this is a new *scoped* projection — e.g. a
`friend_items` view (or RPC) that (a) verifies the mutual-edge friendship inside the
view/function, (b) names an explicit column list: `id, user_id, category, subcategory,
colors, pattern, material, brand, size*, is_borrowable, thumb_path, cutout_path`.
Never a policy widening on `items`. Storage: friend-readable derivative policy mirroring
the existing public-derivative policy, gated on friendship + borrowable-or-shared.

### 3.7 Borrowing

**The flag:** every garment is borrowable **by default**; the owner opts pieces *out*
with a per-item tag — surfaced in the UI as **"Not for lending"** (schema:
`items.is_borrowable boolean not null default true`). Set from item detail and from a
multi-select sweep in the closet ("mark several"). A closet-level kill-switch — "Nothing
in my closet is lendable" — exists in Profile for people who hate the idea; it also hides
her closet's borrowable filter entirely. Unborrowable items still appear in her
friend-visible closet (they're part of her style) but carry no borrow affordance and no
size.

**Decision: structured request, lightweight lifecycle — not comment-thread-only, not
logistics-tracker.** A comment-only flow was tempting (ship nothing!) but borrowing is
the single most fragile social interaction in the app — an unanswered "can I borrow
your bag?" comment sitting in public is exactly the awkwardness software should absorb.
Conversely, a full lending-library (due dates, reminders, condition photos) is
bureaucracy between friends. The middle:

1. **Request** — from a friend's item (or from a comment's "offer"): optional message,
   optional occasion link ("for Thursday's dinner"). Private between the two women.
2. **Owner responds** — Lend it (with optional note: "pick up Wednesday?") · Not this
   time (one tap, a graceful canned decline, no reason required — softening rejection is
   the whole point of structuring this). Silence auto-expires the request after the
   occasion passes; expiry is shown to the requester as neutral ("this one lapsed"), never
   as a decline.
3. **On loan** — the item shows a quiet `ON LOAN TO DANA` ribbon in the owner's closet
   and `BORROWED FROM MARIA` in the borrower's context. **The borrowed garment becomes
   temporarily stylable by the borrower:** it joins her outfit composer and can appear in
   her event looks (this is the delight moment — Cinch styles a borrowed piece into her
   winning look). It does not join her closet stats and never counts toward her item cap.
4. **Returned** — either party taps "returned," the loan closes. No due dates, no
   nagging; one gentle nudge is available to the owner ("remind Dana") but never
   automatic. Logistics of physically handing things over stay in real life.

**Data note:** `borrow_requests` (item, owner, requester, event nullable, message,
status requested/lent/declined/returned/expired, timestamps) — the dormant
`item_inquiries` table is the near-exact shape and precedent (both-parties RLS,
trigger-derived owner, "connect two people, settle it yourselves"); extend that pattern
rather than inventing a new one. Loaned-item stylability = a scoped read of that one
item's presentation columns while status = lent.

### 3.8 Inboxes

One **Activity** sheet (off the Today masthead, alongside Profile): friend requests,
event invites, votes/compliments received, comments on your looks, borrow requests and
responses. Grouped by occasion where possible ("Thursday's dinner · 4 new"). No global
unread badge on tabs — the Plate is a calm magazine, not a slot machine; a single small
dot on the masthead glyph suffices.

---

## 4. What each screen exposes (privacy map for the architecture agent)

The standing rule: **base tables stay owner-only; anything crossing a user boundary is an
explicit projection (view or RPC) that names its columns.** New surfaces and their scopes:

| Surface | Audience | Data exposed | Served by |
| --- | --- | --- | --- |
| Username lookup | any authenticated | username, display_name, avatar_url (exact match, opt-out-able) | new lookup RPC/view |
| Friend profile | mutual friends | + bio, style_tags, shared looks | new `friend_profiles` projection |
| Friend closet | mutual friends | item presentation cols + size (borrowable only) + is_borrowable; **no** price/wear/original photos | new `friend_items` projection |
| Occasion card (invited, not joined) | invitees | title, date, host, guest *count* | `event_members`-scoped view |
| Occasion detail | joined members | + venue, time, reservation link, guest list, looks, votes, comments | member-scoped views over `events`, `event_looks`, etc. |
| Look plate image | joined members | rendered plate snapshot | event-scoped storage policy |
| Borrow request | the two parties | request + status | both-parties RLS (item_inquiries pattern) |
| Public closet (Phase 3) | world | existing `public_*` views, unchanged | existing |

Nothing event-related touches `anon`. No event data is ever in a `public_*` view.

---

## 5. Social mechanics: why this doesn't turn mean

The single most important design decision in this spec: **votes never compare women to
each other.** Every poll is *one woman's options*, judged only against each other, voted
on by people she chose to invite, to answer a question she asked. There is no cross-
attendee ranking, no "best dressed," no leaderboard, and the recap (§6) celebrates the
whole table equally. "Winning outfits" — the founder's phrase — exists per-attendee:
every woman at the dinner has a winning look. Nobody loses.

The supporting cast:

- **Positive-only reactions.** Critique arrives only as a comment a person signed her
  name to, in a group where everyone will see her at dinner Thursday. Accountability is
  the moderation.
- **Signed votes, movable until lock.** No anonymous judgment; changing your pick is
  costless, so votes stay light.
- **No public counts anywhere outside the event.** Follower counts exist in the schema;
  MVP surfaces don't print them. Compliment tallies live on the look, inside the event,
  visible to members only.
- **Silence is always ambiguous.** Declines, ignores, unfollows, expired borrow requests
  — none of them notify. The app never converts inaction into a message.
- **The stylist voice moderates the frame.** Copy always addresses the decision, not the
  body: "Which one for Thursday?" never "Who wore it best?"
- **Absence has no spotlight.** A guest who never pins a look is simply not shown with an
  empty band after event start; pre-event she appears as "still deciding" — a state, not
  a deficiency.

**Streaks & delight — deliberately restrained.** No streaks; a streak on a social
surface manufactures obligation between friends, which curdles. Delight instead comes
from moments: the `bouncy` spring reserved for the winning look's crown landing on the
plate (consistent with the one-bounce rule — an event, not a texture); the coordination
colophon; the borrowed-piece-in-the-winning-look story; and above all the Recap.

---

## 6. The Recap — the growth artifact

The morning after the occasion, the event page becomes a **Recap**: a single composed,
numbered lookbook plate of the table's worn looks — every attendee's chosen outfit as a
mini-plate, the event colophon beneath (`ROSEMARY'S · FEB 12 · FOUR LOOKS · ONE TABLE`).
Built on the existing 1080×1920 share pipeline (`src/features/share/capture-plate.ts`).

Sharing rules: export requires **every pictured member's consent** — each attendee gets
"Include my look in the recap?" (one tap, default nothing until answered); the export
composes only consenting looks, and includes first names only, never venue address, and
ships only after the event has passed (never advertise where people currently are). This
is the app's best advertisement, made safe: clothes and names, no logistics.

---

## 7. Safety & privacy

This section is deliberately the longest. The feature asks women to write down where
they will physically be and when. That data must behave like a secret shared among
friends, because that is what it is.

### 7.1 Location and time disclosure

- **Event visibility is invite-only by default**; the only other option is "friends of
  the host can request." There is no public event, no discovery surface, no "events near
  you," no map, ever. Two women at the same restaurant on the same night via different
  parties are never shown each other. (The founder's "other women on Cinch who are going
  to that dinner can join" is fulfilled by the host's invite link reaching them — via
  the group chat that already exists in real life — not by Cinch matching strangers to a
  reservation. Reservation-matching of non-friends is a stalking primitive and is
  explicitly rejected.)
- **Coarse before joined, precise after.** Invitees see title, date, host, guest count.
  Venue name, time, address/reservation link are members-only.
- **Nothing pre-event leaves the app.** Share/export of an occasion is disabled until it
  has passed; the Recap (§6) is the only export.
- **Retention:** venue and reservation fields are pruned (nulled) from events N days
  after the event (propose N=30); the looks and recap persist, the logistics don't.
- Push notifications never contain the venue in the lock-screen line ("Thursday's dinner
  · 2 new looks", not "Dinner at Rosemary's").

### 7.2 Blocking

Block is account-level and absolute, reachable from every profile, comment, look, and
request via the ⋯ menu:

- Dissolves both follow edges and friendship; removes each from the other's guest-visible
  surfaces; blocks all future requests, invites, comments, votes, and lookups (she never
  appears in the blocker's search; the blocker never appears in hers).
- **Shared events:** the blocker chooses in the block flow — leave the event, or stay
  with mutual invisibility inside it (each sees the event as if the other's content
  doesn't exist; the host sees both). Given both will physically attend, forcing either
  out via software would be wrong; the choice is hers.
- Blocking is silent. The blocked party sees nothing and is told nothing.
- Open loans survive a block as read-only history (the physical garment still exists);
  the item auto-marks returned-disputed for the owner's records without notifying anyone.

### 7.3 Harassment surface, enumerated

| Surface | Mitigation |
| --- | --- |
| Friend-request spam | Requests inbox (never interrupts), rate-limited per sender, "ignore" trains nothing visible, username lookup opt-out |
| Comment abuse | Positive-only reactions; comments members-only; report + block on every comment; host can delete any comment in her event; poster can delete comments on her look |
| Vote weaponisation | No downvotes; per-attendee polls only; signed picks |
| Invite-link leakage | Tokens revocable + regenerable; member cap; host can remove any member (silent to others); removed members lose all access including past content of that event |
| Borrow pressure | Declines are canned + one-tap; silence auto-expires; closet-level lending kill-switch |
| Occasion-mate creep | Non-friend co-attendees see only in-event content, gain no closet access, cannot friend-request from inside the event more than once |
| Ex-friend data | Unfriending immediately revokes closet visibility incl. signed URLs at next issue; her copies of *your* event looks in shared past events persist (they were snapshots into a shared space, like a group photo) |

### 7.4 UGC compliance — the App Store minimum set (Guideline 1.2)

Apple rejects social apps that lack these. All of the following are **MVP-blocking**,
not fast-follows:

1. **Terms/EULA agreement** at first social action, stating zero tolerance for
   objectionable content and abusive users.
2. **Report** on every piece of UGC (looks, comments, profiles, avatars, event titles)
   — two taps, categorized (harassment, inappropriate content, spam, impersonation,
   other), with optional note.
3. **Block** as specified in §7.2.
4. **Timely moderation:** reports reach a moderation queue (a simple internal tool /
   Supabase table + email alert is acceptable at launch scale) with a **24-hour**
   action commitment — remove content and/or eject users. Publish the contact address
   (hello@mail.cinchstyle.com is already sending; add a dedicated report route).
5. **Automated filtering:** a profanity/slur denylist pass on comments, event titles,
   look notes, and display names at write time (server-side, in the Edge Function path),
   plus hold-for-review on repeat-flagged accounts. Text-only UGC keeps this tractable;
   photos in the social surface are always Cinch-rendered garment plates, never free
   camera uploads — a deliberate constraint that removes the nude/abuse-image moderation
   class almost entirely. (Avatars are the exception: run them through the same image
   moderation used at ingest, or launch with initials-only avatars for social surfaces.)
6. **Ejection:** a banned user loses social write access app-wide (closet features
   unaffected — their subscription is not the hostage).
7. Age gate: the App Store age rating must reflect UGC; social features require the
   account to be 16+ (birth-date at first social action; under-16 sees no social entry
   points).

### 7.5 Data rights

Account deletion (already implemented app-side) must cascade: edges, memberships,
looks, votes, comments (hard-delete content, tombstone comment slots as "removed"),
borrow history anonymised. Export-my-data includes social content. Event data of
*other* members is never included in anyone else's export.

---

## 8. Notifications

Principled list — every push answers "why now, why me"; all channels individually
mutable; per-occasion mute; quiet hours respected by default (no social push 22:00–08:00
local except event invites for events <48h away).

| Moment | Default |
| --- | --- |
| Friend request received / accepted | push |
| Event invite | push |
| First look pinned in your occasion | push ("The mirror's open — Maria pinned a look") |
| Your look got its first pick / a compliment | push, then digested (max 1/hr/occasion) |
| Comment on your look | push |
| Someone picked — your board is tied / has a leader, day-of | one push, morning of event |
| "The table has decided" — your board locked with a winner | push, the crown moment |
| Borrow request / response | push |
| Recap ready + consent ask | push, morning after |
| Follows, likes (Phase 3) | in-app only, digested |

Never notified: declines, ignores, unfollows, being removed from an event, request
expiry, someone leaving.

---

## 9. Tiers

**Decision: every social mechanic is free.** Friends, unlimited occasions, looks,
voting, comments, borrowing, recaps — all of it, on the free tier.

Justification: (a) social is the acquisition loop — every occasion is 3–10 invite links
into real-world friend groups, and a paywalled loop doesn't loop; (b) the marginal cost
of social is rows, not model calls — the expensive resources are already metered
elsewhere; (c) a dinner where two guests can't vote because they're free-tier kills the
occasion for the paying host too — group features are only as good as their weakest
member's tier.

Where tiers *do* bite, existing quotas already do the work, no new gates needed:

- **"Ask the stylist for this occasion"** consumes `outfit_generation` (free: 5/week —
  a real occasion budget; standard/pro: daily allowances). The attendee-aware suggestion
  (Phase 2) is the same call with a richer context, same quota.
- **Closet size** (30/150/1000) already shapes how much there is to pin or lend.
- Pinning *existing* outfits, hand-building, voting: free actions on owned data.

One later candidate for pro, explicitly not gated at launch: recap history/archive
depth. Decide with data.

---

## 10. Reservations (OpenTable/Resy) — honest scoping

MVP: the reservation is a pasted URL, rendered members-only, pruned post-event. That
alone delivers the founder's story ("connected to the reservation") as experienced by
users: the booking is one tap away from the occasion.

Actual API integration (import party size/time from a Resy/OpenTable confirmation, or
deep-link into the booking) is partner-gated on both platforms and is a Phase 3+
investigation, likely starting with parsing the share-sheet text/URL a user pastes
(both services' share links carry venue + time in the slug — parse client-side, prefill
the form, never store credentials). Auto-matching *other Cinch users* on the same
reservation is rejected permanently on safety grounds (§7.1) — joining is always by
invitation from a human, never by reservation coincidence.

---

## 11. Fit with the Plate

- Every outfit anywhere in social **is a plate** — the same numbered-plate grammar,
  flat-lay, cap-trimmed didone title, 1px rules. An occasion is a *collaborative issue*
  of the lookbook; the recap is its cover.
- Colophons carry the social data the way they carry weather and $/wear:
  `PINNED BY MARIA · 3 PICKS · CHOSEN`. Real data, printed quietly — the moat, extended:
  competitors can't print "chosen by the table" because they don't have the table.
- Accent color only on the primary CTA (Pin a look / This is the one); compliments and
  picks render in ink/muted, the crown in accentWarm. Capsules only on glass chrome.
  `bouncy` spring: the crown landing, once. No centred hero text; no badge storms.
- Voice: the stylist's — warm, plain, honest. "Two of your friends are deciding." Never
  "🔥 Maria is CRUSHING it."

---

## 12. Open questions for the founder

Collected in the roadmap; headline items: recap consent default, the 16+ age gate
comfort level, moderation staffing for the 24h SLA, whether occasion-mates should be
able to see each other's *other* public content at all, and N for logistics retention.

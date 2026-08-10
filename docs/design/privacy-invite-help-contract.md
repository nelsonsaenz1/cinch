# Privacy, Invite & Help — build contract (atlases 38–40)

Wave 6. Frozen 2026-08-10, before any screen code was written. Where this
document and an atlas disagree, this document wins, and every clause below
says why in terms of something in the repository rather than taste.

Atlases: `38 Privacy & Data`, `39 Invite a Friend`, `40 Help & Support`.
Sources live in the session scratchpad; the PNGs are the visual authority and
the HTML is the authority for values.

---

## 1 · IDs

`PD-01…06`, `IV-01…06`, `HS-01…05` are all free — grepped across `docs/` and
`src/` before the wave opened. **First wave in six where nothing had to be
renamed.** Use them as drawn.

One near-collision worth naming so nobody trips on it: `src/app/dev-invite.tsx`
already exists and is the **event** invite (IF-01…06, "invite friends to this
occasion"). It is a different feature and is not in this wave's territory. The
new fixture is `dev-invite-link.tsx`.

---

## 2 · What these atlases are, and why this wave has a claim-trace

Atlases 38 and 40 are unlike every atlas before them. Previous waves drew
*behaviour* — a grid, a sheet, a flow — and the risk was visual drift. These
two are almost entirely **assertions about the app**: what is stored, what is
sent, who can see what, what deletion does. A wrong pixel is a bug. A wrong
sentence here is a false privacy claim on the page whose entire purpose is
being trustworthy, and on a page Apple reads when reviewing the App Privacy
card.

**So the rule for this wave: no sentence that asserts a fact about the app
ships without a `file:line` proving it.** Appendix A holds the trace. A unit
that cannot find the citation does not get to paraphrase around it — it stops
and reports, exactly as three units correctly did last wave.

---

## 3 · The five corrections

Each is a place the design asserts something the code does not do. In every
case the code wins and the copy changes, because the alternative is shipping a
lie on a privacy page.

### 3.1 — Deletion does not leave comments behind (PD-06)

The atlas: *"Comments you left on a friend's look stay, shown as 'a former
member'."*

The code: every social table cascades from `auth.users`.
`supabase/migrations/20260807102000_event_outfits_votes_comments.sql:17`
(comments), `:62` (votes), `:109` (posts) are all
`references auth.users (id) on delete cascade`. Comments are **erased**, not
retained under a pseudonym.

The atlas also says *"within thirty days"*. `supabase/functions/delete-account/
index.ts` deletes immediately and its docblock explains that immediacy is what
satisfies App Store Guideline 5.1.1(v) — "we will process this within 30 days"
is named there as a thing that does **not** satisfy it.

**Corrected copy** keeps the three-horizon structure the atlas invented, which
is genuinely good, and fills it with true horizons: what happens the moment you
confirm, what the servers do, and what genuinely does survive (only what
another person independently created — a borrow record on their side, a board
of their own). Unit P owns the exact wording and must cite each line.

### 3.2 — Search: the atlas was right, and the first draft of this contract was wrong

The atlas: *"no public profile, no discover tab and no way to find you by
searching."*

This clause originally called that false, on the strength of the `ilike`
prefix search at `src/features/social-graph/queries.ts:236-258`. The audit
found the rest of the sentence. That search runs against two **views**, not
the table: `public_profiles` filters `where visibility = 'public'`
(`20260804200000_public_boundary_tenant_integrity_and_commands.sql:52`), and
`social_profiles` returns only people already related to you
(`20260808110000_friend_closet_privacy_layer.sql:123`). `profiles.visibility`
defaults to `'private'` (`20260803210000_styling_learning_social.sql:230`) and
**no code in `src/` ever writes it** — there is no way to go public.

So a stranger typing your exact handle gets nothing. The atlas's sentence
stands, with one precision edit: search finds people you are *already*
connected to, so say that rather than implying search does not exist.

**This is the entry that justifies the whole claim-trace.** A plausible
reading of one query would have shipped a false reassurance-in-reverse on a
help page. Nothing here is obvious enough to skip the citation.

### 3.3 — "Season in review" does not exist (PD-01)

Atlas 34 was deferred last wave with an explicit re-open trigger, and the
notification channel was cut at the same time. PD-01's storage row cites it as
a live feature. The row keeps its meaning (wears and plans are stored, visible
to you only) and drops the dead reference.

### 3.4 — The export cannot carry the photos inside the archive (PD-04, PD-05)

Decided with the founder. A Supabase edge function cannot assemble a
multi-hundred-megabyte archive inside its memory and time budget, and the
closets that most need an export are exactly the ones that would fail. The zip
carries the data — `closet.csv`, `wears.csv`, `plans.csv`, `account.json` — plus
an index of time-limited links to every original photo at full size.

PD-04's manifest **stays a manifest**; naming the real files is the whole point
of that screen. The `closet/` row is reworded to say what actually arrives. It
is still an honest export: nothing is withheld, and the photos are reachable at
full resolution.

**No progress bar.** PD-05 draws one at 38%. There is no `progress` column and
there will not be one (`20260810120000_data_exports.sql`); a bar is only honest
if something computes the fraction, and assembling a manifest has no meaningful
midpoint. The pending card gets an indeterminate treatment instead.

### 3.5 — "Waiting on" cannot exist (IV-01)

The atlas draws named recipients with send times — *"Maya · sent 2 days ago ·
not opened"* — while the rules panel **on the same page** says *"one link per
person, forever, no per-invite codes to track"* and *"no contact upload"*.
Those cannot both hold: with no codes and no address book, the app cannot know
a link was sent to anybody, or when.

Replaced with **"Came in from your link"** — the people who actually arrived
through the invite, read back from `profiles.invited_by`
(`20260810120100_invite_links.sql`). Same position, same restraint, same
refusal to nag; real data underneath.

---

## 4 · The deferred-install problem, and what the founder chose

iOS provides no supported way to carry an invite token through an App Store
install. The founder chose to add an attribution SDK rather than accept the
honest re-tap fallback.

**Consequences, applied rather than argued:**

1. **A third party now sees an install-time device identifier.** Atlas 38's own
   rules panel says: *"If a disclosure is added to the store listing, the row is
   added to this page in the same release."* The atlas therefore instructs the
   fix for the problem the atlas creates. PD-01 gains a **"Link handling"** row
   in *What is stored*, naming the provider and what it receives, and the App
   Privacy card in §7 gains an *Identifiers* line.
2. **The claim that survives:** *"There is no third party with a copy of your
   closet"* stays true and stays on the page. The SDK never sees closet data.
   The claim *"no ad identifier"* also survives — ATT is not requested and IDFA
   is not read.
3. **The SDK is behind a guarded require**, exactly like
   `src/features/push/native.ts`. `src/features/invite/native.ts` is the only
   file that names the package. A top-level import of an absent native module
   throws during module evaluation, which the importing screen cannot catch —
   that white-screens every user. This is now the second native dependency to
   use this pattern; treat it as house style, not a one-off.
4. **No key, no problem.** With no key configured the shim reports unavailable
   and the invite falls back to the re-tap path, which works. The build is not
   blocked on the founder creating an account.

---

## 5 · What is native, and therefore cannot ride an OTA

Both of these change the binary. The founder has said to cut a store build.

| Change | Why it is native |
|---|---|
| `associatedDomains: ['applinks:cinchstyle.com']` | An **entitlement**. Universal links do not work without it, and entitlements live in the provisioning profile. |
| The attribution SDK | A native module plus its config plugin and Info.plist keys. |
| `expo-clipboard` | IV-01's *Copy link*. A native module. |

**Read the aps-environment lesson before building.** Last wave's store build
failed fastlane because adding `expo-notifications` changed the binary's
entitlements and EAS only syncs capabilities to the App ID with a live Apple
session. `associatedDomains` is the same class of change and may need the same
fix — the founder logging into Apple through `eas credentials`. **Do not try to
drive that with expect**; three attempts last wave mangled the pre-filled Apple
ID field and corrupted the stored credential file. Hand it over immediately.

---

## 6 · Schema (applied to production 2026-08-10)

| Migration | What it adds |
|---|---|
| `20260810120000_data_exports.sql` | `data_exports` + `request_data_export()`. Select-own only; no insert policy, because a daily limit the client can route around is not a limit. |
| `20260810120100_invite_links.sql` | `profiles.invited_by` / `invited_at`, `invite_card()`, `apply_invite()`, `invite_arrivals()`. |
| `20260810120200_support_sends.sql` | `support_sends` — throttle only. RLS on, **zero policies**, explicit revoke, same shape as `push_sends`. |

**There is no invites table.** "One link per person, forever — the handle is
the link" means a per-invite code would be a row nobody asked for and a thing
to revoke that nobody wanted revocable.

**`invite_card()` is granted to `anon`** and is the only thing in this wave
that is. It returns a display name for a handle and nothing else — no id, no
avatar, no bio, no counts. The standing refusal is against `to anon` **policies
on base tables**, which is precisely what a narrow definer function avoids: the
anonymous role never gets a seat at a table it can then explore. The residual
exposure is handle enumeration returning display names, accepted knowingly
because a handle is already resolvable by any signed-in user through friend
search, and the inviter published this one deliberately.

**`apply_invite()` makes the friendship, it does not request it** — "the invite
is already accepted". Both `follows` rows, `on conflict do nothing`, idempotent.
`invited_by` is written only while null, so re-opening a link never
re-attributes an account. It refuses across a block in either direction: a link
must not be a way back in for someone who was blocked.

---

## 7 · The App Privacy card, as it must read after this wave

Each line maps to one row on PD-01. This is the atlas's own rule and it now
cuts both ways.

**This table was wrong when first written, in the app's favour, twice.** Both
errors were inherited from the atlas and caught by Unit P building against the
code. Corrected:

| | |
|---|---|
| **Photos** | Linked to you. Stored for sync, and sent to the model in two cases: tagging a new piece, and matching one against a listing. |
| **Usage data** | Wears and plans, linked to you. Your outfits are yours; **a friend can see a piece's wear count.** |
| **Contact info** | Email and handle, for sign-in and the export mail. No address book access. |
| **Coarse location** | A city-level fix, rounded to two decimal places, sent to the forecast service. |
| **Other user content** | Today's calendar entries, including **event titles**, sent with the outfit request. |
| **Identifiers** | *Only if the link SDK ships.* An install identifier, so an invite reaches the right person. Not an advertising identifier. |
| **Not collected** | Contacts, browsing, advertising identifiers. |

### 7.1 — "No location" was false, and the shipped app already knew

The atlas's PD-01 says *"No contacts, no location, no ad identifier."* The
first and third are true. The second is not:
`src/features/context/use-style-context.ts:162` requests foreground location
and `src/features/context/weather.ts:43` sends the coordinates to Open-Meteo.
Separately, `src/features/styling/use-outfits.ts:133-137` sends **calendar
event titles** to the AI partner with every outfit request.

The reassuring part: **the store listing was already correct.** `app.config.ts`
declares `NSPrivacyCollectedDataTypeCoarseLocation` and
`NSPrivacyCollectedDataTypeOtherUserContent`, and `weather.ts:38-42` documents
rounding to two decimals specifically to qualify for the weaker Coarse claim
rather than the other way round. Somebody thought about this properly.

So the defect was never in what Apple was told — it was that the app's own
privacy page was about to contradict the app's own privacy manifest. PD-01
gains a row, *"Where you are, and what is on today"*, and PD-02's disclosure
gains a sixth item covering what travels that is not a photograph.

**This is the single best argument for the claim-trace in §2.** The atlas
sentence was reassuring, plausible, and false, and no amount of design review
would have caught it — only reading `weather.ts` did.

### 7.2 — "Never used for training" is not ours to say

Struck from the Photos row above, on Unit P's refusal and correctly.
`docs/design/system-safety-contract.md §3` records a standing, launch-blocking
decision from wave 4: **treat any retention or training claim as unshippable**
until the provider's terms are confirmed in writing. That confirmation is still
outstanding.

What ships instead is what Cinch itself controls and can be held to: *"Cinch
never sells them and never advertises against them."* The stronger sentence
goes back on the page the day the terms arrive, and not before.

---

## 8 · Standing refusals carried into this wave

Settled previously, not reopened:

- **Body text is 17px**, not the atlas's 16.
- **Borders are `rule` = .12.**
- **`faint` (#8A8578) loses to `muted` on small text** — 3.52:1 is a WCAG AA
  failure. The atlases set every secondary caption in `#8A8578`; use `muted`.
  This affects nearly every caption in all three atlases.
- **No capsules on labelled controls.** HS-04's topic chips are the app's
  `Chip`, at the app's radius.
- **`note` / `noteSmall` for running secondary prose**, because `label` and
  `caption` carry `font-medium` and will silently render the atlas's regular
  weight as bold.
- **Never stack two utilities of the same kind.**
- **Palette is locked**; light only.
- **CC0 imagery only.**

---

## 9 · Unit boundaries

Non-overlapping. A unit that needs a change in another unit's file **reports
it, and does not make it** — last wave produced three integration holes that
typecheck could not see, and the fix is integrator time, not trespass.

| Unit | Owns | Must not touch |
|---|---|---|
| **P** — Privacy | `src/app/privacy*`, `src/components/privacy/**`, `src/features/privacy/**`, `src/app/dev-privacy.tsx` | profile.tsx, _layout.tsx |
| **I** — Invite | `src/app/invite.tsx`, `src/components/invite/**`, `src/features/invite/**`, `src/app/dev-invite-link.tsx` | `dev-invite.tsx` (different feature), profile.tsx, _layout.tsx |
| **W** — Web | `web/**` only | everything else |
| **H** — Help | `src/app/help*`, `src/components/help/**`, `src/features/help/**`, `src/app/dev-help.tsx` | profile.tsx, _layout.tsx |
| **E** — Backends | `supabase/functions/{build-export,support-mail}/**` | migrations, app code |

**The integrator (main session) owns** `src/app/profile.tsx`,
`src/app/_layout.tsx`, `app.config.ts`, `package.json`, and every route
registration. Nobody else edits those.

---

## Appendix A · Claim trace

Filled from a read-only audit of the repository before any article or privacy
sentence was written. Unit H and Unit P must cite from this table; a claim not
in it does not ship.

### A.1 · Six sentences that would have shipped and been false

These are the ones a careful writer would have written from the atlas without
checking. Each is banned by name.

| Tempting sentence | Why it is false | Write instead |
|---|---|---|
| "Friends can't see how often you wear something." | `friend_items` projects `wear_count, last_worn_at` (`20260808110000_friend_closet_privacy_layer.sql:45`) and `FriendItemCard.tsx:120` prints it as the card caption. | "Friends see every piece in your active closet, including how many times you've worn it." |
| "You can hide your closet, or hide individual stats." | `closet_hidden` / `stat_*_hidden` exist in the database (`…privacy_layer.sql:22-25`) but **have no UI** — the migration says so at `:18` and nothing in `src/` writes them. | "The only way to take a piece out of a friend's view today is to move it to storage." |
| "Your photos are only ever sent for tagging." | `garment-search`'s `match` action signs and sends the user's own photo to a vision model (`supabase/functions/garment-search/index.ts:679`). | "In two cases: when a piece is tagged, and when you ask Cinch to match a piece against a product listing." |
| "Your morning edit is generated for you overnight." | The push carries no look — `send-push/copy.ts:70-80` and its comment *"The server does not have one."* Outfits are built on-device by the beam search in `src/lib/styling/generate.ts`. | "Cinch builds your outfits on your phone; a short AI step picks the best few and writes the note." |
| "Deleting your account erases everything." | Two things survive by design: abuse reports naming you (`content_reports`, deliberately no FK, `20260807100000_social_graph_blocks_borrow.sql:69-72`) and the AI spend ledger with the person-link severed (`ai_calls.user_id` → `on delete set null`, `20260807122000_ai_calls_survive_churn.sql:43`). | Name both, in PD-06's "What stays". They are defensible; concealing them is not. |
| "Anyone can find you by your handle." | See §3.2. | "Search only finds people you're already connected to." |

### A.2 · Verified facts, for the copy that does ship

| # | Fact | Citation |
|---|---|---|
| 1 | Friendship is **mutual**, derived from two `follows` rows plus no block. There is no request to accept. | `20260807100000_social_graph_blocks_borrow.sql:102` (`is_friend`) |
| 2 | `borrowable` defaults to **true** — every new piece is lendable unless the owner turns it off. | `…social_graph_blocks_borrow.sql:123`; toggle at `social-graph/mutations.ts:213` |
| 3 | Removing a friend is **immediate and silent**: a synchronous delete of your own edge, and no activity kind or push channel exists for it. | `social-graph/mutations.ts:63-91`; `20260810100100_activity_feed.sql:60-63` |
| 4 | Friends **cannot** see outfits you planned, changed, or did not share. `outfits` and `outfit_calendar` are owner-only and no outfit table crosses the friend layer. | `20260803154431_initial_schema.sql:168`, `:224` |
| 5 | Per-item **price never crosses**; only a mean cost-per-wear does. | `…privacy_layer.sql:89` |
| 6 | Deletion is **immediate and in-app**, resumable rather than transactional. Both buckets (`garments`, `avatars`) are cleared before the auth user. | `supabase/functions/delete-account/index.ts:58`, `:151-224` |
| 7 | Comments, votes and event posts **cascade** — they do not survive under a pseudonym. | `20260807102000_event_outfits_votes_comments.sql:17`, `:62`, `:109` |
| 8 | Photos go to **OpenRouter**; URLs are stripped from anything written to `ai_calls.error`. | `supabase/functions/_shared/openrouter.ts:10`, `:33` |
| 9 | The stylist chat sends a **digest and assembled outfits as text** — never photographs, never full item rows. | `supabase/functions/stylist-chat/index.ts:23`, `:137` |
| 10 | Free closet is **10 active / 30 stored**. Engine minimum is **8** *and* requires a top and a bottom, or a dress. | `20260808190000_free_closet_is_ten.sql:29`; `styling/queries.ts:128`, `:141` |
| 11 | Background removal is **on-device** (Apple Vision), iOS 17+, and does not run in the Simulator. | `src/lib/bg-removal.ts:1-35` |
| 12 | There are **no photo quality requirements** — no blur check, no minimum resolution, no rejection path. Guidance only. | `src/app/capture.tsx:863` |
| 13 | iPhone only. `supportsTablet: false`; the iOS-only dependency is the Vision module plus Apple sign-in. `web/` is a marketing site, not an app target. | `app.config.ts`; `src/lib/bg-removal.ts:16` |
| 14 | Version renders as **"Cinch 1.0.0 (218)"** from `Constants.expoConfig?.version` + `ios.buildNumber`. Not "2.4.1". `buildNumber` can be null outside a real build — handle it. | `src/app/profile.tsx:227-228` |
| 15 | `expo-device` is **installed but has zero import sites**. Using it for HS-04's device model is a new import of an existing dependency — no native change. | `package.json:22` |
| 16 | Cancelling a subscription: `MANAGE_SUBSCRIPTIONS_URL` already exists and is the right destination for HS's "How do I cancel?". | `src/app/profile.tsx:411` |

### A.3 · One live bug this audit found

**The Privacy screen's "{n} photos sent" counter undercounts.** It filters
`ai_calls` to `workload = 'tagging'` (`src/features/auth/use-ai-privacy.ts:41-48`),
but `garment-search`'s match action sends photos under the `garment_search`
workload. Any sentence promising the list shows every photo that has left the
phone is false today.

This predates the wave and is not a regression, but it lands squarely in Unit
P's territory and on the page whose whole purpose is being accurate about
this. **Unit P fixes the counter to include both workloads** and words PD-02's
disclosure to cover both send paths.

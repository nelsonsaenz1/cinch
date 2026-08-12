# Wave 3 · Group 6 — Safety, Profile, Help, Membership

Source: `docs/design/wave-3-final/Wave 3 - Design · Safety, Profile, Help, Membership.dc.html`
(unmodified; 8/8 sha256 re-verified against `MANIFEST.sha256` before the packet opened).

13 drawn states. **12 built, 1 parked.** One bounded packet, no lanes. No captures,
no visual grading — Codex owns those.

| State | | Evidence |
| --- | --- | --- |
| SF-01 = BL-01 | BUILT | masthead states all four facts incl. "none of them is told"; 68 pt row, handle fallback with its `@`, ink Unblock, footer naming where blocking lives |
| SF-02 = BL-02 | BUILT | three regular paragraphs, both audited consequences, "Keep them blocked" |
| SF-02 / AX | BUILT | consequence scrolls, both actions pin below a hairline — at every size, not on a branch |
| SF-03 | BUILT | unblocking (tray word, no spinner), failed (on the row, not an `Alert`), empty |
| PR-01 | BUILT | capacity band, membership row, toggle state-as-a-word, blocked count |
| PR-01 / AX | BUILT | value wraps under its label; toggle keeps its trailing position |
| PR-02 | BUILT | four reads from one `membershipRowFor` |
| NT-01 | BUILT | five channels counted from the table, state word per row, four send times |
| NT-02 | BUILT | cause once at the top, rows in the conditional, preferences kept, tray track + paper knob |
| HP-01 | BUILT | atlas group titles; questions wrap; four groups (see below) |
| HP-02 | BUILT | the commerce article, per-row disclosure, support card at the end |
| MB-08 | BUILT | measurable counters only, cancellation routed to the store, no auto-downgrade promise |
| **MB-09** | **PARKED — D-5** | selling surface; every price and the CTA label are live StoreKit reads |

## What is parked, and on whom

### D-5 · StoreKit product terms — FOUNDER, then a StoreKit or Superwall surface

MB-09 is not drawn and no fixture exists for it. This is a hard block rather than a
scheduling one:

- Every figure on it is a slot — `App Store price`, and a CTA whose label comes from the
  same read. This app has **no StoreKit module** (`profile.tsx` said so where it linked
  out to Apple's page), so it cannot make that read. Every price Cinch has ever shown came
  from Superwall rendering its own paywall.
- An upgrade row could therefore only register a Superwall **placement**, and every name in
  `features/billing/placements.ts` is a contract with a campaign in the dashboard: an
  unmatched name resolves *silently* to nothing at all. Inventing one ships a row that
  looks like a door and is a wall.
- Creating the campaign is production configuration, which this packet may not touch.

**So MB-08 ships without its "Move to Pro" row**, recorded in `manage-membership.ts` as
`UPGRADE_ROW_PARKED`. Nothing else on MB-08 depends on it — "a management page, not a
sales page" is precisely a page with no upsell in it.

Also parked under D-5: no trial duration is drawn anywhere. `tests/membership-row.test.ts`
fails if `14 day` or a `$` reaches any of the four reads or either MB-08 sentence.

### Dependency C · the downgrade chooser — FOUNDER, then a flow

MB-08's atlas paragraph ends *"Cinch will ask, and will not choose for you."* That promises
a chooser flow, and no screen, mutation or job for one exists anywhere in `src/` or
`supabase/`. It is the atlas's own dependency C. Correction 35 removed the *automatic*
promise; promising a manual flow that does not exist is the same defect wearing better
manners.

What shipped instead is the truth, and it is better news: both ceilings are enforced
`before insert on items` (`20260805160000:284`) and `before update of is_archived`
(`20260808190100:130`), **neither of which fires on an existing row** — so a closet over the
line after a downgrade stays whole, every piece and photograph, and only adding and
restoring stop.

## Where the drawing contradicted shipping truth

Each verified against the repository, not assumed.

| # | The claim | What is true | What shipped |
| --- | --- | --- | --- |
| 1 | Correction 32: notification descriptions "taken verbatim from the push channel definitions" | The supplied strings are not those definitions. **Event reminders** — atlas "Invitations, and a reminder before an occasion starts"; `eventReminderPayload()` (`send-push/copy.ts:137`) sends exactly `"<title> is tomorrow"` and no branch of `index.ts` sends an invitation on that channel. **Borrow requests** — atlas "when they answer yours"; `borrowPayload()` fires on `asked` and `returned` only. **Friend activity** — atlas "Requests and new friends"; `friendActivityPayload()` counts follow-backs and new pieces. | The code's sentences, which are what the senders are checked against. `channels.ts`'s own rule is "the description is the promise"; the atlas's instruction was obeyed and its transcription was not. Pinned by `tests/notification-channel-truth.test.ts`. |
| 2 | SF-01 "previous behaviour: Unblock acted on one tap, with no confirmation" | `UnblockSheet` has stood between the row and the delete since wave 3 phase 1. | Nothing removed. What audit 99 genuinely adds — three regular paragraphs, both named consequences, an outcome-named second action — is now true. |
| 3 | SF-02's consequence written as "**He** will be able to…" | Cinch holds a display name and a handle. There is no pronoun column anywhere in `supabase/migrations`, and inferring one from a name misgenders a real person on the screen where being wrong about who somebody is matters most. | they/them throughout; the **name** does the identifying, which is the property audit 99 actually asked for. A test fails on any gendered pronoun in this surface. |
| 4 | SF-01's third row, "Blocked last week" | `blocked_at` is an exact timestamp. An approximate phrase standing in for a known date is the estimate the standing refusals forbid. | `blockedWhen()`: exact relative inside a fortnight ("this week" / "last week"), month-and-year past it. `now` is a parameter, so fixtures are date-stable. |
| 5 | PR-01's "Stored pieces 4 of 20" | `PLANS.free.storedItems` is **30**, mirroring `item_total_limit_for_plan()`. The atlas contradicts itself — MB-08's own paragraph says "the Free total ceiling is 30". | 30, from `PLANS`. |
| 6 | Correction 29: "Profile drawn as a fifth tab with an invented Today/Closet/You bar" | `profile.tsx` has been a form sheet with a `Done` header since it was written; the app has had four native tabs throughout. | Nothing removed. The correction describes a drawing, not this repository — the same shape as correction 23 in group 5. |
| 7 | PR-01 as a complete inventory of the sheet's rows | The frame omits Sign out, Delete account, Wear diary, Friends, Borrow requests, Privacy Policy and Restore purchases. **Deleting Delete account would break App Store Guideline 5.1.1(v)**, a hard requirement. | The atlas's additions landed; the rows it does not draw stayed. An index frame is a drawing of rows, not an instruction to delete the ones it left out. |
| 8 | MB-08's "Cinch will ask, and will not choose for you" | No chooser flow exists. Dependency C, above. | Not written. The two triggers' real behaviour is, instead. |
| 9 | HP-01's eight rows as the whole corpus | Four accurate shipping articles are not among them — including "How do I cancel?", which is the answer MB-08 routes a member toward. | Ten articles in four groups: the atlas's three group titles adopted, its two detailed new answers written, the four it does not draw kept. |
| 10 | Help's "A person reads it, usually inside a day" — **live in the app** | Nothing behind it keeps a response time: `support-mail` posts to a shared inbox, and there is no queue, rota or SLA anywhere in that function. | Correction 34 applied: "Two people read it, and there is no ticket number." |
| 11 | Correction 34's "the previous disclosure claimed email and version and nothing else" | The composer already lists every field it sends (`diagnosticLines()`) and already states the one true reassurance (`DIAGNOSTICS_FOOTNOTE` — no closet content is read). | Nothing changed there; only the SLA came out. |
| 12 | PR-02's earlier shape (`membershipCopyFor`) | It had no reading state and no failed state, so a member on a slow network or a failed read saw **no membership row at all** — which reads as "you are not a member". It also printed `monthlyPriceHint` into a settings row. | Replaced by `membershipRowFor`: four states, no price in any of them, `usePlan().refetch` wired so the Retry is not a dead control. |
| 13 | MB-08's stylist-message and hosted-event counters | No client read exists for either — the stylist allowance lives server-side in `claim_ai_quota`, and nothing counts live hosted events. | Correction 36 applied: active and stored pieces only, and neither row draws while its count is in flight. |

## Still open

- **Founder, no engineering:** none in this group. D-5 needs a decision *and* a surface.
- **Founder, then a StoreKit or Superwall surface:** MB-09 (D-5).
- **Founder, then a flow:** the downgrade chooser (dependency C).
- **Design/authoring:** three of HP-01's titles have no body yet — "How do I add a piece
  without photographing it?", "Cinch guessed wrong. How do I fix it?", and "What is cost
  per wear, and why is it sometimes missing?". Each is a real question with a real answer
  in the repository; none was drawn, so none was invented here.
- Carried in from group 5 and earlier: D-1 comment closure, D-2a the board lock, D-2b the
  crown, a 14 pt type step, `wardrobe_gaps`, C-09, "1 of 3 this week", `"Describe it"`,
  `chip-spec.COMPACT_HEIGHT`, task #69, IT-04, CP-04/CP-05, V-02/V-03.

## Also landed here

- `components/ui/settled-row.tsx` — `ValueRow` and `ToggleRow`, the two affordances of the
  group's settled row that `SettingsRow` could not grow without becoming a component that
  does four things. `SettingsRow` gained one prop, `sublabel`, for the rows whose second
  fact is a sentence rather than a value.
- `/membership` — a route that did not exist. MB-08 had nowhere to be.
- BL-01 stopped printing `BLOCK_EFFECT`. That constant is the same policy in the singular,
  about one person, and FR-02 prints it; two paraphrases one above the other is exactly
  what its own docblock forbids. `tests/friends-row-data.test.ts` now asserts the
  separation rather than the shared import.

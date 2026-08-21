# The overnight build · 2026-08-21 founder directive

*"One new perfect build." Everything below ships together in the next binary
(build 44, v1.2.x), then gets submitted for App Store review. Recon was five
agents over the whole app; fixes run as six packets. Root-cause detail lives in
the agents' reports; this is the list and the order.*

## Packet T — Today

1. One compact temp mark on the outfit card ("82°" + condition symbol);
   the low–high range moves out of the card mark and lives only in the
   masthead eyebrow. Kill the "Feels 82°F, 64°–83° today" / "82° · 64°–83°
   today" duplication (weather.ts condition clause reaches both).
2. Trip reminder card gains a dismiss ("Got it") — per-trip AsyncStorage key,
   the app's established card-dismissal idiom. Card already says
   "Tokyo, in five days"; it just never went away.
3. Remove the Stylist door from the masthead (Stylist is a tab now); correct
   the three stale comment blocks that claim it's the only door.

## Packet S — Stylist

1. Send path gets a ceiling and a voice: no more infinite silent pending
   (timeout race like the auth run's 8s pattern, honest failed state, retry).
2. The empty-restored-message poison (one '' history row breaks every later
   send with a fake "could not be reached") — filtered at restore.
3. The keyboard trap: `keyboardDismissMode="interactive"` on the transcript,
   tap-outside dismissal, and the tab-bar-aware keyboard offset. The screen
   stopped being a sheet on Aug 20; its keyboard behavior didn't notice.
4. Discoverability: the five feature doors currently vanish forever after the
   first-ever chat. They become reachable always (compact door strip when a
   thread exists), the skeleton draws five bars not four, and the stale
   "four doors" comments are corrected.

## Packet P — Plan + Events

1. Packing's gate and thin-closet states get the ScrollView they never had
   (the founder's "can't scroll").
2. "See all trips" top-right button removed — which also removes the 44pt
   control that inflated the header only in Packing mode, i.e. the
   "indicator bar shifts down" bug. Two complaints, one deletion.
3. Event detail header reorganized (founder ask 2026-08-21, superseding the
   03-event-detail brief): structured block — occasion eyebrow, title,
   date/time, venue + address, dress code, party — instead of the squeezed
   poster line. JS-only; real place imagery needs a native module and a
   schema column, deliberately out of scope tonight (noted for later).

## Packet F — People search

Share-link and invite cards demote below the RECENT list, so the field and
results own the keyboard-up viewport (founder: "they're covering everything
I wanna see"). Layout tests updated with the new order.

## Packet V — Tagging validator

`validator_rejected:category_subcategory_conflict` failed 4 real uploads
today. Investigate tag-validate: prefer salvaging (drop the conflicting
subcategory, keep the category) over failing the whole tag.

## Packet C — Copy, units, spelling (runs after T/S/P/F merge)

1. The one real unit bug: packing-trip.tsx:1146 prints raw **Celsius**.
   Through formatTemp like everything else.
2. kilometres → miles in privacy copy (app + web).
3. American spelling across user-visible copy only: colour→color,
   catalogue→catalog, favourite→favorite (which also fixes the
   Closet/Profile contradiction), grey→gray (labels only — stored swatch
   values and DB ids untouched), recognising→recognizing, maths→math,
   organisation→organization, behavioural→behavioral (CCPA quotes the
   statute's spelling). Code identifiers, file names, comments untouched.
4. Curly apostrophes (U+2019) in the ~44 error-copy files that use ASCII,
   per the convention send-push/copy.ts documents.
5. Dev fixture temps to Fahrenheit for atlas honesty.

## Then

Full gates (suite, tsc, lint) → simulator walk of every touched surface →
commits per packet → build 44 cut (no native change, runtime stays c5f00773,
no gate re-take needed) → eas submit to ASC → App Store review submission
with release to public.

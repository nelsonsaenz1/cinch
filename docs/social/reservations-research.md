# Reservation-platform integration research

*Research date: 2026-08-05. Scope: what Cinch's dinner-event feature can actually
use from OpenTable, Resy, Tock, SevenRooms, and Yelp, plus venue-metadata
options and the legal edges. Conclusion up front: **no reservation platform
offers a public consumer API in 2026** — the pragmatic MVP is Apple-powered
venue search + manual event details + an optional pasted reservation link that
we deep-link back out to.*

---

## Verdict table

| Platform | Public API | Deep links out | Deep links / data in | Realistically usable for Cinch |
| --- | --- | --- | --- | --- |
| **OpenTable** | **No.** Partner/affiliate only; app review takes 3–4 weeks and is aimed at restaurants and booking affiliates ([docs.opentable.com](https://docs.opentable.com/), [Elfsight overview](https://elfsight.com/blog/how-to-get-and-use-opentable-api/)) | Yes — `opentable.com/r/{slug}` restaurant pages are universal links that open the iOS app; date + party size can be encoded in the URL (`covers`, `dateTime` params, observed by third-party monitors — [PageCrawl](https://pagecrawl.io/blog/restaurant-reservation-availability-alerts)) | No inbound API. Confirmation email has add-to-calendar; reservation link is pasteable | Link **out** only. Affiliate program exists for sanctioned consumer referrals ([OpenTable help](https://help.opentable.com/s/article/OpenTable-Affiliate-Program-1505261059868?language=en_US)) |
| **Resy** (Amex) | **No.** Partner-only (POS/CRM/loyalty/discovery) via partnerships team; no self-serve portal ([apis.io provider entry](https://apis.io/providers/resy/)). `api.resy.com` is reverse-engineered, undocumented, unsupported — do not build on it ([Medium writeup](https://medium.com/@seanwiryadi16/the-secret-menu-of-tech-my-encounter-with-an-undisclosed-resy-endpoint-ce46059dcdf0)) | Yes — `resy.com/cities/{city}/venues/{slug}` universal links open the Resy app; `?date=YYYY-MM-DD&seats=N` prefills the picker (community-documented, used by notify tools) | No inbound API. Automated confirmation emails on every book/change/cancel ([Resy helpdesk](https://helpdesk.resy.com/standard-resy-automated-email-content-HyaaWvXId)) | Link **out** only |
| **Tock** | **No.** API + webhooks gated to Premium-plan restaurants; keys by email request to `integrate@tockhq.com`; endpoint docs shared only with approved partners ([API Tracker](https://apitracker.io/a/exploretock)) | Yes — `exploretock.com/{venue}` web links open venue booking pages | No | Link out only; low priority (tasting-menu niche) |
| **SevenRooms** | **No.** B2B platform; API docs individually provisioned since Feb 2026 ([api-docs.sevenrooms.com](https://api-docs.sevenrooms.com/)) | Venue booking widget URLs only | No | Ignore for MVP |
| **Yelp** | **Partial.** Reservations API is partner-only, disabled by default ([Yelp docs](https://docs.developer.yelp.com/docs/reservation)). Fusion/Places API is public but **paid-only** since 2024: 30-day trial, then $7.99+/1K calls ([plans](https://docs.developer.yelp.com/docs/plans), [TechCrunch on the pricing backlash](https://techcrunch.com/2024/08/02/yelps-lack-of-transparency-around-api-charges-angers-developers/)). Fusion AI now returns `reservation_availability` fields ([changelog](https://docs.developer.yelp.com/changelog/fusion-ai-api-reservation-support-fields-added)) | Yes — Yelp biz pages | No inbound without partner status | The only *any-money-buys-it* API with reservation signal — but it's a bill, and Cinch's rule is no bills before revenue |

**Bottom line:** every booking platform is partner-gated. The open surfaces are
(1) their public web URLs, which double as universal links into their iOS apps,
and (2) the confirmation emails/calendar events they send the user — which the
*user* owns and can share with us.

---

## What IS available, in detail

### 1. Deep links out (free, sanctioned-ish, useful)

- **OpenTable:** `https://www.opentable.com/r/{restaurant-slug}` opens the
  restaurant in the OpenTable app when installed (universal link). Third-party
  availability monitors demonstrate that date and party size survive in the URL
  (`covers`, `dateTime`) so the booking widget arrives prefilled
  ([PageCrawl](https://pagecrawl.io/blog/restaurant-reservation-availability-alerts)).
  Not officially documented for third parties — treat as best-effort, always
  degrade gracefully to the plain restaurant URL.
- **Resy:** `https://resy.com/cities/{city-slug}/venues/{venue-slug}` with
  `?date=YYYY-MM-DD&seats=N`. Same caveat: community-documented, not a contract.
- We never *fetch* these URLs server-side. We store what the user pasted and
  hand it to `Linking.openURL` on tap. The HTTP request happens on the user's
  device inside the platform's own app/site — indistinguishable from tapping a
  link in iMessage, and not "scraping" under any reading.

### 2. The user's own reservation data (email, .ics, calendar)

- Both OpenTable and Resy send confirmation emails with reservation details and
  add-to-calendar affordances; Resy documents automated emails on every
  book/change/cancel ([helpdesk](https://helpdesk.resy.com/standard-resy-automated-email-content-HyaaWvXId)).
  The resulting calendar event carries: title (usually "Reservation for N at
  {Venue}" or similar), start time, location (venue name + address), and a URL
  back to the reservation — everything a dinner event needs.
- **iOS EventKit gives us permissioned access to those events.** iOS 17 split
  calendar permissions into full/write-only tiers; reading requires full access
  with `NSCalendarsFullAccessUsageDescription`
  ([Apple WWDC23 EventKit changes](https://developer.apple.com/documentation/eventkit),
  [Expo issue tracking the iOS 17 migration](https://github.com/expo/expo/issues/24343)).
  **`expo-calendar` supports exactly this** in our stack: `listEvents()` returns
  titles, locations, dates, notes; the config plugin handles the Info.plist keys
  ([Expo docs](https://docs.expo.dev/versions/latest/sdk/calendar/)).
- So an "Import from Calendar" button — list the user's next two weeks of
  events, they tap their reservation, we prefill venue/date/time/party-size —
  is fully buildable today, user-permissioned, and violates nobody's ToS,
  because the user is sharing their own data.
- Parsing forwarded emails or .ics attachments server-side is also possible
  (Resend can receive inbound mail) but is strictly more work than EventKit for
  the same data. Defer.

### 3. Venue metadata (typeahead search when creating an event)

| Option | Cost | Photos | Expo fit |
| --- | --- | --- | --- |
| **MKLocalSearch / MKLocalSearchCompleter** (on-device MapKit) | **Free, no quota** | No | Needs a small native module — no first-party Expo API. [`react-native-mk-local-search`](https://github.com/riku99/react-native-mk-local-search) exists, or a ~50-line local Expo Module; either way requires a dev-client/prebuild (Cinch already builds with CNG) |
| **Apple Maps Server API** | **Free: 25,000 calls/day** with the Apple Developer Program membership we already pay for ([Apple](https://developer.apple.com/documentation/applemapsserverapi/), [try page](https://developer.apple.com/maps/try-maps-server-api/)) | No | Trivial — JWT-signed REST from a Supabase Edge Function; zero native code |
| Google Places API (New) | Autocomplete $2.83/1K per-request (free only inside paid sessions); Place Details $5–17/1K; per-SKU free tiers (10K Essentials / 5K Pro per month); the old $200 universal credit was retired March 2025 ([Google billing docs](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [Woosmap analysis](https://www.woosmap.com/blog/google-places-api-pricing)) | Yes | Easy REST, but it's a metered bill with sharp edges |
| Foursquare Places | 10K Pro calls/mo free + $200 credit; but photos/hours/ratings are Premium at $18.75/1K with **no** free tier; legacy v3 dies May 15, 2026 ([pricing](https://foursquare.com/pricing/), [Camino breakdown](https://app.getcamino.ai/learn/foursquare-places-api-pricing)) | Premium only | Easy REST |
| Yelp Fusion | Paid-only, $7.99+/1K after 30-day trial | Yes | Easy REST |

The only thing Apple doesn't give us is **venue photos**. For a dinner-event
card, that's cosmetic — The Plate aesthetic can carry an event card with
typography, a map snapshot (MapKit, also free), or the host's own photo. Not
worth $17/1K Place Details Pro calls at launch.

**Recommendation: Apple Maps Server API from a Supabase Edge Function** as the
primary path — it needs zero native code, keeps the API key server-side, and
25K/day is far beyond launch traffic. Move search on-device to MKLocalSearch
later if latency or the round-trip ever bothers us.

---

## Legal / ToS notes

- **Do not scrape.** OpenTable's Terms of Use prohibit "any deep-link, robot,
  spider, scraper, generative AI or other AI technology to access, copy, search,
  or monitor any portion of the Services" without authorization, and OpenTable
  has been publicly cracking down on unapproved third-party access in 2026
  ([Terms](https://www.opentable.com/c/legal/terms-and-conditions/),
  [Spectrum News on the 2026 terms update](https://spectrumlocalnews.com/ca/california/business/2026/07/14/opentable-new-terms)).
  Resy/Tock have equivalent clauses. This rules out: fetching availability,
  parsing venue pages server-side, and any use of `api.resy.com`.
- **User-initiated outbound links are fine.** Storing a URL the user pasted and
  opening it in their browser/app is ordinary linking, not automated access.
  The prefill params are undocumented, so treat them as progressive
  enhancement.
- **Trademarks:** no OpenTable/Resy logos or brand marks without written
  consent ([OpenTable terms](https://www.opentable.com/c/legal/terms-and-conditions/)).
  Plain-text nominative use — a button reading "Open in OpenTable" / "View on
  Resy" in Cinch's own typography — is the safe pattern. No platform logos in
  screenshots or marketing.
- **Calendar data:** EventKit full access triggers an App Store privacy-label
  entry and a purpose string; only request it when the user taps "Import from
  Calendar," never at onboarding.

---

## Recommended MVP

**Create-event flow:**

1. **Venue typeahead** — Apple Maps Server API (search/searchAutocomplete,
   restaurant POI filter) proxied through a Supabase Edge Function. Returns
   name, address, coordinates. Free at 25K calls/day. Store a normalized
   `venues` row (name, address, lat/lng, apple place id).
2. **Manual details** — date, time, party size. Three taps; this is not the
   hard part of the feature and needs no integration.
3. **Optional reservation link** — a paste field ("Have a reservation? Paste
   the link"). Detect platform from hostname (`opentable.com`, `resy.com`,
   `exploretock.com`, `sevenrooms.com`, `yelp.com`), store the URL verbatim,
   and render a "View reservation" / "Open in {Platform}" button on the event
   for the host — and a "Book nearby" style outbound link for guests where the
   URL is a venue page. Never fetch it ourselves.
4. **Optional calendar import** — "Import from Calendar" via `expo-calendar`
   (iOS 17 full-access permission, requested lazily): list upcoming events,
   user picks their reservation, we prefill venue/date/time and party size
   (parse "for N" from the title when present, else leave for manual entry).
   This is the closest thing to "connected to their OpenTable reservation"
   that exists without a partnership, and it's genuinely good UX.

**Guests** join the event and plan outfits — none of that touches reservation
platforms at all.

Build cost: one edge function, one paste field with a hostname parser, one
permissioned calendar picker. No new monthly bills, no partner agreements, no
native modules required.

---

## Future integrations (post-launch)

| Opportunity | What it gets us | What justifies pursuing it |
| --- | --- | --- |
| **OpenTable affiliate program** | Sanctioned referral links, per-seated-diner commission, legitimacy for deep links ([program page](https://help.opentable.com/s/article/OpenTable-Affiliate-Program-1505261059868?language=en_US)) | Any meaningful volume of outbound OpenTable taps — it converts an existing behavior into revenue and a contract. Apply early; it's low-effort. |
| **Resy partnership (discovery category)** | Real venue/availability data, possibly booking attribution | >20–30% of dinner events carrying pasted Resy links, or a NYC-heavy user base (Resy's stronghold). Amex partnership also has brand-halo value for a style app. |
| **Yelp Fusion AI reservation fields** | "Bookable now" badges and availability on event cards, purchasable without partnership | Users asking for availability inside Cinch; worth it only once revenue covers the $7.99+/1K metering. |
| **Inbound email parsing** (forward confirmation to `events@mail.cinchstyle.com` via Resend) | Zero-tap event creation from any platform's confirmation | Evidence that calendar import has friction (denied permissions, Google-calendar-only users). |
| **Tock / SevenRooms** | Niche coverage | Only with inbound user demand; both are enterprise-gated. |

**Instrument from day one:** count pasted-link events by platform hostname and
calendar-import usage. Those two numbers are the entire business case for every
row above.

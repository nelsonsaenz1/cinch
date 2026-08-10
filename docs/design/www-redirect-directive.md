# Directive — make `cinchstyle.com` the primary domain

**Owner:** founder (Vercel dashboard). Nobody else has access.
**Status:** blocking for invite links. Not blocking the store build.
**Raised:** 2026-08-10, while building atlas 39.

---

## The one-line ask

In the Vercel project's **Domains** settings, make the apex `cinchstyle.com`
the primary domain and set `www.cinchstyle.com` to redirect to it — reversing
the direction that is configured today.

---

## What is wrong now

Every request to the apex is answered with a 308 to `www`:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://cinchstyle.com/i/@ada
```

Today that prints `308 -> https://www.cinchstyle.com/i/@ada`. The same is true
of `/.well-known/apple-app-site-association`, `/privacy`, `/terms` and `/`.

In a browser this is invisible and harmless — it is why nobody has noticed.

## Why it breaks the invite, twice, in silence

Universal links have two halves and the redirect defeats both.

**1. Apple will not fetch the association file through a redirect.** Apple's
crawler reads `https://cinchstyle.com/.well-known/apple-app-site-association`
and requires a direct `200` with `content-type: application/json`. A 308 is
treated as the file not existing. Nothing reports this — the app installs
fine, and links simply never open it.

**2. iOS checks the tapped URL, not the destination.** The entitlement claims
`applinks:cinchstyle.com`, and iOS matches the URL as tapped, *before* any
redirect is followed. So an apex link is not recognised as an app link, Safari
opens instead, Safari follows the 308, and the visitor lands on the web page.
It looks exactly like the feature was never built.

**Both failure modes are silent.** No crash, no error, no log line, in the app
or in Vercel. The only symptom is that invites open a web page for people who
already have Cinch — which reads as a bug in the app, and would be debugged
there first.

## Why the fix has to be this way round

The apex is the form the product uses everywhere:

- `src/features/invite/link.ts` mints `https://cinchstyle.com/i/@handle`, and
  it is the string set in serif on the dark card in IV-01 — the one users read,
  screenshot and type out.
- The web landing page and the association file are served from the same
  project either way.

The alternative — minting `www` links instead — was rejected. It would leave
every apex link broken, including every invite already shared, every one
someone types from memory, and the one printed in the app. `www` in a serif
display line is also just worse.

The app already claims **both** hosts (`app.config.ts`), so a `www` link
someone shares by hand will work. That is a safety net, not the fix: it cannot
rescue the apex, because the apex never reaches the app to begin with.

## Verifying it afterwards

Three checks, in order. All three must pass.

**1. The apex answers directly, with no hop.**

```bash
curl -sS -o /dev/null -w "status=%{http_code} hops=%{num_redirects}\n" -L https://cinchstyle.com/.well-known/apple-app-site-association
```

Wanted: `status=200 hops=0`. Any `hops` above zero and Apple will not read it.

**2. It is served as JSON and parses.**

```bash
curl -sS https://cinchstyle.com/.well-known/apple-app-site-association | python3 -m json.tool
```

Wanted: valid JSON containing `THR27ADF4P.com.nelsonsaenz.cinch`, with paths
scoped to `/i/*` only. If `/privacy`, `/terms` or `/support` appear here, those
pages would start opening the app instead of the browser — they must not.

**3. Apple has picked it up.** Their CDN caches the file and takes a few hours
after it first goes live:

```bash
curl -sS https://app-site-association.cdn-apple.com/a/v1/cinchstyle.com
```

Then, on a device or simulator with the new build installed:

```bash
xcrun simctl openurl booted 'https://cinchstyle.com/i/@ada'
```

Wanted: Cinch opens on the arrival screen. If Safari opens instead, one of the
three checks above is still failing — the order matters, so re-run them from
the top rather than guessing.

## What still works while this is unfixed

Everything except the app-opening half. The landing page renders, the App Store
button works, the copy is correct, and someone who installs and taps the link
again gets the arrival screen once the redirect is fixed. Nothing needs
rebuilding or republishing afterwards — this is a DNS-layer setting, and the
binary already claims both hosts.

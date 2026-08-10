import { guardedFetch, UnsafeUrlError } from './net.ts';
import { hostLabel } from './page-meta.ts';

/**
 * Whether a site asked us not to do what we are about to do.
 *
 * `net.ts` answers a different question — "can this address hurt us" — and
 * answers it well: any public https host passes. That is the right boundary for
 * server-side request forgery and the wrong one for everything else, because a
 * retailer's objection to being scraped is not expressed as a private IP
 * address. It is expressed in `robots.txt`, in an `X-Robots-Tag` header, and in
 * a `<meta name="robots">` element, and until this file existed Cinch read none
 * of them.
 *
 * WHY NOT AN ALLOWLIST, WHICH IS THE OBVIOUS ANSWER
 *
 * Twenty named retailers is the version of this policy that survives a lawyer's
 * first reading and none of a user's. Clothing is a long tail: the dress
 * somebody wants in their closet is as likely to come from a Shopify store with
 * four hundred customers as from Nordstrom, and a feature that silently returns
 * nothing for the four-hundred-customer shop is not a safer feature, it is a
 * broken one that the user blames themselves for. Worse, an allowlist is a
 * *claim* — it says we vetted these twenty and they said yes — and we have not
 * signed an agreement with any of them, so the claim would be false in exactly
 * the way that matters.
 *
 * The premise this feature actually rests on is narrower and defensible: a
 * product listing photograph is published BY the seller, WITH Open Graph tags
 * whose entire purpose is to have that image copied and re-displayed by anyone
 * who links to the page. That is not an accident of the web, it is the protocol
 * working as designed. What we owe in return is (a) to honour the mechanisms
 * that let a site opt out of exactly that, (b) to attribute, and (c) to stop
 * where the premise stops holding.
 *
 * So the policy is four rules, in the order they are cheapest to check:
 *
 *   not_a_retailer     the host is a social network, a pinboard or an image
 *                      cache. The picture there was published by somebody who
 *                      is not selling the garment, and the "seller published
 *                      this to be shared" premise simply does not apply.
 *   robots_disallowed  `robots.txt` refuses our path, for `CinchBot` or for `*`.
 *   robots_unavailable `robots.txt` could not be read at all. We decline rather
 *                      than assume permission — see the note below, it is a
 *                      deliberate and costly choice.
 *   noindex            `X-Robots-Tag` or `<meta name="robots">` carries
 *                      `noindex`, `none` or `noimageindex`.
 *   no_ai_use          the same two places carry `noai` or `noimageai`, the
 *                      convention publishers have converged on for "not for
 *                      machine reuse". It has no RFC and no case law behind it.
 *                      Honouring an informal signal costs us a handful of
 *                      candidates; ignoring one that a site went out of its way
 *                      to publish is the sentence nobody wants to read aloud.
 *
 * WHY `robots_unavailable` DECLINES RATHER THAN PROCEEDS. RFC 9309 §2.3.1.4
 * says a crawler that gets a 5xx "SHOULD assume complete disallow", and is
 * silent on timeouts. A polite reading of a timeout is "allow" — the file
 * probably does not exist. We take the impolite-to-ourselves reading instead,
 * because this policy's whole value is that it is the thing we can point at,
 * and a policy with a hole shaped like "the server was slow" is not one you can
 * point at. The cost is real and lands on the user: a flaky retailer becomes a
 * dropped tile. It is paid for by rule five below.
 *
 * That strictness stops exactly where the RFC does, and the boundary was drawn
 * by evidence rather than taste — see `fetchRobots`, where a 4xx and an
 * unfollowable redirect both mean "allowed", because the first real retailer
 * tested fell into the second case for a reason that had nothing to do with
 * what it wanted.
 *
 * FIFTH RULE, AND THE ONE THAT MAKES THE OTHER FOUR SHIPPABLE: a refusal is
 * never silence. Every decline carries a `DeclineReason` back to the client as
 * a bounded enum, alongside the host it applies to, so the screen can say "one
 * shop asked not to be indexed" instead of showing an empty grid. An empty grid
 * teaches the user the feature is broken; a named refusal teaches them it has
 * limits, and only one of those two is true.
 *
 * WHAT THIS DOES NOT DO. It does not read a site's terms of service, which is
 * the only place most retailers actually state their position and which no
 * program can parse. It does not authenticate us to anyone. It does not create
 * a licence — honouring `robots.txt` is evidence of good faith, not permission,
 * and `docs/design/listing-imagery-posture.md` says so in as many words rather
 * than letting this file imply otherwise.
 */

/**
 * The reasons a source can be refused, as a closed set.
 *
 * Closed on purpose: it crosses the wire and the client renders a sentence per
 * value, so a new reason invented here without a matching sentence there shows
 * the user a raw identifier. Adding one is a two-file change, and that friction
 * is the point.
 */
export type DeclineReason =
  | 'not_a_retailer'
  | 'robots_disallowed'
  | 'robots_unavailable'
  | 'noindex'
  | 'no_ai_use';

/** A refused source, in the shape the client receives it. */
export type Declined = {
  /** Host only, e.g. "pinterest.com". Never a full URL — see below. */
  source: string;
  reason: DeclineReason;
};

/**
 * Hosts where the premise fails.
 *
 * Not a moral ranking of these companies and not a claim they forbid anything.
 * It is one distinction: on a shop's product page the photograph was published
 * by whoever is selling the garment, for the purpose of being shown alongside a
 * link to it. On a pinboard, a feed or a search engine's image cache it was
 * uploaded, re-hosted or scraped by somebody who is selling nothing, and often
 * did not take it either. Every argument this feature has rests on the first
 * situation and none of them survive the second.
 *
 * Resale marketplaces are deliberately ABSENT. A Poshmark or Depop listing is a
 * person selling a garment and publishing a photograph of it to be shared — the
 * premise holds exactly as it does at Nordstrom, and excluding them would cut
 * out most of what makes a secondhand wardrobe findable at all.
 */
const NON_RETAILER_HOSTS = [
  'pinterest.com',
  'pinimg.com',
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  'facebook.com',
  'lookaside.fbsbx.com',
  'threads.net',
  'twitter.com',
  'x.com',
  'twimg.com',
  'tumblr.com',
  'reddit.com',
  'redd.it',
  'weheartit.com',
  'flickr.com',
  'staticflickr.com',
  // Search engines' own image caches: a copy of somebody else's picture,
  // re-served by a party with no relationship to the garment.
  'gstatic.com',
  'bing.net',
  'bing.com',
  'yandex.net',
  'duckduckgo.com',
];

/**
 * Retailers with a public affiliate or product-feed programme.
 *
 * Used ONLY to nudge ordering, never to gate — a candidate from an unlisted
 * shop is as admissible as one from Nordstrom. The reason to keep the list at
 * all is that these are the sources where the relationship could become a
 * written one: joining their affiliate programme turns "we read your Open Graph
 * tags" into "we are a partner with a feed", which is the actual fix for this
 * whole area and is a human's job, not a function's. Preferring them today
 * means the day somebody signs up, the traffic is already pointed there.
 *
 * Necessarily incomplete and will go stale. That is tolerable precisely because
 * nothing is refused for being absent.
 */
const PREFERRED_SOURCES = [
  'nordstrom.com',
  'net-a-porter.com',
  'mrporter.com',
  'ssense.com',
  'farfetch.com',
  'revolve.com',
  'shopbop.com',
  'asos.com',
  'zappos.com',
  'anthropologie.com',
  'urbanoutfitters.com',
  'freepeople.com',
  'jcrew.com',
  'madewell.com',
  'everlane.com',
  'reformation.com',
  'aritzia.com',
  'arket.com',
  'cos.com',
  'uniqlo.com',
];

/** Does `host` equal one of `list`, or sit under it as a subdomain? */
function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * A small ordering nudge toward sources we could hold a written relationship
 * with. Deliberately smaller than the gap between a confident match and a
 * hopeful one, so it breaks ties and never overrules the model.
 */
export const PREFERENCE_BONUS = 0.05;

export function isPreferredSource(url: URL): boolean {
  return hostMatches(hostLabel(url), PREFERRED_SOURCES);
}

// ── robots.txt ───────────────────────────────────────────────────────────────

/** Our product token, matching the `user-agent` `net.ts` actually sends. */
const AGENT_TOKEN = 'cinchbot';

/** Google's own ceiling, and far past any real file. */
const ROBOTS_MAX_BYTES = 512 * 1024;
/**
 * Short on purpose. This fetch is on the critical path of a screen somebody is
 * watching, and it happens up to ten times in parallel. A robots.txt that takes
 * longer than this is served by infrastructure that will not serve the product
 * page inside the 8-second budget either.
 */
const ROBOTS_TIMEOUT_MS = 3_000;

/** One hour. Long enough that a search's ten candidates cost one fetch per
 *  host; short enough that a site changing its mind is honoured the same day. */
const ROBOTS_TTL_MS = 60 * 60 * 1_000;

/** Bounded so a long-lived isolate cannot grow a map without end. */
const ROBOTS_CACHE_MAX = 256;

type RobotsRule = { pattern: string; allow: boolean };

type Robots =
  | { kind: 'allow-all' }
  | { kind: 'deny-all' }
  | { kind: 'unavailable' }
  | { kind: 'rules'; rules: RobotsRule[] };

type CacheEntry = { at: number; robots: Promise<Robots> };

/**
 * Module scope, which in an Edge Function means "for the life of this isolate".
 * Holds the PROMISE rather than the value so that ten candidates on one host,
 * launched in the same tick, share a single fetch instead of racing ten.
 */
const robotsCache = new Map<string, CacheEntry>();

/**
 * Parse a robots.txt into the rules that apply to us.
 *
 * Group selection follows RFC 9309: the most specific matching `user-agent`
 * wins, so an explicit `CinchBot` group beats `*` entirely rather than adding
 * to it. Only `allow` and `disallow` are read — `crawl-delay` is unenforceable
 * inside a request somebody is waiting on, and `sitemap` is not about us.
 */
function parseRobots(text: string): Robots {
  // Two accumulating groups, because a file may name us anywhere in it and we
  // cannot know until the end whether it did.
  const wildcard: RobotsRule[] = [];
  const named: RobotsRule[] = [];
  let sawNamed = false;

  /** Which groups the lines currently being read belong to. */
  let inWildcard = false;
  let inNamed = false;
  /** A run of consecutive `user-agent:` lines is one group's header. */
  let collectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator < 0) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!collectingAgents) {
        // A new group starts here; forget the previous one's membership.
        inWildcard = false;
        inNamed = false;
        collectingAgents = true;
      }
      const agent = value.toLowerCase();
      if (agent === '*') inWildcard = true;
      // Prefix match, because a token may carry a version: `CinchBot/1.0`.
      if (agent.startsWith(AGENT_TOKEN)) {
        inNamed = true;
        sawNamed = true;
      }
      continue;
    }

    collectingAgents = false;

    if (field !== 'allow' && field !== 'disallow') continue;

    // An empty `Disallow:` is the documented way to say "everything is fine",
    // and an empty `Allow:` means nothing at all. Both are simply not rules.
    if (!value) continue;

    const rule: RobotsRule = { pattern: value, allow: field === 'allow' };
    if (inNamed) named.push(rule);
    if (inWildcard) wildcard.push(rule);
  }

  const rules = sawNamed ? named : wildcard;
  if (rules.length === 0) return { kind: 'allow-all' };
  return { kind: 'rules', rules };
}

/**
 * Does a robots.txt pattern match this path?
 *
 * `*` is any run of characters and `$` anchors the end — the two extensions
 * every major crawler implements and every real robots.txt assumes. Escaping
 * the rest before building the expression is what keeps a hostile file from
 * turning into a hostile regular expression.
 */
function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const source = body
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]*');

  try {
    return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
  } catch {
    // A pattern that will not compile is a pattern we cannot honour. Treating
    // it as "does not match" leaves the decision to the file's other lines.
    return false;
  }
}

/**
 * RFC 9309 §2.2.2: the longest matching rule wins, and `allow` wins a tie.
 * The tie rule is what makes `Disallow: /` plus `Allow: /products/` behave the
 * way a site meant it to.
 */
function robotsAllows(robots: Robots, path: string): boolean {
  if (robots.kind === 'allow-all') return true;
  if (robots.kind === 'deny-all') return false;
  if (robots.kind === 'unavailable') return false;

  let bestLength = -1;
  let bestAllow = true;

  for (const rule of robots.rules) {
    if (!patternMatches(rule.pattern, path)) continue;
    const length = rule.pattern.length;
    if (length > bestLength || (length === bestLength && rule.allow)) {
      bestLength = length;
      bestAllow = rule.allow;
    }
  }

  return bestLength < 0 ? true : bestAllow;
}

/**
 * Fetch and parse one origin's robots.txt.
 *
 * Status handling is RFC 9309 §2.3.1 with one deliberate departure, noted at
 * the top of this file: a network failure is treated as `unavailable`, which
 * refuses, where the RFC only requires that of a 5xx.
 */
async function fetchRobots(origin: string): Promise<Robots> {
  let response;
  try {
    response = await guardedFetch(`${origin}/robots.txt`, {
      accept: 'text/plain',
      maxBytes: ROBOTS_MAX_BYTES,
      timeoutMs: ROBOTS_TIMEOUT_MS,
    });
  } catch (err) {
    /**
     * `UnsafeUrlError` here means the origin redirected its robots.txt
     * somewhere `net.ts` will not follow — overwhelmingly a plain-http hop —
     * or served more than half a megabyte of it.
     *
     * This is RFC 9309 §2.3.1.2's "redirects" case, and the RFC's answer is
     * that an unfollowable chain leaves robots.txt *unavailable*, which by
     * §2.3.1.3 means everything is allowed. We follow the RFC here rather than
     * our own stricter instinct, on evidence: reformation.com — a first-party
     * brand site, exactly the source this feature is for — 301s
     * `www.reformation.com/robots.txt` to `http://www.thereformation.com/...`,
     * and the strict reading refused the whole shop over a scheme downgrade in
     * a courtesy lookup. A rule that a retailer's own site fails at random is
     * not a stricter rule, it is a broken one, and defending it would mean
     * defending an outcome nobody intended.
     *
     * The scheme downgrade is still not FOLLOWED — `net.ts` is untouched and
     * the request is never made over http. What changes is only what we
     * conclude from not having made it.
     */
    if (err instanceof UnsafeUrlError) return { kind: 'allow-all' };
    // Anything else is a timeout or a transport failure: the server did not
    // answer at all, which is the one case where we have no information and
    // pressing on anyway is the rudest option. See the note at the top of this
    // file — this branch is the deliberate cost.
    return { kind: 'unavailable' };
  }

  // "Unavailable" in the RFC's sense — the file is not there, so nothing is
  // forbidden. This is the common case: most origins 404 their robots.txt.
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    return { kind: 'allow-all' };
  }

  if (response.status !== 200) return { kind: 'unavailable' };

  return parseRobots(new TextDecoder('utf-8', { fatal: false }).decode(response.body));
}

/** Cached, de-duplicated, and bounded. */
function robotsFor(origin: string): Promise<Robots> {
  const now = Date.now();
  const cached = robotsCache.get(origin);
  if (cached && now - cached.at < ROBOTS_TTL_MS) return cached.robots;

  // Oldest-first eviction, which for a map this small is just "drop the head".
  if (robotsCache.size >= ROBOTS_CACHE_MAX) {
    const oldest = robotsCache.keys().next();
    if (!oldest.done) robotsCache.delete(oldest.value);
  }

  const robots = fetchRobots(origin).catch((): Robots => ({ kind: 'unavailable' }));
  robotsCache.set(origin, { at: now, robots });
  return robots;
}

// ── Indexing directives, which arrive after the request is already made ──────

/**
 * The directives that mean "do not keep a copy of this".
 *
 * `noindex` and `none` are Google's originals; `noimageindex` is the one aimed
 * precisely at what we do. `noai` and `noimageai` have no standard behind them
 * — they are a convention publishers adopted and several CDNs now emit — and
 * they are honoured anyway, for the reason given at the top of this file.
 */
const NOINDEX_TOKENS = ['noindex', 'none', 'noimageindex'];
const NO_AI_TOKENS = ['noai', 'noimageai'];

/**
 * Read one directive string — from a header or a meta element — for us.
 *
 * A value may be scoped to an agent (`googlebot: noindex`). An unscoped value
 * applies to everybody, including us; a value scoped to another crawler's name
 * does not, and reading it as though it did would refuse pages nobody asked us
 * to refuse.
 */
function readDirectives(value: string): DeclineReason | null {
  for (const clause of value.split(',')) {
    const trimmed = clause.trim().toLowerCase();
    if (!trimmed) continue;

    let directives = trimmed;
    const scope = trimmed.indexOf(':');
    if (scope >= 0) {
      const agent = trimmed.slice(0, scope).trim();
      // Scoped at somebody else — and `noindex` itself never contains a colon,
      // so this cannot swallow an unscoped directive.
      if (!agent.startsWith(AGENT_TOKEN) && agent !== '*') continue;
      directives = trimmed.slice(scope + 1).trim();
    }

    for (const token of directives.split(/\s+/)) {
      if (NOINDEX_TOKENS.includes(token)) return 'noindex';
      if (NO_AI_TOKENS.includes(token)) return 'no_ai_use';
    }
  }
  return null;
}

/**
 * `<meta name="robots" content="…">`, in either attribute order.
 *
 * The group indices travel WITH the expression rather than being inferred from
 * it, because the two orders capture their pair the other way round and a rule
 * that reads "whichever came first in the source" is a rule that breaks the day
 * somebody reorders the character class.
 */
const META_ROBOTS_PATTERNS: { pattern: RegExp; name: number; content: number }[] = [
  { pattern: /<meta[^>]+name=["']([a-z0-9_-]+)["'][^>]+content=["']([^"']*)["']/gi, name: 1, content: 2 },
  { pattern: /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']([a-z0-9_-]+)["']/gi, name: 2, content: 1 },
];

/** The `name` values worth reading. Anything else is a description or a
 *  viewport, and scanning it for the word "noindex" would be superstition. */
const ROBOTS_META_NAMES = ['robots', 'cinchbot', 'googlebot', 'bingbot'];

/**
 * What the response itself says about being copied.
 *
 * Runs AFTER the fetch, which is unavoidable — a header cannot be read before
 * it arrives — and that is why it exists alongside the robots.txt check rather
 * than instead of it. The request has already been made; what this decides is
 * whether we are allowed to KEEP what came back, which is the part that
 * produces a stored object with our name on it.
 */
export function admitContent(headers: Headers, html?: string): DeclineReason | null {
  const header = headers.get('x-robots-tag');
  if (header) {
    const reason = readDirectives(header);
    if (reason) return reason;
  }

  if (!html) return null;

  for (const entry of META_ROBOTS_PATTERNS) {
    // A fresh lastIndex per call: these are module-level `g` expressions and
    // would otherwise resume mid-document on the next page.
    entry.pattern.lastIndex = 0;
    for (;;) {
      const match = entry.pattern.exec(html);
      if (!match) break;

      const name = (match[entry.name] ?? '').toLowerCase();
      const content = match[entry.content] ?? '';

      if (!ROBOTS_META_NAMES.includes(name)) continue;
      // A meta element scoped by its `name` to another crawler is that
      // crawler's instruction, not ours.
      if (name !== 'robots' && name !== 'cinchbot') continue;

      const reason = readDirectives(content);
      if (reason) return reason;
    }
  }

  return null;
}

// ── The one entry point everything else uses ─────────────────────────────────

/**
 * May we fetch and keep something from this URL?
 *
 * Called before every outbound request that ends in a stored byte or a
 * displayed tile — the search's candidate pages, a pasted link, and the image
 * download itself, which is a separate host often enough (a CDN) that checking
 * only the page would be checking the wrong site.
 *
 * Returns `null` for "yes" rather than a boolean, so the caller has the reason
 * in hand at the moment it needs to report one and cannot accidentally discard
 * it by writing `if (!allowed)`.
 */
export async function admitSource(url: URL): Promise<DeclineReason | null> {
  const host = hostLabel(url);
  if (hostMatches(host, NON_RETAILER_HOSTS)) return 'not_a_retailer';

  const robots = await robotsFor(url.origin);
  if (robots.kind === 'unavailable') return 'robots_unavailable';
  if (!robotsAllows(robots, `${url.pathname}${url.search}`)) return 'robots_disallowed';

  return null;
}

/**
 * The sentence a user reads when the source they chose is the one refused.
 *
 * Only the single-source paths need it — a pasted link, a confirmed tile. The
 * search paths hand back the enum and let the client compose one sentence for
 * however many hosts were dropped, because "three shops asked not to be
 * indexed" is a better sentence than three copies of this one.
 *
 * Each names the site's decision rather than our failure, and none of them
 * apologise: the shop is entitled to this, and telling the user Cinch "can't"
 * do something would invite them to retry until it works.
 */
export function declineMessage(reason: DeclineReason): string {
  switch (reason) {
    case 'not_a_retailer':
      return 'That picture is from a social site, not a shop. Paste the link from where the item is sold.';
    case 'robots_disallowed':
      return "That shop asks not to have its pages read automatically. Photograph the item instead.";
    case 'robots_unavailable':
      return "That shop didn't answer when Cinch asked what it allows. Try again, or photograph the item.";
    case 'noindex':
      return "That page asks not to be copied. Photograph the item instead.";
    case 'no_ai_use':
      return "That shop asks that its pictures not be reused by apps like Cinch. Photograph the item instead.";
  }
}

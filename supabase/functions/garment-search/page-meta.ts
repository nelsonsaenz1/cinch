/**
 * Reading a product page's own description of itself.
 *
 * Two callers, one set of rules. `provider.ts` uses this to turn a cited page
 * into a candidate tile; `index.ts` uses it to turn a link somebody pasted into
 * a preview. Both want exactly the same three facts — the hero image, the
 * product's name, the shop it came from — so they come from one place rather
 * than two copies that drift.
 *
 * REGULAR EXPRESSIONS, NOT A PARSER, AND ON PURPOSE. Pulling an HTML parser
 * into an Edge Function bundle to read three meta tags is the larger cost, and
 * the failure mode here is benign in a way that justifies the cheap tool: a
 * pattern that misses produces NO candidate, which the caller reports honestly,
 * rather than a wrong one it would present with confidence.
 *
 * NO JAVASCRIPT IS EXECUTED. A retailer that renders its product page entirely
 * client-side publishes no Open Graph tags in the HTML we receive, and there is
 * nothing to be done about that inside a function with an 8-second budget. That
 * is a real limitation, it is stated where the user can see it ("Cinch couldn't
 * read that page — photograph the item instead"), and it is not papered over
 * with a guess at the biggest <img> on the page, which on a commerce template
 * is usually a banner.
 */

// The rule this file already stated — a title it emits must be one the import
// endpoint would accept back — now comes from the file that owns the bound,
// rather than a copy of the number that could drift away from it.
import { boundTitle } from './title-bound.ts';

/** A product page is HTML; anything past this is analytics, not markup. */
export const PAGE_MAX_BYTES = 768 * 1024;
/** Long enough for a slow retailer, short enough that a hung host is not a hang. */
export const PAGE_TIMEOUT_MS = 8_000;

/** The `accept` header both callers send. Kept here so they cannot disagree. */
export const PAGE_ACCEPT = 'text/html,application/xhtml+xml';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&#x2F;': '/',
  '&nbsp;': ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(
    /&(?:amp|quot|#39|apos|lt|gt|#x2F|nbsp);/gi,
    (match) => ENTITIES[match.toLowerCase()] ?? match,
  );
}

/** "www.reformation.com" -> "reformation.com". Shown as the tile's caption. */
export function hostLabel(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** First capturing group of the first pattern that hits. */
function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

const IMAGE_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
  /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  // JSON-LD Product, which is what a page without Open Graph usually has.
  /"image"\s*:\s*"([^"]+)"/i,
  /"image"\s*:\s*\[\s*"([^"]+)"/i,
];

/**
 * The product photograph a page publishes about itself.
 *
 * `og:image` is the right thing to read rather than the biggest `<img>` in the
 * markup: it is the image the retailer chose to represent the product, it is
 * absolute or resolvable, and it is the one asset on a commerce page that is
 * reliably the garment rather than a banner, a badge or a tracking pixel.
 */
export function extractImageUrl(html: string, pageUrl: URL): string | null {
  for (const pattern of IMAGE_PATTERNS) {
    const match = pattern.exec(html);
    if (!match?.[1]) continue;
    const raw = decodeEntities(match[1].trim());
    try {
      // Protocol-relative and root-relative URLs are both common; resolving
      // against the page is what makes them usable.
      const resolved = new URL(raw, pageUrl);
      if (resolved.protocol !== 'https:') continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}

const TITLE_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']og:title["']/i,
  /<meta[^>]+(?:property|name)=["']twitter:title["'][^>]+content=["']([^"']*)["']/i,
  /<title[^>]*>([\s\S]{1,300}?)<\/title>/i,
];

/** The separators retailers hang their shop name off the end of a title with. */
const TITLE_SEPARATORS = [' | ', ' — ', ' – ', ' - ', ' · ', ' :: '];

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * "Gemma Dress | Reformation" -> "Gemma Dress".
 *
 * The trailing shop name is dropped only when it demonstrably IS the shop name —
 * when the last segment matches the host, either way round. A blunter rule that
 * always drops the final segment turns "Linen Shirt - Navy" into "Linen Shirt"
 * and quietly throws away the colour, which is the one word the user needed.
 */
function stripSiteSuffix(title: string, pageUrl: URL): string {
  const host = comparable(hostLabel(pageUrl).split('.')[0] ?? '');
  if (!host) return title;

  for (const separator of TITLE_SEPARATORS) {
    const index = title.lastIndexOf(separator);
    if (index <= 0) continue;

    const head = title.slice(0, index).trim();
    const tail = comparable(title.slice(index + separator.length));
    if (!head || !tail) continue;

    if (tail === host || tail.includes(host) || host.includes(tail)) return head;
  }
  return title;
}

/**
 * What the page says this product is called.
 *
 * Returns null rather than a guess: an untitled preview is a preview the user
 * can still name, where a fabricated one is a wrong name they have to notice
 * before they can correct it.
 */
export function extractTitle(html: string, pageUrl: URL): string | null {
  const raw = firstMatch(html, TITLE_PATTERNS);
  if (!raw) return null;

  const collapsed = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;

  const trimmed = stripSiteSuffix(collapsed, pageUrl).trim();
  if (!trimmed) return null;

  return boundTitle(trimmed);
}

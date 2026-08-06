import { BoundsError } from '../_shared/input-bounds.ts';

/**
 * Request bounds for garment-search.
 *
 * Same reasoning as `_shared/input-bounds.ts` — every string here becomes part
 * of a prompt billed by the token, and one of them becomes a web search that
 * costs money per call — but the shapes are local to this endpoint, so they
 * live beside it rather than widening the shared module.
 *
 * The swatch is the field worth explaining. It arrives as a base64 data URL
 * because the alternative — upload to Storage first, then hand the function a
 * path — would create an item row for a garment the user has not chosen yet and
 * leave litter behind on every abandoned search. The client shrinks it to a
 * 256px JPEG before encoding, which is all a colour and fabric reference needs;
 * the ceiling below is roughly four times that, and sits comfortably under the
 * shared 64KB body cap.
 */

/** Enough for "Reformation Gemma midi dress, size 2, navy, small floral print". */
const MAX_DESCRIPTION_CHARS = 240;
/** Short enough to be a description, long enough not to reject a real one. */
const MIN_DESCRIPTION_CHARS = 3;
const MAX_SWATCH_CHARS = 40_000;
const MAX_URL_CHARS = 2_048;
const MAX_TITLE_CHARS = 120;

/** Only the encodings a phone camera roll produces, and only base64. */
const SWATCH_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export type ValidatedSearchRequest = {
  action: 'search';
  description: string;
  swatchDataUrl?: string;
};

export type ValidatedImportRequest = {
  action: 'import';
  imageUrl: string;
  title?: string;
  source?: string;
};

/**
 * A product page URL somebody pasted.
 *
 * Bounded to the same 2,048 characters as an image URL — the practical ceiling
 * every browser and proxy already agrees on, and comfortably past the tracking
 * parameters a shared retailer link drags along with it.
 */
export type ValidatedResolveRequest = {
  action: 'resolve';
  pageUrl: string;
};

export type ValidatedRequest =
  | ValidatedSearchRequest
  | ValidatedImportRequest
  | ValidatedResolveRequest;

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BoundsError('body must be an object.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number, min = 1): string {
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new BoundsError(
      min === 1 ? `${field} is required.` : `${field} is too short (minimum ${min} characters).`,
    );
  }
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

export function parseGarmentSearchRequest(raw: unknown): ValidatedRequest {
  const body = asObject(raw);
  const action = body.action;

  if (action === 'import') {
    return {
      action: 'import',
      // Vetted for shape here and for *destination* by `assertSafeUrl` at the
      // moment of fetching. Both are needed: this one names the field in the
      // error, that one is the security boundary.
      imageUrl: requiredString(body.imageUrl, 'imageUrl', MAX_URL_CHARS),
      title: optionalString(body.title, 'title', MAX_TITLE_CHARS),
      source: optionalString(body.source, 'source', MAX_TITLE_CHARS),
    };
  }

  if (action === 'resolve') {
    return {
      action: 'resolve',
      // Shape only. `assertSafeUrl` decides whether the *destination* may be
      // reached, and it is the security boundary — this check exists so a
      // 10KB paste is refused before anything opens a socket.
      pageUrl: requiredString(body.pageUrl, 'pageUrl', MAX_URL_CHARS),
    };
  }

  if (action !== 'search') {
    throw new BoundsError('action must be "search", "resolve" or "import".');
  }

  const swatch = optionalString(body.swatch, 'swatch', MAX_SWATCH_CHARS);
  if (swatch !== undefined && !SWATCH_PREFIX.test(swatch)) {
    throw new BoundsError('swatch must be a base64 image data URL.');
  }

  return {
    action: 'search',
    description: requiredString(
      body.description,
      'description',
      MAX_DESCRIPTION_CHARS,
      MIN_DESCRIPTION_CHARS,
    ),
    swatchDataUrl: swatch,
  };
}

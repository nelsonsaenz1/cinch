import { BoundsError } from '../_shared/input-bounds.ts';
import { isBrowsableSlot, type BrowsableSlot } from '../_shared/browse-slots.ts';

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
/** "Comme des Garçons Comme des Garçons" fits; a smuggled paragraph does not. */
const MAX_BRAND_CHARS = 80;
/** Datafeedr's ids are numeric; this is a bound, not a shape. */
const MAX_EXTERNAL_ID_CHARS = 64;
/** "Heather Grey", "Vintage Black". Long enough for the merchant's own phrase. */
const MAX_COLOUR_LABEL_CHARS = 60;
/**
 * The most colourways one request may carry.
 *
 * Each one is an outbound image fetch of up to five megabytes, so this is the
 * ceiling on what a single authenticated call can ask our network to do — and
 * twelve is already more shirts of one design than the screen is drawn for.
 */
const MAX_BATCH_ROWS = 12;

/** Mirrors the check in `_shared/input-bounds.ts` (tag-item): the id becomes a
 *  lookup key, and a malformed uuid should be a 400 naming the field rather
 *  than an opaque error from Postgres. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function itemUuid(value: unknown): string {
  const id = requiredString(value, 'itemId', 40);
  if (!UUID.test(id)) throw new BoundsError('itemId must be a uuid.');
  return id;
}

/** Only the encodings a phone camera roll produces, and only base64. */
const SWATCH_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export type ValidatedSearchRequest = {
  action: 'search';
  description: string;
  swatchDataUrl?: string;
};

/**
 * The category grid's request: a slot, and NOTHING else.
 *
 * The slot is an enum, not a string that happens to look like one. That is the
 * whole privacy argument for browse in a single line — a request that cannot
 * carry words cannot leak them — so the parse refuses free text twice over:
 * a slot value outside the nine is a 400, and a `description` riding alongside
 * is a 400 even when the slot itself is valid, because accepting-and-ignoring
 * typed words would leave a field on the wire that the disclosure says does
 * not exist.
 */
export type ValidatedBrowseRequest = {
  action: 'browse';
  slot: BrowsableSlot;
};

/**
 * The chosen picture, on its way to becoming a garment.
 *
 * `pageUrl` is optional and should not be: the product page is what makes an
 * imported item attributable, and the server records it as
 * `listing_source_url`. It is optional anyway because a client that predates
 * this field is still in people's hands, and refusing its imports would break
 * a shipped door to fix a records problem. When it is absent the server falls
 * back to the image URL it actually fetched — coarser, never null. See
 * `importImage` in index.ts.
 *
 * `source` is accepted and DELIBERATELY IGNORED by the write path. It is a
 * display label the client derived from a URL it already had; the row's label
 * is derived server-side from the URL the server actually used, because a
 * source line the client can set is a source line that can be wrong.
 */
export type ValidatedImportRequest = {
  action: 'import';
  imageUrl: string;
  pageUrl?: string;
  title?: string;
  source?: string;
};

/**
 * One colourway on its way into the closet, inside a batch.
 *
 * `externalId` is Datafeedr's own row id and it is REQUIRED here where it is
 * absent from the single import — it is the idempotency key, and a batch
 * without one cannot promise that a retry will not duplicate. Sixty-four
 * characters is far past the numeric ids the feed actually returns; it is a
 * bound rather than a shape, because the shape belongs to a provider that may
 * one day issue something longer.
 *
 * `colourLabel` is the merchant's own word for the colourway, carried so the
 * three shirts a user just added are distinguishable in a closet grid before
 * tagging has run on any of them.
 */
export type ValidatedCatalogueImportRow = {
  externalId: string;
  imageUrl: string;
  pageUrl?: string;
  title?: string;
  colourLabel?: string;
};

/**
 * CPV2-06 — every colourway the user selected, in one request.
 *
 * Bounded at twelve. A product family with more than twelve colourways exists,
 * but a person who owns more than twelve of one shirt is not the case this
 * screen is for, and an unbounded array here is an unbounded number of outbound
 * image fetches from one request.
 */
export type ValidatedImportBatchRequest = {
  action: 'import-batch';
  imports: ValidatedCatalogueImportRow[];
  /**
   * The opaque intent key the search returned, when the client still has it.
   *
   * OPTIONAL, and it must stay optional: an import is a write the user asked
   * for, and refusing it because a statistic could not be attributed would be
   * putting the counter ahead of the closet. A key of the wrong shape simply
   * moves nothing — `record_catalogue_demand_by_key` updates an existing row or
   * does nothing at all, so there is no value a caller can send that creates
   * demand which never happened.
   */
  intentKey: string | null;
};

/** sha256, hex. Nothing else is a key, and nothing else is accepted. */
const INTENT_KEY_CHARS = 64;

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

/**
 * A garment the user already photographed, to be matched against the web.
 *
 * `brand` is the only optional lever: when the user knows who made the piece,
 * the hunt narrows to that brand's listings; when they leave it out, the model
 * proposes brands itself, and that unscoped run IS the near-identical fallback.
 */
export type ValidatedMatchRequest = {
  action: 'match';
  itemId: string;
  brand?: string;
};

/**
 * The confirm step for `match`: the tile the user tapped, pinned to their item.
 *
 * Both URLs are shape-checked here and destination-checked by `assertSafeUrl`
 * at the moment of use, exactly as `import` splits those duties.
 */
export type ValidatedAttachRequest = {
  action: 'attach';
  itemId: string;
  imageUrl: string;
  pageUrl: string;
};

/**
 * Undo for `attach`: the listing photo comes off and the user's own photograph
 * is what the closet shows again. It takes nothing but the item, because the
 * paths it clears are the ones already recorded on the row — a caller cannot
 * name an object to delete.
 */
export type ValidatedDetachRequest = {
  action: 'detach';
  itemId: string;
};

export type ValidatedRequest =
  | ValidatedSearchRequest
  | ValidatedBrowseRequest
  | ValidatedImportRequest
  | ValidatedImportBatchRequest
  | ValidatedResolveRequest
  | ValidatedMatchRequest
  | ValidatedAttachRequest
  | ValidatedDetachRequest;

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
      // Same 2,048-character ceiling as every other URL here, and the same
      // division of labour: shape now, destination at the moment of use.
      pageUrl: optionalString(body.pageUrl, 'pageUrl', MAX_URL_CHARS),
      title: optionalString(body.title, 'title', MAX_TITLE_CHARS),
      source: optionalString(body.source, 'source', MAX_TITLE_CHARS),
    };
  }

  if (action === 'import-batch') {
    const raw = body.imports;
    if (!Array.isArray(raw)) throw new BoundsError('imports must be an array.');
    if (raw.length === 0) throw new BoundsError('imports is empty.');
    if (raw.length > MAX_BATCH_ROWS) {
      throw new BoundsError(`imports is too long (${raw.length} rows, limit ${MAX_BATCH_ROWS}).`);
    }

    const intentKeyRaw = optionalString(body.intentKey, 'intentKey', INTENT_KEY_CHARS);

    return {
      action: 'import-batch',
      // Shape-checked here rather than trusted: the column it addresses is a
      // hash, so anything that is not one is not a key and is dropped quietly.
      intentKey:
        intentKeyRaw && /^[0-9a-f]{64}$/.test(intentKeyRaw) ? intentKeyRaw : null,
      imports: raw.map((entry, i) => {
        const row = asObject(entry);
        return {
          // Required, unlike the single import: without it a retry cannot be
          // told from a second request for more of the same shirt.
          externalId: requiredString(row.externalId, `imports[${i}].externalId`, MAX_EXTERNAL_ID_CHARS),
          // Shape only, both URLs. `assertSafeUrl` is the security boundary and
          // runs again at the moment each one is used.
          imageUrl: requiredString(row.imageUrl, `imports[${i}].imageUrl`, MAX_URL_CHARS),
          pageUrl: optionalString(row.pageUrl, `imports[${i}].pageUrl`, MAX_URL_CHARS),
          title: optionalString(row.title, `imports[${i}].title`, MAX_TITLE_CHARS),
          colourLabel: optionalString(row.colourLabel, `imports[${i}].colourLabel`, MAX_COLOUR_LABEL_CHARS),
        };
      }),
    };
  }

  if (action === 'browse') {
    // Enum-only, and said with the enum's own guard rather than a string
    // check: anything that is not one of the nine verified slots — a typo, a
    // tenth value, a sentence somebody hoped would be searched — is refused
    // before it can become a query.
    if (!isBrowsableSlot(body.slot)) {
      throw new BoundsError('slot must be one of the nine browsable categories.');
    }
    // No typed words may ride along. See `ValidatedBrowseRequest`.
    if (body.description !== undefined || body.query !== undefined) {
      throw new BoundsError('browse takes a slot, never typed words.');
    }
    return { action: 'browse', slot: body.slot };
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

  if (action === 'match') {
    return {
      action: 'match',
      itemId: itemUuid(body.itemId),
      brand: optionalString(body.brand, 'brand', MAX_BRAND_CHARS),
    };
  }

  if (action === 'attach') {
    return {
      action: 'attach',
      itemId: itemUuid(body.itemId),
      // Shape only, both of them — `assertSafeUrl` is the security boundary,
      // and it runs again on the server at the moment each URL is used.
      imageUrl: requiredString(body.imageUrl, 'imageUrl', MAX_URL_CHARS),
      pageUrl: requiredString(body.pageUrl, 'pageUrl', MAX_URL_CHARS),
    };
  }

  if (action === 'detach') {
    return {
      action: 'detach',
      itemId: itemUuid(body.itemId),
    };
  }

  if (action !== 'search') {
    throw new BoundsError(
      'action must be "search", "browse", "resolve", "import", "import-batch", "match", "attach" or "detach".',
    );
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

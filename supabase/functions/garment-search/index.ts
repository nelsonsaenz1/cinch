import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { OpenRouterError } from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';
import {
  parseGarmentSearchRequest,
  type ValidatedAttachRequest,
  type ValidatedDetachRequest,
  type ValidatedImportRequest,
  type ValidatedImportBatchRequest,
  type ValidatedMatchRequest,
  type ValidatedRequest,
  type ValidatedSearchRequest,
} from './bounds.ts';
import { assertSafeUrl, guardedFetch, UnsafeUrlError } from './net.ts';
import {
  extractImageUrl,
  extractTitle,
  hostLabel,
  PAGE_ACCEPT,
  PAGE_MAX_BYTES,
  PAGE_TIMEOUT_MS,
} from './page-meta.ts';
import {
  admitContent,
  admitSource,
  declineMessage,
  type Declined,
  type DeclineReason,
} from './policy.ts';
import { licensedFirst } from './catalog-wiring.ts';
import { searchFamilies } from './catalog-provider.ts';
import { recordDemand } from '../_shared/demand.ts';
import {
  type ImportRowResult,
  planCatalogueBatch,
  summariseBatch,
} from './import-batch.ts';
import { parseQuery } from '../_shared/catalog-query.ts';
import { openRouterWebProvider } from './provider.ts';

/**
 * garment-search — "describe it, don't photograph it".
 *
 * The category's biggest failure is an empty closet: people install a wardrobe
 * app, are asked to photograph forty garments, photograph three, and never come
 * back. This endpoint is the other door. A user types "Reformation midi dress,
 * size 2, navy", optionally attaches a quick photo of the actual colour, and
 * picks their garment out of a handful of product images found on the web.
 *
 * FIVE ACTIONS, ONE FUNCTION
 *
 *   search   costs a model call and a web search — quota'd, consent-gated.
 *   resolve  reads ONE page the user pasted and returns its og:image and
 *            og:title. No model, no web search — but it is the action that
 *            turns a user-supplied string into an outbound fetch, so it is
 *            quota'd too (see `resolveLink` for why, and at what cost).
 *   import   downloads the chosen image and creates the item — no model, no
 *            quota unit. Charging twice for one garment would be charging the
 *            user for changing their mind, and the expensive half already ran.
 *   match    the same search, entered from the other side: the garment is
 *            already photographed and in the closet, and the question is who
 *            made it and where it is sold. The item's own picture and tags are
 *            the query. Costs a model call and a web search — quota'd and
 *            gated exactly like `search`, on the same workload.
 *   attach   the confirm step for `match`: downloads the chosen listing image
 *            and records it ON the existing item rather than creating one.
 *            No model, no quota unit — the same rule `import` lives by.
 *
 * `search` and `resolve` are the two doors into the same room. One is for
 * somebody who knows what the garment is called; the other is for somebody who
 * is already looking at it in a shop's app and can share the link. They meet at
 * `import`, which creates the item. `match` and `attach` are the same pair for
 * a garment that already exists — the search and its confirmation — except the
 * confirmation decorates a row instead of creating one.
 *
 * THE DOWNLOAD HAPPENS HERE, NEVER ON THE CLIENT. Three reasons, in order of
 * how quickly they bite: a retailer's CDN does not send CORS headers, so the
 * fetch simply fails; the client would have to carry URL-vetting code that
 * belongs on a server; and an image the app displays should come from our own
 * Storage bucket rather than a third party who can swap it later.
 *
 * WHOSE PICTURE IT IS. Every path that ends in a stored byte passes through
 * `policy.ts` first: the host is checked against the handful of places where
 * "the seller published this to be shared" is not true, its `robots.txt` is
 * read and honoured, and the response's own `X-Robots-Tag` and meta directives
 * are read before anything is written. A refusal is never an empty result — it
 * comes back as `source_declined` with a bounded `reason`, or as a `declined[]`
 * entry beside the tiles that did survive, so the screen can name the shop that
 * said no. And every stored image now records where it came from:
 * `listing_source_url` and `listing_source_label` are written by BOTH `import`
 * and `attach`, never left null. The reasoning for all of it is in `policy.ts`
 * and in `docs/design/listing-imagery-posture.md`.
 *
 * The imported item lands at `pending_tag`, which is the same state a
 * photographed garment reaches after upload — so it flows into the existing
 * tagging sweep with no new pipeline. That is the point: this function adds a
 * front door, not a second house.
 */

const BUCKET = 'garments';

/** Signed URL lifetime for the item's own photograph — only needs to outlive
 *  the model call. Same figure tag-item uses, for the same reason. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The workload's own enum value, added by migration 20260806091000.
 *
 * The cast is deliberate and temporary: `ALTER TYPE … ADD VALUE` cannot be
 * *used* in the transaction that adds it, so the generated types (and any
 * `ai_config` row) follow the migration rather than travelling with it. Once
 * `npm run gen:types` runs against a migrated database the cast becomes a
 * no-op — remove it then.
 */
const WORKLOAD = 'garment_search' as Database['public']['Enums']['ai_workload'];

/**
 * Model used when `ai_config` has no row for this workload yet.
 *
 * Vision-capable on purpose — the optional colour swatch is an image part — and
 * the same model the tagging workload already vets for strict structured
 * outputs. An operator who wants a different one inserts an `ai_config` row and
 * this constant stops being read; no deploy involved, which is the whole reason
 * that table exists.
 */
const DEFAULT_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';
const DEFAULT_MAX_TOKENS = 1_024;
const DEFAULT_PARAMS: Record<string, unknown> = { temperature: 0.2 };

/** Enough tiles to choose from, few enough to scan. Whering-sized grid. */
const MAX_CANDIDATES = 6;

/**
 * The ceiling on what one garment costs us in somebody else's bytes.
 *
 * Lowered from ten megabytes, which was set as an abuse line and worked as one.
 * Five is the *policy* line, and it is a different argument: a listing
 * photograph is a hero shot on a commerce template and virtually always under a
 * megabyte, so anything past five is a lookbook spread, a print-resolution
 * master or a poster — none of which is what the user asked for, and all of
 * which are the kind of asset a retailer would be right to mind us keeping.
 * Capping what we store is one of the few things in this whole area we can
 * actually promise, so the number is set where the promise is easy to keep.
 *
 * Paired with a second cap that lives in the paths rather than a constant:
 * exactly ONE stored object per item per role, at a fixed filename, overwritten
 * on re-confirmation. Cinch never accumulates a retailer's catalogue.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;

/** Content types worth storing, and the extension each is saved under. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Does the payload actually start like the image it claims to be?
 *
 * `Content-Type` is chosen by whoever serves the file, so on its own it proves
 * nothing. A file stored as `original.jpg` and handed to the app through a
 * signed URL should be an image and not, say, a document — checking the first
 * bytes costs nothing and closes the gap between the label and the contents.
 */
function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return true;
  // WebP: "RIFF" ���� "WEBP"
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return riff && webp;
}

/** A stable code and a sentence a person can read. Never provider text. */
function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

/**
 * The one refusal that is not a failure.
 *
 * Every other error in this file means Cinch could not do something. This one
 * means a site said no and we listened, which is a different thing and has to
 * look different on the wire — hence its own code, and hence `reason` and
 * `source` travelling with it. The client needs both: the reason to pick a
 * sentence, and the host to name the shop in it.
 *
 * 403 rather than 400, because nothing about the request was malformed. The
 * user did everything right and the answer is still no.
 *
 * `reason` is a closed enum on purpose (`policy.ts`). A client that meets a
 * value it does not know can fall back to `message`, which is always present
 * and always says something true — the enum is the upgrade, not the contract.
 */
function failDeclined(reason: DeclineReason, source: string): Response {
  return Response.json(
    { error: 'source_declined', reason, source, message: declineMessage(reason) },
    { status: 403 },
  );
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      /**
       * OPTIONAL, AND THAT IS THE CHANGE.
       *
       * This used to be a hard precondition: no `OPENROUTER_API_KEY` and every
       * action returned `not_configured`, including a pure licensed catalogue
       * search that never touches a model. That coupled the licensed path's
       * availability to a credential it does not use, and it meant the one path
       * we can honestly describe as "not AI" was the first to go down when the
       * AI credential did.
       *
       * It is still required for `match` (reading a brand off a photograph IS a
       * vision judgement) and for the unlicensed fallback. Each of those checks
       * for it where it is used.
       */
      const apiKey = Deno.env.get('OPENROUTER_API_KEY') ?? null;

      // Annotated rather than inferred. `let request;` is an "evolving any" to
      // the compiler, and an evolving binding does not narrow all the way down
      // to `never` — which silently disables the exhaustiveness check at the
      // bottom of the dispatch, the one thing it exists to do.
      let request: ValidatedRequest;
      try {
        request = parseGarmentSearchRequest(await readBoundedJson(req));
      } catch (err) {
        if (err instanceof BoundsError) {
          return fail('invalid_request', err.message, 400);
        }
        throw err;
      }

      // `withSupabase` returns an untyped client, so every query result widens
      // to `never` and column names stop being checked. Casting once here
      // restores that, exactly as tag-item does.
      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // Above the consent gate, and deliberately the only action that is.
      // Taking a listing photo off sends nothing anywhere and calls no model:
      // it clears four columns and deletes one of our own objects. An account
      // that has since switched AI processing OFF must still be able to undo
      // what it did while it was on — a consent withdrawal that stranded a
      // listing photo in place would make the promise reversible in name only.
      if (request.action === 'detach') {
        return await detachListing(db, admin, request);
      }

      /**
       * ── TYPED SEARCH IS NOT AI PROCESSING, AND IS THEREFORE NOT GATED ────
       *
       * Above the consent gate, deliberately, and this is a correction rather
       * than a loosening.
       *
       * The gate below exists for App Store Guideline 5.1.2(i): the user must
       * agree before their content is sent to a model. A licensed catalogue
       * search sends the typed words to Datafeedr as a QUERY. No model is
       * invoked, no photograph leaves the device, and nothing about the request
       * is a model call — which is exactly what the app already prints, three
       * times, in `CATALOGUE_DISCLOSURE`, in the sheet, and in
       * `web/privacy.html`: "It is not a web search and it is not sent to an AI
       * model."
       *
       * Gating it anyway made the app contradict its own disclosure: it told
       * the reader nothing was sent to a model and then refused to search until
       * they consented to a model. The accepted design settles it — "AI-
       * processing consent [does not gate] typed search. Typed search must work
       * with that consent off; the spoken path remains governed by the existing
       * voice policy and its recording disclosure."
       *
       * WHAT STAYS GATED, AND WHY THE LIST IS NOT ARBITRARY. `match` sends the
       * user's own photograph to a vision model. `import` and `attach`
       * download and store a third party's image. `resolve` turns a typed
       * string into an outbound fetch from our network. Every one of those is
       * something the consent is actually about. Search is not.
       *
       * THE QUOTA STAYS. Consent and allowance answer different questions —
       * "may we" and "how often" — and removing the first does not remove the
       * second. `enforceAiQuota` is claimed inside `searchGarments` exactly as
       * before.
       */
      if (request.action === 'search') {
        return await searchGarments(admin, userId, apiKey, request);
      }

      // ── AI processing consent (App Store Guideline 5.1.2(i)) ──────────────
      // Server-side, like every sibling: a client-side gate is trivially
      // bypassed and the rule is about what actually leaves the device. Every
      // action is gated, not just the searches — `import` and `attach` exist
      // only to complete one, and `match` sends the user's own photograph to a
      // model, which is precisely what the consent is about.
      const { data: profile } = await db
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      const { data: requiredVersion } = await admin.rpc('current_ai_consent_version');

      if (!profile?.ai_consent_version || profile.ai_consent_version < (requiredVersion ?? 1)) {
        return Response.json(
          { error: 'ai_consent_required', requiredVersion: requiredVersion ?? 1 },
          { status: 403 },
        );
      }

      if (request.action === 'import') {
        return await importImage(db, admin, userId, request);
      }

      /**
       * The batch, and the one precondition that is not shared with `import`.
       *
       * A batch is by definition an import of CATALOGUE rows — the user picked
       * them off a family screen — so with no catalogue configured there is
       * nothing that could have selected them, and accepting the request would
       * be storing arbitrary caller-supplied images under a name that claims
       * they came from a licensed feed. The single `import` keeps its older,
       * looser contract because the link door legitimately reaches it with a
       * page the user pasted themselves.
       */
      if (request.action === 'import-batch') {
        if (!licensedFirst(db, null).catalogue) {
          return fail(
            'catalogue_unavailable',
            "Cinch can't reach the shop catalogue right now. Photographing the piece still works.",
            503,
          );
        }
        return await importCatalogueBatch(db, admin, userId, request);
      }

      if (request.action === 'resolve') {
        return await resolveLink(admin, userId, request.pageUrl);
      }

      if (request.action === 'attach') {
        return await attachListing(db, admin, userId, request);
      }

      if (request.action === 'match') {
        return await matchListing(db, admin, userId, apiKey, request);
      }

      // Every action in the union is handled above. `request` is `never` here,
      // so a seventh action added to `bounds.ts` without a branch fails the
      // compile at this line rather than silently 400-ing in production.
      const unreachable: never = request;
      return fail('invalid_request', `Unsupported action: ${String(unreachable)}`, 400);
    },
  ),
};

/**
 * Describe a garment; get back the licensed catalogue's answer.
 *
 * Lifted out of the handler when it moved above the consent gate. Nothing about
 * the order of operations changed with it: kill switch, then allowance, then
 * the provider, then accounting whatever happened.
 *
 * TWO SHAPES IN ONE RESPONSE, ON PURPOSE.
 *
 * `families` is the new contract — CPV2-04's grouped, ranked answer. It is only
 * ever populated by the licensed catalogue, because grouping requires a brand
 * column, a colour field and the knowledge that two listings are one garment,
 * none of which the web fallback has or could invent.
 *
 * `candidates` is the old one, and it stays for a release. A binary already in
 * somebody's hand reads `candidates` and nothing else; shipping the function
 * ahead of the client is only safe if the old field keeps working, and
 * `bounds.ts` already documents that precedent for `pageUrl`. Nothing in this
 * packet reads `families` yet — the client work is Packet 2.
 */
async function searchGarments(
  admin: SupabaseClient<Database>,
  userId: string,
  apiKey: string | null,
  request: ValidatedSearchRequest,
): Promise<Response> {
  // ── Model config, read at call time so a model swap is a DB update ────
  const { data: config } = await admin
    .from('ai_config')
    .select('model_id, params, max_tokens, enabled, provider')
    .eq('workload', WORKLOAD)
    .maybeSingle();

  // `maybeSingle` and a fallback rather than a hard requirement: the row
  // cannot be seeded by the same migration that creates the enum value, so
  // "no row" is the normal state on the day this ships and must mean
  // "defaults", not "broken". An explicit `enabled = false` is still a
  // kill switch.
  if (config && !config.enabled) {
    return fail('search_disabled', 'Search is turned off right now.', 503);
  }

  // Licensed feeds first; the web model path only answers what they could not,
  // and not at all when GARMENT_SEARCH_ALLOW_UNLICENSED is "false". The
  // ordering is a legal statement rather than a performance one — see
  // `catalog.ts`. The web provider is built only when its credential exists, so
  // a missing `OPENROUTER_API_KEY` costs the fallback and not the search.
  const wiring = licensedFirst(
    admin,
    apiKey
      ? openRouterWebProvider({
          apiKey,
          model: config?.model_id ?? DEFAULT_MODEL,
          maxTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
          params: (config?.params ?? DEFAULT_PARAMS) as Record<string, unknown>,
        })
      : null,
  );

  /**
   * Nothing can answer. Said out loud, BEFORE the allowance is spent.
   *
   * This is the fail-closed branch, and the distinct code is the whole point:
   * an empty `candidates` list means "the catalogue was asked and had nothing",
   * which is a true sentence the client prints. Returning that when the
   * catalogue was never configured would be a lie the reader cannot detect, and
   * it is exactly what the old missing-secret fallback produced once the
   * unlicensed path was turned off.
   */
  if (!wiring.canSearch) {
    return fail(
      'catalogue_unavailable',
      "Cinch can't reach the shop catalogue right now. Photographing the piece still works.",
      503,
    );
  }

  // ── Allowance, claimed after the kill switch, before the provider ─────
  // `claim_ai_quota` does not refund (a refund path is a free retry loop),
  // so a unit must not be spent on a request that was never going to reach
  // the provider. The two other AI functions order it the same way.
  const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
  if (quotaResponse) return quotaResponse;

  const provider = wiring.provider;

  let result: Awaited<ReturnType<typeof provider.search>> | null = null;
  let failure: string | null = null;

  try {
    result = await provider.search({
      description: request.description,
      swatchDataUrl: request.swatchDataUrl,
      maxCandidates: MAX_CANDIDATES,
    });
  } catch (err) {
    // `OpenRouterError` messages are already URL-redacted; they go to the
    // accounting table for whoever is debugging cost, and never to the
    // client, which gets a code and a sentence.
    failure = err instanceof Error ? err.message : String(err);
  }

  // ── Accounting. Written for failures too: a failed search still costs a
  //    web-search charge and sometimes tokens, and hiding that skews every
  //    later decision about whether this feature pays for itself. ────────
  await recordAiCall(admin, {
    user_id: userId,
    workload: WORKLOAD,
    provider: config?.provider ?? provider.id,
    model_id: config?.model_id ?? DEFAULT_MODEL,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    cost_usd: result?.costUsd ?? null,
    latency_ms: result?.latencyMs ?? null,
    succeeded: result !== null,
    error: failure,
  });

  if (!result) {
    return fail('search_failed', 'The search did not come back. Try again in a moment.', 502);
  }

  /**
   * The families, from the licensed catalogue only.
   *
   * A SECOND CALL, AND IT COSTS NOTHING EXTRA IN THE COMMON CASE. The tile
   * search above has already walked the ladder and written every row it fetched
   * into `catalog_lookups`; this asks the same question with the same brand and
   * the same duplicate rule, so it reads the cache it just filled. The one case
   * where it does spend is when the tile path answered from the web fallback,
   * and there the catalogue genuinely has not been asked yet.
   *
   * Failure here is not failure of the request. The tiles are already in hand
   * and an older client does not read this field at all, so a broken grouping
   * pass degrades to the previous contract rather than to an error screen.
   */
  let families: Awaited<ReturnType<typeof searchFamilies>>['families'] | null = null;
  /**
   * The opaque handle the later counters are addressed by.
   *
   * Returned to the client so a family open or an import — which happen on a
   * screen that no longer holds the words, and must never be made to hold them
   * again — can be counted against the intent they came from. It is a sha256
   * with no inverse and no user in it; the worst a client can do with it is
   * move a counter on a row its own search created today.
   */
  let intentKey: string | null = null;
  if (wiring.catalogue) {
    const parsedForFamilies = parseQuery(request.description);
    const familiesStartedAt = Date.now();
    try {
      const grouped = await searchFamilies(wiring.catalogue, parsedForFamilies);
      families = grouped.families;

      /**
       * What was asked for, as four canonical values and nothing else.
       *
       * This is the ONLY place demand is recorded, and it is placed here for a
       * reason: `parsedForFamilies` is the server's own parse, so the sentence
       * never has to travel any further than it already has. `recordDemand`
       * keeps a recognised brand, a garment class, an audience bucket and a
       * broad colour family — see `_shared/demand.ts` for why a GUESSED brand
       * is dropped rather than stored, which is the line the whole privacy
       * argument turns on.
       *
       * Awaited rather than fired and forgotten: an Edge Function invocation
       * can be torn down the moment it returns, and a floating promise here
       * would drop counters non-deterministically — which is worse than not
       * counting, because the numbers would look complete.
       */
      intentKey = await recordDemand(admin, parsedForFamilies, {
        searches: 1,
        zeroResult:
          families.exact.length === 0 && families.nearMiss.length === 0 ? 1 : 0,
        latencyMs: Date.now() - familiesStartedAt,
      });
    } catch (err) {
      console.error(
        `garment-search: family grouping failed, serving candidates only: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // `declined` rides alongside the tiles rather than replacing them. A
  // search that found four and refused two is a normal search; the client
  // shows four tiles and one line naming the shops that said no. An empty
  // `candidates` with a populated `declined` is the case this whole field
  // exists for — it is the difference between "nothing matched" and "the
  // shops that matched asked us not to".
  return Response.json({
    ok: true,
    candidates: result.candidates,
    declined: result.declined,
    // Null means "grouping was not available", which is not the same as an
    // empty family list and must not read as one.
    families,
    intentKey,
  });
}

/**
 * The sentence for a page we reached and could not read.
 *
 * It names the real cause — no picture we could find — and gives the way
 * forward that always works, because a great many retailers render their
 * product pages in JavaScript and there is no honest way to promise otherwise
 * from inside an Edge Function with an eight-second budget and no browser.
 */
const UNREADABLE_MESSAGE =
  "Cinch couldn't find the picture on that page — photograph the item instead.";

/**
 * Turn a pasted product link into a preview: one picture, one name, one shop.
 *
 * WHY THIS IS A SEPARATE ROUND TRIP AND NOT PART OF `import`. The user pasted a
 * URL, not a garment. Between the paste and the closet there has to be a moment
 * where they see what Cinch actually found and can say no — retailer links are
 * shared from apps, carry tracking parameters, and sometimes point at a
 * category page rather than the dress. Adding the wrong item silently and
 * asking them to go delete it is the version of this feature nobody comes back
 * to. So: resolve returns, the sheet shows, the person confirms, `import`
 * writes.
 *
 * WHY A QUOTA UNIT, WHEN THERE IS NO MODEL CALL HERE. This action is the one
 * place in the app where a string a user typed becomes an outbound HTTP request
 * from inside Supabase's network. `net.ts` bounds WHERE that request may go and
 * HOW BIG the answer may be; nothing bounded HOW MANY, and an authenticated
 * script looping this is a page-fetching proxy with our name on the user agent.
 * `garment_search` is the allowance that already exists, is already monthly, and
 * is already sized to the onboarding burst this feature serves — 20 on free.
 *
 * It is an over-charge and worth saying so plainly: a link resolve costs us
 * about nothing, where a described search costs ~$0.008 in web search. The
 * honest fix is a separate, much larger `link_import` counter, which needs a
 * migration deployed ahead of the function. Until then this errs toward the
 * bound that exists rather than shipping an unbounded fetch primitive.
 *
 * A failed resolve still spends the unit, exactly as a failed search does —
 * `claim_ai_quota` has no refund path on purpose (see `_shared/quota.ts`), since
 * a refund is a free retry loop for anyone willing to provoke failures.
 */
async function resolveLink(
  admin: SupabaseClient<Database>,
  userId: string,
  pageUrl: string,
): Promise<Response> {
  const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
  if (quotaResponse) return quotaResponse;

  const started = Date.now();

  /** One accounting row per unit spent, so quota and `ai_calls` reconcile. */
  const record = async (succeeded: boolean, error: string | null) => {
    await admin.from('ai_calls').insert({
      user_id: userId,
      workload: WORKLOAD,
      // Not a model and not pretending to be one. This row exists so "how many
      // garment_search units went to links" is answerable in SQL.
      provider: 'link-import',
      model_id: 'none',
      cost_usd: 0,
      latency_ms: Date.now() - started,
      succeeded,
      error,
    });
  };

  // ── The site's own answer, asked before the request it governs ────────────
  // A `robots.txt` read after the page it forbids is a receipt, not a rule, so
  // this runs first — before the fetch, and before the quota unit is spent on
  // a page we were never going to keep. The unit above has already been
  // claimed; that is deliberate and unchanged, because the alternative is a
  // free probe of arbitrary hosts through our network.
  let target: URL;
  try {
    target = assertSafeUrl(pageUrl);
  } catch {
    await record(false, 'unsafe: pre-check');
    return fail(
      'link_rejected',
      "Cinch can't open that link. Paste the product page from the shop's own site.",
      400,
    );
  }

  const sourceVerdict = await admitSource(target);
  if (sourceVerdict) {
    await record(false, `declined: ${sourceVerdict}`);
    return failDeclined(sourceVerdict, hostLabel(target));
  }

  let page;
  try {
    page = await guardedFetch(pageUrl, {
      accept: PAGE_ACCEPT,
      maxBytes: PAGE_MAX_BYTES,
      timeoutMs: PAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      await record(false, `unsafe: ${err.message}`);
      // Deliberately one message for every reason the guard refuses — "not
      // https", "private address", "too many redirects", "too large". Which
      // one it was is only useful to somebody probing the guard.
      return fail(
        'link_rejected',
        "Cinch can't open that link. Paste the product page from the shop's own site.",
        400,
      );
    }
    await record(false, 'unreachable');
    return fail(
      'link_unreachable',
      "That page didn't answer. Check the link, or photograph the item instead.",
      502,
    );
  }

  if (page.status !== 200) {
    await record(false, `status ${page.status}`);
    return fail(
      'link_unreachable',
      "That page didn't answer. Check the link, or photograph the item instead.",
      502,
    );
  }

  const contentType = page.contentType.split(';')[0].trim();

  // Someone who long-pressed a product photograph and copied the image address
  // has already done the extraction by hand. Handing that straight to the
  // preview is a better answer than telling them their link isn't a page.
  if (contentType.startsWith('image/')) {
    // No HTML to read, so the header is the only directive there is — and for
    // an image served straight off a CDN it is usually the only one anywhere.
    const contentVerdict = admitContent(page.headers);
    if (contentVerdict) {
      await record(false, `declined: ${contentVerdict}`);
      return failDeclined(contentVerdict, hostLabel(page.url));
    }
    await record(true, null);
    return Response.json({
      ok: true,
      imageUrl: page.url.toString(),
      title: null,
      source: hostLabel(page.url),
    });
  }

  if (!contentType.includes('html')) {
    await record(false, `content-type ${contentType || 'unknown'}`);
    return fail(
      'link_not_a_page',
      "That link isn't a product page. Open the item on the shop's site and copy that link.",
      415,
    );
  }

  // `fatal: false` because a retailer serving a mislabelled encoding should cost
  // us a few replacement characters in a title, never the whole import.
  const html = new TextDecoder('utf-8', { fatal: false }).decode(page.body);

  // The page's own directives. They could not be asked for before the fetch —
  // a header arrives with the response — so this is the gate on KEEPING what
  // came back, which is the half that produces a stored object.
  const contentVerdict = admitContent(page.headers, html);
  if (contentVerdict) {
    await record(false, `declined: ${contentVerdict}`);
    return failDeclined(contentVerdict, hostLabel(page.url));
  }

  const imageUrl = extractImageUrl(html, page.url);
  if (!imageUrl) {
    await record(false, 'no image on page');
    return fail('link_no_image', UNREADABLE_MESSAGE, 422);
  }

  // Vetted now so a preview that could never be imported is never shown. The
  // import re-checks, because that is the call that downloads bytes.
  let image: URL;
  try {
    image = assertSafeUrl(imageUrl);
  } catch {
    await record(false, 'image url unsafe');
    return fail('link_no_image', UNREADABLE_MESSAGE, 422);
  }

  // A product page that allows us and a CDN that does not is an ordinary
  // arrangement, not an edge case — the image often lives on a host the
  // retailer shares with a thousand other shops, under its own rules.
  const imageVerdict = await admitSource(image);
  if (imageVerdict) {
    await record(false, `declined: ${imageVerdict}`);
    return failDeclined(imageVerdict, hostLabel(image));
  }

  await record(true, null);

  return Response.json({
    ok: true,
    imageUrl,
    // May be null. The client offers its own field rather than inventing a name.
    title: extractTitle(html, page.url),
    source: hostLabel(page.url),
    // The page the preview came from, echoed back so `import` can record it as
    // the item's provenance. Without this the link door produces a garment
    // whose picture came from a shop and whose row cannot say which — the one
    // outcome this whole feature has no answer for.
    pageUrl: page.url.toString(),
  });
}

/**
 * Download the chosen product image and turn it into a closet item.
 *
 * The single write path, reached from both doors: a tapped candidate tile and a
 * confirmed link preview arrive here with the same three facts.
 *
 * ORDER MATTERS. The download runs BEFORE the row is created, so a blocked CDN
 * or an oversized file leaves nothing behind. The row is created second, which
 * is also where the closet-size trigger gets its say, and the object is written
 * third under the `{user_id}/{item_id}/` prefix the bucket policy authorizes on.
 * A failure after the row exists deletes it — an item with no image is a tile
 * the closet cannot render and a slot the user's plan is charged for.
 *
 * PROVENANCE IS WRITTEN HERE, AND IT WAS NOT BEFORE. Until this change the
 * import path stored a retailer's photograph as a garment's own picture and
 * recorded nothing about where it came from: `listing_source_url` and
 * `listing_source_label` existed in the schema (migration 20260808150000) and
 * were populated only by `attach`. An item whose image came from a shop and
 * whose row cannot name the shop is the single indefensible outcome in this
 * whole feature — there is no answer to "where did you get that" that begins
 * with "we did not write it down". So both columns are now written on every
 * import, and neither can be null:
 *
 *   `pageUrl` given   the product page, which is the honest answer and the
 *                     user's way back to buy the thing.
 *   `pageUrl` absent  the image URL actually fetched, after redirects. Weaker
 *                     — a CDN host is not a shopfront — but it is true, it is
 *                     a URL a human can follow, and it is never nothing.
 *
 * The label is derived from the URL server-side and the client's own `source`
 * string is ignored. Attribution that the client can set is attribution that
 * can be wrong, and a wrong source line is worse than a coarse one.
 *
 * `listing_path` and `listing_confirmed_at` stay NULL, which is the deliberate
 * difference between the two flows. On an imported item the retailer's picture
 * IS the garment's picture — there is nothing underneath it to restore — so
 * there is no listing object to detach, and claiming one would give `detach` a
 * path to delete the item's only image.
 */
/**
 * A failure that has not yet decided whether it is an HTTP response or a row in
 * a batch result.
 *
 * The single import turns one of these into a `Response`; the batch turns it
 * into one entry in a list and carries on with the next colourway. Same causes,
 * same codes, two presentations — which is only possible because the deciding
 * happens after the failure rather than inside it.
 */
type ListingFailure = {
  code: string;
  message: string;
  status: number;
  /** Present only when a site said no, which is not the same as a failure. */
  declined?: { reason: DeclineReason; source: string };
};

type FetchedListing = {
  body: Uint8Array;
  contentType: string;
  extension: string;
  /** Where the provenance line points. The page when we have one, else the
   *  image URL the bytes actually came from, after redirects. */
  sourceUrl: URL;
};

function failureResponse(failure: ListingFailure): Response {
  if (failure.declined) return failDeclined(failure.declined.reason, failure.declined.source);
  return fail(failure.code, failure.message, failure.status);
}

/**
 * Vet a listing image and bring back its bytes. No database, no storage.
 *
 * Extracted from `importImage` unchanged when the batch needed the same work
 * per colourway. Splitting it is what keeps the two paths honest about each
 * other: there is no version of this that skips `admitSource` because it was
 * "already checked during the search", and a batch of six cannot quietly become
 * six unvetted downloads.
 */
async function fetchListingImage(
  imageUrl: string,
  pageUrl?: string,
): Promise<{ ok: true; image: FetchedListing } | { ok: false; failure: ListingFailure }> {
  const no = (code: string, message: string, status: number): { ok: false; failure: ListingFailure } => ({
    ok: false,
    failure: { code, message, status },
  });
  const declined = (reason: DeclineReason, source: string): { ok: false; failure: ListingFailure } => ({
    ok: false,
    failure: { code: 'source_declined', message: declineMessage(reason), status: 403, declined: { reason, source } },
  });

  // ── Policy, before the bytes ──────────────────────────────────────────────
  // The tile the user tapped was already admitted once, during the search. It
  // is checked again because that check happened against a page and this one
  // downloads from an image host, because the search's verdict may be minutes
  // old, and because `import` is reachable with any URL a caller cares to send.
  let image: URL;
  try {
    image = assertSafeUrl(imageUrl);
  } catch {
    return no('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  const imageVerdict = await admitSource(image);
  if (imageVerdict) return declined(imageVerdict, hostLabel(image));

  // The page, when the client sent one. Vetted the same way and for the same
  // reason `attach` vets it: a URL we will store and render as a tappable link
  // deserves the treatment of one we would fetch.
  let page: URL | null = null;
  if (pageUrl) {
    try {
      page = assertSafeUrl(pageUrl);
    } catch {
      return no(
        'link_rejected',
        "Cinch can't open that link. Paste the product page from the shop's own site.",
        400,
      );
    }
    const pageVerdict = await admitSource(page);
    if (pageVerdict) return declined(pageVerdict, hostLabel(page));
  }

  let downloaded;
  try {
    downloaded = await guardedFetch(imageUrl, {
      accept: 'image/*',
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return no('image_rejected', "That picture couldn't be saved. Try another one.", 400);
    }
    return no('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  if (downloaded.status !== 200) {
    return no('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  // The response's own directive, which for an image host is usually the only
  // statement it makes. Checked before anything is written, never after.
  const contentVerdict = admitContent(downloaded.headers);
  if (contentVerdict) return declined(contentVerdict, hostLabel(downloaded.url));

  // `image/jpeg; charset=binary` is a real header in the wild.
  const contentType = downloaded.contentType.split(';')[0].trim();
  const extension = IMAGE_EXTENSIONS[contentType];
  if (!extension || !looksLikeImage(downloaded.body)) {
    return no('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  return {
    ok: true,
    image: {
      body: downloaded.body,
      contentType,
      extension,
      // `downloaded.url` rather than the string the caller sent, so a redirect
      // chain is recorded where it ended — which is where the bytes came from.
      sourceUrl: page ?? downloaded.url,
    },
  };
}

/**
 * Turn fetched bytes into a garment.
 *
 * ORDER MATTERS, and it is the same order the single import has always used:
 * the download runs before the row, so a blocked CDN leaves nothing behind; the
 * row is created second, which is where the closet-size trigger gets its say;
 * the object is written third under the `{user_id}/{item_id}/` prefix the
 * bucket policy authorizes on. A failure after the row exists deletes it — an
 * item with no image is a tile the closet cannot render and a slot the user's
 * plan is charged for.
 *
 * PROVENANCE IS WRITTEN WITH THE ROW, never after, so there is no window in
 * which an imported garment exists without its source. `listing_path` and
 * `listing_confirmed_at` stay NULL, which is the deliberate difference from
 * `attach`: on an imported item the retailer's picture IS the garment's
 * picture, so there is nothing underneath it to restore and no listing object
 * to detach.
 */
async function storeListingAsGarment(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  image: FetchedListing,
  extras: {
    title?: string | null;
    /** The merchant's own colour name for the colourway that was chosen. */
    colourLabel?: string | null;
    /** Datafeedr's row id. The idempotency key; null for the link door. */
    catalogExternalId?: string | null;
  },
): Promise<{ ok: true; itemId: string } | { ok: false; failure: ListingFailure }> {
  const fail_ = (code: string, message: string, status: number) =>
    ({ ok: false, failure: { code, message, status } }) as const;

  // ── The row. RLS scopes `db` to the caller, so `user_id` cannot be spoofed,
  //    and `items_enforce_limit` refuses the insert when the plan is full. ───
  // `description` carries the product name because there is no `items.name`
  // column to carry it — the app derives a garment's title from its colour and
  // subcategory (`features/closet/item-name.ts`), which are tags, and an
  // untagged import has neither yet. So the words the user confirmed are what
  // identifies the piece in the window before tagging lands, and they are what
  // survives if tagging never does: `tag-item` writes `description` only on
  // SUCCESS, so a `needs_review` garment keeps "Reformation Gemma Dress"
  // instead of showing up blank.
  //
  // Stated plainly because it is a real limit: a SUCCESSFUL tag overwrites this
  // with the model's own description. Making a user's typed name outlive that
  // needs either a column or a change in `tag-item`, both outside this file.
  //
  // The colourway the user picked rides along in the same string when they
  // picked one, because it is the only thing distinguishing three rows that are
  // otherwise the same shirt, and a closet showing "Crew Neck Jersey Tee" three
  // times is a closet nobody can use.
  const description = [extras.title ?? null, extras.colourLabel ?? null]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' — ')
    .slice(0, 200) || null;

  const { data: item, error: insertError } = await db
    .from('items')
    .insert({
      user_id: userId,
      status: 'pending_upload',
      description,
      listing_source_url: image.sourceUrl.toString(),
      listing_source_label: hostLabel(image.sourceUrl),
      catalog_external_id: extras.catalogExternalId ?? null,
      // NEVER 'measured'. The pixels are a studio shot of a DIFFERENT physical
      // garment than the one in this wardrobe, so telling the harmony scoring
      // it has ground truth would be handing it a stock photo's white balance.
      // Migration 20260813194202 adds the value; its header carries the whole
      // argument, including why 'spoken' would have been the wrong reuse.
      colour_source: 'catalogue',
      // Likewise never 'photo', which is what the column default would have
      // made this. Nobody photographed anything — not having to is the entire
      // point of the matcher — so leaving the default would count every import
      // as camera intake in the one cut that exists to tell the routes apart.
      // Not 'voice' (a typed query is explicitly not voice) and not 'manual'
      // (that is `useFileTypedWords`, where no catalogue was consulted).
      intake_method: 'catalogue',
    })
    .select('id')
    .single();

  if (insertError || !item) {
    // The triggers raise their own sentinels. Recognising them is what lets the
    // client offer an upgrade or a swap instead of an apology.
    if (insertError?.message?.includes('closet_limit_reached')) {
      return fail_('closet_limit_reached', 'Your closet is full on this plan.', 402);
    }
    if (insertError?.message?.includes('storage_limit_reached')) {
      return fail_('storage_limit_reached', 'Your closet and its archive are both full.', 402);
    }
    // The partial unique index on (user_id, catalog_external_id). Reached when
    // a retry races the write it is retrying; the caller turns it into
    // "already added", which is the truth and not an error.
    if (insertError?.code === '23505') {
      return fail_('already_imported', 'That piece is already in your closet.', 409);
    }
    return fail_('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  const path = `${userId}/${item.id}/original.${image.extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, image.body, { contentType: image.contentType, upsert: true });

  if (uploadError) {
    await db.from('items').delete().eq('id', item.id);
    return fail_('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  // `thumb_path` points at the same object rather than a resize. There is no
  // image pipeline in an Edge Function, and Supabase's own transformations are
  // Pro-only and bill per origin image — the reason the client generates
  // thumbnails on-device. A product photograph is already small; pointing at
  // the original is honest, where a null would leave the grid with a hole.
  const { error: updateError } = await db
    .from('items')
    .update({ image_path: path, thumb_path: path, status: 'pending_tag' })
    .eq('id', item.id);

  if (updateError) {
    await db.from('items').delete().eq('id', item.id);
    return fail_('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  return { ok: true, itemId: item.id };
}

/**
 * Download the chosen product image and turn it into a closet item.
 *
 * The single-colourway door, unchanged on the wire. Both halves of it now live
 * in functions the batch shares, which is the only difference — the request it
 * accepts, the response it returns and the order it does things in are exactly
 * what they were.
 *
 * Deliberately does NOT call tag-item: Supabase rate-limits Edge Functions
 * calling each other, and the client's own sweep already drives `pending_tag`
 * rows through tagging. Same pipeline as a photographed garment, from here on.
 */
async function importImage(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  request: ValidatedImportRequest,
): Promise<Response> {
  const fetched = await fetchListingImage(request.imageUrl, request.pageUrl);
  if (!fetched.ok) return failureResponse(fetched.failure);

  const stored = await storeListingAsGarment(db, admin, userId, fetched.image, {
    title: request.title ?? null,
    catalogExternalId: null,
  });
  if (!stored.ok) return failureResponse(stored.failure);

  return Response.json({
    ok: true,
    itemId: stored.itemId,
    status: 'pending_tag',
    // Echoed so the confirmation screen can show the line the row now carries,
    // rather than the client having to re-derive it from a URL it may not have.
    source: hostLabel(fetched.image.sourceUrl),
    sourceUrl: fetched.image.sourceUrl.toString(),
  });
}

/**
 * CPV2-06/07 — add every colourway the user selected.
 *
 * THREE PROPERTIES, IN THE ORDER THEY MATTER.
 *
 * 1 · CAPACITY IS ALL-OR-NOTHING, AND IT IS DECIDED BEFORE ANY BYTES MOVE.
 *     Three colourways into two free slots is refused as a batch. Writing two
 *     and apologising for the third would be the worst of both: the user asked
 *     one question and got half an answer, and the half they got is the half
 *     the app chose. `import_capacity()` answers with the same two counts the
 *     trigger enforces — a PREFLIGHT, never an authority, because between it
 *     and the third insert a garment can arrive from another device and the
 *     trigger is still the thing that decides.
 *
 * 2 · A RETRY CANNOT DUPLICATE. Every row carries Datafeedr's own id for the
 *     colourway, and the partial unique index on (user_id, catalog_external_id)
 *     makes the second write a constraint violation rather than a second shirt.
 *     The rows already held come back as `already-added` — which is a SUCCESS
 *     state and not an error, because from the user's side the piece is in the
 *     closet either way and that is what they asked for.
 *
 *     Checked up front AND caught at the insert. The up-front read makes the
 *     ordinary retry cheap; the caught violation makes the racing one correct.
 *
 * 3 · A FAILED ROW NEVER ROLLS BACK A SUCCESSFUL ONE. The handoff is explicit:
 *     "colourways succeed and fail independently and successes are never rolled
 *     back". So there is no transaction around the loop, and the response is a
 *     list rather than a verdict.
 *
 * LICENSED-ONLY, like everything else in this feature: with no catalogue
 * configured there is no batch, because a batch import is by definition an
 * import of catalogue rows and there would be nothing to have selected them
 * from.
 */
async function importCatalogueBatch(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  request: ValidatedImportBatchRequest,
): Promise<Response> {
  // ── Already held ─────────────────────────────────────────────────────────
  // Read before anything is planned, so the ordinary retry — the one where the
  // first attempt landed and only the response was lost — costs no downloads
  // at all. The unique index catches the racing case at the insert.
  const { data: existing, error: existingError } = await db
    .from('items')
    .select('id, catalog_external_id')
    .in('catalog_external_id', request.imports.map((r) => r.externalId));

  if (existingError) {
    return fail('import_failed', "Cinch couldn't check your closet. Try again.", 500);
  }

  const heldBy = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.catalog_external_id) heldBy.set(row.catalog_external_id, row.id);
  }

  // ── Capacity, before any bytes move ──────────────────────────────────────
  // A failed read does NOT refuse the batch: `import_capacity` is a preflight
  // and `items_enforce_limit` is the authority, so a monitoring blip must not
  // become a closed door.
  const { data: capacityRows, error: capacityError } = await db.rpc('import_capacity');
  const room = capacityError
    ? null
    : ((Array.isArray(capacityRows) ? capacityRows[0] : capacityRows) ?? null);

  const plan = planCatalogueBatch(request.imports, heldBy, room);

  if (plan.refusal) {
    // The numbers travel with the code so the screen can say "room for one of
    // the three" rather than a bare refusal. CPV2-11 draws that state.
    return Response.json(plan.refusal, { status: 402 });
  }

  // ── One colourway at a time ──────────────────────────────────────────────
  // Sequential rather than concurrent, deliberately: the trigger's count is
  // read per insert, and six parallel writes against the last free slot is a
  // race whose loser is a garment the user watched succeed.
  const results: ImportRowResult[] = plan.alreadyHeld.map(({ externalId, itemId }) => ({
    externalId,
    status: 'already-added' as const,
    itemId,
  }));

  for (const row of plan.pending) {
    const fetched = await fetchListingImage(row.imageUrl, row.pageUrl);
    if (!fetched.ok) {
      results.push({
        externalId: row.externalId,
        status: 'failed',
        error: fetched.failure.code,
        message: fetched.failure.message,
      });
      continue;
    }

    const stored = await storeListingAsGarment(db, admin, userId, fetched.image, {
      title: row.title ?? null,
      colourLabel: row.colourLabel ?? null,
      catalogExternalId: row.externalId,
    });

    if (!stored.ok) {
      // The race: another request added this colourway between the read above
      // and this insert. The user's intent is satisfied either way, so it is
      // reported as held rather than as a failure they can do anything about.
      if (stored.failure.code === 'already_imported') {
        results.push({ externalId: row.externalId, status: 'already-added' });
        continue;
      }
      results.push({
        externalId: row.externalId,
        status: 'failed',
        error: stored.failure.code,
        message: stored.failure.message,
      });
      continue;
    }

    results.push({ externalId: row.externalId, status: 'added', itemId: stored.itemId });
  }

  const summary = summariseBatch(results);

  /**
   * Conversion, counted against the intent that produced it.
   *
   * ATTEMPTS is the number of colourways this request tried to write, and
   * SUCCESSES counts `already-added` alongside `added`: from the user's side
   * both mean "it is in my closet now", and treating an idempotent retry as a
   * failure would make the conversion rate a measure of network quality.
   *
   * Best effort, and last: nothing above this line depends on it, and a
   * counter that cannot be moved must not cost somebody the import they just
   * watched succeed.
   */
  if (request.intentKey) {
    const { error: demandError } = await admin.rpc('record_catalogue_demand_by_key', {
      p_intent_key: request.intentKey,
      p_import_attempts: request.imports.length,
      p_import_successes: summary.added + summary.alreadyAdded,
    });
    if (demandError) {
      console.error(`record_catalogue_demand_by_key rejected: ${demandError.message}`);
    }
  }

  // 200 even when rows failed. The request itself succeeded — it asked six
  // questions and answered all six — and a 500 here would tell a client that
  // nothing landed when four things did.
  return Response.json({ ok: true, results, ...summary });
}

/** The columns `match` reads. A pick so a renamed column fails the compile
 *  here, at the one place that depends on it. */
type MatchableItem = Pick<
  Database['public']['Tables']['items']['Row'],
  'category' | 'subcategory' | 'colors' | 'brand' | 'ai_tags' | 'description'
>;

/**
 * One line of what the closet already knows about a garment.
 *
 * The tags were written by `tag-item` and the columns are its output, so the
 * shapes here mirror what that function stores: `colors` is `[{ name }]`, and
 * `ai_tags` is the whole `TagResult` object, read defensively because a row
 * that predates a schema change is still a row somebody wants matched. The
 * photograph is the ground truth; this line only tells the model which words
 * to search with.
 */
function describeItem(item: MatchableItem): string {
  const tags =
    typeof item.ai_tags === 'object' && item.ai_tags !== null && !Array.isArray(item.ai_tags)
      ? (item.ai_tags as Record<string, unknown>)
      : {};

  const colorNames = (Array.isArray(item.colors) ? item.colors : [])
    .map((entry) =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry) &&
        typeof (entry as { name?: unknown }).name === 'string'
        ? (entry as { name: string }).name
        : null,
    )
    .filter((name): name is string => name !== null);

  const pattern = typeof tags.pattern === 'string' ? tags.pattern : null;
  const material = typeof tags.material === 'string' ? tags.material : null;

  const line = [
    item.brand,
    colorNames.slice(0, 3).join(' and '),
    material,
    // "solid" is the absence of a pattern; searching for it finds nothing.
    pattern && pattern !== 'solid' ? pattern : null,
    item.subcategory ?? item.category,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  // The model's own sentence about the garment beats a user-typed title here,
  // because it was written from the same photograph the model is about to see.
  const description =
    typeof tags.description === 'string' && tags.description ? tags.description : item.description;

  const full = description ? `${line}. ${description}` : line;
  // A belt against a description column edited by hand: the descriptor is
  // prompt text billed by the token, and 500 characters says everything a
  // search query can use.
  return full.slice(0, 500);
}

/**
 * Find listings for a garment the user already photographed.
 *
 * `search` starts from words because no photograph exists yet; this starts from
 * the photograph because one does. The item's picture — the cutout when the
 * background has been removed, since a clean silhouette is the best evidence,
 * else the thumb, else the original — is signed for just long enough to show
 * the model, and the tags become the search terms.
 *
 * The optional `brand` narrows the hunt to one maker's listings. Its ABSENCE is
 * the near-identical fallback, not a degraded mode: the model proposes up to
 * five brands from the photograph and returns lookalike listings unscoped, and
 * the client can re-run with one of those brands if the user confirms a guess.
 * One action, one quota unit either way.
 *
 * Loaded through the RLS-scoped client, so another user's item id is
 * indistinguishable from a missing one — a 404 either way, which is the honest
 * answer and leaks nothing.
 */
async function matchListing(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  apiKey: string | null,
  request: ValidatedMatchRequest,
): Promise<Response> {
  const { data: item } = await db
    .from('items')
    .select('id, category, subcategory, colors, brand, ai_tags, description, cutout_path, thumb_path, image_path')
    .eq('id', request.itemId)
    .maybeSingle();

  if (!item) {
    return fail('item_not_found', "That garment isn't in your closet.", 404);
  }

  const imagePath = item.cutout_path ?? item.thumb_path ?? item.image_path;
  if (!imagePath) {
    return fail('item_no_image', "That garment doesn't have a photo yet.", 409);
  }

  // ── Model config, read at call time so a model swap is a DB update ────────
  // Same workload as `search`: matching is searching, entered from a
  // photograph, and splitting the counter would let one door drain what the
  // other advertises.
  const { data: config } = await admin
    .from('ai_config')
    .select('model_id, params, max_tokens, enabled, provider')
    .eq('workload', WORKLOAD)
    .maybeSingle();

  if (config && !config.enabled) {
    return fail('search_disabled', 'Search is turned off right now.', 503);
  }

  // Composed before the quota claim, for the same reason the signed URL is:
  // `claim_ai_quota` does not refund, so a request nothing could have answered
  // must not cost the user a unit on its way to failing.
  const wiring = licensedFirst(
    admin,
    apiKey
      ? openRouterWebProvider({
          apiKey,
          model: config?.model_id ?? DEFAULT_MODEL,
          maxTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
          params: (config?.params ?? DEFAULT_PARAMS) as Record<string, unknown>,
        })
      : null,
  );

  // Nothing configured can answer this one, and it gets its own code: `match`
  // reads a brand off a photograph, which a product feed cannot do at all, so
  // an empty result without this branch would read as "no listings for your
  // garment" when the truth is that nobody looked.
  if (!wiring.canMatch) {
    return fail('match_unavailable', "Cinch can't look this one up right now. Try again later.", 503);
  }

  const provider = wiring.provider;

  // The signed URL comes before the quota claim on purpose: `claim_ai_quota`
  // does not refund, and an unreadable image would otherwise burn a unit on a
  // request that was never going to reach the model. tag-item orders these the
  // same way, for the same reason.
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return fail('item_image_unreadable', "That garment's photo couldn't be read.", 500);
  }

  const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
  if (quotaResponse) return quotaResponse;

  // Same composition as the `search` path, from the same function so the two
  // cannot drift apart and leave one of them on the unlicensed source. Built
  // above, before the allowance was claimed.
  let result: Awaited<ReturnType<typeof provider.match>> | null = null;
  let failure: string | null = null;

  try {
    result = await provider.match({
      descriptor: describeItem(item),
      photoUrl: signed.signedUrl,
      brand: request.brand,
      maxCandidates: MAX_CANDIDATES,
    });
  } catch (err) {
    // `OpenRouterError` messages are already URL-redacted; they go to the
    // accounting table for whoever is debugging cost, and never to the
    // client, which gets a code and a sentence.
    failure = err instanceof Error ? err.message : String(err);
  }

  // ── Accounting. Written for failures too, exactly as the search records
  //    its own — a failed match still costs a web-search charge. ────────────
  await recordAiCall(admin, {
    user_id: userId,
    workload: WORKLOAD,
    provider: config?.provider ?? provider.id,
    model_id: config?.model_id ?? DEFAULT_MODEL,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    cost_usd: result?.costUsd ?? null,
    latency_ms: result?.latencyMs ?? null,
    succeeded: result !== null,
    error: failure,
  });

  if (!result) {
    return fail('match_failed', 'The search did not come back. Try again in a moment.', 502);
  }

  /**
   * Widening, declared rather than silent.
   *
   * When the user named a brand and that brand has nothing that lines up, the
   * useful answer is not an empty page — it is the wider web's resemblances,
   * SAID to be resemblances. The atlas states the rule in so many words: "If
   * <brand> has nothing that lines up, Cinch says so rather than widening
   * quietly." So the second pass runs, and `lookalike` travels with it so the
   * client cannot present these as the user's garment; `scopedBrand` names the
   * brand that came up empty, because the sentence on that screen has to.
   *
   * No second quota claim. The user asked once, and `claim_ai_quota` does not
   * refund — charging twice for one question would make the honest path cost
   * more than the quiet one. The provider call is still recorded in full, so
   * the accounting shows what it actually cost us.
   */
  let lookalike = false;
  const scopedBrand = request.brand ?? null;

  if (result.candidates.length === 0 && scopedBrand) {
    let wide: Awaited<ReturnType<typeof provider.match>> | null = null;
    let wideFailure: string | null = null;

    try {
      wide = await provider.match({
        descriptor: describeItem(item),
        photoUrl: signed.signedUrl,
        maxCandidates: MAX_CANDIDATES,
      });
    } catch (err) {
      wideFailure = err instanceof Error ? err.message : String(err);
    }

    await recordAiCall(admin, {
      user_id: userId,
      workload: WORKLOAD,
      provider: config?.provider ?? provider.id,
      model_id: config?.model_id ?? DEFAULT_MODEL,
      prompt_tokens: wide?.promptTokens ?? null,
      completion_tokens: wide?.completionTokens ?? null,
      cost_usd: wide?.costUsd ?? null,
      latency_ms: wide?.latencyMs ?? null,
      succeeded: wide !== null,
      error: wideFailure,
    });

    // A failed widening is not an error the user needs: the honest answer is
    // still "nothing at that brand", which is what an empty list already says.
    if (wide && wide.candidates.length > 0) {
      result = {
        ...wide,
        brands: result.brands.length ? result.brands : wide.brands,
        // Both passes' refusals, deduplicated by host. The narrow pass is
        // frequently where the interesting refusal happened — it is the one
        // that searched the brand the user named — so discarding its declines
        // because the wide pass produced tiles would hide the very shop they
        // asked about.
        declined: mergeDeclined(result.declined, wide.declined),
      };
      lookalike = true;
    }
  }

  return Response.json({
    ok: true,
    brands: result.brands,
    // Confidence stays server-side — it ordered the list, and that is its job.
    // `pageUrl` rides along because `attach` needs it back.
    candidates: result.candidates.map(({ title, imageUrl, pageUrl, source }) => ({
      title,
      imageUrl,
      pageUrl,
      source,
    })),
    lookalike,
    scopedBrand,
    declined: result.declined,
  });
}

/** Two passes' refusals as one list, one line per host, first mention wins. */
function mergeDeclined(first: Declined[], second: Declined[]): Declined[] {
  const seen = new Set<string>();
  const merged: Declined[] = [];
  for (const entry of [...first, ...second]) {
    if (seen.has(entry.source)) continue;
    seen.add(entry.source);
    merged.push(entry);
  }
  return merged;
}

/**
 * The confirm step for `match`: pin the chosen listing to the existing item.
 *
 * `import` creates a garment; this decorates one the user already owns, so
 * nothing here touches `status` or the tagging pipeline — the item keeps
 * whatever life it had, plus a listing photograph and a provenance line.
 *
 * NO QUOTA UNIT, for the same reason `import` charges none: the expensive half
 * (the match) already ran, and charging the confirmation would be charging the
 * user for making up their mind. The outbound fetch is not the unbounded
 * primitive `resolve` worries about, because it can only follow a `match` the
 * user already paid a unit for.
 *
 * The object lives under a `listing/` segment of the item's own prefix, at a
 * fixed filename, so re-confirming a different listing overwrites rather than
 * accumulates. The one wrinkle is the extension: a jpg replaced by a png lands
 * at a sibling path, so the previous object is removed best-effort — an
 * orphaned image in a private bucket is a few wasted kilobytes, never worth
 * failing a confirmation the user watched succeed.
 */
async function attachListing(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  request: ValidatedAttachRequest,
): Promise<Response> {
  // Ownership through RLS, before any bytes move: another user's item id reads
  // as missing, and a 404 up front beats discovering it after a download.
  const { data: item } = await db
    .from('items')
    .select('id, listing_path')
    .eq('id', request.itemId)
    .maybeSingle();

  if (!item) {
    return fail('item_not_found', "That garment isn't in your closet.", 404);
  }

  // The page URL is stored, not fetched — but a stored URL the app will render
  // as a tappable link deserves the same vetting as one we would fetch.
  let page: URL;
  try {
    page = assertSafeUrl(request.pageUrl);
  } catch {
    return fail(
      'link_rejected',
      "Cinch can't open that link. Paste the product page from the shop's own site.",
      400,
    );
  }

  // Re-asked at the moment of confirmation, not inherited from the match that
  // proposed it: the two are separate requests, minutes may have passed, and
  // this is the one that ends in a stored object.
  const pageVerdict = await admitSource(page);
  if (pageVerdict) return failDeclined(pageVerdict, hostLabel(page));

  let image: URL;
  try {
    image = assertSafeUrl(request.imageUrl);
  } catch {
    return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  const imageVerdict = await admitSource(image);
  if (imageVerdict) return failDeclined(imageVerdict, hostLabel(image));

  // Same limits as `import`, because it is the same job: `guardedFetch`
  // re-vets the image URL itself, every redirect included.
  let downloaded;
  try {
    downloaded = await guardedFetch(request.imageUrl, {
      accept: 'image/*',
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
    }
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  if (downloaded.status !== 200) {
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  const contentVerdict = admitContent(downloaded.headers);
  if (contentVerdict) return failDeclined(contentVerdict, hostLabel(downloaded.url));

  // `image/jpeg; charset=binary` is a real header in the wild.
  const contentType = downloaded.contentType.split(';')[0].trim();
  const extension = IMAGE_EXTENSIONS[contentType];
  if (!extension || !looksLikeImage(downloaded.body)) {
    return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  // Inside the `{user_id}/{item_id}/` prefix the bucket policy authorizes on,
  // one level down so a listing can never collide with the garment's own
  // photographs. `upsert` is what makes re-confirmation an overwrite.
  const path = `${userId}/${request.itemId}/listing/original.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, downloaded.body, { contentType, upsert: true });

  if (uploadError) {
    return fail('attach_failed', "That listing couldn't be saved. Try again.", 500);
  }

  const confirmedAt = new Date().toISOString();

  // The select-back is the guard: an RLS-refused update is a silent no-op, and
  // a confirmation that "succeeded" without writing anything is exactly the
  // kind of auth bug that hides for months. Zero rows back means fail loudly.
  const { data: updated, error: updateError } = await db
    .from('items')
    .update({
      listing_path: path,
      // The vetted, parsed form — normalized by the URL parser, not the raw
      // string off the wire.
      listing_source_url: page.toString(),
      listing_source_label: hostLabel(page),
      listing_confirmed_at: confirmedAt,
    })
    .eq('id', request.itemId)
    .select('id');

  if (updateError || !updated || updated.length !== 1) {
    // The row still points wherever it pointed before, so a freshly-written
    // object at a NEW path is litter — remove it. At the SAME path the old
    // bytes are already gone and the row is still consistent; nothing to undo.
    if (item.listing_path !== path) {
      await admin.storage.from(BUCKET).remove([path]);
    }
    return fail('attach_failed', "That listing couldn't be saved. Try again.", 500);
  }

  // Best-effort, after the row is safely updated: a previous listing at a
  // different extension is now unreachable and merely costs storage.
  if (item.listing_path && item.listing_path !== path) {
    await admin.storage.from(BUCKET).remove([item.listing_path]);
  }

  return Response.json({
    ok: true,
    itemId: request.itemId,
    listingPath: path,
    source: hostLabel(page),
    confirmedAt,
  });
}

/**
 * Undo for `attach` — the listing photo comes off, and the closet shows the
 * user's own photograph again.
 *
 * The whole flow is defensible only because this exists. Confirming a listing
 * is a promotion rather than a replacement, which is a claim about what the
 * user can take back: their photograph was never touched by `attach`, so
 * clearing four columns is genuinely all it takes to restore what they had.
 *
 * The caller names an item, never a path. The object removed is whatever the
 * row itself recorded, so no request can reach an object the row does not
 * already own — and the row is cleared BEFORE the bytes go, because a cleared
 * row with an orphaned object is a few wasted kilobytes while the reverse is a
 * closet pointing at an image that is gone.
 */
async function detachListing(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  request: ValidatedDetachRequest,
): Promise<Response> {
  const { data: item } = await db
    .from('items')
    .select('id, listing_path')
    .eq('id', request.itemId)
    .maybeSingle();

  if (!item) {
    return fail('item_not_found', "That garment isn't in your closet.", 404);
  }

  // Already bare. Not an error: two taps on a slow connection should read as
  // one, and the end state the caller asked for is the state it is in.
  if (!item.listing_path) {
    return Response.json({ ok: true, itemId: request.itemId });
  }

  const { data: updated, error: updateError } = await db
    .from('items')
    .update({
      listing_path: null,
      listing_source_url: null,
      listing_source_label: null,
      listing_confirmed_at: null,
    })
    .eq('id', request.itemId)
    .select('id');

  if (updateError || !updated || updated.length !== 1) {
    return fail('detach_failed', "That listing photo couldn't be removed. Try again.", 500);
  }

  await admin.storage.from(BUCKET).remove([item.listing_path]);

  return Response.json({ ok: true, itemId: request.itemId });
}

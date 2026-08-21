import { FunctionsHttpError } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { GarmentSearchError } from '@/features/ingest/use-garment-search';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/schemas/item';

/**
 * The listing-photo match — finding the shop's own product shot for a garment
 * the user photographed on a hanger.
 *
 * The client half of two new `garment-search` actions. `match` asks the
 * function to search the shops for this item and returns brand suggestions plus
 * candidate product images; `attach` records the one the user chose onto the
 * item's `listing_*` columns. Nothing here fetches third-party pages or images
 * directly, for the reason `use-garment-search.ts` gives: retailer CDNs send no
 * CORS headers, and vetting arbitrary URLs is server work regardless.
 *
 * THE PROMISE IS SMALL IN BOTH DIRECTIONS, same as the describe flow: match
 * offers pictures that might be the listing, each carrying the site it came
 * from, and nothing is written until a person confirms a specific one. Backing
 * out at any point leaves the item exactly as it was — their own photograph is
 * never touched, only ever accompanied.
 */

export type MatchCandidate = {
  title: string;
  /** A remote product image, display-safe through expo-image. */
  imageUrl: string;
  /** The product page the image came from. Sent back verbatim on attach. */
  pageUrl: string;
  /** A bare host, e.g. "arket.com". Shown under the tile. */
  source: string;
};

export type MatchResult = {
  /** Brand suggestions the function derived, for the refinement chips. */
  brands: string[];
  candidates: MatchCandidate[];
  /**
   * The brand-scoped search found nothing, and these candidates are wider-web
   * resemblances rather than that brand's own listings.
   *
   * It is a separate flag rather than an empty result because the two are
   * different things to say to somebody: an empty answer is "nothing close
   * enough", and this is "these are not your garment, and using one would put a
   * photograph of somebody else's coat in your closet". The screen has to be
   * able to tell them apart before it can be honest about either.
   */
  lookalike: boolean;
  /** The brand the search was scoped to, as the function understood it. */
  scopedBrand: string | null;
};

/**
 * The numbers behind a 429, as `_shared/quota.ts` sends them.
 *
 * Read rather than assumed: the allowance and its period are per-plan and are
 * decided server-side, so a screen that types "40 of 40" for everybody is
 * telling most users about a limit that is not theirs.
 */
export type QuotaDetail = {
  used: number | null;
  limit: number | null;
  /** 'day' | 'week' | 'month' in practice; kept open because the server owns it. */
  period: string | null;
  /** Seconds until the allowance comes back, which is how the reset date is derived. */
  retryAfterSeconds: number | null;
};

type ErrorBody = {
  error?: string;
  message?: string;
  period?: string;
  used?: number;
  limit?: number;
  retryAfterSeconds?: number;
};

/**
 * A refusal that still carries the server's own figures.
 *
 * `GarmentSearchError` is the class every caller in both features already
 * branches on and it stays the base, so nothing that catches one stops working.
 * The quota body is attached rather than formatted into the message because the
 * sentence differs by state — the failure frame names the numbers, the inline
 * notice does not — and a pre-baked string can only be one of them.
 */
export class MatchError extends GarmentSearchError {
  constructor(
    code: string,
    message: string,
    readonly quota: QuotaDetail | null,
  ) {
    super(code, message);
    this.name = 'MatchError';
  }
}

/**
 * Read the JSON body off a non-2xx invoke.
 *
 * A local copy of `use-garment-search.ts`'s reader rather than an import: that
 * one is private to its module on purpose, and the two lines it takes do not
 * earn widening the ingest feature's public surface. The error CLASS is shared
 * — a `GarmentSearchError` is what both features' callers already branch on.
 */
async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const response = (error as { context?: unknown }).context as Response | undefined;
    return response ? ((await response.json()) as ErrorBody) : null;
  } catch {
    return null;
  }
}

/**
 * Sentences in the app's voice, keyed by the function's stable codes.
 *
 * The shared codes carry the same copy `use-garment-search.ts` uses for them —
 * one allowance, one consent flag, one set of sentences about each. The
 * match-specific lines keep the same register: what happened, then what to do,
 * and never provider text, which can quote the request back.
 */
const MESSAGES: Record<string, string> = {
  ai_consent_required: 'Searching needs your OK on AI features — you can give it in Profile.',
  ai_quota_exceeded: "You’ve used this month’s searches.",
  quota_unavailable: "Cinch couldn’t check your allowance. Try again shortly.",
  plan_upgrade_required: 'Searching the shops is part of Standard and Pro.',
  search_disabled: 'Search is unavailable right now. Your photo stays.',
  search_failed: "The search didn’t come back. Try again in a moment.",
  match_failed: "The search didn’t come back. Try again in a moment.",
  image_rejected: "That picture couldn’t be saved. Try another one.",
  image_unreachable: "That picture couldn’t be reached. Try another one.",
  attach_failed: "That photo couldn’t be saved to this piece. Your own photo stays.",
};

const FALLBACK_MESSAGE = 'Something went wrong. Try again in a moment.';

/** Same invoke-and-map shape as the describe flow, against the same function. */
async function invokeOrThrow<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('garment-search', { body });

  if (error) {
    const parsed = await readErrorBody(error);
    const code = parsed?.error ?? 'match_failed';
    const quota: QuotaDetail | null =
      code === 'ai_quota_exceeded'
        ? {
            used: parsed?.used ?? null,
            limit: parsed?.limit ?? null,
            period: parsed?.period ?? null,
            retryAfterSeconds: parsed?.retryAfterSeconds ?? null,
          }
        : null;
    throw new MatchError(code, MESSAGES[code] ?? parsed?.message ?? FALLBACK_MESSAGE, quota);
  }
  if (!data) throw new MatchError('match_failed', MESSAGES.match_failed, null);

  return data;
}

/** The four listing columns, camel-cased for the one screen that reads them. */
export type ItemListing = {
  listingPath: string | null;
  listingSourceUrl: string | null;
  listingSourceLabel: string | null;
  listingConfirmedAt: string | null;
};

/**
 * The item's listing columns, read separately from the closet query.
 *
 * The same move `useItemBorrowable` makes and for the same reason: the app's
 * `Item` shape (schemas/item.ts) predates these columns, the closet query maps
 * through it, and one detail screen is the only reader — a four-column request
 * costs less than teaching every closet consumer about a field it never shows.
 */
export function useItemListing(itemId: string | null) {
  return useQuery({
    queryKey: ['item-listing', itemId],
    enabled: Boolean(itemId),
    queryFn: async (): Promise<ItemListing | null> => {
      if (!itemId) return null; // `enabled` already guards; this narrows the type
      const { data, error } = await supabase
        .from('items')
        .select('listing_path, listing_source_url, listing_source_label, listing_confirmed_at')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return {
        listingPath: data.listing_path,
        listingSourceUrl: data.listing_source_url,
        listingSourceLabel: data.listing_source_label,
        listingConfirmedAt: data.listing_confirmed_at,
      };
    },
  });
}

/**
 * The search for this item's listing.
 *
 * A mutation rather than a query, exactly as `useGarmentSearch` argues: it is
 * an action with a cost — a web search against a monthly allowance — and a
 * query would re-run it on every remount, the same money spent by accident.
 * `brand` scopes a re-search after the user picks or types a refinement.
 */
export function useMatchGarment() {
  return useMutation<MatchResult, Error, { itemId: string; brand?: string | null }>({
    mutationFn: async ({ itemId, brand }) => {
      const data = await invokeOrThrow<Partial<MatchResult>>({
        action: 'match',
        itemId,
        brand: brand ?? undefined,
      });
      return {
        brands: data.brands ?? [],
        candidates: data.candidates ?? [],
        // Defaulted to the safe half of each pair: an absent flag means these
        // are ordinary candidates, and an absent scope means nothing was
        // narrowed. A missing field must never be able to caption a real
        // listing "lookalike", or to name a brand the search never used.
        lookalike: data.lookalike ?? false,
        scopedBrand: data.scopedBrand ?? null,
      };
    },
    onSuccess: (result, variables) => {
      // Counts and flags only. The brand is user-adjacent content and stays on
      // the device, same rule as descriptions and links in the describe flow.
      // Under `garment_search_used` rather than a new event: `AppEvent` is a
      // closed union owned by lib/posthog.tsx, this flow rides the same Edge
      // Function, and the `stage` property is already how that event tells its
      // doors apart — a listing-specific stage keeps the funnel one funnel.
      track('garment_search_used', {
        stage: 'listing_matched',
        candidates: result.candidates.length,
        refined: Boolean(variables.brand),
      });
    },
  });
}

/**
 * Recording the chosen picture onto the item.
 *
 * The function downloads the image, writes the `listing_*` columns server-side
 * and enforces ownership there; the client's whole job afterwards is telling
 * the query layer. `['closet']` reaches the grid, this detail screen and the
 * stored list by prefix; `['item-listing', itemId]` is this feature's own read.
 * `['wardrobe']` is deliberately NOT here — the styling engine plans from
 * cutouts, and the listing columns are display furniture it never reads.
 */
export function useAttachListing() {
  const qc = useQueryClient();

  return useMutation<void, Error, { itemId: string; imageUrl: string; pageUrl: string }>({
    mutationFn: async ({ itemId, imageUrl, pageUrl }) => {
      await invokeOrThrow<{ success?: boolean }>({ action: 'attach', itemId, imageUrl, pageUrl });
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['closet'] });
      void qc.invalidateQueries({ queryKey: ['item-listing', variables.itemId] });
      // After the durable write, so a crash between attach and track loses the
      // event rather than fabricating one for a photo that never landed. Same
      // closed-union reasoning as the search stage above.
      track('garment_search_used', { stage: 'listing_attached' });
    },
  });
}

/**
 * The ordered image-path preference once a listing exists: the shop's shot
 * first, then the pipeline's cutout, then the thumbnail.
 *
 * Exposed for the display sites rather than wired into them here — the closet
 * query cannot carry `listingPath` until the `Item` shape learns the column, so
 * callers hand this whatever listing path they have read separately.
 */
export function listingFirst(
  item: Pick<Item, 'cutoutPath' | 'thumbPath'> & { listingPath?: string | null },
): string[] {
  return [item.listingPath ?? null, item.cutoutPath, item.thumbPath].filter(
    (path): path is string => path !== null && path !== undefined,
  );
}

/**
 * What the sheet is allowed to say about the garment, and the photograph the
 * user took of it.
 *
 * Every string here is derived from columns the item already carries. The
 * atlas's wait state (M-04) and its questions ("Is one of these your coat?")
 * are written in the app's own words about the piece precisely so that nothing
 * on screen is a guess dressed as a fact — which is also why `brandGuess` is
 * nullable and never falls back to anything. A brand the tagger did not
 * produce is a brand nobody may print.
 *
 * The closet cache is the source, the same `.find()` item detail makes, so
 * opening this sheet is a cache hit rather than a second read of a row the
 * caller already has on screen.
 */
export type MatchSubject = {
  /** The bare kind word — "shearling coat". Never "other", never empty. */
  noun: string;
  /** Its plural, for the lookalike sentence. */
  plural: string;
  /** Colour words and kind: "Cognac, cream shearling coat". */
  description: string;
  /** The tagger's brand guess, or null when it did not make one. */
  brandGuess: string | null;
  /** A signed URL for the user's own photograph, once the batch has signed it. */
  photoUri: string | undefined;
};

/** The word for a garment with no usable kind on record. */
const UNNAMED_PIECE = 'piece';

export function useMatchSubject(itemId: string | null): MatchSubject {
  const closet = useCloset();
  const item = closet.data?.find((piece) => piece.id === itemId) ?? null;

  // The cutout and the thumbnail only. `listingPath` is deliberately absent:
  // this photograph is the thing the confirm step labels "Kept", and resolving
  // it through a listing image would show somebody a shop's photo under the
  // words "your photograph" — on the one screen whose entire job is telling the
  // two apart.
  const { resolve } = useSignedUrls([item?.cutoutPath, item?.thumbPath]);

  const kind = item?.subcategory ?? (item && item.category !== 'other' ? item.category : null);
  const noun = kind ?? UNNAMED_PIECE;
  const colours = (item?.colors ?? []).map((colour) => colour.name).filter(Boolean);
  const described = [colours.join(', '), kind].filter(Boolean).join(' ');

  return {
    noun,
    plural: `${noun}s`,
    description: described
      ? described.charAt(0).toUpperCase() + described.slice(1)
      : 'This piece, as Cinch has it on record',
    brandGuess: item?.brand ?? null,
    photoUri: resolve(item?.cutoutPath, item?.thumbPath),
  };
}

/** Which of the atlas's honest failures a refusal is, with the server's own figures. */
export type MatchFailure = {
  /** The stable code, unchanged. The sheet picks its frame from this. */
  code: string;
  /** The existing mapped sentence, for the codes the atlas draws no frame for. */
  message: string;
  quota: QuotaDetail | null;
};

/** Which half of the flow is on screen. Confirm is a step, never an inline button. */
export type MatchStep = 'candidates' | 'confirm';

/**
 * The sheet's whole state in one place, mirroring `useGarmentSearchFlow`: the
 * screen stays a rendering of what has come back, what is chosen and what went
 * wrong. `candidates` is null before the first search (and after a failed one)
 * and an array afterwards — the difference between "nothing yet" and "nothing
 * found", which are two very different things to say to somebody.
 */
export function useMatchFlow(itemId: string) {
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [selected, setSelected] = useState<MatchCandidate | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');
  const [lookalike, setLookalike] = useState(false);
  const [scopedBrand, setScopedBrand] = useState<string | null>(null);
  const [step, setStep] = useState<MatchStep>('candidates');

  const match = useMatchGarment();
  const attach = useAttachListing();

  const runMatch = useCallback(
    async (brand: string | null) => {
      setSelected(null);
      // A re-search from the confirm step would leave somebody looking at a
      // listing that is no longer among the candidates behind it.
      setStep('candidates');
      attach.reset();
      const result = await match.mutateAsync({ itemId, brand }).catch(() => null);
      // null on failure, NOT an empty array: the mutation already holds the
      // error for the message line, and "nothing close enough" is a different
      // and much more discouraging sentence than "the search didn't come back".
      if (!result) {
        setCandidates(null);
        setLookalike(false);
        setScopedBrand(null);
        return;
      }
      setCandidates(result.candidates);
      setLookalike(result.lookalike);
      setScopedBrand(result.scopedBrand);
      // Merged rather than replaced: a brand-scoped re-search returns fewer
      // suggestions, and chips that vanish under the finger aiming at them are
      // a moving target. Once offered, a brand stays offered.
      setBrands((prev) => {
        const merged = [...prev];
        for (const suggestion of result.brands) {
          if (!merged.includes(suggestion)) merged.push(suggestion);
        }
        return merged;
      });
    },
    [attach, itemId, match],
  );

  /** The unscoped first search. Also the full reset the sheet runs on open. */
  const start = useCallback(() => {
    setCandidates(null);
    setBrands([]);
    setSelected(null);
    setActiveBrand(null);
    setBrandQuery('');
    setLookalike(false);
    setScopedBrand(null);
    setStep('candidates');
    match.reset();
    attach.reset();
    void runMatch(null);
  }, [attach, match, runMatch]);

  /**
   * Scope the search to one brand — or, tapping the active chip again, undo
   * the scoping. Both are re-searches: the function holds no session, so the
   * previous unscoped results are not kept around to fall back to.
   */
  const refine = useCallback(
    (brand: string) => {
      const next = brand === activeBrand ? null : brand;
      setActiveBrand(next);
      setBrandQuery('');
      void runMatch(next);
    },
    [activeBrand, runMatch],
  );

  /** The typed-brand door. A no-op on whitespace rather than a rejection. */
  const submitBrandQuery = useCallback(() => {
    const typed = brandQuery.trim();
    if (!typed) return;
    setActiveBrand(typed);
    setBrandQuery('');
    void runMatch(typed);
  }, [brandQuery, runMatch]);

  /** Tapping a tile selects it; tapping the selected one un-selects. */
  const choose = useCallback((candidate: MatchCandidate) => {
    setSelected((current) => (current?.imageUrl === candidate.imageUrl ? null : candidate));
  }, []);

  /**
   * Move to the confirm step, and back out of it.
   *
   * Confirming is its own screen rather than a second press of the same button
   * because the thing being decided there is not "which picture" but "is this
   * the garment I own" — and that question is unanswerable next to five other
   * candidates at thumbnail size. Backing out keeps the selection: the user
   * looked closely and said not this one, which is an answer about this
   * listing, not about the search.
   */
  const toConfirm = useCallback(() => {
    if (!selected) return;
    setStep('confirm');
  }, [selected]);

  const backToCandidates = useCallback(() => {
    attach.reset();
    setStep('candidates');
  }, [attach]);

  /** Returns true when the attach landed, so the sheet knows to close. */
  const confirm = useCallback(async (): Promise<boolean> => {
    if (!selected) return false;
    try {
      await attach.mutateAsync({
        itemId,
        imageUrl: selected.imageUrl,
        pageUrl: selected.pageUrl,
      });
      return true;
    } catch {
      // Held on the mutation for the message line; the sheet stays open with
      // the selection intact, because one refused CDN download is not a reason
      // to make somebody search again.
      return false;
    }
  }, [attach, itemId, selected]);

  // The two errors are kept apart rather than collapsed with `??`. A search
  // that was refused is a whole state — one of the atlas's five honest failures
  // — and an attach that was refused is a line under a button on a screen the
  // user should stay on, with their chosen listing still in front of them.
  // Collapsing them would put a download failure where the consent frame goes.
  const failure: MatchFailure | null =
    match.error instanceof GarmentSearchError
      ? {
          code: match.error.code,
          message: match.error.message,
          quota: match.error instanceof MatchError ? match.error.quota : null,
        }
      : match.error
        ? { code: 'match_failed', message: MESSAGES.match_failed, quota: null }
        : null;

  return {
    candidates,
    brands,
    selected,
    activeBrand,
    brandQuery,
    lookalike,
    scopedBrand,
    step,
    setBrandQuery,
    start,
    refine,
    submitBrandQuery,
    choose,
    toConfirm,
    backToCandidates,
    confirm,
    retry: useCallback(() => void runMatch(activeBrand), [activeBrand, runMatch]),
    searching: match.isPending,
    attaching: attach.isPending,
    failure,
    /** The attach refusal only — the search's own refusals are `failure`. */
    attachMessage: attach.error instanceof Error ? attach.error.message : null,
  };
}

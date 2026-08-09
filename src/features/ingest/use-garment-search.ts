import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { tagImportedGarment } from './upload-queue';

/**
 * "Describe it, don't photograph it" — and "paste the link".
 *
 * The client half of the `garment-search` Edge Function. It does deliberately
 * little: types a request, shrinks an optional colour photo, recognises a URL
 * when one is pasted, turns server error codes into something the sheet can say
 * out loud, and — once a garment lands — tells the query layer and the tagging
 * queue about it.
 *
 * TWO DOORS, ONE ROOM. Describing suits somebody recalling what they own; a
 * pasted link suits somebody looking at the thing in a shop's app right now,
 * which is how most garments are actually bought. They converge at the same
 * import call, the same queue job and the same tagging pass, so the second door
 * costs one extra request shape and no second pipeline.
 *
 * WHAT IS NOT HERE, ON PURPOSE: any fetching of third-party pages or images.
 * Both are done by the function. A retailer's CDN sends no CORS headers, so the
 * obvious client-side version fails on the second garment anyone tries — and
 * vetting arbitrary URLs is server work regardless.
 */

export type GarmentCandidate = {
  imageUrl: string;
  title: string;
  /** A bare host, e.g. "reformation.com". Shown under the tile. */
  source: string;
  confidence: number;
};

/**
 * A failure with a code the UI can branch on.
 *
 * The function returns stable codes precisely so the client never has to
 * pattern-match on prose, which changes, and never sees provider text, which
 * can quote the request back.
 */
export class GarmentSearchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GarmentSearchError';
  }
}

type ErrorBody = { error?: string; message?: string };

/** Read the JSON body off a non-2xx invoke, the way the upload queue does. */
async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const response = (error as { context?: unknown }).context as Response | undefined;
    return response ? ((await response.json()) as ErrorBody) : null;
  } catch {
    return null;
  }
}

/** Sentences in the app's voice, keyed by the server's stable codes. */
const MESSAGES: Record<string, string> = {
  ai_consent_required: 'Searching needs your OK on AI features — you can give it in Profile.',
  ai_quota_exceeded: "You've used this month's searches.",
  quota_unavailable: "Cinch couldn't check your allowance. Try again shortly.",
  plan_upgrade_required: 'Searching by description is part of Standard and Pro.',
  closet_limit_reached: 'Your closet is full on this plan.',
  search_disabled: 'Search is unavailable right now. Photographs still work.',
  search_failed: "The search didn't come back. Try again in a moment.",
  image_rejected: "That picture couldn't be saved. Try another one.",
  image_unreachable: "That picture couldn't be reached. Try another one.",
  import_failed: "That garment couldn't be added. Try again.",

  // ── The link path. Four distinct failures, four distinct sentences: which
  //    one a person hits decides what they should do next, and a single
  //    "couldn't import that link" would hide all four differences. ──────────
  /** The URL guard refused it — not https, a private address, a redirect loop. */
  link_rejected: "Cinch can't open that link. Paste the product page from the shop's own site.",
  /** We got there and it did not answer, or answered with an error. */
  link_unreachable: "That page didn't answer. Check the link, or photograph the item instead.",
  /** A PDF, a JSON endpoint, a download — reachable, but not a page. */
  link_not_a_page: "That link isn't a product page. Open the item on the shop's site and copy that link.",
  /** Read it, found no picture. The common one: a JavaScript-rendered shop. */
  link_no_image: "Cinch couldn't find the picture on that page — photograph the item instead.",
};

const FALLBACK_MESSAGE = 'Something went wrong. Try again in a moment.';

async function invokeOrThrow<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('garment-search', { body });

  if (error) {
    const parsed = await readErrorBody(error);
    const code = parsed?.error ?? 'search_failed';
    throw new GarmentSearchError(code, MESSAGES[code] ?? parsed?.message ?? FALLBACK_MESSAGE);
  }
  if (!data) throw new GarmentSearchError('search_failed', MESSAGES.search_failed);

  return data;
}

/**
 * Tell the query layer a garment has landed.
 *
 * A local copy of the upload queue's own invalidation rather than an import:
 * that one is private to a module singleton with no React context, this one has
 * a client in hand. The four keys are the closet grid, the styling engine's
 * wardrobe, the review deck and the capacity counter — verified against their
 * declarations, because an invalidation aimed at a key nobody registered is a
 * silent no-op that looks like a caching bug weeks later.
 */
function invalidateAfterItemSettled(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['closet'] });
  void qc.invalidateQueries({ queryKey: ['wardrobe'] });
  void qc.invalidateQueries({ queryKey: ['review-queue'] });
  void qc.invalidateQueries({ queryKey: ['closet-count'] });
}

/** Long edge of the colour reference sent up with the description. */
const SWATCH_MAX_EDGE = 256;
/** Aggressive, because this image is read for colour and weave, not detail. */
const SWATCH_COMPRESS = 0.5;

export type ColourSwatch = {
  /** Local file URI, for the preview thumbnail in the sheet. */
  uri: string;
  /** `data:image/jpeg;base64,…`, small enough to ride inside the JSON body. */
  dataUrl: string;
};

/**
 * Pick one photo and reduce it to a colour reference.
 *
 * Same picker rules as `use-capture.ts`: no permission request, because
 * PHPickerViewController runs out of process and hands over only what was
 * tapped, and never `base64: true` on the picker itself — that materializes the
 * full-resolution image as a JS string and is the classic iOS memory crash in
 * this exact flow. The base64 taken below is of a 256px re-encode, which is a
 * few kilobytes and fits inside the request the Edge Function will accept.
 */
export async function pickColourSwatch(): Promise<ColourSwatch | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.9,
    exif: false,
  });

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  const landscape = asset.width >= asset.height;
  const context = ImageManipulator.manipulate(asset.uri).resize(
    landscape ? { width: SWATCH_MAX_EDGE, height: null } : { width: null, height: SWATCH_MAX_EDGE },
  );

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: SWATCH_COMPRESS,
    base64: true,
  });

  if (!saved.base64) return null;

  return { uri: saved.uri, dataUrl: `data:image/jpeg;base64,${saved.base64}` };
}

// ---------------------------------------------------------------------------
// Paste a link
// ---------------------------------------------------------------------------

/** A pasted URL the sheet has recognised, ready to send. */
export type PastedLink = {
  /** Normalized, https, no surrounding whitespace. What the server receives. */
  url: string;
  /** "reformation.com" — the one word the row shows, so the user can check it. */
  host: string;
};

/** The server's ceiling, mirrored so the field cannot compose a rejection. */
const MAX_URL_CHARS = 2_048;

/**
 * Is what somebody typed a link rather than a description?
 *
 * The cheapest good answer, and the reason there is no separate "paste a link"
 * button anywhere in this feature: people paste into the field that is already
 * in front of them, and a second field would be a second decision to make
 * before the first one is understood. So the one field takes both, and the row
 * beneath it changes to say which one it thinks it got.
 *
 * A SCHEME OR A `www.` IS REQUIRED, and that line is drawn deliberately. Every
 * link iOS produces — Share Sheet, Safari, a shop's own app — carries `https://`.
 * Accepting bare `reformation.com` would additionally mean that typing a brand
 * name and nothing else silently becomes a link to a homepage, whose og:image is
 * a lifestyle banner and not a garment. That is a worse failure than asking for
 * the scheme, because it succeeds.
 *
 * `http://` is upgraded rather than refused: the guard on the server only opens
 * https, every retailer redirects to it, and bouncing a person back to edit a
 * scheme they did not type is friction with no security value — the server
 * still refuses anything that does not end up on https.
 */
const SCHEME = /^(https?):\/\//i;

/**
 * host[:port][/path], where the host is a real public name.
 *
 * The rejections here are the SHAPE half of the server's `assertSafeUrl`, so
 * the field does not offer to open a link that is certain to come back refused:
 * a bare name with no dot, an IPv4 literal (the last label is not alphabetic),
 * an IPv6 literal (brackets and colons), and `user:pass@host` (no `@` gets
 * through) all fail to match. The name-based half of that guard — the blocked
 * `.internal` and `.local` suffixes — deliberately stays on the server, where
 * it is a security boundary rather than a hint. This function is a hint.
 */
const HOST_AND_PATH = /^((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(:\d{1,5})?([/?#]\S*)?$/i;

export function parsePastedLink(raw: string): PastedLink | null {
  const trimmed = raw.trim();
  // One token. "the blue dress https://…" is a description that happens to
  // mention a link, and treating it as a link would discard the words.
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (trimmed.length > MAX_URL_CHARS) return null;

  // A regex rather than `new URL()`, for the same reason `venue-search.ts`
  // gives: this runs on every keystroke of the field, and it must never throw
  // on a half-typed string. It also does not depend on how complete the
  // JavaScript engine's URL implementation happens to be.
  const scheme = SCHEME.exec(trimmed);
  if (!scheme && !/^www\./i.test(trimmed)) return null;

  const parts = HOST_AND_PATH.exec(scheme ? trimmed.slice(scheme[0].length) : trimmed);
  if (!parts) return null;

  // Host lowercased because it is case-insensitive and gets shown to the user;
  // the path left alone because it is not.
  const host = parts[1].toLowerCase();
  const url = `https://${host}${parts[2] ?? ''}${parts[3] ?? ''}`;
  if (url.length > MAX_URL_CHARS) return null;

  return { url, host: host.replace(/^www\./, '') };
}

/** What the server read off the page, before the user has confirmed any of it. */
export type ResolvedLink = {
  imageUrl: string;
  /** The page's own product name, or null when it published none. */
  title: string | null;
  /** Bare host. The honesty line: this picture came from somewhere. */
  source: string;
};

/**
 * Reading the pasted page.
 *
 * A mutation for the same reason the search is one: it costs an allowance unit
 * and reaches the network, and a query would re-run it on every remount — the
 * same cost spent by accident.
 */
export function useLinkResolve() {
  return useMutation<ResolvedLink, Error, { link: PastedLink }>({
    mutationFn: async ({ link }) => {
      const data = await invokeOrThrow<Partial<ResolvedLink>>({
        action: 'resolve',
        pageUrl: link.url,
      });
      if (!data.imageUrl) throw new GarmentSearchError('link_no_image', MESSAGES.link_no_image);
      return {
        imageUrl: data.imageUrl,
        title: data.title ?? null,
        source: data.source ?? link.host,
      };
    },
    onSuccess: (resolved) => {
      // Counts and flags only. The URL is user content and never leaves the
      // device in an event property — a product link identifies a purchase.
      track('garment_search_used', {
        stage: 'link_resolved',
        had_title: Boolean(resolved.title),
      });
    },
  });
}

/**
 * The search itself.
 *
 * Held as a mutation rather than a query: it is an action with a cost — one web
 * search and one model call against a monthly allowance — and a query would
 * re-run it on every remount and every key change, which is the same money
 * spent by accident.
 */
export function useGarmentSearch() {
  return useMutation<GarmentCandidate[], Error, { description: string; swatch?: ColourSwatch | null }>(
    {
      mutationFn: async ({ description, swatch }) => {
        const data = await invokeOrThrow<{ candidates?: GarmentCandidate[] }>({
          action: 'search',
          description,
          swatch: swatch?.dataUrl,
        });
        return data.candidates ?? [];
      },
      onSuccess: (candidates, variables) => {
        // Counts and flags only. The description is user content and never
        // leaves the device in an event property.
        track('garment_search_used', {
          stage: 'searched',
          candidates: candidates.length,
          had_swatch: Boolean(variables.swatch),
        });
      },
    },
  );
}

/**
 * Turning the tapped tile into a closet item.
 *
 * The server downloads the image, creates the row at `pending_tag` and stops
 * there — which is exactly where a photographed garment arrives too, so the tag
 * is driven by the same queue rather than a second pipeline.
 *
 * It used to be handed to `sweepPendingTags` and forgotten, and that was the
 * dead end: the sweep is rate-limited to once a minute and returns early when
 * one is already running, so the garment could sit at `pending_tag` — invisible
 * on capture, which draws its progress from the queue, and invisible in the
 * review deck, which lists only `tagged` and `needs_review`. Somebody who
 * described a dress was shown "Nothing to review" while their dress existed
 * nowhere they could see. `tagImportedGarment` puts it on the capture rail and
 * carries it to a result — or to a failure with a retry on it.
 */
export type GarmentImportInput = {
  imageUrl: string;
  /** Becomes the garment's description. Null when nobody supplied one. */
  title?: string | null;
  source?: string | null;
  /** Which door this garment came through. Analytics only, never sent up. */
  via: 'describe' | 'link';
};

export function useGarmentImport() {
  const qc = useQueryClient();

  return useMutation<string, Error, GarmentImportInput>({
    mutationFn: async (input) => {
      const data = await invokeOrThrow<{ itemId?: string }>({
        action: 'import',
        imageUrl: input.imageUrl,
        title: input.title ?? undefined,
        source: input.source ?? undefined,
      });
      if (!data.itemId) throw new GarmentSearchError('import_failed', MESSAGES.import_failed);
      return data.itemId;
    },
    onSuccess: (itemId, input) => {
      invalidateAfterItemSettled(qc);
      // After the durable write, so a crash between import and track loses the
      // event rather than fabricating one for a garment that never landed.
      track('garment_search_used', { stage: 'imported', path: input.via });
      // The chosen product shot stands in as the rail thumbnail: it is the
      // picture the user actually tapped, and the server saved that same one.
      void tagImportedGarment(itemId, input.imageUrl);
    },
  });
}

/**
 * The sheet's whole state in one place.
 *
 * Kept here rather than in the component so the screen stays a rendering of
 * state: what has been typed, what is attached, what came back, and what went
 * wrong. `results` is null before the first search and an array afterwards —
 * the difference between "nothing yet" and "nothing found", which are two very
 * different things to say to somebody.
 *
 * The link path adds one more nullable: `preview`. Null means no page has been
 * read; an object means one has, and the sheet is now asking "is this it?"
 * rather than searching. A preview and a result list are mutually exclusive by
 * construction — resolving clears the results, searching clears the preview —
 * because two answers on screen at once is two things to say no to.
 */
export function useGarmentSearchFlow() {
  const [description, setDescription] = useState('');
  const [swatch, setSwatch] = useState<ColourSwatch | null>(null);
  const [results, setResults] = useState<GarmentCandidate[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResolvedLink | null>(null);
  const [previewName, setPreviewName] = useState('');

  const search = useGarmentSearch();
  const resolve = useLinkResolve();
  const importGarment = useGarmentImport();

  // Derived, not stored. The field is the single source of truth for which
  // door is open, so there is no way for the row beneath it to fall out of
  // step with what is actually typed.
  const link = parsePastedLink(description);

  const attachSwatch = useCallback(async () => {
    const picked = await pickColourSwatch();
    if (picked) setSwatch(picked);
  }, []);

  const run = useCallback(async () => {
    const trimmed = description.trim();
    if (trimmed.length < 3) return;
    const candidates = await search.mutateAsync({ description: trimmed, swatch }).catch(() => null);
    // null on failure, NOT an empty array: the mutation already holds the error
    // for the message line, and "nothing matched that" is a different and much
    // more discouraging sentence than "the search didn't come back".
    setResults(candidates);
    setPreview(null);
  }, [description, search, swatch]);

  /**
   * Read the pasted page and hold the answer for confirmation.
   *
   * Nothing is written here. A resolve that fails leaves the typed link in the
   * field and the reason on the message line, so the fix — a different link, or
   * the camera — is one gesture away rather than a re-type.
   */
  const readLink = useCallback(async () => {
    if (!link) return;
    search.reset();
    importGarment.reset();
    setResults(null);
    const resolved = await resolve.mutateAsync({ link }).catch(() => null);
    setPreview(resolved);
    // The page's own product name is a starting point, not an answer: it is
    // often "Gemma Dress" and sometimes a slug. Pre-filled so the common case
    // is one tap, editable so the uncommon one is not a dead end.
    setPreviewName(resolved?.title ?? '');
  }, [importGarment, link, resolve, search]);

  const discardPreview = useCallback(() => {
    setPreview(null);
    setPreviewName('');
    resolve.reset();
    importGarment.reset();
  }, [importGarment, resolve]);

  /** Returns the new item's id, or null when the import was refused. */
  const choose = useCallback(
    async (candidate: GarmentCandidate): Promise<string | null> => {
      setImporting(candidate.imageUrl);
      try {
        return await importGarment.mutateAsync({
          imageUrl: candidate.imageUrl,
          title: candidate.title,
          source: candidate.source,
          via: 'describe',
        });
      } catch {
        // Held on the mutation for the error line; the sheet stays open with
        // the other candidates still tappable, because one dead image URL is
        // not a reason to make somebody search again.
        return null;
      } finally {
        setImporting(null);
      }
    },
    [importGarment],
  );

  /** Confirm the previewed link. Same import call the candidate tiles make. */
  const confirmPreview = useCallback(async (): Promise<string | null> => {
    if (!preview) return null;
    setImporting(preview.imageUrl);
    try {
      const named = previewName.trim();
      return await importGarment.mutateAsync({
        imageUrl: preview.imageUrl,
        // An emptied field means "no name", not "use the page's one" — the
        // user deleted it on purpose, and restoring it would be the app
        // overruling them.
        title: named || null,
        source: preview.source,
        via: 'link',
      });
    } catch {
      // The preview stays on screen: the picture is still right, and the
      // failure is usually the closet limit or a CDN refusing us, both of
      // which are worth a second tap rather than a re-paste.
      return null;
    } finally {
      setImporting(null);
    }
  }, [importGarment, preview, previewName]);

  const reset = useCallback(() => {
    setDescription('');
    setSwatch(null);
    setResults(null);
    setPreview(null);
    setPreviewName('');
    search.reset();
    resolve.reset();
    importGarment.reset();
  }, [importGarment, resolve, search]);

  const error = importGarment.error ?? resolve.error ?? search.error;

  return {
    description,
    setDescription,
    swatch,
    attachSwatch,
    clearSwatch: useCallback(() => setSwatch(null), []),
    results,
    run,
    searching: search.isPending,
    choose,
    importingUrl: importing,
    errorMessage: error instanceof Error ? error.message : null,
    // The Wall's W-03 branches on this specifically — a full closet gets its
    // own designed sheet rather than the generic error line. Checked by code,
    // never by matching `errorMessage`'s prose, which is free to change.
    closetFull: error instanceof GarmentSearchError && error.code === 'closet_limit_reached',
    reset,

    // ── The link door ─────────────────────────────────────────────────────
    link,
    readLink,
    resolving: resolve.isPending,
    preview,
    previewName,
    setPreviewName,
    confirmPreview,
    discardPreview,
    importingPreview: preview !== null && importing === preview.imageUrl,
  };
}

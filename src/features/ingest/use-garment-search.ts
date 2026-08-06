import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { tagImportedGarment } from './upload-queue';

/**
 * "Describe it, don't photograph it."
 *
 * The client half of the `garment-search` Edge Function. It does deliberately
 * little: types a request, shrinks an optional colour photo, turns server error
 * codes into something the sheet can say out loud, and — once a garment lands —
 * tells the query layer and the tagging sweep about it.
 *
 * WHAT IS NOT HERE, ON PURPOSE: any fetching of third-party images. The chosen
 * product photograph is downloaded by the function, into our own Storage
 * bucket. A retailer's CDN sends no CORS headers, so the obvious client-side
 * version fails on the second garment anyone tries — and vetting arbitrary URLs
 * is server work regardless.
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
  ai_consent_required: 'Turn on AI features to search for a garment.',
  ai_quota_exceeded: "You've used this month's searches.",
  plan_upgrade_required: 'Searching by description is part of Standard and Pro.',
  closet_limit_reached: 'Your closet is full on this plan.',
  search_disabled: 'Search is unavailable right now. Photographs still work.',
  search_failed: "The search didn't come back. Try again in a moment.",
  image_rejected: "That picture couldn't be saved. Try another one.",
  image_unreachable: "That picture couldn't be reached. Try another one.",
  import_failed: "That garment couldn't be added. Try again.",
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
export function useGarmentImport() {
  const qc = useQueryClient();

  return useMutation<string, Error, { candidate: GarmentCandidate }>({
    mutationFn: async ({ candidate }) => {
      const data = await invokeOrThrow<{ itemId?: string }>({
        action: 'import',
        imageUrl: candidate.imageUrl,
        title: candidate.title,
        source: candidate.source,
      });
      if (!data.itemId) throw new GarmentSearchError('import_failed', MESSAGES.import_failed);
      return data.itemId;
    },
    onSuccess: (itemId, { candidate }) => {
      invalidateAfterItemSettled(qc);
      // After the durable write, so a crash between import and track loses the
      // event rather than fabricating one for a garment that never landed.
      track('garment_search_used', { stage: 'imported' });
      // The chosen product shot stands in as the rail thumbnail: it is the
      // picture the user actually tapped, and the server saved that same one.
      void tagImportedGarment(itemId, candidate.imageUrl);
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
 */
export function useGarmentSearchFlow() {
  const [description, setDescription] = useState('');
  const [swatch, setSwatch] = useState<ColourSwatch | null>(null);
  const [results, setResults] = useState<GarmentCandidate[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const search = useGarmentSearch();
  const importCandidate = useGarmentImport();

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
  }, [description, search, swatch]);

  /** Returns the new item's id, or null when the import was refused. */
  const choose = useCallback(
    async (candidate: GarmentCandidate): Promise<string | null> => {
      setImporting(candidate.imageUrl);
      try {
        return await importCandidate.mutateAsync({ candidate });
      } catch {
        // Held on the mutation for the error line; the sheet stays open with
        // the other candidates still tappable, because one dead image URL is
        // not a reason to make somebody search again.
        return null;
      } finally {
        setImporting(null);
      }
    },
    [importCandidate],
  );

  const reset = useCallback(() => {
    setDescription('');
    setSwatch(null);
    setResults(null);
    search.reset();
    importCandidate.reset();
  }, [importCandidate, search]);

  const error = importCandidate.error ?? search.error;

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
    reset,
  };
}

import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';

import { newRequestId } from '@/features/catalogue/request-id';
import { prepareForUpload } from '@/lib/image';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';
import type { Garment } from '@/lib/styling';

import { matchInspiration } from './match';
import { pickInspiration } from './pick-inspiration';
import { mayAnalyze, type InspirationCandidate, type InspirationProvider } from './sources';
import type { InspirationPiece, RecreateResult } from './types';

/**
 * The "Recreate this look" flow: take one inspiration from a source, upload it
 * to the caller's own Storage folder, have analyze-inspiration read it into
 * pieces, and match those pieces against the closet ON DEVICE.
 *
 * The division of labour is the outfit engine's: the model reads the
 * photograph and nothing else, the matching is arithmetic, and nothing about
 * the closet goes up the wire. The photograph lands under
 * `{userId}/inspiration/` — the user's own folder in the private bucket,
 * behind the same owner-only RLS as their garments.
 *
 * Which SOURCE supplied the inspiration is `sources.ts`'s business, not this
 * hook's. All this one insists on is that the source cleared the analysis gate
 * before a byte leaves the phone — see `unauthorized_source` below.
 *
 * Bounded causes rather than provider messages, the intake rule: every
 * failure the screen can show is one of these, and none of them quotes
 * anything back.
 */
export type RecreateFailure =
  | 'consent'
  | 'quota'
  | 'disabled'
  | 'offline'
  | 'unreadable'
  /**
   * The source supplied a picture Cinch is not permitted to send for
   * analysis. Unreachable through the UI, which never offers such a source —
   * it is the fail-closed end of `mayAnalyze`, kept user-visible so that a
   * mistake shows up as honest copy rather than a silent no-op.
   */
  | 'unauthorized_source';

export type RecreatePhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; candidate: InspirationCandidate }
  | { kind: 'analyzing'; candidate: InspirationCandidate }
  | { kind: 'done'; result: RecreateResult; candidate: InspirationCandidate }
  /** The model answered honestly: no discernible clothes in the photograph. */
  | { kind: 'empty'; candidate: InspirationCandidate }
  | { kind: 'error'; cause: RecreateFailure };

async function readFailure(error: unknown): Promise<RecreateFailure> {
  if (!(error instanceof FunctionsHttpError)) return 'offline';
  const response = (error as { context?: unknown }).context as Response | undefined;
  if (!response) return 'offline';
  let body: { error?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string };
  } catch {
    // A non-JSON body still has its status.
  }
  if (response.status === 403 && body?.error === 'ai_consent_required') return 'consent';
  if (response.status === 429) return 'quota';
  if (response.status === 503) return 'disabled';
  return 'unreadable';
}

/** Upload one local file through a signed URL — `upload-queue`'s own moves. */
async function uploadInspiration(localUri: string, path: string): Promise<void> {
  const { data, error } = await supabase.storage.from('garments').createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Could not get an upload URL: ${error?.message ?? 'unknown error'}`);
  }
  const file = new File(localUri);
  const result = await file.upload(data.signedUrl, {
    httpMethod: 'PUT',
    mimeType: 'image/jpeg',
    headers: { 'content-type': 'image/jpeg' },
  });
  if (result.status >= 400) throw new Error(`Upload failed with ${result.status}`);
}

export function useRecreate(wardrobe: Garment[]) {
  const [phase, setPhase] = useState<RecreatePhase>({ kind: 'idle' });
  /** One flight at a time — a second tap mid-analysis must not double-spend. */
  const busy = useRef(false);

  const start = useCallback(async (provider: InspirationProvider = 'photo') => {
    if (busy.current) return;

    // The source first, before any state changes: a dismissal is not an
    // error and must leave the screen exactly as it was (avatar.ts:54).
    const candidate = await pickInspiration(provider);
    if (!candidate) return;

    // Fail closed before the upload, not after. A picture Cinch may not send
    // for analysis must not be copied into Storage either — the copy is
    // itself the retention a provider's terms forbid. Narrowing here is what
    // lets `prepareForUpload` below see a file Cinch actually holds.
    if (!mayAnalyze(candidate)) {
      setPhase({ kind: 'error', cause: 'unauthorized_source' });
      return;
    }

    busy.current = true;
    setPhase({ kind: 'uploading', candidate });

    try {
      const userId = await getUserId();
      if (!userId) {
        setPhase({ kind: 'error', cause: 'offline' });
        return;
      }

      // Resized to the garment pipeline's own upload edge — a screenshot at
      // device resolution is megabytes the vision model will only downscale.
      // Only a `local` candidate reaches here: `mayAnalyze` sent every remote
      // one away above, so there is no provider picture to fetch or re-host.
      const prepared = await prepareForUpload(
        candidate.imageUri,
        candidate.width,
        candidate.height,
      );
      const path = `${userId}/inspiration/${newRequestId()}.jpg`;
      await uploadInspiration(prepared.uri, path);

      setPhase({ kind: 'analyzing', candidate });
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        pieces: InspirationPiece[];
      }>('analyze-inspiration', { body: { path } });

      if (error) {
        setPhase({ kind: 'error', cause: await readFailure(error) });
        return;
      }

      const pieces = data?.pieces ?? [];
      if (!pieces.length) {
        track('recreate_analyzed', { pieces: 0, matched: 0, gaps: 0, source: candidate.provider });
        setPhase({ kind: 'empty', candidate });
        return;
      }

      const result = matchInspiration(pieces, wardrobe);
      // COUNTS ONLY — never a piece description, a colour, or a category
      // list. What somebody's saved inspiration contains is theirs. `source`
      // is the provider NAME from a closed set, which says which door the
      // person came through and nothing whatever about what they looked at.
      track('recreate_analyzed', {
        pieces: pieces.length,
        matched: result.matchedItems.length,
        gaps: result.gapCount,
        source: candidate.provider,
      });
      setPhase({ kind: 'done', result, candidate });
    } catch (err) {
      setPhase({
        kind: 'error',
        cause: err instanceof TypeError ? 'offline' : 'unreadable',
      });
    } finally {
      busy.current = false;
    }
  }, [wardrobe]);

  const reset = useCallback(() => {
    if (!busy.current) setPhase({ kind: 'idle' });
  }, []);

  return { phase, start, reset };
}

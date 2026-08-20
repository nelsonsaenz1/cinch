import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';

import { newRequestId } from '@/features/catalogue/request-id';
import { prepareForUpload } from '@/lib/image';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';
import type { Garment } from '@/lib/styling';

import { matchInspiration } from './match';
import type { InspirationPiece, RecreateResult } from './types';

/**
 * The "Recreate this look" flow: pick a saved photograph, upload it to the
 * caller's own Storage folder, have analyze-inspiration read it into pieces,
 * and match those pieces against the closet ON DEVICE.
 *
 * The division of labour is the outfit engine's: the model reads the
 * photograph and nothing else, the matching is arithmetic, and nothing about
 * the closet goes up the wire. The photograph lands under
 * `{userId}/inspiration/` — the user's own folder in the private bucket,
 * behind the same owner-only RLS as their garments.
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
  | 'unreadable';

export type RecreatePhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; imageUri: string }
  | { kind: 'analyzing'; imageUri: string }
  | { kind: 'done'; result: RecreateResult; imageUri: string }
  /** The model answered honestly: no discernible clothes in the photograph. */
  | { kind: 'empty'; imageUri: string }
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

  const start = useCallback(async () => {
    if (busy.current) return;

    // The picker first, before any state changes: a dismissal is not an
    // error and must leave the screen exactly as it was (avatar.ts:54).
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;

    busy.current = true;
    setPhase({ kind: 'uploading', imageUri: asset.uri });

    try {
      const userId = await getUserId();
      if (!userId) {
        setPhase({ kind: 'error', cause: 'offline' });
        return;
      }

      // Resized to the garment pipeline's own upload edge — a screenshot at
      // device resolution is megabytes the vision model will only downscale.
      const prepared = await prepareForUpload(asset.uri, asset.width, asset.height);
      const path = `${userId}/inspiration/${newRequestId()}.jpg`;
      await uploadInspiration(prepared.uri, path);

      setPhase({ kind: 'analyzing', imageUri: asset.uri });
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
        track('recreate_analyzed', { pieces: 0, matched: 0, gaps: 0 });
        setPhase({ kind: 'empty', imageUri: asset.uri });
        return;
      }

      const result = matchInspiration(pieces, wardrobe);
      // COUNTS ONLY — never a piece description, a colour, or a category
      // list. What somebody's saved inspiration contains is theirs.
      track('recreate_analyzed', {
        pieces: pieces.length,
        matched: result.matchedItems.length,
        gaps: result.gapCount,
      });
      setPhase({ kind: 'done', result, imageUri: asset.uri });
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

import { File } from 'expo-file-system';

import { backgroundRemover } from '@/lib/bg-removal';
import { prepareForUpload, prepareThumbnail } from '@/lib/image';
import { supabase, getUserId } from '@/lib/supabase';

import { useQueueStore, type UploadJob } from './queue-store';

/**
 * The ingestion pipeline.
 *
 * Per job: downscale → thumbnail → on-device cutout → upload three objects →
 * create the item row → request tagging.
 *
 * Two design decisions worth keeping:
 *
 * 1. **Concurrency is capped at 3.** 60 concurrent uploads exhaust the JS
 *    thread, can trip Supabase Storage rate limits, and — because the cutout
 *    step decodes full-resolution images into native memory — will get the app
 *    killed by iOS jetsam mid-import.
 *
 * 2. **Tagging fan-out is driven from here, not from an Edge Function.**
 *    Supabase rate-limits recursive Edge Function calls (outbound `fetch()`
 *    between functions), so the obvious "one orchestrator spawns 100 taggers"
 *    pattern gets throttled. The client calls `tag-item` once per item instead.
 *    Items left at `pending_tag` by a backgrounded app are re-driven by a sweep
 *    on next launch.
 */

const MAX_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const BUCKET = 'garments';

let running = 0;
let draining = false;

/** Upload one local file to a Storage path via a signed upload URL. */
async function uploadObject(
  localUri: string,
  path: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Could not get an upload URL: ${error?.message ?? 'unknown error'}`);
  }

  const file = new File(localUri);

  const result = await file.upload(data.signedUrl, {
    httpMethod: 'PUT',
    mimeType: contentType,
    headers: { 'content-type': contentType },
    // Hands the transfer to iOS's NSURLSession background session, so it
    // survives the app being backgrounded mid-import.
    sessionType: 'background',
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesSent / totalBytes);
    },
  });

  if (result.status >= 400) {
    throw new Error(`Upload failed with ${result.status}`);
  }
}

async function processJob(job: UploadJob): Promise<void> {
  const { update } = useQueueStore.getState();

  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');

  // 1. Downscale + thumbnail.
  update(job.id, { stage: 'preparing' });
  const prepared = await prepareForUpload(job.localUri, job.width, job.height);
  const thumb = await prepareThumbnail(job.localUri, job.width, job.height);

  // 2. Cutout. A failure here is expected and non-fatal — an unliftable photo
  //    (patterned background, sheer fabric, white-on-white) still becomes a
  //    perfectly usable item, just without a transparent cutout.
  update(job.id, { stage: 'cutout' });
  let cutoutUri: string | null = null;
  if (await backgroundRemover.isSupported()) {
    const result = await backgroundRemover.remove(prepared.uri);
    if (result.ok && result.subjects.length > 0) {
      cutoutUri = result.subjects[0].uri;
    }
  }

  // 3. Create the row first, so the Storage paths can be keyed by item id and
  //    an interrupted upload leaves a resumable record rather than orphans.
  //    Reused on retry so a partially-completed job never duplicates the item.
  let itemId = job.itemId;
  if (!itemId) {
    const { data, error } = await supabase
      .from('items')
      .insert({ user_id: userId, status: 'pending_upload' })
      .select('id')
      .single();
    if (error || !data) throw new Error(`Could not create item: ${error?.message}`);
    itemId = data.id;
    update(job.id, { itemId });
  }

  // Narrowing for the calls below; unreachable in practice.
  if (!itemId) throw new Error('Item id missing after creation.');

  // 4. Upload. Paths are prefixed by user id because the Storage bucket policy
  //    authorizes on the first path segment.
  update(job.id, { stage: 'uploading', progress: 0 });
  const base = `${userId}/${itemId}`;

  await uploadObject(prepared.uri, `${base}/original.jpg`, 'image/jpeg', (p) =>
    update(job.id, { progress: p * 0.6 }),
  );
  await uploadObject(thumb.uri, `${base}/thumb.jpg`, 'image/jpeg', (p) =>
    update(job.id, { progress: 0.6 + p * 0.2 }),
  );
  if (cutoutUri) {
    await uploadObject(cutoutUri, `${base}/cutout.png`, 'image/png', (p) =>
      update(job.id, { progress: 0.8 + p * 0.2 }),
    );
  }

  const { error: updateError } = await supabase
    .from('items')
    .update({
      image_path: `${base}/original.jpg`,
      thumb_path: `${base}/thumb.jpg`,
      cutout_path: cutoutUri ? `${base}/cutout.png` : null,
      status: 'pending_tag',
    })
    .eq('id', itemId);
  if (updateError) throw new Error(`Could not record upload: ${updateError.message}`);

  // 5. Request tagging. A failure here is explicitly NOT fatal: the item is
  //    already saved and sits at `pending_tag` for the launch sweep to retry.
  //    Losing a tag is recoverable; losing an upload is not.
  update(job.id, { stage: 'tagging', progress: 1 });
  try {
    await supabase.functions.invoke('tag-item', { body: { itemId } });
  } catch {
    // Intentionally swallowed — see above.
  }

  update(job.id, { stage: 'done' });
}

/**
 * Pulls queued jobs until none remain, never exceeding MAX_CONCURRENCY.
 * Safe to call repeatedly; re-entrant calls are ignored.
 */
export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    for (;;) {
      const { jobs, update } = useQueueStore.getState();
      const next = jobs.find((j) => j.stage === 'queued');

      if (!next) {
        if (running === 0) break;
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }

      if (running >= MAX_CONCURRENCY) {
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }

      // Claim it synchronously so the next loop iteration can't pick it up again.
      update(next.id, { stage: 'preparing', attempts: next.attempts + 1 });
      running += 1;

      void processJob({ ...next, attempts: next.attempts + 1 })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          const attempts = next.attempts + 1;
          useQueueStore.getState().update(next.id, {
            stage: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
            error: message,
          });
        })
        .finally(() => {
          running -= 1;
        });
    }
  } finally {
    draining = false;
  }
}

/**
 * Re-drives items whose upload finished but whose tagging never did — the
 * normal outcome when a user backgrounds the app mid-import.
 */
export async function sweepPendingTags(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('items')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['pending_tag', 'needs_review'])
    .limit(50);

  if (error || !data) return;

  for (const row of data) {
    try {
      await supabase.functions.invoke('tag-item', { body: { itemId: row.id } });
    } catch {
      // Next launch will try again.
    }
  }
}

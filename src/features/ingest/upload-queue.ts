import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';

import { CURRENT_CONSENT_VERSION } from '@/features/auth/use-consent';
import { backgroundRemover, type Swatch } from '@/lib/bg-removal';
import { nearestColorName } from '@/lib/color';
import { prepareForUpload, prepareThumbnail } from '@/lib/image';
import { track } from '@/lib/posthog';
import { queryClient } from '@/lib/query-client';
import { supabase, getUserId } from '@/lib/supabase';

import { useQueueStore, type UploadJob } from './queue-store';

/**
 * Tell the query layer a garment has landed.
 *
 * This module is the only writer that adds items outside a React component, so
 * it has to reach the query client directly — it is a module singleton, no hook
 * needed. Without this, the closet keeps its 5-minute-stale cache and the path
 * "import → open Closet" shows a grid missing everything just uploaded, at the
 * exact moment a new user is judging whether the app works.
 */
function invalidateAfterItemSettled(): void {
  void queryClient.invalidateQueries({ queryKey: ['closet'] });
  void queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
  void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
  void queryClient.invalidateQueries({ queryKey: ['closet-count'] });
}

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
 *    Items left at `pending_tag` by a backgrounded app are re-driven by
 *    `sweepPendingTags`, which `startTagSweeper` wires to app launch and to
 *    every return to the foreground.
 */

const MAX_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const BUCKET = 'garments';

let running = 0;
let draining = false;

// ---------------------------------------------------------------------------
// Tagging
// ---------------------------------------------------------------------------

/**
 * What `tag-item` did, as far as this client is concerned.
 *
 * The distinction the previous code missed: the Edge Function returns its own
 * failures as **200 with a JSON body** (`{ ok: false, status: 'needs_review' }`),
 * because losing an item is unacceptable and a badged item is recoverable. So
 * `await invoke(...)` resolving proves nothing at all. Both `error` and the
 * body have to be read, and the local job may only be called finished when the
 * server row actually reached a terminal status.
 */
type TagOutcome =
  /** The row is `tagged` or `needs_review`; nothing further will change it. */
  | { kind: 'settled'; status: 'tagged' | 'needs_review' }
  /** AI consent is absent or withdrawn. Retrying is a guaranteed 403 forever. */
  | { kind: 'consent' }
  /** Transient: the row is still `pending_tag` and a later sweep should retry. */
  | { kind: 'retry'; message: string };

type TagResponseBody = { ok?: boolean; status?: string; error?: string };

/** Read the JSON body off a non-2xx response, if there is one to read. */
async function readErrorBody(error: unknown): Promise<TagResponseBody | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const response = (error as { context?: unknown }).context as Response | undefined;
    return response ? ((await response.json()) as TagResponseBody) : null;
  } catch {
    // A non-JSON error body tells us nothing; treat it as an ordinary failure.
    return null;
  }
}

/** Ask the Edge Function to tag one item, and report what actually happened. */
async function requestTag(itemId: string): Promise<TagOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<TagResponseBody>('tag-item', {
      body: { itemId },
    });

    if (error) {
      const body = await readErrorBody(error);
      if (body?.error === 'ai_consent_required') return { kind: 'consent' };
      return { kind: 'retry', message: error instanceof Error ? error.message : String(error) };
    }

    // 200, but the body decides. `needs_review` is a settled outcome — the item
    // is waiting in the review deck, not waiting on another call.
    if (data?.status === 'tagged' || data?.status === 'needs_review') {
      return { kind: 'settled', status: data.status };
    }

    return { kind: 'retry', message: data?.error ?? 'Tagging did not complete.' };
  } catch (err) {
    return { kind: 'retry', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Move every queue job pointing at this item to a stage, with an explanation. */
function settleJobsForItem(itemId: string, patch: Partial<UploadJob>): void {
  const { jobs, update } = useQueueStore.getState();
  for (const job of jobs) {
    if (job.itemId === itemId) update(job.id, patch);
  }
}

const CONSENT_WITHDRAWN_MESSAGE =
  'Saved, but not tagged — AI processing is turned off for your account.';

/** Is AI processing currently permitted for this user? */
async function hasAiConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('ai_consent_version')
    .eq('user_id', userId)
    .single();

  if (error) return false;
  return (data?.ai_consent_version ?? 0) >= CURRENT_CONSENT_VERSION;
}

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

// ---------------------------------------------------------------------------
// Cutout, plate and colour
// ---------------------------------------------------------------------------

/** `items.colors`, as this file writes it. */
type MeasuredColor = { name: string; hex: string; weight: number };

/** Everything one native Vision pass produced for a job. All of it optional. */
type CutoutArtifacts = {
  cutoutUri: string | null;
  plateUri: string | null;
  colors: MeasuredColor[] | null;
  analysis: { version: number; source: string; swatches: Swatch[] } | null;
};

const NO_CUTOUT: CutoutArtifacts = {
  cutoutUri: null,
  plateUri: null,
  colors: null,
  analysis: null,
};

/**
 * Lift the garment, render its plate, and measure its colours.
 *
 * Run against the ORIGINAL photo rather than the downscaled upload. Two reasons:
 * the native pass decodes at its own bounded resolution anyway, so there is no
 * memory argument for feeding it a re-encoded JPEG; and the one retry it is
 * allowed re-decodes at 1536px, which only buys anything if there is real detail
 * left to decode.
 *
 * Every outcome is reported, including the boring ones — `cutout_result` is how
 * we find out whether a server-side matting fallback is worth paying for, and a
 * denominator made only of failures would answer the wrong question.
 */
async function runCutout(sourceUri: string): Promise<CutoutArtifacts> {
  try {
    if (!(await backgroundRemover.isSupported())) {
      track('cutout_result', { outcome: 'unsupported-device', subjectCount: 0 });
      return NO_CUTOUT;
    }

    const result = await backgroundRemover.remove(sourceUri);

    if (!result.ok) {
      track('cutout_result', { outcome: result.reason, subjectCount: 0 });
      return NO_CUTOUT;
    }

    track('cutout_result', { outcome: 'ok', subjectCount: result.subjects.length });

    // The largest-area subject, not the first one Vision happened to emit.
    // Vision's index order means nothing; on hanger shots and flat-lays the
    // garment is essentially always the biggest thing lifted.
    const subject = result.subjects[0];

    // A measured hex with no name is unusable downstream — every surface in the
    // app speaks in colour names — so an unresolvable swatch is dropped rather
    // than written half-formed.
    const colors = result.colors.flatMap((swatch): MeasuredColor[] => {
      const name = nearestColorName(swatch.hex);
      return name ? [{ name, hex: swatch.hex, weight: swatch.share }] : [];
    });

    return {
      cutoutUri: subject?.uri ?? null,
      plateUri: result.plate?.uri ?? null,
      colors: colors.length > 0 ? colors : null,
      // The full histogram, kept unrounded. Normalization and clustering will
      // both be re-tuned, and having the measurement on the row means that is a
      // re-derivation rather than a re-import.
      analysis:
        result.colors.length > 0
          ? { version: 1, source: 'vision-oklab-median-cut', swatches: result.colors }
          : null,
    };
  } catch {
    // A cutout must NEVER fail an import. The garment is the point; the
    // transparent version of it is a nicety. `remove()` already converts its own
    // failures into results, so reaching here means something outside it broke.
    track('cutout_result', { outcome: 'failed', subjectCount: 0 });
    return NO_CUTOUT;
  }
}

/**
 * Put the measured colours back on the row after tagging.
 *
 * `tag-item` overwrites `colors` with the model's name-only entries, and says so
 * itself: hex "is extracted on-device from the actual pixels ... and enriched
 * client-side". This is that enrichment. It has to run AFTER the tag, not only
 * before it, because the Edge Function's update lands on top of whatever the
 * upload wrote — measured hex would otherwise be destroyed on every item that
 * tags successfully, which is to say on almost all of them.
 *
 * The tradeoff taken here is that the model's richer wording ("washed indigo")
 * is replaced by the nearest table name ("denim"). A true merge needs the
 * tagger's names read back, which is a round trip per item during a 60-photo
 * import; a correct value beats a prettier label until that is measured to matter.
 *
 * Never fatal. A row with name-only colours is the status quo, not a broken item.
 *
 * NOT wired into `sweepPendingTags` yet. Items tagged by a later sweep keep the
 * model's names and lose their hex, and recovering it there means reading
 * `color_analysis` back off the row — which is exactly why the full histogram is
 * stored rather than only the three winners.
 */
async function reapplyMeasuredColors(itemId: string, colors: MeasuredColor[]): Promise<void> {
  try {
    await supabase.from('items').update({ colors }).eq('id', itemId);
  } catch {
    // The garment is saved and tagged. Colour is the part that can wait.
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

  // 2. Cutout, plate render and colour measurement — one native Vision pass.
  //    A failure here is expected and non-fatal — an unliftable photo
  //    (patterned background, sheer fabric, white-on-white) still becomes a
  //    perfectly usable item, just without a transparent cutout.
  update(job.id, { stage: 'cutout' });
  const cutout = await runCutout(job.localUri);

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
    update(job.id, { progress: p * 0.5 }),
  );
  await uploadObject(thumb.uri, `${base}/thumb.jpg`, 'image/jpeg', (p) =>
    update(job.id, { progress: 0.5 + p * 0.2 }),
  );
  // The cutout and the plate are separate objects on purpose: the plate's
  // normalization will be re-tuned, and re-rendering from the stored cutout is
  // free where re-lifting from the original is a Vision pass per item.
  if (cutout.cutoutUri) {
    await uploadObject(cutout.cutoutUri, `${base}/cutout.png`, 'image/png', (p) =>
      update(job.id, { progress: 0.7 + p * 0.15 }),
    );
  }
  if (cutout.plateUri) {
    await uploadObject(cutout.plateUri, `${base}/plate.png`, 'image/png', (p) =>
      update(job.id, { progress: 0.85 + p * 0.15 }),
    );
  }

  const { error: updateError } = await supabase
    .from('items')
    .update({
      image_path: `${base}/original.jpg`,
      thumb_path: `${base}/thumb.jpg`,
      cutout_path: cutout.cutoutUri ? `${base}/cutout.png` : null,
      plate_path: cutout.plateUri ? `${base}/plate.png` : null,
      // Written here as well as after tagging, because an item that never gets
      // tagged (consent withdrawn, model outage) should still carry its real
      // colours rather than none at all.
      ...(cutout.colors ? { colors: cutout.colors } : {}),
      ...(cutout.analysis ? { color_analysis: cutout.analysis } : {}),
      status: 'pending_tag',
    })
    .eq('id', itemId);
  if (updateError) throw new Error(`Could not record upload: ${updateError.message}`);

  // 5. Request tagging. A failure here is explicitly NOT fatal to the import:
  //    the item is already saved. But it is not `done` either — the job stays
  //    at `tagging` so the screen keeps counting it as in progress and the
  //    sweep picks it up, rather than reporting "All done" over a row that is
  //    still sitting at `pending_tag`.
  update(job.id, { stage: 'tagging', progress: 1, error: undefined });

  const outcome = await requestTag(itemId);

  if (outcome.kind === 'settled') {
    // Before the invalidation, so the closet's refetch already sees real hex
    // rather than showing model-named swatches for a beat and then swapping.
    if (cutout.colors) await reapplyMeasuredColors(itemId, cutout.colors);

    update(job.id, { stage: 'done' });
    invalidateAfterItemSettled();
    // After the durable write, so a crash between tag and track loses the
    // event rather than fabricating one for an item that never landed.
    track('clothes_import_completed', { path: 'queue' });
    return;
  }

  if (outcome.kind === 'consent') {
    // Terminal on purpose. Every retry would be another guaranteed 403, and the
    // user turned this off deliberately — the garment is still in their closet,
    // it just has no machine-written tags.
    update(job.id, { stage: 'failed', error: CONSENT_WITHDRAWN_MESSAGE });
    return;
  }

  // Left at `tagging` with the reason attached. `processJob` must NOT throw
  // here: the caller treats a throw as "retry the whole job", which would
  // re-encode and re-upload three objects for a failure that is only about the
  // last call.
  update(job.id, { error: outcome.message });
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

  // Anything the batch left at `tagging` is now the sweep's problem. Rate
  // limiting inside it means this is a nudge, not a guarantee of a pass here.
  void sweepPendingTags();
}

// ---------------------------------------------------------------------------
// Recovery sweep
// ---------------------------------------------------------------------------

/** Never more than this many items in one pass, however many are outstanding. */
const SWEEP_BATCH = 25;
/** Floor between passes, so foregrounding the app repeatedly cannot stampede. */
const SWEEP_MIN_INTERVAL_MS = 60_000;
/** Ceiling on the backoff — a day-long outage should still retry hourly. */
const SWEEP_MAX_INTERVAL_MS = 30 * 60_000;

let sweeping = false;
let sweepInterval = SWEEP_MIN_INTERVAL_MS;
let nextSweepAt = 0;

/**
 * Re-drives items whose upload finished but whose tagging never did — the
 * normal outcome when a user backgrounds the app mid-import, and now also the
 * outcome when `tag-item` returns a transient failure.
 *
 * Three properties this has to have, all learned the hard way:
 *
 * 1. **Consent-gated.** A user who withdraws AI consent has every `tag-item`
 *    call refused with 403, and `needs_review` items are permanently in the
 *    candidate set — so an ungated sweep would fire up to fifty guaranteed
 *    failures on every single launch, forever. Consent is checked once up
 *    front, and an `ai_consent_required` answer aborts the pass immediately
 *    rather than working through the rest of the batch.
 *
 * 2. **Deduplicated.** Launch and the first foreground transition can arrive
 *    within milliseconds of each other; without the `sweeping` guard both
 *    passes would tag the same items twice and pay for both model calls.
 *
 * 3. **Backed off.** Repeated failure doubles the interval up to half an hour,
 *    so a provider outage costs a handful of requests rather than one per
 *    foreground for as long as it lasts.
 *
 * `needs_review` is included deliberately: those rows carry no tags, and a
 * later attempt against a healthy model often succeeds where the first did not.
 */
export async function sweepPendingTags(): Promise<void> {
  if (sweeping || Date.now() < nextSweepAt) return;
  sweeping = true;

  try {
    const userId = await getUserId();
    if (!userId) return;

    if (!(await hasAiConsent(userId))) {
      // Not a failure, so the backoff is left alone — but nothing here will
      // work until consent is granted again, and granting it invalidates the
      // consent query and brings the user back through capture anyway.
      nextSweepAt = Date.now() + SWEEP_MAX_INTERVAL_MS;
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['pending_tag', 'needs_review'])
      .limit(SWEEP_BATCH);

    if (error || !data?.length) {
      nextSweepAt = Date.now() + SWEEP_MIN_INTERVAL_MS;
      return;
    }

    let failures = 0;

    for (const row of data) {
      const outcome = await requestTag(row.id);

      if (outcome.kind === 'settled') {
        settleJobsForItem(row.id, { stage: 'done', error: undefined });
        invalidateAfterItemSettled();
        track('clothes_import_completed', { path: 'sweep' });
        continue;
      }

      if (outcome.kind === 'consent') {
        // Consent changed underneath us between the check above and now. Stop:
        // every remaining item in the batch would fail identically.
        settleJobsForItem(row.id, { stage: 'failed', error: CONSENT_WITHDRAWN_MESSAGE });
        nextSweepAt = Date.now() + SWEEP_MAX_INTERVAL_MS;
        return;
      }

      failures += 1;
      settleJobsForItem(row.id, { error: outcome.message });
    }

    // Back off only when the whole batch failed; a partial success means the
    // service is up and the remainder is worth another try soon.
    sweepInterval =
      failures === data.length
        ? Math.min(sweepInterval * 2, SWEEP_MAX_INTERVAL_MS)
        : SWEEP_MIN_INTERVAL_MS;
    nextSweepAt = Date.now() + sweepInterval;
  } finally {
    sweeping = false;
  }
}

let sweeperStarted = false;

/**
 * Wire the sweep to the app's lifecycle.
 *
 * Called once from Today, which is the first authenticated screen — the sweep
 * needs a session, so anywhere above the auth gate would run it signed out and
 * achieve nothing.
 *
 * Foregrounding is the trigger, not network recovery: NetInfo is not a
 * dependency of this app and adding one for this would be disproportionate.
 * Coming back to the app is in practice when a user has signal again, and
 * `sweepPendingTags` is idempotent and rate-limited, so an early attempt on a
 * dead connection costs one failed request and a longer wait.
 *
 * The listener is never removed. That is deliberate — it lives as long as the
 * process does, and there is exactly one.
 */
export function startTagSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;

  void sweepPendingTags();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void sweepPendingTags();
  });
}

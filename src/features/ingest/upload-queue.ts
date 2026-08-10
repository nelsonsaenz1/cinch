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

import { deleteLocalPhoto, getLocalPhoto, saveLocalPhoto } from './local-photos';
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
/**
 * How many times one garment may be sent to `tag-item` before the job gives up
 * and says so on screen.
 *
 * There used to be no such number, and that is the whole of the "it just
 * continuously loads and loads" bug. A transient tagging failure left the job
 * parked at `tagging` with a message nobody rendered, `selectActiveCount` kept
 * counting it as in-flight, and the only thing that could ever move it was a
 * sweep that is rate-limited to once a minute and silently returns early when
 * one is already running. A failure the user cannot see and cannot act on is
 * indistinguishable from a spinner that never stops, so tagging now terminates:
 * three tries, then a visible, retryable failure.
 */
const MAX_TAG_ATTEMPTS = 3;
/** Backoff between tag attempts within a single job run. */
const TAG_RETRY_DELAY_MS = 1200;
const BUCKET = 'garments';

/**
 * The one consent-refusal sentence, written to be TRUE for both people who
 * can receive it. `ai_consent_required` covers a user who turned tagging off
 * AND a user whose recorded consent predates a policy-version bump (their
 * version is non-null but below current — they never opted out, the text
 * changed under them). "Turned off for your account" was a lie to the second
 * group; "needs your OK in Settings" is a fact and an invitation for both,
 * without an async profile read inside sync classification.
 */
const CONSENT_WITHDRAWN_MESSAGE =
  'Saved, but not tagged — AI tagging needs your OK in Settings.';

/**
 * What a stopped garment is called ON SCREEN.
 *
 * `job.error` is a DIAGNOSTIC string and stays one — it carries HTTP status
 * detail, Edge Function messages and raw `Error.message` text, all of it
 * valuable in a log and none of it a sentence to put in front of somebody
 * looking at a photograph of a jumper. The capture banner used to render it
 * verbatim, so a JWKS misconfiguration read as "Cinch couldn't verify your
 * account" and a storage timeout as whatever the network layer happened to
 * throw.
 *
 * Three outcomes are all a person can act on here, so there are three
 * sentences: the photo was unreadable (nothing to retry — reshoot it), the
 * transfer stopped (retry), or the tag never happened because AI is off (the
 * garment is saved, and the fix is in Profile). Everything else lands on the
 * transfer line, which is the honest general case: the piece is in the closet
 * and something between here and the tag did not finish.
 *
 * Deliberately not written back into `job.error` — the queue keeps the truth,
 * the screen gets the sentence.
 */
export function userFacingFailure(job: Pick<UploadJob, 'error'> | undefined): string {
  const raw = job?.error ?? '';

  // The one failure a retry cannot help and the user can genuinely fix: the
  // consent record the Edge Function checks is absent, withdrawn, or from an
  // older policy version. Phrased as the fix rather than a state claim —
  // "off" was false for a version-bump user who never opted out (see
  // CONSENT_WITHDRAWN_MESSAGE).
  if (raw === CONSENT_WITHDRAWN_MESSAGE || raw.includes('ai_consent_required')) {
    return 'Tagging needs your OK in Settings, so this one stayed untagged.';
  }

  // A photograph that could not be decoded, downscaled or cut out never became
  // an upload at all — there is nothing on the far end to finish.
  if (/decode|unsupported|corrupt|read the image|prepare/i.test(raw)) {
    return 'Cinch couldn’t read that photo.';
  }

  return 'That upload didn’t finish.';
}

/**
 * The same failure, as a bounded value for `clothes_import_failed`.
 *
 * `job.error` is free text: it holds the Edge Function's sentence, a Supabase
 * error message, or whatever a thrown `Error` carried, and any of those can
 * embed a path, an id or a server detail. It is written for the banner and it
 * is not something to hand an analytics vendor — see the privacy note at the
 * top of `lib/posthog.tsx`, which exists to refuse exactly this.
 *
 * So the message is READ here and never SENT. The classification is by the
 * same means `userFacingFailure` above already uses — the messages being
 * matched are this file's own constants from `classify()` — and everything
 * unrecognised lands on 'unknown' rather than leaking. 'unknown' rising is
 * itself the signal that a new failure mode needs a name here.
 *
 * Nine values, and that is the whole vocabulary:
 *   consent_missing · unverified_session · quota_exhausted · item_missing ·
 *   bad_request · photo_unreadable · row_write_failed · not_signed_in · unknown
 */
function analyticsFailureReason(error: string | undefined): string {
  const raw = error ?? '';
  if (!raw) return 'unknown';

  // Account-level refusals from `classify()`, in its own order.
  if (raw === CONSENT_WITHDRAWN_MESSAGE || raw.includes('ai_consent_required')) {
    return 'consent_missing';
  }
  if (raw.includes('couldn’t verify your account')) return 'unverified_session';
  if (raw.includes('tagging allowance')) return 'quota_exhausted';
  if (raw.includes('find this garment')) return 'item_missing';
  if (raw.includes('read this request')) return 'bad_request';

  // Local pipeline failures, thrown rather than returned.
  if (/decode|unsupported|corrupt|read the image|prepare/i.test(raw)) return 'photo_unreadable';
  if (/Could not create item|Could not record upload/i.test(raw)) return 'row_write_failed';
  if (raw.includes('Not signed in')) return 'not_signed_in';

  return 'unknown';
}

let running = 0;
let draining = false;
/** Job ids whose tagging loop is running right now — see `driveTagging`. */
const driving = new Set<string>();

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
  | { kind: 'settled'; status: 'tagged' | 'needs_review'; label?: string }
  /**
   * Answered, and the answer is no. Another identical call is not going to
   * change it, so the queue must stop rather than loop — `accountWide` says
   * whether the rest of the batch is refused for the same reason.
   */
  | { kind: 'blocked'; message: string; retryable: boolean; accountWide: boolean }
  /** Transient: the row is still `pending_tag` and another attempt is worth it. */
  | { kind: 'retry'; message: string };

type TagResponseBody = {
  ok?: boolean;
  status?: string;
  error?: string;
  tags?: { category?: string | null; subcategory?: string | null } | null;
};

/**
 * What a garment should be called on the status rail.
 *
 * Subcategory when the tagger produced one ("Knit"), the broad category
 * otherwise ("Top"). Never a placeholder: an item with no usable name shows its
 * stage instead, which is at least true.
 */
function labelFor(tags: TagResponseBody['tags']): string | undefined {
  const raw = tags?.subcategory ?? tags?.category;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Status code and parsed body from a non-2xx invoke, as far as either can be read. */
async function readHttpError(
  error: unknown,
): Promise<{ status: number | null; body: TagResponseBody | null }> {
  if (!(error instanceof FunctionsHttpError)) return { status: null, body: null };
  const response = (error as { context?: unknown }).context as Response | undefined;
  if (!response) return { status: null, body: null };
  try {
    return { status: response.status, body: (await response.json()) as TagResponseBody };
  } catch {
    // A non-JSON error body still has a status, and the status is the half that
    // decides whether retrying is pointless.
    return { status: response.status, body: null };
  }
}

/**
 * Turn an HTTP status from `tag-item` into a decision.
 *
 * The old code had exactly one branch here — consent — and treated *everything
 * else* as retryable, forever. That is what turned a 401 into an infinite
 * spinner: `withSupabase({ auth: 'user' })` was refusing every request with
 * `INVALID_CREDENTIALS` because the function had no JWKS to verify against, and
 * the client answered by asking again on every sweep, for as long as the app
 * was installed. A 4xx is the server saying it understood and declined; asking
 * an identical question again is not a recovery strategy.
 */
function classify(status: number | null, body: TagResponseBody | null): TagOutcome {
  const detail = body?.error;

  if (status === 403 && detail === 'ai_consent_required') {
    return {
      kind: 'blocked',
      message: CONSENT_WITHDRAWN_MESSAGE,
      retryable: false,
      accountWide: true,
    };
  }

  if (status === 401 || status === 403) {
    // Either the session is stale or the function cannot verify tokens at all.
    // Both are real, both are fixed elsewhere, and neither is fixed by looping.
    // The cure this used to prescribe — "sign out and back in" — was a cure for
    // a fault the user does not have. A 401 here is as often the function
    // failing to verify tokens at all as it is a stale session, and sending
    // somebody to destroy a working session over our outage costs them their
    // place and fixes nothing. Say whose problem it is, and keep the retry.
    return {
      kind: 'blocked',
      message: 'Saved, but not tagged — Cinch couldn’t verify your account. That one is on us; try again in a bit.',
      retryable: true,
      accountWide: true,
    };
  }

  if (status === 429) {
    return {
      kind: 'blocked',
      message: 'Saved, but not tagged — you’ve used this period’s tagging allowance.',
      retryable: true,
      accountWide: true,
    };
  }

  if (status === 404) {
    return {
      kind: 'blocked',
      message: 'Saved, but not tagged — Cinch couldn’t find this garment to tag.',
      retryable: false,
      accountWide: false,
    };
  }

  if (status === 400) {
    return {
      kind: 'blocked',
      message: 'Saved, but not tagged — Cinch couldn’t read this request.',
      retryable: false,
      accountWide: false,
    };
  }

  // 409 (another invocation holds the claim), 5xx, and every network failure:
  // the item is genuinely still on its way.
  return { kind: 'retry', message: detail ?? 'Tagging didn’t finish. Cinch will try again.' };
}

/** Ask the Edge Function to tag one item, and report what actually happened. */
async function requestTag(itemId: string): Promise<TagOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<TagResponseBody>('tag-item', {
      body: { itemId },
    });

    if (error) {
      const { status, body } = await readHttpError(error);
      return classify(status, body);
    }

    // 200, but the body decides. `needs_review` is a settled outcome — the item
    // is waiting in the review deck, not waiting on another call.
    if (data?.status === 'tagged' || data?.status === 'needs_review') {
      return { kind: 'settled', status: data.status, label: labelFor(data.tags) };
    }

    return { kind: 'retry', message: data?.error ?? 'Tagging didn’t finish. Cinch will try again.' };
  } catch (err) {
    return { kind: 'retry', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ask for a tag until the answer settles, and keep one queue job honest about it.
 *
 * Shared by both ways a garment gets in, and that sharing is the point. The
 * photographed path always had this loop; the described path had nothing — it
 * created the row and left, so a tagging failure on an imported garment had
 * nowhere to appear and no retry to offer. One loop means one set of rules
 * about when to stop, one place the reason is written down, and one banner.
 *
 * `onSettled` runs before the job is marked done — the photo path uses it to
 * put its measured colours back on the row before the closet refetches.
 */
async function driveTagging(
  jobId: string,
  itemId: string,
  opts: { path: string; onSettled?: () => Promise<void> },
): Promise<void> {
  const { update } = useQueueStore.getState();
  // A described import is tagged OUTSIDE the drain loop, so a photo batch
  // started while one is in flight would reach `resumeStalledTagging`, find a
  // job sitting at `tagging`, and pay for a second identical model call.
  // Anything in this set is being driven right now and is nobody else's to
  // rescue.
  driving.add(jobId);
  update(jobId, { stage: 'tagging', progress: 1, error: undefined });

  let lastMessage = 'Tagging didn’t finish.';

  try {
    for (let attempt = 0; attempt < MAX_TAG_ATTEMPTS; attempt++) {
      update(jobId, { tagAttempts: attempt + 1 });
      const outcome = await requestTag(itemId);

      if (outcome.kind === 'settled') {
        await opts.onSettled?.();
        update(jobId, { stage: 'done', error: undefined, label: outcome.label });
        invalidateAfterItemSettled();
        // After the durable write, so a crash between tag and track loses the
        // event rather than fabricating one for an item that never landed.
        track('clothes_import_completed', { path: opts.path });
        return;
      }

      if (outcome.kind === 'blocked') {
        // Answered and declined. Retrying is a guaranteed identical answer, so
        // this stops here and says why — the garment is in the closet either way.
        update(jobId, { stage: 'failed', error: outcome.message, retryable: outcome.retryable });
        invalidateAfterItemSettled();
        track('clothes_import_failed', {
          stage: 'tagging',
          reason: analyticsFailureReason(outcome.message),
          retryable: outcome.retryable,
        });
        return;
      }

      lastMessage = outcome.message;
      // Show the reason while the retries run, so a slow recovery reads as a
      // recovery rather than as nothing happening.
      update(jobId, { error: lastMessage });
      if (attempt < MAX_TAG_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, TAG_RETRY_DELAY_MS * (attempt + 1)));
      }
    }

    // Out of tries. The photograph is uploaded and the row exists at
    // `pending_tag`, so the sweep may still rescue it later and will flip this
    // job back to `done` if it does — but the screen stops pretending and offers
    // the user the retry instead.
    update(jobId, {
      stage: 'failed',
      error: `${lastMessage} Your garment is saved — tap retry to tag it.`,
      retryable: true,
    });
    invalidateAfterItemSettled();
    // Out of tries after MAX_TAG_ATTEMPTS, not refused. `reason` classifies the
    // last transient message, which is usually 'unknown' — the interesting
    // property here is `attempts`, because a queue exhausting its retries is a
    // different fault from one being told no on the first call.
    track('clothes_import_failed', {
      stage: 'tagging',
      reason: analyticsFailureReason(lastMessage),
      retryable: true,
      attempts: MAX_TAG_ATTEMPTS,
    });
  } finally {
    driving.delete(jobId);
  }
}

/**
 * Put a DESCRIBED garment on the same rail as a photographed one.
 *
 * The import Edge Function has already fetched the picture and written the row
 * at `pending_tag`, so there is nothing to encode, cut out or upload — but the
 * tag still has to happen, and until now it was handed to `sweepPendingTags`
 * and forgotten. That sweep is rate-limited to once a minute and returns early
 * when one is already running, so "describe it instead" could produce a garment
 * that was invisible on capture (no job, no progress, no failure) and invisible
 * on review (the deck only lists `tagged` and `needs_review`). A job here is
 * what makes the described path show its work in the one place the design puts
 * progress — frame 07 — and land in the deck, frame 08, when there is a result.
 */
export async function tagImportedGarment(itemId: string, previewUri: string): Promise<void> {
  // Keyed by item so a double-tap on the same tile cannot create two jobs; the
  // store also refuses a duplicate id outright.
  const jobId = `import-${itemId}`;
  useQueueStore.getState().enqueueTagging({ id: jobId, localUri: previewUri, itemId });
  await driveTagging(jobId, itemId, { path: 'describe' });
}

/** Move every queue job pointing at this item to a stage, with an explanation. */
function settleJobsForItem(itemId: string, patch: Partial<UploadJob>): void {
  const { jobs, update } = useQueueStore.getState();
  for (const job of jobs) {
    if (job.itemId === itemId) update(job.id, patch);
  }
}

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

/**
 * The local-mode pipeline — declining AI tagging is a working mode (A-04).
 *
 * Same on-device work as the ordinary path: downscale, thumbnail, and the one
 * native Vision pass for the cutout's measured colours (all of which happens
 * on this phone and sends nothing anywhere). Then the two steps that would
 * move data off the device are simply absent: no Storage upload, no `tag-item`
 * call. The row is created with `image_path` null and status `verified` —
 * the honest terminal status in the vocabulary, because in local mode the tags
 * are the user's own words from the moment they exist; there is no AI pass
 * awaiting review (so the review deck, which selects `tagged`/`needs_review`,
 * never lists it) and nothing pending (so `sweepPendingTags`, which selects
 * `pending_tag`/`needs_review`, can never pick it up). The photos land in the
 * local photo store, keyed by the item id.
 */
async function processLocalJob(job: UploadJob, userId: string): Promise<void> {
  const { update } = useQueueStore.getState();

  update(job.id, { stage: 'preparing' });
  const prepared = await prepareForUpload(job.localUri, job.width, job.height);
  const thumb = await prepareThumbnail(job.localUri, job.width, job.height);

  // The cutout runs for its colour measurement — the one piece of AI-free
  // metadata a local item can still carry, and it syncs because it is words
  // and hex, not pixels.
  update(job.id, { stage: 'cutout' });
  const cutout = await runCutout(job.localUri);

  let itemId = job.itemId;
  if (!itemId) {
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        status: 'verified',
        ...(cutout.colors ? { colors: cutout.colors } : {}),
        ...(cutout.analysis ? { color_analysis: cutout.analysis } : {}),
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`Could not create item: ${error?.message}`);
    itemId = data.id;
    update(job.id, { itemId });
  }
  if (!itemId) throw new Error('Item id missing after creation.');

  await saveLocalPhoto(itemId, prepared.uri, thumb.uri);

  update(job.id, { stage: 'done', error: undefined });
  invalidateAfterItemSettled();
  track('clothes_import_completed', { path: 'local' });
}

async function processJob(job: UploadJob): Promise<void> {
  const { update } = useQueueStore.getState();

  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');

  // The declined-consent path never uploads and never tags — see the promise
  // spelled out on `processLocalJob`.
  if (job.local) {
    await processLocalJob(job, userId);
    return;
  }

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
  //    the item is already saved. But it must still REACH AN END. Up to
  //    MAX_TAG_ATTEMPTS tries with a short backoff, then the job is marked
  //    `failed` with the reason on it — never left at `tagging` for a sweep
  //    that may not run for an hour, which is what made this look like an
  //    import that loads forever.
  // Re-bound as a const: the narrowing above does not survive being captured by
  // the callback below, and a `let` would come back in as `string | undefined`.
  const taggedItemId = itemId;
  const measured = cutout.colors;
  await driveTagging(job.id, taggedItemId, {
    path: 'queue',
    // Before the job settles, so the closet's refetch already sees real hex
    // rather than showing model-named swatches for a beat and then swapping.
    onSettled: measured ? () => reapplyMeasuredColors(taggedItemId, measured) : undefined,
  });
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
          const exhausted = attempts >= MAX_ATTEMPTS;
          // Read BEFORE the update below, because that update overwrites it:
          // the store still holds the stage the job actually died at, which is
          // the one fact this event exists to carry. `processJob` walks
          // preparing → cutout → uploading → tagging and the difference between
          // "the phone could not cut this photo out" and "the upload never
          // landed" is the difference between a device problem and a network
          // one.
          const diedAt =
            useQueueStore.getState().jobs.find((j) => j.id === next.id)?.stage ?? 'preparing';
          useQueueStore.getState().update(next.id, {
            stage: exhausted ? 'failed' : 'queued',
            error: message,
            // Encoding, cutting out and uploading are all things that fail for
            // reasons that pass — signal, storage, memory pressure. Worth
            // offering again rather than presenting as final.
            retryable: exhausted ? true : undefined,
          });
          // ONLY when the job is actually finished. The other branch puts it
          // back on the queue with attempts left, and an import that stumbles
          // twice and then succeeds is a success — counting its stumbles would
          // turn the import failure rate into a measure of network weather
          // rather than of garments lost.
          if (exhausted) {
            track('clothes_import_failed', {
              stage: diedAt,
              reason: analyticsFailureReason(message),
              retryable: true,
              attempts,
            });
          }
        })
        .finally(() => {
          running -= 1;
        });
    }
  } finally {
    draining = false;
  }

  // The loop above only exits with `running === 0` and nothing queued, so any
  // job still sitting at `tagging` here is not in flight — it is one a previous
  // session was killed in the middle of and `hydrate` restored. Finishing those
  // is done HERE rather than delegated to the sweep, because the sweep is
  // rate-limited to once a minute and returns early when one is already running:
  // handing it a stalled job is a hope, not a handover, and hoping is what left
  // the founder's import spinning.
  await resumeStalledTagging();

  // The sweep still runs, as the long-tail recovery for rows the app has no
  // local job for at all — an import finished on another device, or a queue
  // entry that aged out of storage.
  void sweepPendingTags();
}

/**
 * Finish tagging for jobs a previous run left mid-flight.
 *
 * Only safe to call when the drain loop has gone quiet — see the call site.
 * Every job either settles, fails visibly, or is handed to the sweep with its
 * attempt count already spent; none of them may go back to waiting silently.
 */
async function resumeStalledTagging(): Promise<void> {
  const stalled = useQueueStore
    .getState()
    .jobs.filter((j) => j.stage === 'tagging' && !driving.has(j.id));

  for (const job of stalled) {
    const { update } = useQueueStore.getState();
    const itemId = job.itemId;
    // No row yet means the kill landed before the insert; the whole job has to
    // run again from the top rather than be tagged.
    if (!itemId) {
      update(job.id, { stage: 'queued', progress: 0, error: undefined });
      continue;
    }

    if (job.tagAttempts >= MAX_TAG_ATTEMPTS) {
      update(job.id, {
        stage: 'failed',
        error: `${job.error ?? 'Tagging didn’t finish.'} Your garment is saved — tap retry to tag it.`,
        retryable: true,
      });
      // A job a previous launch left mid-flight with its attempts already
      // spent. It is being failed here rather than retried, so it is terminal
      // and counts once, on this launch — the launch that killed it never got
      // to emit anything.
      track('clothes_import_failed', {
        stage: 'tagging',
        reason: analyticsFailureReason(job.error),
        retryable: true,
        attempts: job.tagAttempts,
      });
      continue;
    }

    update(job.id, { tagAttempts: job.tagAttempts + 1 });
    const outcome = await requestTag(itemId);

    if (outcome.kind === 'settled') {
      update(job.id, { stage: 'done', error: undefined, label: outcome.label });
      invalidateAfterItemSettled();
      track('clothes_import_completed', { path: 'resume' });
      continue;
    }

    const retryable = outcome.kind === 'blocked' ? outcome.retryable : true;
    update(job.id, {
      stage: 'failed',
      error:
        outcome.kind === 'blocked'
          ? outcome.message
          : `${outcome.message} Your garment is saved — tap retry to tag it.`,
      retryable,
    });
    // Terminal by construction: this function's contract is that a resumed job
    // settles, fails visibly, or is handed on with its attempts spent, and this
    // is the failure arm of it. Reached for a `retry` outcome as well as a
    // `blocked` one, because a resumed job gets one attempt and no loop.
    track('clothes_import_failed', {
      stage: 'tagging',
      reason: analyticsFailureReason(outcome.message),
      retryable,
      attempts: job.tagAttempts + 1,
    });
  }
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
      // Defense in depth for the local-mode guarantee (frame A-06): an item
      // whose photo never left the phone has no `image_path`, and flipping
      // consent back on must NEVER retroactively drag it into a tagging pass.
      // Local items are also `verified` and so outside the status filter —
      // but a promise this explicit gets enforced twice.
      .not('image_path', 'is', null)
      .limit(SWEEP_BATCH);

    if (error || !data?.length) {
      nextSweepAt = Date.now() + SWEEP_MIN_INTERVAL_MS;
      return;
    }

    let failures = 0;

    for (const row of data) {
      const outcome = await requestTag(row.id);

      if (outcome.kind === 'settled') {
        // A job this sweep rescued may well be sitting at `failed` from an
        // earlier run — clearing the error is what lets a late success undo a
        // visible failure rather than leaving both on screen at once.
        settleJobsForItem(row.id, {
          stage: 'done',
          error: undefined,
          retryable: undefined,
          label: outcome.label,
        });
        invalidateAfterItemSettled();
        track('clothes_import_completed', { path: 'sweep' });
        continue;
      }

      if (outcome.kind === 'blocked') {
        settleJobsForItem(row.id, {
          stage: 'failed',
          error: outcome.message,
          retryable: outcome.retryable,
        });
        // The sweep's only terminal transition. Its `retry` arm below writes a
        // message onto the job and leaves the stage alone for the next pass,
        // so it is not a failure yet and emits nothing — the same rule the
        // drain loop's re-queue branch follows.
        track('clothes_import_failed', {
          stage: 'tagging',
          reason: analyticsFailureReason(outcome.message),
          retryable: outcome.retryable,
        });
        // An account-wide refusal — consent withdrawn, session unverifiable,
        // allowance spent — refuses the rest of this batch identically. Stop
        // rather than work through fifty guaranteed failures.
        if (outcome.accountWide) {
          nextSweepAt = Date.now() + SWEEP_MAX_INTERVAL_MS;
          return;
        }
        continue;
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

// ---------------------------------------------------------------------------
// Backfill — the explicit way back from local mode
// ---------------------------------------------------------------------------

let backfilling = false;

/**
 * "Tag the N items I already have" (frame A-06) — one explicit pass, then stop.
 *
 * This is the ONLY code that moves a local-mode photo off the device, and it
 * runs solely when the user asks for it from the Privacy screen. Turning
 * tagging back on does not call this; nothing calls this on a timer.
 *
 * Two kinds of candidate, one decision each:
 *
 * - `image_path` null with photos in THIS device's local store: the local
 *   files are uploaded through the ordinary Storage path, the row gains its
 *   `image_path` at `pending_tag`, the now-redundant local copies are removed,
 *   and tagging is driven through the same loop a fresh import uses. An
 *   `image_path`-null item with no local photo — added from another device,
 *   or a `pending_upload` row a crash orphaned — is skipped silently: there is
 *   nothing here to send.
 *
 * - A server `image_path` but tagging never settled (`pending_tag` /
 *   `needs_review`): re-driven through the same tagging loop directly. No
 *   queue job exists for these, and `driveTagging`'s store writes no-op
 *   harmlessly against an absent id.
 *
 * Consent-gated exactly as normal tagging is (and the Edge Function enforces
 * it again server-side); sequential like `retryFailedJobs`, because a backfill
 * is a background courtesy, not a stampede. Returns how many items were
 * actually put through.
 */
export async function startBackfill(): Promise<{ enqueued: number }> {
  if (backfilling) return { enqueued: 0 };
  backfilling = true;

  try {
    const userId = await getUserId();
    if (!userId) return { enqueued: 0 };
    if (!(await hasAiConsent(userId))) return { enqueued: 0 };

    const { data, error } = await supabase
      .from('items')
      .select('id, image_path')
      .eq('user_id', userId)
      .or('image_path.is.null,status.in.(pending_tag,needs_review)');
    if (error || !data?.length) return { enqueued: 0 };

    let enqueued = 0;

    for (const row of data) {
      if (!row.image_path) {
        const local = await getLocalPhoto(row.id);
        // Photos on another phone (or nowhere) cannot be backfilled from here.
        if (!local) continue;

        const base = `${userId}/${row.id}`;
        const jobId = `backfill-${row.id}`;
        // On the rail like any other in-flight garment, so a user who wanders
        // to capture sees the pass they started rather than silence.
        useQueueStore
          .getState()
          .enqueueTagging({ id: jobId, localUri: local.thumbUri, itemId: row.id });

        try {
          await uploadObject(local.imageUri, `${base}/original.jpg`, 'image/jpeg');
          await uploadObject(local.thumbUri, `${base}/thumb.jpg`, 'image/jpeg');
          const { error: updateError } = await supabase
            .from('items')
            .update({
              image_path: `${base}/original.jpg`,
              thumb_path: `${base}/thumb.jpg`,
              status: 'pending_tag',
            })
            .eq('id', row.id);
          if (updateError) throw new Error(`Could not record upload: ${updateError.message}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          useQueueStore
            .getState()
            .update(jobId, { stage: 'failed', error: message, retryable: true });
          // The backfill's upload arm. `stage: 'uploading'` rather than the
          // job's own stage because this try block IS the upload — the two
          // `uploadObject` calls and the row write that records them — and
          // there is no other step it could have died at.
          track('clothes_import_failed', {
            stage: 'uploading',
            reason: analyticsFailureReason(message),
            retryable: true,
          });
          continue;
        }

        // The server holds the photo now; the local copy has done its job.
        await deleteLocalPhoto(row.id);
        await driveTagging(jobId, row.id, { path: 'backfill' });
        enqueued += 1;
        continue;
      }

      // Uploaded but never (successfully) tagged — re-drive the tag alone.
      await driveTagging(`backfill-${row.id}`, row.id, { path: 'backfill' });
      enqueued += 1;
    }

    return { enqueued };
  } finally {
    backfilling = false;
  }
}

// ---------------------------------------------------------------------------
// User-initiated retry
// ---------------------------------------------------------------------------

/**
 * Try a failed job again, because the user asked.
 *
 * Two routes, and the difference matters. A job that already has an `itemId`
 * got its photographs uploaded and its row written — only the tag is missing —
 * so it re-asks for the tag alone. Re-encoding and re-uploading three objects
 * to fix a failed 200-byte function call is minutes of a stranger's battery
 * spent on nothing. A job that never reached an item id has no such shortcut
 * and goes back through the queue from the top.
 *
 * The sweep's rate limit is cleared here on purpose: an explicit tap is exactly
 * the moment the backoff should not apply.
 */
export async function retryJob(jobId: string): Promise<void> {
  const { jobs, update } = useQueueStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job || job.stage !== 'failed') return;

  if (!job.itemId) {
    update(jobId, {
      stage: 'queued',
      attempts: 0,
      tagAttempts: 0,
      error: undefined,
      retryable: undefined,
      progress: 0,
    });
    nextSweepAt = 0;
    sweepInterval = SWEEP_MIN_INTERVAL_MS;
    await drainQueue();
    return;
  }

  update(jobId, { stage: 'tagging', progress: 1, error: undefined, retryable: undefined });
  const outcome = await requestTag(job.itemId);

  if (outcome.kind === 'settled') {
    update(jobId, { stage: 'done', error: undefined, retryable: undefined, label: outcome.label });
    invalidateAfterItemSettled();
    track('clothes_import_completed', { path: 'retry' });
    return;
  }

  const retryable = outcome.kind === 'blocked' ? outcome.retryable : true;
  update(jobId, {
    stage: 'failed',
    tagAttempts: job.tagAttempts + 1,
    error: outcome.message,
    retryable,
  });
  // A retry the user asked for, that failed again. Counted like any other
  // terminal failure — `attempts` is what separates it from the first one, and
  // a garment that fails three retries produces three events, which is the
  // honest account of three imports that did not land.
  track('clothes_import_failed', {
    stage: 'tagging',
    reason: analyticsFailureReason(outcome.message),
    retryable,
    attempts: job.tagAttempts + 1,
  });
}

/** Every failed job worth another go, in one tap. */
export async function retryFailedJobs(): Promise<void> {
  const retryable = useQueueStore
    .getState()
    .jobs.filter((j) => j.stage === 'failed' && j.retryable !== false);
  // Sequential rather than parallel: these are the calls that were already
  // failing, and three at once is how a struggling backend is kept struggling.
  for (const job of retryable) await retryJob(job.id);
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

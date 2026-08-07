import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

/**
 * The upload queue's persisted state.
 *
 * Persistence is the whole point: a 60-photo import must survive the app being
 * backgrounded, the network dropping, or a cold start, and resume rather than
 * restart. Progress therefore lives in kv-store (synchronous, no extra native
 * dependency) and is rehydrated on launch.
 */

export type JobStage =
  | 'queued'
  | 'preparing' // downscale + thumbnail
  | 'cutout' // on-device background removal
  | 'uploading'
  | 'tagging'
  | 'done'
  | 'failed';

export type UploadJob = {
  id: string;
  localUri: string;
  width: number;
  height: number;
  stage: JobStage;
  /**
   * How this garment got here.
   *
   * `photo` is the ordinary path: a local file that has to be prepared, cut out
   * and uploaded. `import` is a garment DESCRIBED rather than photographed —
   * the Edge Function has already downloaded the picture and written the row, so
   * the only step left is the tag. The distinction has to be on the job because
   * `hydrate` and `drainQueue` both decide what to re-run from it: sending an
   * imported garment back through the encoder would try to downscale a remote
   * URL and fail on a row that is already perfectly fine.
   */
  source?: 'photo' | 'import';
  /**
   * Local mode — AI tagging declined, photos stay on the phone (frame A-04).
   *
   * A local job runs the same on-device pipeline (downscale, thumbnail,
   * cutout) and creates the same item row, but never uploads and never tags:
   * the files land in the local photo store and `image_path` stays null. On
   * the job rather than derived at run time, because a job enqueued in local
   * mode must STAY local across a crash and a rehydrate — consent flipping on
   * mid-batch must never quietly upload photos that were promised the phone.
   */
  local?: boolean;
  attempts: number;
  /**
   * How many times `tag-item` has been asked about this garment.
   *
   * Counted separately from `attempts`, which counts whole-job runs (encode,
   * cut out, upload). Tagging is the one step that can fail on its own without
   * anything else being wrong, and it needs its own ceiling — without one, a
   * job that reached `tagging` had no terminating condition at all and simply
   * stayed there, which is precisely the import that "loads and loads".
   */
  tagAttempts: number;
  /** Server row id, once the item has been created. */
  itemId?: string;
  /**
   * What the garment turned out to be — "Knit", "Coat" — once the tagger has
   * said. The design's status rail reads `Coat ✓ · Knit ✓ · Cleaning… ·
   * Queued`, so a finished item is named rather than counted; anything not yet
   * identified has nothing truthful to call itself and shows its stage instead.
   */
  label?: string;
  error?: string;
  /**
   * Whether a `failed` job is worth offering a retry for.
   *
   * False for the failures another attempt cannot change — AI processing turned
   * off, a garment that no longer exists. A retry button over one of those is a
   * button that is guaranteed to disappoint.
   */
  retryable?: boolean;
  /** 0–1, only meaningful during `uploading`. */
  progress: number;
};

const STORAGE_KEY = 'cinch.upload-queue.v1';

type QueueState = {
  jobs: UploadJob[];
  hydrated: boolean;
  hydrate: () => void;
  enqueue: (jobs: Omit<UploadJob, 'stage' | 'attempts' | 'tagAttempts' | 'progress'>[]) => void;
  /**
   * Put a garment on the rail that is ALREADY uploaded — the described-import
   * path. It enters at `tagging` rather than `queued` so the drain loop never
   * picks it up and tries to re-encode a picture it does not have locally.
   */
  enqueueTagging: (job: { id: string; localUri: string; itemId: string }) => void;
  update: (id: string, patch: Partial<UploadJob>) => void;
  remove: (id: string) => void;
  /**
   * Drop every job that has stopped — added or failed — and keep whatever is
   * still moving.
   *
   * The screen calls this at the start of a new batch and when a settled batch
   * is left behind. Without it a non-retryable failure ("AI processing is turned
   * off") sat in the rail for the life of the install: `persist` keeps every
   * non-`done` job, `hydrate` restores it verbatim, and nothing ever removed it.
   */
  clearSettled: () => void;
  /** Dismiss the failures alone, leaving the added pieces on the rail. */
  clearFailed: () => void;
};

function persist(jobs: UploadJob[]) {
  try {
    // Only unfinished work is worth rehydrating; completed jobs would grow the
    // blob without bound.
    const durable = jobs.filter((j) => j.stage !== 'done');
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(durable));
  } catch {
    // Losing queue persistence degrades resume-after-restart but must never
    // take down an import that is otherwise working.
  }
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    let restored: UploadJob[] = [];
    try {
      const raw = Storage.getItemSync(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw) as UploadJob[];
    } catch {
      restored = [];
    }
    // Anything caught mid-flight by a crash or a kill is retried from the top.
    // Every stage is idempotent up to creating the item row, which is keyed by
    // `itemId` once it exists.
    //
    // A job that reached `tagging` is the exception. Its photos are already in
    // Storage and its row already says `pending_tag`, so restarting it would
    // re-encode and re-upload three objects to achieve nothing. It stays at
    // `tagging`, which is the truth, and `sweepPendingTags` is what finishes it.
    const requeued = restored.map((j) => {
      // Jobs persisted before `tagAttempts` existed come back without it, and
      // `undefined + 1` is NaN — which compares false against every ceiling and
      // would restore the unbounded retry this field was added to stop.
      const job = { ...j, tagAttempts: j.tagAttempts ?? 0 };
      if (job.stage === 'done' || job.stage === 'failed') return job;
      if (job.stage === 'tagging' && job.itemId) return { ...job, progress: 1 };
      return { ...job, stage: 'queued' as const, progress: 0 };
    });
    set({ jobs: requeued, hydrated: true });
  },

  enqueue: (incoming) => {
    const jobs = [
      ...get().jobs,
      ...incoming.map((j) => ({
        ...j,
        stage: 'queued' as const,
        attempts: 0,
        tagAttempts: 0,
        progress: 0,
      })),
    ];
    set({ jobs });
    persist(jobs);
  },

  enqueueTagging: ({ id, localUri, itemId }) => {
    if (get().jobs.some((j) => j.id === id)) return;
    const jobs = [
      ...get().jobs,
      {
        id,
        localUri,
        itemId,
        source: 'import' as const,
        // No local pixels to measure; the rail renders the remote picture at a
        // fixed size and nothing else reads these.
        width: 0,
        height: 0,
        stage: 'tagging' as const,
        attempts: 1,
        tagAttempts: 0,
        // The upload half is genuinely finished — the server did it.
        progress: 1,
      },
    ];
    set({ jobs });
    persist(jobs);
  },

  update: (id, patch) => {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    set({ jobs });
    persist(jobs);
  },

  remove: (id) => {
    const jobs = get().jobs.filter((j) => j.id !== id);
    set({ jobs });
    persist(jobs);
  },

  clearSettled: () => {
    const jobs = get().jobs.filter((j) => j.stage !== 'done' && j.stage !== 'failed');
    set({ jobs });
    persist(jobs);
  },

  clearFailed: () => {
    const jobs = get().jobs.filter((j) => j.stage !== 'failed');
    set({ jobs });
    persist(jobs);
  },
}));

export function selectActiveCount(jobs: UploadJob[]) {
  return jobs.filter((j) => j.stage !== 'done' && j.stage !== 'failed').length;
}

/** Everything that stopped short, in queue order. */
export function selectFailedJobs(jobs: UploadJob[]) {
  return jobs.filter((j) => j.stage === 'failed');
}

/**
 * What each stage is CALLED — the single table both progress surfaces read.
 *
 * There used to be two: this module spelled the tagging phase "categorising…"
 * in the headline while the rail underneath it said "Categorising…", and the
 * cutout stage was "cleaning up…" above and "Cleaning…" below. Two spellings of
 * one moment, six lines apart on the same screen. The words are the design's —
 * the rail reads `Coat ✓ · Knit ✓ · Cleaning… · Queued` — and an ellipsis marks
 * a stage that is still working, so a settled stage never carries one.
 */
export const STAGE_LABEL: Record<JobStage, string> = {
  queued: 'Queued',
  preparing: 'Preparing…',
  // On-device background removal — the same word the consent sheet uses for it.
  cutout: 'Cleaning…',
  uploading: 'Uploading…',
  // "Working out what this garment is". "Tagging" is our word for it, not
  // anyone else's; this says what is happening.
  tagging: 'Categorising…',
  done: 'Added ✓',
  failed: 'Failed',
};

/**
 * The one phrase that describes what the batch is doing right now.
 *
 * Reads the furthest-along stage actually in flight rather than the first job
 * in the array, because at concurrency 3 the queue is usually mid-upload on one
 * garment and mid-cutout on another, and "Uploading" while a photo is visibly
 * being cleaned up is the kind of small lie that makes a progress display feel
 * fabricated. Null when nothing is moving.
 */
export function selectPhaseLabel(jobs: UploadJob[]): string | null {
  const stages = new Set(jobs.map((j) => j.stage));
  if (stages.has('tagging')) return STAGE_LABEL.tagging;
  if (stages.has('uploading')) return STAGE_LABEL.uploading;
  if (stages.has('cutout')) return STAGE_LABEL.cutout;
  if (stages.has('preparing')) return STAGE_LABEL.preparing;
  // Nothing has started yet. "Processing 1 of 5 · Queued" contradicts itself,
  // so the headline says only the count until there is a verb to report.
  return null;
}

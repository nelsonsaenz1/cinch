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
  update: (id: string, patch: Partial<UploadJob>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
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

  clearFinished: () => {
    const jobs = get().jobs.filter((j) => j.stage !== 'done');
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
 * The one sentence that describes what the batch is doing right now.
 *
 * Reads the furthest-along stage actually in flight rather than the first job
 * in the array, because at concurrency 3 the queue is usually mid-upload on one
 * garment and mid-cutout on another, and "Uploading" while a photo is visibly
 * being cleaned up is the kind of small lie that makes a progress display feel
 * fabricated. Null when nothing is moving.
 */
export function selectPhaseLabel(jobs: UploadJob[]): string | null {
  const stages = new Set(jobs.map((j) => j.stage));
  if (stages.has('tagging')) return 'categorising…';
  if (stages.has('uploading')) return 'uploading…';
  if (stages.has('cutout')) return 'cleaning up…';
  if (stages.has('preparing')) return 'preparing…';
  // Nothing has started yet. "Processing 1 of 5 · queued" contradicts itself,
  // so the headline says only the count until there is a verb to report.
  return null;
}

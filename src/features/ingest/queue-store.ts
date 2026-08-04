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
  /** Server row id, once the item has been created. */
  itemId?: string;
  error?: string;
  /** 0–1, only meaningful during `uploading`. */
  progress: number;
};

const STORAGE_KEY = 'cinch.upload-queue.v1';

type QueueState = {
  jobs: UploadJob[];
  hydrated: boolean;
  hydrate: () => void;
  enqueue: (jobs: Omit<UploadJob, 'stage' | 'attempts' | 'progress'>[]) => void;
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
    const requeued = restored.map((j) =>
      j.stage === 'done' || j.stage === 'failed' ? j : { ...j, stage: 'queued' as const, progress: 0 },
    );
    set({ jobs: requeued, hydrated: true });
  },

  enqueue: (incoming) => {
    const jobs = [
      ...get().jobs,
      ...incoming.map((j) => ({ ...j, stage: 'queued' as const, attempts: 0, progress: 0 })),
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

export function selectFailed(jobs: UploadJob[]) {
  return jobs.filter((j) => j.stage === 'failed');
}

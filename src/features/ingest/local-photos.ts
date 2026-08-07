import { Directory, File, Paths } from 'expo-file-system';
import { useEffect } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

/**
 * The on-device photo store — the literal keeping of a literal promise.
 *
 * The consent sheet's decline button reads "Keep my photos on this phone"
 * (design frame A-01), and this module is where that sentence is made true.
 * An item added in local mode gets a row in Supabase like any other — the
 * name, tags and wear counts a user types still sync — but `image_path`
 * stays null and the photograph itself never leaves the device: the prepared
 * image and its thumbnail are copied into a dedicated subdirectory of the
 * app's document directory, keyed by item id, and every surface that would
 * have fetched from Storage reads from here instead.
 *
 * Two properties the promise depends on:
 *
 * 1. **Files survive relaunch.** They live under `Paths.document`, which iOS
 *    never evicts, and the filenames are deterministic (`<itemId>.jpg`) — the
 *    persisted index in kv-store holds only item ids, because the document
 *    directory's absolute path can change between app updates and a stored
 *    URI would quietly go stale.
 *
 * 2. **Nothing here uploads.** The only path off the device is
 *    `startBackfill` in upload-queue.ts, which is a separate, explicit,
 *    consent-gated act (frame A-06) — never a side effect of consent flipping
 *    back on.
 */

const INDEX_KEY = 'cinch.local-photos.v1';
const DIR_NAME = 'local-photos';

function photosDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function imageFile(itemId: string): File {
  return new File(photosDir(), `${itemId}.jpg`);
}

function thumbFile(itemId: string): File {
  return new File(photosDir(), `${itemId}.thumb.jpg`);
}

type LocalPhotoEntry = { imageUri: string; thumbUri: string };

/** What the index holds: ids only. URIs are re-derived per launch (see header). */
function readIndex(): string[] {
  try {
    const raw = Storage.getItemSync(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function persistIndex(ids: string[]): void {
  try {
    Storage.setItemSync(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // The files themselves are still on disk; a lost index degrades to items
    // rendering without their local photo until the next save rebuilds it.
  }
}

/** The entry for one item, verified against the filesystem rather than trusted. */
function entryFor(itemId: string): LocalPhotoEntry | null {
  try {
    const image = imageFile(itemId);
    if (!image.exists) return null;
    const thumb = thumbFile(itemId);
    return { imageUri: image.uri, thumbUri: thumb.exists ? thumb.uri : image.uri };
  } catch {
    return null;
  }
}

type LocalPhotoState = {
  hydrated: boolean;
  entries: Record<string, LocalPhotoEntry>;
  hydrate: () => void;
  put: (itemId: string, entry: LocalPhotoEntry) => void;
  drop: (itemId: string) => void;
};

/**
 * The in-memory mirror `useLocalPhoto` reads. Hydrated once from the kv-store
 * index — same idiom as queue-store's zustand + kv pairing — and kept in step
 * by the save/delete functions below, so a screen showing a local item
 * re-renders the moment its photo lands.
 */
const useLocalPhotoStore = create<LocalPhotoState>((set, get) => ({
  hydrated: false,
  entries: {},

  hydrate: () => {
    if (get().hydrated) return;
    const entries: Record<string, LocalPhotoEntry> = {};
    for (const id of readIndex()) {
      const entry = entryFor(id);
      if (entry) entries[id] = entry;
    }
    set({ entries, hydrated: true });
  },

  put: (itemId, entry) => {
    const next = { ...get().entries, [itemId]: entry };
    set({ entries: next });
    persistIndex(Object.keys(next));
  },

  drop: (itemId) => {
    const next = { ...get().entries };
    delete next[itemId];
    set({ entries: next });
    persistIndex(Object.keys(next));
  },
}));

function hydrated(): LocalPhotoState {
  const store = useLocalPhotoStore.getState();
  store.hydrate();
  return useLocalPhotoStore.getState();
}

/** Delete a file if it exists; never throw over housekeeping. */
function deleteIfPresent(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // A stale file that cannot be removed is overwritten by the next copy.
  }
}

/**
 * Keep one item's photos on this phone. Copies the prepared image and its
 * thumbnail into the document directory under deterministic names, and records
 * the item in the persisted index.
 */
export async function saveLocalPhoto(
  itemId: string,
  preparedUri: string,
  thumbUri: string,
): Promise<void> {
  hydrated();
  const dir = photosDir();
  dir.create({ intermediates: true, idempotent: true });

  const image = imageFile(itemId);
  const thumb = thumbFile(itemId);
  // Overwrite semantics by hand: a retried job must land cleanly on top of a
  // half-written first attempt.
  deleteIfPresent(image);
  deleteIfPresent(thumb);
  await new File(preparedUri).copy(image);
  await new File(thumbUri).copy(thumb);

  useLocalPhotoStore.getState().put(itemId, { imageUri: image.uri, thumbUri: thumb.uri });
}

/** The photos for one item, if this device holds them. */
export async function getLocalPhoto(
  itemId: string,
): Promise<{ imageUri: string; thumbUri: string } | null> {
  const store = hydrated();
  return store.entries[itemId] ?? entryFor(itemId);
}

/**
 * The hook surfaces read. Null until hydration finds the files — a remote item,
 * or a local item whose photos live on another device, stays null forever.
 */
export function useLocalPhoto(itemId: string | null | undefined): {
  imageUri: string | null;
  thumbUri: string | null;
} {
  const hydrate = useLocalPhotoStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  const entry = useLocalPhotoStore((s) => (itemId ? s.entries[itemId] : undefined));
  return { imageUri: entry?.imageUri ?? null, thumbUri: entry?.thumbUri ?? null };
}

/**
 * Remove one item's local photos. Silent no-op when absent — item deletion
 * calls this unconditionally, and most items have nothing here.
 */
export async function deleteLocalPhoto(itemId: string): Promise<void> {
  hydrated();
  deleteIfPresent(imageFile(itemId));
  deleteIfPresent(thumbFile(itemId));
  useLocalPhotoStore.getState().drop(itemId);
}

/** Every item id this device holds photos for — the backfill's candidate list. */
export async function listLocalPhotoItemIds(): Promise<string[]> {
  const store = hydrated();
  return Object.keys(store.entries);
}

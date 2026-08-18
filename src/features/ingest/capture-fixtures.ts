/**
 * Posed queues for the dev-cp fixtures — redesign 22.
 *
 * The capture route cannot be screenshotted as it ships: a simulator has no
 * camera at all, so the live stage renders an empty preview, and the batch page
 * only exists once a real import has run. The fixtures therefore pose the
 * QUEUE — the one input every canvas state in this redesign is a function of —
 * and let the shipped parts draw it.
 *
 * Pure data with no React Native import, in `features/` and reached through the
 * `@/` alias, so the fixtures under `src/dev-fixtures/` stay presentational and
 * the node test runner can read the same shapes the screens do.
 *
 * `localUri` is deliberately an empty string throughout. The parts fall back to
 * their own tray grounds when there is no photograph, which is exactly what a
 * fixture should show: a bundled stock garment would put a picture in a
 * screenshot that the real screen can only ever get from the user.
 */

import type { RowSource } from './capture-spec';

type PosedJob = RowSource & { localUri: string };

const job = (over: Partial<PosedJob> & { id: string; stage: string }): PosedJob => ({
  localUri: '',
  ...over,
});

/** Frame 07 — two filed, two filing, two waiting. */
export const CP_FILING_EARLY: PosedJob[] = [
  job({ id: 'a', stage: 'done', label: 'Camel coat', itemId: 'i1' }),
  job({ id: 'b', stage: 'done', label: 'Black dress', itemId: 'i2' }),
  job({ id: 'c', stage: 'uploading', label: 'Linen shirt' }),
  job({ id: 'd', stage: 'cutout', label: 'Wool skirt' }),
  job({ id: 'e', stage: 'queued' }),
  job({ id: 'f', stage: 'queued' }),
];

/** Frame 08 — four filed, one cut-out short, one still moving. */
export const CP_FILING_MIXED: PosedJob[] = [
  job({ id: 'a', stage: 'done', label: 'Black dress', itemId: 'i1' }),
  job({ id: 'b', stage: 'done', label: 'Linen shirt', itemId: 'i2' }),
  job({ id: 'c', stage: 'done', label: 'Wool skirt', itemId: 'i3' }),
  job({ id: 'd', stage: 'done', label: 'Ankle boots', itemId: 'i4' }),
  job({ id: 'e', stage: 'done', label: 'Wool coat', itemId: 'i5', cutoutFailed: true }),
  job({ id: 'f', stage: 'tagging', label: 'Wide trousers' }),
];

/** Frame 09 — nothing in flight. */
export const CP_SETTLED: PosedJob[] = [
  job({ id: 'a', stage: 'done', label: 'Camel coat', itemId: 'i1' }),
  job({ id: 'b', stage: 'done', label: 'Black dress', itemId: 'i2' }),
  job({ id: 'c', stage: 'done', label: 'Linen shirt', itemId: 'i3' }),
  job({ id: 'd', stage: 'done', label: 'Wool skirt', itemId: 'i4' }),
  job({ id: 'e', stage: 'done', label: 'Wide trousers', itemId: 'i5' }),
  job({ id: 'f', stage: 'done', label: 'Ankle boots', itemId: 'i6' }),
];

/** Frame 17 — three photographs held on the phone. */
export const CP_OFFLINE: PosedJob[] = [
  job({ id: 'a', stage: 'queued', label: 'Camel coat' }),
  job({ id: 'b', stage: 'queued', label: 'Linen shirt' }),
  job({ id: 'c', stage: 'queued', label: 'Wool skirt' }),
];

/** Frame 18 — a batch a kill interrupted. */
export const CP_RESUMABLE: PosedJob[] = [
  job({ id: 'a', stage: 'queued' }),
  job({ id: 'b', stage: 'queued' }),
  job({ id: 'c', stage: 'queued' }),
  job({ id: 'd', stage: 'queued' }),
];

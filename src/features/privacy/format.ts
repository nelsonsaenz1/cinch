/**
 * The Privacy & data pages' pure formatting, kept in a `.ts` so it can be
 * tested — the test bundler is esbuild and cannot parse React Native's Flow
 * source, so anything importing a `.tsx` is untestable by construction.
 *
 * Everything here turns a real row into a sentence. Nothing estimates: PD-05
 * prints `data_exports.bytes`, which the worker measures off the assembled
 * archive (`20260810120000_data_exports.sql:26` — "Real size of the assembled
 * archive. PD-05 prints it, so it is measured, never estimated").
 */

/** One export request, as the app reads it out of `data_exports`. */
export type DataExport = {
  id: string;
  requestedAt: string;
  /** The column's own three values. Expiry is NOT one of them — see below. */
  status: 'pending' | 'ready' | 'failed';
  readyAt: string | null;
  bytes: number | null;
  expiresAt: string | null;
  /** The worker's sentence when it failed. Rendered as-is; it is written to be read. */
  error: string | null;
};

/**
 * What an export is, once the clock is taken into account.
 *
 * `expired` is derived, never stored. The migration is explicit about why:
 * "expiry is a fact about the clock (expires_at < now()), not a state anyone
 * transitions into, and a status that needs a cron job to stay true is a
 * status that will one day be wrong" (`20260810120000_data_exports.sql:17-20`).
 */
export type ExportState = 'pending' | 'ready' | 'expired' | 'failed';

export function exportStateOf(row: DataExport, now: Date = new Date()): ExportState {
  if (row.status !== 'ready') return row.status;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < now.getTime()) return 'expired';
  return 'ready';
}

/**
 * "412 MB", "9.4 GB", "884 kB".
 *
 * SI units, because that is what the Files app and the Finder show for the
 * same archive — a "412 MB" here and a "393 MB" in Files for one file is the
 * app looking wrong about the one number on this page that is measured.
 * One decimal place below 10 units, none above, so the figure never implies
 * more precision than a byte count deserves.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1_000) return `${Math.round(bytes)} bytes`;

  const units = ['kB', 'MB', 'GB', 'TB'] as const;
  let value = bytes / 1_000;
  let unit = 0;
  while (value >= 1_000 && unit < units.length - 1) {
    value /= 1_000;
    unit += 1;
  }
  const shown = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${shown} ${units[unit]}`;
}

/** "12 March" — the app's short date voice (profile.tsx's trial line). */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/** "12 March 2026" — the fuller form, for a record being cited. */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "9:38 am" — only ever used for something that happened today. */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The quiet second line of an "Earlier exports" row.
 *
 * A size only appears when there is one: a failed run never produced an
 * archive, and "0 bytes · failed" would read as a measurement rather than an
 * absence.
 */
export function earlierExportLine(row: DataExport, now: Date = new Date()): string {
  const state = exportStateOf(row, now);
  const size = row.bytes != null && row.bytes > 0 ? formatBytes(row.bytes) : null;

  const tail =
    state === 'expired'
      ? 'link expired'
      : state === 'ready'
        ? 'emailed to you'
        : state === 'failed'
          ? 'did not finish'
          : 'still being put together';

  return size ? `${size} · ${tail}` : tail;
}

/**
 * "{n} photos sent." / "1 photo sent." / "No photo has left this phone."
 *
 * `tagged` is the itemised count — one entry per piece whose photo really went
 * to the tagger. `listing` is the second door, and it is counted separately
 * rather than added in, because `ai_calls` records no `item_id` for it and the
 * two numbers do not mean the same thing. See use-ai-privacy.ts.
 */
export function sentClause(tagged: number, listing: number): string {
  if (tagged === 0 && listing === 0) return 'No photo has left this phone.';

  const first =
    tagged === 0
      ? 'No photo has been sent for tagging.'
      : `${tagged} ${tagged === 1 ? 'photo' : 'photos'} sent for tagging.`;

  if (listing === 0) return first;

  // Deliberately "listing searches", not "photos": a search run from a typed
  // description alone sends no photograph, and `ai_calls` cannot tell the two
  // apart. Over-claiming here would be the same defect as the undercount it
  // replaces, pointed the other way.
  const second = `${listing} listing ${listing === 1 ? 'search' : 'searches'}, each of which sends a photo unless you searched by description alone.`;

  return `${first} ${second}`;
}

/**
 * The state line under the AI-consent heading. Every branch is a fact the
 * server can back: dates from the consent record, counts from `ai_calls`.
 */
export function consentStatusLine(
  granted: boolean,
  grantedAt: string | null,
  revokedAt: string | null,
  tagged: number,
  listing: number,
): string {
  const sent = sentClause(tagged, listing);
  if (granted) {
    return grantedAt ? `On since ${shortDate(grantedAt)}. ${sent}` : `On. ${sent}`;
  }
  return revokedAt ? `Off since ${shortDate(revokedAt)}. ${sent}` : `Off. ${sent}`;
}

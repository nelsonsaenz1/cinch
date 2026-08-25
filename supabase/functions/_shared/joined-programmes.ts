/**
 * Parsing Awin's joined-programmes answer — the source of truth for
 * `commerce_joined_programmes`.
 *
 * awin-joined-programmes-directive.md §1.1: the joined list is READ from
 *   GET /publishers/{publisherId}/programmes?relationship=joined
 * and never hand-maintained. A row in `commerce_joined_programmes` is the only
 * thing that may label a link `Paid link`, so the parse errs toward dropping a
 * malformed entry over admitting one: a missed programme costs one day of a
 * link reading "Open at merchant" (the next sync catches it); an invented one
 * puts a false paid disclosure on screen.
 *
 * Pure and `Deno`-free so `tests/awin-link-construction.test.ts` can execute
 * it — the same split every testable edge module here makes.
 */

export type JoinedProgramme = {
  /** Awin's advertiser id, digits only — the value that goes into `awinmid`
   *  and into `commerce_joined_programmes.merchant_id`. */
  id: string;
  name: string;
};

/**
 * The response body is an array of programme objects; the two fields Cinch
 * needs are `id` (Awin sends a number) and `name`. Everything else — regions,
 * commission ranges, logos — is deliberately not read: commission may never
 * influence what Cinch recommends (commerce-directive.md §0), and the easiest
 * way to keep a number out of the ranking is to never parse it.
 */
export function parseJoinedProgrammes(body: unknown): JoinedProgramme[] {
  if (!Array.isArray(body)) {
    throw new Error('programmes response is not an array');
  }

  const out: JoinedProgramme[] = [];
  for (const raw of body) {
    if (typeof raw !== 'object' || raw === null) continue;
    const record = raw as Record<string, unknown>;

    // Numeric today, but stringified defensively — the table's column is text
    // because neither network promises ids stay numeric. The digits-only check
    // matters beyond hygiene: this value is interpolated into a feed URL path
    // and an `in`-filter, so nothing that could carry syntax gets through.
    const id =
      typeof record.id === 'number' && Number.isInteger(record.id) && record.id > 0
        ? String(record.id)
        : typeof record.id === 'string' && /^[0-9]{1,64}$/.test(record.id)
          ? record.id
          : null;

    const name =
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim().slice(0, 200)
        : null;

    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out;
}

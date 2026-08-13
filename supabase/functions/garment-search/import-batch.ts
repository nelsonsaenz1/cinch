/**
 * What a batch import is going to do, decided before it does any of it.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 *
 * Everything in `importCatalogueBatch` that can be wrong in an interesting way
 * is a decision, not an I/O call: which rows are duplicates of each other,
 * which are already in the closet, whether there is room for the rest, and
 * whether the answer to that last question should stop the whole batch. Those
 * four are exactly what the acceptance criteria name, and none of them needs a
 * database to be checked.
 *
 * Kept apart so they can be proved against fixtures rather than against a live
 * Postgres — the same split `catalog.ts` and `catalog-store.ts` already have,
 * and for the same reason: `tests/catalog-import-batch.test.ts` runs on Node.
 *
 * THE ONE RULE THAT IS EASY TO GET BACKWARDS. Capacity is measured against the
 * rows that would actually be WRITTEN, never against the rows that were sent. A
 * retry of a batch that half-landed is mostly rows the closet already holds,
 * and counting those would refuse the retry for the slots its own successes are
 * sitting in — which is a dead end the user cannot get out of by any action
 * available to them.
 */

/** One selected colourway, as the request carries it. */
export type BatchRow = {
  externalId: string;
  imageUrl: string;
  pageUrl?: string;
  title?: string;
  colourLabel?: string;
};

/** What `import_capacity()` answered. Null when it could not be read. */
export type Room = {
  active: number;
  active_limit: number;
  total: number;
  total_limit: number;
};

export type BatchRefusal =
  | { code: 'closet_limit_reached'; requested: number; active: number; activeLimit: number }
  | { code: 'storage_limit_reached'; requested: number; total: number; totalLimit: number };

export type BatchPlan = {
  /** In request order, deduplicated, minus everything already held. */
  pending: BatchRow[];
  /** Already in the closet. A SUCCESS state, not an error — see below. */
  alreadyHeld: { externalId: string; itemId: string }[];
  /**
   * Set when the whole batch must be refused before any bytes move. Null means
   * proceed; `pending` may still be empty, which means every row was already
   * held and there is nothing to do but say so.
   */
  refusal: BatchRefusal | null;
};

/**
 * Plan the batch.
 *
 * `held` maps a catalogue row id to the item already carrying it, read from the
 * closet before this is called. Those rows come back as `alreadyHeld` rather
 * than as errors, because from the user's side the piece IS in the closet and
 * that is what they asked for — reporting it as a failure would invite them to
 * fix something that is not broken.
 *
 * `room` is a PREFLIGHT and this function treats it as one: a null (the read
 * failed) does not refuse the batch, it lets it through to the trigger, which
 * is the only thing that was ever the authority. Refusing on a failed read
 * would turn a monitoring blip into a closed door.
 */
export function planCatalogueBatch(
  rows: readonly BatchRow[],
  held: ReadonlyMap<string, string>,
  room: Room | null,
): BatchPlan {
  // A client that sent the same colourway twice means it once. The unique index
  // would refuse the second anyway; deduplicating here is what makes the ANSWER
  // match the question rather than containing a spurious failure.
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.externalId)) return false;
    seen.add(row.externalId);
    return true;
  });

  const alreadyHeld: BatchPlan['alreadyHeld'] = [];
  const pending: BatchRow[] = [];
  for (const row of unique) {
    const itemId = held.get(row.externalId);
    if (itemId) alreadyHeld.push({ externalId: row.externalId, itemId });
    else pending.push(row);
  }

  return { pending, alreadyHeld, refusal: refuse(pending.length, room) };
}

/**
 * All-or-nothing, and decided before anything is downloaded.
 *
 * Three colourways into two free slots is refused as a batch. Writing two and
 * apologising for the third would be the worst of both — the user asked one
 * question and got half an answer, and the half they got is the half the app
 * picked for them. CPV2-11 draws the refusal as its own state, with the
 * numbers, so they are carried here rather than flattened into a sentence.
 */
function refuse(requested: number, room: Room | null): BatchRefusal | null {
  if (requested === 0 || !room) return null;

  if (room.active + requested > room.active_limit) {
    return {
      code: 'closet_limit_reached',
      requested,
      active: room.active,
      activeLimit: room.active_limit,
    };
  }
  if (room.total + requested > room.total_limit) {
    return {
      code: 'storage_limit_reached',
      requested,
      total: room.total,
      totalLimit: room.total_limit,
    };
  }
  return null;
}

/** One colourway's outcome. Never a bare boolean: the three states are what
 *  makes a retry safe and a partial failure recoverable. */
export type ImportRowResult = {
  externalId: string;
  status: 'added' | 'already-added' | 'failed';
  itemId?: string;
  /** A stable code the client branches on. Never prose. */
  error?: string;
  /** A sentence, for the row that failed. */
  message?: string;
};

/**
 * The counts that ride alongside the rows.
 *
 * `already-added` is counted apart from `added` and neither is counted as a
 * failure. A retry that finds everything already there reports three
 * already-added and zero failed, which is what lets the screen say "these are
 * in your closet" instead of "nothing happened".
 */
export function summariseBatch(results: readonly ImportRowResult[]): {
  added: number;
  alreadyAdded: number;
  failed: number;
} {
  return {
    added: results.filter((r) => r.status === 'added').length,
    alreadyAdded: results.filter((r) => r.status === 'already-added').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}

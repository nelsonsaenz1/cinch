import { PLANS, type Plan } from '@/features/billing/plans';

/**
 * Storage — what the screen decides before it draws. Redesign 25.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it. Same split, same reason, as
 * `closet-spec.ts` — and this file is deliberately its sibling rather than an
 * extension of it, because the two screens disagree about one thing that
 * matters (see `restoreBlocked`) and a shared enum would have hidden it.
 *
 * ── THE ARITHMETIC IS THE SCREEN ────────────────────────────────────────────
 *
 * Every figure this module prints is READ, never typed and never estimated.
 * The counts come from `useCapacity` (which mirrors the limit triggers) and the
 * ceilings come from `PLANS`. The one rule that governs all of it:
 *
 *   A number appears only where the real value is known.
 *
 * Not zero, not a dash, not a guess. `capacityLine` omits whole clauses rather
 * than filling them, because a ceiling printed wrong is worse than a ceiling
 * printed late — the reader acts on it.
 *
 * ── TWO CEILINGS, TWO MEANINGS ──────────────────────────────────────────────
 *
 * ACTIVE counts unarchived pieces — what Cinch styles from. TOTAL counts every
 * piece the account holds, active plus stored. Free 10/30, Standard 150/450,
 * Pro 1000/3000, all from `plans.ts`.
 *
 * They are never conflated, and the total limit is never called "stored
 * pieces": a stored piece spends against the total, but so does an active one,
 * and calling the total a storage budget would make storing look free.
 */

// ---------------------------------------------------------------------------
// The capacity line
// ---------------------------------------------------------------------------

/**
 * What the screen knows about capacity right now. `null` means NOT YET KNOWN —
 * distinct from zero, which is a real and printable count.
 *
 * `stored` alone is never null: it is `items.length` off the list this screen
 * has already rendered, so by the time the line is drawn it is a fact. The
 * ceilings arrive separately (`useCapacity` runs its own query and reads the
 * plan) and are the parts that go missing.
 */
export interface CapacityFacts {
  readonly stored: number;
  readonly active: number | null;
  readonly activeLimit: number | null;
  readonly total: number | null;
  readonly totalLimit: number | null;
}

/**
 * `12 stored · 138 of 150 active · 150 of 450 total`.
 *
 * One grammar for all three tiers and all three clauses, and any clause whose
 * figures are unknown is DROPPED rather than filled. The frames pin both ends
 * of that: `capacity-unknown-omitted` prints `12 stored` and nothing else,
 * while the populated frames print all three.
 *
 * Zero stored is worded, not numeralised — "Nothing stored", per the `empty`
 * frame. A leading `0` in a line whose other clauses are live counts reads as a
 * failed read rather than an empty drawer, which is the one misreading this
 * screen must never invite.
 */
export function capacityLine(facts: CapacityFacts): string {
  const clauses: string[] = [facts.stored === 0 ? 'Nothing stored' : `${facts.stored} stored`];

  if (facts.active !== null && facts.activeLimit !== null) {
    clauses.push(`${facts.active} of ${facts.activeLimit} active`);
  }
  if (facts.total !== null && facts.totalLimit !== null) {
    clauses.push(`${facts.total} of ${facts.totalLimit} total`);
  }

  return clauses.join(' · ');
}

// ---------------------------------------------------------------------------
// The state the two ceilings put this screen in
// ---------------------------------------------------------------------------

/**
 * Six states, because six of them have different things to say.
 *
 * This is deliberately NOT `closet-spec.ts`'s `CapacityState`. That type has
 * three members and folds `total_full` over `active_full`, which is right for
 * the closet — where both block the thing the closet is trying to do, ADD a
 * piece — and wrong here, where the thing being attempted is a RESTORE and the
 * two ceilings behave oppositely (see `restoreBlocked`).
 *
 * The `over_*` pair are the downgrade states: strictly OVER a ceiling rather
 * than at it, which is only reachable by a plan changing under an account that
 * was already full. They are separated because their first sentence is not a
 * limit at all, it is a reassurance — nothing was deleted — and a state that
 * has to lead with that is not the same state as one sitting exactly on its
 * ceiling.
 */
export type StorageState =
  | 'room'
  | 'active_full'
  | 'total_full'
  | 'both_full'
  | 'over_active'
  | 'over_total';

export function storageState(input: {
  active: number;
  activeLimit: number;
  total: number;
  totalLimit: number;
}): StorageState {
  // Strictly-over first, and active before total: an account over the active
  // ceiling is over it whatever the total is doing, and "every piece is still
  // here" is the sentence it needs before any arithmetic.
  if (input.active > input.activeLimit) return 'over_active';
  if (input.total > input.totalLimit) return 'over_total';

  const activeAt = input.active >= input.activeLimit;
  const totalAt = input.total >= input.totalLimit;

  if (activeAt && totalAt) return 'both_full';
  if (activeAt) return 'active_full';
  if (totalAt) return 'total_full';
  return 'room';
}

/**
 * Whether the database will refuse a restore in this state.
 *
 * THE ONE ASYMMETRY THIS SCREEN EXISTS TO GET RIGHT. Restoring flips
 * `is_archived` to false: it moves a piece from the stored side to the active
 * side and changes the TOTAL BY NOTHING. So:
 *
 *   · active-full BLOCKS it — `items_enforce_limit_on_restore` (migration
 *     20260808190100) is `before update of is_archived` and refuses.
 *   · total-full alone DOES NOT — the total is unmoved by the write, so there
 *     is nothing for the trigger to refuse.
 *
 * A reader's intuition runs the other way ("storage is full, so I cannot take
 * anything out of storage"), which is why `total_full`'s copy says outright
 * that bringing one back still works instead of leaving it to be discovered.
 *
 * `over_active` blocks for the same reason `active_full` does, and harder: the
 * account is already past the ceiling, so a restore moves it further past.
 * `over_total` does not block, on the same arithmetic as `total_full`.
 *
 * This is a DISPLAY preflight, never a control. The server refuses correctly
 * whatever this returns; being wrong here costs one honest error message, and
 * the alternative — a client that decides it has room — is a client an attacker
 * patches.
 */
export function restoreBlocked(state: StorageState): boolean {
  return state === 'active_full' || state === 'both_full' || state === 'over_active';
}

// ---------------------------------------------------------------------------
// What each state says
// ---------------------------------------------------------------------------

/**
 * Where a notice's action goes.
 *
 * `store` is the closet, where storing happens — the same door The Wall's "make
 * room" exit uses, in the opposite direction. `plans` is the paywall gate.
 * `recover` opens the both-full sheet, which is the only state with more than
 * one honest way out and therefore the only one that earns a sheet rather than
 * a direct jump.
 */
export type StorageDoor = 'store' | 'plans' | 'recover';

export interface StorageAction {
  readonly label: string;
  readonly door: StorageDoor;
}

export interface StorageNotice {
  /**
   * `refusal` is the state that just blocked, or would block, a restore — it
   * takes the oxblood body the frames give it. `notice` is informational and
   * stays in ink. Both sit on the same blush ground: the tone is carried by the
   * copy and the type colour, not by a second surface colour.
   */
  readonly tone: 'refusal' | 'notice';
  readonly title: string;
  readonly body: string;
  /** Zero, one or two. Never three — a notice with three ways out is a menu. */
  readonly actions: readonly StorageAction[];
}

/**
 * The band above the grid, or null when there is nothing to say.
 *
 * Every figure is an argument, not a literal. The frames spell their numbers
 * out in words ("Ten pieces are already active", "under thirty") and this
 * prints numerals from `plans.ts` instead — see the build report's deviation
 * note. A spelled number is a TYPED number: it cannot follow a plan change, so
 * the day a ceiling moves the sentence quietly starts lying, which is exactly
 * what the "numbers derive from plans" law exists to prevent.
 */
export function storageNotice(input: {
  state: StorageState;
  activeLimit: number;
  total: number;
  totalLimit: number;
}): StorageNotice | null {
  switch (input.state) {
    case 'room':
      return null;

    case 'active_full':
      return {
        tone: 'refusal',
        title: 'The active closet is full',
        body: `${input.activeLimit} pieces are already active. Store one to make room for this.`,
        actions: [{ label: 'Choose one to store', door: 'store' }],
      };

    case 'total_full':
      // Says outright that restoring still works. Without this sentence the
      // reader assumes the opposite and stops trying, which is a dead end
      // invented entirely by omission.
      return {
        tone: 'notice',
        title: 'No room for new pieces',
        body: `${input.totalLimit} pieces is everything this plan holds. Bringing one back from Storage still works — it does not add a piece.`,
        actions: [],
      };

    case 'both_full':
      // Both numbers stated, then the one action that resolves it. Freeing an
      // active place is SUFFICIENT here — the total does not have to come down
      // — so the copy does not offer deleting or upgrading as if it did.
      return {
        tone: 'refusal',
        title: 'Both limits reached',
        body: `${input.activeLimit} active and ${input.totalLimit} in total. Storing a piece frees an active place — that is enough.`,
        actions: [{ label: 'Choose one to store', door: 'recover' }],
      };

    case 'over_active':
      return {
        tone: 'notice',
        title: 'Over the new plan’s limits',
        body: `Every piece is still here. Nothing was deleted. Store pieces until ${input.activeLimit} are active, or move back to a larger plan.`,
        actions: [
          { label: `Store pieces to get to ${input.activeLimit}`, door: 'store' },
          { label: 'See what each plan holds', door: 'plans' },
        ],
      };

    case 'over_total':
      // Names precisely what is blocked — ADDING — and leaves restoring alone,
      // because restoring is not blocked here and saying so by silence would
      // be the same dead end `total_full` avoids.
      return {
        tone: 'notice',
        title: 'Over the total this plan holds',
        body: `${input.total} pieces, all kept. Nothing is deleted. Adding new pieces waits until you are under ${input.totalLimit}.`,
        actions: [],
      };
  }
}

/**
 * The label on the one primary control.
 *
 * Named, once a piece is picked: the frames refuse a bare "Continue" on the
 * grounds that an action which names its object is an action somebody can check
 * before they commit it. `pieceName` supplies the name, so this never sees a
 * raw row.
 */
export function primaryLabel(pickedName: string | null): string {
  return pickedName === null ? 'Activate a piece' : `Bring back ${pickedName}`;
}

/** The copy tables. Kept out of the components so a test can read them. */
export const STORAGE_COPY = {
  title: 'Storage',

  empty: {
    title: 'Nothing put away yet',
    body: 'Pieces you store keep their photographs and their history. They just step out of the way.',
    action: 'Back to closet',
  },

  readError: {
    title: 'Couldn’t read Storage',
    // NOT an empty state, and the distinction is the whole point: this is the
    // screen somebody opens to check their pieces are still there, and telling
    // them the drawer is empty over a dropped connection is the one thing it
    // must never do.
    body: 'Nothing is lost. Your stored pieces are on the server, waiting.',
    action: 'Try again',
    retrying: 'Trying again…',
  },

  noSession: {
    title: 'Sign in to see Storage',
    body: 'Your stored pieces are private to your account. Nothing was changed.',
    action: 'Sign in',
  },

  chooser: {
    title: 'Which piece comes back?',
    body: 'It rejoins the active closet and can be styled again.',
    confirm: 'Bring it back',
    saving: 'Bringing it back…',
    cancel: 'Cancel',
  },

  /** The light celebration. A mark and a sentence — never confetti. */
  restored: {
    title: (name: string) => `${name} is back`,
    body: 'It can be styled again from today.',
  },

  /**
   * An empty mutation result, or a dropped write. Names the two facts that
   * matter and nothing else: nothing moved, and the pick survives.
   */
  writeFailed: {
    title: 'Nothing changed',
    body: 'The piece is still in Storage. Your selection is kept.',
    action: 'Try again',
  },

  /**
   * The row was already restored somewhere else. NOT an error — the reader did
   * not cause it and cannot fix it, and reporting a failure for a state that is
   * simply current teaches them to distrust the list.
   */
  reconciled: {
    title: 'Already back',
    body: (name: string) => `${name} was activated on another device. The list is up to date.`,
  },

  staleRefreshing: 'Checking for changes from your other device.',

  /** The make-room sheet, reached from a refusal's action. */
  makeRoom: {
    title: 'Make room first',
    body: 'Storing an active piece frees a place. Nothing is deleted either way.',
    confirm: 'Store it and bring the other back',
    cancel: 'Cancel',
  },

  /** The both-full recovery sheet. See the build report for the omitted line. */
  twoWays: {
    title: 'Two ways forward',
    body: 'Storing an active piece frees a place immediately. Nothing here is deleted unless you say so.',
    store: 'Store an active piece instead',
    plans: 'See what each plan holds',
  },

  scrollHint: 'Scroll for the rest',
  clearSelection: 'Clear selection',
} as const;

/** The ceilings, from the plan, so a tier change moves every figure at once. */
export function ceilings(plan: Plan): { active: number; total: number } {
  return { active: PLANS[plan].items, total: PLANS[plan].storedItems };
}

// ---------------------------------------------------------------------------
// Geometry — the artifact's own "Tokens & measurements" line
// ---------------------------------------------------------------------------

/**
 * Two columns, always.
 *
 * The closet runs three (redesign 14) and this runs two, which is the "lower
 * emphasis" instruction read literally: the same card in a calmer rhythm.
 * Fewer, larger plates make storage a place you browse rather than a dense
 * index you scan, and the difference between the two screens should be legible
 * in a glance at the grid alone.
 *
 * Two survives AX as well. The artifact's own AX frame keeps both columns and
 * spends the extra type size on HEIGHT — plates yield, names wrap in full,
 * nothing clamps — so unlike the closet there is no one-column break here.
 */
export const GRID_COLUMNS = 2;

export const PLATE = {
  /** 157×188 at 393pt, per the artifact. */
  width: 157,
  height: 188,
  /** 148×172 on a 667pt device — tighter, still two columns. */
  shortWidth: 148,
  shortHeight: 172,
  /** Plates yield height at AX rather than dropping a column. */
  axHeight: 150,
  radius: 12,
  gutter: 10,
  /** "Asleep, not degraded" — the well dims, the type never does. */
  storedOpacity: 0.72,
} as const;

export const CONTROL = {
  primaryHeight: 56,
  primaryHeightAx: 62,
  secondaryHeight: 52,
  radius: 14,
  /** Chooser rows grow rather than shrinking their names. */
  rowHeight: 44,
  rowHeightAx: 56,
} as const;

export const NOTICE = {
  radius: 14,
  paddingY: 13,
  paddingX: 15,
} as const;

export const TYPE = {
  title: 36,
  titleLineHeight: 41,
  titleAx: 32,
  /** The clay capacity line — uppercase, tracked, 12.5. */
  capacity: 12.5,
  capacityAx: 15,
  capacityTracking: 0.1,
  plateName: 12.5,
  plateNameLineHeight: 17,
} as const;

/** The device height below which the plates take their tighter measure. */
export const SHORT_DEVICE_HEIGHT = 700;

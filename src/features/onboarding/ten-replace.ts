/**
 * LP-02 — replacing the photograph in a filled First 10 position.
 *
 * WHY THIS IS A MODULE AND NOT A HANDFUL OF `useState`s.
 *
 * A replacement is a small distributed transaction across three systems that
 * can each fail independently: the system camera or picker, the upload/cutout/
 * tag pipeline in `features/ingest`, and the archive write that keeps the
 * closet's count from moving. The contract it has to hold is short and
 * unforgiving —
 *
 *   - the position, the order and the 1/10…10/10 count never change;
 *   - the outgoing photograph stays authoritative until the incoming one has
 *     been captured, processed AND written;
 *   - cancel, a denied camera, a denied library, a failed upload and the app
 *     being backgrounded all leave the grid exactly as it was;
 *   - nothing is ever deleted, at any point, on any path.
 *
 * — and there is no React renderer in this repo's test toolchain
 * (`scripts/run-tests.mjs` is esbuild plus `node --test`), so a contract of
 * that shape can only be held honestly if it is a pure reducer that a test can
 * drive event by event. `the-ten.tsx` owns the effects; this owns the truth.
 *
 * WHY THE OUTGOING PIECE IS STORED AND NOT DELETED.
 *
 * The pipeline in `upload-queue.ts` writes a NEW item row per capture — its
 * Storage paths are keyed by item id and its signed upload URLs refuse an
 * object that already exists, so a photograph cannot be overwritten in place.
 * A replacement is therefore genuinely "one in, one out", and the piece going
 * out is ARCHIVED, which is the same reversible move `wall-swap.tsx` already
 * calls making room: the photograph, the cutout, the plate, the wear history
 * and the cost-per-wear all survive intact and the piece is one tap from
 * coming back on the Storage screen. Delete is a different act, lives in item
 * detail, and is never reached from here.
 *
 * WHICH SIDE OF THE CAPTURE THAT ARCHIVE FALLS ON — the one genuinely
 * conditional thing in the machine.
 *
 * `enforce_item_limit` (migration 20260808190100) refuses an insert that would
 * take the ACTIVE closet past its ceiling, and the First 10 grid is exactly
 * that ceiling on the free tier. So:
 *
 *   ROOM TO SPARE (1/10, 9/10) — capture first, archive after. The outgoing
 *   piece is live in the closet for the whole flow, and a cancel or a failure
 *   is a no-op in the strictest sense: nothing was written to undo.
 *
 *   NO ROOM (10/10) — the outgoing piece is stored FIRST, because otherwise
 *   the incoming insert is rejected and a replacement at ten of ten would
 *   simply be impossible. Every non-success exit from that path therefore
 *   restores it, which is a compensating write rather than an untouched
 *   closet — but the piece is never outside the account, never unreachable,
 *   and never in a state a restore cannot return.
 *
 * The grid keeps drawing the OUTGOING photograph in the slot throughout, on
 * both paths, until `replaced`: see `heldGarmentId`.
 */

import { replaceSlot, type TenSlot } from '@/features/onboarding/ten-slots';

/** Which door the reader chose out of the sheet. */
export type ReplaceMode = 'camera' | 'library';

/**
 * Why a replacement stopped short. Every one of these leaves the slot holding
 * the piece it held before, which is the only thing the reader has to be told.
 */
export type ReplaceFailure =
  | 'cancelled'
  | 'camera-denied'
  | 'library-denied'
  | 'no-room'
  | 'processing-failed'
  | 'restore-failed';

type Slot = { slotId: number; outgoingId: string };

export type ReplaceState =
  /** No sheet, no flow. The grid's ordinary state. */
  | { phase: 'closed' }
  /** The four-action sheet, over the slot's own photograph. */
  | ({ phase: 'choosing' } & Slot)
  /** 10/10 only — storing the outgoing piece so the incoming one has a slot. */
  | ({ phase: 'freeing'; mode: ReplaceMode } & Slot)
  /** The camera or the picker, through the same `TenCamera` the flow already uses. */
  | ({ phase: 'capturing'; mode: ReplaceMode; freed: boolean } & Slot)
  /** A row exists; its photograph is still being prepared, uploaded and read. */
  | ({ phase: 'processing'; incomingId: string; freed: boolean } & Slot)
  /**
   * The incoming photograph is written. One funnel for both paths: the
   * room-to-spare one still owes the closet an archive here, the no-room one
   * already made it on the way in and `freed` is how the screen tells them
   * apart without a second ending to reason about.
   */
  | ({ phase: 'retiring'; incomingId: string; freed: boolean } & Slot)
  /** No-room path, unwinding — bringing the stored piece back after a stop. */
  | ({ phase: 'restoring'; failure: ReplaceFailure } & Slot)
  /** Stopped. The slot is untouched; `failure` is what to say about it. */
  | ({ phase: 'failed'; failure: ReplaceFailure } & Slot)
  /**
   * Done. `retired` is false only when the archive write itself failed after
   * the swap landed — the new photograph is in the slot and the old piece is
   * still in the closet, which is a count that wants tidying rather than
   * anything lost.
   */
  | ({ phase: 'replaced'; incomingId: string; retired: boolean } & Slot);

export type ReplaceEvent =
  | { type: 'open'; slotId: number; garmentId: string }
  /** `needsRoom` is `useCapacity().full` — see the header. */
  | { type: 'choose'; mode: ReplaceMode; needsRoom: boolean }
  /** Cancel, from the sheet or from the camera's own chrome. */
  | { type: 'cancel' }
  | { type: 'room-freed' }
  | { type: 'room-refused' }
  | { type: 'permission-denied'; source: ReplaceMode }
  /** The pipeline wrote the row — `TenCamera`'s `onFilled`. */
  | { type: 'item-created'; itemId: string }
  /**
   * The incoming photograph is on the row: the job reached `tagging` or `done`,
   * which is the first moment `image_path` is written. Tagging may still be in
   * flight, and a tag that fails afterwards is an ordinary badged item — not a
   * failed replacement.
   */
  | { type: 'processing-committed' }
  | { type: 'processing-failed' }
  | { type: 'retired' }
  | { type: 'retire-failed' }
  | { type: 'restored' }
  | { type: 'restore-failed' }
  /** The reader dismisses the outcome notice. */
  | { type: 'acknowledge' };

export const initialReplaceState: ReplaceState = { phase: 'closed' };

function slotOf(state: ReplaceState): Slot | null {
  return state.phase === 'closed' ? null : { slotId: state.slotId, outgoingId: state.outgoingId };
}

/**
 * The reducer.
 *
 * Every event that does not belong to the current phase returns the SAME state
 * object, and that identity is load-bearing rather than tidy: it is how the
 * machine states that being backgrounded, resumed, or handed a late event from
 * a job the reader already cancelled changes nothing at all. There is no
 * `background` event for the same reason — the guarantee is the absence of a
 * transition, and a test asserts exactly that.
 */
export function replaceReducer(state: ReplaceState, event: ReplaceEvent): ReplaceState {
  switch (state.phase) {
    case 'closed':
      return event.type === 'open'
        ? { phase: 'choosing', slotId: event.slotId, outgoingId: event.garmentId }
        : state;

    case 'choosing': {
      const slot = slotOf(state)!;
      if (event.type === 'cancel') return { phase: 'closed' };
      // The camera is already known to be off — the screen checks before it
      // chooses, because a door found locked BEFORE anything is written must
      // not first store the outgoing piece and then have to fetch it back.
      if (event.type === 'permission-denied') {
        return {
          phase: 'failed',
          failure: event.source === 'camera' ? 'camera-denied' : 'library-denied',
          ...slot,
        };
      }
      if (event.type === 'choose') {
        return event.needsRoom
          ? { phase: 'freeing', mode: event.mode, ...slot }
          : { phase: 'capturing', mode: event.mode, freed: false, ...slot };
      }
      // `Edit details` is deliberately absent: it opens `/item/{id}` and is not
      // a replacement at all, so it must not move this machine off `choosing`
      // — the sheet closes, the route pushes, and nothing here is mutated.
      return state;
    }

    case 'freeing': {
      const slot = slotOf(state)!;
      if (event.type === 'room-freed')
        return { phase: 'capturing', mode: state.mode, freed: true, ...slot };
      // Nothing was written, so there is nothing to unwind — straight to the
      // notice.
      if (event.type === 'room-refused') return { phase: 'failed', failure: 'no-room', ...slot };
      return state;
    }

    case 'capturing': {
      const slot = slotOf(state)!;
      const stop = (failure: ReplaceFailure): ReplaceState =>
        state.freed
          ? { phase: 'restoring', failure, ...slot }
          : { phase: 'failed', failure, ...slot };

      if (event.type === 'cancel') return stop('cancelled');
      if (event.type === 'permission-denied')
        return stop(event.source === 'camera' ? 'camera-denied' : 'library-denied');
      if (event.type === 'item-created')
        return { phase: 'processing', incomingId: event.itemId, freed: state.freed, ...slot };
      return state;
    }

    case 'processing': {
      const slot = slotOf(state)!;
      if (event.type === 'processing-committed') {
        return { phase: 'retiring', incomingId: state.incomingId, freed: state.freed, ...slot };
      }
      if (event.type === 'processing-failed') {
        return state.freed
          ? { phase: 'restoring', failure: 'processing-failed', ...slot }
          : { phase: 'failed', failure: 'processing-failed', ...slot };
      }
      // A cancel this late cannot un-write a row, so it is not offered: the
      // camera is already gone and the reader is looking at the grid.
      return state;
    }

    case 'retiring': {
      const slot = slotOf(state)!;
      if (event.type === 'retired')
        return { phase: 'replaced', incomingId: state.incomingId, retired: true, ...slot };
      if (event.type === 'retire-failed')
        return { phase: 'replaced', incomingId: state.incomingId, retired: false, ...slot };
      return state;
    }

    case 'restoring': {
      const slot = slotOf(state)!;
      if (event.type === 'restored') return { phase: 'failed', failure: state.failure, ...slot };
      // The piece is in storage, not gone — one tap from back, and the notice
      // says so rather than reporting the original stop as if it were clean.
      if (event.type === 'restore-failed')
        return { phase: 'failed', failure: 'restore-failed', ...slot };
      return state;
    }

    case 'failed':
    case 'replaced':
      return event.type === 'acknowledge' ? { phase: 'closed' } : state;
  }
}

// ---------------------------------------------------------------------------
// What the screen reads off the state
// ---------------------------------------------------------------------------

/**
 * The garment whose photograph the tile must keep drawing.
 *
 * The outgoing piece until the very last transition, on BOTH paths — including
 * the whole of the no-room path, where the piece is in storage and its row has
 * left the wardrobe query. Holding the id here is what keeps a tile from going
 * blank behind the camera.
 */
export function heldGarmentId(state: ReplaceState, slotId: number): string | null {
  if (state.phase === 'closed' || state.slotId !== slotId) return null;
  return state.phase === 'replaced' ? state.incomingId : state.outgoingId;
}

/** True while the flow owes the closet a write — the slot is busy, not idle. */
export function isReplaceInFlight(state: ReplaceState): boolean {
  return (
    state.phase === 'freeing' ||
    state.phase === 'processing' ||
    state.phase === 'retiring' ||
    state.phase === 'restoring'
  );
}

/**
 * Apply the machine to the grid. The ONLY phase that moves a slot is
 * `replaced`, and it moves exactly one, through `replaceSlot` — so the length,
 * the order, the statuses and `filledCount` are identical before and after,
 * by construction rather than by assertion.
 */
export function applyReplace(slots: readonly TenSlot[], state: ReplaceState): TenSlot[] {
  if (state.phase !== 'replaced') return slots as TenSlot[];
  return replaceSlot(slots, state.slotId, state.incomingId);
}

/**
 * The piece whose row must not be touched, given a state — the assertion the
 * tests make on every non-success path, expressed once here so the screen and
 * the tests agree about what "the prior asset" means.
 */
export function retainedGarmentId(state: ReplaceState): string | null {
  if (state.phase === 'closed') return null;
  return state.outgoingId;
}

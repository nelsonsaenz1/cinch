import { useEffect, useRef, useState } from 'react';

import { claimSeedHandle } from './handle-seed-io';

/**
 * Seed a handle on arrival, once per mount, only when the profile has
 * settled with none — the invite screen's half of ledger A54.
 *
 * `settled` is "the profile read finished without error": while it is
 * pending nothing is known, and after an error the screen shows its own
 * retry. `seeding` is true while the claim is in flight so the page can hold
 * its skeleton instead of flashing "Choose a handle first" for the second
 * the write takes; `seeded` is the handle this mount claimed (the note the
 * page prints reads from it), null when the account already had one or the
 * claim failed. A failed claim leaves `handle` null and the page falls back
 * to the profile sheet exactly as before.
 */
export function useSeedHandle(input: { handle: string | null; settled: boolean }): {
  seeding: boolean;
  seeded: string | null;
} {
  const attempted = useRef(false);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);

  useEffect(() => {
    if (!input.settled || input.handle !== null || attempted.current) return;
    attempted.current = true;
    let alive = true;
    setSeeding(true);
    void claimSeedHandle()
      .then((handle) => {
        if (alive && handle) setSeeded(handle);
      })
      .finally(() => {
        if (alive) setSeeding(false);
      });
    return () => {
      alive = false;
    };
  }, [input.settled, input.handle]);

  return { seeding, seeded };
}

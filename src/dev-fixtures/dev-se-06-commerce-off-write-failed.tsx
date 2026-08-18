import { SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-06 — the one real switch, off, after a write that did not land.
 *
 * `cinch:///dev-se-06-commerce-off-write-failed`. The switch is back exactly
 * where it was and the notice says so in the one sentence that answers the
 * reader's actual fear — that it half-saved. Note the detail line reports the
 * off state in words ("Gaps stay silent"), so the preference is never carried
 * by the track colour alone.
 */
export default function DevSe06CommerceOffWriteFailed() {
  return <SeFrame whereToBuy={false} whereToBuyFailed />;
}

import { UNCONFIRMED, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-04 — one read failed, not the page.
 *
 * `cinch:///dev-se-04-read-errors-partial`. Membership could not be confirmed
 * (named as a failure, with Retry, and never drawn as Free), and neither the
 * borrow queue nor the block list has answered — so both counts are OMITTED
 * rather than printed as 0. Everything else on the page is live.
 *
 * This is the page offline, too: local preferences are true and stay drawn,
 * server counts and membership are the things that go quiet.
 */
export default function DevSe04ReadErrorsPartial() {
  return <SeFrame membership={UNCONFIRMED} borrowWaiting={null} blockedCount={null} />;
}

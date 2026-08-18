import { CONFIRMED_FREE, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-05 — confirmed free, and a binary with nothing to offer.
 *
 * `cinch:///dev-se-05-free-and-absent-rows`. Four absences in one frame, all of
 * them the same refusal:
 *
 * · No membership plate. Free is the ABSENCE of the row, never an upsell — and
 *   a failed read (SE-04) must never be drawn as this.
 * · No invite row. The profile read has not landed, so there is no link to hand
 *   over, and an empty invite row is worse than none.
 * · No Notifications row. This binary carries no push module, so the row is
 *   absent, nothing is registered, and no permission is ever requested.
 * · No Restore purchases row. Purchases are not configured in this build.
 *
 * A control that cannot work is worse than no control, and an absent row asks
 * for nothing.
 */
export default function DevSe05FreeAndAbsentRows() {
  return (
    <SeFrame
      membership={CONFIRMED_FREE}
      inviteLink={null}
      notificationsAvailable={false}
      restoreAvailable={false}
    />
  );
}

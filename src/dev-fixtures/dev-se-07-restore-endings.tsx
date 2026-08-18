import { RESTORE_NOTICES, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-07 — the restore asked, and the store answered no.
 *
 * `cinch:///dev-se-07-restore-endings`. The row is locked and says who it is
 * waiting on, and the notice under it reports the distinct ending: the store
 * ANSWERED, and the answer was no purchase. That is not a failure, and the
 * copy has to say so or a reader concludes their membership vanished — which
 * is why "nothing found" and "couldn't reach the store" are two notices and
 * not one.
 */
export default function DevSe07RestoreEndings() {
  return <SeFrame restoring restoreNotice={RESTORE_NOTICES.none} />;
}

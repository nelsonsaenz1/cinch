import { SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-08 — the sign-out question, mid-answer.
 *
 * `cinch:///dev-se-08-sign-out`. Two neutral choices, neither in destructive
 * colour: signing out is reversible and must never look like deletion. The
 * keep-option is named for the thing being kept, and the body names what
 * survives item by item. Both controls lock while the session ends.
 */
export default function DevSe08SignOut() {
  return <SeFrame signOutAsking signingOut />;
}

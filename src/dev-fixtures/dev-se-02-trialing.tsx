import { TRIALING, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-02 — the trial, with the server's own end date.
 *
 * `cinch:///dev-se-02-trialing`. The 14 days are granted once,
 * server-side, and Settings prints the exact date the read returned and nothing
 * else about it: no countdown, no renewability, no eligibility claim, no second
 * trial. `membershipRowFor` decides the whole line; this frame only supplies
 * the read.
 */
export default function DevSe02Trialing() {
  return <SeFrame membership={TRIALING} />;
}

import { MuFrame } from './mm-frames';

/**
 * DEV ONLY · MM-22 — the upgrade route reached by an account that owns nothing.
 *
 * `cinch:///dev-mm-22-plans-free`. There is no frame for this state because
 * the atlas never drew one: MB-09 was specified as a Standard member's page,
 * and everything else fell into a single refusal that said "This account is
 * already on Pro". Profile's plan door and the friends shelf both land free
 * accounts here, so it is not a hypothetical.
 *
 * What it draws instead is the comparison — one plate per paid tier, every
 * figure out of `PLANS` — and the same gate, because a free account has a
 * first purchase rather than an upgrade.
 */
export default function DevMm22PlansFree() {
  return <MuFrame paid={false} plan="free" />;
}

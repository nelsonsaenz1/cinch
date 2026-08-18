import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-10 — tier confirmed, period end not yet read.
 *
 * `cinch:///dev-mm-10-period-end-unknown`. The frame
 * `membership-period-end-unknown-omitted`. `subscriptions.current_period_end`
 * stays null until the billing webhook fills it, which genuinely lags a
 * purchase — so the colophon is DROPPED whole rather than softened into "until
 * the end of your term", which sounds like a fact and is a paraphrase of a
 * value nobody has.
 */
export default function DevMm10PeriodEndUnknown() {
  return <MmFrame currentPeriodEnd={null} />;
}

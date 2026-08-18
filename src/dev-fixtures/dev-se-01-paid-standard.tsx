import { PAID_STANDARD, SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-01 — the ordinary page. A confirmed Standard member, every read
 * landed, every group present.
 *
 * `cinch:///dev-se-01-paid-standard`. The frame `settings-full-page-top` and
 * `-middle` and `-bottom` draw between them: the blush membership plate under
 * the title, then STYLING, PEOPLE, UTILITY, ACCOUNT, DIAGNOSTICS and the
 * edition mark, all on one scrolling column.
 *
 * ALSO THE AX FRAME. Every row here holds one arrangement at every Dynamic Type
 * size — the label and its detail are stacked, and the switch's state is a word
 * beside it rather than a width the label competes for. So the accessibility
 * state of this page is this page with the system text size turned up: open it,
 * set Larger Text to AX-XXXL, and look again.
 */
export default function DevSe01PaidStandard() {
  return <SeFrame membership={PAID_STANDARD} />;
}

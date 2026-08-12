/**
 * The one Dynamic Type setting at which this group's compositions change.
 *
 * ── WHY A CONSTANT AND NOT A NUMBER PER SCREEN ────────────────────────────
 *
 * Three stress frames are drawn — C-01 / AX turns the grid into one row per
 * piece, IT-01 / AX turns the stat band into ruled rows and stacks the actions,
 * RV-01 / AX grows the review sheet and collapses three chips into one row —
 * and the accessibility note says the same thing about all three: "In every
 * case composition changes and height is allowed. Nothing is capped, truncated,
 * ellipsised or scaled below its documented size."
 *
 * Three screens changing composition at three different thresholds is three
 * different apps to the person turning the slider: the grid would relayout, the
 * item screen would not, and the review sheet would go somewhere else again.
 * One threshold means one moment where the app visibly becomes its large-type
 * self.
 *
 * ── WHY 1.5 RATHER THAN THE TOP OF THE RANGE ──────────────────────────────
 *
 * `MAX_TEXT_SCALE` is 1.8, but every one of the three arguments bites well
 * before the top: at 1.5 a 168pt-wide tile can no longer hold "Worn 31 times ·
 * $3.19 a wear" without ellipsising, three centred stat cells can no longer
 * hold their labels side by side, and three correction chips can no longer sit
 * in one row without wrapping into a shape nobody can scan. Waiting for 1.8
 * would mean shipping the exact failures the stress frames exist to prevent
 * across most of the range that reaches them.
 *
 * Read from `useWindowDimensions().fontScale`, which is the user's real setting
 * and re-renders on change like any other window dimension — never guessed at,
 * and never inferred from a measured text height.
 */
export const AX_STACK_SCALE = 1.5;

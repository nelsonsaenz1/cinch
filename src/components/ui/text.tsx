import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { capTrim, leading } from '@/theme/font-metrics';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

type Variant =
  | 'wordmark'
  | 'spread'
  | 'display'
  | 'greeting'
  | 'greetingWide'
  | 'title'
  | 'plate'
  | 'heading'
  | 'body'
  | 'callout'
  | 'label'
  | 'caption'
  | 'note'
  | 'noteSmall'
  | 'eyebrow'
  | 'colophon'
  | 'dayhead'
  | 'stat'
  | 'statSmall'
  | 'statFigure'
  | 'door';

/**
 * TWO CUTS, AND NEITHER OF THEM IS MEDIUM — TY-01 / TY-02.
 *
 * Instrument Serif for display, the regular Helvetica Neue cut for everything
 * else. Hierarchy is carried by size, colour, case and space; never by weight.
 * The correction file states the implementation rule in one line — "delete
 * every fontWeight declaration from product components; the sans inherits 400
 * and the serif is a single-weight family" — and this table is where the app
 * used to disobey it: `heading`, `label`, `caption`, `eyebrow` and `colophon`
 * all named a Medium family, which is how a tracked micro-label and a running
 * secondary sentence came to shout at the same volume as a headline.
 *
 * What replaces the weight was already here. The eyebrow and colophon are
 * uppercase and tracked, `label`/`caption` are smaller, and every quiet role is
 * `muted` rather than `ink`. `tests/type-weight.test.ts` holds the rule.
 *
 * `note`/`noteSmall` are now identical in classes to `label`/`caption`. They
 * keep their own names because the call sites mean different things by them — a
 * field label is not a sentence — and collapsing them would be a rename across
 * ~90 call sites for no visual change.
 *
 * React Native does not synthesise weights for a *bundled* family, and a system
 * face like Helvetica Neue honours its cuts by PostScript name. Either way, do
 * not reach for `fontWeight` or for a Medium family: there is one sans cut.
 *
 * Never hand-write a `lineHeight` on top of these. The sizes carry line heights
 * computed from the real font metrics; a tighter override clips the tops of the
 * glyphs. See src/theme/font-metrics.js. The app is light-only, so there are no
 * `dark:` halves here — or anywhere else, since audit item 51.
 */
const variants: Record<Variant, string> = {
  // Instrument Serif — display only.
  wordmark: 'font-display text-wordmark text-ink',
  /** The first-run tour's headline, and nothing else. See tailwind.config.js. */
  spread: 'font-display text-spread text-ink',
  display: 'font-display text-display text-ink',
  /**
   * The Today greeting, at the two widths TM-01 and TM-02 draw it.
   *
   * A variant rather than `variant="display"` with a `fontSize` override,
   * because the two are inseparable here: the sizes carry line heights computed
   * from the real font metrics (see the note below `TRIMS`), and `trim` is a
   * per-variant table of cap-height margins. Overriding the size alone would
   * leave a 40 px line box and a 40 px trim around a 30 px glyph — which is the
   * cap-trim bug this component was built to prevent, reintroduced by hand.
   */
  greeting: 'font-display text-greeting text-ink',
  greetingWide: 'font-display text-greeting-wide text-ink',
  title: 'font-title text-title text-ink',
  plate: 'font-title text-plate text-ink',

  // Helvetica Neue.
  heading: 'font-body text-heading text-ink',
  body: 'font-body text-body text-ink',
  callout: 'font-body text-callout text-ink',
  label: 'font-body text-label text-muted',
  caption: 'font-body text-caption text-muted',
  /** Secondary prose at 13px. Same classes as `label`; see the header note. */
  note: 'font-body text-label text-muted',
  /** Secondary prose at 11px. Same classes as `caption`; see the header note. */
  noteSmall: 'font-body text-caption text-muted',
  // The tracked-out eyebrow — the fashion-magazine signature.
  //
  // Set in `muted`, not `faint`. Both variants carry real, non-redundant
  // content app-wide (a ScreenHeader title is the page's H1; a plate colophon
  // is its temperature and cost per wear) at 10–13px, none of it "large text".
  // `faint` on canvas is 3.52:1 — an AA failure on nearly every screen. `muted`
  // is 5.46:1 and one step darker, not a new voice: tracking, casing and size
  // are unchanged, so the quiet layer stays the quiet layer. Reserve `faint`
  // for text genuinely redundant with an adjacent icon or duplicated on screen,
  // and set it per-caller. A caller on a dark or accent ground overrides with
  // inline `style`, never a second `text-*` class — see EventCard.tsx.
  eyebrow: 'font-body text-eyebrow uppercase text-muted',
  // The data line under a plate.
  colophon: 'font-body text-colophon uppercase text-muted',
  /**
   * A DATE at the head of a row — the serif at the heading step, 20px, ink.
   *
   * Added 2026-08-18: the Plan week drew its dates in `colophon`, the app's
   * smallest token at 10px, tracked and `muted`, with the temperature and the
   * occasion crammed into the same line. Seven days of that read as seven
   * captions, and the one thing a week is FOR — which day is which — was the
   * quietest thing on the page. The founder asked for the dates to carry more
   * weight; this is that weight, taken in size and face rather than in the
   * `fontWeight` the app does not have (TY-01/TY-02).
   *
   * Identical in classes to `stat` and `door`, and named separately anyway,
   * for exactly the reason written over those two: the alternative at the call
   * site is `variant="heading" className="font-title"`, which puts two font
   * utilities on one element and lets stylesheet key order decide whether the
   * date comes out as a serif. It takes `tabular-nums` below — a date is a
   * figure, and "Thu 7" must not shift its stem when it becomes "Thu 17".
   */
  dayhead: 'font-title text-heading text-ink',
  // ── The serif data figures ────────────────────────────────────────────────
  // Three sizes, because the app needs three and was getting them by stacking a
  // second `text-*` class on top of `stat` — `variant="stat" className="text-
  // figure"` in the item-detail grid, `className="text-label"` on the closet
  // cards. NativeWind gives no precedence between two size utilities on one
  // element, so those renders were a coin toss: the item-detail hero figure was
  // as likely to come out at `stat`'s 20px as at the 28px it was asking for.
  // Same hazard the label colours hit in button.tsx L18-25. Name the size.
  /** The default data figure — plate cost-per-wear. 20px. */
  stat: 'font-title text-heading text-ink',
  /** The figure inside a card, set beside caption text. 13px. */
  statSmall: 'font-title text-label text-ink',
  /** The hero figure of a stat grid — item detail's "42×". 28px. */
  statFigure: 'font-title text-figure text-ink',
  /**
   * The name on a door plate — the serif at the heading step, 20/−0.2.
   *
   * Identical in classes to `stat`, and named separately anyway, for the
   * reason written over the three figures above: the alternative at the call
   * site is `variant="heading" className="font-title"`, which puts two font
   * utilities on one element and lets key order in the generated stylesheet
   * decide whether the door reads as a serif or as Helvetica Medium. A door
   * name is prose, not data — it must never inherit `tabular-nums`, which is
   * what borrowing `stat` for it would eventually do the moment that variant's
   * figure treatment changes.
   */
  door: 'font-title text-heading text-ink',
};

/**
 * The cap-trim table for the serif variants.
 *
 * Instrument Serif carries a tall 1.30 line box, so a 64px setting sits inside
 * an 84px box. Untrimmed, a rule placed 12px below the text *looks* far below
 * it, and the tight editorial measure is impossible. `trim` collapses
 * the box to the cap height with negative margins, leaving the glyph box intact.
 * Opt in per use; flowing body text never wants it.
 */
const TRIMS: Partial<Record<Variant, { marginTop: number; marginBottom: number }>> = {
  wordmark: capTrim('instrument', 64, leading('instrument', 64, 1.05)),
  spread: capTrim('instrument', 56, leading('instrument', 56, 1.04)),
  display: capTrim('instrument', 40, leading('instrument', 40, 1.05)),
  greeting: capTrim('instrument', 30, leading('instrument', 30, 1.05)),
  greetingWide: capTrim('instrument', 32, leading('instrument', 32, 1.05)),
  title: capTrim('instrument', 28, leading('instrument', 28, 1.08)),
  plate: capTrim('instrument', 24, leading('instrument', 24, 1.08)),
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  className?: string;
  /** Collapse the line box to the cap height (single-line display text only). */
  trim?: boolean;
};

export function Text({ variant = 'body', className = '', trim = false, style, ...rest }: TextProps) {
  const isDisplay =
    variant === 'wordmark' ||
    variant === 'spread' ||
    variant === 'display' ||
    variant === 'greeting' ||
    variant === 'greetingWide' ||
    variant === 'title' ||
    variant === 'plate' ||
    // The hero figure sits in a fixed 2×2 grid cell; the looser 1.8 cap lets a
    // large Dynamic Type setting push "£4.20" out of its own box.
    variant === 'statFigure';

  return (
    <RNText
      // Dynamic Type: content scales with the user's system setting, but is
      // capped so a very large setting cannot destroy the plate grid.
      maxFontSizeMultiplier={isDisplay ? MAX_DISPLAY_SCALE : MAX_TEXT_SCALE}
      className={`${variants[variant]} ${className}`}
      style={[
        // Tabular figures stop wear counts, temperatures and prices from
        // jittering as digits change. Helvetica Neue ships them; this turns them on.
        variant === 'stat' ||
        variant === 'statSmall' ||
        variant === 'statFigure' ||
        variant === 'colophon' ||
        variant === 'dayhead'
          ? { fontVariant: ['tabular-nums'] }
          : null,
        trim ? TRIMS[variant] : null,
        style,
      ]}
      {...rest}
    />
  );
}

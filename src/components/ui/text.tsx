import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { capTrim, leading } from '@/theme/font-metrics';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

type Variant =
  | 'wordmark'
  | 'spread'
  | 'display'
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
  | 'stat'
  | 'statSmall'
  | 'statFigure'
  | 'door';

/**
 * Weight is a font FAMILY for the serif, and may be a family for Helvetica too.
 *
 * React Native does not synthesise weights for a *bundled* family (Instrument
 * Serif ships one weight, so there is only ever the regular cut). Helvetica Neue
 * is a system face and does honour its distinct cuts by PostScript name, which
 * is why `font-medium`/`font-semibold` resolve to HelveticaNeue-Medium. Either
 * way, do not lean on `fontWeight`; name the family.
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
  title: 'font-title text-title text-ink',
  plate: 'font-title text-plate text-ink',

  // Helvetica Neue.
  heading: 'font-semibold text-heading text-ink',
  body: 'font-body text-body text-ink',
  callout: 'font-body text-callout text-ink',
  label: 'font-medium text-label text-muted',
  caption: 'font-medium text-caption text-muted',
  // `label` and `caption` at their own sizes but in the REGULAR cut.
  //
  // Both variants above are `font-medium`, which is right for what they were
  // built for — tracked labels and buttons, the things an atlas draws at
  // `font-weight:500`. It is wrong for running secondary prose at the same
  // size: the Stylist sheet's promise line and its closing caption are the
  // quietest sentences on that screen and the atlas sets no font-weight on
  // either, so medium rendered them as bold grey shouting a disclaimer meant to
  // be murmured.
  //
  // Named variants rather than `variant="label" className="font-body"` for the
  // reason recorded under the serif figures below: NativeWind gives no
  // precedence between two utilities of the same kind on one element, and
  // `medium` follows `body` in tailwind.config.js's `fontFamily`, so the class
  // form loses and the inline-style form is at the mercy of how className
  // styles merge. Name the weight; don't stack it.
  /** Secondary prose at 13px, regular. */
  note: 'font-body text-label text-muted',
  /** Secondary prose at 11px, regular. */
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
  eyebrow: 'font-medium text-eyebrow uppercase text-muted',
  // The data line under a plate.
  colophon: 'font-medium text-colophon uppercase text-muted',
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
        variant === 'colophon'
          ? { fontVariant: ['tabular-nums'] }
          : null,
        trim ? TRIMS[variant] : null,
        style,
      ]}
      {...rest}
    />
  );
}

import { Pressable, useWindowDimensions, View } from 'react-native';

import { StatRow } from '@/components/closet/stat-row';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import {
  AVATAR_SIZE,
  BIO_SIZE,
  EDIT_PROFILE_LABEL,
  EDIT_TAP_TARGET_LARGE,
  HANDLE_SIZE,
  LARGE_TEXT_SCALE,
  NAME_SIZE,
  ZERO_BIO_CUE,
  ZERO_NAME_FALLBACK,
  zeroLeading,
} from '@/features/closet/zero-identity';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * CI-01 — the Closet at exactly zero pieces, as the signed-in person's profile.
 *
 * ── WHAT THIS REPLACES, AND WHY ───────────────────────────────────────────
 *
 * The zero branch opened with an eyebrow, a count and an example closet: a page
 * about a wardrobe that does not exist yet, and about nobody. Every other state
 * of this tab opens with the reader's own face and name (C-01's masthead), so
 * zero was the one state where Closet stopped being a profile — precisely where
 * a new account spends its first minute.
 *
 * CI-01 puts the identity first. The person is real from the moment they sign
 * in; the closet is the thing that is empty, and the page now says so in that
 * order.
 *
 * ── NOTHING HERE IS INVENTED ──────────────────────────────────────────────
 *
 * No fictional person, no fictional follower count, no illustrated placeholder
 * face. The avatar, name, handle and bio are the account's own row; where a
 * field is unset the block says what to do about it rather than filling it in.
 * The four figures are the account's own numbers, which at zero pieces are
 * genuinely zero — a PRE-ACTIVATION state, not a loading state (see `stats`).
 *
 * ── PURE PROPS, ON PURPOSE ────────────────────────────────────────────────
 *
 * This component reads no query and holds no state, so `/dev-ci-01-closet-zero`
 * renders the SAME tree the real screen does with fixed values — which is what
 * makes a simulator screenshot evidence about this component rather than about
 * whichever account happened to be signed in.
 *
 * The copy and the line-box arithmetic live in `features/closet/zero-identity`,
 * a leaf module the unit suite can import; see its header for why.
 */

export type ZeroIdentityHeaderProps = {
  /** The account's display name. Empty or null falls back to the page's own name. */
  name: string | null;
  /** "@handle · City", already joined and collapsed by the caller. */
  handleLine: string;
  /** The account's bio. Empty or null draws the cue instead. */
  bio: string | null;
  /** The profile photograph. Null draws the monogram — never a stock face. */
  avatarUrl: string | null;
  /**
   * The four figures, already resolved to numbers by the caller.
   *
   * Numbers rather than `number | undefined`: C-01's strip renders an em dash
   * while a query is in flight, because there a dash means "not known yet" and
   * a zero would be a claim the data never made. At zero pieces the claim is
   * the point — CI-01 is a pre-activation state, and four dashes on a first
   * launch read as a page that failed to load. The caller coalesces, so a
   * genuinely non-zero figure (an account with friends and no clothes) still
   * prints what it is.
   */
  stats: { pieces: number; outfits: number; unworn: number; followers: number };
  onEditProfile: () => void;
};

/**
 * The identity block: face, name, handle, bio, the way to change all four, and
 * the four figures under a rule. No enclosing card — CI-01 draws this as the
 * page's own masthead, and a card would make the person a module on a screen
 * about something else.
 */
export function ZeroIdentityHeader({
  name,
  handleLine,
  bio,
  avatarUrl,
  stats,
  onEditProfile,
}: ZeroIdentityHeaderProps) {
  const { fontScale } = useWindowDimensions();
  const lh = zeroLeading(fontScale);
  const large = fontScale >= LARGE_TEXT_SCALE;

  const displayName = name?.trim() || ZERO_NAME_FALLBACK;
  const bioLine = bio?.trim() || ZERO_BIO_CUE;

  return (
    <View>
      {/* The face and the name. `items-center` at standard sizes; at
          accessibility sizes the name and handle stack and grow, and centring a
          72pt disc against three wrapped lines drops it into the middle of the
          paragraph — so the column tops align once the text is the taller half. */}
      <View
        className="flex-row px-gutter"
        style={{ gap: 16, alignItems: large ? 'flex-start' : 'center' }}>
        <Avatar
          name={name}
          size={AVATAR_SIZE}
          tone="accent"
          imageUri={avatarUrl ?? undefined}
          fallback="?"
        />
        {/* `flexBasis: 'auto'`, not `flex-1`: a zero basis contributes nothing
            to the row's intrinsic height, so the row would collapse to the
            avatar and clip the wrapped name at accessibility sizes. */}
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 'auto' }}>
          {/* NO `trim`. The trim table holds cap-height margins computed for
              the variant's OWN 28px, and this line is set at 30 — trimming it
              would subtract the wrong margin from the wrong box. */}
          <Text
            variant="title"
            accessibilityRole="header"
            style={{ fontSize: NAME_SIZE, lineHeight: lh.name }}>
            {displayName}
          </Text>
          {/* CI-03 lets the handle wrap BELOW the name rather than truncate —
              a handle is how somebody is found, so an ellipsis costs more here
              than a second line does. */}
          {handleLine ? (
            <Text
              variant="label"
              style={{ fontSize: HANDLE_SIZE, lineHeight: lh.handle, marginTop: 6 }}>
              {handleLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* The bio at full measure, under the row rather than beside the avatar:
          a 15pt paragraph in the column left over next to a 72pt disc sets to
          about four words a line. */}
      <View className="px-gutter" style={{ marginTop: 14 }}>
        <Text variant="note" style={{ fontSize: BIO_SIZE, lineHeight: lh.bio }}>
          {bioLine}
        </Text>
      </View>

      {/* The SAME editor the rest of the app opens — one sheet, no inline
          editor and no second form. Full width and quiet: this is the only
          control in the block, so it does not have to compete for the eye, but
          it does have to be findable, which is why it is a labelled bordered
          row rather than a word tucked beside the name. */}
      <Pressable
        onPress={onEditProfile}
        accessibilityRole="button"
        accessibilityLabel="Edit your profile"
        accessibilityHint="Change your name, handle, bio and photo"
        style={{ minHeight: large ? EDIT_TAP_TARGET_LARGE : MIN_TAP_TARGET }}
        className="mx-gutter mt-4 items-center justify-center rounded-md border border-rule active:opacity-60">
        {/* The label takes a scaled box for the same reason the three lines
            above do: `label`'s own leading is numeric, so at accessibility
            sizes the glyphs are drawn inside a box built for 13px and the
            word is sliced. `handle` is the same variant at a size one point
            larger, so it is the right box to borrow. */}
        <Text variant="label" className="text-ink" style={{ lineHeight: lh.handle }}>
          {EDIT_PROFILE_LABEL}
        </Text>
      </Pressable>

      {/* The strip, unchanged from C-01 — the same four columns between the
          same rules, so a reader who fills their closet watches these numbers
          move rather than watching a different component replace them. Its
          lower rule is the divider the example is measured from. */}
      <View className="mt-5 px-gutter">
        <StatRow
          // CI-03 — the figures and their labels grow their own line boxes at
          // accessibility sizes. Opt-in, so the filled closet's own strip is
          // untouched by this packet.
          growWithType
          pieces={stats.pieces}
          outfits={stats.outfits}
          unworn={stats.unworn}
          followers={stats.followers}
        />
      </View>
    </View>
  );
}

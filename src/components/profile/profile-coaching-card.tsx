import { View } from 'react-native';

import { ExampleCard, ExampleGarments, ExampleMonogram } from '@/components/examples/example-card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PR_C1 } from '@/features/examples/example-copy';

/**
 * PR-C1 — what your friends see, shown once.
 *
 * ── THE CLAIM THIS CARD IS NOT ALLOWED TO MAKE ────────────────────────────
 *
 * "Profile is a private settings sheet. There is no public profile and search
 * reaches existing connections only." So the card says "what your friends see"
 * and the phrase "public profile" appears nowhere in it — that phrase would
 * describe a surface this app does not have, and a privacy claim shipped on a
 * guess is the one kind of copy that can never be walked back. The body says
 * the true version out loud: only accepted people, no public page, and search
 * finds only people already connected.
 *
 * ── THE PERSON ON IT DOES NOT EXIST, AND SAYS SO ──────────────────────────
 *
 * Rae Whitfield is fiction. The badge carries "Example — not a real person",
 * the caption repeats it, and the avatar is a MONOGRAM: no person photography
 * exists in this project and none can be generated, so a face here would be
 * either a fabrication or a real person standing in for a fictional one.
 * Licensing a portrait is a founder decision; until it is made this is the
 * honest picture of somebody who is not there.
 *
 * ── AND IT ROUTES TO THE SMALLEST HONEST NEXT STEP ────────────────────────
 *
 * "Start mine" goes to Edit profile when the identity is incomplete and to Add
 * clothes when it is not. It never opens a share sheet — there is nothing
 * public to share to, which is the whole point of the card.
 */
export function ProfileCoachingCard({
  onStart,
  onDismiss,
  /** What "Start mine" will do, so the label can be honest about it. */
  destination,
}: {
  onStart: () => void;
  onDismiss: () => void;
  destination: 'edit-profile' | 'add-clothes';
}) {
  return (
    <View className="px-gutter pb-2 pt-1">
      <ExampleCard
        id="PR-C1"
        badgeSuffix={PR_C1.badgeSuffix}
        caption={PR_C1.headline}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <ExampleMonogram letter={PR_C1.monogram} size={44} />
          <View className="flex-1">
            <Text variant="plate">{PR_C1.name}</Text>
            <Text variant="noteSmall">{PR_C1.handle}</Text>
          </View>
        </View>

        <Text variant="noteSmall" className="mt-2.5">
          {PR_C1.bio}
        </Text>
        <Text variant="noteSmall" className="mt-1">
          {`${PR_C1.friends} · ${PR_C1.pieces}`}
        </Text>

        <View className="mt-3">
          <ExampleGarments pieces={PR_C1.wardrobe} size={62} />
        </View>
      </ExampleCard>

      {/* The real half — outside the inert card, so both controls work. The
          example above accepts no touch; these two are the only live things
          here and they are the reason the card exists. */}
      <Text variant="note" className="mt-3">
        {PR_C1.body}
      </Text>
      <View className="mt-3.5 flex-row" style={{ gap: 8 }}>
        <Button
          title={PR_C1.accept}
          variant="ink"
          haptic
          onPress={onStart}
          accessibilityHint={
            destination === 'edit-profile'
              ? 'Opens Edit profile'
              : 'Opens Add clothes'
          }
        />
        <Button title={PR_C1.dismiss} variant="ghost" onPress={onDismiss} />
      </View>
    </View>
  );
}

/**
 * CPV2-01 → CPV2-08. "Find a product photo" — §10.6's recommended route name.
 *
 * THIS FILE IS THE CONTAINER AND ONLY THE CONTAINER. Every pixel it draws comes
 * from `SearchHeader`, `ListeningScreen` or `CatalogueBody`, all three of which
 * are presentational and stateless. What lives here is the machinery those three
 * must not have: the flow state, the recorder, the microphone permission, the
 * upload, and the navigation.
 *
 * That split is what makes the fixture routes honest. `dev-cpv2-02-listening`
 * renders the same `ListeningScreen` this screen renders, with numbers instead
 * of a recorder — so what Codex reviews is the shipping component, not a
 * lookalike drawn beside it.
 *
 * THE ONE THING THIS FILE GUARANTEES is that the microphone is a peer of the
 * field and not a second flow. §8: the spoken path writes its transcript "into
 * the same field" and makes "the identical search call as typed". So the
 * transcript is `setText` and the search is `submit` — the same two functions
 * the keyboard drives — and no branch below asks how the words arrived.
 *
 * DELIBERATE DEVIATION FROM THE ATLAS, RULED ON AND CLOSED. CPV2-03 draws the
 * search as already in flight beneath the transcript; this screen does not run
 * it until the user confirms. Dictation mishears brand names more than anything
 * else, "James Purse" costs a metered request against a hard monthly cutoff to
 * return nothing, and the atlas itself calls the transcript editable — which
 * only means something if there is a moment to edit it in. Recorded here as a
 * product decision rather than carried as a blocker.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueBody } from '@/components/catalogue/catalogue-body';
import { ListeningScreen } from '@/components/catalogue/listening-screen';
import { SearchHeader } from '@/components/catalogue/search-header';
import { ScreenHeader } from '@/components/ui/screen-header';
import { catalogueSearchOffered } from '@/features/catalogue/analytics';
import type { CataloguePath } from '@/features/catalogue/query';
import { useCatalogueFlow } from '@/features/catalogue/use-catalogue-flow';
import {
  CATALOGUE_MAX_RECORDING_MS,
  useCatalogueVoice,
} from '@/features/catalogue/use-catalogue-voice';
import { describeFailure, needsNewRecording } from '@/features/intake/use-transcription';

export default function FindPhotoScreen() {
  const params = useLocalSearchParams<{
    /** The EXTRACTED garment words — what actually gets searched. */
    words?: string;
    /** The verbatim utterance, quoted back so nothing is silently rewritten. */
    said?: string;
    colours?: string;
    path?: string;
    /**
     * `from=ten` when this door was opened inside The Ten, so CPV2-08's return
     * action names the flow the user is actually in. Three hops carry it and
     * every one has lost it before — `tests/intake-routes.test.ts` walks them.
     */
    from?: string;
  }>();

  const path: CataloguePath = params.path === 'walkthrough' ? 'walkthrough' : 'typed';
  const namedColours = params.colours ? params.colours.split(',').filter(Boolean) : [];
  const fromWalkthrough = path === 'walkthrough';
  const fromTen = params.from === 'ten';

  const view = useCatalogueFlow({
    path,
    initialText: params.words ?? '',
    namedColours,
  });

  const [transcribed, setTranscribed] = useState(false);

  useEffect(() => {
    catalogueSearchOffered(path);
  }, [path]);

  /**
   * The transcript lands in the field. It does NOT auto-search — see the
   * deviation note in the file header.
   */
  const onTranscript = useCallback(
    (transcript: string) => {
      setTranscribed(true);
      view.setText(transcript);
    },
    [view],
  );

  const voice = useCatalogueVoice(onTranscript);

  const close = useCallback(() => {
    // Leaving abandons the microphone AND the take, not just the request. A
    // recording left running behind a popped screen is the one bug that would
    // make the disclosure a lie.
    void voice.cancel();
    view.editSearch();
    router.back();
  }, [view, voice]);

  // ── CPV2-02 takes the whole screen ──────────────────────────────────────
  //
  // Not a block under the field. The atlas gives listening its own frame with
  // Cancel top-left and a typed escape, and the reason is behavioural rather
  // than decorative: a live microphone under a keyboard is a state somebody can
  // forget they are in.
  if (voice.stage === 'recording') {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
        <ListeningScreen
          elapsedMs={voice.elapsedMs}
          maxMs={CATALOGUE_MAX_RECORDING_MS}
          amplitude={voice.amplitude}
          onDone={() => void voice.stop()}
          onCancel={() => void voice.cancel()}
          // "Type it instead" abandons the recording, not the words — whatever
          // was already typed is still in the field behind this frame.
          onTypeInstead={() => void voice.cancel()}
        />
      </SafeAreaView>
    );
  }

  const showsField = view.step === 'search';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      {/* CPV2-V02 names the return destination in the back control itself,
          "because losing a partly finished procession is the worst outcome this
          flow can produce" — so it is said twice, here and in the tray. */}
      <ScreenHeader
        title="Find a product photo"
        onBack={close}
        backLabel={fromWalkthrough ? 'Back to review' : undefined}
      />

      {showsField ? (
        <SearchHeader
          text={view.text}
          onChangeText={view.setText}
          canSearch={view.canSearch && voice.stage !== 'transcribing'}
          onSubmit={view.submit}
          onSpeak={() => void voice.start()}
          transcribed={transcribed}
          micBusy={voice.stage === 'transcribing'}
          said={params.said}
          fromWalkthrough={fromWalkthrough}
          permissionDenied={voice.stage === 'permission-denied'}
          failureMessage={
            voice.stage === 'failed' && voice.failure ? describeFailure(voice.failure) : null
          }
          failureAction={
            voice.stage === 'failed' && voice.failure
              ? needsNewRecording(voice.failure) || !voice.retry
                ? { label: 'Record again', onPress: () => void voice.start() }
                : { label: 'Try again', onPress: () => void voice.retry?.() }
              : null
          }
        />
      ) : null}

      <View className="flex-1">
        <CatalogueBody
          view={view}
          transcribed={transcribed}
          onAddAnother={view.reset}
          backLabel={fromTen ? 'Back to my first ten' : 'Back to the closet'}
          onBackToCloset={() => router.replace(fromTen ? '/the-ten' : '/(tabs)/closet')}
          onPhotograph={() => router.replace('/capture')}
          onFileWords={close}
        />
      </View>
    </SafeAreaView>
  );
}

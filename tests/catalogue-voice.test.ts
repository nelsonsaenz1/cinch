/**
 * The single-item voice path, and the two things it must never do.
 *
 * IT MUST NOT TOUCH `intake_sessions`. A walkthrough session is durable and
 * resumable — `intake_sessions_resumable_idx` will offer an unfinished one back
 * to the user on their next launch. A single spoken query that created one
 * would leave a row stuck in `recording` that the app then offers as work they
 * never started, forever. The isolation is asserted structurally below, because
 * the failure is invisible in any single request and only shows up as a
 * phantom resume prompt days later.
 *
 * IT MUST NOT BREAK THE WALKTHROUGH. The bulk contract is byte-compatible: a
 * body with no `purpose` field is a walkthrough, so every deployed client keeps
 * working without knowing the field exists.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ALL_COPY, BANNED_WORDS } from '../src/features/catalogue/copy.ts';
import { fallbackUuid, newRequestId } from '../src/features/catalogue/request-id.ts';
import { INTAKE_ROUTES } from '../src/features/ingest/intake-routes.ts';

const INDEX = readFileSync('supabase/functions/transcribe-intake/index.ts', 'utf8');
const ASR = readFileSync('supabase/functions/transcribe-intake/asr.ts', 'utf8');
const VOICE = readFileSync('src/features/catalogue/use-catalogue-voice.ts', 'utf8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The `catalogueQuery` function body, comments removed. */
function catalogueBody(): string {
  const at = INDEX.indexOf('async function catalogueQuery');
  assert.ok(at > 0, 'the catalogue-query mode is gone');
  return stripComments(INDEX.slice(at));
}

// ---------------------------------------------------------------------------
// 1 · Isolation from intake_sessions
// ---------------------------------------------------------------------------

test('the catalogue mode cannot read or write a session', () => {
  const body = catalogueBody();
  assert.ok(!/intake_sessions/.test(body), 'catalogue-query names intake_sessions');
  assert.ok(!/\.update\(|\.insert\(|\.upsert\(/.test(body), 'catalogue-query writes a row');
});

test('the isolation is enforced by the signature, not by remembering', () => {
  // No `db` parameter at all — the RLS client is never handed to this branch,
  // so a future edit cannot reach a table even by accident.
  const sig = INDEX.slice(
    INDEX.indexOf('async function catalogueQuery'),
    INDEX.indexOf('): Promise<Response> {', INDEX.indexOf('async function catalogueQuery')),
  );
  assert.ok(!/\bdb\b/.test(sig), 'catalogue-query was handed the database client');
  assert.ok(/admin: SupabaseClient/.test(sig), 'it still needs admin for storage and quota');
});

test('the client sends no session id and creates no session', () => {
  const src = stripComments(VOICE);
  assert.ok(/purpose: 'catalogue-query'/.test(src));
  assert.ok(!/sessionId/.test(src), 'the catalogue voice hook still speaks in session ids');
  assert.ok(!/intake_sessions/.test(src));
});

// ---------------------------------------------------------------------------
// 2 · The walkthrough contract is unchanged
// ---------------------------------------------------------------------------

test('a body with no purpose is still a walkthrough', () => {
  // THE compatibility promise. A deployed client that has never heard of
  // `purpose` must keep working.
  assert.match(
    stripComments(INDEX),
    /body\?\.purpose === undefined \? 'walkthrough'/,
    'the default stopped being walkthrough',
  );
});

test('the walkthrough keeps every status it wrote before', () => {
  const at = INDEX.indexOf('async function walkthrough');
  const end = INDEX.indexOf('async function catalogueQuery');
  const body = INDEX.slice(at, end);
  for (const status of ['transcribing', 'parsing', 'failed']) {
    assert.ok(body.includes(`'${status}'`), `the walkthrough stopped writing ${status}`);
  }
  for (const code of ['quota_exhausted', 'audio_unreadable', 'transcription_failed', 'silent']) {
    assert.ok(body.includes(code), `the walkthrough stopped reporting ${code}`);
  }
  // And it still refuses a session that is not the caller's.
  assert.ok(/not_found/.test(body) && /session_unavailable/.test(body));
});

test('an unknown purpose is refused rather than defaulted', () => {
  // Defaulting an unrecognised value to walkthrough would let a typo drive a
  // session update from a request that meant something else entirely.
  assert.match(stripComments(INDEX), /!== 'walkthrough' && raw !== 'catalogue-query'/);
});

// ---------------------------------------------------------------------------
// 3 · One provider call, not two
// ---------------------------------------------------------------------------

test('the provider call lives in one place', () => {
  assert.ok(/audio\/transcriptions/.test(ASR), 'the shared core lost the provider call');
  assert.ok(
    !/audio\/transcriptions/.test(INDEX),
    'the router makes its own provider call — that is the duplication this split removed',
  );
  // The expensive lesson stays in the shared copy.
  assert.match(ASR, /response_format', 'json'/);
});

test('the diagnostic still logs, and still redacts', () => {
  assert.match(ASR, /console\.error/);
  assert.match(ASR, /redactUrls/);
  // A transcript, a filename or a signed URL in a log line would undo the
  // deletion promise from the other end.
  const log = ASR.slice(ASR.indexOf('console.error'), ASR.indexOf('return { ok: false, failure: \'transcription_failed\''));
  assert.ok(!/transcript|signedUrl|objectPath/.test(log), 'the failure log carries content');
});

// ---------------------------------------------------------------------------
// 4 · Deletion and retention, both modes
// ---------------------------------------------------------------------------

test('both modes delete the audio the moment a transcript exists', () => {
  const src = stripComments(INDEX);
  const deletes = src.match(/deleteStoredAudio\(/g) ?? [];
  assert.ok(deletes.length >= 2, `each mode must delete on success; found ${deletes.length}`);
});

test('a failed take survives, so the retry does not ask for a second recording', () => {
  const body = catalogueBody();
  const failureBranch = body.slice(body.indexOf('if (!outcome.ok)'), body.indexOf('await deleteStoredAudio'));
  assert.ok(
    !/deleteStoredAudio/.test(failureBranch),
    'a transient failure deletes the audio, so the retry has nothing to send',
  );
});

test('an oversized object is removed, because it will never transcribe', () => {
  const guard = ASR.slice(ASR.indexOf("if (size > MAX_BYTES)"), ASR.indexOf("createSignedUrl"));
  assert.match(guard, /remove\(/);
});

test('the 24-hour reaper covers catalogue objects with no change', () => {
  // It deletes by AGE across the whole bucket and never looks at the filename,
  // which is why this packet needed no migration. Asserted so that a future
  // narrowing of the reaper to session ids fails here rather than silently
  // retaining catalogue audio.
  const sql = readFileSync('supabase/migrations/20260810140300_intake_audio_bucket.sql', 'utf8');
  const fn = sql.slice(sql.indexOf('function public.reap_intake_audio'));
  assert.match(fn, /created_at < now\(\) - interval '24 hours'/);
  assert.ok(!/intake_sessions|session_id/.test(fn.slice(0, fn.indexOf('$$;'))));
});

// ---------------------------------------------------------------------------
// 5 · Caps, auth and quota are not relaxed for the new mode
// ---------------------------------------------------------------------------

test('the catalogue mode claims the same allowance', () => {
  assert.match(catalogueBody(), /enforceAiQuota\(admin, userId, 'tagging'\)/);
});

test('the request id comes from a UUID source that actually exists at runtime', () => {
  // `crypto.randomUUID()` was the first draft and it was wrong: nothing
  // installs a global `crypto` in this app — `react-native-quick-crypto` is
  // required lazily inside `lib/supabase.ts` and never touches `globalThis`,
  // and `expo-crypto` is not a dependency. It would have thrown on the first
  // spoken query, on a path only a microphone tap reaches.
  // `crypto.randomUUID()` was the first draft. Nothing installs a global
  // `crypto` here — `react-native-quick-crypto` is required lazily inside
  // `lib/supabase.ts` and never touches `globalThis`, and `expo-crypto` is not
  // a dependency. `uuid.v4()` from `expo-modules-core` was the second, and it
  // is better, but it reads a NATIVE binding off `globalThis.expo` and throws
  // by hand when that is missing. Both fail on a path only a microphone tap
  // reaches, which no test here can execute.
  //
  // So the id comes from a source that CANNOT throw: three rungs, each guarded.
  const ID = readFileSync('src/features/catalogue/request-id.ts', 'utf8');
  assert.match(VOICE, /newRequestId\(\)/);
  assert.ok(!/crypto\.randomUUID/.test(stripComments(VOICE)));

  for (const rung of ["expo?.uuidv4 === 'function'", "crypto?.randomUUID === 'function'"]) {
    assert.ok(ID.includes(rung), `the ${rung} rung is unguarded`);
  }
  assert.match(ID, /function fallbackUuid/);
});

test('every rung produces something the server guard accepts', () => {
  // The server validates the SHAPE before building an object name from it, so a
  // fallback that produced anything else would 400 rather than crash — a
  // quieter failure and a worse one.
  const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (let i = 0; i < 500; i += 1) {
    const id = fallbackUuid();
    assert.match(id, SHAPE, `the fallback produced an id the server would refuse: ${id}`);
  }
  // And whatever rung this runtime actually takes.
  assert.match(newRequestId(), SHAPE);
});

test('the UUID source adds no dependency', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const added of ['expo-crypto', 'uuid', 'react-native-uuid']) {
    assert.ok(!(added in deps), `${added} was added — the fingerprint would move`);
  }
  // expo-modules-core is transitive, in the bundle already, and not listed.
  assert.ok(!('expo-modules-core' in deps));
});

test('the request id cannot become a path', () => {
  // It is used to build an object name. A value with a slash in it would be a
  // value that names a directory.
  assert.match(INDEX, /const REQUEST_ID = \/\^\[0-9a-f\]\{8\}-/);
  assert.match(stripComments(INDEX), /REQUEST_ID\.test\(handle\)/);
});

test('the duration cap is checked before either mode runs', () => {
  const src = stripComments(INDEX);
  const capAt = src.indexOf('MAX_DURATION_MS');
  const branchAt = src.indexOf("purpose === 'catalogue-query'\n");
  assert.ok(capAt > 0 && capAt < branchAt, 'the duration cap moved below the mode branch');
});

test('the object path is built from the authenticated id, never from the body', () => {
  assert.match(ASR, /const objectPath = `\$\{userId\}\/\$\{objectName\}`/);
});

// ---------------------------------------------------------------------------
// 6 · The client: no auto-search, and a bounded recording
// ---------------------------------------------------------------------------

test('a transcript lands in the field and searches nothing — the ruled deviation', () => {
  // CPV2-03 draws the search as already in flight. It is not, by decision:
  // dictation mishears brand names more than anything else, and a metered
  // request against a hard monthly cutoff should not be spent before somebody
  // has read what was heard. Closed as a product deviation, not a blocker —
  // this assertion is what keeps it deliberate rather than drifting back.
  const route = stripComments(readFileSync('src/app/find-photo.tsx', 'utf8'));
  const at = route.indexOf('const onTranscript');
  const body = route.slice(at, route.indexOf('const voice =', at));
  assert.ok(/view\.setText/.test(body), 'the transcript does not reach the field');
  assert.ok(
    !/submit|view\.run|search/.test(body),
    'the transcript auto-searches — dictation mishears brand names, and this spends a metered request to prove it',
  );
});

test('the recording is bounded at the ceiling the screen states', () => {
  assert.match(VOICE, /CATALOGUE_MAX_RECORDING_MS = 30_000/);
  assert.match(VOICE, /useRecorder\(CATALOGUE_MAX_RECORDING_MS\)/);
  // Stated on screen, not merely enforced: "Listening · 0:04 of 0:30".
  const listening = readFileSync('src/components/catalogue/listening-screen.tsx', 'utf8');
  assert.match(listening, /Listening · \$\{formatClock\(elapsedMs\)\} of \$\{formatClock\(maxMs\)\}/);
});

// ---------------------------------------------------------------------------
// 6b · The voice surface is shared between the route and the fixtures
// ---------------------------------------------------------------------------

test('the listening screen is presentational and cannot record', () => {
  // If a fixture route could reach a recorder, opening it would start recording
  // whoever opened it — which is why this state had no reviewable fixture at
  // all before the split.
  const src = readFileSync('src/components/catalogue/listening-screen.tsx', 'utf8');
  assert.ok(
    !/useCatalogueVoice|useRecorder|useState|useEffect|supabase/.test(stripComments(src)),
    'the listening screen owns machinery a fixture must not have',
  );
});

test('the field header is presentational too', () => {
  const src = stripComments(readFileSync('src/components/catalogue/search-header.tsx', 'utf8'));
  assert.ok(!/useCatalogueVoice|useRecorder|useState|useEffect|supabase/.test(src));
});

test('the route and the fixtures render the same components', () => {
  // Not lookalikes drawn beside them. A second copy of this screen would be a
  // second thing to keep in step with the atlas, and it would lose.
  const route = readFileSync('src/app/find-photo.tsx', 'utf8');
  for (const component of ['ListeningScreen', 'SearchHeader']) {
    assert.ok(route.includes(component), `the route stopped using ${component}`);
  }
  for (const [file, component] of [
    ['src/app/dev-cpv2-02-listening.tsx', 'ListeningScreen'],
    ['src/app/dev-cpv2-03-transcript.tsx', 'SearchHeader'],
    ['src/app/dev-cpv2-01-idle.tsx', 'SearchHeader'],
  ] as const) {
    const src = readFileSync(file, 'utf8');
    assert.ok(src.includes(component), `${file} does not render ${component}`);
    assert.ok(
      !/useCatalogueVoice|useRecorder|useCatalogueFlow/.test(stripComments(src)),
      `${file} reaches a live hook`,
    );
  }
});

test('CPV2-02 is a whole screen, not a block under the field', () => {
  const route = stripComments(readFileSync('src/app/find-photo.tsx', 'utf8'));
  // An early return — the listening state replaces the screen rather than
  // stacking under a keyboard somebody can forget they left open.
  assert.match(route, /if \(voice\.stage === 'recording'\) \{[\s\S]{0,600}return \(/);
  const listening = readFileSync('src/components/catalogue/listening-screen.tsx', 'utf8');
  // The atlas's four load-bearing controls.
  assert.ok(listening.includes('"Cancel"'));
  assert.ok(listening.includes('"Done"'));
  assert.ok(listening.includes('"Type it instead"'));
  assert.ok(/Recording/.test(listening));
});

test('the meter is static without a live level, so a fixture never animates', () => {
  const src = readFileSync('src/components/catalogue/listening-screen.tsx', 'utf8');
  assert.match(src, /if \(!amplitude\) \{/);
  assert.match(src, /STATIC_PROFILE/);
});

test('leaving the screen abandons the microphone and the take', () => {
  const route = stripComments(readFileSync('src/app/find-photo.tsx', 'utf8'));
  const close = route.slice(route.indexOf('const close = useCallback'), route.indexOf('}, [view, voice]);'));
  assert.match(close, /voice\.cancel\(\)/);
});

test('a permission denial is its own state, not an error row', () => {
  assert.match(VOICE, /setStage\('permission-denied'\)/);
  const route = readFileSync('src/app/find-photo.tsx', 'utf8');
  assert.ok(/permission-denied/.test(route));
  // And it never reads as a failure of the recording.
  assert.ok(!/tone="critical"[\s\S]{0,200}permission/.test(route));
});

test('a retry re-sends the same request id, so no audio moves twice', () => {
  // `uploadAudio`'s 409 branch is what makes this safe, and it is only reachable
  // if the id is stable across the retry.
  const retry = VOICE.slice(VOICE.indexOf('const retry ='), VOICE.indexOf('return {'));
  assert.ok(!/newRequestId/.test(retry), 'the retry mints a new id and re-uploads');
  assert.match(retry, /held\.requestId/);
});

test('the upload is the walkthrough’s, not a second one', () => {
  assert.match(VOICE, /from '@\/features\/intake\/use-transcription'/);
  assert.match(VOICE, /uploadAudio\(userId, requestId, take\.uri\)/);
  assert.ok(!/createSignedUploadUrl/.test(VOICE), 'the catalogue hook has its own upload');
});

// ---------------------------------------------------------------------------
// 7 · Every live entry point reaches the new door
// ---------------------------------------------------------------------------

test('the Add Clothes catalogue plate opens /find-photo, ungated', () => {
  const src = stripComments(readFileSync('src/app/add-clothes.tsx', 'utf8'));
  const at = src.indexOf('name={ROUTE.catalogue.name}');
  const plate = src.slice(at, src.indexOf('/>', at));
  assert.match(plate, /router\.push\('\/find-photo'\)/);
  assert.ok(
    !/openContentDoor/.test(plate),
    'the catalogue door is behind the AI-consent sheet, which it does not need',
  );
});

test('the ?door=describe deep link lands on the same door', () => {
  const src = stripComments(readFileSync('src/app/add-clothes.tsx', 'utf8'));
  const at = src.indexOf("requestedDoor !== 'describe'");
  const block = src.slice(at, at + 900);
  assert.match(block, /find-photo/);
});

test('the capture screen’s describe control leaves for the route', () => {
  const src = readFileSync('src/app/capture.tsx', 'utf8');
  assert.match(stripComments(src), /router\.push\('\/find-photo'\)/);
  assert.ok(
    !/GarmentSearchSheet/.test(stripComments(src)),
    'capture still mounts the old listing-tile sheet',
  );
});

test('no live surface still opens the old sheet as its catalogue door', () => {
  for (const file of ['src/app/capture.tsx', 'src/app/add-clothes.tsx']) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(!/GarmentSearchSheet/.test(src), `${file} still opens the old sheet`);
  }
});

test('the door subtitle promises only what the door does', () => {
  // `/find-photo` takes typed or spoken words. It has no paste field, so the
  // plate must not offer one — a subtitle read at the moment somebody chooses
  // a door is the worst place in the app to be wrong.
  const route = INTAKE_ROUTES.find((r) => r.key === 'catalogue');
  assert.ok(route, 'the catalogue route is gone');
  assert.ok(
    !/paste|link/i.test(route.line),
    `the plate promises something /find-photo does not do: ${route.line}`,
  );
  assert.match(route.line, /^Say or type a piece/);
});

// ---------------------------------------------------------------------------
// 8 · The new copy obeys the same ban
// ---------------------------------------------------------------------------

test('the CPV2-01/02/03/V02 copy carries no shopping word', () => {
  const NEGATED = /\b(not|never|no|does not|isn't|is not)\b[^.]*$/i;
  for (const line of ALL_COPY) {
    for (const banned of BANNED_WORDS) {
      const at = line.toLowerCase().indexOf(banned);
      if (at === -1) continue;
      assert.ok(NEGATED.test(line.slice(0, at)), `"${banned}" asserted in: ${line}`);
    }
  }
});

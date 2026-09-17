#!/usr/bin/env node
/**
 * App Store Connect — custom product pages (CPP).
 *
 *   node scripts/asc-cpp.mjs read
 *   node scripts/asc-cpp.mjs create  --name "<internal name>"
 *   node scripts/asc-cpp.mjs upload  --page <pageId> --folder <ordered-folder> [--locale en-US]
 *   node scripts/asc-cpp.mjs submit  --page <pageId>
 *
 * Why this exists (docs/app-store/screenshot-v4-fix-directive.md §6): a live
 * version's screenshots are locked, so new art that must not wait for a binary
 * ships as a custom product page. A CPP carries its own localisations and
 * screenshot sets, needs App Review, but needs NO build. Apple Ads can point a
 * campaign at the page's `url` (the ppid link) once it is approved.
 *
 * `upload` expects the folder that scripts/prep-appstore-upload.py writes:
 * NN-name.png, already in ship order, already flattened. Files are uploaded in
 * name order, which App Store Connect keeps as display order.
 *
 * Auth: the same L5FX967PC6 key scripts/asc-listing.mjs uses.
 */
import { createHash, createSign } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_ID = '6798479578';
const KID = 'L5FX967PC6';
const ISS = '15be563e-238a-41b6-891b-950650cf424e';
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`;
const API = 'https://api.appstoreconnect.apple.com/v1';
const DISPLAY_TYPE = 'APP_IPHONE_67'; // the 6.9"/6.7" slot; 1320×2868 lands here (the live v3 set does)
const PROMOTIONAL_TEXT =
  'Ten pieces is all it takes. Cinch dresses you in clothes you already own — it never invents a garment or asks you to buy one first.';

function jwt() {
  const pem = readFileSync(KEY_PATH, 'utf8');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: KID, typ: 'JWT' });
  const body = b64({ iss: ISS, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}
let token = null;
async function api(method, path, body) {
  token ??= jwt();
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 600)}`);
  return json;
}
const get = (p) => api('GET', p);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function pages() {
  const { data } = await get(`/apps/${APP_ID}/appCustomProductPages?fields[appCustomProductPages]=name,url,visible&limit=50`);
  return data.map((p) => ({ id: p.id, ...p.attributes }));
}
async function versionsOf(pageId) {
  const { data } = await get(`/appCustomProductPages/${pageId}/appCustomProductPageVersions?fields[appCustomProductPageVersions]=version,state,deepLink&limit=10`);
  return data.map((v) => ({ id: v.id, ...v.attributes }));
}
async function localizationsOf(versionId) {
  const { data } = await get(`/appCustomProductPageVersions/${versionId}/appCustomProductPageLocalizations?fields[appCustomProductPageLocalizations]=locale,promotionalText&limit=50`);
  return data.map((l) => ({ id: l.id, ...l.attributes }));
}
async function setsOf(localizationId) {
  const { data } = await get(`/appCustomProductPageLocalizations/${localizationId}/appScreenshotSets?include=appScreenshots&limit=50`);
  const out = [];
  for (const set of data) {
    const shots = (await get(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data.map((s) => ({
      id: s.id,
      fileName: s.attributes.fileName,
      state: s.attributes.assetDeliveryState?.state,
    }));
    out.push({ id: set.id, displayType: set.attributes.screenshotDisplayType, shots });
  }
  return out;
}

/** The version to edit: the newest one that is still editable. */
async function editableVersion(pageId) {
  const vs = await versionsOf(pageId);
  const v = vs.find((x) => x.state === 'PREPARE_FOR_SUBMISSION' || x.state === 'REJECTED');
  if (!v) throw new Error(`no editable version on page ${pageId}: ${JSON.stringify(vs)}`);
  return v;
}

async function cmdRead() {
  const ps = await pages();
  if (ps.length === 0) console.log('no custom product pages (0 of 70)');
  for (const p of ps) {
    console.log(`page ${p.id}  "${p.name}"  visible=${p.visible}\n  url: ${p.url}`);
    for (const v of await versionsOf(p.id)) {
      console.log(`  version ${v.id}  v${v.version}  ${v.state}${v.deepLink ? `  deepLink=${v.deepLink}` : ''}`);
      for (const l of await localizationsOf(v.id)) {
        console.log(`    ${l.locale}  promo=${l.promotionalText ? `${l.promotionalText.length} chars` : 'null'}`);
        for (const s of await setsOf(l.id)) {
          console.log(`      ${s.displayType}: ${s.shots.length} shots`);
          for (const sh of s.shots) console.log(`        ${sh.fileName}  ${sh.state}`);
        }
      }
    }
  }
}

async function cmdCreate() {
  const name = arg('name');
  const locale = arg('locale') ?? 'en-US';
  if (!name) throw new Error('--name is required');
  // Apple requires the first version and its first localisation inline, by
  // temporary id (`${…}`), on the page's own create request.
  const { data } = await api('POST', '/appCustomProductPages', {
    data: {
      type: 'appCustomProductPages',
      attributes: { name },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } },
        appCustomProductPageVersions: { data: [{ type: 'appCustomProductPageVersions', id: '${new-version}' }] },
      },
    },
    included: [
      {
        type: 'appCustomProductPageVersions',
        id: '${new-version}',
        relationships: {
          appCustomProductPageLocalizations: { data: [{ type: 'appCustomProductPageLocalizations', id: '${new-loc}' }] },
        },
      },
      {
        type: 'appCustomProductPageLocalizations',
        id: '${new-loc}',
        attributes: { locale, promotionalText: PROMOTIONAL_TEXT },
      },
    ],
  });
  console.log(`created page ${data.id}  "${data.attributes.name}"\n  url: ${data.attributes.url}`);
  for (const v of await versionsOf(data.id)) {
    console.log(`  version ${v.id}  v${v.version}  ${v.state}`);
    for (const l of await localizationsOf(v.id)) console.log(`    ${l.locale} ${l.id}`);
  }
}

async function cmdUpload() {
  const pageId = arg('page');
  const folder = arg('folder');
  const locale = arg('locale') ?? 'en-US';
  if (!pageId || !folder) throw new Error('--page and --folder are required');

  const files = readdirSync(folder).filter((f) => /^\d{2}-[a-z0-9-]+\.png$/.test(f)).sort();
  if (files.length === 0) throw new Error(`no NN-name.png files in ${folder}`);
  if (files.length > 10) throw new Error(`${files.length} files; Apple takes at most 10`);

  const version = await editableVersion(pageId);
  console.log(`version ${version.id} (${version.state})`);

  let loc = (await localizationsOf(version.id)).find((l) => l.locale === locale);
  if (!loc) {
    const { data } = await api('POST', '/appCustomProductPageLocalizations', {
      data: {
        type: 'appCustomProductPageLocalizations',
        attributes: { locale, promotionalText: PROMOTIONAL_TEXT },
        relationships: { appCustomProductPageVersion: { data: { type: 'appCustomProductPageVersions', id: version.id } } },
      },
    });
    loc = { id: data.id, ...data.attributes };
    console.log(`created localisation ${locale} ${loc.id}`);
  } else {
    console.log(`localisation ${locale} ${loc.id} exists`);
  }

  let set = (await setsOf(loc.id)).find((s) => s.displayType === DISPLAY_TYPE);
  if (set && set.shots.length > 0) {
    throw new Error(`set ${set.id} already holds ${set.shots.length} shots — delete them in ASC (or by id) before re-uploading; this script never overwrites`);
  }
  if (!set) {
    const { data } = await api('POST', '/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: DISPLAY_TYPE },
        relationships: { appCustomProductPageLocalization: { data: { type: 'appCustomProductPageLocalizations', id: loc.id } } },
      },
    });
    set = { id: data.id, displayType: DISPLAY_TYPE, shots: [] };
    console.log(`created ${DISPLAY_TYPE} set ${set.id}`);
  }

  for (const fileName of files) {
    const bytes = readFileSync(join(folder, fileName));
    const reserved = await api('POST', '/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
      },
    });
    for (const op of reserved.data.attributes.uploadOperations) {
      const chunk = bytes.subarray(op.offset, op.offset + op.length);
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (!r.ok) throw new Error(`upload chunk for ${fileName} → ${r.status}`);
    }
    await api('PATCH', `/appScreenshots/${reserved.data.id}`, {
      data: {
        type: 'appScreenshots',
        id: reserved.data.id,
        attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') },
      },
    });
    console.log(`  uploaded ${fileName} (${bytes.length} bytes) → ${reserved.data.id}`);
  }

  // Read back until Apple has processed every file.
  for (let i = 0; i < 20; i++) {
    const shots = (await setsOf(loc.id)).find((s) => s.id === set.id)?.shots ?? [];
    const states = shots.map((s) => `${s.fileName}:${s.state}`);
    console.log(`  states: ${states.join('  ')}`);
    if (shots.length === files.length && shots.every((s) => s.state === 'COMPLETE')) return;
    if (shots.some((s) => s.state === 'FAILED')) throw new Error('a screenshot FAILED processing');
    await new Promise((r) => setTimeout(r, 6000));
  }
  console.log('  (still processing — re-run `read` in a minute)');
}

async function cmdSubmit() {
  const pageId = arg('page');
  if (!pageId) throw new Error('--page is required');
  const version = await editableVersion(pageId);
  const open = (await get(`/apps/${APP_ID}/reviewSubmissions?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&fields[reviewSubmissions]=state`)).data;
  if (open.length) throw new Error(`a review submission is already open: ${JSON.stringify(open.map((s) => [s.id, s.attributes.state]))}`);

  const sub = await api('POST', '/reviewSubmissions', {
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
  });
  console.log(`review submission ${sub.data.id} ${sub.data.attributes.state}`);
  await api('POST', '/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
        appCustomProductPageVersion: { data: { type: 'appCustomProductPageVersions', id: version.id } },
      },
    },
  });
  console.log(`  item added: CPP version ${version.id}`);
  const done = await api('PATCH', `/reviewSubmissions/${sub.data.id}`, {
    data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } },
  });
  console.log(`  submitted → ${done.data.attributes.state}`);
}

const cmd = process.argv[2];
const run = { read: cmdRead, create: cmdCreate, upload: cmdUpload, submit: cmdSubmit }[cmd];
if (!run) {
  console.error('usage: asc-cpp.mjs read | create --name X | upload --page ID --folder DIR [--locale en-US] | submit --page ID');
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

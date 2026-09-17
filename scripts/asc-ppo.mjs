#!/usr/bin/env node
/**
 * Product Page Optimization — an A/B test of the default product page's
 * screenshots (App Store Connect "experiments", v2).
 *
 *   node scripts/asc-ppo.mjs read
 *   node scripts/asc-ppo.mjs create --name "<test name>" --treatment "<treatment name>" --folder <ordered-folder> [--traffic 50]
 *
 * The original is whatever the current version's page carries; the treatment
 * is the folder (scripts/prep-appstore-upload.py shape: NN-name.png, ship
 * order), uploaded to an en-US APP_IPHONE_67 set on the treatment. Other
 * locales fall back to the original. The experiment rides the next review
 * submission (scripts/asc-release.mjs submit adds it when one is PREPARE_FOR_SUBMISSION-shaped)
 * and starts when that version is released.
 *
 * Auth: the L5FX967PC6 key, as scripts/asc-listing.mjs.
 */
import { createHash, createSign } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_ID = '6798479578';
const KID = 'L5FX967PC6';
const ISS = '15be563e-238a-41b6-891b-950650cf424e';
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`;
const API = 'https://api.appstoreconnect.apple.com';
const DISPLAY_TYPE = 'APP_IPHONE_67';

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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 800)}`);
  return json;
}
const get = (p) => api('GET', p);
function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
}

async function experiments() {
  const { data } = await get(`/v1/apps/${APP_ID}/appStoreVersionExperimentsV2?fields[appStoreVersionExperiments]=name,platform,trafficProportion,state,reviewRequired,startDate,endDate&limit=50`);
  return data.map((e) => ({ id: e.id, ...e.attributes }));
}
async function treatments(expId) {
  const { data } = await get(`/v2/appStoreVersionExperiments/${expId}/appStoreVersionExperimentTreatments?fields[appStoreVersionExperimentTreatments]=name,appIconName,promotedDate&limit=50`);
  return data.map((t) => ({ id: t.id, ...t.attributes }));
}
async function treatmentLocs(tId) {
  const { data } = await get(`/v1/appStoreVersionExperimentTreatments/${tId}/appStoreVersionExperimentTreatmentLocalizations?limit=50`);
  return data.map((l) => ({ id: l.id, locale: l.attributes.locale }));
}
async function setsOf(locId) {
  const { data } = await get(`/v1/appStoreVersionExperimentTreatmentLocalizations/${locId}/appScreenshotSets?limit=50`);
  return data.map((s) => ({ id: s.id, displayType: s.attributes.screenshotDisplayType }));
}
async function shots(setId) {
  const { data } = await get(`/v1/appScreenshotSets/${setId}/appScreenshots?limit=50`);
  return data.map((s) => ({ fileName: s.attributes.fileName, state: s.attributes.assetDeliveryState?.state }));
}

async function cmdRead() {
  const es = await experiments();
  if (!es.length) console.log('no experiments');
  for (const e of es) {
    console.log(`experiment ${e.id}  "${e.name}"  ${e.platform}  ${e.trafficProportion}%  ${e.state}`);
    for (const t of await treatments(e.id)) {
      console.log(`  treatment ${t.id}  "${t.name}"`);
      for (const l of await treatmentLocs(t.id)) {
        for (const s of await setsOf(l.id)) {
          const list = await shots(s.id);
          console.log(`    ${l.locale}  ${s.displayType}: ${list.map((x) => `${x.fileName}:${x.state}`).join('  ')}`);
        }
      }
    }
  }
}

async function cmdCreate() {
  const name = arg('name');
  const tname = arg('treatment');
  const folder = arg('folder');
  const traffic = Number(arg('traffic', '50'));
  if (!name || !tname || !folder) throw new Error('--name, --treatment and --folder are required');
  const files = readdirSync(folder).filter((f) => /^\d{2}-[a-z0-9-]+\.png$/.test(f)).sort();
  if (!files.length || files.length > 10) throw new Error(`${files.length} frames in ${folder}`);

  const exp = await api('POST', '/v2/appStoreVersionExperiments', {
    data: {
      type: 'appStoreVersionExperiments',
      attributes: { name, platform: 'IOS', trafficProportion: traffic },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  const expId = exp.data.id;
  console.log(`experiment ${expId} "${name}" ${traffic}% ${exp.data.attributes.state}`);

  const tr = await api('POST', '/v1/appStoreVersionExperimentTreatments', {
    data: {
      type: 'appStoreVersionExperimentTreatments',
      attributes: { name: tname },
      relationships: { appStoreVersionExperimentV2: { data: { type: 'appStoreVersionExperiments', id: expId } } },
    },
  });
  const tId = tr.data.id;
  console.log(`  treatment ${tId} "${tname}"`);

  let loc = (await treatmentLocs(tId)).find((l) => l.locale === 'en-US');
  if (!loc) {
    const r = await api('POST', '/v1/appStoreVersionExperimentTreatmentLocalizations', {
      data: {
        type: 'appStoreVersionExperimentTreatmentLocalizations',
        attributes: { locale: 'en-US' },
        relationships: { appStoreVersionExperimentTreatment: { data: { type: 'appStoreVersionExperimentTreatments', id: tId } } },
      },
    });
    loc = { id: r.data.id, locale: 'en-US' };
  }
  console.log(`    localisation en-US ${loc.id}`);

  await fillSet(loc.id, folder, files);
}

/**
 * Apple pre-fills a new treatment with the ORIGINAL page's screenshots (the
 * first run hit 409 SCREENSHOT_TOO_MANY at ten), so the set is emptied before
 * the treatment's own frames go up.
 */
async function fillSet(locId, folder, files) {
  let set = (await setsOf(locId)).find((s) => s.displayType === DISPLAY_TYPE);
  if (set) {
    const { data } = await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    for (const s of data) await api('DELETE', `/v1/appScreenshots/${s.id}`);
    console.log(`    cleared ${data.length} pre-filled screenshots`);
  }
  const loc = { id: locId };
  if (!set) {
    const r = await api('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: DISPLAY_TYPE },
        relationships: { appStoreVersionExperimentTreatmentLocalization: { data: { type: 'appStoreVersionExperimentTreatmentLocalizations', id: loc.id } } },
      },
    });
    set = { id: r.data.id };
  }
  for (const fileName of files) {
    const bytes = readFileSync(join(folder, fileName));
    const reserved = await api('POST', '/v1/appScreenshots', {
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
    await api('PATCH', `/v1/appScreenshots/${reserved.data.id}`, {
      data: { type: 'appScreenshots', id: reserved.data.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } },
    });
    process.stdout.write(`${fileName} `);
  }
  console.log('');
  for (let i = 0; i < 20; i++) {
    const list = await shots(set.id);
    const pending = list.filter((x) => x.state !== 'COMPLETE');
    console.log(`    processed ${list.length - pending.length}/${list.length}`);
    if (pending.some((x) => x.state === 'FAILED')) throw new Error('a screenshot FAILED');
    if (!pending.length) break;
    await new Promise((r) => setTimeout(r, 8000));
  }
}

async function cmdFill() {
  const folder = arg('folder');
  const locId = arg('loc');
  if (!folder || !locId) throw new Error('--loc and --folder are required');
  const files = readdirSync(folder).filter((f) => /^\d{2}-[a-z0-9-]+\.png$/.test(f)).sort();
  await fillSet(locId, folder, files);
}

const run = { read: cmdRead, create: cmdCreate, fill: cmdFill }[process.argv[2]];
if (!run) {
  console.error('usage: asc-ppo.mjs read | create --name X --treatment Y --folder DIR [--traffic 50]');
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

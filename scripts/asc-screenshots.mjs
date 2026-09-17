#!/usr/bin/env node
/**
 * Replace the iPhone screenshots on an App Store version — every localisation.
 *
 *   node scripts/asc-screenshots.mjs replace --version 1.2.6 --folder docs/app-store/screenshots/v4
 *   node scripts/asc-screenshots.mjs read    --version 1.2.6
 *
 * The folder is the ship-order bundle scripts/prep-appstore-upload.py writes
 * (NN-name.png, flattened). For each localisation of the version: the
 * APP_IPHONE_67 set is created if absent, every screenshot it holds is deleted,
 * and the folder is uploaded in name order. Refuses a version that is not
 * editable — a live version's screenshots are locked by Apple anyway, and the
 * refusal names it rather than failing seven PATCHes deep.
 *
 * Why every localisation: a version localisation without screenshots blocks
 * submission, and the storefront a person sees is decided by their device, so
 * en-GB / en-CA / en-AU / es-MX all carry the same set as en-US.
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
const API = 'https://api.appstoreconnect.apple.com/v1';
const DISPLAY_TYPE = 'APP_IPHONE_67';
const EDITABLE = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'WAITING_FOR_REVIEW']);

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

async function version(versionString) {
  const { data } = await get(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const v = data.find((x) => x.attributes.versionString === versionString);
  if (!v) throw new Error(`no version ${versionString}`);
  return { id: v.id, version: versionString, state: v.attributes.appStoreState };
}
async function localizations(versionId) {
  const { data } = await get(`/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`);
  return data.map((l) => ({ id: l.id, locale: l.attributes.locale }));
}
async function sets(locId) {
  const { data } = await get(`/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=50`);
  return data.map((s) => ({ id: s.id, displayType: s.attributes.screenshotDisplayType }));
}
async function shots(setId) {
  const { data } = await get(`/appScreenshotSets/${setId}/appScreenshots?limit=50`);
  return data.map((s) => ({ id: s.id, fileName: s.attributes.fileName, state: s.attributes.assetDeliveryState?.state }));
}

async function cmdRead() {
  const v = await version(arg('version'));
  console.log(`${v.version}  ${v.state}`);
  for (const l of await localizations(v.id)) {
    for (const s of await sets(l.id)) {
      const list = await shots(s.id);
      console.log(`  ${l.locale}  ${s.displayType}: ${list.map((x) => `${x.fileName}:${x.state}`).join('  ')}`);
    }
  }
}

async function upload(setId, folder, files) {
  for (const fileName of files) {
    const bytes = readFileSync(join(folder, fileName));
    const reserved = await api('POST', '/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
      },
    });
    for (const op of reserved.data.attributes.uploadOperations) {
      const chunk = bytes.subarray(op.offset, op.offset + op.length);
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (!r.ok) throw new Error(`upload chunk for ${fileName} → ${r.status}`);
    }
    await api('PATCH', `/appScreenshots/${reserved.data.id}`, {
      data: { type: 'appScreenshots', id: reserved.data.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } },
    });
    process.stdout.write(`${fileName} `);
  }
}

async function cmdReplace() {
  const folder = arg('folder');
  if (!folder) throw new Error('--folder is required');
  const files = readdirSync(folder).filter((f) => /^\d{2}-[a-z0-9-]+\.png$/.test(f)).sort();
  if (!files.length || files.length > 10) throw new Error(`${files.length} NN-name.png files in ${folder}; Apple takes 1–10`);
  const v = await version(arg('version'));
  if (!EDITABLE.has(v.state)) throw new Error(`${v.version} is ${v.state} — its screenshots are locked; use a custom product page or the next version`);
  console.log(`${v.version}  ${v.state}  ${files.length} frames`);
  for (const l of await localizations(v.id)) {
    let set = (await sets(l.id)).find((s) => s.displayType === DISPLAY_TYPE);
    if (!set) {
      const { data } = await api('POST', '/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: DISPLAY_TYPE },
          relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: l.id } } },
        },
      });
      set = { id: data.id, displayType: DISPLAY_TYPE };
    }
    const old = await shots(set.id);
    for (const s of old) await api('DELETE', `/appScreenshots/${s.id}`);
    process.stdout.write(`  ${l.locale}: removed ${old.length}, uploading `);
    await upload(set.id, folder, files);
    console.log('');
  }
  // Read back until processed.
  for (let i = 0; i < 20; i++) {
    let pending = 0, failed = 0, total = 0;
    for (const l of await localizations(v.id)) {
      for (const s of await sets(l.id)) {
        if (s.displayType !== DISPLAY_TYPE) continue;
        for (const x of await shots(s.id)) {
          total += 1;
          if (x.state === 'FAILED') failed += 1;
          else if (x.state !== 'COMPLETE') pending += 1;
        }
      }
    }
    console.log(`  processed: ${total - pending - failed}/${total}${failed ? `  FAILED ${failed}` : ''}`);
    if (failed) throw new Error('a screenshot FAILED processing');
    if (!pending) return;
    await new Promise((r) => setTimeout(r, 8000));
  }
  console.log('  (still processing — re-run `read`)');
}

const run = { read: cmdRead, replace: cmdReplace }[process.argv[2]];
if (!run) {
  console.error('usage: asc-screenshots.mjs read --version X | replace --version X --folder DIR');
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

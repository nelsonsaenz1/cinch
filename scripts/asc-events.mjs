#!/usr/bin/env node
/**
 * In-app events (App Store Connect).
 *
 *   node scripts/asc-events.mjs read
 *   node scripts/asc-events.mjs create --spec <event.json>
 *
 * The spec is one JSON object:
 *   {
 *     "referenceName": "...", "badge": "CHALLENGE", "purpose": "ATTRACT_NEW_USERS",
 *     "priority": "HIGH", "deepLink": "cinch://the-ten",
 *     "publishStart": "2026-09-18T00:00:00Z", "eventStart": "...", "eventEnd": "...",
 *     "locale": "en-US", "name": "≤30", "shortDescription": "≤50", "longDescription": "≤120",
 *     "card": "path/1920x1080.png", "details": "path/1080x1920.png"
 *   }
 * Media: card 16:9 (1920×1080 min), details 9:16 (1080×1920 min). Name ≤ 30,
 * short ≤ 50, long ≤ 120 characters; an event runs ≤ 31 days and may be
 * promoted up to 14 days ahead. The outfit count is never a constant in any of
 * these strings (docs/design/positioning-contract.md §3).
 *
 * An event needs App Review: it rides the next review submission (see
 * scripts/asc-release.mjs submit, or add a reviewSubmissionItems row with an
 * appEvent relationship).
 */
import { createSign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename } from 'node:path';

const APP_ID = '6798479578';
const KID = 'L5FX967PC6';
const ISS = '15be563e-238a-41b6-891b-950650cf424e';
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`;
const API = 'https://api.appstoreconnect.apple.com/v1';

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
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function events() {
  const { data } = await get(`/apps/${APP_ID}/appEvents?fields[appEvents]=referenceName,badge,eventState,deepLink,purpose,priority,territorySchedules&limit=50`);
  return data.map((e) => ({ id: e.id, ...e.attributes }));
}
async function locsOf(eventId) {
  const { data } = await get(`/appEvents/${eventId}/localizations?fields[appEventLocalizations]=locale,name,shortDescription,longDescription&limit=50`);
  return data.map((l) => ({ id: l.id, ...l.attributes }));
}
async function mediaOf(locId) {
  const { data } = await get(`/appEventLocalizations/${locId}/appEventScreenshots?fields[appEventScreenshots]=fileName,appEventAssetType,assetDeliveryState&limit=50`);
  return data.map((m) => ({ id: m.id, fileName: m.attributes.fileName, type: m.attributes.appEventAssetType, state: m.attributes.assetDeliveryState?.state, errors: m.attributes.assetDeliveryState?.errors }));
}

async function cmdRead() {
  const es = await events();
  if (!es.length) console.log('no in-app events');
  for (const e of es) {
    const sched = (e.territorySchedules ?? []).map((s) => `${s.eventStart} → ${s.eventEnd} (publish ${s.publishStart})`).join('; ');
    console.log(`event ${e.id}  "${e.referenceName}"  ${e.badge}  ${e.eventState}  ${e.purpose}  ${e.priority}  ${e.deepLink}\n  ${sched}`);
    for (const l of await locsOf(e.id)) {
      console.log(`  ${l.locale}  "${l.name}" / "${l.shortDescription}" / "${l.longDescription}"`);
      for (const m of await mediaOf(l.id)) console.log(`    ${m.type}  ${m.fileName}  ${m.state}${m.errors?.length ? `  ${JSON.stringify(m.errors)}` : ''}`);
    }
  }
}

async function uploadMedia(locId, type, path) {
  const bytes = readFileSync(path);
  const fileName = basename(path);
  const reserved = await api('POST', '/appEventScreenshots', {
    data: {
      type: 'appEventScreenshots',
      attributes: { fileName, fileSize: statSync(path).size, appEventAssetType: type },
      relationships: { appEventLocalization: { data: { type: 'appEventLocalizations', id: locId } } },
    },
  });
  for (const op of reserved.data.attributes.uploadOperations) {
    const chunk = bytes.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!r.ok) throw new Error(`upload chunk for ${fileName} → ${r.status}`);
  }
  // Unlike appScreenshots, appEventScreenshots has no sourceFileChecksum
  // attribute (409 ATTRIBUTE.UNKNOWN on the first run) — `uploaded` alone commits.
  await api('PATCH', `/appEventScreenshots/${reserved.data.id}`, {
    data: { type: 'appEventScreenshots', id: reserved.data.id, attributes: { uploaded: true } },
  });
  console.log(`    uploaded ${type} ${fileName}`);
}

async function cmdCreate() {
  const spec = JSON.parse(readFileSync(arg('spec'), 'utf8'));
  const limits = { name: 30, shortDescription: 50, longDescription: 120 };
  for (const [k, max] of Object.entries(limits)) {
    if ((spec[k] ?? '').length > max) throw new Error(`${k} is ${spec[k].length} chars (limit ${max})`);
  }
  // Apple requires an explicit territory list on every schedule; the event is
  // sold everywhere the app is, so every territory Apple lists.
  const territories = (await get('/territories?limit=200')).data.map((t) => ({ type: 'territories', id: t.id }));
  const ev = await api('POST', '/appEvents', {
    data: {
      type: 'appEvents',
      attributes: {
        referenceName: spec.referenceName,
        badge: spec.badge,
        deepLink: spec.deepLink,
        purchaseRequirement: 'NO_COST_ASSOCIATED',
        primaryLocale: spec.locale ?? 'en-US',
        priority: spec.priority ?? 'NORMAL',
        purpose: spec.purpose,
        territorySchedules: [{ territories: territories.map((t) => t.id), publishStart: spec.publishStart, eventStart: spec.eventStart, eventEnd: spec.eventEnd }],
      },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  console.log(`event ${ev.data.id} "${spec.referenceName}" ${ev.data.attributes.eventState}`);
  const loc = await api('POST', '/appEventLocalizations', {
    data: {
      type: 'appEventLocalizations',
      attributes: { locale: spec.locale ?? 'en-US', name: spec.name, shortDescription: spec.shortDescription, longDescription: spec.longDescription },
      relationships: { appEvent: { data: { type: 'appEvents', id: ev.data.id } } },
    },
  });
  console.log(`  localisation ${loc.data.id} ${spec.locale ?? 'en-US'}`);
  await uploadMedia(loc.data.id, 'EVENT_CARD', spec.card);
  await uploadMedia(loc.data.id, 'EVENT_DETAILS_PAGE', spec.details);
  for (let i = 0; i < 20; i++) {
    const m = await mediaOf(loc.data.id);
    console.log(`    states: ${m.map((x) => `${x.type}:${x.state}`).join('  ')}`);
    if (m.some((x) => x.state === 'FAILED')) throw new Error(`media FAILED: ${JSON.stringify(m.map((x) => x.errors))}`);
    if (m.length === 2 && m.every((x) => x.state === 'COMPLETE')) return;
    await new Promise((r) => setTimeout(r, 8000));
  }
}

/** Finish a localisation's media: commit anything awaiting upload, add what is missing. */
async function cmdMedia() {
  const locId = arg('loc');
  const want = { EVENT_CARD: arg('card'), EVENT_DETAILS_PAGE: arg('details') };
  const have = await mediaOf(locId);
  for (const m of have) {
    if (m.state === 'AWAITING_UPLOAD') {
      await api('PATCH', `/appEventScreenshots/${m.id}`, { data: { type: 'appEventScreenshots', id: m.id, attributes: { uploaded: true } } });
      console.log(`    committed ${m.type} ${m.fileName}`);
    }
  }
  for (const [type, path] of Object.entries(want)) {
    if (path && !have.some((m) => m.type === type)) await uploadMedia(locId, type, path);
  }
  for (let i = 0; i < 20; i++) {
    const m = await mediaOf(locId);
    console.log(`    states: ${m.map((x) => `${x.type}:${x.state}`).join('  ')}`);
    if (m.some((x) => x.state === 'FAILED')) throw new Error(`media FAILED: ${JSON.stringify(m.map((x) => x.errors))}`);
    if (m.length === 2 && m.every((x) => x.state === 'COMPLETE')) return;
    await new Promise((r) => setTimeout(r, 8000));
  }
}

const run = { read: cmdRead, create: cmdCreate, media: cmdMedia }[process.argv[2]];
if (!run) {
  console.error('usage: asc-events.mjs read | create --spec event.json | media --loc ID --card PNG --details PNG');
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

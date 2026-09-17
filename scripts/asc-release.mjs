#!/usr/bin/env node
/**
 * Build-49 release helper (App Store Connect API, key L5FX967PC6).
 *
 *   node asc-release.mjs status [--version 1.2.5]
 *   node asc-release.mjs whatsnew --version 1.2.5 --file whatsnew.txt   (every localisation)
 *   node asc-release.mjs attach --version 1.2.5 [--build <buildId>]     (latest processed build if omitted)
 *   node asc-release.mjs submit --version 1.2.5
 *
 * Read-only unless the verb writes. Every write is idempotent per ASC.
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

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
  const sig = createSign('SHA256')
    .update(`${head}.${body}`)
    .sign({ key: pem, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
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

const args = process.argv.slice(2);
const verb = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};

async function versions() {
  const { data } = await get(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  return data.map((v) => ({ id: v.id, version: v.attributes.versionString, state: v.attributes.appStoreState, created: v.attributes.createdDate }));
}
async function builds() {
  const { data } = await get(`/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=8`);
  return data.map((b) => ({ id: b.id, version: b.attributes.version, state: b.attributes.processingState, uploaded: b.attributes.uploadedDate, expired: b.attributes.expired }));
}
async function versionFor(versionString) {
  const v = (await versions()).find((x) => x.version === versionString);
  if (!v) throw new Error(`no appStoreVersion ${versionString}`);
  return v;
}

if (verb === 'status') {
  console.log('versions:');
  for (const v of await versions()) console.log(`  ${v.version}  ${v.state}  ${v.id}  ${v.created}`);
  console.log('builds:');
  try {
    for (const b of await builds()) console.log(`  build ${b.version}  ${b.state}  ${b.id}  ${b.uploaded}${b.expired ? '  EXPIRED' : ''}`);
  } catch (e) {
    console.log(`  (builds endpoint: ${e.message.slice(0, 200)})`);
  }
  const ver = opt('version');
  if (ver) {
    const v = await versionFor(ver);
    const { data: locs } = await get(`/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
    for (const l of locs) console.log(`  ${l.attributes.locale}  whatsNew: ${(l.attributes.whatsNew ?? '—').slice(0, 80).replace(/\n/g, ' ')}`);
    try {
      const { data: b } = await get(`/appStoreVersions/${v.id}/build`);
      console.log(`  attached build: ${b ? `${b.attributes.version} (${b.id})` : 'none'}`);
    } catch (e) {
      console.log(`  attached build: ? ${e.message.slice(0, 120)}`);
    }
  }
} else if (verb === 'whatsnew') {
  const v = await versionFor(opt('version'));
  const text = readFileSync(opt('file'), 'utf8').trim();
  const { data: locs } = await get(`/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  for (const l of locs) {
    await api('PATCH', `/appStoreVersionLocalizations/${l.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew: text } },
    });
    console.log(`  ${l.attributes.locale}  whatsNew set (${text.length} chars)`);
  }
} else if (verb === 'attach') {
  const v = await versionFor(opt('version'));
  let buildId = opt('build');
  if (!buildId) {
    const b = (await builds()).find((x) => x.state === 'VALID' && !x.expired);
    if (!b) throw new Error('no processed build to attach');
    buildId = b.id;
    console.log(`  latest processed build: ${b.version} (${b.id})`);
  }
  await api('PATCH', `/appStoreVersions/${v.id}/relationships/build`, { data: { type: 'builds', id: buildId } });
  console.log(`  attached ${buildId} to ${v.version}`);
} else if (verb === 'submit') {
  const v = await versionFor(opt('version'));
  const existing = await get(`/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
  let sub = existing.data?.[0];
  if (!sub) {
    const created = await api('POST', '/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
    });
    sub = created.data;
    console.log(`  reviewSubmission created ${sub.id}`);
  } else {
    console.log(`  reviewSubmission exists ${sub.id} (${sub.attributes.state})`);
  }
  if (sub.attributes.state === 'READY_FOR_REVIEW') {
    const items = await get(`/reviewSubmissions/${sub.id}/items`);
    if (!items.data?.length) {
      await api('POST', '/reviewSubmissionItems', {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } },
          },
        },
      });
      console.log(`  item added: appStoreVersion ${v.version}`);
    }
    const done = await api('PATCH', `/reviewSubmissions/${sub.id}`, {
      data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } },
    });
    console.log(`  submitted → ${done.data.attributes.state}`);
  } else {
    console.log('  nothing to do at this state');
  }
} else if (verb === 'create') {
  const vs = opt('version');
  const existing = (await versions()).find((v) => v.version === vs);
  if (existing) {
    console.log(`  exists ${existing.id} ${existing.state}`);
  } else {
    const r = await api('POST', '/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: vs, releaseType: 'AFTER_APPROVAL' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    });
    console.log(`  created ${r.data.id} ${r.data.attributes.appStoreState}`);
  }
} else {
  console.log('usage: status | create | whatsnew | attach | submit');
}

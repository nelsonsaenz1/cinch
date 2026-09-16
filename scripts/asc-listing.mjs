#!/usr/bin/env node
/**
 * App Store Connect listing tool — keywords and storefront localisations.
 *
 *   node scripts/asc-listing.mjs read
 *   node scripts/asc-listing.mjs plan  --version 1.2.4
 *   node scripts/asc-listing.mjs apply --version 1.2.4
 *   node scripts/asc-listing.mjs promo --version 1.2.5   (any state — no review)
 *
 * `promo` sets PROMOTIONAL_TEXT on every localisation of the version whose
 * field differs, released or not: promotional text is the one field Apple
 * lets a live version change without a submission. It exists because a
 * version created through the API (1.2.5, 2026-09-13) carries NO promotional
 * text — the field is not copied from the previous version the way keywords
 * and description are — and the live page ran blank for two days before the
 * nightly read it (ledger A81). Run it after every `create`.
 *
 * Input is the "Next build" section of docs/app-store-listing.md: the keyword
 * string per locale lives in KEYWORDS below and MUST match that doc (the test
 * pins it). `read` and `plan` never write. `apply` writes only to an EDITABLE
 * version — a released version's fields are locked by Apple anyway, but the
 * check is here so a wrong --version fails loudly instead of with Apple's 409.
 *
 * Auth: the L5FX967PC6 key (issuer 15be563e-…), read from
 * ~/.appstoreconnect/private_keys/AuthKey_L5FX967PC6.p8 — the same key the
 * 08-26 submission automation used. Signed with node:crypto; no dependency.
 *
 * What `apply` does, idempotently:
 *   1. en-US keywords → KEYWORDS['en-US'] if they differ.
 *   2. For each other locale in KEYWORDS: an appInfoLocalization (name +
 *      subtitle copied from en-US) if missing; an appStoreVersionLocalization
 *      (description, promotionalText, whatsNew copied from en-US; keywords from
 *      KEYWORDS) if missing, keywords patched if present and different.
 *   3. Every en-US screenshot set copied into each locale that has none of
 *      that display type: download from the template URL, reserve, upload the
 *      chunks, commit with the MD5. A localisation without screenshots blocks
 *      submission.
 */
import { createHash, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const APP_ID = '6798479578';
const KID = 'L5FX967PC6';
const ISS = '15be563e-238a-41b6-891b-950650cf424e';
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`;
const API = 'https://api.appstoreconnect.apple.com/v1';

/** The keyword field per locale — docs/app-store-listing.md "Next build" is the source. */
export const KEYWORDS = {
  'en-US':
    'digital,stylist,organizer,clothes,what,wear,ootd,style,calendar,inventory,clothing,ai,travel,weather',
  'es-MX': 'outfits,lookbook,fashion,mix,match,virtual,dress,fit,daily,morning,laundry,worn,cost,per,jeans',
  'en-GB': 'wardrobe,organiser,jumper,trainers,trousers,outfits,lookbook,fashion,mix,match,daily,dress,what,wear',
  'en-AU': 'wardrobe,organiser,jumper,trainers,trousers,outfits,lookbook,fashion,mix,match,daily,dress,what,wear',
  'en-CA': 'wardrobe,organiser,jumper,trainers,trousers,outfits,lookbook,fashion,mix,match,daily,dress,what,wear',
};
export const KEYWORD_LIMIT = 100;

/**
 * The promotional text in force — docs/app-store-listing.md "Promotional
 * text" is the source (the test pins it). Set 2026-09-01 on 1.2.3, carried
 * by 1.2.4, dropped by the API-created 1.2.5 and restored 2026-09-16.
 */
export const PROMOTIONAL_TEXT =
  'Ten pieces is all it takes. Cinch dresses you in clothes you already own — it never invents a garment or asks you to buy one first.';
export const PROMO_LIMIT = 170;
const EDITABLE = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'WAITING_FOR_REVIEW']);

// ── auth ──────────────────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 400)}`);
  return json;
}
const get = (p) => api('GET', p);

// ── reads ─────────────────────────────────────────────────────────────────
async function versions() {
  const { data } = await get(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  return data.map((v) => ({ id: v.id, version: v.attributes.versionString, state: v.attributes.appStoreState }));
}
async function versionLocalizations(versionId) {
  const { data } = await get(`/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  return data.map((l) => ({ id: l.id, locale: l.attributes.locale, ...l.attributes }));
}
async function appInfo() {
  const { data } = await get(`/apps/${APP_ID}/appInfos`);
  // The editable appInfo when one exists, else the live one.
  const info = data.find((i) => EDITABLE.has(i.attributes.appStoreState)) ?? data[0];
  const locs = (await get(`/appInfos/${info.id}/appInfoLocalizations`)).data.map((l) => ({
    id: l.id,
    locale: l.attributes.locale,
    name: l.attributes.name,
    subtitle: l.attributes.subtitle,
    privacyPolicyUrl: l.attributes.privacyPolicyUrl,
    privacyChoicesUrl: l.attributes.privacyChoicesUrl,
  }));
  return { id: info.id, state: info.attributes.appStoreState, locs };
}
async function screenshotSets(localizationId) {
  const { data } = await get(`/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?include=appScreenshots&limit=50`);
  const out = [];
  for (const set of data) {
    const shots = (await get(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data.map((s) => ({
      id: s.id,
      fileName: s.attributes.fileName,
      fileSize: s.attributes.fileSize,
      width: s.attributes.imageAsset?.width,
      height: s.attributes.imageAsset?.height,
      templateUrl: s.attributes.imageAsset?.templateUrl,
      state: s.attributes.assetDeliveryState?.state,
    }));
    out.push({ id: set.id, displayType: set.attributes.screenshotDisplayType, shots });
  }
  return out;
}

// ── commands ──────────────────────────────────────────────────────────────
function checkKeywords() {
  for (const [locale, kw] of Object.entries(KEYWORDS)) {
    if (kw.length > KEYWORD_LIMIT) throw new Error(`${locale} keywords are ${kw.length} chars (limit ${KEYWORD_LIMIT})`);
    if (/\s/.test(kw)) throw new Error(`${locale} keywords contain whitespace`);
  }
}

async function cmdRead() {
  const vs = await versions();
  for (const v of vs) {
    console.log(`\n${v.version}  ${v.state}  ${v.id}`);
    for (const l of await versionLocalizations(v.id)) {
      console.log(`  ${l.locale}  keywords(${(l.keywords ?? '').length}): ${l.keywords ?? '—'}`);
      console.log(`         promo: ${(l.promotionalText ?? '—').slice(0, 80)}`);
    }
  }
  const info = await appInfo();
  console.log(`\nappInfo ${info.state}`);
  for (const l of info.locs) console.log(`  ${l.locale}  name: ${l.name}  subtitle: ${l.subtitle}`);
}

async function target(versionString) {
  const v = (await versions()).find((x) => x.version === versionString);
  if (!v) throw new Error(`no version ${versionString}`);
  return v;
}

async function plan(versionString) {
  checkKeywords();
  const v = await target(versionString);
  const locs = await versionLocalizations(v.id);
  const info = await appInfo();
  const primary = locs.find((l) => l.locale === 'en-US');
  if (!primary) throw new Error('no en-US localisation on that version');
  const steps = [];
  if ((primary.keywords ?? '') !== KEYWORDS['en-US']) steps.push({ op: 'patch-keywords', locale: 'en-US', id: primary.id, keywords: KEYWORDS['en-US'] });
  for (const locale of Object.keys(KEYWORDS)) {
    if (locale === 'en-US') continue;
    // `privacyPolicyUrl` travels with the appInfo localisation and is REQUIRED
    // at review submission — 1.2.4's first submit attempt was refused with
    // "You must provide a value for the attribute 'privacyPolicyUrl'" on every
    // locale this step had created without it (2026-09-09).
    const enInfo = info.locs.find((l) => l.locale === 'en-US');
    if (!info.locs.find((l) => l.locale === locale)) steps.push({ op: 'create-appinfo-loc', locale, infoId: info.id, name: enInfo?.name, subtitle: enInfo?.subtitle, privacyPolicyUrl: enInfo?.privacyPolicyUrl, privacyChoicesUrl: enInfo?.privacyChoicesUrl });
    const existing = locs.find((l) => l.locale === locale);
    if (!existing) steps.push({ op: 'create-version-loc', locale, versionId: v.id, from: primary.id, keywords: KEYWORDS[locale] });
    else if ((existing.keywords ?? '') !== KEYWORDS[locale]) steps.push({ op: 'patch-keywords', locale, id: existing.id, keywords: KEYWORDS[locale] });
    // Apple creates the version localisation ITSELF the moment an appInfo
    // localisation for that locale exists (learned on 1.2.4, 2026-09-09: the
    // POST answered 409 "already exists" for every locale the previous step had
    // just created). That auto-created row carries no description, promo text
    // or What's New — a half-filled localisation Apple refuses at submission —
    // so an existing row with an empty description is filled from en-US.
    if (existing && !(existing.description ?? '')) steps.push({ op: 'fill-text', locale, id: existing.id, from: primary.id });
    if (!existing || (await screenshotSets(existing.id)).length === 0) steps.push({ op: 'copy-screenshots', locale, from: primary.id });
  }
  // Every localisation that exists, en-US included: the field is per
  // localisation and an API-created version has it blank on all of them.
  for (const l of locs) {
    if ((l.promotionalText ?? '') !== PROMOTIONAL_TEXT) steps.push({ op: 'set-promo', locale: l.locale, id: l.id });
  }
  return { version: v, primary, steps };
}

async function cmdPlan(versionString) {
  const { version, steps } = await plan(versionString);
  console.log(`${version.version}  ${version.state}  editable: ${EDITABLE.has(version.state)}`);
  if (steps.length === 0) console.log('nothing to do');
  for (const s of steps) console.log(' ', JSON.stringify(s));
}

// ── writes ────────────────────────────────────────────────────────────────
async function copyScreenshots(fromLocId, toLocId) {
  const sets = await screenshotSets(fromLocId);
  for (const set of sets) {
    const created = await api('POST', '/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: set.displayType },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: toLocId } } },
      },
    });
    const setId = created.data.id;
    for (const shot of set.shots) {
      if (!shot.templateUrl) continue;
      const url = shot.templateUrl.replace('{w}', String(shot.width)).replace('{h}', String(shot.height)).replace('{f}', 'png');
      const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
      const reserved = await api('POST', '/appScreenshots', {
        data: {
          type: 'appScreenshots',
          attributes: { fileName: shot.fileName, fileSize: bytes.length },
          relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
        },
      });
      for (const op of reserved.data.attributes.uploadOperations) {
        const chunk = bytes.subarray(op.offset, op.offset + op.length);
        const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
        const r = await fetch(op.url, { method: op.method, headers, body: chunk });
        if (!r.ok) throw new Error(`upload chunk ${r.status}`);
      }
      await api('PATCH', `/appScreenshots/${reserved.data.id}`, {
        data: { type: 'appScreenshots', id: reserved.data.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } },
      });
      console.log(`  uploaded ${set.displayType} ${shot.fileName} (${bytes.length} bytes)`);
    }
  }
}

async function cmdApply(versionString) {
  const { version, primary, steps } = await plan(versionString);
  if (!EDITABLE.has(version.state)) throw new Error(`${version.version} is ${version.state} — not editable; pick the version the next build attaches to`);
  const primaryFull = (await versionLocalizations(version.id)).find((l) => l.id === primary.id);
  const created = {};
  for (const s of steps) {
    console.log('→', s.op, s.locale);
    if (s.op === 'patch-keywords') {
      await api('PATCH', `/appStoreVersionLocalizations/${s.id}`, { data: { type: 'appStoreVersionLocalizations', id: s.id, attributes: { keywords: s.keywords } } });
    } else if (s.op === 'create-appinfo-loc') {
      await api('POST', '/appInfoLocalizations', {
        data: {
          type: 'appInfoLocalizations',
          attributes: {
            locale: s.locale,
            name: s.name,
            subtitle: s.subtitle,
            privacyPolicyUrl: s.privacyPolicyUrl ?? undefined,
            privacyChoicesUrl: s.privacyChoicesUrl ?? undefined,
          },
          relationships: { appInfo: { data: { type: 'appInfos', id: s.infoId } } },
        },
      });
    } else if (s.op === 'create-version-loc') {
      const r = await api('POST', '/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: s.locale,
            description: primaryFull.description,
            keywords: s.keywords,
            promotionalText: primaryFull.promotionalText ?? PROMOTIONAL_TEXT,
            whatsNew: primaryFull.whatsNew ?? undefined,
            supportUrl: primaryFull.supportUrl ?? undefined,
            marketingUrl: primaryFull.marketingUrl ?? undefined,
          },
          relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: s.versionId } } },
        },
      });
      created[s.locale] = r.data.id;
    } else if (s.op === 'fill-text') {
      await api('PATCH', `/appStoreVersionLocalizations/${s.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: s.id,
          attributes: {
            description: primaryFull.description,
            promotionalText: primaryFull.promotionalText ?? PROMOTIONAL_TEXT,
            whatsNew: primaryFull.whatsNew ?? undefined,
            supportUrl: primaryFull.supportUrl ?? undefined,
            marketingUrl: primaryFull.marketingUrl ?? undefined,
          },
        },
      });
    } else if (s.op === 'copy-screenshots') {
      const toId = created[s.locale] ?? (await versionLocalizations(version.id)).find((l) => l.locale === s.locale)?.id;
      if (!toId) throw new Error(`no localisation id for ${s.locale}`);
      await copyScreenshots(s.from, toId);
    } else if (s.op === 'set-promo') {
      await setPromo(s.id);
    }
  }
  console.log('done — re-run `plan` to confirm nothing is left');
}

async function setPromo(localizationId) {
  await api('PATCH', `/appStoreVersionLocalizations/${localizationId}`, {
    data: { type: 'appStoreVersionLocalizations', id: localizationId, attributes: { promotionalText: PROMOTIONAL_TEXT } },
  });
}

/**
 * Promotional text only, on ANY version state. Deliberately not behind the
 * EDITABLE guard: Apple accepts this one PATCH on a READY_FOR_SALE version,
 * and the whole point of the command is the live page.
 */
async function cmdPromo(versionString) {
  if (PROMOTIONAL_TEXT.length > PROMO_LIMIT) throw new Error(`promotional text is ${PROMOTIONAL_TEXT.length} chars (limit ${PROMO_LIMIT})`);
  const v = await target(versionString);
  const locs = await versionLocalizations(v.id);
  let changed = 0;
  for (const l of locs) {
    if ((l.promotionalText ?? '') === PROMOTIONAL_TEXT) {
      console.log(`  ${l.locale}  already set`);
      continue;
    }
    await setPromo(l.id);
    changed += 1;
    console.log(`  ${l.locale}  set (${(l.promotionalText ?? '').length} → ${PROMOTIONAL_TEXT.length} chars)`);
  }
  for (const l of await versionLocalizations(v.id)) {
    if ((l.promotionalText ?? '') !== PROMOTIONAL_TEXT) throw new Error(`${l.locale} read back differently`);
  }
  console.log(`${v.version}  ${v.state}  promotional text verified on ${locs.length} localisations (${changed} changed)`);
}

// ── main ──────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const versionArg = rest[rest.indexOf('--version') + 1];
// By filename, not by URL: the test runner bundles this file into the test, where
// import.meta.url is the bundle's own path and would read as "main".
const isMain = /asc-listing\.mjs$/.test(process.argv[1] ?? '');
if (isMain) {
  try {
    if (cmd === 'read') await cmdRead();
    else if (cmd === 'plan') await cmdPlan(versionArg);
    else if (cmd === 'apply') await cmdApply(versionArg);
    else if (cmd === 'promo') await cmdPromo(versionArg);
    else {
      console.error('usage: asc-listing.mjs read | plan --version X | apply --version X | promo --version X');
      process.exit(2);
    }
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exit(1);
  }
}

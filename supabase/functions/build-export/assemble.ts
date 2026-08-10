import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import { type Cell, csvDocument, json, list, readable } from './csv.ts';

/**
 * Everything the archive contains, and every query that fills it.
 *
 * ── WHAT SHIPS, AND WHY IT IS NOT THE PHOTOGRAPHS ──────────────────────────
 *
 * Contract §3.4, decided with the founder: an Edge Function cannot assemble a
 * multi-hundred-megabyte archive inside its memory and time budget, and the
 * closets that most need an export are exactly the ones that would fail. So the
 * zip carries the data — `closet.csv`, `wears.csv`, `plans.csv`, `account.json`
 * — plus `photos.html`, an index of time-limited signed links to every original
 * photograph at full size. Nothing is withheld and nothing is downscaled; the
 * pictures are one click away rather than inside the file.
 *
 * Those five files are the manifest PD-04 prints, and this module ships exactly
 * them. Adding a sixth would make the manifest wrong in the same way dropping
 * one would.
 *
 * ── THE FRIEND LAYER IS NOT CROSSED ────────────────────────────────────────
 *
 * Every query below is `.eq('user_id', userId)` or its equivalent. A friend's
 * closet is theirs to export and none of it is read here — not `friend_items`,
 * not `social_profiles`, not a single row of anybody else's `items`. The two
 * places another person's data is touched at all are named where they happen:
 *
 *   - `account.json` lists **friend handles**, which §3.4 asks for by name. It
 *     reads `username` and `display_name` for people in a mutual follow and
 *     nothing else — no ids, no counts, no closet.
 *   - `plans.csv` includes occasions the user was invited to, through their own
 *     `event_members` row. That is the user's calendar, not the friend graph,
 *     and every field in it is one the app already shows them. They are labelled
 *     `occasion (guest)` so the archive never implies they were the author.
 */

/** Signed links live exactly as long as the archive does. */
export const ARCHIVE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** `createSignedUrls` takes a batch; a large closet exceeds what one call likes. */
const SIGN_CHUNK = 100;

/** The bucket every garment photograph lives in. */
const PHOTO_BUCKET = 'garments';

export type ArchiveFiles = Record<string, string>;

export type ArchiveSummary = {
  items: number;
  wears: number;
  plans: number;
  photos: number;
  friends: number;
};

export type Assembled = { files: ArchiveFiles; summary: ArchiveSummary };

type Row = Record<string, unknown>;

/**
 * The three filters this module uses, and nothing else.
 *
 * PostgREST's own builder type is generic over the schema and recursive enough
 * that naming it here makes the compiler give up with "type instantiation is
 * excessively deep". This narrow surface says exactly what `selectAll` allows a
 * caller to do — which, given every query in this file must stay scoped to one
 * person, is a feature rather than a workaround.
 */
type Filterable = {
  eq(column: string, value: unknown): Filterable;
  in(column: string, values: unknown[]): Filterable;
  order(column: string, options: { ascending: boolean }): Filterable;
};

type QueryResult = { data: Row[] | null; error: { message: string } | null };

/** A select that failed is a hole in the export, so it stops the export. */
async function selectAll(
  db: SupabaseClient,
  table: string,
  columns: string,
  apply: (q: Filterable) => Filterable,
): Promise<Row[]> {
  const base = db.from(table).select(columns) as unknown as Filterable;
  const { data, error } = (await (apply(base) as unknown as Promise<QueryResult>));
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  // `planned_date` is already a bare date; `worn_at` is a timestamptz. Both are
  // printed as the calendar day, because "what did I wear on the 4th" is the
  // question wears.csv exists to answer, with the full timestamp kept beside it.
  return value.slice(0, 10);
}

function itemLabel(item: Row): string {
  const parts = [item.brand, item.subcategory ?? item.category].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  return parts.length ? parts.join(' ') : 'Untitled piece';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * One signed URL per stored object, in as few round trips as possible.
 *
 * A path that fails to sign is dropped from the map rather than failing the
 * export: a missing photo is a gap in one row of the index, and refusing to
 * hand over the CSVs because one object went astray would be the worse trade.
 */
async function signAll(db: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths)];

  for (let i = 0; i < unique.length; i += SIGN_CHUNK) {
    const chunk = unique.slice(i, i + SIGN_CHUNK);
    const { data, error } = await db.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(chunk, ARCHIVE_TTL_SECONDS);

    if (error) {
      console.warn(`build-export: a batch of ${chunk.length} photo link(s) could not be signed.`);
      continue;
    }

    for (const entry of data ?? []) {
      const path = (entry as { path?: string | null }).path;
      const url = (entry as { signedUrl?: string | null }).signedUrl;
      if (typeof path === 'string' && typeof url === 'string') signed.set(path, url);
    }
  }

  return signed;
}

// ── closet.csv ─────────────────────────────────────────────────────────────

/**
 * Every column of `items` a person put there or the app derived for them, in an
 * order that reads top to bottom rather than in migration order.
 *
 * The storage paths are the deliberate omission: they are keys into a private
 * bucket and mean nothing outside it, so they become links in `photos.html`
 * instead. `user_id` is left out for the same reason a letter does not repeat
 * the recipient's address on every line.
 */
const CLOSET_HEADERS = [
  'item_id',
  'added_on',
  'where_it_lives',
  'tagging_status',
  'category',
  'subcategory',
  'brand',
  'size',
  'colors',
  'pattern',
  'pattern_scale',
  'material',
  'fit',
  'condition',
  'formality_score',
  'warmth_score',
  'water_resistant',
  'seasons',
  'occasions',
  'description',
  'purchase_price',
  'purchase_date',
  'wear_count',
  'last_worn_at',
  'lendable_to_friends',
  'for_sale',
  'sale_price',
  'sale_note',
  'listing_source',
  'listing_source_url',
  'listing_confirmed_at',
  'details_you_confirmed',
  'ai_tags',
  'color_analysis',
  'photos',
];

function closetCsv(items: Row[], photoKinds: Map<string, string[]>): string {
  const rows: Cell[][] = items.map((item) => [
    String(item.id ?? ''),
    String(item.created_at ?? ''),
    item.is_archived === true ? 'storage' : 'active closet',
    String(item.status ?? ''),
    String(item.category ?? ''),
    String(item.subcategory ?? ''),
    String(item.brand ?? ''),
    String(item.size ?? ''),
    readable(item.colors),
    String(item.pattern ?? ''),
    String(item.pattern_scale ?? ''),
    String(item.material ?? ''),
    String(item.fit ?? ''),
    String(item.condition ?? ''),
    item.formality_score as Cell,
    item.warmth_score as Cell,
    item.water_resistant as Cell,
    list(item.seasons),
    list(item.occasions),
    String(item.description ?? ''),
    item.purchase_price as Cell,
    String(item.purchase_date ?? ''),
    item.wear_count as Cell,
    String(item.last_worn_at ?? ''),
    item.borrowable as Cell,
    item.is_for_sale as Cell,
    item.sale_price as Cell,
    String(item.sale_note ?? ''),
    String(item.listing_source_label ?? ''),
    String(item.listing_source_url ?? ''),
    String(item.listing_confirmed_at ?? ''),
    item.user_verified as Cell,
    json(item.ai_tags),
    json(item.color_analysis),
    (photoKinds.get(String(item.id)) ?? []).join('; '),
  ]);

  return csvDocument(CLOSET_HEADERS, rows);
}

// ── wears.csv ──────────────────────────────────────────────────────────────

const WEARS_HEADERS = [
  'date',
  'worn_at',
  'look',
  'occasion',
  'note',
  'pieces',
  'item_ids',
  'built_by',
  'your_rating',
  'rating_reason',
  'outfit_id',
];

/**
 * A wear is an `outfits` row with `worn_at` set.
 *
 * There is no wear-log table and there never was: `items.wear_count` is a
 * counter kept in step by the same transaction, and the diary reads exactly
 * this shape (`features/diary/queries.ts`). Deriving the file from `worn_at`
 * rather than from the counter is what makes the archive agree with the app.
 */
function wearsCsv(outfits: Row[], piecesByOutfit: Map<string, Row[]>): string {
  const worn = outfits
    .filter((o) => typeof o.worn_at === 'string' && o.worn_at)
    .sort((a, b) => String(b.worn_at).localeCompare(String(a.worn_at)));

  const rows: Cell[][] = worn.map((outfit) => {
    const pieces = piecesByOutfit.get(String(outfit.id)) ?? [];
    return [
      isoDate(outfit.worn_at),
      String(outfit.worn_at ?? ''),
      String(outfit.name ?? ''),
      String(outfit.occasion ?? ''),
      String(outfit.note ?? ''),
      pieces.map(itemLabel).join('; '),
      pieces.map((p) => String(p.id ?? '')).join('; '),
      String(outfit.generated_by ?? ''),
      outfit.rating as Cell,
      String(outfit.rating_reason ?? ''),
      String(outfit.id ?? ''),
    ];
  });

  return csvDocument(WEARS_HEADERS, rows);
}

// ── plans.csv ──────────────────────────────────────────────────────────────

const PLANS_HEADERS = [
  'kind',
  'date',
  'title',
  'occasion',
  'dress_code',
  'venue',
  'note',
  'pieces',
  'item_ids',
  'id',
];

function plansCsv(
  calendar: Row[],
  outfitsById: Map<string, Row>,
  piecesByOutfit: Map<string, Row[]>,
  hosted: Row[],
  guest: Row[],
): string {
  const rows: Cell[][] = [];

  for (const entry of calendar) {
    const outfit = outfitsById.get(String(entry.outfit_id));
    const pieces = piecesByOutfit.get(String(entry.outfit_id)) ?? [];
    rows.push([
      'planned look',
      isoDate(entry.planned_date),
      String(outfit?.name ?? ''),
      String(outfit?.occasion ?? ''),
      '',
      '',
      String(entry.note ?? ''),
      pieces.map(itemLabel).join('; '),
      pieces.map((p) => String(p.id ?? '')).join('; '),
      String(entry.id ?? ''),
    ]);
  }

  const occasion = (event: Row, kind: string): Cell[] => [
    kind,
    isoDate(event.starts_at),
    String(event.title ?? ''),
    String(event.occasion ?? ''),
    String(event.dress_code ?? ''),
    String(event.venue_name ?? ''),
    String(event.note ?? ''),
    '',
    '',
    String(event.id ?? ''),
  ];

  for (const event of hosted) rows.push(occasion(event, 'occasion (yours)'));
  for (const event of guest) rows.push(occasion(event, 'occasion (guest)'));

  // Newest first, and undated occasions (`starts_at` is nullable since the
  // New Occasion rebuild) sink to the bottom rather than sorting as epoch zero.
  rows.sort((a, b) => String(b[1] ?? '').localeCompare(String(a[1] ?? '')));

  return csvDocument(PLANS_HEADERS, rows);
}

// ── photos.html ────────────────────────────────────────────────────────────

/**
 * Which stored objects belong to an item, and what to call them.
 *
 * `original.jpg` is the photograph as it was taken, at full size and untouched —
 * it is what §3.4 means by "every original photo at full size". The rest are
 * derived from it and are listed too, because an export that quietly kept the
 * cutouts back would be withholding something.
 */
const PHOTO_KINDS: { column: string; label: string }[] = [
  { column: 'image_path', label: 'Original photo' },
  { column: 'cutout_path', label: 'Cut out' },
  { column: 'plate_path', label: 'Plate' },
  { column: 'thumb_path', label: 'Thumbnail' },
  { column: 'listing_path', label: 'Matched listing photo' },
];

function photosHtml(
  items: Row[],
  signed: Map<string, string>,
  avatarUrl: string | null,
  expiresAt: string,
): string {
  const expiryText = escapeHtml(new Date(expiresAt).toUTCString());

  const blocks: string[] = [];
  let linked = 0;

  for (const item of items) {
    const links: string[] = [];
    for (const kind of PHOTO_KINDS) {
      const path = item[kind.column];
      if (typeof path !== 'string' || !path) continue;
      const url = signed.get(path);
      if (!url) continue;
      linked += 1;
      links.push(
        `<li><a href="${escapeHtml(url)}">${escapeHtml(kind.label)}</a> ` +
          `<span class="path">${escapeHtml(path.split('/').slice(-1)[0] ?? '')}</span></li>`,
      );
    }

    if (!links.length) continue;

    blocks.push(
      `<section><h2>${escapeHtml(itemLabel(item))}</h2>` +
        `<p class="meta">${escapeHtml(String(item.category ?? ''))} · added ${
          escapeHtml(isoDate(item.created_at))
        } · <span class="path">${escapeHtml(String(item.id ?? ''))}</span></p>` +
        `<ul>${links.join('')}</ul></section>`,
    );
  }

  const avatarBlock = avatarUrl
    ? `<section><h2>Your profile picture</h2><ul><li><a href="${
      escapeHtml(avatarUrl)
    }">Profile picture</a></li></ul></section>`
    : '';

  const empty = blocks.length
    ? ''
    : '<p class="empty">There are no photographs stored for this account.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Cinch photos</title>
<style>
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #211F1A; background: #FAF7F0; margin: 0; padding: 32px 20px 64px; }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 8px; font-weight: 600; }
  h2 { font-size: 17px; margin: 0 0 2px; font-weight: 600; }
  .lede { margin: 0 0 4px; }
  .expiry { margin: 0 0 32px; color: #6B6656; }
  .meta, .path { color: #6B6656; font-size: 14px; }
  .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  section { padding: 16px 0; border-top: 1px solid rgba(33,31,26,0.12); }
  ul { margin: 8px 0 0; padding-left: 20px; }
  li { margin: 2px 0; }
  a { color: #211F1A; }
  .empty { color: #6B6656; }
</style>
</head>
<body>
<main>
<h1>Your Cinch photos</h1>
<p class="lede">${linked} link${
    linked === 1 ? '' : 's'
  }, each one to the file exactly as it is stored — full size, nothing recompressed.</p>
<p class="expiry">These links stop working on ${expiryText}. Download anything you want to keep before then; you can ask for a new export at any time.</p>
${empty}${blocks.join('\n')}
${avatarBlock}
</main>
</body>
</html>
`;
}

// ── the whole thing ────────────────────────────────────────────────────────

export async function assembleArchive(
  db: SupabaseClient,
  userId: string,
  exportId: string,
  requestedAt: string,
  expiresAt: string,
): Promise<Assembled> {
  // ── the account ─────────────────────────────────────────────────────────
  const [profileResult, authResult] = await Promise.all([
    db.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);

  if (profileResult.error) throw new Error(`profiles: ${profileResult.error.message}`);
  const profile = (profileResult.data ?? {}) as Row;
  const authUser = authResult.data?.user ?? null;

  // ── the closet, the looks, the calendar ─────────────────────────────────
  const [items, outfits, outfitItems, calendar, hostedEvents, memberships] = await Promise.all([
    selectAll(db, 'items', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: true })),
    selectAll(db, 'outfits', '*', (q) => q.eq('user_id', userId)),
    selectAll(db, 'outfit_items', 'outfit_id, item_id, role, position', (q) =>
      q.eq('user_id', userId)),
    selectAll(db, 'outfit_calendar', 'id, outfit_id, planned_date, note', (q) =>
      q.eq('user_id', userId)),
    selectAll(db, 'events', '*', (q) => q.eq('host_id', userId)),
    selectAll(db, 'event_members', 'event_id', (q) => q.eq('user_id', userId)),
  ]);

  const itemsById = new Map(items.map((item) => [String(item.id), item]));

  const piecesByOutfit = new Map<string, Row[]>();
  const ordered = [...outfitItems].sort(
    (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
  );
  for (const link of ordered) {
    const key = String(link.outfit_id);
    const item = itemsById.get(String(link.item_id));
    if (!item) continue;
    const bucket = piecesByOutfit.get(key) ?? [];
    bucket.push(item);
    piecesByOutfit.set(key, bucket);
  }

  const outfitsById = new Map(outfits.map((o) => [String(o.id), o]));

  // Occasions the user was invited to. Read through their OWN membership rows,
  // then by primary key — no friend query, and hosted ones are filtered out so
  // an event does not appear twice.
  const hostedIds = new Set(hostedEvents.map((e) => String(e.id)));
  const guestIds = memberships
    .map((m) => String(m.event_id))
    .filter((id) => id && !hostedIds.has(id));

  const guestEvents = guestIds.length
    ? await selectAll(db, 'events', 'id, title, occasion, dress_code, venue_name, note, starts_at', (q) =>
      q.in('id', guestIds))
    : [];

  // ── friend handles, and nothing else about them ─────────────────────────
  const [following, followers] = await Promise.all([
    selectAll(db, 'follows', 'followee_id', (q) => q.eq('follower_id', userId)),
    selectAll(db, 'follows', 'follower_id', (q) => q.eq('followee_id', userId)),
  ]);

  const followerIds = new Set(followers.map((f) => String(f.follower_id)));
  const friendIds = following
    .map((f) => String(f.followee_id))
    .filter((id) => followerIds.has(id));

  const inviterId = typeof profile.invited_by === 'string' ? profile.invited_by : null;
  const handleIds = [...new Set([...friendIds, ...(inviterId ? [inviterId] : [])])];

  const handleRows = handleIds.length
    ? await selectAll(db, 'profiles', 'user_id, username, display_name', (q) =>
      q.in('user_id', handleIds))
    : [];

  const handles = new Map(handleRows.map((p) => [String(p.user_id), p]));

  // ── photographs ─────────────────────────────────────────────────────────
  const paths: string[] = [];
  const photoKinds = new Map<string, string[]>();

  for (const item of items) {
    const kinds: string[] = [];
    for (const kind of PHOTO_KINDS) {
      const path = item[kind.column];
      if (typeof path !== 'string' || !path) continue;
      paths.push(path);
      kinds.push(kind.label);
    }
    if (kinds.length) photoKinds.set(String(item.id), kinds);
  }

  const signed = await signAll(db, paths);
  const avatarUrl = typeof profile.avatar_url === 'string' && profile.avatar_url
    ? profile.avatar_url
    : null;

  // ── account.json ────────────────────────────────────────────────────────
  const friends = friendIds
    .map((id) => {
      const row = handles.get(id);
      return {
        handle: (row?.username as string | null) ?? null,
        name: (row?.display_name as string | null) ?? null,
      };
    })
    .filter((f) => f.handle || f.name)
    .sort((a, b) => String(a.handle ?? a.name).localeCompare(String(b.handle ?? b.name)));

  const wearCount = outfits.filter((o) => typeof o.worn_at === 'string' && o.worn_at).length;
  const planCount = calendar.length + hostedEvents.length + guestEvents.length;

  const account = {
    export: {
      id: exportId,
      requested_at: requestedAt,
      generated_at: new Date().toISOString(),
      photo_links_expire_at: expiresAt,
      contains: ['closet.csv', 'wears.csv', 'plans.csv', 'account.json', 'photos.html'],
    },
    account: {
      handle: (profile.username as string | null) ?? null,
      display_name: (profile.display_name as string | null) ?? null,
      email: authUser?.email ?? null,
      joined_on: authUser?.created_at ?? (profile.created_at as string | null) ?? null,
      home_city: (profile.home_city as string | null) ?? null,
      time_zone: (profile.time_zone as string | null) ?? null,
      units: (profile.units as string | null) ?? null,
      bio: (profile.bio as string | null) ?? null,
      gender_presentation: (profile.gender_presentation as string | null) ?? null,
      style_tags: (profile.style_tags as string[] | null) ?? [],
      color_season: (profile.color_season as string | null) ?? null,
      sizes: profile.sizes ?? null,
      style_summary: (profile.preference_summary as string | null) ?? null,
      invited_by: inviterId
        ? {
          handle: (handles.get(inviterId)?.username as string | null) ?? null,
          at: (profile.invited_at as string | null) ?? null,
        }
        : null,
      ai_consent_at: (profile.ai_consent_at as string | null) ?? null,
      ai_consent_revoked_at: (profile.ai_consent_revoked_at as string | null) ?? null,
    },
    friends,
    counts: {
      pieces: items.length,
      wears: wearCount,
      plans: planCount,
      photos: signed.size,
      friends: friends.length,
    },
  };

  return {
    files: {
      'closet.csv': closetCsv(items, photoKinds),
      'wears.csv': wearsCsv(outfits, piecesByOutfit),
      'plans.csv': plansCsv(calendar, outfitsById, piecesByOutfit, hostedEvents, guestEvents),
      'account.json': `${JSON.stringify(account, null, 2)}\n`,
      'photos.html': photosHtml(items, signed, avatarUrl, expiresAt),
    },
    summary: {
      items: items.length,
      wears: wearCount,
      plans: planCount,
      photos: signed.size,
      friends: friends.length,
    },
  };
}

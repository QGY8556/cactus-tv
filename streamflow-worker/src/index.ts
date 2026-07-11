interface Env {
  DB: D1Database;
  STREAMFLOW_R2: R2Bucket;
  STREAMFLOW_QUEUE: Queue<StreamflowMessage>;
  STREAMFLOW_MAX_HEIGHT?: string;
  STREAMFLOW_MAX_BYTES?: string;
  STREAMFLOW_BATCH_OBJECTS?: string;
  STREAMFLOW_TOTAL_MAX_BYTES?: string;
  PROVIDERS_JSON?: string;
}

type StreamflowMessage =
  | { type: 'cache'; sessionId: string; revision: number }
  | { type: 'clear'; requestedAt: number };

type SessionRow = {
  id: string;
  item_key: string;
  provider_id: string;
  source_url: string;
  title: string;
  episode_name: string;
  position_seconds: number;
  duration_seconds: number;
  target_start_seconds: number;
  target_end_seconds: number;
  cached_bytes: number;
  revision: number;
  playback_state: string;
  cache_state: string;
  enabled: number;
  last_heartbeat: number;
};

type Provider = {
  id: string;
  baseUrl: string;
  enabled: boolean;
  proxyEnabled: boolean;
  mediaHosts: string[];
  requestHeaders: Record<string, string>;
};

type ByteRange = { start: number; length: number };

type CacheObject = {
  objectId: string;
  sourceUrl: string;
  kind: 'segment' | 'map' | 'key';
  trackId: string;
  start: number;
  end: number;
  range?: ByteRange;
};

type ParsedMedia = {
  endList: boolean;
  objects: CacheObject[];
};

type Variant = {
  index: number;
  url: string;
  bandwidth: number;
  height: number;
  audioGroup: string;
};

type Rendition = {
  index: number;
  type: string;
  groupId: string;
  url: string;
  isDefault: boolean;
  autoSelect: boolean;
};

const MANIFEST_LIMIT = 3_000_000;
const DEFAULT_MAX_BYTES = 950 * 1024 * 1024;
const DEFAULT_BATCH_OBJECTS = 7;
const MAX_SINGLE_OBJECT = 64 * 1024 * 1024;
const STREAMFLOW_PREFIX = 'streamflow';
const PRIVATE_HOSTS = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

let schemaPromise: Promise<void> | null = null;

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function objectKey(sessionId: string, objectId: string): string {
  return `${STREAMFLOW_PREFIX}/${sessionId}/objects/${objectId}`;
}

function rangeSuffix(range?: ByteRange): string {
  return range ? `-br-${range.start}-${range.length}` : '';
}

function parseByteRange(value: string): { length: number; offset?: number } | null {
  const match = String(value || '').trim().match(/^(\d+)(?:@(\d+))?$/);
  if (!match) return null;
  const length = Number(match[1]);
  const offset = match[2] == null ? undefined : Number(match[2]);
  if (!(length > 0) || (offset != null && offset < 0)) return null;
  return { length, offset };
}

function parseAttributes(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    result[match[1].toUpperCase()] = value;
  }
  return result;
}

function isPrivateUrl(url: URL): boolean {
  return url.protocol !== 'https:' || PRIVATE_HOSTS.test(url.hostname) || url.hostname.endsWith('.local') || Boolean(url.username || url.password);
}

function assertAllowed(provider: Provider, raw: string): URL {
  const url = new URL(raw);
  if (isPrivateUrl(url)) throw new Error(`禁止缓存不安全地址：${url.hostname}`);
  const allowed = new Set([new URL(provider.baseUrl).hostname.toLowerCase(), ...provider.mediaHosts.map(host => host.toLowerCase())]);
  if (!allowed.has(url.hostname.toLowerCase())) throw new Error(`媒体主机 ${url.hostname} 不在白名单中`);
  url.hash = '';
  return url;
}

async function ensureSchema(env: Env): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS streamflow_sessions (
        id TEXT PRIMARY KEY, item_key TEXT NOT NULL, provider_id TEXT NOT NULL, source_url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '', episode_name TEXT NOT NULL DEFAULT '', line_index INTEGER NOT NULL DEFAULT 0,
        episode_index INTEGER NOT NULL DEFAULT 0, position_seconds REAL NOT NULL DEFAULT 0,
        duration_seconds REAL NOT NULL DEFAULT 0, target_start_seconds REAL NOT NULL DEFAULT 0,
        target_end_seconds REAL NOT NULL DEFAULT 0, cached_start_seconds REAL NOT NULL DEFAULT 0,
        cached_end_seconds REAL NOT NULL DEFAULT 0, cached_bytes INTEGER NOT NULL DEFAULT 0,
        cached_objects INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0,
        playback_state TEXT NOT NULL DEFAULT 'idle', cache_state TEXT NOT NULL DEFAULT 'idle',
        enabled INTEGER NOT NULL DEFAULT 1, last_heartbeat INTEGER NOT NULL DEFAULT 0,
        last_queued_at INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS streamflow_objects (
        session_id TEXT NOT NULL, object_id TEXT NOT NULL, r2_key TEXT NOT NULL, source_url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'segment', track_id TEXT NOT NULL DEFAULT 'main',
        start_seconds REAL NOT NULL DEFAULT 0, end_seconds REAL NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0, content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        range_header TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, object_id),
        FOREIGN KEY (session_id) REFERENCES streamflow_sessions(id) ON DELETE CASCADE
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_streamflow_objects_session_time ON streamflow_objects(session_id, end_seconds)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS streamflow_hints (
        session_id TEXT PRIMARY KEY, track_id TEXT NOT NULL DEFAULT 'main',
        playlist_url TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL
      )`),
    ]).then(() => undefined).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function normalizeProvider(entry: any): Provider | null {
  if (!entry || typeof entry !== 'object') return null;
  try {
    const baseUrl = String(entry.baseUrl || entry.base_url || '');
    const parsed = new URL(baseUrl);
    if (isPrivateUrl(parsed)) return null;
    return {
      id: String(entry.id || '').trim(),
      baseUrl: parsed.toString(),
      enabled: entry.enabled !== false && Number(entry.enabled ?? 1) !== 0,
      proxyEnabled: entry.proxyEnabled === true || Number(entry.proxy_enabled || 0) === 1,
      mediaHosts: safeJson<string[]>(entry.mediaHosts ?? entry.media_hosts, []).map(String),
      requestHeaders: safeJson<Record<string, string>>(entry.requestHeaders ?? entry.headers_json, {}),
    };
  } catch { return null; }
}

async function loadProvider(env: Env, id: string): Promise<Provider> {
  const row = await env.DB.prepare(`SELECT id, base_url, enabled, proxy_enabled, media_hosts, headers_json
    FROM providers WHERE id = ?`).bind(id).first<any>();
  const fromDb = normalizeProvider(row);
  if (fromDb?.enabled && fromDb.proxyEnabled) return fromDb;
  const fromEnv = safeJson<any[]>(env.PROVIDERS_JSON, []).map(normalizeProvider).find(provider => provider?.id === id);
  if (fromEnv?.enabled && fromEnv.proxyEnabled) return fromEnv;
  throw new Error(`数据源 ${id} 不存在或未启用代理`);
}

async function fetchAllowed(provider: Provider, raw: string, range?: ByteRange): Promise<Response> {
  let current = assertAllowed(provider, raw);
  for (let redirect = 0; redirect < 5; redirect += 1) {
    const headers = new Headers({ Accept: '*/*', 'User-Agent': 'CactusStreamflow/0.1', ...provider.requestHeaders });
    if (range) headers.set('range', `bytes=${range.start}-${range.start + range.length - 1}`);
    const response = await fetch(current.toString(), { headers, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    current = assertAllowed(provider, new URL(location, current).toString());
  }
  throw new Error('片源重定向次数过多');
}

async function fetchManifest(provider: Provider, raw: string): Promise<{ url: string; text: string }> {
  const response = await fetchAllowed(provider, raw);
  if (!response.ok) throw new Error(`m3u8 上游返回 HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MANIFEST_LIMIT) throw new Error('m3u8 播放列表过大');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MANIFEST_LIMIT || !text.trimStart().startsWith('#EXTM3U')) {
    throw new Error('当前片源不是可缓存的 HLS 播放列表');
  }
  return { url: response.url || raw, text };
}

function parseMaster(text: string, baseUrl: string): { variants: Variant[]; renditions: Rendition[] } {
  const lines = text.split(/\r?\n/);
  const variants: Variant[] = [];
  const renditions: Rendition[] = [];
  let pendingVariant: Record<string, string> | null = null;
  let variantIndex = 0;
  let audioIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      pendingVariant = parseAttributes(line.slice(line.indexOf(':') + 1));
      continue;
    }
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseAttributes(line.slice(line.indexOf(':') + 1));
      const type = String(attrs.TYPE || '').toUpperCase();
      const uri = attrs.URI;
      if (type === 'AUDIO' && uri) {
        renditions.push({
          index: audioIndex,
          type,
          groupId: attrs['GROUP-ID'] || '',
          url: new URL(uri, baseUrl).toString(),
          isDefault: String(attrs.DEFAULT || '').toUpperCase() === 'YES',
          autoSelect: String(attrs.AUTOSELECT || '').toUpperCase() === 'YES',
        });
        audioIndex += 1;
      }
      continue;
    }
    if (!line.startsWith('#') && pendingVariant) {
      const resolution = String(pendingVariant.RESOLUTION || '').match(/^(\d+)x(\d+)$/i);
      variants.push({
        index: variantIndex,
        url: new URL(line, baseUrl).toString(),
        bandwidth: Number(pendingVariant['AVERAGE-BANDWIDTH'] || pendingVariant.BANDWIDTH || 0),
        height: Number(resolution?.[2] || 0),
        audioGroup: pendingVariant.AUDIO || '',
      });
      variantIndex += 1;
      pendingVariant = null;
    }
  }
  return { variants, renditions };
}

function selectVariant(variants: Variant[], maxHeight: number): Variant {
  if (!variants.length) throw new Error('主播放列表没有可用清晰度');
  const under = variants.filter(item => !item.height || item.height <= maxHeight);
  const candidates = under.length ? under : [...variants].sort((a, b) => (a.height || Infinity) - (b.height || Infinity)).slice(0, 1);
  return [...candidates].sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth))[0];
}

function parseMedia(text: string, baseUrl: string, trackId: string): ParsedMedia {
  const lines = text.split(/\r?\n/);
  const objects = new Map<string, CacheObject>();
  const previousRangeEnd = new Map<string, number>();
  let mediaSequence = 0;
  let segmentIndex = 0;
  let timeline = 0;
  let pendingDuration = 0;
  let pendingRange: { length: number; offset?: number } | null = null;
  let mapIndex = 0;
  let keyIndex = 0;
  let currentMap: CacheObject | null = null;
  let currentKey: CacheObject | null = null;
  let endList = false;

  const materializeRange = (url: string, raw: { length: number; offset?: number } | null): ByteRange | undefined => {
    if (!raw) return undefined;
    const start = raw.offset == null ? (previousRangeEnd.get(url) || 0) : raw.offset;
    previousRangeEnd.set(url, start + raw.length);
    return { start, length: raw.length };
  };

  const addDependency = (dependency: CacheObject | null, start: number, end: number) => {
    if (!dependency) return;
    const existing = objects.get(dependency.objectId);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    } else objects.set(dependency.objectId, { ...dependency, start, end });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = Math.max(0, Number(line.slice(line.indexOf(':') + 1)) || 0);
      continue;
    }
    if (line.startsWith('#EXTINF:')) {
      pendingDuration = Math.max(0, Number(line.slice(line.indexOf(':') + 1).split(',')[0]) || 0);
      continue;
    }
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      pendingRange = parseByteRange(line.slice(line.indexOf(':') + 1));
      continue;
    }
    if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = parseAttributes(line.slice(line.indexOf(':') + 1));
      if (attrs.URI) {
        const sourceUrl = new URL(attrs.URI, baseUrl).toString();
        const parsedRange = parseByteRange(attrs.BYTERANGE || '');
        const range = materializeRange(sourceUrl, parsedRange);
        currentMap = {
          objectId: `${trackId}--map-${mapIndex}${rangeSuffix(range)}`,
          sourceUrl,
          kind: 'map',
          trackId,
          start: timeline,
          end: timeline,
          range,
        };
        mapIndex += 1;
      }
      continue;
    }
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttributes(line.slice(line.indexOf(':') + 1));
      if (String(attrs.METHOD || '').toUpperCase() === 'NONE') currentKey = null;
      else if (attrs.URI) {
        currentKey = {
          objectId: `${trackId}--key-${keyIndex}`,
          sourceUrl: new URL(attrs.URI, baseUrl).toString(),
          kind: 'key',
          trackId,
          start: timeline,
          end: timeline,
        };
        keyIndex += 1;
      }
      continue;
    }
    if (line === '#EXT-X-ENDLIST') {
      endList = true;
      continue;
    }
    if (line.startsWith('#')) continue;

    const sourceUrl = new URL(line, baseUrl).toString();
    const range = materializeRange(sourceUrl, pendingRange);
    const sequence = mediaSequence + segmentIndex;
    const start = timeline;
    const end = timeline + pendingDuration;
    const segment: CacheObject = {
      objectId: `${trackId}--seg-${sequence}${rangeSuffix(range)}`,
      sourceUrl,
      kind: 'segment',
      trackId,
      start,
      end,
      range,
    };
    objects.set(segment.objectId, segment);
    addDependency(currentMap, start, end);
    addDependency(currentKey, start, end);
    timeline = end;
    pendingDuration = 0;
    pendingRange = null;
    segmentIndex += 1;
  }

  return { endList, objects: [...objects.values()] };
}

async function resolveObjects(env: Env, session: SessionRow, provider: Provider): Promise<CacheObject[]> {
  const maxHeight = clampInt(env.STREAMFLOW_MAX_HEIGHT, 1080, 240, 4320);
  const root = await fetchManifest(provider, session.source_url);
  const isMaster = /#EXT-X-STREAM-INF:/i.test(root.text);
  const mediaPlaylists: Array<{ url: string; trackId: string }> = [];

  if (isMaster) {
    const master = parseMaster(root.text, root.url);
    const hint = await env.DB.prepare('SELECT track_id FROM streamflow_hints WHERE session_id = ?')
      .bind(session.id).first<{ track_id: string }>();
    const hintedIndex = String(hint?.track_id || '').match(/^v(\d+)$/);
    const hinted = hintedIndex ? master.variants.find(item => item.index === Number(hintedIndex[1])) : null;
    const variant = hinted || selectVariant(master.variants, maxHeight);
    mediaPlaylists.push({ url: variant.url, trackId: `v${variant.index}` });
    if (variant.audioGroup) {
      const audio = master.renditions
        .filter(item => item.groupId === variant.audioGroup)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(b.autoSelect) - Number(a.autoSelect))[0];
      if (audio) mediaPlaylists.push({ url: audio.url, trackId: `a${audio.index}` });
    }
  } else mediaPlaylists.push({ url: root.url, trackId: 'main' });

  const selected = new Map<string, CacheObject>();
  for (const playlist of mediaPlaylists) {
    const manifest = playlist.url === root.url ? root : await fetchManifest(provider, playlist.url);
    const parsed = parseMedia(manifest.text, manifest.url, playlist.trackId);
    if (!parsed.endList) throw new Error('CactusStreamflow 暂不缓存直播或没有 ENDLIST 的 HLS');
    for (const object of parsed.objects) {
      if (object.kind === 'segment') {
        if (object.end <= session.target_start_seconds || object.start >= session.target_end_seconds) continue;
        selected.set(object.objectId, object);
      } else if (object.end > session.target_start_seconds && object.start < session.target_end_seconds) {
        selected.set(object.objectId, object);
      }
    }
  }
  return [...selected.values()].sort((a, b) => a.start - b.start || (a.kind === 'segment' ? 1 : -1));
}

async function deleteWatched(env: Env, session: SessionRow): Promise<void> {
  const rows = await env.DB.prepare(`SELECT object_id, r2_key FROM streamflow_objects
    WHERE session_id = ? AND kind = 'segment' AND end_seconds < ? LIMIT 300`)
    .bind(session.id, session.target_start_seconds).all<{ object_id: string; r2_key: string }>();
  const values = rows.results || [];
  if (!values.length) return;
  await env.STREAMFLOW_R2.delete(values.map(row => row.r2_key));
  const placeholders = values.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM streamflow_objects WHERE session_id = ? AND object_id IN (${placeholders})`)
    .bind(session.id, ...values.map(row => row.object_id)).run();
}

async function aggregateSession(env: Env, sessionId: string): Promise<{ bytes: number; count: number; start: number; end: number }> {
  const row = await env.DB.prepare(`SELECT COALESCE(SUM(size_bytes), 0) AS bytes,
    COUNT(*) AS count,
    COALESCE(MIN(CASE WHEN kind = 'segment' THEN start_seconds END), 0) AS start,
    COALESCE(MAX(CASE WHEN kind = 'segment' THEN end_seconds END), 0) AS end
    FROM streamflow_objects WHERE session_id = ?`).bind(sessionId).first<any>();
  return {
    bytes: Number(row?.bytes || 0),
    count: Number(row?.count || 0),
    start: Number(row?.start || 0),
    end: Number(row?.end || 0),
  };
}

async function saveObject(env: Env, session: SessionRow, provider: Provider, object: CacheObject, remainingBytes: number): Promise<number> {
  const response = await fetchAllowed(provider, object.sourceUrl, object.range);
  if (!response.ok && response.status !== 206) throw new Error(`分片上游返回 HTTP ${response.status}`);
  if (!response.body) throw new Error('分片响应没有内容');
  const announced = Number(response.headers.get('content-length') || 0);
  if (announced > MAX_SINGLE_OBJECT || (announced > 0 && announced > remainingBytes)) {
    await response.body.cancel();
    return 0;
  }

  const contentType = (response.headers.get('content-type') || 'application/octet-stream').slice(0, 160);
  const r2Key = objectKey(session.id, object.objectId);
  const stored = await env.STREAMFLOW_R2.put(r2Key, response.body, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, max-age=31536000, immutable',
    },
    customMetadata: {
      kind: object.kind,
      track: object.trackId,
      source: object.sourceUrl.slice(0, 1800),
      range: object.range ? `${object.range.start}:${object.range.length}` : '',
      upstreamStatus: String(response.status),
      start: String(object.start),
      end: String(object.end),
    },
  });
  if (!stored) throw new Error('R2 拒绝写入分片');
  if (stored.size > remainingBytes || stored.size > MAX_SINGLE_OBJECT) {
    await env.STREAMFLOW_R2.delete(r2Key);
    return 0;
  }

  await env.DB.prepare(`INSERT INTO streamflow_objects (
    session_id, object_id, r2_key, source_url, kind, track_id,
    start_seconds, end_seconds, size_bytes, content_type, range_header, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, object_id) DO UPDATE SET
    r2_key = excluded.r2_key,
    source_url = excluded.source_url,
    start_seconds = excluded.start_seconds,
    end_seconds = excluded.end_seconds,
    size_bytes = excluded.size_bytes,
    content_type = excluded.content_type,
    range_header = excluded.range_header,
    created_at = excluded.created_at`)
    .bind(
      session.id,
      object.objectId,
      r2Key,
      object.sourceUrl,
      object.kind,
      object.trackId,
      object.start,
      object.end,
      stored.size,
      contentType,
      object.range ? `bytes=${object.range.start}-${object.range.start + object.range.length - 1}` : '',
      Date.now(),
    ).run();
  return stored.size;
}

async function markError(env: Env, sessionId: string, revision: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await env.DB.prepare(`UPDATE streamflow_sessions SET cache_state = 'error', last_error = ?, updated_at = ?
    WHERE id = ? AND revision = ?`).bind(message.slice(0, 500), Date.now(), sessionId, revision).run();
}

async function processCache(env: Env, message: Extract<StreamflowMessage, { type: 'cache' }>): Promise<void> {
  await ensureSchema(env);
  const session = await env.DB.prepare('SELECT * FROM streamflow_sessions WHERE id = ?').bind(message.sessionId).first<SessionRow>();
  if (!session || session.revision !== message.revision || !session.enabled) return;
  if (!(session.duration_seconds > 0) || session.position_seconds / session.duration_seconds < 1 / 3) return;

  const recentPlaying = session.playback_state === 'playing' && Date.now() - session.last_heartbeat < 60_000;
  if (recentPlaying && session.cached_bytes <= 0) return;

  await env.DB.prepare(`UPDATE streamflow_sessions SET cache_state = 'planning', last_error = '', updated_at = ?
    WHERE id = ? AND revision = ?`).bind(Date.now(), session.id, message.revision).run();

  const provider = await loadProvider(env, session.provider_id);
  assertAllowed(provider, session.source_url);
  await deleteWatched(env, session);
  const allObjects = await resolveObjects(env, session, provider);
  if (!allObjects.length) throw new Error('目标时间段没有可缓存的 HLS 分片');

  const existingResult = await env.DB.prepare('SELECT object_id FROM streamflow_objects WHERE session_id = ?')
    .bind(session.id).all<{ object_id: string }>();
  const existing = new Set((existingResult.results || []).map(row => row.object_id));
  const missing = allObjects.filter(object => !existing.has(object.objectId));
  const maxBytes = clampInt(env.STREAMFLOW_MAX_BYTES, DEFAULT_MAX_BYTES, 64 * 1024 * 1024, 1024 * 1024 * 1024 - 1);
  const totalMaxBytes = clampInt(env.STREAMFLOW_TOTAL_MAX_BYTES, 5_000_000_000, maxBytes, 10 * 1024 * 1024 * 1024);
  const batchLimit = clampInt(env.STREAMFLOW_BATCH_OBJECTS, DEFAULT_BATCH_OBJECTS, 1, 8);
  let aggregate = await aggregateSession(env, session.id);
  const globalRow = await env.DB.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM streamflow_objects').first<{ bytes: number }>();
  const globalRemaining = Math.max(0, totalMaxBytes - Number(globalRow?.bytes || 0));
  let remaining = Math.max(0, Math.min(maxBytes - aggregate.bytes, globalRemaining));
  let downloaded = 0;
  let capReached = remaining <= 0;

  for (const object of missing.slice(0, batchLimit)) {
    const latest = await env.DB.prepare('SELECT revision, enabled FROM streamflow_sessions WHERE id = ?')
      .bind(session.id).first<{ revision: number; enabled: number }>();
    if (!latest || latest.revision !== message.revision || !latest.enabled) return;
    if (remaining <= 0) { capReached = true; break; }
    const size = await saveObject(env, session, provider, object, remaining);
    if (!size) { capReached = true; break; }
    remaining -= size;
    downloaded += 1;
  }

  aggregate = await aggregateSession(env, session.id);
  const processedCount = Math.min(missing.length, batchLimit);
  const more = !capReached && missing.length > processedCount;
  await env.DB.prepare(`UPDATE streamflow_sessions SET
    cached_start_seconds = ?, cached_end_seconds = ?, cached_bytes = ?, cached_objects = ?,
    cache_state = ?, last_error = '', updated_at = ?
    WHERE id = ? AND revision = ?`)
    .bind(
      aggregate.start,
      aggregate.end,
      aggregate.bytes,
      aggregate.count,
      more ? 'caching' : (capReached ? 'limit' : 'ready'),
      Date.now(),
      session.id,
      message.revision,
    ).run();

  if (more && downloaded > 0) {
    await env.STREAMFLOW_QUEUE.send(message, { delaySeconds: 1 });
  }
}

async function processClear(env: Env, requestedAt: number): Promise<void> {
  await ensureSchema(env);
  const listed = await env.STREAMFLOW_R2.list({ prefix: `${STREAMFLOW_PREFIX}/`, limit: 500 });
  if (listed.objects.length) await env.STREAMFLOW_R2.delete(listed.objects.map(object => object.key));
  if (listed.truncated || listed.objects.length >= 500) {
    await env.STREAMFLOW_QUEUE.send({ type: 'clear', requestedAt }, { delaySeconds: 1 });
    return;
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM streamflow_objects'),
    env.DB.prepare('DELETE FROM streamflow_hints'),
    env.DB.prepare('DELETE FROM streamflow_sessions'),
  ]);
}

export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ ok: true, service: 'CactusStreamflow', version: '0.1.0' }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  },

  async queue(batch: MessageBatch<StreamflowMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.type === 'clear') await processClear(env, message.body.requestedAt);
        else await processCache(env, message.body);
        message.ack();
      } catch (error) {
        if (message.body.type === 'cache') await markError(env, message.body.sessionId, message.body.revision, error).catch(() => {});
        console.error('CactusStreamflow queue error', error);
        message.retry({ delaySeconds: 30 });
      }
    }
  },
} satisfies ExportedHandler<Env, StreamflowMessage>;

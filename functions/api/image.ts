import type { AppData, Env } from '../_shared/types';

const DOUBAN_HOSTS = /(^|\.)doubanio\.com$/i;
const NUMERIC_ID = /^\d{5,12}$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const CACHE_REVISION = '7';
const IMAGE_HOST_ALTERNATES = [
  'img1.doubanio.com',
  'img2.doubanio.com',
  'img3.doubanio.com',
  'img9.doubanio.com',
  'qnmob3.doubanio.com',
];
const BANGUMI_API = 'https://api.bgm.tv/v0/search/subjects?limit=10&offset=0';
const BANGUMI_SUBJECT_API = 'https://api.bgm.tv/v0/subjects/';
const KNOWN_BANGUMI_SUBJECTS: Record<string, number> = {
  '尼古喵喵': 622206,
  '再见菈菈': 495291,
};
const BANGUMI_IMAGE_HOSTS = /^(?:lain\.bgm\.tv|lain\.bgm38\.tv)$/i;

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36';
const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

const DOUBAN_HEADERS = {
  Accept: IMAGE_ACCEPT,
  Referer: 'https://movie.douban.com/',
  'User-Agent': DESKTOP_USER_AGENT,
};

function noStore(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

function textAt(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function detectedImageType(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return '';

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && textAt(bytes, 1, 4) === 'PNG') return 'image/png';
  if (textAt(bytes, 0, 4) === 'GIF8') return 'image/gif';
  if (textAt(bytes, 0, 4) === 'RIFF' && textAt(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (textAt(bytes, 0, 2) === 'BM') return 'image/bmp';

  if (textAt(bytes, 4, 8) === 'ftyp') {
    const brand = textAt(bytes, 8, 12).toLowerCase();
    if (['avif', 'avis', 'mif1', 'msf1', 'heic', 'heix'].includes(brand)) return 'image/avif';
  }

  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 768))).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return '';
}

function responseImageType(buffer: ArrayBuffer, contentType: string): string {
  const detected = detectedImageType(buffer);
  if (detected) return detected;

  const declared = contentType.split(';')[0].trim().toLowerCase();
  if (!declared.startsWith('image/')) return '';

  const head = new TextDecoder().decode(new Uint8Array(buffer).subarray(0, Math.min(buffer.byteLength, 512))).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('{') || head.startsWith('[')) return '';
  return declared;
}

function addCandidate(output: URL[], seen: Set<string>, candidate: URL): void {
  if (candidate.protocol !== 'https:' || !DOUBAN_HOSTS.test(candidate.hostname)) return;
  const value = candidate.toString();
  if (seen.has(value)) return;
  seen.add(value);
  output.push(candidate);
}

function officialCandidates(source: URL): URL[] {
  const output: URL[] = [];
  const seen = new Set<string>();

  const cleanSource = new URL(source.toString());
  cleanSource.protocol = 'https:';
  cleanSource.hash = '';
  addCandidate(output, seen, source);
  addCandidate(output, seen, cleanSource);

  // New Douban covers sometimes arrive from qnmob hosts or include image-processing
  // query strings. Those URLs can fail at the edge even though the same file works
  // from an img*.doubanio.com host without the transform query.
  const paths = new Set<string>([cleanSource.pathname]);
  if (/\/view\/photo\/[^/]*ratio_poster\//i.test(cleanSource.pathname)) {
    for (const size of ['l_ratio_poster', 'm_ratio_poster', 's_ratio_poster']) {
      paths.add(cleanSource.pathname.replace(/\/view\/photo\/[^/]*ratio_poster\//i, `/view/photo/${size}/`));
    }
  }
  if (/\/view\/photo\/(?:l|m|s)\/public\//i.test(cleanSource.pathname)) {
    for (const size of ['l', 'm', 's']) {
      paths.add(cleanSource.pathname.replace(/\/view\/photo\/(?:l|m|s)\/public\//i, `/view/photo/${size}/public/`));
    }
  }
  if (/\.webp$/i.test(cleanSource.pathname)) paths.add(cleanSource.pathname.replace(/\.webp$/i, '.jpg'));
  if (/\.jpg$/i.test(cleanSource.pathname)) paths.add(cleanSource.pathname.replace(/\.jpg$/i, '.webp'));

  for (const hostname of IMAGE_HOST_ALTERNATES) {
    for (const path of paths) {
      const candidate = new URL(cleanSource.toString());
      candidate.hostname = hostname;
      candidate.pathname = path;
      candidate.search = '';
      candidate.hash = '';
      addCandidate(output, seen, candidate);
    }
  }

  return output.slice(0, 30);
}

async function fetchImageOnce(url: URL, headers: HeadersInit, timeoutMs: number): Promise<{ response: Response | null; body: ArrayBuffer | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return { response, body: null };

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) return { response, body: null };

    const body = await response.arrayBuffer();
    return { response, body };
  } catch {
    return { response: null, body: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchVerified(url: URL, timeoutMs = 5_000): Promise<{ body: ArrayBuffer; type: string } | null> {
  const attempts: HeadersInit[] = [
    DOUBAN_HEADERS,
    { Accept: IMAGE_ACCEPT, 'User-Agent': MOBILE_USER_AGENT },
  ];

  for (let index = 0; index < attempts.length; index += 1) {
    const fetched = await fetchImageOnce(url, attempts[index], timeoutMs);
    if (!fetched.response || !fetched.body) {
      if (fetched.response && ![401, 403, 406, 429].includes(fetched.response.status)) break;
      continue;
    }

    if (fetched.body.byteLength < 64 || fetched.body.byteLength > MAX_IMAGE_BYTES) continue;
    const type = responseImageType(fetched.body, fetched.response.headers.get('content-type') || '');
    if (type) return { body: fetched.body, type };
  }

  return null;
}

async function firstVerified(candidates: URL[]): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!candidates.length) return null;

  const first = await fetchVerified(candidates[0]);
  if (first) return first;

  const remaining = candidates.slice(1);
  for (let index = 0; index < remaining.length; index += 5) {
    const results = await Promise.all(remaining.slice(index, index + 5).map(candidate => fetchVerified(candidate, 4_500)));
    const valid = results.find((value): value is { body: ArrayBuffer; type: string } => Boolean(value));
    if (valid) return valid;
  }
  return null;
}

function addBangumiCandidate(output: URL[], seen: Set<string>, value: unknown): void {
  if (typeof value !== 'string' || !value.trim()) return;
  try {
    const candidate = new URL(value.replace(/^http:/i, 'https:'));
    if (candidate.protocol !== 'https:' || !BANGUMI_IMAGE_HOSTS.test(candidate.hostname)) return;
    candidate.hash = '';
    const key = candidate.toString();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(candidate);
  } catch { /* ignore malformed image URL */ }
}

async function fetchVerifiedBangumi(url: URL, timeoutMs = 6_000): Promise<{ body: ArrayBuffer; type: string } | null> {
  const attempts: HeadersInit[] = [
    { Accept: IMAGE_ACCEPT, Referer: 'https://bangumi.tv/', 'User-Agent': DESKTOP_USER_AGENT },
    { Accept: IMAGE_ACCEPT, 'User-Agent': MOBILE_USER_AGENT },
  ];

  for (const headers of attempts) {
    const fetched = await fetchImageOnce(url, headers, timeoutMs);
    if (!fetched.response || !fetched.body) continue;
    if (fetched.body.byteLength < 64 || fetched.body.byteLength > MAX_IMAGE_BYTES) continue;
    const type = responseImageType(fetched.body, fetched.response.headers.get('content-type') || '');
    if (type) return { body: fetched.body, type };
  }
  return null;
}

async function verifiedBangumiCandidates(values: unknown[]): Promise<{ body: ArrayBuffer; type: string } | null> {
  const candidates: URL[] = [];
  const seen = new Set<string>();
  for (const value of values) addBangumiCandidate(candidates, seen, value);
  for (const candidate of candidates) {
    const verified = await fetchVerifiedBangumi(candidate);
    if (verified) return verified;
  }
  return null;
}

function bangumiImageValues(item: any): unknown[] {
  if (!item?.images) return [];
  return ['large', 'common', 'medium', 'small', 'grid'].map(key => item.images[key]);
}

async function bangumiSubjectPoster(subjectId: number): Promise<{ body: ArrayBuffer; type: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_500);
  try {
    const response = await fetch(`${BANGUMI_SUBJECT_API}${subjectId}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CactusTV/0.2.3 poster-fallback' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload: any = await response.json();
    return verifiedBangumiCandidates(bangumiImageValues(payload));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function bangumiPagePoster(subjectId: number): Promise<{ body: ArrayBuffer; type: string } | null> {
  const metadata = await fetchMetadata(
    new URL(`https://bangumi.tv/subject/${subjectId}`),
    'text/html,application/xhtml+xml',
    'https://bangumi.tv/',
    6_500,
  );
  if (!metadata) return null;
  const decoded = decodeEscapedText(metadata.text);
  const matches = decoded.match(/https?:\/\/lain\.(?:bgm|bgm38)\.tv\/pic\/cover\/[a-z]\/[^\s"'<>]+/gi) || [];
  return verifiedBangumiCandidates(matches);
}

async function bangumiPoster(title: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!title) return null;
  const normalized = normalizedTitle(title);
  const knownEntry = Object.entries(KNOWN_BANGUMI_SUBJECTS)
    .find(([name]) => normalizedTitle(name) === normalized);
  const knownSubjectId = knownEntry?.[1] || 0;

  if (knownSubjectId) {
    const exact = await bangumiSubjectPoster(knownSubjectId);
    if (exact) return exact;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(BANGUMI_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'CactusTV/0.2.3 poster-fallback',
      },
      body: JSON.stringify({ keyword: title, sort: 'match', filter: { type: [2] } }),
      signal: controller.signal,
    });
    if (response.ok) {
      const payload: any = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const ranked = items
        .map((item: any) => {
          const names = [item?.name_cn, item?.name].filter(Boolean).map((value: string) => normalizedTitle(String(value)));
          const exact = names.includes(normalized);
          const partial = names.some((name: string) => name.includes(normalized) || normalized.includes(name));
          return { item, score: exact ? 100 : partial ? 60 : 0 };
        })
        .filter((entry: any) => entry.score >= 60)
        .sort((left: any, right: any) => right.score - left.score);
      const selected = ranked[0]?.item;
      const searched = await verifiedBangumiCandidates(bangumiImageValues(selected));
      if (searched) return searched;
    }
  } catch {
    // The public API can be temporarily unavailable; use the exact subject page below.
  } finally {
    clearTimeout(timeout);
  }

  return knownSubjectId ? bangumiPagePoster(knownSubjectId) : null;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character] || character));
}

function placeholderPoster(title: string): Response {
  const cleanTitle = (title || '海报暂不可用').trim().slice(0, 28);
  const characters = Array.from(cleanTitle);
  const lines: string[] = [];
  while (characters.length && lines.length < 3) lines.push(characters.splice(0, 8).join(''));
  const text = lines.map((line, index) => `<text x="300" y="${520 + index * 66}" text-anchor="middle" class="title">${escapeXml(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171717"/><stop offset="0.55" stop-color="#090909"/><stop offset="1" stop-color="#2b080b"/></linearGradient>
    <radialGradient id="glow" cx="75%" cy="20%" r="70%"><stop stop-color="#e50914" stop-opacity=".28"/><stop offset="1" stop-color="#e50914" stop-opacity="0"/></radialGradient>
    <style>.brand{font:700 34px Arial,sans-serif;letter-spacing:5px;fill:#e50914}.title{font:700 42px system-ui,-apple-system,'Segoe UI','Noto Sans CJK SC','Microsoft YaHei',sans-serif;fill:#fff}.hint{font:400 22px system-ui,-apple-system,'Segoe UI','Noto Sans CJK SC','Microsoft YaHei',sans-serif;fill:#9a9a9a}</style>
  </defs>
  <rect width="600" height="900" fill="url(#bg)"/><rect width="600" height="900" fill="url(#glow)"/>
  <text x="42" y="72" class="brand">CACTUS</text>
  <g transform="translate(210 210)" fill="none" stroke="#555" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="180" height="125" rx="18"/><path d="M55 170h70M35 140h110"/></g>
  ${text}
  <text x="300" y="765" text-anchor="middle" class="hint">海报源暂时不可用</text>
  <text x="300" y="805" text-anchor="middle" class="hint">稍后刷新会自动重试</text>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
      'x-content-type-options': 'nosniff',
      'x-cactus-poster-source': 'generated-fallback',
    },
  });
}

function normalizedTitle(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s\-_:：·•.，,()（）\[\]【】]/g, '');
}

function decodeEscapedText(value: string): string {
  return value
    .replace(/\\u002f/gi, '/')
    .replace(/\\u003a/gi, ':')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"');
}

function urlsFromText(text: string): URL[] {
  const decoded = decodeEscapedText(text);
  const output: URL[] = [];
  const seen = new Set<string>();
  const matches = decoded.match(/https?:\/\/[^\s"'<>]+doubanio\.com\/[^\s"'<>]+/gi) || [];

  for (const match of matches) {
    const cleaned = match.replace(/[),.;]+$/g, '').replace(/^http:/i, 'https:');
    try {
      addCandidate(output, seen, new URL(cleaned));
    } catch { /* ignore malformed metadata URLs */ }
  }

  const score = (url: URL): number => {
    const path = url.pathname.toLowerCase();
    if (/\/view\/photo\/[^/]*ratio_poster\//.test(path)) return 120;
    if (/\/view\/photo\/(?:l|m|s)\/public\//.test(path)) return 100;
    if (/\/view\/photo\//.test(path)) return 80;
    if (/\/p\d+\.(?:jpg|jpeg|png|webp|avif)$/.test(path)) return 60;
    if (/\/(?:logo|icon|avatar|shire|talion)\//.test(path)) return -80;
    return 0;
  };
  return output.sort((left, right) => score(right) - score(left));
}

async function fetchMetadata(url: URL, accept: string, referer: string, timeoutMs = 6_000): Promise<{ text: string; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: accept,
        Referer: referer,
        Origin: new URL(referer).origin,
        'User-Agent': DESKTOP_USER_AGENT,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_METADATA_BYTES) return null;
    const text = await response.text();
    if (!text || text.length > MAX_METADATA_BYTES) return null;
    return { text, contentType: response.headers.get('content-type') || '' };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function prioritizedUrlsFromJson(payload: any, doubanId: string): URL[] {
  const output: URL[] = [];
  const seen = new Set<string>();
  const preferredKeys = /cover|poster|pic|image|photo|avatar/i;

  function visit(value: any, depth: number, matchedSubject: boolean): void {
    if (depth > 8 || value == null) return;
    if (typeof value === 'string') {
      if (!matchedSubject && doubanId) return;
      for (const url of urlsFromText(value)) addCandidate(output, seen, url);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, matchedSubject);
      return;
    }
    if (typeof value !== 'object') return;

    const objectId = String(value.id || value.subject_id || value.douban_id || '');
    const isTarget = matchedSubject || !doubanId || objectId === doubanId;

    const entries = Object.entries(value);
    for (const [key, child] of entries.filter(([key]) => preferredKeys.test(key))) visit(child, depth + 1, isTarget);
    for (const [key, child] of entries.filter(([key]) => !preferredKeys.test(key))) visit(child, depth + 1, isTarget);
  }

  visit(payload, 0, false);
  return output;
}

async function refreshedOfficialPoster(title: string, doubanId: string): Promise<URL[]> {
  if (!title) return [];

  const endpoint = new URL('https://movie.douban.com/j/subject_suggest');
  endpoint.searchParams.set('q', title);
  const metadata = await fetchMetadata(endpoint, 'application/json, text/plain, */*', 'https://movie.douban.com/');
  if (!metadata) return [];

  try {
    const payload: any = JSON.parse(metadata.text);
    const items = Array.isArray(payload) ? payload : [];
    const targetTitle = normalizedTitle(title);
    const selected = items.find((item: any) => doubanId && String(item?.id || '') === doubanId)
      || items.find((item: any) => normalizedTitle(String(item?.title || item?.sub_title || '')) === targetTitle)
      || items[0];
    return prioritizedUrlsFromJson(selected, doubanId || String(selected?.id || ''));
  } catch {
    return urlsFromText(metadata.text);
  }
}

async function subjectMetadataPosters(doubanId: string): Promise<URL[]> {
  if (!NUMERIC_ID.test(doubanId)) return [];

  const targets = [
    {
      url: new URL(`https://movie.douban.com/subject/${doubanId}/`),
      accept: 'text/html,application/xhtml+xml',
      referer: 'https://movie.douban.com/',
    },
    {
      url: new URL(`https://m.douban.com/rexxar/api/v2/tv/${doubanId}?ck=&for_mobile=1`),
      accept: 'application/json, text/plain, */*',
      referer: `https://m.douban.com/movie/subject/${doubanId}/`,
    },
    {
      url: new URL(`https://m.douban.com/rexxar/api/v2/movie/${doubanId}?ck=&for_mobile=1`),
      accept: 'application/json, text/plain, */*',
      referer: `https://m.douban.com/movie/subject/${doubanId}/`,
    },
    {
      url: new URL('https://m.douban.com/rexxar/api/v2/subject_collection/tv_animation/items?start=0&count=50&items_only=1&for_mobile=1'),
      accept: 'application/json, text/plain, */*',
      referer: 'https://m.douban.com/subject_collection/tv_animation',
    },
  ];

  const responses = await Promise.all(targets.map(target => fetchMetadata(target.url, target.accept, target.referer, 6_500)));
  const output: URL[] = [];
  const seen = new Set<string>();

  for (const response of responses) {
    if (!response) continue;
    if (/json/i.test(response.contentType) || response.text.trimStart().startsWith('{') || response.text.trimStart().startsWith('[')) {
      try {
        const payload = JSON.parse(response.text);
        for (const url of prioritizedUrlsFromJson(payload, doubanId)) addCandidate(output, seen, url);
        continue;
      } catch { /* fall through to HTML/text extraction */ }
    }
    for (const url of urlsFromText(response.text)) addCandidate(output, seen, url);
  }

  return output.slice(0, 20);
}

async function backupPoster(doubanId: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!NUMERIC_ID.test(doubanId)) return null;
  const candidates = [
    new URL(`https://dou.img.lithub.cc/movie/${doubanId}.jpg`),
    new URL(`https://dou.img.lithub.cc/tv/${doubanId}.jpg`),
  ];
  for (const candidate of candidates) {
    const result = await fetchVerified(candidate, 7_000);
    if (result) return result;
  }
  return null;
}

function mergeCandidates(...groups: URL[][]): URL[] {
  const output: URL[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const url of group) addCandidate(output, seen, url);
  }
  return output;
}

export const onRequestGet: PagesFunction<Env, any, AppData> = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get('url') || '';
  const rawId = requestUrl.searchParams.get('id') || '';
  const doubanId = NUMERIC_ID.test(rawId) ? rawId : '';
  const title = (requestUrl.searchParams.get('title') || '').trim().slice(0, 100);
  const bypassCache = requestUrl.searchParams.has('retry') || requestUrl.searchParams.get('bypass') === '1';

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return noStore('Bad image URL', 400);
  }

  if (imageUrl.protocol === 'http:' && DOUBAN_HOSTS.test(imageUrl.hostname)) imageUrl.protocol = 'https:';
  if (imageUrl.protocol !== 'https:' || !DOUBAN_HOSTS.test(imageUrl.hostname)) {
    return noStore('Image host not allowed', 403);
  }

  const cache = caches.default;
  const cacheUrl = new URL(requestUrl.origin + requestUrl.pathname);
  cacheUrl.searchParams.set('url', imageUrl.toString());
  cacheUrl.searchParams.set('rev', CACHE_REVISION);
  if (doubanId) cacheUrl.searchParams.set('id', doubanId);
  if (title) cacheUrl.searchParams.set('title', title);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  if (!bypassCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let sourceName = 'douban-original';
  let result = await firstVerified(officialCandidates(imageUrl));

  if (!result && (title || doubanId)) {
    const [suggested, subjectPosters] = await Promise.all([
      refreshedOfficialPoster(title, doubanId),
      subjectMetadataPosters(doubanId),
    ]);
    const refreshedCandidates = mergeCandidates(suggested, subjectPosters)
      .flatMap(candidate => officialCandidates(candidate));
    result = await firstVerified(mergeCandidates(refreshedCandidates));
    if (result) sourceName = 'douban-refreshed';
  }

  if (!result && doubanId) {
    result = await backupPoster(doubanId);
    if (result) sourceName = 'douban-backup';
  }

  // Anime entries that have just aired can briefly expose a broken Douban CDN URL.
  // Bangumi is only consulted after every Douban route has failed.
  if (!result && title) {
    result = await bangumiPoster(title);
    if (result) sourceName = 'bangumi';
  }

  // Never leave a blank white card. This response is intentionally short-lived so
  // a later refresh can recover the real poster as soon as an upstream starts working.
  if (!result) return placeholderPoster(title);

  const headers = new Headers();
  headers.set('content-type', result.type);
  headers.set('content-length', String(result.body.byteLength));
  headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-cactus-poster-source', sourceName);

  const proxied = new Response(result.body, { status: 200, headers });
  await cache.put(cacheKey, proxied.clone());
  return proxied;
};

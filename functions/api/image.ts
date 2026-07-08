import type { AppData, Env } from '../_shared/types';

const DOUBAN_HOSTS = /(^|\.)doubanio\.com$/i;
const DOUBAN_IMAGE_HOST = /^img\d+\.doubanio\.com$/i;
const NUMERIC_ID = /^\d{5,12}$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CACHE_REVISION = '5';
const IMAGE_HOST_ALTERNATES = [
  'img1.doubanio.com',
  'img2.doubanio.com',
  'img3.doubanio.com',
  'img9.doubanio.com',
];

const DOUBAN_HEADERS = {
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  Referer: 'https://movie.douban.com/',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36',
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
  if (textAt(bytes, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(textAt(bytes, 8, 12))) return 'image/avif';

  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 768))).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return '';
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
  addCandidate(output, seen, source);

  const paths = new Set<string>([source.pathname]);
  const sizeMatch = source.pathname.match(/\/view\/photo\/[^/]*ratio_poster\//i);
  if (sizeMatch) {
    for (const size of ['m_ratio_poster', 'l_ratio_poster', 's_ratio_poster']) {
      paths.add(source.pathname.replace(/\/view\/photo\/[^/]*ratio_poster\//i, `/view/photo/${size}/`));
    }
  }

  for (const path of paths) {
    const candidate = new URL(source.toString());
    candidate.pathname = path;
    addCandidate(output, seen, candidate);
  }

  if (DOUBAN_IMAGE_HOST.test(source.hostname)) {
    const preferredPaths = Array.from(paths).slice(0, 2);
    for (const hostname of IMAGE_HOST_ALTERNATES) {
      for (const path of preferredPaths) {
        const candidate = new URL(source.toString());
        candidate.hostname = hostname;
        candidate.pathname = path;
        addCandidate(output, seen, candidate);
      }
    }
  }

  return output.slice(0, 10);
}

async function fetchVerified(url: URL, timeoutMs = 6_000): Promise<{ body: ArrayBuffer; type: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: DOUBAN_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength < 64 || body.byteLength > MAX_IMAGE_BYTES) return null;

    const type = detectedImageType(body);
    return type ? { body, type } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function firstVerified(candidates: URL[]): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!candidates.length) return null;

  const first = await fetchVerified(candidates[0]);
  if (first) return first;

  for (let index = 1; index < candidates.length; index += 3) {
    const results = await Promise.all(candidates.slice(index, index + 3).map(candidate => fetchVerified(candidate)));
    const valid = results.find(Boolean);
    if (valid) return valid;
  }
  return null;
}

function normalizedTitle(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s\-_:：·•.，,()（）\[\]【】]/g, '');
}

async function refreshedOfficialPoster(title: string, doubanId: string): Promise<URL | null> {
  if (!title) return null;

  const endpoint = new URL('https://movie.douban.com/j/subject_suggest');
  endpoint.searchParams.set('q', title);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        ...DOUBAN_HEADERS,
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://movie.douban.com',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload: any = await response.json();
    const items = Array.isArray(payload) ? payload : [];
    const targetTitle = normalizedTitle(title);
    const selected = items.find((item: any) => doubanId && String(item?.id || '') === doubanId)
      || items.find((item: any) => normalizedTitle(String(item?.title || item?.sub_title || '')) === targetTitle)
      || items[0];
    const value = String(selected?.pic || selected?.img || selected?.cover_url || '').replace(/\\/g, '').replace(/^http:/i, 'https:');
    if (!value) return null;

    const poster = new URL(value);
    return poster.protocol === 'https:' && DOUBAN_HOSTS.test(poster.hostname) ? poster : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function backupPoster(doubanId: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!NUMERIC_ID.test(doubanId)) return null;
  const url = new URL(`https://dou.img.lithub.cc/movie/${doubanId}.jpg`);
  return fetchVerified(url, 7_000);
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

  let result = await firstVerified(officialCandidates(imageUrl));

  if (!result && title) {
    const refreshed = await refreshedOfficialPoster(title, doubanId);
    if (refreshed && refreshed.toString() !== imageUrl.toString()) {
      result = await firstVerified(officialCandidates(refreshed));
    }
  }

  if (!result && doubanId) result = await backupPoster(doubanId);
  if (!result) return noStore('Image unavailable', 502);

  const headers = new Headers();
  headers.set('content-type', result.type);
  headers.set('content-length', String(result.body.byteLength));
  headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  headers.set('x-content-type-options', 'nosniff');

  const proxied = new Response(result.body, { status: 200, headers });
  await cache.put(cacheKey, proxied.clone());
  return proxied;
};

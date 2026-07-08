import type { AppData, Env } from '../_shared/types';

const ALLOWED_HOSTS = /(^|\.)doubanio\.com$/i;

export const onRequestGet: PagesFunction<Env, any, AppData> = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get('url') || '';

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return new Response('Bad image URL', { status: 400 });
  }

  if (imageUrl.protocol !== 'https:' || !ALLOWED_HOSTS.test(imageUrl.hostname)) {
    return new Response('Image host not allowed', { status: 403 });
  }

  const cache = caches.default;
  const cacheKey = new Request(requestUrl.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await fetch(imageUrl.toString(), {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: 'https://movie.douban.com/',
      'User-Agent': 'Mozilla/5.0',
    },
    redirect: 'follow',
  });

  if (!response.ok || !response.body) {
    return new Response('Image unavailable', { status: response.status || 502 });
  }

  const headers = new Headers();
  headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
  headers.set('cache-control', 'public, max-age=86400, s-maxage=604800');
  headers.set('x-content-type-options', 'nosniff');

  const proxied = new Response(response.body, { status: 200, headers });
  await cache.put(cacheKey, proxied.clone());
  return proxied;
};

import { HttpError } from './http';
import { encodeProxyTarget, mediaAuthHeaders, type MediaSession, validateProxyTarget } from './media';

function cleanUpstreamUrl(url: URL): URL {
  for (const key of [...url.searchParams.keys()]) {
    if (/^(api_key|apikey|x-emby-token|token)$/i.test(key)) url.searchParams.delete(key);
  }
  return url;
}

function proxyUrl(origin: string, sessionId: string, upstream: URL): string {
  cleanUpstreamUrl(upstream);
  return `${origin}/api/media/proxy?session=${encodeURIComponent(sessionId)}&u=${encodeURIComponent(encodeProxyTarget(upstream.toString()))}`;
}

function rewritePlaylist(text: string, baseUrl: string, origin: string, sessionId: string): string {
  const base = new URL(baseUrl);
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith('#')) {
      try { return proxyUrl(origin, sessionId, new URL(trimmed, base)); }
      catch { return line; }
    }
    return line.replace(/URI=("([^"]+)"|'([^']+)')/gi, (_match, quoted, doubleValue, singleValue) => {
      const value = doubleValue || singleValue || '';
      try {
        const rewritten = proxyUrl(origin, sessionId, new URL(value, base));
        return `URI="${rewritten}"`;
      } catch {
        return `URI=${quoted}`;
      }
    });
  }).join('\n');
}

function isPlaylist(response: Response, url: URL): boolean {
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  return /mpegurl|m3u8/.test(type) || /\.m3u8(?:$|[?#])/i.test(url.toString());
}

function forwardHeaders(response: Response, transformed = false): Headers {
  const headers = new Headers();
  for (const key of ['content-type', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'content-disposition']) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (!transformed) {
    const length = response.headers.get('content-length');
    if (length) headers.set('content-length', length);
  }
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

export async function proxyMediaRequest(request: Request, session: MediaSession, target: URL): Promise<Response> {
  validateProxyTarget(session, target.toString());
  const headers = mediaAuthHeaders(session, {
    Accept: request.headers.get('accept') || '*/*',
  });
  const range = request.headers.get('range');
  if (range) headers.set('Range', range);
  const upstream = await fetch(target.toString(), {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    redirect: 'follow',
  });
  if (!upstream.ok && upstream.status !== 206) {
    if (upstream.status === 401 || upstream.status === 403) {
      throw new HttpError(401, '媒体库登录已失效，请重新连接', 'MEDIA_AUTH_FAILED');
    }
    throw new HttpError(502, `媒体服务器返回 HTTP ${upstream.status}`, 'MEDIA_STREAM_UPSTREAM_ERROR');
  }

  const finalUrl = validateProxyTarget(session, upstream.url || target.toString());
  if (request.method !== 'HEAD' && isPlaylist(upstream, finalUrl)) {
    const text = await upstream.text();
    if (text.length > 8_000_000) throw new HttpError(502, '播放列表过大', 'MEDIA_PLAYLIST_TOO_LARGE');
    const rewritten = rewritePlaylist(text, finalUrl.toString(), new URL(request.url).origin, session.id);
    const responseHeaders = forwardHeaders(upstream, true);
    responseHeaders.set('content-type', 'application/vnd.apple.mpegurl; charset=utf-8');
    return new Response(rewritten, { status: upstream.status, headers: responseHeaders });
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardHeaders(upstream),
  });
}

import { HttpError, ok } from '../_shared/http';
import { fetchWithTimeout, findProvider, validateHttpsUrl } from '../_shared/providers';
import type { AppData, Env, Provider } from '../_shared/types';

const PLAYLIST_LIMIT = 3_000_000;
const SNIFF_LIMIT = 64 * 1024;
const STRONG_AD_TOKEN = /(?:^|[\/_\-.?&=])(?:ads?|advert(?:isement)?s?|commercials?|promo(?:tion)?s?|pre-?roll|mid-?roll|post-?roll|ad-?segment|ad-?break|ad-?pod|creative|placement|vast|vmap|ima|ssai|dai|stitched?-?ad|slate|casino|bet(?:ting)?|gambling|博彩|赌博)(?:[\/_\-.?&=]|$)/i;
const AD_QUERY_KEY = /^(?:ad|ads|ad_?id|ad_?unit|advert|commercial|campaign|preroll|midroll|postroll|creative(?:id)?|placement(?:id)?|vast|vmap|ima|ssai|dai)$/i;
const AD_HOST_TOKEN = /(?:^|\.)(?:ads?|adservice|adserver|adnxs|doubleclick|googlesyndication|googleads|imasdk|innovid|freewheel|spotx|springserve|pubads)(?:\.|$)/i;
const AD_QUERY_VALUE = /^(?:1|true|yes|ad|ads|advert|commercial|preroll|midroll|postroll)$/i;
const AD_QUERY_ID_KEY = /^(?:ad_?id|ad_?unit|campaign|creative(?:id)?|placement(?:id)?)$/i;
const AD_CUE_OUT = /^#EXT-X-CUE-OUT(?:-CONT)?\b/i;
const AD_SCTE_MARKER = /^#EXT-X-(?:SCTE35|OATCLS-SCTE35)\b/i;
const AD_CUE_IN = /^#EXT-X-CUE-IN\b/i;

function hostMatchesRule(hostname: string, rule: string): boolean {
  const host = hostname.toLowerCase();
  const normalized = rule.trim().toLowerCase();
  if (!normalized) return false;
  if (!normalized.startsWith('*.')) return host === normalized;
  const base = normalized.slice(2);
  if (base.split('.').length < 2) return false;
  return host !== base && host.endsWith(`.${base}`);
}

function allowedHost(provider: Provider, hostname: string): boolean {
  const rules = [new URL(provider.baseUrl).hostname.toLowerCase(), ...provider.mediaHosts];
  return rules.some(rule => hostMatchesRule(hostname, rule));
}

function assertMediaUrl(provider: Provider, raw: string): URL {
  const value = validateHttpsUrl(raw);
  const url = new URL(value);
  if (!allowedHost(provider, url.hostname)) throw new HttpError(403, `媒体主机 ${url.hostname} 不在该数据源白名单中`, 'MEDIA_HOST_BLOCKED');
  return url;
}

type AdMeta = { reason: string; group: number } | null;

function proxied(provider: Provider, absolute: string, clean = false, ad: AdMeta = null): string {
  const params = new URLSearchParams({ provider: provider.id, url: absolute });
  if (clean) params.set('clean', '1');
  if (ad) {
    params.set('cactus_ad', '1');
    params.set('cactus_ad_reason', ad.reason);
    params.set('cactus_ad_group', String(ad.group));
  }
  return `/api/stream?${params.toString()}`;
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

function adReasonForUri(raw: string, base: URL): string {
  const decoded = safeDecode(raw).toLowerCase();
  if (STRONG_AD_TOKEN.test(decoded)) return 'url';
  try {
    const url = new URL(raw, base);
    const target = safeDecode(`${url.pathname}${url.search}`).toLowerCase();
    if (AD_HOST_TOKEN.test(url.hostname)) return 'host';
    if (STRONG_AD_TOKEN.test(target)) return 'url';
    for (const [key, value] of url.searchParams) {
      if (AD_QUERY_KEY.test(key) && (AD_QUERY_ID_KEY.test(key) ? Boolean(value) : AD_QUERY_VALUE.test(value) || STRONG_AD_TOKEN.test(safeDecode(value)))) return 'query';
    }
  } catch {}
  return '';
}

function isAdDateRange(line: string): boolean {
  if (!/^#EXT-X-DATERANGE:/i.test(line)) return false;
  return /(?:CLASS|ID)="[^"]*(?:ad|advert|commercial|interstitial|scte)[^"]*"/i.test(line)
    || /SCTE35-(?:OUT|CMD)=/i.test(line)
    || /X-ASSET-(?:URI|LIST)=/i.test(line);
}

function isExternalInterstitial(line: string): boolean {
  return /^#EXT-X-DATERANGE:/i.test(line)
    && (/X-ASSET-(?:URI|LIST)=/i.test(line) || /CLASS="[^"]*interstitial[^"]*"/i.test(line));
}

function attributeNumber(line: string, name: string): number {
  const match = line.match(new RegExp(`(?:^|[:,])\\s*${name}=([0-9]+(?:\\.[0-9]+)?)`, 'i'));
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function cueDuration(line: string): number {
  const direct = line.match(/^#EXT-X-CUE-OUT:\s*([0-9]+(?:\.[0-9]+)?)/i);
  const value = Number(direct?.[1]);
  return Number.isFinite(value) && value > 0 ? value : attributeNumber(line, 'DURATION');
}

function rewriteUriAttributes(rawLine: string, base: URL, provider: Provider, clean: boolean): string {
  return rawLine.replace(/URI="([^"]+)"/g, (_all, uri) => {
    try { return `URI="${proxied(provider, new URL(uri, base).toString(), clean)}"`; }
    catch { return `URI="${uri}"`; }
  });
}

function rewriteM3u8(text: string, base: URL, provider: Provider, clean: boolean): {
  text: string;
  marked: number;
  interstitials: number;
  cleanReason: string;
} {
  const mediaPlaylist = /#EXTINF:/i.test(text);
  if (!mediaPlaylist) {
    const master = text.split(/\r?\n/).map(rawLine => {
      const trimmed = rawLine.trim();
      if (!trimmed) return rawLine;
      if (!trimmed.startsWith('#')) {
        try { return proxied(provider, new URL(trimmed, base).toString(), clean); }
        catch { return rawLine; }
      }
      return rewriteUriAttributes(rawLine, base, provider, clean);
    }).join('\n');
    return { text: master, marked: 0, interstitials: 0, cleanReason: clean ? 'master-playlist' : 'disabled' };
  }

  const output: string[] = [];
  let cueActive = false;
  let timedAdRemaining = 0;
  let pendingDuration = 0;
  let waitingForSegmentUri = false;
  let marked = 0;
  let interstitials = 0;
  let group = 0;
  let previousWasAd = false;
  const reasons = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (clean && isExternalInterstitial(line)) {
      interstitials += 1;
      reasons.add('interstitial');
      continue;
    }

    if (AD_CUE_OUT.test(line)) {
      cueActive = true;
      const duration = cueDuration(line);
      if (duration > 0) timedAdRemaining = Math.max(timedAdRemaining, duration);
      if (clean) { reasons.add('cue'); continue; }
    }
    if (AD_SCTE_MARKER.test(line)) {
      const duration = attributeNumber(line, 'DURATION');
      if (duration > 0) timedAdRemaining = Math.max(timedAdRemaining, duration);
      if (clean) { reasons.add('scte'); continue; }
    }
    if (AD_CUE_IN.test(line)) {
      cueActive = false;
      timedAdRemaining = 0;
      if (clean) continue;
    }
    if (clean && isAdDateRange(line)) {
      const duration = attributeNumber(line, 'DURATION') || attributeNumber(line, 'PLANNED-DURATION');
      if (duration > 0) timedAdRemaining = Math.max(timedAdRemaining, duration);
      reasons.add('daterange');
      continue;
    }

    if (/^#EXTINF:/i.test(line)) {
      const duration = Number(line.slice(line.indexOf(':') + 1).split(',')[0]);
      pendingDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      waitingForSegmentUri = true;
      output.push(rawLine);
      continue;
    }

    if (waitingForSegmentUri && line && !line.startsWith('#')) {
      let reason = '';
      if (clean) {
        if (cueActive) reason = 'cue';
        else if (timedAdRemaining > 0.01) reason = 'daterange';
        else reason = adReasonForUri(line, base);
      }
      const isAd = Boolean(reason);
      if (isAd && !previousWasAd) group += 1;
      if (isAd) {
        marked += 1;
        reasons.add(reason);
      }
      try {
        output.push(proxied(provider, new URL(line, base).toString(), clean, isAd ? { reason, group } : null));
      } catch { output.push(rawLine); }
      if (timedAdRemaining > 0) timedAdRemaining = Math.max(0, timedAdRemaining - pendingDuration);
      previousWasAd = isAd;
      waitingForSegmentUri = false;
      pendingDuration = 0;
      continue;
    }

    if (line && !line.startsWith('#')) {
      try { output.push(proxied(provider, new URL(line, base).toString(), clean)); }
      catch { output.push(rawLine); }
      previousWasAd = false;
      continue;
    }

    output.push(rewriteUriAttributes(rawLine, base, provider, clean));
  }

  const cleanReason = !clean
    ? 'disabled'
    : marked || interstitials
      ? [...reasons].join(',') || 'marked'
      : 'no-match';
  return { text: output.join('\n'), marked, interstitials, cleanReason };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function normalizeMpdBase(text: string, manifestUrl: URL): string {
  const directory = new URL('.', manifestUrl).toString();
  return text.replace(/<MPD\b[^>]*>/i, match => `${match}<BaseURL>${escapeXml(directory)}</BaseURL>`);
}

async function fetchRedirectSafe(provider: Provider, url: URL, request: Request): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i += 1) {
    assertMediaUrl(provider, current.toString());
    const headers = new Headers({ Accept: '*/*', 'User-Agent': 'CactusTV/1.3.1', ...provider.requestHeaders });
    const range = request.headers.get('range');
    if (range) headers.set('range', range);
    const response = await fetchWithTimeout(current.toString(), { headers, redirect: 'manual' }, 15_000);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    current = new URL(location, current);
    assertMediaUrl(provider, current.toString());
  }
  throw new HttpError(502, '媒体地址重定向次数过多', 'TOO_MANY_REDIRECTS');
}

function declaredKind(contentType: string, url: URL): 'hls' | 'dash' | 'media' | '' {
  const path = `${url.pathname}${url.search}`;
  if (contentType.includes('mpegurl') || /\.m3u8(?:$|[?#])/i.test(path)) return 'hls';
  if (contentType.includes('dash+xml') || /\.mpd(?:$|[?#])/i.test(path)) return 'dash';
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return 'media';
  return '';
}

function sniffKind(bytes: Uint8Array): 'hls' | 'dash' | 'media' {
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, SNIFF_LIMIT)).trimStart();
  if (sample.startsWith('#EXTM3U')) return 'hls';
  if (/^<\?xml[\s\S]{0,500}<MPD\b|^<MPD\b/i.test(sample)) return 'dash';
  return 'media';
}

async function readPrefix(body: ReadableStream<Uint8Array> | null, limit = SNIFF_LIMIT): Promise<{
  prefix: Uint8Array;
  rest: ReadableStream<Uint8Array> | null;
}> {
  if (!body) return { prefix: new Uint8Array(), rest: null };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  while (total < limit) {
    const result = await reader.read();
    done = result.done;
    if (result.value) { chunks.push(result.value); total += result.value.byteLength; }
    if (done) break;
  }
  const prefix = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => { prefix.set(chunk, offset); offset += chunk.byteLength; });
  if (done) return { prefix, rest: null };
  const rest = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) { controller.close(); reader.releaseLock(); }
      else controller.enqueue(result.value);
    },
    async cancel(reason) { await reader.cancel(reason); },
  });
  return { prefix, rest };
}

function combinedBody(prefix: Uint8Array, rest: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> {
  let sent = false;
  const reader = rest?.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sent) {
        sent = true;
        if (prefix.byteLength) controller.enqueue(prefix);
        if (!reader) controller.close();
        return;
      }
      if (!reader) { controller.close(); return; }
      const result = await reader.read();
      if (result.done) { controller.close(); reader.releaseLock(); }
      else controller.enqueue(result.value);
    },
    async cancel(reason) { await reader?.cancel(reason); },
  });
}

function mediaHeaders(upstream: Response, contentType: string): Headers {
  const headers = new Headers();
  ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'].forEach(key => {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  });
  headers.set('cache-control', contentType.includes('video') || contentType.includes('audio') || contentType.includes('octet-stream')
    ? 'public, max-age=300, stale-while-revalidate=60'
    : 'public, max-age=60');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('vary', 'Range');
  return headers;
}

export const onRequestGet: PagesFunction<Env, any, AppData> = async ({ request, env }) => {
  const params = new URL(request.url).searchParams;
  const provider = await findProvider(env, params.get('provider') || '');
  if (!provider || !provider.enabled || !provider.proxyEnabled) throw new HttpError(404, '该数据源未启用受控代理', 'PROXY_DISABLED');

  const clean = params.get('clean') === '1';
  const target = assertMediaUrl(provider, params.get('url') || '');
  const upstream = await fetchRedirectSafe(provider, target, request);
  if (!upstream.ok && upstream.status !== 206) throw new HttpError(502, `媒体上游返回 HTTP ${upstream.status}`, 'MEDIA_UPSTREAM_ERROR');

  const finalUrl = upstream.url ? new URL(upstream.url) : target;
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  let kind = declaredKind(contentType, finalUrl);
  let prefix = new Uint8Array();
  let rest: ReadableStream<Uint8Array> | null = upstream.body;

  if (!kind || contentType.includes('octet-stream') || contentType.includes('text/plain')) {
    const peeked = await readPrefix(upstream.body);
    prefix = peeked.prefix;
    rest = peeked.rest;
    kind = sniffKind(prefix);
  }

  if (params.get('probe') === '1') {
    try { await rest?.cancel(); } catch {}
    return ok({ kind, contentType, finalUrl: finalUrl.toString(), clean }, 200, { 'cache-control': 'no-store, private' });
  }

  if (kind === 'hls') {
    let bytes = prefix;
    if (rest) {
      const remaining = await new Response(rest).arrayBuffer();
      if (bytes.byteLength + remaining.byteLength > PLAYLIST_LIMIT) throw new HttpError(502, '播放列表过大', 'PLAYLIST_TOO_LARGE');
      const combined = new Uint8Array(bytes.byteLength + remaining.byteLength);
      combined.set(bytes, 0);
      combined.set(new Uint8Array(remaining), bytes.byteLength);
      bytes = combined;
    }
    if (bytes.byteLength > PLAYLIST_LIMIT) throw new HttpError(502, '播放列表过大', 'PLAYLIST_TOO_LARGE');
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const rewritten = rewriteM3u8(text, finalUrl, provider, clean);
    return new Response(rewritten.text, {
      headers: {
        'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'cache-control': 'no-store, private',
        'access-control-allow-origin': '*',
        'x-cactus-media-kind': 'hls',
        'x-cactus-cleanstream': clean ? (rewritten.marked ? 'MARKED' : rewritten.interstitials ? 'INTERSTITIAL' : 'PASS') : 'OFF',
        'x-cactus-cleanstream-marked': String(rewritten.marked),
        'x-cactus-cleanstream-interstitials': String(rewritten.interstitials),
        'x-cactus-cleanstream-reason': rewritten.cleanReason,
      },
    });
  }

  if (kind === 'dash') {
    let bytes = prefix;
    if (rest) {
      const remaining = await new Response(rest).arrayBuffer();
      if (bytes.byteLength + remaining.byteLength > PLAYLIST_LIMIT) throw new HttpError(502, 'DASH 清单过大', 'PLAYLIST_TOO_LARGE');
      const combined = new Uint8Array(bytes.byteLength + remaining.byteLength);
      combined.set(bytes, 0);
      combined.set(new Uint8Array(remaining), bytes.byteLength);
      bytes = combined;
    }
    if (bytes.byteLength > PLAYLIST_LIMIT) throw new HttpError(502, 'DASH 清单过大', 'PLAYLIST_TOO_LARGE');
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return new Response(normalizeMpdBase(text, finalUrl), {
      headers: {
        'content-type': 'application/dash+xml; charset=utf-8',
        'cache-control': 'no-store, private',
        'access-control-allow-origin': '*',
        'x-cactus-media-kind': 'dash',
      },
    });
  }

  const allowedTypes = ['video/', 'audio/', 'application/octet-stream', 'application/dash+xml', 'text/xml', 'application/xml', 'text/plain'];
  if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
    try { await rest?.cancel(); } catch {}
    throw new HttpError(415, `不支持代理该媒体类型：${contentType}`, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const headers = mediaHeaders(upstream, contentType);
  headers.set('x-cactus-media-kind', kind || 'media');
  if (!headers.get('content-type') || contentType.includes('text/plain')) headers.set('content-type', 'application/octet-stream');
  const body = prefix.byteLength ? combinedBody(prefix, rest) : rest;
  return new Response(body, { status: upstream.status, headers });
};

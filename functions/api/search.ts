import { HttpError, ok } from '../_shared/http';
import { bestTmdbMatch, doubanSearch, searchTmdb } from '../_shared/metadata';
import { buildCmsUrl, fetchJson, getProviders } from '../_shared/providers';
import type { AppData, Env } from '../_shared/types';

function cleanName(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\s\-—–_:：·•.，,()（）\[\]【】]/g, '')
    .replace(/(第?[一二三四五六七八九十0-9]+季|国语|粤语|中字|高清|完整版)$/gu, '');
}

function keyFor(name: string, year: string) { return `${cleanName(name)}:${year || ''}`; }

function metadataName(value: string): string {
  return cleanName(value)
    .replace(/(?:电影|影视|剧情)?解说$/u, '')
    .replace(/(?:抢先|先行|正式|终极)?预告(?:片)?$/u, '')
    .replace(/(?:抢先|先行|加长|导演剪辑|修复|重映|未删减|完整)版$/u, '')
    .replace(/(?:花絮|幕后特辑|制作特辑|彩蛋)$/u, '');
}

function sameMetadataTitle(left: string, right: string): boolean {
  const a = metadataName(left);
  const b = metadataName(right);
  return Boolean(a && b && a === b);
}

function backfillSiblingPosters(items: any[]): any[] {
  const pools = new Map<string, Array<{ pic: string; year: string; priority: number }>>();
  for (const item of items) {
    const key = metadataName(String(item.name || ''));
    const pic = String(item.pic || '');
    if (!key || !pic) continue;
    const year = String(item.tmdb?.year || item.douban?.year || item.year || '');
    const priority = item.tmdb?.poster ? 3 : item.douban?.poster ? 2 : 1;
    const list = pools.get(key) || [];
    list.push({ pic, year, priority });
    list.sort((a, b) => b.priority - a.priority);
    pools.set(key, list);
  }

  return items.map(item => {
    if (item.pic) return item;
    const key = metadataName(String(item.name || ''));
    const candidates = pools.get(key) || [];
    if (!candidates.length) return item;
    const year = String(item.tmdb?.year || item.douban?.year || item.year || '');
    const exact = year ? candidates.find(candidate => candidate.year === year) : null;
    const compatible = exact || candidates.find(candidate => {
      if (!year || !candidate.year) return true;
      const delta = Math.abs(Number(year) - Number(candidate.year));
      return Number.isFinite(delta) && delta <= 1;
    });
    return compatible ? { ...item, pic: compatible.pic } : item;
  });
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export const onRequestGet: PagesFunction<Env, any, AppData> = async context => {
  const { request, env } = context;
  const query = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (!query || query.length > 80) throw new HttpError(400, '请输入 1—80 个字符的关键词', 'INVALID_QUERY');

  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set('q', query.normalize('NFKC'));
  cacheUrl.searchParams.set('v', '5');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const providers = await getProviders(env);
  if (!providers.length) {
    return ok({ items: [], errors: [], query }, 200, {
      'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
    });
  }

  const metadataPromise = searchTmdb(query, env).catch(() => []);
  const doubanPromise = doubanSearch(query, env).catch(() => null);
  const settled = await mapLimit(providers, 3, async provider => {
    const started = Date.now();
    const payload = await fetchJson(buildCmsUrl(provider, { ac: 'detail', wd: query }), provider, 7_000);
    const list = Array.isArray(payload?.list) ? payload.list : [];
    return {
      latency: Date.now() - started,
      provider,
      items: list.slice(0, 40).map((item: any) => ({
        id: String(item.vod_id ?? ''),
        provider: provider.id,
        providerName: provider.name,
        name: String(item.vod_name ?? '未命名'),
        pic: String(item.vod_pic ?? ''),
        remarks: String(item.vod_remarks ?? ''),
        year: String(item.vod_year ?? ''),
        type: String(item.type_name ?? item.vod_class ?? ''),
        proxyEnabled: provider.proxyEnabled,
      })).filter((item: any) => item.id && item.name),
    };
  });

  const grouped = new Map<string, any>();
  const errors: any[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push({
        provider: providers[index].name,
        error: result.reason instanceof Error ? result.reason.message : '未知错误',
      });
      return;
    }
    for (const item of result.value.items) {
      const key = keyFor(item.name, item.year);
      const existing = grouped.get(key);
      const source = {
        id: item.id,
        provider: item.provider,
        providerName: item.providerName,
        remarks: item.remarks,
        latency: result.value.latency,
        proxyEnabled: item.proxyEnabled,
      };
      if (existing) {
        existing.sources.push(source);
        if (!existing.pic && item.pic) existing.pic = item.pic;
        if (!existing.type && item.type) existing.type = item.type;
      } else {
        grouped.set(key, { ...item, key, sources: [source] });
      }
    }
  });

  const [tmdbCandidates, douban] = await Promise.all([metadataPromise, doubanPromise]);
  const enriched = [...grouped.values()].map(item => {
    const tmdb = bestTmdbMatch(item.name, item.year, tmdbCandidates);
    const tmdbExact = tmdb && [tmdb.title, tmdb.originalTitle].some(title => title && sameMetadataTitle(title, item.name));
    const doubanMatch = douban && sameMetadataTitle(douban.title, item.name) ? douban : null;
    const metadataYear = (tmdbExact ? tmdb?.year : '') || doubanMatch?.year || '';
    const preferred = [...item.sources].sort((a, b) => a.latency - b.latency)[0];
    return {
      ...item,
      id: preferred.id,
      provider: preferred.provider,
      providerName: preferred.providerName,
      pic: tmdb?.poster || doubanMatch?.poster || item.pic,
      year: metadataYear || item.year || '',
      tmdb,
      douban: doubanMatch,
      sourceCount: item.sources.length,
    };
  });
  const items = backfillSiblingPosters(enriched)
    .sort((a, b) => (b.sourceCount - a.sourceCount) || ((b.tmdb?.popularity || 0) - (a.tmdb?.popularity || 0)));

  const response = ok({ items: items.slice(0, 80), errors, query }, 200, {
    'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
  });
  if (items.length && errors.length < providers.length) context.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
};

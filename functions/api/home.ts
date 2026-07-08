import { ok } from '../_shared/http';
import { getSetting } from '../_shared/db';
import { doubanList, mapTmdb, resolveMetadataSource, tmdb } from '../_shared/metadata';
import type { AppData, Env } from '../_shared/types';

function mapList(payload: any) {
  return (payload?.results || []).filter((x: any) => x.poster_path && (x.title || x.name)).slice(0, 20).map(mapTmdb);
}

async function tmdbSections(env: Env) {
  if (!env.TMDB_BEARER_TOKEN) return [];
  const [trending, movies, tv, animation] = await Promise.all([
    tmdb('/trending/all/day', env, {}, 1800),
    tmdb('/discover/movie', env, { sort_by: 'popularity.desc', include_adult: 'false', page: '1' }, 3600),
    tmdb('/discover/tv', env, { sort_by: 'popularity.desc', include_adult: 'false', page: '1' }, 3600),
    tmdb('/discover/tv', env, { with_genres: '16', sort_by: 'popularity.desc', include_adult: 'false', page: '1' }, 3600),
  ]);
  return [
    { id: 'trending', title: '今日热门', kicker: 'TRENDING', items: mapList(trending) },
    { id: 'movies', title: '热门电影', kicker: 'MOVIES', items: mapList(movies) },
    { id: 'tv', title: '热门剧集', kicker: 'SERIES', items: mapList(tv) },
    { id: 'animation', title: '动画精选', kicker: 'ANIMATION', items: mapList(animation) },
  ].filter(section => section.items.length);
}

async function doubanSections() {
  const [movies, tv, top, animation] = await Promise.all([
    doubanList('movie', '热门', 3600),
    doubanList('tv', '热门', 3600),
    doubanList('movie', '豆瓣高分', 7200),
    doubanList('tv', '日本动画', 7200),
  ]);
  return [
    { id: 'movies', title: '热门电影', kicker: 'MOVIES', items: movies },
    { id: 'tv', title: '热门剧集', kicker: 'SERIES', items: tv },
    { id: 'top', title: '豆瓣高分', kicker: 'RATED', items: top },
    { id: 'animation', title: '动画精选', kicker: 'ANIMATION', items: animation },
  ].filter(section => section.items.length);
}

export const onRequestGet: PagesFunction<Env, any, AppData> = async ({ env }) => {
  const [homeNotice, preference] = await Promise.all([
    getSetting(env, 'home_notice', ''),
    getSetting(env, 'metadata_source', 'auto'),
  ]);
  const source = resolveMetadataSource(preference, env);

  if (source === 'tmdb' && !env.TMDB_BEARER_TOKEN) {
    return ok({ metadataSource: source, sections: [], notice: homeNotice || '已选择 TMDB，但还没有配置 TMDB_BEARER_TOKEN。' }, 200, { 'cache-control': 'public, max-age=60, s-maxage=60' });
  }

  let sections = source === 'tmdb' ? await tmdbSections(env) : await doubanSections();
  let actualSource = source;

  if (!sections.length && preference === 'auto') {
    actualSource = source === 'tmdb' ? 'douban' : 'tmdb';
    sections = actualSource === 'tmdb' ? await tmdbSections(env) : await doubanSections();
  }

  return ok({
    metadataSource: actualSource,
    notice: homeNotice || (!sections.length ? `${actualSource === 'tmdb' ? 'TMDB' : '豆瓣'}数据暂时不可用，可以直接搜索。` : ''),
    sections,
  }, 200, { 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400' });
};

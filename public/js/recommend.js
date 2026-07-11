const KIND_LABELS = {
  movie: '电影',
  tv: '剧集',
  animation: '动画',
  variety: '综艺',
  other: '影视',
};

function text(value = '') {
  return String(value || '').normalize('NFKC').trim();
}

function isPlaceholderTitle(value = '') {
  return /^(?:未命名|未知|无标题|untitled|unknown|n\/?a)$/iu.test(text(value));
}

function titleOf(item) {
  const value = text(item?.name || item?.title || '');
  return value && !isPlaceholderTitle(value) ? value : '';
}

function keyOf(item) {
  return text(item?.key || `${item?.provider || 'item'}:${item?.id || titleOf(item)}`);
}

function kindOf(item) {
  const value = `${item?.mediaType || ''} ${item?.type || ''} ${(item?.tmdb?.genres || item?.genres || []).join(' ')}`.toLowerCase();
  if (/动漫|动画|anime|animation/.test(value)) return 'animation';
  if (/综艺|variety|reality|真人秀/.test(value)) return 'variety';
  if (/电视剧|剧集|连续剧|电视|国产剧|港台剧|日韩剧|欧美剧|series|\btv\b/.test(value)) return 'tv';
  if (/电影|movie|film|片$/.test(value.trim())) return 'movie';
  return 'other';
}

function genreTokens(item) {
  const raw = [
    ...(Array.isArray(item?.genres) ? item.genres : []),
    ...(Array.isArray(item?.tmdb?.genres) ? item.tmdb.genres : []),
    item?.type,
  ].filter(Boolean).join(' ');
  return [...new Set(raw.split(/[\s,/|·、，]+/u)
    .map(token => text(token).toLowerCase())
    .filter(token => token.length >= 2 && token.length <= 12)
    .filter(token => !/^(电影|电视剧|剧集|连续剧|视频|其他|未知)$/u.test(token)))].slice(0, 8);
}

function decadeOf(item) {
  const year = Number(String(item?.year || '').match(/(?:19|20)\d{2}/)?.[0] || 0);
  return year ? `${Math.floor(year / 10) * 10}s` : '';
}

function featuresOf(item) {
  const features = new Set([`kind:${kindOf(item)}`]);
  for (const genre of genreTokens(item)) features.add(`genre:${genre}`);
  const decade = decadeOf(item);
  if (decade) features.add(`decade:${decade}`);
  return features;
}

function completionOf(item) {
  const position = Number(item?.position || 0);
  const duration = Number(item?.duration || 0);
  return duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
}

function normalizedTitle(item) {
  return titleOf(item)
    .toLowerCase()
    .replace(/[\s\-_:：·•.，,()（）\[\]【】'"“”‘’]/gu, '')
    .replace(/第?[一二三四五六七八九十0-9]+季$/u, '');
}

function contentIdentity(item) {
  const tmdbId = text(item?.tmdb?.id || item?.tmdbId || '');
  if (tmdbId) return `tmdb:${tmdbId}`;
  const doubanId = text(item?.douban?.id || item?.doubanId || '');
  if (doubanId) return `douban:${doubanId}`;
  const title = normalizedTitle(item);
  const year = String(item?.year || '').match(/(?:19|20)\d{2}/)?.[0] || '';
  if (title && year) return `title:${title}:${year}:${kindOf(item)}`;
  return '';
}

function sourceAliases(item) {
  const values = new Set();
  const key = keyOf(item);
  if (key) values.add(`key:${key}`);
  if (item?.provider && item?.id) values.add(`source:${item.provider}:${item.id}`);
  for (const source of Array.isArray(item?.sources) ? item.sources : []) {
    if (source?.provider && source?.id) values.add(`source:${source.provider}:${source.id}`);
  }
  const identity = contentIdentity(item);
  if (identity) values.add(identity);
  return [...values];
}

function firstValue(items, selector) {
  for (const item of items) {
    const value = selector(item);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function mergeSources(...groups) {
  const map = new Map();
  for (const source of groups.flatMap(group => Array.isArray(group) ? group : [])) {
    if (!source?.provider || !source?.id) continue;
    const id = `${source.provider}:${source.id}`;
    if (!map.has(id)) map.set(id, source);
  }
  return [...map.values()];
}

function mergeMediaMetadata(playback, catalog) {
  const items = [playback, catalog].filter(Boolean);
  const name = firstValue(items, item => titleOf(item));
  const pic = firstValue(items, item => item?.pic || item?.poster || item?.tmdb?.poster || item?.douban?.poster);
  const backdrop = firstValue(items, item => item?.backdrop || item?.tmdb?.backdrop);
  const sources = mergeSources(playback?.sources, catalog?.sources);
  return {
    ...(catalog || {}),
    ...(playback || {}),
    ...(name ? { name } : {}),
    ...(pic ? { pic, poster: pic } : {}),
    ...(backdrop ? { backdrop } : {}),
    ...(sources.length ? { sources } : {}),
    tmdb: playback?.tmdb || catalog?.tmdb,
    douban: playback?.douban || catalog?.douban,
    year: playback?.year || catalog?.year,
    type: playback?.type || catalog?.type,
    mediaType: playback?.mediaType || catalog?.mediaType,
    rating: playback?.rating || catalog?.rating,
    popularity: playback?.popularity || catalog?.popularity,
    votes: playback?.votes || catalog?.votes,
  };
}

function buildCatalogIndex(items) {
  const index = new Map();
  for (const item of items) {
    for (const alias of sourceAliases(item)) {
      if (!index.has(alias)) index.set(alias, item);
    }
  }
  return index;
}

function hydrateHistory(history, pool) {
  const index = buildCatalogIndex(pool);
  return (history || []).map(item => {
    let match = null;
    for (const alias of sourceAliases(item)) {
      match = index.get(alias);
      if (match) break;
    }
    return match ? mergeMediaMetadata(item, match) : item;
  });
}

function ageWeight(timestamp, halfLifeDays = 45) {
  const value = Number(timestamp || 0);
  if (!value) return 0.45;
  const days = Math.max(0, Date.now() - value) / 864e5;
  return Math.exp(-Math.LN2 * days / halfLifeDays);
}

function addFeatureWeights(profile, item, weight) {
  if (!item || !Number.isFinite(weight) || weight === 0) return;
  for (const feature of featuresOf(item)) profile.set(feature, (profile.get(feature) || 0) + weight);
}

function buildProfile(history, favorites) {
  const profile = new Map();
  const seen = new Set();
  for (const item of favorites || []) {
    for (const alias of sourceAliases(item)) seen.add(alias);
    addFeatureWeights(profile, item, 6.5 * ageWeight(item?.watchedAt || item?.updatedAt, 90));
  }
  for (const item of history || []) {
    for (const alias of sourceAliases(item)) seen.add(alias);
    const completion = completionOf(item);
    const seconds = Number(item?.position || 0);
    const recency = ageWeight(item?.watchedAt, 35);
    let signal = 0;
    if (completion >= 0.82) signal = 5.5;
    else if (completion >= 0.35) signal = 3.8;
    else if (seconds >= 900) signal = 2.4;
    else if (seconds >= 240) signal = 1.1;
    else if (seconds >= 45 && completion < 0.08) signal = -1.8;
    addFeatureWeights(profile, item, signal * recency);
  }
  return { profile, seen };
}

function hash32(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dailyNoise(key) {
  const date = new Date();
  const day = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  return (hash32(`${day}:${key}`) % 1000) / 1000;
}

function qualityScore(item) {
  const rating = Number(item?.rating || item?.tmdb?.rating || item?.douban?.rating || 0);
  const popularity = Number(item?.popularity || item?.tmdb?.popularity || 0);
  const votes = Number(item?.votes || item?.tmdb?.votes || 0);
  return Math.min(4.2, rating * 0.34)
    + Math.min(2.2, Math.log10(Math.max(1, popularity + 1)) * 0.72)
    + Math.min(1.2, Math.log10(Math.max(1, votes + 1)) * 0.22);
}

function affinityScore(item, profile) {
  let score = 0;
  let best = null;
  let bestValue = -Infinity;
  for (const feature of featuresOf(item)) {
    const value = Number(profile.get(feature) || 0);
    score += value;
    if (value > bestValue) { bestValue = value; best = feature; }
  }
  return { score, best, bestValue };
}

function reasonFor(item, affinity) {
  if (affinity?.best?.startsWith('genre:') && affinity.bestValue > 0.8) return `因为你常看${affinity.best.slice(6)}`;
  if (affinity?.best?.startsWith('kind:') && affinity.bestValue > 0.8) return `因为你常看${KIND_LABELS[affinity.best.slice(5)] || '这类内容'}`;
  if (affinity?.best?.startsWith('decade:') && affinity.bestValue > 1.2) return '符合你的年代偏好';
  const rating = Number(item?.rating || item?.tmdb?.rating || item?.douban?.rating || 0);
  if (rating >= 8) return '高分口碑精选';
  return '为你探索的新内容';
}

function overlapRatio(a, b) {
  if (!a?.size || !b?.size) return 0;
  let overlap = 0;
  for (const feature of a) if (b.has(feature)) overlap += 1;
  return overlap / Math.max(1, Math.min(a.size, b.size));
}

function diversify(scored, limit) {
  const selected = [];
  const kindCounts = new Map();
  const decadeCounts = new Map();
  while (selected.length < limit && scored.length) {
    let bestIndex = -1;
    let bestAdjusted = -Infinity;
    for (let index = 0; index < scored.length; index += 1) {
      const candidate = scored[index];
      const kind = kindOf(candidate.item);
      const decade = decadeOf(candidate.item);
      const kindPenalty = Math.max(0, (kindCounts.get(kind) || 0) - 2) * 2.3;
      const decadePenalty = decade ? Math.max(0, (decadeCounts.get(decade) || 0) - 2) * 1.1 : 0;
      const similarityPenalty = selected.reduce((max, chosen) => Math.max(max, overlapRatio(candidate.features, chosen.features)), 0) * 3.4;
      const adjusted = candidate.score - kindPenalty - decadePenalty - similarityPenalty;
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = index; }
    }
    if (bestIndex < 0) break;
    const [chosen] = scored.splice(bestIndex, 1);
    selected.push(chosen);
    const kind = kindOf(chosen.item);
    const decade = decadeOf(chosen.item);
    kindCounts.set(kind, (kindCounts.get(kind) || 0) + 1);
    if (decade) decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
  }
  return selected;
}

function candidatePool(sections) {
  const map = new Map();
  for (const section of sections || []) {
    for (const item of section?.items || []) {
      const identity = contentIdentity(item) || keyOf(item);
      if (!identity || map.has(identity)) continue;
      map.set(identity, item);
    }
  }
  return [...map.values()];
}

function mergeDuplicateHistory(existing, incoming) {
  const latest = Number(existing?.watchedAt || 0) >= Number(incoming?.watchedAt || 0) ? existing : incoming;
  const older = latest === existing ? incoming : existing;
  return mergeMediaMetadata(latest, older);
}

function continueWatching(history, limit = 14) {
  const deduped = new Map();
  const sorted = [...(history || [])].sort((a, b) => Number(b?.watchedAt || 0) - Number(a?.watchedAt || 0));
  for (const item of sorted) {
    const duration = Number(item?.duration || 0);
    const position = Number(item?.position || 0);
    const ratio = completionOf(item);
    const title = titleOf(item);
    if (!keyOf(item) || !title || position < 45 || duration < 180 || ratio >= 0.94) continue;
    const identity = contentIdentity(item) || keyOf(item);
    if (deduped.has(identity)) deduped.set(identity, mergeDuplicateHistory(deduped.get(identity), item));
    else deduped.set(identity, item);
  }
  return [...deduped.values()]
    .sort((a, b) => Number(b?.watchedAt || 0) - Number(a?.watchedAt || 0))
    .slice(0, limit)
    .map(item => ({
      ...item,
      _progress: completionOf(item),
      _recommendReason: item?.episodeName ? `继续 ${item.episodeName}` : '从上次位置继续',
    }));
}

function overlapsAliases(item, aliases) {
  return sourceAliases(item).some(alias => aliases.has(alias));
}

export function buildPersonalizedHome(sections, history = [], favorites = [], options = {}) {
  const baseSections = Array.isArray(sections) ? sections.filter(section => Array.isArray(section?.items)) : [];
  if (options.enabled === false) return baseSections;
  const output = [];
  const pool = candidatePool(baseSections);
  const hydratedHistory = hydrateHistory(history, pool);
  const resume = continueWatching(hydratedHistory, options.continueLimit || 14);
  if (resume.length) output.push({ id: 'continue', title: '继续观看', kicker: 'CONTINUE', personalized: true, items: resume });

  const activeResumeAliases = new Set(resume.flatMap(sourceAliases));
  const { profile, seen } = buildProfile(hydratedHistory, favorites);
  const completedAliases = new Set(
    hydratedHistory.filter(item => completionOf(item) >= 0.9).flatMap(sourceAliases),
  );
  const scored = [];
  for (const item of pool) {
    const key = keyOf(item);
    if (!key || overlapsAliases(item, completedAliases) || overlapsAliases(item, activeResumeAliases)) continue;
    const affinity = affinityScore(item, profile);
    const seenPenalty = overlapsAliases(item, seen) ? 3.4 : 0;
    const exploration = profile.size ? 0 : 1.8;
    const score = qualityScore(item)
      + affinity.score * 0.72
      + exploration
      + dailyNoise(contentIdentity(item) || key) * 1.2
      - seenPenalty;
    scored.push({ item, score, affinity, features: featuresOf(item) });
  }
  scored.sort((a, b) => b.score - a.score);
  const recommended = diversify(scored, options.recommendLimit || 18).map(entry => ({
    ...entry.item,
    _recommendReason: reasonFor(entry.item, entry.affinity),
    _recommendScore: Math.round(entry.score * 10) / 10,
  }));
  if (recommended.length >= 6) output.push({ id: 'for-you', title: '为你推荐', kicker: 'FOR YOU', personalized: true, items: recommended });

  return [...output, ...baseSections];
}

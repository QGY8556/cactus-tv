import { ok } from '../../_shared/http';
import {
  getStreamflowGeneration,
  readStreamflowStatus,
  STREAMFLOW_CACHE_TTL_SECONDS,
  STREAMFLOW_MAX_PREFETCH_OBJECTS,
  STREAMFLOW_MIN_AHEAD_SECONDS,
  streamflowReady,
  validStreamflowId,
} from '../../_shared/streamflow';
import type { AppData, Env } from '../../_shared/types';

export const onRequestGet: PagesFunction<Env, any, AppData> = async ({ request, env }) => {
  const ready = streamflowReady();
  const generation = await getStreamflowGeneration(env);
  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').toLowerCase();
  const session = ready && validStreamflowId(id)
    ? await readStreamflowStatus(url.origin, id, generation)
    : null;

  return ok({
    ready,
    engine: 'cache-api',
    generation,
    ttlSeconds: STREAMFLOW_CACHE_TTL_SECONDS,
    maxPrefetchObjectsPerBatch: STREAMFLOW_MAX_PREFETCH_OBJECTS,
    minimumAheadSeconds: STREAMFLOW_MIN_AHEAD_SECONDS,
    capacityKnown: false,
    localToDataCenter: true,
    persistent: false,
    session,
  });
};

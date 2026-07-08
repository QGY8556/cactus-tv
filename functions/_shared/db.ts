import { HttpError } from './http';
import type { Env } from './types';

const SETTING_TTL = 20_000;
const settingCache = new Map<string, { value: string; expires: number }>();
let settingsCache: { value: Record<string, string>; expires: number } | null = null;

export function requireDb(env: Env): D1Database {
  if (!env.DB) throw new HttpError(503, 'D1 数据库尚未绑定，请完成部署配置', 'DB_NOT_CONFIGURED');
  return env.DB;
}

export async function getSetting(env: Env, key: string, fallback = ''): Promise<string> {
  if (!env.DB) return fallback;
  const cached = settingCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
    const value = row?.value ?? fallback;
    settingCache.set(key, { value, expires: Date.now() + SETTING_TTL });
    return value;
  } catch {
    return fallback;
  }
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  const db = requireDb(env);
  await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(key, value).run();
  settingCache.set(key, { value, expires: Date.now() + SETTING_TTL });
  settingsCache = null;
}

export async function getSettings(env: Env): Promise<Record<string, string>> {
  if (!env.DB) return {};
  if (settingsCache && settingsCache.expires > Date.now()) return { ...settingsCache.value };
  const result = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const value = Object.fromEntries((result.results || []).map(row => [row.key, row.value]));
  settingsCache = { value, expires: Date.now() + SETTING_TTL };
  for (const [key, entry] of Object.entries(value)) settingCache.set(key, { value: entry, expires: Date.now() + SETTING_TTL });
  return { ...value };
}

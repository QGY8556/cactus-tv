const KEYS = { favorites: 'cactus:favorites:v2', history: 'cactus:history:v2', settings: 'cactus:settings:v2' };
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
export const store = {
  favorites() { return read(KEYS.favorites, []); },
  replaceFavorites(list) { write(KEYS.favorites, list || []); },
  isFavorite(key) { return this.favorites().some(item => item.key === key); },
  setFavorite(item, active) { const list = this.favorites().filter(x => x.key !== item.key); if (active) list.unshift(item); write(KEYS.favorites, list.slice(0, 300)); return active; },
  toggleFavorite(item) { return this.setFavorite(item, !this.isFavorite(item.key)); },
  history() { return read(KEYS.history, []); },
  replaceHistory(list) { write(KEYS.history, list || []); },
  addHistory(item) { const list = this.history().filter(entry => entry.key !== item.key); list.unshift({ ...item, watchedAt: Date.now() }); write(KEYS.history, list.slice(0, 200)); },
  updateProgress(key, position, duration) { const list = this.history(); const item = list.find(x => x.key === key); if (item) { item.position = position; item.duration = duration; item.watchedAt = Date.now(); write(KEYS.history, list); } },
  progress(key) { return this.history().find(item => item.key === key) || null; },
  settings() { return { recordHistory: true, preferNativeHls: true, resumePlayback: true, ...read(KEYS.settings, {}) }; },
  saveSettings(settings) { write(KEYS.settings, settings); }
};

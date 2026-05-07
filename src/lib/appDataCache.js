/**
 * Lightweight in-memory cache for static/reference data.
 * TTL: 3 minutes. Invalidated explicitly after edits to workers/settings/templates.
 */

const CACHE_TTL_MS = 3 * 60 * 1000;

const cache = {};

function isFresh(key) {
  const entry = cache[key];
  return entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

function set(key, value) {
  cache[key] = { value, ts: Date.now() };
}

function get(key) {
  return isFresh(key) ? cache[key].value : null;
}

function invalidate(...keys) {
  keys.forEach(k => { delete cache[k]; });
}

function invalidateAll() {
  Object.keys(cache).forEach(k => { delete cache[k]; });
}

// ── Cached loaders ────────────────────────────────────────────────────────────
// Each loader checks the cache first; only hits the API on miss or TTL expiry.

export async function getCachedWorkers(entities) {
  const cached = get('workers');
  if (cached) return cached;
  const data = await entities.Worker.filter({ active: true });
  set('workers', data);
  return data;
}

export async function getCachedTemplates(entities) {
  const cached = get('templates');
  if (cached) return cached;
  const data = await entities.Template.filter({ active: true });
  set('templates', data);
  return data;
}

export async function getCachedAllSettings(entities) {
  const cached = get('allSettings');
  if (cached) return cached;
  const data = await entities.AppSettings.list();
  set('allSettings', data);
  return data;
}

/**
 * Returns a single parsed setting value from the cached settings list.
 * @param {Array} allSettings - the full settings list
 * @param {string} key - setting_key to find
 * @param {*} defaultValue - value to return if not found
 */
export function parseSetting(allSettings, key, defaultValue = null) {
  const s = allSettings.find(s => s.setting_key === key);
  if (!s) return defaultValue;
  try { return JSON.parse(s.setting_value); } catch { return defaultValue; }
}

/**
 * Invalidate reference data caches after edits.
 * Call this after saving Workers, Templates, or AppSettings.
 */
export function invalidateStaticCache(...keys) {
  if (keys.length === 0) {
    invalidate('workers', 'templates', 'allSettings');
  } else {
    invalidate(...keys);
  }
}

export function invalidateSettingsCache() {
  invalidate('allSettings');
}

export function invalidateWorkersCache() {
  invalidate('workers');
}

export function invalidateTemplatesCache() {
  invalidate('templates');
}
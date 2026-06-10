/**
 * Lightweight in-memory cache for static/reference data.
 * TTL: 3 minutes. Invalidated explicitly after edits to workers/settings/templates.
 */

const CACHE_TTL_MS = 3 * 60 * 1000;

const cache = {};
// Tracks in-flight promises to deduplicate concurrent requests for the same key
const pending = {};

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

async function fetchWithRetry(fn, retries = 6, baseDelay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      const isRateLimit = e?.message?.includes('Rate limit') || e?.message?.includes('rate limit');
      if (isRateLimit && i < retries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      } else if (isRateLimit) {
        console.warn('Cache fetchWithRetry: rate limit exhausted for key, returning []');
        return [];
      } else {
        throw e;
      }
    }
  }
}

async function cachedFetch(key, fetcher) {
  const cached = get(key);
  if (cached) return cached;
  // If already in-flight, return the same promise
  if (pending[key]) return pending[key];
  pending[key] = fetchWithRetry(fetcher).then(data => {
    set(key, data);
    delete pending[key];
    return data;
  }).catch(err => {
    delete pending[key];
    throw err;
  });
  return pending[key];
}

export async function getCachedWorkers(entities) {
  return cachedFetch('workers', () => entities.Worker.filter({ active: true }));
}

export async function getCachedAllWorkers(entities) {
  return cachedFetch('allWorkers', () => entities.Worker.list("-created_date"));
}

export async function getCachedTemplates(entities) {
  return cachedFetch('templates', () => entities.Template.filter({ active: true }));
}

export async function getCachedAllSettings(entities) {
  return cachedFetch('allSettings', () => entities.AppSettings.list());
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
 * Parse a list setting (worker_roles, worker_populations, shift_statuses) and
 * return an array of plain name strings — works whether items are strings or
 * the new { name, mapping_id, ... } object format.
 */
export function parseListSetting(allSettings, key, defaultValue = []) {
  const raw = parseSetting(allSettings, key, null);
  if (!raw) return defaultValue;
  return raw.map(item => (typeof item === "string" ? item : item.name));
}

/**
 * Invalidate reference data caches after edits.
 * Call this after saving Workers, Templates, or AppSettings.
 */
export function invalidateStaticCache(...keys) {
  if (keys.length === 0) {
    invalidate('workers', 'allWorkers', 'templates', 'allSettings');
  } else {
    invalidate(...keys);
  }
}

export function invalidateSettingsCache() {
  invalidate('allSettings');
}

export function invalidateWorkersCache() {
  invalidate('workers', 'allWorkers');
}

export function invalidateTemplatesCache() {
  invalidate('templates');
}
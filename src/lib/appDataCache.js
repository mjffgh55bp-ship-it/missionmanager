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

function isTransient(e) {
  const msg = String(e?.message || e || '').toLowerCase();
  const status = e?.status || e?.response?.status || e?.statusCode;
  return (
    msg.includes('rate limit') || msg.includes('429') ||
    msg.includes('timeout') || msg.includes('timed out') ||
    msg.includes('network') || msg.includes('failed to fetch') ||
    msg.includes('econn') || msg.includes('fetch failed') ||
    status === 429 || status === 500 || status === 502 ||
    status === 503 || status === 504
  );
}

export async function fetchWithRetry(fn, retries = 6, baseDelay = 700) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1 && isTransient(e)) {
        // exponential backoff + small jitter so concurrent retries don't sync up
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 200;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      // Non-transient, or out of retries
      if (isTransient(e)) {
        const err = new Error('TRANSIENT_EXHAUSTED');
        err.transientExhausted = true;
        throw err;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function cachedFetch(key, fetcher) {
  const fresh = get(key);              // fresh (within TTL)
  if (fresh) return fresh;
  if (pending[key]) return pending[key];
  pending[key] = fetchWithRetry(fetcher).then(data => {
    set(key, data);                    // cache ONLY on success
    delete pending[key];
    return data;
  }).catch(err => {
    delete pending[key];
    // Do NOT cache the failure. Fall back to last known value if we ever had one.
    const lastKnown = cache[key]?.value;  // ignores TTL on purpose — stale data beats blank
    if (lastKnown !== undefined) return lastKnown;
    return [];  // nothing cached yet → empty is safer than crashing
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
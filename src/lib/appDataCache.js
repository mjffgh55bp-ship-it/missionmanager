/**
 * Lightweight in-memory cache for static/reference data.
 * TTL: 3 minutes. Invalidated explicitly after edits to workers/settings/templates.
 */

const CACHE_TTL_MS = 3 * 60 * 1000;
const SOFT_TTL_MS = 10 * 1000;   // serve instantly; refresh in background past this
// CACHE_TTL_MS stays the hard limit (3 min): older than this = block & refetch

const cache = {};
// Tracks in-flight promises to deduplicate concurrent requests for the same key
const pending = {};

function isFresh(key) {
  const entry = cache[key];
  return entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

function set(key, value, ttl = CACHE_TTL_MS) {
  cache[key] = { value, ts: Date.now(), ttl };
}

function get(key, ttl = CACHE_TTL_MS) {
  const entry = cache[key];
  if (!entry) return null;
  return (Date.now() - entry.ts < ttl) ? entry.value : null;
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

async function cachedFetch(key, fetcher, ttl = CACHE_TTL_MS) {
  const entry = cache[key];
  const age = entry ? Date.now() - entry.ts : Infinity;

  // Fresh enough to serve instantly (have a value within the HARD ttl)
  if (entry && entry.value !== undefined && age < ttl) {
    // Past the soft window → refresh in the background (don't block navigation)
    if (age >= SOFT_TTL_MS && !pending[key]) {
      pending[key] = fetchWithRetry(fetcher).then(data => {
        set(key, data, ttl);
        delete pending[key];
        return data;
      }).catch(err => {
        delete pending[key];
        // background refresh failed → keep serving the existing value, don't throw
        return entry.value;
      });
    }
    return entry.value;   // instant
  }

  // No usable value (cold, or past hard ttl) → must fetch; dedupe concurrent callers
  if (pending[key]) return pending[key];
  pending[key] = fetchWithRetry(fetcher).then(data => {
    set(key, data, ttl);
    delete pending[key];
    return data;
  }).catch(err => {
    delete pending[key];
    const lastKnown = cache[key]?.value;
    if (lastKnown !== undefined) {
      // stale beats blank — return expired value, refresh will retry next access
      return lastKnown;
    }
    // No stale value either. Return empty array (most common type) instead of
    // crashing the page — the cache will self-heal on the next access after the
    // transient issue resolves.
    console.warn(`cachedFetch "${key}": all retries exhausted, returning empty fallback`);
    return [];
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

// ── Soft invalidation (SWR) ─────────────────────────────────────────────────

// Mark entries stale WITHOUT deleting them: next read serves instantly + refreshes in background.
function markStale(...keys) {
  keys.forEach(k => {
    const entry = cache[k];
    if (entry) entry.ts = Date.now() - SOFT_TTL_MS - 1; // older than soft window, within hard ttl
  });
}

export function softInvalidateStaticCache() {
  markStale('workers', 'allWorkers', 'templates', 'allSettings');
}

// Toggle a week's published state. Returns the updated array. De-dupes AppSettings rows.
export async function toggleWeekPublished(entities, weekStartStr, published) {
  let rows = [];
  try {
    rows = await entities.AppSettings.filter({ setting_key: "published_weeks" });
  } catch (e) {
    console.error("published_weeks: read failed", e);
    throw new Error("read_failed");
  }

  let weeks = [];
  if (rows && rows.length > 0) {
    try { weeks = JSON.parse(rows[0].setting_value || "[]") || []; } catch { weeks = []; }
  }
  weeks = weeks.filter(w => w !== weekStartStr);     // remove if present
  if (published) weeks.push(weekStartStr);            // add if turning on
  const value = JSON.stringify(weeks);

  try {
    if (rows && rows.length > 0) {
      await entities.AppSettings.update(rows[0].id, { setting_value: value });
    } else {
      await entities.AppSettings.create({ setting_key: "published_weeks", setting_value: value });
    }
  } catch (e) {
    console.error("published_weeks: write failed", e);
    throw new Error("write_failed");
  }

  // De-dupe is best-effort ONLY — never let it fail the whole operation
  if (rows && rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      try { await entities.AppSettings.delete(rows[i].id); } catch (e) { console.warn("published_weeks: dedupe delete skipped", e); }
    }
  }
  invalidateSettingsCache(); // workers must see the updated list immediately
  return weeks;
}
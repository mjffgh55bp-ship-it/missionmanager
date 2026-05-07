// =============================================================
// Data Transfer Schema — structured round-trip-safe architecture
// Version 2.0
//
// Internal value key rules (derived from Schedule.jsx):
//   col.type === "task"   → internal key is always "task"
//   col.type === "time"   → internal key is col.name (e.g. "התחלה", "סיום")
//   col.type === "worker" → internal key is col.name
//   col.type === "text"   → internal key is col.name
//   col.type === "select" → internal key is col.name
//   status column         → internal key is "status"
//
// ColumnCell (custom params) stores:
//   values[col.name]           → main value (string or JSON)
//   values[col.name_subTypes]  → array of selected sub-types
// =============================================================

export const EXPORT_VERSION = "2.0";
export const EXPORT_SOURCE_NAME = "מערכת ניהול כוח אדם";

// ── Sheet names ────────────────────────────────────────────────────────────────
export const SHEET_MANIFEST           = "Manifest";
export const SHEET_MOKED_TEMPLATES    = "MokedTemplates";
export const SHEET_MOKED_COLUMNS      = "MokedColumns";
export const SHEET_MOKED_ROWS         = "MokedRows";
export const SHEET_MOKED_VALUES       = "MokedValues";
export const SHEET_WORKERS_MAP        = "WorkersMap";
export const SHEET_HUMAN_READABLE     = "HumanReadableSchedule";
export const SHEET_IMPORT_DIAGNOSTICS = "ImportDiagnostics";

// ── Availability sheet names ───────────────────────────────────────────────────
export const SHEET_AVAIL_SUBMISSIONS  = "AvailabilitySubmissions";
export const SHEET_AVAIL_WINDOWS      = "AvailabilityWindows";
export const SHEET_UNAVAIL_WINDOWS    = "UnavailabilityWindows";

// ── Legacy sheet names (for backward compat detection) ────────────────────────
export const LEGACY_SCHEDULE_SHEET = "לוח משמרות";
export const LEGACY_AVAIL_SHEET    = "זמינות";

// ── Internal-value-key resolver ───────────────────────────────────────────────
// Given a Template column definition, returns the actual key used in TemplateRow.values
export function getInternalValueKey(col) {
  if (!col) return null;
  if (col.type === "task") return "task";
  // time, worker, text, select, and custom all use col.name as key
  return col.name;
}

// ── Well-known worker column names ────────────────────────────────────────────
export const KNOWN_WORKER_COL_NAMES = new Set([
  "שף", "סו-שף", "סו־שף", "מנהל", 'מנל"ח', "מנל״ח", "עובד",
]);

// ── Normalize a string for matching ───────────────────────────────────────────
// Handles: trim, lowercase, Hebrew maqaf ↔ ASCII hyphen, gershayim normalization
export function normalizeForMatch(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[־–—]/g, "-")    // maqaf and dashes → ASCII hyphen
    .replace(/״|"/g, '"')      // normalize gershayim
    .replace(/׳|'/g, "'");     // normalize geresh
}

// ── Column alias map: normalized raw header → canonical Hebrew display name ──
// Used when matching XLSX headers to known internal column concepts
export const COLUMN_ALIAS_MAP = {
  "task":    "task",      // task type internal key
  "status":  "status",
  "start":   "התחלה",
  "end":     "סיום",
  "briefing": "תדריך",
};

// ── Check if a column is a worker column ─────────────────────────────────────
export function isKnownWorkerCol(colName) {
  const n = normalizeForMatch(colName);
  for (const known of KNOWN_WORKER_COL_NAMES) {
    if (normalizeForMatch(known) === n) return true;
  }
  return false;
}

// ── Sanitize text to prevent formula injection ────────────────────────────────
export function sanitizeText(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (/^[=+\-@|]/.test(s)) return "'" + s;
  return s;
}

// ── Empty value check ─────────────────────────────────────────────────────────
export function isEmpty(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "None" || s === "none";
}

// ── Serialize for XLSX cell ───────────────────────────────────────────────────
export function serializeForExport(val) {
  if (isEmpty(val)) return "";
  if (typeof val === "object") return sanitizeText(JSON.stringify(val));
  return sanitizeText(String(val));
}

// ── Deserialize from XLSX cell ────────────────────────────────────────────────
export function deserializeFromImport(rawStr) {
  const s = String(rawStr ?? "").trim();
  if (!s || s === "None") return null;
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try { return JSON.parse(s); } catch { /* fall through */ }
  }
  // Strip leading apostrophe (formula injection protection)
  if (s.startsWith("'")) return s.slice(1);
  return s;
}
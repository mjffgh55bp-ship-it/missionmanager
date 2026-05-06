// =============================================================
// Data Transfer Schema — round-trip safe
// Export and import use the exact same field set.
// ALL TemplateRow.values fields are included dynamically.
// Internal fields (starting with _) are NOT exported as data columns,
// EXCEPT _group_id and _order which are needed for row matching.
// =============================================================

export const EXPORT_SOURCE_NAME = "מערכת ניהול כוח אדם";

// Fixed meta-columns that always appear at the start of every exported row
export const SCHEDULE_META_COLS = ["תאריך", "מוקד", "_group_id", "_order"];

// Sheet names
export const SCHEDULE_SHEET = "לוח משמרות";
export const AVAIL_SHEET    = "זמינות";
export const META_SHEET     = "מטא-נתונים";

// Internal keys that must never be exported as data columns
export const INTERNAL_SKIP_KEYS = new Set([
  "is_continuation",
  "continuation_from_date",
  "continuation_source_row_id",
  "status",
  "_order",          // exported separately as a meta col
]);

// Keys whose values are always exported/imported as-is (not treated as worker fields by default)
// Worker fields are detected dynamically from the template definition.

/** Strip a text value from formula-injection attempts */
export function sanitizeText(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (/^[=+\-@|]/.test(s)) return "'" + s;
  return s;
}

/** Is a value considered "empty" for export/import purposes? */
export function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (v === "" || v === "None" || v === "none") return true;
  return false;
}

/** Serialize a value for export to XLSX cell */
export function serializeForExport(val) {
  if (isEmpty(val)) return "";
  if (typeof val === "object") return sanitizeText(JSON.stringify(val));
  return sanitizeText(String(val));
}

/** Deserialize a cell value from XLSX back into the correct type.
 *  JSON strings are parsed back into objects. */
export function deserializeFromImport(rawStr) {
  const s = String(rawStr ?? "").trim();
  if (!s || s === "None") return null;
  // Try to parse JSON objects/arrays
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try { return JSON.parse(s); } catch { /* fall through */ }
  }
  return s;
}

/** Validate a parsed schedule row (before applying to DB).
 *  Returns array of error strings (empty = valid). */
export function validateScheduleRow(row) {
  const errors = [];
  if (!row["תאריך"] || !/^\d{4}-\d{2}-\d{2}$/.test(row["תאריך"])) {
    errors.push("תאריך חסר או בפורמט שגוי (נדרש YYYY-MM-DD)");
  }
  if (!row["מוקד"]) {
    errors.push("שם מוקד חסר");
  }
  return errors;
}

/** Validate a parsed availability row. Returns array of error strings. */
export function validateAvailRow(row) {
  const errors = [];
  if (!row["מזהה עובד"]) errors.push("מזהה עובד חסר");
  if (!row["תאריך משמרת"] || !/^\d{4}-\d{2}-\d{2}$/.test(row["תאריך משמרת"])) {
    errors.push("תאריך משמרת חסר או בפורמט שגוי");
  }
  return errors;
}
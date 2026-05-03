// =============================================================
// APPROVED SCHEMA — only these fields are exported / imported.
// Any field NOT listed here is stripped silently.
// DO NOT add fields here unless explicitly approved.
// =============================================================

export const EXPORT_SOURCE_NAME = "מערכת ניהול כוח אדם";

// Approved fields for Assignment rows
export const ASSIGNMENT_SCHEMA = {
  employee_id:   { col: "A", label: "מזהה עובד",      required: true,  type: "string" },
  employee_name: { col: "B", label: "שם עובד",        required: false, type: "string" },
  date:          { col: "C", label: "תאריך",          required: true,  type: "date" },
  start_time:    { col: "D", label: "שעת התחלה",      required: true,  type: "time" },
  end_time:      { col: "E", label: "שעת סיום",       required: true,  type: "time" },
  hours:         { col: "F", label: "שעות",           required: false, type: "number" },
  role:          { col: "G", label: "תפקיד",          required: false, type: "string" },
  status:        { col: "H", label: "סטטוס",          required: false, type: "string" },
  notes:         { col: "I", label: "הערות",          required: false, type: "string" },
};

// Approved fields for Availability rows
export const AVAILABILITY_SCHEMA = {
  employee_id:   { col: "A", label: "מזהה עובד",      required: true,  type: "string" },
  employee_name: { col: "B", label: "שם עובד",        required: false, type: "string" },
  week_start:    { col: "C", label: "שבוע (יום ראשון)",required: true, type: "date" },
  date:          { col: "D", label: "תאריך משמרת",    required: true,  type: "date" },
  start_time:    { col: "E", label: "שעת התחלה",      required: true,  type: "time" },
  end_time:      { col: "F", label: "שעת סיום",       required: true,  type: "time" },
  shift_type:    { col: "G", label: "סוג זמינות",     required: false, type: "string" }, // wanted/available/unavailable
  status:        { col: "H", label: "סטטוס הגשה",    required: false, type: "string" },
};

export const SHEET_ASSIGNMENTS  = "משמרות";
export const SHEET_AVAILABILITY = "זמינות";
export const SHEET_META         = "מטא-נתונים";

/** Strip a text value from formula-injection attempts */
export function sanitizeText(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  // Prevent Excel formula injection
  if (/^[=+\-@|]/.test(s)) return "'" + s;
  return s;
}

/** Pick only approved fields from an object, sanitize strings */
export function stripToSchema(obj, schema) {
  const result = {};
  for (const [key, def] of Object.entries(schema)) {
    if (key in obj) {
      const raw = obj[key];
      result[key] = def.type === "string" ? sanitizeText(raw) : raw;
    }
  }
  return result;
}

/** Validate a row against a schema; returns array of error strings */
export function validateRow(row, schema) {
  const errors = [];
  for (const [key, def] of Object.entries(schema)) {
    if (def.required && (row[key] === undefined || row[key] === null || row[key] === "")) {
      errors.push(`שדה חובה חסר: ${def.label}`);
    }
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      if (def.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(row[key]))) {
        errors.push(`פורמט תאריך שגוי בשדה "${def.label}" (נדרש YYYY-MM-DD)`);
      }
      if (def.type === "time" && !/^\d{2}:\d{2}$/.test(String(row[key]))) {
        errors.push(`פורמט שעה שגוי בשדה "${def.label}" (נדרש HH:MM)`);
      }
    }
  }
  return errors;
}
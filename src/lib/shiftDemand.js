/**
 * shiftDemand.js
 * Computes unified shift demand from TemplateRows + Templates,
 * counts signups from all Availability records, and calculates status.
 *
 * Operational day rule: 06:00 → next-day 06:00.
 * row.date is always the OPERATIONAL date (the Schedule day).
 * Do NOT convert after-midnight times to the next calendar day for grouping.
 */

import { isVisibleScheduleTemplate } from "@/lib/scheduleVisibility";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the operational date from a shift entry.
 * New records have operational_date; old records fall back to date.
 */
function getShiftOperationalDate(shift) {
  return shift.operational_date || shift.date;
}

// ── 1. Build unified shift demand from TemplateRows ───────────────────────────
// Returns Map: unifiedKey → { key, date, operational_date, mokedName, startTime, endTime, roles: { roleName: count } }
export function buildUnifiedShiftDemand(templateRows, templates) {
  const templateById = {};
  templates.forEach(t => { templateById[t.id] = t; });

  const map = new Map(); // key → unified shift

  // Returns true for zero-duration continuation rows (06:00→06:00) — must be ignored
  const isInvalidContinuationRow = (row) => {
    if (!row?.values?.is_continuation) return false;
    const start = row.values["התחלה"] || row.values["שעת התחלה"];
    const end   = row.values["סיום"]  || row.values["שעת סיום"];
    return start === "06:00" && end === "06:00" && !!row.values.continuation_source_row_id;
  };

  templateRows.forEach(row => {
    const tmpl = templateById[row.template_id];
    // Skip rows whose template is missing or not visible in the Schedule calendar
    if (!tmpl || !isVisibleScheduleTemplate(tmpl) || !row.values) return;
    // Skip invalid zero-duration continuation rows
    if (isInvalidContinuationRow(row)) return;

    const values = row.values;
    const startTime = values["התחלה"] || values["שעת התחלה"];
    const endTime   = values["סיום"]  || values["שעת סיום"];
    if (!startTime || !endTime || !row.date) return;

    // Always use row.date as the operational date for grouping.
    const operationalDate = row.date;
    const mokedName = tmpl.name || row.template_name || "";
    const key = `${operationalDate}|${mokedName}|${startTime}|${endTime}`;

    console.log("OPERATIONAL AVAILABILITY DEBUG", {
      rowId: row.id,
      rowDate: row.date,
      startTime,
      endTime,
      operationalDate,
      demandKey: key
    });

    if (!map.has(key)) {
      map.set(key, { key, date: operationalDate, operational_date: operationalDate, mokedName, startTime, endTime, roles: {} });
    }
    const unified = map.get(key);

    // Find worker-type columns and count one slot per column per row
    const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
    workerCols.forEach(col => {
      const roleName = col.name;
      unified.roles[roleName] = (unified.roles[roleName] || 0) + 1;
    });
  });

  return map;
}

// ── 2. Count signups per unified shift + role ─────────────────────────────────
// availabilities: all Availability records for the week
// workers: all Worker records
// unifiedShift: one entry from buildUnifiedShiftDemand
// roleName: the specific role to count for
export function getSignupsForRole(availabilities, workers, unifiedShift, roleName) {
  const operationalDate = unifiedShift.operational_date || unifiedShift.date;
  const { startTime, endTime } = unifiedShift;

  // Build a set of worker IDs that have the required role
  const eligibleWorkerIds = new Set(
    workers.filter(w => Array.isArray(w.role) ? w.role.includes(roleName) : w.role === roleName)
           .map(w => w.id)
  );

  const signedWorkerIds = new Set();

  availabilities.forEach(avail => {
    if (!eligibleWorkerIds.has(avail.worker_id)) return;
    const shifts = avail.shifts || [];
    const hasMatch = shifts.some(s =>
      getShiftOperationalDate(s) === operationalDate &&
      s.start_time === startTime &&
      s.end_time === endTime &&
      (s.type === "wanted" || s.type === "available")
    );
    if (hasMatch) signedWorkerIds.add(avail.worker_id);
  });

  return signedWorkerIds.size;
}

// ── 3. Calculate status for a role slot ──────────────────────────────────────
// signupMode: "limit_sign_up" | "allow_over_sign_up"
export function calculateRoleStatus(required, signed, signupMode) {
  const available = Math.max(0, required - signed);
  const fullnessPct = required > 0 ? Math.min(100, Math.round((signed / required) * 100)) : 0;
  const isOver = signed > required;
  const isFull = signed >= required;
  const chance = signed === 0 ? 100 : isFull ? Math.round((required / signed) * 100) : 100;

  let statusLabel;
  if (isOver)          statusLabel = "הרשמה עודפת";
  else if (isFull)     statusLabel = "מלא";
  else if (fullnessPct >= 70) statusLabel = "כמעט מלא";
  else                 statusLabel = "פתוח";

  const blocked = signupMode === "limit_sign_up" && isFull;

  return { available, fullnessPct, isOver, isFull, chance, statusLabel, blocked };
}

// ── 4. Check if current worker already signed up for a unified shift slot ─────
export function workerSignedForShift(selectedShifts, unifiedShift) {
  const operationalDate = unifiedShift.operational_date || unifiedShift.date;
  const { startTime, endTime } = unifiedShift;
  return selectedShifts.some(s =>
    getShiftOperationalDate(s) === operationalDate &&
    s.start_time === startTime &&
    s.end_time === endTime &&
    (s.type === "wanted" || s.type === "available")
  );
}

// ── 5. Filter unified shifts to the current week ──────────────────────────────
export function filterDemandForWeek(demandMap, weekStart) {
  const results = [];
  const weekDates = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDates.add(d.toISOString().slice(0, 10));
  }
  demandMap.forEach(shift => {
    if (weekDates.has(shift.date)) results.push(shift);
  });
  return results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}
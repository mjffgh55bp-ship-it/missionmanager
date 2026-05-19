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

// ── Signup key helpers ────────────────────────────────────────────────────────

/**
 * Normalize a moked name for key building:
 * - trim whitespace
 * - collapse multiple spaces to one
 * - preserve numbers and all suffixes (1, 2, etc.)
 */
function normalizeMokedName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Build the shared moked key.
 *
 * Key rule (in priority order):
 * 1. Explicit signup_group_id / registration_group_id on template or row →
 *    intentional cross-template merge: `group:<id>`
 * 2. Default: exact normalized moked display name →
 *    `name:<normalizedName>`
 *
 * This means:
 * - "מוקד מלא 1" and "מוקד מלא 1" (same name, different template instances)
 *   → same key → shared capacity pool
 * - "מוקד מלא 1" and "מוקד מלא 2" (different names, same time)
 *   → different keys → separate pools, never cross-affect each other
 */
export function buildSharedMokedKey(template, row) {
  // Explicit cross-template group override
  const explicit =
    row?.values?.signup_group_id ||
    row?.values?.registration_group_id ||
    template?.signup_group_id ||
    template?.registration_group_id;
  if (explicit) return `group:${explicit}`;

  // Default: exact normalized display name
  const name =
    row?.template_name ||
    template?.name ||
    row?.values?.moked_name ||
    row?.values?.["שם מוקד"] ||
    "";
  return `name:${normalizeMokedName(name)}`;
}

/**
 * Build the canonical signup key for a unified shift.
 * Format: `${operational_date}__${sharedMokedKey}__${start_time}__${end_time}`
 */
export function buildSignupKey(operationalDate, sharedMokedKey, startTime, endTime) {
  return `${operationalDate}__${sharedMokedKey}__${startTime}__${endTime}`;
}

// ── Status normalization ──────────────────────────────────────────────────────
export function normalizeSignupType(s) {
  const raw = s.type || s.status || s.preference || s.value;
  if (raw === "wanted" || raw === "רצוי") return "wanted";
  if (raw === "available" || raw === "זמין") return "available";
  if (raw === "unavailable" || raw === "לא זמין") return "unavailable";
  return raw || null;
}

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
    // Pass both template AND row so buildSharedMokedKey can use row-level overrides
    const sharedMokedKey = buildSharedMokedKey(tmpl, row);
    const signupKey = buildSignupKey(operationalDate, sharedMokedKey, startTime, endTime);

    // Use signupKey as the map key so duplicate same-name mokeds are grouped together
    const key = signupKey;

    if (!map.has(key)) {
      map.set(key, {
        key, signupKey, sharedMokedKey,
        date: operationalDate, operational_date: operationalDate,
        mokedName, startTime, endTime,
        roles: {},
        possibleInstances: [],
      });
    }
    const unified = map.get(key);

    // Track possible instances (for manager assignment later)
    unified.possibleInstances.push({
      row_id: row.id,
      template_id: tmpl.id,
      group_id: row.group_id || "default",
      mokedName,
    });

    // Find worker-type columns and count one slot per column per row
    const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
    workerCols.forEach(col => {
      const roleName = col.name;
      unified.roles[roleName] = (unified.roles[roleName] || 0) + 1;
    });

    console.log("UNIFIED SHIFT KEY DEBUG", {
      rowId: row.id,
      templateId: tmpl.id,
      templateName: tmpl.name,
      rowTemplateName: row.template_name,
      mokedName,
      sharedMokedKey,
      signupKey,
      startTime,
      endTime,
      roles: unified.roles,
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

  const { signupKey } = unifiedShift;

  availabilities.forEach(avail => {
    if (!eligibleWorkerIds.has(avail.worker_id)) return;
    const shifts = avail.shifts || [];
    const hasMatch = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      // Match by signupKey (new records — most reliable)
      if (signupKey && s.signupKey) return s.signupKey === signupKey;
      // Legacy: rebuild key from stored sharedMokedKey
      if (signupKey && s.sharedMokedKey) {
        const legacyKey = buildSignupKey(getShiftOperationalDate(s), s.sharedMokedKey, s.start_time, s.end_time);
        return legacyKey === signupKey;
      }
      // Last-resort: only for truly old records with NO moked identity at all.
      // Never use this path if either side has any moked identity.
      const hasMokedIdentity = s.moked_name || s.signupKey || s.sharedMokedKey;
      if (!hasMokedIdentity && signupKey) {
        console.warn("LEGACY DATE_TIME SIGNUP MATCH USED", {
          signupKey,
          shiftDate: getShiftOperationalDate(s),
          shiftStart: s.start_time,
          shiftEnd: s.end_time,
          workerId: avail.worker_id,
        });
        return (
          getShiftOperationalDate(s) === operationalDate &&
          s.start_time === startTime &&
          s.end_time === endTime
        );
      }
      return false;
    });

    console.log("SIGNUP COUNT DEBUG", {
      mokedName: unifiedShift.mokedName,
      signupKey: unifiedShift.signupKey,
      required: Object.values(unifiedShift.roles || {}).reduce((a, b) => a + b, 0),
      workerId: avail.worker_id,
      hasMatch,
      signedCount: hasMatch ? signedWorkerIds.size + 1 : signedWorkerIds.size,
    });
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
  const { signupKey } = unifiedShift;
  return selectedShifts.some(s => {
    const active = s.type === "wanted" || s.type === "available";
    if (!active) return false;
    // Match by signupKey when available (new records)
    if (signupKey && s.signupKey) return s.signupKey === signupKey;
    // Legacy fallback: match by signupKey computed from stored sharedMokedKey/moked_name
    if (signupKey && s.sharedMokedKey) {
      const legacyKey = buildSignupKey(
        getShiftOperationalDate(s),
        s.sharedMokedKey,
        s.start_time,
        s.end_time
      );
      return legacyKey === signupKey;
    }
    // Last-resort fallback: only for truly old records with NO moked identity at all.
    const hasMokedIdentity = s.moked_name || s.signupKey || s.sharedMokedKey;
    if (!hasMokedIdentity) {
      const operationalDate = unifiedShift.operational_date || unifiedShift.date;
      console.warn("LEGACY DATE_TIME SIGNUP MATCH USED (workerSignedForShift)", {
        signupKey,
        shiftDate: getShiftOperationalDate(s),
        shiftStart: s.start_time,
        shiftEnd: s.end_time,
      });
      return (
        getShiftOperationalDate(s) === operationalDate &&
        s.start_time === unifiedShift.startTime &&
        s.end_time === unifiedShift.endTime
      );
    }
    return false;
  });
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
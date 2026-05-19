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

// ── Row validity guard ────────────────────────────────────────────────────────

/**
 * Returns true only for real, visible, scheduled rows that should contribute
 * to availability demand capacity. Excludes hidden, archived, preset, and
 * invalid continuation rows.
 */
function isRealAvailabilityDemandRow(row, tmpl) {
  if (!row || !tmpl || !row.values) return false;
  if (!isVisibleScheduleTemplate(tmpl)) return false;
  if (!row.date) return false;

  const v = row.values;

  // Skip hidden / deleted / archived rows
  if (v.is_hidden || v.hidden || v.deleted || v.archived) return false;

  // Skip preset / template-definition rows (not live schedule rows)
  if (v.is_preset || v.is_template_definition) return false;

  // Must have valid start and end times
  const start = v["התחלה"] || v["שעת התחלה"];
  const end   = v["סיום"]  || v["שעת סיום"];
  if (!start || !end) return false;

  // Skip invalid zero-duration continuation rows (06:00→06:00)
  if (v.is_continuation && start === "06:00" && end === "06:00" && v.continuation_source_row_id) {
    return false;
  }

  return true;
}

/**
 * Single source of truth for the moked display name used in both
 * grouping keys and UI labels.
 */
function getMokedDisplayName(row, tmpl) {
  // tmpl.name is the ONLY authoritative identifier of a moked.
  // It is set by the admin in the template editor and distinguishes
  // "מוקד מלא 1" from "מוקד מלא 2" — never override it with row values.
  // row.template_name is a stale copy made at row-creation time; use only as last resort.
  return (
    tmpl?.name ||
    row?.template_name ||
    ""
  ).trim().replace(/\s+/g, " ");
}

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

  // Default: use the same display name function — single source of truth
  return `name:${normalizeMokedName(getMokedDisplayName(row, template))}`;
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
// Returns Map: unifiedKey → { key, date, operational_date, mokedName, startTime, endTime,
//   requiredCount (unique row instances), eligibleRoles (Set of worker col names), possibleInstances }
export function buildUnifiedShiftDemand(templateRows, templates) {
  const templateById = {};
  templates.forEach(t => { templateById[t.id] = t; });

  const map = new Map(); // signupKey → unified shift

  templateRows.forEach(row => {
    const tmpl = templateById[row.template_id];

    // ── Gate 1: must be a real, visible, valid scheduled row ──
    if (!isRealAvailabilityDemandRow(row, tmpl)) {
      // Only log for rows that have a date (skip truly empty rows)
      if (row.date) {
        const start = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
        const end   = row.values?.["סיום"]  || row.values?.["שעת סיום"];
        console.log("DEMAND ROW SKIPPED", {
          rowId: row.id,
          rowDate: row.date,
          templateId: row.template_id,
          templateName: tmpl?.name,
          reason: !tmpl ? "no_template"
            : !isVisibleScheduleTemplate(tmpl) ? "not_visible"
            : !row.values ? "no_values"
            : row.values.is_hidden || row.values.hidden || row.values.deleted || row.values.archived ? "hidden_archived"
            : row.values.is_preset || row.values.is_template_definition ? "preset_or_definition"
            : !start || !end ? "no_times"
            : "invalid_continuation",
          isContinuation: row.values?.is_continuation,
          startTime: start,
          endTime: end,
        });
      }
      return;
    }

    const values = row.values;
    const startTime = values["התחלה"] || values["שעת התחלה"];
    const endTime   = values["סיום"]  || values["שעת סיום"];
    const operationalDate = row.date;

    // ── Single source of truth for the moked name ──
    const mokedName = getMokedDisplayName(row, tmpl);
    const sharedMokedKey = buildSharedMokedKey(tmpl, row);
    const signupKey = buildSignupKey(operationalDate, sharedMokedKey, startTime, endTime);

    if (!map.has(signupKey)) {
      map.set(signupKey, {
        key: signupKey, signupKey, sharedMokedKey,
        date: operationalDate, operational_date: operationalDate,
        mokedName, startTime, endTime,
        requiredCount: 0,
        eligibleRoles: new Set(),
        possibleInstances: [],
      });
    }
    const unified = map.get(signupKey);

    // ── Gate 2: deduplicate — never count the same row.id twice ──
    const alreadyCounted = unified.possibleInstances.some(i => i.row_id === row.id);
    if (alreadyCounted) {
      console.warn("DEMAND ROW DUPLICATE SKIPPED", {
        rowId: row.id, signupKey, mokedName,
        existingCount: unified.possibleInstances.length,
      });
      return;
    }

    // Collect worker-column names as eligible roles (for hasMyRole check only)
    const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
    workerCols.forEach(col => unified.eligibleRoles.add(col.name));

    unified.possibleInstances.push({
      row_id: row.id,
      template_id: tmpl.id,
      group_id: row.group_id || "default",
      mokedName,
      startTime,
      endTime,
      worker_columns: workerCols.map(c => c.name),
    });

    // requiredCount = unique row instances (recalculate from Set to be safe)
    unified.requiredCount = new Set(unified.possibleInstances.map(i => i.row_id)).size;

    console.log("DEMAND ROW INCLUDED", {
      rowId: row.id,
      rowDate: row.date,
      templateId: row.template_id,
      templateName: tmpl.name,
      rowTemplateName: row.template_name,
      mokedName,
      signupKey,
      sharedMokedKey,
      startTime,
      endTime,
      isContinuation: row.values?.is_continuation,
      continuationSource: row.values?.continuation_source_row_id,
      rowValues: row.values,
      visibleTemplate: isVisibleScheduleTemplate(tmpl),
    });
  });

  // Log final state for each unified shift
  map.forEach(shift => {
    console.log("UNIFIED SHIFT FINAL", {
      mokedName: shift.mokedName,
      signupKey: shift.signupKey,
      requiredCount: shift.requiredCount,
      possibleInstances: shift.possibleInstances.map(i => ({
        row_id: i.row_id,
        template_id: i.template_id,
        group_id: i.group_id,
        mokedName: i.mokedName,
      })),
    });
  });

  return map;
}

// ── 2. Count unique workers signed up (wanted) for a unified shift ────────────
// Counts by signupKey — does NOT multiply by worker-column count.
export function getSignupsForShift(availabilities, unifiedShift) {
  const { signupKey, mokedName, sharedMokedKey } = unifiedShift;
  const operationalDate = unifiedShift.operational_date || unifiedShift.date;
  const { startTime, endTime } = unifiedShift;

  const signedWorkerIds = new Set();

  availabilities.forEach(avail => {
    const shifts = avail.shifts || [];

    // Phase 1: check for an exact moked-keyed match (new-style records)
    const hasKeyedMatch = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      if (s.signupKey) return s.signupKey === signupKey;
      if (s.sharedMokedKey) {
        const legacyKey = buildSignupKey(getShiftOperationalDate(s), s.sharedMokedKey, s.start_time, s.end_time);
        return legacyKey === signupKey;
      }
      return false;
    });

    if (hasKeyedMatch) {
      signedWorkerIds.add(avail.worker_id);
      return;
    }

    // Phase 2: if no keyed entry for THIS moked at this slot, check if this worker
    // has a DIFFERENT moked's keyed entry at the same date+time — if so, the naked
    // entry belongs to that other moked and should NOT count here.
    const hasOtherMokedKeyedEntry = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      const sDate = getShiftOperationalDate(s);
      if (sDate !== operationalDate || s.start_time !== startTime || s.end_time !== endTime) return false;
      // Has a moked identity but it's different from this signupKey
      if (s.signupKey && s.signupKey !== signupKey) return true;
      if (s.sharedMokedKey) {
        const legacyKey = buildSignupKey(sDate, s.sharedMokedKey, s.start_time, s.end_time);
        if (legacyKey !== signupKey) return true;
      }
      return false;
    });

    if (hasOtherMokedKeyedEntry) return; // belongs to another moked

    // Phase 3: naked entry (no moked identity) — counts for ALL mokeds at this slot
    const hasNakedMatch = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      if (s.signupKey || s.sharedMokedKey) return false; // has identity, handled above
      return getShiftOperationalDate(s) === operationalDate &&
        s.start_time === startTime &&
        s.end_time === endTime;
    });
    if (hasNakedMatch) signedWorkerIds.add(avail.worker_id);
  });

  return signedWorkerIds.size;
}

// Keep old name as alias for any callers that still use it
export function getSignupsForRole(availabilities, workers, unifiedShift, roleName) {
  return getSignupsForShift(availabilities, unifiedShift);
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
    // Naked entry: check if it belongs to another moked first
    const hasMokedIdentity = s.signupKey || s.sharedMokedKey;
    if (hasMokedIdentity) return false;
    const operationalDate2 = unifiedShift.operational_date || unifiedShift.date;
    if (getShiftOperationalDate(s) !== operationalDate2 || s.start_time !== unifiedShift.startTime || s.end_time !== unifiedShift.endTime) return false;
    const hasOtherKey = selectedShifts.some(other => {
      if (other === s) return false;
      const oDate = getShiftOperationalDate(other);
      if (oDate !== operationalDate2 || other.start_time !== unifiedShift.startTime || other.end_time !== unifiedShift.endTime) return false;
      if (other.signupKey && other.signupKey !== signupKey) return true;
      if (other.sharedMokedKey) {
        const ok = buildSignupKey(oDate, other.sharedMokedKey, other.start_time, other.end_time);
        if (ok !== signupKey) return true;
      }
      return false;
    });
    return !hasOtherKey;
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
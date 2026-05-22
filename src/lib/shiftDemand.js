/**
 * shiftDemand.js
 * Computes unified shift demand from TemplateRows + Templates.
 *
 * KEY ARCHITECTURE CONCEPTS:
 *
 * 1. Moked Instance = one concrete moked block on Schedule.
 *    Identity: mokedInstanceKey = `${template_id}_${group_id || "default"}`
 *    A single instance can have many TemplateRows (worker columns).
 *
 * 2. Signup Group = what workers sign up to in Availability.
 *    Groups by: same display name + same date + same time.
 *    requiredCount = number of distinct moked INSTANCES in the group.
 *    NOT the number of TemplateRows or worker columns.
 *
 * 3. Signup Key format:
 *    `${operational_date}__name:${mokedDisplayName}__${start_time}__${end_time}`
 */

import { isVisibleScheduleTemplate } from "@/lib/scheduleVisibility";

// ── Moked instance key ────────────────────────────────────────────────────────

/**
 * Returns the unique identity of one concrete moked on the Schedule page.
 * One moked instance = one group_id within one template_id.
 */
function getMokedInstanceKey(row) {
  return `${row.template_id}_${row.group_id || "default"}`;
}

// ── Display name — single source of truth ─────────────────────────────────────

/**
 * Returns the canonical display name for a moked instance.
 *
 * Priority order:
 * 1. row.values.moked_instance_name  — ONLY if moked_instance_name_locked === true
 *    (set exclusively by an explicit user rename action in Schedule)
 * 2. template.name                   — structural identity, always up to date
 * 3. row.values.moked_name           — alternate row-level field
 * 4. row.values["שם מוקד"]           — Hebrew field name fallback
 * 5. row.template_name               — stale copy from row creation (last resort)
 *
 * CRITICAL: moked_instance_name without the _locked flag is IGNORED.
 * A duplicated moked copies moked_instance_name from the source group, but
 * WITHOUT setting _locked. That means the copy correctly falls back to
 * template.name (which IS different for different templates, and the same
 * for same-template duplicates — which is the desired behaviour).
 *
 * This function is used everywhere: Schedule title, signupKey, Matrix tooltip.
 */
export function getMokedDisplayName(row, template) {
  // Only trust moked_instance_name when it was explicitly locked by a rename
  const explicitName = row?.values?.moked_instance_name_locked === true
    ? row?.values?.moked_instance_name
    : null;

  return String(
    explicitName ||
    template?.name ||
    row?.values?.moked_name ||
    row?.values?.["שם מוקד"] ||
    row?.template_name ||
    ""
  ).trim().replace(/\s+/g, " ");
}

// ── Row validity guard ────────────────────────────────────────────────────────

function isRealAvailabilityDemandRow(row, tmpl) {
  if (!row || !tmpl || !row.values) return false;
  if (!isVisibleScheduleTemplate(tmpl)) return false;
  if (!row.date) return false;

  const v = row.values;
  if (v.is_hidden || v.hidden || v.deleted || v.archived) return false;
  if (v.is_preset || v.is_template_definition) return false;

  const start = v["התחלה"] || v["שעת התחלה"];
  const end   = v["סיום"]  || v["שעת סיום"];
  if (!start || !end) return false;

  // Skip zero-duration continuation boundary rows
  if (v.is_continuation && start === "06:00" && end === "06:00" && v.continuation_source_row_id) {
    return false;
  }

  return true;
}

// ── Signup key helpers ────────────────────────────────────────────────────────

function normalizeMokedName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

/**
 * Build the shared moked key component (the part between date and times).
 * Uses explicit signup_group_id if set, otherwise the normalized display name.
 * "מוקד מלא 1" and "מוקד מלא 2" produce DIFFERENT keys — numbers are preserved.
 */
export function buildSharedMokedKey(template, row) {
  const explicit =
    row?.values?.signup_group_id ||
    row?.values?.registration_group_id ||
    template?.signup_group_id ||
    template?.registration_group_id;
  if (explicit) return `group:${explicit}`;

  // Use getMokedDisplayName — same function as UI — so name is always consistent
  return `name:${normalizeMokedName(getMokedDisplayName(row, template))}`;
}

/**
 * Build the full canonical signup key.
 * Format: `${operational_date}__${sharedMokedKey}__${start_time}__${end_time}`
 */
export function buildSignupKey(operationalDate, sharedMokedKey, startTime, endTime) {
  return `${operationalDate}__${sharedMokedKey}__${startTime}__${endTime}`;
}

// ── Status normalization ──────────────────────────────────────────────────────

export function normalizeSignupType(s) {
  const raw = s.type || s.status || s.preference || s.value;
  if (raw === "wanted"      || raw === "רצוי")     return "wanted";
  if (raw === "available"   || raw === "זמין")     return "available";
  if (raw === "unavailable" || raw === "לא זמין") return "unavailable";
  return raw || null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShiftOperationalDate(shift) {
  return shift.operational_date || shift.date;
}

// ── 1. Build unified shift demand from TemplateRows ───────────────────────────
/**
 * Returns Map: signupKey → unified shift descriptor.
 *
 * CRITICAL: requiredCount = number of distinct moked INSTANCES (by mokedInstanceKey),
 * NOT the number of TemplateRows.  A single moked instance with 3 worker columns
 * (= 3 rows) must produce requiredCount = 1, not 3.
 *
 * Two same-named moked instances (different group_ids) at the same date+time
 * share one signup group with requiredCount = 2.
 */
export function buildUnifiedShiftDemand(templateRows, templates) {
  const templateById = {};
  templates.forEach(t => { templateById[t.id] = t; });

  // signupKey → unified shift
  const map = new Map();

  templateRows.forEach(row => {
    const tmpl = templateById[row.template_id];

    if (!isRealAvailabilityDemandRow(row, tmpl)) return;

    const values = row.values;
    const startTime = values["התחלה"] || values["שעת התחלה"];
    const endTime   = values["סיום"]  || values["שעת סיום"];
    const operationalDate = row.date;

    const mokedName       = getMokedDisplayName(row, tmpl);
    const sharedMokedKey  = buildSharedMokedKey(tmpl, row);
    const signupKey       = buildSignupKey(operationalDate, sharedMokedKey, startTime, endTime);
    const instanceKey     = getMokedInstanceKey(row);

    if (!map.has(signupKey)) {
      map.set(signupKey, {
        key: signupKey, signupKey, sharedMokedKey,
        date: operationalDate, operational_date: operationalDate,
        mokedName, startTime, endTime,
        requiredCount: 0,
        eligibleRoles: new Set(),
        // Map: mokedInstanceKey → { mokedInstanceKey, template_id, group_id, row_ids[] }
        possibleInstances: new Map(),
      });
    }
    const unified = map.get(signupKey);

    // ── Track moked instances (not individual rows) ───────────────────────────
    if (!unified.possibleInstances.has(instanceKey)) {
      unified.possibleInstances.set(instanceKey, {
        mokedInstanceKey: instanceKey,
        template_id: tmpl.id,
        group_id: row.group_id || "default",
        mokedName,
        row_ids: [],
      });
    }
    const instance = unified.possibleInstances.get(instanceKey);

    // Deduplicate: never add the same row_id twice to the same instance
    if (!instance.row_ids.includes(row.id)) {
      instance.row_ids.push(row.id);
    }

    // Collect worker-column names for hasMyRole check (not for counting)
    const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
    workerCols.forEach(col => unified.eligibleRoles.add(col.name));

    // requiredCount = number of distinct moked INSTANCES
    unified.requiredCount = unified.possibleInstances.size;
  });

  return map;
}

// ── 2. Count unique workers signed up (wanted) for a unified shift ────────────
/**
 * Counts workers where normalizeSignupType === "wanted" AND signupKey matches.
 * Only "wanted" consumes capacity. "available" and "unavailable" do not.
 */
export function getSignupsForShift(availabilities, unifiedShift, slotSignupKeyCount = 1) {
  const { signupKey } = unifiedShift;
  const operationalDate = unifiedShift.operational_date || unifiedShift.date;
  const { startTime, endTime } = unifiedShift;

  const signedWorkerIds = new Set();

  availabilities.forEach(avail => {
    const shifts = avail.shifts || [];

    // Phase 1: exact signupKey match (new-style records)
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

    // Phase 2: worker has a DIFFERENT moked's keyed entry at the same date+time
    // → their naked entry belongs to that other moked, not this one
    const hasOtherMokedKeyedEntry = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      const sDate = getShiftOperationalDate(s);
      if (sDate !== operationalDate || s.start_time !== startTime || s.end_time !== endTime) return false;
      if (s.signupKey && s.signupKey !== signupKey) return true;
      if (s.sharedMokedKey) {
        const legacyKey = buildSignupKey(sDate, s.sharedMokedKey, s.start_time, s.end_time);
        if (legacyKey !== signupKey) return true;
      }
      return false;
    });

    if (hasOtherMokedKeyedEntry) return;

    // Phase 3: naked entry (no moked identity) — legacy data
    // ONLY run if this is the single moked at this date+time slot.
    // If slotSignupKeyCount > 1, naked entries are ambiguous — skip entirely.
    if (slotSignupKeyCount > 1) return;

    const hasNakedMatch = shifts.some(s => {
      if (normalizeSignupType(s) !== "wanted") return false;
      if (s.signupKey || s.sharedMokedKey) return false;
      return getShiftOperationalDate(s) === operationalDate &&
        s.start_time === startTime &&
        s.end_time === endTime;
    });
    if (hasNakedMatch) {
      signedWorkerIds.add(avail.worker_id);
    }
  });

  return signedWorkerIds.size;
}

// Backward-compat alias
export function getSignupsForRole(availabilities, workers, unifiedShift, roleName) {
  return getSignupsForShift(availabilities, unifiedShift);
}

// ── 3. Calculate status ───────────────────────────────────────────────────────

export function calculateRoleStatus(required, signed, signupMode) {
  const available = Math.max(0, required - signed);
  const fullnessPct = required > 0 ? Math.min(100, Math.round((signed / required) * 100)) : 0;
  const isOver = signed > required;
  const isFull = signed >= required;
  const chance = signed === 0 ? 100 : isFull ? Math.round((required / signed) * 100) : 100;

  let statusLabel;
  if (isOver)           statusLabel = "הרשמה עודפת";
  else if (isFull)      statusLabel = "מלא";
  else if (fullnessPct >= 70) statusLabel = "כמעט מלא";
  else                  statusLabel = "פתוח";

  // Blocked = limited mode AND full AND this worker hasn't already signed up
  const blocked = signupMode === "limit_sign_up" && isFull;

  return { available, fullnessPct, isOver, isFull, chance, statusLabel, blocked };
}

// ── 4. Check if current worker signed up for a shift ─────────────────────────
/**
 * STRICT: match by signupKey only when the chip has a signupKey.
 * Never fall through to date+time for a keyed chip — that is what caused
 * "signing to one moked affects another moked at the same time".
 */
export function workerSignedForShift(selectedShifts, unifiedShift) {
  const { signupKey } = unifiedShift;

  return selectedShifts.some(s => {
    const active = s.type === "wanted" || s.type === "available" || s.type === "unavailable";
    if (!active) return false;

    // Exact signupKey match (new records)
    if (s.signupKey && signupKey) return s.signupKey === signupKey;

    // Legacy: reconstruct from sharedMokedKey
    if (s.sharedMokedKey && signupKey) {
      const legacyKey = buildSignupKey(
        getShiftOperationalDate(s),
        s.sharedMokedKey,
        s.start_time,
        s.end_time
      );
      return legacyKey === signupKey;
    }

    // Naked entry: only match if NO other keyed entry exists for this slot
    // (prevents naked legacy entries from highlighting chips they don't belong to)
    if (s.signupKey || s.sharedMokedKey) return false;
    const operationalDate = unifiedShift.operational_date || unifiedShift.date;
    if (getShiftOperationalDate(s) !== operationalDate ||
        s.start_time !== unifiedShift.startTime ||
        s.end_time !== unifiedShift.endTime) return false;

    // There's a keyed entry for this slot — this naked entry doesn't own it
    const hasKeyedEntry = selectedShifts.some(other => {
      if (other === s) return false;
      const oDate = getShiftOperationalDate(other);
      if (oDate !== operationalDate ||
          other.start_time !== unifiedShift.startTime ||
          other.end_time !== unifiedShift.endTime) return false;
      return !!(other.signupKey || other.sharedMokedKey);
    });
    return !hasKeyedEntry;
  });
}

// ── 5. Serialize possibleInstances for storage ────────────────────────────────
/**
 * Convert the Map form (used internally) to an Array for JSON storage in Availability.shifts.
 */
export function serializePossibleInstances(instancesMap) {
  if (!instancesMap || typeof instancesMap.values !== 'function') return [];
  return [...instancesMap.values()];
}

// ── 6. Filter to current week ─────────────────────────────────────────────────

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
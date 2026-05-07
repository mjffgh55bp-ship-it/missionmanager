/**
 * shiftDemand.js
 * Computes unified shift demand from TemplateRows + Templates,
 * counts signups from all Availability records, and calculates status.
 */

// ── 1. Build unified shift demand from TemplateRows ───────────────────────────
// Returns Map: unifiedKey → { key, date, mokedName, startTime, endTime, roles: { roleName: count } }
export function buildUnifiedShiftDemand(templateRows, templates) {
  const templateById = {};
  templates.forEach(t => { templateById[t.id] = t; });

  const map = new Map(); // key → unified shift

  templateRows.forEach(row => {
    const tmpl = templateById[row.template_id];
    if (!tmpl || !row.values) return;

    const values = row.values;
    const startTime = values["התחלה"] || values["שעת התחלה"];
    const endTime   = values["סיום"]  || values["שעת סיום"];
    if (!startTime || !endTime || !row.date) return;

    const mokedName = tmpl.name || row.template_name || "";
    const key = `${row.date}|${mokedName}|${startTime}|${endTime}`;

    if (!map.has(key)) {
      map.set(key, { key, date: row.date, mokedName, startTime, endTime, roles: {} });
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
  const { date, startTime, endTime } = unifiedShift;

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
      s.date === date &&
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
  const { date, startTime, endTime } = unifiedShift;
  return selectedShifts.some(s =>
    s.date === date &&
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
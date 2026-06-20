/**
 * Matrix column counting utilities.
 * Supports both legacy (criteria_type/criteria_value) and new criteria-based column formats.
 */
import { startOfWeek, endOfWeek, format } from "date-fns";
import { getOperationalMinutes, getOperationalEndMinutes } from "@/lib/operationalDate";

/**
 * Evaluate a single criterion against a shift row.
 */
export function evaluateCriterionForShift(criterion, shiftRow, workerId, workerQualifications) {
  // Task/qualification criterion
  if (criterion.col_name === "__משימה__") {
    const qualIds = criterion.include || [];
    if (qualIds.length === 0) return true;
    const workerQualIds = (workerQualifications || []).filter(wq => wq.worker_id === workerId).map(wq => wq.qualification_id);
    return criterion.logic === 'and'
      ? qualIds.every(qid => workerQualIds.includes(qid))
      : qualIds.some(qid => workerQualIds.includes(qid));
  }

  // Time range criterion
  if (criterion.col_name === "__טווח_שעות__") {
    const ranges = (criterion.include || []).map(str => {
      const m = str.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      return m ? { start: m[1], end: m[2] } : null;
    }).filter(Boolean);
    if (ranges.length === 0) return true;
    const st = shiftRow.values?.['התחלה'] || shiftRow.values?.['שעת התחלה'];
    const et = shiftRow.values?.['סיום'] || shiftRow.values?.['שעת סיום'];
    if (!st || !et) return false;
    const sStart = getOperationalMinutes(st);
    const sEnd = getOperationalEndMinutes(st, et);
    return criterion.logic === 'and'
      ? ranges.every(r => {
          const rStart = getOperationalMinutes(r.start);
          const rEnd = getOperationalMinutes(r.end) || 1440;
          return sStart < rEnd && sEnd > rStart;
        })
      : ranges.some(r => {
          const rStart = getOperationalMinutes(r.start);
          const rEnd = getOperationalMinutes(r.end) || 1440;
          return sStart < rEnd && sEnd > rStart;
        });
  }

  // Schedule column criterion — read BOTH the main value and the `<col>_subTypes` array
  const mainVal = shiftRow.values?.[criterion.col_name];
  const subTypeVal = shiftRow.values?.[`${criterion.col_name}_subTypes`];
  const tokens = [];
  if (Array.isArray(mainVal)) tokens.push(...mainVal);
  else if (mainVal != null && mainVal !== '') tokens.push(String(mainVal));
  if (Array.isArray(subTypeVal)) tokens.push(...subTypeVal);
  else if (subTypeVal != null && subTypeVal !== '') tokens.push(String(subTypeVal));

  const includeVals = criterion.include || [];
  if (includeVals.length === 0) return tokens.length > 0;

  // exact-token match (a token equals the wanted value), with substring fallback for legacy free-text
  const matchesOne = (wanted) =>
    tokens.some(t => t === wanted || t.includes(wanted));
  return criterion.logic === 'and'
    ? includeVals.every(matchesOne)
    : includeVals.some(matchesOne);
}

/**
 * Count shifts for a worker using the new criteria-based column format.
 */
export function countWithCriteria(column, workerId, templateRows, allTemplates, workerQualifications, currentDate) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');

  // No criteria = count all assigned shifts this week
  if (!column.criteria || column.criteria.length === 0) {
    let count = 0;
    templateRows.forEach(row => {
      if (!row.values || row.date < weekStartStr || row.date > weekEndStr) return;
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      // isWorkerAssignedToRow is passed from the caller context
      const assigned = isWorkerInRow(row, workerId, tmpl);
      if (assigned) count++;
    });
    return count;
  }

  let count = 0;
  let assignedCount = 0;
  templateRows.forEach(row => {
    if (!row.values || row.date < weekStartStr || row.date > weekEndStr) return;
    const tmpl = allTemplates.find(t => t.id === row.template_id);
    if (!tmpl) return;
    const assigned = isWorkerInRow(row, workerId, tmpl);
    if (!assigned) return;
    assignedCount++;

    const results = column.criteria.map(c => evaluateCriterionForShift(c, row, workerId, workerQualifications));
    const match = column.criteria_logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    if (match) count++;
  });
  console.log('[matrixColumnCount] workerId:', workerId, 'column:', column.name, 'criteria:', JSON.stringify(column.criteria), 'assignedRows:', assignedCount, 'matchCount:', count);
  return count;
}

/**
 * Check if a worker is assigned to a template row.
 * Pure utility — caller provides the helper.
 */
export function isWorkerInRow(row, workerId, template) {
  if (!row.values || !workerId) return false;
  const cols = template?.columns || [];
  for (const col of cols) {
    if (col.type !== "worker") continue;
    const val = row.values[col.name];
    if (val === workerId) return true;
    if (Array.isArray(val) && val.includes(workerId)) return true;
  }
  return false;
}

/**
 * Count using legacy criteria_type/criteria_value format.
 */
export function countLegacy(column, workerId, templateRows, allTemplates, currentDate, trackerEntries) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const weeklyShifts = [];

  templateRows.forEach(row => {
    if (!row.values) return;
    const tmpl = allTemplates.find(t => t.id === row.template_id);
    if (!tmpl) return;
    if (!isWorkerInRow(row, workerId, tmpl)) return;
    if (row.date < weekStartStr || row.date > weekEndStr) return;
    const st = row.values?.['התחלה'] || row.values?.['שעת התחלה'];
    const et = row.values?.['סיום'] || row.values?.['שעת סיום'];
    weeklyShifts.push({
      date: row.date, start_time: st || null, end_time: et || null,
      status: row.values?.status || null,
      food_cart_name: tmpl.name || row.template_name || ''
    });
  });

  if (column.criteria_type === 'total_shifts') return weeklyShifts.length;
  if (column.criteria_type === 'status') return weeklyShifts.filter(s => s.status === column.criteria_value).length;
  if (column.criteria_type === 'food_cart') return weeklyShifts.filter(s => s.food_cart_name === column.criteria_value).length;

  if (column.criteria_type === 'time_range') {
    const [from, to] = (column.criteria_value || '').split('-');
    if (!from || !to) return 0;
    const fromOp = getOperationalMinutes(from);
    const toOp = getOperationalMinutes(to) || 1440;
    return weeklyShifts.filter(s => {
      const sStart = getOperationalMinutes(s.start_time);
      const sEnd = getOperationalEndMinutes(s.start_time, s.end_time);
      return sStart < toOp && sEnd > fromOp;
    }).length;
  }

  if (column.criteria_type === 'schedule_col') {
    const [colName, criterion] = (column.criteria_value || '').split('|||');
    if (!colName) return 0;
    let count = 0;
    templateRows.forEach(row => {
      if (!row.values || row.date < weekStartStr || row.date > weekEndStr) return;
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      if (!isWorkerInRow(row, workerId, tmpl)) return;
      const cellVal = row.values[colName];
      if (!criterion) { if (cellVal) count++; }
      else { const valStr = Array.isArray(cellVal) ? cellVal.join(',') : (cellVal || ''); if (valStr.includes(criterion)) count++; }
    });
    return count;
  }

  if (column.criteria_type === 'tracker_col') {
    const [trackerId, columnId] = (column.criteria_value || '').split('|||');
    if (!trackerId || !columnId) return 0;
    const entry = trackerEntries.find(e => e.tracker_id === trackerId && e.worker_id === workerId && e.column_id === columnId);
    return entry ? (parseFloat(entry.value) || entry.value || 0) : 0;
  }

  return 0;
}

/**
 * Main entry point: get count for a worker column.
 * Supports both old (criteria_type/criteria_value) and new (criteria array) formats.
 */
export function getWorkerColumnCount(column, workerId, { templateRows, allTemplates, workerQualifications, currentDate, trackerEntries }) {
  if (column.criteria && Array.isArray(column.criteria) && column.criteria.length > 0) {
    return countWithCriteria(column, workerId, templateRows, allTemplates, workerQualifications, currentDate);
  }
  if (column.criteria && Array.isArray(column.criteria) && column.criteria.length === 0) {
    // Empty criteria = count all shifts (same as no-criteria, but through criteria path)
    return countWithCriteria(column, workerId, templateRows, allTemplates, workerQualifications, currentDate);
  }
  return countLegacy(column, workerId, templateRows, allTemplates, currentDate, trackerEntries);
}
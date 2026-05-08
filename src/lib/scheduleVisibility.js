/**
 * scheduleVisibility.js
 * Single source of truth for which templates/rows are "visible" in the Schedule calendar.
 * Used by both Schedule.jsx and ShiftDemandPanel/shiftDemand to ensure consistency.
 */

const STALE_TEMPLATE_NAMES = [
  "מנהלי מסעדה יום",
  "מנהלי מסעדה לילה",
];

/**
 * Returns true only if the template should be shown in the Schedule calendar
 * and considered real for the purposes of shift demand / availability signup.
 */
export function isVisibleScheduleTemplate(template) {
  if (!template) return false;
  if (template.active === false) return false;

  const name = template.name || "";
  if (STALE_TEMPLATE_NAMES.some(n => name.includes(n))) return false;

  // Schedule hides any template that has a column named "תפקיד"
  if ((template.columns || []).some(c => c.name === "תפקיד")) return false;

  return true;
}

/**
 * Filters templateRows to only those whose template passes isVisibleScheduleTemplate.
 */
export function filterVisibleScheduleRows(templateRows, templates) {
  const templateById = {};
  templates.forEach(t => { templateById[t.id] = t; });
  return templateRows.filter(row => isVisibleScheduleTemplate(templateById[row.template_id]));
}
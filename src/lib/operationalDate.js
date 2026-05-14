/**
 * Operational day helper.
 * The operational day starts at 06:00.
 * Times between 00:00 and 05:59 belong to the NEXT calendar day.
 *
 * @param {string} scheduleDate - "yyyy-MM-dd" — the date shown on the schedule
 * @param {string} time         - "HH:MM" — the clock time of the shift start/end
 * @returns {string} "yyyy-MM-dd" — the actual calendar date this time belongs to
 */
export function getOperationalDate(scheduleDate, time) {
  if (!scheduleDate || !time) return scheduleDate;
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + (m || 0);
  // 00:00–05:59 → belongs to the next calendar day
  if (totalMinutes < 6 * 60) {
    const base = new Date(scheduleDate + "T12:00:00");
    base.setDate(base.getDate() + 1);
    return base.toISOString().slice(0, 10);
  }
  return scheduleDate;
}

/**
 * Returns the "operational start date" for a shift.
 * For hour counting / matrix placement, use the start time to determine the operational day.
 */
export function getOperationalStartDate(scheduleDate, startTime) {
  return getOperationalDate(scheduleDate, startTime);
}

/**
 * Calculate hours for a shift, handling overnight correctly.
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime   - "HH:MM"
 * @returns {number} hours (float)
 */
export function calcShiftHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight
  return Math.max(0, (endMins - startMins) / 60);
}

/**
 * Given a schedule date + start time, returns true if this shift's start
 * is in the 00:00–05:59 window (i.e., it belongs operationally to the next day).
 */
export function isNextDayShift(startTime) {
  if (!startTime) return false;
  const [h] = startTime.split(":").map(Number);
  return h < 6;
}

/**
 * Convert a clock time to operational minutes since 06:00.
 *
 * The operational day runs 06:00 → next-day 06:00 (1440 minutes total).
 *
 *   06:00 →    0
 *   07:00 →   60
 *   22:00 →  960
 *   23:00 → 1020
 *   00:00 → 1080
 *   01:00 → 1140
 *   02:00 → 1200
 *   05:00 → 1380
 *   06:00 → 1440  (end boundary)
 *
 * @param {string} time - "HH:MM"
 * @returns {number} minutes since operational day start (0–1440)
 */
export function getOperationalMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0);
  // 06:00–23:59: subtract the 6-hour offset
  if (total >= 6 * 60) return total - 6 * 60;
  // 00:00–05:59: wrap to end of operational day (after midnight segment)
  return total + 18 * 60;
}
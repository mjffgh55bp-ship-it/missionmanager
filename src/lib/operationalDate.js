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
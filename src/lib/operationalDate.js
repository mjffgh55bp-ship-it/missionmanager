/**
 * Operational day helper.
 * The operational day starts at 06:00.
 * Times between 00:00 and 05:59 belong to the NEXT calendar day.
 *
 * TimeCell stores values as:
 *   "HH:MM"        plain same-day time
 *   "+1 HH:MM"     next-day time
 *   "+2 HH:MM"     two-days-out time
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a TimeCell value (plain or +N prefixed) into its components.
 *
 * Examples:
 *   "06:00"    → { dayOffset: 0, hour: 6,  minute: 0,  clockTime: "06:00" }
 *   "02:00"    → { dayOffset: 0, hour: 2,  minute: 0,  clockTime: "02:00" }
 *   "+1 06:00" → { dayOffset: 1, hour: 6,  minute: 0,  clockTime: "06:00" }
 *   "+1 02:00" → { dayOffset: 1, hour: 2,  minute: 0,  clockTime: "02:00" }
 *   "+2 06:00" → { dayOffset: 2, hour: 6,  minute: 0,  clockTime: "06:00" }
 *
 * @param {string} value
 * @returns {{ dayOffset: number, hour: number, minute: number, clockTime: string }}
 */
export function parseTimeCellValue(value) {
  if (!value) return { dayOffset: 0, hour: NaN, minute: NaN, clockTime: "" };

  const str = String(value).trim();

  // "+N HH:MM" format
  const plusMatch = str.match(/^\+(\d+)\s+(\d{1,2}):(\d{2})$/);
  if (plusMatch) {
    const hour = parseInt(plusMatch[2], 10);
    const minute = parseInt(plusMatch[3], 10);
    return {
      dayOffset: parseInt(plusMatch[1], 10),
      hour,
      minute,
      clockTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  // Plain "HH:MM" format
  const plainMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    const hour = parseInt(plainMatch[1], 10);
    const minute = parseInt(plainMatch[2], 10);
    return {
      dayOffset: 0,
      hour,
      minute,
      clockTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  return { dayOffset: 0, hour: NaN, minute: NaN, clockTime: str };
}

/**
 * Extract just the plain "HH:MM" clock time from a TimeCell value.
 * "+1 06:00" → "06:00"
 * "02:00"    → "02:00"
 */
export function getClockTime(value) {
  return parseTimeCellValue(value).clockTime;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a schedule date string and a time value (plain or +N prefixed),
 * return the calendar date this time actually belongs to.
 *
 * Rules:
 *  - +N prefix: add N days to the schedule date
 *  - plain 00:00–05:59: next calendar day (same rule as before)
 *  - plain 06:00–23:59: same calendar day
 */
export function getOperationalDate(scheduleDate, timeValue) {
  if (!scheduleDate || !timeValue) return scheduleDate;
  const { dayOffset, hour } = parseTimeCellValue(timeValue);

  const base = new Date(scheduleDate + "T12:00:00");

  if (dayOffset > 0) {
    base.setDate(base.getDate() + dayOffset);
    return base.toISOString().slice(0, 10);
  }

  // Plain time: 00:00–05:59 belongs to next calendar day
  if (!isNaN(hour) && hour < 6) {
    base.setDate(base.getDate() + 1);
    return base.toISOString().slice(0, 10);
  }

  return scheduleDate;
}

export function getOperationalStartDate(scheduleDate, startTime) {
  return getOperationalDate(scheduleDate, startTime);
}

/**
 * Explicit alias: returns the physical calendar date for a given time value on an operational date.
 * Use for ICS/calendar export, NOT for visual grouping in Schedule/Matrix/Availability.
 *
 * Examples (operationalDate = 2026-05-18):
 *   getCalendarDateForTime("2026-05-18", "06:00") → "2026-05-18"
 *   getCalendarDateForTime("2026-05-18", "02:00") → "2026-05-19"  ← after midnight
 *   getCalendarDateForTime("2026-05-18", "+1 02:00") → "2026-05-19"
 */
export function getCalendarDateForTime(operationalDate, timeValue) {
  return getOperationalDate(operationalDate, timeValue);
}

/**
 * Add N days to a date string "yyyy-MM-dd" and return the new date string.
 */
export function addDaysString(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the operational day for a schedule row — always row.date unchanged.
 * Use this everywhere you need the "business day" for visual grouping.
 */
export function getOperationalDayForScheduleRow(rowDate) {
  return rowDate;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL MINUTE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert any TimeCell value to operational minutes since 06:00.
 *
 * The operational day runs 06:00 → next-day 06:00 (1440 minutes total).
 *
 *   06:00 / +1 06:00  →    0   (start of operational day)
 *   07:00             →   60
 *   22:00             →  960
 *   23:00             → 1020
 *   00:00             → 1080
 *   01:00             → 1140
 *   02:00 / +1 02:00  → 1200
 *   05:00             → 1380
 *
 * NOTE: 06:00 returns 0 here. For END-time logic use getOperationalEndMinutes.
 *
 * @param {string} value - "HH:MM" or "+N HH:MM"
 * @returns {number} 0–1379
 */
export function getOperationalMinutes(value) {
  const { hour, minute } = parseTimeCellValue(value);
  if (isNaN(hour) || isNaN(minute)) return 0;

  const total = hour * 60 + minute;

  // 06:00–23:59 → 0–1079
  if (total >= 6 * 60) return total - 6 * 60;

  // 00:00–05:59 → 1080–1379
  return total + 18 * 60;
}

/**
 * Calculate the operational END minutes for a shift.
 *
 * Handles all cases:
 *  - Plain overnight: "22:00" → "02:00"
 *  - Plain 02:00 → "06:00" (end boundary = 1440, NOT 0)
 *  - "+1 06:00" end (explicit next-day boundary = 1440)
 *  - "+1 02:00" end for a shift starting same day
 *
 * For 02:00–06:00 (or 02:00–+1 06:00):
 *   start = 1200, end = 1440, duration = 240 ✓
 *
 * @param {string} startValue - "HH:MM" or "+N HH:MM"
 * @param {string} endValue   - "HH:MM" or "+N HH:MM"
 * @returns {number} operational minutes for end (always > start)
 */
export function getOperationalEndMinutes(startValue, endValue) {
  const parsedEnd = parseTimeCellValue(endValue);
  const start = getOperationalMinutes(startValue);
  let end = getOperationalMinutes(endValue);

  // Explicit +N end: the +N tells us it's definitely after the start day.
  // If the clock time of the end is 06:00, it is the operational day boundary → 1440.
  if (parsedEnd.dayOffset > 0 && parsedEnd.hour === 6 && parsedEnd.minute === 0) {
    return 1440;
  }

  // Plain "06:00" as end time AND shift started after midnight (op-mins > 0):
  // This is the end-of-operational-day boundary → 1440.
  if (parsedEnd.dayOffset === 0 && parsedEnd.hour === 6 && parsedEnd.minute === 0 && start > 0) {
    return 1440;
  }

  // General safety: if end <= start, move it forward one full operational cycle.
  if (end <= start) {
    end += 1440;
  }

  return end;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTHER SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate hours for a shift (supports +N format).
 */
export function calcShiftHours(startValue, endValue) {
  if (!startValue || !endValue) return 0;
  const startMins = getOperationalMinutes(startValue);
  const endMins = getOperationalEndMinutes(startValue, endValue);
  return Math.max(0, (endMins - startMins) / 60);
}

/**
 * Returns true if a shift start time is in the 00:00–05:59 window.
 */
export function isNextDayShift(startValue) {
  if (!startValue) return false;
  const { hour } = parseTimeCellValue(startValue);
  return !isNaN(hour) && hour < 6;
}

/**
 * Convert operational minutes (0 = 06:00, 1440 = next-day 06:00) back to a clock time string.
 * Used by Matrix drag/resize to convert pixel positions back to displayable times.
 *
 * Examples:
 *   0    → "06:00"
 *   240  → "10:00"
 *   960  → "22:00"
 *   1080 → "00:00"
 *   1200 → "02:00"
 *   1440 → "06:00"  (end-of-day boundary, wraps to 06:00)
 */
export function operationalMinutesToTime(opMinutes) {
  const m = ((opMinutes % 1440) + 1440) % 1440;
  const clockMinutes = (m + 6 * 60) % 1440;
  const h = Math.floor(clockMinutes / 60);
  const rawMin = Math.round((clockMinutes % 60) / 15) * 15;
  const finalH = rawMin >= 60 ? (h + 1) % 24 : h;
  const finalM = rawMin >= 60 ? 0 : rawMin;
  return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
}
/**
 * Matrix timeline utility functions.
 * Operational day: 06:00 → next-day 06:00 (1440 minutes total).
 * RTL layout: right edge = 06:00 (0%), left edge = next-day 06:00 (100%).
 *
 * ========== PIXEL-BASED RTL POSITIONING (NEW) ==========
 * All visual elements use the same coordinate system:
 *
 * For a bar (range):
 *   right = startPx  (position from right edge of timeline)
 *   width = endPx - startPx
 *
 * For a point marker:
 *   right = pointPx  (position from right edge of timeline)
 *
 * This ensures:
 * - 06:00 appears at right edge (startPx=0, rightPx=0)
 * - 10:00 appears to the left (startPx=240*ppm, rightPx=240*ppm)
 * - bars and points use consistent RTL logic
 */
import { getOperationalMinutes, getOperationalEndMinutes, parseTimeCellValue, operationalMinutesToTime } from "@/lib/operationalDate";

export const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/**
 * Operational timeline: 06:00 → next-day 06:00 (24 slots, RTL)
 * Slot values are the actual display hours: 6, 7, …, 23, 0, 1, 2, 3, 4, 5
 */
export const getDailyTimeSlots = (zoomRange = { start: 0, end: 100 }) => {
  const allSlots = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};

// Operational hour order: 06, 07, ..., 23, 00, 01, ..., 05
const OPERATIONAL_HOURS = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

export const getWeeklyTimeSlots = (zoomRange = { start: 0, end: 100 }, weekStartDate = null) => {
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmtDM = (d) => `${d.getDate()}.${d.getMonth() + 1}`;
  const allSlots = [];
  for (let day = 0; day < 7; day++) {
    let dateLabel = null;
    if (weekStartDate) {
      const date = addDays(weekStartDate, day);
      dateLabel = fmtDM(date);
    }
    OPERATIONAL_HOURS.forEach((hour, opIndex) => {
      allSlots.push({
        day,
        hour,
        opIndex,
        label: opIndex === 0 ? DAYS_OF_WEEK[day] : null,
        dateLabel: opIndex === 0 ? dateLabel : null
      });
    });
  }
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};

/**
 * Convert a clock time + day to a percentage position on the timeline.
 *
 * Daily mode: uses operational day (06:00 = 0%, next-day 06:00 = 100%).
 * Weekly mode: uses plain 7×24h grid.
 */
export const timeToPercentage = (timeStr, day = 0, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1] || 0;
  let basePercent;

  if (viewMode === 'weekly') {
    const totalMinutes = (day * 24 + hours) * 60 + minutes;
    basePercent = (totalMinutes / (7 * 24 * 60)) * 100;
  } else {
    // Operational day: 06:00 = 0%, next-day 06:00 = 100% (1440 operational minutes)
    const opMins = getOperationalMinutes(timeStr);
    basePercent = (opMins / (24 * 60)) * 100;
  }

  if (basePercent < zoomRange.start || basePercent > zoomRange.end) {
    return basePercent < zoomRange.start ? -1 : 101;
  }

  const zoomWidth = zoomRange.end - zoomRange.start;
  return ((basePercent - zoomRange.start) / zoomWidth) * 100;
};

/**
 * Convert a percentage position back to a clock time string.
 */
export const percentageToTime = (percentage, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  const zoomWidth = zoomRange.end - zoomRange.start;
  const basePercent = (percentage / 100) * zoomWidth + zoomRange.start;

  if (viewMode === 'weekly') {
    const totalMinutes = (basePercent / 100) * (7 * 24 * 60);
    const day = Math.floor(totalMinutes / (24 * 60));
    const minutesInDay = totalMinutes % (24 * 60);
    const hours = Math.floor(minutesInDay / 60);
    const mins = Math.round((minutesInDay % 60) / 15) * 15;
    return { day: Math.max(0, Math.min(6, day)), time: `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
  } else {
    // Operational: 0% = 06:00, 100% = next-day 06:00
    const opMins = (basePercent / 100) * (24 * 60);
    const clockMins = (opMins + 6 * 60) % (24 * 60);
    const hours = Math.floor(clockMins / 60);
    const rawMins = Math.round((clockMins % 60) / 15) * 15;
    const finalMins = rawMins >= 60 ? 0 : rawMins;
    const finalHours = rawMins >= 60 ? (hours + 1) % 24 : hours;
    return { day: 0, time: `${String(finalHours).padStart(2, '0')}:${String(finalMins).padStart(2, '0')}` };
  }
};

/**
 * ========== PIXEL-BASED POSITIONING HELPERS ==========
 * Convert time to pixel position from RIGHT edge of timeline.
 * Used for all Matrix visual elements: bars, markers, boundaries.
 */

/**
 * timeToPixels: Convert clock time to pixel offset from RIGHT edge (RTL).
 * Daily: operational minutes * ppm
 * Weekly: (day * 1440 + operational minutes) * ppm, with day offset support
 */
export const timeToPixels = (timeStr, dayIndex = 0, viewMode = 'daily', ppm = 1) => {
  if (!timeStr) return 0;
  const opMins = getOperationalMinutes(timeStr);
  if (viewMode === 'weekly') {
    // Weekly: dayIndex * 1440 + operational minutes (no dayOffset for visual placement)
    return (dayIndex * 1440 + opMins) * ppm;
  }
  // Daily: operational minutes only
  return opMins * ppm;
};

/**
 * endTimeToPixels: Convert end time to pixel offset, handling overnight shifts.
 * If end <= start, add 24h (1440 mins).
 */
export const endTimeToPixels = (startTime, endTime, viewMode = 'daily', ppm = 1, dayIndex = 0) => {
  const endOpMins = getOperationalEndMinutes(startTime, endTime);
  if (viewMode === 'weekly') {
    return (dayIndex * 1440 + endOpMins) * ppm;
  }
  return endOpMins * ppm;
};

/**
 * getTimelineRangeStyle: Get RTL positioning for a bar (range).
 * Returns { rightPx, widthPx, style: { right, width } }
 * Used for assignment, availability, unavailability, drag preview bars.
 */
export const getTimelineRangeStyle = (startTime, endTime, dayIndex = 0, viewMode = 'daily', ppm = 1) => {
  const startPx = timeToPixels(startTime, dayIndex, viewMode, ppm);
  const endPx = endTimeToPixels(startTime, endTime, viewMode, ppm, dayIndex);
  const widthPx = Math.max(endPx - startPx, 2);

  return {
    rightPx: startPx,
    widthPx,
    style: {
      right: `${startPx}px`,
      width: `${widthPx}px`
    }
  };
};

/**
 * getTimelinePointStyle: Get RTL positioning for a marker (point).
 * Returns { rightPx, style: { right } }
 * Used for briefing markers, day boundaries.
 */
export const getTimelinePointStyle = (timeStr, dayIndex = 0, viewMode = 'daily', ppm = 1) => {
  const pointPx = timeToPixels(timeStr, dayIndex, viewMode, ppm);

  return {
    rightPx: pointPx,
    style: {
      right: `${pointPx}px`
    }
  };
};
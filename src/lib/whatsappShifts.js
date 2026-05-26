import { format, addDays, startOfWeek } from "date-fns";

// Strip operational day prefix like "-1 " or "+2 " from stored time strings
const stripDayOffset = (timeStr) => {
  if (!timeStr) return timeStr;
  const match = timeStr.match(/^[-+]\d+\s+(\d{2}:\d{2})$/);
  return match ? match[1] : timeStr;
};

const timeToMins = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Given the row's calendar date and the shift start/end/briefing times,
// compute the actual calendar date for each time.
// Rule: everything is on calendarDateStr UNLESS the time is past midnight
// (i.e. end < start in clock terms → end is next calendar day).
const resolveShiftCalendarTimes = (calendarDateStr, rawBriefingTime, rawStartTime, rawEndTime) => {
  const briefingTime = stripDayOffset(rawBriefingTime);
  const startTime   = stripDayOffset(rawStartTime);
  const endTime     = stripDayOffset(rawEndTime);

  const base = new Date(calendarDateStr + "T12:00:00"); // noon avoids DST edge cases
  const baseFormatted = format(base, "d.M.yyyy");
  const nextFormatted = format(addDays(base, 1), "d.M.yyyy");

  const startMins = timeToMins(startTime);
  const endMins   = timeToMins(endTime);

  // Shift start is always on the row's calendar date — never changes
  const shiftStartDate = baseFormatted;

  // Shift end is next calendar day only if end time is before start time (crosses midnight)
  const shiftEndDate = endMins < startMins ? nextFormatted : baseFormatted;

  // Briefing is ALWAYS on the same calendar date as the shift start.
  // A briefing happens before the shift starts — it cannot be on a later date.
  const briefingDate = baseFormatted;

  return { briefingDate, briefingTime, shiftStartDate, shiftStartTime: startTime, shiftEndDate, shiftEndTime: endTime };
};

const getBriefingTime = (shift) => {
  if (shift?.briefing_time) return stripDayOffset(shift.briefing_time);
  const [h, m] = (shift?.start_time || '06:00').split(':').map(Number);
  const totalMins = h * 60 + m - 15;
  const normMins = ((totalMins % 1440) + 1440) % 1440;
  return `${String(Math.floor(normMins / 60)).padStart(2, '0')}:${String(normMins % 60).padStart(2, '0')}`;
};

// Format a single shift into a message line
const formatShiftLine = (a, calendarDateStr, prefix = "  ") => {
  const rawBriefing = getBriefingTime(a);
  const { briefingDate, briefingTime, shiftStartDate, shiftStartTime, shiftEndDate, shiftEndTime } =
    resolveShiftCalendarTimes(calendarDateStr, rawBriefing, a.start_time, a.end_time);

  const standby = isStandbyStr(a.status);
  const name = standby ? `כוננות (${a.status})` : a.food_cart_name;
  const statusTag = a.status && !standby ? ` [${a.status}]` : '';

  const briefingStr = `תדריך: ${briefingDate} בשעה ${briefingTime}`;

  // If start and end are on the same calendar day, show date only once
  const shiftStr = shiftStartDate === shiftEndDate
    ? `משמרת: ${shiftStartDate} בשעה ${shiftStartTime} - ${shiftEndTime}`
    : `משמרת: ${shiftStartDate} בשעה ${shiftStartTime} - ${shiftEndDate} בשעה ${shiftEndTime}`;

  return `${prefix}${name}${statusTag}\n  ${briefingStr}\n  ${shiftStr}\n`;
};

const isStandbyStr = (status) => /^\d+[׳']/.test(status || '');

export const buildWhatsAppMessage = async (worker, viewMode, currentDate, getWorkerTemplateShifts, getWorkerExtraTaskShifts, isStandbyStatus, base44) => {
  let message = `שלום ${worker.nickname}! משמרות קרובות:\n\n`;
  let icsEvents = [];

  if (viewMode === "weekly") {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const dStr = format(d, "yyyy-MM-dd");
      const allDayShifts = [...getWorkerTemplateShifts(worker.id, dStr), ...getWorkerExtraTaskShifts(worker.id, dStr)];
      if (allDayShifts.length === 0) continue;
      const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
      message += `*${hebrewDays[d.getDay()]}, ${format(d, "d.M")}:*\n`;
      allDayShifts.forEach(a => {
        message += formatShiftLine(a, dStr);
        icsEvents.push({ shift: a, calendarDate: dStr });
      });
      message += "\n";
    }
  } else {
    const allShifts = [...getWorkerTemplateShifts(worker.id), ...getWorkerExtraTaskShifts(worker.id)];
    const dStr = format(currentDate, "yyyy-MM-dd");
    if (allShifts.length === 0) {
      message += "אין משמרות מתוכננות ליום זה.\n\n";
    } else {
      allShifts.forEach((a, i) => {
        message += `*משמרת ${i + 1}:* ` + formatShiftLine(a, dStr, "").trimStart() + "\n";
        icsEvents.push({ shift: a, calendarDate: dStr });
      });
    }
  }

  // Build ICS
  if (icsEvents.length > 0) {
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kitchen Shifts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    icsEvents.forEach((evt, idx) => {
      const { shift, calendarDate } = evt;
      const rawBriefing = getBriefingTime(shift);
      const { briefingDate, briefingTime, shiftEndDate, shiftEndTime } =
        resolveShiftCalendarTimes(calendarDate, rawBriefing, shift.start_time, shift.end_time);

      const toIcsDateTime = (dateStr, timeStr) => {
        const [d, m, y] = dateStr.split('.').map(Number);
        return `${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}T${timeStr.replace(':','')}00`;
      };

      const standby = isStandbyStr(shift.status);
      icsContent += `BEGIN:VEVENT\nUID:shift-${idx}-${Date.now()}@kitchen\nDTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\nDTSTART:${toIcsDateTime(briefingDate, briefingTime)}\nDTEND:${toIcsDateTime(shiftEndDate, shiftEndTime)}\nSUMMARY:${standby ? `כוננות ${shift.status}` : shift.food_cart_name}${shift.status && !standby ? ` - ${shift.status}` : ''}\nDESCRIPTION:תדריך: ${briefingDate} ${briefingTime}\\nמשמרת: ${shift.start_time} - ${shift.end_time}\nEND:VEVENT\n`;
    });
    icsContent += 'END:VCALENDAR';

    const uploadResult = await base44.integrations.Core.UploadFile({
      file: new File([new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })], 'shifts.ics', { type: 'text/calendar' })
    });
    if (uploadResult?.file_url) message += `\n📅 *להוספת המשמרות ליומן:*\n${uploadResult.file_url}\n\n`;
  }

  message += "בהצלחה! 👨‍🍳";
  return message;
};
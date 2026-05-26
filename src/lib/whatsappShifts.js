import { format, addDays, startOfWeek } from "date-fns";

// Strip any operational day prefix like "-1 " or "+2 " from a time string
const stripDayOffset = (timeStr) => {
  if (!timeStr) return timeStr;
  const match = timeStr.match(/^[-+]\d+\s+(\d{2}:\d{2})$/);
  return match ? match[1] : timeStr;
};

// Given a calendar base date (yyyy-MM-dd) and a time "HH:MM",
// return the actual calendar date string "d.M.yyyy" for that time.
// Times 00:00–05:59 that come AFTER a start time ≥ 06:00 are on the next calendar day.
const resolveCalendarDate = (baseDateStr, timeStr, referenceTimeStr = null) => {
  const t = stripDayOffset(timeStr);
  const [h] = t.split(':').map(Number);
  const base = new Date(baseDateStr + "T12:00:00"); // noon to avoid DST issues

  // If referenceTimeStr is provided (e.g. shift start), and current time < reference time
  // and reference time >= 06:00, then current time wraps to next calendar day
  if (referenceTimeStr) {
    const ref = stripDayOffset(referenceTimeStr);
    const [rh] = ref.split(':').map(Number);
    if (rh >= 6 && h < 6) {
      return format(addDays(base, 1), "d.M.yyyy");
    }
  }

  return format(base, "d.M.yyyy");
};

// Format a shift's briefing and shift times as calendar-aware strings.
// Returns { briefingDate, briefingTime, shiftStartDate, shiftStartTime, shiftEndDate, shiftEndTime }
const resolveShiftCalendarTimes = (calendarDateStr, rawBriefingTime, rawStartTime, rawEndTime) => {
  const briefingTime = stripDayOffset(rawBriefingTime);
  const startTime = stripDayOffset(rawStartTime);
  const endTime = stripDayOffset(rawEndTime);

  const [bh] = briefingTime.split(':').map(Number);
  const [sh] = startTime.split(':').map(Number);
  const [eh] = endTime.split(':').map(Number);

  const base = new Date(calendarDateStr + "T12:00:00");

  // Shift start: if start is 00:00–05:59, it's next calendar day
  const shiftStartDate = sh < 6 ? format(addDays(base, 1), "d.M.yyyy") : format(base, "d.M.yyyy");

  // Shift end: if end is 00:00–05:59 OR end < start (wraps midnight), it's next calendar day from start
  const shiftEndDate = (eh < 6 || (sh >= 6 && eh < sh)) 
    ? format(addDays(base, 1), "d.M.yyyy") 
    : shiftStartDate;

  // Briefing: if briefing >= 06:00, it's on the base calendar date
  // if briefing is 00:00–05:59, it's next calendar day (same as overnight shift start)
  const briefingDate = bh < 6 ? format(addDays(base, 1), "d.M.yyyy") : format(base, "d.M.yyyy");

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

  const standby = /^\d+[׳']/.test(a.status || '');
  const name = standby ? `כוננות (${a.status})` : a.food_cart_name;
  const statusTag = a.status && !standby ? ` [${a.status}]` : '';

  const briefingStr = `תדריך: ${briefingDate} בשעה ${briefingTime}`;

  // If start and end are on the same calendar day, don't repeat the date
  const shiftStr = shiftStartDate === shiftEndDate
    ? `משמרת: ${shiftStartDate} בשעה ${shiftStartTime} - ${shiftEndTime}`
    : `משמרת: ${shiftStartDate} בשעה ${shiftStartTime} - ${shiftEndDate} בשעה ${shiftEndTime}`;

  return `${prefix}${name}${statusTag}\n  ${briefingStr}\n  ${shiftStr}\n`;
};

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

      const standby = /^\d+[׳']/.test(shift.status || '');
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
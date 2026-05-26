import { format, addDays, startOfWeek } from "date-fns";

// Convert "HH:MM" to total minutes from midnight
const timeToMins = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Add minutes to a date string, returning { date: "yyyy-MM-dd", time: "HH:MM" }
const addMinsToDate = (dateStr, timeStr, extraMins = 0) => {
  const base = new Date(dateStr + "T00:00:00");
  const [h, m] = timeStr.split(':').map(Number);
  base.setHours(h, m + extraMins, 0, 0);
  return {
    date: format(base, "d.M.yyyy"),
    time: format(base, "HH:mm"),
  };
};

// Given a shift's operational date + times, compute calendar dates for briefing and shift start
// Briefing may be on previous calendar day if time > shift start (e.g. 23:00 briefing, 01:00 shift)
const getCalendarBriefingAndShift = (operationalDateStr, briefingTimeStr, shiftStartStr, shiftEndStr) => {
  const bMins = timeToMins(briefingTimeStr);
  const sMins = timeToMins(shiftStartStr);
  const eMins = timeToMins(shiftEndStr);

  // Operational day starts at 06:00. Times before 06:00 belong to next calendar day.
  // Briefing is before shift start → if briefing time > shift start time (clock), briefing is on the prev calendar day.
  const opBase = new Date(operationalDateStr + "T06:00:00"); // operational day base

  // Shift start: if shiftStartStr < "06:00" (i.e. 00:00–05:59), it's on the next calendar day
  const shiftStartCalendar = sMins < 360
    ? format(addDays(opBase, 1), "d.M.yyyy")
    : format(opBase, "d.M.yyyy");

  const shiftEndCalendar = eMins < 360 || (eMins < sMins && sMins >= 360)
    ? format(addDays(opBase, 1), "d.M.yyyy")
    : shiftStartCalendar;

  // Briefing: if briefing time > shift start time on the clock AND shift is early morning → briefing is prev night
  let briefingCalendar;
  if (bMins >= 360) {
    // Briefing is in "normal" part of day (06:00+) → same calendar day as operational date
    briefingCalendar = format(opBase, "d.M.yyyy");
  } else {
    // Briefing is 00:00–05:59 → next calendar day (same as early-morning shift)
    briefingCalendar = format(addDays(opBase, 1), "d.M.yyyy");
  }

  // Special case: if briefing time is close to midnight (≥22:00) and shift starts early (≤06:00 next day)
  // then briefing is the PREVIOUS night (operational date calendar day, which is actually the prev civil day)
  // We detect this: briefingMins ≥ 1320 (22:00) and shiftStartMins < 360 (06:00)
  if (bMins >= 1320 && sMins < 360) {
    briefingCalendar = format(opBase, "d.M.yyyy");
  }

  return { briefingCalendar, shiftStartCalendar, shiftEndCalendar };
};

export const buildWhatsAppMessage = async (worker, viewMode, currentDate, getWorkerTemplateShifts, getWorkerExtraTaskShifts, isStandbyStatus, base44) => {
  const getBriefingTime = (shift, operationDate) => {
    if (shift?.briefing_time) {
      // Strip any "-1 " or "+N " prefix from briefing_time
      const raw = shift.briefing_time;
      const match = raw.match(/^[-+]\d+\s+(\d{2}:\d{2})$/);
      return match ? match[1] : raw;
    }
    const [h, m] = (shift?.start_time || '06:00').split(':').map(Number);
    const bm = h * 60 + m - 15;
    const bh = Math.floor(((bm % 1440) + 1440) % 1440 / 60);
    const bmin = ((bm % 60) + 60) % 60;
    return `${String(bh).padStart(2, '0')}:${String(bmin).padStart(2, '0')}`;
  };

  let message = `שלום ${worker.nickname}! משמרות קרובות:\n\n`;
  let icsEvents = [];

  const formatShiftLine = (a, dStr, shiftIndex = null) => {
    const bt = getBriefingTime(a, dStr);
    const standby = isStandbyStatus(a.status);
    const name = standby ? `כוננות (${a.status})` : a.food_cart_name;
    const statusTag = a.status && !standby ? ` [${a.status}]` : '';

    // Compute calendar dates
    const { briefingCalendar, shiftStartCalendar, shiftEndCalendar } = getCalendarBriefingAndShift(dStr, bt, a.start_time, a.end_time);

    const briefingStr = `תדריך: ${briefingCalendar} בשעה ${bt}`;
    const shiftStr = `משמרת: ${shiftStartCalendar} בשעה ${a.start_time} - ${shiftEndCalendar} בשעה ${a.end_time}`;

    const prefix = shiftIndex !== null ? `*משמרת ${shiftIndex + 1}:* ` : `  `;
    return `${prefix}${name}${statusTag}\n  ${briefingStr}\n  ${shiftStr}\n`;
  };

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
        const bt = getBriefingTime(a, dStr);
        message += formatShiftLine(a, dStr);
        icsEvents.push({ shift: a, opDate: dStr, briefingTime: bt });
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
        const bt = getBriefingTime(a, dStr);
        message += formatShiftLine(a, dStr, i) + "\n";
        icsEvents.push({ shift: a, opDate: dStr, briefingTime: bt });
      });
    }
  }

  // Build ICS with correct calendar dates
  if (icsEvents.length > 0) {
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kitchen Shifts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    icsEvents.forEach((evt, idx) => {
      const { shift, opDate, briefingTime } = evt;
      const { briefingCalendar, shiftStartCalendar, shiftEndCalendar } = getCalendarBriefingAndShift(opDate, briefingTime, shift.start_time, shift.end_time);

      // Convert calendar date strings back to yyyyMMdd for ICS
      const toIcsDate = (calStr, timeStr) => {
        const [d, m, y] = calStr.split('.').map(Number);
        return `${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}T${timeStr.replace(':','')}00`;
      };

      icsContent += `BEGIN:VEVENT\nUID:shift-${idx}-${Date.now()}@kitchen\nDTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\nDTSTART:${toIcsDate(briefingCalendar, briefingTime)}\nDTEND:${toIcsDate(shiftEndCalendar, shift.end_time)}\nSUMMARY:${isStandbyStatus(shift.status) ? `כוננות ${shift.status}` : shift.food_cart_name}${shift.status && !isStandbyStatus(shift.status) ? ` - ${shift.status}` : ''}\nDESCRIPTION:תדריך: ${briefingCalendar} ${briefingTime}\\nמשמרת: ${shiftStartCalendar} ${shift.start_time} - ${shiftEndCalendar} ${shift.end_time}\nEND:VEVENT\n`;
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
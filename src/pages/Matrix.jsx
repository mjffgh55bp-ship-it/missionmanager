import React, { useState, useEffect, useRef } from "react";
import { usePageState } from "@/hooks/usePageState";
import { base44 } from "@/api/base44Client";
import { getCachedAllSettings, getCachedWorkers, getCachedTemplates } from "@/lib/appDataCache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { getOperationalStartDate, getOperationalMinutes, getOperationalEndMinutes, parseTimeCellValue, getClockTime } from "@/lib/operationalDate";
import { Send, Star, Check, Ban, Plus, MessageCircle } from "lucide-react";
import BriefingBar from "../components/matrix/BriefingBar";
import WorkerLockButton from "../components/matrix/WorkerLockButton";
import MasterControls from "../components/matrix/MasterControls";
import SummaryColumnsDialog from "../components/matrix/SummaryColumnsDialog";
import MatrixHeader from "../components/matrix/MatrixHeader";
import { NotificationDialog, TypeChangeDialog, ManualShiftDialog } from "../components/matrix/MatrixDialogs";

// Operational timeline: 06:00 → next-day 06:00 (24 slots, RTL)
// Each slot value is the clock-hour to display: 6, 7, …, 23, 0, 1, 2, 3, 4, 5
const getDailyTimeSlots = (zoomRange = { start: 0, end: 100 }) => {
  const allSlots = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};
const getWeeklyTimeSlots = (zoomRange = { start: 0, end: 100 }, weekStartDate = null) => {
  const allSlots = [];
  for (let day = 0; day < 7; day++) {
    let dateLabel = null;
    if (weekStartDate && day < 7) {
      const date = addDays(weekStartDate, day);
      dateLabel = format(date, 'd.M');
    }
    for (let hour = 0; hour < 24; hour++) {
      allSlots.push({ day, hour, label: hour === 0 ? DAYS_OF_WEEK[day] : null, dateLabel: hour === 0 ? dateLabel : null });
    }
  }
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};
const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

// Daily: 06:00 (right, 0%) → next-day 06:00 (left, 100%) — operational day, RTL
// Weekly: plain day*24h grid
// Supports plain "HH:MM" and "+N HH:MM" format from TimeCell.
const timeToPercentage = (timeStr, day = 0, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  if (!timeStr) return 0;
  const { hour, minute } = parseTimeCellValue(timeStr);
  if (isNaN(hour)) return 0;
  let basePercent;
  if (viewMode === 'weekly') {
    basePercent = ((day * 24 + hour) * 60 + (minute || 0)) / (7 * 24 * 60) * 100;
  } else {
    basePercent = getOperationalMinutes(timeStr) / (24 * 60) * 100;
  }
  if (basePercent < zoomRange.start || basePercent > zoomRange.end) return basePercent < zoomRange.start ? -1 : 101;
  const zoomWidth = zoomRange.end - zoomRange.start;
  return ((basePercent - zoomRange.start) / zoomWidth) * 100;
};

const percentageToTime = (percentage, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
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
    const opMins = (basePercent / 100) * (24 * 60);
    const clockMins = (opMins + 6 * 60) % (24 * 60);
    const hours = Math.floor(clockMins / 60);
    const rawMins = Math.round((clockMins % 60) / 15) * 15;
    const finalMins = rawMins >= 60 ? 0 : rawMins;
    const finalHours = rawMins >= 60 ? (hours + 1) % 24 : hours;
    return { day: 0, time: `${String(finalHours).padStart(2, '0')}:${String(finalMins).padStart(2, '0')}` };
  }
};

export default function Matrix() {
  const [_savedDate, _setSavedDate] = usePageState("matrix", "currentDate", null);
  const currentDate = _savedDate ? new Date(_savedDate) : new Date();
  const setCurrentDate = (d) => _setSavedDate(d instanceof Date ? d.toISOString() : d);

  const [viewMode, setViewMode] = usePageState("matrix", "viewMode", "daily");
  const [populationFilter, setPopulationFilter] = usePageState("matrix", "populationFilter", "__all__");
  const [roleFilter, setRoleFilter] = usePageState("matrix", "roleFilter", "__all__");
  const [statusFilter, setStatusFilter] = usePageState("matrix", "statusFilter", "__all__");
  const [zoomRange, setZoomRange] = usePageState("matrix", "zoomRange", { start: 0, end: 100 });

  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [selectedWorkerForNotification, setSelectedWorkerForNotification] = useState(null);
  const [notificationNotes, setNotificationNotes] = useState("");
  const [dragging, setDragging] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [selectedShiftForType, setSelectedShiftForType] = useState(null);
  const [selectedWorkerForType, setSelectedWorkerForType] = useState(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [selectedWorkerForManual, setSelectedWorkerForManual] = useState(null);
  const [manualShiftData, setManualShiftData] = useState({ start_time: '', end_time: '', type: 'available' });
  const [editingShift, setEditingShift] = useState(null);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const timelineRefs = useRef({});
  const loadingTimeoutRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const isLoadingRef = useRef(false);
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [sentState, setSentState] = useState({});
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [summaryColumns, setSummaryColumns] = useState([]);
  const [showSummaryColumnsDialog, setShowSummaryColumnsDialog] = useState(false);
  const [scheduleParams, setScheduleParams] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [trackerEntries, setTrackerEntries] = useState([]);
  const [signupMode, setSignupMode] = useState("allow_over_sign_up");
  const [savingSignupMode, setSavingSignupMode] = useState(false);
  const settingsIdCache = useRef({});

  useEffect(() => { loadStaticData(); }, []);
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    loadDynamicData(false);
  }, [currentDate, viewMode]);
  useEffect(() => {
    const unsubAssignment = base44.entities.Assignment.subscribe(() => { debouncedLoadDataRef.current(true); });
    const unsubTemplateRow = base44.entities.TemplateRow.subscribe(() => { debouncedLoadDataRef.current(true); });
    return () => { unsubAssignment(); unsubTemplateRow(); };
  }, []);

  const refreshWorkers = async () => {
    try {
      const workersData = await getCachedWorkers(base44.entities);
      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
    } catch (error) { console.error('Error refreshing workers:', error); }
  };

  const loadStaticData = async () => {
    try {
      const [workersData, allSettings, trackersData] = await Promise.all([
        getCachedWorkers(base44.entities),
        getCachedAllSettings(base44.entities),
        base44.entities.Tracker.list()
      ]);
      const parseSetting = (key) => { const s = allSettings.find(x => x.setting_key === key); return s ? JSON.parse(s.setting_value) : null; };
      const rawPops = parseSetting("worker_populations") || ["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"];
      setPopulations(rawPops.map(p => (typeof p === "string" ? p : p.name)));
      const rawRoles = parseSetting("worker_roles") || ["שף", "סו-שף"];
      setWorkerRoles(rawRoles.map(r => (typeof r === "string" ? r : r.name)));
      const rawStatuses = parseSetting("shift_statuses") || [];
      setShiftStatuses(rawStatuses.map(s => (typeof s === "string" ? s : s.name)));
      setSummaryColumns(parseSetting("matrix_summary_columns") || []);
      setScheduleParams(parseSetting("custom_schedule_params") || []);
      setSignupMode(parseSetting("availability_signup_mode") || "allow_over_sign_up");
      allSettings.forEach(s => { settingsIdCache.current[s.setting_key] = s.id; });
      setTrackers(trackersData);
      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
    } catch (error) { console.error('Error loading static matrix data:', error); }
    initialLoadDoneRef.current = true;
    loadDynamicData(false);
  };

  const loadDynamicData = async (silent = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    if (!silent && !initialLoaded) setLoading(true);
    try {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const dateStr = format(currentDate, "yyyy-MM-dd");

      const assignmentsData = viewMode === "daily"
        ? await base44.entities.Assignment.filter({ date: dateStr })
        : await base44.entities.Assignment.list();
      const availabilitiesData = await base44.entities.Availability.list();
      await new Promise(r => setTimeout(r, 100));
      const unavailabilitiesData = await (viewMode === "daily"
        ? base44.entities.Unavailability.filter({ date: dateStr })
        : base44.entities.Unavailability.list());
      await new Promise(r => setTimeout(r, 100));
      const [templateRowsData, allTemplatesData] = await Promise.all([
        viewMode === "daily" ? base44.entities.TemplateRow.filter({ date: dateStr }) : base44.entities.TemplateRow.list(),
        getCachedTemplates(base44.entities)
      ]);
      let filteredAssignments = assignmentsData;
      let filteredTemplateRows = templateRowsData;
      if (viewMode === "weekly") {
        const weekEndStr = format(weekEnd, "yyyy-MM-dd");
        filteredAssignments = assignmentsData.filter(a => a.date >= weekStartStr && a.date <= weekEndStr);
        filteredTemplateRows = templateRowsData.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);
      }
      if (viewMode === "daily") {
        const continuationRows = filteredTemplateRows.filter(r => r.values?.is_continuation && r.values?.continuation_source_row_id);
        const uniqueSourceIds = [...new Set(continuationRows.map(r => r.values.continuation_source_row_id).filter(Boolean))];
        if (uniqueSourceIds.length > 0) {
          const missingSourceIds = uniqueSourceIds.filter(id => !filteredTemplateRows.some(r => r.id === id));
          if (missingSourceIds.length > 0) {
            const sourceRows = await Promise.all(missingSourceIds.map(id => base44.entities.TemplateRow.get(id).catch(() => null)));
            filteredTemplateRows = [...filteredTemplateRows, ...sourceRows.filter(Boolean)];
          }
        }
      }
      const trackerEntriesData = await base44.entities.TrackerEntry.list();
      setAssignments(filteredAssignments);
      setAvailabilities(availabilitiesData);
      setUnavailabilities(unavailabilitiesData);
      setTemplateRows(filteredTemplateRows);
      setAllTemplates(allTemplatesData);
      setTrackerEntries(trackerEntriesData);
      setInitialLoaded(true);
    } catch (error) { console.error('Error loading matrix data:', error); }
    finally { setLoading(false); isLoadingRef.current = false; }
  };

  const debouncedLoadData = (silent = false) => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => loadDynamicData(silent), 2500);
  };
  const debouncedLoadDataRef = useRef(null);
  debouncedLoadDataRef.current = debouncedLoadData;

  const dateString = format(currentDate, "yyyy-MM-dd");
  const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const getWorkerTemplateShifts = (workerId, date = null) => {
    const targetDate = date || dateString;
    const shifts = [];
    templateRows.forEach(row => {
      if (!row.values) return;
      const isContinuation = row.values.is_continuation;
      const sourceRowId = row.values.continuation_source_row_id;
      let isAssigned = false;
      let briefingTime = row.values?.["תדריך"];
      if (isContinuation && sourceRowId) {
        const sourceRow = templateRows.find(r => r.id === sourceRowId);
        if (sourceRow && sourceRow.values) {
          isAssigned = Object.values(sourceRow.values).some(val => val === workerId);
          if (!briefingTime) briefingTime = sourceRow.values?.["תדריך"];
        }
      } else {
        isAssigned = Object.values(row.values).some(val => val === workerId);
      }
      if (!isAssigned || row.date !== targetDate) return;
      const template = allTemplates.find(t => t.id === row.template_id);
      if (!template) return;
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
      if (startTime && endTime) {
        shifts.push({
          id: `template_${row.id}`,
          date: getOperationalStartDate(row.date, startTime),
          schedule_date: row.date,
          start_time: startTime,
          end_time: endTime,
          briefing_time: briefingTime,
          food_cart_name: template.name || row.template_name,
          hours: null,
          status: row.values?.status || null,
          isTemplateShift: true
        });
      }
    });
    return shifts;
  };

  const getWorkerExtraTaskShifts = (workerId, date = null) => {
    const targetDate = date || dateString;
    const shifts = [];
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate && (a.status === "approved" || a.status === "submitted"));
    if (!workerAvail || !workerAvail.extra_tasks) return shifts;
    Object.entries(workerAvail.extra_tasks).forEach(([taskKey, taskState]) => {
      if (taskState !== 'wanted' && taskState !== 'available') return;
      const keyParts = taskKey.split('__');
      const groupKey = keyParts[0];
      const shiftIndex = keyParts.length > 1 ? parseInt(keyParts[1]) : null;
      const groupParts = groupKey.split('_');
      const groupIndex = groupParts.indexOf('group');
      if (groupIndex === -1) return;
      const matchingRows = templateRows.filter(r => {
        const rowKey = `${r.template_id}_${r.group_id || 'default'}`;
        return rowKey === groupKey && (!date || r.date === targetDate);
      });
      matchingRows.forEach((row, idx) => {
        if (shiftIndex !== null && idx !== shiftIndex) return;
        const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
        const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
        if (startTime && endTime) {
          const template = allTemplates.find(t => t.id === row.template_id);
          shifts.push({ id: `extratask_${row.id}_${workerId}`, date: row.date, start_time: startTime, end_time: endTime, food_cart_name: `${template?.name || row.template_name} (משימה נוספת)`, hours: null, status: row.values?.status || null, isTemplateShift: true, isExtraTask: true });
        }
      });
    });
    return shifts;
  };

  const getWorkerAvailabilityForDate = (workerId, date = null) => {
    const targetDate = date || dateString;
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate && (a.status === "approved" || a.status === "submitted"));
    if (!workerAvail || !workerAvail.shifts) return [];
    if (viewMode === 'weekly') return workerAvail.shifts || [];
    return workerAvail.shifts.filter(s => s.date === targetDate);
  };

  const getWorkerUnavailabilityForDate = (workerId, date = null) => {
    const targetDate = date || dateString;
    if (viewMode === 'weekly') return unavailabilities.filter(u => u.worker_id === workerId);
    return unavailabilities.filter(u => u.worker_id === workerId && u.date === targetDate);
  };

  const isStandbyStatus = (status) => /^\d+[׳']/.test(status || '');

  const getWorkerSendStatus = (worker) => {
    const allAssigned = [...getWorkerTemplateShifts(worker.id), ...getWorkerExtraTaskShifts(worker.id)];
    if (allAssigned.length === 0) return 'none';
    const sent = sentState[worker.id];
    if (!sent) return 'needs_update';
    const currentIds = allAssigned.map(a => a.id).sort().join(',');
    return (sent.assignmentIds === currentIds && sent.date === dateString) ? 'synced' : 'needs_update';
  };

  const sendWhatsAppNotification = async (worker) => {
    setSendingWhatsApp(true);
    try {
      let message = `שלום ${worker.nickname}!\n\n`;
      const getBriefingTime = (shift) => {
        if (shift?.briefing_time) return shift.briefing_time;
        const [h, m] = (shift?.start_time || shift).split(':').map(Number);
        const bm = h * 60 + m - 15;
        return `${String(Math.floor(bm / 60)).padStart(2, '0')}:${String(bm % 60).padStart(2, '0')}`;
      };
      let icsEvents = [];
      if (viewMode === "weekly") {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        message += `הנה לוח המשמרות שלך לשבוע של ${format(weekStart, "d.M.yyyy")}:\n\n`;
        for (let i = 0; i < 7; i++) {
          const d = addDays(weekStart, i);
          const dStr = format(d, "yyyy-MM-dd");
          const allDayShifts = [...getWorkerTemplateShifts(worker.id, dStr), ...getWorkerExtraTaskShifts(worker.id, dStr)];
          const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
          message += `*${hebrewDays[d.getDay()]}, ${format(d, "d.M")}:*\n`;
          if (allDayShifts.length === 0) { message += "  אין משמרות\n"; }
          else { allDayShifts.forEach(a => { const bt = getBriefingTime(a); const standby = isStandbyStatus(a.status); message += `  ${standby ? `כוננות (${a.status})` : a.food_cart_name}${a.status ? ` [${a.status}]` : ''}: תדריך ${bt}, משמרת ${a.start_time} - ${a.end_time}\n`; icsEvents.push({ shift: a, date: dStr }); }); }
          message += "\n";
        }
      } else {
        const allShifts = [...getWorkerTemplateShifts(worker.id), ...getWorkerExtraTaskShifts(worker.id)];
        const dStr = format(currentDate, "yyyy-MM-dd");
        message += `הנה לוח המשמרות שלך ל-${format(currentDate, "d.M.yyyy")}:\n\n`;
        if (allShifts.length === 0) { message += "אין משמרות מתוכננות ליום זה.\n\n"; }
        else { allShifts.forEach((a, i) => { const bt = getBriefingTime(a); const standby = isStandbyStatus(a.status); message += `*משמרת ${i + 1}:* ${standby ? `כוננות (${a.status})` : a.food_cart_name}${a.status ? ` [${a.status}]` : ''}\n  תדריך: ${bt}\n  משמרת: ${a.start_time} - ${a.end_time}\n\n`; icsEvents.push({ shift: a, date: dStr }); }); }
      }
      if (icsEvents.length > 0) {
        let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kitchen Shifts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
        icsEvents.forEach((evt, idx) => {
          const { shift, date } = evt;
          const bt = getBriefingTime(shift);
          icsContent += `BEGIN:VEVENT\nUID:shift-${idx}-${Date.now()}@kitchen\nDTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\nDTSTART:${date.replace(/-/g, '')}T${bt.replace(':', '')}00\nDTEND:${date.replace(/-/g, '')}T${shift.end_time.replace(':', '')}00\nSUMMARY:${isStandbyStatus(shift.status) ? `כוננות ${shift.status}` : shift.food_cart_name}${shift.status ? ` - ${shift.status}` : ''}\nDESCRIPTION:תדריך: ${bt}\\nמשמרת: ${shift.start_time} - ${shift.end_time}\nEND:VEVENT\n`;
        });
        icsContent += 'END:VCALENDAR';
        const uploadResult = await base44.integrations.Core.UploadFile({ file: new File([new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })], 'shifts.ics', { type: 'text/calendar' }) });
        if (uploadResult?.file_url) message += `\n📅 *להוספת המשמרות ליומן:*\n${uploadResult.file_url}\n\n`;
      }
      message += "בהצלחה! 👨‍🍳";
      const phoneNumber = worker.phone?.replace(/[^0-9]/g, '');
      window.open(phoneNumber ? `https://wa.me/972${phoneNumber.startsWith('0') ? phoneNumber.slice(1) : phoneNumber}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) { console.error('Error sending WhatsApp:', error); alert('שגיאה בשליחת ההודעה. אנא נסה שוב.'); }
    finally { setSendingWhatsApp(false); }
  };

  const sendNotification = async () => {
    if (!selectedWorkerForNotification) return;
    const getBriefingTime = (shift) => {
      if (shift?.briefing_time) return shift.briefing_time;
      const [h, m] = (shift?.start_time || shift).split(':').map(Number);
      const bm = h * 60 + m - 15;
      return `${String(Math.floor(bm / 60)).padStart(2, '0')}:${String(bm % 60).padStart(2, '0')}`;
    };
    let emailBody = `שלום ${selectedWorkerForNotification.nickname},\n\n`;
    let icsEvents = [];
    if (viewMode === "weekly") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      emailBody += `הנה לוח המשמרות שלך לשבוע של ${format(weekStart, "d.M.yyyy")}:\n\n`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const dStr = format(d, "yyyy-MM-dd");
        const allDayShifts = [...getWorkerTemplateShifts(selectedWorkerForNotification.id, dStr), ...getWorkerExtraTaskShifts(selectedWorkerForNotification.id, dStr)];
        const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        emailBody += `${hebrewDays[d.getDay()]}, ${format(d, "d.M")}:\n`;
        if (allDayShifts.length === 0) { emailBody += "  אין משמרות\n"; }
        else { allDayShifts.forEach(a => { emailBody += `  ${isStandbyStatus(a.status) ? `כוננות (${a.status})` : a.food_cart_name}${a.status ? ` [${a.status}]` : ''}: תדריך ${getBriefingTime(a)}, משמרת ${a.start_time} - ${a.end_time}\n`; icsEvents.push({ shift: a, date: dStr }); }); }
        emailBody += "\n";
      }
    } else {
      const allShifts = [...getWorkerTemplateShifts(selectedWorkerForNotification.id), ...getWorkerExtraTaskShifts(selectedWorkerForNotification.id)];
      const dStr = format(currentDate, "yyyy-MM-dd");
      emailBody += `הנה לוח המשמרות שלך ל-${format(currentDate, "d.M.yyyy")}:\n\n`;
      if (allShifts.length === 0) { emailBody += "אין משמרות מתוכננות ליום זה.\n\n"; }
      else { allShifts.forEach((a, i) => { emailBody += `משמרת ${i + 1}: ${isStandbyStatus(a.status) ? `כוננות (${a.status})` : a.food_cart_name}${a.status ? ` [${a.status}]` : ''}\n  תדריך: ${getBriefingTime(a)}\n  משמרת: ${a.start_time} - ${a.end_time}\n\n`; icsEvents.push({ shift: a, date: dStr }); }); }
    }
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kitchen Shifts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    icsEvents.forEach((evt, idx) => {
      const { shift, date } = evt;
      const bt = getBriefingTime(shift);
      icsContent += `BEGIN:VEVENT\nUID:shift-${idx}-${Date.now()}@kitchen\nDTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\nDTSTART:${date.replace(/-/g, '')}T${bt.replace(':', '')}00\nDTEND:${date.replace(/-/g, '')}T${shift.end_time.replace(':', '')}00\nSUMMARY:${isStandbyStatus(shift.status) ? `כוננות ${shift.status}` : shift.food_cart_name}\nEND:VEVENT\n`;
    });
    icsContent += 'END:VCALENDAR';
    const { file_url: icsUrl } = await base44.integrations.Core.UploadFile({ file: new File([new Blob([icsContent], { type: 'text/calendar' })], 'shifts.ics', { type: 'text/calendar' }) });
    emailBody += `\n📅 להוספת המשמרות ליומן:\n${icsUrl}\n\n`;
    if (notificationNotes.trim()) emailBody += `הערות מההנהלה:\n${notificationNotes}\n\n`;
    emailBody += "בברכה,\nההנהלה";
    if (selectedWorkerForNotification.email) {
      await base44.integrations.Core.SendEmail({
        to: selectedWorkerForNotification.email,
        subject: viewMode === "weekly" ? `לוח משמרות שבועי - שבוע של ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d.M.yyyy")}` : `לוח משמרות - ${format(currentDate, "d.M.yyyy")}`,
        body: emailBody
      });
    }
    const sentWorker = selectedWorkerForNotification;
    const allAssigned = [...getWorkerTemplateShifts(sentWorker.id), ...getWorkerExtraTaskShifts(sentWorker.id)];
    setSentState(prev => ({ ...prev, [sentWorker.id]: { assignmentIds: allAssigned.map(a => a.id).sort().join(','), date: dateString } }));
    setShowNotificationDialog(false);
    setSelectedWorkerForNotification(null);
    setNotificationNotes("");
  };

  const getDayIndexFromDate = (dateStr) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const diff = Math.floor((new Date(dateStr) - weekStart) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, diff));
  };

  const handleMouseDown = (e, worker, shift, action, dayIndex = 0) => {
    e.preventDefault(); e.stopPropagation();
    if (action === 'move' && e.detail === 2) return;
    const timeline = timelineRefs.current[worker.id];
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const startPercent = 100 - ((e.clientX - rect.left) / rect.width) * 100;
    setDragging({ workerId: worker.id, worker, shift, action, startPercent, originalStart: shift?.start_time, originalEnd: shift?.end_time, originalDay: viewMode === 'weekly' ? (shift ? getDayIndexFromDate(shift.date) : dayIndex) : 0, originalType: shift?.type, rect });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { worker, shift, action, startPercent, originalStart, originalEnd, originalDay, rect } = dragging;
    const currentPercent = Math.max(0, Math.min(100, 100 - ((e.clientX - rect.left) / rect.width) * 100));
    let newStart = originalStart, newEnd = originalEnd, newDay = originalDay || 0;
    if (action === 'create') {
      const [minP, maxP] = [Math.min(startPercent, currentPercent), Math.max(startPercent, currentPercent)];
      const sd = percentageToTime(minP, viewMode, zoomRange), ed = percentageToTime(maxP, viewMode, zoomRange);
      newStart = sd.time; newEnd = ed.time; newDay = sd.day;
    } else if (action === 'resize-start') {
      const d = percentageToTime(currentPercent, viewMode, zoomRange); newStart = d.time; newDay = d.day;
    } else if (action === 'resize-end') {
      newEnd = percentageToTime(currentPercent, viewMode, zoomRange).time;
    } else if (action === 'move') {
      const origStartP = timeToPercentage(originalStart, originalDay || 0, viewMode, zoomRange);
      const origEndP = timeToPercentage(originalEnd, originalDay || 0, viewMode, zoomRange);
      const width = origEndP - origStartP;
      const newStartP = Math.max(0, Math.min(100 - width, origStartP + currentPercent - startPercent));
      const sd = percentageToTime(newStartP, viewMode, zoomRange), ed = percentageToTime(newStartP + width, viewMode, zoomRange);
      newStart = sd.time; newEnd = ed.time; newDay = sd.day;
    }
    setDragPreview({ workerId: dragging.workerId, start: newStart, end: newEnd, day: newDay, type: shift?.type || 'available' });
  };

  const handleMouseUp = async () => {
    if (!dragging || !dragPreview) { setDragging(null); setDragPreview(null); return; }
    const { workerId, worker, shift, action } = dragging;
    const { start, end, day } = dragPreview;
    if (start === end) { setDragging(null); setDragPreview(null); return; }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const targetDate = viewMode === 'weekly' ? format(addDays(weekStart, day || 0), 'yyyy-MM-dd') : dateString;
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    if (action === 'create') {
      updatedShifts.push({ date: targetDate, start_time: start, end_time: end, type: 'available', priority: updatedShifts.length + 1 });
    } else if (shift) {
      updatedShifts = updatedShifts.map(s => s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time ? { ...s, date: targetDate, start_time: start, end_time: end } : s);
    }
    const availData = { worker_id: workerId, worker_name: worker.nickname, week_start_date: weekStartDate, shifts: updatedShifts, status: workerAvail?.status || "approved" };
    if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
    else await base44.entities.Availability.create(availData);
    setDragging(null); setDragPreview(null); debouncedLoadData();
  };

  const handleTypeClick = async (e, worker, shift) => {
    e.stopPropagation(); e.preventDefault();
    const workerAvail = availabilities.find(a => a.worker_id === worker.id && a.week_start_date === weekStartDate);
    if (!workerAvail) return;
    const typeMap = { available: 'wanted', wanted: 'unavailable', unavailable: 'available' };
    const updatedShifts = workerAvail.shifts.map(s => s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time ? { ...s, type: typeMap[shift.type || 'available'] } : s);
    await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    debouncedLoadData();
  };

  const handleChangeType = async (newType) => {
    if (!selectedWorkerForType || !selectedShiftForType) return;
    const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForType.id && a.week_start_date === weekStartDate);
    if (!workerAvail) return;
    const updatedShifts = workerAvail.shifts.map(s => s.date === selectedShiftForType.date && s.start_time === selectedShiftForType.start_time && s.end_time === selectedShiftForType.end_time ? { ...s, type: newType } : s);
    await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    setShowTypeDialog(false); setSelectedShiftForType(null); setSelectedWorkerForType(null); debouncedLoadData();
  };

  const handleManualShiftAdd = (worker) => {
    setSelectedWorkerForManual(worker);
    setManualShiftData({ start_time: '', end_time: '', type: 'available' });
    setEditingShift(null);
    setShowManualDialog(true);
  };

  const handleShiftDoubleClick = (e, worker, shift) => {
    e.stopPropagation(); e.preventDefault();
    setSelectedWorkerForManual(worker);
    setManualShiftData({ start_time: shift.start_time, end_time: shift.end_time, type: shift.type });
    setEditingShift(shift);
    setShowManualDialog(true);
  };

  const submitManualShift = async () => {
    if (!selectedWorkerForManual || !manualShiftData.start_time || !manualShiftData.end_time) return;
    const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForManual.id && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    const targetDate = format(currentDate, "yyyy-MM-dd");
    if (editingShift) {
      updatedShifts = updatedShifts.map(s => s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type ? { ...s, date: targetDate, start_time: manualShiftData.start_time, end_time: manualShiftData.end_time, type: manualShiftData.type } : s);
    } else {
      updatedShifts.push({ date: targetDate, start_time: manualShiftData.start_time, end_time: manualShiftData.end_time, type: manualShiftData.type, priority: updatedShifts.length + 1 });
    }
    const availData = { worker_id: selectedWorkerForManual.id, worker_name: selectedWorkerForManual.nickname, week_start_date: weekStartDate, shifts: updatedShifts, status: workerAvail?.status || "approved" };
    if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
    else await base44.entities.Availability.create(availData);
    setShowManualDialog(false); setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available' }); setEditingShift(null); debouncedLoadData();
  };

  const deleteManualShift = async () => {
    if (!selectedWorkerForManual || !editingShift) return;
    const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForManual.id && a.week_start_date === weekStartDate);
    if (!workerAvail) return;
    const updatedShifts = workerAvail.shifts.filter(s => !(s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type));
    await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    setShowManualDialog(false); setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available' }); setEditingShift(null); debouncedLoadData();
  };

  const saveSignupMode = async (newMode) => {
    setSavingSignupMode(true);
    const existingId = settingsIdCache.current["availability_signup_mode"];
    if (existingId) await base44.entities.AppSettings.update(existingId, { setting_value: JSON.stringify(newMode) });
    else { const created = await base44.entities.AppSettings.create({ setting_key: "availability_signup_mode", setting_value: JSON.stringify(newMode) }); settingsIdCache.current["availability_signup_mode"] = created.id; }
    setSignupMode(newMode); setSavingSignupMode(false);
  };

  const saveSummaryColumns = async (cols) => {
    const existingId = settingsIdCache.current["matrix_summary_columns"];
    if (existingId) await base44.entities.AppSettings.update(existingId, { setting_value: JSON.stringify(cols) });
    else { const created = await base44.entities.AppSettings.create({ setting_key: 'matrix_summary_columns', setting_value: JSON.stringify(cols) }); settingsIdCache.current["matrix_summary_columns"] = created.id; }
    setSummaryColumns(cols);
  };

  const getWorkerColumnCount = (workerId, column) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weeklyShifts = [];
    templateRows.forEach(row => {
      if (!row.values) return;
      if (!Object.values(row.values).some(val => val === workerId)) return;
      const st = row.values?.['התחלה'] || row.values?.['שעת התחלה'];
      const et = row.values?.['סיום'] || row.values?.['שעת סיום'];
      if (st && et) {
        const effectiveDate = getOperationalStartDate(row.date, st);
        if (effectiveDate < weekStartStr || effectiveDate > weekEndStr) return;
        weeklyShifts.push({ date: effectiveDate, start_time: st, end_time: et, status: row.values?.status || null, food_cart_name: allTemplates.find(t => t.id === row.template_id)?.name || row.template_name || '' });
      }
    });
    if (column.criteria_type === 'total_shifts') return weeklyShifts.length;
    if (column.criteria_type === 'status') return weeklyShifts.filter(s => s.status === column.criteria_value).length;
    if (column.criteria_type === 'food_cart') return weeklyShifts.filter(s => s.food_cart_name === column.criteria_value).length;
    if (column.criteria_type === 'time_range') {
      const [from, to] = (column.criteria_value || '').split('-');
      if (!from || !to) return 0;
      const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      return weeklyShifts.filter(s => toMins(s.start_time) < toMins(to) && toMins(s.end_time) > toMins(from)).length;
    }
    if (column.criteria_type === 'schedule_col') {
      const [colName, criterion] = (column.criteria_value || '').split('|||');
      if (!colName) return 0;
      let count = 0;
      templateRows.forEach(row => {
        if (!row.values || row.date < weekStartStr || row.date > weekEndStr) return;
        if (!Object.values(row.values).some(val => val === workerId)) return;
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
  };

  // ── Bar Components ─────────────────────────────────────────────────────────
  const AssignmentBar = ({ assignment }) => {
    const positionDate = assignment.schedule_date || assignment.date;
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(positionDate) : 0;
    const startOpMins = getOperationalMinutes(assignment.start_time);
    const endOpMins = getOperationalEndMinutes(assignment.start_time, assignment.end_time);
    // startPercent: position in the zoomed view (RTL: right edge = 06:00 = 0%)
    const startPercent = timeToPercentage(assignment.start_time, dayIndex, viewMode, zoomRange);
    // endPercent: in daily mode, compute directly from operational minutes to avoid +N parsing issues
    const endPercent = viewMode === 'daily'
      ? (() => {
          const bp = (Math.min(endOpMins, 1440) / (24 * 60)) * 100;
          if (bp < zoomRange.start || bp > zoomRange.end) return bp < zoomRange.start ? -1 : 101;
          return ((bp - zoomRange.start) / (zoomRange.end - zoomRange.start)) * 100;
        })()
      : timeToPercentage(assignment.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent >= startPercent ? endPercent - startPercent : 0;
    console.log("MATRIX BAR DEBUG", { worker_id: assignment.food_cart_name, start_time: assignment.start_time, end_time: assignment.end_time, startOpMins, endOpMins, duration: endOpMins - startOpMins, startPercent, endPercent, width });
    if (startPercent < 0 || startPercent > 100) return null;
    const isTemplate = assignment.isTemplateShift;
    const standby = isStandbyStatus(assignment.status);
    if (standby) {
      const borderColor = isTemplate ? '#a855f7' : '#3b82f6';
      return (
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <div className="absolute h-full rounded-sm z-20 flex items-center justify-center px-1 overflow-hidden" style={{ right: `${startPercent}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: 'transparent', border: `2px dashed ${borderColor}` }}>
            <span className="text-[9px] font-bold truncate" style={{ color: borderColor }}>{assignment.status}</span>
          </div>
        </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
          <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p><p>סטטוס כוננות: {assignment.status}</p>
        </TooltipContent></Tooltip></TooltipProvider>
      );
    }
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div className={`absolute h-full border-r-2 rounded-sm flex flex-col items-center justify-center px-2 overflow-hidden z-20 ${isTemplate ? "bg-purple-400 border-purple-600" : assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"}`} style={{ right: `${startPercent}%`, width: `${Math.max(width, 0.5)}%` }}>
          {!isTemplate && <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>}
          {assignment.status && <span className="text-white text-[8px] truncate">{assignment.status}</span>}
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p>{assignment.status && <p>סטטוס: {assignment.status}</p>}
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  const timesOverlap = (aStart, aEnd, bStart, bEnd) => {
    const toMins = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
    const as = toMins(aStart), ae = toMins(aEnd) || toMins(aStart) + 24*60;
    const bs = toMins(bStart), be = toMins(bEnd) || toMins(bStart) + 24*60;
    return as < be && ae > bs;
  };

  const AvailabilityBar = ({ shift, worker }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shift.date) : 0;
    const startPercent = timeToPercentage(shift.start_time, dayIndex, viewMode, zoomRange);
    // Use robust end-minute calculation (handles overnight, +N, 06:00 boundary)
    const avEndOpMins = getOperationalEndMinutes(shift.start_time, shift.end_time);
    const endPercent = viewMode === 'daily'
      ? (() => {
          const bp = (Math.min(avEndOpMins, 1440) / (24 * 60)) * 100;
          if (bp < zoomRange.start || bp > zoomRange.end) return bp < zoomRange.start ? -1 : 101;
          return ((bp - zoomRange.start) / (zoomRange.end - zoomRange.start)) * 100;
        })()
      : timeToPercentage(shift.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent >= startPercent ? endPercent - startPercent : 0;
    if (startPercent < 0 || startPercent > 100) return null;
    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };
    const borderColors = { wanted: '#16a34a', available: '#3b82f6', unavailable: '#dc2626' };
    const borderColor = borderColors[shift.type] || '#3b82f6';
    const overlappingAssignments = templateRows.filter(r => {
      if (r.date !== shift.date || !r.values) return false;
      if (!Object.values(r.values).some(val => val === worker.id)) return false;
      const st = r.values?.["התחלה"] || r.values?.["שעת התחלה"];
      const et = r.values?.["סיום"] || r.values?.["שעת סיום"];
      return st && et && timesOverlap(shift.start_time, shift.end_time, st, et);
    }).map(r => ({ start_time: r.values?.["התחלה"] || r.values?.["שעת התחלה"], end_time: r.values?.["סיום"] || r.values?.["שעת סיום"], status: r.values?.status || null }));
    return (
      <div className="absolute h-full rounded-sm z-10 cursor-move overflow-visible" style={{ right: `${startPercent}%`, width: `${width}%`, backgroundColor: 'transparent', border: `2px solid ${borderColor}` }} onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'move', dayIndex); }} onDoubleClick={(e) => handleShiftDoubleClick(e, worker, shift)}>
        <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/10 z-20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-start', dayIndex); }} />
        <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/10 z-20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-end', dayIndex); }} />
        <button className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[8px] font-bold z-30 hover:scale-110 transition-transform" style={{ borderColor }} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTypeClick(e, worker, shift); }}>
          {typeLabels[shift.type] || "A"}
        </button>
        {overlappingAssignments.map((ass, i) => {
          const toMins = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
          const avS = toMins(shift.start_time), avE = toMins(shift.end_time) || avS + 24*60;
          const assS = toMins(ass.start_time), assE = toMins(ass.end_time) || assS + 24*60;
          const overS = Math.max(avS, assS), overE = Math.min(avE, assE);
          const totalMins = avE - avS;
          return <div key={i} className="absolute top-0 h-full" style={{ left: `${((overS - avS) / totalMins) * 100}%`, width: `${((overE - overS) / totalMins) * 100}%`, backgroundColor: isStandbyStatus(ass.status) ? 'rgba(200,200,210,0.55)' : 'rgba(192,132,252,0.55)', pointerEvents: 'none' }} />;
        })}
      </div>
    );
  };

  const UnavailabilityBar = ({ unavail }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(unavail.date) : 0;
    const startPercent = timeToPercentage(unavail.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(unavail.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;
    if (startPercent < 0 || startPercent > 100) return null;
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${unavail.reason === 'overseas' ? 'bg-red-200 border-r-2 border-red-500' : 'bg-gray-300 border-r-2 border-gray-500'}`} style={{ right: `${startPercent}%`, width: `${width}%` }}>
          <Ban className="w-3 h-3 text-gray-600" />
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold capitalize">{unavail.reason}</p><p>{unavail.start_time} - {unavail.end_time}</p>
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  const DragPreviewBar = ({ preview, workerId }) => {
    if (!preview || preview.workerId !== workerId) return null;
    const startPercent = timeToPercentage(preview.start, preview.day || 0, viewMode, zoomRange);
    const endPercent = timeToPercentage(preview.end, preview.day || 0, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;
    return <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80" style={{ right: `${startPercent}%`, width: `${width}%` }}><span className="text-xs font-bold">{preview.start} - {preview.end}</span></div>;
  };

  const calcHours = (s, e) => {
    if (!s || !e) return 0;
    const start = getOperationalMinutes(s);
    const end = getOperationalEndMinutes(s, e);
    return Math.max(0, (end - start) / 60);
  };

  const WeeklySummary = ({ worker }) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = [];
    let totalWeeklyHours = 0;
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(weekStart, i), "yyyy-MM-dd");
      const dayShifts = getWorkerTemplateShifts(worker.id, d);
      const dayHours = dayShifts.reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);
      totalWeeklyHours += dayHours;
      days.push({ date: d, day: DAYS_OF_WEEK[i], hours: dayHours, working: dayShifts.length > 0 });
    }
    if (viewMode === 'weekly') return <div className="flex items-center gap-1"><span className={`text-[10px] font-bold ${totalWeeklyHours > 0 ? 'text-blue-700' : 'text-gray-300'}`}>{totalWeeklyHours > 0 ? `${Math.round(totalWeeklyHours * 10) / 10}h` : ''}</span></div>;
    return <div className="flex gap-0.5 items-center">{days.map((d, i) => <div key={i} className={`text-[9px] font-medium leading-tight ${d.working ? 'text-green-600' : 'text-gray-300'}`} title={`${d.day}: ${d.working ? d.hours.toFixed(1) + 'h' : 'חופש'}`}>{d.day}</div>)}</div>;
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} dir="rtl">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-3">
          <MatrixHeader currentDate={currentDate} setCurrentDate={setCurrentDate} viewMode={viewMode} setViewMode={setViewMode} populationFilter={populationFilter} setPopulationFilter={setPopulationFilter} roleFilter={roleFilter} setRoleFilter={setRoleFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} populations={populations} workerRoles={workerRoles} shiftStatuses={shiftStatuses} signupMode={signupMode} saveSignupMode={saveSignupMode} savingSignupMode={savingSignupMode} />
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto pb-16">
              <div className="min-w-[1400px]">
                {/* Header row */}
                <div className="flex sticky top-0 bg-gray-100 z-30 border-b">
                  <div className="w-[220px] min-w-[220px] p-3 font-semibold text-gray-700 border-r sticky left-0 bg-gray-100 z-30 flex items-center justify-start gap-2" dir="rtl">
                    <MasterControls workers={workers} populationFilter={populationFilter} roleFilter={roleFilter} getWorkerSendStatus={getWorkerSendStatus}
                      onSendWhatsApp={async (visibleWorkers) => { for (const w of visibleWorkers) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
                      onSendEmail={async (visibleWorkers) => { for (const w of visibleWorkers) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
                      sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers} />
                  </div>
                  {viewMode === 'weekly' && summaryColumns.map(col => (
                    <div key={col.id} className="w-[60px] min-w-[60px] border-r bg-gray-100 flex flex-col items-center justify-center text-center px-0.5 py-1" title={col.name}>
                      <span className="text-[9px] font-semibold text-gray-600 leading-tight">{col.name}</span>
                    </div>
                  ))}
                  {viewMode === 'weekly' && (
                    <div className="w-[52px] min-w-[52px] border-r bg-blue-50 flex flex-col items-center justify-center text-center px-0.5 py-1" title="סה״כ שעות">
                      <span className="text-[9px] font-semibold text-blue-700 leading-tight">שעות</span>
                    </div>
                  )}
                  {viewMode === 'weekly' && (
                    <div className="w-[28px] min-w-[28px] border-r bg-gray-100 flex items-center justify-center">
                      <button onClick={() => setShowSummaryColumnsDialog(true)} className="text-gray-400 hover:text-gray-600 p-1" title="נהל עמודות סיכום"><Plus className="w-3 h-3" /></button>
                    </div>
                  )}
                  <div className="flex-1 relative flex" dir="rtl">
                    {viewMode === 'daily' ? (
                      getDailyTimeSlots(zoomRange).map((hour) => (
                        <div key={hour} className="flex-1 text-xs text-gray-600 py-3 border-l text-center font-medium">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      ))
                    ) : (
                      getWeeklyTimeSlots(zoomRange, startOfWeek(currentDate, { weekStartsOn: 0 })).map((slot, idx) => (
                        <div key={idx} className={`flex-1 text-xs text-gray-600 py-3 text-center font-medium ${slot.hour === 0 ? 'border-l-2 border-l-gray-400' : ''}`}>
                          {slot.label && <div className="font-bold">{slot.label}</div>}
                          {slot.dateLabel && <div className="text-[9px] text-gray-500">{slot.dateLabel}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Worker rows */}
                {loading && !initialLoaded ? (
                  <div className="text-center p-8" dir="rtl">טוען...</div>
                ) : workers.length === 0 ? (
                  <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
                ) : (
                  workers.filter(w => {
                    if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
                    if (roleFilter !== "__all__") { const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []); if (!roles.includes(roleFilter)) return false; }
                    return true;
                  }).map((worker, index) => {
                    const availabilityShifts = getWorkerAvailabilityForDate(worker.id);
                    const workerTemplateShifts = (() => {
                      if (viewMode !== 'weekly') return getWorkerTemplateShifts(worker.id, dateString);
                      const wS = startOfWeek(currentDate, { weekStartsOn: 0 });
                      const all = [];
                      for (let _i = 0; _i < 7; _i++) all.push(...getWorkerTemplateShifts(worker.id, format(addDays(wS, _i), "yyyy-MM-dd")));
                      return all;
                    })();
                    const workerExtraTaskShifts = getWorkerExtraTaskShifts(worker.id);
                    const workerUnavailabilities = getWorkerUnavailabilityForDate(worker.id);
                    const sendStatus = getWorkerSendStatus(worker);
                    const actionClass = sendStatus === 'none' ? 'text-gray-400 hover:text-gray-500' : sendStatus === 'needs_update' ? 'text-green-500 hover:text-green-600' : 'text-gray-900 hover:text-gray-700';

                    return (
                      <React.Fragment key={worker.id}>
                      <div className={`flex border-b h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <div className="w-[220px] min-w-[220px] px-2 py-0.5 font-medium text-gray-800 border-r flex items-center gap-2 sticky left-0 bg-inherit z-20 h-8">
                          <WorkerLockButton worker={worker} onUpdate={refreshWorkers} />
                          <button onClick={() => sendWhatsAppNotification(worker)} className={`rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-50 ${actionClass}`} title="שלח משמרות בוואטסאפ" disabled={sendingWhatsApp}>
                            {sendingWhatsApp ? <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setSelectedWorkerForNotification(worker); setNotificationNotes(""); setShowNotificationDialog(true); }} className={`rounded p-1 transition-colors hover:bg-gray-100 ${actionClass}`} title="שלח לוח משמרות באימייל">
                            <Send className="w-4 h-4" />
                          </button>
                          <div className="flex items-center flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <span className="truncate block text-sm leading-tight">{worker.nickname}</span>
                              <WeeklySummary worker={worker} />
                            </div>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 p-0 mr-1" onClick={() => handleManualShiftAdd(worker)} title="הוסף חלון זמינות ידנית"><Plus className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        {viewMode === 'weekly' && summaryColumns.map(col => (
                          <div key={col.id} className={`w-[60px] min-w-[60px] border-r flex items-center justify-center h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <span className="text-xs font-bold text-gray-700">{getWorkerColumnCount(worker.id, col)}</span>
                          </div>
                        ))}
                        {viewMode === 'weekly' && (() => {
                          const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
                          let totalHrs = 0;
                          templateRows.forEach(row => {
                            if (!row.values || !Object.values(row.values).some(val => val === worker.id)) return;
                            const st = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
                            const et = row.values?.["סיום"] || row.values?.["שעת סיום"];
                            if (!st || !et) return;
                            const opDate = getOperationalStartDate(row.date, st);
                            const weekStartStr = format(weekStart, "yyyy-MM-dd");
                            const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
                            if (opDate < weekStartStr || opDate > weekEndStr) return;
                            const s = getOperationalMinutes(st);
                            const e = getOperationalEndMinutes(st, et);
                            totalHrs += Math.max(0, (e - s) / 60);
                          });
                          return <div className="w-[52px] min-w-[52px] border-r flex items-center justify-center h-8 bg-blue-50"><span className="text-xs font-bold text-blue-800">{totalHrs > 0 ? `${Math.round(totalHrs * 10) / 10}h` : '-'}</span></div>;
                        })()}
                        {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} />}
                        <div data-worker-id={worker.id} ref={el => { if (el) timelineRefs.current[worker.id] = el; }} className="flex-1 relative border-r cursor-crosshair h-8" dir="rtl" onMouseDown={(e) => handleMouseDown(e, worker, null, 'create')}>
                          <div className="absolute inset-0 flex h-8" dir="rtl">
                            {viewMode === 'daily' ? getDailyTimeSlots(zoomRange).map(hour => <div key={hour} className="flex-1 border-l time-slot h-8" />) : getWeeklyTimeSlots(zoomRange).map((slot, idx) => <div key={idx} className="flex-1 border-l time-slot h-8" />)}
                          </div>
                          <div className="absolute inset-0">
                            {viewMode === 'weekly' && [0,1,2,3,4,5,6].map(day => {
                              const pos = timeToPercentage("06:00", day, 'weekly', zoomRange);
                              if (pos < 0 || pos > 100) return null;
                              return <div key={`db-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${pos}%`, width: '1px', backgroundColor: 'rgba(80,80,80,0.25)', zIndex: 15 }} />;
                            })}
                            {availabilityShifts.map((shift, idx) => <AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />)}
                            {workerUnavailabilities.map(unavail => <UnavailabilityBar key={unavail.id} unavail={unavail} />)}
                            {workerTemplateShifts.map(ts => (
                              <React.Fragment key={ts.id}>
                                <AssignmentBar assignment={ts} />
                                {ts.briefing_time && <BriefingBar briefingTime={ts.briefing_time} shiftStartTime={ts.start_time} shiftEndTime={ts.end_time} dayIndex={viewMode === 'weekly' ? getDayIndexFromDate(ts.schedule_date || ts.date) : 0} viewMode={viewMode} zoomRange={zoomRange} timeToPercentage={timeToPercentage} />}
                              </React.Fragment>
                            ))}
                            {workerExtraTaskShifts.map(ets => <AssignmentBar key={ets.id} assignment={ets} />)}
                            <DragPreviewBar preview={dragPreview} workerId={worker.id} />
                          </div>
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <SummaryColumnsDialog open={showSummaryColumnsDialog} onOpenChange={setShowSummaryColumnsDialog} summaryColumns={summaryColumns} saveSummaryColumns={saveSummaryColumns} shiftStatuses={shiftStatuses} scheduleParams={scheduleParams} trackers={trackers} />
        <NotificationDialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog} viewMode={viewMode} currentDate={currentDate} selectedWorkerForNotification={selectedWorkerForNotification} notificationNotes={notificationNotes} setNotificationNotes={setNotificationNotes} getWorkerTemplateShifts={getWorkerTemplateShifts} getWorkerExtraTaskShifts={getWorkerExtraTaskShifts} sendNotification={sendNotification} />
        <TypeChangeDialog open={showTypeDialog} onOpenChange={setShowTypeDialog} handleChangeType={handleChangeType} />
        <ManualShiftDialog open={showManualDialog} onOpenChange={(v) => { setShowManualDialog(v); if (!v) { setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available' }); setEditingShift(null); } }} editingShift={editingShift} selectedWorkerForManual={selectedWorkerForManual} manualShiftData={manualShiftData} setManualShiftData={setManualShiftData} submitManualShift={submitManualShift} deleteShift={deleteManualShift} />
      </div>
    </div>

    {/* Fixed Zoom Control at Bottom */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg" style={{ direction: 'ltr', zIndex: 50, width: '100%', padding: '8px' }}>
      <div className="flex items-center gap-4 max-w-screen-2xl mx-auto">
        <div className="flex-1 relative bg-gray-200 rounded-full" style={{ height: '16px', minHeight: '16px' }}>
          <div className="absolute top-0 h-full bg-blue-400 rounded-full cursor-move hover:bg-blue-500 transition-colors" style={{ left: `${zoomRange.start}%`, width: `${zoomRange.end - zoomRange.start}%` }}
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              const startX = e.clientX, srs = zoomRange.start, sre = zoomRange.end, rw = sre - srs;
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              const hm = (me) => { const d = ((me.clientX - startX) / rect.width) * 100; let ns = srs + d, ne = sre + d; if (ns < 0) { ns = 0; ne = rw; } else if (ne > 100) { ne = 100; ns = 100 - rw; } setZoomRange({ start: ns, end: ne }); };
              const hu = () => { document.removeEventListener('mousemove', hm); document.removeEventListener('mouseup', hu); };
              document.addEventListener('mousemove', hm); document.addEventListener('mouseup', hu);
            }} />
          <div className="absolute bg-blue-600 rounded-l-full cursor-ew-resize hover:bg-blue-700 transition-colors" style={{ left: `${zoomRange.start}%`, top: '-2px', width: '16px', height: '20px', zIndex: 10 }}
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              const startX = e.clientX, ce = zoomRange.end, sv = zoomRange.start;
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              const hm = (me) => { const ns = Math.max(0, Math.min(ce - 5, sv + ((me.clientX - startX) / rect.width) * 100)); setZoomRange(prev => ({ start: ns, end: prev.end })); };
              const hu = () => { document.removeEventListener('mousemove', hm); document.removeEventListener('mouseup', hu); };
              document.addEventListener('mousemove', hm); document.addEventListener('mouseup', hu);
            }} />
          <div className="absolute bg-blue-600 rounded-r-full cursor-ew-resize hover:bg-blue-700 transition-colors" style={{ left: `${zoomRange.end}%`, top: '-2px', width: '16px', height: '20px', transform: 'translateX(-100%)', zIndex: 10 }}
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              const startX = e.clientX, cs = zoomRange.start, sv = zoomRange.end;
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              const hm = (me) => { const ne = Math.max(cs + 5, Math.min(100, sv + ((me.clientX - startX) / rect.width) * 100)); setZoomRange(prev => ({ start: prev.start, end: ne })); };
              const hu = () => { document.removeEventListener('mousemove', hm); document.removeEventListener('mouseup', hu); };
              document.addEventListener('mousemove', hm); document.addEventListener('mouseup', hu);
            }} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setZoomRange({ start: 0, end: 100 })} disabled={zoomRange.start === 0 && zoomRange.end === 100} className="shrink-0">איפוס</Button>
      </div>
    </div>
    </>
  );
}
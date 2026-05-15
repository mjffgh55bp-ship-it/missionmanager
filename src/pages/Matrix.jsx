import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePageState } from "@/hooks/usePageState";
import { base44 } from "@/api/base44Client";
import { getCachedAllSettings, getCachedWorkers, getCachedTemplates } from "@/lib/appDataCache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { getOperationalStartDate, getOperationalMinutes, getOperationalEndMinutes, parseTimeCellValue } from "@/lib/operationalDate";
import { getTimelineRangeStyle, getTimelinePointStyle } from "@/lib/matrixTimeUtils";
import { Send, Star, Check, Ban, Plus, MessageCircle, ZoomIn, ZoomOut } from "lucide-react";
import BriefingBar from "../components/matrix/BriefingBar";
import WorkerLockButton from "../components/matrix/WorkerLockButton";
import MasterControls from "../components/matrix/MasterControls";
import SummaryColumnsDialog from "../components/matrix/SummaryColumnsDialog";
import MatrixHeader from "../components/matrix/MatrixHeader";
import { NotificationDialog, TypeChangeDialog, ManualShiftDialog } from "../components/matrix/MatrixDialogs";

// ── Timeline constants ──────────────────────────────────────────────────────
const DAILY_TOTAL_MINUTES = 24 * 60;        // 1440
const WEEKLY_TOTAL_MINUTES = 7 * 24 * 60;  // 10080
const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const FIXED_COL_WIDTH = 220;      // worker name column px
const SUMMARY_COL_WIDTH = 60;     // each summary column
const SUMMARY_ADD_COL_WIDTH = 28; // the "+column" button

// ── Time slot generators ─────────────────────────────────────────────────────
const getDailyTimeSlots = () =>
  Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

const getWeeklyTimeSlots = (weekStartDate = null) => {
  const slots = [];
  for (let day = 0; day < 7; day++) {
    let dateLabel = null;
    if (weekStartDate) {
      const d = addDays(weekStartDate, day);
      dateLabel = format(d, 'd.M');
    }
    for (let hour = 0; hour < 24; hour++) {
      slots.push({ day, hour, label: hour === 0 ? DAYS_OF_WEEK[day] : null, dateLabel: hour === 0 ? dateLabel : null });
    }
  }
  return slots;
};

const timeToPixels = (timeStr, day = 0, viewMode = 'daily', ppm) => {
  if (!timeStr) return 0;
  const parsed = parseTimeCellValue(timeStr);
  if (isNaN(parsed.hour)) return 0;
  let totalMins;
  if (viewMode === 'weekly') {
    totalMins = (day + parsed.dayOffset) * 24 * 60 + parsed.hour * 60 + (parsed.minute || 0);
  } else {
    totalMins = getOperationalMinutes(timeStr);
  }
  return totalMins * ppm;
};

const endTimeToPixels = (startTimeStr, endTimeStr, viewMode = 'daily', ppm, dayIndex = 0) => {
  let endPx = timeToPixels(endTimeStr, dayIndex, viewMode, ppm);
  const startPx = timeToPixels(startTimeStr, dayIndex, viewMode, ppm);
  if (endPx <= startPx) {
    if (viewMode === 'weekly') {
      endPx += 7 * 24 * 60 * ppm;
    } else {
      endPx += DAILY_TOTAL_MINUTES * ppm;
    }
  }
  return endPx;
};

const getTimelineWidth = (viewMode, ppm) =>
  (viewMode === 'daily' ? DAILY_TOTAL_MINUTES : WEEKLY_TOTAL_MINUTES) * ppm;

const pixelsToTime = (px, viewMode = 'daily', ppm) => {
  const totalMins = px / ppm;
  if (viewMode === 'weekly') {
    const day = Math.min(6, Math.max(0, Math.floor(totalMins / (24 * 60))));
    const minsInDay = totalMins % (24 * 60);
    const h = Math.floor(minsInDay / 60);
    const m = Math.round((minsInDay % 60) / 15) * 15;
    const mf = m >= 60 ? 0 : m;
    const hf = m >= 60 ? (h + 1) % 24 : h;
    return { day, time: `${String(hf).padStart(2,'0')}:${String(mf).padStart(2,'0')}` };
  } else {
    const clockMins = (totalMins + 6 * 60) % (24 * 60);
    const h = Math.floor(clockMins / 60);
    const m = Math.round((clockMins % 60) / 15) * 15;
    const mf = m >= 60 ? 0 : m;
    const hf = m >= 60 ? (h + 1) % 24 : h;
    return { day: 0, time: `${String(hf).padStart(2,'0')}:${String(mf).padStart(2,'0')}` };
  }
};

// ── Pin icon SVG (pushpin outline style) ─────────────────────────────────────
const PinIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5"/>
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>
  </svg>
);

export default function Matrix() {
  const [_savedDate, _setSavedDate] = usePageState("matrix", "currentDate", null);
  const currentDate = _savedDate ? new Date(_savedDate) : new Date();
  const setCurrentDate = (d) => _setSavedDate(d instanceof Date ? d.toISOString() : d);

  const [viewMode, setViewMode] = usePageState("matrix", "viewMode", "daily");
  const [populationFilter, setPopulationFilter] = usePageState("matrix", "populationFilter", "__all__");
  const [roleFilter, setRoleFilter] = usePageState("matrix", "roleFilter", "__all__");
  const [statusFilter, setStatusFilter] = usePageState("matrix", "statusFilter", "__all__");

  // ── Pin state ────────────────────────────────────────────────────────────────
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('matrix_pinned_worker_panel') === 'true'; } catch { return false; }
  });
  const togglePin = () => {
    setPinned(prev => {
      const next = !prev;
      try { localStorage.setItem('matrix_pinned_worker_panel', String(next)); } catch {}
      return next;
    });
  };

  // ── Container width tracking ─────────────────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(0);
  const containerWidthRef = useRef(0);

  const [zoomPreset, setZoomPreset] = useState('fit');
  const [customPpm, setCustomPpm] = useState(null);

  const [summaryColumns, setSummaryColumns] = useState([]);

  const totalMins = viewMode === 'daily' ? DAILY_TOTAL_MINUTES : WEEKLY_TOTAL_MINUTES;

  const fixedColumnsWidth = useMemo(() => {
    return FIXED_COL_WIDTH +
      (viewMode === 'weekly' ? summaryColumns.length * SUMMARY_COL_WIDTH : 0) +
      (viewMode === 'weekly' ? SUMMARY_ADD_COL_WIDTH : 0);
  }, [viewMode, summaryColumns]);

  const ppm = useMemo(() => {
    if (!containerWidth) return 1;
    const available = Math.max(300, containerWidth - (pinned ? 0 : fixedColumnsWidth));
    const ppmFit  = available / totalMins;
    const ppm24h  = available / DAILY_TOTAL_MINUTES;
    const ppm12h  = available / 720;

    if (zoomPreset === 'fit')    return ppmFit;
    if (zoomPreset === '24h')    return ppm24h;
    if (zoomPreset === '12h')    return ppm12h;
    if (zoomPreset === 'custom' && customPpm !== null) {
      return Math.max(ppmFit, customPpm);
    }
    return ppmFit;
  }, [containerWidth, fixedColumnsWidth, totalMins, zoomPreset, customPpm, pinned]);

  const [workers, setWorkers] = useState([]);
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
  const [showSummaryColumnsDialog, setShowSummaryColumnsDialog] = useState(false);
  const [scheduleParams, setScheduleParams] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [trackerEntries, setTrackerEntries] = useState([]);
  const [signupMode, setSignupMode] = useState("allow_over_sign_up");
  const [savingSignupMode, setSavingSignupMode] = useState(false);
  const settingsIdCache = useRef({});

  // ── Scroll refs ──────────────────────────────────────────────────────────────
  // Legacy single-container (unpinned)
  const scrollContainerRef = useRef(null);
  // Split layout (pinned)
  const workerPanelRef = useRef(null);        // fixed panel — vertical scroll only
  const timelineScrollRef = useRef(null);     // timeline — both axes
  const timelineHeaderRef = useRef(null);     // timeline header — horizontal sync only
  const vScrollSyncRef = useRef(false);       // guard against scroll loop

  const midMouseDragRef = useRef(null);
  const ppmRef = useRef(ppm);
  ppmRef.current = ppm;

  const timelineWidth = useMemo(() => totalMins * ppm, [totalMins, ppm]);
  const totalMatrixWidth = useMemo(() => fixedColumnsWidth + timelineWidth, [fixedColumnsWidth, timelineWidth]);

  // ── Container width: track the relevant scroll container ─────────────────────
  useEffect(() => {
    const getTarget = () => pinned ? timelineScrollRef.current : scrollContainerRef.current;
    let ro;
    const update = () => {
      const sc = getTarget();
      if (!sc) return;
      const w = sc.clientWidth;
      if (w !== containerWidthRef.current) {
        containerWidthRef.current = w;
        setContainerWidth(w);
      }
    };
    update();
    ro = new ResizeObserver(update);
    const sc = getTarget();
    if (sc) ro.observe(sc);
    return () => ro && ro.disconnect();
  }, [pinned]);

  // Also remeasure when pinned changes
  useEffect(() => {
    setTimeout(() => {
      const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
      if (!sc) return;
      const w = sc.clientWidth;
      containerWidthRef.current = w;
      setContainerWidth(w);
    }, 50);
  }, [pinned]);

  // ── Vertical scroll sync (pinned mode) ───────────────────────────────────────
  useEffect(() => {
    if (!pinned) return;
    const panel = workerPanelRef.current;
    const timeline = timelineScrollRef.current;
    if (!panel || !timeline) return;

    const syncFromTimeline = () => {
      if (vScrollSyncRef.current) return;
      vScrollSyncRef.current = true;
      panel.scrollTop = timeline.scrollTop;
      vScrollSyncRef.current = false;
    };
    const syncFromPanel = () => {
      if (vScrollSyncRef.current) return;
      vScrollSyncRef.current = true;
      timeline.scrollTop = panel.scrollTop;
      vScrollSyncRef.current = false;
    };

    timeline.addEventListener('scroll', syncFromTimeline);
    panel.addEventListener('scroll', syncFromPanel);
    return () => {
      timeline.removeEventListener('scroll', syncFromTimeline);
      panel.removeEventListener('scroll', syncFromPanel);
    };
  }, [pinned]);

  // ── Horizontal scroll sync: timeline body → timeline header (pinned) ─────────
  useEffect(() => {
    if (!pinned) return;
    const body = timelineScrollRef.current;
    const header = timelineHeaderRef.current;
    if (!body || !header) return;
    const sync = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', sync);
    return () => body.removeEventListener('scroll', sync);
  }, [pinned]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const applyZoom = useCallback((newPpmRaw, focalClientX = null) => {
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    const oldPpm = ppmRef.current;
    if (!containerWidth) return;
    const fixedW = pinned ? 0 : (FIXED_COL_WIDTH +
      (viewMode === 'weekly' ? summaryColumns.length * SUMMARY_COL_WIDTH + SUMMARY_ADD_COL_WIDTH : 0));
    const available = Math.max(300, containerWidth - fixedW);
    const ppmFit = available / totalMins;
    const newPpm = Math.max(ppmFit, newPpmRaw);

    if (Math.abs(newPpm - oldPpm) < 0.0001) return;

    setZoomPreset('custom');
    setCustomPpm(newPpm);

    if (sc) {
      const rect = sc.getBoundingClientRect();
      const focalX = focalClientX !== null ? (focalClientX - rect.left) : sc.clientWidth / 2;
      const minuteUnderCursor = (sc.scrollLeft + focalX) / oldPpm;
      const newScrollLeft = minuteUnderCursor * newPpm - focalX;
      requestAnimationFrame(() => {
        const s = pinned ? timelineScrollRef.current : scrollContainerRef.current;
        if (!s) return;
        const maxScroll = s.scrollWidth - s.clientWidth;
        s.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
      });
    }
  }, [containerWidth, totalMins, viewMode, summaryColumns, pinned]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      applyZoom(ppmRef.current * factor, e.clientX);
    }
  }, [applyZoom]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (!sc) return;
    midMouseDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initScrollLeft: sc.scrollLeft,
      initScrollTop: sc.scrollTop,
    };
    sc.style.cursor = 'grabbing';
  }, [pinned]);

  const handlePointerMove = useCallback((e) => {
    if (!midMouseDragRef.current) return;
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (!sc) return;
    const { startX, startY, initScrollLeft, initScrollTop } = midMouseDragRef.current;
    sc.scrollLeft = initScrollLeft - (e.clientX - startX);
    sc.scrollTop  = initScrollTop  - (e.clientY - startY);
  }, [pinned]);

  const handlePointerUp = useCallback((e) => {
    if (e.button !== 1) return;
    midMouseDragRef.current = null;
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (sc) sc.style.cursor = '';
  }, [pinned]);

  // Attach wheel listener to the relevant scroll container
  useEffect(() => {
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (!sc) return;
    const onWheel = (e) => handleWheel(e);
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, [handleWheel, pinned]);

  const zoomIn  = () => applyZoom(ppmRef.current * 1.25);
  const zoomOut = () => applyZoom(ppmRef.current * 0.8);

  const applyPreset = (preset) => {
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (preset === 'auto' || preset === 'fit') setZoomPreset('fit');
    else if (preset === 'full' || preset === '24h') setZoomPreset('24h');
    else if (preset === '12h') setZoomPreset('12h');
    setCustomPpm(null);
    if (sc) requestAnimationFrame(() => { sc.scrollLeft = 0; });
  };

  useEffect(() => {
    setZoomPreset('fit');
    setCustomPpm(null);
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (sc) sc.scrollLeft = 0;
  }, [viewMode]);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => { loadStaticData(); }, []);
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    loadDynamicData(false);
  }, [currentDate, viewMode]);
  useEffect(() => {
    const unsubTemplateRow = base44.entities.TemplateRow.subscribe(() => { debouncedLoadDataRef.current(true); });
    const onVisibility = () => { if (document.visibilityState === 'visible') debouncedLoadDataRef.current(true); };
    document.addEventListener('visibilitychange', onVisibility);
    const onTemplateRowsUpdated = () => { debouncedLoadDataRef.current(true); };
    window.addEventListener('templateRowsUpdated', onTemplateRowsUpdated);
    return () => {
      unsubTemplateRow();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('templateRowsUpdated', onTemplateRowsUpdated);
    };
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
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      const dateStr = format(currentDate, "yyyy-MM-dd");

      const availabilitiesData = await base44.entities.Availability.list();
      await new Promise(r => setTimeout(r, 100));
      const unavailabilitiesData = viewMode === "daily"
        ? await base44.entities.Unavailability.filter({ date: dateStr })
        : await base44.entities.Unavailability.list();
      await new Promise(r => setTimeout(r, 100));

      let filteredTemplateRows = [];
      if (viewMode === "daily") {
        filteredTemplateRows = await base44.entities.TemplateRow.filter({ date: dateStr });
      } else {
        const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
        const perDayRows = await Promise.all(weekDates.map(d => base44.entities.TemplateRow.filter({ date: d })));
        filteredTemplateRows = perDayRows.flat();
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

      const allTemplatesData = await getCachedTemplates(base44.entities);
      await new Promise(r => setTimeout(r, 100));
      const trackerEntriesData = await base44.entities.TrackerEntry.list();

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

  // ── Data helpers ─────────────────────────────────────────────────────────────
  const isWorkerAssignedToRow = (row, workerId, template) => {
    if (!row.values || !workerId) return { assigned: false, workerColumnName: null };
    const columns = template?.columns || [];
    for (const col of columns) {
      if (col.type !== "worker") continue;
      const val = row.values[col.name];
      if (val === workerId) return { assigned: true, workerColumnName: col.name };
      if (Array.isArray(val) && val.includes(workerId)) return { assigned: true, workerColumnName: col.name };
    }
    return { assigned: false, workerColumnName: null };
  };

  const getWorkerTemplateShifts = (workerId, date = null) => {
    const targetDate = date || dateString;
    const shifts = [];
    templateRows.forEach(row => {
      if (!row.values) return;
      if (row.date !== targetDate) return;
      const template = allTemplates.find(t => t.id === row.template_id);
      if (!template) return;
      const isContinuation = row.values.is_continuation;
      const sourceRowId = row.values.continuation_source_row_id;
      let assignedResult = { assigned: false, workerColumnName: null };
      let briefingTime = row.values?.["תדריך"];
      if (isContinuation && sourceRowId) {
        const sourceRow = templateRows.find(r => r.id === sourceRowId);
        if (sourceRow && sourceRow.values) {
          const sourceTemplate = allTemplates.find(t => t.id === sourceRow.template_id) || template;
          assignedResult = isWorkerAssignedToRow(sourceRow, workerId, sourceTemplate);
          if (!briefingTime) briefingTime = sourceRow.values?.["תדריך"];
        }
      } else {
        assignedResult = isWorkerAssignedToRow(row, workerId, template);
      }
      if (!assignedResult.assigned) return;
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
      if (!startTime || !endTime) return;
      shifts.push({
        id: `schedule_${row.id}_${assignedResult.workerColumnName}_${workerId}`,
        source: "schedule",
        template_row_id: row.id,
        template_id: row.template_id,
        group_id: row.group_id || "default",
        schedule_date: row.date,
        date: getOperationalStartDate(row.date, startTime),
        worker_id: workerId,
        worker_column_name: assignedResult.workerColumnName,
        start_time: startTime,
        end_time: endTime,
        briefing_time: briefingTime,
        food_cart_name: template.name || row.template_name,
        hours: null,
        status: row.values?.status || null,
        isTemplateShift: true
      });
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

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = (e, worker, shift, action, dayIndex = 0) => {
    e.preventDefault(); e.stopPropagation();
    if (action === 'move' && e.detail === 2) return;
    const timeline = timelineRefs.current[worker.id];
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const pxFromRight = rect.width - (e.clientX - rect.left);
    const startPxFromRight = Math.max(0, Math.min(timelineWidth, pxFromRight));
    setDragging({ workerId: worker.id, worker, shift, action, startPxFromRight, originalStart: shift?.start_time, originalEnd: shift?.end_time, originalDay: viewMode === 'weekly' ? (shift ? getDayIndexFromDate(shift.date) : dayIndex) : 0, rect });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { worker, shift, action, startPxFromRight, originalStart, originalEnd, originalDay, rect } = dragging;
    const currentPxFromRight = Math.max(0, Math.min(timelineWidth, rect.width - (e.clientX - rect.left)));
    const rightToTimelinePx = (pxR) => Math.max(0, timelineWidth - pxR);
    let newStart = originalStart, newEnd = originalEnd, newDay = originalDay || 0;
    if (action === 'create') {
      const [minPx, maxPx] = [Math.min(startPxFromRight, currentPxFromRight), Math.max(startPxFromRight, currentPxFromRight)];
      const sd = pixelsToTime(rightToTimelinePx(maxPx), viewMode, ppm);
      const ed = pixelsToTime(rightToTimelinePx(minPx), viewMode, ppm);
      newStart = sd.time; newEnd = ed.time; newDay = sd.day;
    } else if (action === 'resize-start') {
      const d = pixelsToTime(rightToTimelinePx(currentPxFromRight), viewMode, ppm);
      newStart = d.time; newDay = d.day;
    } else if (action === 'resize-end') {
      newEnd = pixelsToTime(rightToTimelinePx(currentPxFromRight), viewMode, ppm).time;
    } else if (action === 'move') {
      const origStartPx = timeToPixels(originalStart, originalDay || 0, viewMode, ppm);
      const origEndPx = endTimeToPixels(originalStart, originalEnd, viewMode, ppm, originalDay || 0);
      const widthPx = origEndPx - origStartPx;
      const origStartPxFromRight = timelineWidth - origStartPx;
      const delta = currentPxFromRight - startPxFromRight;
      const newStartPxFromRight = origStartPxFromRight + delta;
      const newStartPxFromLeft = Math.max(0, Math.min(timelineWidth - widthPx, timelineWidth - newStartPxFromRight));
      const sd = pixelsToTime(newStartPxFromLeft, viewMode, ppm);
      const ed = pixelsToTime(Math.min(timelineWidth, newStartPxFromLeft + widthPx), viewMode, ppm);
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
    try {
      await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
      debouncedLoadData();
    } catch (error) {
      await new Promise(r => setTimeout(r, 500));
      try { await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts }); debouncedLoadData(); } catch {}
    }
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
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      const { assigned } = isWorkerAssignedToRow(row, workerId, tmpl);
      if (!assigned) return;
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
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        const { assigned } = isWorkerAssignedToRow(row, workerId, tmpl);
        if (!assigned) return;
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

  // ── Bar Components ────────────────────────────────────────────────────────────
  const AssignmentBar = ({ assignment }) => {
    const positionDate = assignment.schedule_date || assignment.date;
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(positionDate) : 0;
    const startPx = timeToPixels(assignment.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(assignment.start_time, assignment.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 2);
    const rightPx = startPx;
    if (startPx < 0 || startPx > timelineWidth) return null;
    const isTemplate = assignment.isTemplateShift;
    const standby = isStandbyStatus(assignment.status);
    if (standby) {
      const borderColor = isTemplate ? '#a855f7' : '#3b82f6';
      return (
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <div className="absolute h-full rounded-sm z-20 flex items-center justify-center px-1 overflow-hidden" style={{ right: `${rightPx}px`, width: `${widthPx}px`, backgroundColor: 'transparent', border: `2px dashed ${borderColor}` }}>
            <span className="text-[9px] font-bold truncate" style={{ color: borderColor }}>{assignment.status}</span>
          </div>
        </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
          <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p><p>סטטוס כוננות: {assignment.status}</p>
        </TooltipContent></Tooltip></TooltipProvider>
      );
    }
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div className={`absolute h-full border-r-2 rounded-sm flex flex-col items-center justify-center px-2 overflow-hidden z-20 ${isTemplate ? "bg-purple-400 border-purple-600" : assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"}`} style={{ right: `${rightPx}px`, width: `${widthPx}px` }}>
          {!isTemplate && <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>}
          {assignment.status && <span className="text-white text-[8px] truncate">{assignment.status}</span>}
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p>{assignment.status && <p>סטטוס: {assignment.status}</p>}
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  const timesOverlap = (aStart, aEnd, bStart, bEnd) => {
    const aStartMin = getOperationalMinutes(aStart);
    const aEndMin = getOperationalEndMinutes(aStart, aEnd);
    const bStartMin = getOperationalMinutes(bStart);
    const bEndMin = getOperationalEndMinutes(bStart, bEnd);
    return aStartMin < bEndMin && aEndMin > bStartMin;
  };

  const AvailabilityBar = ({ shift, worker }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shift.date) : 0;
    const startPx = timeToPixels(shift.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(shift.start_time, shift.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    const rightPx = startPx;
    if (startPx < 0 || startPx > timelineWidth) return null;
    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };
    const borderColors = { wanted: '#16a34a', available: '#3b82f6', unavailable: '#dc2626' };
    const borderColor = borderColors[shift.type] || '#3b82f6';
    const overlappingAssignments = templateRows.filter(r => {
      if (r.date !== shift.date || !r.values) return false;
      const tmpl = allTemplates.find(t => t.id === r.template_id);
      if (!tmpl) return false;
      const { assigned } = isWorkerAssignedToRow(r, worker.id, tmpl);
      if (!assigned) return false;
      const st = r.values?.["התחלה"] || r.values?.["שעת התחלה"];
      const et = r.values?.["סיום"] || r.values?.["שעת סיום"];
      return st && et && timesOverlap(shift.start_time, shift.end_time, st, et);
    }).map(r => ({ start_time: r.values?.["התחלה"] || r.values?.["שעת התחלה"], end_time: r.values?.["סיום"] || r.values?.["שעת סיום"], status: r.values?.status || null }));
    return (
      <div className="absolute h-full rounded-sm z-10 cursor-move overflow-visible" style={{ right: `${rightPx}px`, width: `${widthPx}px`, backgroundColor: 'transparent', border: `2px solid ${borderColor}` }} onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'move', dayIndex); }} onDoubleClick={(e) => handleShiftDoubleClick(e, worker, shift)}>
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
          const totalM = avE - avS;
          return <div key={i} className="absolute top-0 h-full" style={{ left: `${((overS - avS) / totalM) * 100}%`, width: `${((overE - overS) / totalM) * 100}%`, backgroundColor: isStandbyStatus(ass.status) ? 'rgba(200,200,210,0.55)' : 'rgba(192,132,252,0.55)', pointerEvents: 'none' }} />;
        })}
      </div>
    );
  };

  const UnavailabilityBar = ({ unavail }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(unavail.date) : 0;
    const startPx = timeToPixels(unavail.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(unavail.start_time, unavail.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    const rightPx = startPx;
    if (startPx < 0 || startPx > timelineWidth) return null;
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${unavail.reason === 'overseas' ? 'bg-red-200 border-r-2 border-red-500' : 'bg-gray-300 border-r-2 border-gray-500'}`} style={{ right: `${rightPx}px`, width: `${widthPx}px` }}>
          <Ban className="w-3 h-3 text-gray-600" />
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold capitalize">{unavail.reason}</p><p>{unavail.start_time} - {unavail.end_time}</p>
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  const DragPreviewBar = ({ preview, workerId }) => {
    if (!preview || preview.workerId !== workerId) return null;
    const dayIndex = preview.day || 0;
    const startPx = timeToPixels(preview.start, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(preview.start, preview.end, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    const rightPx = startPx;
    return <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80" style={{ right: `${rightPx}px`, width: `${widthPx}px` }}><span className="text-xs font-bold">{preview.start} - {preview.end}</span></div>;
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
    return <div className="flex gap-0.5 items-center">{days.map((d, i) => <div key={i} className={`text-[9px] font-medium leading-tight ${d.working ? 'text-green-600' : 'text-gray-300'}`} title={`${d.day}: ${d.working ? d.hours.toFixed(1) + 'h' : 'חופש'}`}>{d.day}</div>)}</div>;
  };

  const dailySlots = useMemo(() => getDailyTimeSlots(), []);
  const weeklySlots = useMemo(
    () => getWeeklyTimeSlots(startOfWeek(currentDate, { weekStartsOn: 0 })),
    [currentDate]
  );

  // ── Filtered workers ──────────────────────────────────────────────────────────
  const filteredWorkers = useMemo(() => workers.filter(w => {
    if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
    if (roleFilter !== "__all__") { const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []); if (!roles.includes(roleFilter)) return false; }
    return true;
  }), [workers, populationFilter, roleFilter]);

  // ── Row height: fixed 32px (h-8) — constant for both panels ──────────────────
  const ROW_H = 32;

  // ── Render helpers ────────────────────────────────────────────────────────────
  const renderTimelineHeader = () => (
    <div className="flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
      {viewMode === 'daily' ? (
        dailySlots.map((hour) => (
          <div key={hour} className="shrink-0 text-xs text-gray-600 py-3 border-l text-center font-medium overflow-hidden" style={{ width: `${60 * ppm}px` }}>
            {String(hour).padStart(2, '0')}:00
          </div>
        ))
      ) : (
        weeklySlots.map((slot, idx) => (
          <div key={idx} className={`shrink-0 text-xs text-gray-600 py-1 text-center font-medium overflow-hidden ${slot.hour === 0 ? 'border-l-2 border-l-gray-400' : 'border-l border-l-gray-200'}`} style={{ width: `${60 * ppm}px` }}>
            {slot.label && <div className="font-bold text-gray-800 text-[10px] leading-tight">{slot.label}</div>}
            {slot.dateLabel && <div className="text-[8px] text-gray-500 leading-tight">{slot.dateLabel}</div>}
            <div className={`text-[8px] leading-tight ${slot.hour === 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
              {String(slot.hour).padStart(2, '0')}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderWorkerCell = (worker, index) => {
    const sendStatus = getWorkerSendStatus(worker);
    const actionClass = sendStatus === 'none' ? 'text-gray-400 hover:text-gray-500' : sendStatus === 'needs_update' ? 'text-green-500 hover:text-green-600' : 'text-gray-900 hover:text-gray-700';
    return (
      <div
        key={worker.id}
        className={`flex items-center border-b h-8 shrink-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
        style={{ height: `${ROW_H}px` }}
      >
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
    );
  };

  const renderSummaryCell = (worker, col, index) => (
    <div key={col.id} className={`w-[60px] min-w-[60px] border-r flex items-center justify-center h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} style={{ height: `${ROW_H}px` }}>
      <span className="text-xs font-bold text-gray-700">{getWorkerColumnCount(worker.id, col)}</span>
    </div>
  );

  const renderTimelineRow = (worker, index) => {
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

    return (
      <div
        key={worker.id}
        className={`relative border-b cursor-crosshair shrink-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
        style={{ width: `${timelineWidth}px`, height: `${ROW_H}px` }}
        dir="rtl"
        data-worker-id={worker.id}
        ref={el => { if (el) timelineRefs.current[worker.id] = el; }}
        onMouseDown={(e) => handleMouseDown(e, worker, null, 'create')}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 flex" dir="rtl">
          {viewMode === 'daily'
            ? dailySlots.map(hour => <div key={hour} className="shrink-0 border-l time-slot h-full" style={{ width: `${60 * ppm}px` }} />)
            : weeklySlots.map((slot, idx) => <div key={idx} className="shrink-0 border-l time-slot h-full" style={{ width: `${60 * ppm}px` }} />)
          }
        </div>
        {/* Day boundary lines (weekly) */}
        <div className="absolute inset-0">
          {viewMode === 'weekly' && [0,1,2,3,4,5,6].map(day => {
            const px = timeToPixels("06:00", day, 'weekly', ppm);
            return <div key={`db-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '1px', backgroundColor: 'rgba(80,80,80,0.25)', zIndex: 15 }} />;
          })}
          {availabilityShifts.map((shift, idx) => <AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />)}
          {workerUnavailabilities.map(unavail => <UnavailabilityBar key={unavail.id} unavail={unavail} />)}
          {workerTemplateShifts.map(ts => (
            <React.Fragment key={ts.id}>
              <AssignmentBar assignment={ts} />
              {ts.briefing_time && <BriefingBar
                briefingTime={ts.briefing_time}
                shiftStartTime={ts.start_time}
                shiftEndTime={ts.end_time}
                dayIndex={viewMode === 'weekly' ? getDayIndexFromDate(ts.schedule_date || ts.date) : 0}
                viewMode={viewMode}
                ppm={ppm}
                timeToPixels={timeToPixels}
              />}
            </React.Fragment>
          ))}
          {workerExtraTaskShifts.map(ets => <AssignmentBar key={ets.id} assignment={ets} />)}
          <DragPreviewBar preview={dragPreview} workerId={worker.id} />
        </div>
      </div>
    );
  };

  // ── PINNED LAYOUT ─────────────────────────────────────────────────────────────
  const renderPinnedLayout = () => (
    <div className="flex flex-1 min-h-0" dir="rtl">
      {/* ── Fixed Worker Panel (right side, RTL) ── */}
      <div
        className="flex flex-col flex-shrink-0 bg-white z-20"
        style={{
          width: `${fixedColumnsWidth}px`,
          boxShadow: '-4px 0 8px rgba(0,0,0,0.06)',
          borderLeft: '1px solid #e5e7eb',
        }}
      >
        {/* Worker panel header */}
        <div className="flex-shrink-0 bg-gray-100 border-b z-10" style={{ height: '40px' }}>
          <div className="flex items-center h-full">
            {/* Pin icon in the top-right corner of the fixed panel header */}
            <div className="w-[220px] min-w-[220px] px-2 flex items-center gap-1 h-full border-r">
              <MasterControls
                workers={workers} populationFilter={populationFilter} roleFilter={roleFilter}
                getWorkerSendStatus={getWorkerSendStatus}
                onSendWhatsApp={async (visibleWorkers) => { for (const w of visibleWorkers) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
                onSendEmail={async (visibleWorkers) => { for (const w of visibleWorkers) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
                sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
              />
              {/* Pin indicator inside fixed panel header */}
              <div className="ml-auto flex-shrink-0 text-green-600" title="עמודות עובדים נעוצות">
                <PinIcon size={13} />
              </div>
            </div>
            {viewMode === 'weekly' && summaryColumns.map(col => (
              <div key={col.id} className="w-[60px] min-w-[60px] border-r bg-gray-100 flex flex-col items-center justify-center text-center px-0.5 py-1 h-full" title={col.name}>
                <span className="text-[9px] font-semibold text-gray-600 leading-tight">{col.name}</span>
              </div>
            ))}
            {viewMode === 'weekly' && (
              <div className="w-[28px] min-w-[28px] border-r bg-gray-100 flex items-center justify-center h-full">
                <button onClick={() => setShowSummaryColumnsDialog(true)} className="text-gray-400 hover:text-gray-600 p-1" title="נהל עמודות סיכום"><Plus className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Worker panel body — vertical scroll only */}
        <div
          ref={workerPanelRef}
          className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading && !initialLoaded ? (
            <div className="text-center p-8" dir="rtl">טוען...</div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
          ) : (
            filteredWorkers.map((worker, index) => (
              <div key={worker.id} className="flex" style={{ height: `${ROW_H}px` }}>
                {/* Worker name + actions */}
                <div
                  className={`w-[220px] min-w-[220px] px-2 py-0.5 font-medium text-gray-800 border-r flex items-center gap-2 h-full ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  {renderWorkerCell(worker, index)}
                </div>
                {/* Summary columns */}
                {viewMode === 'weekly' && summaryColumns.map(col => renderSummaryCell(worker, col, index))}
                {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-full ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} />}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Scrollable Timeline Panel (left side, RTL) ── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Timeline header — horizontal scroll synced with body, no scrollbar shown */}
        <div
          ref={timelineHeaderRef}
          className="flex-shrink-0 bg-gray-100 border-b overflow-x-hidden"
          style={{ height: '40px' }}
          dir="ltr"
        >
          <div style={{ width: `${timelineWidth}px` }}>
            {renderTimelineHeader()}
          </div>
        </div>

        {/* Timeline body — both axes scrollable */}
        <div
          ref={timelineScrollRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
          dir="ltr"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
        >
          <div dir="rtl" style={{ width: `${timelineWidth}px` }}>
            {loading && !initialLoaded ? null : (
              filteredWorkers.map((worker, index) => renderTimelineRow(worker, index))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── CLASSIC (UNPINNED) LAYOUT — identical to original ─────────────────────────
  const renderClassicLayout = () => (
    <div
      ref={scrollContainerRef}
      dir="ltr"
      className="overflow-x-auto overflow-y-auto flex-1 min-h-0"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
    >
      <div dir="rtl" style={{ width: `${totalMatrixWidth}px`, minWidth: `${totalMatrixWidth}px` }}>
        {/* Sticky header row */}
        <div className="flex sticky top-0 bg-gray-100 z-30 border-b" style={{ width: `${totalMatrixWidth}px` }}>
          <div className="w-[220px] min-w-[220px] p-3 font-semibold text-gray-700 border-r sticky left-0 bg-gray-100 z-30 flex items-center justify-start gap-2" dir="rtl">
            <MasterControls
              workers={workers} populationFilter={populationFilter} roleFilter={roleFilter}
              getWorkerSendStatus={getWorkerSendStatus}
              onSendWhatsApp={async (visibleWorkers) => { for (const w of visibleWorkers) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
              onSendEmail={async (visibleWorkers) => { for (const w of visibleWorkers) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
              sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
            />
          </div>
          {viewMode === 'weekly' && summaryColumns.map(col => (
            <div key={col.id} className="w-[60px] min-w-[60px] border-r bg-gray-100 flex flex-col items-center justify-center text-center px-0.5 py-1" title={col.name}>
              <span className="text-[9px] font-semibold text-gray-600 leading-tight">{col.name}</span>
            </div>
          ))}
          {viewMode === 'weekly' && (
            <div className="w-[28px] min-w-[28px] border-r bg-gray-100 flex items-center justify-center">
              <button onClick={() => setShowSummaryColumnsDialog(true)} className="text-gray-400 hover:text-gray-600 p-1" title="נהל עמודות סיכום"><Plus className="w-3 h-3" /></button>
            </div>
          )}
          <div className="flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
            {renderTimelineHeader()}
          </div>
        </div>

        {/* Worker rows */}
        {loading && !initialLoaded ? (
          <div className="text-center p-8" dir="rtl">טוען...</div>
        ) : workers.length === 0 ? (
          <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
        ) : (
          filteredWorkers.map((worker, index) => {
            const sendStatus = getWorkerSendStatus(worker);
            const actionClass = sendStatus === 'none' ? 'text-gray-400 hover:text-gray-500' : sendStatus === 'needs_update' ? 'text-green-500 hover:text-green-600' : 'text-gray-900 hover:text-gray-700';
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

            return (
              <React.Fragment key={worker.id}>
                <div className={`flex border-b h-8 shrink-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} style={{ width: `${totalMatrixWidth}px` }}>
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
                  {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} />}
                  <div
                    data-worker-id={worker.id}
                    ref={el => { if (el) timelineRefs.current[worker.id] = el; }}
                    className="relative border-r cursor-crosshair h-8 shrink-0"
                    dir="rtl"
                    style={{ width: `${timelineWidth}px` }}
                    onMouseDown={(e) => handleMouseDown(e, worker, null, 'create')}
                  >
                    <div className="absolute inset-0 flex h-8" dir="rtl">
                      {viewMode === 'daily'
                        ? dailySlots.map(hour => <div key={hour} className="shrink-0 border-l time-slot h-8" style={{ width: `${60 * ppm}px` }} />)
                        : weeklySlots.map((slot, idx) => <div key={idx} className="shrink-0 border-l time-slot h-8" style={{ width: `${60 * ppm}px` }} />)
                      }
                    </div>
                    <div className="absolute inset-0">
                      {viewMode === 'weekly' && [0,1,2,3,4,5,6].map(day => {
                        const px = timeToPixels("06:00", day, 'weekly', ppm);
                        return <div key={`db-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '1px', backgroundColor: 'rgba(80,80,80,0.25)', zIndex: 15 }} />;
                      })}
                      {availabilityShifts.map((shift, idx) => <AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />)}
                      {workerUnavailabilities.map(unavail => <UnavailabilityBar key={unavail.id} unavail={unavail} />)}
                      {workerTemplateShifts.map(ts => (
                        <React.Fragment key={ts.id}>
                          <AssignmentBar assignment={ts} />
                          {ts.briefing_time && <BriefingBar
                            briefingTime={ts.briefing_time}
                            shiftStartTime={ts.start_time}
                            shiftEndTime={ts.end_time}
                            dayIndex={viewMode === 'weekly' ? getDayIndexFromDate(ts.schedule_date || ts.date) : 0}
                            viewMode={viewMode}
                            ppm={ppm}
                            timeToPixels={timeToPixels}
                          />}
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
  );

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 p-2"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      dir="rtl"
    >
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <Card className="border-none shadow-lg mb-2 flex-shrink-0">
          <MatrixHeader
            currentDate={currentDate} setCurrentDate={setCurrentDate}
            viewMode={viewMode} setViewMode={setViewMode}
            populationFilter={populationFilter} setPopulationFilter={setPopulationFilter}
            roleFilter={roleFilter} setRoleFilter={setRoleFilter}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            populations={populations} workerRoles={workerRoles} shiftStatuses={shiftStatuses}
            signupMode={signupMode} saveSignupMode={saveSignupMode} savingSignupMode={savingSignupMode}
          />
        </Card>

        {/* Zoom controls bar */}
        <div className="flex items-center gap-2 mb-1 px-1 flex-shrink-0" dir="rtl">
          <span className="text-xs text-gray-500 font-medium">רזולוציה:</span>
          <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 text-sm font-bold transition-colors" title="הקטן רזולוציית זמן">−</button>
          <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 text-sm font-bold transition-colors" title="הגדל רזולוציית זמן">+</button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button onClick={() => applyPreset('auto')} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors">התאם ליום</button>
          <button onClick={() => applyPreset('full')} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors">24h</button>
          <button onClick={() => applyPreset('12h')} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors">12h</button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          {/* Pin toggle button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={togglePin}
                  className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
                    pinned
                      ? 'bg-green-50 border-green-400 text-green-600 hover:bg-green-100'
                      : 'bg-white border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                  }`}
                  title="נעץ עמודות עובדים"
                >
                  <PinIcon size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent dir="rtl">
                {pinned ? 'בטל נעיצת עמודות עובדים' : 'נעץ עמודות עובדים'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-[10px] text-gray-400 mr-2">Ctrl+גלגל לזום · גרירת גלגל לגלילה</span>
        </div>

        <Card className="border-none shadow-lg flex-1 min-h-0 flex flex-col">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
            {pinned ? renderPinnedLayout() : renderClassicLayout()}
          </CardContent>
        </Card>

        <SummaryColumnsDialog open={showSummaryColumnsDialog} onOpenChange={setShowSummaryColumnsDialog} summaryColumns={summaryColumns} saveSummaryColumns={saveSummaryColumns} shiftStatuses={shiftStatuses} scheduleParams={scheduleParams} trackers={trackers} />
        <NotificationDialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog} viewMode={viewMode} currentDate={currentDate} selectedWorkerForNotification={selectedWorkerForNotification} notificationNotes={notificationNotes} setNotificationNotes={setNotificationNotes} getWorkerTemplateShifts={getWorkerTemplateShifts} getWorkerExtraTaskShifts={getWorkerExtraTaskShifts} sendNotification={sendNotification} />
        <TypeChangeDialog open={showTypeDialog} onOpenChange={setShowTypeDialog} handleChangeType={handleChangeType} />
        <ManualShiftDialog open={showManualDialog} onOpenChange={(v) => { setShowManualDialog(v); if (!v) { setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available' }); setEditingShift(null); } }} editingShift={editingShift} selectedWorkerForManual={selectedWorkerForManual} manualShiftData={manualShiftData} setManualShiftData={setManualShiftData} submitManualShift={submitManualShift} deleteShift={deleteManualShift} />
      </div>
    </div>
  );
}
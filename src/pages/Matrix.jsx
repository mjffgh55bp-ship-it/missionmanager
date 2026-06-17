import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { usePageState } from "@/hooks/usePageState";
import { base44 } from "@/api/base44Client";
import { getCachedAllSettings, getCachedWorkers, getCachedTemplates, invalidateSettingsCache, toggleWeekPublished } from "@/lib/appDataCache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { getOperationalStartDate, getOperationalMinutes, getOperationalEndMinutes, parseTimeCellValue, operationalMinutesToTime, addDaysString } from "@/lib/operationalDate";
import { getTimelineRangeStyle, getTimelinePointStyle } from "@/lib/matrixTimeUtils";
import { Send, Star, Check, Ban, Plus, MessageCircle, ZoomIn, ZoomOut, Eye, EyeOff, FileSpreadsheet } from "lucide-react";
import { buildWhatsAppMessage } from "@/lib/whatsappShifts";
import BriefingBar from "../components/matrix/BriefingBar";
import MokedSignupBar from "../components/matrix/MokedSignupBar";
import WorkerLockButton from "../components/matrix/WorkerLockButton";
import MasterControls from "../components/matrix/MasterControls";
import SummaryColumnsDialog from "../components/matrix/SummaryColumnsDialog";
import MatrixHeader from "../components/matrix/MatrixHeader";
import { NotificationDialog, TypeChangeDialog, ManualShiftDialog, UnavailabilityDialog } from "../components/matrix/MatrixDialogs";
import ClassicTimelineRow from "../components/matrix/ClassicTimelineRow";

// ── Timeline constants ──────────────────────────────────────────────────────
const DAILY_TOTAL_MINUTES = 24 * 60;        // 1440
const WEEKLY_TOTAL_MINUTES = 7 * 24 * 60;  // 10080
const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const WORKER_COL_WIDTH = 170;     // worker name column px
const SUMMARY_COL_WIDTH = 60;     // each summary column
const SUMMARY_ADD_COL_WIDTH = 28; // the "+column" button

// ── Time slot generators ─────────────────────────────────────────────────────
const getDailyTimeSlots = () =>
  Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

// Operational hour order: 06, 07, ..., 23, 00, 01, ..., 05
const OPERATIONAL_HOURS_ORDER = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

const getWeeklyTimeSlots = (weekStartDate = null) => {
  const slots = [];
  for (let day = 0; day < 7; day++) {
    let dateLabel = null;
    if (weekStartDate) {
      const d = addDays(weekStartDate, day);
      dateLabel = format(d, 'd.M');
    }
    OPERATIONAL_HOURS_ORDER.forEach((hour, opIndex) => {
      slots.push({ day, hour, opIndex, label: opIndex === 0 ? DAYS_OF_WEEK[day] : null, dateLabel: opIndex === 0 ? dateLabel : null });
    });
  }
  return slots;
};

const timeToPixels = (timeStr, day = 0, viewMode = 'daily', ppm) => {
  if (!timeStr) return 0;
  const parsed = parseTimeCellValue(timeStr);
  if (isNaN(parsed.hour)) return 0;
  let totalMins;
  if (viewMode === 'weekly') {
    totalMins = day * 1440 + getOperationalMinutes(timeStr);
  } else {
    totalMins = getOperationalMinutes(timeStr);
  }
  return totalMins * ppm;
};

const endTimeToPixels = (startTimeStr, endTimeStr, viewMode = 'daily', ppm, dayIndex = 0) => {
  if (viewMode === 'weekly') {
    return (dayIndex * 1440 + getOperationalEndMinutes(startTimeStr, endTimeStr)) * ppm;
  }
  return getOperationalEndMinutes(startTimeStr, endTimeStr) * ppm;
};

const getTimelineWidth = (viewMode, ppm) =>
  (viewMode === 'daily' ? DAILY_TOTAL_MINUTES : WEEKLY_TOTAL_MINUTES) * ppm;

const pixelsToTime = (px, viewMode = 'daily', ppm) => {
  const totalMins = px / ppm;
  if (viewMode === 'weekly') {
    const day = Math.max(0, Math.min(6, Math.floor(totalMins / 1440)));
    const opMins = totalMins - day * 1440;
    return { day, time: operationalMinutesToTime(opMins) };
  }
  return { day: 0, time: operationalMinutesToTime(totalMins) };
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
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    const scrollMinutes = sc ? sc.scrollLeft / ppmRef.current : 0;

    setPinned(prev => {
      const next = !prev;
      try { localStorage.setItem('matrix_pinned_worker_panel', String(next)); } catch {}
      return next;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const newSc = !pinned ? timelineScrollRef.current : scrollContainerRef.current;
          if (newSc) newSc.scrollLeft = scrollMinutes * ppmRef.current;
        }, 80);
      });
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
    return WORKER_COL_WIDTH +
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
  const [workersLoadFailed, setWorkersLoadFailed] = useState(false);
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
  const [editingUnavail, setEditingUnavail] = useState(null); // Unavailability record being edited (null or {worker_id, worker_name, date, ...})
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
  const [dailyCustomColumns, setDailyCustomColumns] = useState({});
  const [savingSignupMode, setSavingSignupMode] = useState(false);
  const [publishedWeeks, setPublishedWeeks] = useState([]);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const settingsIdCache = useRef({});
  const trackerEntriesCache = useRef(null);

  // ── Row selection ─────────────────────────────────────────────────────────────
  const [selectedWorkerIds, setSelectedWorkerIds] = useState(new Set());
  const lastSelectedIndexRef = useRef(null);
  const filteredWorkersRef = useRef([]);

  // ── Scroll refs ──────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef(null);
  const workerPanelRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const timelineHeaderRef = useRef(null);
  const vScrollSyncRef = useRef(false);

  const midMouseDragRef = useRef(null);
  const pendingDragRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const wheelAccumRef = useRef(null);
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
    if (!containerWidth || !sc) return;

    const fixedW = pinned ? 0 : (WORKER_COL_WIDTH +
      (viewMode === 'weekly' ? summaryColumns.length * SUMMARY_COL_WIDTH + SUMMARY_ADD_COL_WIDTH : 0));
    const available = Math.max(300, containerWidth - fixedW);
    const ppmFit = available / totalMins;
    const newPpm = Math.max(ppmFit, newPpmRaw);

    if (Math.abs(newPpm - oldPpm) < 0.0001) return;

    const rect = sc.getBoundingClientRect();
    let cursorX;
    if (focalClientX !== null) {
      cursorX = Math.max(0, focalClientX - rect.left - fixedW);
    } else {
      cursorX = available / 2;
    }

    const oldTimelineWidth = totalMins * oldPpm;
    const cursorFromLeft = sc.scrollLeft + cursorX;
    const anchorRightPx = oldTimelineWidth - cursorFromLeft;

    const newTimelineWidth = totalMins * newPpm;
    const scaledAnchorRightPx = anchorRightPx * (newPpm / oldPpm);
    const newCursorFromLeft = newTimelineWidth - scaledAnchorRightPx;
    const targetScrollLeft = newCursorFromLeft - cursorX;
    const maxScroll = Math.max(0, newTimelineWidth - available);

    pendingScrollRef.current = { targetScrollLeft, maxScroll };

    setZoomPreset('custom');
    setCustomPpm(newPpm);
  }, [containerWidth, totalMins, viewMode, summaryColumns, pinned]);

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;

    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (!sc) return;
    sc.scrollLeft = Math.max(0, Math.min(pending.targetScrollLeft, pending.maxScroll));
  }, [ppm, pinned]);

  const handleWheel = useCallback((e) => {
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;

    // Ctrl+scroll → zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      if (!wheelAccumRef.current) {
        wheelAccumRef.current = { totalFactor: factor, clientX: e.clientX };
        requestAnimationFrame(() => {
          const accum = wheelAccumRef.current;
          wheelAccumRef.current = null;
          if (accum) applyZoom(ppmRef.current * accum.totalFactor, accum.clientX);
        });
      } else {
        wheelAccumRef.current.totalFactor *= factor;
        wheelAccumRef.current.clientX = e.clientX;
      }
      return;
    }

    // Horizontal swipe (trackpad): deltaX is the dominant axis → pan horizontally
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (!sc) return;
      e.preventDefault();
      sc.scrollLeft += e.deltaX;
      return;
    }

    // Plain vertical wheel (deltaY dominant) → let browser scroll vertically, don't intercept
  }, [applyZoom, pinned]);

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
    const unsubTemplateRow = base44.entities.TemplateRow.subscribe(() => {
      debouncedLoadDataRef.current(true, false);
    });
    const unsubAvailability = base44.entities.Availability.subscribe(() => {
      debouncedLoadDataRef.current(true, true);
    });
    const unsubUnavailability = base44.entities.Unavailability.subscribe(() => {
      debouncedLoadDataRef.current(true, false);
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') debouncedLoadDataRef.current(true, false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onTemplateRowsUpdated = (e) => {
      const { rowId, updatedValues } = e.detail || {};
      if (rowId && updatedValues) {
        setTemplateRows(prev => prev.map(row => row.id === rowId ? { ...row, values: updatedValues } : row));
      }
      debouncedLoadDataRef.current(true, true);
    };
    window.addEventListener('templateRowsUpdated', onTemplateRowsUpdated);

    let bc = null;
    try {
      bc = new BroadcastChannel('schedule-sync');
      bc.onmessage = (e) => {
        if (e.data?.type === 'templateRowsUpdated') {
          const { rowId, updatedValues } = e.data;
          if (rowId && updatedValues) {
            setTemplateRows(prev => prev.map(row => row.id === rowId ? { ...row, values: updatedValues } : row));
          }
          debouncedLoadDataRef.current(true, true);
        }
      };
    } catch {}

    const onStorage = (e) => {
      if (e.key === 'schedule-sync-event') {
        try {
          const data = JSON.parse(e.newValue || '{}');
          if (data.type === 'templateRowsUpdated') {
            debouncedLoadDataRef.current(true, true);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      unsubTemplateRow();
      unsubAvailability();
      unsubUnavailability();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('templateRowsUpdated', onTemplateRowsUpdated);
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
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
        base44.entities.Tracker.list('-created_date', 200),
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
      setPublishedWeeks(parseSetting("published_weeks") || []);
      // ── canManage check ─────────────────────────────────────────────────────
      (async () => {
        try {
          const user = await base44.auth.me();
          const userRoles = parseSetting("user_roles") || {};
          const role = userRoles[user.email];
          setCanManage(user?.role === 'admin' || role === 'manager');
        } catch { setCanManage(false); }
      })();
      allSettings.forEach(s => { settingsIdCache.current[s.setting_key] = s.id; });
      setTrackers(trackersData);
      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
      setWorkersLoadFailed(false);
    } catch (error) {
      console.error('Error loading static matrix data:', error);
      setWorkersLoadFailed(true);
    }
    initialLoadDoneRef.current = true;
    loadDynamicData(false);
  };

  const queuedMatrixRefreshRef = useRef(false);

  const loadDynamicData = async (silent = false) => {
    if (isLoadingRef.current) {
      queuedMatrixRefreshRef.current = true;
      return;
    }
    isLoadingRef.current = true;
    if (!silent && !initialLoaded) setLoading(true);
    const dateStr = format(currentDate, "yyyy-MM-dd");

    try {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const dateStrLocal = format(currentDate, "yyyy-MM-dd");

      const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));

      const [availabilitiesData, unavailabilitiesData, allTemplatesData] = await Promise.all([
        base44.entities.Availability.filter({ week_start_date: weekStartStr }),
        viewMode === "daily"
          ? base44.entities.Unavailability.filter({ date: dateStrLocal })
          : base44.entities.Unavailability.list(),
        getCachedTemplates(base44.entities),
      ]);

      if (!trackerEntriesCache.current) {
        trackerEntriesCache.current = await base44.entities.TrackerEntry.list();
      }
      const trackerEntriesData = trackerEntriesCache.current;

      const parallelFetch = (dates) =>
        Promise.all(dates.map(d => base44.entities.TemplateRow.filter({ date: d })));

      let templateRowArrays;
      if (viewMode === "daily") {
        templateRowArrays = await parallelFetch([
          addDaysString(dateStrLocal, -1),
          dateStrLocal,
          addDaysString(dateStrLocal, 1),
        ]);
      } else {
        templateRowArrays = await parallelFetch([
          addDaysString(weekStartStr, -1),
          ...weekDates,
          addDaysString(weekDates[weekDates.length - 1], 1),
        ]);
      }

      let filteredTemplateRows = templateRowArrays.flat();

      if (viewMode === "daily") {
        const continuationRows = filteredTemplateRows.filter(r => r.values?.is_continuation && r.values?.continuation_source_row_id);
        const uniqueSourceIds = [...new Set(continuationRows.map(r => r.values.continuation_source_row_id).filter(Boolean))];
        if (uniqueSourceIds.length > 0) {
          const missingSourceIds = uniqueSourceIds.filter(id => !filteredTemplateRows.some(r => r.id === id));
          const sourceRows = await Promise.all(
            missingSourceIds.map(id => base44.entities.TemplateRow.get(id).catch(() => null))
          );
          filteredTemplateRows.push(...sourceRows.filter(Boolean));
        }
      }

      // Load daily custom columns for all relevant dates
      const relevantDates = viewMode === 'daily'
        ? [dateStr]
        : Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i), "yyyy-MM-dd"));
      const allSettingsForDailyColumns = await getCachedAllSettings(base44.entities);
      const newDailyCustomColumns = {};
      relevantDates.forEach(d => {
        const setting = allSettingsForDailyColumns.find(s => s.setting_key === `schedule_daily_columns_${d}`);
        if (setting) {
          try {
            const parsed = JSON.parse(setting.setting_value);
            Object.entries(parsed).forEach(([templateId, cols]) => {
              if (!newDailyCustomColumns[templateId]) newDailyCustomColumns[templateId] = [];
              cols.forEach(col => {
                if (!newDailyCustomColumns[templateId].find(c => c.name === col.name)) {
                  newDailyCustomColumns[templateId].push(col);
                }
              });
            });
          } catch {}
        }
      });
      setDailyCustomColumns(newDailyCustomColumns);

      setAvailabilities(availabilitiesData);
      setUnavailabilities(unavailabilitiesData);
      setTemplateRows(filteredTemplateRows);
      setAllTemplates(allTemplatesData);
      setTrackerEntries(trackerEntriesData);
      setInitialLoaded(true);

    } catch (error) { console.error('Error loading matrix data:', error); }
    finally {
      setLoading(false);
      isLoadingRef.current = false;
      if (queuedMatrixRefreshRef.current) {
        queuedMatrixRefreshRef.current = false;
        loadDynamicData(true);
      }
    }
  };

  const debouncedLoadData = (silent = false, fast = false, postsave = false) => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    const delay = postsave ? 100 : fast ? 200 : 500;
    loadingTimeoutRef.current = setTimeout(() => loadDynamicData(silent), delay);
  };
  const applyOptimisticAvailability = (workerId, newShifts, newRecord = null) => {
    setAvailabilities(prev => {
      const existing = prev.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
      if (existing) return prev.map(a => a.worker_id === workerId && a.week_start_date === weekStartDate ? { ...a, shifts: newShifts } : a);
      if (newRecord) return [...prev, { ...newRecord, shifts: newShifts }];
      return prev;
    });
  };
  const debouncedLoadDataRef = useRef(null);
  debouncedLoadDataRef.current = debouncedLoadData;

  const dateString = format(currentDate, "yyyy-MM-dd");
  const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const isCurrentWeekPublished = publishedWeeks.includes(weekStartDate);

  const handleTogglePublish = async () => {
    const allSettings = await getCachedAllSettings(base44.entities);
    const userRolesMap = (() => { const s = allSettings.find(x => x.setting_key === "user_roles"); if (!s) return {}; try { return JSON.parse(s.setting_value); } catch { return {}; } })();
    const currentUser = await base44.auth.me();
    const role = userRolesMap[currentUser.email];
    const canPublish = currentUser?.role === 'admin' || role === 'manager';
    if (!canPublish) { alert("רק מנהל יכול לפרסם משמרות לעובדים"); return; }
    setTogglingPublish(true);
    try {
      const next = !isCurrentWeekPublished;
      const weeks = await toggleWeekPublished(base44.entities, weekStartDate, next);
      setPublishedWeeks(weeks);
    } catch (e) {
      console.error("toggle publish failed:", e);
      alert("שגיאה בעדכון פרסום המשמרות. נסה שוב.");
    } finally {
      setTogglingPublish(false);
    }
  };

  // ── Data helpers ─────────────────────────────────────────────────────────────
  const isWorkerAssignedToRow = (row, workerId, template) => {
    if (!row.values || !workerId) return { assigned: false, workerColumnName: null };
    const templateCols = template?.columns || [];
    const extraCols = (template?.id && dailyCustomColumns[template.id]) ? dailyCustomColumns[template.id] : [];
    const columns = [...templateCols, ...extraCols];
    for (const col of columns) {
      if (col.type !== "worker") continue;
      const val = row.values[col.name];
      if (val === workerId) return { assigned: true, workerColumnName: col.name };
      if (Array.isArray(val) && val.includes(workerId)) return { assigned: true, workerColumnName: col.name };
    }
    return { assigned: false, workerColumnName: null };
  };

  const isInvalidContinuationRow = (row) => {
    if (!row?.values?.is_continuation) return false;
    const start = row.values["התחלה"] || row.values["שעת התחלה"];
    const end   = row.values["סיום"]  || row.values["שעת סיום"];
    return start === "06:00" && end === "06:00" && !!row.values.continuation_source_row_id;
  };

  const getWorkerTemplateShifts = (workerId, date = null) => {
    const targetDate = date || dateString;
    const shifts = [];
    templateRows.forEach(row => {
      if (!row.values) return;
      if (row.date !== targetDate) return;
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const weekStartStr2 = format(weekStart, "yyyy-MM-dd");
      if (viewMode === 'weekly' && (row.date < weekStartStr2 || row.date > weekEnd)) return;
      if (isInvalidContinuationRow(row)) return;
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
        operational_date: row.date,
        date: row.date,
        calendar_start_date: getOperationalStartDate(row.date, startTime),
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
    const workerAvail = getBestAvail(workerId);
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

  const getBestAvail = (wid) => availabilities.filter(a => a.worker_id === wid && a.week_start_date === weekStartDate).sort((a,b)=>(b.shifts?.length||0)-(a.shifts?.length||0))[0] || null;

  const getWorkerAvailabilityForDate = (workerId, date = null) => {
    const targetDate = date || dateString;
    const workerAvail = getBestAvail(workerId);
    if (!workerAvail || !workerAvail.shifts) return [];
    if (viewMode === 'weekly') return workerAvail.shifts || [];
    return workerAvail.shifts.filter(s => (s.operational_date || s.date) === targetDate);
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
      const message = await buildWhatsAppMessage(worker, viewMode, currentDate, getWorkerTemplateShifts, getWorkerExtraTaskShifts, isStandbyStatus, base44);
      const phoneNumber = worker.phone?.replace(/[^0-9]/g, '');
      window.open(phoneNumber ? `https://wa.me/972${phoneNumber.startsWith('0') ? phoneNumber.slice(1) : phoneNumber}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) { console.error('Error sending WhatsApp:', error); alert('שגיאה בשליחת ההודעה. אנא נסה שוב.'); }
    finally { setSendingWhatsApp(false); }
  };

  const sendNotification = async () => {
    if (!selectedWorkerForNotification) return;
    const getBriefingTime = (shift) => {
      if (shift?.briefing_time) return shift.briefing_time;
      const startOp = getOperationalMinutes(shift?.start_time || '06:00');
      return operationalMinutesToTime(Math.max(0, startOp - 15));
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
    const _timeToMins = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kitchen Shifts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    icsEvents.forEach((evt, idx) => {
      const { shift, date } = evt;
      const bt = getBriefingTime(shift);
      const startMins = _timeToMins(shift.start_time);
      const endMins   = _timeToMins(shift.end_time);
      const startDateFmt = date.replace(/-/g, '');
      const endDateFmt = endMins < startMins
        ? format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyyMMdd')
        : startDateFmt;
      icsContent += `BEGIN:VEVENT\nUID:shift-${idx}-${Date.now()}@kitchen\nDTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}\nDTSTART:${startDateFmt}T${bt.replace(':', '')}00\nDTEND:${endDateFmt}T${shift.end_time.replace(':', '')}00\nSUMMARY:${isStandbyStatus(shift.status) ? `כוננות ${shift.status}` : shift.food_cart_name}\nEND:VEVENT\n`;
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
    const diff = Math.floor((new Date(dateStr + "T12:00:00") - weekStart) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, diff));
  };

  const getSlotFromPointer = (e) => {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    let slot = null;
    for (const el of els) {
      if (el.dataset?.matrixTimeSlot === 'true') { slot = el; break; }
      const found = el.closest?.("[data-matrix-time-slot='true']");
      if (found) { slot = found; break; }
    }
    return slot;
  };

  const clientXToOpMinutes = (clientX) => {
    console.warn("MATRIX DRAG FALLBACK X-MATH USED");
    const sc = pinned ? timelineScrollRef.current : scrollContainerRef.current;
    if (!sc) return { opMinutes: 0, dayIndex: 0 };
    const rect = sc.getBoundingClientRect();
    const localX = (clientX - rect.left) + sc.scrollLeft;
    const timelineOffsetFromLeft = pinned ? 0 : fixedColumnsWidth;
    const localXInTimeline = localX - timelineOffsetFromLeft;
    const pxFromRight = Math.max(0, Math.min(timelineWidth, timelineWidth - localXInTimeline));
    const pxFromLeft = timelineWidth - pxFromRight;
    const totalMinsFromLeft = pxFromLeft / ppm;
    if (viewMode === 'weekly') {
      const dayIndex = Math.max(0, Math.min(6, Math.floor(totalMinsFromLeft / 1440)));
      return { opMinutes: totalMinsFromLeft - dayIndex * 1440, dayIndex };
    }
    return { opMinutes: totalMinsFromLeft, dayIndex: 0 };
  };

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = (e, worker, shift, action, dayIndex = 0) => {
    if (action === 'create') e.preventDefault();
    e.stopPropagation();
    if (action === 'move' && e.detail === 2) return;

    const slot = getSlotFromPointer(e);

    let startAbsMinute;
    let startOpDate;

    if (slot) {
      const slotDay = Number(slot.dataset.dayIndex || 0);
      const slotOpMin = Number(slot.dataset.operationalMinute || 0);
      startAbsMinute = slotDay * 1440 + slotOpMin;
      startOpDate = slot.dataset.operationalDate || dateString;
    } else {
      const { opMinutes, dayIndex: fbDay } = clientXToOpMinutes(e.clientX);
      startAbsMinute = fbDay * 1440 + opMinutes;
      startOpDate = viewMode === 'weekly'
        ? format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), fbDay), 'yyyy-MM-dd')
        : dateString;
    }

    const dragData = {
      workerId: worker.id,
      worker,
      shift,
      action,
      startAbsMinute,
      currentAbsMinute: startAbsMinute,
      startOpDate,
      originalStart: shift?.start_time,
      originalEnd: shift?.end_time,
      originalDay: viewMode === 'weekly' ? (shift ? getDayIndexFromDate(shift.date) : dayIndex) : 0,
    };

    if (action === 'move') {
      // Defer: only become a real drag once pointer moves past threshold.
      // This lets double-click fire cleanly without drag state interfering.
      pendingDragRef.current = { ...dragData, startClientX: e.clientX, startClientY: e.clientY };
      return;
    }

    // resize-start / resize-end / create commit immediately
    setDragging(dragData);
  };

  const handleMouseMove = (e) => {
    // Promote a pending move-drag to a real drag once pointer moves enough
    if (!dragging && pendingDragRef.current) {
      const dx = Math.abs(e.clientX - pendingDragRef.current.startClientX);
      const dy = Math.abs(e.clientY - pendingDragRef.current.startClientY);
      if (dx > 4 || dy > 4) {
        setDragging(pendingDragRef.current);
        pendingDragRef.current = null;
      }
      return; // wait until either promoted or mouseup clears it
    }
    if (!dragging) return;
    const { worker, shift, action, startAbsMinute, originalStart, originalEnd, originalDay } = dragging;

    const slot = getSlotFromPointer(e);

    let currentAbsMinute;

    if (slot) {
      const slotDay = Number(slot.dataset.dayIndex || 0);
      const slotOpMin = Number(slot.dataset.operationalMinute || 0);
      currentAbsMinute = slotDay * 1440 + slotOpMin;
    } else {
      const { opMinutes, dayIndex: fbDay } = clientXToOpMinutes(e.clientX);
      currentAbsMinute = fbDay * 1440 + opMinutes;
    }

    const SLOT_MINS = 60;

    let newStart = originalStart;
    let newEnd = originalEnd;
    let newDay = originalDay || 0;

    if (action === 'create') {
      const startAbs = Math.min(startAbsMinute, currentAbsMinute);
      const endAbs = Math.max(startAbsMinute, currentAbsMinute + SLOT_MINS);
      newDay = Math.max(0, Math.min(6, Math.floor(startAbs / 1440)));
      const startOpMins = startAbs - newDay * 1440;
      const endOpMins = endAbs - newDay * 1440;
      newStart = operationalMinutesToTime(Math.max(0, Math.min(1440, startOpMins)));
      newEnd = operationalMinutesToTime(Math.max(0, Math.min(1440, endOpMins)));
    } else if (action === 'resize-start') {
      newDay = Math.max(0, Math.min(6, Math.floor(currentAbsMinute / 1440)));
      newStart = operationalMinutesToTime(Math.max(0, currentAbsMinute - newDay * 1440));
    } else if (action === 'resize-end') {
      const endDay = Math.max(0, Math.min(6, Math.floor(currentAbsMinute / 1440)));
      newEnd = operationalMinutesToTime(Math.max(0, currentAbsMinute - endDay * 1440 + SLOT_MINS));
    } else if (action === 'move') {
      const origStartPx = timeToPixels(originalStart, originalDay || 0, viewMode, ppm);
      const origEndPx = endTimeToPixels(originalStart, originalEnd, viewMode, ppm, originalDay || 0);
      const widthMins = (origEndPx - origStartPx) / ppm;
      const delta = currentAbsMinute - startAbsMinute;
      const newStartAbs = Math.max(0, (originalDay || 0) * 1440 + getOperationalMinutes(originalStart) + delta);
      newDay = Math.max(0, Math.min(6, Math.floor(newStartAbs / 1440)));
      const newStartOpMins = newStartAbs - newDay * 1440;
      newStart = operationalMinutesToTime(Math.max(0, Math.min(1440, newStartOpMins)));
      newEnd = operationalMinutesToTime(Math.max(0, Math.min(1440, newStartOpMins + widthMins)));
    }

    setDragPreview({ workerId: dragging.workerId, start: newStart, end: newEnd, day: newDay, type: shift?.type || 'available' });
  };

  const handleMouseUp = async () => {
    pendingDragRef.current = null; // click/dblclick with no movement — discard pending
    if (!dragging || !dragPreview) { setDragging(null); setDragPreview(null); return; }
    const { workerId, worker, shift, action } = dragging;
    const { start, end, day } = dragPreview;

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const targetDate = viewMode === 'weekly' ? format(addDays(weekStart, day || 0), 'yyyy-MM-dd') : dateString;

    if (start === end) { setDragging(null); setDragPreview(null); return; }
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    if (action === 'create') {
      updatedShifts.push({ date: targetDate, start_time: start, end_time: end, type: 'available', priority: updatedShifts.length + 1 });
    } else if (shift) {
      updatedShifts = updatedShifts.map(s => s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time ? { ...s, date: targetDate, start_time: start, end_time: end } : s);
    }
    const availData = { worker_id: workerId, worker_name: worker.nickname, week_start_date: weekStartDate, shifts: updatedShifts, status: workerAvail?.status || "approved" };
    const prevAvails = availabilities;
    applyOptimisticAvailability(workerId, updatedShifts, availData);
    setDragging(null); setDragPreview(null);
    try {
      if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
      else await base44.entities.Availability.create(availData);
    } catch { setAvailabilities(prevAvails); }
    debouncedLoadData(true, false, true);
  };

  const handleTypeClick = async (e, worker, shift) => {
    e.stopPropagation(); e.preventDefault();
    const workerAvail = getBestAvail(worker.id);
    if (!workerAvail) return;
    const typeMap = { available: 'wanted', wanted: 'available' };
    const updatedShifts = workerAvail.shifts.map(s => s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time ? { ...s, type: typeMap[shift.type || 'available'] } : s);
    const previousAvailabilities = availabilities;
    applyOptimisticAvailability(worker.id, updatedShifts);
    try {
      await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    } catch {
      setAvailabilities(previousAvailabilities);
    }
  };

  const handleChangeType = async (newType) => {
    if (!selectedWorkerForType || !selectedShiftForType) return;
    const workerAvail = getBestAvail(selectedWorkerForType.id);
    if (!workerAvail) return;
    const updatedShifts = workerAvail.shifts.map(s => s.date === selectedShiftForType.date && s.start_time === selectedShiftForType.start_time && s.end_time === selectedShiftForType.end_time ? { ...s, type: newType } : s);
    const previousAvailabilities = availabilities;
    applyOptimisticAvailability(selectedWorkerForType.id, updatedShifts);
    setShowTypeDialog(false); setSelectedShiftForType(null); setSelectedWorkerForType(null);
    try {
      await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    } catch { setAvailabilities(previousAvailabilities); }
    debouncedLoadData(true, false, true);
  };

  const handleManualShiftAdd = (worker) => {
    setSelectedWorkerForManual(worker);
    setManualShiftData({ start_time: '', end_time: '', type: 'available', date: dateString, reason: 'occupied' });
    setEditingShift(null);
    setShowManualDialog(true);
  };

  const handleShiftDoubleClick = (e, worker, shift) => {
    e.stopPropagation();
    e.preventDefault();
    setTimeout(() => {
      setSelectedWorkerForManual(worker);
      setManualShiftData({ start_time: shift.start_time, end_time: shift.end_time, type: shift.type });
      setEditingShift(shift);
      setShowManualDialog(true);
    }, 0);
  };

  const submitManualShift = async () => {
    if (!selectedWorkerForManual || !manualShiftData.start_time || !manualShiftData.end_time) return;
    if (manualShiftData.type === "constraint") {
      try {
        await base44.entities.Unavailability.create({
          worker_id: selectedWorkerForManual.id,
          worker_name: selectedWorkerForManual.nickname,
          date: manualShiftData.date || dateString,
          start_time: manualShiftData.start_time,
          end_time: manualShiftData.end_time,
          reason: manualShiftData.reason || "occupied",
        });
      } catch (e) {
        console.error("create constraint failed:", e);
        alert("שגיאה בשמירת האילוץ. נסה שוב.");
        return;
      }
      setUnavailabilities(prev => [...prev, {
        id: 'temp_' + Date.now(), // optimistic placeholder — real data loads next refresh
        worker_id: selectedWorkerForManual.id,
        worker_name: selectedWorkerForManual.nickname,
        date: manualShiftData.date || dateString,
        start_time: manualShiftData.start_time,
        end_time: manualShiftData.end_time,
        reason: manualShiftData.reason || "occupied",
      }]);
      setShowManualDialog(false); setSelectedWorkerForManual(null);
      setManualShiftData({ start_time: '', end_time: '', type: 'available', date: dateString, reason: 'occupied' }); setEditingShift(null);
      debouncedLoadData(true, false, true);
      return;
    }
    const workerAvail = getBestAvail(selectedWorkerForManual.id);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    const targetDate = format(currentDate, "yyyy-MM-dd");
    if (editingShift) {
      updatedShifts = updatedShifts.map(s => s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type ? { ...s, date: targetDate, start_time: manualShiftData.start_time, end_time: manualShiftData.end_time, type: manualShiftData.type } : s);
    } else {
      updatedShifts.push({ date: targetDate, start_time: manualShiftData.start_time, end_time: manualShiftData.end_time, type: manualShiftData.type, priority: updatedShifts.length + 1 });
    }
    const availData = { worker_id: selectedWorkerForManual.id, worker_name: selectedWorkerForManual.nickname, week_start_date: weekStartDate, shifts: updatedShifts, status: workerAvail?.status || "approved" };
    const previousAvailabilities = availabilities;
    applyOptimisticAvailability(selectedWorkerForManual.id, updatedShifts, availData);
    setShowManualDialog(false); setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available', date: dateString, reason: 'occupied' }); setEditingShift(null);
    try {
      if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
      else await base44.entities.Availability.create(availData);
    } catch { setAvailabilities(previousAvailabilities); }
    debouncedLoadData(true, false, true);
  };

  const deleteManualShift = async () => {
    if (!selectedWorkerForManual || !editingShift) return;
    const workerAvail = getBestAvail(selectedWorkerForManual.id);
    if (!workerAvail) return;
    const updatedShifts = workerAvail.shifts.filter(s => !(s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type));
    const prevAvails2 = availabilities;
    applyOptimisticAvailability(selectedWorkerForManual.id, updatedShifts);
    setShowManualDialog(false); setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available', date: dateString, reason: 'occupied' }); setEditingShift(null);
    try { await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts }); }
    catch { setAvailabilities(prevAvails2); }
    debouncedLoadData(true, false, true);
  };

  const handleSaveUnavail = async (unavailData, isDelete = false) => {
    if (isDelete) {
      await base44.entities.Unavailability.delete(unavailData.id);
      setUnavailabilities(prev => prev.filter(u => u.id !== unavailData.id));
    } else if (unavailData.id) {
      const updated = await base44.entities.Unavailability.update(unavailData.id, {
        date: unavailData.date,
        start_time: unavailData.start_time,
        end_time: unavailData.end_time,
        reason: unavailData.reason,
      });
      setUnavailabilities(prev => prev.map(u => u.id === updated.id ? updated : u));
    } else {
      const created = await base44.entities.Unavailability.create({
        worker_id: unavailData.worker_id,
        worker_name: unavailData.worker_name,
        date: unavailData.date,
        start_time: unavailData.start_time,
        end_time: unavailData.end_time,
        reason: unavailData.reason,
      });
      setUnavailabilities(prev => [...prev, created]);
    }
    setEditingUnavail(null);
  };

  const saveSignupMode = async (newMode) => {
    setSavingSignupMode(true);
    try {
      // Authoritative: fetch ALL records for this key (bypass any cache/id assumptions)
      const records = await base44.entities.AppSettings.filter({ setting_key: "availability_signup_mode" });

      if (records.length === 0) {
        const created = await base44.entities.AppSettings.create({
          setting_key: "availability_signup_mode",
          setting_value: JSON.stringify(newMode),
        });
        settingsIdCache.current["availability_signup_mode"] = created.id;
      } else {
        // Keep the first record, update it, DELETE all duplicates
        const keep = records[0];
        await base44.entities.AppSettings.update(keep.id, { setting_value: JSON.stringify(newMode) });
        settingsIdCache.current["availability_signup_mode"] = keep.id;
        for (const dup of records.slice(1)) {
          try { await base44.entities.AppSettings.delete(dup.id); } catch (_) { /* already gone */ }
        }
        if (records.length > 1) console.warn(`signup_mode: removed ${records.length - 1} duplicate setting record(s)`);
      }

      invalidateSettingsCache();
      setSignupMode(newMode);
    } catch (e) {
      console.error("saveSignupMode failed:", e);
      alert("שמירת מצב ההרשמה נכשלה — נסו שוב");
    } finally {
      setSavingSignupMode(false);
    }
  };

  const saveSummaryColumns = async (cols) => {
    const existingId = settingsIdCache.current["matrix_summary_columns"];
    if (existingId) await base44.entities.AppSettings.update(existingId, { setting_value: JSON.stringify(cols) });
    else { const created = await base44.entities.AppSettings.create({ setting_key: 'matrix_summary_columns', setting_value: JSON.stringify(cols) }); settingsIdCache.current["matrix_summary_columns"] = created.id; }
    invalidateSettingsCache();
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
        if (row.date < weekStartStr || row.date > weekEndStr) return;
        weeklyShifts.push({ date: row.date, start_time: st, end_time: et, status: row.values?.status || null, food_cart_name: allTemplates.find(t => t.id === row.template_id)?.name || row.template_name || '' });
      }
    });
    if (column.criteria_type === 'total_shifts') return weeklyShifts.length;
    if (column.criteria_type === 'status') return weeklyShifts.filter(s => s.status === column.criteria_value).length;
    if (column.criteria_type === 'food_cart') return weeklyShifts.filter(s => s.food_cart_name === column.criteria_value).length;
    if (column.criteria_type === 'time_range') {
      const [from, to] = (column.criteria_value || '').split('-');
      if (!from || !to) return 0;
      const fromOp = getOperationalMinutes(from);
      const toOp = getOperationalMinutes(to) || 1440;
      return weeklyShifts.filter(s => {
        const sStart = getOperationalMinutes(s.start_time);
        const sEnd = getOperationalEndMinutes(s.start_time, s.end_time);
        return sStart < toOp && sEnd > fromOp;
      }).length;
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

  const AssignmentBar = ({ assignment }) => {
    const positionDate = assignment.operational_date || assignment.schedule_date || assignment.date;
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

  const AvailabilityBar = ({ shift, worker, shiftIdx }) => {
    const shiftDate = shift.operational_date || shift.date;
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shiftDate) : 0;
    const startPx = timeToPixels(shift.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(shift.start_time, shift.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    const rightPx = startPx;
    if (startPx < 0 || startPx > timelineWidth) return null;
    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };
    const borderColors = { wanted: '#16a34a', available: '#3b82f6', unavailable: '#dc2626' };
    const borderColor = borderColors[shift.type] || '#3b82f6';
    const overlappingAssignments = templateRows.filter(r => {
      if (r.date !== shiftDate || !r.values) return false;
      const tmpl = allTemplates.find(t => t.id === r.template_id);
      if (!tmpl) return false;
      const { assigned } = isWorkerAssignedToRow(r, worker.id, tmpl);
      if (!assigned) return false;
      const st = r.values?.["התחלה"] || r.values?.["שעת התחלה"];
      const et = r.values?.["סיום"] || r.values?.["שעת סיום"];
      return st && et && timesOverlap(shift.start_time, shift.end_time, st, et);
    }).map(r => ({ start_time: r.values?.["התחלה"] || r.values?.["שעת התחלה"], end_time: r.values?.["סיום"] || r.values?.["שעת סיום"], status: r.values?.status || null }));
    const handleBarDblClick = (e) => { e.stopPropagation(); handleShiftDoubleClick(e, worker, shift); };
    const handleBarMD = (action) => (e) => { if (e.detail >= 2) return; e.stopPropagation(); handleMouseDown(e, worker, shift, action, dayIndex); };
    return (
      <div
        data-matrix-existing-bar="true"
        className="absolute h-full rounded-sm z-20 cursor-move overflow-visible"
        data-matrix-avail-bar="true"
        data-shift-idx={shiftIdx}
        style={{ right: `${rightPx}px`, width: `${widthPx}px`, backgroundColor: `${borderColor}18`, border: `2px solid ${borderColor}` }}
        onMouseDown={handleBarMD('move')}
        onDoubleClick={handleBarDblClick}
      >
        <div data-matrix-existing-bar="true" className="absolute right-0 top-0 h-full cursor-ew-resize z-30" style={{ width: '16px', marginRight: '-6px' }} onMouseDown={handleBarMD('resize-start')} onDoubleClick={handleBarDblClick} />
        <div data-matrix-existing-bar="true" className="absolute left-0 top-0 h-full cursor-ew-resize z-30" style={{ width: '16px', marginLeft: '-6px' }} onMouseDown={handleBarMD('resize-end')} onDoubleClick={handleBarDblClick} />
        <button data-matrix-existing-bar="true" className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[8px] font-bold z-30 hover:scale-110 transition-transform" style={{ borderColor }} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTypeClick(e, worker, shift); }} onDoubleClick={handleBarDblClick}>
          {typeLabels[shift.type] || "A"}
        </button>
        {overlappingAssignments.map((ass, i) => {
          const avS = getOperationalMinutes(shift.start_time);
          const avE = getOperationalEndMinutes(shift.start_time, shift.end_time);
          const assS = getOperationalMinutes(ass.start_time);
          const assE = getOperationalEndMinutes(ass.start_time, ass.end_time);
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
        <div
          onClick={(e) => { e.stopPropagation(); if (canManage) setEditingUnavail(unavail); }}
          className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${canManage ? 'cursor-pointer' : ''} ${unavail.reason === 'overseas' ? 'bg-red-200 border-r-2 border-red-500' : 'bg-gray-300 border-r-2 border-gray-500'}`}
          style={{ right: `${rightPx}px`, width: `${widthPx}px` }}
        >
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
    const { style } = getTimelineRangeStyle(preview.start, preview.end, dayIndex, viewMode, ppm);
    return <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80 pointer-events-none" style={style}><span className="text-xs font-bold">{preview.start} - {preview.end}</span></div>;
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

  const exportToExcel = () => {
    const HEBREW_DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const typeLabel = { wanted: "רצוי", available: "זמין", unavailable: "לא זמין" };

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));

    // Build rows: one row per worker × per signup shift
    const rows = [];
    filteredWorkers.forEach(worker => {
      const avail = getBestAvail(worker.id);
      const shifts = avail?.shifts || [];

      // Determine which shifts are relevant to current view
      const relevantShifts = shifts.filter(s => {
        const opDate = s.operational_date || s.date;
        if (viewMode === "daily") return opDate === dateString;
        return weekDates.includes(opDate);
      });

      if (relevantShifts.length === 0) {
        rows.push({
          "שם עובד": worker.nickname,
          "תאריך": viewMode === "daily" ? dateString : `${format(weekStart, "d.M")}-${format(addDays(weekStart, 6), "d.M")}`,
          "יום": "",
          "שעת התחלה": "",
          "שעת סיום": "",
          "סוג הרשמה": "",
          "שם מוקד": "",
          "הערות": "לא נרשם",
        });
      } else {
        relevantShifts.forEach(s => {
          const opDate = s.operational_date || s.date;
          const d = new Date(opDate + "T12:00:00");
          rows.push({
            "שם עובד": worker.nickname,
            "תאריך": opDate,
            "יום": HEBREW_DAYS_FULL[d.getDay()],
            "שעת התחלה": s.start_time || "",
            "שעת סיום": s.end_time || "",
            "סוג הרשמה": typeLabel[s.type] || s.type || "",
            "שם מוקד": s.moked_name || "",
            "הערות": "",
          });
        });
      }
    });

    // Convert to CSV (UTF-8 BOM for Hebrew Excel support)
    const headers = ["שם עובד", "תאריך", "יום", "שעת התחלה", "שעת סיום", "סוג הרשמה", "שם מוקד", "הערות"];
    const csvLines = [
      headers.join(","),
      ...rows.map(row => headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","))
    ];
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = viewMode === "daily" ? dateString : `${format(weekStart, "d.M")}-${format(addDays(weekStart, 6), "d.M")}`;
    a.download = `מטריצה_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const briefingMarkers = useMemo(() => {
    const markers = [];
    templateRows.forEach(row => {
      if (!row.values) return;
      if (row.values?.is_continuation) return;
      const originalBriefingTime = row.values?.["תדריך"];
      if (!originalBriefingTime) return;
      const template = allTemplates.find(t => t.id === row.template_id);
      if (!template) return;
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
      if (!startTime || !endTime) return;
      const parsed = parseTimeCellValue(originalBriefingTime);
      let visualOperationalDate;
      let visualTime;
      if (parsed.dayOffset === -1) {
        visualOperationalDate = addDaysString(row.date, -1);
        visualTime = parsed.clockTime;
      } else if (parsed.dayOffset > 0) {
        visualOperationalDate = addDaysString(row.date, parsed.dayOffset);
        visualTime = parsed.clockTime;
      } else {
        visualOperationalDate = row.date;
        visualTime = parsed.clockTime;
      }
      const workerCols = (template.columns || []).filter(c => c.type === "worker");
      const assignedWorkerIds = [];
      workerCols.forEach(col => {
        const val = row.values[col.name];
        if (!val) return;
        if (Array.isArray(val)) assignedWorkerIds.push(...val);
        else assignedWorkerIds.push(val);
      });
      if (assignedWorkerIds.length === 0) return;
      assignedWorkerIds.forEach(workerId => {
        markers.push({
          id: `briefing_${row.id}_${workerId}`,
          worker_id: workerId,
          source_row_id: row.id,
          linked_shift_operational_date: row.date,
          visual_operational_date: visualOperationalDate,
          visual_time: visualTime,
          original_briefing_time: originalBriefingTime,
          shift_start_time: startTime,
          shift_end_time: endTime,
          template_name: template.name || row.template_name,
        });
      });
    });
    return markers;
  }, [templateRows, allTemplates, workers]);

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
  filteredWorkersRef.current = filteredWorkers;

  const handleRowClick = useCallback((e, worker, index) => {
    if (e.shiftKey && lastSelectedIndexRef.current !== null) {
      const lo = Math.min(lastSelectedIndexRef.current, index);
      const hi = Math.max(lastSelectedIndexRef.current, index);
      setSelectedWorkerIds(prev => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) {
          const w = filteredWorkersRef.current[i];
          if (w) next.add(w.id);
        }
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedWorkerIds(prev => {
        const next = new Set(prev);
        if (next.has(worker.id)) next.delete(worker.id);
        else next.add(worker.id);
        return next;
      });
      lastSelectedIndexRef.current = index;
    } else {
      setSelectedWorkerIds(new Set([worker.id]));
      lastSelectedIndexRef.current = index;
    }
  }, []);

  // ── Row height: fixed 32px (h-8) ──────────────────────────────────────────────
  const ROW_H = 32;

  const getWorkerMokedSignups = (workerId) => {
    const workerAvail = getBestAvail(workerId);
    if (!workerAvail?.shifts) return [];
    const grouped = new Map();

    workerAvail.shifts.forEach(s => {
      if (s.type !== "wanted" && s.type !== "available") return;
      const opDate = s.operational_date || s.date;
      if (viewMode === 'daily') {
        if (opDate !== dateString) return;
      } else {
        const weekStart2 = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd2 = format(addDays(weekStart2, 6), "yyyy-MM-dd");
        const weekStartStr2 = format(weekStart2, "yyyy-MM-dd");
        if (opDate < weekStartStr2 || opDate > weekEnd2) return;
      }
      const key = s.signupKey || `${opDate}__${s.start_time}__${s.end_time}`;
      if (!grouped.has(key)) {
        grouped.set(key, { startTime: s.start_time, endTime: s.end_time, date: opDate, signups: [] });
      }
      grouped.get(key).signups.push(s);
    });

    return Array.from(grouped.values());
  };

  const renderTimelineHeader = () => (
    <div className="relative flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
      {viewMode === 'daily' ? (
        dailySlots.map((hour) => (
          <div key={hour} className="shrink-0 text-xs text-gray-600 py-3 border-l text-center font-medium overflow-hidden" style={{ width: `${60 * ppm}px` }}>
            {String(hour).padStart(2, '0')}:00
          </div>
        ))
      ) : (
        <>
          {weeklySlots.map((slot, idx) => (
            <div key={idx} className={`shrink-0 text-xs text-gray-600 py-1 text-center font-medium overflow-hidden border-l border-l-gray-200`} style={{ width: `${60 * ppm}px` }}>
              {slot.label && <div className="font-bold text-gray-800 text-[10px] leading-tight">{slot.label}</div>}
              {slot.dateLabel && <div className="text-[8px] text-gray-500 leading-tight">{slot.dateLabel}</div>}
              <div className={`text-[8px] leading-tight ${slot.opIndex === 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                {String(slot.hour).padStart(2, '0')}
              </div>
            </div>
          ))}
          {[0,1,2,3,4,5,6].map(day => {
            const px = day * 1440 * ppm;
            return <div key={`hdb-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '2px', backgroundColor: 'rgba(80,80,80,0.5)', zIndex: 5 }} />;
          })}
        </>
      )}
    </div>
  );

  const renderWorkerCellContent = (worker, index) => {
    const sendStatus = getWorkerSendStatus(worker);
    const actionClass = sendStatus === 'none' ? 'text-gray-400 hover:text-gray-500' : sendStatus === 'needs_update' ? 'text-green-500 hover:text-green-600' : 'text-gray-900 hover:text-gray-700';
    return (
      <>
        <div onClick={e => e.stopPropagation()}><WorkerLockButton worker={worker} onUpdate={refreshWorkers} /></div>
        <button
          onClick={e => { e.stopPropagation(); sendWhatsAppNotification(worker); }}
          className={`rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-50 ${actionClass}`}
          title="שלח משמרות בוואטסאפ" disabled={sendingWhatsApp}
        >
          {sendingWhatsApp ? <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : <MessageCircle className="w-4 h-4" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); setSelectedWorkerForNotification(worker); setNotificationNotes(""); setShowNotificationDialog(true); }}
          className={`rounded p-1 transition-colors hover:bg-gray-100 ${actionClass}`}
          title="שלח לוח משמרות באימייל"
        >
          <Send className="w-4 h-4" />
        </button>
        <div className="flex items-center flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="truncate block text-sm leading-tight">{worker.nickname}</span>
            <WeeklySummary worker={worker} />
          </div>
          <Button
            variant="ghost" size="icon" className="h-5 w-5 shrink-0 p-0 mr-1"
            onClick={e => { e.stopPropagation(); handleManualShiftAdd(worker); }}
            title="הוסף חלון זמינות"
          ><Plus className="w-3 h-3" /></Button>
        </div>
      </>
    );
  };

  const renderSummaryCell = (worker, col, index, isSelected) => (
    <div key={col.id} className={`w-[60px] min-w-[60px] border-r flex items-center justify-center h-8 ${isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} style={{ height: `${ROW_H}px` }}>
      <span className="text-xs font-bold text-gray-700">{getWorkerColumnCount(worker.id, col)}</span>
    </div>
  );

  const getWorkerBriefingMarkers = (workerId) => {
    return briefingMarkers.filter(m => {
      if (m.worker_id !== workerId) return false;
      if (viewMode === 'daily') {
        return m.visual_operational_date === dateString;
      } else {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = addDays(weekStart, 6);
        const vd = new Date(m.visual_operational_date + "T12:00:00");
        return vd >= weekStart && vd <= weekEnd;
      }
    });
  };

  const renderTimelineRow = (worker, index, isSelected) => {
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
    const workerBriefingMarkers = getWorkerBriefingMarkers(worker.id);
    const workerMokedSignups = getWorkerMokedSignups(worker.id);

    return (
      <div
        key={worker.id}
        className={`relative border-b cursor-crosshair shrink-0 ${isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
        style={{ width: `${timelineWidth}px`, height: `${ROW_H}px` }}
        dir="rtl"
        data-worker-id={worker.id}
        ref={el => { if (el) timelineRefs.current[worker.id] = el; }}
        onClick={e => handleRowClick(e, worker, index)}
        onMouseDown={(e) => {
          if (
            e.target.closest("[data-matrix-existing-bar='true']") ||
            e.target.closest("button") ||
            e.target.closest("[role='button']") ||
            e.target.closest("[data-no-drag='true']")
          ) return;
          if (e.detail === 2) return;
          handleMouseDown(e, worker, null, 'create');
        }}
      >
        <div className="absolute inset-0 flex" dir="rtl">
          {viewMode === 'daily'
            ? dailySlots.map(hour => {
                const opMin = ((hour - 6 + 24) % 24) * 60;
                const timeStr = `${String(hour).padStart(2,'0')}:00`;
                return (
                  <div
                    key={hour}
                    className="shrink-0 border-l time-slot h-full"
                    style={{ width: `${60 * ppm}px` }}
                    data-matrix-time-slot="true"
                    data-operational-date={dateString}
                    data-operational-minute={opMin}
                    data-time={timeStr}
                    data-day-index={0}
                  />
                );
              })
            : weeklySlots.map((slot, idx) => {
                const opMin = ((slot.hour - 6 + 24) % 24) * 60;
                const timeStr = `${String(slot.hour).padStart(2,'0')}:00`;
                const slotDate = format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), slot.day), 'yyyy-MM-dd');
                return (
                  <div
                    key={idx}
                    className="shrink-0 border-l time-slot h-full"
                    style={{ width: `${60 * ppm}px` }}
                    data-matrix-time-slot="true"
                    data-operational-date={slotDate}
                    data-operational-minute={opMin}
                    data-time={timeStr}
                    data-day-index={slot.day}
                  />
                );
              })
          }
        </div>
        <div className="absolute inset-0" onDoubleClick={(e) => { const bar = e.target.closest("[data-matrix-avail-bar='true']"); if (bar) { e.stopPropagation(); const idx = parseInt(bar.dataset.shiftIdx); const sh = getWorkerAvailabilityForDate(worker.id); if (!isNaN(idx) && sh[idx]) handleShiftDoubleClick(e, worker, sh[idx]); } }}>
          {viewMode === 'weekly' && [0,1,2,3,4,5,6].map(day => {
            const px = day * 1440 * ppm;
            return <div key={`db-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '2px', backgroundColor: 'rgba(80,80,80,0.35)', zIndex: 15 }} />;
          })}
          {availabilityShifts.map((shift, idx) => <AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} shiftIdx={idx} />)}
          {workerUnavailabilities.map(unavail => <UnavailabilityBar key={unavail.id} unavail={unavail} />)}
          {workerTemplateShifts.map(ts => <AssignmentBar key={ts.id} assignment={ts} />)}
          {workerExtraTaskShifts.map(ets => <AssignmentBar key={ets.id} assignment={ets} />)}
          {workerMokedSignups.map((sg, i) => {
            const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(sg.date) : 0;
            return (
              <MokedSignupBar
                key={`mokedsignup_${worker.id}_${i}`}
                signups={sg.signups}
                startTime={sg.startTime}
                endTime={sg.endTime}
                dayIndex={dayIndex}
                viewMode={viewMode}
                ppm={ppm}
                timelineWidth={timelineWidth}
              />
            );
          })}
          {workerBriefingMarkers.map(marker => {
            const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(marker.visual_operational_date) : 0;
            return (
              <BriefingBar
                key={marker.id}
                visualTime={marker.visual_time}
                originalBriefingTime={marker.original_briefing_time}
                linkedShiftDate={marker.linked_shift_operational_date}
                shiftStartTime={marker.shift_start_time}
                shiftEndTime={marker.shift_end_time}
                dayIndex={dayIndex}
                viewMode={viewMode}
                ppm={ppm}
                timeToPixels={timeToPixels}
              />
            );
          })}
          <DragPreviewBar preview={dragPreview} workerId={worker.id} />
        </div>
      </div>
    );
  };

  // ── PINNED LAYOUT ─────────────────────────────────────────────────────────────
  const renderPinnedLayout = () => (
    <div className="flex flex-1 min-h-0" dir="rtl">
      <div
        className="flex flex-col flex-shrink-0 bg-white z-20"
        style={{ width: `${fixedColumnsWidth}px`, boxShadow: '-4px 0 8px rgba(0,0,0,0.06)', borderLeft: '1px solid #e5e7eb' }}
      >
        <div className="flex-shrink-0 bg-gray-100 border-b z-10" style={{ height: '40px' }}>
          <div className="flex items-center h-full">
            <div className="px-2 flex items-center gap-1 h-full border-r relative" style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={togglePin} className="absolute top-1 left-1 flex-shrink-0 text-green-600 hover:text-green-800 transition-colors p-0.5 rounded hover:bg-green-50 z-10">
                      <PinIcon size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent dir="rtl">בטל הקפאת עמודת עובדים</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <MasterControls
                workers={workers} populationFilter={populationFilter} roleFilter={roleFilter}
                getWorkerSendStatus={getWorkerSendStatus}
                onSendWhatsApp={async (visibleWorkers) => { for (const w of visibleWorkers) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
                onSendEmail={async (visibleWorkers) => { for (const w of visibleWorkers) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
                sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
                isWeekPublished={isCurrentWeekPublished}
                onTogglePublish={handleTogglePublish}
                togglingPublish={togglingPublish}
              />
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

        <div
          ref={workerPanelRef}
          className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading && !initialLoaded ? (
            <div className="text-center p-8" dir="rtl">טוען...</div>
          ) : workersLoadFailed ? (
            <div className="text-center p-8 text-gray-500" dir="rtl">
              בעיית טעינה — <button className="underline" onClick={() => loadStaticData()}>נסה שוב</button>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
          ) : (
            filteredWorkers.map((worker, index) => {
              const isSelected = selectedWorkerIds.has(worker.id);
              const rowBg = isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
              return (
                <div
                  key={worker.id}
                  className={`flex border-b cursor-pointer select-none ${rowBg}`}
                  style={{ height: `${ROW_H}px` }}
                  onClick={e => handleRowClick(e, worker, index)}
                >
                  <div
                    className={`px-1 font-medium text-gray-800 border-r flex items-center gap-1 h-full ${rowBg}`}
                    style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}
                  >
                    {renderWorkerCellContent(worker, index)}
                  </div>
                  {viewMode === 'weekly' && summaryColumns.map(col => renderSummaryCell(worker, col, index, isSelected))}
                  {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-full ${rowBg}`} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div
          ref={timelineHeaderRef}
          className="flex-shrink-0 bg-gray-100 border-b"
          style={{ height: '40px', overflowX: 'hidden', scrollbarWidth: 'none' }}
          dir="ltr"
        >
          <div style={{ width: `${timelineWidth}px` }}>
            {renderTimelineHeader()}
          </div>
        </div>

        <div
          ref={timelineScrollRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-auto matrix-scroll-container matrix-timeline-pinned"
          dir="ltr"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
        >
          <div dir="rtl" style={{ width: `${timelineWidth}px` }}>
            {loading && !initialLoaded ? null : (
              filteredWorkers.map((worker, index) => renderTimelineRow(worker, index, selectedWorkerIds.has(worker.id)))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── CLASSIC (UNPINNED) LAYOUT ─────────────────────────────────────────────────
  const renderClassicLayout = () => (
    <div
      ref={scrollContainerRef}
      dir="ltr"
      className="overflow-x-auto overflow-y-auto flex-1 min-h-0 matrix-scroll-container"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
    >
      <div dir="rtl" style={{ width: `${totalMatrixWidth}px`, minWidth: `${totalMatrixWidth}px` }}>
        <div className="flex sticky top-0 bg-gray-100 z-30 border-b" style={{ width: `${totalMatrixWidth}px` }}>
          <div className="p-2 font-semibold text-gray-700 border-r sticky left-0 bg-gray-100 z-30 flex items-center justify-start gap-2 relative" dir="rtl" style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={togglePin} className="absolute top-1 left-1 flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors p-0.5 rounded hover:bg-green-50 z-10">
                    <PinIcon size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent dir="rtl">הקפא עמודת עובדים</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <MasterControls
              workers={workers} populationFilter={populationFilter} roleFilter={roleFilter}
              getWorkerSendStatus={getWorkerSendStatus}
              onSendWhatsApp={async (visibleWorkers) => { for (const w of visibleWorkers) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
              onSendEmail={async (visibleWorkers) => { for (const w of visibleWorkers) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
              sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
              isWeekPublished={isCurrentWeekPublished}
              onTogglePublish={handleTogglePublish}
              togglingPublish={togglingPublish}
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

        {loading && !initialLoaded ? (
          <div className="text-center p-8" dir="rtl">טוען...</div>
        ) : workersLoadFailed ? (
          <div className="text-center p-8 text-gray-500" dir="rtl">
            בעיית טעינה — <button className="underline" onClick={() => loadStaticData()}>נסה שוב</button>
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
        ) : (
          filteredWorkers.map((worker, index) => {
            const isSelected = selectedWorkerIds.has(worker.id);
            const rowBg = isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
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
            const workerBriefingMarkers = getWorkerBriefingMarkers(worker.id);
            const workerMokedSignups = getWorkerMokedSignups(worker.id);

            return (
              <div
                key={worker.id}
                className={`flex border-b shrink-0 cursor-pointer select-none ${rowBg}`}
                style={{ width: `${totalMatrixWidth}px`, height: `${ROW_H}px` }}
                onClick={e => handleRowClick(e, worker, index)}
              >
                <div
                  className={`px-1 font-medium text-gray-800 border-r flex items-center gap-1 sticky left-0 z-20 h-full ${rowBg}`}
                  style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}
                >
                  {renderWorkerCellContent(worker, index)}
                </div>
                {viewMode === 'weekly' && summaryColumns.map(col => renderSummaryCell(worker, col, index, isSelected))}
                {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-full ${rowBg}`} />}
                <ClassicTimelineRow
                  worker={worker} index={index} isSelected={isSelected} rowBg={rowBg}
                  timelineWidth={timelineWidth} ppm={ppm} viewMode={viewMode}
                  dateString={dateString} currentDate={currentDate}
                  dailySlots={dailySlots} weeklySlots={weeklySlots}
                  availabilityShifts={availabilityShifts}
                  workerUnavailabilities={workerUnavailabilities}
                  workerTemplateShifts={workerTemplateShifts}
                  workerExtraTaskShifts={workerExtraTaskShifts}
                  workerMokedSignups={workerMokedSignups}
                  workerBriefingMarkers={workerBriefingMarkers}
                  dragPreview={dragPreview}
                  handleMouseDown={handleMouseDown}
                  getDayIndexFromDate={getDayIndexFromDate}
                  timeToPixels={timeToPixels}
                  endTimeToPixels={endTimeToPixels}
                  getTimelineRangeStyle={getTimelineRangeStyle}
                  getOperationalMinutes={getOperationalMinutes}
                  getOperationalEndMinutes={getOperationalEndMinutes}
                  isStandbyStatus={isStandbyStatus}
                  isWorkerAssignedToRow={isWorkerAssignedToRow}
                  allTemplates={allTemplates}
                  templateRows={templateRows}
                  timesOverlap={timesOverlap}
                  handleTypeClick={handleTypeClick}
                  handleShiftDoubleClick={handleShiftDoubleClick}
                  canManage={canManage}
                  onEditUnavail={setEditingUnavail}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 p-2 pb-[100px] md:pb-14"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      dir="rtl"
    >
      <style>{`
        .matrix-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .matrix-scroll-container::-webkit-scrollbar {
          height: 8px;
          width: 6px;
        }
        .matrix-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .matrix-scroll-container::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 4px;
          transition: background-color 0.15s ease;
        }
        .matrix-scroll-container:hover::-webkit-scrollbar-thumb {
          background-color: #94a3b8;
        }
        .matrix-scroll-container::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }
        .matrix-timeline-pinned::-webkit-scrollbar:vertical {
          display: none;
        }
        .matrix-timeline-pinned {
          scrollbar-width: thin;
        }
      `}</style>
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

        <Card className="border-none shadow-lg flex-1 min-h-0 flex flex-col">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
            {pinned ? renderPinnedLayout() : renderClassicLayout()}
          </CardContent>
        </Card>

        {/* ── Fixed bottom zoom bar ── */}
        <div className="fixed bottom-12 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md flex items-center gap-2 px-3 py-1.5" dir="rtl" style={{ zIndex: 90 }}>
          <span className="text-xs text-gray-500 font-medium">רזולוציה:</span>
          <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 text-sm font-bold transition-colors" title="הקטן רזולוציית זמן">−</button>
          <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 text-sm font-bold transition-colors" title="הגדל רזולוציית זמן">+</button>
          <span className="text-[10px] text-gray-400 mr-auto">Ctrl+גלגל לזום · גרירת גלגל לגלילה</span>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1 px-2 py-1 rounded border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium transition-colors"
            title="יצוא מטריצה לאקסל"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>

        <SummaryColumnsDialog open={showSummaryColumnsDialog} onOpenChange={setShowSummaryColumnsDialog} summaryColumns={summaryColumns} saveSummaryColumns={saveSummaryColumns} shiftStatuses={shiftStatuses} scheduleParams={scheduleParams} trackers={trackers} />
        <NotificationDialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog} viewMode={viewMode} currentDate={currentDate} selectedWorkerForNotification={selectedWorkerForNotification} notificationNotes={notificationNotes} setNotificationNotes={setNotificationNotes} getWorkerTemplateShifts={getWorkerTemplateShifts} getWorkerExtraTaskShifts={getWorkerExtraTaskShifts} sendNotification={sendNotification} />
        <TypeChangeDialog open={showTypeDialog} onOpenChange={setShowTypeDialog} handleChangeType={handleChangeType} />
        <ManualShiftDialog open={showManualDialog} onOpenChange={(v) => { setShowManualDialog(v); if (!v) { setSelectedWorkerForManual(null); setManualShiftData({ start_time: '', end_time: '', type: 'available', date: dateString, reason: 'occupied' }); setEditingShift(null); } }} editingShift={editingShift} selectedWorkerForManual={selectedWorkerForManual} manualShiftData={manualShiftData} setManualShiftData={setManualShiftData} submitManualShift={submitManualShift} deleteShift={deleteManualShift} />
        <UnavailabilityDialog
          open={!!editingUnavail}
          onOpenChange={(v) => { if (!v) setEditingUnavail(null); }}
          editingUnavail={editingUnavail || {}}
          setEditingUnavail={setEditingUnavail}
          onSave={handleSaveUnavail}
        />
      </div>
    </div>
  );
}
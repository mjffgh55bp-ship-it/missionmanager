import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Gauge, Pin, PinOff, Filter, BarChart2, Target, Sliders } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { base44 } from "@/api/base44Client";
import ColumnConfigDialog from "./ColumnConfigDialog";
import VisualAnalysisDialog, { getVisualColor } from "./VisualAnalysisDialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { getOperationalStartDate, calcShiftHours } from "@/lib/operationalDate";
import WorkerPillFilter from "@/components/shared/WorkerPillFilter";

const COLUMN_TYPES = [
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "schedule_col", label: "סיכום שעות לפי טקסט" },
  { value: "count_by_text", label: "סיכום פעמים לפי טקסט" },
  { value: "count_by_task", label: "ספירה לפי משימה" },
  { value: "count_quantitative", label: "ספירה כמותית" },
];

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  return Math.round(calcShiftHours(start, end) * 10) / 10;
};

const getDateRange = (mode, startDate, endDate) => {
  const today = new Date();
  if (mode === "daily") { const d = format(today, "yyyy-MM-dd"); return { start: d, end: d }; }
  if (mode === "week") return { start: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"), end: format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd") };
  if (mode === "month") return { start: format(startOfMonth(today), "yyyy-MM-dd"), end: format(endOfMonth(today), "yyyy-MM-dd") };
  if (mode === "last_30_days") { return { start: format(subDays(today, 30), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") }; }
  if (mode === "half_year") { const s = new Date(today); s.setMonth(s.getMonth() - 6); return { start: format(s, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") }; }
  if (mode === "half_year_start") {
    const m = today.getMonth();
    const halfStart = m < 6 ? new Date(today.getFullYear(), 0, 1) : new Date(today.getFullYear(), 6, 1);
    return { start: format(halfStart, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
  if (mode === "year_start") { return { start: format(new Date(today.getFullYear(), 0, 1), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") }; }
  if (mode === "custom" && startDate && endDate) return { start: startDate, end: endDate };
  return null;
};

const DATE_MODES = [
  { value: "all", label: "כל הזמן" },
  { value: "daily", label: "היום" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "last_30_days", label: "30 יום אחרונים" },
  { value: "half_year", label: "חצי שנה" },
  { value: "half_year_start", label: "מתחילת חציון" },
  { value: "year_start", label: "מתחילת שנה" },
  { value: "custom", label: "מותאם" },
];



export default function TrackerTable({ tracker: initialTracker, workers, assignments, templateRows, allTemplates, populations, workerRoles, scheduleColumns = [], qualifications = [], workerQualifications = [], onDelete, onUpdated, onDragStart }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [entries, setEntries] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [cellDraft, setCellDraft] = useState("");

  // Filters — persist to localStorage
  const [dateFilterMode, setDateFilterMode] = useState(() => {
    try { return localStorage.getItem(`tracker_filter_dateMode_${initialTracker.id}`) || "all"; } catch { return "all"; }
  });
  const [startDate, setStartDate] = useState(() => {
    try { return localStorage.getItem(`tracker_filter_startDate_${initialTracker.id}`) || ""; } catch { return ""; }
  });
  const [endDate, setEndDate] = useState(() => {
    try { return localStorage.getItem(`tracker_filter_endDate_${initialTracker.id}`) || ""; } catch { return ""; }
  });
  const [selectedPopulations, setSelectedPopulations] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_filter_pops_${initialTracker.id}`) || "[]"); } catch { return []; }
  });
  const [selectedRoles, setSelectedRoles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_filter_roles_${initialTracker.id}`) || "[]"); } catch { return []; }
  });
  const [selectedQualifications, setSelectedQualifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_filter_quals_${initialTracker.id}`) || "[]"); } catch { return []; }
  });
  const [selectedWorkerIds, setSelectedWorkerIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_filter_workers_${initialTracker.id}`) || "[]"); } catch { return []; }
  });
  const [workerSearch, setWorkerSearch] = useState("");
  const [guide, setGuide] = useState("__all__");
  const [showFilters, setShowFilters] = useState(false);
  // Pin is ON by default unless user explicitly turned it off
  const [headerPinned, setHeaderPinned] = useState(() => {
    try {
      const stored = localStorage.getItem(`tracker_pin_${initialTracker.id}`);
      // null = never changed by user = default ON; "false" = user turned off; "true" = user turned on
      return stored === null ? true : stored === "true";
    } catch { return true; }
  });
  // Track whether the user has explicitly changed the pin state
  const [pinUserModified, setPinUserModified] = useState(() => {
    try { return localStorage.getItem(`tracker_pin_${initialTracker.id}`) !== null; } catch { return false; }
  });
  const [colWidths, setColWidths] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_colwidths_${initialTracker.id}`) || "{}"); } catch { return {}; }
  });
  const resizingRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const [editColumns, setEditColumns] = useState([]);
  const [configuringCol, setConfiguringCol] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Visual Analysis — persisted to localStorage
  const [visualConfigs, setVisualConfigs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_visualConfigs_${initialTracker.id}`) || "{}"); } catch { return {}; }
  });
  // Per-column: tracks whether the custom config is currently "shown" or "hidden" (toggle)
  const [visualActive, setVisualActive] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tracker_visualActive_${initialTracker.id}`) || "{}"); } catch { return {}; }
  });
  const [visualDialogCol, setVisualDialogCol] = useState(null); // col object
  const gaugeClickTimerRef = useRef({}); // colId -> timeout id for double-click detection

  // Sorting
  const [sortColId, setSortColId] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSortClick = (colId) => {
    if (sortColId === colId) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColId(colId);
      setSortDir("asc");
    }
  };

  const togglePin = () => {
    const next = !headerPinned;
    setHeaderPinned(next);
    setPinUserModified(true);
    try { localStorage.setItem(`tracker_pin_${tracker.id}`, String(next)); } catch {}
  };

  const startColResize = useCallback((e, colKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 140;
    resizingRef.current = { colKey, startX, startWidth };

    const onMove = (me) => {
      const delta = startX - me.clientX; // RTL: drag left = wider
      const newWidth = Math.max(60, startWidth + delta);
      setColWidths(prev => {
        const next = { ...prev, [colKey]: newWidth };
        try { localStorage.setItem(`tracker_colwidths_${tracker.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths, tracker.id]);

  // Persist filter changes to localStorage
  useEffect(() => { try { localStorage.setItem(`tracker_filter_dateMode_${tracker.id}`, dateFilterMode); } catch {} }, [dateFilterMode, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_startDate_${tracker.id}`, startDate); } catch {} }, [startDate, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_endDate_${tracker.id}`, endDate); } catch {} }, [endDate, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_pops_${tracker.id}`, JSON.stringify(selectedPopulations)); } catch {} }, [selectedPopulations, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_roles_${tracker.id}`, JSON.stringify(selectedRoles)); } catch {} }, [selectedRoles, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_quals_${tracker.id}`, JSON.stringify(selectedQualifications)); } catch {} }, [selectedQualifications, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_filter_workers_${tracker.id}`, JSON.stringify(selectedWorkerIds)); } catch {} }, [selectedWorkerIds, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_visualConfigs_${tracker.id}`, JSON.stringify(visualConfigs)); } catch {} }, [visualConfigs, tracker.id]);
  useEffect(() => { try { localStorage.setItem(`tracker_visualActive_${tracker.id}`, JSON.stringify(visualActive)); } catch {} }, [visualActive, tracker.id]);

  // Returns the effective config for a column (null if toggled off)
  const getEffectiveVisualConfig = (colId) => {
    const cfg = visualConfigs[colId];
    if (!cfg) return null;
    if (visualActive[colId] === false) return null;
    return cfg;
  };

  // Handle Gauge button click — single = avg_scale toggle, double = open dialog
  const handleGaugeClick = (col) => {
    const colId = col.id;
    const existing = visualConfigs[colId];

    if (gaugeClickTimerRef.current[colId]) {
      // Double click detected — clear single-click timer and open dialog
      clearTimeout(gaugeClickTimerRef.current[colId]);
      gaugeClickTimerRef.current[colId] = null;
      setVisualDialogCol(col);
      return;
    }

    // Start single-click timer (250ms window for double-click)
    gaugeClickTimerRef.current[colId] = setTimeout(() => {
      gaugeClickTimerRef.current[colId] = null;

      if (!existing) {
        // No config yet → apply avg_scale automatically
        const vals = filteredWorkers.map(w => {
          const v = computeAutoValue(col, w.id);
          if (typeof v === "number") return v;
          if (typeof v === "object" && v !== null) {
            if (col.quantitative_single_item) return v[col.quantitative_single_item] || 0;
            return Object.values(v).reduce((s, x) => s + (x || 0), 0);
          }
          return 0;
        }).filter(v => !isNaN(v) && v > 0);
        const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
        const cfg = { mode: "avg_scale", _avg: avg };
        setVisualConfigs(prev => ({ ...prev, [colId]: cfg }));
        setVisualActive(prev => ({ ...prev, [colId]: true }));
      } else {
        // Has config → toggle active state
        setVisualActive(prev => ({ ...prev, [colId]: !(prev[colId] !== false) }));
      }
    }, 250);
  };

  useEffect(() => { loadEntries(); }, [tracker.id]);
  useEffect(() => { setTracker(initialTracker); }, [initialTracker]);

  useEffect(() => {
    // Real-time sync for this tracker's entries
    const unsubTrackerEntries = base44.entities.TrackerEntry.subscribe((event) => {
      if (event.data?.tracker_id !== tracker.id) return;
      if (event.type === "create") {
        setEntries(prev => [...prev, event.data]);
      } else if (event.type === "update") {
        setEntries(prev => prev.map(e => e.id === event.id ? event.data : e));
      } else if (event.type === "delete") {
        setEntries(prev => prev.filter(e => e.id !== event.id));
      }
    });
    return unsubTrackerEntries;
  }, [tracker.id]);

  const openEditMode = () => {
    setEditColumns((tracker.columns || []).map(c => ({ ...c })));
    setEditMode(true);
  };

  const saveAndExitEditMode = async () => {
    setSavingEdit(true);
    // editColumns may have already been saved per-column; save final state to ensure consistency
    const updated = await base44.entities.Tracker.update(tracker.id, { columns: editColumns });
    setTracker(updated);
    onUpdated(updated);
    setEditMode(false);
    setSavingEdit(false);
  };

  const removeEditColumn = (colId) => {
    setEditColumns(prev => prev.filter(c => c.id !== colId));
  };

  const addNewEditColumn = () => {
    const newCol = {
      id: Date.now().toString(),
      name: "עמודה חדשה",
      description: "",
      type: "schedule_col",
      schedule_col_name: "",
      criteria: [],
    };
    setEditColumns(prev => [...prev, newCol]);
    setConfiguringCol(newCol);
  };

  const saveColConfig = async (updatedCol) => {
    // Compute new columns synchronously
    const currentCols = editColumns;
    const exists = currentCols.find(c => c.id === updatedCol.id);
    const newCols = exists
      ? currentCols.map(c => c.id === updatedCol.id ? updatedCol : c)
      : [...currentCols, updatedCol];

    // Update state and close dialog
    setEditColumns(newCols);
    setConfiguringCol(null);

    // Persist to DB
    const updated = await base44.entities.Tracker.update(tracker.id, { columns: newCols });
    setTracker(updated);
    onUpdated(updated);
  };

  const loadingRef = useRef(false);
  const fetchWithRetry = async (fn, retries = 6, baseDelay = 800) => {
    for (let i = 0; i < retries; i++) {
      try { return await fn(); }
      catch (e) {
        const isRateLimit = e?.message?.includes('Rate limit') || e?.message?.includes('rate limit');
        if (isRateLimit && i < retries - 1) {
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
        } else if (isRateLimit) {
          return [];
        } else {
          throw e;
        }
      }
    }
  };
  const loadEntries = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await fetchWithRetry(() => base44.entities.TrackerEntry.filter({ tracker_id: tracker.id }));
      setEntries(data || []);
    } finally {
      loadingRef.current = false;
    }
  };

  const getEntry = (workerId, colId) => entries.find(e => e.worker_id === workerId && e.column_id === colId);

  const startCellEdit = (workerId, colId) => {
    setCellDraft(getEntry(workerId, colId)?.value || "");
    setEditingCell({ workerId, colId });
  };

  const saveCell = async () => {
    if (!editingCell) return;
    const { workerId, colId } = editingCell;
    const existing = getEntry(workerId, colId);
    let updated;
    if (existing) {
      updated = await base44.entities.TrackerEntry.update(existing.id, { value: cellDraft });
      setEntries(entries.map(e => e.id === existing.id ? updated : e));
    } else {
      updated = await base44.entities.TrackerEntry.create({ tracker_id: tracker.id, worker_id: workerId, column_id: colId, value: cellDraft });
      setEntries([...entries, updated]);
    }
    setEditingCell(null);
  };

  const toggleCheckbox = async (workerId, colId, currentValue) => {
    const entry = getEntry(workerId, colId);
    const newVal = currentValue === "true" ? "" : "true";
    if (entry) {
      const updated = await base44.entities.TrackerEntry.update(entry.id, { value: newVal });
      setEntries(entries.map(e => e.id === entry.id ? updated : e));
    } else {
      const created = await base44.entities.TrackerEntry.create({ tracker_id: tracker.id, worker_id: workerId, column_id: colId, value: newVal });
      setEntries([...entries, created]);
    }
  };

  const WORKER_ROLE_COL_NAME = "__תפקיד__";

  const computeAutoValue = (col, workerId) => {
  const dateRange = getDateRange(dateFilterMode, startDate, endDate);

  // ── Role criteria — filter at SHIFT level ──────────────────────────
  // Instead of checking whether the worker HAS a role in their profile,
  // we check whether the worker was ASSIGNED to that specific role in
  // each individual shift. A worker might fill different roles in different shifts.
  const roleCriteria = (col.criteria || []).filter(c => c.col_name === WORKER_ROLE_COL_NAME && c.include?.length > 0);
  const expectedRoles = roleCriteria.length > 0 ? roleCriteria.flatMap(c => c.include) : null;
  // Use component-level role maps (roleIdByName / roleNameById)
    const _roleIdByName = roleIdByName;
    const _roleNameById = roleNameById;

  // Helper: check if the worker was assigned to a matching role in a given shift
    const workerMatchesRoleInShift = (shiftData, isTemplateRow = false, template = null) => {
      if (!expectedRoles) return true;

      // Check if a column name/role_filter matches any of the expected roles
      // Expected roles can be mapping_ids (e.g. "role_abc") or plain names (e.g. "נהג")
      const colRoleMatches = (col) => {
        // Collect all possible identifiers for this column's role:
        // 1. explicit role_mapping_id on column
        // 2. role_filter field
        // 3. the column name itself (most common case: column named "נהג" = that role)
        const candidates = [
          col.role_mapping_id,
          col.role_filter,
          col.name,
          col.name && _roleIdByName[col.name.trim()],   // name → id
          col.role_filter && _roleIdByName[col.role_filter.trim()],
        ].filter(Boolean);

        return expectedRoles.some(er => {
          // Direct match against any candidate
          if (candidates.includes(er)) return true;
          // er might be a mapping_id — check if its display name matches any candidate
          const erName = _roleNameById[er];
          if (erName && candidates.includes(erName)) return true;
          // er might be a display name — check if any candidate is its id
          const erId = _roleIdByName[er];
          if (erId && candidates.includes(erId)) return true;
          return false;
        });
      };

      if (isTemplateRow && template) {
        const allWorkerCols = (template.columns || []).filter(c => c.type === "worker");
        return allWorkerCols.some(tc => {
          // Is THIS worker assigned in this column? (support name-keyed and id-keyed storage)
          const valByName = shiftData.values?.[tc.name];
          const valById = tc.column_id ? shiftData.values?.[tc.column_id] : undefined;
          if (valByName !== workerId && valById !== workerId) return false;
          return colRoleMatches(tc);
        });
      }

      // Non-template (saved assignment) path — check scheduleColumns registry
      const vals = shiftData.column_values || {};
      const matchedViaRegistry = scheduleColumns.some(sc => {
        if (sc.type !== "worker") return false;
        if (!colRoleMatches(sc)) return false;
        return vals[sc.name] === workerId || (sc.mapping_id && vals[sc.mapping_id] === workerId);
      });
      if (matchedViaRegistry) return true;

      // Fallback: check column_values keys directly — key name IS the role column name
      return Object.entries(vals).some(([colName, colVal]) => {
        if (colVal !== workerId) return false;
        // Check if this column name corresponds to one of the expected roles
        const fakecol = { name: colName, role_filter: colName, role_mapping_id: null };
        return colRoleMatches(fakecol);
      });
    };

  // Get the actual cell values for a schedule column (supports old string + new JSON)
    const getCellVals = (vals, colName) => {
      const fieldVal = vals?.[colName];
      const subTypes = vals?.[`${colName}_subTypes`] || [];
      return [fieldVal, ...subTypes].filter(Boolean).map(String);
    };

    // Check criteria array (new format) or fall back to old col_value_filter
    const TASK_COL = "__משימה__";
    const TIME_RANGE_COL = "__טווח_שעות__";
    const DAY_OF_WEEK_COL = "__ימי_שבוע__";
    const parseQuantJson = (raw) => {
      if (!raw) return {};
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return {}; }
    };
    const calculateHoursInRange = (startTime, endTime, timeRanges) => {
      if (!startTime || !endTime) return 0;

      const timeToMinutes = (timeStr) => {
        if (!timeStr) return NaN;
        // Handle "+1 HH:MM" format (next day)
        const nextDayMatch = timeStr.match(/^\+(\d+)\s+(\d{2}):(\d{2})$/);
        if (nextDayMatch) {
          const days = parseInt(nextDayMatch[1]);
          const h = parseInt(nextDayMatch[2]);
          const m = parseInt(nextDayMatch[3]);
          return days * 1440 + h * 60 + m;
        }
        const parts = timeStr.split(":");
        const h = parseInt(parts[0]);
        const m = parseInt(parts[1] || "0");
        if (isNaN(h)) return NaN;
        return h * 60 + m;
      };

      let shiftStart = timeToMinutes(startTime);
      let shiftEnd = timeToMinutes(endTime);
      if (isNaN(shiftStart) || isNaN(shiftEnd)) return 0;
      // Normalize next-day times to same-day (mod 1440)
      shiftStart = shiftStart % 1440;
      shiftEnd = shiftEnd % 1440;
      const shiftCrossesMidnight = shiftStart > shiftEnd; // e.g., 22:00 > 06:00

      let totalMinutes = 0;

      timeRanges.forEach(rangeStr => {
        const rangeMatch = rangeStr.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (!rangeMatch) return;
        const rangeStart = rangeMatch[1];
        const rangeEnd = rangeMatch[2];
        const rangeStartMin = timeToMinutes(rangeStart);
        const rangeEndMin = timeToMinutes(rangeEnd);
        const rangeCrossesMidnight = rangeStartMin > rangeEndMin;

        if (shiftCrossesMidnight) {
          // Shift crosses midnight (e.g., 22:00-06:00)
          if (rangeCrossesMidnight) {
            // Both cross midnight: calculate overlap in both parts
            const overlap1 = Math.max(0, Math.min(1440, 1440) - Math.max(shiftStart, rangeStartMin));
            const overlap2 = Math.max(0, Math.min(shiftEnd, rangeEndMin) - Math.max(0, 0));
            totalMinutes += overlap1 + overlap2;
          } else {
            // Range doesn't cross midnight (e.g., 00:00-02:00 or 06:00-14:00)
            // Check if it overlaps with second part [0, shiftEnd)
            if (rangeEndMin > 0 && rangeStartMin < shiftEnd) {
              totalMinutes += Math.min(shiftEnd, rangeEndMin) - Math.max(0, rangeStartMin);
            }
            // Check if it overlaps with first part [shiftStart, 1440)
            if (rangeEndMin > shiftStart && 1440 > rangeStartMin) {
              totalMinutes += Math.min(1440, rangeEndMin) - Math.max(shiftStart, rangeStartMin);
            }
          }
        } else {
          // Shift doesn't cross midnight (e.g., 06:00-22:00)
          if (rangeCrossesMidnight) {
            // Range crosses midnight (e.g., 22:00-06:00)
            // Check overlap with first part of range [rangeStartMin, 1440)
            if (shiftStart < 1440 && shiftEnd > rangeStartMin) {
              totalMinutes += Math.min(1440, shiftEnd) - Math.max(shiftStart, rangeStartMin);
            }
            // Check overlap with second part of range [0, rangeEndMin)
            if (shiftStart < rangeEndMin && shiftEnd > 0) {
              totalMinutes += Math.min(shiftEnd, rangeEndMin) - Math.max(shiftStart, 0);
            }
          } else {
            // Both don't cross midnight - standard range intersection
            const overlapStart = Math.max(shiftStart, rangeStartMin);
            const overlapEnd = Math.min(shiftEnd, rangeEndMin);
            if (overlapEnd > overlapStart) {
              totalMinutes += overlapEnd - overlapStart;
            }
          }
        }
      });

      return totalMinutes / 60;
    };

    const matchesCriteria = (vals, assignmentObj) => {
      const criteria = col.criteria;
      if (criteria && criteria.length > 0) {
        // For count_quantitative, always use "and" logic to enforce all criteria must match
        const criteriaLogic = col.type === "count_quantitative" ? "and" : (col.criteria_logic || "or");
        const checkOne = (c) => {
          if (!c.col_name) return true; // no column selected = match all
          if (!c.include?.length) {
            // Empty include means nothing selected - don't match
            // This prevents untrained criteria from passing
            return false;
          }
          if (c.col_name === TIME_RANGE_COL) {
            // Check if shift overlaps with any of the time ranges (handles cross-midnight ranges)
            const shiftStart = assignmentObj?.start_time || vals?.["התחלה"] || vals?.["שעת התחלה"];
            const shiftEnd = assignmentObj?.end_time || vals?.["סיום"] || vals?.["שעת סיום"];
            if (!shiftStart || !shiftEnd) return false;
            
            const matches = (rangeStr) => {
              // Use calculateHoursInRange to check if there's any overlap
              const hoursInRange = calculateHoursInRange(shiftStart, shiftEnd, [rangeStr]);
              return hoursInRange > 0;
            };
            if (c.logic === "and") return c.include.every(r => matches(r));
            return c.include.some(r => matches(r));
          }
          if (c.col_name === DAY_OF_WEEK_COL) {
            // assignmentObj.date is "YYYY-MM-DD"; getDay() returns 0=Sun..6=Sat
            const date = assignmentObj?.date || vals?.["תאריך"];
            if (!date) return false;
            const dayNum = String(new Date(date + "T12:00:00").getDay());
            return c.include.includes(dayNum);
          }
          if (c.col_name === WORKER_ROLE_COL_NAME) {
            // Already filtered at worker level — always pass here
            return true;
          }
          if (c.col_name === TASK_COL) {
            // Task can be stored as:
            // 1. assignmentObj.qualification_id = ID of qualification
            // 2. column_values["משימה"] = ID or name of qualification
            const taskQualId = assignmentObj?.qualification_id || "";
            const taskColVal = String(vals?.["משימה"] || "");
            if (!taskQualId && !taskColVal) return false;

            // For each value in c.include (which is a qualification ID):
            const matches = (v) => {
              // Direct ID match against qualification_id field
              if (v === taskQualId) return true;
              // Direct match against column value (might be ID or name)
              if (v === taskColVal) return true;
              // Column value might be a name — check if qual with this ID has that name
              const qual = qualifications.find(q => q.id === v);
              if (qual && qual.name === taskColVal) return true;
              // Column value might be an ID — check if it matches
              if (taskColVal && v === taskColVal) return true;
              // qual_id might be stored as name in column_values
              const qualByName = qualifications.find(q => q.name === taskColVal);
              if (qualByName && qualByName.id === v) return true;
              return false;
            };
            if (c.logic === "and") return c.include.every(v => matches(v));
            return c.include.some(v => matches(v));
          }
          // Check if this is a quantitative column (value stored as JSON like {"A":1,"B":0})
          const rawVal = vals?.[c.col_name];
          if (typeof rawVal === "string" && rawVal.startsWith("{")) {
            const parsed = parseQuantJson(rawVal);
            const matches = (v) => (parsed[v] || 0) > 0;
            if (c.logic === "and") return c.include.every(v => matches(v));
            return c.include.some(v => matches(v));
          }
          const cellVals = getCellVals(vals, c.col_name);
          if (c.logic === "and") return c.include.every(v => cellVals.includes(v));
          return c.include.some(v => cellVals.includes(v));
        };
        if (criteriaLogic === "and") return criteria.every(c => checkOne(c));
        return criteria.some(c => checkOne(c));
      }
      return true; // no criteria = match all
    };

    const matchesColValueFilter = (vals, colName, assignmentObj) => {
      if (col.criteria?.length) return matchesCriteria(vals, assignmentObj);
      return true;
    };

    const filtered = assignments.filter(a => {
      if (!(a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)) return false;
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    });

    if (col.type === "shifts_count") {
      return filtered.filter(a => matchesCriteria(a.column_values, a) && workerMatchesRoleInShift(a)).length;
    }

    if (col.type === "schedule_col") {
      // Check if this is a quantitative-sum mode: criteria targets a quantitative column (JSON values)
      const quantCriteria = (col.criteria || []).filter(c =>
        c.col_name && c.col_name !== "__משימה__" && c.include?.length > 0
      );
      const isQuantSum = quantCriteria.length > 0 && (() => {
        // Check if any templateRow has that column stored as JSON
        const colName = quantCriteria[0].col_name;
        return templateRows.some(r => {
          const v = r.values?.[colName];
          return typeof v === "string" && v.startsWith("{");
        }) || assignments.some(a => {
          const v = a.column_values?.[quantCriteria[0].col_name];
          return typeof v === "string" && v.startsWith("{");
        });
      })();

      let total = 0;

      // Time range criteria always applies as AND filter
      const timeRangeC = (col.criteria || []).find(c => c.col_name === TIME_RANGE_COL);
      const checkTimeRange = (startT, endT) => {
        if (!timeRangeC || !timeRangeC.include?.length) return true;
        if (!startT || !endT) return false;
        return calculateHoursInRange(startT, endT, timeRangeC.include) > 0;
      };

      if (isQuantSum) {
        // Sum the numeric values from JSON for each include item across all matching rows
        const colName = quantCriteria[0].col_name;
        const includeItems = quantCriteria.flatMap(c => c.include);
        filtered.forEach(a => {
          if (!checkTimeRange(a.start_time, a.end_time)) return;
          if (!workerMatchesRoleInShift(a)) return;
          const raw = a.column_values?.[colName];
          if (!raw) return;
          const parsed = parseQuantJson(raw);
          includeItems.forEach(item => { total += parsed[item] || 0; });
        });
        templateRows.forEach(row => {
          const tmpl = allTemplates.find(t => t.id === row.template_id);
          if (!tmpl) return;
          const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
          const rowStartTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (tmplTimeCols[0] ? row.values?.[tmplTimeCols[0].name] : "") || "";
          const rowEndTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (tmplTimeCols[1] ? row.values?.[tmplTimeCols[1].name] : "") || "";
          const effectiveDate = getOperationalStartDate(row.date, rowStartTime || "06:00");
          if (dateRange && (effectiveDate < dateRange.start || effectiveDate > dateRange.end)) return;
          if (!(tmpl.columns || []).some(tc => tc.type === "worker" && (row.values?.[tc.name] === workerId || (tc.column_id && row.values?.[tc.column_id] === workerId)))) return;
          if (!checkTimeRange(rowStartTime, rowEndTime)) return;
          if (!workerMatchesRoleInShift(row, true, tmpl)) return;
          const raw = row.values?.[colName];
          if (!raw) return;
          const parsed = parseQuantJson(raw);
          includeItems.forEach(item => { total += parsed[item] || 0; });
        });
      } else {
        filtered.forEach(a => {
          if (!matchesCriteria(a.column_values, a)) return;
          if (!workerMatchesRoleInShift(a)) return;
          // If criteria include time range, only count hours within that range
          const timeRangeCriteria = (col.criteria || []).find(c => c.col_name === TIME_RANGE_COL);
          if (timeRangeCriteria && timeRangeCriteria.include?.length > 0) {
            const hoursInRange = calculateHoursInRange(a.start_time, a.end_time, timeRangeCriteria.include);
            total += hoursInRange;
          } else {
            total += a.hours || 0;
          }
        });
        templateRows.forEach(row => {
          const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "";
          const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || "";
          const effectiveDate = getOperationalStartDate(row.date, startTime || "06:00");
          if (dateRange && (effectiveDate < dateRange.start || effectiveDate > dateRange.end)) return;
          const tmpl = allTemplates.find(t => t.id === row.template_id);
          if (!tmpl) return;
          // Check if this row has the worker anywhere (not just one column)
          const hasWorker = (tmpl.columns || []).some(tc => 
            tc.type === "worker" && (
              row.values?.[tc.name] === workerId ||
              (tc.column_id && row.values?.[tc.column_id] === workerId)
            )
          );
          if (!hasWorker) return;
          
          // Check if criteria match this row (as if it's an assignment)
          const rowAsAssignment = { qualification_id: row.values?.task || "" };
          if (!matchesCriteria(row.values, rowAsAssignment)) return;
          if (!workerMatchesRoleInShift(row, true, tmpl)) return;
          
          // If criteria include time range, only count hours within that range
          const timeRangeCriteria = (col.criteria || []).find(c => c.col_name === TIME_RANGE_COL);
          if (timeRangeCriteria && timeRangeCriteria.include?.length > 0) {
            const hoursInRange = calculateHoursInRange(startTime, endTime, timeRangeCriteria.include);
            total += hoursInRange;
          } else {
            total += calcHours(startTime, endTime);
          }
        });
      }

      return Math.round(total * 10) / 10;
    }

    if (col.type === "count_by_text") {
      if (!col.schedule_col_name) return 0;
      let count = 0;
      filtered.forEach(a => {
        if (!matchesColValueFilter(a.column_values, col.schedule_col_name, a)) return;
        if (!workerMatchesRoleInShift(a)) return;
        count++;
      });
      templateRows.forEach(row => {
        const st = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "";
        const effectiveDate = getOperationalStartDate(row.date, st || "06:00");
        if (dateRange && (effectiveDate < dateRange.start || effectiveDate > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && (row.values?.[tc.name] === workerId || (tc.column_id && row.values?.[tc.column_id] === workerId)))) return;
        const rowAsAssignment = { qualification_id: row.values?.task || "" };
        if (!matchesColValueFilter(row.values, col.schedule_col_name, rowAsAssignment)) return;
        if (!workerMatchesRoleInShift(row, true, tmpl)) return;
        count++;
      });
      return count;
    }

    if (col.type === "count_by_task") {
       const taskList = col.task_list || [];
       if (taskList.length === 0) return 0;
       const result = {};
       taskList.forEach(taskId => { result[taskId] = 0; });
       filtered.forEach(a => {
         if (a.qualification_id && taskList.includes(a.qualification_id)) {
           if (!workerMatchesRoleInShift(a)) return;
           result[a.qualification_id] += a.hours || 0;
         }
       });
       return result;
     }

    if (col.type === "count_quantitative") {
      if (!col.schedule_col_name) return {};
      const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
      const allOpts = (col.quantitative_options && col.quantitative_options.length > 0)
        ? col.quantitative_options
        : (sc?.quantitative_items || []);
      const opts = col.quantitative_single_item ? [col.quantitative_single_item] : allOpts;
      const counts = {};
      opts.forEach(o => { counts[o] = 0; });

      const parseQuantJson = (raw) => {
        if (!raw) return {};
        try { return JSON.parse(raw); } catch { return {}; }
      };

      // Separate quantitative items criteria from time range criteria
      const quantCriteria = (col.criteria || []).filter(c => c.col_name && c.col_name !== TIME_RANGE_COL && c.include?.length > 0);
      const timeRangeCriteria = (col.criteria || []).find(c => c.col_name === TIME_RANGE_COL);

      const checkQuantCriteria = (vals) => {
        if (quantCriteria.length === 0) return true;
        const criteriaLogicForQuant = col.criteria_logic || "or";
        const checkOne = (c) => {
          const rawVal = vals?.[c.col_name];
          // Handle both JSON string and plain object
          if (rawVal !== null && rawVal !== undefined && (typeof rawVal === "object" || (typeof rawVal === "string" && rawVal.startsWith("{")))) {
            const parsed = parseQuantJson(rawVal);
            if (c.logic === "and") return c.include.every(v => (parsed[v] || 0) > 0);
            return c.include.some(v => (parsed[v] || 0) > 0);
          }
          // Non-JSON value: check as plain string match
          if (typeof rawVal === "string" && rawVal.length > 0) {
            if (c.logic === "and") return c.include.every(v => v === rawVal);
            return c.include.some(v => v === rawVal);
          }
          return false;
        };
        if (criteriaLogicForQuant === "and") return quantCriteria.every(c => checkOne(c));
        return quantCriteria.some(c => checkOne(c));
      };

      const checkTimeRangeCriteria = (startTime, endTime) => {
         if (!timeRangeCriteria || !timeRangeCriteria.include?.length) return true;
         if (!startTime || !endTime) return false; // No time data = cannot match time range
         const hoursInRange = calculateHoursInRange(startTime, endTime, timeRangeCriteria.include);
         return hoursInRange > 0;
       };

      // Check all criteria - quantitative items use criteriaLogic, time range is AND
       filtered.forEach(a => {
         if (!checkQuantCriteria(a.column_values)) return;
         if (!checkTimeRangeCriteria(a.start_time, a.end_time)) return;
         if (!workerMatchesRoleInShift(a)) return;

         const raw = a.column_values?.[col.schedule_col_name]?.value || a.column_values?.[col.schedule_col_name];
         const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
         opts.forEach(o => { counts[o] += parsed[o] || 0; });
       });

      templateRows.forEach(row => {
         const tmpl = allTemplates.find(t => t.id === row.template_id);
         if (!tmpl) return;
         // Find time columns dynamically from template
         const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
         const startTimeCol = tmplTimeCols[0];
         const endTimeCol = tmplTimeCols[1];
         const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (startTimeCol ? row.values?.[startTimeCol.name] : "") || "";
         const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (endTimeCol ? row.values?.[endTimeCol.name] : "") || "";
         const effectiveDate = getOperationalStartDate(row.date, startTime || "06:00");
         if (dateRange && (effectiveDate < dateRange.start || effectiveDate > dateRange.end)) return;
         if (!(tmpl.columns || []).some(tc => tc.type === "worker" && (row.values?.[tc.name] === workerId || (tc.column_id && row.values?.[tc.column_id] === workerId)))) return;

         if (!checkQuantCriteria(row.values)) return;
         if (!checkTimeRangeCriteria(startTime, endTime)) return;
         if (!workerMatchesRoleInShift(row, true, tmpl)) return;

         const raw = row.values?.[col.schedule_col_name];
         const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
         opts.forEach(o => { counts[o] += parsed[o] || 0; });
         });

      return counts;
    }

    return null;
  };

  // Compute org-level hours for a "per_shift" column (deduped by shift, not per worker)
  const computeShiftTotal = (col) => {
    const dateRange = getDateRange(dateFilterMode, startDate, endDate);
    const TIME_RANGE_COL = "__טווח_שעות__";

    const parseQuantJson = (raw) => {
      if (!raw) return {};
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return {}; }
    };

    const calculateHoursInRange = (startTime, endTime, timeRanges) => {
      const timeToMinutes = (t) => {
        if (!t) return NaN;
        const nd = t.match(/^\+(\d+)\s+(\d{2}):(\d{2})$/);
        if (nd) return parseInt(nd[1]) * 1440 + parseInt(nd[2]) * 60 + parseInt(nd[3]);
        const p = t.split(":");
        const h = parseInt(p[0]); const m = parseInt(p[1] || "0");
        if (isNaN(h)) return NaN;
        return h * 60 + m;
      };
      let ss = timeToMinutes(startTime) % 1440;
      let se = timeToMinutes(endTime) % 1440;
      if (isNaN(ss) || isNaN(se)) return 0;
      const shiftX = ss > se;
      let total = 0;
      timeRanges.forEach(rs => {
        const m = rs.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (!m) return;
        const rs_ = timeToMinutes(m[1]); const re_ = timeToMinutes(m[2]);
        const rangeX = rs_ > re_;
        if (shiftX) {
          if (rangeX) {
            total += Math.max(0, 1440 - Math.max(ss, rs_)) + Math.max(0, Math.min(se, re_));
          } else {
            if (re_ > 0 && rs_ < se) total += Math.min(se, re_) - Math.max(0, rs_);
            if (re_ > ss) total += Math.min(1440, re_) - Math.max(ss, rs_);
          }
        } else {
          if (rangeX) {
            if (ss < 1440 && se > rs_) total += Math.min(1440, se) - Math.max(ss, rs_);
            if (ss < re_ && se > 0) total += Math.min(se, re_) - Math.max(ss, 0);
          } else {
            const os = Math.max(ss, rs_); const oe = Math.min(se, re_);
            if (oe > os) total += oe - os;
          }
        }
      });
      return total / 60;
    };

    const timeRangeC = (col.criteria || []).find(c => c.col_name === TIME_RANGE_COL);
    const checkTimeRange = (s, e) => {
      if (!timeRangeC || !timeRangeC.include?.length) return true;
      if (!s || !e) return false;
      return calculateHoursInRange(s, e, timeRangeC.include) > 0;
    };

    // Build a fake "match criteria" that works without workerId
    const TASK_COL = "__משימה__";
    const DAY_OF_WEEK_COL_SHIFT = "__ימי_שבוע__";
    const getCellVals = (vals, colName) => {
      const fv = vals?.[colName]; const st = vals?.[`${colName}_subTypes`] || [];
      return [fv, ...st].filter(Boolean).map(String);
    };
    const matchesCriteriaForShift = (vals, assignmentObj) => {
      const criteria = col.criteria;
      if (!criteria || criteria.length === 0) return true;
      const criteriaLogic = col.criteria_logic || "or";
      const checkOne = (c) => {
        if (!c.col_name) return true;
        if (!c.include?.length) return false;
        if (c.col_name === TIME_RANGE_COL) {
          const s = assignmentObj?.start_time || vals?.["התחלה"] || vals?.["שעת התחלה"];
          const e = assignmentObj?.end_time || vals?.["סיום"] || vals?.["שעת סיום"];
          if (!s || !e) return false;
          if (c.logic === "and") return c.include.every(r => calculateHoursInRange(s, e, [r]) > 0);
          return c.include.some(r => calculateHoursInRange(s, e, [r]) > 0);
        }
        if (c.col_name === "__תפקיד__") {
            // Worker role criterion — skip at shift level (handled per-column)
            return true;
          }
        if (c.col_name === DAY_OF_WEEK_COL_SHIFT) {
            const date = assignmentObj?.date || vals?.["תאריך"];
            if (!date) return false;
            const dayNum = String(new Date(date + "T12:00:00").getDay());
            return c.include.includes(dayNum);
          }
        if (c.col_name === TASK_COL) {
            const tq = assignmentObj?.qualification_id || "";
            const tv = String(vals?.["משימה"] || "");
            if (!tq && !tv) return false;
            const matches = (v) => v === tq || v === tv || (qualifications.find(q => q.id === v)?.name === tv) || (qualifications.find(q => q.name === tv)?.id === v);
            if (c.logic === "and") return c.include.every(matches);
            return c.include.some(matches);
          }
        const rv = vals?.[c.col_name];
        if (typeof rv === "string" && rv.startsWith("{")) {
          const p = parseQuantJson(rv);
          if (c.logic === "and") return c.include.every(v => (p[v] || 0) > 0);
          return c.include.some(v => (p[v] || 0) > 0);
        }
        const cv = getCellVals(vals, c.col_name);
        if (c.logic === "and") return c.include.every(v => cv.includes(v));
        return c.include.some(v => cv.includes(v));
      };
      if (criteriaLogic === "and") return criteria.every(c => checkOne(c));
      return criteria.some(c => checkOne(c));
    };

    // Collect all assignments in date range (not filtered by worker)
    const allFiltered = assignments.filter(a => {
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    });

    let total = 0;
    const seenShiftIds = new Set();

    allFiltered.forEach(a => {
      if (seenShiftIds.has(a.id)) return;
      if (!matchesCriteriaForShift(a.column_values, a)) return;
      seenShiftIds.add(a.id);
      if (timeRangeC && timeRangeC.include?.length) {
        total += calculateHoursInRange(a.start_time, a.end_time, timeRangeC.include);
      } else {
        total += a.hours || 0;
      }
    });

    templateRows.forEach(row => {
      if (seenShiftIds.has(row.id)) return;
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (tmplTimeCols[0] ? row.values?.[tmplTimeCols[0].name] : "") || "";
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (tmplTimeCols[1] ? row.values?.[tmplTimeCols[1].name] : "") || "";
      const effectiveDate = getOperationalStartDate(row.date, startTime || "06:00");
      if (dateRange && (effectiveDate < dateRange.start || effectiveDate > dateRange.end)) return;
      const rowAsAssignment = { qualification_id: row.values?.task || "" };
      if (!matchesCriteriaForShift(row.values, rowAsAssignment)) return;
      seenShiftIds.add(row.id);
      if (!checkTimeRange(startTime, endTime)) return;
      if (timeRangeC && timeRangeC.include?.length) {
        total += calculateHoursInRange(startTime, endTime, timeRangeC.include);
      } else {
        total += calcHours(startTime, endTime);
      }
    });

    return Math.round(total * 10) / 10;
  };

  const isAuto = (type) => ["shifts_count", "schedule_col", "count_by_text", "count_by_task", "count_quantitative"].includes(type);

  // Role name↔id maps at component level (used by both computeAutoValue and filteredWorkers)
  const roleIdByName = {};
  const roleNameById = {};
  (workerRoles || []).forEach(r => {
    const name = typeof r === "string" ? r : r.name;
    const mid = typeof r === "string" ? r : (r.mapping_id || r.name);
    if (name && mid) { roleIdByName[name.trim()] = mid; roleNameById[mid] = name.trim(); }
  });

  const popIdByName = {}; const popNameById = {};
  (populations || []).forEach(p => { if (typeof p === "string") return; if (p.name && p.mapping_id) { popIdByName[p.name.trim()] = p.mapping_id; popNameById[p.mapping_id] = p.name.trim(); } });
  const popMatches = (workerPop, selected) => {
    if (!selected || selected.length === 0) return true;
    const cands = new Set([workerPop]);
    if (popIdByName[workerPop]) cands.add(popIdByName[workerPop]);
    if (popNameById[workerPop]) cands.add(popNameById[workerPop]);
    return [...cands].some(c => selected.includes(c));
  };

  // Step 1: filter workers (no sort yet — sort needs cellValueMap)
  const filteredWorkersBase = workers.filter(w => {
    if (!w.active) return false;
    if (!popMatches(w.population, selectedPopulations)) return false;
    if (selectedRoles.length > 0) {
      const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      const roleMatches = selectedRoles.some(sr => {
        if (roles.includes(sr)) return true;
        const srName = roleNameById[sr];
        if (srName && roles.includes(srName)) return true;
        const srId = roleIdByName[sr];
        if (srId && roles.includes(srId)) return true;
        return false;
      });
      if (!roleMatches) return false;
    }
    if (selectedQualifications.length > 0) {
      const wqIds = workerQualifications.filter(wq => wq.worker_id === w.id).map(wq => wq.qualification_id);
      if (!selectedQualifications.some(qid => wqIds.includes(qid))) return false;
    }
    if (selectedWorkerIds.length > 0 && !selectedWorkerIds.includes(w.id)) return false;
    if (guide === "yes" && !w.is_guide) return false;
    if (guide === "no" && w.is_guide) return false;
    return true;
  });

  // Step 2: pre-compute cell values (depends on filtered workers list)
  const cellValueMap = useMemo(() => {
    const map = new Map();
    if (!tracker?.columns || !filteredWorkersBase) return map;
    tracker.columns.forEach(col => {
      filteredWorkersBase.forEach(worker => {
        map.set(`${col.id}_${worker.id}`, computeAutoValue(col, worker.id));
      });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker?.columns, filteredWorkersBase, assignments, templateRows, entries, dateFilterMode, startDate, endDate]);

  // Step 3: sort using cellValueMap (now safe to reference)
  const filteredWorkers = [...filteredWorkersBase].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortColId === null) {
      return mult * (a.nickname || "").localeCompare(b.nickname || "", "he");
    }
    const col = (tracker.columns || []).find(c => c.id === sortColId);
    if (!col) return 0;
    if (isAuto(col.type)) {
      const extractNum = (raw) => {
        if (typeof raw === "number") return raw;
        if (typeof raw === "object" && raw !== null) {
          if (col.quantitative_single_item) return raw[col.quantitative_single_item] || 0;
          return Object.values(raw).reduce((s, v) => s + (v || 0), 0);
        }
        return 0;
      };
      const va = extractNum(cellValueMap.get(`${col.id}_${a.id}`));
      const vb = extractNum(cellValueMap.get(`${col.id}_${b.id}`));
      return mult * (va - vb);
    }
    const va = getEntry(a.id, sortColId)?.value || "";
    const vb = getEntry(b.id, sortColId)?.value || "";
    return mult * va.localeCompare(vb, "he");
  });

  const displayColumns = editMode ? editColumns : (tracker.columns || []);

  const parseQuantitativeValue = (raw) => {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  };

  const saveQuantitativeItem = async (workerId, colId, optionName, delta) => {
    const existing = getEntry(workerId, colId);
    const current = parseQuantitativeValue(existing?.value);
    const newVal = Math.max(0, (current[optionName] || 0) + delta);
    const updated = { ...current, [optionName]: newVal };
    const strVal = JSON.stringify(updated);
    if (existing) {
      const res = await base44.entities.TrackerEntry.update(existing.id, { value: strVal });
      setEntries(entries.map(e => e.id === existing.id ? res : e));
    } else {
      const res = await base44.entities.TrackerEntry.create({ tracker_id: tracker.id, worker_id: workerId, column_id: colId, value: strVal });
      setEntries([...entries, res]);
    }
  };


  // Collect all numeric values for a column (for avg computation in dialog)
  const getColValues = (col) => {
    if (!isAuto(col.type)) return [];
    return filteredWorkers.map(w => {
      const v = cellValueMap.get(`${col.id}_${w.id}`);
      if (typeof v === "number") return v;
      if (typeof v === "object" && v !== null) {
        if (col.quantitative_single_item) return v[col.quantitative_single_item] || 0;
        return Object.values(v).reduce((s, x) => s + (x || 0), 0);
      }
      return 0;
    });
  };

  // Workers visible after population/role/qualification filter (for the worker picker)
  const preFilteredWorkers = workers.filter(w => {
    if (!w.active) return false;
    if (!popMatches(w.population, selectedPopulations)) return false;
    if (selectedRoles.length > 0) {
      const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      if (!selectedRoles.some(r => roles.includes(r))) return false;
    }
    if (selectedQualifications.length > 0) {
      const wqIds = workerQualifications.filter(wq => wq.worker_id === w.id).map(wq => wq.qualification_id);
      if (!selectedQualifications.some(qid => wqIds.includes(qid))) return false;
    }
    return true;
  });
  const searchedWorkers = preFilteredWorkers.filter(w =>
    !workerSearch || (w.nickname || "").includes(workerSearch)
  );

  // Compute total table width (worker col + all data cols)
  const totalTableWidth = (colWidths["__worker__"] || 120) + displayColumns.reduce((sum, col) => sum + (colWidths[col.id] || 140), 0) + (editMode ? 40 : 0);

  // Build gridTemplateColumns string — shared by header row and every body row
  const colTemplate = [
    `${colWidths["__worker__"] || 120}px`,
    ...displayColumns.map(col => `${colWidths[col.id] || 140}px`),
    ...(editMode ? ["40px"] : []),
  ].join(" ");

  // Render a single header row as a CSS-grid div (not a <table>)
  const renderGridHeaderRow = () => (
    <div
      dir="rtl"
      style={{
        display: "grid",
        gridTemplateColumns: colTemplate,
        flexShrink: 0,
        backgroundColor: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        zIndex: 40,
      }}
    >
      {/* Worker column header */}
      <div className="font-bold px-4 py-2 relative flex items-center">
        <button
          onClick={() => handleSortClick(null)}
          className="flex items-center gap-1 hover:text-blue-700 transition-colors text-sm"
          title="מיון לפי שם"
        >
          עובד
          {sortColId === null
            ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
            : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
        </button>
        <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
          onMouseDown={e => startColResize(e, "__worker__")}
          style={{ userSelect: "none" }} />
      </div>

      {/* Data column headers */}
      {displayColumns.map((col, idx) => (
        <div key={col.id} className="px-2 py-1 relative flex items-start justify-center">
          <div className="flex flex-col items-center gap-0.5 py-0.5 w-full">
            <div className="flex items-center gap-1">
              <button
                onClick={() => !editMode && handleSortClick(col.id)}
                className="font-medium flex items-center gap-1 hover:text-blue-700 transition-colors text-sm"
              >
                {col.name || <span className="text-gray-300 italic text-xs">ללא שם</span>}
                {!editMode && (sortColId === col.id
                  ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                  : <ArrowUpDown className="w-3 h-3 text-gray-300" />)}
              </button>
              {!editMode && isAuto(col.type) && (() => {
                const cfg = visualConfigs[col.id];
                const isActive = visualActive[col.id] !== false && !!cfg;
                const isOff = cfg && !isActive;
                const ModeIcon = cfg?.mode === "avg_scale" ? BarChart2 : cfg?.mode === "custom_scale" ? Target : cfg?.mode === "thresholds" ? Sliders : null;
                const tooltipText = !cfg
                  ? "לחץ להפעלת סקאלה לפי ממוצע | לחץ פעמיים לפתיחת הגדרות"
                  : isActive
                  ? `מצב: ${cfg.mode === "avg_scale" ? "סקאלה לפי ממוצע" : cfg.mode === "custom_scale" ? "סקאלה אישית" : "ספים"} — לחץ לכיבוי | לחץ פעמיים לשינוי`
                  : "כבוי — לחץ להפעלה מחדש | לחץ פעמיים לשינוי הגדרות";
                return (
                  <div className="relative flex items-center" title={tooltipText}>
                    <button
                      onClick={() => handleGaugeClick(col)}
                      className={`p-0.5 rounded hover:bg-blue-100 transition-colors relative ${
                        isActive ? "text-blue-600" : isOff ? "text-gray-400" : "text-gray-300 hover:text-blue-400"
                      }`}
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      {/* Small mode indicator dot */}
                      {cfg && (
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${isActive ? "bg-blue-500" : "bg-gray-400"}`} />
                      )}
                    </button>
                    {/* Mode icon badge */}
                    {ModeIcon && isActive && (
                      <ModeIcon className="w-2.5 h-2.5 text-blue-400 ml-0.5" />
                    )}
                  </div>
                );
              })()}
            </div>
            {col.description && (
              <span className="text-xs text-gray-400 font-normal text-center leading-tight">{col.description}</span>
            )}
            {editMode && (
              <div className="flex gap-0.5 items-center">
                <Button size="icon" variant="ghost" className="h-4 w-4 p-0" disabled={idx === 0}
                  onClick={() => {
                    const next = [...editColumns];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    setEditColumns(next);
                  }}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-4 w-4 p-0" disabled={idx === displayColumns.length - 1}
                  onClick={() => {
                    const next = [...editColumns];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    setEditColumns(next);
                  }}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-4 w-4 p-0 text-blue-500 hover:text-blue-700"
                  onClick={() => setConfiguringCol({ ...editColumns.find(c => c.id === col.id) })}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                  onClick={() => removeEditColumn(col.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
            onMouseDown={e => startColResize(e, col.id)}
            style={{ userSelect: "none" }} />
        </div>
      ))}

      {/* Add column button (edit mode) */}
      {editMode && (
        <div className="flex items-center justify-center w-full h-full">
          <button
            onClick={addNewEditColumn}
            className="flex items-center justify-center w-full h-full px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
            title="הוסף עמודה">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  // Render a single body data row as a CSS-grid div
  const renderGridBodyRow = (worker) => {
    return (
      <div
        key={worker.id}
        dir="rtl"
        className="hover:bg-gray-50"
        style={{
          display: "grid",
          gridTemplateColumns: colTemplate,
          borderBottom: "1px solid #f3f4f6",
          minHeight: 32,
        }}
      >
        <div className="font-medium whitespace-nowrap px-4 py-0.5 text-sm flex items-center">{worker.nickname}</div>
        {displayColumns.map(col => {
          const auto = isAuto(col.type);
          const entryValue = getEntry(worker.id, col.id)?.value || "";
          const value = auto ? cellValueMap.get(`${col.id}_${worker.id}`) : entryValue;
          const isEditing = editingCell?.workerId === worker.id && editingCell?.colId === col.id;

          if (col.type === "count_by_task") {
            const tasks = col.task_list || [];
            const hours = typeof value === "object" && value !== null ? value : {};
            if (tasks.length === 0) {
              return <div key={col.id} className="px-2 py-0.5 text-gray-300 text-xs flex items-center justify-center">אין משימות</div>;
            }
            const grandTotal = Object.values(hours).reduce((sum, h) => sum + (h || 0), 0);
            const bgColorTask = getVisualColor(grandTotal, getEffectiveVisualConfig(col.id));
            return (
              <div key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm flex items-center justify-center"
                style={bgColorTask ? { backgroundColor: bgColorTask } : {}}>
                <span className={grandTotal > 0 ? "text-blue-900" : "text-gray-300"}>
                  {grandTotal > 0 ? `${Math.round(grandTotal * 10) / 10}h` : "-"}
                </span>
              </div>
            );
          }
          if (col.type === "count_quantitative") {
            const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
            const allOpts = (col.quantitative_options && col.quantitative_options.length > 0)
              ? col.quantitative_options
              : (sc?.quantitative_items || []);
            const counts = typeof value === "object" && value !== null ? value : {};
            if (col.quantitative_single_item) {
              const num = counts[col.quantitative_single_item] || 0;
              const bgColorQ = getVisualColor(num, getEffectiveVisualConfig(col.id));
              return (
                <div key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm flex items-center justify-center"
                  style={bgColorQ ? { backgroundColor: bgColorQ } : {}}>
                  <span className={num > 0 ? "text-blue-900" : "text-gray-300"}>{num > 0 ? num : "-"}</span>
                </div>
              );
            }
            return (
              <div key={col.id} className="px-2 py-0.5 flex flex-col justify-center">
                <div className="space-y-0">
                  {allOpts.map(opt => (
                    <div key={opt} className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-gray-600 truncate">{opt}</span>
                      <span className={`font-semibold ${(counts[opt] || 0) > 0 ? "text-blue-900" : "text-gray-300"}`}>{counts[opt] || 0}</span>
                    </div>
                  ))}
                  {allOpts.length === 0 && <span className="text-gray-300 text-xs">אין פריטים</span>}
                </div>
              </div>
            );
          }
          if (auto) {
            if (col.count_mode === "per_shift") {
              return (
                <div key={col.id} className="text-center px-2 py-0.5 text-sm flex items-center justify-center">
                  <span className="text-gray-300">-</span>
                </div>
              );
            }
            const quantCriteriaCheck = (col.criteria || []).filter(c => c.col_name && c.col_name !== "__משימה__" && c.include?.length > 0);
            const isQuantSumCol = col.type === "schedule_col" && quantCriteriaCheck.length > 0;
            const showAsHours = col.type === "schedule_col" && !isQuantSumCol;
            const bgColor = typeof value === "number" ? getVisualColor(value, getEffectiveVisualConfig(col.id)) : null;
            return (
              <div key={col.id} className="text-center font-semibold text-blue-900 px-2 py-0.5 text-sm flex items-center justify-center"
                style={bgColor ? { backgroundColor: bgColor } : {}}>
                {value > 0 ? (showAsHours ? `${value}h` : value) : <span className="text-gray-300">-</span>}
              </div>
            );
          }
          return (
            <div key={col.id} className="px-2 py-0.5 flex items-center">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Input autoFocus value={cellDraft} onChange={e => setCellDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCell(); if (e.key === "Escape") setEditingCell(null); }}
                    className="h-7 text-sm w-24" dir="rtl" />
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={saveCell}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400" onClick={() => setEditingCell(null)}><X className="w-3 h-3" /></Button>
                </div>
              ) : (
                <div onClick={() => startCellEdit(worker.id, col.id)}
                  className="min-w-[60px] min-h-[24px] px-1 rounded cursor-pointer hover:bg-blue-50 text-sm w-full" dir="rtl">
                  {entryValue || <span className="text-gray-300 text-xs">לחץ לעריכה</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render summary row as a CSS-grid div
  const renderGridSummaryRow = () => {
    if (!displayColumns.some(c => c.type === "count_quantitative" || c.type === "count_by_task" || isAuto(c.type))) return null;
    return (
      <div
        dir="rtl"
        style={{
          display: "grid",
          gridTemplateColumns: colTemplate,
          backgroundColor: "#eff6ff",
          borderTop: "2px solid #bfdbfe",
          fontWeight: 600,
        }}
      >
        <div className="px-4 py-1 text-blue-900 font-bold text-sm flex items-center">סה"כ</div>
        {displayColumns.map(col => {
          if (col.type === "count_by_task") {
            const grandTotal = filteredWorkers.reduce((sum, w) => {
              const taskHours = cellValueMap.get(`${col.id}_${w.id}`);
              return sum + (typeof taskHours === "object" && taskHours !== null
                ? Object.values(taskHours).reduce((s, h) => s + (h || 0), 0)
                : 0);
            }, 0);
            return (
              <div key={col.id} className="text-center font-bold text-blue-900 px-2 py-1 flex items-center justify-center text-sm">
                {grandTotal > 0 ? `${Math.round(grandTotal * 10) / 10}h` : "-"}
              </div>
            );
          }
          if (col.type === "count_quantitative") {
            const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
            const allOpts = (col.quantitative_options && col.quantitative_options.length > 0)
              ? col.quantitative_options
              : (sc?.quantitative_items || []);
            if (col.quantitative_single_item) {
              const total = filteredWorkers.reduce((sum, w) => {
                const counts = cellValueMap.get(`${col.id}_${w.id}`);
                return sum + ((typeof counts === "object" && counts !== null) ? (counts[col.quantitative_single_item] || 0) : 0);
              }, 0);
              return (
                <div key={col.id} className="text-center font-bold text-blue-900 px-2 py-1 flex items-center justify-center text-sm">
                  {total > 0 ? total : <span className="text-gray-300">-</span>}
                </div>
              );
            }
            const totals = {};
            allOpts.forEach(opt => {
              totals[opt] = filteredWorkers.reduce((sum, w) => {
                const counts = cellValueMap.get(`${col.id}_${w.id}`);
                return sum + ((typeof counts === "object" && counts !== null) ? (counts[opt] || 0) : 0);
              }, 0);
            });
            return (
              <div key={col.id} className="px-2 py-1 flex flex-col justify-center">
                <div className="space-y-0.5">
                  {allOpts.map(opt => (
                    <div key={opt} className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-blue-800 truncate font-medium">{opt}</span>
                      <span className="font-bold text-blue-900">{totals[opt]}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (isAuto(col.type)) {
            if (col.count_mode === "per_shift") {
              const total = computeShiftTotal(col);
              return (
                <div key={col.id} className="text-center font-bold text-blue-900 px-2 py-1 flex items-center justify-center text-sm">
                  {total > 0 ? `${total}h` : <span className="text-gray-300">-</span>}
                </div>
              );
            }
            const total = filteredWorkers.reduce((sum, w) => {
              const v = cellValueMap.get(`${col.id}_${w.id}`);
              return sum + (typeof v === "number" ? v : 0);
            }, 0);
            const quantCriteriaCheckTotal = (col.criteria || []).filter(c => c.col_name && c.col_name !== "__משימה__" && c.include?.length > 0);
            const isQuantSumTotal = col.type === "schedule_col" && quantCriteriaCheckTotal.length > 0;
            const showAsHours = col.type === "schedule_col" && !isQuantSumTotal;
            return (
              <div key={col.id} className="text-center font-bold text-blue-900 px-2 py-1 flex items-center justify-center text-sm">
                {total > 0 ? (showAsHours ? `${total}h` : total) : <span className="text-gray-300">-</span>}
              </div>
            );
          }
          return <div key={col.id} />;
        })}
      </div>
    );
  };

  return (
    // ReportCard: flex column, clips overflow
    <div className="border rounded-xl shadow-lg mb-6 bg-white" dir="rtl" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── RedHeader: outside HorizontalScrollContainer, never scrolls horizontally ── */}
      <div style={{ flexShrink: 0, zIndex: 50, backgroundColor: "white" }}>
        <div
          className="border-b py-3 px-4 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{tracker.name}</CardTitle>
            <div className="flex gap-2" onMouseDown={e => e.stopPropagation()}>
              <Button size="sm"
                variant={pinUserModified && !headerPinned ? "default" : "outline"}
                className={`w-8 px-0 ${pinUserModified && !headerPinned ? "bg-blue-700 hover:bg-blue-800" : ""}`}
                onClick={togglePin}
                title={headerPinned ? "בטל נעיצת כותרת" : "נעץ כותרת"}>
                {pinUserModified && !headerPinned ? <X className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant={showFilters ? "default" : "outline"}
                className={`w-8 px-0 ${showFilters ? "bg-gray-700 hover:bg-gray-800" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
                title="סינון">
                <Filter className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={editMode ? "default" : "outline"}
                className={`w-8 px-0 ${editMode ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                onClick={() => editMode ? saveAndExitEditMode() : openEditMode()}
                title={editMode ? "סיים עריכה" : "ערוך עמודות"}>
                <Pencil className="w-4 h-4" />
              </Button>
              {editMode && (
                <ConfirmDeleteButton onConfirm={onDelete} variant="icon" />
              )}
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="pt-3 mt-3 border-t space-y-3">
              <div>
                <Label className="text-xs block mb-1 font-semibold text-gray-500">תקופה</Label>
                <div className="flex flex-wrap gap-1">
                  {DATE_MODES.map(m => (
                    <Button key={m.value} variant={dateFilterMode === m.value ? "default" : "outline"} size="sm"
                      className={`h-7 px-2 text-xs ${dateFilterMode === m.value ? "bg-blue-900 text-white" : ""}`}
                      onClick={() => setDateFilterMode(m.value)}>{m.label}</Button>
                  ))}
                </div>
              </div>
              {dateFilterMode === "custom" && (
                <div className="flex gap-2">
                  <div><Label className="text-xs block mb-1">מ-</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-36" /></div>
                  <div><Label className="text-xs block mb-1">עד</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-36" /></div>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
                <WorkerPillFilter
                  label="אוכלוסייה"
                  options={(populations || []).map(p =>
                    typeof p === "string"
                      ? { value: p, label: p }
                      : { value: p.mapping_id || p.name, label: p.name }
                  ).filter(o => o.label)}
                  selected={selectedPopulations}
                  onChange={setSelectedPopulations}
                  color="orange"
                />
                <WorkerPillFilter
                  label="תפקיד"
                  options={(workerRoles || []).map(r =>
                    typeof r === "string" ? { value: r, label: r } : { value: r.mapping_id || r.name, label: r.name }
                  ).filter(o => o.label)}
                  selected={selectedRoles}
                  onChange={setSelectedRoles}
                  color="indigo"
                />
                <WorkerPillFilter label="כשירות" options={qualifications.map(q => ({ value: q.id, label: q.name }))} selected={selectedQualifications} onChange={setSelectedQualifications} color="teal" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">עובדים ({selectedWorkerIds.length > 0 ? `${selectedWorkerIds.length} נבחרו` : "כולם"})</p>
                  <Input value={workerSearch} onChange={e => setWorkerSearch(e.target.value)} placeholder="חיפוש עובד..." className="h-7 text-xs mb-1" dir="rtl" />
                  <div className="flex gap-2 mb-1">
                    <button type="button" className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      onClick={() => setSelectedWorkerIds(searchedWorkers.map(w => w.id))}>
                      בחר הכל ({searchedWorkers.length})
                    </button>
                    <button type="button" className="text-xs px-2 py-0.5 rounded bg-gray-400 text-white hover:bg-gray-500 transition-colors"
                      onClick={() => setSelectedWorkerIds([])}>
                      נקה
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto border rounded bg-white space-y-0.5 p-1">
                    {searchedWorkers.map(w => (
                      <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-0.5 rounded">
                        <input type="checkbox" checked={selectedWorkerIds.length === 0 || selectedWorkerIds.includes(w.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedWorkerIds(prev => prev.length === 0 ? [] : [...prev, w.id]);
                            else setSelectedWorkerIds(prev => {
                              const all = prev.length === 0 ? preFilteredWorkers.map(pw => pw.id) : prev;
                              return all.filter(id => id !== w.id);
                            });
                          }} className="rounded" />
                        <span className="text-xs">{w.nickname}</span>
                      </label>
                    ))}
                    {searchedWorkers.length === 0 && <p className="text-xs text-gray-400 text-center py-1">אין תוצאות</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual Analysis Dialog */}
      {visualDialogCol && (
        <VisualAnalysisDialog
          col={visualDialogCol}
          values={getColValues(visualDialogCol)}
          open={!!visualDialogCol}
          onOpenChange={(o) => { if (!o) setVisualDialogCol(null); }}
          config={visualConfigs[visualDialogCol.id] || null}
          onConfigChange={(cfg) => {
            const colId = visualDialogCol.id;
            if (cfg) {
              setVisualConfigs(prev => ({ ...prev, [colId]: cfg }));
              setVisualActive(prev => ({ ...prev, [colId]: true }));
            } else {
              // "הסר עיצוב" — clear everything
              setVisualConfigs(prev => { const n = { ...prev }; delete n[colId]; return n; });
              setVisualActive(prev => { const n = { ...prev }; delete n[colId]; return n; });
            }
          }}
        />
      )}

      {/* Column config popup */}
      {configuringCol && (
        <ColumnConfigDialog
          col={configuringCol}
          scheduleColumns={scheduleColumns}
          qualifications={qualifications}
          workerRoles={workerRoles}
          onSave={saveColConfig}
          onClose={() => setConfiguringCol(null)}
        />
      )}

      {/* ── HorizontalScrollContainer: THE ONLY element with overflow-x:auto ── */}
      <div style={{ overflowX: "auto", overflowY: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* ── WideTableGrid: width = totalColumnWidth, contains BlueHeaderRow + BodyVerticalScrollArea ── */}
        <div style={{ width: totalTableWidth, minWidth: totalTableWidth, display: "flex", flexDirection: "column" }}>

          {/* ── BlueHeaderRow: always visible, outside BodyVerticalScrollArea ── */}
          {headerPinned && renderGridHeaderRow()}

          {/* ── BodyVerticalScrollArea: THE ONLY element with overflow-y:auto ── */}
          <div style={{ overflowY: "auto", overflowX: "visible", maxHeight: "60vh", minHeight: 0 }}>
            {/* Header row when not pinned */}
            {!headerPinned && renderGridHeaderRow()}

            {/* Body rows */}
            {filteredWorkers.map(worker => renderGridBodyRow(worker))}
          </div>

          {/* ── Summary row: always docked at bottom, outside scroll area ── */}
          {renderGridSummaryRow()}

        </div>{/* end WideTableGrid */}
      </div>{/* end HorizontalScrollContainer */}
    </div>
  );
}
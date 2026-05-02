import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Gauge, Pin, PinOff, Filter } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { base44 } from "@/api/base44Client";
import ColumnConfigDialog from "./ColumnConfigDialog";
import VisualAnalysisDialog, { getVisualColor } from "./VisualAnalysisDialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";

// Pill-style worker filter — same pattern as Yearly participant filter
// options: array of strings OR array of {value, label} objects
function WorkerPillFilter({ label, options, selected, onChange, color }) {
  const colorMap = {
    orange: { active: "bg-orange-500 text-white border-orange-500", inactive: "bg-white text-gray-600 border-gray-300 hover:border-orange-400" },
    indigo: { active: "bg-indigo-600 text-white border-indigo-600", inactive: "bg-white text-gray-600 border-gray-300 hover:border-indigo-400" },
    teal: { active: "bg-teal-600 text-white border-teal-600", inactive: "bg-white text-gray-600 border-gray-300 hover:border-teal-400" },
  };
  const cls = colorMap[color] || colorMap.indigo;
  if (!options || options.length === 0) return null;
  // Normalize options to {value, label}
  const normalized = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {normalized.map(opt => (
          <button key={opt.value} type="button"
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selected.includes(opt.value) ? cls.active : cls.inactive}`}
            onClick={() => onChange(selected.includes(opt.value) ? selected.filter(v => v !== opt.value) : [...selected, opt.value])}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const COLUMN_TYPES = [
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "schedule_col", label: "סיכום שעות לפי טקסט" },
  { value: "count_by_text", label: "סיכום פעמים לפי טקסט" },
  { value: "count_by_task", label: "ספירה לפי משימה" },
  { value: "count_quantitative", label: "ספירה כמותית" },
];

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const endMatch = end.match(/^\+(\d+)\s+(\d{2}):(\d{2})$/);
  const [sh, sm] = start.split(":").map(Number);
  if (endMatch) {
    const days = parseInt(endMatch[1]);
    const eh = parseInt(endMatch[2]);
    const em = parseInt(endMatch[3]);
    return Math.round((days * 24 + eh + em / 60 - sh - sm / 60) * 10) / 10;
  }
  const [eh, em] = end.split(":").map(Number);
  let diff = eh + em / 60 - sh - sm / 60;
  if (diff < 0) diff += 24;
  return Math.round(diff * 10) / 10;
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
  const cardHeaderRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [editColumns, setEditColumns] = useState([]);
  const [configuringCol, setConfiguringCol] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Visual Analysis
  const [visualConfigs, setVisualConfigs] = useState({}); // colId -> config
  const [visualDialogCol, setVisualDialogCol] = useState(null); // col object

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
  const loadEntries = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await base44.entities.TrackerEntry.filter({ tracker_id: tracker.id });
      setEntries(data);
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

  const computeAutoValue = (col, workerId) => {
    const dateRange = getDateRange(dateFilterMode, startDate, endDate);

    // Get the actual cell values for a schedule column (supports old string + new JSON)
    const getCellVals = (vals, colName) => {
      const fieldVal = vals?.[colName];
      const subTypes = vals?.[`${colName}_subTypes`] || [];
      return [fieldVal, ...subTypes].filter(Boolean).map(String);
    };

    // Check criteria array (new format) or fall back to old col_value_filter
    const TASK_COL = "__משימה__";
    const TIME_RANGE_COL = "__טווח_שעות__";
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
      return filtered.filter(a => matchesCriteria(a.column_values, a)).length;
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
          const raw = a.column_values?.[colName];
          if (!raw) return;
          const parsed = parseQuantJson(raw);
          includeItems.forEach(item => { total += parsed[item] || 0; });
        });
        templateRows.forEach(row => {
          if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
          const tmpl = allTemplates.find(t => t.id === row.template_id);
          if (!tmpl) return;
          if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === workerId)) return;
          const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
          const rowStartTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (tmplTimeCols[0] ? row.values?.[tmplTimeCols[0].name] : "") || "";
          const rowEndTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (tmplTimeCols[1] ? row.values?.[tmplTimeCols[1].name] : "") || "";
          if (!checkTimeRange(rowStartTime, rowEndTime)) return;
          const raw = row.values?.[colName];
          if (!raw) return;
          const parsed = parseQuantJson(raw);
          includeItems.forEach(item => { total += parsed[item] || 0; });
        });
      } else {
        filtered.forEach(a => {
          if (!matchesCriteria(a.column_values, a)) return;
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
          if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
          const tmpl = allTemplates.find(t => t.id === row.template_id);
          if (!tmpl) return;
          // Check if this row has the worker anywhere (not just one column)
          const hasWorker = (tmpl.columns || []).some(tc => 
            tc.type === "worker" && row.values?.[tc.name] === workerId
          );
          if (!hasWorker) return;
          
          // Check if criteria match this row (as if it's an assignment)
          const rowAsAssignment = { qualification_id: row.values?.task || "" };
          if (!matchesCriteria(row.values, rowAsAssignment)) return;
          
          const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "";
          const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || "";
          
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
        count++;
      });
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] && row.values?.[tc.name] === workerId)) return;
        const rowAsAssignment = { qualification_id: row.values?.task || "" };
        if (matchesColValueFilter(row.values, col.schedule_col_name, rowAsAssignment)) count++;
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

         const raw = a.column_values?.[col.schedule_col_name]?.value || a.column_values?.[col.schedule_col_name];
         const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
         opts.forEach(o => { counts[o] += parsed[o] || 0; });
       });

      templateRows.forEach(row => {
         if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
         const tmpl = allTemplates.find(t => t.id === row.template_id);
         if (!tmpl) return;
         if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] && row.values?.[tc.name] === workerId)) return;

         if (!checkQuantCriteria(row.values)) return;

         // Find time columns dynamically from template
         const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
         const startTimeCol = tmplTimeCols[0];
         const endTimeCol = tmplTimeCols[1];
         const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (startTimeCol ? row.values?.[startTimeCol.name] : "") || "";
         const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (endTimeCol ? row.values?.[endTimeCol.name] : "") || "";
         if (!checkTimeRangeCriteria(startTime, endTime)) return;

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
      if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
      if (seenShiftIds.has(row.id)) return;
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      const rowAsAssignment = { qualification_id: row.values?.task || "" };
      if (!matchesCriteriaForShift(row.values, rowAsAssignment)) return;
      seenShiftIds.add(row.id);
      const tmplTimeCols = (tmpl.columns || []).filter(tc => tc.type === "time");
      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"] || (tmplTimeCols[0] ? row.values?.[tmplTimeCols[0].name] : "") || "";
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"] || (tmplTimeCols[1] ? row.values?.[tmplTimeCols[1].name] : "") || "";
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

  const displayColumns = editMode ? editColumns : (tracker.columns || []);

  const filteredWorkers = workers.filter(w => {
    if (!w.active) return false;
    if (selectedPopulations.length > 0 && !selectedPopulations.includes(w.population)) return false;
    if (selectedRoles.length > 0) {
      const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      if (!selectedRoles.some(r => roles.includes(r))) return false;
    }
    if (selectedQualifications.length > 0) {
      const wqIds = workerQualifications.filter(wq => wq.worker_id === w.id).map(wq => wq.qualification_id);
      if (!selectedQualifications.some(qid => wqIds.includes(qid))) return false;
    }
    if (selectedWorkerIds.length > 0 && !selectedWorkerIds.includes(w.id)) return false;
    if (guide === "yes" && !w.is_guide) return false;
    if (guide === "no" && w.is_guide) return false;
    return true;
  }).sort((a, b) => {
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
      const va = extractNum(computeAutoValue(col, a.id));
      const vb = extractNum(computeAutoValue(col, b.id));
      return mult * (va - vb);
    }
    const va = getEntry(a.id, sortColId)?.value || "";
    const vb = getEntry(b.id, sortColId)?.value || "";
    return mult * va.localeCompare(vb, "he");
  });

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
      const v = computeAutoValue(col, w.id);
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
    if (selectedPopulations.length > 0 && !selectedPopulations.includes(w.population)) return false;
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

  const [cardHeaderH, setCardHeaderH] = useState(0);
  useEffect(() => {
    if (!cardHeaderRef.current) return;
    const obs = new ResizeObserver(() => {
      setCardHeaderH(cardHeaderRef.current?.offsetHeight || 0);
    });
    obs.observe(cardHeaderRef.current);
    return () => obs.disconnect();
  }, [showFilters]);

  return (
    <Card className="border-none shadow-lg mb-6" dir="rtl" style={headerPinned ? { maxHeight: "70vh", overflow: "auto" } : {}}>
      {/* Header */}
      <CardHeader
        ref={cardHeaderRef}
        className="border-b py-3 px-4 cursor-grab active:cursor-grabbing select-none bg-white"
        style={headerPinned ? { position: "sticky", top: 0, zIndex: 30, boxShadow: "0 2px 4px rgba(0,0,0,0.08)" } : {}}
        onMouseDown={onDragStart}
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{tracker.name}</CardTitle>
          <div className="flex gap-2" onMouseDown={e => e.stopPropagation()}>
            {/* Pin button: neutral when pinned (default), blue+X only when user explicitly unpinned */}
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
            {/* Time filter */}
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

            {/* Worker filter — pill style like Yearly */}
            <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
              <WorkerPillFilter label="אוכלוסייה" options={populations} selected={selectedPopulations} onChange={setSelectedPopulations} color="orange" />
              <WorkerPillFilter label="תפקיד" options={workerRoles} selected={selectedRoles} onChange={setSelectedRoles} color="indigo" />
              <WorkerPillFilter label="כשירות" options={qualifications.map(q => ({ value: q.id, label: q.name }))} selected={selectedQualifications} onChange={setSelectedQualifications} color="teal" />

              {/* Worker search + list */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">עובדים ({selectedWorkerIds.length > 0 ? `${selectedWorkerIds.length} נבחרו` : "כולם"})</p>
                <Input
                  value={workerSearch}
                  onChange={e => setWorkerSearch(e.target.value)}
                  placeholder="חיפוש עובד..."
                  className="h-7 text-xs mb-1"
                  dir="rtl"
                />
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
      </CardHeader>

      {/* Visual Analysis Dialog */}
      {visualDialogCol && (
        <VisualAnalysisDialog
          col={visualDialogCol}
          values={getColValues(visualDialogCol)}
          open={!!visualDialogCol}
          onOpenChange={(o) => { if (!o) setVisualDialogCol(null); }}
          config={visualConfigs[visualDialogCol.id] || null}
          onConfigChange={(cfg) => {
            setVisualConfigs(prev => ({ ...prev, [visualDialogCol.id]: cfg }));
          }}
        />
      )}

      {/* Column config popup */}
      {configuringCol && (
        <ColumnConfigDialog
          col={configuringCol}
          scheduleColumns={scheduleColumns}
          qualifications={qualifications}
          onSave={saveColConfig}
          onClose={() => setConfiguringCol(null)}
        />
      )}

      {/* Table */}
      <CardContent className="pt-0 px-0 relative" style={headerPinned ? { height: "calc(100% - 48px)", display: "flex", flexDirection: "column" } : {}}>
        {/* Resize handle (fixed to bottom-left of card) */}
        {!headerPinned && (
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-col-resize hover:bg-blue-400 transition-colors rounded-tr-sm z-50"
            onMouseDown={e => startColResize(e, "__worker__")}
            style={{ userSelect: "none", background: "rgba(59, 130, 246, 0.3)" }}
            title="גרור לשינוי גודל"
          />
        )}
        <div style={headerPinned ? { overflowX: "auto", overflowY: "auto", flex: 1 } : { overflowX: "auto" }}>
        <Table style={{ tableLayout: "fixed" }}>
          <TableHeader style={headerPinned ? { position: "sticky", top: cardHeaderH, zIndex: 25, backgroundColor: "#f9fafb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } : {}}>
            <TableRow className="bg-gray-50">
              <TableHead dir="rtl" className="font-bold px-4 relative"
                style={{ width: colWidths["__worker__"] || 120, minWidth: 80 }}>
                <button
                  onClick={() => handleSortClick(null)}
                  className="flex items-center gap-1 hover:text-blue-700 transition-colors"
                  title="מיון לפי שם"
                >
                  עובד
                  {sortColId === null
                    ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                    : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                </button>
                {/* Resize handle (sticky to column header) */}
                {headerPinned && (
                  <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors group"
                    onMouseDown={e => startColResize(e, "__worker__")}
                    style={{ userSelect: "none" }} />
                )}
              </TableHead>
              {displayColumns.map((col, idx) => (
                <TableHead key={col.id} dir="rtl" className="px-2 relative"
                  style={{ width: colWidths[col.id] || 140, minWidth: 60 }}>
                  <div className="flex flex-col items-center gap-0.5 py-0.5">
                    <div className="flex items-center gap-1">
                     <button
                       onClick={() => !editMode && handleSortClick(col.id)}
                       className="font-medium flex items-center gap-1 hover:text-blue-700 transition-colors"
                     >
                       {col.name || <span className="text-gray-300 italic text-xs">ללא שם</span>}
                       {!editMode && (sortColId === col.id
                         ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                         : <ArrowUpDown className="w-3 h-3 text-gray-300" />)}
                     </button>
                     {!editMode && isAuto(col.type) && (
                       <button
                         onClick={() => setVisualDialogCol(col)}
                         title="ניתוח ויזואלי"
                         className={`p-0.5 rounded hover:bg-blue-100 transition-colors ${visualConfigs[col.id] ? "text-blue-600" : "text-gray-300 hover:text-blue-400"}`}
                       >
                         <Gauge className="w-3.5 h-3.5" />
                       </button>
                     )}
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
                  {/* Resize handle */}
                  <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                    onMouseDown={e => startColResize(e, col.id)}
                    style={{ userSelect: "none" }} />
                </TableHead>
              ))}
              {editMode && (
                <TableHead className="w-[40px] p-0 text-center">
                  <button
                    onClick={addNewEditColumn}
                    className="flex items-center justify-center w-full h-full px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
                    title="הוסף עמודה">
                    <Plus className="w-4 h-4" />
                  </button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkers.map(worker => (
              <TableRow key={worker.id} className="hover:bg-gray-50 h-6">
                <TableCell className="font-medium whitespace-nowrap px-4 py-0.5 text-sm">{worker.nickname}</TableCell>
                {displayColumns.map(col => {
                   const auto = isAuto(col.type);
                   const entryValue = getEntry(worker.id, col.id)?.value || "";
                   const value = auto ? computeAutoValue(col, worker.id) : entryValue;
                  const isEditing = editingCell?.workerId === worker.id && editingCell?.colId === col.id;

                  if (col.type === "count_by_task") {
                    const tasks = col.task_list || [];
                    const hours = typeof value === "object" && value !== null ? value : {};
                    if (tasks.length === 0) {
                      return <TableCell key={col.id} className="px-2 py-0.5 text-gray-300 text-xs">אין משימות</TableCell>;
                    }
                    const grandTotal = Object.values(hours).reduce((sum, h) => sum + (h || 0), 0);
                    const bgColorTask = visualConfigs[col.id] ? getVisualColor(grandTotal, visualConfigs[col.id]) : null;
                    return (
                      <TableCell key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm"
                        style={bgColorTask ? { backgroundColor: bgColorTask } : {}}>
                        <span className={grandTotal > 0 ? "text-blue-900" : "text-gray-300"}>
                          {grandTotal > 0 ? `${Math.round(grandTotal * 10) / 10}h` : "-"}
                        </span>
                      </TableCell>
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
                      const bgColorQ = visualConfigs[col.id] ? getVisualColor(num, visualConfigs[col.id]) : null;
                      return (
                        <TableCell key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm"
                          style={bgColorQ ? { backgroundColor: bgColorQ } : {}}>
                          <span className={num > 0 ? "text-blue-900" : "text-gray-300"}>{num > 0 ? num : "-"}</span>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={col.id} className="px-2 py-0.5 min-w-[120px]">
                        <div className="space-y-0">
                          {allOpts.map(opt => (
                            <div key={opt} className="flex items-center justify-between gap-1 text-xs">
                              <span className="text-gray-600 truncate">{opt}</span>
                              <span className={`font-semibold ${(counts[opt] || 0) > 0 ? "text-blue-900" : "text-gray-300"}`}>{counts[opt] || 0}</span>
                            </div>
                          ))}
                          {allOpts.length === 0 && <span className="text-gray-300 text-xs">אין פריטים</span>}
                        </div>
                      </TableCell>
                    );
                  }
                  if (auto) {
                    // per_shift columns show "-" per worker row (org-level only)
                    if (col.count_mode === "per_shift") {
                      return (
                        <TableCell key={col.id} className="text-center px-2 py-0.5 text-sm">
                          <span className="text-gray-300">-</span>
                        </TableCell>
                      );
                    }
                    const quantCriteriaCheck = (col.criteria || []).filter(c => c.col_name && c.col_name !== "__משימה__" && c.include?.length > 0);
                    const isQuantSumCol = col.type === "schedule_col" && quantCriteriaCheck.length > 0;
                    const showAsHours = col.type === "schedule_col" && !isQuantSumCol;
                    const vCfg = visualConfigs[col.id];
                    const bgColor = vCfg && typeof value === "number" ? getVisualColor(value, vCfg) : null;
                    return (
                      <TableCell key={col.id} className="text-center font-semibold text-blue-900 px-2 py-0.5 text-sm"
                        style={bgColor ? { backgroundColor: bgColor } : {}}>
                        {value > 0 ? (showAsHours ? `${value}h` : value) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    );
                  }
                  return (
                   <TableCell key={col.id} className="px-2 py-0.5">
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
                         className="min-w-[60px] min-h-[24px] px-1 rounded cursor-pointer hover:bg-blue-50 text-sm" dir="rtl">
                         {entryValue || <span className="text-gray-300 text-xs">לחץ לעריכה</span>}
                       </div>
                     )}
                   </TableCell>
                  );
                  })}
                  </TableRow>
                  ))}
                  {/* Summary row */}
                  {displayColumns.some(c => c.type === "count_quantitative" || c.type === "count_by_task" || isAuto(c.type)) && (
               <TableRow className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                 <TableCell className="px-4 text-blue-900 font-bold">סה"כ</TableCell>
                 {displayColumns.map(col => {
                   if (col.type === "count_by_task") {
                      const grandTotal = filteredWorkers.reduce((sum, w) => {
                        const taskHours = computeAutoValue(col, w.id);
                        return sum + (typeof taskHours === "object" && taskHours !== null
                          ? Object.values(taskHours).reduce((s, h) => s + (h || 0), 0)
                          : 0);
                      }, 0);
                      return (
                        <TableCell key={col.id} className="text-center font-bold text-blue-900 px-2">
                          {grandTotal > 0 ? `${Math.round(grandTotal * 10) / 10}h` : "-"}
                        </TableCell>
                      );
                    }
                   if (col.type === "count_quantitative") {
                    const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                    const allOpts = (col.quantitative_options && col.quantitative_options.length > 0)
                      ? col.quantitative_options
                      : (sc?.quantitative_items || []);
                    if (col.quantitative_single_item) {
                      const total = filteredWorkers.reduce((sum, w) => {
                        const counts = computeAutoValue(col, w.id);
                        return sum + ((typeof counts === "object" && counts !== null) ? (counts[col.quantitative_single_item] || 0) : 0);
                      }, 0);
                      return (
                        <TableCell key={col.id} className="text-center font-bold text-blue-900 px-2">
                          {total > 0 ? total : <span className="text-gray-300">-</span>}
                        </TableCell>
                      );
                    }
                    const totals = {};
                    allOpts.forEach(opt => {
                      totals[opt] = filteredWorkers.reduce((sum, w) => {
                        const counts = computeAutoValue(col, w.id);
                        return sum + ((typeof counts === "object" && counts !== null) ? (counts[opt] || 0) : 0);
                      }, 0);
                    });
                    return (
                      <TableCell key={col.id} className="px-2 min-w-[120px]">
                        <div className="space-y-0.5">
                          {allOpts.map(opt => (
                            <div key={opt} className="flex items-center justify-between gap-1 text-xs">
                              <span className="text-blue-800 truncate font-medium">{opt}</span>
                              <span className="font-bold text-blue-900">{totals[opt]}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    );
                  }
                  if (isAuto(col.type)) {
                    // per_shift: use org-level computation instead of sum of workers
                    if (col.count_mode === "per_shift") {
                      const total = computeShiftTotal(col);
                      return (
                        <TableCell key={col.id} className="text-center font-bold text-blue-900 px-2">
                          {total > 0 ? `${total}h` : <span className="text-gray-300">-</span>}
                        </TableCell>
                      );
                    }
                    const total = filteredWorkers.reduce((sum, w) => {
                      const v = computeAutoValue(col, w.id);
                      return sum + (typeof v === "number" ? v : 0);
                    }, 0);
                    const quantCriteriaCheckTotal = (col.criteria || []).filter(c => c.col_name && c.col_name !== "__משימה__" && c.include?.length > 0);
                    const isQuantSumTotal = col.type === "schedule_col" && quantCriteriaCheckTotal.length > 0;
                    const showAsHours = col.type === "schedule_col" && !isQuantSumTotal;
                    return (
                      <TableCell key={col.id} className="text-center font-bold text-blue-900 px-2">
                        {total > 0 ? (showAsHours ? `${total}h` : total) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    );
                  }
                  return <TableCell key={col.id} />;
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
        </CardContent>
        </Card>
        );
        }
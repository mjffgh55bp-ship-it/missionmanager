import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, ChevronDown, ChevronUp, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { base44 } from "@/api/base44Client";
import ColumnConfigDialog from "./ColumnConfigDialog";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const toggle = (val) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="h-8 min-w-[140px] max-w-[200px] border border-input rounded-md px-2 text-sm text-right flex items-center justify-between gap-2 bg-white hover:bg-gray-50"
        dir="rtl"
      >
        <span className="truncate text-right">
          {selected.length === 0 ? placeholder : selected.join(", ")}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[1000] bg-white border border-gray-200 rounded-md shadow-lg min-w-[160px] py-1"
            style={{ top: dropPos.top, right: dropPos.right }}
            dir="rtl"
          >
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`w-full text-right px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                  selected.includes(opt) ? "font-semibold text-blue-700" : ""
                }`}
              >
                <span className={`w-4 h-4 border-2 rounded flex-shrink-0 flex items-center justify-center ${
                  selected.includes(opt) ? "bg-blue-600 border-blue-600" : "border-gray-300"
                }`}>
                  {selected.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {opt}
              </button>
            ))}
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="w-full text-right px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t mt-1">
                נקה בחירה
              </button>
            )}
          </div>
        </>
      )}
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
  { value: "half_year", label: "חצי שנה" },
  { value: "half_year_start", label: "מתחילת חציון" },
  { value: "year_start", label: "מתחילת שנה" },
  { value: "custom", label: "מותאם" },
];

export default function TrackerTable({ tracker: initialTracker, workers, assignments, templateRows, allTemplates, populations, workerRoles, scheduleColumns = [], qualifications = [], onDelete, onUpdated }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [entries, setEntries] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [cellDraft, setCellDraft] = useState("");

  // Filters
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPopulations, setSelectedPopulations] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [guide, setGuide] = useState("__all__");
  const [showFilters, setShowFilters] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editColumns, setEditColumns] = useState([]);
  const [configuringCol, setConfiguringCol] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => { loadEntries(); }, [tracker.id]);
  useEffect(() => { setTracker(initialTracker); }, [initialTracker]);

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

  const loadEntries = async () => {
    const data = await base44.entities.TrackerEntry.filter({ tracker_id: tracker.id });
    setEntries(data);
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
    const parseQuantJson = (raw) => {
      if (!raw) return {};
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return {}; }
    };
    const matchesCriteria = (vals, assignmentObj) => {
      const criteria = col.criteria;
      if (criteria && criteria.length > 0) {
        const criteriaLogic = col.criteria_logic || "or";
        const checkOne = (c) => {
          if (!c.col_name || !(c.include?.length)) return true; // no selection = match all
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
      let total = 0;
      filtered.forEach(a => {
        if (!matchesCriteria(a.column_values, a)) return;
        total += a.hours || 0;
      });
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] && row.values?.[tc.name] === workerId)) return;
        const rowAsAssignment = { qualification_id: row.values?.task || "" };
        if (!matchesColValueFilter(row.values, col.schedule_col_name, rowAsAssignment)) return;
        total += calcHours(
          row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "",
          row.values?.["סיום"] || row.values?.["שעת סיום"] || ""
        );
      });
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

      filtered.forEach(a => {
        const raw = a.column_values?.[col.schedule_col_name]?.value || a.column_values?.[col.schedule_col_name];
        const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
        opts.forEach(o => { counts[o] += parsed[o] || 0; });
      });

      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] && row.values?.[tc.name] === workerId)) return;
        const raw = row.values?.[col.schedule_col_name];
        const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
        opts.forEach(o => { counts[o] += parsed[o] || 0; });
      });

      return counts;
    }

    return null;
  };

  const isAuto = (type) => ["shifts_count", "schedule_col", "count_by_text", "count_by_task", "count_quantitative"].includes(type);

  const displayColumns = editMode ? editColumns : (tracker.columns || []);

  const filteredWorkers = workers.filter(w => {
    if (!w.active) return false;
    if (selectedPopulations.length > 0 && !selectedPopulations.includes(w.population)) return false;
    if (selectedRoles.length > 0 && !selectedRoles.includes(w.role)) return false;
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


  return (
    <Card className="border-none shadow-lg mb-6" dir="rtl">
      {/* Header */}
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{tracker.name}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              סינון
            </Button>
            <Button size="sm" variant={editMode ? "default" : "outline"}
              className={editMode ? "bg-purple-600 hover:bg-purple-700" : ""}
              onClick={() => editMode ? saveAndExitEditMode() : openEditMode()}>
              <Pencil className="w-4 h-4 ml-1" />{editMode ? "סיים עריכה" : "ערוך עמודות"}
            </Button>
            <ConfirmDeleteButton onConfirm={onDelete} variant="button" label="מחק טבלה" />
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="pt-3 mt-3 border-t flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs block mb-1">תקופה</Label>
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
            <div>
              <Label className="text-xs block mb-1">אוכלוסייה</Label>
              <MultiSelect
                options={populations}
                selected={selectedPopulations}
                onChange={setSelectedPopulations}
                placeholder="כל האוכלוסיות"
              />
            </div>
            <div>
              <Label className="text-xs block mb-1">תפקיד</Label>
              <MultiSelect
                options={workerRoles}
                selected={selectedRoles}
                onChange={setSelectedRoles}
                placeholder="כל התפקידים"
              />
            </div>
            <div>
              <Label className="text-xs block mb-1">מדריך</Label>
              <Select value={guide} onValueChange={setGuide}>
                <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__all__">כולם</SelectItem>
                  <SelectItem value="yes">מדריכים</SelectItem>
                  <SelectItem value="no">לא מדריכים</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

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
      <CardContent className="pt-0 px-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead dir="rtl" className="font-bold px-4 min-w-[100px]">
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
              </TableHead>
              {displayColumns.map((col, idx) => (
                <TableHead key={col.id} dir="rtl" className="px-2 min-w-[140px]">
                  <div className="flex flex-col items-center gap-0.5 py-0.5">
                    <button
                      onClick={() => !editMode && handleSortClick(col.id)}
                      className="font-medium flex items-center gap-1 hover:text-blue-700 transition-colors"
                    >
                      {col.name || <span className="text-gray-300 italic text-xs">ללא שם</span>}
                      {!editMode && (sortColId === col.id
                        ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                        : <ArrowUpDown className="w-3 h-3 text-gray-300" />)}
                    </button>
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
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-4 w-4 p-0" disabled={idx === displayColumns.length - 1}
                          onClick={() => {
                            const next = [...editColumns];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            setEditColumns(next);
                          }}>
                          <ChevronUp className="w-3 h-3" />
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
                    return (
                      <TableCell key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm">
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
                      return (
                        <TableCell key={col.id} className="text-center font-semibold px-2 py-0.5 text-sm">
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
                    const showAsHours = col.type === "schedule_col";
                    return (
                      <TableCell key={col.id} className="text-center font-semibold text-blue-900 px-2 py-0.5 text-sm">
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
                    const total = filteredWorkers.reduce((sum, w) => {
                      const v = computeAutoValue(col, w.id);
                      return sum + (typeof v === "number" ? v : 0);
                    }, 0);
                    const showAsHours = col.type === "schedule_col";
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
      </CardContent>
    </Card>
  );
}
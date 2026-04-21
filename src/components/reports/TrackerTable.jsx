import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Check, X, Plus, Save, ChevronDown, ChevronUp, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { base44 } from "@/api/base44Client";
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
    const m = today.getMonth(); // 0-indexed
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

export default function TrackerTable({ tracker: initialTracker, workers, assignments, templateRows, allTemplates, populations, workerRoles, scheduleColumns = [], taskQualifications = {}, onDelete, onUpdated }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [entries, setEntries] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [cellDraft, setCellDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Filters
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPopulations, setSelectedPopulations] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [guide, setGuide] = useState("__all__");
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortColId, setSortColId] = useState(null); // null = sort by name
  const [sortDir, setSortDir] = useState("asc");

  const handleSortClick = (colId) => {
    if (sortColId === colId) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColId(colId);
      setSortDir("asc");
    }
  };

  // Inline edit
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(tracker.name);
  const [editColumns, setEditColumns] = useState(tracker.columns || []);
  const [saving, setSaving] = useState(false);

  const allWorkerColumnNames = [...new Set(
    (allTemplates || []).flatMap(t => (t.columns || []).filter(c => c.type === "worker").map(c => c.name))
  )];

  useEffect(() => { loadEntries(); }, [tracker.id]);

  const loadEntries = async () => {
    const data = await base44.entities.TrackerEntry.filter({ tracker_id: tracker.id });
    setEntries(data);
  };

  const [newOptionDraft, setNewOptionDraft] = useState({});

  const addColumn = () => setEditColumns([...editColumns, { id: Date.now().toString(), name: "", type: "shifts_count", template_column: "", schedule_col_name: "", schedule_col_value: "", options: [], quantitative_options: [] }]);
  const updateColumn = (idx, field, value) => { const c = [...editColumns]; c[idx] = { ...c[idx], [field]: value }; setEditColumns(c); };
  const removeColumn = (idx) => setEditColumns(editColumns.filter((_, i) => i !== idx));

  const saveTracker = async () => {
    setSaving(true);
    const updated = await base44.entities.Tracker.update(tracker.id, { name: editName, columns: editColumns });
    setTracker(updated);
    if (onUpdated) onUpdated(updated);
    setSaving(false);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditName(tracker.name);
    setEditColumns(tracker.columns || []);
    setEditMode(false);
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
    const filtered = assignments.filter(a => {
      if (!(a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)) return false;
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    });

    if (col.type === "shifts_count") return filtered.length;

    // Helper: check if a schedule column value matches the filter
    const matchesFilter = (vals, colName, colValue) => {
      const fieldVal = vals?.[colName];
      const subTypes = vals?.[`${colName}_subTypes`] || [];
      const allVals = [fieldVal, ...subTypes].filter(Boolean).map(String);
      if (!colValue) return allVals.length > 0;
      return allVals.includes(String(colValue));
    };

    if (col.type === "schedule_col") {
      if (!col.schedule_col_name) return 0;
      let total = 0;
      filtered.forEach(a => {
        if (!matchesFilter(a.column_values, col.schedule_col_name, col.schedule_col_value)) return;
        total += a.hours || 0;
      });
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === workerId)) return;
        if (!matchesFilter(row.values, col.schedule_col_name, col.schedule_col_value)) return;
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
        if (matchesFilter(a.column_values, col.schedule_col_name, col.schedule_col_value)) count++;
      });
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === workerId)) return;
        if (matchesFilter(row.values, col.schedule_col_name, col.schedule_col_value)) count++;
      });
      return count;
    }

    if (col.type === "count_by_task") {
       const taskList = col.task_list || [];
       if (taskList.length === 0) return 0;
       // Return object with task names as keys and counts/hours as values
       const result = {};
       taskList.forEach(taskName => { result[taskName] = 0; });
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
      // If single item selected, only count that one
      const opts = col.quantitative_single_item ? [col.quantitative_single_item] : allOpts;
      const counts = {};
      opts.forEach(o => { counts[o] = 0; });

      // Parse JSON quantitative value (stored as '{"A":1,"B":2}')
      const parseQuantJson = (raw) => {
        if (!raw) return {};
        try { return JSON.parse(raw); } catch { return {}; }
      };

      // For assignments: stored in column_values[colName].value as JSON string
      filtered.forEach(a => {
        const raw = a.column_values?.[col.schedule_col_name]?.value || a.column_values?.[col.schedule_col_name];
        const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
        opts.forEach(o => { counts[o] += parsed[o] || 0; });
      });

      // For templateRows: stored in values[colName] as JSON string
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        if (!(tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === workerId)) return;
        const raw = row.values?.[col.schedule_col_name];
        const parsed = parseQuantJson(typeof raw === "string" ? raw : null);
        opts.forEach(o => { counts[o] += parsed[o] || 0; });
      });

      return counts;
    }

    return null;
  };

  const isAuto = (type) => ["shifts_count", "schedule_col", "count_by_text", "count_by_task", "count_quantitative"].includes(type);

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
  const displayColumns = editMode ? editColumns : (tracker.columns || []);

  return (
    <Card className="border-none shadow-lg mb-6" dir="rtl">
      {/* Header */}
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          {editMode ? (
            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 font-semibold text-base w-56" dir="rtl" placeholder="שם הטבלה" />
          ) : (
            <CardTitle className="text-base">{tracker.name}</CardTitle>
          )}
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={saveTracker} disabled={saving || !editName.trim()} className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 ml-1" />{saving ? "שומר..." : "שמור"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  <X className="w-4 h-4 ml-1" />ביטול
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
                  {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                  סינון
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditName(tracker.name);
                  // Auto-fill quantitative_options from scheduleColumns if empty
                  const cols = (tracker.columns || []).map(col => {
                    if (col.type === "count_quantitative" && (!col.quantitative_options || col.quantitative_options.length === 0) && col.schedule_col_name) {
                      const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                      if (sc?.quantitative_items?.length > 0) return { ...col, quantitative_options: sc.quantitative_items };
                    }
                    return col;
                  });
                  setEditColumns(cols);
                  setEditMode(true);
                }}>
                  <Pencil className="w-4 h-4 ml-1" />ערוך
                </Button>
                <ConfirmDeleteButton onConfirm={onDelete} variant="button" label="מחק טבלה" />
              </>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {!editMode && showFilters && (
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
              {displayColumns.map((col, idx) => {
                const isMultiTask = col.type === "count_by_task" && (col.task_list || []).length > 1;
                return (
                <TableHead key={col.id} dir="rtl" className={`px-2 ${isMultiTask ? "min-w-[180px]" : "min-w-[160px]"}`}>
                  {editMode ? (
                    <div className="flex flex-col gap-1 py-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeColumn(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Input
                          value={col.name}
                          onChange={e => updateColumn(idx, "name", e.target.value)}
                          placeholder="שם עמודה"
                          className="h-7 text-xs flex-1 min-w-0"
                          dir="rtl"
                        />
                      </div>
                      <Select value={col.type} onValueChange={v => updateColumn(idx, "type", v)}>
                        <SelectTrigger className="h-7 text-xs w-full" dir="rtl"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                          {COLUMN_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value} className="text-xs">{ct.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {(col.type === "schedule_col" || col.type === "count_by_text") && (() => {
                        const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                        const opts = [...(sc?.options || []), ...(sc?.sub_options?.map(so => so.name) || [])];
                        return (
                          <div className="space-y-1">
                            <Select value={col.schedule_col_name || ""} onValueChange={v => updateColumn(idx, "schedule_col_name", v)}>
                              <SelectTrigger className="h-7 text-xs w-full" dir="rtl"><SelectValue placeholder="עמודת לוח..." /></SelectTrigger>
                              <SelectContent dir="rtl">
                                {scheduleColumns.map(sc => <SelectItem key={sc.name} value={sc.name} className="text-xs">{sc.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {opts.length > 0 && (
                              <Select value={col.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "schedule_col_value", v)}>
                                <SelectTrigger className="h-7 text-xs w-full" dir="rtl"><SelectValue placeholder="ערך ספציפי (אופציונלי)..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                  <SelectItem value={null}>כל ערך</SelectItem>
                                  {opts.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })()}
                      {col.type === "count_by_task" && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs" dir="rtl">בחר משימות/כישרויות</Label>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(taskQualifications).sort().map(taskName => (
                              <button
                                key={taskName}
                                type="button"
                                onClick={() => {
                                  const tasks = col.task_list || [];
                                  const updated = tasks.includes(taskName) ? tasks.filter(t => t !== taskName) : [...tasks, taskName];
                                  updateColumn(idx, "task_list", updated);
                                }}
                                className={`px-1.5 py-0.5 rounded text-xs border transition-colors ${
                                  (col.task_list || []).includes(taskName)
                                    ? "bg-blue-600 border-blue-600 text-white font-semibold"
                                    : "bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-400"
                                }`}
                              >
                                {taskName}
                              </button>
                            ))}
                          </div>
                          {Object.keys(taskQualifications).length === 0 && <p className="text-xs text-gray-400">אין משימות מוגדרות בהגדרות</p>}
                        </div>
                      )}
                      {col.type === "count_quantitative" && (
                        <div className="space-y-1">
                          <Select
                            value={col.schedule_col_name || ""}
                            onValueChange={v => {
                              const sc = scheduleColumns.find(c => c.name === v);
                              const autoOpts = sc?.quantitative_items || [];
                              const next = [...editColumns];
                              next[idx] = { ...next[idx], schedule_col_name: v, quantitative_options: autoOpts, quantitative_single_item: "" };
                              setEditColumns(next);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-full" dir="rtl"><SelectValue placeholder="עמודת לוח לספירה..." /></SelectTrigger>
                            <SelectContent dir="rtl">
                              {scheduleColumns.filter(sc => sc.report_type === "count_quantitative").map(sc => <SelectItem key={sc.name} value={sc.name} className="text-xs">{sc.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                            const availableItems = sc?.quantitative_items || col.quantitative_options || [];
                            if (availableItems.length === 0) return null;
                            const singleItem = col.quantitative_single_item || "";
                            return (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">פריט לספירה:</div>
                                <div className="flex flex-wrap gap-1">
                                  {availableItems.map(item => (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => updateColumn(idx, "quantitative_single_item", singleItem === item ? "" : item)}
                                      className={`px-1.5 py-0.5 rounded text-xs border transition-colors ${
                                        singleItem === item
                                          ? "bg-blue-600 border-blue-600 text-white font-semibold"
                                          : "bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-400"
                                      }`}
                                    >
                                      {item}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                              </div>
                               ) : (
                                <button
                                  onClick={() => handleSortClick(col.id)}
                                  className="flex flex-col gap-0.5 py-1 items-center text-center w-full hover:text-blue-700 transition-colors"
                                >
                                  <span className="font-medium flex items-center gap-1">
                                    {col.name || <span className="text-gray-300 italic text-xs">ללא שם</span>}
                                    {sortColId === col.id
                                      ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                                      : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                                  </span>
                                  {col.type === "count_by_task" && (col.task_list || []).length > 1 && (
                                    <div className="flex flex-wrap gap-1 justify-center mt-1">
                                      {(col.task_list || []).map(taskName => (
                                        <span key={taskName} className="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded">
                                          {taskName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-gray-400 font-normal">
                                    {COLUMN_TYPES.find(ct => ct.value === col.type)?.label || ""}
                                  </span>
                                </button>
                               )}
                  </TableHead>
                  );
                  })}
              {/* Add column button in header */}
              {editMode && (
                <TableHead className="px-2">
                  <button
                    onClick={addColumn}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-dashed border-blue-300 hover:border-blue-500 rounded px-2 py-1 whitespace-nowrap transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />הוסף עמודה
                  </button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkers.map(worker => (
              <TableRow key={worker.id} className="hover:bg-gray-50">
                <TableCell className="font-medium whitespace-nowrap px-4">{worker.nickname}</TableCell>
                {displayColumns.map(col => {
                   const auto = isAuto(col.type);
                   const entryValue = getEntry(worker.id, col.id)?.value || "";
                   const value = auto ? computeAutoValue(col, worker.id) : entryValue;
                  const isEditing = editingCell?.workerId === worker.id && editingCell?.colId === col.id;

                  if (col.type === "count_by_task") {
                    const tasks = col.task_list || [];
                    const hours = typeof value === "object" && value !== null ? value : {};
                    if (tasks.length === 0) {
                      return <TableCell key={col.id} className="px-2 text-gray-300 text-xs">אין משימות</TableCell>;
                    }
                    // Single task: show just the number
                    if (tasks.length === 1) {
                      const taskName = tasks[0];
                      const h = hours[taskName] || 0;
                      return (
                        <TableCell key={col.id} className="text-center font-semibold px-2">
                          <span className={h > 0 ? "text-blue-900" : "text-gray-300"}>{h > 0 ? `${Math.round(h * 10) / 10}h` : "-"}</span>
                        </TableCell>
                      );
                    }
                    // Multiple tasks: show as column headers with values only
                    return (
                      <TableCell key={col.id} className="px-2 min-w-[80px]">
                        <div className="text-center">
                          <span className={`font-semibold ${Object.values(hours).some(h => h > 0) ? "text-blue-900" : "text-gray-300"}`}>
                            {Object.values(hours).reduce((sum, h) => sum + (h || 0), 0) > 0 
                              ? `${Math.round(Object.values(hours).reduce((sum, h) => sum + (h || 0), 0) * 10) / 10}h` 
                              : "-"}
                          </span>
                        </div>
                      </TableCell>
                    );
                  }
                  if (col.type === "count_quantitative") {
                    const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                    const allOpts = (col.quantitative_options && col.quantitative_options.length > 0)
                      ? col.quantitative_options
                      : (sc?.quantitative_items || []);
                    const counts = typeof value === "object" && value !== null ? value : {};
                    // Single item mode: show just one number
                    if (col.quantitative_single_item) {
                      const num = counts[col.quantitative_single_item] || 0;
                      return (
                        <TableCell key={col.id} className="text-center font-semibold px-2">
                          <span className={num > 0 ? "text-blue-900" : "text-gray-300"}>{num > 0 ? num : "-"}</span>
                        </TableCell>
                      );
                    }
                    // Multi-item mode: show list
                    return (
                      <TableCell key={col.id} className="px-2 min-w-[120px]">
                        <div className="space-y-0.5">
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
                      <TableCell key={col.id} className="text-center font-semibold text-blue-900 px-2">
                        {value > 0 ? (showAsHours ? `${value}h` : value) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    );
                  }
                  return (
                   <TableCell key={col.id} className="px-2">
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
                {editMode && <TableCell />}
              </TableRow>
            ))}
            {/* Summary row */}
            {!editMode && displayColumns.some(c => c.type === "count_quantitative" || c.type === "count_by_task" || isAuto(c.type)) && (
               <TableRow className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                 <TableCell className="px-4 text-blue-900 font-bold">סה"כ</TableCell>
                 {displayColumns.map(col => {
                   if (col.type === "count_by_task") {
                     const taskList = col.task_list || [];
                     const totals = {};
                     taskList.forEach(taskName => {
                       totals[taskName] = filteredWorkers.reduce((sum, w) => {
                         const taskHours = computeAutoValue(col, w.id);
                         return sum + ((typeof taskHours === "object" && taskHours !== null) ? (taskHours[taskName] || 0) : 0);
                       }, 0);
                     });
                     const grandTotal = Object.values(totals).reduce((sum, h) => sum + (h || 0), 0);
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
                    // Single item mode
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
                    // Multi-item mode
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
                  // For auto columns, sum numerics
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
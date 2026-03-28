import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Check, X, Plus, Save, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

const COLUMN_TYPES = [
  { value: "hours_assignments", label: "שעות (משימות)" },
  { value: "hours_templates", label: "שעות (תבניות)" },
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "number", label: "מספר (ידני)" },
  { value: "text", label: "טקסט (ידני)" },
  { value: "checkbox", label: "סימון (ידני)" },
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
  if (mode === "custom" && startDate && endDate) return { start: startDate, end: endDate };
  return null;
};

const DATE_MODES = [
  { value: "all", label: "כל הזמן" },
  { value: "daily", label: "היום" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "half_year", label: "חצי שנה" },
  { value: "custom", label: "מותאם" },
];

export default function TrackerTable({ tracker: initialTracker, workers, assignments, templateRows, allTemplates, populations, workerRoles, onDelete }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [entries, setEntries] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [cellDraft, setCellDraft] = useState("");

  // Filters
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [population, setPopulation] = useState("__all__");
  const [role, setRole] = useState("__all__");
  const [guide, setGuide] = useState("__all__");
  const [showFilters, setShowFilters] = useState(false);

  // Inline editor state
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

  // ── Inline editor helpers ──
  const addColumn = () => setEditColumns([...editColumns, { id: Date.now().toString(), name: "", type: "hours_assignments", template_column: "" }]);
  const updateColumn = (idx, field, value) => { const c = [...editColumns]; c[idx] = { ...c[idx], [field]: value }; setEditColumns(c); };
  const removeColumn = (idx) => setEditColumns(editColumns.filter((_, i) => i !== idx));

  const saveTracker = async () => {
    setSaving(true);
    const updated = await base44.entities.Tracker.update(tracker.id, { name: editName, columns: editColumns });
    setTracker(updated);
    setSaving(false);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditName(tracker.name);
    setEditColumns(tracker.columns || []);
    setEditMode(false);
  };

  // ── Cell helpers ──
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

  // ── Auto-compute ──
  const computeAutoValue = (col, workerId) => {
    const dateRange = getDateRange(dateFilterMode, startDate, endDate);
    const filtered = assignments.filter(a => {
      if (!(a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)) return false;
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    });
    if (col.type === "hours_assignments") return filtered.reduce((s, a) => s + (a.hours || 0), 0);
    if (col.type === "shifts_count") return filtered.length;
    if (col.type === "hours_templates") {
      let total = 0;
      templateRows.forEach(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return;
        const h = calcHours(row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "", row.values?.["סיום"] || row.values?.["שעת סיום"] || "");
        (tmpl.columns || []).forEach(tc => {
          if (tc.type !== "worker") return;
          if (col.template_column && col.template_column !== "__all__" && tc.name !== col.template_column) return;
          if (row.values?.[tc.name] === workerId) total += h;
        });
      });
      return Math.round(total * 10) / 10;
    }
    return null;
  };

  const filteredWorkers = workers.filter(w => {
    if (!w.active) return false;
    if (population !== "__all__" && w.population !== population) return false;
    if (role !== "__all__" && w.role !== role) return false;
    if (guide === "yes" && !w.is_guide) return false;
    if (guide === "no" && w.is_guide) return false;
    return true;
  });

  const isAuto = (type) => ["hours_assignments", "hours_templates", "shifts_count"].includes(type);
  const displayColumns = editMode ? editColumns : (tracker.columns || []);

  return (
    <Card className="border-none shadow-lg mb-6" dir="rtl">
      {/* ── Header ── */}
      <CardHeader className="border-b py-3 px-4">
        {editMode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 font-semibold text-base flex-1" dir="rtl" placeholder="שם הטבלה" />
              <Button size="sm" onClick={saveTracker} disabled={saving || !editName.trim()} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 ml-1" />{saving ? "שומר..." : "שמור"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 ml-1" />ביטול
              </Button>
            </div>
            {/* Column editor */}
            <div className="space-y-2 pt-1">
              {editColumns.map((col, idx) => (
                <div key={col.id} className="flex gap-2 items-center bg-gray-50 rounded-lg p-2 border">
                  <Input value={col.name} onChange={e => updateColumn(idx, "name", e.target.value)} placeholder="שם עמודה" className="h-7 text-sm flex-1" dir="rtl" />
                  <Select value={col.type} onValueChange={v => updateColumn(idx, "type", v)}>
                    <SelectTrigger className="h-7 w-44 text-sm" dir="rtl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {COLUMN_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {col.type === "hours_templates" && allWorkerColumnNames.length > 0 && (
                    <Select value={col.template_column || ""} onValueChange={v => updateColumn(idx, "template_column", v)}>
                      <SelectTrigger className="h-7 w-36 text-sm" dir="rtl"><SelectValue placeholder="עמודה..." /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="__all__">כל העמודות</SelectItem>
                        {allWorkerColumnNames.map(cn => <SelectItem key={cn} value={cn}>{cn}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 flex-shrink-0" onClick={() => removeColumn(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addColumn} className="w-full">
                <Plus className="w-4 h-4 ml-1" />הוסף עמודה
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{tracker.name}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                סינון
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                <Pencil className="w-4 h-4 ml-1" />ערוך
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Filters panel */}
        {!editMode && showFilters && (
          <div className="pt-3 mt-3 border-t flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs block mb-1">תקופה</Label>
              <div className="flex flex-wrap gap-1">
                {DATE_MODES.map(m => (
                  <Button key={m.value} variant={dateFilterMode === m.value ? "default" : "outline"} size="sm"
                    className={dateFilterMode === m.value ? "bg-blue-900 text-white h-7 px-2 text-xs" : "h-7 px-2 text-xs"}
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
              <Select value={population} onValueChange={setPopulation}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__all__">כולם</SelectItem>
                  {populations.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs block mb-1">תפקיד</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__all__">כולם</SelectItem>
                  {workerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* ── Table ── */}
      <CardContent className="pt-4 px-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead dir="rtl" className="font-bold">עובד</TableHead>
              {displayColumns.map(col => (
                <TableHead key={col.id} dir="rtl">
                  <div className="flex flex-col gap-0.5">
                    <span>{col.name || <span className="text-gray-300 italic text-xs">ללא שם</span>}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {COLUMN_TYPES.find(ct => ct.value === col.type)?.label || ""}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkers.map(worker => (
              <TableRow key={worker.id} className="hover:bg-gray-50">
                <TableCell className="font-medium whitespace-nowrap">{worker.nickname}</TableCell>
                {displayColumns.map(col => {
                  const auto = isAuto(col.type);
                  const entryValue = getEntry(worker.id, col.id)?.value || "";
                  const value = auto ? computeAutoValue(col, worker.id) : entryValue;
                  const isEditing = editingCell?.workerId === worker.id && editingCell?.colId === col.id;

                  if (auto) {
                    return (
                      <TableCell key={col.id} className="text-center font-semibold text-blue-900">
                        {value > 0 ? (col.type === "shifts_count" ? value : `${value}h`) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    );
                  }
                  if (col.type === "checkbox") {
                    return (
                      <TableCell key={col.id} className="text-center">
                        <button
                          onClick={() => toggleCheckbox(worker.id, col.id, entryValue)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mx-auto ${entryValue === "true" ? "bg-green-500 border-green-600 text-white" : "border-gray-300 hover:border-blue-400"}`}
                        >
                          {entryValue === "true" && <Check className="w-3 h-3" />}
                        </button>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={col.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input autoFocus value={cellDraft} onChange={e => setCellDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveCell(); if (e.key === "Escape") setEditingCell(null); }}
                            className="h-7 text-sm w-24" type={col.type === "number" ? "number" : "text"} dir="rtl" />
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
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
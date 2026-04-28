import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Settings2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const REPORT_TYPE_MAP = {
  sum_hours: "schedule_col",
  count_by_text: "count_by_text",
  count_quantitative: "count_quantitative",
  sum_numbers: "schedule_col",
};

const REPORT_TYPE_LABEL = {
  sum_hours: "סיכום שעות",
  count_by_text: "ספירת פעמים",
  count_quantitative: "ספירה כמותית",
  sum_numbers: "סיכום מספרים",
};

// Multi-tag selector: include/exclude chips
function MultiCriterion({ label, description, options, value = { include: [], exclude: [] }, onChange }) {
  const toggle = (mode, opt) => {
    const other = mode === "include" ? "exclude" : "include";
    const current = value[mode] || [];
    const otherList = value[other] || [];
    if (current.includes(opt)) {
      onChange({ ...value, [mode]: current.filter(v => v !== opt) });
    } else {
      onChange({ ...value, [mode]: [...current, opt], [other]: otherList.filter(v => v !== opt) });
    }
  };

  const isIncluded = (opt) => (value.include || []).includes(opt);
  const isExcluded = (opt) => (value.exclude || []).includes(opt);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const inc = isIncluded(opt);
          const exc = isExcluded(opt);
          return (
            <div key={opt} className="flex rounded-lg overflow-hidden border text-xs">
              <button
                type="button"
                title="כלול"
                onClick={() => toggle("include", opt)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${
                  inc ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-500 hover:bg-green-50"
                }`}
              >
                ✓ {opt}
              </button>
              <button
                type="button"
                title="אל תכלול"
                onClick={() => toggle("exclude", opt)}
                className={`px-2 py-1.5 border-r transition-colors ${
                  exc ? "bg-red-500 text-white" : "bg-white text-gray-300 hover:bg-red-50 hover:text-red-400"
                }`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      {((value.include?.length || 0) > 0 || (value.exclude?.length || 0) > 0) && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-1 mt-0.5">
          {(value.include || []).length > 0 && (
            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
              כולל: {value.include.join(", ")}
            </span>
          )}
          {(value.exclude || []).length > 0 && (
            <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
              לא כולל: {value.exclude.join(", ")}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange({ include: [], exclude: [] })}
            className="text-gray-400 hover:text-gray-600 underline"
          >נקה</button>
        </div>
      )}
    </div>
  );
}

// Pop-up dialog for configuring a single column's criteria
function ColumnConfigDialog({ col, scheduleColumns, taskNames, populations, workerRoles, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...col });

  // Sync draft when col prop changes (e.g. after external state update)
  useEffect(() => {
    setDraft({ ...col });
  }, [col.id]);

  const schedCol = scheduleColumns.find(c => c.name === draft.schedule_col_name);
  const reportType = schedCol?.report_type || "";

  const colOptions = [
    ...(schedCol?.options || []),
    ...(schedCol?.sub_options?.map(so => so.name) || [])
  ];
  const quantItems = schedCol?.quantitative_items || [];

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle dir="rtl">
            הגדרת עמודה — {draft.schedule_col_name || "מספר משמרות"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Column display name */}
          <div>
            <Label className="text-sm font-medium">שם תצוגה בטבלה</Label>
            <Input
              value={draft.name}
              onChange={e => update("name", e.target.value)}
              dir="rtl"
              className="mt-1"
              placeholder="שם העמודה..."
            />
          </div>

          {/* ── Value filter (for text/hours columns) ── */}
          {(reportType === "sum_hours" || reportType === "count_by_text" || reportType === "sum_numbers") && colOptions.length > 0 && (
            <MultiCriterion
              label="ערכים בעמודת הלוח"
              description='✓ = כלול בחישוב  |  ✕ = אל תכלול. ללא בחירה — כל הערכים נספרים'
              options={colOptions}
              value={draft.col_value_filter || { include: [], exclude: [] }}
              onChange={v => update("col_value_filter", v)}
            />
          )}

          {/* ── Quantitative: pick items ── */}
          {reportType === "count_quantitative" && quantItems.length > 0 && (
            <div>
              <Label className="text-sm font-medium">פריט לספירה</Label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">בחר פריט אחד בלחיצה, או השאר ריק להציג את כולם</p>
              <div className="flex flex-wrap gap-2">
                {quantItems.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => update("quantitative_single_item", draft.quantitative_single_item === item ? "" : item)}
                    className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors font-medium ${
                      draft.quantitative_single_item === item
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Time range filter ── */}
          {(reportType === "sum_hours" || reportType === "count_by_text" || !draft.schedule_col_name) && (
            <div>
              <Label className="text-sm font-medium">טווח שעות משמרת</Label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">ספור רק משמרות שמתחילות בין השעות האלה (לדוגמה: 02:00 עד 06:00)</p>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={draft.time_range_filter?.start || ""}
                  onChange={e => update("time_range_filter", { ...draft.time_range_filter, start: e.target.value })}
                  className="w-28"
                />
                <span className="text-sm text-gray-500">עד</span>
                <Input
                  type="time"
                  value={draft.time_range_filter?.end || ""}
                  onChange={e => update("time_range_filter", { ...draft.time_range_filter, end: e.target.value })}
                  className="w-28"
                />
                {(draft.time_range_filter?.start || draft.time_range_filter?.end) && (
                  <button
                    type="button"
                    onClick={() => update("time_range_filter", { start: "", end: "" })}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >נקה</button>
                )}
              </div>
            </div>
          )}

          {/* ── Task filter ── */}
          {taskNames.length > 0 && (
            <MultiCriterion
              label="משימות"
              description="ספור רק שורות עם המשימות האלה (✓), או הוצא (✕). ללא בחירה — כל המשימות"
              options={taskNames}
              value={draft.task_filter || { include: [], exclude: [] }}
              onChange={v => update("task_filter", v)}
            />
          )}

          {/* ── Population filter ── */}
          {(populations || []).length > 0 && (
            <MultiCriterion
              label="אוכלוסיות"
              description="כלול או הוצא לפי אוכלוסייה. ללא בחירה — כל האוכלוסיות"
              options={populations}
              value={draft.population_filter || { include: [], exclude: [] }}
              onChange={v => update("population_filter", v)}
            />
          )}

          {/* ── Role filter ── */}
          {(workerRoles || []).length > 0 && (
            <MultiCriterion
              label="תפקידים"
              description="כלול או הוצא לפי תפקיד. ללא בחירה — כל התפקידים"
              options={workerRoles}
              value={draft.role_filter || { include: [], exclude: [] }}
              onChange={v => update("role_filter", v)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} dir="rtl">ביטול</Button>
          <Button onClick={() => { onSave(draft); onClose(); }} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
            <Check className="w-4 h-4 ml-1" />אישור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper: summarize a column's active filters into display tags
function getColSummary(col) {
  const tags = [];
  const cf = col.col_value_filter;
  if (cf?.include?.length) tags.push(`ערך: ${cf.include.join(", ")}`);
  if (cf?.exclude?.length) tags.push(`לא: ${cf.exclude.join(", ")}`);
  if (col.quantitative_single_item) tags.push(col.quantitative_single_item);
  const tf = col.task_filter;
  if (tf?.include?.length) tags.push(`משימה: ${tf.include.join(", ")}`);
  if (tf?.exclude?.length) tags.push(`לא משימה: ${tf.exclude.join(", ")}`);
  const pf = col.population_filter;
  if (pf?.include?.length) tags.push(`אוכ׳: ${pf.include.join(", ")}`);
  const rf = col.role_filter;
  if (rf?.include?.length) tags.push(`תפקיד: ${rf.include.join(", ")}`);
  const trf = col.time_range_filter;
  if (trf?.start || trf?.end) tags.push(`שעות: ${trf.start || "?"}-${trf.end || "?"}`);
  return tags;
}

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, scheduleColumns = [], taskQualifications = {}, populations = [], workerRoles = [] }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);
  // Store only the ID of the column being configured, then look it up from `columns` state
  const [configuringColId, setConfiguringColId] = useState(null);
  const [localTaskNames, setLocalTaskNames] = useState([]);

  const prevOpenRef = useRef(false);
  const prevTrackerIdRef = useRef(null);
  useEffect(() => {
    const trackerId = tracker?.id ?? null;
    const justOpened = open && !prevOpenRef.current;
    const trackerChanged = open && trackerId !== prevTrackerIdRef.current;
    if (justOpened || trackerChanged) {
      setName(tracker ? tracker.name || "" : "");
      setColumns(tracker ? (tracker.columns || []).map(c => ({ ...c })) : []);
      setConfiguringColId(null);
      prevTrackerIdRef.current = trackerId;
    }
    prevOpenRef.current = open;
  }, [open, tracker]);

  useEffect(() => {
    if (open) {
      base44.entities.AppSettings.filter({ setting_key: "tasks_list" }).then(settings => {
        setLocalTaskNames(settings.length > 0 ? JSON.parse(settings[0].setting_value) || [] : []);
      });
    }
  }, [open]);

  // Always get fresh column data from state by ID
  const configuringCol = configuringColId ? columns.find(c => c.id === configuringColId) || null : null;

  const isAdded = (schedColName) => columns.some(c => c.schedule_col_name === schedColName);
  const shiftsCountAdded = columns.some(c => c.type === "shifts_count");

  const buildNewCol = (schedCol) => ({
    id: Date.now().toString(),
    name: schedCol.name,
    type: REPORT_TYPE_MAP[schedCol.report_type] || "schedule_col",
    schedule_col_name: schedCol.name,
    quantitative_options: schedCol.quantitative_items || [],
    quantitative_single_item: "",
    col_value_filter: { include: [], exclude: [] },
    task_filter: { include: [], exclude: [] },
    population_filter: { include: [], exclude: [] },
    role_filter: { include: [], exclude: [] },
    time_range_filter: { start: "", end: "" },
  });

  const toggleScheduleCol = (schedColName) => {
    if (isAdded(schedColName)) {
      setColumns(prev => prev.filter(c => c.schedule_col_name !== schedColName));
    } else {
      const schedCol = scheduleColumns.find(c => c.name === schedColName);
      if (!schedCol) return;
      const newCol = buildNewCol(schedCol);
      setColumns(prev => [...prev, newCol]);
      setConfiguringColId(newCol.id);
    }
  };

  const toggleShiftsCount = () => {
    if (shiftsCountAdded) {
      setColumns(prev => prev.filter(c => c.type !== "shifts_count"));
    } else {
      setColumns(prev => [...prev, {
        id: Date.now().toString(),
        name: "מספר משמרות",
        type: "shifts_count",
        schedule_col_name: "",
        task_filter: { include: [], exclude: [] },
        population_filter: { include: [], exclude: [] },
        role_filter: { include: [], exclude: [] },
      }]);
    }
  };

  const saveColConfig = (updatedCol) => {
    setColumns(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    setConfiguringColId(null);
  };

  const removeColumn = (colId) => {
    setColumns(prev => prev.filter(c => c.id !== colId));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = { name: name.trim(), columns };
    let saved;
    if (tracker?.id) {
      saved = await base44.entities.Tracker.update(tracker.id, data);
    } else {
      saved = await base44.entities.Tracker.create({ ...data, order: Date.now() });
    }
    setSaving(false);
    onSaved(saved);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle dir="rtl">{tracker ? "ערוך מעקב" : "צור מעקב חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Table name */}
            <div>
              <Label dir="rtl">שם הטבלה</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="לדוגמה: מעקב שעות חודשי"
                dir="rtl"
                className="mt-1"
              />
            </div>

            {/* Column picker grid */}
            <div>
              <Label dir="rtl" className="mb-3 block">בחר עמודות להוספה</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" dir="rtl">

                {/* Shifts count */}
                <button
                  type="button"
                  onClick={toggleShiftsCount}
                  className={`relative flex flex-col items-start p-3 rounded-lg border-2 text-right transition-all ${
                    shiftsCountAdded
                      ? "bg-blue-900 border-blue-900 text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {shiftsCountAdded && <Check className="absolute top-2 left-2 w-4 h-4" />}
                  <span className="font-semibold text-sm">מספר משמרות</span>
                  <span className={`text-xs mt-1 ${shiftsCountAdded ? "text-blue-200" : "text-gray-400"}`}>ספירת כמות</span>
                </button>

                {/* Schedule columns */}
                {scheduleColumns.map(sc => {
                  const added = isAdded(sc.name);
                  const col = columns.find(c => c.schedule_col_name === sc.name);
                  const tags = col ? getColSummary(col) : [];
                  return (
                    <button
                      key={sc.name}
                      type="button"
                      onClick={() => toggleScheduleCol(sc.name)}
                      className={`relative flex flex-col items-start p-3 rounded-lg border-2 text-right transition-all ${
                        added
                          ? "bg-blue-900 border-blue-900 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {added && <Check className="absolute top-2 left-2 w-4 h-4" />}
                      <span className="font-semibold text-sm">{sc.name}</span>
                      <span className={`text-xs mt-1 px-1.5 py-0.5 rounded-full ${
                        added ? "bg-blue-700 text-blue-100" :
                        sc.report_type === "sum_hours" ? "bg-purple-100 text-purple-700" :
                        sc.report_type === "count_by_text" ? "bg-green-100 text-green-700" :
                        sc.report_type === "count_quantitative" ? "bg-emerald-100 text-emerald-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {REPORT_TYPE_LABEL[sc.report_type] || sc.report_type}
                      </span>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tags.slice(0, 2).map((t, i) => (
                            <span key={i} className="text-[10px] bg-blue-700 text-blue-100 px-1 rounded leading-4">{t}</span>
                          ))}
                          {tags.length > 2 && <span className="text-[10px] text-blue-200">+{tags.length - 2}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}

                {scheduleColumns.length === 0 && (
                  <p className="col-span-3 text-xs text-gray-400 text-center py-4">אין עמודות לוח מוגדרות בהגדרות</p>
                )}
              </div>
            </div>

            {/* Added columns list */}
            {columns.length > 0 && (
              <div>
                <Label dir="rtl" className="mb-2 block">עמודות שנוספו ({columns.length})</Label>
                <div className="space-y-1.5" dir="rtl">
                  {columns.map((col) => {
                    const tags = getColSummary(col);
                    return (
                      <div key={col.id} className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm text-gray-800">{col.name}</span>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {tags.map((t, i) => (
                                <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setConfiguringColId(col.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="הגדר קריטריונים"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeColumn(col.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
              {saving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column config popup — reads fresh data from `columns` state via ID */}
      {configuringCol && (
        <ColumnConfigDialog
          col={configuringCol}
          scheduleColumns={scheduleColumns}
          taskNames={localTaskNames}
          populations={populations}
          workerRoles={workerRoles}
          onSave={saveColConfig}
          onClose={() => setConfiguringColId(null)}
        />
      )}
    </>
  );
}
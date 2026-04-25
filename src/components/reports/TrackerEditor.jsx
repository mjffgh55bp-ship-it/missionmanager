import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Map schedule column report_type → tracker column type
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

// A single column editor after the schedule column is chosen
function ColumnCriteriaEditor({ col, idx, scheduleColumns, taskQualifications, populations, workerRoles, updateColumn, removeColumn }) {
  const schedCol = scheduleColumns.find(c => c.name === col.schedule_col_name);
  const reportType = schedCol?.report_type || "";
  const opts = [...(schedCol?.options || []), ...(schedCol?.sub_options?.map(so => so.name) || [])];
  const taskNames = Object.keys(taskQualifications || {}).sort();
  const quantItems = schedCol?.quantitative_items || [];

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={col.name}
            onChange={e => updateColumn(idx, "name", e.target.value)}
            placeholder="שם העמודה..."
            dir="rtl"
            className="h-7 text-sm border-0 bg-transparent p-0 font-medium focus-visible:ring-0"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">{col.schedule_col_name} · {REPORT_TYPE_LABEL[reportType] || ""}</span>
        </div>
        <button onClick={() => removeColumn(idx)} className="text-red-400 hover:text-red-600 ml-2">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Criteria */}
      <div className="px-3 py-3 space-y-3" dir="rtl">
        {/* Value filter for text-based cols */}
        {(reportType === "sum_hours" || reportType === "count_by_text" || reportType === "sum_numbers") && opts.length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">ערך ספציפי בעמודת הלוח (אופציונלי)</Label>
            <Select value={col.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "schedule_col_value", v)}>
              <SelectTrigger className="h-8 text-sm" dir="rtl">
                <SelectValue placeholder="כל ערך" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={null}>כל ערך</SelectItem>
                {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Quantitative: pick a single item */}
        {reportType === "count_quantitative" && quantItems.length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">פריט לספירה (בחר אחד)</Label>
            <div className="flex flex-wrap gap-1">
              {quantItems.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => updateColumn(idx, "quantitative_single_item", col.quantitative_single_item === item ? "" : item)}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    col.quantitative_single_item === item
                      ? "bg-blue-600 border-blue-600 text-white font-semibold"
                      : "bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-400"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            {!col.quantitative_single_item && <p className="text-xs text-gray-400 mt-1">ללא בחירה — יוצגו כל הפריטים בשורות נפרדות</p>}
          </div>
        )}

        {/* Task filter */}
        {taskNames.length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">ספור רק אם בוצעה משימה (אופציונלי)</Label>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => updateColumn(idx, "filter_task", "")}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  !col.filter_task ? "bg-gray-700 border-gray-700 text-white" : "bg-gray-50 border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                ללא סינון
              </button>
              {taskNames.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateColumn(idx, "filter_task", col.filter_task === t ? "" : t)}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    col.filter_task === t
                      ? "bg-violet-600 border-violet-600 text-white font-semibold"
                      : "bg-gray-50 border-gray-300 text-gray-600 hover:border-violet-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Population filter */}
        {(populations || []).length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">ספור רק לאוכלוסייה (אופציונלי)</Label>
            <Select value={col.filter_population || ""} onValueChange={v => updateColumn(idx, "filter_population", v)}>
              <SelectTrigger className="h-8 text-sm" dir="rtl">
                <SelectValue placeholder="כל האוכלוסיות" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={null}>כל האוכלוסיות</SelectItem>
                {populations.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Role filter */}
        {(workerRoles || []).length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">ספור רק לתפקיד (אופציונלי)</Label>
            <Select value={col.filter_role || ""} onValueChange={v => updateColumn(idx, "filter_role", v)}>
              <SelectTrigger className="h-8 text-sm" dir="rtl">
                <SelectValue placeholder="כל התפקידים" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={null}>כל התפקידים</SelectItem>
                {workerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, scheduleColumns = [], taskQualifications = {}, populations = [], workerRoles = [] }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [localTaskQuals, setLocalTaskQuals] = useState(taskQualifications);

  useEffect(() => {
    if (open) {
      if (tracker) {
        setName(tracker.name || "");
        setColumns(tracker.columns || []);
      } else {
        setName("");
        setColumns([]);
      }
    }
  }, [tracker, open]);

  useEffect(() => {
    if (open) {
      base44.entities.AppSettings.filter({ setting_key: "task_qualifications" }).then(settings => {
        if (settings.length > 0) setLocalTaskQuals(JSON.parse(settings[0].setting_value) || {});
        else setLocalTaskQuals({});
      });
    }
  }, [open]);

  const addColumnFromScheduleCol = (schedColName) => {
    const schedCol = scheduleColumns.find(c => c.name === schedColName);
    if (!schedCol) return;
    const trackerType = REPORT_TYPE_MAP[schedCol.report_type] || "schedule_col";
    setColumns(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: schedCol.name,
        type: trackerType,
        schedule_col_name: schedCol.name,
        schedule_col_value: "",
        quantitative_options: schedCol.quantitative_items || [],
        quantitative_single_item: "",
        filter_task: "",
        filter_population: "",
        filter_role: "",
      }
    ]);
    setAddingColumn(false);
  };

  // Special: shifts_count column
  const addShiftsCountColumn = () => {
    setColumns(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "מספר משמרות",
        type: "shifts_count",
        schedule_col_name: "",
        filter_task: "",
        filter_population: "",
        filter_role: "",
      }
    ]);
    setAddingColumn(false);
  };

  const updateColumn = (idx, field, value) => {
    setColumns(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const removeColumn = (idx) => {
    setColumns(prev => prev.filter((_, i) => i !== idx));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle dir="rtl">{tracker ? "ערוך מעקב" : "צור מעקב חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label dir="rtl">שם הטבלה</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='לדוגמה: מעקב שעות חודשי'
              dir="rtl"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label dir="rtl">עמודות</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddingColumn(v => !v)}
                dir="rtl"
              >
                <Plus className="w-4 h-4 ml-1" />הוסף עמודה
              </Button>
            </div>

            {/* Column picker dropdown */}
            {addingColumn && (
              <div className="mb-3 border rounded-lg bg-blue-50 p-3 space-y-1" dir="rtl">
                <p className="text-xs font-semibold text-gray-600 mb-2">בחר עמודת לוח להוספה:</p>

                {/* Shifts count (special) */}
                <button
                  onClick={addShiftsCountColumn}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors text-sm flex justify-between items-center"
                >
                  <span className="font-medium">מספר משמרות</span>
                  <span className="text-xs text-gray-400">סיפור כמות משמרות</span>
                </button>

                {scheduleColumns.length === 0 && (
                  <p className="text-xs text-gray-400 py-2 text-center">אין עמודות לוח מוגדרות בהגדרות</p>
                )}

                {scheduleColumns.map(sc => (
                  <button
                    key={sc.name}
                    onClick={() => addColumnFromScheduleCol(sc.name)}
                    className="w-full text-right px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors text-sm flex justify-between items-center"
                  >
                    <span className="font-medium">{sc.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sc.report_type === "sum_hours" ? "bg-purple-100 text-purple-700" :
                      sc.report_type === "count_by_text" ? "bg-green-100 text-green-700" :
                      sc.report_type === "count_quantitative" ? "bg-emerald-100 text-emerald-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {REPORT_TYPE_LABEL[sc.report_type] || sc.report_type}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Columns list */}
            <div className="space-y-2">
              {columns.length === 0 && !addingColumn && (
                <p className="text-sm text-gray-400 text-center py-6" dir="rtl">
                  אין עמודות עדיין — לחץ "הוסף עמודה" כדי לבחור
                </p>
              )}

              {columns.map((col, idx) => (
                col.type === "shifts_count" ? (
                  // Simple shifts_count row
                  <div key={col.id} className="border rounded-lg bg-white">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={col.name}
                          onChange={e => updateColumn(idx, "name", e.target.value)}
                          dir="rtl"
                          className="h-7 text-sm border-0 bg-transparent p-0 font-medium focus-visible:ring-0"
                        />
                        <span className="text-xs text-gray-400">מספר משמרות</span>
                      </div>
                      <button onClick={() => removeColumn(idx)} className="text-red-400 hover:text-red-600 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Task/population/role filters */}
                    <div className="px-3 py-2 space-y-2" dir="rtl">
                      {Object.keys(localTaskQuals).length > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">ספור רק אם בוצעה משימה (אופציונלי)</Label>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => updateColumn(idx, "filter_task", "")}
                              className={`px-2 py-1 rounded text-xs border transition-colors ${!col.filter_task ? "bg-gray-700 border-gray-700 text-white" : "bg-gray-50 border-gray-300 text-gray-600"}`}
                            >ללא סינון</button>
                            {Object.keys(localTaskQuals).sort().map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => updateColumn(idx, "filter_task", col.filter_task === t ? "" : t)}
                                className={`px-2 py-1 rounded text-xs border transition-colors ${col.filter_task === t ? "bg-violet-600 border-violet-600 text-white" : "bg-gray-50 border-gray-300 text-gray-600 hover:border-violet-400"}`}
                              >{t}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ColumnCriteriaEditor
                    key={col.id}
                    col={col}
                    idx={idx}
                    scheduleColumns={scheduleColumns}
                    taskQualifications={localTaskQuals}
                    populations={populations}
                    workerRoles={workerRoles}
                    updateColumn={updateColumn}
                    removeColumn={removeColumn}
                  />
                )
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
            {saving ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
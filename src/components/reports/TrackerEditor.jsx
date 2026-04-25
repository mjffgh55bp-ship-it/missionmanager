import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Settings2, Check, Plus } from "lucide-react";
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

const REPORT_TYPE_COLOR = {
  sum_hours: "bg-purple-100 text-purple-700 border-purple-200",
  count_by_text: "bg-green-100 text-green-700 border-green-200",
  count_quantitative: "bg-emerald-100 text-emerald-700 border-emerald-200",
  sum_numbers: "bg-blue-100 text-blue-700 border-blue-200",
};

// Pop-up dialog for configuring a single column's criteria
function ColumnConfigDialog({ col, scheduleColumns, taskQualifications, populations, workerRoles, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...col });

  const schedCol = scheduleColumns.find(c => c.name === draft.schedule_col_name);
  const reportType = schedCol?.report_type || "";
  const opts = [...(schedCol?.options || []), ...(schedCol?.sub_options?.map(so => so.name) || [])];
  const taskNames = Object.keys(taskQualifications || {}).sort();
  const quantItems = schedCol?.quantitative_items || [];

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle dir="rtl">הגדרת עמודה — {draft.schedule_col_name || "מספר משמרות"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          {/* Value filter for text-based cols */}
          {(reportType === "sum_hours" || reportType === "count_by_text" || reportType === "sum_numbers") && opts.length > 0 && (
            <div>
              <Label className="text-sm font-medium">ערך ספציפי בעמודת הלוח</Label>
              <p className="text-xs text-gray-500 mb-1">ספור רק שורות שבהן העמודה שווה לערך זה</p>
              <Select value={draft.schedule_col_value || ""} onValueChange={v => update("schedule_col_value", v)}>
                <SelectTrigger className="mt-1" dir="rtl">
                  <SelectValue placeholder="כל ערך (ללא סינון)" />
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
              <Label className="text-sm font-medium">פריט לספירה</Label>
              <p className="text-xs text-gray-500 mb-2">בחר פריט אחד, או השאר ריק להציג את כולם</p>
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

          {/* Task filter */}
          {taskNames.length > 0 && (
            <div>
              <Label className="text-sm font-medium">ספור רק אם בוצעה משימה</Label>
              <p className="text-xs text-gray-500 mb-2">הגבל לשורות בהן שויכה משימה זו</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => update("filter_task", "")}
                  className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors font-medium ${
                    !draft.filter_task ? "bg-gray-700 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  ללא סינון
                </button>
                {taskNames.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("filter_task", draft.filter_task === t ? "" : t)}
                    className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors font-medium ${
                      draft.filter_task === t
                        ? "bg-violet-600 border-violet-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-violet-300"
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
              <Label className="text-sm font-medium">ספור רק לאוכלוסייה</Label>
              <Select value={draft.filter_population || ""} onValueChange={v => update("filter_population", v)}>
                <SelectTrigger className="mt-1" dir="rtl">
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
              <Label className="text-sm font-medium">ספור רק לתפקיד</Label>
              <Select value={draft.filter_role || ""} onValueChange={v => update("filter_role", v)}>
                <SelectTrigger className="mt-1" dir="rtl">
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

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, scheduleColumns = [], taskQualifications = {}, populations = [], workerRoles = [] }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [configuringCol, setConfiguringCol] = useState(null); // { col, idx } | null
  const [localTaskQuals, setLocalTaskQuals] = useState(taskQualifications);

  useEffect(() => {
    if (open) {
      setName(tracker ? tracker.name || "" : "");
      setColumns(tracker ? tracker.columns || [] : []);
    }
  }, [tracker, open]);

  useEffect(() => {
    if (open) {
      base44.entities.AppSettings.filter({ setting_key: "task_qualifications" }).then(settings => {
        setLocalTaskQuals(settings.length > 0 ? JSON.parse(settings[0].setting_value) || {} : {});
      });
    }
  }, [open]);

  // Check if a schedule column is already added
  const isAdded = (schedColName) => columns.some(c => c.schedule_col_name === schedColName);
  const shiftsCountAdded = columns.some(c => c.type === "shifts_count");

  const toggleScheduleCol = (schedColName) => {
    if (isAdded(schedColName)) {
      setColumns(prev => prev.filter(c => c.schedule_col_name !== schedColName));
    } else {
      const schedCol = scheduleColumns.find(c => c.name === schedColName);
      if (!schedCol) return;
      const newCol = {
        id: Date.now().toString(),
        name: schedCol.name,
        type: REPORT_TYPE_MAP[schedCol.report_type] || "schedule_col",
        schedule_col_name: schedCol.name,
        schedule_col_value: "",
        quantitative_options: schedCol.quantitative_items || [],
        quantitative_single_item: "",
        filter_task: "",
        filter_population: "",
        filter_role: "",
      };
      setColumns(prev => [...prev, newCol]);
      // Auto-open config dialog for the new column
      setConfiguringCol({ col: newCol, idx: columns.length });
    }
  };

  const toggleShiftsCount = () => {
    if (shiftsCountAdded) {
      setColumns(prev => prev.filter(c => c.type !== "shifts_count"));
    } else {
      const newCol = {
        id: Date.now().toString(),
        name: "מספר משמרות",
        type: "shifts_count",
        schedule_col_name: "",
        filter_task: "",
        filter_population: "",
        filter_role: "",
      };
      setColumns(prev => [...prev, newCol]);
    }
  };

  const saveColConfig = (updatedCol) => {
    setColumns(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    setConfiguringCol(null);
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

  // Build summary tags for a column
  const getColSummary = (col) => {
    const tags = [];
    if (col.schedule_col_value) tags.push(col.schedule_col_value);
    if (col.quantitative_single_item) tags.push(col.quantitative_single_item);
    if (col.filter_task) tags.push(`משימה: ${col.filter_task}`);
    if (col.filter_population) tags.push(`אוכ׳: ${col.filter_population}`);
    if (col.filter_role) tags.push(`תפקיד: ${col.filter_role}`);
    return tags;
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
                          {tags.map((t, i) => (
                            <span key={i} className="text-[10px] bg-blue-700 text-blue-100 px-1 rounded">{t}</span>
                          ))}
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

            {/* Added columns list with config buttons */}
            {columns.length > 0 && (
              <div>
                <Label dir="rtl" className="mb-2 block">עמודות שנוספו ({columns.length})</Label>
                <div className="space-y-1.5" dir="rtl">
                  {columns.map((col, idx) => {
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
                          onClick={() => setConfiguringCol({ col, idx })}
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

      {/* Column config popup */}
      {configuringCol && (
        <ColumnConfigDialog
          col={configuringCol.col}
          scheduleColumns={scheduleColumns}
          taskQualifications={localTaskQuals}
          populations={populations}
          workerRoles={workerRoles}
          onSave={saveColConfig}
          onClose={() => setConfiguringCol(null)}
        />
      )}
    </>
  );
}
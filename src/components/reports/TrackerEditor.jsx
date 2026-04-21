import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const COLUMN_TYPES = [
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "schedule_col", label: "סיכום שעות לפי טקסט" },
  { value: "count_by_text", label: "סיכום פעמים לפי טקסט" },
  { value: "count_by_task", label: "ספירה לפי משימה" },
  { value: "count_quantitative", label: "ספירה כמותית" },
];

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, allTemplates, scheduleColumns = [] }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [quantitativePresets, setQuantitativePresets] = useState([]);

  useEffect(() => {
    base44.entities.AppSettings.filter({ setting_key: "quantitative_presets" }).then(res => {
      if (res.length > 0) setQuantitativePresets(JSON.parse(res[0].setting_value) || []);
    });
  }, []);

  useEffect(() => {
    if (tracker) {
      setName(tracker.name || "");
      setColumns(tracker.columns || []);
    } else {
      setName("");
      setColumns([]);
    }
  }, [tracker, open]);

  const addColumn = () => {
    setColumns([...columns, { id: Date.now().toString(), name: "", type: "shifts_count", schedule_col_name: "", schedule_col_value: "", combined_filters: {}, combined_operation: "sum_hours" }]);
  };

  const updateColumn = (idx, field, value) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: value };
    setColumns(updated);
  };

  const removeColumn = (idx) => {
    setColumns(columns.filter((_, i) => i !== idx));
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
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="לדוגמה: מעקב שעות חודשי" dir="rtl" className="mt-1" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label dir="rtl">עמודות</Label>
              <Button size="sm" variant="outline" onClick={addColumn} dir="rtl">
                <Plus className="w-4 h-4 mr-1" />הוסף עמודה
              </Button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={col.id} className="flex gap-2 items-start p-2 border rounded-lg bg-gray-50">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs" dir="rtl">שם העמודה</Label>
                      <Input
                        value={col.name}
                        onChange={e => updateColumn(idx, "name", e.target.value)}
                        placeholder="שם..."
                        dir="rtl"
                        className="h-8 mt-0.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs" dir="rtl">סוג</Label>
                      <Select value={col.type} onValueChange={v => updateColumn(idx, "type", v)}>
                        <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {COLUMN_TYPES.map(ct => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(col.type === "schedule_col" || col.type === "count_by_text") && (() => {
                    const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                    const opts = [...(sc?.options || []), ...(sc?.sub_options?.map(so => so.name) || [])];
                    return (
                      <div className="col-span-2 space-y-2">
                        <div>
                          <Label className="text-xs" dir="rtl">עמודת לוח</Label>
                          <Select value={col.schedule_col_name || ""} onValueChange={v => updateColumn(idx, "schedule_col_name", v)}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                            <SelectContent dir="rtl">
                              {scheduleColumns.map(sc => <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {opts.length > 0 && (
                          <div>
                            <Label className="text-xs" dir="rtl">ערך ספציפי (אופציונלי)</Label>
                            <Select value={col.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "schedule_col_value", v)}>
                              <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="כל ערך" /></SelectTrigger>
                              <SelectContent dir="rtl">
                                <SelectItem value={null}>כל ערך</SelectItem>
                                {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                    })()}
                    {col.type === "count_by_task" && (
                    <div className="col-span-2 space-y-2">
                      <div>
                        <Label className="text-xs" dir="rtl">בחר משימות</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {allTemplates.flatMap(t => (t.columns || []).filter(c => c.type === "select" && c.name === "משימה").flatMap(c => c.options || [])).filter((v, i, a) => a.indexOf(v) === i).map(task => (
                            <button
                              key={task}
                              type="button"
                              onClick={() => {
                                const tasks = col.task_list || [];
                                const updated = tasks.includes(task) ? tasks.filter(t => t !== task) : [...tasks, task];
                                updateColumn(idx, "task_list", updated);
                              }}
                              className={`px-2 py-1 rounded text-xs border transition-colors ${
                                (col.task_list || []).includes(task)
                                  ? "bg-blue-600 border-blue-600 text-white font-semibold"
                                  : "bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-400"
                              }`}
                            >
                              {task}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    )}
                    {col.type === "count_quantitative" && (
                      <div className="col-span-2 space-y-2">
                        <div>
                          <Label className="text-xs" dir="rtl">עמודת לוח לספירה</Label>
                          <Select
                            value={col.schedule_col_name || ""}
                            onValueChange={v => {
                              const sc = scheduleColumns.find(c => c.name === v);
                              const autoOpts = sc?.quantitative_items || [];
                              const next = [...columns];
                              next[idx] = { ...next[idx], schedule_col_name: v, quantitative_options: autoOpts, quantitative_single_item: "" };
                              setColumns(next);
                            }}
                          >
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                            <SelectContent dir="rtl">
                              {scheduleColumns.filter(sc => sc.report_type === "count_quantitative").map(sc => <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {(() => {
                          const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                          const availableItems = sc?.quantitative_items || col.quantitative_options || [];
                          if (availableItems.length === 0) return null;
                          const singleItem = col.quantitative_single_item || "";
                          return (
                            <div>
                              <Label className="text-xs" dir="rtl">פריט לספירה (בחר אחד)</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {availableItems.map(item => (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => updateColumn(idx, "quantitative_single_item", singleItem === item ? "" : item)}
                                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                                      singleItem === item
                                        ? "bg-blue-600 border-blue-600 text-white font-semibold"
                                        : "bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-400"
                                    }`}
                                  >
                                    {item}
                                  </button>
                                ))}
                              </div>
                              {!singleItem && <p className="text-xs text-gray-400 mt-1">אם לא נבחר פריט — יוצגו כל הפריטים בשורות נפרדות</p>}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 mt-5" onClick={() => removeColumn(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {columns.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4" dir="rtl">אין עמודות עדיין - לחץ "הוסף עמודה"</p>
              )}
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
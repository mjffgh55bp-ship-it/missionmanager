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
  { value: "schedule_col", label: "עמודת לוח — שעות" },
  { value: "status_count", label: "ספירת סטטוס" },
  { value: "combined_data", label: "נתונים משולבים" },
  { value: "count_quantitative", label: "ספירה כמותית" },
  { value: "sum_quantitative", label: "סכום ספירה כמותית" },
];

const COMBINED_OPS = [
  { value: "sum_hours", label: "סהכו שעות" },
  { value: "count_shifts", label: "מספר משמרות" },
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
                    {col.type === "status_count" && (() => {
                      const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                      const opts = [...(sc?.options || []), ...(sc?.sub_options?.map(so => so.name) || [])];
                      return (
                        <div className="col-span-2 space-y-2">
                          <div>
                            <Label className="text-xs" dir="rtl">עמודת לוח (עם סטטוסים)</Label>
                            <Select value={col.schedule_col_name || ""} onValueChange={v => updateColumn(idx, "schedule_col_name", v)}>
                              <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                              <SelectContent dir="rtl">
                                {scheduleColumns.map(sc => (
                                  <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {opts.length > 0 && (
                            <div>
                              <Label className="text-xs" dir="rtl">סטטוס לספירה</Label>
                              <Select value={col.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "schedule_col_value", v)}>
                                <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר סטטוס..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                  {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {col.type === "schedule_col" && (
                      <div className="col-span-2 space-y-2">
                        <div>
                          <Label className="text-xs" dir="rtl">שדה לוח (עמודה)</Label>
                          <Select value={col.schedule_col_name || ""} onValueChange={v => updateColumn(idx, "schedule_col_name", v)}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                            <SelectContent dir="rtl">
                              {scheduleColumns.map(sc => (
                                <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {col.schedule_col_name && (() => {
                          const sc = scheduleColumns.find(c => c.name === col.schedule_col_name);
                          const opts = [...(sc?.options || []), ...(sc?.sub_options?.map(so => so.name) || [])];
                          return opts.length > 0 ? (
                            <div>
                              <Label className="text-xs" dir="rtl">סנן לפי ערך (אופציונאלי)</Label>
                              <Select value={col.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "schedule_col_value", v)}>
                                <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="כל ערך" /></SelectTrigger>
                                <SelectContent dir="rtl">
                                  <SelectItem value={null}>כל ערך</SelectItem>
                                  {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                    {col.type === "combined_data" && (
                      <div className="col-span-2 space-y-2">
                        <div>
                          <Label className="text-xs" dir="rtl">שדה לוח</Label>
                          <Select value={col.combined_filters?.schedule_col_name || ""} onValueChange={v => updateColumn(idx, "combined_filters", { ...col.combined_filters, schedule_col_name: v })}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר..." /></SelectTrigger>
                            <SelectContent dir="rtl">
                              {scheduleColumns.map(sc => (
                                <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {col.combined_filters?.schedule_col_name && (() => {
                          const sc = scheduleColumns.find(c => c.name === col.combined_filters.schedule_col_name);
                          const opts = [...(sc?.options || []), ...(sc?.sub_options?.map(so => so.name) || [])];
                          return opts.length > 0 ? (
                            <div>
                              <Label className="text-xs" dir="rtl">ערך בעמודה</Label>
                              <Select value={col.combined_filters?.schedule_col_value || ""} onValueChange={v => updateColumn(idx, "combined_filters", { ...col.combined_filters, schedule_col_value: v })}>
                                <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר" /></SelectTrigger>
                                <SelectContent dir="rtl">
                                  {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null;
                        })()}
                        <div>
                          <Label className="text-xs" dir="rtl">תפקיד (אופציונאלי)</Label>
                          <Select value={col.combined_filters?.role || ""} onValueChange={v => updateColumn(idx, "combined_filters", { ...col.combined_filters, role: v })}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר" /></SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value={null}>בחירה חטיבה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs" dir="rtl">משימה (אופציונאלי)</Label>
                          <Select value={col.combined_filters?.task || ""} onValueChange={v => updateColumn(idx, "combined_filters", { ...col.combined_filters, task: v })}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר" /></SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value={null}>בחירה חטיבה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs" dir="rtl">חישוב</Label>
                          <Select value={col.combined_operation || "sum_hours"} onValueChange={v => updateColumn(idx, "combined_operation", v)}>
                            <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="sum_hours">סהכו שעות</SelectItem>
                              <SelectItem value="count_shifts">מספר משמרות</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {col.type === "sum_quantitative" && (() => {
                      const quantCols = columns.filter(c => c.type === "count_quantitative");
                      const selectedSourceColId = col.source_quantitative_col_id || "";
                      const sourceCol = quantCols.find(c => c.id === selectedSourceColId);
                      const availableItems = sourceCol?.quantitative_options?.filter(Boolean) || [];
                      return (
                        <div className="col-span-2 space-y-2">
                          <div>
                            <Label className="text-xs" dir="rtl">עמודת ספירה כמותית</Label>
                            <Select value={selectedSourceColId} onValueChange={v => updateColumn(idx, "source_quantitative_col_id", v)}>
                              <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                              <SelectContent dir="rtl">
                                {quantCols.map(qc => <SelectItem key={qc.id} value={qc.id}>{qc.name || "ללא שם"}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs" dir="rtl">פריט לסכום</Label>
                            {availableItems.length > 0 ? (
                              <Select value={col.quantitative_item || ""} onValueChange={v => updateColumn(idx, "quantitative_item", v)}>
                                <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl"><SelectValue placeholder="בחר פריט..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                  {availableItems.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-xs text-gray-400 mt-1" dir="rtl">
                                {selectedSourceColId ? "לעמודה הנבחרת אין פריטים מוגדרים" : "יש לבחור עמודת ספירה כמותית תחילה"}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {col.type === "count_quantitative" && (
                      <div className="col-span-2 space-y-2">
                        <Label className="text-xs" dir="rtl">אפשרויות (פריטים)</Label>
                        {quantitativePresets.length > 0 && (
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-gray-500">טען מרשימה:</span>
                            <Select onValueChange={v => {
                              const preset = quantitativePresets.find(p => p.name === v);
                              if (preset) updateColumn(idx, "quantitative_options", [...(preset.items || [])]);
                            }}>
                              <SelectTrigger className="h-7 text-xs flex-1" dir="rtl"><SelectValue placeholder="טען רשימה מוגדרת מראש..." /></SelectTrigger>
                              <SelectContent dir="rtl">
                                {quantitativePresets.map(p => <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          {(col.quantitative_options || []).map((opt, oi) => (
                            <div key={oi} className="flex gap-1 items-center">
                              <Input
                                value={opt}
                                onChange={e => {
                                  const opts = [...(col.quantitative_options || [])];
                                  opts[oi] = e.target.value;
                                  updateColumn(idx, "quantitative_options", opts);
                                }}
                                placeholder="שם פריט..."
                                dir="rtl"
                                className="h-7 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = (col.quantitative_options || []).filter((_, i) => i !== oi);
                                  updateColumn(idx, "quantitative_options", opts);
                                }}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs w-full"
                            onClick={() => updateColumn(idx, "quantitative_options", [...(col.quantitative_options || []), ""])}
                            dir="rtl"
                          >
                            <Plus className="w-3 h-3 ml-1" />הוסף פריט
                          </Button>
                        </div>
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
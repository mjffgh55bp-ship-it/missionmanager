import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const CHART_TYPES = [
  { value: "bar", label: "עמודות (Bar)" },
  { value: "line", label: "קו (Line)" },
  { value: "pie", label: "עוגה (Pie)" },
];

const DATA_SOURCES = [
  { value: "shifts_per_worker", label: "מספר משמרות לעובד" },
  { value: "hours_per_worker", label: "שעות לעובד" },
  { value: "schedule_col_values", label: "עמודת לוח — ספירת ערכים" },
  { value: "quantitative_col", label: "ספירה כמותית מטבלת מעקב" },
];

const DATE_MODES = [
  { value: "all", label: "כל הזמן" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "half_year", label: "חצי שנה" },
  { value: "custom", label: "מותאם" },
];

const COLORS = ["#1e3a5f", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#ca8a04"];

export default function ChartBuilder({ open, onOpenChange, chart, onSaved, scheduleColumns, trackers, workers, populations, workerRoles }) {
  const [form, setForm] = useState({
    title: "", chart_type: "bar", data_source: "shifts_per_worker",
    schedule_col_name: "", tracker_id: "", quantitative_col_id: "",
    date_mode: "month", date_start: "", date_end: "",
    filter_populations: [], filter_roles: [], color: "#1e3a5f",
  });
  const [saving, setSaving] = useState(false);

  const [selectedTracker, setSelectedTracker] = useState(null);

  useEffect(() => {
    if (chart) {
      setForm({ ...chart });
    } else {
      setForm({
        title: "", chart_type: "bar", data_source: "shifts_per_worker",
        schedule_col_name: "", tracker_id: "", quantitative_col_id: "",
        date_mode: "month", date_start: "", date_end: "",
        filter_populations: [], filter_roles: [], color: "#1e3a5f",
      });
    }
  }, [chart, open]);

  useEffect(() => {
    if (form.tracker_id) {
      setSelectedTracker(trackers.find(t => t.id === form.tracker_id) || null);
    }
  }, [form.tracker_id, trackers]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleArr = (field, val) => {
    const arr = form[field] || [];
    set(field, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    let saved;
    if (chart?.id) {
      saved = await base44.entities.ChartWidget.update(chart.id, form);
    } else {
      saved = await base44.entities.ChartWidget.create({ ...form, order: Date.now() });
    }
    setSaving(false);
    onSaved(saved);
    onOpenChange(false);
  };

  const quantCols = (selectedTracker?.columns || []).filter(c => c.type === "count_quantitative");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle dir="rtl">{chart ? "ערוך גרף" : "בנה גרף חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">כותרת הגרף</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="לדוגמה: שעות לעובד החודש" dir="rtl" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">סוג גרף</Label>
              <Select value={form.chart_type} onValueChange={v => set("chart_type", v)}>
                <SelectTrigger className="mt-1" dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {CHART_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">מקור נתונים</Label>
              <Select value={form.data_source} onValueChange={v => set("data_source", v)}>
                <SelectTrigger className="mt-1" dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {DATA_SOURCES.map(ds => <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.data_source === "schedule_col_values" && (
            <div>
              <Label className="text-sm">עמודת לוח</Label>
              <Select value={form.schedule_col_name} onValueChange={v => set("schedule_col_name", v)}>
                <SelectTrigger className="mt-1" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                <SelectContent dir="rtl">
                  {scheduleColumns.map(sc => <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.data_source === "quantitative_col" && (
            <div className="space-y-2">
              <div>
                <Label className="text-sm">טבלת מעקב</Label>
                <Select value={form.tracker_id} onValueChange={v => set("tracker_id", v)}>
                  <SelectTrigger className="mt-1" dir="rtl"><SelectValue placeholder="בחר טבלה..." /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {trackers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {quantCols.length > 0 && (
                <div>
                  <Label className="text-sm">עמודה כמותית</Label>
                  <Select value={form.quantitative_col_id} onValueChange={v => set("quantitative_col_id", v)}>
                    <SelectTrigger className="mt-1" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {quantCols.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-sm">תקופת זמן</Label>
            <Select value={form.date_mode} onValueChange={v => set("date_mode", v)}>
              <SelectTrigger className="mt-1" dir="rtl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                {DATE_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.date_mode === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><Label className="text-xs">מ-</Label><Input type="date" value={form.date_start} onChange={e => set("date_start", e.target.value)} className="h-8" /></div>
                <div><Label className="text-xs">עד</Label><Input type="date" value={form.date_end} onChange={e => set("date_end", e.target.value)} className="h-8" /></div>
              </div>
            )}
          </div>

          {populations.length > 0 && (
            <div>
              <Label className="text-sm">סנן לפי אוכלוסייה</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {populations.map(p => (
                  <button key={p} type="button" onClick={() => toggleArr("filter_populations", p)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_populations || []).includes(p) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {workerRoles.length > 0 && (
            <div>
              <Label className="text-sm">סנן לפי תפקיד</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {workerRoles.map(r => (
                  <button key={r} type="button" onClick={() => toggleArr("filter_roles", r)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_roles || []).includes(r) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm">צבע</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="bg-blue-900 hover:bg-blue-800">
            {saving ? "שומר..." : "שמור גרף"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
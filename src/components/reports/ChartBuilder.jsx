import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

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
  { value: "tracker_col", label: "עמודה מטבלת מעקב — לפי עובד" },
];

const DATE_MODES = [
  { value: "all", label: "כל הזמן" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "half_year", label: "חצי שנה" },
  { value: "custom", label: "מותאם" },
];

const COLORS = ["#1e3a5f", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#ca8a04"];
const COLORS_PALETTE = ["#1e3a5f", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#ca8a04", "#059669", "#7c3aed"];

const getDateRange = (mode, startDate, endDate) => {
  const today = new Date();
  if (mode === "week") return { start: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"), end: format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd") };
  if (mode === "month") return { start: format(startOfMonth(today), "yyyy-MM-dd"), end: format(endOfMonth(today), "yyyy-MM-dd") };
  if (mode === "half_year") { const s = new Date(today); s.setMonth(s.getMonth() - 6); return { start: format(s, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") }; }
  if (mode === "custom" && startDate && endDate) return { start: startDate, end: endDate };
  return null;
};

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

export function computeChartData(chart, workers, assignments, templateRows, allTemplates, trackers, trackerEntries) {
  const dateRange = getDateRange(chart.date_mode, chart.date_start, chart.date_end);

  const filterWorker = (w) => {
    if (!w.active) return false;
    if ((chart.filter_populations || []).length > 0 && !chart.filter_populations.includes(w.population)) return false;
    if ((chart.filter_roles || []).length > 0) {
      const wRoles = Array.isArray(w.role) ? w.role : [w.role];
      if (!wRoles.some(r => chart.filter_roles.includes(r))) return false;
    }
    return true;
  };

  const filteredWorkers = workers.filter(filterWorker);

  const filterByDate = (item) => {
    if (dateRange && (item.date < dateRange.start || item.date > dateRange.end)) return false;
    return true;
  };

  if (chart.data_source === "shifts_per_worker") {
    return filteredWorkers.map(w => {
      const count = assignments.filter(a => filterByDate(a) && (a.chef_id === w.id || a.sous_chef_id === w.id || a.additional_chef_id === w.id)).length;
      return { name: w.nickname, value: count };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }

  if (chart.data_source === "hours_per_worker") {
    return filteredWorkers.map(w => {
      let total = 0;
      assignments.filter(a => filterByDate(a) && (a.chef_id === w.id || a.sous_chef_id === w.id || a.additional_chef_id === w.id))
        .forEach(a => { total += a.hours || 0; });
      templateRows.filter(row => {
        if (!filterByDate(row)) return false;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return false;
        return (tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === w.id);
      }).forEach(row => {
        total += calcHours(row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "", row.values?.["סיום"] || row.values?.["שעת סיום"] || "");
      });
      return { name: w.nickname, value: Math.round(total * 10) / 10 };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }

  if (chart.data_source === "schedule_col_values" && chart.schedule_col_name) {
    const counts = {};
    templateRows.filter(filterByDate).forEach(row => {
      const val = row.values?.[chart.schedule_col_name];
      if (val) counts[val] = (counts[val] || 0) + 1;
      const subTypes = row.values?.[`${chart.schedule_col_name}_subTypes`] || [];
      subTypes.forEach(st => { counts[st] = (counts[st] || 0) + 1; });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }

  if (chart.data_source === "quantitative_col" && chart.tracker_id && chart.quantitative_col_id) {
    const tracker = trackers.find(t => t.id === chart.tracker_id);
    const col = (tracker?.columns || []).find(c => c.id === chart.quantitative_col_id);
    if (!col) return [];
    const opts = col.quantitative_options || [];
    const totals = {};
    opts.forEach(o => { totals[o] = 0; });
    (trackerEntries || []).filter(e => e.tracker_id === chart.tracker_id && e.column_id === chart.quantitative_col_id).forEach(e => {
      try {
        const vals = JSON.parse(e.value || "{}");
        opts.forEach(o => { totals[o] = (totals[o] || 0) + (vals[o] || 0); });
      } catch {}
    });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }

  if (chart.data_source === "tracker_col" && chart.tracker_id && chart.tracker_col_id) {
    return filteredWorkers.map(w => {
      const entry = (trackerEntries || []).find(e => e.tracker_id === chart.tracker_id && e.column_id === chart.tracker_col_id && e.worker_id === w.id);
      const raw = entry?.value || "";
      let val = 0;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          val = Object.values(parsed).reduce((s, v) => s + (Number(v) || 0), 0);
        } else {
          val = Number(parsed) || 0;
        }
      } catch {
        val = Number(raw) || 0;
      }
      return { name: w.nickname, value: val };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }

  return [];
}

function LiveChartPreview({ form, workers, assignments, templateRows, allTemplates, trackers, trackerEntries }) {
  const data = useMemo(() =>
    computeChartData(form, workers, assignments, templateRows, allTemplates, trackers, trackerEntries),
    [form, workers, assignments, templateRows, allTemplates, trackers, trackerEntries]
  );

  const color = form.color || "#1e3a5f";
  const xKey = form.x_axis_key || "name";
  const yKey = form.y_axis_key || "value";

  if (!form.title && !form.data_source) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">מלא את הפרטים לצד שמאל לצפייה בתצוגה מקדימה</div>;
  }

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">אין נתונים להצגה בתצורה זו</div>;
  }

  // Rename keys if custom axis selected
  const chartData = data.map(d => ({
    ...d,
    [xKey]: d.name,
    [yKey]: d.value,
  }));

  if (form.chart_type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={chartData} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={110} label={({ name, value }) => `${name}: ${value}`}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS_PALETTE[i % COLORS_PALETTE.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (form.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} angle={-35} textAnchor="end" tick={{ fontSize: 11 }} label={{ value: form.x_axis_label || "", position: "insideBottom", offset: -40, fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: form.y_axis_label || "", angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} angle={-35} textAnchor="end" tick={{ fontSize: 11 }} label={{ value: form.x_axis_label || "", position: "insideBottom", offset: -40, fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} label={{ value: form.y_axis_label || "", angle: -90, position: "insideLeft", fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ChartBuilder({ open, onOpenChange, chart, onSaved, scheduleColumns, trackers, workers, populations, workerRoles, assignments, templateRows, allTemplates, trackerEntries }) {
  const [form, setForm] = useState({
    title: "", chart_type: "bar", data_source: "shifts_per_worker",
    schedule_col_name: "", tracker_id: "", quantitative_col_id: "", tracker_col_id: "",
    date_mode: "month", date_start: "", date_end: "",
    filter_populations: [], filter_roles: [], color: "#1e3a5f",
    x_axis_label: "", y_axis_label: "",
  });
  const [saving, setSaving] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState(null);

  useEffect(() => {
    if (chart) {
      setForm({ x_axis_label: "", y_axis_label: "", ...chart });
    } else {
      setForm({
        title: "", chart_type: "bar", data_source: "shifts_per_worker",
        schedule_col_name: "", tracker_id: "", quantitative_col_id: "", tracker_col_id: "",
        date_mode: "month", date_start: "", date_end: "",
        filter_populations: [], filter_roles: [], color: "#1e3a5f",
        x_axis_label: "", y_axis_label: "",
      });
    }
  }, [chart, open]);

  useEffect(() => {
    if (form.tracker_id) setSelectedTracker(trackers.find(t => t.id === form.tracker_id) || null);
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
  const allTrackerCols = (selectedTracker?.columns || []);
  const hasAxes = form.chart_type === "bar" || form.chart_type === "line";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle dir="rtl">{chart ? "ערוך גרף" : "בנה גרף חדש"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Form - left side */}
          <div className="w-80 flex-shrink-0 border-l overflow-y-auto p-4 space-y-4">
            <div>
              <Label className="text-sm">כותרת הגרף</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="לדוגמה: שעות לעובד החודש" dir="rtl" className="mt-1" />
            </div>

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

            {(form.data_source === "quantitative_col" || form.data_source === "tracker_col") && (
              <div className="space-y-2">
                <div>
                  <Label className="text-sm">טבלת מעקב</Label>
                  <Select value={form.tracker_id} onValueChange={v => { set("tracker_id", v); set("quantitative_col_id", ""); set("tracker_col_id", ""); }}>
                    <SelectTrigger className="mt-1" dir="rtl"><SelectValue placeholder="בחר טבלה..." /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {trackers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.data_source === "quantitative_col" && quantCols.length > 0 && (
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
                {form.data_source === "tracker_col" && allTrackerCols.length > 0 && (
                  <div>
                    <Label className="text-sm">עמודה</Label>
                    <Select value={form.tracker_col_id} onValueChange={v => set("tracker_col_id", v)}>
                      <SelectTrigger className="mt-1" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                      <SelectContent dir="rtl">
                        {allTrackerCols.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Axis labels for bar/line */}
            {hasAxes && (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-800">תוויות צירים</p>
                <div>
                  <Label className="text-xs text-gray-600">תווית ציר X (אופקי)</Label>
                  <Input value={form.x_axis_label} onChange={e => set("x_axis_label", e.target.value)} placeholder="לדוגמה: שם עובד" dir="rtl" className="mt-1 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">תווית ציר Y (אנכי)</Label>
                  <Input value={form.y_axis_label} onChange={e => set("y_axis_label", e.target.value)} placeholder="לדוגמה: מספר שעות" dir="rtl" className="mt-1 h-7 text-xs" />
                </div>
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

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">ביטול</Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 bg-blue-900 hover:bg-blue-800">
                {saving ? "שומר..." : "שמור גרף"}
              </Button>
            </div>
          </div>

          {/* Live Preview - right side */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="bg-white rounded-xl shadow-sm border p-4 h-full min-h-[350px]">
              <h3 className="text-base font-semibold text-gray-800 mb-1 text-center">{form.title || "תצוגה מקדימה"}</h3>
              <p className="text-xs text-gray-400 text-center mb-4">מתעדכן בזמן אמת</p>
              <LiveChartPreview
                form={form}
                workers={workers || []}
                assignments={assignments || []}
                templateRows={templateRows || []}
                allTemplates={allTemplates || []}
                trackers={trackers || []}
                trackerEntries={trackerEntries || []}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
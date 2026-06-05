import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { computeChartSeries, DATE_MODES, COLORS_PALETTE } from "@/lib/chartEngine";
import ChartRenderer from "./ChartRenderer";
import { Plus, Trash2 } from "lucide-react";

const CHART_TYPES = [
  { value: "bar", label: "עמודות" },
  { value: "horizontal_bar", label: "עמודות אופקיות" },
  { value: "line", label: "קו" },
  { value: "area", label: "שטח" },
  { value: "pie", label: "עוגה" },
];

const GROUP_BY_OPTIONS = [
  { value: "worker", label: "לפי עובד" },
  { value: "time", label: "לאורך זמן" },
  { value: "category", label: "לפי קטגוריה" },
];

const TIME_BUCKET_OPTIONS = [
  { value: "day", label: "יום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
];

const SORT_OPTIONS = [
  { value: "value_desc", label: "מהגבוה לנמוך" },
  { value: "value_asc", label: "מהנמוך לגבוה" },
  { value: "name", label: "לפי שם" },
  { value: "none", label: "ללא מיון" },
];

const METRIC_SOURCES = [
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "hours", label: "שעות" },
  { value: "schedule_col_value", label: "עמודת לוח — ספירת ערכים" },
  { value: "tracker_quantitative", label: "ספירה כמותית (מעקב)" },
  { value: "tracker_column", label: "עמודת מעקב (לפי עובד)" },
  { value: "task_count", label: "ספירת משימות/הסמכות" },
];

const DEFAULT_METRIC = () => ({
  id: `m${Date.now()}`,
  label: "מדד",
  source: "shifts_count",
  color: COLORS_PALETTE[0],
  schedule_col_name: "",
  schedule_col_value: "",
  tracker_id: "",
  tracker_col_id: "",
  quantitative_item: "",
  task_ids: [],
});

const DEFAULT_FORM = {
  title: "",
  chart_type: "bar",
  group_by: "worker",
  time_bucket: "week",
  metrics: [{ ...DEFAULT_METRIC(), label: "מדד 1", color: COLORS_PALETTE[0] }],
  date_mode: "month",
  date_start: "",
  date_end: "",
  filter_worker_ids: [],
  filter_roles: [],
  filter_populations: [],
  sort_mode: "value_desc",
  top_n: 0,
};

export default function ChartBuilder({
  open, onOpenChange, chart, onSaved,
  scheduleColumns, trackers, workers, populations, workerRoles,
  assignments, templateRows, allTemplates, trackerEntries,
  workerQualifications, qualifications,
  roleObjects, populationObjects,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [workerSearch, setWorkerSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    if (chart) {
      // Migrate legacy format
      const normalized = {
        ...DEFAULT_FORM,
        ...chart,
        metrics: (chart.metrics && chart.metrics.length > 0)
          ? chart.metrics
          : [{ ...DEFAULT_METRIC(), label: "מדד 1" }],
        filter_worker_ids: chart.filter_worker_ids || [],
        group_by: chart.group_by || "worker",
        time_bucket: chart.time_bucket || "week",
        sort_mode: chart.sort_mode || "value_desc",
        top_n: chart.top_n || 0,
      };
      setForm(normalized);
    } else {
      setForm({ ...DEFAULT_FORM, metrics: [{ ...DEFAULT_METRIC(), label: "מדד 1", color: COLORS_PALETTE[0] }] });
    }
  }, [chart, open]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const setMetric = (idx, field, value) => {
    setForm(f => {
      const metrics = [...f.metrics];
      metrics[idx] = { ...metrics[idx], [field]: value };
      return { ...f, metrics };
    });
  };

  const addMetric = () => {
    if (form.metrics.length >= 2) return;
    setForm(f => ({
      ...f,
      metrics: [...f.metrics, {
        ...DEFAULT_METRIC(),
        label: `מדד ${f.metrics.length + 1}`,
        color: COLORS_PALETTE[f.metrics.length % COLORS_PALETTE.length],
      }],
    }));
  };

  const removeMetric = (idx) => {
    setForm(f => ({ ...f, metrics: f.metrics.filter((_, i) => i !== idx) }));
  };

  const toggleWorker = (id) => {
    const arr = form.filter_worker_ids || [];
    set("filter_worker_ids", arr.includes(id) ? arr.filter(v => v !== id) : [...arr, id]);
  };

  const toggleRoleId = (id) => {
    const arr = form.filter_roles || [];
    set("filter_roles", arr.includes(id) ? arr.filter(v => v !== id) : [...arr, id]);
  };

  const togglePopId = (id) => {
    const arr = form.filter_populations || [];
    set("filter_populations", arr.includes(id) ? arr.filter(v => v !== id) : [...arr, id]);
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

  // Live preview data
  const series = useMemo(() => computeChartSeries(form, {
    workers: workers || [],
    assignments: assignments || [],
    templateRows: templateRows || [],
    allTemplates: allTemplates || [],
    trackers: trackers || [],
    trackerEntries: trackerEntries || [],
    workerQualifications: workerQualifications || [],
    qualifications: qualifications || [],
    roleObjects: roleObjects || [],
    populationObjects: populationObjects || [],
  }), [form, workers, assignments, templateRows, allTemplates, trackers, trackerEntries, workerQualifications, qualifications, roleObjects, populationObjects]);

  const activeWorkers = (workers || []).filter(w => w.active);
  const filteredWorkerList = workerSearch
    ? activeWorkers.filter(w => w.nickname?.toLowerCase().includes(workerSearch.toLowerCase()))
    : activeWorkers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle dir="rtl">{chart ? "ערוך גרף" : "בנה גרף חדש"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ── Controls ── */}
          <div className="w-80 flex-shrink-0 border-l overflow-y-auto p-4 space-y-4">

            {/* 1. Basics */}
            <section className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">בסיסי</p>
              <div>
                <Label className="text-sm">כותרת</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="לדוגמה: שעות לעובד" dir="rtl" className="mt-1" />
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
            </section>

            {/* 2. Dimension */}
            <section className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">ציר X (ממד)</p>
              <div>
                <Select value={form.group_by} onValueChange={v => set("group_by", v)}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {GROUP_BY_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.group_by === "time" && (
                <div>
                  <Label className="text-sm">גרנולריות זמן</Label>
                  <Select value={form.time_bucket} onValueChange={v => set("time_bucket", v)}>
                    <SelectTrigger className="mt-1" dir="rtl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {TIME_BUCKET_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>

            {/* 3. Metrics */}
            <section className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">מדדים</p>
              {form.chart_type === "pie" && form.metrics.length > 1 && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">גרף עוגה מציג מדד אחד בלבד</p>
              )}
              {(form.chart_type === "pie" ? form.metrics.slice(0, 1) : form.metrics).map((metric, idx) => (
                <MetricEditor
                  key={metric.id}
                  metric={metric}
                  idx={idx}
                  canRemove={form.metrics.length > 1}
                  onChange={(field, val) => setMetric(idx, field, val)}
                  onRemove={() => removeMetric(idx)}
                  groupBy={form.group_by}
                  scheduleColumns={scheduleColumns}
                  trackers={trackers}
                  qualifications={qualifications}
                />
              ))}
              {form.chart_type !== "pie" && form.metrics.length < 2 && (
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMetric}>
                  <Plus className="w-3 h-3 ml-1" />הוסף מדד שני
                </Button>
              )}
            </section>

            {/* 4. Filters */}
            <section className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">סינון</p>

              {/* Date range */}
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

              {/* Workers */}
              {form.group_by === "worker" && (
                <div>
                  <Label className="text-sm">בחר עובדים ספציפיים</Label>
                  <Input
                    placeholder="חפש עובד..."
                    value={workerSearch}
                    onChange={e => setWorkerSearch(e.target.value)}
                    className="mt-1 h-7 text-xs"
                    dir="rtl"
                  />
                  <div className="max-h-28 overflow-y-auto border rounded mt-1 p-1 space-y-0.5">
                    {filteredWorkerList.map(w => (
                      <label key={w.id} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={(form.filter_worker_ids || []).includes(w.id)}
                          onChange={() => toggleWorker(w.id)}
                          className="w-3 h-3"
                        />
                        {w.nickname}
                      </label>
                    ))}
                  </div>
                  {(form.filter_worker_ids || []).length > 0 && (
                    <button className="text-xs text-blue-600 mt-0.5" onClick={() => set("filter_worker_ids", [])}>
                      נקה בחירה ({form.filter_worker_ids.length})
                    </button>
                  )}
                </div>
              )}

              {/* Populations */}
              {(populationObjects || populations || []).length > 0 && (
                <div>
                  <Label className="text-sm">סנן לפי אוכלוסייה</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(populationObjects || []).length > 0
                      ? (populationObjects || []).map(p => {
                          const id = p.mapping_id || p.name;
                          return (
                            <button key={id} type="button" onClick={() => togglePopId(id)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_populations || []).includes(id) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                              {p.name}
                            </button>
                          );
                        })
                      : (populations || []).map(p => {
                          const name = typeof p === "string" ? p : p.name;
                          return (
                            <button key={name} type="button" onClick={() => togglePopId(name)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_populations || []).includes(name) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                              {name}
                            </button>
                          );
                        })
                    }
                  </div>
                </div>
              )}

              {/* Roles */}
              {(roleObjects || workerRoles || []).length > 0 && (
                <div>
                  <Label className="text-sm">סנן לפי תפקיד</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(roleObjects || []).length > 0
                      ? (roleObjects || []).map(r => {
                          const id = r.mapping_id || r.name;
                          return (
                            <button key={id} type="button" onClick={() => toggleRoleId(id)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_roles || []).includes(id) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                              {r.name}
                            </button>
                          );
                        })
                      : (workerRoles || []).map(r => {
                          const name = typeof r === "string" ? r : r.name;
                          return (
                            <button key={name} type="button" onClick={() => toggleRoleId(name)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${(form.filter_roles || []).includes(name) ? "bg-blue-900 text-white border-blue-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                              {name}
                            </button>
                          );
                        })
                    }
                  </div>
                </div>
              )}
            </section>

            {/* 5. Display */}
            <section className="space-y-3 pt-2 border-t">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">תצוגה</p>
              <div>
                <Label className="text-sm">מיון</Label>
                <Select value={form.sort_mode || "value_desc"} onValueChange={v => set("sort_mode", v)}>
                  <SelectTrigger className="mt-1" dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {SORT_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">הצג רק N מובילים (0 = הכל)</Label>
                <Input
                  type="number" min="0" max="100"
                  value={form.top_n || 0}
                  onChange={e => set("top_n", parseInt(e.target.value) || 0)}
                  className="mt-1 h-8 w-24"
                />
              </div>
            </section>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">ביטול</Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 bg-blue-900 hover:bg-blue-800">
                {saving ? "שומר..." : "שמור גרף"}
              </Button>
            </div>
          </div>

          {/* ── Live Preview ── */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="bg-white rounded-xl shadow-sm border p-4 h-full min-h-[350px]">
              <h3 className="text-base font-semibold text-gray-800 mb-1 text-center">{form.title || "תצוגה מקדימה"}</h3>
              <p className="text-xs text-gray-400 text-center mb-4">מתעדכן בזמן אמת • {series.rows.length} שורות</p>
              <ChartRenderer chart={form} series={series} height={300} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Metric editor sub-component ──────────────────────────────────────────────
function MetricEditor({ metric, idx, canRemove, onChange, onRemove, groupBy, scheduleColumns, trackers, qualifications }) {
  const selectedTracker = trackers.find(t => t.id === metric.tracker_id);
  const trackerCols = selectedTracker?.columns || [];
  const quantCols = trackerCols.filter(c => c.type === "count_quantitative");
  const selectedQuantCol = quantCols.find(c => c.id === metric.tracker_col_id);

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">מדד {idx + 1}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={metric.color || "#1e3a5f"}
            onChange={e => onChange("color", e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            title="צבע"
          />
          {canRemove && (
            <button onClick={onRemove} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div>
        <Input
          value={metric.label}
          onChange={e => onChange("label", e.target.value)}
          placeholder="תווית המדד"
          className="h-7 text-xs"
          dir="rtl"
        />
      </div>

      <div>
        <Select value={metric.source} onValueChange={v => onChange("source", v)}>
          <SelectTrigger className="h-7 text-xs" dir="rtl"><SelectValue /></SelectTrigger>
          <SelectContent dir="rtl">
            {METRIC_SOURCES.filter(s => {
              if (groupBy === "time" && (s.value === "tracker_column" || s.value === "tracker_quantitative" || s.value === "task_count")) return false;
              if (groupBy === "category" && s.value !== "schedule_col_value" && s.value !== "tracker_quantitative") return false;
              return true;
            }).map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Source-specific pickers */}
      {metric.source === "schedule_col_value" && (
        <div>
          <Select value={metric.schedule_col_name} onValueChange={v => onChange("schedule_col_name", v)}>
            <SelectTrigger className="h-7 text-xs" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
            <SelectContent dir="rtl">
              {(scheduleColumns || []).map(sc => <SelectItem key={sc.name} value={sc.name} className="text-xs">{sc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {(metric.source === "tracker_column" || metric.source === "tracker_quantitative") && (
        <>
          <Select value={metric.tracker_id} onValueChange={v => { onChange("tracker_id", v); onChange("tracker_col_id", ""); }}>
            <SelectTrigger className="h-7 text-xs" dir="rtl"><SelectValue placeholder="בחר מעקב..." /></SelectTrigger>
            <SelectContent dir="rtl">
              {(trackers || []).map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {metric.tracker_id && (
            <Select value={metric.tracker_col_id} onValueChange={v => onChange("tracker_col_id", v)}>
              <SelectTrigger className="h-7 text-xs" dir="rtl"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
              <SelectContent dir="rtl">
                {(metric.source === "tracker_quantitative" ? quantCols : trackerCols).map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {metric.source === "tracker_quantitative" && selectedQuantCol && (
            <Select value={metric.quantitative_item || ""} onValueChange={v => onChange("quantitative_item", v)}>
              <SelectTrigger className="h-7 text-xs" dir="rtl"><SelectValue placeholder="כל הפריטים..." /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={null} className="text-xs">כל הפריטים (סכום)</SelectItem>
                {(selectedQuantCol.quantitative_options || []).map(o => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      )}

      {metric.source === "task_count" && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">בחר משימות/הסמכות:</p>
          <div className="max-h-24 overflow-y-auto border rounded p-1 bg-white">
            {(qualifications || []).map(q => (
              <label key={q.id} className="flex items-center gap-1 text-xs py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(metric.task_ids || []).includes(q.id)}
                  onChange={() => {
                    const arr = metric.task_ids || [];
                    onChange("task_ids", arr.includes(q.id) ? arr.filter(v => v !== q.id) : [...arr, q.id]);
                  }}
                  className="w-3 h-3"
                />
                {q.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";

export const COLORS_PALETTE = [
  "#1e3a5f", "#16a34a", "#dc2626", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#ca8a04", "#059669", "#7c3aed"
];

export const DATE_MODES = [
  { value: "all", label: "כל הזמן" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "half_year", label: "חצי שנה" },
  { value: "half_year_start", label: "מתחילת חציון" },
  { value: "year_start", label: "מתחילת שנה" },
  { value: "custom", label: "מותאם" },
];

export function getDateRange(mode, startDate, endDate) {
  const today = new Date();
  if (mode === "week") return {
    start: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    end: format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
  };
  if (mode === "month") return {
    start: format(startOfMonth(today), "yyyy-MM-dd"),
    end: format(endOfMonth(today), "yyyy-MM-dd"),
  };
  if (mode === "half_year") {
    const s = new Date(today);
    s.setMonth(s.getMonth() - 6);
    return { start: format(s, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
  if (mode === "half_year_start") {
    const m = today.getMonth();
    const halfStart = m < 6
      ? new Date(today.getFullYear(), 0, 1)
      : new Date(today.getFullYear(), 6, 1);
    return { start: format(halfStart, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
  if (mode === "year_start") {
    return { start: format(new Date(today.getFullYear(), 0, 1), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
  if (mode === "custom" && startDate && endDate) return { start: startDate, end: endDate };
  return null;
}

export function calcHours(start, end) {
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
}

// ── Migrate legacy chart to new metrics format ──────────────────────────────
export function normalizChart(chart) {
  if (chart.metrics && chart.metrics.length > 0) return chart; // already new format

  // Legacy → synthesize a single metric
  const legacy = chart.data_source || "shifts_per_worker";
  let source = "shifts_count";
  const metric = {
    id: "m1",
    label: legacy === "hours_per_worker" ? "שעות" : legacy === "schedule_col_values" ? "ספירת ערכים" :
           legacy === "quantitative_col" ? "ספירה כמותית" : legacy === "tracker_col" ? "ערך מעקב" : "משמרות",
    source:
      legacy === "hours_per_worker" ? "hours" :
      legacy === "schedule_col_values" ? "schedule_col_value" :
      legacy === "quantitative_col" ? "tracker_quantitative" :
      legacy === "tracker_col" ? "tracker_column" : "shifts_count",
    color: chart.color || COLORS_PALETTE[0],
    schedule_col_name: chart.schedule_col_name || "",
    schedule_col_value: "",
    tracker_id: chart.tracker_id || "",
    tracker_col_id: chart.tracker_col_id || chart.quantitative_col_id || "",
    quantitative_item: "",
    task_ids: [],
  };

  return {
    ...chart,
    metrics: [metric],
    group_by: (legacy === "schedule_col_values" || legacy === "quantitative_col") ? "category" : "worker",
    time_bucket: "week",
    filter_worker_ids: [],
    sort_mode: "value_desc",
    top_n: 0,
  };
}

// ── Worker filter resolution ─────────────────────────────────────────────────
function filterWorkers(workers, chart, roleObjects, populationObjects) {
  const activeWorkers = workers.filter(w => w.active);

  // Explicit worker IDs override role/population filters
  if ((chart.filter_worker_ids || []).length > 0) {
    return activeWorkers.filter(w => chart.filter_worker_ids.includes(w.id));
  }

  const filterRoles = chart.filter_roles || [];
  const filterPops = chart.filter_populations || [];

  return activeWorkers.filter(w => {
    if (filterPops.length > 0) {
      // Try matching by mapping_id first, then by name (legacy)
      const matched = filterPops.some(fp => {
        const obj = (populationObjects || []).find(p => p.mapping_id === fp || p.name === fp);
        return obj ? (w.population === obj.name || w.population === obj.mapping_id) : w.population === fp;
      });
      if (!matched) return false;
    }
    if (filterRoles.length > 0) {
      const wRoles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      const matched = filterRoles.some(fr => {
        const obj = (roleObjects || []).find(r => r.mapping_id === fr || r.name === fr);
        return obj
          ? wRoles.some(wr => wr === obj.name || wr === obj.mapping_id)
          : wRoles.includes(fr);
      });
      if (!matched) return false;
    }
    return true;
  });
}

// ── Compute single metric value for a worker ────────────────────────────────
function computeMetricForWorker(metric, worker, { assignments, templateRows, allTemplates, trackerEntries, workerQualifications }, dateRange) {
  const inRange = (date) => !dateRange || (date >= dateRange.start && date <= dateRange.end);

  if (metric.source === "shifts_count") {
    return assignments.filter(a =>
      inRange(a.date) &&
      (a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id)
    ).length;
  }

  if (metric.source === "hours") {
    let total = 0;
    assignments
      .filter(a => inRange(a.date) && (a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id))
      .forEach(a => { total += a.hours || 0; });
    templateRows
      .filter(row => {
        if (!inRange(row.date)) return false;
        const tmpl = allTemplates.find(t => t.id === row.template_id);
        if (!tmpl) return false;
        return (tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === worker.id);
      })
      .forEach(row => {
        total += calcHours(
          row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "",
          row.values?.["סיום"] || row.values?.["שעת סיום"] || ""
        );
      });
    return Math.round(total * 10) / 10;
  }

  if (metric.source === "tracker_column") {
    const entry = (trackerEntries || []).find(e =>
      e.tracker_id === metric.tracker_id &&
      e.column_id === metric.tracker_col_id &&
      e.worker_id === worker.id
    );
    const raw = entry?.value || "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return Object.values(parsed).reduce((s, v) => s + (Number(v) || 0), 0);
      }
      return Number(parsed) || 0;
    } catch {
      return Number(raw) || 0;
    }
  }

  if (metric.source === "tracker_quantitative") {
    const entry = (trackerEntries || []).find(e =>
      e.tracker_id === metric.tracker_id &&
      e.column_id === metric.tracker_col_id &&
      e.worker_id === worker.id
    );
    const raw = entry?.value || "";
    try {
      const vals = JSON.parse(raw);
      if (metric.quantitative_item) return Number(vals[metric.quantitative_item]) || 0;
      return Object.values(vals).reduce((s, v) => s + (Number(v) || 0), 0);
    } catch {
      return 0;
    }
  }

  if (metric.source === "task_count") {
    const taskIds = metric.task_ids || [];
    if (taskIds.length === 0) return 0;
    return (workerQualifications || []).filter(wq =>
      wq.worker_id === worker.id && taskIds.includes(wq.qualification_id)
    ).length;
  }

  return 0;
}

// ── Time bucket helpers ──────────────────────────────────────────────────────
function getBucketKey(dateStr, bucket) {
  const d = new Date(dateStr + "T12:00:00");
  if (bucket === "day") return dateStr;
  if (bucket === "week") return format(startOfWeek(d, { weekStartsOn: 0 }), "yyyy-MM-dd");
  if (bucket === "month") return format(startOfMonth(d), "yyyy-MM-dd");
  return dateStr;
}

function getBucketLabel(key, bucket) {
  const d = new Date(key + "T12:00:00");
  if (bucket === "day") {
    const day = d.getDate();
    const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
    return `${day} ${months[d.getMonth()]}`;
  }
  if (bucket === "week") return `שבוע ${format(d, "d.M")}`;
  if (bucket === "month") {
    const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return key;
}

// ── Main engine ──────────────────────────────────────────────────────────────
export function computeChartSeries(chartRaw, {
  workers = [],
  assignments = [],
  templateRows = [],
  allTemplates = [],
  trackers = [],
  trackerEntries = [],
  workerQualifications = [],
  qualifications = [],
  roleObjects = [],        // [{name, mapping_id}]
  populationObjects = [],  // [{name, mapping_id}]
  scheduleColumnsById = {}, // mapping_id → {name, ...}
} = {}) {
  const chart = normalizChart(chartRaw);
  const metrics = chart.metrics || [];
  const dateRange = getDateRange(chart.date_mode, chart.date_start, chart.date_end);
  const groupBy = chart.group_by || "worker";
  const bucket = chart.time_bucket || "week";
  const dataObj = { assignments, templateRows, allTemplates, trackerEntries, workerQualifications };

  const metricKeys = metrics.map((m, i) => ({
    key: m.id || `m${i}`,
    label: m.label || `מדד ${i + 1}`,
    color: m.color || COLORS_PALETTE[i % COLORS_PALETTE.length],
  }));

  let rows = [];

  // ── group_by = worker ────────────────────────────────────────────────────
  if (groupBy === "worker") {
    const filteredWorkers = filterWorkers(workers, chart, roleObjects, populationObjects);
    rows = filteredWorkers.map(w => {
      const row = { name: w.nickname };
      metrics.forEach(m => {
        const key = m.id || `m${metrics.indexOf(m)}`;
        row[key] = computeMetricForWorker(m, w, dataObj, dateRange);
      });
      return row;
    });
  }

  // ── group_by = time ──────────────────────────────────────────────────────
  else if (groupBy === "time") {
    const filteredWorkers = filterWorkers(workers, chart, roleObjects, populationObjects);
    const workerIdSet = new Set(filteredWorkers.map(w => w.id));
    const bucketMap = new Map(); // bucketKey → { label, ...metricTotals }

    const ensureBucket = (key) => {
      if (!bucketMap.has(key)) {
        const entry = { name: getBucketLabel(key, bucket), _key: key };
        metrics.forEach(m => { entry[m.id || `m${metrics.indexOf(m)}`] = 0; });
        bucketMap.set(key, entry);
      }
      return bucketMap.get(key);
    };

    // Count assignments per bucket
    const inRange = (date) => !dateRange || (date >= dateRange.start && date <= dateRange.end);
    assignments.filter(a => inRange(a.date)).forEach(a => {
      const workerIds = [a.chef_id, a.sous_chef_id, a.additional_chef_id].filter(Boolean);
      workerIds.forEach(wid => {
        if (!workerIdSet.has(wid)) return;
        const key = getBucketKey(a.date, bucket);
        const entry = ensureBucket(key);
        metrics.forEach(m => {
          const mKey = m.id || `m${metrics.indexOf(m)}`;
          if (m.source === "shifts_count") entry[mKey] = (entry[mKey] || 0) + 1;
          if (m.source === "hours") entry[mKey] = Math.round(((entry[mKey] || 0) + (a.hours || 0)) * 10) / 10;
        });
      });
    });

    // Count template rows per bucket
    templateRows.filter(row => inRange(row.date)).forEach(row => {
      const tmpl = allTemplates.find(t => t.id === row.template_id);
      if (!tmpl) return;
      const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
      workerCols.forEach(col => {
        const wid = row.values?.[col.name];
        if (!wid || !workerIdSet.has(wid)) return;
        const key = getBucketKey(row.date, bucket);
        const entry = ensureBucket(key);
        metrics.forEach(m => {
          const mKey = m.id || `m${metrics.indexOf(m)}`;
          if (m.source === "hours") {
            const h = calcHours(
              row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "",
              row.values?.["סיום"] || row.values?.["שעת סיום"] || ""
            );
            entry[mKey] = Math.round(((entry[mKey] || 0) + h) * 10) / 10;
          }
          if (m.source === "shifts_count") {
            // Already counted in assignments above; skip template rows to avoid double-counting
            // (template rows are not assignments)
            entry[mKey] = (entry[mKey] || 0) + 1;
          }
        });
      });
    });

    rows = Array.from(bucketMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
  }

  // ── group_by = category ──────────────────────────────────────────────────
  else if (groupBy === "category") {
    const inRange = (date) => !dateRange || (date >= dateRange.start && date <= dateRange.end);
    const firstMetric = metrics[0];
    if (!firstMetric) return { rows: [], metricKeys };

    if (firstMetric.source === "schedule_col_value" && firstMetric.schedule_col_name) {
      // Resolve live column name: if a column_id is stored, use it to look up the current name
      const resolvedColName = (firstMetric.schedule_col_id && scheduleColumnsById[firstMetric.schedule_col_id]?.name)
        || firstMetric.schedule_col_name;
      const counts = {};
      templateRows.filter(row => inRange(row.date)).forEach(row => {
        // Try resolved name first, fall back to stored name for backward compat
        const val = row.values?.[resolvedColName] ?? row.values?.[firstMetric.schedule_col_name];
        if (val) counts[val] = (counts[val] || 0) + 1;
        const subTypes = row.values?.[`${resolvedColName}_subTypes`] || row.values?.[`${firstMetric.schedule_col_name}_subTypes`] || [];
        subTypes.forEach(st => { counts[st] = (counts[st] || 0) + 1; });
      });
      const mKey = firstMetric.id || "m0";
      rows = Object.entries(counts).map(([name, val]) => ({ name, [mKey]: val }));
    } else if (firstMetric.source === "tracker_quantitative" && firstMetric.tracker_id && firstMetric.tracker_col_id) {
      const tracker = trackers.find(t => t.id === firstMetric.tracker_id);
      const col = (tracker?.columns || []).find(c => c.id === firstMetric.tracker_col_id);
      if (!col) return { rows: [], metricKeys };
      const opts = col.quantitative_options || [];
      const totals = {};
      opts.forEach(o => { totals[o] = 0; });
      (trackerEntries || [])
        .filter(e => e.tracker_id === firstMetric.tracker_id && e.column_id === firstMetric.tracker_col_id)
        .forEach(e => {
          try {
            const vals = JSON.parse(e.value || "{}");
            opts.forEach(o => { totals[o] = (totals[o] || 0) + (vals[o] || 0); });
          } catch {}
        });
      const mKey = firstMetric.id || "m0";
      rows = Object.entries(totals).map(([name, val]) => ({ name, [mKey]: val }));
    }
  }

  // ── Apply sort & top_n ───────────────────────────────────────────────────
  const sortMode = chart.sort_mode || "value_desc";
  const firstKey = metricKeys[0]?.key;
  if (sortMode === "value_desc" && firstKey) rows.sort((a, b) => (b[firstKey] || 0) - (a[firstKey] || 0));
  else if (sortMode === "value_asc" && firstKey) rows.sort((a, b) => (a[firstKey] || 0) - (b[firstKey] || 0));
  else if (sortMode === "name") rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const topN = parseInt(chart.top_n) || 0;
  if (topN > 0) rows = rows.slice(0, topN);

  // Filter out rows where ALL metrics are 0 (for worker/category groupings)
  if (groupBy !== "time") {
    rows = rows.filter(row => metricKeys.some(mk => (row[mk.key] || 0) > 0));
  }

  return { rows, metricKeys };
}
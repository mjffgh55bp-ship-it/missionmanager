import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

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

const COLORS_PALETTE = ["#1e3a5f", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#ca8a04", "#059669", "#7c3aed"];

export default function ChartDisplay({ chart, workers, assignments, templateRows, allTemplates, trackers, trackerEntries, onEdit, onDelete }) {
  const data = useMemo(() => {
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

    const filterAssignment = (a) => {
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      return true;
    };

    if (chart.data_source === "shifts_per_worker") {
      return filteredWorkers.map(w => {
        const count = assignments.filter(a =>
          filterAssignment(a) &&
          (a.chef_id === w.id || a.sous_chef_id === w.id || a.additional_chef_id === w.id)
        ).length;
        return { name: w.nickname, value: count };
      }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }

    if (chart.data_source === "hours_per_worker") {
      return filteredWorkers.map(w => {
        let total = 0;
        assignments.filter(a => filterAssignment(a) && (a.chef_id === w.id || a.sous_chef_id === w.id || a.additional_chef_id === w.id))
          .forEach(a => { total += a.hours || 0; });
        templateRows.filter(row => {
          if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return false;
          const tmpl = allTemplates.find(t => t.id === row.template_id);
          if (!tmpl) return false;
          return (tmpl.columns || []).some(tc => tc.type === "worker" && row.values?.[tc.name] === w.id);
        }).forEach(row => {
          const h = calcHours(
            row.values?.["התחלה"] || row.values?.["שעת התחלה"] || "",
            row.values?.["סיום"] || row.values?.["שעת סיום"] || ""
          );
          total += h;
        });
        return { name: w.nickname, value: Math.round(total * 10) / 10 };
      }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }

    if (chart.data_source === "schedule_col_values" && chart.schedule_col_name) {
      const counts = {};
      templateRows.filter(row => {
        if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return false;
        return true;
      }).forEach(row => {
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

    return [];
  }, [chart, workers, assignments, templateRows, allTemplates, trackers, trackerEntries]);

  const color = chart.color || "#1e3a5f";

  const renderChart = () => {
    if (data.length === 0) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">אין נתונים להצגה</div>;

    if (chart.chart_type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS_PALETTE[i % COLORS_PALETTE.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chart.chart_type === "line") {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="border-none shadow-lg" dir="rtl">
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{chart.title}</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {renderChart()}
      </CardContent>
    </Card>
  );
}
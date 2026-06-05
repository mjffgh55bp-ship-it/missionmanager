import React from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { COLORS_PALETTE } from "@/lib/chartEngine";

export default function ChartRenderer({ chart, series, height = 260 }) {
  const { rows, metricKeys } = series || { rows: [], metricKeys: [] };

  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        אין נתונים להצגה
      </div>
    );
  }

  const showLegend = metricKeys.length > 1;
  const marginBottom = rows.length > 6 ? 60 : 40;
  const margin = { top: 5, right: 20, left: 0, bottom: marginBottom };
  const chartType = chart.chart_type || "bar";

  // ── PIE ──────────────────────────────────────────────────────────────────
  if (chartType === "pie") {
    const mKey = metricKeys[0]?.key || "value";
    const pieData = rows.map(r => ({ name: r.name, value: r[mKey] || 0 }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={height * 0.32}
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={false}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS_PALETTE[i % COLORS_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── LINE ──────────────────────────────────────────────────────────────────
  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {metricKeys.map(mk => (
            <Line
              key={mk.key}
              type="monotone"
              dataKey={mk.key}
              name={mk.label}
              stroke={mk.color}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── AREA ──────────────────────────────────────────────────────────────────
  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {metricKeys.map((mk, i) => (
            <Area
              key={mk.key}
              type="monotone"
              dataKey={mk.key}
              name={mk.label}
              stroke={mk.color}
              fill={mk.color + "33"}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── HORIZONTAL BAR ───────────────────────────────────────────────────────
  if (chartType === "horizontal_bar") {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, rows.length * 28 + 40)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip />
          {showLegend && <Legend />}
          {metricKeys.map(mk => (
            <Bar key={mk.key} dataKey={mk.key} name={mk.label} fill={mk.color} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── BAR (default) ────────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {showLegend && <Legend />}
        {metricKeys.map(mk => (
          <Bar key={mk.key} dataKey={mk.key} name={mk.label} fill={mk.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
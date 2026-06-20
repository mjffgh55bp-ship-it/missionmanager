import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ClipboardList, FileText, AlertTriangle, Link, SkipForward } from "lucide-react";

const CONFIRMED_MAPPING = {
  "מנהל": "role_04",
  "מנהל+רצת": "role_04",
  "מנהל ורצת": "role_04",
  "מאחורי מנהל": "role_04",
  "מנהל בכיר": "role_05",
  "מאחורי ליד נהג": "role_02",
  "בקסיט ליד נהג": "role_02",
  "בקסיט נהג": "role_02",
};

const METADATA_KEY_PREFIXES = ["_", "continuation_source_row_id"];

function isMetadataKey(key) {
  return METADATA_KEY_PREFIXES.some(p => key.startsWith(p));
}

function isTimeKey(key) {
  // Common time column names
  const timePatterns = ["התחלה", "סיום", "שעת התחלה", "שעת סיום"];
  return timePatterns.some(p => key === p || key.startsWith(p));
}

function looksLikeWorkerId(val) {
  return typeof val === "string" && val.length === 24 && /^[a-f0-9]{24}$/i.test(val);
}

export default function RoleRepairPreview() {
  const [auditRows, setAuditRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const downloadRef = useRef(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setAuditRows([]);
    setSummary(null);

    try {
      // ── LOAD ALL DATA (read-only) ──────────────────────────────────
      const [workerRolesSetting, scheduleColsSetting, allTemplates, allRows, allWorkers] = await Promise.all([
        base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
        base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
        base44.entities.Template.list("created_date", 300),
        base44.entities.TemplateRow.list("-date", 5000),
        base44.entities.Worker.list(),
      ]);

      // Parse role list
      const roleList = workerRolesSetting.length > 0
        ? (JSON.parse(workerRolesSetting[0].setting_value) || [])
        : [];
      const roleNameToId = {};
      const roleIdToName = {};
      roleList.forEach(r => {
        if (typeof r === "string") return;
        if (r.name && r.mapping_id) {
          roleNameToId[r.name.trim()] = r.mapping_id;
          roleIdToName[r.mapping_id] = r.name.trim();
        }
      });

      // Parse schedule columns
      const rawCols = scheduleColsSetting.length > 0
        ? (JSON.parse(scheduleColsSetting[0].setting_value) || [])
        : [];
      const scheduleColumns = rawCols.map(c => ({
        ...c,
        mapping_id: c.mapping_id || "",
        role_filter: c.role_filter || "",
        name: c.name || "",
      }));

      // Build role mapping_id → ScheduleColumn mapping_id lookup
      // For each role, find the ScheduleColumn whose role_filter matches or whose mapping_id is the canonical col_role_*
      const roleIdToScheduleColId = {};
      roleList.forEach(r => {
        if (!r.mapping_id || !r.name) return;
        // Try: ScheduleColumn with matching role_filter
        let sc = scheduleColumns.find(c => c.role_filter && c.role_filter.trim() === r.name.trim());
        if (!sc) {
          // Try: ScheduleColumn with canonical col_role_* mapping_id
          sc = scheduleColumns.find(c => c.mapping_id && c.mapping_id === `col_role_${r.mapping_id.split("_").pop()}`);
        }
        if (sc) {
          roleIdToScheduleColId[r.mapping_id] = sc.mapping_id || sc.name;
        }
      });

      // Build worker lookup
      const workerById = {};
      allWorkers.forEach(w => { workerById[w.id] = w; });

      // Build template lookup
      const templateById = {};
      allTemplates.forEach(t => { templateById[t.id] = t; });

      // Collect col_role_* keys for filtering
      const colRoleKeys = new Set();
      scheduleColumns.forEach(sc => {
        if (sc.mapping_id) colRoleKeys.add(sc.mapping_id);
      });

      const rows = [];

      // ── PART A: column_id relink preview ─────────────────────────────
      allTemplates.forEach(tmpl => {
        (tmpl.columns || []).forEach(col => {
          if (col.type !== "worker") return;
          if (col.column_id) return; // already has column_id
          if (col.name !== "מנהל בכיר") return;
          // Map role_05 to its ScheduleColumn mapping_id
          const targetColId = roleIdToScheduleColId["role_05"] || "";
          rows.push({
            action: "relink_column",
            row_id: "",
            date: "",
            template_name: tmpl.name || "",
            worker_id: "",
            worker_nickname: "",
            old_key: col.name,
            new_role: "role_05",
            target_column_id: targetColId,
            new_column_id: targetColId,
          });
        });
      });

      // ── PART B: orphaned assignment reconcile preview ────────────────
      allRows.forEach(row => {
        const tmpl = templateById[row.template_id];
        if (!tmpl) return;
        const workerColsWithId = new Set(
          (tmpl.columns || [])
            .filter(c => c.type === "worker" && c.column_id)
            .map(c => c.column_id)
        );

        const values = row.values || {};
        for (const [key, val] of Object.entries(values)) {
          if (!looksLikeWorkerId(val)) continue;
          if (workerColsWithId.has(key)) continue; // already a proper worker column
          if (colRoleKeys.has(key)) continue; // it's a col_role_* key
          if (isMetadataKey(key)) continue;
          if (isTimeKey(key)) continue;

          const worker = workerById[val];
          const workerNickname = worker?.nickname || val;

          // Check CONFIRMED_MAPPING
          if (CONFIRMED_MAPPING[key] !== undefined) {
            const roleId = CONFIRMED_MAPPING[key];
            const targetColId = roleIdToScheduleColId[roleId] || "";
            rows.push({
              action: "reconcile_key",
              row_id: row.id,
              date: row.date || "",
              template_name: tmpl.name || "",
              worker_id: val,
              worker_nickname: workerNickname,
              old_key: key,
              new_role: roleId,
              target_column_id: targetColId,
              new_column_id: "",
            });
          } else if (key === "בקסיט") {
            rows.push({
              action: "skip_unresolved",
              row_id: row.id,
              date: row.date || "",
              template_name: tmpl.name || "",
              worker_id: val,
              worker_nickname: workerNickname,
              old_key: key,
              new_role: "",
              target_column_id: "",
              new_column_id: "",
            });
          } else {
            rows.push({
              action: "skip_unknown",
              row_id: row.id,
              date: row.date || "",
              template_name: tmpl.name || "",
              worker_id: val,
              worker_nickname: workerNickname,
              old_key: key,
              new_role: "",
              target_column_id: "",
              new_column_id: "",
            });
          }
        }
      });

      setAuditRows(rows);

      // Summary
      const counts = { relink_column: 0, reconcile_key: 0, skip_unresolved: 0, skip_unknown: 0 };
      rows.forEach(r => { counts[r.action] = (counts[r.action] || 0) + 1; });
      setSummary(counts);

      // Auto-download CSV
      const headers = ["action", "row_id", "date", "template_name", "worker_id", "worker_nickname", "old_key", "new_role", "target_column_id", "new_column_id"];
      const csvLines = [headers.join(",")];
      rows.forEach(r => {
        csvLines.push(headers.map(h => {
          const v = (r[h] || "").toString();
          return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(","));
      });
      const csvContent = "\uFEFF" + csvLines.join("\n"); // BOM for Hebrew
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = "role_repair_preview.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Audit failed:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">תצוגה מקדימה לתיקון תפקידים</h1>
          <p className="text-gray-600">סריקה לקריאה בלבד — לא מבצעת שום שינוי בנתונים. מייצרת קובץ CSV להורדה.</p>
        </div>

        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              בדיקת נתונים
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800">הפעולה הזו היא לקריאה בלבד</p>
                  <p className="text-sm text-amber-700 mt-1">
                    לא יבוצעו שינויים בנתונים. הלחיצה תסרוק את הנתונים ותפיק קובץ CSV עם תצוגה מקדימה של כל התיקונים המוצעים.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={runAudit}
              disabled={loading}
              className="bg-blue-900 hover:bg-blue-800 text-white"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> סורק נתונים...</>
              ) : (
                <><Download className="w-4 h-4 ml-2" /> הפעל סריקה והורד CSV</>
              )}
            </Button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                שגיאה: {error}
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800">סיכום ({auditRows.length} שורות)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryCard
                    icon={<Link className="w-4 h-4" />}
                    label="קישור עמודות"
                    count={summary.relink_column}
                    color="blue"
                  />
                  <SummaryCard
                    icon={<FileText className="w-4 h-4" />}
                    label="תיקון מפתחות"
                    count={summary.reconcile_key}
                    color="green"
                  />
                  <SummaryCard
                    icon={<SkipForward className="w-4 h-4" />}
                    label="דולגו (בקסיט)"
                    count={summary.skip_unresolved}
                    color="amber"
                  />
                  <SummaryCard
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="לא ידועים"
                    count={summary.skip_unknown}
                    color="red"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, count, color }) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-xs">{label}</div>
      </div>
    </div>
  );
}
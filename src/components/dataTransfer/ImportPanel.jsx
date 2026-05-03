import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, Loader2, Info, X } from "lucide-react";
import {
  ASSIGNMENT_SCHEMA,
  AVAILABILITY_SCHEMA,
  SHEET_ASSIGNMENTS,
  SHEET_AVAILABILITY,
  sanitizeText,
  stripToSchema,
  validateRow,
} from "@/lib/dataTransferSchema";

const STATUS_STYLES = {
  תקין:   "bg-green-100 text-green-800",
  דולג:   "bg-yellow-100 text-yellow-800",
  שגיאה:  "bg-red-100 text-red-800",
  עודכן:  "bg-blue-100 text-blue-800",
  יובא:   "bg-emerald-100 text-emerald-800",
};

function RowStatusBadge({ status, tooltip }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-help ${STATUS_STYLES[status] || "bg-gray-100 text-gray-700"}`}
      title={tooltip || ""}
    >
      {status}
    </span>
  );
}

function parseSheetRows(ws, schema) {
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (raw.length < 2) return [];

  const headerRow = raw[0].map(h => String(h).trim());
  const schemaLabels = Object.entries(schema).map(([key, def]) => ({ key, label: def.label }));

  // Map column index → field key
  const colMap = {};
  headerRow.forEach((label, idx) => {
    const match = schemaLabels.find(s => s.label === label);
    if (match) colMap[idx] = match.key;
  });

  return raw.slice(1).map((row, rowIdx) => {
    const obj = {};
    Object.entries(colMap).forEach(([idx, key]) => {
      obj[key] = sanitizeText(row[idx]);
    });
    // Strip to only approved fields (ignores any extra unmapped columns)
    return stripToSchema(obj, schema);
  }).filter(r => Object.values(r).some(v => v !== ""));
}

export default function ImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // { assignments: [...], availabilities: [...] }
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState("");

  const reset = () => {
    setFileName("");
    setPreview(null);
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      setParseError("יש להעלות קובץ XLSX בלבד.");
      return;
    }
    setFileName(file.name);
    setParseError("");
    setPreview(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });

      const wsA = wb.Sheets[SHEET_ASSIGNMENTS];
      const wsV = wb.Sheets[SHEET_AVAILABILITY];

      if (!wsA && !wsV) {
        setParseError(`הקובץ חייב להכיל לפחות גיליון אחד בשם "${SHEET_ASSIGNMENTS}" או "${SHEET_AVAILABILITY}".`);
        return;
      }

      const assignmentRows = wsA ? parseSheetRows(wsA, ASSIGNMENT_SCHEMA) : [];
      const availabilityRows = wsV ? parseSheetRows(wsV, AVAILABILITY_SCHEMA) : [];

      // Validate each row
      const aPreview = assignmentRows.map((row, i) => {
        const errors = validateRow(row, ASSIGNMENT_SCHEMA);
        return { ...row, _rowNum: i + 2, _errors: errors, _status: errors.length > 0 ? "שגיאה" : "תקין" };
      });

      const vPreview = availabilityRows.map((row, i) => {
        const errors = validateRow(row, AVAILABILITY_SCHEMA);
        return { ...row, _rowNum: i + 2, _errors: errors, _status: errors.length > 0 ? "שגיאה" : "תקין" };
      });

      setPreview({ assignments: aPreview, availabilities: vPreview });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    const workers = await base44.entities.Worker.list();
    const existingAssignments = await base44.entities.Assignment.list();

    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const resultRows = [];

    // --- Apply assignments ---
    for (const row of preview.assignments) {
      if (row._status === "שגיאה") {
        errors++;
        resultRows.push({ ...row, _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      // Match worker by employee_id
      const worker = workers.find(w => w.id === row.employee_id);
      if (!worker) {
        skipped++;
        resultRows.push({ ...row, _finalStatus: "דולג", _reason: "מזהה עובד לא נמצא במערכת" });
        continue;
      }

      // Check for existing assignment by date+start+end+worker
      const existing = existingAssignments.find(a =>
        a.date === row.date &&
        a.start_time === row.start_time &&
        a.end_time === row.end_time &&
        (a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id)
      );

      const cleanData = stripToSchema(row, ASSIGNMENT_SCHEMA);
      // Only update status and notes — we do NOT create new assignment records (security rule)
      if (existing) {
        const patch = {};
        if (cleanData.status)  patch.status = cleanData.status;
        if (cleanData.notes)   patch.notes  = cleanData.notes;
        if (Object.keys(patch).length > 0) {
          await base44.entities.Assignment.update(existing.id, patch);
          updated++;
          resultRows.push({ ...row, _finalStatus: "עודכן", _reason: "סטטוס/הערות עודכנו" });
        } else {
          skipped++;
          resultRows.push({ ...row, _finalStatus: "דולג", _reason: "אין שינוי" });
        }
      } else {
        skipped++;
        resultRows.push({ ...row, _finalStatus: "דולג", _reason: "משמרת לא קיימת במערכת (ייצירה לא מורשית)" });
      }
    }

    // --- Apply availabilities ---
    const existingAvailabilities = await base44.entities.Availability.list();
    for (const row of preview.availabilities) {
      if (row._status === "שגיאה") {
        errors++;
        resultRows.push({ ...row, _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      const worker = workers.find(w => w.id === row.employee_id);
      if (!worker) {
        skipped++;
        resultRows.push({ ...row, _finalStatus: "דולג", _reason: "מזהה עובד לא נמצא" });
        continue;
      }

      const existing = existingAvailabilities.find(a =>
        a.worker_id === worker.id && a.week_start_date === row.week_start
      );

      if (existing) {
        // Update shifts array — add or update matching shift
        const shifts = [...(existing.shifts || [])];
        const idx = shifts.findIndex(s => s.date === row.date && s.start_time === row.start_time && s.end_time === row.end_time);
        const shiftData = { date: row.date, start_time: row.start_time, end_time: row.end_time, type: row.shift_type || "available", priority: idx >= 0 ? shifts[idx].priority : shifts.length + 1 };
        if (idx >= 0) shifts[idx] = shiftData; else shifts.push(shiftData);
        await base44.entities.Availability.update(existing.id, { shifts });
        updated++;
        resultRows.push({ ...row, _finalStatus: "עודכן", _reason: "משמרת זמינות עודכנה" });
      } else {
        // Create new availability record
        await base44.entities.Availability.create({
          worker_id: worker.id,
          worker_name: worker.nickname,
          week_start_date: row.week_start,
          shifts: [{ date: row.date, start_time: row.start_time, end_time: row.end_time, type: row.shift_type || "available", priority: 1 }],
          status: row.status || "submitted",
        });
        imported++;
        resultRows.push({ ...row, _finalStatus: "יובא", _reason: "רשומת זמינות חדשה נוצרה" });
      }
    }

    const totalRows = resultRows.length;

    await base44.entities.AuditLog.create({
      action_type: "import",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: totalRows,
      imported_count: imported,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errors,
    });
    if (onAuditLog) onAuditLog();

    setResult({ rows: resultRows, imported, updated, skipped, errors, total: totalRows });
    setApplying(false);
    setPreview(null);
  };

  const previewTotal = preview ? (preview.assignments.length + preview.availabilities.length) : 0;
  const previewErrors = preview ? (
    preview.assignments.filter(r => r._status === "שגיאה").length +
    preview.availabilities.filter(r => r._status === "שגיאה").length
  ) : 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* File picker */}
      {!preview && !result && (
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 font-medium">לחץ להעלאת קובץ XLSX</span>
              <span className="text-xs text-gray-400 mt-1">קבצי XLSX בלבד</span>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            </label>
            {parseError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <span className="font-semibold text-gray-800">{fileName}</span>
              <Badge variant="outline">{previewTotal} שורות</Badge>
              {previewErrors > 0 && <Badge className="bg-red-100 text-red-800">{previewErrors} שגיאות</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>

          {/* Assignments preview */}
          {preview.assignments.length > 0 && (
            <PreviewTable title={`משמרות (${preview.assignments.length})`} rows={preview.assignments}
              cols={["date","start_time","end_time","employee_name","role","status","notes"]}
              labels={["תאריך","התחלה","סיום","שם עובד","תפקיד","סטטוס","הערות"]}
            />
          )}

          {/* Availability preview */}
          {preview.availabilities.length > 0 && (
            <PreviewTable title={`זמינות (${preview.availabilities.length})`} rows={preview.availabilities}
              cols={["date","start_time","end_time","employee_name","shift_type","status"]}
              labels={["תאריך","התחלה","סיום","שם עובד","סוג","סטטוס"]}
            />
          )}

          {previewErrors > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              שורות עם שגיאות יידלגו בעת הייבוא. בדוק את השגיאות לפני ההמשך.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset}>ביטול</Button>
            <Button
              onClick={handleApply}
              disabled={applying || previewTotal === 0}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {applying ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</> : `אישור וייבוא (${previewTotal - previewErrors} שורות)`}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4" dir="rtl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">הייבוא הושלם</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SumRow label="סה״כ שורות" value={result.total} />
              <SumRow label="יובא" value={result.imported} color="text-emerald-700" />
              <SumRow label="עודכן" value={result.updated} color="text-blue-700" />
              <SumRow label="דולג" value={result.skipped} color="text-yellow-700" />
              <SumRow label="שגיאות" value={result.errors} color="text-red-700" />
            </div>
          </div>

          <PreviewTable
            title="דו״ח ייבוא מפורט"
            rows={result.rows}
            cols={["date","start_time","end_time","employee_name"]}
            labels={["תאריך","התחלה","סיום","שם עובד"]}
            showFinal
          />

          <Button variant="outline" onClick={reset} className="w-full">ייבוא נוסף</Button>
        </div>
      )}
    </div>
  );
}

function SumRow({ label, value, color }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-semibold ${color || "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function PreviewTable({ title, rows, cols, labels, showFinal }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, 6);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">שורה</th>
                {labels.map((l, i) => <th key={i} className="px-2 py-1.5 text-right font-medium text-gray-600">{l}</th>)}
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const status = showFinal ? row._finalStatus : row._status;
                const tooltip = showFinal ? row._reason : row._errors?.join("; ");
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400">{row._rowNum || i + 2}</td>
                    {cols.map((col, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate" title={row[col]}>{row[col] || "-"}</td>
                    ))}
                    <td className="px-2 py-1.5">
                      <RowStatusBadge status={status} tooltip={tooltip} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 6 && (
          <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t">
            {expanded ? "הצג פחות ▲" : `הצג את כל ${rows.length} השורות ▼`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
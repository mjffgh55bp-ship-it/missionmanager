import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { sanitizeText } from "@/lib/dataTransferSchema";

const SCHEDULE_SHEET = "לוח משמרות";
const AVAIL_SHEET = "זמינות";

const STATUS_STYLES = {
  תקין:  "bg-green-100 text-green-800",
  דולג:  "bg-yellow-100 text-yellow-800",
  שגיאה: "bg-red-100 text-red-800",
  עודכן: "bg-blue-100 text-blue-800",
  יובא:  "bg-emerald-100 text-emerald-800",
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

/** Parse any sheet into array of objects using first row as headers */
function parseSheet(ws) {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map(row => {
    const clean = {};
    Object.entries(row).forEach(([k, v]) => {
      clean[String(k).trim()] = v === null || v === undefined ? "" : String(v).trim();
    });
    return clean;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

export default function ImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // { scheduleRows, availRows }
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState("");

  const reset = () => {
    setFileName(""); setPreview(null); setResult(null); setParseError("");
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
    setParseError(""); setPreview(null); setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });

      const wsS = wb.Sheets[SCHEDULE_SHEET];
      const wsA = wb.Sheets[AVAIL_SHEET];

      if (!wsS && !wsA) {
        setParseError(`הקובץ חייב להכיל גיליון בשם "${SCHEDULE_SHEET}" או "${AVAIL_SHEET}".`);
        return;
      }

      const scheduleRows = wsS ? parseSheet(wsS).map((r, i) => ({
        ...r, _rowNum: i + 2,
        _status: (!r["תאריך"] || !r["מוקד"]) ? "שגיאה" : "תקין",
        _errors: (!r["תאריך"] || !r["מוקד"]) ? ["חסר תאריך או שם מוקד"] : [],
      })) : [];

      const availRows = wsA ? parseSheet(wsA).map((r, i) => ({
        ...r, _rowNum: i + 2,
        _status: (!r["מזהה עובד"] || !r["תאריך משמרת"]) ? "שגיאה" : "תקין",
        _errors: (!r["מזהה עובד"] || !r["תאריך משמרת"]) ? ["חסר מזהה עובד או תאריך"] : [],
      })) : [];

      setPreview({ scheduleRows, availRows });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    // Collect all unique dates from the schedule rows to filter queries
    const importDates = [...new Set(preview.scheduleRows.map(r => r["תאריך"]).filter(Boolean))];

    const [allTemplates, workers] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.Worker.list(),
    ]);

    // Fetch TemplateRows for each date in the import file
    const existingRowsArrays = await Promise.all(
      importDates.map(date => base44.entities.TemplateRow.filter({ date }))
    );
    const existingRows = existingRowsArrays.flat();

    // Fetch availabilities for the weeks in the import file
    const importWeeks = [...new Set(preview.availRows.map(r => r["שבוע"]).filter(Boolean))];
    const existingAvailabilities = importWeeks.length > 0
      ? (await Promise.all(importWeeks.map(w => base44.entities.Availability.filter({ week_start_date: w })))).flat()
      : [];

    // Build lookup maps
    const templateByName = {};
    allTemplates.forEach(t => { templateByName[t.name] = t; });

    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const resultRows = [];

    // --- Apply schedule rows ---
    for (const row of preview.scheduleRows) {
      if (row._status === "שגיאה") {
        errors++;
        resultRows.push({ ...row, _type: "schedule", _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      const date = sanitizeText(row["תאריך"]);
      const mokedName = sanitizeText(row["מוקד"]);
      const status = sanitizeText(row["סטטוס"] || "");

      // Find the template by moked name
      const template = templateByName[mokedName];
      if (!template) {
        skipped++;
        resultRows.push({ ...row, _type: "schedule", _finalStatus: "דולג", _reason: `מוקד "${mokedName}" לא קיים במערכת` });
        continue;
      }

      // Find existing TemplateRow for this date + template
      const existingTemplateRow = existingRows.find(r =>
        r.date === date && r.template_id === template.id
      );

      if (existingTemplateRow) {
        // Only update the status field — all other data stays intact
        if (status && existingTemplateRow.values?.status !== status) {
          const newValues = { ...existingTemplateRow.values, status };
          await base44.entities.TemplateRow.update(existingTemplateRow.id, { values: newValues });
          updated++;
          resultRows.push({ ...row, _type: "schedule", _finalStatus: "עודכן", _reason: "סטטוס עודכן" });
        } else {
          skipped++;
          resultRows.push({ ...row, _type: "schedule", _finalStatus: "דולג", _reason: "אין שינוי" });
        }
      } else {
        skipped++;
        resultRows.push({ ...row, _type: "schedule", _finalStatus: "דולג", _reason: "שורה לא קיימת (ייצירה לא מורשית)" });
      }
    }

    // --- Apply availability rows ---
    for (const row of preview.availRows) {
      if (row._status === "שגיאה") {
        errors++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      const workerId = sanitizeText(row["מזהה עובד"]);
      const weekStart = sanitizeText(row["שבוע"] || "");
      const date = sanitizeText(row["תאריך משמרת"]);
      const startTime = sanitizeText(row["שעת התחלה"] || "");
      const endTime = sanitizeText(row["שעת סיום"] || "");
      const shiftType = sanitizeText(row["סוג זמינות"] || "available");
      const avStatus = sanitizeText(row["סטטוס הגשה"] || "submitted");

      const worker = workers.find(w => w.id === workerId);
      if (!worker) {
        skipped++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "דולג", _reason: "מזהה עובד לא נמצא" });
        continue;
      }

      const existing = existingAvailabilities.find(a =>
        a.worker_id === workerId && a.week_start_date === weekStart
      );

      if (existing) {
        const shifts = [...(existing.shifts || [])];
        const idx = shifts.findIndex(s => s.date === date && s.start_time === startTime && s.end_time === endTime);
        const shiftData = { date, start_time: startTime, end_time: endTime, type: shiftType, priority: idx >= 0 ? shifts[idx].priority : shifts.length + 1 };
        if (idx >= 0) shifts[idx] = shiftData; else shifts.push(shiftData);
        await base44.entities.Availability.update(existing.id, { shifts });
        updated++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "עודכן", _reason: "משמרת זמינות עודכנה" });
      } else {
        if (!weekStart) {
          skipped++;
          resultRows.push({ ...row, _type: "avail", _finalStatus: "דולג", _reason: "חסר תאריך שבוע" });
          continue;
        }
        await base44.entities.Availability.create({
          worker_id: workerId,
          worker_name: worker.nickname,
          week_start_date: weekStart,
          shifts: [{ date, start_time: startTime, end_time: endTime, type: shiftType, priority: 1 }],
          status: avStatus,
        });
        imported++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "יובא", _reason: "רשומת זמינות חדשה נוצרה" });
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

  const previewTotal = preview ? (preview.scheduleRows.length + preview.availRows.length) : 0;
  const previewErrors = preview ? (
    preview.scheduleRows.filter(r => r._status === "שגיאה").length +
    preview.availRows.filter(r => r._status === "שגיאה").length
  ) : 0;

  return (
    <div className="space-y-4" dir="rtl">
      {!preview && !result && (
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 font-medium">לחץ להעלאת קובץ XLSX</span>
              <span className="text-xs text-gray-400 mt-1">קבצי XLSX בלבד — שיוצאו ממערכת זו</span>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            </label>
            {parseError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{parseError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

          {preview.scheduleRows.length > 0 && (
            <PreviewTable
              title={`לוח משמרות (${preview.scheduleRows.length})`}
              rows={preview.scheduleRows}
              cols={["תאריך", "מוקד", "סטטוס"]}
            />
          )}
          {preview.availRows.length > 0 && (
            <PreviewTable
              title={`זמינות (${preview.availRows.length})`}
              rows={preview.availRows}
              cols={["מזהה עובד", "תאריך משמרת", "שעת התחלה", "שעת סיום", "סוג זמינות"]}
            />
          )}

          {previewErrors > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              שורות עם שגיאות יידלגו בעת הייבוא.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset}>ביטול</Button>
            <Button
              onClick={handleApply}
              disabled={applying || previewTotal === 0}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {applying
                ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</>
                : `אישור וייבוא (${previewTotal - previewErrors} שורות)`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">הייבוא הושלם</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["סה״כ שורות", result.total, ""], ["יובא", result.imported, "text-emerald-700"],
                ["עודכן", result.updated, "text-blue-700"], ["דולג", result.skipped, "text-yellow-700"],
                ["שגיאות", result.errors, "text-red-700"]].map(([label, val, color]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-600">{label}:</span>
                  <span className={`font-semibold ${color || "text-gray-900"}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <PreviewTable
            title="דו״ח ייבוא מפורט"
            rows={result.rows}
            cols={["תאריך", "מוקד", "סטטוס"]}
            showFinal
          />
          <Button variant="outline" onClick={reset} className="w-full">ייבוא נוסף</Button>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ title, rows, cols, showFinal }) {
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
                {cols.map((c, i) => <th key={i} className="px-2 py-1.5 text-right font-medium text-gray-600">{c}</th>)}
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
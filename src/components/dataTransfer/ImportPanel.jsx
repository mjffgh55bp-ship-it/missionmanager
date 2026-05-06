import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  sanitizeText,
  isEmpty,
  deserializeFromImport,
  validateScheduleRow,
  validateAvailRow,
  SCHEDULE_SHEET,
  AVAIL_SHEET,
  SCHEDULE_META_COLS,
  INTERNAL_SKIP_KEYS,
} from "@/lib/dataTransferSchema";

const STATUS_STYLES = {
  תקין:   "bg-green-100 text-green-800",
  דולג:   "bg-yellow-100 text-yellow-800",
  שגיאה:  "bg-red-100 text-red-800",
  עודכן:  "bg-blue-100 text-blue-800",
  יובא:   "bg-emerald-100 text-emerald-800",
  אזהרה:  "bg-orange-100 text-orange-800",
};

function StatusBadge({ status, tooltip }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-help ${STATUS_STYLES[status] || "bg-gray-100 text-gray-700"}`}
      title={tooltip || ""}
    >
      {status}
    </span>
  );
}

/** Parse a worksheet into array-of-objects using first row as headers */
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

/**
 * Given a parsed XLSX schedule row, resolve all its data fields:
 * - worker fields: nickname → worker ID (using workerNameToId map)
 * - JSON fields: parse back to objects
 * - empty values: skip
 * Returns: { values, warnings }
 */
function resolveRowValues(rawRow, workerColNames, workerNameToId) {
  const skipCols = new Set([...SCHEDULE_META_COLS, "סטטוס", "_rowNum", "_status", "_errors"]);
  const values = {};
  const warnings = [];

  Object.entries(rawRow).forEach(([k, rawVal]) => {
    if (skipCols.has(k)) return;
    if (k.startsWith("_")) return; // internal meta keys
    if (k.endsWith("_subTypes")) return;

    const strVal = String(rawVal ?? "").trim();
    if (!strVal || strVal === "None") return; // skip empty

    if (workerColNames.has(k)) {
      // Worker field: resolve nickname → ID
      const workerId = workerNameToId[strVal];
      if (workerId) {
        values[k] = workerId;
      } else {
        // Try stripping sanitizeText's leading ' (formula-injection protection)
        const stripped = strVal.startsWith("'") ? strVal.slice(1) : strVal;
        const workerIdStripped = workerNameToId[stripped];
        if (workerIdStripped) {
          values[k] = workerIdStripped;
        } else {
          warnings.push(`שם עובד "${strVal}" בעמודה "${k}" לא נמצא — השדה לא יעודכן`);
          // Do not set this key — preserve existing DB value
        }
      }
    } else {
      // Regular field: deserialize (JSON parse if needed)
      const deserialized = deserializeFromImport(strVal);
      if (deserialized !== null && deserialized !== undefined) {
        values[k] = deserialized;
      }
    }
  });

  return { values, warnings };
}

export default function ImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName] = useState("");
  const [parsedData, setParsedData] = useState(null); // raw parsed rows before DB enrichment
  const [preview, setPreview] = useState(null);       // enriched preview after loading workers/templates
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState("");

  const reset = () => {
    setFileName(""); setParsedData(null); setPreview(null);
    setResult(null); setParseError(""); setLoadingPreview(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Step 1: Read file → parse raw rows (no DB calls yet)
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      setParseError("יש להעלות קובץ XLSX בלבד.");
      return;
    }
    setFileName(file.name);
    setParseError(""); setParsedData(null); setPreview(null); setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const wsS = wb.Sheets[SCHEDULE_SHEET];
      const wsA = wb.Sheets[AVAIL_SHEET];

      if (!wsS && !wsA) {
        setParseError(`הקובץ חייב להכיל גיליון בשם "${SCHEDULE_SHEET}" או "${AVAIL_SHEET}".`);
        return;
      }

      const rawSchedule = wsS ? parseSheet(wsS) : [];
      const rawAvail    = wsA ? parseSheet(wsA) : [];

      setParsedData({ rawSchedule, rawAvail });
    };
    reader.readAsArrayBuffer(file);
  };

  // Step 2: Load DB data and build enriched preview
  const handleBuildPreview = async () => {
    if (!parsedData) return;
    setLoadingPreview(true);

    const { rawSchedule, rawAvail } = parsedData;

    // Load workers and templates
    const [allTemplates, workers] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.Worker.list(),
    ]);

    const templateByName = {};
    allTemplates.forEach(t => { templateByName[t.name] = t; });

    const workerNameToId = {};
    workers.forEach(w => { if (w.nickname) workerNameToId[w.nickname] = w.id; });

    // Load existing TemplateRows for the dates in the import
    const importDates = [...new Set(rawSchedule.map(r => r["תאריך"]).filter(Boolean))];
    const existingRowsArrays = importDates.length > 0
      ? await Promise.all(importDates.map(d => base44.entities.TemplateRow.filter({ date: d })))
      : [];
    const existingRows = existingRowsArrays.flat();

    // Build lookups for row matching:
    // Primary: "date|group_id|_order" (for rows that have _order set)
    // Fallback: "date|group_id|rowIndexInGroup" (sorted by _order then created_date)
    const existingRowByOrder = {};
    const existingRowByIndex = {}; // "date|group_id|index" → row

    // Group existing rows by date+group_id, sorted stably
    const existingByGroup = {};
    existingRows.forEach(row => {
      const gKey = `${row.date}|${row.group_id || ""}`;
      if (!existingByGroup[gKey]) existingByGroup[gKey] = [];
      existingByGroup[gKey].push(row);
    });
    Object.entries(existingByGroup).forEach(([gKey, rows]) => {
      rows.sort((a, b) => {
        const aO = a.values?._order ?? Infinity;
        const bO = b.values?._order ?? Infinity;
        if (aO !== bO) return aO - bO;
        return new Date(a.created_date) - new Date(b.created_date);
      });
      rows.forEach((row, idx) => {
        // Primary key: by stored _order value
        if (row.values?._order !== undefined && row.values?._order !== null) {
          const key = `${row.date}|${row.group_id || ""}|${row.values._order}`;
          existingRowByOrder[key] = row;
        }
        // Fallback key: by position index
        const idxKey = `${gKey}|idx:${idx}`;
        existingRowByIndex[idxKey] = row;
      });
    });

    // Combined lookup: try _order first, then index
    const lookupExistingRow = (date, groupId, order, rowIndexInGroup) => {
      const gKey = `${date}|${groupId}`;
      // Try by _order value (matches rows where _order was explicitly set)
      if (order !== "" && order !== undefined) {
        const key = `${gKey}|${order}`;
        if (existingRowByOrder[key]) return existingRowByOrder[key];
      }
      // Fallback: match by stable index within group
      const idxKey = `${gKey}|idx:${rowIndexInGroup}`;
      return existingRowByIndex[idxKey] || null;
    };

    // Track row index per group for fallback matching
    const groupRowCounter = {}; // "date|group_id" → counter

    // Enrich schedule rows
    const scheduleRows = rawSchedule.map((rawRow, i) => {
      const rowNum = i + 2;
      const errors = validateScheduleRow(rawRow);

      if (errors.length > 0) {
        return {
          _rowNum: rowNum, _status: "שגיאה", _errors: errors,
          תאריך: rawRow["תאריך"] || "", מוקד: rawRow["מוקד"] || "",
          _group_id: rawRow["_group_id"] || "", _order: rawRow["_order"] || "",
          _warnings: [], _parsedValues: {}, _action: "skip",
          _fieldsUpdated: [], _fieldsSkipped: [],
        };
      }

      const date       = rawRow["תאריך"];
      const mokedName  = rawRow["מוקד"];
      const groupId    = rawRow["_group_id"] || "";
      const order      = rawRow["_order"] !== undefined ? String(rawRow["_order"]).trim() : "";
      const status     = rawRow["סטטוס"] || "";

      // Track row index within this group (for fallback matching)
      const gKey = `${date}|${groupId}`;
      const rowIndexInGroup = groupRowCounter[gKey] ?? 0;
      groupRowCounter[gKey] = rowIndexInGroup + 1;

      const template = templateByName[mokedName];
      if (!template) {
        return {
          _rowNum: rowNum, _status: "שגיאה", _errors: [`מוקד "${mokedName}" לא קיים במערכת`],
          תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
          _warnings: [], _parsedValues: {}, _action: "skip",
          _fieldsUpdated: [], _fieldsSkipped: [],
          _rowIndexInGroup: rowIndexInGroup,
        };
      }

      const workerColNames = new Set(
        (template.columns || []).filter(c => c.type === "worker").map(c => c.name)
      );

      const { values: parsedValues, warnings } = resolveRowValues(rawRow, workerColNames, workerNameToId);
      if (status) parsedValues.status = status;

      // Check if row exists: try _order match first, then index fallback
      const existingRow = lookupExistingRow(date, groupId, order, rowIndexInGroup);

      // Determine which fields will be updated vs skipped (already same value)
      const fieldsUpdated = [];
      const fieldsSkipped = [];

      if (existingRow) {
        Object.entries(parsedValues).forEach(([k, v]) => {
          const existing = existingRow.values?.[k];
          const existingStr = existing !== undefined ? JSON.stringify(existing) : undefined;
          const newStr = JSON.stringify(v);
          if (existingStr === newStr) {
            fieldsSkipped.push(`${k} (ללא שינוי)`);
          } else {
            fieldsUpdated.push(k);
          }
        });
      } else {
        Object.keys(parsedValues).forEach(k => fieldsUpdated.push(k));
      }

      return {
        _rowNum: rowNum,
        _status: warnings.length > 0 ? "אזהרה" : "תקין",
        _errors: [],
        _warnings: warnings,
        תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
        _parsedValues: parsedValues,
        _action: existingRow ? "update" : "create",
        _existingRowId: existingRow?.id || null,
        _existingValues: existingRow?.values || null,
        _templateId: template.id,
        _fieldsUpdated: fieldsUpdated,
        _fieldsSkipped: fieldsSkipped,
        _rowIndexInGroup: rowIndexInGroup,
      };
    });

    // Enrich availability rows (simpler — no change here)
    const importWeeks = [...new Set(rawAvail.map(r => r["שבוע"]).filter(Boolean))];
    const existingAvailabilities = importWeeks.length > 0
      ? (await Promise.all(importWeeks.map(w => base44.entities.Availability.filter({ week_start_date: w })))).flat()
      : [];

    const availRows = rawAvail.map((rawRow, i) => {
      const errors = validateAvailRow(rawRow);
      return {
        ...rawRow,
        _rowNum: i + 2,
        _status: errors.length > 0 ? "שגיאה" : "תקין",
        _errors: errors,
      };
    });

    setPreview({ scheduleRows, availRows, workers, existingAvailabilities });
    setLoadingPreview(false);
  };

  // Step 3: Apply
  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    const { scheduleRows, availRows, workers, existingAvailabilities } = preview;
    const workerNameToId = {};
    workers.forEach(w => { if (w.nickname) workerNameToId[w.nickname] = w.id; });

    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const resultRows = [];

    // --- Apply schedule rows ---
    for (const row of scheduleRows) {
      if (row._status === "שגיאה" || row._action === "skip") {
        errors++;
        resultRows.push({ ...row, _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      if (row._action === "update" && row._existingRowId) {
        // Merge: existing values + new parsed values (preserve _order and internal fields)
        const preserved = {};
        if (row._existingValues?._order !== undefined) preserved._order = row._existingValues._order;

        const newValues = {
          ...(row._existingValues || {}),
          ...row._parsedValues,
          ...preserved,
        };

        await base44.entities.TemplateRow.update(row._existingRowId, { values: newValues });
        updated++;
        resultRows.push({
          ...row, _finalStatus: "עודכן",
          _reason: `עודכנו: ${row._fieldsUpdated.join(", ") || "ללא שינויים"}`,
        });
      } else {
        // Create new row
        const groupId = row._group_id || (Date.now().toString() + Math.random().toString(36).substr(2, 6));
        await base44.entities.TemplateRow.create({
          template_id: row._templateId,
          template_name: row["מוקד"],
          date: row["תאריך"],
          values: row._parsedValues,
          group_id: groupId,
        });
        imported++;
        resultRows.push({ ...row, _finalStatus: "יובא", _reason: "שורה חדשה נוצרה" });
      }
    }

    // --- Apply availability rows ---
    for (const row of availRows) {
      if (row._status === "שגיאה") {
        errors++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      const workerId  = sanitizeText(row["מזהה עובד"]);
      const weekStart = sanitizeText(row["שבוע"] || "");
      const date      = sanitizeText(row["תאריך משמרת"]);
      const startTime = sanitizeText(row["שעת התחלה"] || "");
      const endTime   = sanitizeText(row["שעת סיום"] || "");
      const shiftType = sanitizeText(row["סוג זמינות"] || "available");
      const avStatus  = sanitizeText(row["סטטוס הגשה"] || "submitted");

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

    await base44.entities.AuditLog.create({
      action_type: "import",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: resultRows.length,
      imported_count: imported,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errors,
    });
    if (onAuditLog) onAuditLog();

    setResult({ rows: resultRows, imported, updated, skipped, errors, total: resultRows.length });
    setApplying(false);
    setPreview(null);
  };

  // ── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">

      {/* Step 1: Upload */}
      {!parsedData && !result && (
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

      {/* Step 1b: File loaded, need to build preview */}
      {parsedData && !preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            נמצאו {parsedData.rawSchedule.length} שורות לוח משמרות ו-{parsedData.rawAvail.length} שורות זמינות.
            לחץ על "בדוק ייבוא" לניתוח מפורט לפני האישור.
          </div>
          <Button
            onClick={handleBuildPreview}
            disabled={loadingPreview}
            className="w-full bg-blue-900 hover:bg-blue-800"
          >
            {loadingPreview
              ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />בודק נתונים...</>
              : "בדוק ייבוא — הצג תצוגה מקדימה"}
          </Button>
        </div>
      )}

      {/* Step 2: Preview */}
      {preview && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
              <Badge variant="outline">{preview.scheduleRows.length} שורות לוח</Badge>
              {preview.scheduleRows.filter(r => r._status === "שגיאה").length > 0 && (
                <Badge className="bg-red-100 text-red-800">{preview.scheduleRows.filter(r => r._status === "שגיאה").length} שגיאות</Badge>
              )}
              {preview.scheduleRows.filter(r => r._status === "אזהרה").length > 0 && (
                <Badge className="bg-orange-100 text-orange-800">{preview.scheduleRows.filter(r => r._status === "אזהרה").length} אזהרות</Badge>
              )}
              {preview.scheduleRows.filter(r => r._action === "create").length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800">{preview.scheduleRows.filter(r => r._action === "create").length} חדשים</Badge>
              )}
              {preview.scheduleRows.filter(r => r._action === "update").length > 0 && (
                <Badge className="bg-blue-100 text-blue-800">{preview.scheduleRows.filter(r => r._action === "update").length} עדכונים</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>

          <DiagnosticPreviewTable rows={preview.scheduleRows} />

          {preview.scheduleRows.some(r => r._status === "שגיאה") && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              שורות עם שגיאות יידלגו בעת הייבוא.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset}>ביטול</Button>
            <Button
              onClick={handleApply}
              disabled={applying}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {applying
                ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</>
                : `אישור וייבוא`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
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
          <ResultTable rows={result.rows} />
          <Button variant="outline" onClick={reset} className="w-full">ייבוא נוסף</Button>
        </div>
      )}
    </div>
  );
}

/** Full diagnostic preview table for schedule rows */
function DiagnosticPreviewTable({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, 8);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">תצוגה מקדימה — ניתוח שורות</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">שורה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">תאריך</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">מוקד</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">group_id</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">סדר</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">פעולה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">עמודות לעדכן</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">אזהרות</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const actionLabel = row._action === "create" ? "יצירה" : row._action === "update" ? "עדכון" : "דילוג";
                const actionColor = row._action === "create" ? "text-emerald-700" : row._action === "update" ? "text-blue-700" : "text-gray-400";
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400">{row._rowNum}</td>
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{row["תאריך"] || "-"}</td>
                    <td className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate" title={row["מוקד"]}>{row["מוקד"] || "-"}</td>
                    <td className="px-2 py-1.5 text-gray-400 max-w-[80px] truncate font-mono text-[10px]" title={row._group_id}>{row._group_id ? row._group_id.slice(0, 8) + "…" : "-"}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-center">{row._order !== undefined && row._order !== "" ? row._order : "-"}</td>
                    <td className={`px-2 py-1.5 font-semibold ${actionColor}`}>{actionLabel}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[180px]">
                      {row._status === "שגיאה"
                        ? <span className="text-red-600">{row._errors.join("; ")}</span>
                        : row._fieldsUpdated?.length > 0
                          ? <span className="text-blue-700 truncate block" title={row._fieldsUpdated.join(", ")}>{row._fieldsUpdated.join(", ")}</span>
                          : <span className="text-gray-300">ללא שינויים</span>
                      }
                    </td>
                    <td className="px-2 py-1.5 max-w-[160px]">
                      {row._warnings?.length > 0
                        ? <span className="text-orange-600 truncate block" title={row._warnings.join("; ")}>{row._warnings.join("; ")}</span>
                        : <span className="text-gray-300">-</span>
                      }
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={row._status} tooltip={[...row._errors, ...(row._warnings || [])].join("; ")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
            {expanded
              ? <><ChevronUp className="w-3 h-3" />הצג פחות</>
              : <><ChevronDown className="w-3 h-3" />הצג את כל {rows.length} השורות</>}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/** Result table after applying import */
function ResultTable({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, 8);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">דו״ח ייבוא מפורט</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">שורה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">תאריך</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">מוקד</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">תוצאה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">פרטים</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-400">{row._rowNum || i + 2}</td>
                  <td className="px-2 py-1.5 text-gray-700">{row["תאריך"] || "-"}</td>
                  <td className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate" title={row["מוקד"]}>{row["מוקד"] || "-"}</td>
                  <td className="px-2 py-1.5"><StatusBadge status={row._finalStatus} /></td>
                  <td className="px-2 py-1.5 text-gray-500 max-w-[200px] truncate" title={row._reason}>{row._reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
            {expanded ? <><ChevronUp className="w-3 h-3" />הצג פחות</> : <><ChevronDown className="w-3 h-3" />הצג את כל {rows.length} השורות</>}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
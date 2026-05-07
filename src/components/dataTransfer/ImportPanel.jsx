import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, Loader2, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  sanitizeText,
  deserializeFromImport,
  validateScheduleRow,
  validateAvailRow,
  SCHEDULE_SHEET,
  AVAIL_SHEET,
  SCHEDULE_META_COLS,
  isKnownWorkerCol,
  normalizeColName,
  COLUMN_ALIAS_MAP,
} from "@/lib/dataTransferSchema";

// ── Value emptiness check ──────────────────────────────────────────────────────
function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "None" || s === "none";
}

// ── Parse worksheet → array of objects, normalizing column names ───────────────
function parseSheet(ws) {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows
    .map(row => {
      const clean = {};
      Object.entries(row).forEach(([k, v]) => {
        // Normalize: trim + Hebrew maqaf → ASCII hyphen
        const nk = normalizeColName(k);
        clean[nk] = v === null || v === undefined ? "" : String(v).trim();
      });
      return clean;
    })
    .filter(row => Object.values(row).some(v => v !== ""));
}

// ── Normalize + alias a raw XLSX header to its canonical key ──────────────────
// Returns { canonical, wasAliased }
function resolveHeader(rawHeader) {
  const normalized = normalizeColName(rawHeader);
  const aliased = COLUMN_ALIAS_MAP[normalized] || COLUMN_ALIAS_MAP[rawHeader];
  if (aliased) return { canonical: aliased, wasAliased: true, normalized };
  return { canonical: normalized, wasAliased: false, normalized };
}

// ── Match a canonical header to an existing template column ───────────────────
// Returns the matching template column object or null
function matchToTemplateColumn(canonical, templateColumns) {
  // Exact match first
  const exact = templateColumns.find(c => c.name === canonical);
  if (exact) return exact;
  // Normalized match
  const normCanon = normalizeColName(canonical);
  return templateColumns.find(c => normalizeColName(c.name) === normCanon) || null;
}

// ── Build column mapping for a row given its template ────────────────────────
// Returns array of { xlsxHeader, canonical, normalized, matchedCol, action }
//   action: "matched" | "meta" | "missing" | "internal"
function buildColMapping(rawRow, template) {
  const templateColumns = template?.columns || [];
  const mapping = [];
  const metaSet = new Set(SCHEDULE_META_COLS);
  const internalKeys = new Set(["_rowNum", "_status", "_errors", "סטטוס", "status"]);

  Object.keys(rawRow).forEach(xlsxHeader => {
    if (metaSet.has(xlsxHeader)) {
      mapping.push({ xlsxHeader, canonical: xlsxHeader, normalized: xlsxHeader, matchedCol: null, action: "meta" });
      return;
    }
    if (internalKeys.has(xlsxHeader)) {
      mapping.push({ xlsxHeader, canonical: xlsxHeader, normalized: xlsxHeader, matchedCol: null, action: "internal" });
      return;
    }

    const { canonical, wasAliased, normalized } = resolveHeader(xlsxHeader);
    const matchedCol = matchToTemplateColumn(canonical, templateColumns);

    if (matchedCol) {
      mapping.push({ xlsxHeader, canonical: matchedCol.name, normalized, matchedCol, wasAliased, action: "matched" });
    } else {
      mapping.push({ xlsxHeader, canonical, normalized, matchedCol: null, wasAliased, action: "missing" });
    }
  });

  return mapping;
}

// ── Resolve and validate values for one row ───────────────────────────────────
// Uses prebuilt colMapping. Returns { values, warnings, rejectedFields, workerDiagnostics }
function resolveRowValues(rawRow, colMapping, workerNameToId, workerIdSet) {
  const values = {};
  const warnings = [];
  const rejectedFields = [];
  const workerDiagnostics = [];

  for (const cm of colMapping) {
    if (cm.action === "meta" || cm.action === "internal" || cm.action === "missing") continue;

    const rawVal = rawRow[cm.xlsxHeader];
    if (isEmptyValue(rawVal)) continue; // NEVER overwrite with empty

    const strVal = String(rawVal).trim();
    const stripped = strVal.startsWith("'") ? strVal.slice(1) : strVal;

    const colType = cm.matchedCol?.type;
    const isWorkerCol = colType === "worker" || isKnownWorkerCol(cm.canonical);

    if (isWorkerCol) {
      const byNickname = workerNameToId[stripped] || workerNameToId[strVal];
      const byId = !byNickname && workerIdSet.has(strVal) ? strVal : null;

      if (byNickname) {
        values[cm.canonical] = byNickname;
        workerDiagnostics.push({ col: cm.canonical, rawValue: strVal, resolvedId: byNickname, status: "resolved" });
      } else if (byId) {
        values[cm.canonical] = byId;
        workerDiagnostics.push({ col: cm.canonical, rawValue: strVal, resolvedId: byId, status: "resolved" });
      } else {
        warnings.push(`העובד "${stripped}" לא נמצא עבור "${cm.canonical}" — השדה לא יעודכן`);
        rejectedFields.push({ col: cm.canonical, value: stripped, reason: `עובד לא נמצא` });
        workerDiagnostics.push({ col: cm.canonical, rawValue: strVal, resolvedId: null, status: "unresolved" });
      }
      continue;
    }

    // Non-worker: deserialize and store
    const deserialized = deserializeFromImport(strVal);
    if (deserialized !== null && deserialized !== undefined) {
      values[cm.canonical] = deserialized;
    }
  }

  return { values, warnings, rejectedFields, workerDiagnostics };
}

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

async function loadAppSettingsContext() {
  const allSettings = await base44.entities.AppSettings.list();
  const getSetting = (key) => {
    const s = allSettings.find(s => s.setting_key === key);
    return s ? JSON.parse(s.setting_value) : null;
  };
  const shiftStatuses = getSetting("shift_statuses") || [];
  return { shiftStatuses };
}

export default function ImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState("");
  const [showColDiag, setShowColDiag] = useState(false);

  const reset = () => {
    setFileName(""); setParsedData(null); setPreview(null);
    setResult(null); setParseError(""); setLoadingPreview(false); setShowColDiag(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Step 1: Read file → parse raw rows
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

  // Step 2: Build preview with full diagnostics
  const handleBuildPreview = async () => {
    if (!parsedData) return;
    setLoadingPreview(true);

    const { rawSchedule, rawAvail } = parsedData;

    const [allTemplates, workers, settingsCtx] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.Worker.list(),
      loadAppSettingsContext(),
    ]);

    const { shiftStatuses } = settingsCtx;

    const templateByName = {};
    allTemplates.forEach(t => { templateByName[t.name] = t; });

    const workerNameToId = {};
    workers.forEach(w => { if (w.nickname) workerNameToId[w.nickname] = w.id; });
    const workerIdSet = new Set(workers.map(w => w.id).filter(Boolean));

    // Load existing TemplateRows for all import dates
    const importDates = [...new Set(rawSchedule.map(r => r["תאריך"]).filter(Boolean))];
    const existingRows = importDates.length > 0
      ? (await Promise.all(importDates.map(d => base44.entities.TemplateRow.filter({ date: d })))).flat()
      : [];

    // Build matching lookups
    const existingByGroup = {};
    existingRows.forEach(row => {
      const gKey = `${row.date}|${row.group_id || ""}`;
      if (!existingByGroup[gKey]) existingByGroup[gKey] = [];
      existingByGroup[gKey].push(row);
    });
    Object.values(existingByGroup).forEach(rows => {
      rows.sort((a, b) => {
        const aO = a.values?._order ?? Infinity;
        const bO = b.values?._order ?? Infinity;
        if (aO !== bO) return aO - bO;
        return new Date(a.created_date) - new Date(b.created_date);
      });
    });

    const lookupExistingRow = (date, groupId, order, rowIndexInGroup) => {
      const gKey = `${date}|${groupId}`;
      const rows = existingByGroup[gKey] || [];
      if (order !== "" && order !== undefined) {
        const byOrder = rows.find(r => String(r.values?._order) === String(order));
        if (byOrder) return byOrder;
      }
      return rows[rowIndexInGroup] || null;
    };

    // Collect global column diagnostics across all rows
    const globalColDiag = {}; // xlsxHeader → { xlsxHeader, canonical, action, matchedType, count }

    const groupRowCounter = {};

    const scheduleRows = rawSchedule.map((rawRow, i) => {
      const rowNum = i + 2;
      const errors = validateScheduleRow(rawRow);

      const date      = rawRow["תאריך"] || "";
      const mokedName = rawRow["מוקד"] || "";
      const groupId   = rawRow["_group_id"] || "";
      const order     = rawRow["_order"] !== undefined ? String(rawRow["_order"]).trim() : "";
      const statusRaw = rawRow["סטטוס"] || "";

      if (errors.length > 0) {
        return {
          _rowNum: rowNum, _status: "שגיאה", _errors: errors,
          תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
          _warnings: [], _parsedValues: {}, _rejectedFields: [], _action: "skip",
          _fieldsUpdated: [], _colMapping: [],
        };
      }

      const template = templateByName[mokedName];
      if (!template) {
        return {
          _rowNum: rowNum, _status: "שגיאה",
          _errors: [`מוקד "${mokedName}" לא קיים במערכת`],
          תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
          _warnings: [], _parsedValues: {}, _rejectedFields: [], _action: "skip",
          _fieldsUpdated: [], _colMapping: [],
        };
      }

      // Build column mapping for this row's template
      const colMapping = buildColMapping(rawRow, template);

      // Accumulate global column diagnostics
      colMapping.forEach(cm => {
        if (cm.action === "meta" || cm.action === "internal") return;
        if (!globalColDiag[cm.xlsxHeader]) {
          globalColDiag[cm.xlsxHeader] = {
            xlsxHeader: cm.xlsxHeader,
            normalized: cm.normalized,
            canonical: cm.canonical,
            action: cm.action,
            matchedType: cm.matchedCol?.type || null,
            wasAliased: cm.wasAliased || false,
            count: 0,
          };
        }
        globalColDiag[cm.xlsxHeader].count++;
      });

      const { values: parsedValues, warnings, rejectedFields, workerDiagnostics } =
        resolveRowValues(rawRow, colMapping, workerNameToId, workerIdSet);

      // Handle status
      if (statusRaw && !isEmptyValue(statusRaw)) {
        const statusValid = shiftStatuses.length === 0 || shiftStatuses.includes(statusRaw);
        if (statusValid) {
          parsedValues.status = statusRaw;
        } else {
          warnings.push(`הסטטוס "${statusRaw}" לא קיים בהגדרות — לא יעודכן`);
          rejectedFields.push({ col: "סטטוס", value: statusRaw, reason: `סטטוס לא תקין` });
        }
      }

      const gKey = `${date}|${groupId}`;
      const rowIndexInGroup = groupRowCounter[gKey] ?? 0;
      groupRowCounter[gKey] = rowIndexInGroup + 1;

      const existingRow = lookupExistingRow(date, groupId, order, rowIndexInGroup);

      const fieldsUpdated = [];
      const fieldsSkipped = [];
      if (existingRow) {
        Object.entries(parsedValues).forEach(([k, v]) => {
          const existing = existingRow.values?.[k];
          if (JSON.stringify(existing) === JSON.stringify(v)) {
            fieldsSkipped.push(`${k} (ללא שינוי)`);
          } else {
            fieldsUpdated.push(k);
          }
        });
      } else {
        Object.keys(parsedValues).forEach(k => fieldsUpdated.push(k));
      }

      // Check for missing columns (XLSX columns that had no template match)
      const missingCols = colMapping.filter(cm => cm.action === "missing");
      if (missingCols.length > 0) {
        missingCols.forEach(cm => {
          warnings.push(`עמודה "${cm.xlsxHeader}" לא קיימת בתבנית "${mokedName}" — תידלג`);
        });
      }

      const status = warnings.length > 0 || rejectedFields.length > 0 ? "אזהרה" : "תקין";

      return {
        _rowNum: rowNum, _status: status, _errors: [], _warnings: warnings,
        תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
        _parsedValues: parsedValues,
        _rejectedFields: rejectedFields,
        _workerDiagnostics: workerDiagnostics || [],
        _action: existingRow ? "update" : "create",
        _existingRowId: existingRow?.id || null,
        _existingValues: existingRow?.values || null,
        _templateId: template.id,
        _fieldsUpdated: fieldsUpdated,
        _fieldsSkipped: fieldsSkipped,
        _colMapping: colMapping,
      };
    });

    // Availability rows
    const importWeeks = [...new Set(rawAvail.map(r => r["שבוע"]).filter(Boolean))];
    const existingAvailabilities = importWeeks.length > 0
      ? (await Promise.all(importWeeks.map(w => base44.entities.Availability.filter({ week_start_date: w })))).flat()
      : [];

    const availRows = rawAvail.map((rawRow, i) => {
      const errors = validateAvailRow(rawRow);
      return { ...rawRow, _rowNum: i + 2, _status: errors.length > 0 ? "שגיאה" : "תקין", _errors: errors };
    });

    setPreview({
      scheduleRows,
      availRows,
      workers,
      existingAvailabilities,
      globalColDiag: Object.values(globalColDiag),
    });
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

    // Apply schedule rows — NO column creation, NO reordering
    for (const row of scheduleRows) {
      if (row._status === "שגיאה" || row._action === "skip") {
        errors++;
        resultRows.push({ ...row, _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      if (row._action === "update" && row._existingRowId) {
        // Merge: existing values first, then overlay only non-empty imported values
        // Preserve _order from existing
        const preserved = {};
        if (row._existingValues?._order !== undefined) preserved._order = row._existingValues._order;
        const newValues = { ...(row._existingValues || {}), ...row._parsedValues, ...preserved };
        await base44.entities.TemplateRow.update(row._existingRowId, { values: newValues });
        updated++;
        const rejSummary = row._rejectedFields?.length > 0
          ? ` | נדחו: ${row._rejectedFields.map(r => r.col).join(", ")}` : "";
        resultRows.push({ ...row, _finalStatus: "עודכן", _reason: `עודכנו: ${row._fieldsUpdated.join(", ") || "ללא שינויים"}${rejSummary}` });
      } else {
        const groupId = row._group_id || (Date.now().toString() + Math.random().toString(36).substr(2, 6));
        await base44.entities.TemplateRow.create({
          template_id: row._templateId,
          template_name: row["מוקד"],
          date: row["תאריך"],
          values: row._parsedValues,
          group_id: groupId,
        });
        imported++;
        const rejSummary = row._rejectedFields?.length > 0
          ? ` | נדחו: ${row._rejectedFields.map(r => r.col).join(", ")}` : "";
        resultRows.push({ ...row, _finalStatus: "יובא", _reason: `שורה חדשה נוצרה${rejSummary}` });
      }
    }

    // Apply availability rows
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

      const existing = existingAvailabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStart);
      if (existing) {
        const shifts = [...(existing.shifts || [])];
        const idx = shifts.findIndex(s => s.date === date && s.start_time === startTime && s.end_time === endTime);
        const shiftData = { date, start_time: startTime, end_time: endTime, type: shiftType, priority: idx >= 0 ? shifts[idx].priority : shifts.length + 1 };
        if (idx >= 0) shifts[idx] = shiftData; else shifts.push(shiftData);
        await base44.entities.Availability.update(existing.id, { shifts });
        updated++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "עודכן", _reason: "משמרת זמינות עודכנה" });
      } else {
        if (!weekStart) { skipped++; resultRows.push({ ...row, _type: "avail", _finalStatus: "דולג", _reason: "חסר תאריך שבוע" }); continue; }
        await base44.entities.Availability.create({
          worker_id: workerId, worker_name: worker.nickname, week_start_date: weekStart,
          shifts: [{ date, start_time: startTime, end_time: endTime, type: shiftType, priority: 1 }],
          status: avStatus,
        });
        imported++;
        resultRows.push({ ...row, _type: "avail", _finalStatus: "יובא", _reason: "רשומת זמינות חדשה נוצרה" });
      }
    }

    await base44.entities.AuditLog.create({
      action_type: "import", file_name: fileName,
      user_email: currentUser?.email || "", user_name: currentUser?.full_name || "",
      row_count: resultRows.length, imported_count: imported, updated_count: updated,
      skipped_count: skipped, error_count: errors,
    });
    if (onAuditLog) onAuditLog();

    setResult({ rows: resultRows, imported, updated, skipped, errors, total: resultRows.length });
    setApplying(false);
    setPreview(null);
  };

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

      {/* Step 1b: File loaded */}
      {parsedData && !preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            נמצאו {parsedData.rawSchedule.length} שורות לוח משמרות ו-{parsedData.rawAvail.length} שורות זמינות.
          </div>
          <Button onClick={handleBuildPreview} disabled={loadingPreview} className="w-full bg-blue-900 hover:bg-blue-800">
            {loadingPreview
              ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />בודק נתונים...</>
              : "בדוק ייבוא — הצג תצוגה מקדימה"}
          </Button>
        </div>
      )}

      {/* Step 2: Preview */}
      {preview && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
              <Badge variant="outline">{preview.scheduleRows.length} שורות</Badge>
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

          {/* Column Diagnostic Panel */}
          <ColumnDiagPanel colDiag={preview.globalColDiag} open={showColDiag} onToggle={() => setShowColDiag(v => !v)} />

          {/* Missing columns warning */}
          {preview.globalColDiag.some(c => c.action === "missing") && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              <div className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                עמודות שלא נמצאו בתבנית — ידולגו:
              </div>
              {preview.globalColDiag.filter(c => c.action === "missing").map((c, i) => (
                <div key={i} className="text-xs">"{c.xlsxHeader}" (נרמול: "{c.normalized}")</div>
              ))}
            </div>
          )}

          {/* Worker diagnostics */}
          <WorkerDiagPanel rows={preview.scheduleRows} />

          {/* Row preview table */}
          <DiagnosticPreviewTable rows={preview.scheduleRows} />

          {preview.scheduleRows.some(r => r._status === "שגיאה") && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              שורות עם שגיאות יידלגו. שורות עם אזהרות ייובאו עם השדות התקפים בלבד.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset}>ביטול</Button>
            <Button onClick={handleApply} disabled={applying} className="bg-blue-900 hover:bg-blue-800">
              {applying ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</> : "אישור וייבוא"}
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

// ── Column Diagnostic Panel ────────────────────────────────────────────────────
function ColumnDiagPanel({ colDiag, open, onToggle }) {
  if (!colDiag || colDiag.length === 0) return null;
  const actionLabel = {
    matched: { label: "✓ מותאם", cls: "text-green-700" },
    missing: { label: "✗ חסר בתבנית", cls: "text-red-600" },
  };
  return (
    <Card className="border shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        <span className="flex items-center gap-2"><Info className="w-4 h-4" />אבחון עמודות XLSX ({colDiag.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" dir="rtl">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-right font-medium text-gray-600">כותרת XLSX</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">לאחר נרמול</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">עמודה מותאמת</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">סוג</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {colDiag.map((c, i) => {
                  const a = actionLabel[c.action] || { label: c.action, cls: "text-gray-500" };
                  return (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-1.5 font-medium">{c.xlsxHeader}{c.wasAliased ? <span className="text-purple-600 mr-1">(alias)</span> : null}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.normalized}</td>
                      <td className="px-3 py-1.5">{c.action === "matched" ? c.canonical : <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.matchedType || "—"}</td>
                      <td className={`px-3 py-1.5 font-semibold ${a.cls}`}>{a.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Worker Diagnostic Panel ────────────────────────────────────────────────────
function WorkerDiagPanel({ rows }) {
  const allDiag = rows.flatMap(r => r._workerDiagnostics || []);
  if (allDiag.length === 0) return null;
  const unresolved = allDiag.filter(d => d.status === "unresolved");
  const resolved   = allDiag.filter(d => d.status === "resolved");
  if (resolved.length === 0 && unresolved.length === 0) return null;

  const uniqueDiag = [...new Map(allDiag.map(d => [`${d.col}|${d.rawValue}`, d])).values()];
  const hasIssue = unresolved.length > 0;

  return (
    <div className={`border rounded-lg p-3 text-sm space-y-1 ${hasIssue ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900"}`}>
      <div className="font-semibold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        עמודות עובדים ({resolved.length} פוענחו, {unresolved.length} לא נמצאו):
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs mt-1">
          <thead><tr className="border-b">
            <th className="text-right py-1 px-1">עמודה</th>
            <th className="text-right py-1 px-1">ערך XLSX</th>
            <th className="text-right py-1 px-1">מזהה</th>
            <th className="text-right py-1 px-1">סטטוס</th>
          </tr></thead>
          <tbody>
            {uniqueDiag.slice(0, 15).map((d, i) => (
              <tr key={i} className="border-b border-dashed">
                <td className="py-0.5 px-1 font-medium">{d.col}</td>
                <td className="py-0.5 px-1">{d.rawValue}</td>
                <td className="py-0.5 px-1 font-mono text-xs">{d.resolvedId || "—"}</td>
                <td className={`py-0.5 px-1 font-semibold ${d.status === "resolved" ? "text-green-700" : "text-red-600"}`}>
                  {d.status === "resolved" ? "✓" : "✗ לא נמצא"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Row Preview Table ──────────────────────────────────────────────────────────
function DiagnosticPreviewTable({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, 8);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ניתוח שורות</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">שורה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">תאריך</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">מוקד</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">פעולה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">שדות שיעודכנו</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">הערות</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const actionLabel = row._action === "create" ? "יצירה" : row._action === "update" ? "עדכון" : "דילוג";
                const actionColor = row._action === "create" ? "text-emerald-700" : row._action === "update" ? "text-blue-700" : "text-gray-400";
                const allWarnings = [...(row._errors || []), ...(row._warnings || [])];
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400">{row._rowNum}</td>
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{row["תאריך"] || "-"}</td>
                    <td className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate" title={row["מוקד"]}>{row["מוקד"] || "-"}</td>
                    <td className={`px-2 py-1.5 font-semibold ${actionColor}`}>{actionLabel}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[180px]">
                      {row._status === "שגיאה"
                        ? <span className="text-red-600">{row._errors?.join("; ")}</span>
                        : row._fieldsUpdated?.length > 0
                          ? <span className="text-blue-700 truncate block" title={row._fieldsUpdated.join(", ")}>{row._fieldsUpdated.join(", ")}</span>
                          : <span className="text-gray-300">ללא שינויים</span>
                      }
                    </td>
                    <td className="px-2 py-1.5 max-w-[180px]">
                      {allWarnings.length > 0
                        ? <span className="text-orange-600 truncate block text-xs" title={allWarnings.join("; ")}>{allWarnings[0]}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={row._status} tooltip={allWarnings.join("; ")} />
                    </td>
                  </tr>
                );
              })}
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

// ── Result Table ───────────────────────────────────────────────────────────────
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
                  <td className="px-2 py-1.5 text-gray-500 max-w-[220px] truncate" title={row._reason}>{row._reason || "-"}</td>
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
import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload, AlertTriangle, CheckCircle2, Loader2, X,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import {
  sanitizeText,
  isEmpty,
  deserializeFromImport,
  getInternalValueKey,
  isKnownWorkerCol,
  normalizeForMatch,
  SHEET_MOKED_TEMPLATES,
  SHEET_MOKED_COLUMNS,
  SHEET_MOKED_ROWS,
  SHEET_MOKED_VALUES,
  SHEET_WORKERS_MAP,
  LEGACY_SCHEDULE_SHEET,
} from "@/lib/dataTransferSchema";

// ── Parse a worksheet into array-of-objects (first row = headers) ─────────────
function parseSheet(ws) {
  if (!ws) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  if (raw.length < 1) return { headers: [], rows: [] };
  const headers = raw[0].map(h => String(h ?? "").trim());
  const rows = raw.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
  return { headers, rows };
}

// ── Match an imported column entry to a live template column ──────────────────
// Returns the matched live column object or null
function matchColumn(importedCol, liveColumns) {
  const { column_name, display_name, internal_value_key } = importedCol;

  // 1. Exact column_name match
  let match = liveColumns.find(c => c.name === column_name);
  if (match) return match;

  // 2. Exact internal_value_key match — handles task type
  //    (imported internal_value_key === "task" → find col where type === "task")
  if (internal_value_key === "task") {
    match = liveColumns.find(c => c.type === "task");
    if (match) return match;
  }

  // 3. Normalized column_name match
  const nColName = normalizeForMatch(column_name);
  match = liveColumns.find(c => normalizeForMatch(c.name) === nColName);
  if (match) return match;

  // 4. Normalized display_name match
  if (display_name) {
    const nDisp = normalizeForMatch(display_name);
    match = liveColumns.find(c => normalizeForMatch(c.name) === nDisp);
    if (match) return match;
  }

  // 5. Alias: internal_value_key normalization
  if (internal_value_key) {
    const nKey = normalizeForMatch(internal_value_key);
    match = liveColumns.find(c => normalizeForMatch(getInternalValueKey(c)) === nKey);
    if (match) return match;
  }

  return null;
}

// ── Find existing TemplateRow by row_id or by (template+date+group+order) ─────
function findExistingRow(importedRow, existingRows) {
  // 1. By original row_id
  if (importedRow.row_id) {
    const byId = existingRows.find(r => r.id === importedRow.row_id);
    if (byId) return byId;
  }

  // 2. By (template_id, date, group_id, _order)
  const matches = existingRows.filter(r =>
    r.template_id === importedRow.template_id &&
    r.date === importedRow.date &&
    (r.group_id || "") === (importedRow.group_id || "") &&
    String(r.values?._order ?? "") === String(importedRow._order ?? "")
  );
  if (matches.length === 1) return matches[0];

  return null;
}

const STATUS_STYLES = {
  תקין:  "bg-green-100 text-green-800",
  דולג:  "bg-yellow-100 text-yellow-800",
  שגיאה: "bg-red-100 text-red-800",
  עודכן: "bg-blue-100 text-blue-800",
  יובא:  "bg-emerald-100 text-emerald-800",
  אזהרה: "bg-orange-100 text-orange-800",
};

function StatusBadge({ status, tooltip }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-help ${STATUS_STYLES[status] || "bg-gray-100 text-gray-700"}`}
      title={tooltip || ""}
    >{status}</span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportPanel({ currentUser, onAuditLog }) {
  const fileRef = useRef();
  const [fileName, setFileName] = useState("");
  const [rawSheets, setRawSheets] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState("");
  const [showColDiag, setShowColDiag] = useState(false);
  const [showRowDiag, setShowRowDiag] = useState(false);

  const reset = () => {
    setFileName(""); setRawSheets(null); setPreview(null);
    setResult(null); setParseError(""); setShowColDiag(false); setShowRowDiag(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Step 1: Read file ───────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) { setParseError("יש להעלות קובץ XLSX בלבד."); return; }
    setFileName(file.name);
    setParseError(""); setRawSheets(null); setPreview(null); setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheetNames = wb.SheetNames;

      // Detect if this is a new structured export or a legacy flat export
      const isStructured = sheetNames.includes(SHEET_MOKED_VALUES);
      const isLegacy     = !isStructured && sheetNames.includes(LEGACY_SCHEDULE_SHEET);

      if (!isStructured && !isLegacy) {
        setParseError(`הקובץ אינו מזוהה. חייב להכיל גיליון "${SHEET_MOKED_VALUES}" (ייצוא חדש) או "${LEGACY_SCHEDULE_SHEET}" (ייצוא ישן).`);
        return;
      }

      if (isLegacy) {
        setParseError("קובץ זה הוא ייצוא ישן ואינו נתמך עוד. יש לייצא מחדש עם הגרסה החדשה של המערכת.");
        return;
      }

      const sheets = {
        mokedTemplates: parseSheet(wb.Sheets[SHEET_MOKED_TEMPLATES]),
        mokedColumns:   parseSheet(wb.Sheets[SHEET_MOKED_COLUMNS]),
        mokedRows:      parseSheet(wb.Sheets[SHEET_MOKED_ROWS]),
        mokedValues:    parseSheet(wb.Sheets[SHEET_MOKED_VALUES]),
        workersMap:     parseSheet(wb.Sheets[SHEET_WORKERS_MAP]),
      };

      setRawSheets(sheets);
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Step 2: Build preview ───────────────────────────────────────────────────
  const handleBuildPreview = async () => {
    if (!rawSheets) return;
    setLoadingPreview(true);

    // Load live app state
    const [allTemplates, workers, allSettings] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.Worker.list(),
      base44.entities.AppSettings.list(),
    ]);

    // Parse settings
    const getSetting = (key) => {
      const s = allSettings.find(s => s.setting_key === key);
      return s ? (() => { try { return JSON.parse(s.setting_value); } catch { return null; } })() : null;
    };
    const shiftStatuses    = getSetting("shift_statuses")        || [];
    const customParams     = getSetting("custom_schedule_params") || [];
    const tasksList        = getSetting("tasks_list")             || [];

    // Build dropdown options per column name
    const dropdownOptions = {};
    customParams.forEach(c => {
      const opts = [];
      if (c.options)           opts.push(...c.options);
      if (c.sub_options)       opts.push(...c.sub_options.map(so => so.name));
      if (c.quantitative_items) opts.push(...c.quantitative_items);
      if (opts.length > 0) dropdownOptions[c.name] = opts;
    });

    // Worker lookups
    const workerByNickname = {};
    workers.forEach(w => { if (w.nickname) workerByNickname[w.nickname] = w.id; });
    const workerIdSet = new Set(workers.map(w => w.id).filter(Boolean));

    // Also use imported WorkersMap for nickname→id mapping
    const { rows: importedWorkers } = rawSheets.workersMap;
    importedWorkers.forEach(iw => {
      const nick = iw.nickname?.trim();
      const id   = iw.worker_id?.trim();
      if (nick && id && !workerByNickname[nick]) {
        // Check if this ID exists locally
        if (workerIdSet.has(id)) workerByNickname[nick] = id;
      }
    });

    // Template matching
    const templateByName = {};
    allTemplates.forEach(t => { templateByName[normalizeForMatch(t.name)] = t; });
    const templateById = {};
    allTemplates.forEach(t => { templateById[t.id] = t; });

    // ── STEP 3: Match templates ───────────────────────────────────────────────
    const { rows: importedTmplRows } = rawSheets.mokedTemplates;
    const templateMatch = {}; // imported template_id → live Template
    importedTmplRows.forEach(it => {
      // Try by ID first
      let live = templateById[it.template_id];
      // Fallback by normalized name
      if (!live) live = templateByName[normalizeForMatch(it.template_name)];
      templateMatch[it.template_id] = live || null;
    });

    // ── STEP 4: Match columns ─────────────────────────────────────────────────
    const { rows: importedColRows } = rawSheets.mokedColumns;
    // Group imported columns by template_id, preserving order (column_index)
    const importedColsByTemplate = {};
    importedColRows.forEach(ic => {
      const tid = ic.template_id;
      if (!importedColsByTemplate[tid]) importedColsByTemplate[tid] = [];
      importedColsByTemplate[tid].push(ic);
    });
    Object.values(importedColsByTemplate).forEach(cols => {
      cols.sort((a, b) => Number(a.column_index || 0) - Number(b.column_index || 0));
    });

    // Build column matching result per (template_id, column_name)
    const colMatchKey = (tid, colName) => `${tid}::${colName}`;
    const colMatchResult = {}; // key → { importedCol, liveCol, action, internalKey, reason }

    Object.entries(importedColsByTemplate).forEach(([tid, cols]) => {
      const liveTemplate = templateMatch[tid];
      const liveColumns  = liveTemplate?.columns || [];

      cols.forEach(ic => {
        const key = colMatchKey(tid, ic.column_name);
        const liveCol = matchColumn(ic, liveColumns);

        if (ic.column_name === "status") {
          colMatchResult[key] = { importedCol: ic, liveCol: null, action: "status", internalKey: "status" };
          return;
        }

        if (liveCol) {
          const internalKey = getInternalValueKey(liveCol);
          colMatchResult[key] = { importedCol: ic, liveCol, action: "matched", internalKey };
        } else if (!liveTemplate) {
          colMatchResult[key] = { importedCol: ic, liveCol: null, action: "no_template", internalKey: null, reason: "תבנית לא קיימת" };
        } else {
          colMatchResult[key] = { importedCol: ic, liveCol: null, action: "missing", internalKey: null, reason: "עמודה לא קיימת בתבנית" };
        }
      });
    });

    // Load existing TemplateRows for import dates
    const { rows: importedRowMeta } = rawSheets.mokedRows;
    const importDates = [...new Set(importedRowMeta.map(r => r.date).filter(Boolean))];
    const existingRows = importDates.length > 0
      ? (await Promise.all(importDates.map(d => base44.entities.TemplateRow.filter({ date: d })))).flat()
      : [];

    // ── STEP 5-8: Build per-row import plan ───────────────────────────────────
    const { rows: importedValues } = rawSheets.mokedValues;
    // Group values by row_id
    const valuesByRowId = {};
    importedValues.forEach(iv => {
      const rid = iv.row_id;
      if (!valuesByRowId[rid]) valuesByRowId[rid] = [];
      valuesByRowId[rid].push(iv);
    });

    const rowPlan = [];
    const workerDiagAll = [];

    importedRowMeta.forEach((irow, i) => {
      const rowNum = i + 2;
      const liveTemplate = templateMatch[irow.template_id];

      if (!irow.date || !/^\d{4}-\d{2}-\d{2}$/.test(irow.date)) {
        rowPlan.push({ rowNum, status: "שגיאה", errors: ["תאריך חסר/שגוי"], irow, action: "skip" });
        return;
      }
      if (!liveTemplate) {
        rowPlan.push({ rowNum, status: "שגיאה", errors: [`תבנית "${irow.template_name}" לא קיימת`], irow, action: "skip" });
        return;
      }

      const existingRow = findExistingRow({ ...irow, template_id: liveTemplate.id }, existingRows);
      const existingValues = existingRow?.values || {};

      // Process each value cell for this row
      const parsedValues = {};
      const warnings = [];
      const rejectedFields = [];
      const workerDiag = [];
      const fieldsDiag = [];

      const rowValues = valuesByRowId[irow.row_id] || [];
      // Build a set of live column names for subTypes validation
      const liveColNames = new Set((liveTemplate.columns || []).map(c => c.name));

      rowValues.forEach(iv => {
        const colName = iv.column_name;

        // ── Handle *_subTypes rows directly ──────────────────────────────────
        // These are NOT in MokedColumns; validate via parent column name
        if (colName.endsWith("_subTypes")) {
          const parentColName = colName.slice(0, -"_subTypes".length);
          // Only import if parent column exists in the live template
          if (!liveColNames.has(parentColName)) {
            fieldsDiag.push({ col: colName, internalKey: colName, rawVal: iv.value_exported, writtenVal: null, status: "skipped" });
            return;
          }
          const rawVal = iv.value_exported || iv.value_raw;
          if (isEmpty(rawVal)) {
            fieldsDiag.push({ col: colName, internalKey: colName, rawVal: "", writtenVal: null, status: "empty_skip" });
            return;
          }
          const stripped = String(rawVal).startsWith("'") ? String(rawVal).slice(1) : String(rawVal);
          // Parse JSON array if present, otherwise wrap in array
          let parsed;
          try { parsed = JSON.parse(stripped); } catch { parsed = [stripped]; }
          if (!Array.isArray(parsed)) parsed = [String(parsed)];
          parsedValues[colName] = parsed;
          fieldsDiag.push({ col: colName, internalKey: colName, rawVal: stripped, writtenVal: parsed, status: "written" });
          return;
        }

        const key = colMatchKey(irow.template_id, colName);
        const cm = colMatchResult[key];

        // Status column
        if (colName === "status" || (cm && cm.action === "status")) {
          const rawVal = iv.value_exported || iv.value_raw;
          if (!isEmpty(rawVal)) {
            const stripped = String(rawVal).startsWith("'") ? String(rawVal).slice(1) : String(rawVal);
            if (shiftStatuses.length === 0 || shiftStatuses.includes(stripped)) {
              parsedValues.status = stripped;
              fieldsDiag.push({ col: colName, internalKey: "status", rawVal: stripped, writtenVal: stripped, status: "written" });
            } else {
              warnings.push(`סטטוס "${stripped}" לא קיים בהגדרות`);
              rejectedFields.push({ col: colName, value: stripped, reason: "סטטוס לא תקין" });
              fieldsDiag.push({ col: colName, internalKey: "status", rawVal: stripped, writtenVal: null, status: "rejected" });
            }
          }
          return;
        }

        if (!cm || cm.action === "missing" || cm.action === "no_template") {
          if (!isEmpty(iv.value_exported) || !isEmpty(iv.value_raw)) {
            warnings.push(`עמודה "${colName}" לא קיימת בתבנית — תידלג`);
          }
          fieldsDiag.push({ col: colName, internalKey: null, rawVal: iv.value_exported, writtenVal: null, status: "skipped" });
          return;
        }

        const internalKey = cm.internalKey;
        const liveCol = cm.liveCol;
        // Prefer value_exported (human readable), fall back to value_raw
        const rawVal = iv.value_exported || iv.value_raw;

        if (isEmpty(rawVal)) {
          fieldsDiag.push({ col: colName, internalKey, rawVal: "", writtenVal: null, status: "empty_skip" });
          return; // Never overwrite with empty
        }

        const stripped = String(rawVal).startsWith("'") ? String(rawVal).slice(1) : String(rawVal);

        const isWorker = liveCol.type === "worker" || isKnownWorkerCol(liveCol.name);
        const isTask   = liveCol.type === "task";

        if (isWorker) {
          // Resolve nickname → worker_id
          const resolvedId = workerByNickname[stripped] || (workerIdSet.has(stripped) ? stripped : null);
          if (resolvedId) {
            parsedValues[internalKey] = resolvedId;
            workerDiag.push({ col: colName, rawValue: stripped, resolvedId, status: "resolved" });
            fieldsDiag.push({ col: colName, internalKey, rawVal: stripped, writtenVal: resolvedId, status: "written" });
          } else {
            warnings.push(`עובד "${stripped}" לא נמצא עבור "${colName}" — יידלג`);
            rejectedFields.push({ col: colName, value: stripped, reason: "עובד לא נמצא" });
            workerDiag.push({ col: colName, rawValue: stripped, resolvedId: null, status: "unresolved" });
            fieldsDiag.push({ col: colName, internalKey, rawVal: stripped, writtenVal: null, status: "rejected" });
          }
          return;
        }

        // Validate dropdown columns
        if (liveCol.type === "text" && dropdownOptions[liveCol.name]) {
          const opts = dropdownOptions[liveCol.name];
          if (!opts.includes(stripped)) {
            warnings.push(`ערך "${stripped}" לא קיים בהגדרות עבור "${colName}"`);
            rejectedFields.push({ col: colName, value: stripped, reason: "ערך לא קיים בהגדרות" });
            fieldsDiag.push({ col: colName, internalKey, rawVal: stripped, writtenVal: null, status: "rejected" });
            return;
          }
        }

        // Task column — validate against tasks list
        if (isTask && tasksList.length > 0 && !tasksList.includes(stripped)) {
          warnings.push(`משימה "${stripped}" לא קיימת ברשימת המשימות`);
          rejectedFields.push({ col: colName, value: stripped, reason: "משימה לא קיימת" });
          fieldsDiag.push({ col: colName, internalKey, rawVal: stripped, writtenVal: null, status: "rejected" });
          return;
        }

        // Deserialize and write
        const deserialized = deserializeFromImport(stripped);
        if (deserialized !== null && deserialized !== undefined) {
          parsedValues[internalKey] = deserialized;
          fieldsDiag.push({ col: colName, internalKey, rawVal: stripped, writtenVal: deserialized, status: "written" });
        }
      });

      // Diff: what fields actually change
      const fieldsUpdated = [];
      const fieldsUnchanged = [];
      Object.entries(parsedValues).forEach(([k, v]) => {
        const existing = existingValues[k];
        if (JSON.stringify(existing) !== JSON.stringify(v)) fieldsUpdated.push(k);
        else fieldsUnchanged.push(k);
      });

      workerDiagAll.push(...workerDiag);

      const hasError = warnings.length > 0 || rejectedFields.length > 0;
      rowPlan.push({
        rowNum,
        status: hasError ? "אזהרה" : "תקין",
        errors: [],
        warnings,
        rejectedFields,
        fieldsDiag,
        workerDiag,
        irow,
        liveTemplate,
        existingRow,
        existingValues,
        parsedValues,
        fieldsUpdated,
        fieldsUnchanged,
        action: existingRow ? "update" : "create",
      });
    });

    // Column diagnostics summary
    const colDiagList = Object.values(colMatchResult).map(cm => ({
      templateName: templateMatch[cm.importedCol.template_id]?.name || cm.importedCol.template_name,
      importedName: cm.importedCol.column_name,
      displayName: cm.importedCol.display_name,
      internalKey: cm.internalKey,
      liveColName: cm.liveCol?.name || null,
      liveColType: cm.liveCol?.type || null,
      action: cm.action,
      reason: cm.reason || null,
    }));

    setPreview({ rowPlan, colDiagList, workerDiagAll });
    setLoadingPreview(false);
  };

  // ── Step 3: Apply ───────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const resultRows = [];

    for (const plan of preview.rowPlan) {
      if (plan.action === "skip" || plan.status === "שגיאה") {
        errors++;
        resultRows.push({ ...plan, finalStatus: "שגיאה", reason: plan.errors.join("; ") });
        continue;
      }

      if (plan.action === "update" && plan.existingRow) {
        // Non-destructive merge: existing values first, overlay non-empty imported values
        // Preserve _order from existing
        const baseValues = { ...(plan.existingValues || {}) };
        const incomingValues = { ...plan.parsedValues };
        // Keep existing _order
        if (baseValues._order !== undefined) {
          delete incomingValues._order;
        }
        const newValues = { ...baseValues, ...incomingValues };
        await base44.entities.TemplateRow.update(plan.existingRow.id, { values: newValues });
        updated++;
        const note = plan.fieldsUpdated.length > 0
          ? `עודכנו: ${plan.fieldsUpdated.join(", ")}`
          : "ללא שינויים";
        const rej = plan.rejectedFields?.length > 0 ? ` | נדחו: ${plan.rejectedFields.map(r => r.col).join(", ")}` : "";
        resultRows.push({ ...plan, finalStatus: "עודכן", reason: note + rej });
      } else {
        // Create new row
        const groupId = plan.irow.group_id || (Date.now().toString() + Math.random().toString(36).substr(2, 6));
        const orderVal = plan.irow._order !== "" && plan.irow._order !== undefined ? Number(plan.irow._order) : undefined;
        const newValues = { ...plan.parsedValues };
        if (orderVal !== undefined && !isNaN(orderVal)) newValues._order = orderVal;

        await base44.entities.TemplateRow.create({
          template_id: plan.liveTemplate.id,
          template_name: plan.liveTemplate.name,
          date: plan.irow.date,
          values: newValues,
          group_id: groupId,
        });
        imported++;
        const rej = plan.rejectedFields?.length > 0 ? ` | נדחו: ${plan.rejectedFields.map(r => r.col).join(", ")}` : "";
        resultRows.push({ ...plan, finalStatus: "יובא", reason: `שורה חדשה נוצרה${rej}` });
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">

      {/* Upload */}
      {!rawSheets && !result && (
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 font-medium">לחץ להעלאת קובץ XLSX</span>
              <span className="text-xs text-gray-400 mt-1">קבצי XLSX בלבד — שיוצאו ממערכת זו (גרסה 2.0+)</span>
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

      {/* File loaded, not yet previewed */}
      {rawSheets && !preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
            <div>קובץ מובנה (גרסה 2.0) זוהה בהצלחה.</div>
            <div className="text-xs text-blue-600">
              {rawSheets.mokedRows.rows.length} שורות · {rawSheets.mokedValues.rows.length} ערכים · {rawSheets.mokedColumns.rows.length} עמודות
            </div>
          </div>
          <Button onClick={handleBuildPreview} disabled={loadingPreview} className="w-full bg-blue-900 hover:bg-blue-800">
            {loadingPreview
              ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />בודק נתונים...</>
              : "בדוק ייבוא — הצג תצוגה מקדימה"}
          </Button>
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <PreviewPanel
          preview={preview}
          fileName={fileName}
          showColDiag={showColDiag}
          setShowColDiag={setShowColDiag}
          showRowDiag={showRowDiag}
          setShowRowDiag={setShowRowDiag}
          applying={applying}
          onApply={handleApply}
          onCancel={reset}
        />
      )}

      {/* Result */}
      {result && (
        <ResultPanel result={result} onReset={reset} />
      )}
    </div>
  );
}

// ── Preview panel ─────────────────────────────────────────────────────────────
function PreviewPanel({ preview, fileName, showColDiag, setShowColDiag, showRowDiag, setShowRowDiag, applying, onApply, onCancel }) {
  const { rowPlan, colDiagList, workerDiagAll } = preview;
  const errCount  = rowPlan.filter(r => r.status === "שגיאה").length;
  const warnCount = rowPlan.filter(r => r.status === "אזהרה").length;
  const newCount  = rowPlan.filter(r => r.action === "create").length;
  const updCount  = rowPlan.filter(r => r.action === "update").length;
  const missingCols = colDiagList.filter(c => c.action === "missing");
  const unresWorkers = workerDiagAll.filter(d => d.status === "unresolved");

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="font-semibold text-gray-800 text-sm">{fileName}</span>
          <Badge variant="outline">{rowPlan.length} שורות</Badge>
          {errCount  > 0 && <Badge className="bg-red-100 text-red-800">{errCount} שגיאות</Badge>}
          {warnCount > 0 && <Badge className="bg-orange-100 text-orange-800">{warnCount} אזהרות</Badge>}
          {newCount  > 0 && <Badge className="bg-emerald-100 text-emerald-800">{newCount} חדשים</Badge>}
          {updCount  > 0 && <Badge className="bg-blue-100 text-blue-800">{updCount} עדכונים</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>

      {/* Missing columns alert */}
      {missingCols.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
          <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />עמודות שלא נמצאו בתבנית — ידולגו:</div>
          {missingCols.map((c, i) => (
            <div key={i} className="text-xs">"{c.importedName}" (תבנית: {c.templateName})</div>
          ))}
        </div>
      )}

      {/* Unresolved workers alert */}
      {unresWorkers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
          <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />עובדים שלא נמצאו — השדות ידולגו:</div>
          {[...new Map(unresWorkers.map(d => [d.rawValue, d])).values()].map((d, i) => (
            <div key={i} className="text-xs">"{d.rawValue}" (עמודה: {d.col})</div>
          ))}
        </div>
      )}

      {/* Column diagnostics */}
      <CollapsibleSection
        title={`אבחון עמודות (${colDiagList.length})`}
        open={showColDiag}
        onToggle={() => setShowColDiag(v => !v)}
        icon={<Info className="w-4 h-4" />}
      >
        <ColDiagTable colDiagList={colDiagList} />
      </CollapsibleSection>

      {/* Row diagnostics */}
      <CollapsibleSection
        title={`ניתוח שורות (${rowPlan.length})`}
        open={showRowDiag}
        onToggle={() => setShowRowDiag(v => !v)}
        icon={<Info className="w-4 h-4" />}
        defaultOpen={true}
      >
        <RowDiagTable rowPlan={rowPlan} />
      </CollapsibleSection>

      {errCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          שורות עם שגיאות יידלגו. שורות עם אזהרות ייובאו עם השדות התקפים בלבד.
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>ביטול</Button>
        <Button onClick={onApply} disabled={applying} className="bg-blue-900 hover:bg-blue-800">
          {applying ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</> : "אישור וייבוא"}
        </Button>
      </div>
    </div>
  );
}

// ── Column diagnostics table ───────────────────────────────────────────────────
function ColDiagTable({ colDiagList }) {
  const actionLabel = {
    matched:     { label: "✓ מותאם",              cls: "text-green-700" },
    missing:     { label: "✗ חסר בתבנית",         cls: "text-red-600" },
    no_template: { label: "✗ תבנית לא נמצאה",     cls: "text-red-600" },
    status:      { label: "→ עמודת סטטוס",         cls: "text-blue-600" },
    skipped:     { label: "דולג",                  cls: "text-gray-400" },
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" dir="rtl">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">תבנית</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">שם ייבוא</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">שם בתבנית</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">מפתח פנימי</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">סוג</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-600">פעולה</th>
          </tr>
        </thead>
        <tbody>
          {colDiagList.map((c, i) => {
            const a = actionLabel[c.action] || { label: c.action, cls: "text-gray-500" };
            return (
              <tr key={i} className="border-b">
                <td className="px-2 py-1 text-gray-500 text-xs">{c.templateName}</td>
                <td className="px-2 py-1 font-medium">{c.importedName}</td>
                <td className="px-2 py-1">{c.liveColName || <span className="text-red-400">—</span>}</td>
                <td className="px-2 py-1 font-mono text-xs text-blue-700">{c.internalKey || "—"}</td>
                <td className="px-2 py-1 text-gray-500">{c.liveColType || "—"}</td>
                <td className={`px-2 py-1 font-semibold ${a.cls}`}>{a.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Row diagnostics table ──────────────────────────────────────────────────────
function RowDiagTable({ rowPlan }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? rowPlan : rowPlan.slice(0, 10);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" dir="rtl">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">שורה</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">תאריך</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">מוקד</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">פעולה</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">שדות יעודכנו</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">הערות</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => {
              const actionLabel = row.action === "create" ? "יצירה" : row.action === "update" ? "עדכון" : "דילוג";
              const actionColor = row.action === "create" ? "text-emerald-700" : row.action === "update" ? "text-blue-700" : "text-gray-400";
              const allWarnings = [...(row.errors || []), ...(row.warnings || [])];
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1 text-gray-400">{row.rowNum}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{row.irow?.date || "-"}</td>
                  <td className="px-2 py-1 max-w-[90px] truncate" title={row.irow?.template_name}>{row.irow?.template_name || "-"}</td>
                  <td className={`px-2 py-1 font-semibold ${actionColor}`}>{actionLabel}</td>
                  <td className="px-2 py-1 max-w-[160px]">
                    {row.status === "שגיאה"
                      ? <span className="text-red-600">{row.errors?.join("; ")}</span>
                      : row.fieldsUpdated?.length > 0
                        ? <span className="text-blue-700 truncate block" title={row.fieldsUpdated.join(", ")}>{row.fieldsUpdated.join(", ")}</span>
                        : <span className="text-gray-300">ללא שינויים</span>}
                  </td>
                  <td className="px-2 py-1 max-w-[160px]">
                    {allWarnings.length > 0
                      ? <span className="text-orange-600 truncate block text-xs" title={allWarnings.join("; ")}>{allWarnings[0]}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-1"><StatusBadge status={row.status} tooltip={allWarnings.join("; ")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rowPlan.length > 10 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" />הצג פחות</> : <><ChevronDown className="w-3 h-3" />הצג את כל {rowPlan.length} השורות</>}
        </button>
      )}
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────
function CollapsibleSection({ title, open, onToggle, icon, children, defaultOpen }) {
  const isOpen = open !== undefined ? open : defaultOpen;
  return (
    <Card className="border shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        <span className="flex items-center gap-2">{icon}{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && <CardContent className="p-0">{children}</CardContent>}
    </Card>
  );
}

// ── Result panel ───────────────────────────────────────────────────────────────
function ResultPanel({ result, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? result.rows : result.rows.slice(0, 10);

  return (
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

      <Card className="border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">דו״ח ייבוא מפורט</CardTitle></CardHeader>
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
                {display.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-400">{row.rowNum || i + 2}</td>
                    <td className="px-2 py-1">{row.irow?.date || "-"}</td>
                    <td className="px-2 py-1 max-w-[100px] truncate" title={row.irow?.template_name}>{row.irow?.template_name || "-"}</td>
                    <td className="px-2 py-1"><StatusBadge status={row.finalStatus} /></td>
                    <td className="px-2 py-1 text-gray-500 max-w-[220px] truncate" title={row.reason}>{row.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 10 && (
            <button onClick={() => setExpanded(!expanded)} className="w-full text-xs text-blue-700 py-2 hover:bg-blue-50 border-t flex items-center justify-center gap-1">
              {expanded ? <><ChevronUp className="w-3 h-3" />הצג פחות</> : <><ChevronDown className="w-3 h-3" />הצג את כל {result.rows.length} השורות</>}
            </button>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onReset} className="w-full">ייבוא נוסף</Button>
    </div>
  );
}
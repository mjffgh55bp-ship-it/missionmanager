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
} from "@/lib/dataTransferSchema";

// ── Column alias map ──────────────────────────────────────────────────────────
// Maps XLSX column header names → canonical internal key used in TemplateRow.values
// This lets us accept legacy/English column names without writing them to the DB.
const COLUMN_ALIAS_MAP = {
  "task":   "משימה",
  "status": "סטטוס",
  "start":  "התחלה",
  "end":    "סיום",
};

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
 * Build a settings context from AppSettings — used for value validation.
 * Returns:
 *   scheduleColumns: array of { name, options, sub_options, quantitative_items, free_text }
 *   tasksList: string[]
 *   shiftStatuses: string[]
 *   colAllowedValues: Map<colName, Set<string> | null>
 *     null = free-text (any value allowed)
 *     Set = only these values are valid
 */
async function loadAppSettingsContext() {
  const allSettings = await base44.entities.AppSettings.list();
  const getSetting = (key) => {
    const s = allSettings.find(s => s.setting_key === key);
    return s ? JSON.parse(s.setting_value) : null;
  };

  const scheduleColumns = getSetting("custom_schedule_params") || [];
  const tasksList       = getSetting("tasks_list") || [];
  const shiftStatuses   = getSetting("shift_statuses") || [];

  // Build per-column allowed-values map
  const colAllowedValues = new Map(); // colName → Set<string> | null (null = free text)
  for (const col of scheduleColumns) {
    if (col.free_text) {
      colAllowedValues.set(col.name, null); // any value OK
    } else {
      const allowed = new Set();
      // options (legacy simple options array)
      (col.options || []).forEach(o => allowed.add(String(o)));
      // sub_options — the criterion is what gets stored in the DB
      (col.sub_options || []).forEach(so => {
        if (so.criterion) allowed.add(String(so.criterion));
        if (so.name)      allowed.add(String(so.name));
      });
      // quantitative_items — stored as JSON keys, so any value key is valid
      // We allow the whole JSON object through (validated later by structure)
      if (col.report_type === "count_quantitative") {
        colAllowedValues.set(col.name, null); // JSON blob — validated structurally
      } else {
        colAllowedValues.set(col.name, allowed.size > 0 ? allowed : null);
      }
    }
  }

  // "משימה" column: allowed values are the tasks list
  colAllowedValues.set("משימה", tasksList.length > 0 ? new Set(tasksList) : null);

  // "סטטוס" column: allowed values are the shift statuses
  colAllowedValues.set("סטטוס", shiftStatuses.length > 0 ? new Set(shiftStatuses) : null);

  return { scheduleColumns, tasksList, shiftStatuses, colAllowedValues };
}

/**
 * Resolve and validate all fields in one raw XLSX row.
 * - Applies COLUMN_ALIAS_MAP to normalize header names
 * - Worker cols: nickname → ID (warn if not found, skip field)
 * - Schedule cols: validate against allowed values (reject + warn if invalid)
 * - Time cols ("התחלה","סיום","תדריך"): always pass through (time strings)
 * - Status col: validate against shiftStatuses
 * Returns: { values, warnings, rejectedFields }
 *   rejectedFields: [{ col, value, reason }]
 */
function resolveAndValidateRow(rawRow, workerColNames, workerNameToId, colAllowedValues, shiftStatuses) {
  const skipCols = new Set([...SCHEDULE_META_COLS, "סטטוס", "_rowNum", "_status", "_errors"]);
  const values = {};
  const warnings = [];
  const rejectedFields = [];

  // Time column names (always pass through without validation)
  const TIME_COL_NAMES = new Set(["התחלה", "שעת התחלה", "סיום", "שעת סיום", "תדריך"]);

  // Build reverse map: workerId → nickname (for detecting if a stored value is already an ID)
  const workerIdSet = new Set(Object.values(workerNameToId));

  Object.entries(rawRow).forEach(([rawKey, rawVal]) => {
    // Apply alias mapping first
    const k = COLUMN_ALIAS_MAP[rawKey] ?? rawKey;

    if (skipCols.has(k)) return;
    if (k.startsWith("_")) return;
    if (k.endsWith("_subTypes")) return;

    const strVal = String(rawVal ?? "").trim();
    if (!strVal || strVal === "None") return; // skip empty

    // ── Worker columns ────────────────────────────────────────────────────────
    // A column is treated as a worker column if:
    //   (a) the template explicitly marks it as type "worker" (workerColNames), OR
    //   (b) the cell value resolves to a known worker nickname (nickname→ID lookup succeeds)
    //       This handles columns that were previously imported with type "text" instead of "worker"
    const stripped = strVal.startsWith("'") ? strVal.slice(1) : strVal;
    const resolvedWorkerId = workerNameToId[strVal] || workerNameToId[stripped];

    if (workerColNames.has(k) || resolvedWorkerId || workerIdSet.has(strVal)) {
      if (resolvedWorkerId) {
        // Resolved nickname → worker ID
        values[k] = resolvedWorkerId;
      } else if (workerIdSet.has(strVal)) {
        // Already a worker ID (e.g. re-import of already-resolved data)
        values[k] = strVal;
      } else if (workerColNames.has(k)) {
        // Explicitly a worker column but nickname not found — warn and skip field
        warnings.push(`העובד "${strVal}" לא נמצא עבור העמודה "${k}" — השדה לא יעודכן`);
        rejectedFields.push({ col: k, value: strVal, reason: `העובד "${strVal}" לא נמצא עבור העמודה "${k}"` });
      }
      return;
    }

    // ── Time columns — always pass through ────────────────────────────────────
    if (TIME_COL_NAMES.has(k)) {
      values[k] = strVal;
      return;
    }

    // ── Status ("סטטוס") — handled in caller via rawRow["סטטוס"] ────────────
    // (already in skipCols, handled separately)

    // ── Validate against allowed values ───────────────────────────────────────
    const deserialized = deserializeFromImport(strVal);

    // JSON quantitative objects — pass through (structure is valid by construction)
    if (typeof deserialized === "object" && deserialized !== null) {
      values[k] = deserialized;
      return;
    }

    if (colAllowedValues.has(k)) {
      const allowed = colAllowedValues.get(k);
      if (allowed === null) {
        // free-text column: any value OK
        values[k] = deserialized ?? strVal;
      } else if (allowed.has(strVal)) {
        values[k] = deserialized ?? strVal;
      } else {
        // Value not in settings — REJECT
        rejectedFields.push({ col: k, value: strVal, reason: `הערך "${strVal}" לא קיים בהגדרות עבור העמודה "${k}"` });
        warnings.push(`הערך "${strVal}" לא קיים בהגדרות עבור העמודה "${k}" — השדה לא יעודכן`);
      }
      return;
    }

    // Column not in settings at all — pass through (may be a time/text template column)
    if (deserialized !== null && deserialized !== undefined) {
      values[k] = deserialized;
    }
  });

  return { values, warnings, rejectedFields };
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

  // Step 2: Load DB data + app settings, build enriched & validated preview
  const handleBuildPreview = async () => {
    if (!parsedData) return;
    setLoadingPreview(true);

    const { rawSchedule, rawAvail } = parsedData;

    // Load everything in parallel
    const [allTemplates, workers, settingsCtx] = await Promise.all([
      base44.entities.Template.list(),
      base44.entities.Worker.list(),
      loadAppSettingsContext(),
    ]);

    const { colAllowedValues, shiftStatuses } = settingsCtx;

    const templateByName = {};
    allTemplates.forEach(t => { templateByName[t.name] = t; });

    const workerNameToId = {};
    workers.forEach(w => { if (w.nickname) workerNameToId[w.nickname] = w.id; });

    // Load existing TemplateRows for the dates in the import
    const importDates = [...new Set(rawSchedule.map(r => r["תאריך"]).filter(Boolean))];
    const existingRows = importDates.length > 0
      ? (await Promise.all(importDates.map(d => base44.entities.TemplateRow.filter({ date: d })))).flat()
      : [];

    // Build row-matching lookups (by _order primary, by index fallback)
    const existingRowByOrder = {};
    const existingRowByIndex = {};
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
        if (row.values?._order !== undefined && row.values?._order !== null) {
          existingRowByOrder[`${gKey}|${row.values._order}`] = row;
        }
        existingRowByIndex[`${gKey}|idx:${idx}`] = row;
      });
    });

    const lookupExistingRow = (date, groupId, order, rowIndexInGroup) => {
      const gKey = `${date}|${groupId}`;
      if (order !== "" && order !== undefined) {
        const found = existingRowByOrder[`${gKey}|${order}`];
        if (found) return found;
      }
      return existingRowByIndex[`${gKey}|idx:${rowIndexInGroup}`] || null;
    };

    const groupRowCounter = {};

    // Enrich + validate schedule rows
    const scheduleRows = rawSchedule.map((rawRow, i) => {
      const rowNum = i + 2;
      const errors = validateScheduleRow(rawRow);
      if (errors.length > 0) {
        return {
          _rowNum: rowNum, _status: "שגיאה", _errors: errors,
          תאריך: rawRow["תאריך"] || "", מוקד: rawRow["מוקד"] || "",
          _group_id: rawRow["_group_id"] || "", _order: rawRow["_order"] || "",
          _warnings: [], _parsedValues: {}, _rejectedFields: [], _action: "skip",
          _fieldsUpdated: [], _fieldsSkipped: [], _aliasedCols: [],
        };
      }

      const date      = rawRow["תאריך"];
      const mokedName = rawRow["מוקד"];
      const groupId   = rawRow["_group_id"] || "";
      const order     = rawRow["_order"] !== undefined ? String(rawRow["_order"]).trim() : "";
      const statusRaw = rawRow["סטטוס"] || "";

      const gKey = `${date}|${groupId}`;
      const rowIndexInGroup = groupRowCounter[gKey] ?? 0;
      groupRowCounter[gKey] = rowIndexInGroup + 1;

      const template = templateByName[mokedName];
      if (!template) {
        return {
          _rowNum: rowNum, _status: "שגיאה",
          _errors: [`מוקד "${mokedName}" לא קיים במערכת`],
          תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
          _warnings: [], _parsedValues: {}, _rejectedFields: [], _action: "skip",
          _fieldsUpdated: [], _fieldsSkipped: [], _aliasedCols: [],
          _rowIndexInGroup: rowIndexInGroup,
        };
      }

      const workerColNames = new Set(
        (template.columns || []).filter(c => c.type === "worker").map(c => c.name)
      );

      // Detect which raw columns were aliased (for preview display)
      const aliasedCols = Object.keys(rawRow)
        .filter(k => COLUMN_ALIAS_MAP[k])
        .map(k => `${k} → ${COLUMN_ALIAS_MAP[k]}`);

      const { values: parsedValues, warnings, rejectedFields } =
        resolveAndValidateRow(rawRow, workerColNames, workerNameToId, colAllowedValues, shiftStatuses);

      // Handle status separately: validate against shiftStatuses
      if (statusRaw) {
        const statusAllowed = colAllowedValues.get("סטטוס");
        if (!statusAllowed || statusAllowed.has(statusRaw)) {
          parsedValues.status = statusRaw;
        } else {
          warnings.push(`הסטטוס "${statusRaw}" לא קיים בהגדרות — הסטטוס לא יעודכן`);
          rejectedFields.push({ col: "סטטוס", value: statusRaw, reason: `הסטטוס "${statusRaw}" לא קיים בהגדרות` });
        }
      }

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

      const hasRejections = rejectedFields.length > 0;
      const status = warnings.length > 0 || hasRejections ? "אזהרה" : "תקין";

      return {
        _rowNum: rowNum, _status: status, _errors: [], _warnings: warnings,
        תאריך: date, מוקד: mokedName, _group_id: groupId, _order: order,
        _parsedValues: parsedValues,
        _rejectedFields: rejectedFields,
        _aliasedCols: aliasedCols,
        _action: existingRow ? "update" : "create",
        _existingRowId: existingRow?.id || null,
        _existingValues: existingRow?.values || null,
        _templateId: template.id,
        _fieldsUpdated: fieldsUpdated,
        _fieldsSkipped: fieldsSkipped,
        _rowIndexInGroup: rowIndexInGroup,
      };
    });

    // Compute which NEW columns will be added to templates (for display)
    const templateColsToAdd = {};
    for (const row of scheduleRows) {
      if (row._status === "שגיאה" || row._action === "skip") continue;
      const template = Object.values(templateByName).find(t => t.id === row._templateId);
      if (!template) continue;
      const existingColNames = new Set((template.columns || []).map(c => c.name));
      Object.keys(row._parsedValues || {}).forEach(k => {
        if (k === "status" || k.startsWith("_")) return;
        if (!existingColNames.has(k)) {
          if (!templateColsToAdd[template.name]) templateColsToAdd[template.name] = new Set();
          templateColsToAdd[template.name].add(k);
        }
      });
    }
    const templateColsToAddArr = {};
    Object.entries(templateColsToAdd).forEach(([k, v]) => { templateColsToAddArr[k] = [...v]; });

    // Availability rows
    const importWeeks = [...new Set(rawAvail.map(r => r["שבוע"]).filter(Boolean))];
    const existingAvailabilities = importWeeks.length > 0
      ? (await Promise.all(importWeeks.map(w => base44.entities.Availability.filter({ week_start_date: w })))).flat()
      : [];

    const availRows = rawAvail.map((rawRow, i) => {
      const errors = validateAvailRow(rawRow);
      return { ...rawRow, _rowNum: i + 2, _status: errors.length > 0 ? "שגיאה" : "תקין", _errors: errors };
    });

    setPreview({ scheduleRows, availRows, workers, existingAvailabilities, templateColsToAdd: templateColsToAddArr });
    setLoadingPreview(false);
  };

  // Step 3: Apply — only valid/warned rows (not errored), only validated fields
  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);

    const { scheduleRows, availRows, workers, existingAvailabilities } = preview;
    const workerNameToId = {};
    workers.forEach(w => { if (w.nickname) workerNameToId[w.nickname] = w.id; });

    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const resultRows = [];

    // ── STEP 0: Sync missing columns into Template.columns ────────────────────
    // Only add columns that are in parsedValues (already validated)
    // Never add aliased names like "task" — those are already mapped to "משימה"
    const templateColumnsNeeded = {};
    for (const row of scheduleRows) {
      if (row._status === "שגיאה" || row._action === "skip") continue;
      if (!templateColumnsNeeded[row._templateId]) templateColumnsNeeded[row._templateId] = new Set();
      Object.keys(row._parsedValues || {}).forEach(k => {
        if (k === "status" || k.startsWith("_")) return;
        templateColumnsNeeded[row._templateId].add(k);
      });
    }

    const templateIds = Object.keys(templateColumnsNeeded);
    if (templateIds.length > 0) {
      const freshTemplates = (await Promise.all(templateIds.map(id => base44.entities.Template.filter({ id })))).flat();
      const templateMap = {};
      freshTemplates.forEach(t => { templateMap[t.id] = t; });

      for (const templateId of templateIds) {
        const template = templateMap[templateId];
        if (!template) continue;
        const existingCols = template.columns || [];
        const existingColNames = new Set(existingCols.map(c => c.name));
        const missing = [...templateColumnsNeeded[templateId]].filter(n => !existingColNames.has(n));
        if (missing.length === 0) continue;

        // Build worker ID set for type inference
        const allWorkerIds = new Set(workers.map(w => w.id).filter(Boolean));

        const newCols = missing.map(name => {
          // Check if any existing col on this template has this name with a known type
          const existingMatch = existingCols.find(c =>
            c.name === name && ["worker", "time", "task"].includes(c.type)
          );
          if (existingMatch) return { ...existingMatch };

          // Infer type from actual values written to parsedValues for this column:
          // if the value is a worker ID, mark as worker type
          const sampleValue = scheduleRows
            .filter(r => r._parsedValues?.[name] !== undefined)
            .map(r => r._parsedValues[name])[0];
          if (sampleValue && allWorkerIds.has(sampleValue)) {
            return { name, type: "worker", width: 150 };
          }
          return { name, type: "text", width: 120 };
        });
        await base44.entities.Template.update(templateId, { columns: [...existingCols, ...newCols] });
      }
    }
    // ── END STEP 0 ────────────────────────────────────────────────────────────

    // Apply schedule rows
    for (const row of scheduleRows) {
      if (row._status === "שגיאה" || row._action === "skip") {
        errors++;
        resultRows.push({ ...row, _finalStatus: "שגיאה", _reason: row._errors.join("; ") });
        continue;
      }

      if (row._action === "update" && row._existingRowId) {
        const preserved = {};
        if (row._existingValues?._order !== undefined) preserved._order = row._existingValues._order;
        const newValues = { ...(row._existingValues || {}), ...row._parsedValues, ...preserved };
        await base44.entities.TemplateRow.update(row._existingRowId, { values: newValues });
        updated++;
        const rejSummary = row._rejectedFields?.length > 0
          ? ` | נדחו: ${row._rejectedFields.map(r => r.col).join(", ")}`
          : "";
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
          ? ` | נדחו: ${row._rejectedFields.map(r => r.col).join(", ")}`
          : "";
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
        if (!weekStart) {
          skipped++;
          resultRows.push({ ...row, _type: "avail", _finalStatus: "דולג", _reason: "חסר תאריך שבוע" });
          continue;
        }
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

      {/* Step 1b: File loaded */}
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

          {/* Aliased columns notice */}
          {(() => {
            const allAliased = [...new Set(preview.scheduleRows.flatMap(r => r._aliasedCols || []))];
            return allAliased.length > 0 ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800 space-y-1">
                <div className="font-semibold">מיפוי עמודות:</div>
                {allAliased.map(a => <div key={a} className="text-xs">{a}</div>)}
              </div>
            ) : null;
          })()}

          {/* New columns to be created */}
          {Object.keys(preview.templateColsToAdd || {}).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
              <div className="font-semibold">עמודות חדשות שייווצרו בתבניות:</div>
              {Object.entries(preview.templateColsToAdd).map(([tmplName, cols]) => (
                <div key={tmplName} className="text-xs">
                  <span className="font-medium">{tmplName}:</span> {cols.join(", ")}
                </div>
              ))}
            </div>
          )}

          {/* Rejected fields summary */}
          {preview.scheduleRows.some(r => (r._rejectedFields || []).length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              <div className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                שדות שנדחו (לא קיימים בהגדרות):
              </div>
              {preview.scheduleRows.flatMap(r => r._rejectedFields || []).slice(0, 10).map((rf, i) => (
                <div key={i} className="text-xs">{rf.reason}</div>
              ))}
              {preview.scheduleRows.flatMap(r => r._rejectedFields || []).length > 10 && (
                <div className="text-xs text-red-500">...ועוד</div>
              )}
            </div>
          )}

          <DiagnosticPreviewTable rows={preview.scheduleRows} />

          {preview.scheduleRows.some(r => r._status === "שגיאה") && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              שורות עם שגיאות יידלגו בעת הייבוא. שורות עם אזהרות ייובאו עם השדות התקפים בלבד.
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
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">סדר</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">פעולה</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">שדות תקינים</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">שדות שנדחו</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const actionLabel = row._action === "create" ? "יצירה" : row._action === "update" ? "עדכון" : "דילוג";
                const actionColor = row._action === "create" ? "text-emerald-700" : row._action === "update" ? "text-blue-700" : "text-gray-400";
                const rejected = row._rejectedFields || [];
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400">{row._rowNum}</td>
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{row["תאריך"] || "-"}</td>
                    <td className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate" title={row["מוקד"]}>{row["מוקד"] || "-"}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-center">{row._order !== undefined && row._order !== "" ? row._order : "-"}</td>
                    <td className={`px-2 py-1.5 font-semibold ${actionColor}`}>{actionLabel}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[160px]">
                      {row._status === "שגיאה"
                        ? <span className="text-red-600">{row._errors.join("; ")}</span>
                        : row._fieldsUpdated?.length > 0
                          ? <span className="text-blue-700 truncate block" title={row._fieldsUpdated.join(", ")}>{row._fieldsUpdated.join(", ")}</span>
                          : <span className="text-gray-300">ללא שינויים</span>
                      }
                    </td>
                    <td className="px-2 py-1.5 max-w-[160px]">
                      {rejected.length > 0
                        ? <span className="text-red-600 truncate block" title={rejected.map(r => r.reason).join("; ")}>
                            {rejected.map(r => r.col).join(", ")}
                          </span>
                        : row._warnings?.length > 0
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
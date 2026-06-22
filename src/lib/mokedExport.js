/**
 * Shared מוקד export engine.
 * Called by ExportPanel (date-based export) and Schedule (מוקד-selection export).
 * Both produce identical file structure.
 */
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  sanitizeText,
  serializeForExport,
  getInternalValueKey,
  isKnownWorkerCol,
  EXPORT_VERSION,
  EXPORT_SOURCE_NAME,
  SHEET_MANIFEST,
  SHEET_MOKED_TEMPLATES,
  SHEET_MOKED_COLUMNS,
  SHEET_MOKED_ROWS,
  SHEET_MOKED_VALUES,
  SHEET_WORKERS_MAP,
  SHEET_HUMAN_READABLE,
} from "@/lib/dataTransferSchema";

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

/**
 * Build effective columns for a template on a given date.
 * Mirrors Schedule.jsx / ExportPanel logic exactly.
 */
function getEffectiveColumns(tmpl, dateStr, dailyColumnsPerDate, columnOrderPerDate) {
  const dailyCustomColumns = dailyColumnsPerDate[dateStr] || {};
  const customColumnOrders = columnOrderPerDate[dateStr] || {};
  const templateCols = tmpl.columns || [];
  const dailyCols = dailyCustomColumns[tmpl.id] || [];
  const allColNames = new Set(templateCols.map(c => c.name));
  const uniqueDailyCols = dailyCols.filter(c => !allColNames.has(c.name));
  const allCols = [...templateCols, ...uniqueDailyCols];
  const customOrder = customColumnOrders[tmpl.id];
  if (!customOrder) return allCols;
  return [
    ...customOrder.map(name => allCols.find(c => c.name === name)).filter(Boolean),
    ...allCols.filter(c => !customOrder.includes(c.name)),
  ];
}

/**
 * Run the export and trigger a browser file download.
 *
 * @param {object} params
 * @param {object[]} params.workers
 * @param {object[]} params.allTemplates
 * @param {object[]} params.templateRows  — all rows (will be filtered to dates + selectedTemplateIds)
 * @param {object[]} params.allSettings   — AppSettings records
 * @param {string[]} params.dates         — sorted ISO date strings to include
 * @param {string[]|null} params.selectedTemplateIds — null/[] = all templates
 * @param {object|null}  params.currentUser
 * @param {function|null} params.onAuditLog
 * @param {function} params.createAuditLog — (data) => Promise — caller provides so we don't import base44 here
 * @returns {Promise<void>}
 */
export async function runMokedExport({
  workers,
  allTemplates,
  templateRows,
  allSettings,
  dates,
  selectedTemplateIds,
  currentUser,
  onAuditLog,
  createAuditLog,
}) {
  const dateSet = new Set(dates);
  const dateStart = dates[0];
  const dateEnd = dates[dates.length - 1];

  // Build per-date daily columns and column orders from AppSettings
  const dailyColumnsPerDate = {};
  const columnOrderPerDate = {};
  allSettings.forEach(s => {
    const dcMatch = s.setting_key.match(/^schedule_daily_columns_(.+)$/);
    if (dcMatch) { try { dailyColumnsPerDate[dcMatch[1]] = JSON.parse(s.setting_value); } catch {} }
    const coMatch = s.setting_key.match(/^schedule_column_order_(.+)$/);
    if (coMatch) { try { columnOrderPerDate[coMatch[1]] = JSON.parse(s.setting_value); } catch {} }
  });

  // Build a name → registry mapping_id lookup from the column registry
  // (AppSettings "custom_schedule_params"). This is the source of the col_XX IDs
  // set in Settings → "עמודות לוח ודוחות". Columns are matched across networks by
  // this stable ID, never by their local display name.
  const colRegistry = (() => {
    const s = allSettings.find(x => x.setting_key === "custom_schedule_params");
    if (!s) return [];
    try { return JSON.parse(s.setting_value) || []; } catch { return []; }
  })();
  const colMappingIdByName = {};
  colRegistry.forEach(c => {
    if (c && c.name && c.mapping_id) colMappingIdByName[String(c.name).trim()] = c.mapping_id;
  });
  const resolveColMappingId = (col) => {
    if (!col) return "";
    if (col.mapping_id) return col.mapping_id;
    if (col.name && colMappingIdByName[String(col.name).trim()]) return colMappingIdByName[String(col.name).trim()];
    return "";
  };

  const workerById = {};
  workers.forEach(w => { workerById[w.id] = w; });

  const templateById = {};
  allTemplates.forEach(t => { templateById[t.id] = t; });

  const tmplIdSet = (selectedTemplateIds && selectedTemplateIds.length > 0) ? new Set(selectedTemplateIds) : null;

  const filteredRows = templateRows
    .filter(r => dateSet.has(r.date) && (!tmplIdSet || tmplIdSet.has(r.template_id)))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if ((a.group_id || "") !== (b.group_id || "")) return (a.group_id || "").localeCompare(b.group_id || "");
      const aO = a.values?._order ?? Infinity;
      const bO = b.values?._order ?? Infinity;
      if (aO !== bO) return aO - bO;
      return new Date(a.created_date) - new Date(b.created_date);
    });

  // Assign stable _order
  const groupOrderCounter = {};
  filteredRows.forEach(row => {
    const gKey = `${row.date}|${row.group_id || ""}`;
    if (groupOrderCounter[gKey] === undefined) groupOrderCounter[gKey] = 0;
    row._stableOrder = (row.values?._order === undefined || row.values?._order === null)
      ? groupOrderCounter[gKey]
      : row.values._order;
    groupOrderCounter[gKey]++;
  });

  if (filteredRows.length === 0) {
    alert("לא נמצאו נתונים לטווח שנבחר.");
    return;
  }

  const exportedAt = format(new Date(), "yyyy-MM-dd HH:mm");
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Manifest ───────────────────────────────────────────────────────
  const manifestData = [
    ["export_version", EXPORT_VERSION],
    ["export_date", exportedAt],
    ["source", EXPORT_SOURCE_NAME],
    ["date_start", dateStart],
    ["date_end", dateEnd],
    ["days_count", dates.length],
    ["rows_count", filteredRows.length],
    ["selected_templates", tmplIdSet ? selectedTemplateIds.length : "all"],
    ["exported_by", sanitizeText(currentUser?.email || "")],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(manifestData), SHEET_MANIFEST);

  // ── Sheet 2: MokedTemplates ─────────────────────────────────────────────────
  const usedTemplateIds = new Set(filteredRows.map(r => r.template_id));
  const usedTemplates = allTemplates.filter(t => usedTemplateIds.has(t.id) && t.is_exportable !== false);

  const tmplHeader = [
    "template_id", "template_mapping_id", "color", "is_default", "active",
    "is_importable", "is_exportable",
  ];
  const tmplRows = usedTemplates.map(t => [
    t.id,
    sanitizeText(t.mapping_id || ""),
    t.color || "#3b82f6",
    t.is_default ? "true" : "false",
    t.active !== false ? "true" : "false",
    t.is_importable !== false ? "true" : "false",
    t.is_exportable !== false ? "true" : "false",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tmplHeader, ...tmplRows]), SHEET_MOKED_TEMPLATES);

  // ── Sheet 3: MokedColumns ───────────────────────────────────────────────────
  const colHeader = [
    "template_id", "template_mapping_id", "column_index",
    "column_mapping_id", "internal_value_key", "type", "width",
    "default_value", "options_json", "role_filter", "role_mapping_id", "is_worker_column",
    "is_task_column", "is_importable", "is_exportable",
  ];
  const colRows = [];
  const firstDateByTemplate = {};
  filteredRows.forEach(r => {
    if (!firstDateByTemplate[r.template_id]) firstDateByTemplate[r.template_id] = r.date;
  });
  usedTemplates.forEach(t => {
    const firstDate = firstDateByTemplate[t.id] || dates[0];
    const effectiveCols = getEffectiveColumns(t, firstDate, dailyColumnsPerDate, columnOrderPerDate);
    effectiveCols.forEach((col, idx) => {
      if (col.is_exportable === false) return;
      const isTask = col.type === "task";
      const internalKey = isTask ? "task" : getInternalValueKey(col);
      const isWorker = !isTask && (col.type === "worker" || isKnownWorkerCol(col.name));
      colRows.push([
        t.id,
        sanitizeText(t.mapping_id || ""),
        idx,
        sanitizeText(isTask ? "__task__" : resolveColMappingId(col)),
        sanitizeText(internalKey),
        sanitizeText(isTask ? "task" : col.type || "text"),
        col.width || 120,
        sanitizeText(col.default_value || ""),
        col.options ? JSON.stringify(col.options) : "",
        sanitizeText(col.role_filter || ""),
        sanitizeText(col.role_mapping_id || ""),
        isWorker ? "true" : "false",
        isTask   ? "true" : "false",
        col.is_importable !== false ? "true" : "false",
        col.is_exportable !== false ? "true" : "false",
      ]);
    });
    colRows.push([
      t.id, sanitizeText(t.mapping_id || ""),
      effectiveCols.length,
      "__status__", "status", "select", 100,
      "", "", "", "", "false", "false",
      "true", "true",
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colHeader, ...colRows]), SHEET_MOKED_COLUMNS);

  // ── Sheet 4: MokedRows ──────────────────────────────────────────────────────
  const rowHeader = ["row_id", "template_id", "template_name", "date", "group_id", "_order", "created_date"];
  const rowData = filteredRows.map(row => [
    row.id,
    row.template_id,
    sanitizeText(row.template_name || templateById[row.template_id]?.name || ""),
    row.date,
    sanitizeText(row.group_id || ""),
    row._stableOrder,
    row.created_date || "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([rowHeader, ...rowData]), SHEET_MOKED_ROWS);

  // ── Sheet 5: MokedValues ────────────────────────────────────────────────────
  const valHeader = [
    "row_id", "template_id", "date",
    "group_id", "_order",
    "template_mapping_id", "column_mapping_id",
    "internal_value_key", "column_type", "is_worker_column", "is_task_column",
    "value_raw",
  ];
  const valRows = [];
  filteredRows.forEach(row => {
    const tmpl = templateById[row.template_id];
    if (!tmpl) return;
    const values = row.values || {};
    const effectiveCols = getEffectiveColumns(tmpl, row.date, dailyColumnsPerDate, columnOrderPerDate);
    const allCols = [...effectiveCols, { name: "status", type: "select", _isStatusCol: true }];
    allCols.forEach(col => {
      if (!col._isStatusCol && col.is_exportable === false) return;
      const isTask   = !col._isStatusCol && col.type === "task";
      const internalKey = col._isStatusCol ? "status" : (isTask ? "task" : getInternalValueKey(col));
      const isWorker = !col._isStatusCol && !isTask && (col.type === "worker" || isKnownWorkerCol(col.name));
      const colMappingId = col._isStatusCol ? "__status__" : (isTask ? "__task__" : resolveColMappingId(col));
      const rawVal = values[internalKey];
      let exportValue = "";
      if (!isEmpty(rawVal)) {
        if (isWorker) {
          const w = workerById[rawVal];
          exportValue = w ? sanitizeText(w.worker_mapping_id || w.id) : sanitizeText(String(rawVal));
        } else {
          exportValue = serializeForExport(rawVal);
        }
      }
      const subTypesKey = `${internalKey}_subTypes`;
      const subTypesVal = values[subTypesKey];
      const subTypesExported = !isEmpty(subTypesVal) ? serializeForExport(subTypesVal) : "";

      valRows.push([
        row.id, row.template_id, row.date,
        sanitizeText(row.group_id || ""),
        row._stableOrder,
        sanitizeText(tmpl.mapping_id || ""),
        sanitizeText(colMappingId),
        sanitizeText(internalKey),
        sanitizeText(isTask ? "task" : col.type || "text"),
        isWorker ? "true" : "false",
        isTask   ? "true" : "false",
        exportValue,
      ]);

      if (subTypesExported) {
        valRows.push([
          row.id, row.template_id, row.date,
          sanitizeText(row.group_id || ""),
          row._stableOrder,
          sanitizeText(tmpl.mapping_id || ""),
          sanitizeText(colMappingId ? `${colMappingId}_subTypes` : ""),
          sanitizeText(subTypesKey),
          "subtypes", "false", "false",
          subTypesExported,
        ]);
      }
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([valHeader, ...valRows]), SHEET_MOKED_VALUES);

  // ── Sheet 6: WorkersMap ─────────────────────────────────────────────────────
  const workerHeader = ["worker_id", "worker_mapping_id", "nickname", "roles", "active"];
  const workerRowsData = workers.map(w => [
    w.id,
    sanitizeText(w.worker_mapping_id || ""),
    sanitizeText(w.nickname || ""),
    Array.isArray(w.role) ? w.role.join(", ") : (w.role || ""),
    w.active !== false ? "true" : "false",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([workerHeader, ...workerRowsData]), SHEET_WORKERS_MAP);

  // ── Sheet 7: HumanReadableSchedule ─────────────────────────────────────────
  const hrRows = [["תאריך", "מוקד", "קבוצה", "שורה", "עמודה", "ערך"]];
  filteredRows.forEach(row => {
    const tmpl = templateById[row.template_id];
    if (!tmpl) return;
    const values = row.values || {};
    const effectiveCols = getEffectiveColumns(tmpl, row.date, dailyColumnsPerDate, columnOrderPerDate);
    const allCols = [...effectiveCols, { name: "status", type: "select" }];
    allCols.forEach(col => {
      const isTask = col.type === "task";
      const internalKey = isTask ? "task" : getInternalValueKey(col);
      const displayColName = isTask ? "משימה" : col.name;
      const rawVal = values[internalKey];
      const subTypesVal = values[`${internalKey}_subTypes`];
      const hasSubTypes = Array.isArray(subTypesVal) && subTypesVal.length > 0;
      if (isEmpty(rawVal) && !hasSubTypes) return;
      let displayVal;
      if (!isTask && (col.type === "worker" || isKnownWorkerCol(col.name))) {
        const w = workerById[rawVal];
        displayVal = w ? (w.nickname || w.id) : String(rawVal || "");
      } else if (!isEmpty(rawVal)) {
        displayVal = serializeForExport(rawVal);
      } else if (hasSubTypes) {
        displayVal = subTypesVal.join(", ");
      } else {
        return;
      }
      hrRows.push([
        row.date,
        sanitizeText(tmpl.name),
        sanitizeText(row.group_id || ""),
        row._stableOrder,
        sanitizeText(displayColName),
        sanitizeText(displayVal),
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hrRows), SHEET_HUMAN_READABLE);

  // ── Write file ──────────────────────────────────────────────────────────────
  const fileName = `export_${dateStart}_${dateEnd}.xlsx`;
  XLSX.writeFile(wb, fileName);

  if (createAuditLog) {
    await createAuditLog({
      action_type: "export",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: filteredRows.length,
      date_range_start: dateStart,
      date_range_end: dateEnd,
    });
  }
  if (onAuditLog) onAuditLog();
}
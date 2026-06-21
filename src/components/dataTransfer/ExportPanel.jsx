import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Loader2 } from "lucide-react";
import {
  sanitizeText,
  isEmpty,
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

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export default function ExportPanel({ currentUser, onAuditLog }) {
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });

  const toggleDate = (day) => {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setDone(false);
  };

  const selectMonth = () => {
    setSelectedDates(new Set(calDays.map(d => format(d, "yyyy-MM-dd"))));
    setDone(false);
  };

  const clearSelection = () => { setSelectedDates(new Set()); setDone(false); };

  const handleExport = async () => {
    if (selectedDates.size === 0) return;
    setExporting(true);
    setDone(false);

    const dates = [...selectedDates].sort();
    const dateStart = dates[0];
    const dateEnd = dates[dates.length - 1];
    const dateSet = new Set(dates);

    // ── Step 1: Load all source data ─────────────────────────────────────────
    const [workers, allTemplates, templateRows, allSettings] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Template.list(),
      base44.entities.TemplateRow.list(),
      base44.entities.AppSettings.list(),
    ]);

    // Build lookups
    const workerById = {};
    workers.forEach(w => { workerById[w.id] = w; });

    const templateById = {};
    allTemplates.forEach(t => { templateById[t.id] = t; });

    // Build per-date daily columns and column orders from AppSettings
    const dailyColumnsPerDate = {};   // dateStr → { [templateId]: col[] }
    const columnOrderPerDate = {};    // dateStr → { [templateId]: string[] }
    allSettings.forEach(s => {
      const dcMatch = s.setting_key.match(/^schedule_daily_columns_(.+)$/);
      if (dcMatch) {
        try { dailyColumnsPerDate[dcMatch[1]] = JSON.parse(s.setting_value); } catch {}
      }
      const coMatch = s.setting_key.match(/^schedule_column_order_(.+)$/);
      if (coMatch) {
        try { columnOrderPerDate[coMatch[1]] = JSON.parse(s.setting_value); } catch {}
      }
    });

    // Build effective columns for a given template + date (mirrors Schedule.jsx logic exactly)
    const getEffectiveColumns = (tmpl, dateStr) => {
      const dailyCustomColumns = dailyColumnsPerDate[dateStr] || {};
      const customColumnOrders = columnOrderPerDate[dateStr] || {};
      const templateCols = tmpl.columns || [];
      const dailyCols = dailyCustomColumns[tmpl.id] || [];
      // Deduplicate: daily cols that don't already exist in template cols by name
      const allColNames = new Set(templateCols.map(c => c.name));
      const uniqueDailyCols = dailyCols.filter(c => !allColNames.has(c.name));
      const allCols = [...templateCols, ...uniqueDailyCols];
      const customOrder = customColumnOrders[tmpl.id];
      if (!customOrder) return allCols;
      // Apply custom order: ordered first, then remainder
      const ordered = [
        ...customOrder.map(name => allCols.find(c => c.name === name)).filter(Boolean),
        ...allCols.filter(c => !customOrder.includes(c.name)),
      ];
      return ordered;
    };

    // Filter rows to selected dates, sorted stably
    const filteredRows = templateRows
      .filter(r => dateSet.has(r.date))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if ((a.group_id || "") !== (b.group_id || "")) return (a.group_id || "").localeCompare(b.group_id || "");
        const aO = a.values?._order ?? Infinity;
        const bO = b.values?._order ?? Infinity;
        if (aO !== bO) return aO - bO;
        return new Date(a.created_date) - new Date(b.created_date);
      });

    // Assign stable _order per group if missing
    const groupOrderCounter = {};
    filteredRows.forEach(row => {
      const gKey = `${row.date}|${row.group_id || ""}`;
      if (groupOrderCounter[gKey] === undefined) groupOrderCounter[gKey] = 0;
      if (row.values?._order === undefined || row.values?._order === null) {
        row._stableOrder = groupOrderCounter[gKey];
      } else {
        row._stableOrder = row.values._order;
      }
      groupOrderCounter[gKey]++;
    });

    if (filteredRows.length === 0) {
      setExporting(false);
      alert("לא נמצאו נתונים לטווח התאריכים שנבחר.");
      return;
    }

    const exportedAt = format(new Date(), "yyyy-MM-dd HH:mm");
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Manifest ─────────────────────────────────────────────────────
    const manifestData = [
      ["export_version", EXPORT_VERSION],
      ["export_date", exportedAt],
      ["source", EXPORT_SOURCE_NAME],
      ["date_start", dateStart],
      ["date_end", dateEnd],
      ["days_count", dates.length],
      ["rows_count", filteredRows.length],
      ["exported_by", sanitizeText(currentUser?.email || "")],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(manifestData), SHEET_MANIFEST);

    // ── Sheet 2: MokedTemplates ───────────────────────────────────────────────
    // Collect only templates that appear in filtered rows, skip non-exportable
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

    // ── Sheet 3: MokedColumns ─────────────────────────────────────────────────
    // One row per effective column per template, using the first date the template appears on
    const colHeader = [
      "template_id", "template_mapping_id", "column_index",
      "column_mapping_id", "internal_value_key", "type", "width",
      "default_value", "options_json", "role_filter", "role_mapping_id", "is_worker_column",
      "is_task_column", "is_importable", "is_exportable",
    ];
    const colRows = [];
    // Find the first date each template appears on (for effective column resolution)
    const firstDateByTemplate = {};
    filteredRows.forEach(r => {
      if (!firstDateByTemplate[r.template_id]) firstDateByTemplate[r.template_id] = r.date;
    });
    usedTemplates.forEach(t => {
      const firstDate = firstDateByTemplate[t.id] || dates[0];
      const effectiveCols = getEffectiveColumns(t, firstDate);
      effectiveCols.forEach((col, idx) => {
        if (col.is_exportable === false) return; // skip non-exportable columns
        const isTask = col.type === "task";
        const internalKey = isTask ? "task" : getInternalValueKey(col);
        const isWorker = !isTask && (col.type === "worker" || isKnownWorkerCol(col.name));
        colRows.push([
          t.id,
          sanitizeText(t.mapping_id || ""),
          idx,
          sanitizeText(isTask ? "__task__" : (col.mapping_id || "")),
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
      // Always add the implicit "status" column at the end
      colRows.push([
        t.id, sanitizeText(t.mapping_id || ""),
        effectiveCols.length,
        "__status__", "status", "select", 100,
        "", "", "", "false", "false",
        "true", "true",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colHeader, ...colRows]), SHEET_MOKED_COLUMNS);

    // ── Sheet 4: MokedRows ────────────────────────────────────────────────────
    const rowHeader = [
      "row_id", "template_id", "template_name", "date",
      "group_id", "_order", "created_date",
    ];
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

    // ── Sheet 5: MokedValues ──────────────────────────────────────────────────
    // One row per (row × column) cell value
    // Identity uses mapping_id only — no local/exported display names
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

      // Use effective columns for this row's date (mirrors Schedule.jsx exactly)
      const effectiveCols = getEffectiveColumns(tmpl, row.date);
      // Add implicit status column
      const allCols = [...effectiveCols, { name: "status", type: "select", _isStatusCol: true }];

      allCols.forEach(col => {
        if (!col._isStatusCol && col.is_exportable === false) return; // skip non-exportable
        const isTask   = !col._isStatusCol && col.type === "task";
        const internalKey = col._isStatusCol ? "status" : (isTask ? "task" : getInternalValueKey(col));
        const isWorker = !col._isStatusCol && !isTask && (col.type === "worker" || isKnownWorkerCol(col.name));
        // Use fixed sentinel for status/task, or mapping_id for regular cols
        const colMappingId = col._isStatusCol ? "__status__" : (isTask ? "__task__" : (col.mapping_id || ""));

        const rawVal = values[internalKey];

        // For worker columns: export mapping_id if available, fallback to worker_id
        let exportValue = "";
        if (!isEmpty(rawVal)) {
          if (isWorker) {
            const w = workerById[rawVal];
            exportValue = w ? sanitizeText(w.worker_mapping_id || w.id) : sanitizeText(String(rawVal));
            if (!w) console.warn(`[Export] Worker ID not found: ${rawVal} in col ${col.name}`);
          } else {
            exportValue = serializeForExport(rawVal);
          }
        }

        // Also export _subTypes for ColumnCell columns
        const subTypesKey = `${internalKey}_subTypes`;
        const subTypesVal = values[subTypesKey];
        const subTypesExported = !isEmpty(subTypesVal) ? serializeForExport(subTypesVal) : "";

        valRows.push([
          row.id,
          row.template_id,
          row.date,
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

        // Export subTypes as a separate row if present
        if (subTypesExported) {
          valRows.push([
            row.id, row.template_id,
            row.date,
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

    // ── Sheet 6: WorkersMap ───────────────────────────────────────────────────
    const workerHeader = ["worker_id", "worker_mapping_id", "nickname", "roles", "active"];
    const workerRows = workers.map(w => [
      w.id,
      sanitizeText(w.worker_mapping_id || ""),
      sanitizeText(w.nickname || ""),
      Array.isArray(w.role) ? w.role.join(", ") : (w.role || ""),
      w.active !== false ? "true" : "false",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([workerHeader, ...workerRows]), SHEET_WORKERS_MAP);

    // ── Sheet 7: HumanReadableSchedule ───────────────────────────────────────
    // Build a flat readable view grouped by template
    const hrRows = [["תאריך", "מוקד", "קבוצה", "שורה", "עמודה", "ערך"]];
    filteredRows.forEach(row => {
      const tmpl = templateById[row.template_id];
      if (!tmpl) return;
      const values = row.values || {};
      const effectiveCols = getEffectiveColumns(tmpl, row.date);
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

    // ── Write file ────────────────────────────────────────────────────────────
    const fileName = `export_${dateStart}_${dateEnd}.xlsx`;
    XLSX.writeFile(wb, fileName);

    await base44.entities.AuditLog.create({
      action_type: "export",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: filteredRows.length,
      date_range_start: dateStart,
      date_range_end: dateEnd,
    });
    if (onAuditLog) onAuditLog();

    setExporting(false);
    setDone(true);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">בחר ימים לייצוא</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {HEBREW_MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={selectMonth} className="text-xs">בחר חודש שלם</Button>
            {selectedDates.size > 0 && (
              <Button size="sm" variant="ghost" onClick={clearSelection} className="text-xs text-gray-500">נקה בחירה</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
            {["א","ב","ג","ד","ה","ו","ש"].map((d,i) => (
              <div key={i} className="font-semibold text-gray-500 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calDays[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {calDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const selected = selectedDates.has(key);
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={key}
                  onClick={() => toggleDate(day)}
                  className={`h-8 w-full rounded text-xs font-medium transition-all border
                    ${selected ? "bg-blue-900 text-white border-blue-900" : "bg-white hover:bg-blue-50 border-gray-200 text-gray-700"}
                    ${today ? "ring-2 ring-blue-400" : ""}
                  `}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
          {selectedDates.size > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-right">{selectedDates.size} ימים נבחרו</p>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleExport}
        disabled={selectedDates.size === 0 || exporting}
        className="w-full bg-blue-900 hover:bg-blue-800 text-white h-10"
      >
        {exporting ? (
          <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייצא...</>
        ) : done ? (
          <><CheckCircle2 className="w-4 h-4 ml-2 text-green-300" />הייצוא הושלם בהצלחה</>
        ) : (
          <><Download className="w-4 h-4 ml-2" />ייצוא נתונים ({selectedDates.size} ימים)</>
        )}
      </Button>

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          ✓ הקובץ הורד בהצלחה ונרשם ביומן הביקורת.
          <div className="text-xs text-green-700 mt-1">הקובץ כולל גיליונות מובנים: MokedTemplates, MokedColumns, MokedRows, MokedValues, WorkersMap</div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Loader2 } from "lucide-react";
import { sanitizeText } from "@/lib/dataTransferSchema";

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

    // Load all needed data in parallel
    const [workers, allTemplates, templateRows, availabilities] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Template.list(),
      base44.entities.TemplateRow.list(),
      base44.entities.Availability.list(),
    ]);

    // Build a map of worker id -> nickname
    const workerMap = {};
    workers.forEach(w => { workerMap[w.id] = w.nickname || w.id; });

    // Build a map of template id -> template
    const templateMap = {};
    allTemplates.forEach(t => { templateMap[t.id] = t; });

    // Filter rows to selected dates
    const filteredRows = templateRows.filter(r => dateSet.has(r.date));

    // Build schedule sheet: one row per TemplateRow
    // Columns: תאריך, שם מוקד, + all column names that appear, + סטטוס
    // First pass: collect all column names across filtered rows
    const colNamesSet = new Set();
    filteredRows.forEach(row => {
      const template = templateMap[row.template_id];
      if (!template) return;
      const allCols = [...(template.columns || [])];
      allCols.forEach(col => colNamesSet.add(col.name));
      // Also include keys from values that aren't internal
      Object.keys(row.values || {}).forEach(k => {
        if (!["is_continuation", "continuation_from_date", "continuation_source_row_id", "status"].includes(k)
            && !k.endsWith("_subTypes")) {
          colNamesSet.add(k);
        }
      });
    });
    const colNames = [...colNamesSet];

    // Build header row
    const scheduleHeader = ["תאריך", "מוקד", "_group_id", ...colNames, "סטטוס"];

    // Build data rows
    const scheduleRows = filteredRows.map(row => {
      const template = templateMap[row.template_id];
      const mokedName = sanitizeText(template?.name || row.template_name || "");
      const values = row.values || {};

      const cells = colNames.map(colName => {
        let val = values[colName];
        if (val === undefined || val === null) return "";
        // If value is a worker ID, resolve to name
        if (typeof val === "string" && workerMap[val]) return sanitizeText(workerMap[val]);
        return sanitizeText(String(val));
      });

      return [
        sanitizeText(row.date),
        mokedName,
        sanitizeText(row.group_id || ""),
        ...cells,
        sanitizeText(values.status || ""),
      ];
    });

    // Build availability sheet
    const filteredAvailabilities = availabilities.filter(av =>
      (av.shifts || []).some(s => dateSet.has(s.date))
    );
    const availHeader = ["מזהה עובד", "שם עובד", "שבוע", "תאריך משמרת", "שעת התחלה", "שעת סיום", "סוג זמינות", "סטטוס הגשה"];
    const availRows = filteredAvailabilities.flatMap(av => {
      const worker = workers.find(w => w.id === av.worker_id);
      if (!worker) return [];
      return (av.shifts || [])
        .filter(s => dateSet.has(s.date))
        .map(s => [
          sanitizeText(worker.id),
          sanitizeText(worker.nickname || ""),
          sanitizeText(av.week_start_date),
          sanitizeText(s.date),
          sanitizeText(s.start_time || ""),
          sanitizeText(s.end_time || ""),
          sanitizeText(s.type || ""),
          sanitizeText(av.status || ""),
        ]);
    });

    const totalRows = scheduleRows.length + availRows.length;
    if (totalRows === 0) {
      setExporting(false);
      alert("לא נמצאו נתונים לטווח התאריכים שנבחר.");
      return;
    }

    // Build workbook
    const wb = XLSX.utils.book_new();

    const scheduleSheet = XLSX.utils.aoa_to_sheet([scheduleHeader, ...scheduleRows]);
    XLSX.utils.book_append_sheet(wb, scheduleSheet, "לוח משמרות");

    const availSheet = XLSX.utils.aoa_to_sheet([availHeader, ...availRows]);
    XLSX.utils.book_append_sheet(wb, availSheet, "זמינות");

    const exportedAt = format(new Date(), "yyyy-MM-dd HH:mm");
    const metaSheet = XLSX.utils.aoa_to_sheet([
      ["מקור", "מערכת ניהול כוח אדם"],
      ["תאריך ייצוא", exportedAt],
      ["תאריך התחלה", dateStart],
      ["תאריך סיום", dateEnd],
      ["מספר ימים", dates.length],
      ["שורות לוח משמרות", scheduleRows.length],
      ["שורות זמינות", availRows.length],
      ["מייצא", sanitizeText(currentUser?.email || "")],
    ]);
    XLSX.utils.book_append_sheet(wb, metaSheet, "מטא-נתונים");

    const fileName = `export_${dateStart}_${dateEnd}.xlsx`;
    XLSX.writeFile(wb, fileName);

    // Audit log
    await base44.entities.AuditLog.create({
      action_type: "export",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: totalRows,
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
        </div>
      )}
    </div>
  );
}
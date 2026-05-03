import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Loader2 } from "lucide-react";
import {
  EXPORT_SOURCE_NAME,
  ASSIGNMENT_SCHEMA,
  AVAILABILITY_SCHEMA,
  SHEET_ASSIGNMENTS,
  SHEET_AVAILABILITY,
  SHEET_META,
  sanitizeText,
} from "@/lib/dataTransferSchema";

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function buildHeaderRow(schema) {
  return Object.values(schema).map(d => d.label);
}

function assignmentToRow(a, workers) {
  const worker = workers.find(w => w.id === a.chef_id || w.id === a.sous_chef_id || w.id === a.additional_chef_id);
  // We export one row per worker-assignment combination
  const rows = [];
  const pushRow = (wid, role) => {
    const w = workers.find(x => x.id === wid);
    if (!w) return;
    rows.push([
      sanitizeText(w.id),
      sanitizeText(w.nickname || ""),
      sanitizeText(a.date),
      sanitizeText(a.start_time),
      sanitizeText(a.end_time),
      a.hours ?? "",
      sanitizeText(role),
      sanitizeText(a.status || ""),
      sanitizeText(a.notes || ""),
    ]);
  };
  if (a.chef_id)            pushRow(a.chef_id, a.chef_seniority || "שף");
  if (a.sous_chef_id)       pushRow(a.sous_chef_id, a.sous_chef_seniority || "סו-שף");
  if (a.additional_chef_id) pushRow(a.additional_chef_id, a.additional_chef_role || "נוסף");
  return rows;
}

function availabilityToRows(av, workers) {
  const worker = workers.find(w => w.id === av.worker_id);
  if (!worker) return [];
  return (av.shifts || []).map(s => [
    sanitizeText(worker.id),
    sanitizeText(worker.nickname || ""),
    sanitizeText(av.week_start_date),
    sanitizeText(s.date),
    sanitizeText(s.start_time),
    sanitizeText(s.end_time),
    sanitizeText(s.type || ""),
    sanitizeText(av.status || ""),
  ]);
}

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
    const keys = calDays.map(d => format(d, "yyyy-MM-dd"));
    setSelectedDates(new Set(keys));
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

    const [workers, assignments, availabilities] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Assignment.list(),
      base44.entities.Availability.list(),
    ]);

    const dateSet = new Set(dates);

    // Filter assignments to selected dates
    const filteredAssignments = assignments.filter(a => dateSet.has(a.date));
    // Filter availabilities: any that overlap selected dates
    const filteredAvailabilities = availabilities.filter(av =>
      (av.shifts || []).some(s => dateSet.has(s.date))
    );

    const wb = XLSX.utils.book_new();

    // --- Sheet: Assignments ---
    const aHeader = buildHeaderRow(ASSIGNMENT_SCHEMA);
    const aRows = filteredAssignments.flatMap(a => assignmentToRow(a, workers));
    const aSheet = XLSX.utils.aoa_to_sheet([aHeader, ...aRows]);
    XLSX.utils.book_append_sheet(wb, aSheet, SHEET_ASSIGNMENTS);

    // --- Sheet: Availability ---
    const vHeader = buildHeaderRow(AVAILABILITY_SCHEMA);
    const vRows = filteredAvailabilities.flatMap(av => availabilityToRows(av, workers));
    const vSheet = XLSX.utils.aoa_to_sheet([vHeader, ...vRows]);
    XLSX.utils.book_append_sheet(wb, vSheet, SHEET_AVAILABILITY);

    // --- Sheet: Metadata ---
    const exportedAt = format(new Date(), "yyyy-MM-dd HH:mm");
    const metaRows = [
      ["מקור", sanitizeText(EXPORT_SOURCE_NAME)],
      ["תאריך ייצוא", exportedAt],
      ["תאריך התחלה", dateStart],
      ["תאריך סיום", dateEnd],
      ["מספר ימים", dates.length],
      ["שורות משמרות", aRows.length],
      ["שורות זמינות", vRows.length],
      ["מייצא", sanitizeText(currentUser?.email || "")],
    ];
    const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(wb, metaSheet, SHEET_META);

    // Validate at least one sheet has data
    const totalRows = aRows.length + vRows.length;
    if (totalRows === 0) {
      setExporting(false);
      alert("לא נמצאו נתונים לטווח התאריכים שנבחר.");
      return;
    }

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
      {/* Calendar date picker */}
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
          {/* Pad first row */}
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
                    ${selected
                      ? "bg-blue-900 text-white border-blue-900"
                      : "bg-white hover:bg-blue-50 border-gray-200 text-gray-700"}
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

      {/* Export button */}
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800" dir="rtl">
          ✓ הקובץ הורד בהצלחה ונרשם ביומן הביקורת.
        </div>
      )}
    </div>
  );
}
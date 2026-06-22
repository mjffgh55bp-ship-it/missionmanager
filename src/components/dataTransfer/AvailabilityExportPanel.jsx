import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import {
  format, eachWeekOfInterval, startOfWeek, endOfWeek,
  addMonths, subMonths, startOfMonth, endOfMonth, isSameWeek,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Loader2 } from "lucide-react";
import {
  sanitizeText, EXPORT_VERSION, EXPORT_SOURCE_NAME,
  SHEET_MANIFEST, SHEET_WORKERS_MAP,
  SHEET_AVAIL_SUBMISSIONS, SHEET_AVAIL_WINDOWS, SHEET_UNAVAIL_WINDOWS,
} from "@/lib/dataTransferSchema";
import { fetchWithRetry } from "@/lib/appDataCache";

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export default function AvailabilityExportPanel({ currentUser, onAuditLog }) {
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedWeeks, setSelectedWeeks] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  // Compute weeks in the current month view (Monday-start)
  const monthStart = startOfMonth(calMonth);
  const monthEnd   = endOfMonth(calMonth);
  const weeksInMonth = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 0 }
  );

  const weekKey = (d) => format(startOfWeek(d, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const toggleWeek = (d) => {
    const k = weekKey(d);
    setSelectedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
    setDone(false);
  };

  const selectMonth = () => {
    setSelectedWeeks(new Set(weeksInMonth.map(w => weekKey(w))));
    setDone(false);
  };

  const clearSelection = () => { setSelectedWeeks(new Set()); setDone(false); };

  const handleExport = async () => {
    if (selectedWeeks.size === 0) return;
    setExporting(true);
    setDone(false);

    const weekStarts = [...selectedWeeks].sort();
    const dateStart = weekStarts[0];
    const dateEnd   = format(endOfWeek(new Date(weekStarts[weekStarts.length - 1]), { weekStartsOn: 0 }), "yyyy-MM-dd");

    // Load data — staggered to avoid rate limits with large datasets
    const workers = await fetchWithRetry(() => base44.entities.Worker.list());
    const liveWorkerIds = new Set(workers.map(w => w.id));
    await new Promise(r => setTimeout(r, 200));
    const availabilities = await fetchWithRetry(() => base44.entities.Availability.list());
    await new Promise(r => setTimeout(r, 200));
    const unavailabilities = await fetchWithRetry(() => base44.entities.Unavailability.list());

    // Filter availability by selected week_start_dates, only for live workers
    const filteredAvail = availabilities.filter(a =>
      weekStarts.includes(a.week_start_date) && liveWorkerIds.has(a.worker_id)
    );

    // Filter unavailability by date range, only for live workers
    // Exclude auto-generated yearly-event constraints — they regenerate from the event itself.
    const filteredUnavail = unavailabilities.filter(u =>
      u.date >= dateStart && u.date <= dateEnd && liveWorkerIds.has(u.worker_id) && !u.yearly_event_id
    );

    const exportedAt = format(new Date(), "yyyy-MM-dd HH:mm");
    const wb = XLSX.utils.book_new();

    // ── Manifest ──────────────────────────────────────────────────────────────
    const manifestData = [
      ["export_version", EXPORT_VERSION],
      ["export_date", exportedAt],
      ["source", EXPORT_SOURCE_NAME],
      ["export_type", "availability"],
      ["date_start", dateStart],
      ["date_end", dateEnd],
      ["weeks_count", weekStarts.length],
      ["avail_count", filteredAvail.length],
      ["unavail_count", filteredUnavail.length],
      ["exported_by", sanitizeText(currentUser?.email || "")],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(manifestData), SHEET_MANIFEST);

    // ── WorkersMap ────────────────────────────────────────────────────────────
    const workerHeader = ["worker_mapping_id", "worker_id", "nickname", "full_name", "roles", "active"];
    const workerRows = workers.map(w => [
      w.worker_mapping_id || "",
      w.id,
      sanitizeText(w.nickname || ""),
      sanitizeText(w.full_name || ""),
      Array.isArray(w.role) ? w.role.join(", ") : (w.role || ""),
      w.active !== false ? "true" : "false",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([workerHeader, ...workerRows]), SHEET_WORKERS_MAP);

    // ── AvailabilitySubmissions ───────────────────────────────────────────────
    const submHeader = [
      "availability_id", "worker_id", "worker_name", "week_start_date",
      "status", "desired_shifts", "extra_tasks_json", "change_request",
      "created_date", "updated_date",
    ];
    const submRows = filteredAvail.map(a => [
      a.id,
      a.worker_id,
      sanitizeText(a.worker_name || ""),
      a.week_start_date,
      sanitizeText(a.status || "draft"),
      a.desired_shifts != null ? String(a.desired_shifts) : "",
      a.extra_tasks ? JSON.stringify(a.extra_tasks) : "",
      sanitizeText(a.change_request || ""),
      a.created_date || "",
      a.updated_date || "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([submHeader, ...submRows]), SHEET_AVAIL_SUBMISSIONS);

    // ── AvailabilityWindows ───────────────────────────────────────────────────
    const winHeader = [
      "availability_id", "worker_id", "worker_name", "week_start_date",
      "date", "start_time", "end_time", "type", "priority",
    ];
    const winRows = [];
    filteredAvail.forEach(a => {
      (a.shifts || []).forEach(shift => {
        // Only include shifts within selected date range
        if (!shift.date || shift.date < dateStart || shift.date > dateEnd) return;
        winRows.push([
          a.id,
          a.worker_id,
          sanitizeText(a.worker_name || ""),
          a.week_start_date,
          shift.date,
          shift.start_time || "",
          shift.end_time || "",
          shift.type || "available",
          shift.priority != null ? String(shift.priority) : "",
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([winHeader, ...winRows]), SHEET_AVAIL_WINDOWS);

    // ── UnavailabilityWindows ─────────────────────────────────────────────────
    const unavailHeader = [
      "unavailability_id", "worker_id", "worker_name",
      "date", "start_time", "end_time", "reason",
    ];
    const unavailRows = filteredUnavail.map(u => [
      u.id,
      u.worker_id,
      sanitizeText(u.worker_name || ""),
      u.date,
      u.start_time || "",
      u.end_time || "",
      sanitizeText(u.reason || ""),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([unavailHeader, ...unavailRows]), SHEET_UNAVAIL_WINDOWS);

    // ── Write file ────────────────────────────────────────────────────────────
    const fileName = `availability_${dateStart}_${dateEnd}.xlsx`;
    XLSX.writeFile(wb, fileName);

    await base44.entities.AuditLog.create({
      action_type: "export",
      file_name: fileName,
      user_email: currentUser?.email || "",
      user_name: currentUser?.full_name || "",
      row_count: filteredAvail.length,
      date_range_start: dateStart,
      date_range_end: dateEnd,
      notes: `זמינות: ${filteredAvail.length} רשומות, חלונות: ${winRows.length}, אי-זמינות: ${filteredUnavail.length}`,
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
            <CardTitle className="text-base">בחר שבועות לייצוא זמינות</CardTitle>
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
            {selectedWeeks.size > 0 && (
              <Button size="sm" variant="ghost" onClick={clearSelection} className="text-xs text-gray-500">נקה בחירה</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {weeksInMonth.map((weekStart) => {
              const k = weekKey(weekStart);
              const wEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
              const selected = selectedWeeks.has(k);
              return (
                <button
                  key={k}
                  onClick={() => toggleWeek(weekStart)}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium text-right transition-all border
                    ${selected
                      ? "bg-blue-900 text-white border-blue-900"
                      : "bg-white hover:bg-blue-50 border-gray-200 text-gray-700"
                    }`}
                >
                  שבוע {format(weekStart, "dd/MM")} – {format(wEnd, "dd/MM/yyyy")}
                </button>
              );
            })}
          </div>
          {selectedWeeks.size > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-right">{selectedWeeks.size} שבועות נבחרו</p>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleExport}
        disabled={selectedWeeks.size === 0 || exporting}
        className="w-full bg-blue-900 hover:bg-blue-800 text-white h-10"
      >
        {exporting ? (
          <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייצא...</>
        ) : done ? (
          <><CheckCircle2 className="w-4 h-4 ml-2 text-green-300" />הייצוא הושלם בהצלחה</>
        ) : (
          <><Download className="w-4 h-4 ml-2" />ייצוא זמינות ({selectedWeeks.size} שבועות)</>
        )}
      </Button>

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          ✓ הקובץ הורד בהצלחה ונרשם ביומן הביקורת.
          <div className="text-xs text-green-700 mt-1">הקובץ כולל: AvailabilitySubmissions, AvailabilityWindows, UnavailabilityWindows</div>
        </div>
      )}
    </div>
  );
}
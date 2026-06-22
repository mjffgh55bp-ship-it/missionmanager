import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Loader2 } from "lucide-react";
import { runMokedExport } from "@/lib/mokedExport";

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export default function ExportPanel({ currentUser, onAuditLog, selectedTemplateIds }) {
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

    const [workers, allTemplates, templateRows, allSettings] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Template.list(),
      base44.entities.TemplateRow.list(),
      base44.entities.AppSettings.list(),
    ]);

    await runMokedExport({
      workers,
      allTemplates,
      templateRows,
      allSettings,
      dates,
      selectedTemplateIds: selectedTemplateIds || null,
      currentUser,
      onAuditLog,
      createAuditLog: (data) => base44.entities.AuditLog.create(data),
    });

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
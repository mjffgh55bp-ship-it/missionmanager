import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function Matrix() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const workersData = await base44.entities.Worker.filter({ active: true });
      setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24); // 6,7,8...23,0,1...5

  const goToPreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1));
  };

  const goToNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1));
  };

  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <p className="text-gray-600" dir="rtl">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <Card className="border-none shadow-lg mb-4">
          <CardHeader className="border-b bg-white py-4 px-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl" dir="rtl">מטריצת זמינות</CardTitle>
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  השבוע
                </Button>
                <span className="px-3 py-1 bg-blue-50 text-blue-900 rounded font-medium text-sm" dir="rtl">
                  {format(weekStart, "dd/MM/yyyy")} - {format(addDays(weekStart, 6), "dd/MM/yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Matrix Table */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" dir="rtl">
                <thead>
                  {/* Day headers */}
                  <tr className="bg-gradient-to-l from-blue-600 to-blue-700">
                    <th className="sticky right-0 z-20 bg-blue-700 border border-blue-600 p-2 text-white font-semibold text-sm min-w-[150px]">
                      עובד
                    </th>
                    {weekDays.map((day, index) => (
                      <th key={index} colSpan={24} className="border border-blue-600 p-2 text-white text-center">
                        <div className="font-semibold">{HEBREW_DAYS[index]}</div>
                        <div className="text-xs font-normal mt-1">{format(day, "dd/MM")}</div>
                      </th>
                    ))}
                  </tr>
                  {/* Hour headers */}
                  <tr className="bg-blue-500">
                    <th className="sticky right-0 z-20 bg-blue-500 border border-blue-400 p-1"></th>
                    {weekDays.map((day, dayIndex) => (
                      <React.Fragment key={dayIndex}>
                        {hours.map((hour) => (
                          <th key={hour} className={`border border-blue-400 p-1 text-white text-[10px] min-w-[24px] w-[24px] ${hour === 5 ? 'border-l-4 border-l-blue-900' : ''}`}>
                            {hour}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker, workerIndex) => (
                    <tr key={worker.id} className={workerIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="sticky right-0 z-10 border border-gray-300 p-2 font-medium text-sm bg-inherit">
                        {worker.nickname}
                      </td>
                      {weekDays.map((day, dayIndex) => (
                        <React.Fragment key={dayIndex}>
                          {hours.map((hour) => (
                            <td key={hour} className={`border border-gray-200 p-0 h-8 w-[24px] min-w-[24px] hover:bg-blue-50 cursor-pointer ${hour === 5 ? 'border-l-4 border-l-gray-800' : ''}`}>
                              {/* תא שעה - נוסיף פונקציונליות בהמשך */}
                            </td>
                          ))}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {workers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500" dir="rtl">אין עובדים פעילים במערכת</p>
          </div>
        )}
      </div>
    </div>
  );
}
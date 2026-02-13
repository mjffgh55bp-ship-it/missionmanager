import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const CATEGORIES = [
  { id: "selected", label: "איכ√ת √ נבחר", color: "bg-pink-200", borderColor: "border-blue-600" },
  { id: "absent", label: "נבחר: ‎√×לא", color: "bg-pink-100", borderColor: "border-pink-600" },
  { id: "green", label: "המקף כחול", color: "bg-lime-400", borderColor: "border-lime-600" },
  { id: "greenAlt", label: "כגונת טבל 30 המקפת כחול", color: "bg-lime-500", borderColor: "border-lime-700" },
  { id: "magenta", label: "כגונת 45", color: "bg-pink-500", borderColor: "border-pink-700" },
  { id: "brown", label: "תשמורת", color: "bg-amber-700", borderColor: "border-amber-900" },
  { id: "purple", label: "כוננות 60/75/90/105/120/180", color: "bg-purple-400", borderColor: "border-purple-600" },
  { id: "lightBlue", label: "מאמן", color: "bg-sky-300", borderColor: "border-sky-500" },
  { id: "orange", label: "ציוד", color: "bg-orange-400", borderColor: "border-orange-600" },
  { id: "lightPink", label: "אחר", color: "bg-pink-200", borderColor: "border-pink-400" },
  { id: "lavender", label: "חופש", color: "bg-purple-200", borderColor: "border-purple-400" },
  { id: "gray", label: 'חו"ל', color: "bg-gray-400", borderColor: "border-gray-600" },
];

export default function Matrix() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cellData, setCellData] = useState({});
  const [isDragging, setIsDragging] = useState(false);

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

  const getCellKey = (workerId, dayIndex, hour) => {
    return `${workerId}-${dayIndex}-${hour}`;
  };

  const handleCellMouseDown = (workerId, dayIndex, hour) => {
    if (!selectedCategory) return;
    setIsDragging(true);
    toggleCell(workerId, dayIndex, hour);
  };

  const handleCellMouseEnter = (workerId, dayIndex, hour) => {
    if (!isDragging || !selectedCategory) return;
    toggleCell(workerId, dayIndex, hour);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleCell = (workerId, dayIndex, hour) => {
    const key = getCellKey(workerId, dayIndex, hour);
    setCellData(prev => {
      const newData = { ...prev };
      if (newData[key] === selectedCategory) {
        delete newData[key];
      } else {
        newData[key] = selectedCategory;
      }
      return newData;
    });
  };

  const getCellCategory = (workerId, dayIndex, hour) => {
    const key = getCellKey(workerId, dayIndex, hour);
    return cellData[key];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <p className="text-gray-600" dir="rtl">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" onMouseUp={handleMouseUp}>
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
                          {hours.map((hour) => {
                            const category = getCellCategory(worker.id, dayIndex, hour);
                            const categoryData = CATEGORIES.find(c => c.id === category);
                            return (
                              <td 
                                key={hour} 
                                className={`border border-gray-200 p-0 h-8 w-[24px] min-w-[24px] cursor-pointer transition-colors ${hour === 5 ? 'border-l-4 border-l-gray-800' : ''} ${categoryData ? categoryData.color : 'hover:bg-blue-50'}`}
                                onMouseDown={() => handleCellMouseDown(worker.id, dayIndex, hour)}
                                onMouseEnter={() => handleCellMouseEnter(worker.id, dayIndex, hour)}
                              >
                              </td>
                            );
                          })}
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

        {/* Legend */}
        <Card className="border-none shadow-lg mt-4">
          <CardHeader className="border-b bg-white py-3 px-6">
            <CardTitle className="text-lg" dir="rtl">מקרא סוג פעילות</CardTitle>
            <p className="text-sm text-gray-600 mt-1" dir="rtl">לחץ על קטגוריה כדי למהור אותה לעובדים על המטריצה</p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${category.color} ${
                    selectedCategory === category.id 
                      ? `ring-4 ${category.borderColor} ring-opacity-50 scale-[1.02]` 
                      : 'hover:scale-[1.01]'
                  }`}
                  dir="rtl"
                >
                  {category.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
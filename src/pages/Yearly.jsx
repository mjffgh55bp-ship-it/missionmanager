import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { format, addDays, startOfYear, endOfYear, getDay, getWeek, differenceInDays } from "date-fns";
import { getHebrewDate, toHebrewNumerals } from "../components/utils/HebrewDate";

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

// Calculate week number where Dec 28 is week 1
const getCustomWeekNumber = (date, year) => {
  // Week 1 starts on the Sunday of the week containing Dec 28 of the previous year
  const dec28PrevYear = new Date(year - 1, 11, 28);
  const weekStartDec28 = new Date(dec28PrevYear);
  weekStartDec28.setDate(dec28PrevYear.getDate() - dec28PrevYear.getDay()); // Go to Sunday
  
  const diffDays = differenceInDays(date, weekStartDec28);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

export default function Yearly() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [newRowName, setNewRowName] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    setLoading(true);
    const [rowsData, eventsData] = await Promise.all([
      base44.entities.YearlyRow.list("order"),
      base44.entities.YearlyEvent.list()
    ]);
    
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const yearEvents = eventsData.filter(e => e.date >= yearStart && e.date <= yearEnd);
    
    setRows(rowsData);
    setEvents(yearEvents);
    setLoading(false);
  };

  const handleAddRow = async () => {
    if (!newRowName.trim()) return;
    await base44.entities.YearlyRow.create({
      name: newRowName.trim(),
      order: rows.length,
      color: "#3b82f6"
    });
    setNewRowName("");
    setShowAddRowDialog(false);
    loadData();
  };

  const handleDeleteRow = async (rowId) => {
    await base44.entities.YearlyRow.delete(rowId);
    // Delete all events for this row
    const rowEvents = events.filter(e => e.row_id === rowId);
    for (const event of rowEvents) {
      await base44.entities.YearlyEvent.delete(event.id);
    }
    loadData();
  };

  const handleCellClick = (rowId, date) => {
    setSelectedCell({ rowId, date });
    setEventTitle("");
    setShowAddEventDialog(true);
  };

  const handleAddEvent = async () => {
    if (!selectedCell) return;
    await base44.entities.YearlyEvent.create({
      row_id: selectedCell.rowId,
      date: selectedCell.date,
      title: eventTitle.trim() || "•"
    });
    setShowAddEventDialog(false);
    setSelectedCell(null);
    setEventTitle("");
    loadData();
  };

  const handleDeleteEvent = async (eventId) => {
    await base44.entities.YearlyEvent.delete(eventId);
    loadData();
  };

  const getEventForCell = (rowId, dateStr) => {
    return events.find(e => e.row_id === rowId && e.date === dateStr);
  };

  // Generate all days of the year
  const generateYearDays = () => {
    const days = [];
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    let current = start;
    
    while (current <= end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return days; // Left to right (reversed for RTL display)
  };

  const yearDays = generateYearDays();

  // Group days by month for header
  const getMonthGroups = () => {
    const groups = [];
    let currentMonth = -1;
    let count = 0;
    
    for (const day of yearDays) {
      const month = day.getMonth();
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          groups.push({ month: currentMonth, count });
        }
        currentMonth = month;
        count = 1;
      } else {
        count++;
      }
    }
    groups.push({ month: currentMonth, count });
    return groups;
  };

  // Group days by week for header
  const getWeekGroups = () => {
    const groups = [];
    let currentWeek = -1;
    let count = 0;
    
    for (const day of yearDays) {
      const week = getCustomWeekNumber(day, currentYear);
      if (week !== currentWeek) {
        if (currentWeek !== -1) {
          groups.push({ week: currentWeek, count });
        }
        currentWeek = week;
        count = 1;
      } else {
        count++;
      }
    }
    groups.push({ week: currentWeek, count });
    return groups;
  };

  const monthGroups = getMonthGroups();
  const weekGroups = getWeekGroups();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-full mx-auto">
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">לוח שנתי</h1>
            <p className="text-gray-600">ניהול אירועים שנתיים</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[100px] text-center">
              {currentYear}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>
              השנה
            </Button>
            <Button onClick={() => setShowAddRowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />
              הוסף שורה
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto" ref={scrollRef}>
              <div style={{ minWidth: `${yearDays.length * 40 + 150}px` }}>
                {/* Month Header */}
                <div className="flex flex-row-reverse border-b bg-blue-900 text-white sticky top-0 z-20">
                  <div className="w-[150px] min-w-[150px] p-2 border-r font-semibold sticky right-0 bg-blue-900 z-30">שורה</div>
                  {monthGroups.map((group, idx) => (
                    <div 
                      key={idx} 
                      className="text-center font-semibold text-xs py-2 border-r"
                      style={{ width: `${group.count * 40}px`, minWidth: `${group.count * 40}px` }}
                    >
                      {HEBREW_MONTHS[group.month]}
                    </div>
                  ))}
                </div>

                {/* Week Header */}
                <div className="flex flex-row-reverse border-b bg-blue-800 text-white sticky top-[36px] z-20">
                  <div className="w-[150px] min-w-[150px] p-2 border-r text-xs sticky right-0 bg-blue-800 z-30">שבוע</div>
                  {weekGroups.map((group, idx) => (
                    <div 
                      key={idx} 
                      className="text-center text-xs py-1 border-r"
                      style={{ width: `${group.count * 40}px`, minWidth: `${group.count * 40}px` }}
                    >
                      {group.week}
                    </div>
                  ))}
                </div>

                {/* Combined Day/Date/Hebrew Header */}
                <div className="flex flex-row-reverse border-b bg-gray-100 sticky top-[72px] z-20">
                  <div className="w-[150px] min-w-[150px] p-2 border-r text-xs font-medium sticky right-0 bg-gray-100 z-30">יום, תאריך</div>
                  {yearDays.map((day, idx) => {
                    const dayOfWeek = getDay(day);
                    const isShabbat = dayOfWeek === 6;
                    const isFriday = dayOfWeek === 5;
                    const hebDate = getHebrewDate(day);
                    return (
                      <div 
                        key={idx} 
                        className={`w-10 min-w-[40px] text-center text-[9px] py-1 border-r leading-tight ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : ''}`}
                      >
                        <div className="font-medium">{HEBREW_DAYS[dayOfWeek]}</div>
                        <div>{day.getDate()}</div>
                        <div className="text-gray-500">{hebDate.dayHeb}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Rows */}
                {loading ? (
                  <div className="p-8 text-center text-gray-500">טוען...</div>
                ) : rows.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">אין שורות. לחץ "הוסף שורה" להתחיל.</div>
                ) : (
                  rows.map((row, rowIdx) => (
                    <div key={row.id} className={`flex flex-row-reverse border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <div className="w-[150px] min-w-[150px] p-2 border-r flex items-center justify-between sticky right-0 bg-inherit z-10">
                        <span className="text-sm font-medium truncate">{row.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(row.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {yearDays.map((day, idx) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const event = getEventForCell(row.id, dateStr);
                        const dayOfWeek = getDay(day);
                        const isShabbat = dayOfWeek === 6;
                        const isFriday = dayOfWeek === 5;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`w-10 min-w-[40px] h-10 border-r flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}
                            onClick={() => event ? null : handleCellClick(row.id, dateStr)}
                          >
                            {event && (
                              <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[8px] font-bold cursor-pointer hover:opacity-80"
                                style={{ backgroundColor: event.color || row.color || '#3b82f6' }}
                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                title={event.title || "לחץ למחיקה"}
                              >
                                {event.title ? event.title.charAt(0) : "•"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Row Dialog */}
        <Dialog open={showAddRowDialog} onOpenChange={setShowAddRowDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>הוסף שורה חדשה</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>שם השורה</Label>
              <Input 
                value={newRowName} 
                onChange={(e) => setNewRowName(e.target.value)} 
                placeholder="הכנס שם..."
                className="mt-2"
              />
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={handleAddRow} disabled={!newRowName.trim()}>הוסף</Button>
              <Button variant="outline" onClick={() => setShowAddRowDialog(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Event Dialog */}
        <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>הוסף אירוע</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                תאריך: {selectedCell?.date ? format(new Date(selectedCell.date), "dd/MM/yyyy") : ""}
              </p>
              <Label>כותרת (אופציונלי)</Label>
              <Input 
                value={eventTitle} 
                onChange={(e) => setEventTitle(e.target.value)} 
                placeholder="השאר ריק לסימון פשוט"
                className="mt-2"
              />
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={handleAddEvent}>הוסף</Button>
              <Button variant="outline" onClick={() => setShowAddEventDialog(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
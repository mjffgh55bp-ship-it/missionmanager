import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Trash2, Palette } from "lucide-react";
import { format, addDays, getDay, differenceInDays } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ROW_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const getCustomWeekNumber = (date, year) => {
  const dec28PrevYear = new Date(year - 1, 11, 28);
  const weekStartDec28 = new Date(dec28PrevYear);
  weekStartDec28.setDate(dec28PrevYear.getDate() - dec28PrevYear.getDay());
  const diffDays = differenceInDays(date, weekStartDec28);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

export default function Yearly() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [newRowName, setNewRowName] = useState("");
  const [newRowColor, setNewRowColor] = useState("#3b82f6");
  const [selectedCell, setSelectedCell] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", hours: "", worker_id: "" });
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    setLoading(true);
    const [rowsData, eventsData, workersData, unavailData] = await Promise.all([
      base44.entities.YearlyRow.list("order"),
      base44.entities.YearlyEvent.list(),
      base44.entities.Worker.filter({ active: true }),
      base44.entities.Unavailability.list()
    ]);
    
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const yearEvents = eventsData.filter(e => e.date >= yearStart && e.date <= yearEnd);
    const yearUnavail = unavailData.filter(u => u.date >= yearStart && u.date <= yearEnd);
    
    setRows(rowsData);
    setEvents(yearEvents);
    setWorkers(workersData);
    setUnavailabilities(yearUnavail);
    setLoading(false);
  };

  const handleAddRow = async () => {
    if (!newRowName.trim()) return;
    await base44.entities.YearlyRow.create({
      name: newRowName.trim(),
      order: rows.length,
      color: newRowColor
    });
    setNewRowName("");
    setNewRowColor("#3b82f6");
    setShowAddRowDialog(false);
    loadData();
  };

  const handleDeleteRow = async (rowId) => {
    await base44.entities.YearlyRow.delete(rowId);
    const rowEvents = events.filter(e => e.row_id === rowId);
    for (const event of rowEvents) {
      await base44.entities.YearlyEvent.delete(event.id);
    }
    loadData();
  };

  const handleChangeRowColor = async (rowId, color) => {
    await base44.entities.YearlyRow.update(rowId, { color });
    setShowColorPicker(null);
    loadData();
  };

  const handleCellClick = (rowId, date) => {
    setSelectedCell({ rowId, date });
    setEventForm({ title: "", hours: "", worker_id: "" });
    setShowAddEventDialog(true);
  };

  const handleAddEvent = async () => {
    if (!selectedCell) return;
    const worker = workers.find(w => w.id === eventForm.worker_id);
    await base44.entities.YearlyEvent.create({
      row_id: selectedCell.rowId,
      date: selectedCell.date,
      title: eventForm.title.trim() || "•",
      hours: eventForm.hours ? parseFloat(eventForm.hours) : null,
      worker_id: eventForm.worker_id || null,
      worker_name: worker?.full_name || null
    });
    setShowAddEventDialog(false);
    setSelectedCell(null);
    setEventForm({ title: "", hours: "", worker_id: "" });
    loadData();
  };

  const handleDeleteEvent = async (eventId) => {
    await base44.entities.YearlyEvent.delete(eventId);
    loadData();
  };

  const getEventForCell = (rowId, dateStr) => {
    return events.find(e => e.row_id === rowId && e.date === dateStr);
  };

  const getUnavailForWorkerDate = (workerId, dateStr) => {
    return unavailabilities.find(u => u.worker_id === workerId && u.date === dateStr);
  };

  const generateYearDays = () => {
    const days = [];
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    let current = end;
    while (current >= start) {
      days.push(new Date(current));
      current = addDays(current, -1);
    }
    return days;
  };

  const yearDays = generateYearDays();

  const getMonthGroups = () => {
    const groups = [];
    let currentMonth = -1;
    let count = 0;
    for (const day of yearDays) {
      const month = day.getMonth();
      if (month !== currentMonth) {
        if (currentMonth !== -1) groups.push({ month: currentMonth, count });
        currentMonth = month;
        count = 1;
      } else {
        count++;
      }
    }
    groups.push({ month: currentMonth, count });
    return groups;
  };

  const getWeekGroups = () => {
    const groups = [];
    let currentWeek = -1;
    let count = 0;
    for (const day of yearDays) {
      const week = getCustomWeekNumber(day, currentYear);
      if (week !== currentWeek) {
        if (currentWeek !== -1) groups.push({ week: currentWeek, count });
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
  const filteredWorker = workers.find(w => w.id === selectedWorkerFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4" dir="rtl">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">לוח שנתי</h1>
            <p className="text-gray-600">ניהול אירועים שנתיים</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[100px] text-center">
              {currentYear}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>השנה</Button>
            <Select value={selectedWorkerFilter} onValueChange={setSelectedWorkerFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="בחר עובד..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל העובדים</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddRowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />הוסף שורה
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[80vh]" ref={scrollRef}>
              <table className="border-collapse" style={{ minWidth: `${yearDays.length * 36 + 160}px` }}>
                <thead className="sticky top-0 z-20">
                  {/* Month Header */}
                  <tr className="bg-blue-900 text-white">
                    <th className="sticky right-0 z-30 bg-blue-900 w-[160px] min-w-[160px] p-2 border-l text-right font-semibold">שורה</th>
                    {monthGroups.map((group, idx) => (
                      <th key={idx} colSpan={group.count} className="text-center font-semibold text-xs py-2 border-l">
                        {HEBREW_MONTHS[group.month]}
                      </th>
                    ))}
                  </tr>
                  {/* Week Header */}
                  <tr className="bg-blue-800 text-white">
                    <th className="sticky right-0 z-30 bg-blue-800 w-[160px] min-w-[160px] p-2 border-l text-right text-xs">שבוע</th>
                    {weekGroups.map((group, idx) => (
                      <th key={idx} colSpan={group.count} className="text-center text-xs py-1 border-l">
                        {group.week}
                      </th>
                    ))}
                  </tr>
                  {/* Day/Date Header */}
                  <tr className="bg-gray-100">
                    <th className="sticky right-0 z-30 bg-gray-100 w-[160px] min-w-[160px] p-2 border-l text-right text-xs font-medium">יום, תאריך</th>
                    {yearDays.map((day, idx) => {
                      const dayOfWeek = getDay(day);
                      const isShabbat = dayOfWeek === 6;
                      const isFriday = dayOfWeek === 5;
                      const hebDate = getHebrewDate(day);
                      return (
                        <th key={idx} className={`w-9 min-w-[36px] text-center text-[8px] py-1 border-l leading-tight ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : 'bg-gray-100'}`}>
                          <div className="font-semibold">{HEBREW_DAYS[dayOfWeek]}</div>
                          <div>{day.getDate()}</div>
                          <div className="text-gray-500">{hebDate.dayHeb}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Worker Unavailability Row */}
                  {selectedWorkerFilter && selectedWorkerFilter !== "__all__" && (
                    <tr className="bg-red-50 border-b">
                      <td className="sticky right-0 z-10 bg-red-50 w-[160px] min-w-[160px] p-2 border-l">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-sm font-medium text-red-700">אי זמינות - {filteredWorker?.full_name}</span>
                        </div>
                      </td>
                      {yearDays.map((day, idx) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const unavail = getUnavailForWorkerDate(selectedWorkerFilter, dateStr);
                        const dayOfWeek = getDay(day);
                        const isShabbat = dayOfWeek === 6;
                        const isFriday = dayOfWeek === 5;
                        return (
                          <td key={idx} className={`w-9 min-w-[36px] h-9 border-l text-center ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}>
                            {unavail && (
                              <div className="w-6 h-6 mx-auto rounded-full bg-red-500 flex items-center justify-center text-white text-[8px]" title={`${unavail.start_time}-${unavail.end_time} (${unavail.reason})`}>
                                X
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Custom Rows */}
                  {loading ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">טוען...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">אין שורות. לחץ "הוסף שורה" להתחיל.</td></tr>
                  ) : (
                    rows.map((row, rowIdx) => (
                      <tr key={row.id} className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className={`sticky right-0 z-10 w-[160px] min-w-[160px] p-2 border-l ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }}></div>
                              <span className="text-sm font-medium truncate">{row.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <div className="relative">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowColorPicker(showColorPicker === row.id ? null : row.id)}>
                                  <Palette className="w-3 h-3" />
                                </Button>
                                {showColorPicker === row.id && (
                                  <div className="absolute top-7 right-0 bg-white border rounded-lg shadow-lg p-2 z-50 flex gap-1 flex-wrap w-24">
                                    {ROW_COLORS.map(c => (
                                      <button key={c} className="w-5 h-5 rounded-full border-2 border-white hover:scale-110" style={{ backgroundColor: c }} onClick={() => handleChangeRowColor(row.id, c)} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(row.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </td>
                        {yearDays.map((day, idx) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const event = getEventForCell(row.id, dateStr);
                          const dayOfWeek = getDay(day);
                          const isShabbat = dayOfWeek === 6;
                          const isFriday = dayOfWeek === 5;
                          
                          return (
                            <td 
                              key={idx} 
                              className={`w-9 min-w-[36px] h-9 border-l cursor-pointer hover:bg-blue-100 transition-colors ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}
                              onClick={() => !event && handleCellClick(row.id, dateStr)}
                            >
                              {event && (
                                <div 
                                  className="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-white text-[7px] font-bold cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: event.color || row.color || '#3b82f6' }}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                  title={`${event.title || ""}${event.hours ? ` (${event.hours}h)` : ""}${event.worker_name ? ` - ${event.worker_name}` : ""}\nלחץ למחיקה`}
                                >
                                  {event.hours || (event.title ? event.title.charAt(0) : "•")}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add Row Dialog */}
        <Dialog open={showAddRowDialog} onOpenChange={setShowAddRowDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>הוסף שורה חדשה</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label>שם השורה</Label>
                <Input value={newRowName} onChange={(e) => setNewRowName(e.target.value)} placeholder="הכנס שם..." className="mt-2" />
              </div>
              <div>
                <Label>צבע</Label>
                <div className="flex gap-2 mt-2">
                  {ROW_COLORS.map(c => (
                    <button key={c} className={`w-8 h-8 rounded-full border-2 ${newRowColor === c ? 'border-gray-800 scale-110' : 'border-white'}`} style={{ backgroundColor: c }} onClick={() => setNewRowColor(c)} />
                  ))}
                </div>
              </div>
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
            <DialogHeader><DialogTitle>הוסף אירוע</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-gray-600">תאריך: {selectedCell?.date ? format(new Date(selectedCell.date), "dd/MM/yyyy") : ""}</p>
              <div>
                <Label>כותרת (אופציונלי)</Label>
                <Input value={eventForm.title} onChange={(e) => setEventForm({...eventForm, title: e.target.value})} placeholder="השאר ריק לסימון פשוט" className="mt-1" />
              </div>
              <div>
                <Label>שעות (אופציונלי)</Label>
                <Input type="number" value={eventForm.hours} onChange={(e) => setEventForm({...eventForm, hours: e.target.value})} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>עובד (אופציונלי)</Label>
                <Select value={eventForm.worker_id} onValueChange={(v) => setEventForm({...eventForm, worker_id: v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="בחר עובד..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Trash2, Palette, Pencil } from "lucide-react";
import { format, addDays, getDay, differenceInDays, parseISO } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ROW_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const CELL_WIDTH = 36;

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
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [newRowName, setNewRowName] = useState("");
  const [newRowColor, setNewRowColor] = useState("#3b82f6");
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", start_time: "08:00", end_time: "16:00", worker_id: "", start_date: "", end_date: "" });
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState("");
  const [dragging, setDragging] = useState(null);
  const tableRef = useRef(null);

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
    const yearEvents = eventsData.filter(e => (e.start_date >= yearStart && e.start_date <= yearEnd) || (e.end_date >= yearStart && e.end_date <= yearEnd));
    const yearUnavail = unavailData.filter(u => u.date >= yearStart && u.date <= yearEnd);
    
    setRows(rowsData);
    setEvents(yearEvents);
    setWorkers(workersData);
    setUnavailabilities(yearUnavail);
    setLoading(false);
  };

  const handleAddRow = async () => {
    if (!newRowName.trim()) return;
    await base44.entities.YearlyRow.create({ name: newRowName.trim(), order: rows.length, color: newRowColor });
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
    setEditingEvent(null);
    setEventForm({ title: "", start_time: "08:00", end_time: "16:00", worker_id: "", start_date: date, end_date: date });
    setShowEventDialog(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setEditingEvent(event);
    setSelectedCell({ rowId: event.row_id, date: event.start_date });
    setEventForm({
      title: event.title || "",
      start_time: event.start_time || "08:00",
      end_time: event.end_time || "16:00",
      worker_id: event.worker_id || "",
      start_date: event.start_date,
      end_date: event.end_date
    });
    setShowEventDialog(true);
  };

  const handleSaveEvent = async () => {
    const worker = workers.find(w => w.id === eventForm.worker_id);
    const data = {
      row_id: selectedCell.rowId,
      start_date: eventForm.start_date,
      end_date: eventForm.end_date,
      title: eventForm.title.trim() || "אירוע",
      start_time: eventForm.start_time,
      end_time: eventForm.end_time,
      worker_id: eventForm.worker_id === "__none__" ? null : eventForm.worker_id || null,
      worker_name: worker?.full_name || null
    };
    
    if (editingEvent) {
      await base44.entities.YearlyEvent.update(editingEvent.id, data);
    } else {
      await base44.entities.YearlyEvent.create(data);
    }
    setShowEventDialog(false);
    setSelectedCell(null);
    setEditingEvent(null);
    loadData();
  };

  const handleDeleteEvent = async () => {
    if (editingEvent) {
      await base44.entities.YearlyEvent.delete(editingEvent.id);
      setShowEventDialog(false);
      setEditingEvent(null);
      loadData();
    }
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
  const yearDaysMap = {};
  yearDays.forEach((d, i) => { yearDaysMap[format(d, "yyyy-MM-dd")] = i; });

  const getEventsForRow = (rowId) => events.filter(e => e.row_id === rowId);

  const getEventPosition = (event) => {
    const startIdx = yearDaysMap[event.start_date];
    const endIdx = yearDaysMap[event.end_date];
    if (startIdx === undefined || endIdx === undefined) return null;
    const left = Math.min(startIdx, endIdx);
    const right = Math.max(startIdx, endIdx);
    return { left: left * CELL_WIDTH, width: (right - left + 1) * CELL_WIDTH };
  };

  const handleDragStart = (e, event, type) => {
    e.stopPropagation();
    const rect = tableRef.current.getBoundingClientRect();
    setDragging({ event, type, startX: e.clientX, rect, originalStart: event.start_date, originalEnd: event.end_date });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { event, type, startX, originalStart, originalEnd } = dragging;
    const deltaX = e.clientX - startX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);
    
    const origStartDate = parseISO(originalStart);
    const origEndDate = parseISO(originalEnd);
    
    let newStart = origStartDate;
    let newEnd = origEndDate;
    
    if (type === "move") {
      newStart = addDays(origStartDate, -deltaDays);
      newEnd = addDays(origEndDate, -deltaDays);
    } else if (type === "resize-start") {
      newStart = addDays(origStartDate, -deltaDays);
      if (newStart > newEnd) newStart = newEnd;
    } else if (type === "resize-end") {
      newEnd = addDays(origEndDate, -deltaDays);
      if (newEnd < newStart) newEnd = newStart;
    }
    
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    if (newStart < yearStart) newStart = yearStart;
    if (newEnd > yearEnd) newEnd = yearEnd;
    if (newStart < yearStart) newStart = yearStart;
    if (newEnd > yearEnd) newEnd = yearEnd;
    
    setDragging(prev => ({ ...prev, newStart: format(newStart, "yyyy-MM-dd"), newEnd: format(newEnd, "yyyy-MM-dd") }));
  };

  const handleMouseUp = async () => {
    if (!dragging) return;
    const { event, newStart, newEnd } = dragging;
    if (newStart && newEnd) {
      await base44.entities.YearlyEvent.update(event.id, { start_date: newStart, end_date: newEnd });
      loadData();
    }
    setDragging(null);
  };

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging]);

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

  const EventBar = ({ event, row }) => {
    const displayEvent = dragging?.event?.id === event.id ? 
      { ...event, start_date: dragging.newStart || event.start_date, end_date: dragging.newEnd || event.end_date } : event;
    const pos = getEventPosition(displayEvent);
    if (!pos) return null;
    
    const color = event.color || row?.color || "#3b82f6";
    const isDragging = dragging?.event?.id === event.id;
    
    return (
      <div
        className={`absolute top-1 h-7 rounded flex items-center text-white text-[10px] font-medium overflow-hidden cursor-pointer ${isDragging ? 'opacity-70 z-50' : 'z-10'}`}
        style={{ left: `${pos.left}px`, width: `${pos.width}px`, backgroundColor: color }}
        onClick={(e) => handleEventClick(event, e)}
      >
        <div
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20"
          onMouseDown={(e) => handleDragStart(e, event, "resize-start")}
        />
        <div
          className="flex-1 px-2 truncate cursor-move text-center"
          onMouseDown={(e) => handleDragStart(e, event, "move")}
        >
          {event.title}{event.worker_name ? ` - ${event.worker_name}` : ""}{event.start_time ? ` (${event.start_time}-${event.end_time})` : ""}
        </div>
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20"
          onMouseDown={(e) => handleDragStart(e, event, "resize-end")}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4" dir="rtl">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">לוח שנתי</h1>
            <p className="text-gray-600">ניהול אירועים שנתיים - גרור לשינוי תאריכים</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}><ChevronRight className="w-4 h-4" /></Button>
            <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[100px] text-center">{currentYear}</div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>השנה</Button>
            <Select value={selectedWorkerFilter} onValueChange={setSelectedWorkerFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="בחר עובד..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל העובדים</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddRowDialog(true)}><Plus className="w-4 h-4 ml-2" />הוסף שורה</Button>
          </div>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[80vh]" ref={tableRef}>
              <table className="border-collapse" style={{ minWidth: `${yearDays.length * CELL_WIDTH + 160}px` }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-blue-900 text-white">
                    <th className="sticky right-0 z-30 bg-blue-900 w-[160px] min-w-[160px] p-2 border-l text-right font-semibold">שורה</th>
                    {monthGroups.map((group, idx) => (
                      <th key={idx} colSpan={group.count} className="text-center font-semibold text-xs py-2 border-l">{HEBREW_MONTHS[group.month]}</th>
                    ))}
                  </tr>
                  <tr className="bg-blue-800 text-white">
                    <th className="sticky right-0 z-30 bg-blue-800 w-[160px] min-w-[160px] p-2 border-l text-right text-xs">שבוע</th>
                    {weekGroups.map((group, idx) => (
                      <th key={idx} colSpan={group.count} className="text-center text-xs py-1 border-l">{group.week}</th>
                    ))}
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="sticky right-0 z-30 bg-gray-100 w-[160px] min-w-[160px] p-2 border-l text-right text-xs font-medium">יום, תאריך</th>
                    {yearDays.map((day, idx) => {
                      const dayOfWeek = getDay(day);
                      const isShabbat = dayOfWeek === 6;
                      const isFriday = dayOfWeek === 5;
                      const hebDate = getHebrewDate(day);
                      return (
                        <th key={idx} className={`w-9 min-w-[${CELL_WIDTH}px] text-center text-[8px] py-1 border-l leading-tight ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : 'bg-gray-100'}`}>
                          <div className="font-semibold">{HEBREW_DAYS[dayOfWeek]}</div>
                          <div>{day.getDate()}</div>
                          <div className="text-gray-500">{hebDate.dayHeb}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Workers Unavailability Rows */}
                  {workers.map(worker => {
                    const workerUnavail = unavailabilities.filter(u => u.worker_id === worker.id);
                    if (workerUnavail.length === 0) return null;
                    return (
                      <tr key={`unavail-${worker.id}`} className="bg-red-50 border-b">
                        <td className="sticky right-0 z-10 bg-red-50 w-[160px] min-w-[160px] p-2 border-l">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-xs font-medium text-red-700 truncate">{worker.full_name} - אי זמינות</span>
                          </div>
                        </td>
                        {yearDays.map((day, idx) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const unavail = workerUnavail.find(u => u.date === dateStr);
                          const dayOfWeek = getDay(day);
                          const isShabbat = dayOfWeek === 6;
                          const isFriday = dayOfWeek === 5;
                          return (
                            <td key={idx} className={`w-9 min-w-[${CELL_WIDTH}px] h-9 border-l text-center ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}>
                              {unavail && (
                                <div className="w-5 h-5 mx-auto rounded bg-red-500 flex items-center justify-center text-white text-[7px]" title={`${unavail.start_time}-${unavail.end_time} (${unavail.reason})`}>
                                  X
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Custom Rows */}
                  {loading ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">טוען...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">אין שורות. לחץ "הוסף שורה" להתחיל.</td></tr>
                  ) : (
                    rows.map((row, rowIdx) => {
                      const rowEvents = getEventsForRow(row.id);
                      return (
                        <tr key={row.id} className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} style={{ height: "40px" }}>
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
                          <td colSpan={yearDays.length} className="relative p-0 h-10">
                            <div className="absolute inset-0 flex">
                              {yearDays.map((day, idx) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                const dayOfWeek = getDay(day);
                                const isShabbat = dayOfWeek === 6;
                                const isFriday = dayOfWeek === 5;
                                return (
                                  <div
                                    key={idx}
                                    className={`w-9 min-w-[${CELL_WIDTH}px] h-full border-l cursor-pointer hover:bg-blue-50 ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}
                                    onClick={() => handleCellClick(row.id, dateStr)}
                                  />
                                );
                              })}
                            </div>
                            {rowEvents.map(event => <EventBar key={event.id} event={event} row={row} />)}
                          </td>
                        </tr>
                      );
                    })
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
              <div><Label>שם השורה</Label><Input value={newRowName} onChange={(e) => setNewRowName(e.target.value)} placeholder="הכנס שם..." className="mt-2" /></div>
              <div><Label>צבע</Label><div className="flex gap-2 mt-2">{ROW_COLORS.map(c => (<button key={c} className={`w-8 h-8 rounded-full border-2 ${newRowColor === c ? 'border-gray-800 scale-110' : 'border-white'}`} style={{ backgroundColor: c }} onClick={() => setNewRowColor(c)} />))}</div></div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={handleAddRow} disabled={!newRowName.trim()}>הוסף</Button>
              <Button variant="outline" onClick={() => setShowAddRowDialog(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Event Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>{editingEvent ? "ערוך אירוע" : "הוסף אירוע"}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div><Label>כותרת</Label><Input value={eventForm.title} onChange={(e) => setEventForm({...eventForm, title: e.target.value})} placeholder="שם האירוע" className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>תאריך התחלה</Label><Input type="date" value={eventForm.start_date} onChange={(e) => setEventForm({...eventForm, start_date: e.target.value})} className="mt-1" /></div>
                <div><Label>תאריך סיום</Label><Input type="date" value={eventForm.end_date} onChange={(e) => setEventForm({...eventForm, end_date: e.target.value})} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>שעת התחלה</Label><Input type="time" value={eventForm.start_time} onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})} className="mt-1" /></div>
                <div><Label>שעת סיום</Label><Input type="time" value={eventForm.end_time} onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})} className="mt-1" /></div>
              </div>
              <div>
                <Label>עובד</Label>
                <Select value={eventForm.worker_id || "__none__"} onValueChange={(v) => setEventForm({...eventForm, worker_id: v})}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="בחר עובד..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={handleSaveEvent}>{editingEvent ? "שמור" : "הוסף"}</Button>
              {editingEvent && <Button variant="destructive" onClick={handleDeleteEvent}><Trash2 className="w-4 h-4 ml-1" />מחק</Button>}
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
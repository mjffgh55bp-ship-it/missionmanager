import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Trash2, Palette, Eye, EyeOff } from "lucide-react";
import { format, addDays, getDay, differenceInDays, parseISO } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ROW_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const CELL_WIDTH = 28;
const ROW_HEIGHT = 60;
const EVENT_HEIGHT = 14;

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
  const [viewOnly, setViewOnly] = useState(false);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [newRowName, setNewRowName] = useState("");
  const [newRowColor, setNewRowColor] = useState("#3b82f6");
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", start_time: "08:00", end_time: "16:00", worker_id: "", start_date: "", end_date: "" });
  const [dragging, setDragging] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => { loadData(); }, [currentYear]);

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
    setRows(rowsData);
    setEvents(eventsData.filter(e => (e.start_date >= yearStart && e.start_date <= yearEnd) || (e.end_date >= yearStart && e.end_date <= yearEnd)));
    setWorkers(workersData);
    setUnavailabilities(unavailData.filter(u => u.date >= yearStart && u.date <= yearEnd));
    setLoading(false);
  };

  const handleAddRow = async () => {
    if (!newRowName.trim()) return;
    await base44.entities.YearlyRow.create({ name: newRowName.trim(), order: rows.length, color: newRowColor });
    setNewRowName(""); setNewRowColor("#3b82f6"); setShowAddRowDialog(false); loadData();
  };

  const handleDeleteRow = async (rowId) => {
    await base44.entities.YearlyRow.delete(rowId);
    for (const event of events.filter(e => e.row_id === rowId)) {
      await base44.entities.YearlyEvent.delete(event.id);
    }
    loadData();
  };

  const handleChangeRowColor = async (rowId, color) => {
    await base44.entities.YearlyRow.update(rowId, { color });
    setShowColorPicker(null); loadData();
  };

  const handleCellClick = (rowId, date) => {
    if (viewOnly) return;
    setSelectedCell({ rowId, date });
    setEditingEvent(null);
    setEventForm({ title: "", start_time: "08:00", end_time: "16:00", worker_id: "", start_date: date, end_date: date });
    setShowEventDialog(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    if (viewOnly) return;
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
    if (editingEvent) await base44.entities.YearlyEvent.update(editingEvent.id, data);
    else await base44.entities.YearlyEvent.create(data);
    setShowEventDialog(false); setSelectedCell(null); setEditingEvent(null); loadData();
  };

  const handleDeleteEvent = async () => {
    if (editingEvent) {
      await base44.entities.YearlyEvent.delete(editingEvent.id);
      setShowEventDialog(false); setEditingEvent(null); loadData();
    }
  };

  const generateYearDays = () => {
    const days = [];
    let current = new Date(currentYear, 11, 31);
    const start = new Date(currentYear, 0, 1);
    while (current >= start) { days.push(new Date(current)); current = addDays(current, -1); }
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
    if (viewOnly) return;
    e.stopPropagation();
    setDragging({ event, type, startX: e.clientX, originalStart: event.start_date, originalEnd: event.end_date });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { event, type, startX, originalStart, originalEnd } = dragging;
    const deltaX = e.clientX - startX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);
    const origStartDate = parseISO(originalStart);
    const origEndDate = parseISO(originalEnd);
    let newStart = origStartDate, newEnd = origEndDate;
    if (type === "move") { newStart = addDays(origStartDate, -deltaDays); newEnd = addDays(origEndDate, -deltaDays); }
    else if (type === "resize-start") { newStart = addDays(origStartDate, -deltaDays); if (newStart > newEnd) newStart = newEnd; }
    else if (type === "resize-end") { newEnd = addDays(origEndDate, -deltaDays); if (newEnd < newStart) newEnd = newStart; }
    const yearStart = new Date(currentYear, 0, 1), yearEnd = new Date(currentYear, 11, 31);
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
      return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [dragging]);

  const getMonthGroups = () => {
    const groups = [];
    let currentMonth = -1, count = 0;
    for (const day of yearDays) {
      const month = day.getMonth();
      if (month !== currentMonth) { if (currentMonth !== -1) groups.push({ month: currentMonth, count }); currentMonth = month; count = 1; }
      else count++;
    }
    groups.push({ month: currentMonth, count });
    return groups;
  };

  const getWeekGroups = () => {
    const groups = [];
    let currentWeek = -1, count = 0;
    for (const day of yearDays) {
      const week = getCustomWeekNumber(day, currentYear);
      if (week !== currentWeek) { if (currentWeek !== -1) groups.push({ week: currentWeek, count }); currentWeek = week; count = 1; }
      else count++;
    }
    groups.push({ week: currentWeek, count });
    return groups;
  };

  const monthGroups = getMonthGroups();
  const weekGroups = getWeekGroups();

  // Layout events in tracks to avoid overlap
  const layoutEventsInTracks = (rowEvents) => {
    const sorted = [...rowEvents].sort((a, b) => {
      const aStart = yearDaysMap[a.start_date] ?? 999;
      const bStart = yearDaysMap[b.start_date] ?? 999;
      return aStart - bStart;
    });
    const tracks = [];
    for (const event of sorted) {
      const pos = getEventPosition(event);
      if (!pos) continue;
      let placed = false;
      for (let i = 0; i < tracks.length; i++) {
        const lastInTrack = tracks[i][tracks[i].length - 1];
        const lastPos = getEventPosition(lastInTrack);
        if (lastPos && pos.left >= lastPos.left + lastPos.width) {
          tracks[i].push(event); placed = true; break;
        }
      }
      if (!placed) tracks.push([event]);
    }
    return tracks;
  };

  const EventBar = ({ event, row, trackIndex }) => {
    const displayEvent = dragging?.event?.id === event.id ? { ...event, start_date: dragging.newStart || event.start_date, end_date: dragging.newEnd || event.end_date } : event;
    const pos = getEventPosition(displayEvent);
    if (!pos) return null;
    const color = event.color || row?.color || "#3b82f6";
    const isDragging = dragging?.event?.id === event.id;
    const topOffset = 2 + trackIndex * (EVENT_HEIGHT + 2);
    return (
      <div
        className={`absolute rounded flex items-center text-white text-[9px] font-medium overflow-hidden ${viewOnly ? 'cursor-default' : 'cursor-pointer'} ${isDragging ? 'opacity-70 z-50' : 'z-10'}`}
        style={{ left: `${pos.left}px`, width: `${pos.width}px`, top: `${topOffset}px`, height: `${EVENT_HEIGHT}px`, backgroundColor: color }}
        onClick={(e) => handleEventClick(event, e)}
        title={`${event.title}${event.worker_name ? ` - ${event.worker_name}` : ""}${event.start_time ? ` (${event.start_time}-${event.end_time})` : ""}`}
      >
        {!viewOnly && <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => handleDragStart(e, event, "resize-start")} />}
        <div className={`flex-1 px-1 truncate text-center ${viewOnly ? '' : 'cursor-move'}`} onMouseDown={(e) => !viewOnly && handleDragStart(e, event, "move")}>
          {event.title}
        </div>
        {!viewOnly && <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => handleDragStart(e, event, "resize-end")} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4" dir="rtl">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">לוח שנתי</h1>
            <p className="text-gray-600">{viewOnly ? "מצב צפייה בלבד" : "ניהול אירועים - גרור לשינוי תאריכים"}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border">
              <Label className="text-sm">צפייה בלבד</Label>
              <Switch checked={viewOnly} onCheckedChange={setViewOnly} />
              {viewOnly ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}><ChevronRight className="w-4 h-4" /></Button>
            <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[100px] text-center">{currentYear}</div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>השנה</Button>
            {!viewOnly && <Button onClick={() => setShowAddRowDialog(true)}><Plus className="w-4 h-4 ml-2" />הוסף שורה</Button>}
          </div>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[80vh]" ref={tableRef}>
              <table className="border-collapse" style={{ minWidth: `${yearDays.length * CELL_WIDTH + 160}px` }} dir="rtl">
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
                        <th key={idx} className={`min-w-[${CELL_WIDTH}px] text-center text-[7px] py-1 border-l leading-tight ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : 'bg-gray-100'}`} style={{ width: CELL_WIDTH }}>
                          <div className="font-semibold">{HEBREW_DAYS[dayOfWeek]}</div>
                          <div>{day.getDate()}</div>
                          <div className="text-gray-500">{hebDate.dayHeb}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Workers Unavailability Row */}
                  {unavailabilities.length > 0 && (
                    <tr className="bg-red-50 border-b" style={{ height: ROW_HEIGHT }}>
                      <td className="sticky right-0 z-10 bg-red-50 w-[160px] min-w-[160px] p-2 border-l">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-xs font-medium text-red-700">אי זמינות עובדים</span>
                        </div>
                      </td>
                      <td colSpan={yearDays.length} className="relative p-0" style={{ height: ROW_HEIGHT }}>
                        <div className="absolute inset-0 flex">
                          {yearDays.map((day, idx) => {
                            const dayOfWeek = getDay(day);
                            const isShabbat = dayOfWeek === 6;
                            const isFriday = dayOfWeek === 5;
                            return <div key={idx} className={`h-full border-l ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`} style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }} />;
                          })}
                        </div>
                        {unavailabilities.map((unavail, idx) => {
                          const dateIdx = yearDaysMap[unavail.date];
                          if (dateIdx === undefined) return null;
                          const worker = workers.find(w => w.id === unavail.worker_id);
                          return (
                            <div key={unavail.id || idx} className="absolute top-1 rounded bg-red-500 flex items-center justify-center text-white text-[8px] font-medium px-1 z-10"
                              style={{ left: `${dateIdx * CELL_WIDTH}px`, width: `${CELL_WIDTH - 2}px`, height: EVENT_HEIGHT }}
                              title={`${worker?.full_name}: ${unavail.start_time}-${unavail.end_time} (${unavail.reason})`}>
                              <span className="truncate">{worker?.full_name?.split(' ')[0] || '?'}</span>
                            </div>
                          );
                        })}
                      </td>
                    </tr>
                  )}

                  {/* Custom Rows */}
                  {loading ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">טוען...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={yearDays.length + 1} className="p-8 text-center text-gray-500">אין שורות. לחץ "הוסף שורה" להתחיל.</td></tr>
                  ) : (
                    rows.map((row, rowIdx) => {
                      const rowEvents = getEventsForRow(row.id);
                      const tracks = layoutEventsInTracks(rowEvents);
                      const dynamicHeight = Math.max(ROW_HEIGHT, 8 + tracks.length * (EVENT_HEIGHT + 2));
                      return (
                        <tr key={row.id} className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} style={{ height: dynamicHeight }}>
                          <td className={`sticky right-0 z-10 w-[160px] min-w-[160px] p-2 border-l ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }}></div>
                                <span className="text-sm font-medium truncate">{row.name}</span>
                              </div>
                              {!viewOnly && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <div className="relative">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowColorPicker(showColorPicker === row.id ? null : row.id)}><Palette className="w-3 h-3" /></Button>
                                    {showColorPicker === row.id && (
                                      <div className="absolute top-7 right-0 bg-white border rounded-lg shadow-lg p-2 z-50 flex gap-1 flex-wrap w-24">
                                        {ROW_COLORS.map(c => (<button key={c} className="w-5 h-5 rounded-full border-2 border-white hover:scale-110" style={{ backgroundColor: c }} onClick={() => handleChangeRowColor(row.id, c)} />))}
                                      </div>
                                    )}
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(row.id)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td colSpan={yearDays.length} className="relative p-0" style={{ height: dynamicHeight }}>
                            <div className="absolute inset-0 flex">
                              {yearDays.map((day, idx) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                const dayOfWeek = getDay(day);
                                const isShabbat = dayOfWeek === 6;
                                const isFriday = dayOfWeek === 5;
                                return (
                                  <div key={idx}
                                    className={`h-full border-l ${viewOnly ? '' : 'cursor-pointer hover:bg-blue-50'} ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}
                                    style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                                    onClick={() => handleCellClick(row.id, dateStr)} />
                                );
                              })}
                            </div>
                            {tracks.map((track, trackIdx) => track.map(event => <EventBar key={event.id} event={event} row={row} trackIndex={trackIdx} />))}
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
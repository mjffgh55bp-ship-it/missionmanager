import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Trash2, Palette, Eye, EyeOff, GripVertical } from "lucide-react";
import { format, addDays, getDay, differenceInDays, parseISO } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import MenuButton from "../components/MenuButton";

const HEBREW_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ROW_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const CELL_WIDTH = 60;
const ROW_HEIGHT = 60;
const EVENT_HEIGHT = 16;

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
  const [categoryNames, setCategoryNames] = useState({ category_1: "קטגוריה 1", category_2: "קטגוריה 2", category_3: "קטגוריה 3" });
  const [loading, setLoading] = useState(true);
  const [viewOnly, setViewOnly] = useState(true);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [newRowName, setNewRowName] = useState("");
  const [newRowColor, setNewRowColor] = useState("#3b82f6");
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", start_time: "08:00", end_time: "16:00", worker_ids: [], start_date: "", end_date: "" });
  const [workerCategoryFilter, setWorkerCategoryFilter] = useState("__all__");
  const [workerRoleFilter, setWorkerRoleFilter] = useState("__all__");
  const [dragging, setDragging] = useState(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => { loadData(); }, [currentYear]);

  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      setTimeout(() => {
        const today = format(new Date(), "yyyy-MM-dd");
        const yearStart = new Date(currentYear, 0, 1);
        const todayDate = new Date();
        const daysDiff = Math.floor((todayDate - yearStart) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && todayDate.getFullYear() === currentYear) {
          const scrollPosition = daysDiff * CELL_WIDTH - (scrollContainerRef.current.clientWidth / 2) + (CELL_WIDTH / 2);
          scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition);
        }
      }, 100);
    }
  }, [loading, currentYear]);

  const loadData = async () => {
    setLoading(true);
    const [rowsData, eventsData, workersData, unavailData, catSettings] = await Promise.all([
      base44.entities.YearlyRow.list("order"),
      base44.entities.YearlyEvent.list(),
      base44.entities.Worker.filter({ active: true }),
      base44.entities.Unavailability.list(),
      base44.entities.AppSettings.filter({ setting_key: "worker_category_names" })
    ]);
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    setRows(rowsData);
    setEvents(eventsData.filter(e => (e.start_date >= yearStart && e.start_date <= yearEnd) || (e.end_date >= yearStart && e.end_date <= yearEnd)));
    setWorkers(workersData);
    setUnavailabilities(unavailData.filter(u => u.date >= yearStart && u.date <= yearEnd));
    if (catSettings.length > 0) setCategoryNames(JSON.parse(catSettings[0].setting_value));
    setLoading(false);
  };

  const handleAddRow = async () => {
    if (!newRowName.trim()) return;
    await base44.entities.YearlyRow.create({ name: newRowName.trim(), order: rows.length, color: newRowColor });
    setNewRowName(""); setNewRowColor("#3b82f6"); setShowAddRowDialog(false); loadData();
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || viewOnly) return;
    const items = Array.from(rows);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setRows(items);
    
    for (let i = 0; i < items.length; i++) {
      await base44.entities.YearlyRow.update(items[i].id, { order: i });
    }
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
    setEventForm({ title: "", start_time: "08:00", end_time: "16:00", worker_ids: [], start_date: date, end_date: date });
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
      worker_ids: event.worker_ids || (event.worker_id ? [event.worker_id] : []),
      start_date: event.start_date,
      end_date: event.end_date
    });
    setShowEventDialog(true);
  };

  const handleSaveEvent = async () => {
    const workerNames = eventForm.worker_ids.map(id => workers.find(w => w.id === id)?.full_name).filter(Boolean);
    const data = {
      row_id: selectedCell.rowId,
      start_date: eventForm.start_date,
      end_date: eventForm.end_date,
      title: eventForm.title.trim() || "אירוע",
      start_time: eventForm.start_time,
      end_time: eventForm.end_time,
      worker_ids: eventForm.worker_ids,
      worker_id: eventForm.worker_ids[0] || null,
      worker_name: workerNames.join(", ") || null
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
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    let current = start;
    while (current <= end) { days.push(new Date(current)); current = addDays(current, 1); }
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
    // Prevent drag from starting on double-click
    if (e.detail > 1) return;
    setDragging({ event, type, startX: e.clientX, originalStart: event.start_date, originalEnd: event.end_date });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { event, type, startX, originalStart, originalEnd } = dragging;
    const deltaX = startX - e.clientX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);
    const origStartDate = parseISO(originalStart);
    const origEndDate = parseISO(originalEnd);
    let newStart = origStartDate, newEnd = origEndDate;
    if (type === "move") { newStart = addDays(origStartDate, deltaDays); newEnd = addDays(origEndDate, deltaDays); }
    else if (type === "resize-start") { newStart = addDays(origStartDate, deltaDays); if (newStart > newEnd) newStart = newEnd; }
    else if (type === "resize-end") { newEnd = addDays(origEndDate, deltaDays); if (newEnd < newStart) newEnd = newStart; }
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

  const layoutEventsInTracks = (rowEvents) => {
    const sorted = [...rowEvents].sort((a, b) => (yearDaysMap[a.start_date] ?? 999) - (yearDaysMap[b.start_date] ?? 999));
    const tracks = [];
    for (const event of sorted) {
      const pos = getEventPosition(event);
      if (!pos) continue;
      let placed = false;
      for (let i = 0; i < tracks.length; i++) {
        const lastInTrack = tracks[i][tracks[i].length - 1];
        const lastPos = getEventPosition(lastInTrack);
        if (lastPos && pos.left >= lastPos.left + lastPos.width) { tracks[i].push(event); placed = true; break; }
      }
      if (!placed) tracks.push([event]);
    }
    return tracks;
  };

  const filteredWorkersForDialog = workers.filter(w => {
    if (workerCategoryFilter !== "__all__" && w.category !== workerCategoryFilter) return false;
    if (workerRoleFilter !== "__all__" && w.role !== workerRoleFilter) return false;
    return true;
  });

  const EventBar = ({ event, row, trackIndex }) => {
    const displayEvent = dragging?.event?.id === event.id ? { ...event, start_date: dragging.newStart || event.start_date, end_date: dragging.newEnd || event.end_date } : event;
    const pos = getEventPosition(displayEvent);
    if (!pos) return null;
    const color = event.color || row?.color || "#3b82f6";
    const isDragging = dragging?.event?.id === event.id;
    const topOffset = 2 + trackIndex * (EVENT_HEIGHT + 2);
    return (
      <div
        className={`absolute rounded flex items-center text-white text-[10px] font-medium overflow-hidden ${viewOnly ? 'cursor-default' : 'cursor-pointer hover:brightness-110'} ${isDragging ? 'opacity-70 z-50' : 'z-10'}`}
        style={{ right: `${pos.left}px`, width: `${pos.width}px`, top: `${topOffset}px`, height: `${EVENT_HEIGHT}px`, backgroundColor: color }}
        onDoubleClick={(e) => { e.stopPropagation(); handleEventClick(event, e); }}
        title={`${event.title}${event.worker_name ? ` - ${event.worker_name}` : ""}${event.start_time ? ` (${event.start_time}-${event.end_time})` : ""} - לחץ פעמיים לעריכה`}
      >
        {!viewOnly && <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => handleDragStart(e, event, "resize-end")} />}
        <div className={`flex-1 px-1 truncate text-center ${viewOnly ? '' : 'cursor-move'}`} onMouseDown={(e) => !viewOnly && handleDragStart(e, event, "move")}>
          {event.title}
        </div>
        {!viewOnly && <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => handleDragStart(e, event, "resize-start")} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col" dir="rtl">
      <MenuButton />
      {/* Fixed Header */}
      <div className="fixed top-0 left-64 right-0 z-30 bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 pb-2">
        <div className="max-w-full mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">תצוגה תקופתית</h1>
            <p className="text-gray-600 text-sm">{viewOnly ? "מצב צפייה בלבד" : "לחץ פעמיים על אירוע לעריכה"}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border">
              <Label className="text-sm">מצב עריכה</Label>
              <Switch checked={!viewOnly} onCheckedChange={(checked) => setViewOnly(!checked)} />
              {!viewOnly ? <EyeOff className="w-4 h-4 text-green-600" /> : <Eye className="w-4 h-4 text-gray-500" />}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}><ChevronRight className="w-4 h-4" /></Button>
            <div className="px-4 py-2 bg-green-300 text-gray-800 rounded-lg font-semibold min-w-[100px] text-center">{currentYear}</div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>השנה</Button>
            </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4 pt-24">
        <Card className="border-none shadow-lg overflow-hidden h-full">
          <CardContent className="p-0 h-full">
            <div className="flex h-full">
              {/* Fixed Row Headers */}
              <div className="flex-shrink-0 bg-white border-l overflow-y-auto sticky right-0 z-40 shadow-lg" style={{ width: 160 }}>
                <div className="bg-green-300 text-gray-800 p-2 font-semibold text-right h-[36px] flex items-center sticky top-0 z-50">שורה</div>
                <div className="bg-green-200 text-gray-800 p-2 text-xs text-right h-[28px] flex items-center sticky top-[36px] z-50">שבוע</div>
                <div className="bg-gray-100 p-2 text-xs font-medium text-right h-[52px] flex items-center sticky top-[64px] z-50 border-b">יום, תאריך</div>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="rows">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {rows.map((row, rowIdx) => {
                          const rowEvents = getEventsForRow(row.id);
                          const tracks = layoutEventsInTracks(rowEvents);
                          const dynamicHeight = Math.max(ROW_HEIGHT, 8 + tracks.length * (EVENT_HEIGHT + 2));
                          return (
                            <Draggable key={row.id} draggableId={row.id} index={rowIdx} isDragDisabled={viewOnly}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`p-2 border-b flex items-center justify-between ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                  style={{ height: dynamicHeight, ...provided.draggableProps.style }}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {!viewOnly && (
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }}></div>
                                    <span className="text-sm font-medium truncate">{row.name}</span>
                                  </div>
                                  {!viewOnly && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <div className="relative">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowColorPicker(showColorPicker === row.id ? null : row.id)}><Palette className="w-3 h-3" /></Button>
                                        {showColorPicker === row.id && (
                                          <div className="absolute top-7 left-0 bg-white border rounded-lg shadow-lg p-2 z-50 flex gap-1 flex-wrap w-24">
                                            {ROW_COLORS.map(c => (<button key={c} className="w-5 h-5 rounded-full border-2 border-white hover:scale-110" style={{ backgroundColor: c }} onClick={() => handleChangeRowColor(row.id, c)} />))}
                                          </div>
                                        )}
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(row.id)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        </div>
                        )}
                        </Droppable>
                        </DragDropContext>

                        {!viewOnly && (
                        <button
                        onClick={() => setShowAddRowDialog(true)}
                        className="w-full p-3 border-b bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-blue-900 font-medium"
                        >
                        <Plus className="w-4 h-4" />
                        <span>הוסף שורה</span>
                        </button>
                        )}
                

              </div>

              {/* Scrollable Grid */}
              <div className="overflow-auto flex-1" ref={scrollContainerRef}>
                <div style={{ minWidth: `${yearDays.length * CELL_WIDTH}px` }}>
                  {/* Month Header */}
                  <div className="flex bg-green-300 text-gray-800 h-[36px] sticky top-0 z-10">
                    {monthGroups.map((group, idx) => (
                      <div key={idx} className="text-center font-semibold text-xs py-2 border-l flex items-center justify-center" style={{ width: `${group.count * CELL_WIDTH}px` }}>
                        {HEBREW_MONTHS[group.month]}
                      </div>
                    ))}
                  </div>

                  {/* Week Header */}
                  <div className="flex bg-green-200 text-gray-800 h-[28px] sticky top-[36px] z-10">
                    {weekGroups.map((group, idx) => (
                      <div key={idx} className="text-center text-xs py-1 border-l flex items-center justify-center" style={{ width: `${group.count * CELL_WIDTH}px` }}>
                        {group.week}
                      </div>
                    ))}
                  </div>

                  {/* Day/Date Header */}
                  <div className="flex bg-gray-100 h-[52px] sticky top-[64px] z-10">
                    {yearDays.map((day, idx) => {
                      const dayOfWeek = getDay(day);
                      const isShabbat = dayOfWeek === 6;
                      const isFriday = dayOfWeek === 5;
                      const hebDate = getHebrewDate(day);
                      return (
                        <div key={idx} className={`text-center text-[8px] py-1 border-l leading-tight flex flex-col justify-center ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : 'bg-gray-100'}`} style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}>
                          <div className="font-semibold">{HEBREW_DAYS[dayOfWeek]}</div>
                          <div>{day.getDate()}</div>
                          <div className="text-gray-500">{hebDate.dayHeb}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom Rows */}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="rows-grid">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                          {rows.map((row, rowIdx) => {
                            const rowEvents = getEventsForRow(row.id);
                            const tracks = layoutEventsInTracks(rowEvents);
                            const dynamicHeight = Math.max(ROW_HEIGHT, 8 + tracks.length * (EVENT_HEIGHT + 2));
                            return (
                              <Draggable key={row.id} draggableId={row.id} index={rowIdx} isDragDisabled={viewOnly}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`flex border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                    style={{ height: dynamicHeight, ...provided.draggableProps.style }}
                                  >
                                    <div className="relative flex" style={{ width: `${yearDays.length * CELL_WIDTH}px` }}>
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
                                      {tracks.map((track, trackIdx) => track.map(event => <EventBar key={event.id} event={event} row={row} trackIndex={trackIdx} />))}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          </div>
                          )}
                          </Droppable>
                          </DragDropContext>


                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={showAddRowDialog} onOpenChange={setShowAddRowDialog}>
        <DialogContent className="sm:max-w-md">
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

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-md">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סינון קטגוריה</Label>
                <Select value={workerCategoryFilter} onValueChange={setWorkerCategoryFilter}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">הכל</SelectItem>
                    <SelectItem value="category_1">{categoryNames.category_1}</SelectItem>
                    <SelectItem value="category_2">{categoryNames.category_2}</SelectItem>
                    <SelectItem value="category_3">{categoryNames.category_3}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סינון תפקיד</Label>
                <Select value={workerRoleFilter} onValueChange={setWorkerRoleFilter}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">הכל</SelectItem>
                    <SelectItem value="chef">שף</SelectItem>
                    <SelectItem value="sous_chef">סו-שף</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label>משתתפים ({eventForm.worker_ids.length})</Label>
                {filteredWorkersForDialog.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setEventForm({...eventForm, worker_ids: filteredWorkersForDialog.map(w => w.id)})}
                  >
                    בחר הכל ({filteredWorkersForDialog.length})
                  </Button>
                )}
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                {filteredWorkersForDialog.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      checked={eventForm.worker_ids.includes(w.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEventForm({...eventForm, worker_ids: [...eventForm.worker_ids, w.id]});
                        } else {
                          setEventForm({...eventForm, worker_ids: eventForm.worker_ids.filter(id => id !== w.id)});
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{w.full_name}</span>
                  </label>
                ))}
                {filteredWorkersForDialog.length === 0 && <p className="text-xs text-gray-500">אין עובדים תואמים</p>}
              </div>
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
  );
}
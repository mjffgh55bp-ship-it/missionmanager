import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getCachedWorkers, getCachedAllSettings } from "@/lib/appDataCache";
import { Card, CardContent } from "@/components/ui/card";
import { getTaskQuals } from "@/lib/taskQuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";

import { ChevronLeft, ChevronRight, Plus, Trash2, Palette, GripVertical, Clock, User, CalendarDays, Pencil, X } from "lucide-react";
import { format, addDays, getDay, differenceInDays, parseISO } from "date-fns";
import { getHebrewDate } from "../components/utils/HebrewDate";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
  const [workerRoles, setWorkerRoles] = useState([]);
  const [workerPopulations, setWorkerPopulations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskQualifications, setTaskQualifications] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewOnly, setViewOnly] = useState(true);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [newRowName, setNewRowName] = useState("");
  const [newRowColor, setNewRowColor] = useState("#3b82f6");
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", start_time: "08:00", end_time: "16:00", worker_ids: [], start_date: "", end_date: "" });
  const [filterRoles, setFilterRoles] = useState([]);
  const [filterPopulations, setFilterPopulations] = useState([]);
  const [filterTasks, setFilterTasks] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const scrollContainerRef = useRef(null);
  const rowHeaderRef = useRef(null);

  useEffect(() => { loadData(); }, [currentYear]);

  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      setTimeout(() => {
        if (!scrollContainerRef.current) return;
        const jumpTarget = localStorage.getItem('yearly_jump_date');
        if (jumpTarget && jumpTarget.startsWith(`${currentYear}-`)) {
          localStorage.removeItem('yearly_jump_date');
          scrollToDate(jumpTarget);
          return;
        }
        const savedScrollPosition = localStorage.getItem(`yearly_scroll_${currentYear}`);
        if (savedScrollPosition !== null) {
          if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = parseInt(savedScrollPosition, 10);
        } else {
          scrollToToday();
        }
      }, 150);
    }
  }, [loading, currentYear]);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        localStorage.setItem(`yearly_scroll_${currentYear}`, scrollContainerRef.current.scrollLeft.toString());
      }
    };
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [currentYear, loading]);

  useEffect(() => {
    const grid = scrollContainerRef.current;
    const headers = rowHeaderRef.current;
    if (!grid || !headers) return;
    const syncScroll = () => { headers.scrollTop = grid.scrollTop; };
    grid.addEventListener('scroll', syncScroll);
    return () => grid.removeEventListener('scroll', syncScroll);
  }, [loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rowsData, eventsData, unavailData] = await Promise.all([
        base44.entities.YearlyRow.list("order"),
        base44.entities.YearlyEvent.list(),
        base44.entities.Unavailability.list(),
      ]);
      const [workersData, allSettings] = await Promise.all([
        getCachedWorkers(base44.entities),
        getCachedAllSettings(base44.entities),
      ]);
      const getSetting = (key) => allSettings.find(s => s.setting_key === key);
      const rolesS = getSetting("worker_roles");
      const popsS = getSetting("worker_populations");
      const tasksS = getSetting("tasks_list");
      const taskQualS = getSetting("task_qualifications");

      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      setRows(rowsData);
      setEvents(eventsData.filter(e => (e.start_date >= yearStart && e.start_date <= yearEnd) || (e.end_date >= yearStart && e.end_date <= yearEnd)));
      setWorkers(workersData);
      // People row in Yearly shows only חו״ל / חופש. לו״ז, אישי and event constraints are excluded.
      setUnavailabilities(unavailData.filter(u => u.date >= yearStart && u.date <= yearEnd && ['overseas', 'vacation'].includes(u.reason)));
      const rawRoles = rolesS ? JSON.parse(rolesS.setting_value) : ["שף", "סו-שף"];
      setWorkerRoles(rawRoles.map(r => (typeof r === 'string' ? r : r.name || r.mapping_id || "")));
      const rawPops = popsS ? JSON.parse(popsS.setting_value) : ["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"];
      setWorkerPopulations(rawPops.map(p => (typeof p === 'string' ? p : p.name || p.mapping_id || "")));
      const rawTasksY = tasksS ? JSON.parse(tasksS.setting_value) : [];
      setTasks(rawTasksY.map(t => {
      if (typeof t === 'string') return { name: t, mapping_id: "", export_name: "", is_importable: true, is_exportable: true };
      return { ...t, name: t.name || t.mapping_id || "" };
      }));
      setTaskQualifications(taskQualS ? JSON.parse(taskQualS.setting_value) : {});
    } catch (error) {
      console.error('Error loading yearly data:', error);
    } finally {
      setLoading(false);
    }
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
      const linked = await base44.entities.Unavailability.filter({ yearly_event_id: event.id });
      for (const u of linked) await base44.entities.Unavailability.delete(u.id);
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
    setFilterRoles([]); setFilterPopulations([]); setFilterTasks([]);
    setEventForm({ title: "", start_time: "08:00", end_time: "16:00", worker_ids: [], start_date: date, end_date: date });
    setShowEventDialog(true);
  };

  const handleEventDoubleClick = (event, e) => {
    e.stopPropagation();
    if (viewOnly) {
      setViewingEvent(event);
      setShowViewDialog(true);
    } else {
      setEditingEvent(event);
      setSelectedCell({ rowId: event.row_id, date: event.start_date });
      setFilterRoles([]); setFilterPopulations([]); setFilterTasks([]);
      setEventForm({
        title: event.title || "",
        start_time: event.start_time || "08:00",
        end_time: event.end_time || "16:00",
        worker_ids: event.worker_ids || (event.worker_id ? [event.worker_id] : []),
        start_date: event.start_date,
        end_date: event.end_date
      });
      setShowEventDialog(true);
    }
  };

  // Sync auto-generated matrix constraints for a yearly event's participants.
  // Wipes the event's existing linked constraints, then recreates one per worker per day.
  const syncEventConstraints = async (eventId, ev) => {
    const existing = await base44.entities.Unavailability.filter({ yearly_event_id: eventId });
    for (const u of existing) await base44.entities.Unavailability.delete(u.id);
    const dates = [];
    let d = parseISO(ev.start_date);
    const end = parseISO(ev.end_date);
    while (d <= end && dates.length < 120) { dates.push(format(d, "yyyy-MM-dd")); d = addDays(d, 1); }
    for (const wid of ev.worker_ids || []) {
      const w = workers.find(x => x.id === wid);
      for (const dateStr of dates) {
        await base44.entities.Unavailability.create({
          worker_id: wid,
          worker_name: w?.nickname || "",
          date: dateStr,
          start_time: ev.start_time || "00:00",
          end_time: ev.end_time || "23:59",
          reason: "periodic_event",
          yearly_event_id: eventId,
          yearly_event_name: ev.title || "אירוע",
        });
      }
    }
  };

  const handleSaveEvent = async () => {
    const workerNames = eventForm.worker_ids.map(id => workers.find(w => w.id === id)?.nickname).filter(Boolean);
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
    let savedId;
    if (editingEvent) { await base44.entities.YearlyEvent.update(editingEvent.id, data); savedId = editingEvent.id; }
    else { const created = await base44.entities.YearlyEvent.create(data); savedId = created.id; }
    await syncEventConstraints(savedId, data);
    setShowEventDialog(false); setSelectedCell(null); setEditingEvent(null); loadData();
  };

  const handleDeleteEvent = async () => {
    if (editingEvent) {
      const linked = await base44.entities.Unavailability.filter({ yearly_event_id: editingEvent.id });
      for (const u of linked) await base44.entities.Unavailability.delete(u.id);
      await base44.entities.YearlyEvent.delete(editingEvent.id);
      setShowEventDialog(false); setEditingEvent(null); loadData();
    }
  };

  const generateYearDays = () => {
    const days = [];
    let current = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    while (current <= end) { days.push(new Date(current)); current = addDays(current, 1); }
    return days;
  };

  const yearDays = useMemo(() => generateYearDays(), [currentYear]);
  const yearDaysMap = useMemo(() => {
    const map = {};
    yearDays.forEach((d, i) => { map[format(d, "yyyy-MM-dd")] = i; });
    return map;
  }, [yearDays]);

  const scrollToToday = () => {
    if (!scrollContainerRef.current) return;
    const todayDate = new Date();
    if (todayDate.getFullYear() !== currentYear) return;
    const todayStr = format(todayDate, "yyyy-MM-dd");
    const el = scrollContainerRef.current.querySelector(`[data-date="${todayStr}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "start" });
    }
  };

  const scrollToDate = (dateStr) => {
    if (!scrollContainerRef.current || !dateStr) return;
    const el = scrollContainerRef.current.querySelector(`[data-date="${dateStr}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "center" });
    }
  };

  const handleJumpToDate = () => {
    if (!jumpDate) return;
    const parsed = new Date(jumpDate);
    if (isNaN(parsed)) return;
    const year = parsed.getFullYear();
    const dateStr = format(parsed, "yyyy-MM-dd");
    setShowDatePicker(false);
    if (year !== currentYear) {
      localStorage.setItem('yearly_jump_date', dateStr);
      setCurrentYear(year);
    } else {
      scrollToDate(dateStr);
    }
  };

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
    if (e.detail > 1) return;
    setDragging({ event, type, startX: e.clientX, originalStart: event.start_date, originalEnd: event.end_date });
  };

  const handleMouseMove = useCallback((e) => {
    setDragging(prev => {
      if (!prev) return prev;
      const { type, startX, originalStart, originalEnd } = prev;
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
      return { ...prev, newStart: format(newStart, "yyyy-MM-dd"), newEnd: format(newEnd, "yyyy-MM-dd") };
    });
  }, [currentYear]);

  const handleMouseUp = useCallback(async () => {
    setDragging(prev => {
      if (!prev) return prev;
      const { event, newStart, newEnd } = prev;
      if (newStart && newEnd) {
        base44.entities.YearlyEvent.update(event.id, { start_date: newStart, end_date: newEnd }).then(() => loadData());
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [!!dragging, handleMouseMove, handleMouseUp]);

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

  const monthGroups = useMemo(() => getMonthGroups(), [yearDays]);
  const weekGroups = useMemo(() => getWeekGroups(), [yearDays]);

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

  const filteredWorkersForDialog = useMemo(() => workers.filter(w => {
    if (filterRoles.length > 0) {
      const workerRoleArr = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      if (!filterRoles.some(r => workerRoleArr.includes(r))) return false;
    }
    if (filterPopulations.length > 0) {
      if (!filterPopulations.includes(w.population)) return false;
    }
    if (filterTasks.length > 0) {
      const passesAll = filterTasks.every(task => {
        const quals = getTaskQuals(taskQualifications, task) || {};
        const qualifiedIds = Object.values(quals).flat();
        return qualifiedIds.includes(w.id);
      });
      if (!passesAll) return false;
    }
    return true;
  }), [workers, filterRoles, filterPopulations, filterTasks, taskQualifications]);

  const addAllFiltered = () => {
    const filteredIds = filteredWorkersForDialog.map(w => w.id);
    const merged = [...new Set([...eventForm.worker_ids, ...filteredIds])];
    setEventForm({ ...eventForm, worker_ids: merged });
  };

  const removeAllFiltered = () => {
    const filteredIds = filteredWorkersForDialog.map(w => w.id);
    setEventForm({ ...eventForm, worker_ids: eventForm.worker_ids.filter(id => !filteredIds.includes(id)) });
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
        className={`absolute rounded flex items-center text-white text-[10px] font-medium overflow-hidden cursor-pointer hover:brightness-110 ${isDragging ? 'opacity-70 z-50' : 'z-10'}`}
        style={{ right: `${pos.left}px`, width: `${pos.width}px`, top: `${topOffset}px`, height: `${EVENT_HEIGHT}px`, backgroundColor: color }}
        onDoubleClick={(e) => handleEventDoubleClick(event, e)}
        title={viewOnly ? `${event.title}${event.worker_name ? ` - ${event.worker_name}` : ""} — לחץ פעמיים לצפייה` : `${event.title} — לחץ פעמיים לעריכה`}
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
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-gray-50 to-gray-100 p-4 pb-2 border-b border-gray-200" style={{ marginRight: 48 }}>
        <div className="max-w-full mx-auto flex items-center justify-between gap-4">
          {/* Right: Navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={() => {
              const todayYear = new Date().getFullYear();
              const todayStr = format(new Date(), "yyyy-MM-dd");
              if (currentYear === todayYear) {
                localStorage.removeItem(`yearly_scroll_${todayYear}`);
                scrollToToday();
              } else {
                localStorage.setItem('yearly_jump_date', todayStr);
                setCurrentYear(todayYear);
              }
            }}>היום</Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}><ChevronRight className="w-4 h-4" /></Button>
            <div className="relative">
              <button
                className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[80px] text-center hover:bg-blue-800 transition-colors"
                onClick={() => { setJumpDate(""); setShowDatePicker(v => !v); }}
              >
                {currentYear}
              </button>
              {showDatePicker && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white border rounded-lg shadow-xl p-3 z-50 flex flex-col gap-2 w-52" dir="rtl">
                  <p className="text-xs text-gray-500 font-medium">קפוץ לתאריך ספציפי</p>
                  <Input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)} className="h-8 text-sm" dir="ltr" />
                  <Button size="sm" onClick={handleJumpToDate} disabled={!jumpDate}>קפוץ</Button>
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}><ChevronLeft className="w-4 h-4" /></Button>
          </div>

          {/* Left: Edit mode toggle */}
          {!viewOnly ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setViewOnly(true)}>
                <X className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-blue-500 text-blue-600 bg-blue-50" onClick={() => setViewOnly(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setViewOnly(false)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent dir="rtl">מצב עריכה</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4 pt-20">
        <Card className="border-none shadow-lg overflow-hidden h-full">
          <CardContent className="p-0 h-full">
            <div className="flex h-full">
              {/* Fixed Row Headers */}
              <div ref={rowHeaderRef} className="flex-shrink-0 bg-white border-l overflow-y-hidden flex flex-col sticky right-0 z-40 shadow-lg" style={{ width: 160 }}>
                <div className="bg-blue-900 text-white p-2 font-semibold text-right h-[36px] flex items-center flex-shrink-0"></div>
                <div className="bg-blue-800 text-white p-2 text-xs text-right h-[28px] flex items-center flex-shrink-0">שבוע</div>
                <div className="bg-gray-100 p-2 text-xs font-medium text-right h-[52px] flex items-center flex-shrink-0 border-b">יום, תאריך</div>

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
                                  className={`p-2 border-b flex items-start justify-between ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                  style={{ height: dynamicHeight, ...provided.draggableProps.style }}
                                >
                                  <div className="flex items-center gap-2 min-w-0 pt-1">
                                    {!viewOnly && (
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: row.color }}></div>
                                    <span className="text-sm font-medium truncate">{row.name}</span>
                                  </div>
                                  {!viewOnly && (
                                    <div className="flex items-center gap-1 flex-shrink-0 pt-1">
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
                  <button onClick={() => setShowAddRowDialog(true)} className="w-full p-3 border-b bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-blue-900 font-medium">
                    <Plus className="w-4 h-4" /><span>הוסף שורה</span>
                  </button>
                )}

                {unavailabilities.length > 0 && (
                  <div className="p-2 border-b bg-red-50 flex items-center gap-2" style={{ height: ROW_HEIGHT }}>
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-xs font-medium text-red-700">אנשים</span>
                  </div>
                )}
              </div>

              {/* Scrollable Grid */}
              <div className="overflow-auto flex-1" ref={scrollContainerRef}>
                <div style={{ minWidth: `${yearDays.length * CELL_WIDTH}px` }}>
                  {/* Month Header */}
                  <div className="flex bg-blue-900 text-white h-[36px] sticky top-0 z-10">
                    {monthGroups.map((group, idx) => (
                      <div key={idx} className="text-center font-semibold text-xs py-2 border-l flex items-center justify-center" style={{ width: `${group.count * CELL_WIDTH}px` }}>
                        {HEBREW_MONTHS[group.month]}
                      </div>
                    ))}
                  </div>

                  {/* Week Header */}
                  <div className="flex bg-blue-800 text-white h-[28px] sticky top-[36px] z-10">
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
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                      return (
                        <div key={idx} data-date={dateStr} className={`text-center text-[8px] py-1 border-l leading-tight flex flex-col justify-center ${isToday ? 'border-r-2 border-r-blue-500' : ''} ${isShabbat ? 'bg-amber-100' : isFriday ? 'bg-amber-50' : 'bg-gray-100'}`} style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}>
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
                                        const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                                        return (
                                          <div key={idx}
                                            className={`h-full border-l ${isToday ? 'border-r-2 border-r-blue-500' : ''} ${viewOnly ? '' : 'cursor-pointer hover:bg-blue-50'} ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`}
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

                  {/* Unavailability Row */}
                  {unavailabilities.length > 0 && (() => {
                    const groupedByWorker = {};
                    unavailabilities.forEach(unavail => {
                      if (!groupedByWorker[unavail.worker_id]) groupedByWorker[unavail.worker_id] = [];
                      groupedByWorker[unavail.worker_id].push(unavail);
                    });
                    const mergedBars = [];
                    Object.entries(groupedByWorker).forEach(([workerId, workerUnavails]) => {
                      workerUnavails.sort((a, b) => a.date.localeCompare(b.date));
                      let currentGroup = null;
                      workerUnavails.forEach(unavail => {
                        const dateIdx = yearDaysMap[unavail.date];
                        if (dateIdx === undefined) return;
                        if (!currentGroup) {
                          currentGroup = { worker_id: workerId, startIdx: dateIdx, endIdx: dateIdx, unavails: [unavail] };
                        } else if (dateIdx === currentGroup.endIdx + 1) {
                          currentGroup.endIdx = dateIdx;
                          currentGroup.unavails.push(unavail);
                        } else {
                          mergedBars.push(currentGroup);
                          currentGroup = { worker_id: workerId, startIdx: dateIdx, endIdx: dateIdx, unavails: [unavail] };
                        }
                      });
                      if (currentGroup) mergedBars.push(currentGroup);
                    });

                    // Lay out bars in non-overlapping tracks (stacked vertically)
                    const sorted = [...mergedBars].sort((a, b) => a.startIdx - b.startIdx);
                    const tracks = [];
                    for (const bar of sorted) {
                      let placed = false;
                      for (let i = 0; i < tracks.length; i++) {
                        const lastInTrack = tracks[i][tracks[i].length - 1];
                        if (bar.startIdx > lastInTrack.endIdx) {
                          tracks[i].push(bar);
                          placed = true;
                          break;
                        }
                      }
                      if (!placed) tracks.push([bar]);
                    }
                    const unavailRowHeight = Math.max(ROW_HEIGHT, tracks.length * (EVENT_HEIGHT + 2) + 4);

                    return (
                      <div className="flex border-b bg-red-50" style={{ height: unavailRowHeight }}>
                        <div className="relative flex" style={{ width: `${yearDays.length * CELL_WIDTH}px` }}>
                          {yearDays.map((day, idx) => {
                            const dayOfWeek = getDay(day);
                            const isShabbat = dayOfWeek === 6;
                            const isFriday = dayOfWeek === 5;
                            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                            return <div key={idx} className={`h-full border-l ${isToday ? 'border-r-2 border-r-blue-500' : ''} ${isShabbat ? 'bg-amber-50' : isFriday ? 'bg-amber-50/50' : ''}`} style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }} />;
                          })}
                          {tracks.map((track, trackIdx) => track.map((group, idx) => {
                            const worker = workers.find(w => w.id === group.worker_id);
                            const width = (group.endIdx - group.startIdx + 1) * CELL_WIDTH - 2;
                            const topOffset = 2 + trackIdx * (EVENT_HEIGHT + 2);
                            return (
                              <div key={`${group.worker_id}-${idx}`} className="absolute rounded bg-red-500 flex items-center justify-center text-white text-[8px] font-medium px-1 z-10"
                                style={{ right: `${group.startIdx * CELL_WIDTH}px`, width: `${width}px`, height: EVENT_HEIGHT, top: `${topOffset}px` }}
                                title={`${worker?.nickname || 'Unknown'}: ${format(parseISO(group.unavails[0].date), 'dd/MM')}-${format(parseISO(group.unavails[group.unavails.length - 1].date), 'dd/MM')}`}>
                                <span className="truncate">{worker?.nickname?.split(' ')[0] || '?'}</span>
                              </div>
                            );
                          }))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Close date picker on outside click */}
      {showDatePicker && <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />}

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

      {/* View Event Dialog (read-only) */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>פרטי אירוע</DialogTitle></DialogHeader>
          {viewingEvent && (
            <div className="py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded flex-shrink-0 mt-0.5" style={{ backgroundColor: viewingEvent.color || rows.find(r => r.id === viewingEvent.row_id)?.color || "#3b82f6" }} />
                <div>
                  <p className="font-semibold text-lg">{viewingEvent.title}</p>
                  <p className="text-sm text-gray-500">{rows.find(r => r.id === viewingEvent.row_id)?.name || ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span>{viewingEvent.start_date === viewingEvent.end_date ? viewingEvent.start_date : `${viewingEvent.start_date} — ${viewingEvent.end_date}`}</span>
              </div>
              {(viewingEvent.start_time || viewingEvent.end_time) && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{viewingEvent.start_time} - {viewingEvent.end_time}</span>
                </div>
              )}
              {viewingEvent.worker_ids?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">משתתפים ({viewingEvent.worker_ids.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pr-6">
                    {viewingEvent.worker_ids.map(id => {
                      const w = workers.find(wk => wk.id === id);
                      return w ? <span key={id} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{w.nickname}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle className="text-right">{editingEvent ? "ערוך אירוע" : "הוסף אירוע"}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="block text-right mb-1">כותרת</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm({...eventForm, title: e.target.value})} placeholder="שם האירוע" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-right mb-1">תאריך התחלה</Label>
                <Input type="date" value={eventForm.start_date} onChange={(e) => setEventForm({...eventForm, start_date: e.target.value})} />
              </div>
              <div>
                <Label className="block text-right mb-1">תאריך סיום</Label>
                <Input type="date" value={eventForm.end_date} onChange={(e) => setEventForm({...eventForm, end_date: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-right mb-1">שעת התחלה</Label>
                <Input type="time" value={eventForm.start_time} onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})} />
              </div>
              <div>
                <Label className="block text-right mb-1">שעת סיום</Label>
                <Input type="time" value={eventForm.end_time} onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})} />
              </div>
            </div>
            <div>
              <Label className="block text-right mb-2">משתתפים ({eventForm.worker_ids.length})</Label>

              {/* Filters */}
              <div className="space-y-2 mb-3 p-2 bg-gray-50 rounded-lg border">
                {workerPopulations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">אוכלוסייה</p>
                    <div className="flex flex-wrap gap-1">
                      {workerPopulations.map(pop => (
                        <button key={pop} type="button"
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterPopulations.includes(pop) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'}`}
                          onClick={() => setFilterPopulations(prev => prev.includes(pop) ? prev.filter(p => p !== pop) : [...prev, pop])}>
                          {pop}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {workerRoles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">תפקיד</p>
                    <div className="flex flex-wrap gap-1">
                      {workerRoles.map(role => (
                        <button key={role} type="button"
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterRoles.includes(role) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
                          onClick={() => setFilterRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])}>
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">כשירות למשימה</p>
                    <div className="flex flex-wrap gap-1">
                      {tasks.map(task => {
                        const taskName = task.name || "";
                        return (
                          <button key={taskName || Math.random()} type="button"
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterTasks.includes(taskName) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}
                            onClick={() => setFilterTasks(prev => prev.includes(taskName) ? prev.filter(t => t !== taskName) : [...prev, taskName])}>
                            {taskName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Add/Remove all buttons */}
              <div className="flex gap-2 mb-2">
                <button type="button" className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors" onClick={addAllFiltered}>
                  הוסף הכל ({filteredWorkersForDialog.length})
                </button>
                <button type="button" className="text-xs px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors" onClick={removeAllFiltered}>
                  הסר הכל ({filteredWorkersForDialog.length})
                </button>
              </div>

              {/* Worker list */}
              <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1">
                {filteredWorkersForDialog.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" checked={eventForm.worker_ids.includes(w.id)} onChange={(e) => {
                      if (e.target.checked) setEventForm({...eventForm, worker_ids: [...eventForm.worker_ids, w.id]});
                      else setEventForm({...eventForm, worker_ids: eventForm.worker_ids.filter(id => id !== w.id)});
                    }} className="rounded" />
                    <span className="text-sm">{w.nickname}</span>
                    {w.role && <span className="text-xs text-gray-400">{Array.isArray(w.role) ? w.role.join(", ") : w.role}</span>}
                  </label>
                ))}
                {filteredWorkersForDialog.length === 0 && <p className="text-xs text-gray-500 text-center py-2">אין עובדים התואמים את הסינון</p>}
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
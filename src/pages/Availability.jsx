import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Check, X, AlertCircle, Info, GripVertical, Plus, XCircle, Star, Ban, ChevronLeft, ChevronRight, PartyPopper, Pencil, Download } from "lucide-react";
import { format, startOfWeek, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { formatHebrewDate } from "../components/utils/HebrewDate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SHIFT_BLOCKS = [
  { start: "06:00", end: "10:00" },
  { start: "10:00", end: "14:00" },
  { start: "14:00", end: "18:00" },
  { start: "18:00", end: "22:00" },
  { start: "22:00", end: "02:00" },
  { start: "02:00", end: "06:00" }
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Availability() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [originalShifts, setOriginalShifts] = useState([]);
  const [existingAvailability, setExistingAvailability] = useState(null);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [yearlyEvents, setYearlyEvents] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [showChangeRecap, setShowChangeRecap] = useState(false);
  const [showUnavailabilityDialog, setShowUnavailabilityDialog] = useState(false);
  const [showDateDetails, setShowDateDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [tipsMessage, setTipsMessage] = useState("");
  const [showTipsPopup, setShowTipsPopup] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [unavailabilityForm, setUnavailabilityForm] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "17:00",
    reason: "occupied",
    multiDay: false
  });
  const [desiredShiftsCount, setDesiredShiftsCount] = useState("");

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const loadData = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);
    
    const workersData = await base44.entities.Worker.filter({ active: true });
    setWorkers(workersData);
    
    const worker = workersData.find(w => w.email === user.email);
    setCurrentWorker(worker);
    
    const [settings, eventsData, yearlyEventsData] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "availability_tips" }),
      base44.entities.CompanyEvent.list("-date"),
      base44.entities.YearlyEvent.list()
    ]);
    
    if (settings.length > 0) {
      const tipsData = JSON.parse(settings[0].setting_value);
      setTipsMessage(tipsData.message || "");
      if (tipsData.message && tipsData.message.trim() && tipsData.showAsPopup) {
        setShowTipsPopup(true);
      }
    }
    
    setCompanyEvents(eventsData);
    setYearlyEvents(yearlyEventsData);
    
    if (worker) {
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
      
      const [availabilities, unavailabilitiesData, assignmentsData] = await Promise.all([
        base44.entities.Availability.filter({
          worker_id: worker.id,
          week_start_date: weekStartStr
        }),
        base44.entities.Unavailability.filter({
          worker_id: worker.id
        }),
        base44.entities.Assignment.list("-date")
      ]);
      
      if (availabilities.length > 0) {
        setExistingAvailability(availabilities[0]);
        const shifts = availabilities[0].shifts || [];
        setSelectedShifts(shifts);
        setOriginalShifts(JSON.parse(JSON.stringify(shifts)));
      } else {
        setExistingAvailability(null);
        setSelectedShifts([]);
        setOriginalShifts([]);
      }
      
      const weekUnavailabilities = unavailabilitiesData.filter(u => {
        const uDate = new Date(u.date);
        return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
      });
      setUnavailabilities(weekUnavailabilities);
      
      const workerAssignments = assignmentsData.filter(a => 
        a.chef_id === worker.id || 
        a.sous_chef_id === worker.id || 
        a.additional_chef_id === worker.id
      );
      setAssignments(workerAssignments);
    }
  };

  const getShiftState = (date, shiftBlock) => {
    const shift = selectedShifts.find(
      s => s.date === date && s.start_time === shiftBlock.start && s.end_time === shiftBlock.end
    );
    return shift?.type || null;
  };

  const cycleShiftState = (date, shiftBlock) => {
    if (existingAvailability?.status === "approved" && !showEditMode) return;

    const currentState = getShiftState(date, shiftBlock);

    let newShifts = selectedShifts.filter(
      s => !(s.date === date && s.start_time === shiftBlock.start && s.end_time === shiftBlock.end)
    );

    if (currentState === null) {
      const wantedCount = newShifts.filter(s => s.type === "wanted").length;
      newShifts.push({
        date,
        start_time: shiftBlock.start,
        end_time: shiftBlock.end,
        type: "wanted",
        priority: wantedCount + 1
      });
    } else if (currentState === "wanted") {
      const availableCount = newShifts.filter(s => s.type === "available").length;
      newShifts.push({
        date,
        start_time: shiftBlock.start,
        end_time: shiftBlock.end,
        type: "available",
        priority: availableCount + 1
      });
    } else if (currentState === "available") {
      newShifts.push({
        date,
        start_time: shiftBlock.start,
        end_time: shiftBlock.end,
        type: "unavailable",
        priority: 0
      });
    }

    setSelectedShifts(newShifts);
  };

  const handleDragEnd = (result, listType) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedShifts.filter(s => s.type === listType));
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const updatedItems = items.map((item, index) => ({
      ...item,
      priority: index + 1
    }));
    
    const otherShifts = selectedShifts.filter(s => s.type !== listType);
    setSelectedShifts([...otherShifts, ...updatedItems]);
  };

  const handleSubmit = async () => {
    if (!currentWorker) return;

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const availabilityData = {
      worker_id: currentWorker.id,
      worker_name: currentWorker.full_name,
      week_start_date: weekStartStr,
      shifts: selectedShifts,
      status: "submitted",
      desired_shifts: desiredShiftsCount ? parseInt(desiredShiftsCount) : null
    };

    let updatedAvailability;
    if (existingAvailability) {
      updatedAvailability = await base44.entities.Availability.update(existingAvailability.id, availabilityData);
      setExistingAvailability(updatedAvailability);
    } else {
      updatedAvailability = await base44.entities.Availability.create(availabilityData);
      setExistingAvailability(updatedAvailability);
    }
    
    setOriginalShifts(JSON.parse(JSON.stringify(selectedShifts)));
    setShowSummary(false);
    setShowEditMode(false);
  };

  const handleSubmitChangeRequest = async () => {
    if (!existingAvailability) return;

    const updatedAvailability = await base44.entities.Availability.update(existingAvailability.id, {
      shifts: selectedShifts,
      status: "pending_change",
      change_request: changeNote || "Shift changes requested"
    });

    setExistingAvailability(updatedAvailability);
    setOriginalShifts(JSON.parse(JSON.stringify(selectedShifts)));
    setShowChangeRecap(false);
    setShowEditMode(false);
    setChangeNote("");
  };

  const getChanges = () => {
    const added = selectedShifts.filter(s => 
      !originalShifts.find(o => 
        o.date === s.date && o.start_time === s.start_time && o.end_time === s.end_time && o.type === s.type
      )
    );
    const removed = originalShifts.filter(o => 
      !selectedShifts.find(s => 
        s.date === o.date && s.start_time === o.start_time && s.end_time === o.end_time && s.type === o.type
      )
    );
    return { added, removed };
  };

  const handleAddUnavailability = async () => {
    if (!currentWorker) return;

    const startDate = new Date(unavailabilityForm.start_date);
    const endDate = unavailabilityForm.multiDay ? new Date(unavailabilityForm.end_date) : startDate;
    
    // Create unavailabilities for each day in range
    const datesToAdd = [];
    let currentD = new Date(startDate);
    while (currentD <= endDate) {
      datesToAdd.push(format(currentD, "yyyy-MM-dd"));
      currentD = addDays(currentD, 1);
    }

    const newUnavailabilities = [];
    for (const dateStr of datesToAdd) {
      const created = await base44.entities.Unavailability.create({
        worker_id: currentWorker.id,
        worker_name: currentWorker.full_name,
        date: dateStr,
        start_time: unavailabilityForm.start_time,
        end_time: unavailabilityForm.end_time,
        reason: unavailabilityForm.reason
      });
      newUnavailabilities.push(created);
    }

    // Update state with new unavailabilities
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const weekUnavailabilities = newUnavailabilities.filter(u => {
      const uDate = new Date(u.date);
      return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
    });
    setUnavailabilities([...unavailabilities, ...weekUnavailabilities]);

    // Also mark affected shifts as unavailable in selectedShifts
    if (unavailabilityForm.multiDay) {
      const newShifts = [...selectedShifts];
      for (const dateStr of datesToAdd) {
        SHIFT_BLOCKS.forEach(block => {
          const overlaps = (unavailabilityForm.start_time <= block.end && unavailabilityForm.end_time >= block.start);
          if (overlaps) {
            const existingIdx = newShifts.findIndex(s => s.date === dateStr && s.start_time === block.start && s.end_time === block.end);
            if (existingIdx >= 0) {
              newShifts[existingIdx] = { ...newShifts[existingIdx], type: "unavailable", priority: 0 };
            } else {
              newShifts.push({ date: dateStr, start_time: block.start, end_time: block.end, type: "unavailable", priority: 0 });
            }
          }
        });
      }
      setSelectedShifts(newShifts);
    }

    setShowUnavailabilityDialog(false);
    setUnavailabilityForm({
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(), "yyyy-MM-dd"),
      start_time: "09:00",
      end_time: "17:00",
      reason: "occupied",
      multiDay: false
    });
  };

  const handleDeleteUnavailability = async (id) => {
    await base44.entities.Unavailability.delete(id);
    setUnavailabilities(unavailabilities.filter(u => u.id !== id));
  };

  const generateICSFile = () => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mission Manager//Events//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;
    
    companyEvents.forEach(event => {
      const dateStr = event.date.replace(/-/g, '');
      icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${dateStr}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
END:VEVENT
`;
    });
    
    // Add yearly events assigned to current worker
    if (currentWorker) {
      yearlyEvents.filter(e => e.worker_ids?.includes(currentWorker.id)).forEach(event => {
        const startDateStr = event.start_date.replace(/-/g, '');
        const endDateStr = event.end_date.replace(/-/g, '');
        
        if (event.start_time && event.end_time) {
          const startTimeStr = event.start_time.replace(/:/g, '');
          const endTimeStr = event.end_time.replace(/:/g, '');
          icsContent += `BEGIN:VEVENT
DTSTART:${startDateStr}T${startTimeStr}00
DTEND:${endDateStr}T${endTimeStr}00
SUMMARY:${event.title || 'Event'}
DESCRIPTION:${event.worker_name || ''}
END:VEVENT
`;
        } else {
          icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${startDateStr}
DTEND;VALUE=DATE:${endDateStr}
SUMMARY:${event.title || 'Event'}
DESCRIPTION:${event.worker_name || ''}
END:VEVENT
`;
        }
      });
    }
    
    icsContent += `END:VCALENDAR`;
    
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isApproved = existingAvailability?.status === "approved";
  const isPendingChange = existingAvailability?.status === "pending_change";
  const canEdit = !isApproved || showEditMode;

  const getShiftStyle = (type) => {
    if (type === "wanted") return "bg-green-500 border-green-600 text-white";
    if (type === "available") return "bg-blue-500 border-blue-600 text-white";
    if (type === "unavailable") return "bg-red-500 border-red-600 text-white";
    return "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50";
  };

  const getShiftIcon = (type) => {
    if (type === "wanted") return <Star className="w-3 h-3" />;
    if (type === "available") return <Check className="w-3 h-3" />;
    if (type === "unavailable") return <Ban className="w-3 h-3" />;
    return null;
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth)
  });

  const getEventForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return companyEvents.find(e => e.date === dateStr);
  };

  const getYearlyEventsForDate = (date) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter(e => 
      e.worker_ids?.includes(currentWorker.id) && 
      dateStr >= e.start_date && dateStr <= e.end_date
    );
  };

  const getYearlyEventsForShift = (date, shiftStart, shiftEnd) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter(e => {
      if (e.start_date > dateStr || e.end_date < dateStr) return false;
      if (!e.worker_ids?.includes(currentWorker.id)) return false;
      if (!e.start_time || !e.end_time) return false;
      
      const eventStart = e.start_time;
      const eventEnd = e.end_time;
      
      // Check if event overlaps with shift
      return (eventStart >= shiftStart && eventStart < shiftEnd) ||
             (eventEnd > shiftStart && eventEnd <= shiftEnd) ||
             (eventStart <= shiftStart && eventEnd >= shiftEnd);
    });
  };

  const getEventBarPosition = (eventStart, eventEnd, shiftStart, shiftEnd) => {
    const timeToMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    
    const shiftStartMin = timeToMinutes(shiftStart);
    const shiftEndMin = timeToMinutes(shiftEnd);
    const eventStartMin = Math.max(timeToMinutes(eventStart), shiftStartMin);
    const eventEndMin = Math.min(timeToMinutes(eventEnd), shiftEndMin);
    
    const shiftDuration = shiftEndMin - shiftStartMin;
    const left = ((eventStartMin - shiftStartMin) / shiftDuration) * 100;
    const width = ((eventEndMin - eventStartMin) / shiftDuration) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  const getAssignmentForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return assignments.filter(a => a.date === dateStr);
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
    setShowDateDetails(true);
  };

  const wantedShifts = selectedShifts.filter(s => s.type === "wanted").sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const availableShifts = selectedShifts.filter(s => s.type === "available").sort((a, b) => (a.priority || 0) - (b.priority || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Tips Section */}
        {tipsMessage && (
          <Card className="border-none shadow-lg mb-4">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-1">נהלי הרשמה ועדכונים</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{tipsMessage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <Card className="border-none shadow-lg mb-4">
          <CardHeader className="border-b bg-white py-3 px-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Weekly Availability</CardTitle>
                  <p className="text-xs text-gray-600 mt-1">
                    {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
                    <span className="text-gray-400 ml-2">({formatHebrewDate(weekStart)})</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7), { weekStartsOn: 0 }))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7), { weekStartsOn: 0 }))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-green-100 text-green-800"><Star className="w-3 h-3 mr-1" />Wanted</Badge>
                  <Badge className="bg-blue-100 text-blue-800"><Check className="w-3 h-3 mr-1" />Available</Badge>
                  <Badge className="bg-red-100 text-red-800"><Ban className="w-3 h-3 mr-1" />Unavailable</Badge>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs text-gray-600">Desired shifts:</Label>
                  <Input 
                    type="number" 
                    className="w-16 h-7 text-xs" 
                    value={desiredShiftsCount} 
                    onChange={(e) => setDesiredShiftsCount(e.target.value)}
                    placeholder="#"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {!currentWorker ? (
          <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Worker Profile Found</h3>
              <p className="text-gray-600">Your email is not associated with a worker account.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Unavailable Times Section */}
            <Card className="border-none shadow-lg mb-4">
              <CardHeader className="border-b bg-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Non-Available Times</CardTitle>
                  <Button onClick={() => setShowUnavailabilityDialog(true)} size="sm" className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4">
                {unavailabilities.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">No unavailable times for this week</p>
                ) : (
                  <div className="space-y-2">
                    {unavailabilities.map((unavail) => (
                      <div key={unavail.id} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{format(new Date(unavail.date), "EEE, MMM d")}</p>
                          <p className="text-xs text-gray-600">{unavail.start_time} - {unavail.end_time} • {unavail.reason}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUnavailability(unavail.id)} className="text-red-600 hover:text-red-700 hover:bg-red-100 h-8 w-8">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status */}
            {existingAvailability && (
              <Card className="border-none shadow-lg mb-4">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        {existingAvailability.status === "approved" ? "Approved" : 
                         existingAvailability.status === "submitted" ? "Submitted" : 
                         existingAvailability.status === "pending_change" ? "Change Pending" : "Draft"}
                      </span>
                    </div>
                    {isApproved && !showEditMode && (
                      <Button variant="outline" size="sm" onClick={() => setShowEditMode(true)}>
                        <Pencil className="w-3 h-3 mr-1" />Edit Shifts
                      </Button>
                    )}
                    {showEditMode && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setShowEditMode(false);
                          setSelectedShifts(originalShifts);
                        }}>Cancel</Button>
                        <Button size="sm" onClick={() => setShowChangeRecap(true)} className="bg-blue-900 hover:bg-blue-800">
                          Review Changes
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shift Selection Grid */}
            <Card className="border-none shadow-lg mb-4">
              <CardHeader className="border-b bg-white py-3 px-4">
                <CardTitle className="text-base">Select Shifts (Tap to cycle: Wanted → Available → Unavailable)</CardTitle>
              </CardHeader>
              <CardContent className="py-3 px-2">
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const date = format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
                    const event = getEventForDate(addDays(weekStart, dayIndex));
                    
                    return (
                      <div key={day} className="border rounded-lg p-2">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-sm">{day}</span>
                            <span className="text-xs text-gray-500 ml-2">{format(addDays(weekStart, dayIndex), "MMM d")}</span>
                            <span className="text-xs text-gray-400 ml-1">({formatHebrewDate(addDays(weekStart, dayIndex))})</span>
                          </div>
                          {event && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              <PartyPopper className="w-3 h-3 mr-1" />{event.title}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-6 gap-1">
                          {SHIFT_BLOCKS.map((shift) => {
                            const state = getShiftState(date, shift);
                            const yearlyEvts = getYearlyEventsForShift(addDays(weekStart, dayIndex), shift.start, shift.end);
                            return (
                              <div key={shift.start} className="flex flex-col gap-0.5 relative">
                                {yearlyEvts.length > 0 && (
                                  <div className="h-3 relative mb-0.5">
                                    {yearlyEvts.map(evt => {
                                      const barPos = getEventBarPosition(evt.start_time, evt.end_time, shift.start, shift.end);
                                      return (
                                        <div 
                                          key={evt.id} 
                                          className="absolute h-2.5 bg-purple-500 rounded-sm border border-purple-600" 
                                          style={{ left: barPos.left, width: barPos.width, top: '0px' }}
                                          title={`${evt.title} (${evt.start_time}-${evt.end_time})`}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                                <button
                                  onClick={() => cycleShiftState(date, shift)}
                                  disabled={!canEdit}
                                  className={`p-1.5 rounded border-2 transition-all flex flex-col items-center justify-center ${getShiftStyle(state)} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                >
                                  {getShiftIcon(state)}
                                  <span className="text-[10px] mt-0.5">{shift.start}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!isApproved && !isPendingChange && (
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setSelectedShifts([])}>Clear</Button>
                    <Button
                      onClick={() => setShowSummary(true)}
                      disabled={selectedShifts.filter(s => s.type !== "unavailable").length === 0}
                      size="sm"
                      className="bg-blue-900 hover:bg-blue-800"
                    >
                      Review & Submit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Calendar */}
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b bg-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">My Schedule Calendar</CardTitle>
                  <div className="flex gap-1 items-center">
                    <Button variant="outline" size="sm" onClick={generateICSFile} title="Sync to phone calendar">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-2 py-1 text-sm font-medium">{format(calendarMonth, "MMM yyyy")}</span>
                    <Button variant="outline" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="font-semibold text-gray-500 py-1">{d}</div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const dayAssignments = getAssignmentForDate(day);
                    const event = getEventForDate(day);
                    const workerYearlyEvents = getYearlyEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, calendarMonth);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        className={`p-1 min-h-[50px] border rounded text-xs hover:bg-blue-50 transition-colors ${
                          isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
                        } ${isToday ? "ring-2 ring-blue-500" : ""}`}
                      >
                        <div className="font-medium">{format(day, "d")}</div>
                        {event && <div className="bg-purple-100 text-purple-700 rounded px-1 truncate mt-1">🎉</div>}
                        {workerYearlyEvents.slice(0, 1).map((e, i) => (
                          <div key={i} className="bg-green-100 text-green-700 rounded px-1 truncate mt-1" title={e.title}>{e.title}</div>
                        ))}
                        {dayAssignments.slice(0, 1).map((a, i) => (
                          <div key={i} className="bg-blue-100 text-blue-700 rounded px-1 truncate mt-1">{a.start_time.slice(0, 5)}</div>
                        ))}
                        {(dayAssignments.length + workerYearlyEvents.length) > 1 && <div className="text-gray-500">+{dayAssignments.length + workerYearlyEvents.length - 1}</div>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Dialogs */}
        <Dialog open={showUnavailabilityDialog} onOpenChange={setShowUnavailabilityDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Unavailable Time</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="multiDay" checked={unavailabilityForm.multiDay} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, multiDay: e.target.checked })} />
                <Label htmlFor="multiDay">Multiple Days</Label>
              </div>
              <div className={unavailabilityForm.multiDay ? "grid grid-cols-2 gap-4" : ""}>
                <div><Label>{unavailabilityForm.multiDay ? "Start Date" : "Date"}</Label><Input type="date" value={unavailabilityForm.start_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_date: e.target.value })} /></div>
                {unavailabilityForm.multiDay && <div><Label>End Date</Label><Input type="date" value={unavailabilityForm.end_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_date: e.target.value })} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Time</Label><Input type="time" value={unavailabilityForm.start_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={unavailabilityForm.end_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_time: e.target.value })} /></div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={unavailabilityForm.reason} onValueChange={(value) => setUnavailabilityForm({ ...unavailabilityForm, reason: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="overseas">Overseas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnavailabilityDialog(false)}>Cancel</Button>
              <Button onClick={handleAddUnavailability} className="bg-red-600 hover:bg-red-700">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTipsPopup} onOpenChange={setShowTipsPopup}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="w-5 h-5 text-blue-600" />נהלי הרשמה ועדכונים</DialogTitle></DialogHeader>
            <div className="py-4"><div className="bg-blue-50 border border-blue-200 rounded-lg p-4 whitespace-pre-wrap">{tipsMessage}</div></div>
            <DialogFooter><Button onClick={() => setShowTipsPopup(false)} className="bg-blue-900 hover:bg-blue-800">Got it</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Review & Reorder Priority</DialogTitle></DialogHeader>
            <div className="py-4">
              <Tabs defaultValue="wanted" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="wanted">Wanted ({wantedShifts.length})</TabsTrigger>
                  <TabsTrigger value="available">Available ({availableShifts.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="wanted" className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Drag to reorder wanted shifts priority</p>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "wanted")}>
                    <Droppable droppableId="wanted-shifts">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 max-h-64 overflow-y-auto">
                          {wantedShifts.map((shift, index) => (
                            <Draggable key={`${shift.date}-${shift.start_time}`} draggableId={`wanted-${shift.date}-${shift.start_time}`} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                  className={`flex items-center gap-3 p-3 rounded-lg border ${snapshot.isDragging ? 'bg-green-50 border-green-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-5 h-5 text-gray-400" />
                                  <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full font-bold text-sm">{index + 1}</div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{format(new Date(shift.date), "EEE, MMM d")}</p>
                                    <p className="text-sm text-gray-600">{shift.start_time} - {shift.end_time}</p>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </TabsContent>
                <TabsContent value="available" className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Drag to reorder available shifts priority</p>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "available")}>
                    <Droppable droppableId="available-shifts">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 max-h-64 overflow-y-auto">
                          {availableShifts.map((shift, index) => (
                            <Draggable key={`${shift.date}-${shift.start_time}`} draggableId={`available-${shift.date}-${shift.start_time}`} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                  className={`flex items-center gap-3 p-3 rounded-lg border ${snapshot.isDragging ? 'bg-blue-50 border-blue-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-5 h-5 text-gray-400" />
                                  <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full font-bold text-sm">{index + 1}</div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{format(new Date(shift.date), "EEE, MMM d")}</p>
                                    <p className="text-sm text-gray-600">{shift.start_time} - {shift.end_time}</p>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSummary(false)}><X className="w-4 h-4 mr-2" />Back</Button>
              <Button onClick={handleSubmit} className="bg-blue-900 hover:bg-blue-800"><Check className="w-4 h-4 mr-2" />Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showChangeRecap} onOpenChange={setShowChangeRecap}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Change Request Summary</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {(() => {
                const { added, removed } = getChanges();
                return (
                  <>
                    {added.length > 0 && (
                      <div>
                        <p className="font-semibold text-green-700 mb-2">Added:</p>
                        {added.map((s, i) => (
                          <div key={i} className="p-2 bg-green-50 rounded mb-1 text-sm">
                            {format(new Date(s.date), "EEE, MMM d")} {s.start_time}-{s.end_time} ({s.type})
                          </div>
                        ))}
                      </div>
                    )}
                    {removed.length > 0 && (
                      <div>
                        <p className="font-semibold text-red-700 mb-2">Removed:</p>
                        {removed.map((s, i) => (
                          <div key={i} className="p-2 bg-red-50 rounded mb-1 text-sm">
                            {format(new Date(s.date), "EEE, MMM d")} {s.start_time}-{s.end_time} ({s.type})
                          </div>
                        ))}
                      </div>
                    )}
                    {added.length === 0 && removed.length === 0 && (
                      <p className="text-gray-500">No changes detected</p>
                    )}
                  </>
                );
              })()}
              <div>
                <Label>Note to Admin (optional)</Label>
                <Textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Explain the reason for changes..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangeRecap(false)}>Cancel</Button>
              <Button onClick={handleSubmitChangeRequest} className="bg-blue-900 hover:bg-blue-800">Submit Change Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDateDetails} onOpenChange={setShowDateDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}</DialogTitle>
            </DialogHeader>
            {selectedDate && (
              <div className="space-y-4 py-4">
                {getEventForDate(selectedDate) && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="font-semibold text-purple-800 flex items-center gap-2">
                      <PartyPopper className="w-4 h-4" />{getEventForDate(selectedDate).title}
                    </p>
                    {getEventForDate(selectedDate).description && (
                      <p className="text-sm text-gray-600 mt-1">{getEventForDate(selectedDate).description}</p>
                    )}
                  </div>
                )}
                {getYearlyEventsForDate(selectedDate).length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">Your Yearly Events:</p>
                    {getYearlyEventsForDate(selectedDate).map((e, i) => (
                      <div key={i} className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                        <p className="font-medium text-green-800">{e.title}</p>
                        <p className="text-sm text-gray-600">{e.start_time} - {e.end_time}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <p className="font-semibold mb-2">Your Shifts:</p>
                  {getAssignmentForDate(selectedDate).length === 0 ? (
                    <p className="text-sm text-gray-500">No shifts scheduled</p>
                  ) : (
                    getAssignmentForDate(selectedDate).map((a, i) => (
                      <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                        <p className="font-medium">{a.food_cart_name}</p>
                        <p className="text-sm text-gray-600">{a.start_time} - {a.end_time} ({a.hours}h)</p>
                        {a.menu && <p className="text-sm text-amber-700">Menu: {a.menu}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDateDetails(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
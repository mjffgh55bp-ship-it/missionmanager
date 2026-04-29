import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Check, X, AlertCircle, Info, GripVertical, Plus, XCircle, Star, Ban, ChevronLeft, ChevronRight, PartyPopper, Pencil, Download, Lock } from "lucide-react";
import { format, startOfWeek, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { formatHebrewDate } from "../components/utils/HebrewDate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const formatDateHebrew = (date, formatType = "short") => {
  const d = new Date(date);
  const dayName = HEBREW_DAYS[d.getDay()];
  const dayNameShort = HEBREW_DAYS_SHORT[d.getDay()];
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  if (formatType === "short") {
    return `${dayNameShort}, ${day} ${monthName}`;
  } else if (formatType === "long") {
    return `${dayName}, ${day} ${monthName}, ${year}`;
  } else if (formatType === "monthYear") {
    return `${monthName} ${year}`;
  }
  return `${day} ${monthName}`;
};

const SHIFT_BLOCKS = [
{ start: "06:00", end: "10:00" },
{ start: "10:00", end: "14:00" },
{ start: "14:00", end: "18:00" },
{ start: "18:00", end: "22:00" },
{ start: "22:00", end: "02:00" },
{ start: "02:00", end: "06:00" }];


const DAYS_OF_WEEK = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

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
  const [openRegistrations, setOpenRegistrations] = useState([]);
  const [extraTaskStates, setExtraTaskStates] = useState({});
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [editingTips, setEditingTips] = useState(false);
  const [tipsEditValue, setTipsEditValue] = useState("");
  const [showTipsAsPopup, setShowTipsAsPopup] = useState(false);

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const loadData = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);

    const weekStartStr2 = format(startOfWeek(weekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

    // Single batch for all initial data
    const [workersData, eventsData, openRegSettings, userRolesSettings, settings, weekTipsSettings, yearlyEventsData] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.CompanyEvent.list("-date"),
      base44.entities.AppSettings.filter({ setting_key: "open_registrations" }),
      base44.entities.AppSettings.filter({ setting_key: "user_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "availability_tips" }),
      base44.entities.AppSettings.filter({ setting_key: `availability_tips_${weekStartStr2}` }),
      base44.entities.YearlyEvent.list()
    ]);

    setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
    setCompanyEvents(eventsData);
    setYearlyEvents(yearlyEventsData);

    if (openRegSettings.length > 0) {
      setOpenRegistrations(JSON.parse(openRegSettings[0].setting_value) || []);
    }

    const worker = workersData.find((w) => w.email === user.email);
    setCurrentWorker(worker);

    // Check if manager
    if (userRolesSettings.length > 0) {
      const rolesData = JSON.parse(userRolesSettings[0].setting_value);
      const role = rolesData[user.email];
      setIsManager(user.role === 'admin' || role === 'manager');
    } else {
      setIsManager(user.role === 'admin');
    }

    // Load week-specific tips, fallback to global
    const activeWeekTips = weekTipsSettings.length > 0 ? weekTipsSettings[0] : null;
    const activeGlobalTips = settings.length > 0 ? settings[0] : null;
    const tipsSource = activeWeekTips || activeGlobalTips;
    if (tipsSource) {
      const tipsData = JSON.parse(tipsSource.setting_value);
      setTipsMessage(tipsData.message || "");
      setTipsEditValue(tipsData.message || "");
      setShowTipsAsPopup(tipsData.showAsPopup || false);
      if (tipsData.message && tipsData.message.trim() && tipsData.showAsPopup) {
        const acknowledgedSettings = await base44.entities.AppSettings.filter({ 
          setting_key: `tips_acknowledged_${user.email}` 
        });
        const acknowledgedVersion = acknowledgedSettings.length > 0 
          ? acknowledgedSettings[0].setting_value 
          : null;
        if (acknowledgedVersion !== tipsData.message) {
          setShowTipsPopup(true);
        }
      }
    } else {
      setTipsMessage("");
      setTipsEditValue("");
    }

    if (worker) {
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      // Single batch for all worker-specific data
      const [availabilities, unavailabilitiesData, templatesData, assignmentsData, templateRowsData] = await Promise.all([
        base44.entities.Availability.filter({ worker_id: worker.id, week_start_date: weekStartStr }),
        base44.entities.Unavailability.filter({ worker_id: worker.id }),
        base44.entities.Template.filter({ active: true }),
        base44.entities.Assignment.list("-date", 500),
        base44.entities.TemplateRow.list("-date", 500)
      ]);

      if (availabilities.length > 0) {
        setExistingAvailability(availabilities[0]);
        const shifts = availabilities[0].shifts || [];
        setSelectedShifts(shifts);
        setOriginalShifts(JSON.parse(JSON.stringify(shifts)));
        setExtraTaskStates(availabilities[0].extra_tasks || {});
      } else {
        setExistingAvailability(null);
        setSelectedShifts([]);
        setOriginalShifts([]);
      }

      const weekUnavailabilities = unavailabilitiesData.filter((u) => {
        const uDate = new Date(u.date);
        return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
      });
      setUnavailabilities(weekUnavailabilities);

      const workerAssignments = assignmentsData.filter((a) =>
        a.chef_id === worker.id ||
        a.sous_chef_id === worker.id ||
        a.additional_chef_id === worker.id
      );
      setAssignments(workerAssignments);
      setTemplateRows(templateRowsData);
      setAllTemplates(templatesData);
    }
  };

  const getShiftState = (date, shiftBlock) => {
    const shift = selectedShifts.find(
      (s) => s.date === date && s.start_time === shiftBlock.start && s.end_time === shiftBlock.end
    );
    return shift?.type || null;
  };

  const cycleShiftState = (date, shiftBlock) => {
    if (existingAvailability?.status === "approved" && !showEditMode) return;
    if (currentWorker?.availability_locked) return;

    const currentState = getShiftState(date, shiftBlock);

    let newShifts = selectedShifts.filter(
      (s) => !(s.date === date && s.start_time === shiftBlock.start && s.end_time === shiftBlock.end)
    );

    if (currentState === null) {
      const wantedCount = newShifts.filter((s) => s.type === "wanted").length;
      newShifts.push({
        date,
        start_time: shiftBlock.start,
        end_time: shiftBlock.end,
        type: "wanted",
        priority: wantedCount + 1
      });
    } else if (currentState === "wanted") {
      const availableCount = newShifts.filter((s) => s.type === "available").length;
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

  const cycleExtraTask = (taskName) => {
    if (existingAvailability?.status === "approved" && !showEditMode) return;
    if (currentWorker?.availability_locked) return;
    const current = extraTaskStates[taskName] || null;
    let next;
    if (current === null || current === undefined) next = "wanted";else
    if (current === "wanted") next = "available";else
    if (current === "available") next = "unavailable";else
    next = null;
    const updated = { ...extraTaskStates };
    if (next === null) delete updated[taskName];else
    updated[taskName] = next;
    setExtraTaskStates(updated);
  };

  const handleDragEnd = (result, listType) => {
    if (!result.destination) return;

    const items = Array.from(selectedShifts.filter((s) => s.type === listType));
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      priority: index + 1
    }));

    const otherShifts = selectedShifts.filter((s) => s.type !== listType);
    setSelectedShifts([...otherShifts, ...updatedItems]);
  };

  const handleSubmit = async () => {
    if (!currentWorker) return;

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const availabilityData = {
      worker_id: currentWorker.id,
      worker_name: currentWorker.nickname,
      week_start_date: weekStartStr,
      shifts: selectedShifts,
      extra_tasks: extraTaskStates,
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
    const added = selectedShifts.filter((s) =>
    !originalShifts.find((o) =>
    o.date === s.date && o.start_time === s.start_time && o.end_time === s.end_time && o.type === s.type
    )
    );
    const removed = originalShifts.filter((o) =>
    !selectedShifts.find((s) =>
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
        worker_name: currentWorker.nickname,
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
    const weekUnavailabilities = newUnavailabilities.filter((u) => {
      const uDate = new Date(u.date);
      return uDate >= new Date(weekStartStr) && uDate <= new Date(weekEndStr);
    });
    setUnavailabilities([...unavailabilities, ...weekUnavailabilities]);

    // Also mark affected shifts as unavailable in selectedShifts
    if (unavailabilityForm.multiDay) {
      const newShifts = [...selectedShifts];
      for (const dateStr of datesToAdd) {
        SHIFT_BLOCKS.forEach((block) => {
          const overlaps = unavailabilityForm.start_time <= block.end && unavailabilityForm.end_time >= block.start;
          if (overlaps) {
            const existingIdx = newShifts.findIndex((s) => s.date === dateStr && s.start_time === block.start && s.end_time === block.end);
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
    setUnavailabilities(unavailabilities.filter((u) => u.id !== id));
  };

  const generateICSFile = () => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mission Manager//Events//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    companyEvents.forEach((event) => {
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
      yearlyEvents.filter((e) => e.worker_ids?.includes(currentWorker.id)).forEach((event) => {
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

      // Add assigned shifts from assignments and template rows
      [...assignments, ...templateRows.filter((row) => {
        if (!row.values) return false;
        return Object.values(row.values).some((val) => val === currentWorker.id);
      })].forEach((shift) => {
        const dateStr = shift.date.replace(/-/g, '');
        let startTime, endTime, briefingTime, title;

        if (shift.isTemplateShift || shift.template_id) {
          // Template shift
          startTime = shift.values?.["התחלה"] || shift.values?.["שעת התחלה"];
          endTime = shift.values?.["סיום"] || shift.values?.["שעת סיום"];
          briefingTime = shift.values?.["תדריך"];
          const template = allTemplates.find((t) => t.id === shift.template_id);
          title = template?.name || shift.template_name || 'משמרת';
        } else {
          // Regular assignment
          startTime = shift.start_time;
          endTime = shift.end_time;
          title = shift.food_cart_name;
        }

        if (!startTime || !endTime) return;

        // Use briefing time if available, otherwise use shift start time
        const eventStartTime = briefingTime || startTime;
        const startTimeStr = eventStartTime.replace(/:/g, '');
        const endTimeStr = endTime.replace(/:/g, '');

        icsContent += `BEGIN:VEVENT
DTSTART:${dateStr}T${startTimeStr}00
DTEND:${dateStr}T${endTimeStr}00
SUMMARY:${title}
DESCRIPTION:${briefingTime ? `תדריך: ${briefingTime}\\nמשמרת: ${startTime} - ${endTime}` : `משמרת: ${startTime} - ${endTime}`}
END:VEVENT
`;
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
    if (type === "available") return "bg-cyan-500 border-cyan-600 text-white";
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
    return companyEvents.find((e) => e.date === dateStr);
  };

  const getYearlyEventsForDate = (date) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter((e) =>
    e.worker_ids?.includes(currentWorker.id) &&
    dateStr >= e.start_date && dateStr <= e.end_date
    );
  };

  const getYearlyEventsForShift = (date, shiftStart, shiftEnd) => {
    if (!currentWorker) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return yearlyEvents.filter((e) => {
      if (e.start_date > dateStr || e.end_date < dateStr) return false;
      if (!e.worker_ids?.includes(currentWorker.id)) return false;
      if (!e.start_time || !e.end_time) return false;

      const eventStart = e.start_time;
      const eventEnd = e.end_time;

      // Check if event overlaps with shift
      return eventStart >= shiftStart && eventStart < shiftEnd ||
      eventEnd > shiftStart && eventEnd <= shiftEnd ||
      eventStart <= shiftStart && eventEnd >= shiftEnd;
    });
  };

  // Convert time to minutes offset from 06:00 (handles midnight crossing)
  const timeToMinsFrom6 = (time) => {
    const [h, m] = time.split(':').map(Number);
    let mins = h * 60 + m;
    if (mins < 360) mins += 1440; // 00:00-05:59 → next day
    return mins - 360;
  };

  const getEventBarPositionFull = (eventStart, eventEnd) => {
    const totalMins = 1440;
    const startMins = Math.max(timeToMinsFrom6(eventStart), 0);
    const endMins = Math.min(timeToMinsFrom6(eventEnd), totalMins);
    if (endMins <= startMins) return null;
    return {
      right: `${startMins / totalMins * 100}%`,
      width: `${(endMins - startMins) / totalMins * 100}%`
    };
  };

  const getAssignmentForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const regularAssignments = assignments.filter((a) => a.date === dateStr);

    // Get template shifts for this worker on this date
    if (!currentWorker) return regularAssignments;

    const templateShifts = templateRows.filter((row) => {
      if (row.date !== dateStr || !row.values) return false;

      // Check if worker is assigned in this row
      const isAssigned = Object.values(row.values).some((val) => val === currentWorker.id);
      if (!isAssigned) return false;

      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];
      return startTime && endTime;
    }).map((row) => {
      const template = allTemplates.find((t) => t.id === row.template_id);
      const briefingTime = row.values?.["תדריך"];
      return {
        id: `template_${row.id}`,
        date: row.date,
        start_time: row.values?.["התחלה"] || row.values?.["שעת התחלה"],
        end_time: row.values?.["סיום"] || row.values?.["שעת סיום"],
        briefing_time: briefingTime,
        food_cart_name: template?.name || row.template_name || 'משמרת',
        hours: null,
        isTemplateShift: true
      };
    });

    return [...regularAssignments, ...templateShifts];
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
    setShowDateDetails(true);
  };

  const wantedShifts = selectedShifts.filter((s) => s.type === "wanted").sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const availableShifts = selectedShifts.filter((s) => s.type === "available").sort((a, b) => (a.priority || 0) - (b.priority || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Tips Section */}
        {(tipsMessage || isManager) &&
        <Card className="border-none shadow-lg mb-4">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-900">נהלי הרשמה ועדכונים</p>
                    {isManager && !editingTips && (
                      <Button size="sm" variant="outline" onClick={() => { setTipsEditValue(tipsMessage); setEditingTips(true); }} dir="rtl">
                        <Pencil className="w-3 h-3 mr-1" />ערוך
                      </Button>
                    )}
                  </div>
                  {editingTips ? (
                    <div className="space-y-2">
                      <Textarea
                        value={tipsEditValue}
                        onChange={e => setTipsEditValue(e.target.value)}
                        rows={6}
                        dir="rtl"
                        className="text-sm"
                        placeholder="הכנס הודעה לעובדים..."
                      />
                      <div className="flex items-center gap-2 justify-end" dir="rtl">
                        <Label className="text-xs text-gray-600">הצג כפופ-אפ שדורש אישור</Label>
                        <Switch checked={showTipsAsPopup} onCheckedChange={setShowTipsAsPopup} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditingTips(false)} dir="rtl">ביטול</Button>
                        <Button size="sm" className="bg-blue-900 hover:bg-blue-800" dir="rtl" onClick={async () => {
                          const weekStartStr3 = format(startOfWeek(weekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");
                          const key = `availability_tips_${weekStartStr3}`;
                          const existing = await base44.entities.AppSettings.filter({ setting_key: key });
                          const data = { setting_key: key, setting_value: JSON.stringify({ message: tipsEditValue, showAsPopup: showTipsAsPopup }) };
                          if (existing.length > 0) await base44.entities.AppSettings.update(existing[0].id, data);
                          else await base44.entities.AppSettings.create(data);
                          setTipsMessage(tipsEditValue);
                          setEditingTips(false);
                        }}>שמור</Button>
                      </div>
                    </div>
                  ) : tipsMessage ? (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{tipsMessage}</p>
                  ) : (
                    <p className="text-sm text-gray-400" dir="rtl">לא הוגדרה הודעה לשבוע זה</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {/* Header */}
        <Card className="border-none shadow-lg mb-4">
          <CardHeader className="border-b bg-white py-3 px-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl" dir="rtl">זמינות שבועית</CardTitle>
                  <p className="text-xs text-gray-600 mt-1" dir="rtl">
                    {formatDateHebrew(weekStart)} - {formatDateHebrew(addDays(weekStart, 6))}
                    <span className="text-gray-400 ml-2">({formatHebrewDate(weekStart)})</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7), { weekStartsOn: 0 }))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7), { weekStartsOn: 0 }))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-green-100 text-green-800" dir="rtl"><Star className="w-3 h-3 mr-1" />רצוי</Badge>
                  <Badge className="bg-cyan-100 text-cyan-800" dir="rtl"><Check className="w-3 h-3 mr-1" />זמין</Badge>
                  <Badge className="bg-red-100 text-red-800" dir="rtl"><Ban className="w-3 h-3 mr-1" />לא זמין</Badge>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs text-gray-600" dir="rtl">משמרות רצויות:</Label>
                  <Input
                    type="number"
                    className="w-16 h-7 text-xs"
                    value={desiredShiftsCount}
                    onChange={(e) => setDesiredShiftsCount(e.target.value)}
                    placeholder="#" />

                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {!currentWorker ?
        <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2" dir="rtl">לא נמצא פרופיל עובד</h3>
              <p className="text-gray-600" dir="rtl">האימייל שלך לא משויך לחשבון עובד.</p>
            </CardContent>
          </Card> :

        <>
            {/* Unavailable Times Section */}
            <Card className="border-none shadow-lg mb-4">
              <CardHeader className="border-b bg-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base" dir="rtl">אילוצים</CardTitle>
                  <Button onClick={() => setShowUnavailabilityDialog(true)} size="sm" className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4">
                {unavailabilities.length === 0 ?
              <p className="text-xs text-gray-500 text-center py-2" dir="rtl">אין אילוצים השבוע</p> :

              <div className="space-y-2">
                    {unavailabilities.map((unavail) =>
                <div key={unavail.id} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900" dir="rtl">{formatDateHebrew(unavail.date, "short")}</p>
                          <p className="text-xs text-gray-600" dir="rtl">{unavail.start_time} - {unavail.end_time} • {unavail.reason === 'overseas' ? 'בחו"ל' : 'תפוס'}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUnavailability(unavail.id)} className="text-red-600 hover:text-red-700 hover:bg-red-100 h-8 w-8">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                )}
                  </div>
              }
              </CardContent>
            </Card>

            {/* Status */}
            {existingAvailability &&
          <Card className="border-none shadow-lg mb-4">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        {existingAvailability.status === "approved" ? "אושר" :
                    existingAvailability.status === "submitted" ? "נשלח" :
                    existingAvailability.status === "pending_change" ? "ממתין לשינוי" : "טיוטה"}
                      </span>
                    </div>
                    {isApproved && !showEditMode &&
                <Button variant="outline" size="sm" onClick={() => setShowEditMode(true)}>
                        <Pencil className="w-3 h-3 mr-1" />ערוך משמרות
                      </Button>
                }
                    {showEditMode &&
                <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                    setShowEditMode(false);
                    setSelectedShifts(originalShifts);
                  }} dir="rtl">ביטול</Button>
                        <Button size="sm" onClick={() => setShowChangeRecap(true)} className="bg-blue-900 hover:bg-blue-800">
                          סקור שינויים
                        </Button>
                      </div>
                }
                  </div>
                </CardContent>
              </Card>
          }

            {/* Extra Tasks Section */}
            {openRegistrations.filter((reg) => {
            const regShifts = reg?.shifts || [];
            if (regShifts.length === 0) return false;
            if (!reg?.date) return true;
            const weekStartStr = format(weekStart, "yyyy-MM-dd");
            const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
            return reg.date >= weekStartStr && reg.date <= weekEndStr;
          }).length > 0 &&
          <Card className="border-none shadow-lg mb-4">
                <CardHeader className="border-b bg-white py-3 px-4">
                  <CardTitle className="text-base" dir="rtl">משימות נוספות</CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-gray-500 mb-3" dir="rtl">לחיצה בודדת - רצוי, לחיצה כפולה - זמין, שלוש לחיצות - לא זמין</p>
                  <div className="space-y-3">
                    {openRegistrations.filter((reg) => {
                  const regShifts = reg?.shifts || [];
                  if (regShifts.length === 0) return false;
                  if (!reg?.date) return true;
                  const weekStartStr = format(weekStart, "yyyy-MM-dd");
                  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
                  return reg.date >= weekStartStr && reg.date <= weekEndStr;
                }).map((reg) => {
                  const regKey = reg?.key || reg;
                  const regName = reg?.name || reg;
                  const regDate = reg?.date || null;
                  const regShifts = reg?.shifts || [];

                  // Helper: parse "+N HH:MM" or "HH:MM"
                  const parseTime = (t) => {
                    if (!t) return { days: 0, time: t };
                    const m = t.match(/^(\+(\d+))\s+(\d{2}:\d{2})$/);
                    if (m) return { days: parseInt(m[2]), time: m[3] };
                    return { days: 0, time: t };
                  };

                  return (
                    <div key={regKey} className="border rounded-lg p-3" dir="rtl">
                          <div className="font-semibold text-sm mb-2">{regName}
                            {regDate && <span className="text-xs text-gray-400 font-normal mr-2">{regDate}</span>}
                          </div>
                          {regShifts.length > 0 ?
                      <div className="flex flex-wrap gap-2">
                              {regShifts.map((shift, si) => {
                          const taskKey = `${regKey}__${si}`;
                          const state = extraTaskStates[taskKey] || null;
                          const stateStyle = state === "wanted" ? "bg-green-500 border-green-600 text-white" :
                          state === "available" ? "bg-cyan-500 border-cyan-600 text-white" :
                          state === "unavailable" ? "bg-red-500 border-red-600 text-white" :
                          "bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                          const stateIcon = state === "wanted" ? <Star className="w-3 h-3" /> :
                          state === "available" ? <Check className="w-3 h-3" /> :
                          state === "unavailable" ? <Ban className="w-3 h-3" /> :
                          null;

                          const endParsed = parseTime(shift.end_time);
                          // Multi-day only if end crosses the 06:00 boundary of the next day
                          const isMultiDay = endParsed.days > 0 && endParsed.time >= "06:00";
                          const disabled = !canEdit || currentWorker?.availability_locked;

                          if (isMultiDay) {
                            // Show two connected buttons sharing the same key, split at 06:00
                            return (
                              <div key={si} className="flex items-stretch">
                                      {/* Day 1 part: start → 06:00 */}
                                      <button
                                  onClick={() => cycleExtraTask(taskKey)}
                                  disabled={disabled}
                                  className={`flex flex-col items-start px-2 py-1.5 rounded-r-lg border-2 border-l-0 text-xs font-medium transition-all ${stateStyle} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>

                                        <div className="flex items-center gap-1">
                                          {stateIcon}
                                          <span>{shift.start_time} - 06:00</span>
                                        </div>
                                        <div className="text-[9px] opacity-70 mt-0.5">יום א׳</div>
                                      </button>
                                      {/* Day 2 part: 06:00 → actual end */}
                                      <button
                                  onClick={() => cycleExtraTask(taskKey)}
                                  disabled={disabled}
                                  className={`flex flex-col items-start px-2 py-1.5 rounded-l-lg border-2 border-dashed text-xs font-medium transition-all relative ${stateStyle} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                        <span className="absolute top-0.5 left-0.5 text-[9px] font-bold bg-orange-300 text-orange-900 rounded px-0.5">+1</span>
                                        <div className="flex items-center gap-1">
                                          {stateIcon}
                                          <span>06:00 - {endParsed.time}</span>
                                        </div>
                                        <div className="text-[9px] opacity-70 mt-0.5">יום ב׳</div>
                                      </button>
                                    </div>);

                          }

                          return (
                            <button
                              key={si}
                              onClick={() => cycleExtraTask(taskKey)}
                              disabled={disabled}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${stateStyle} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>

                                    {stateIcon}
                                    <span>{shift.start_time} - {shift.end_time}</span>
                                  </button>);

                        })}
                            </div> :

                      (() => {
                        const taskKey = regKey;
                        const state = extraTaskStates[taskKey] || null;
                        const stateStyle = state === "wanted" ? "bg-green-500 border-green-600 text-white" :
                        state === "available" ? "bg-cyan-500 border-cyan-600 text-white" :
                        state === "unavailable" ? "bg-red-500 border-red-600 text-white" :
                        "bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                        const stateIcon = state === "wanted" ? <Star className="w-3 h-3 ml-1" /> :
                        state === "available" ? <Check className="w-3 h-3 ml-1" /> :
                        state === "unavailable" ? <Ban className="w-3 h-3 ml-1" /> :
                        null;
                        const stateLabel = state === "wanted" ? "רצוי" : state === "available" ? "זמין" : state === "unavailable" ? "לא זמין" : "לחץ לסימון";
                        return (
                          <button
                            onClick={() => cycleExtraTask(taskKey)}
                            disabled={!canEdit || currentWorker?.availability_locked}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${stateStyle} ${!canEdit || currentWorker?.availability_locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>

                                  {stateIcon}
                                  <span>{stateLabel}</span>
                                </button>);

                      })()
                      }
                        </div>);

                })}
                  </div>
                </CardContent>
              </Card>
          }

            {/* Shift Selection Grid */}
            <Card className="border-none shadow-lg mb-4">
              <CardHeader className="border-b bg-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base" dir="rtl">בחר משמרות (לחץ כדי להחליף: רצוי → זמין → לא זמין)</CardTitle>
                  {currentWorker?.availability_locked &&
                <Badge className="bg-red-100 text-red-800" dir="rtl">
                      <Lock className="w-3 h-3 mr-1" />
                      זמינות נעולה
                    </Badge>
                }
                </div>
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
                            <span className="font-semibold text-sm" dir="rtl">{day}</span>
                            <span className="text-xs text-gray-500 ml-2" dir="rtl">{formatDateHebrew(addDays(weekStart, dayIndex))}</span>
                            <span className="text-xs text-gray-400 ml-1">({formatHebrewDate(addDays(weekStart, dayIndex))})</span>
                          </div>
                          {event &&
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                              <PartyPopper className="w-3 h-3 mr-1" />{event.title}
                            </Badge>
                        }
                        </div>
                        {(() => {
                        const dayYearlyEvts = yearlyEvents.filter((e) =>
                        e.worker_ids?.includes(currentWorker?.id) &&
                        e.start_date <= date && e.end_date >= date &&
                        e.start_time && e.end_time
                        );
                        return dayYearlyEvts.length > 0 ?
                        <div className="relative h-4 mb-1">
                                {dayYearlyEvts.map((evt) => {
                            const pos = getEventBarPositionFull(evt.start_time, evt.end_time);
                            if (!pos) return null;
                            return (
                              <div
                                key={evt.id} className="bg-green-300 text-[8px] px-1 rounded absolute h-3.5 flex items-center overflow-hidden whitespace-nowrap"

                                style={{ right: pos.right, width: pos.width }}
                                title={`${evt.title} (${evt.start_time}-${evt.end_time})`}>

                                      {evt.title}
                                    </div>);

                          })}
                              </div> :
                        null;
                      })()}
                        <div className="grid grid-cols-6 gap-1">
                          {SHIFT_BLOCKS.map((shift) => {
                          const state = getShiftState(date, shift);
                          return (
                            <button
                              key={shift.start}
                              onClick={() => cycleShiftState(date, shift)}
                              disabled={!canEdit || currentWorker?.availability_locked}
                              className={`p-1.5 rounded border-2 transition-all flex flex-col items-center justify-center ${getShiftStyle(state)} ${!canEdit || currentWorker?.availability_locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>

                                {getShiftIcon(state)}
                                <span className="text-[10px] mt-0.5">{shift.start}</span>
                              </button>);

                        })}
                        </div>
                      </div>);

                })}
                </div>

                {!isApproved && !isPendingChange &&
              <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setSelectedShifts([])} disabled={currentWorker?.availability_locked} dir="rtl">נקה</Button>
                    <Button
                  onClick={() => setShowSummary(true)}
                  disabled={selectedShifts.filter((s) => s.type !== "unavailable").length === 0 || currentWorker?.availability_locked}
                  size="sm"
                  className="bg-blue-900 hover:bg-blue-800">

                      סקור ושלח
                    </Button>
                  </div>
              }
              </CardContent>
            </Card>

            {/* Summary Calendar */}
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b bg-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base" dir="rtl">לוח</CardTitle>
                  <div className="flex gap-1 items-center">
                    <Button variant="outline" size="sm" onClick={generateICSFile} title="סנכרן ללוח השנה בטלפון">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <span className="px-2 py-1 text-sm font-medium" dir="rtl">{formatDateHebrew(calendarMonth, "monthYear")}</span>
                    <Button variant="outline" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d, i) =>
                <div key={i} className="font-semibold text-gray-500 py-1">{d}</div>
                )}
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
                      isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"} ${
                      isToday ? "ring-2 ring-blue-500" : ""}`}>

                        <div className="font-medium">{format(day, "d")}</div>
                        {event && <div className="bg-purple-100 text-purple-700 rounded px-1 truncate mt-1">🎉</div>}
                        {workerYearlyEvents.slice(0, 1).map((e, i) =>
                      <div key={i} className="bg-green-100 text-green-700 rounded px-1 truncate mt-1" title={e.title}>{e.title}</div>
                      )}
                        {dayAssignments.slice(0, 1).map((a, i) => {
                        const displayTime = a.briefing_time || a.start_time;
                        return (
                          <div key={i} className="bg-blue-100 text-blue-700 rounded px-1 truncate mt-1" title={a.briefing_time ? `תדריך: ${a.briefing_time}` : ''}>
                            {displayTime.slice(0, 5)}
                          </div>);

                      })}
                        {dayAssignments.length + workerYearlyEvents.length > 1 && <div className="text-gray-500">+{dayAssignments.length + workerYearlyEvents.length - 1}</div>}
                      </button>);

                })}
                </div>
              </CardContent>
            </Card>
          </>
        }

        {/* Dialogs */}
        <Dialog open={showUnavailabilityDialog} onOpenChange={setShowUnavailabilityDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-right" dir="rtl">הוסף אילוץ</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2" dir="rtl">
                <Label htmlFor="multiDay">מספר ימים</Label>
                <input type="checkbox" id="multiDay" checked={unavailabilityForm.multiDay} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, multiDay: e.target.checked })} />
              </div>
              <div className={unavailabilityForm.multiDay ? "grid grid-cols-2 gap-2" : ""}>
                <div><Label className="text-center block mb-2" dir="rtl">{unavailabilityForm.multiDay ? "תאריך התחלה" : "תאריך"}</Label><Input type="date" value={unavailabilityForm.start_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_date: e.target.value })} /></div>
                {unavailabilityForm.multiDay && <div><Label className="text-center block mb-2" dir="rtl">תאריך סיום</Label><Input type="date" value={unavailabilityForm.end_date} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_date: e.target.value })} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-2" dir="rtl">
                <div><Label className="text-center block mb-2">שעת התחלה</Label><Input type="time" value={unavailabilityForm.start_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, start_time: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-center block mb-2">שעת סיום</Label><Input type="time" value={unavailabilityForm.end_time} onChange={(e) => setUnavailabilityForm({ ...unavailabilityForm, end_time: e.target.value })} className="text-sm" /></div>
              </div>
              <div>
                <Label className="text-center block mb-2" dir="rtl">סיבה</Label>
                <Select value={unavailabilityForm.reason} onValueChange={(value) => setUnavailabilityForm({ ...unavailabilityForm, reason: value })}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="occupied">תפוס</SelectItem>
                    <SelectItem value="overseas">בחו"ל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnavailabilityDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleAddUnavailability} className="bg-red-600 hover:bg-red-700" dir="rtl">הוסף</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTipsPopup} onOpenChange={setShowTipsPopup}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="w-5 h-5 text-blue-600" />נהלי הרשמה ועדכונים</DialogTitle></DialogHeader>
            <div className="py-4"><div className="bg-blue-50 border border-blue-200 rounded-lg p-4 whitespace-pre-wrap">{tipsMessage}</div></div>
            <DialogFooter><Button onClick={async () => {
              // Save acknowledgment to database per user
              const acknowledgedSettings = await base44.entities.AppSettings.filter({ 
                setting_key: `tips_acknowledged_${currentUser.email}` 
              });
              
              if (acknowledgedSettings.length > 0) {
                await base44.entities.AppSettings.update(acknowledgedSettings[0].id, {
                  setting_value: tipsMessage
                });
              } else {
                await base44.entities.AppSettings.create({
                  setting_key: `tips_acknowledged_${currentUser.email}`,
                  setting_value: tipsMessage
                });
              }
              
              setShowTipsPopup(false);
            }} className="bg-blue-900 hover:bg-blue-800" dir="rtl">הבנתי</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-sm" dir="rtl">סקור וסדר מחדש עדיפות</DialogTitle></DialogHeader>
            <div className="py-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Wanted Shifts */}
                <div className="border rounded p-2">
                  <div className="mb-2">
                    <h3 className="font-semibold text-green-700 text-xs mb-0.5" dir="rtl">רצוי ({wantedShifts.length})</h3>
                    <p className="text-[10px] text-gray-600" dir="rtl">גרור לשינוי</p>
                  </div>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "wanted")}>
                    <Droppable droppableId="wanted-shifts">
                      {(provided) =>
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-64 overflow-y-auto">
                          {wantedShifts.map((shift, index) =>
                        <Draggable key={`${shift.date}-${shift.start_time}`} draggableId={`wanted-${shift.date}-${shift.start_time}`} index={index}>
                              {(provided, snapshot) =>
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          className={`flex items-center gap-1 p-1.5 rounded border ${snapshot.isDragging ? 'bg-green-50 border-green-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                  <div className="flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded-full font-bold text-[10px]">{index + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-[11px] truncate" dir="rtl">{formatDateHebrew(shift.date, "short")}</p>
                                    <p className="text-[9px] text-gray-600">{shift.start_time}-{shift.end_time}</p>
                                  </div>
                                </div>
                          }
                            </Draggable>
                        )}
                          {provided.placeholder}
                        </div>
                      }
                    </Droppable>
                  </DragDropContext>
                </div>

                {/* Available Shifts */}
                <div className="border rounded p-2">
                  <div className="mb-2">
                    <h3 className="font-semibold text-blue-700 text-xs mb-0.5" dir="rtl">זמין ({availableShifts.length})</h3>
                    <p className="text-[10px] text-gray-600" dir="rtl">גרור לשינוי</p>
                  </div>
                  <DragDropContext onDragEnd={(r) => handleDragEnd(r, "available")}>
                    <Droppable droppableId="available-shifts">
                      {(provided) =>
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-64 overflow-y-auto">
                          {availableShifts.map((shift, index) =>
                        <Draggable key={`${shift.date}-${shift.start_time}`} draggableId={`available-${shift.date}-${shift.start_time}`} index={index}>
                              {(provided, snapshot) =>
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          className={`flex items-center gap-1 p-1.5 rounded border ${snapshot.isDragging ? 'bg-blue-50 border-blue-300 shadow-lg' : 'bg-white border-gray-200'}`}>
                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                  <div className="flex items-center justify-center w-5 h-5 bg-blue-500 text-white rounded-full font-bold text-[10px]">{index + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-[11px] truncate" dir="rtl">{formatDateHebrew(shift.date, "short")}</p>
                                    <p className="text-[9px] text-gray-600">{shift.start_time}-{shift.end_time}</p>
                                  </div>
                                </div>
                          }
                            </Draggable>
                        )}
                          {provided.placeholder}
                        </div>
                      }
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSummary(false)} dir="rtl"><X className="w-4 h-4 mr-2" />חזור</Button>
              <Button onClick={handleSubmit} className="bg-blue-900 hover:bg-blue-800" dir="rtl"><Check className="w-4 h-4 mr-2" />שלח</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showChangeRecap} onOpenChange={setShowChangeRecap}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">סיכום בקשת שינוי</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {(() => {
                const { added, removed } = getChanges();
                return (
                  <>
                    {added.length > 0 &&
                    <div>
                        <p className="font-semibold text-green-700 mb-2" dir="rtl">נוסף:</p>
                        {added.map((s, i) =>
                      <div key={i} className="p-2 bg-green-50 rounded mb-1 text-sm" dir="rtl">
                            {formatDateHebrew(s.date, "short")} {s.start_time}-{s.end_time} ({s.type === 'wanted' ? 'רצוי' : s.type === 'available' ? 'זמין' : 'לא זמין'})
                          </div>
                      )}
                      </div>
                    }
                    {removed.length > 0 &&
                    <div>
                        <p className="font-semibold text-red-700 mb-2" dir="rtl">הוסר:</p>
                        {removed.map((s, i) =>
                      <div key={i} className="p-2 bg-red-50 rounded mb-1 text-sm" dir="rtl">
                            {formatDateHebrew(s.date, "short")} {s.start_time}-{s.end_time} ({s.type === 'wanted' ? 'רצוי' : s.type === 'available' ? 'זמין' : 'לא זמין'})
                          </div>
                      )}
                      </div>
                    }
                    {added.length === 0 && removed.length === 0 &&
                    <p className="text-gray-500" dir="rtl">לא זוהו שינויים</p>
                    }
                  </>);

              })()}
              <div>
                <Label dir="rtl">הערה למנהל (אופציונלי)</Label>
                <Textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="הסבר את הסיבה לשינויים..." rows={3} dir="rtl" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangeRecap(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSubmitChangeRequest} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שלח בקשת שינוי</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDateDetails} onOpenChange={setShowDateDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle dir="rtl">{selectedDate && formatDateHebrew(selectedDate, "long")}</DialogTitle>
            </DialogHeader>
            {selectedDate &&
            <div className="space-y-4 py-4">
                {getEventForDate(selectedDate) &&
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="font-semibold text-purple-800 flex items-center gap-2" dir="rtl">
                      <PartyPopper className="w-4 h-4" />{getEventForDate(selectedDate).title}
                    </p>
                    {getEventForDate(selectedDate).description &&
                <p className="text-sm text-gray-600 mt-1" dir="rtl">{getEventForDate(selectedDate).description}</p>
                }
                  </div>
              }
                {getYearlyEventsForDate(selectedDate).length > 0 &&
              <div>
                    <p className="font-semibold mb-2" dir="rtl">האירועים השנתיים שלך:</p>
                    {getYearlyEventsForDate(selectedDate).map((e, i) =>
                <div key={i} className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                        <p className="font-medium text-green-800" dir="rtl">{e.title}</p>
                        <p className="text-sm text-gray-600">{e.start_time} - {e.end_time}</p>
                      </div>
                )}
                  </div>
              }
                <div>
                  <p className="font-semibold mb-2" dir="rtl">המשמרות שלך:</p>
                  {getAssignmentForDate(selectedDate).length === 0 ?
                <p className="text-sm text-gray-500" dir="rtl">אין משמרות מתוכננות</p> :

                getAssignmentForDate(selectedDate).map((a, i) =>
                <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                        <p className="font-medium" dir="rtl">{a.food_cart_name}</p>
                        {a.briefing_time && <p className="text-sm text-amber-600" dir="rtl">תדריך: {a.briefing_time}</p>}
                        <p className="text-sm text-gray-600">{a.start_time} - {a.end_time} {a.hours ? `(${a.hours}h)` : ''}</p>
                        {a.menu && <p className="text-sm text-amber-700" dir="rtl">תפריט: {a.menu}</p>}
                      </div>
                )
                }
                </div>
              </div>
            }
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDateDetails(false)} dir="rtl">סגור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>);

}
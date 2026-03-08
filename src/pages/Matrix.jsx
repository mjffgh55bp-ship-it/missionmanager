import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ChefHat, Send, Star, Check, Ban, Calendar, CalendarDays, Plus, Trash2, Lock, LockOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Timeline: 00:00 → 24:00 (right to left in RTL)
const getDailyTimeSlots = (zoomRange = { start: 0, end: 100 }) => {
  const allSlots = Array.from({ length: 24 }, (_, i) => i); // 0..23
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};
const getWeeklyTimeSlots = (zoomRange = { start: 0, end: 100 }, weekStartDate = null) => {
  const allSlots = [];
  for (let day = 0; day < 7; day++) {
    let dateLabel = null;
    if (weekStartDate && day < 7) {
      const date = addDays(weekStartDate, day);
      dateLabel = format(date, 'd.M');
    }
    for (let hour = 0; hour < 24; hour++) {
      allSlots.push({ 
        day, 
        hour: hour, 
        label: hour === 0 ? DAYS_OF_WEEK[day] : null,
        dateLabel: hour === 0 ? dateLabel : null
      });
    }
  }
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};
const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];



// Timeline: 00:00 (right, 0%) → 24:00 (left, 100%) in RTL
const timeToPercentage = (timeStr, day = 0, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0]; // 0-24
  const minutes = parts[1] || 0;
  let basePercent;
  if (viewMode === 'weekly') {
    const totalMinutes = (day * 24 + hours) * 60 + minutes;
    basePercent = (totalMinutes / (7 * 24 * 60)) * 100;
  } else {
    // 00:00 = 0%, 24:00 = 100%
    const totalMinutes = hours * 60 + minutes;
    basePercent = (totalMinutes / (24 * 60)) * 100;
  }
  
  if (basePercent < zoomRange.start || basePercent > zoomRange.end) {
    return basePercent < zoomRange.start ? -1 : 101;
  }
  
  const zoomWidth = zoomRange.end - zoomRange.start;
  return ((basePercent - zoomRange.start) / zoomWidth) * 100;
};

const percentageToTime = (percentage, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  const zoomWidth = zoomRange.end - zoomRange.start;
  const basePercent = (percentage / 100) * zoomWidth + zoomRange.start;
  const totalMinutes = (basePercent / 100) * (viewMode === 'weekly' ? 7 * 24 * 60 : 24 * 60);
  
  if (viewMode === 'weekly') {
    const day = Math.floor(totalMinutes / (24 * 60));
    const minutesInDay = totalMinutes % (24 * 60);
    const hours = Math.floor(minutesInDay / 60);
    const mins = Math.round((minutesInDay % 60) / 15) * 15;
    return { day: Math.max(0, Math.min(6, day)), time: `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round((totalMinutes % 60) / 15) * 15;
    return { day: 0, time: `${String(hours).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
  }
};

export default function Matrix() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("daily"); // daily or weekly
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [selectedWorkerForNotification, setSelectedWorkerForNotification] = useState(null);
  const [notificationNotes, setNotificationNotes] = useState("");
  const [dragging, setDragging] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [selectedShiftForType, setSelectedShiftForType] = useState(null);
  const [selectedWorkerForType, setSelectedWorkerForType] = useState(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [selectedWorkerForManual, setSelectedWorkerForManual] = useState(null);
  const [manualShiftData, setManualShiftData] = useState({ start_time: '', end_time: '', type: 'available' });
  const [editingShift, setEditingShift] = useState(null);
  const [populationFilter, setPopulationFilter] = useState("__all__");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const timelineRefs = useRef({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const loadingTimeoutRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  // sentState: { [workerId]: { sentAssignmentIds: string[], sentDate: string } }
  const [sentState, setSentState] = useState({});

  useEffect(() => { 
    loadStaticData();
  }, []);

  useEffect(() => { 
    loadDynamicData(); 
  }, [currentDate, viewMode]);

  // Real-time subscriptions - refresh when assignments or template rows change
  useEffect(() => {
    const unsubAssignment = base44.entities.Assignment.subscribe(() => {
      debouncedLoadData();
    });
    const unsubTemplateRow = base44.entities.TemplateRow.subscribe(() => {
      debouncedLoadData();
    });
    return () => {
      unsubAssignment();
      unsubTemplateRow();
    };
  }, [currentDate, viewMode]);

  const loadStaticData = async () => {
    // Load workers and settings only once
    const [workersData, populationsSettings, workerRolesSettings, shiftStatusesSettings] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "shift_statuses" })
    ]);
    
    if (populationsSettings.length > 0) {
      setPopulations(JSON.parse(populationsSettings[0].setting_value) || []);
    } else {
      setPopulations(["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"]);
    }
    if (workerRolesSettings.length > 0) {
      setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    } else {
      setWorkerRoles(["שף", "סו-שף"]);
    }
    if (shiftStatusesSettings.length > 0) {
      setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    }
    
    setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
  };

  const loadDynamicData = async () => {
    if (isLoadingData) return;
    setIsLoadingData(true);
    setLoading(true);
    
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    
    const dateStr = format(currentDate, "yyyy-MM-dd");

    const [assignmentsData, availabilitiesData, unavailabilitiesData, templateRowsData, allTemplatesData] = await Promise.all([
      viewMode === "daily" 
        ? base44.entities.Assignment.filter({ date: dateStr })
        : base44.entities.Assignment.list(),
      base44.entities.Availability.list(),
      viewMode === "daily"
        ? base44.entities.Unavailability.filter({ date: dateStr })
        : base44.entities.Unavailability.list(),
      viewMode === "daily"
        ? base44.entities.TemplateRow.filter({ date: dateStr })
        : base44.entities.TemplateRow.list(),
      base44.entities.Template.filter({ active: true })
    ]);
    
    // Filter weekly assignments and template rows
    let filteredAssignments = assignmentsData;
    let filteredTemplateRows = templateRowsData;
    if (viewMode === "weekly") {
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      filteredAssignments = assignmentsData.filter(a => a.date >= weekStartStr && a.date <= weekEndStr);
      filteredTemplateRows = templateRowsData.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);
    }
    
    setAssignments(filteredAssignments);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    setTemplateRows(filteredTemplateRows);
    setAllTemplates(allTemplatesData);
    setLoading(false);
    setIsLoadingData(false);
  };

  const debouncedLoadData = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      loadDynamicData();
    }, 300);
  };

  const dateString = format(currentDate, "yyyy-MM-dd");
  const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const getWorkerAssignments = (workerId, date = null) => {
    const targetDate = date || dateString;
    let filtered = assignments.filter(a => 
      (a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId) &&
      (!date || a.date === targetDate)
    );
    
    // Apply status filter
    if (statusFilter !== "__all__") {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    
    return filtered;
  };

  // Get template row shifts for a worker (from worker-type columns in TemplateRow)
  const getWorkerTemplateShifts = (workerId, date = null) => {
    const targetDate = date || dateString;
    const shifts = [];

    const rowsToCheck = date
      ? templateRows.filter(r => r.date === targetDate)
      : templateRows.filter(r => !date || r.date === targetDate);

    rowsToCheck.forEach(row => {
      if (!row.values) return;
      // Check if this worker is assigned to any worker column in this row
      const isAssigned = Object.values(row.values).some(val => val === workerId);
      if (!isAssigned) return;

      // Find the template to get worker-type columns
      const template = allTemplates.find(t => t.id === row.template_id);
      if (!template) return;

      const startTime = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
      const endTime = row.values?.["סיום"] || row.values?.["שעת סיום"];

      if (startTime && endTime) {
        shifts.push({
          id: `template_${row.id}`,
          date: row.date,
          start_time: startTime,
          end_time: endTime,
          food_cart_name: template.name || row.template_name,
          hours: null,
          status: row.values?.status || null,
          isTemplateShift: true
        });
      }
    });

    return shifts;
  };

  const getWorkerAvailabilityForDate = (workerId, date = null) => {
    const targetDate = date || dateString;
    const workerAvail = availabilities.find(a => 
      a.worker_id === workerId && 
      a.week_start_date === weekStartDate &&
      (a.status === "approved" || a.status === "submitted")
    );
    if (!workerAvail || !workerAvail.shifts) return [];
    if (viewMode === 'weekly') {
      return workerAvail.shifts || [];
    }
    return workerAvail.shifts.filter(s => s.date === targetDate);
  };

  const getWorkerUnavailabilityForDate = (workerId, date = null) => {
    const targetDate = date || dateString;
    if (viewMode === 'weekly') {
      return unavailabilities.filter(u => u.worker_id === workerId);
    }
    return unavailabilities.filter(u => u.worker_id === workerId && u.date === targetDate);
  };

  const getWorkerWeeklySummary = (workerId) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(weekStart, i), "yyyy-MM-dd");
      const hasAssignment = assignments.some(a => 
        (a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId) && a.date === d
      );
      days.push({ date: d, day: DAYS_OF_WEEK[i], working: hasAssignment });
    }
    return days;
  };

  const handleSendNotification = (worker) => {
    setSelectedWorkerForNotification(worker);
    setNotificationNotes("");
    setShowNotificationDialog(true);
  };

  // Returns: 'none' | 'needs_update' | 'synced'
  const getWorkerSendStatus = (worker) => {
    const workerAssignments = getWorkerAssignments(worker.id);
    const workerTemplateShifts = getWorkerTemplateShifts(worker.id);
    const allAssigned = [...workerAssignments, ...workerTemplateShifts];
    if (allAssigned.length === 0) return 'none';
    const sent = sentState[worker.id];
    if (!sent) return 'needs_update';
    const currentIds = allAssigned.map(a => a.id).sort().join(',');
    if (sent.assignmentIds === currentIds && sent.date === dateString) return 'synced';
    return 'needs_update';
  };

  const sendNotification = async () => {
    if (!selectedWorkerForNotification) return;
    
    let emailBody = `שלום ${selectedWorkerForNotification.nickname},\n\n`;
    
    const formatShiftLine = (a, prefix = '  ') => {
      const standby = isStandbyStatus(a.status);
      const label = standby ? `כוננות (${a.status})` : a.food_cart_name;
      const duration = standby ? a.status : (a.hours ? `${a.hours}h` : '');
      return `${prefix}${label}: ${a.start_time} - ${a.end_time}${duration && !standby ? ` (${duration})` : ''}\n`;
    };

    if (viewMode === "weekly") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      emailBody += `הנה לוח המשמרות שלך לשבוע של ${format(weekStart, "d.M.yyyy")}:\n\n`;
      
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const dStr = format(d, "yyyy-MM-dd");
        const dayAssignments = getWorkerAssignments(selectedWorkerForNotification.id, dStr);
        const dayTemplateShifts = getWorkerTemplateShifts(selectedWorkerForNotification.id, dStr);
        const allDayShifts = [...dayAssignments, ...dayTemplateShifts];
        const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        emailBody += `${hebrewDays[d.getDay()]}, ${format(d, "d.M")}:\n`;
        if (allDayShifts.length === 0) {
          emailBody += "  אין משמרות\n";
        } else {
          allDayShifts.forEach(a => {
            emailBody += formatShiftLine(a);
          });
        }
        emailBody += "\n";
      }
    } else {
      const workerAssignments = getWorkerAssignments(selectedWorkerForNotification.id);
      const workerTemplateShifts = getWorkerTemplateShifts(selectedWorkerForNotification.id);
      const allShifts = [...workerAssignments, ...workerTemplateShifts];
      emailBody += `הנה לוח המשמרות שלך ל-${format(currentDate, "d.M.yyyy")}:\n\n`;
      if (allShifts.length === 0) {
        emailBody += "אין משמרות מתוכננות ליום זה.\n\n";
      } else {
        allShifts.forEach((a, i) => {
          const standby = isStandbyStatus(a.status);
          emailBody += `משמרת ${i + 1}: ${standby ? `כוננות (${a.status})` : a.food_cart_name}\n  זמן: ${a.start_time} - ${a.end_time}${a.hours && !standby ? ` (${a.hours}h)` : ''}\n\n`;
        });
      }
    }
    
    if (notificationNotes.trim()) emailBody += `הערות מההנהלה:\n${notificationNotes}\n\n`;
    emailBody += "בברכה,\nההנהלה";
    
    if (selectedWorkerForNotification.email) {
      await base44.integrations.Core.SendEmail({
        to: selectedWorkerForNotification.email,
        subject: viewMode === "weekly" 
          ? `לוח משמרות שבועי - שבוע של ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d.M.yyyy")}`
          : `לוח משמרות - ${format(currentDate, "d.M.yyyy")}`,
        body: emailBody
      });
    }
    
    // Mark as sent
    const sentWorker = selectedWorkerForNotification;
    const allAssigned = [...getWorkerAssignments(sentWorker.id), ...getWorkerTemplateShifts(sentWorker.id)];
    const currentIds = allAssigned.map(a => a.id).sort().join(',');
    setSentState(prev => ({ ...prev, [sentWorker.id]: { assignmentIds: currentIds, date: dateString } }));

    setShowNotificationDialog(false);
    setSelectedWorkerForNotification(null);
    setNotificationNotes("");
  };

  const handleMouseDown = (e, worker, shift, action, dayIndex = 0) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't start dragging if it's a double-click on an existing shift
    if (action === 'move' && e.detail === 2) return;
    
    const timeline = timelineRefs.current[worker.id];
    if (!timeline) return;
    
    const rect = timeline.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    // RTL: timeline right edge = 0% (06:00), left edge = 100% (next 06:00)
    // So invert: percent from left → percent from right
    const startPercent = 100 - (startX / rect.width) * 100;
    
    setDragging({
      workerId: worker.id,
      worker,
      shift,
      action,
      startPercent,
      originalStart: shift?.start_time,
      originalEnd: shift?.end_time,
      originalDay: viewMode === 'weekly' ? (shift ? getDayIndexFromDate(shift.date) : dayIndex) : 0,
      originalType: shift?.type,
      rect
    });
  };
  
  const getDayIndexFromDate = (dateStr) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const date = new Date(dateStr);
    const diff = Math.floor((date - weekStart) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, diff));
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const { workerId, worker, shift, action, startPercent, originalStart, originalEnd, originalDay, rect } = dragging;
    const currentX = e.clientX - rect.left;
    // RTL: invert so right side = 0% (06:00)
    const currentPercent = Math.max(0, Math.min(100, 100 - (currentX / rect.width) * 100));
    
    let newStart = originalStart;
    let newEnd = originalEnd;
    let newDay = originalDay || 0;
    
    if (action === 'create') {
      const minP = Math.min(startPercent, currentPercent);
      const maxP = Math.max(startPercent, currentPercent);
      const startData = percentageToTime(minP, viewMode, zoomRange);
      const endData = percentageToTime(maxP, viewMode, zoomRange);
      newStart = startData.time;
      newEnd = endData.time;
      newDay = startData.day;
    } else if (action === 'resize-start') {
      const data = percentageToTime(currentPercent, viewMode, zoomRange);
      newStart = data.time;
      newDay = data.day;
    } else if (action === 'resize-end') {
      const data = percentageToTime(currentPercent, viewMode, zoomRange);
      newEnd = data.time;
    } else if (action === 'move') {
      const origStartP = timeToPercentage(originalStart, originalDay || 0, viewMode, zoomRange);
      const origEndP = timeToPercentage(originalEnd, originalDay || 0, viewMode, zoomRange);
      const width = origEndP - origStartP;
      const diff = currentPercent - startPercent;
      const newStartP = Math.max(0, Math.min(100 - width, origStartP + diff));
      const startData = percentageToTime(newStartP, viewMode, zoomRange);
      const endData = percentageToTime(newStartP + width, viewMode, zoomRange);
      newStart = startData.time;
      newEnd = endData.time;
      newDay = startData.day;
    }
    
    setDragPreview({ workerId, start: newStart, end: newEnd, day: newDay, type: shift?.type || 'available' });
  };

  const handleMouseUp = async () => {
    if (!dragging || !dragPreview) {
      setDragging(null);
      setDragPreview(null);
      return;
    }
    
    const { workerId, worker, shift, action } = dragging;
    const { start, end, day } = dragPreview;
    
    if (start === end) {
      setDragging(null);
      setDragPreview(null);
      return;
    }
    
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const targetDate = viewMode === 'weekly' ? format(addDays(weekStart, day || 0), 'yyyy-MM-dd') : dateString;
    
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    
    if (action === 'create') {
      const newShift = { 
        date: targetDate, 
        start_time: start, 
        end_time: end, 
        type: 'available', 
        priority: updatedShifts.length + 1 
      };
      
      updatedShifts.push(newShift);
    } else if (shift) {
      updatedShifts = updatedShifts.map(s => {
        if (s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time) {
          return { ...s, date: targetDate, start_time: start, end_time: end };
        }
        return s;
      });
    }
    
    const availData = {
      worker_id: workerId,
      worker_name: worker.nickname,
      week_start_date: weekStartDate,
      shifts: updatedShifts,
      status: workerAvail?.status || "approved"
    };
    
    console.log('Saving availability with shifts:', JSON.stringify(updatedShifts));
    
    if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
    else await base44.entities.Availability.create(availData);
    
    setDragging(null);
    setDragPreview(null);
    debouncedLoadData();
  };

  const handleTypeClick = async (e, worker, shift) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Cycle through types directly without dialog
    const workerAvail = availabilities.find(a => a.worker_id === worker.id && a.week_start_date === weekStartDate);
    if (!workerAvail) return;
    
    const currentType = shift.type || 'available';
    let newType = 'available';
    if (currentType === 'available') newType = 'wanted';
    else if (currentType === 'wanted') newType = 'unavailable';
    else if (currentType === 'unavailable') newType = 'available';
    
    const updatedShifts = workerAvail.shifts.map(s => {
      if (s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time) {
        return { ...s, type: newType };
      }
      return s;
    });
    
    await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    debouncedLoadData();
  };

  const handleChangeType = async (newType) => {
    if (!selectedWorkerForType || !selectedShiftForType) return;
    
    const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForType.id && a.week_start_date === weekStartDate);
    if (!workerAvail) return;
    
    const updatedShifts = workerAvail.shifts.map(s => {
      if (s.date === selectedShiftForType.date && s.start_time === selectedShiftForType.start_time && s.end_time === selectedShiftForType.end_time) {
        return { ...s, type: newType };
      }
      return s;
    });
    
    await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
    setShowTypeDialog(false);
    setSelectedShiftForType(null);
    setSelectedWorkerForType(null);
    debouncedLoadData();
  };

  const handleManualShiftAdd = (worker) => {
    setSelectedWorkerForManual(worker);
    setManualShiftData({ start_time: '', end_time: '', type: 'available' });
    setEditingShift(null);
    setShowManualDialog(true);
  };

  const handleShiftDoubleClick = (e, worker, shift) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedWorkerForManual(worker);
    setManualShiftData({ 
      start_time: shift.start_time, 
      end_time: shift.end_time, 
      type: shift.type
    });
    setEditingShift(shift);
    setShowManualDialog(true);
  };

  const submitManualShift = async () => {
    if (!selectedWorkerForManual || !manualShiftData.start_time || !manualShiftData.end_time) return;

    const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForManual.id && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];

    // Ensure date is in correct format without timezone issues
    const targetDate = format(currentDate, "yyyy-MM-dd");

    if (editingShift) {
      // Update existing shift
      updatedShifts = updatedShifts.map(s => {
        if (s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type) {
          return {
            ...s,
            date: targetDate,
            start_time: manualShiftData.start_time,
            end_time: manualShiftData.end_time,
            type: manualShiftData.type
          };
        }
        return s;
      });
    } else {
      // Add new shift
      updatedShifts.push({
        date: targetDate,
        start_time: manualShiftData.start_time,
        end_time: manualShiftData.end_time,
        type: manualShiftData.type,
        priority: updatedShifts.length + 1
      });
    }

    const availData = {
      worker_id: selectedWorkerForManual.id,
      worker_name: selectedWorkerForManual.nickname,
      week_start_date: weekStartDate,
      shifts: updatedShifts,
      status: workerAvail?.status || "approved"
    };

    if (workerAvail) await base44.entities.Availability.update(workerAvail.id, availData);
    else await base44.entities.Availability.create(availData);

    setShowManualDialog(false);
    setSelectedWorkerForManual(null);
    setManualShiftData({ start_time: '', end_time: '', type: 'available' });
    setEditingShift(null);
    debouncedLoadData();
  };

  const calculateWorkerSummary = (workerId) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    
    const workerShifts = availabilities
      .filter(a => a.worker_id === workerId)
      .flatMap(a => a.shifts || [])
      .filter(s => {
        const shiftDate = new Date(s.date);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      });

    const calculateHours = (startTime, endTime) => {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      let hours = endHour - startHour;
      if (endHour < startHour) hours += 24;
      hours += (endMin - startMin) / 60;
      return Math.max(0, hours);
    };

    let totalShifts = 0;
    let standbyHours = 0;
    let regularShiftCount = 0;
    let trainingHours = 0;
    let otherCount = 0;
    let coreHours = 0;
    let extremeHours = 0;

    workerShifts.forEach(shift => {
      const hours = calculateHours(shift.start_time, shift.end_time);
      
      // Count all shifts for total
      totalShifts++;
      regularShiftCount++;
        
      // Core hours (6:00-18:00) - every 4 hours = 1 shift
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      const [endHour, endMin] = shift.end_time.split(':').map(Number);
      
      // Check if shift is within core hours
      const startInCore = startHour >= 6 && startHour < 18;
      const endInCore = endHour > 6 && endHour <= 18;
      
      if (startInCore || endInCore) {
        // Calculate overlap with core hours
        const coreStart = Math.max(startHour + startMin / 60, 6);
        const coreEnd = Math.min(endHour + endMin / 60, 18);
        if (coreEnd > coreStart) {
          coreHours += Math.max(0, coreEnd - coreStart);
        }
      }
      
      // Extreme hours (2:00-6:00) - every 4 hours = 1 shift
      const startInExtreme = startHour >= 2 && startHour < 6;
      const endInExtreme = endHour > 2 && endHour <= 6;
      
      if (startInExtreme || endInExtreme) {
        // Calculate overlap with extreme hours
        const extremeStart = Math.max(startHour + startMin / 60, 2);
        const extremeEnd = Math.min(endHour + endMin / 60, 6);
        if (extremeEnd > extremeStart) {
          extremeHours += Math.max(0, extremeEnd - extremeStart);
        }
      }
    });

    return {
      total: totalShifts,
      regularShift: regularShiftCount,
      core: Math.round((coreHours / 4) * 10) / 10,
      extreme: Math.round((extremeHours / 4) * 10) / 10
    };
  };

  const isStandbyStatus = (status) => /^\d+[׳']/.test(status || '');

  const AssignmentBar = ({ assignment }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(assignment.date) : 0;
    const startPercent = timeToPercentage(assignment.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(assignment.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent >= startPercent ? endPercent - startPercent : 0;
    
    if (startPercent < 0 || startPercent > 100) return null;

    const isTemplate = assignment.isTemplateShift;
    const rightPercent = startPercent;
    const standby = isStandbyStatus(assignment.status);

    // Standby shifts: render as empty outline bar (like availability window)
    if (standby) {
      const borderColor = isTemplate ? '#a855f7' : '#3b82f6';
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute h-full rounded-sm z-20 flex items-center justify-center px-1 overflow-hidden"
                style={{
                  right: `${rightPercent}%`,
                  width: `${Math.max(width, 0.5)}%`,
                  backgroundColor: 'transparent',
                  border: `2px dashed ${borderColor}`,
                }}
              >
                <span className="text-[9px] font-bold truncate" style={{ color: borderColor }}>{assignment.status}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-none">
              <p className="font-bold">{assignment.food_cart_name}</p>
              <p>זמן: {assignment.start_time} - {assignment.end_time}</p>
              <p>סטטוס כוננות: {assignment.status}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full border-r-2 rounded-sm flex flex-col items-center justify-center px-2 overflow-hidden z-20 ${
                isTemplate 
                  ? "bg-purple-400 border-purple-600" 
                  : assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"
              }`}
              style={{ right: `${rightPercent}%`, width: `${Math.max(width, 0.5)}%` }}
            >
              {!isTemplate && <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>}
              {assignment.status && <span className="text-white text-[8px] truncate">{assignment.status}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 text-white border-none">
            <p className="font-bold">{assignment.food_cart_name}</p>
            <p>זמן: {assignment.start_time} - {assignment.end_time}</p>
            {assignment.status && <p>סטטוס: {assignment.status}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Helper: check if two time ranges overlap (handles overnight)
  const timesOverlap = (aStart, aEnd, bStart, bEnd) => {
    const toMins = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
    const as = toMins(aStart), ae = toMins(aEnd) || toMins(aStart) + 24*60;
    const bs = toMins(bStart), be = toMins(bEnd) || toMins(bStart) + 24*60;
    return as < be && ae > bs;
  };

  const AvailabilityBar = ({ shift, worker }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shift.date) : 0;
    const startPercent = timeToPercentage(shift.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(shift.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent >= startPercent ? endPercent - startPercent : 0;
    
    if (startPercent < 0 || startPercent > 100) return null;

    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };
    const borderColors = { wanted: '#16a34a', available: '#3b82f6', unavailable: '#dc2626' };
    const borderColor = borderColors[shift.type] || '#3b82f6';
    const rightPercent = startPercent;

    // Find assignments that overlap this availability window (for this worker on this date)
    const shiftDate = shift.date;
    const overlappingAssignments = [
      ...assignments.filter(a =>
        (a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id) &&
        a.date === shiftDate && a.start_time && a.end_time &&
        timesOverlap(shift.start_time, shift.end_time, a.start_time, a.end_time)
      ),
      ...templateRows.filter(r => {
        if (r.date !== shiftDate) return false;
        if (!r.values) return false;
        const isAssigned = Object.values(r.values).some(val => val === worker.id);
        if (!isAssigned) return false;
        const st = r.values?.["התחלה"] || r.values?.["שעת התחלה"];
        const et = r.values?.["סיום"] || r.values?.["שעת סיום"];
        return st && et && timesOverlap(shift.start_time, shift.end_time, st, et);
      }).map(r => ({
        start_time: r.values?.["התחלה"] || r.values?.["שעת התחלה"],
        end_time: r.values?.["סיום"] || r.values?.["שעת סיום"],
        status: r.values?.status || null,
        isTemplateShift: true
      }))
    ];

    return (
      <div
        className="absolute h-full rounded-sm z-10 cursor-move overflow-visible"
        style={{ 
          right: `${rightPercent}%`, 
          width: `${width}%`,
          backgroundColor: 'transparent',
          border: `2px solid ${borderColor}`,
        }}
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'move', dayIndex); }}
        onDoubleClick={(e) => handleShiftDoubleClick(e, worker, shift)}
      >
        {/* Resize handles */}
        <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/10 z-20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-start', dayIndex); }} />
        <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/10 z-20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-end', dayIndex); }} />

        {/* Type indicator circle */}
        <button
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[8px] font-bold z-30 hover:scale-110 transition-transform"
          style={{ borderColor }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTypeClick(e, worker, shift); }}
        >
          {typeLabels[shift.type] || "A"}
        </button>

        {/* Filled segments for overlapping assignments */}
        {overlappingAssignments.map((ass, i) => {
          const overlapStart = (() => {
            const toMins = t => { const [h,m] = t.split(':').map(Number); return h * 60 + m; };
            const avS = toMins(shift.start_time), avE = toMins(shift.end_time) || toMins(shift.start_time)+24*60;
            const assS = toMins(ass.start_time), assE = toMins(ass.end_time) || toMins(ass.start_time)+24*60;
            const overS = Math.max(avS, assS);
            const overE = Math.min(avE, assE);
            const totalMins = avE - avS;
            const leftPct = ((overS - avS) / totalMins) * 100;
            const widthPct = ((overE - overS) / totalMins) * 100;
            return { leftPct, widthPct };
          })();
          const standby = isStandbyStatus(ass.status);
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${overlapStart.leftPct}%`,
                width: `${overlapStart.widthPct}%`,
                backgroundColor: standby
                  ? 'rgba(200,200,210,0.55)'
                  : ass.isTemplateShift
                    ? 'rgba(192,132,252,0.55)'
                    : 'rgba(96,165,250,0.55)',
                pointerEvents: 'none'
              }}
            />
          );
        })}
      </div>
    );
  };

  const UnavailabilityBar = ({ unavail }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(unavail.date) : 0;
    const startPercent = timeToPercentage(unavail.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(unavail.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;
    
    // Hide if outside zoom range
    if (startPercent < 0 || startPercent > 100) return null;
    // In RTL layout: 0% from timeToPercentage = 06:00 = rightmost side.
    const rightPercent = startPercent;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${unavail.reason === 'overseas' ? 'bg-red-200 border-r-2 border-red-500' : 'bg-gray-300 border-r-2 border-gray-500'}`} style={{ right: `${rightPercent}%`, width: `${width}%` }}>
              <Ban className="w-3 h-3 text-gray-600" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 text-white border-none">
            <p className="font-bold capitalize">{unavail.reason}</p>
            <p>{unavail.start_time} - {unavail.end_time}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const DragPreviewBar = ({ preview, workerId }) => {
    if (!preview || preview.workerId !== workerId) return null;
    const startPercent = timeToPercentage(preview.start, preview.day || 0, viewMode, zoomRange);
    const endPercent = timeToPercentage(preview.end, preview.day || 0, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;
    const rightPercent = startPercent;

    return (
      <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80" style={{ right: `${rightPercent}%`, width: `${width}%` }}>
        <span className="text-xs font-bold">{preview.start} - {preview.end}</span>
      </div>
    );
  };

  const WeeklySummary = ({ worker }) => {
    const summary = getWorkerWeeklySummary(worker.id);
    return (
      <div className="flex gap-1 ml-2">
        {summary.map((d, i) => (
          <div key={i} className={`w-5 h-5 rounded text-[8px] flex items-center justify-center font-medium ${d.working ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`} title={`${d.day}: ${d.working ? 'עובד' : 'חופש'}`}>
            {d.day.charAt(0)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} dir="rtl">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div dir="rtl">
                <CardTitle className="text-2xl">מטריצת שעות {viewMode === "weekly" ? "שבועית" : "יומית"}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">גרור קצוות לשינוי גודל, גרור אמצע להזזה, לחץ על עיגול הסוג לשינוי</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge className="bg-green-100 text-green-800" dir="rtl"><Star className="w-3 h-3 mr-1 fill-current" />רצוי</Badge>
                  <Badge className="bg-cyan-100 text-cyan-800" dir="rtl"><Check className="w-3 h-3 mr-1" />זמין</Badge>
                  <Badge className="bg-red-100 text-red-800" dir="rtl"><Ban className="w-3 h-3 mr-1" />לא זמין</Badge>
                  <Badge className="bg-blue-400 text-white" dir="rtl">שיבוץ</Badge>
                  <Badge className="bg-purple-400 text-white" dir="rtl">שיבוץ (לוח)</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={populationFilter} onValueChange={setPopulationFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="אוכלוסייה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">כל האוכלוסיות</SelectItem>
                    {populations.map(pop => (
                      <SelectItem key={pop} value={pop}>{pop}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="תפקיד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">כל התפקידים</SelectItem>
                    {workerRoles.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">כל הסטטוסים</SelectItem>
                    {shiftStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm" dir="rtl">יומי</span>
                  <Switch checked={viewMode === "weekly"} onCheckedChange={(checked) => setViewMode(checked ? "weekly" : "daily")} />
                  <CalendarDays className="w-4 h-4" />
                  <span className="text-sm" dir="rtl">שבועי</span>
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, viewMode === "weekly" ? 7 : 1))}><ChevronRight className="w-4 h-4" /></Button>
                <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center">
                  {viewMode === "weekly" ? `שבוע של ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d")}` : format(currentDate, "d.M.yyyy")}
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === "weekly" ? 7 : 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-0">
            {/* Fixed Zoom Control at Bottom */}
            <div 
              className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg pointer-events-auto"
              style={{ 
                direction: 'ltr',
                zIndex: 9999,
                width: '100%',
                padding: '8px'
              }}
            >
              <div className="flex items-center gap-4 max-w-screen-2xl mx-auto">
                <div className="flex-1 relative bg-gray-200 rounded-full pointer-events-auto" style={{ height: '16px', minHeight: '16px' }}>
                  {/* Main drag bar */}
                  <div 
                    className="absolute top-0 h-full bg-blue-400 rounded-full cursor-move hover:bg-blue-500 transition-colors"
                    style={{ 
                      left: `${zoomRange.start}%`, 
                      width: `${zoomRange.end - zoomRange.start}%`,
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startRangeStart = zoomRange.start;
                      const startRangeEnd = zoomRange.end;
                      const width = startRangeEnd - startRangeStart;
                      const rect = e.currentTarget.parentElement.getBoundingClientRect();
                      const handleMove = (moveE) => {
                        moveE.preventDefault();
                        moveE.stopPropagation();
                        const delta = ((moveE.clientX - startX) / rect.width) * 100;
                        let newStart = startRangeStart + delta;
                        let newEnd = startRangeEnd + delta;
                        
                        if (newStart < 0) {
                          newStart = 0;
                          newEnd = width;
                        } else if (newEnd > 100) {
                          newEnd = 100;
                          newStart = 100 - width;
                        }
                        
                        setZoomRange({ start: newStart, end: newEnd });
                      };
                      const handleUp = (upE) => {
                        upE.preventDefault();
                        upE.stopPropagation();
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  />
                  {/* Left handle */}
                  <div 
                    className="absolute bg-blue-600 rounded-l-full cursor-ew-resize hover:bg-blue-700 transition-colors"
                    style={{ 
                      left: `${zoomRange.start}%`,
                      top: '-2px',
                      width: '16px',
                      height: '20px',
                      zIndex: 10,
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startValue = zoomRange.start;
                      const rect = e.currentTarget.parentElement.getBoundingClientRect();
                      const handleMove = (moveE) => {
                        moveE.preventDefault();
                        moveE.stopPropagation();
                        const deltaPixels = moveE.clientX - startX;
                        const deltaPercent = (deltaPixels / rect.width) * 100;
                        const newStart = Math.max(0, Math.min(zoomRange.end - 5, startValue + deltaPercent));
                        setZoomRange({ start: newStart, end: zoomRange.end });
                      };
                      const handleUp = (upE) => {
                        upE.preventDefault();
                        upE.stopPropagation();
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  />
                  {/* Right handle */}
                  <div 
                    className="absolute bg-blue-600 rounded-r-full cursor-ew-resize hover:bg-blue-700 transition-colors"
                    style={{ 
                      left: `${zoomRange.end}%`,
                      top: '-2px',
                      width: '16px',
                      height: '20px',
                      transform: 'translateX(-100%)',
                      zIndex: 10,
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startValue = zoomRange.end;
                      const rect = e.currentTarget.parentElement.getBoundingClientRect();
                      const handleMove = (moveE) => {
                        moveE.preventDefault();
                        moveE.stopPropagation();
                        const deltaPixels = moveE.clientX - startX;
                        const deltaPercent = (deltaPixels / rect.width) * 100;
                        const newEnd = Math.max(zoomRange.start + 5, Math.min(100, startValue + deltaPercent));
                        setZoomRange({ start: zoomRange.start, end: newEnd });
                      };
                      const handleUp = (upE) => {
                        upE.preventDefault();
                        upE.stopPropagation();
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setZoomRange({ start: 0, end: 100 })}
                  disabled={zoomRange.start === 0 && zoomRange.end === 100}
                  className="shrink-0"
                  style={{ pointerEvents: 'auto' }}
                >
                  איפוס
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto pb-16">
              <div className="min-w-[1400px]">
                <div className="flex sticky top-0 bg-gray-100 z-50 border-b">
                  <div className="w-[300px] min-w-[300px] p-3 font-semibold text-gray-700 border-r sticky left-0 bg-gray-100 z-50" dir="rtl">עובד</div>
                  <div className="flex-1 relative flex" dir="rtl">
                    {viewMode === 'daily' ? (
                     getDailyTimeSlots(zoomRange).map((hour) => (
                       <div key={hour} className="flex-1 text-xs text-gray-600 py-3 border-l text-center font-medium">{String(hour).padStart(2, '0')}:00</div>
                     ))
                    ) : (
                     getWeeklyTimeSlots(zoomRange, startOfWeek(currentDate, { weekStartsOn: 0 })).map((slot, idx) => (
                       <div key={idx} className="flex-1 text-xs text-gray-600 py-3 border-l text-center font-medium">
                         {slot.label && <div className="font-bold">{slot.label}</div>}
                         {slot.dateLabel && <div className="text-[9px] text-gray-500">{slot.dateLabel}</div>}
                         {slot.hour === 0 && <div className="text-[10px]">{String(slot.hour).padStart(2, '0')}:00</div>}
                       </div>
                     ))
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="text-center p-8" dir="rtl">טוען...</div>
                ) : workers.length === 0 ? (
                  <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
                ) : (
                  workers
                    .filter(w => {
                      if (populationFilter !== "__all__" && w.population !== populationFilter) return false;
                      if (roleFilter !== "__all__" && w.role !== roleFilter) return false;
                      return true;
                    })
                    .map((worker, index) => {
                    const availabilityShifts = getWorkerAvailabilityForDate(worker.id);
                    const workerAssignments = getWorkerAssignments(worker.id);
                    const workerTemplateShifts = getWorkerTemplateShifts(worker.id);
                    const workerUnavailabilities = getWorkerUnavailabilityForDate(worker.id);
                    const summary = viewMode === 'weekly' ? calculateWorkerSummary(worker.id) : null;
                    
                    return (
                      <React.Fragment key={worker.id}>
                      <div className={`flex border-b h-16 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <div className="w-[300px] min-w-[300px] p-3 font-medium text-gray-800 border-r flex items-center justify-between sticky left-0 bg-inherit z-40 h-16">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                await base44.entities.Worker.update(worker.id, {
                                  ...worker,
                                  availability_locked: !worker.availability_locked
                                });
                                loadStaticData();
                              }}
                              className="hover:bg-gray-100 rounded p-1 transition-colors"
                              title={worker.availability_locked ? "נעול - לחץ לפתיחה" : "פתוח - לחץ לנעילה"}
                            >
                              {worker.availability_locked ? (
                                <Lock className="w-5 h-5 text-gray-900" />
                              ) : (
                                <LockOpen className="w-5 h-5 text-blue-500" />
                              )}
                            </button>
                            {/* Send button - between lock and worker name */}
                            {(() => {
                              const sendStatus = getWorkerSendStatus(worker);
                              const btnClass = sendStatus === 'none'
                                ? 'text-gray-400 hover:text-gray-500'
                                : sendStatus === 'needs_update'
                                ? 'text-green-500 hover:text-green-600'
                                : 'text-gray-900 hover:text-gray-700';
                              return (
                                <button
                                  onClick={() => handleSendNotification(worker)}
                                  className={`rounded p-1 transition-colors hover:bg-gray-100 ${btnClass}`}
                                  title="שלח לוח משמרות"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              );
                            })()}
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${worker.role === 'chef' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-700'}`}>
                                <ChefHat className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="truncate block">{worker.nickname}</span>
                                <WeeklySummary worker={worker} />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleManualShiftAdd(worker)} title="הוסף חלון זמינות ידנית"><Plus className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        <div 
                          data-worker-id={worker.id}
                          ref={el => {
                            if (el) {
                              timelineRefs.current[worker.id] = el;
                              console.log(`Assigned ref for ${worker.nickname} (${worker.id}):`, el);
                            }
                          }}
                          className="flex-1 relative border-r cursor-crosshair h-16"
                          dir="rtl"
                          onMouseDown={(e) => {
                            handleMouseDown(e, worker, null, 'create');
                          }}
                        >
                          <div className="absolute inset-0 flex h-16" dir="rtl">
                            {viewMode === 'daily' ? (
                              getDailyTimeSlots(zoomRange).map(hour => (<div key={hour} className="flex-1 border-l time-slot h-16"></div>))
                            ) : (
                              getWeeklyTimeSlots(zoomRange).map((slot, idx) => (<div key={idx} className="flex-1 border-l time-slot h-16"></div>))
                            )}
                          </div>
                          <div className="absolute inset-0">
                            {availabilityShifts.map((shift, idx) => (<AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />))}
                            {workerUnavailabilities.map(unavail => (<UnavailabilityBar key={unavail.id} unavail={unavail} />))}
                            {workerAssignments.map(ass => <AssignmentBar key={ass.id} assignment={ass} />)}
                            {workerTemplateShifts.map(ts => <AssignmentBar key={ts.id} assignment={ts} />)}
                            <DragPreviewBar preview={dragPreview} workerId={worker.id} />
                          </div>
                        </div>
                      </div>
                      {viewMode === 'weekly' && summary && (
                       <div className="flex border-b bg-gray-100 text-xs h-8">
                         <div className="w-[300px] min-w-[300px] px-3 py-1 border-r sticky left-0 bg-gray-100 z-40 font-semibold text-gray-700" dir="rtl">
                           סיכום שבועי
                         </div>
                         <div className="flex-1 px-3 py-1 flex gap-4 items-center flex-wrap text-gray-700" dir="rtl">
                           <span><strong>סה"כ:</strong> {summary.total}</span>
                           <span><strong>משמרת:</strong> {summary.regularShift}</span>
                           <span><strong>ליבה:</strong> {summary.core}</span>
                           <span><strong>קיצון:</strong> {summary.extreme}</span>
                         </div>
                       </div>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Dialog */}
        <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">שלח לוח זמנים {viewMode === "weekly" ? "שבועי" : "יומי"} - {selectedWorkerForNotification?.nickname}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                <p className="text-sm font-semibold mb-2">
                  {viewMode === "weekly" ? `משמרות לשבוע של ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "d.M.yyyy")}:` : `משמרות ל-${format(currentDate, "d.M.yyyy")}:`}
                </p>
                {viewMode === "weekly" && selectedWorkerForNotification ? (
                  Array.from({ length: 7 }).map((_, i) => {
                    const d = addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i);
                    const dStr = format(d, "yyyy-MM-dd");
                    const dayAssignments = getWorkerAssignments(selectedWorkerForNotification.id, dStr);
                    return (
                      <div key={i} className="mb-2">
                        <p className="text-xs font-semibold">{(() => {
                          const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
                          return `${hebrewDays[d.getDay()]}, ${format(d, "d.M")}`;
                        })()}</p>
                        {dayAssignments.length === 0 ? (
                          <p className="text-xs text-gray-500 ml-2">אין משמרות</p>
                        ) : dayAssignments.map((a, idx) => (
                          <div key={idx} className="text-xs bg-white p-1 rounded border ml-2 mt-1">{a.food_cart_name}: {a.start_time}-{a.end_time}</div>
                        ))}
                      </div>
                    );
                  })
                ) : selectedWorkerForNotification && getWorkerAssignments(selectedWorkerForNotification.id).length > 0 ? (
                  getWorkerAssignments(selectedWorkerForNotification.id).map((a, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded border mb-1">
                      <p className="font-semibold">{a.food_cart_name}</p>
                      <p>{a.start_time} - {a.end_time} ({a.hours}h)</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">אין משמרות מתוכננות</p>
                )}
              </div>
              <div><Label dir="rtl">הערות נוספות</Label><Textarea value={notificationNotes} onChange={(e) => setNotificationNotes(e.target.value)} rows={4} dir="rtl" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNotificationDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={sendNotification} className="bg-blue-900 hover:bg-blue-800" disabled={!selectedWorkerForNotification?.email} dir="rtl"><Send className="w-4 h-4 mr-2" />שלח</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Type Change Dialog */}
        <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle dir="rtl">שינוי סוג זמינות</DialogTitle></DialogHeader>
            <div className="py-4 space-y-2" dir="rtl">
              <Button variant="outline" className="w-full justify-start" onClick={() => handleChangeType('wanted')}>
                <Star className="w-4 h-4 ml-2 text-green-600 fill-green-600" />רצוי
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleChangeType('available')}>
                <Check className="w-4 h-4 ml-2 text-blue-600" />זמין
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleChangeType('unavailable')}>
                <Ban className="w-4 h-4 ml-2 text-red-600" />לא זמין
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Shift Add/Edit Dialog */}
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-right" dir="rtl">{editingShift ? 'עריכת' : 'הוספת'} חלון זמינות - {selectedWorkerForManual?.nickname}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-center block mb-2" dir="rtl">שעת התחלה (HH:MM)</Label>
                  <Input 
                    type="time" 
                    value={manualShiftData.start_time} 
                    onChange={(e) => setManualShiftData({ ...manualShiftData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-center block mb-2" dir="rtl">שעת סיום (HH:MM)</Label>
                  <Input 
                    type="time" 
                    value={manualShiftData.end_time} 
                    onChange={(e) => setManualShiftData({ ...manualShiftData, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-center block mb-2" dir="rtl">סוג זמינות</Label>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant={manualShiftData.type === "wanted" ? "default" : "outline"}
                    className={manualShiftData.type === "wanted" ? "bg-green-500 hover:bg-green-600" : ""}
                    onClick={() => setManualShiftData({ ...manualShiftData, type: "wanted" })}
                    dir="rtl"
                  >
                    <Star className="w-4 h-4 ml-1" />
                    רצוי
                  </Button>
                  <Button
                    variant={manualShiftData.type === "available" ? "default" : "outline"}
                    className={manualShiftData.type === "available" ? "bg-blue-500 hover:bg-blue-600" : ""}
                    onClick={() => setManualShiftData({ ...manualShiftData, type: "available" })}
                    dir="rtl"
                  >
                    <Check className="w-4 h-4 ml-1" />
                    זמין
                  </Button>
                  <Button
                    variant={manualShiftData.type === "unavailable" ? "default" : "outline"}
                    className={manualShiftData.type === "unavailable" ? "bg-red-500 hover:bg-red-600" : ""}
                    onClick={() => setManualShiftData({ ...manualShiftData, type: "unavailable" })}
                    dir="rtl"
                  >
                    <Ban className="w-4 h-4 ml-1" />
                    לא זמין
                  </Button>
                </div>
              </div>

            </div>
            <DialogFooter className="flex justify-between" dir="rtl">
              <div>
                {editingShift && (
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      if (!selectedWorkerForManual || !editingShift) return;
                      const workerAvail = availabilities.find(a => a.worker_id === selectedWorkerForManual.id && a.week_start_date === weekStartDate);
                      if (!workerAvail) return;
                      const updatedShifts = workerAvail.shifts.filter(s => 
                        !(s.date === editingShift.date && s.start_time === editingShift.start_time && s.end_time === editingShift.end_time && s.type === editingShift.type)
                      );
                      await base44.entities.Availability.update(workerAvail.id, { shifts: updatedShifts });
                      setShowManualDialog(false);
                      setSelectedWorkerForManual(null);
                      setManualShiftData({ start_time: '', end_time: '', type: 'available' });
                      setEditingShift(null);
                      debouncedLoadData();
                    }}
                    dir="rtl"
                  >
                    מחק
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setShowManualDialog(false);
                  setSelectedWorkerForManual(null);
                  setManualShiftData({ start_time: '', end_time: '', type: 'available' });
                  setEditingShift(null);
                }} dir="rtl">ביטול</Button>
                <Button 
                  onClick={submitManualShift} 
                  className="bg-blue-900 hover:bg-blue-800"
                  disabled={!manualShiftData.start_time || !manualShiftData.end_time}
                  dir="rtl"
                >
                  {editingShift ? 'עדכן' : <><Plus className="w-4 h-4 mr-2" />הוסף</>}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
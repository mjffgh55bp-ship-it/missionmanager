import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ChefHat, Send, Star, Check, Ban, Calendar, CalendarDays, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const getDailyTimeSlots = (zoomRange = { start: 0, end: 100 }) => {
  const allSlots = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);
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
    for (let hour = 6; hour < 30; hour++) {
      allSlots.push({ 
        day, 
        hour: hour % 24, 
        label: hour === 6 ? DAYS_OF_WEEK[day] : null,
        dateLabel: hour === 6 ? dateLabel : null
      });
    }
  }
  const startIdx = Math.floor((zoomRange.start / 100) * allSlots.length);
  const endIdx = Math.ceil((zoomRange.end / 100) * allSlots.length);
  return allSlots.slice(startIdx, endIdx);
};
const DAYS_OF_WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const DEFAULT_ACTIVITY_TYPES = [
  { id: 'constraint', label: 'אילוץ', color: '#E0BBE4' },
  { id: 'management', label: 'תפקיד ניהול', color: '#C5F05A' },
  { id: 'standby_30_mgmt', label: 'כוננות 30\' לתפקיד ניהול', color: '#9AE03A' },
  { id: 'standby_15', label: 'כוננות 15\'', color: '#FF1493' },
  { id: 'shift', label: 'משמרת', color: '#8B4513' },
  { id: 'standby_long', label: 'כוננות 60/75/90/105/120/180', color: '#9B59B6' },
  { id: 'trainer', label: 'מאמן', color: '#A9A9A9' },
  { id: 'bird', label: 'ציפור', color: '#FFA500' },
  { id: 'other', label: 'אחר', color: '#FFB6C1' },
  { id: 'vacation', label: 'חופש', color: '#E6C3E6' },
  { id: 'abroad', label: 'חו"ל', color: '#C8C8C8' }
];

const timeToPercentage = (timeStr, day = 0, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  let basePercent;
  if (viewMode === 'weekly') {
    // For weekly: day 0 starts at 06:00
    const hoursFromWeekStart = (hours >= 6 ? hours - 6 : hours + 18) + day * 24;
    const totalMinutes = hoursFromWeekStart * 60 + minutes;
    basePercent = (totalMinutes / (7 * 24 * 60)) * 100;
  } else {
    // For daily: timeline starts at 06:00, so adjust hours
    const hoursFromDayStart = hours >= 6 ? hours - 6 : hours + 18;
    const totalMinutes = hoursFromDayStart * 60 + minutes;
    basePercent = (totalMinutes / (24 * 60)) * 100;
  }
  
  // Check if time is outside zoom range
  if (basePercent < zoomRange.start || basePercent > zoomRange.end) {
    return basePercent < zoomRange.start ? -1 : 101;
  }
  
  // Map to zoomed range (0-100% of visible area)
  const zoomWidth = zoomRange.end - zoomRange.start;
  return ((basePercent - zoomRange.start) / zoomWidth) * 100;
};

const percentageToTime = (percentage, viewMode = 'daily', zoomRange = { start: 0, end: 100 }) => {
  // Map from zoomed percentage (0-100% of visible area) back to full range (0-100% of timeline)
  const zoomWidth = zoomRange.end - zoomRange.start;
  const basePercent = (percentage / 100) * zoomWidth + zoomRange.start;
  
  // Round to nearest minute for precision
  const totalMinutes = (basePercent / 100) * (viewMode === 'weekly' ? 7 * 24 * 60 : 24 * 60);
  
  if (viewMode === 'weekly') {
    const day = Math.floor(totalMinutes / (24 * 60));
    const minutesInDay = totalMinutes % (24 * 60);
    const hoursFromDayStart = Math.floor(minutesInDay / 60);
    const mins = Math.round((minutesInDay % 60) / 15) * 15;
    // Convert back to actual hour (timeline starts at 06:00)
    const actualHour = (hoursFromDayStart + 6) % 24;
    return { day: Math.max(0, Math.min(6, day)), time: `${String(actualHour).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
  } else {
    const hoursFromDayStart = Math.floor(totalMinutes / 60);
    const mins = Math.round((totalMinutes % 60) / 15) * 15;
    // Convert back to actual hour (timeline starts at 06:00)
    const actualHour = (hoursFromDayStart + 6) % 24;
    return { day: 0, time: `${String(actualHour).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
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
  const [manualShiftData, setManualShiftData] = useState({ start_time: '', end_time: '', type: 'available', activity_type: 'shift' });
  const [editingShift, setEditingShift] = useState(null);
  const [populationFilter, setPopulationFilter] = useState("__all__");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const timelineRefs = useRef({});
  const [activityTypes, setActivityTypes] = useState(DEFAULT_ACTIVITY_TYPES);
  const [showActivityTypesDialog, setShowActivityTypesDialog] = useState(false);
  const [editingActivityType, setEditingActivityType] = useState(null);
  const [newActivityType, setNewActivityType] = useState({ label: '', color: '#3b82f6' });
  const [tempActivityTypes, setTempActivityTypes] = useState([]);
  const [selectedActivityType, setSelectedActivityType] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const loadingTimeoutRef = useRef(null);

  useEffect(() => { 
    loadStaticData();
  }, []);

  useEffect(() => { 
    loadDynamicData(); 
  }, [currentDate, viewMode]);

  useEffect(() => { loadActivityTypes(); }, []);

  const loadActivityTypes = async () => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "activity_types" });
    if (settings.length > 0) {
      setActivityTypes(JSON.parse(settings[0].setting_value) || DEFAULT_ACTIVITY_TYPES);
    } else {
      setActivityTypes(DEFAULT_ACTIVITY_TYPES);
    }
  };

  const saveActivityTypes = async (types) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "activity_types" });
    const data = { setting_key: "activity_types", setting_value: JSON.stringify(types) };
    if (settings.length > 0) {
      await base44.entities.AppSettings.update(settings[0].id, data);
    } else {
      await base44.entities.AppSettings.create(data);
    }
    setActivityTypes(types);
  };

  const handleOpenActivityTypesDialog = () => {
    setTempActivityTypes([...activityTypes]);
    setShowActivityTypesDialog(true);
  };

  const handleSaveActivityTypesDialog = async () => {
    await saveActivityTypes(tempActivityTypes);
    setShowActivityTypesDialog(false);
    setNewActivityType({ label: '', color: '#3b82f6' });
  };

  const handleAddActivityType = () => {
    if (!newActivityType.label) return;
    const newId = newActivityType.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const updatedTypes = [...tempActivityTypes, { id: newId, ...newActivityType }];
    setTempActivityTypes(updatedTypes);
    setNewActivityType({ label: '', color: '#3b82f6' });
  };

  const handleUpdateActivityType = (id, updates) => {
    const updatedTypes = tempActivityTypes.map(t => t.id === id ? { ...t, ...updates } : t);
    setTempActivityTypes(updatedTypes);
  };

  const handleDeleteActivityType = (id) => {
    if (confirm('האם למחוק קטגוריה זו?')) {
      const updatedTypes = tempActivityTypes.filter(t => t.id !== id);
      setTempActivityTypes(updatedTypes);
    }
  };

  const loadStaticData = async () => {
    // Load workers and settings only once
    const [workersData, populationsSettings, workerRolesSettings] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" })
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
    
    setWorkers(workersData.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")));
  };

  const loadDynamicData = async () => {
    if (isLoadingData) return;
    setIsLoadingData(true);
    setLoading(true);
    
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    
    const [assignmentsData, availabilitiesData, unavailabilitiesData] = await Promise.all([
      viewMode === "daily" 
        ? base44.entities.Assignment.filter({ date: format(currentDate, "yyyy-MM-dd") })
        : base44.entities.Assignment.list(),
      base44.entities.Availability.list(),
      viewMode === "daily"
        ? base44.entities.Unavailability.filter({ date: format(currentDate, "yyyy-MM-dd") })
        : base44.entities.Unavailability.list()
    ]);
    
    // Filter weekly assignments
    let filteredAssignments = assignmentsData;
    if (viewMode === "weekly") {
      filteredAssignments = assignmentsData.filter(a => {
        const d = a.date;
        return d >= weekStartStr && d <= format(weekEnd, "yyyy-MM-dd");
      });
    }
    
    setAssignments(filteredAssignments);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
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
    return assignments.filter(a => 
      (a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId) &&
      (!date || a.date === targetDate)
    );
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

  const sendNotification = async () => {
    if (!selectedWorkerForNotification) return;
    
    let emailBody = `שלום ${selectedWorkerForNotification.nickname},\n\n`;
    
    if (viewMode === "weekly") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      emailBody += `הנה לוח המשמרות שלך לשבוע של ${format(weekStart, "d.M.yyyy")}:\n\n`;
      
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const dStr = format(d, "yyyy-MM-dd");
        const dayAssignments = getWorkerAssignments(selectedWorkerForNotification.id, dStr);
        const hebrewDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
        emailBody += `${hebrewDays[d.getDay()]}, ${format(d, "d.M")}:\n`;
        if (dayAssignments.length === 0) {
          emailBody += "  אין משמרות\n";
        } else {
          dayAssignments.forEach(a => {
            emailBody += `  ${a.food_cart_name}: ${a.start_time} - ${a.end_time} (${a.hours}h)\n`;
          });
        }
        emailBody += "\n";
      }
    } else {
      const workerAssignments = getWorkerAssignments(selectedWorkerForNotification.id);
      emailBody += `הנה לוח המשמרות שלך ל-${format(currentDate, "d.M.yyyy")}:\n\n`;
      if (workerAssignments.length === 0) {
        emailBody += "אין משמרות מתוכננות ליום זה.\n\n";
      } else {
        workerAssignments.forEach((a, i) => {
          emailBody += `משמרת ${i + 1}: ${a.food_cart_name}\n  זמן: ${a.start_time} - ${a.end_time} (${a.hours}h)\n\n`;
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
    const startPercent = (startX / rect.width) * 100;
    
    console.log('=== MOUSE DOWN ===');
    console.log('Current selectedActivityType:', selectedActivityType);
    console.log('Action:', action);
    
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
      selectedActivityType: selectedActivityType || 'shift',
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
    const currentPercent = Math.max(0, Math.min(100, (currentX / rect.width) * 100));
    
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
    
    const { workerId, worker, shift, action, selectedActivityType: dragActivityType } = dragging;
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
      const activityType = dragActivityType || 'shift';
      console.log('=== CREATING SHIFT ===');
      console.log('Using activity_type from dragging state:', activityType);
      updatedShifts.push({ 
        date: targetDate, 
        start_time: start, 
        end_time: end, 
        type: 'available', 
        activity_type: activityType,
        priority: updatedShifts.length + 1 
      });
      console.log('Created shift object:', JSON.stringify(updatedShifts[updatedShifts.length - 1]));
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
    setManualShiftData({ start_time: '', end_time: '', type: 'available', activity_type: 'shift' });
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
      type: shift.type,
      activity_type: shift.activity_type || 'shift'
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
            type: manualShiftData.type,
            activity_type: manualShiftData.activity_type || 'shift'
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
        activity_type: manualShiftData.activity_type || 'shift',
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
    setManualShiftData({ start_time: '', end_time: '', type: 'available', activity_type: 'shift' });
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
      const activityType = shift.activity_type || 'shift';
      
      // Count only shift, trainer, and other for total
      if (['shift', 'trainer', 'other'].includes(activityType)) {
        totalShifts++;
      }

      // Standby - every 4 hours = 1 standby
      if (activityType.includes('standby') || activityType === 'standby_15' || activityType === 'standby_30_mgmt' || activityType === 'standby_long') {
        standbyHours += hours;
      }

      // Regular shifts
      if (activityType === 'shift') {
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
      }

      // Training - each hour = 1
      if (activityType === 'trainer') {
        trainingHours += hours;
      }

      // Other
      if (activityType === 'other') {
        otherCount++;
      }
    });

    return {
      total: totalShifts,
      standby: Math.round((standbyHours / 4) * 10) / 10,
      regularShift: regularShiftCount,
      training: Math.round(trainingHours * 10) / 10,
      other: otherCount,
      core: Math.round((coreHours / 4) * 10) / 10,
      extreme: Math.round((extremeHours / 4) * 10) / 10
    };
  };

  const AssignmentBar = ({ assignment }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(assignment.date) : 0;
    const startPercent = timeToPercentage(assignment.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(assignment.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : (viewMode === 'daily' ? (100 - startPercent) + endPercent : 0);
    
    // Hide if outside zoom range
    if (startPercent < 0 || startPercent > 100) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full border-l-2 rounded-sm flex items-center px-2 overflow-hidden z-20 ${assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"}`}
              style={{ left: `${startPercent}%`, width: `${width}%` }}
            >
              <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 text-white border-none">
            <p className="font-bold">{assignment.food_cart_name}</p>
            <p>זמן: {assignment.start_time} - {assignment.end_time}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const AvailabilityBar = ({ shift, worker }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shift.date) : 0;
    const startPercent = timeToPercentage(shift.start_time, dayIndex, viewMode, zoomRange);
    const endPercent = timeToPercentage(shift.end_time, dayIndex, viewMode, zoomRange);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;
    
    // Hide if outside zoom range
    if (startPercent < 0 || startPercent > 100) return null;

    // Get activity type color and label
    const activityTypeId = shift.activity_type || 'shift';
    const activityType = activityTypes.find(t => t.id === activityTypeId);
    const activityColor = activityType ? activityType.color : '#8B4513';
    const activityLabel = activityType ? activityType.label : 'משמרת';
    
    const icons = { wanted: <Star className="w-3 h-3 fill-current" />, available: <Check className="w-3 h-3" />, unavailable: <Ban className="w-3 h-3" /> };
    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };

    return (
      <div
        className="absolute h-full border-l-2 rounded-sm flex flex-col items-center justify-center px-1 z-10 cursor-move"
        style={{ 
          left: `${startPercent}%`, 
          width: `${width}%`,
          backgroundColor: activityColor,
          borderColor: activityColor,
          opacity: 0.9
        }}
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'move', dayIndex); }}
        onDoubleClick={(e) => handleShiftDoubleClick(e, worker, shift)}
      >
        <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-start', dayIndex); }} />
        
        {/* Type indicator - clickable circle */}
        <button
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[8px] font-bold z-30 hover:scale-110 transition-transform"
          style={{ borderColor: shift.type === 'wanted' ? '#16a34a' : shift.type === 'unavailable' ? '#dc2626' : '#3b82f6' }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTypeClick(e, worker, shift); }}
        >
          {typeLabels[shift.type] || "A"}
        </button>
        
        <div className="flex flex-col items-center gap-0 text-gray-800 text-[10px] font-medium truncate pointer-events-none w-full px-1 mt-2">
          <div className="font-bold text-[9px] truncate w-full text-center">{activityLabel}</div>
          <div className="flex items-center gap-1">
            {icons[shift.type]}
            <span className="text-[9px]">{shift.start_time}-{shift.end_time}</span>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-end', dayIndex); }} />
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

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${unavail.reason === 'overseas' ? 'bg-red-200 border-l-2 border-red-500' : 'bg-gray-300 border-l-2 border-gray-500'}`} style={{ left: `${startPercent}%`, width: `${width}%` }}>
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

    return (
      <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80" style={{ left: `${startPercent}%`, width: `${width}%` }}>
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
                  <Badge className="bg-blue-100 text-blue-800" dir="rtl"><Check className="w-3 h-3 mr-1" />זמין</Badge>
                  <Badge className="bg-red-100 text-red-800" dir="rtl"><Ban className="w-3 h-3 mr-1" />לא זמין</Badge>
                  <Badge className="bg-blue-400 text-white" dir="rtl">שיבוץ</Badge>
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
                  <div className="flex-1 relative flex" dir="ltr">
                    {viewMode === 'daily' ? (
                      getDailyTimeSlots(zoomRange).map((hour) => (
                        <div key={hour} className="flex-1 text-xs text-gray-600 py-3 border-r text-center font-medium">{String(hour).padStart(2, '0')}:00</div>
                      ))
                    ) : (
                      getWeeklyTimeSlots(zoomRange, startOfWeek(currentDate, { weekStartsOn: 0 })).map((slot, idx) => (
                        <div key={idx} className="flex-1 text-xs text-gray-600 py-3 border-r text-center font-medium">
                          {slot.label && <div className="font-bold">{slot.label}</div>}
                          {slot.dateLabel && <div className="text-[9px] text-gray-500">{slot.dateLabel}</div>}
                          {slot.hour === 6 && <div className="text-[10px]">{String(slot.hour).padStart(2, '0')}:00</div>}
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
                    const workerUnavailabilities = getWorkerUnavailabilityForDate(worker.id);
                    const summary = viewMode === 'weekly' ? calculateWorkerSummary(worker.id) : null;
                    
                    console.log(`Row ${index}: ${worker.nickname} (${worker.id}) - Assignments:`, workerAssignments.length, 'Availability:', availabilityShifts.length);
                    
                    return (
                      <React.Fragment key={worker.id}>
                      <div className={`flex border-b h-16 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <div className="w-[300px] min-w-[300px] p-3 font-medium text-gray-800 border-r flex items-center justify-between sticky left-0 bg-inherit z-40 h-16">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${worker.role === 'chef' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-700'}`}>
                              <ChefHat className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="truncate block">{worker.nickname}</span>
                              <WeeklySummary worker={worker} />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleManualShiftAdd(worker)} title="הוסף חלון זמינות ידנית"><Plus className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSendNotification(worker)}><Send className="w-3 h-3" /></Button>
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
                          dir="ltr"
                          onMouseDown={(e) => {
                            handleMouseDown(e, worker, null, 'create');
                          }}
                        >
                          <div className="absolute inset-0 flex h-16">
                            {viewMode === 'daily' ? (
                              getDailyTimeSlots(zoomRange).map(hour => (<div key={hour} className="flex-1 border-r time-slot h-16"></div>))
                            ) : (
                              getWeeklyTimeSlots(zoomRange).map((slot, idx) => (<div key={idx} className="flex-1 border-r time-slot h-16"></div>))
                            )}
                          </div>
                          <div className="absolute inset-0">
                            {availabilityShifts.map((shift, idx) => (<AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />))}
                            {workerUnavailabilities.map(unavail => (<UnavailabilityBar key={unavail.id} unavail={unavail} />))}
                            {workerAssignments.length > 0 && console.log(`Rendering ${workerAssignments.length} assignments for ${worker.nickname}:`, workerAssignments.map(a => `${a.chef_id || a.sous_chef_id || a.additional_chef_id}`).join(', '))}
                            {workerAssignments.map(ass => {
                              const actualChefId = ass.chef_id || ass.sous_chef_id || ass.additional_chef_id;
                              if (actualChefId !== worker.id) console.warn(`MISMATCH: Assignment for ${actualChefId} rendering in ${worker.nickname}'s row!`);
                              return <AssignmentBar key={ass.id} assignment={ass} />;
                            })}
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
                           <span><strong>כוננות:</strong> {summary.standby}</span>
                           <span><strong>משמרת:</strong> {summary.regularShift}</span>
                           <span><strong>אימון:</strong> {summary.training}</span>
                           <span><strong>אחר:</strong> {summary.other}</span>
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
              <div>
                <Label className="text-center block mb-2" dir="rtl">סוג פעילות</Label>
                <Select value={manualShiftData.activity_type} onValueChange={(value) => setManualShiftData({ ...manualShiftData, activity_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג פעילות..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: type.color }} />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      setManualShiftData({ start_time: '', end_time: '', type: 'available', activity_type: 'shift' });
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
                  setManualShiftData({ start_time: '', end_time: '', type: 'available', activity_type: 'shift' });
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

        {/* Activity Types Management Dialog */}
        <Dialog open={showActivityTypesDialog} onOpenChange={setShowActivityTypesDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle dir="rtl">ניהול קטגוריות פעילות</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 space-y-3">
                <Label className="font-semibold" dir="rtl">קטגוריות קיימות</Label>
                {tempActivityTypes.map(type => (
                  <div key={type.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <Input
                      type="color"
                      value={type.color}
                      onChange={(e) => handleUpdateActivityType(type.id, { color: e.target.value })}
                      className="w-16 h-10"
                    />
                    <Input
                      value={type.label}
                      onChange={(e) => handleUpdateActivityType(type.id, { label: e.target.value })}
                      className="flex-1"
                      dir="rtl"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteActivityType(type.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <Label className="font-semibold" dir="rtl">הוסף קטגוריה חדשה</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={newActivityType.color}
                    onChange={(e) => setNewActivityType({ ...newActivityType, color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={newActivityType.label}
                    onChange={(e) => setNewActivityType({ ...newActivityType, label: e.target.value })}
                    placeholder="שם הקטגוריה..."
                    className="flex-1"
                    dir="rtl"
                  />
                  <Button onClick={handleAddActivityType} disabled={!newActivityType.label} dir="rtl">
                    <Plus className="w-4 h-4 ml-1" />
                    הוסף
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivityTypesDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveActivityTypesDialog} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activity Types Legend - Below Matrix */}
        <Card className="border-none shadow-lg mt-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <CardTitle className="text-xl" dir="rtl">מקרא סוגי פעילות</CardTitle>
              <Button variant="outline" size="sm" onClick={handleOpenActivityTypesDialog} dir="rtl">
                ערוך קטגוריות
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-2" dir="rtl">לחץ על קטגוריה כדי לבחור אותה לצביעה על המטריצה</p>
            {selectedActivityType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2 text-center" dir="rtl">
                <span className="font-semibold">נבחר: </span>
                <span style={{ color: activityTypes.find(t => t.id === selectedActivityType)?.color }}>
                  {activityTypes.find(t => t.id === selectedActivityType)?.label}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {activityTypes.map(type => {
                const isSelected = selectedActivityType === type.id;
                return (
                  <button
                    key={type.id} 
                    type="button"
                    onClick={() => {
                      const newValue = isSelected ? null : type.id;
                      console.log('=== ACTIVITY TYPE CLICK ===');
                      console.log('Current selectedActivityType:', selectedActivityType);
                      console.log('Clicked type.id:', type.id);
                      console.log('New value will be:', newValue);
                      setSelectedActivityType(newValue);
                      console.log('State updated to:', newValue);
                    }}
                    style={{ backgroundColor: type.color }} 
                    className={`text-sm font-medium text-gray-900 py-2 px-4 rounded-lg text-center transition-all hover:opacity-90 cursor-pointer ${
                      isSelected
                        ? 'ring-4 ring-blue-500 ring-offset-2 shadow-lg' 
                        : ''
                    }`}
                    dir="rtl"
                  >
                    {type.label} {isSelected && '✓ נבחר'}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
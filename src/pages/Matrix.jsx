import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ChefHat, Send, Star, Check, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const timeSlots = Array.from({ length: 24 }, (_, i) => i);

const timeToPercentage = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
};

const percentageToTime = (percentage) => {
  const totalMinutes = Math.round((percentage / 100) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round((totalMinutes % 60) / 15) * 15;
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export default function Matrix() {
  const [currentDate, setCurrentDate] = useState(new Date());
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
  const timelineRefs = useRef({});

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
    
    const [workersData, assignmentsData, availabilitiesData, unavailabilitiesData] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.Assignment.filter({ date: dateString }),
      base44.entities.Availability.list(),
      base44.entities.Unavailability.filter({ date: dateString })
    ]);
    
    setWorkers(workersData);
    setAssignments(assignmentsData);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    setLoading(false);
  };

  const getWorkerAssignments = (workerId) => {
    return assignments.filter(a => a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId);
  };

  const getWorkerAvailabilityForDate = (workerId) => {
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
    const workerAvail = availabilities.find(a => 
      a.worker_id === workerId && 
      a.week_start_date === weekStartDate &&
      (a.status === "approved" || a.status === "submitted")
    );
    
    if (!workerAvail || !workerAvail.shifts) return [];
    return workerAvail.shifts.filter(s => s.date === dateString);
  };

  const getWorkerUnavailabilityForDate = (workerId) => {
    return unavailabilities.filter(u => u.worker_id === workerId);
  };

  const handleSendNotification = (worker) => {
    setSelectedWorkerForNotification(worker);
    setNotificationNotes("");
    setShowNotificationDialog(true);
  };

  const sendNotification = async () => {
    if (!selectedWorkerForNotification) return;
    
    const workerAssignments = getWorkerAssignments(selectedWorkerForNotification.id);
    const dateString = format(currentDate, "MMMM d, yyyy");
    
    let emailBody = `Hi ${selectedWorkerForNotification.full_name},\n\nHere is your shift schedule for ${dateString}:\n\n`;
    
    if (workerAssignments.length === 0) {
      emailBody += "No shifts scheduled for this day.\n\n";
    } else {
      workerAssignments.forEach((assignment, index) => {
        emailBody += `Shift ${index + 1}:\n`;
        emailBody += `  Location: ${assignment.food_cart_name}\n`;
        emailBody += `  Time: ${assignment.start_time} - ${assignment.end_time} (${assignment.hours}h)\n`;
        emailBody += "\n";
      });
    }
    
    if (notificationNotes.trim()) {
      emailBody += `Notes from management:\n${notificationNotes}\n\n`;
    }
    
    emailBody += "Best regards,\nManagement";
    
    if (selectedWorkerForNotification.email) {
      await base44.integrations.Core.SendEmail({
        to: selectedWorkerForNotification.email,
        subject: `Your Shift Schedule - ${dateString}`,
        body: emailBody
      });
    }
    
    setShowNotificationDialog(false);
    setSelectedWorkerForNotification(null);
    setNotificationNotes("");
  };

  const handleMouseDown = (e, worker, shift, action) => {
    e.preventDefault();
    const timeline = timelineRefs.current[worker.id];
    if (!timeline) return;
    
    const rect = timeline.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startPercent = (startX / rect.width) * 100;
    
    setDragging({
      worker,
      shift,
      action,
      startPercent,
      originalStart: shift?.start_time,
      originalEnd: shift?.end_time,
      rect
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const { worker, shift, action, startPercent, originalStart, originalEnd, rect } = dragging;
    const currentX = e.clientX - rect.left;
    const currentPercent = Math.max(0, Math.min(100, (currentX / rect.width) * 100));
    
    let newStart = originalStart;
    let newEnd = originalEnd;
    
    if (action === 'create') {
      const minP = Math.min(startPercent, currentPercent);
      const maxP = Math.max(startPercent, currentPercent);
      newStart = percentageToTime(minP);
      newEnd = percentageToTime(maxP);
    } else if (action === 'resize-start') {
      newStart = percentageToTime(currentPercent);
    } else if (action === 'resize-end') {
      newEnd = percentageToTime(currentPercent);
    } else if (action === 'move') {
      const origStartP = timeToPercentage(originalStart);
      const origEndP = timeToPercentage(originalEnd);
      const width = origEndP - origStartP;
      const diff = currentPercent - startPercent;
      const newStartP = Math.max(0, Math.min(100 - width, origStartP + diff));
      newStart = percentageToTime(newStartP);
      newEnd = percentageToTime(newStartP + width);
    }
    
    setDragPreview({ worker, start: newStart, end: newEnd, type: shift?.type || 'available' });
  };

  const handleMouseUp = async () => {
    if (!dragging || !dragPreview) {
      setDragging(null);
      setDragPreview(null);
      return;
    }
    
    const { worker, shift, action } = dragging;
    const { start, end } = dragPreview;
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStartDate = format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
    
    if (start === end) {
      setDragging(null);
      setDragPreview(null);
      return;
    }
    
    const workerAvail = availabilities.find(a => a.worker_id === worker.id && a.week_start_date === weekStartDate);
    let updatedShifts = workerAvail?.shifts ? [...workerAvail.shifts] : [];
    
    if (action === 'create') {
      updatedShifts.push({ date: dateString, start_time: start, end_time: end, type: 'available', priority: updatedShifts.length + 1 });
    } else {
      updatedShifts = updatedShifts.map(s => {
        if (s.date === dateString && s.start_time === shift.start_time && s.end_time === shift.end_time) {
          return { ...s, start_time: start, end_time: end };
        }
        return s;
      });
    }
    
    const availData = {
      worker_id: worker.id,
      worker_name: worker.full_name,
      week_start_date: weekStartDate,
      shifts: updatedShifts,
      status: workerAvail?.status || "approved"
    };
    
    if (workerAvail) {
      await base44.entities.Availability.update(workerAvail.id, availData);
    } else {
      await base44.entities.Availability.create(availData);
    }
    
    // Notify worker of change
    if (worker.email && action !== 'create') {
      await base44.integrations.Core.SendEmail({
        to: worker.email,
        subject: `Availability Updated - ${format(currentDate, "MMM d, yyyy")}`,
        body: `Hi ${worker.full_name},\n\nYour availability for ${format(currentDate, "MMMM d, yyyy")} has been updated:\n\nNew time: ${start} - ${end}\n\nBest regards,\nManagement`
      });
    }
    
    setDragging(null);
    setDragPreview(null);
    loadData();
  };

  const AssignmentBar = ({ assignment }) => {
    const startPercent = timeToPercentage(assignment.start_time);
    const endPercent = timeToPercentage(assignment.end_time);
    const width = endPercent > startPercent ? endPercent - startPercent : (100 - startPercent) + endPercent;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full border-l-2 rounded-sm flex items-center px-2 overflow-hidden z-30 ${
                assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"
              }`}
              style={{ left: `${startPercent}%`, width: `${width}%` }}
            >
              <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 text-white border-none">
            <p className="font-bold">{assignment.food_cart_name}</p>
            <p>Time: {assignment.start_time} - {assignment.end_time}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const AvailabilityBar = ({ shift, worker }) => {
    const startPercent = timeToPercentage(shift.start_time);
    const endPercent = timeToPercentage(shift.end_time);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;

    const colors = {
      wanted: "bg-green-400 border-green-600",
      available: "bg-blue-300 border-blue-500",
      unavailable: "bg-red-300 border-red-500"
    };

    const icons = {
      wanted: <Star className="w-3 h-3 fill-current" />,
      available: <Check className="w-3 h-3" />,
      unavailable: <Ban className="w-3 h-3" />
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full border-l-2 rounded-sm flex items-center justify-between px-1 z-10 cursor-move ${colors[shift.type] || colors.available}`}
              style={{ left: `${startPercent}%`, width: `${width}%` }}
              onMouseDown={(e) => handleMouseDown(e, worker, shift, 'move')}
            >
              <div
                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20"
                onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-start'); }}
              />
              <div className="flex items-center gap-1 text-gray-800 text-[10px] font-medium mx-2 truncate">
                {icons[shift.type]}
                <span>{shift.start_time}-{shift.end_time}</span>
              </div>
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-black/20"
                onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, worker, shift, 'resize-end'); }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 text-white border-none">
            <p className="font-bold capitalize">{shift.type}</p>
            <p>{shift.start_time} - {shift.end_time}</p>
            {shift.priority && <p>Priority: {shift.priority}</p>}
            {shift.notes && <p>Notes: {shift.notes}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const UnavailabilityBar = ({ unavail }) => {
    const startPercent = timeToPercentage(unavail.start_time);
    const endPercent = timeToPercentage(unavail.end_time);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full rounded-sm flex items-center justify-center z-20 ${
                unavail.reason === 'overseas' ? 'bg-red-200 border-l-2 border-red-500' : 'bg-gray-300 border-l-2 border-gray-500'
              }`}
              style={{ left: `${startPercent}%`, width: `${width}%` }}
            >
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

  const DragPreviewBar = ({ preview }) => {
    if (!preview) return null;
    const startPercent = timeToPercentage(preview.start);
    const endPercent = timeToPercentage(preview.end);
    const width = endPercent > startPercent ? endPercent - startPercent : 0;

    return (
      <div
        className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-50 opacity-80"
        style={{ left: `${startPercent}%`, width: `${width}%` }}
      >
        <span className="text-xs font-bold">{preview.start} - {preview.end}</span>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Daily Hours Matrix</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Drag edges to resize, drag middle to move, click empty to add</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge className="bg-green-100 text-green-800"><Star className="w-3 h-3 mr-1 fill-current" />Wanted</Badge>
                  <Badge className="bg-blue-100 text-blue-800"><Check className="w-3 h-3 mr-1" />Available</Badge>
                  <Badge className="bg-red-100 text-red-800"><Ban className="w-3 h-3 mr-1" />Unavailable</Badge>
                  <Badge className="bg-blue-400 text-white">Assignment</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center">{format(currentDate, "MMM d, yyyy")}</div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[1400px]">
                <div className="grid grid-cols-[250px_1fr] sticky top-0 bg-gray-100 z-40 border-b">
                  <div className="p-3 font-semibold text-gray-700 border-r">Worker</div>
                  <div className="relative flex h-full">
                    {timeSlots.map((hour) => (
                      <div key={hour} className="flex-1 text-xs text-gray-600 py-3 border-r text-center font-medium">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="text-center p-8">Loading...</div>
                ) : workers.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">No active workers found.</div>
                ) : (
                  workers.map((worker, index) => {
                    const availabilityShifts = getWorkerAvailabilityForDate(worker.id);
                    const workerAssignments = getWorkerAssignments(worker.id);
                    const workerUnavailabilities = getWorkerUnavailabilityForDate(worker.id);
                    const isCurrentWorkerDragging = dragPreview?.worker?.id === worker.id;
                    
                    return (
                      <div key={worker.id} className={`grid grid-cols-[250px_1fr] border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <div className="p-3 font-medium text-gray-800 border-r flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${worker.role === 'chef' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-700'}`}>
                              <ChefHat className="w-4 h-4" />
                            </div>
                            <span className="truncate">{worker.full_name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSendNotification(worker)}>
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                        <div 
                          ref={el => timelineRefs.current[worker.id] = el}
                          className="relative border-r cursor-crosshair"
                          onMouseDown={(e) => {
                            if (e.target === e.currentTarget || e.target.classList.contains('time-slot')) {
                              handleMouseDown(e, worker, null, 'create');
                            }
                          }}
                        >
                          <div className="flex h-16">
                            {timeSlots.map(hour => (
                              <div key={hour} className="flex-1 border-r time-slot"></div>
                            ))}
                          </div>
                          {availabilityShifts.map((shift, idx) => (
                            <AvailabilityBar key={`avail-${idx}`} shift={shift} worker={worker} />
                          ))}
                          {workerUnavailabilities.map(unavail => (
                            <UnavailabilityBar key={unavail.id} unavail={unavail} />
                          ))}
                          {workerAssignments.map(ass => (
                            <AssignmentBar key={ass.id} assignment={ass} />
                          ))}
                          {isCurrentWorkerDragging && <DragPreviewBar preview={dragPreview} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Send Schedule - {selectedWorkerForNotification?.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">Shifts for {format(currentDate, "MMM d, yyyy")}:</p>
                {selectedWorkerForNotification && getWorkerAssignments(selectedWorkerForNotification.id).length > 0 ? (
                  getWorkerAssignments(selectedWorkerForNotification.id).map((a, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded border mb-1">
                      <p className="font-semibold">{a.food_cart_name}</p>
                      <p>{a.start_time} - {a.end_time} ({a.hours}h)</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No shifts scheduled</p>
                )}
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea value={notificationNotes} onChange={(e) => setNotificationNotes(e.target.value)} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
              <Button onClick={sendNotification} className="bg-blue-900 hover:bg-blue-800" disabled={!selectedWorkerForNotification?.email}>
                <Send className="w-4 h-4 mr-2" />Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
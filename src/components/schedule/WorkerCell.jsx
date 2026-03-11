import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, AlertTriangle, Star, Check, X } from "lucide-react";

export default function WorkerCell({ 
  rowId, 
  columnName, 
  currentValue, 
  currentRowValues,
  workers,
  workerRoles,
  roleFilter,
  availabilities,
  unavailabilities,
  dateString,
  rowStartTime,
  rowEndTime,
  onSaved
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedWorker = currentValue ? workers.find(w => w.id === currentValue) : null;

  const isWorkerUnavailable = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return false;
    return unavailabilities.filter(u => u.worker_id === workerId).some(u =>
      (startTime >= u.start_time && startTime < u.end_time) ||
      (endTime > u.start_time && endTime <= u.end_time) ||
      (startTime <= u.start_time && endTime >= u.end_time)
    );
  };

  const getWorkerAvailabilityPriority = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return null;
    const workerAvail = availabilities.find(a =>
      a.worker_id === workerId && (a.status === "approved" || a.status === "submitted")
    );
    if (!workerAvail?.shifts) return null;
    const exactShift = workerAvail.shifts.find(s =>
      s.date === dateString && s.type !== "unavailable" &&
      startTime >= s.start_time && endTime <= s.end_time
    );
    if (exactShift) return { priority: exactShift.priority, type: exactShift.type };
    const overlapShift = workerAvail.shifts.find(s =>
      s.date === dateString && s.type !== "unavailable" &&
      startTime < s.end_time && endTime > s.start_time
    );
    return overlapShift ? { priority: overlapShift.priority, type: overlapShift.type } : null;
  };

  const getSeniorityColor = (seniority) => {
    if (seniority === "newbie") return "text-blue-600";
    if (seniority === "trainee") return "text-orange-600";
    return "text-gray-900";
  };

  const handleWorkerSelect = async (workerId) => {
    const updatedValues = { ...(currentRowValues || {}), [columnName]: workerId };
    await base44.entities.TemplateRow.update(rowId, { values: updatedValues });
    setOpen(false);
    if (onSaved) onSaved(workerId);
  };

  const handleRemoveWorker = async () => {
    const updatedValues = { ...(currentRowValues || {}), [columnName]: null };
    await base44.entities.TemplateRow.update(rowId, { values: updatedValues });
    setOpen(false);
    if (onSaved) onSaved(null);
  };

  const filteredWorkers = workers
    .filter(w => w.active)
    .filter(w => {
      const matchesSearch = !searchQuery ||
        w.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.role?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !roleFilter || roleFilter === "__all__" || w.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (!rowStartTime || !rowEndTime) return 0;
      const aAvail = getWorkerAvailabilityPriority(a.id, rowStartTime, rowEndTime);
      const bAvail = getWorkerAvailabilityPriority(b.id, rowStartTime, rowEndTime);
      const aUnavail = isWorkerUnavailable(a.id, rowStartTime, rowEndTime);
      const bUnavail = isWorkerUnavailable(b.id, rowStartTime, rowEndTime);
      if (aUnavail && !bUnavail) return 1;
      if (!aUnavail && bUnavail) return -1;
      if (aAvail?.type === 'wanted' && bAvail?.type !== 'wanted') return -1;
      if (aAvail?.type !== 'wanted' && bAvail?.type === 'wanted') return 1;
      if (aAvail?.type === 'available' && !bAvail?.type) return -1;
      if (!aAvail?.type && bAvail?.type === 'available') return 1;
      if (aAvail?.priority && bAvail?.priority) return aAvail.priority - bAvail.priority;
      return 0;
    });

  const isCurrentUnavailable = selectedWorker && rowStartTime && rowEndTime &&
    isWorkerUnavailable(selectedWorker.id, rowStartTime, rowEndTime);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearchQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full text-center p-2 hover:bg-blue-50 transition-colors ${
            isCurrentUnavailable ? "bg-red-50" : ""
          }`}
          dir="rtl"
        >
          {selectedWorker ? (
            <div className="flex items-center gap-1 justify-center">
              <span className={`text-xs font-medium truncate ${getSeniorityColor(selectedWorker.seniority)}`}>
                {selectedWorker.nickname}
              </span>
              {isCurrentUnavailable && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
            </div>
          ) : (
            <span className="text-xs text-gray-400">+ בחר עובד</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2 z-50" align="start" dir="rtl">
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <Input
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pr-7"
            dir="rtl"
            autoFocus
          />
        </div>

        {/* Worker list */}
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {/* Remove option if worker selected */}
          {selectedWorker && (
            <button
              onClick={handleRemoveWorker}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-red-600 hover:bg-red-50"
              dir="rtl"
            >
              <X className="w-3 h-3" />
              הסר עובד
            </button>
          )}

          {filteredWorkers.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">לא נמצאו עובדים</div>
          ) : (
            filteredWorkers.map((worker) => {
              const availInfo = rowStartTime && rowEndTime
                ? getWorkerAvailabilityPriority(worker.id, rowStartTime, rowEndTime)
                : null;
              const isUnavailable = rowStartTime && rowEndTime
                ? isWorkerUnavailable(worker.id, rowStartTime, rowEndTime)
                : false;
              const isSelected = worker.id === currentValue;

              return (
                <button
                  key={worker.id}
                  onClick={() => handleWorkerSelect(worker.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-100 text-blue-800"
                      : isUnavailable
                      ? "bg-red-50 hover:bg-red-100"
                      : availInfo?.type === "wanted"
                      ? "bg-green-50 hover:bg-green-100"
                      : "hover:bg-gray-100"
                  }`}
                  dir="rtl"
                >
                  {/* Availability indicator */}
                  <span className="flex-shrink-0">
                    {isUnavailable
                      ? <AlertTriangle className="w-3 h-3 text-red-500" />
                      : availInfo?.type === "wanted"
                      ? <Star className="w-3 h-3 text-green-600 fill-green-600" />
                      : availInfo?.type === "available"
                      ? <Check className="w-3 h-3 text-blue-500" />
                      : <span className="w-3 h-3 inline-block" />
                    }
                  </span>

                  {/* Name */}
                  <span className={`flex-1 text-right font-medium ${getSeniorityColor(worker.seniority)}`}>
                    {worker.nickname}
                  </span>

                  {/* Role badge */}
                  {worker.role && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                      {worker.role}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
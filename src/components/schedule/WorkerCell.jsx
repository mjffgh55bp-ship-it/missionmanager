import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, Star, Check } from "lucide-react";

export default function WorkerCell({ 
  rowId, 
  columnName, 
  currentValue, 
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
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Find the selected worker
  const selectedWorker = currentValue ? workers.find(w => w.id === currentValue) : null;

  const isWorkerUnavailable = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return false;
    const workerUnavail = unavailabilities.filter(u => u.worker_id === workerId);
    return workerUnavail.some(u => {
      return (startTime >= u.start_time && startTime < u.end_time) ||
             (endTime > u.start_time && endTime <= u.end_time) ||
             (startTime <= u.start_time && endTime >= u.end_time);
    });
  };

  const getWorkerAvailabilityPriority = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return null;
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.status === "approved");
    if (!workerAvail || !workerAvail.shifts) return null;
    const shift = workerAvail.shifts.find(s => 
      s.date === dateString && 
      s.type !== "unavailable" && 
      startTime >= s.start_time && 
      endTime <= s.end_time
    );
    return shift ? { priority: shift.priority, type: shift.type } : null;
  };

  const getSeniorityColor = (seniority) => {
    if (seniority === "newbie") return "text-blue-600";
    if (seniority === "trainee") return "text-orange-600";
    return "text-gray-900";
  };

  const handleOpen = () => {
    setSearchQuery("");
    setShowDialog(true);
  };

  const handleWorkerSelect = async (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    const newValues = { [columnName]: workerId };
    await base44.entities.TemplateRow.update(rowId, {
      values: newValues
    });

    setShowDialog(false);
    if (onSaved) onSaved(workerId);
  };

  const handleRemoveWorker = async () => {
    await base44.entities.TemplateRow.update(rowId, {
      values: { [columnName]: null }
    });

    setShowDialog(false);
    if (onSaved) onSaved(null);
  };

  // Filter and sort workers - if roleFilter is set, show ONLY workers with that exact role
  const filteredWorkers = workers
    .filter(w => w.active)
    .filter(w => {
      const matchesSearch = !searchQuery || 
        w.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.role?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !roleFilter || w.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (!rowStartTime || !rowEndTime) return 0;

      const aAvail = getWorkerAvailabilityPriority(a.id, rowStartTime, rowEndTime);
      const bAvail = getWorkerAvailabilityPriority(b.id, rowStartTime, rowEndTime);
      
      const aUnavailable = isWorkerUnavailable(a.id, rowStartTime, rowEndTime);
      const bUnavailable = isWorkerUnavailable(b.id, rowStartTime, rowEndTime);
      if (aUnavailable && !bUnavailable) return 1;
      if (!aUnavailable && bUnavailable) return -1;
      
      const aType = aAvail?.type;
      const bType = bAvail?.type;
      if (aType === 'wanted' && bType !== 'wanted') return -1;
      if (aType !== 'wanted' && bType === 'wanted') return 1;
      if (aType === 'available' && !bType) return -1;
      if (!aType && bType === 'available') return 1;
      
      if (aAvail?.priority && bAvail?.priority) {
        return aAvail.priority - bAvail.priority;
      }
      
      return 0;
    });

  return (
    <>
      <button
        onClick={handleOpen}
        className={`w-full h-full text-right p-2 hover:bg-blue-50 transition-colors ${
          selectedWorker && rowStartTime && rowEndTime && isWorkerUnavailable(selectedWorker.id, rowStartTime, rowEndTime)
            ? "bg-red-50 border-red-300"
            : "border-transparent"
        }`}
        dir="rtl"
      >
        {selectedWorker ? (
          <div className="flex items-center gap-2 justify-end">
            <span className={`text-xs font-medium truncate ${getSeniorityColor(selectedWorker.seniority)}`}>
              {selectedWorker.nickname}
            </span>
            {rowStartTime && rowEndTime && isWorkerUnavailable(selectedWorker.id, rowStartTime, rowEndTime) && (
              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">+ בחר עובד</span>
        )}
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle dir="rtl">בחר עובד - {columnName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="חיפוש..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  dir="rtl"
                />
              </div>
              {roleFilter && (
                <div className="flex items-center px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700" dir="rtl">
                  תפקיד: {roleFilter}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredWorkers.length === 0 ? (
                <div className="text-center text-gray-500 py-8" dir="rtl">
                  לא נמצאו עובדים
                </div>
              ) : (
                filteredWorkers.map((worker) => {
                  const availInfo = rowStartTime && rowEndTime 
                    ? getWorkerAvailabilityPriority(worker.id, rowStartTime, rowEndTime)
                    : null;
                  const isUnavailable = rowStartTime && rowEndTime 
                    ? isWorkerUnavailable(worker.id, rowStartTime, rowEndTime)
                    : false;
                  
                  return (
                    <button
                      key={worker.id}
                      onClick={() => handleWorkerSelect(worker.id)}
                      className={`w-full p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-left ${
                        isUnavailable 
                          ? "border-red-300 bg-red-50" 
                          : availInfo?.type === 'wanted' 
                          ? "border-green-300 bg-green-50" 
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isUnavailable && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {availInfo?.type === "wanted" && <Star className="w-4 h-4 text-green-600 fill-green-600" />}
                        {availInfo?.type === "available" && <Check className="w-4 h-4 text-blue-600" />}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{worker.nickname}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {worker.role && (
                              <Badge variant="outline" className="text-xs" dir="rtl">
                                {worker.role}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs" dir="rtl">
                              {worker.seniority === 'trainee' ? 'מתלמד' : worker.seniority === 'newbie' ? 'מתחיל' : worker.seniority === 'experienced_chef' ? 'מנוסה' : worker.seniority}
                            </Badge>
                            {worker.is_guide && (
                              <Badge className="text-xs bg-yellow-100 text-yellow-800" dir="rtl">
                                מדריך
                              </Badge>
                            )}
                            {availInfo && (
                              <Badge variant="outline" className="text-xs" dir="rtl">
                                {availInfo.type === 'wanted' ? 'רצוי' : 'זמין'} #{availInfo.priority}
                              </Badge>
                            )}
                            {isUnavailable && (
                              <Badge className="text-xs bg-red-100 text-red-800" dir="rtl">
                                לא זמין
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            {selectedWorker && (
              <Button variant="destructive" onClick={handleRemoveWorker} dir="rtl">
                הסר עובד
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDialog(false)} dir="rtl">
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
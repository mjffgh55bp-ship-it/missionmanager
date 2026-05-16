import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Star, Check, X } from "lucide-react";

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
  taskQualifiedWorkerIds,
  onSaved
}) {
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const selectedWorker = currentValue ? workers.find((w) => w.id === currentValue) : null;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setEditing(false);
        setSearchQuery("");
      }
    };
    if (editing) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editing]);

  const isWorkerUnavailable = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return false;
    return unavailabilities.filter((u) => u.worker_id === workerId).some((u) =>
      startTime >= u.start_time && startTime < u.end_time ||
      endTime > u.start_time && endTime <= u.end_time ||
      startTime <= u.start_time && endTime >= u.end_time
    );
  };

  const getWorkerAvailabilityPriority = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return null;
    const workerAvail = availabilities.find((a) =>
      a.worker_id === workerId && (a.status === "approved" || a.status === "submitted")
    );
    if (!workerAvail?.shifts) return null;
    const exactShift = workerAvail.shifts.find((s) =>
      s.date === dateString && s.type !== "unavailable" &&
      startTime >= s.start_time && endTime <= s.end_time
    );
    if (exactShift) return { priority: exactShift.priority, type: exactShift.type };
    const overlapShift = workerAvail.shifts.find((s) =>
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

  const broadcastRowUpdate = (rowId, date, updatedValues) => {
    const payload = { type: "templateRowsUpdated", rowId, date, updatedValues, timestamp: Date.now() };
    // Same-tab: immediate patch + fast refetch
    window.dispatchEvent(new CustomEvent("templateRowsUpdated", { detail: payload }));
    // Cross-tab: BroadcastChannel
    try {
      const bc = new BroadcastChannel("schedule-sync");
      bc.postMessage(payload);
      bc.close();
    } catch {}
    // Cross-tab: localStorage fallback
    try {
      localStorage.setItem("schedule-sync-event", JSON.stringify(payload));
    } catch {}
    console.log("SCHEDULE MATRIX SYNC", { source: "WorkerCell", rowId, date, patchedLocalState: true });
  };

  const handleWorkerSelect = async (workerId) => {
    const updatedValues = { ...(currentRowValues || {}), [columnName]: workerId };
    await base44.entities.TemplateRow.update(rowId, { values: updatedValues });
    setEditing(false);
    setSearchQuery("");
    if (onSaved) onSaved(workerId);
    broadcastRowUpdate(rowId, dateString, updatedValues);
  };

  const handleRemoveWorker = async () => {
    const updatedValues = { ...(currentRowValues || {}), [columnName]: null };
    await base44.entities.TemplateRow.update(rowId, { values: updatedValues });
    setEditing(false);
    setSearchQuery("");
    if (onSaved) onSaved(null);
    broadcastRowUpdate(rowId, dateString, updatedValues);
  };

  const isWorkerQualified = (workerId) => {
    if (!taskQualifiedWorkerIds) return true;
    return taskQualifiedWorkerIds.includes(workerId);
  };

  const getWorkerCategory = (workerId) => {
    if (!rowStartTime || !rowEndTime) return 'no-info';
    const isUnavail = isWorkerUnavailable(workerId, rowStartTime, rowEndTime);
    if (isUnavail) return 'unavailable';
    const availInfo = getWorkerAvailabilityPriority(workerId, rowStartTime, rowEndTime);
    if (availInfo?.type === 'wanted') return 'wanted';
    if (availInfo?.type === 'available') return 'available';
    return 'no-info';
  };

  const filteredWorkers = workers
    .filter((w) => w.active)
    .filter((w) => {
      const matchesSearch = !searchQuery ||
        w.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(w.role) ? w.role.join(" ") : w.role || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !roleFilter || roleFilter === "__all__" ||
        (Array.isArray(w.role) ? w.role.includes(roleFilter) : w.role === roleFilter);
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const aQual = isWorkerQualified(a.id);
      const bQual = isWorkerQualified(b.id);
      if (!rowStartTime || !rowEndTime) {
        if (aQual !== bQual) return aQual ? -1 : 1;
        return 0;
      }
      const aCat = getWorkerCategory(a.id);
      const bCat = getWorkerCategory(b.id);
      const catOrder = { wanted: 0, available: 1, 'no-info': 2, unavailable: 6 };
      const aScore = aCat === 'unavailable' ? 6 : (aQual ? catOrder[aCat] : catOrder[aCat] + 3);
      const bScore = bCat === 'unavailable' ? 6 : (bQual ? catOrder[bCat] : catOrder[bCat] + 3);
      if (aScore !== bScore) return aScore - bScore;
      const aAvail = getWorkerAvailabilityPriority(a.id, rowStartTime, rowEndTime);
      const bAvail = getWorkerAvailabilityPriority(b.id, rowStartTime, rowEndTime);
      if (aAvail?.priority && bAvail?.priority) return aAvail.priority - bAvail.priority;
      return 0;
    });

  const isCurrentUnavailable = selectedWorker && rowStartTime && rowEndTime &&
    isWorkerUnavailable(selectedWorker.id, rowStartTime, rowEndTime);
  const isCurrentUnqualified = selectedWorker && taskQualifiedWorkerIds &&
    !taskQualifiedWorkerIds.includes(selectedWorker.id);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-full" style={{ height: '100%' }} dir="rtl">
      {/* Cell display / input */}
      {editing ? (
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredWorkers.length > 0) {
              handleWorkerSelect(filteredWorkers[0].id);
            } else if (e.key === 'Escape') {
              setEditing(false);
              setSearchQuery("");
            }
          }}
          placeholder={selectedWorker ? selectedWorker.nickname : "חיפוש..."}
          className="w-full h-full text-xs text-center bg-blue-50 border-0 outline-none px-1 py-1"
          dir="rtl"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={`w-full text-center p-2 hover:bg-blue-50 transition-colors ${isCurrentUnavailable ? "bg-red-50" : ""}`}
          style={{ minHeight: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          dir="rtl"
        >
          {selectedWorker ? (
            <div className="flex items-center gap-1 justify-center">
              <span className={`text-xs font-medium truncate ${isCurrentUnqualified ? 'text-orange-600' : 'text-gray-950'}`}>
                {selectedWorker.nickname}
              </span>
              {isCurrentUnavailable && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
              {isCurrentUnqualified && <span className="text-[10px] text-orange-500 flex-shrink-0">⚠</span>}
            </div>
          ) : (
            <span className="text-gray-300 text-xs">+ בחר עובד</span>
          )}
        </button>
      )}

      {/* Dropdown list */}
      {editing && (() => {
        const rect = containerRef.current?.getBoundingClientRect();
        // For fixed positioning, coordinates are relative to viewport — never add scroll offsets
        const spaceBelow = rect ? window.innerHeight - rect.bottom : 999;
        const dropdownHeight = 240; // max-h-60
        const openUpward = spaceBelow < dropdownHeight && rect?.top > dropdownHeight;
        const top = rect ? (openUpward ? rect.top - dropdownHeight : rect.bottom) : 0;
        const right = rect ? Math.max(0, window.innerWidth - rect.right) : 0;

        console.log("WORKER DROPDOWN OPEN", {
          rowId,
          columnName,
          triggerRect: rect,
          openUpward,
          top,
          right
        });

        return (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-2xl w-56 max-h-60 overflow-y-auto"
          style={{
            minWidth: "180px",
            zIndex: 9999,
            top,
            right
          }}
          dir="rtl"
        >
          {selectedWorker && (
            <button
              onMouseDown={(e) => { e.preventDefault(); handleRemoveWorker(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-b border-gray-100"
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
              const category = getWorkerCategory(worker.id);
              const isSelected = worker.id === currentValue;
              const qualified = isWorkerQualified(worker.id);

              const bgClass = isSelected
                ? "bg-blue-100 text-blue-800"
                : category === 'wanted'
                ? "bg-green-50 hover:bg-green-100 text-green-900"
                : category === 'available'
                ? "bg-blue-50 hover:bg-blue-100 text-blue-900"
                : category === 'no-info'
                ? "bg-orange-50 hover:bg-orange-100 text-orange-900"
                : "bg-red-50 hover:bg-red-100 text-red-900";

              const roleDisplay = Array.isArray(worker.role) ? worker.role.join(", ") : worker.role;

              return (
                <button
                  key={worker.id}
                  onMouseDown={(e) => { e.preventDefault(); handleWorkerSelect(worker.id); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${bgClass}`}
                  dir="rtl"
                >
                  <span className="flex-shrink-0">
                    {category === 'unavailable' ? <AlertTriangle className="w-3 h-3 text-red-700" /> :
                     category === 'wanted' ? <Star className="w-3 h-3 text-green-700 fill-green-700" /> :
                     category === 'available' ? <Check className="w-3 h-3 text-blue-700" /> :
                     <span className="w-3 h-3 inline-block" />}
                  </span>
                  <span className={`flex-1 text-right font-medium ${!qualified ? 'text-orange-600' : getSeniorityColor(worker.seniority)}`}>
                    {worker.nickname}{!qualified ? ' ⚠' : ''}
                  </span>
                  {roleDisplay && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                      {roleDisplay}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
        );
      })()}
    </div>
  );
}
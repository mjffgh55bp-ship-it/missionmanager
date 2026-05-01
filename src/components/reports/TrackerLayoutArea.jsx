import React, { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical } from "lucide-react";
import TrackerTable from "./TrackerTable";

const DEFAULT_W = 700;
const HANDLE_H = 40;

export default function TrackerLayoutArea({
  trackers,
  workers, assignments, templateRows, allTemplates,
  populations, workerRoles, scheduleColumns, qualifications,
  onDeleteTracker, onUpdatedTracker,
}) {
  // positions stored in state: { [id]: { x, y, w } }
  const [positions, setPositions] = useState({});
  const containerRef = useRef(null);
  const dragging = useRef(null);
  // Track actual rendered heights via refs
  const cardRefs = useRef({});

  // Initialize positions for new trackers
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      trackers.forEach((tracker, i) => {
        if (!next[tracker.id]) {
          next[tracker.id] = {
            x: 12,
            y: i * 420 + 12,
            w: DEFAULT_W,
          };
        }
      });
      Object.keys(next).forEach(id => {
        if (!trackers.find(t => t.id === id)) delete next[id];
      });
      return next;
    });
  }, [trackers]);

  // Canvas height: max bottom of all trackers + padding
  const canvasHeight = Math.max(
    400,
    ...trackers.map(t => {
      const p = positions[t.id];
      const el = cardRefs.current[t.id];
      const h = el ? el.offsetHeight : 400;
      return p ? p.y + h + 40 : 400;
    })
  );

  const startDrag = useCallback((e, trackerId) => {
    e.preventDefault();
    const p = positions[trackerId] || { x: 0, y: 0, w: DEFAULT_W };
    dragging.current = {
      id: trackerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: p.x,
      startY: p.y,
    };

    const onMove = (ev) => {
      const d = dragging.current;
      if (!d) return;
      const dx = ev.clientX - d.startMouseX;
      const dy = ev.clientY - d.startMouseY;
      setPositions(prev => ({
        ...prev,
        [d.id]: {
          ...prev[d.id],
          x: Math.max(0, d.startX + dx),
          y: Math.max(0, d.startY + dy),
        },
      }));
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [positions]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-auto"
      style={{ minHeight: canvasHeight }}
    >
      {trackers.map(tracker => {
        const p = positions[tracker.id] || { x: 0, y: 0, w: DEFAULT_W };
        return (
          <div
            key={tracker.id}
            ref={el => { cardRefs.current[tracker.id] = el; }}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              minWidth: 320,
              zIndex: 10,
            }}
            className="bg-white border border-gray-200 rounded-xl shadow-sm"
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-between px-4 bg-gray-50 rounded-t-xl border-b border-gray-200 cursor-grab active:cursor-grabbing select-none"
              style={{ height: HANDLE_H }}
              onMouseDown={(e) => startDrag(e, tracker.id)}
            >
              <div className="text-sm font-semibold text-gray-700">{tracker.name}</div>
              <div className="flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-400" />
                ))}
              </div>
            </div>

            <TrackerTable
              tracker={tracker}
              workers={workers}
              assignments={assignments}
              templateRows={templateRows}
              allTemplates={allTemplates}
              populations={populations}
              workerRoles={workerRoles}
              scheduleColumns={scheduleColumns}
              qualifications={qualifications}
              onDelete={() => onDeleteTracker(tracker.id)}
              onUpdated={onUpdatedTracker}
            />
          </div>
        );
      })}
    </div>
  );
}
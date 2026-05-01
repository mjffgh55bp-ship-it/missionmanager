import React, { useState, useRef, useEffect, useCallback } from "react";
import TrackerTable from "./TrackerTable";
import SnapGuides from "./SnapGuides";
import { snapPosition, snapResize } from "./snapEngine";

const DEFAULT_W = 700;
const HANDLE_H = 40;
const MIN_W = 320;
const MIN_H = 150;

export default function TrackerLayoutArea({
  trackers,
  workers, assignments, templateRows, allTemplates,
  populations, workerRoles, scheduleColumns, qualifications,
  onDeleteTracker, onUpdatedTracker,
}) {
  const [positions, setPositions] = useState({}); // { [id]: { x, y, w, h } }
  const [snapGuides, setSnapGuides] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const containerRef = useRef(null);
  const cardRefs = useRef({});
  const interacting = useRef(null); // { type: 'drag'|'resize', id, ... }

  // Initialize positions for new trackers
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      trackers.forEach((tracker, i) => {
        if (!next[tracker.id]) {
          next[tracker.id] = { x: 12, y: i * 420 + 12, w: DEFAULT_W, h: null };
        }
      });
      Object.keys(next).forEach(id => {
        if (!trackers.find(t => t.id === id)) delete next[id];
      });
      return next;
    });
  }, [trackers]);

  // Collect all rects from current positions + DOM heights
  const getAllRects = useCallback((excludeId) => {
    const rects = {};
    for (const [id, p] of Object.entries(positions)) {
      if (id === excludeId) continue;
      const el = cardRefs.current[id];
      const h = p.h || (el ? el.offsetHeight : 400);
      rects[id] = { x: p.x, y: p.y, w: p.w, h };
    }
    return rects;
  }, [positions]);

  const containerW = () => containerRef.current?.offsetWidth || 1000;

  // Canvas height
  const canvasHeight = Math.max(
    500,
    ...trackers.map(t => {
      const p = positions[t.id];
      const el = cardRefs.current[t.id];
      const h = p?.h || (el ? el.offsetHeight : 400);
      return p ? p.y + h + 60 : 500;
    })
  );

  // ── DRAG ──
  const startDrag = useCallback((e, trackerId) => {
    e.preventDefault();
    const p = positions[trackerId] || { x: 0, y: 0, w: DEFAULT_W, h: null };
    interacting.current = {
      type: "drag",
      id: trackerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: p.x,
      startY: p.y,
    };
    setActiveId(trackerId);

    const onMove = (ev) => {
      const d = interacting.current;
      if (!d || d.type !== "drag") return;
      const rawX = d.startX + (ev.clientX - d.startMouseX);
      const rawY = d.startY + (ev.clientY - d.startMouseY);
      const el = cardRefs.current[d.id];
      const h = positions[d.id]?.h || (el ? el.offsetHeight : 400);
      const w = positions[d.id]?.w || DEFAULT_W;
      const others = getAllRects(d.id);
      const { snappedX, snappedY, guides } = snapPosition(
        { x: rawX, y: rawY, w, h }, others, containerW()
      );
      setSnapGuides(guides);
      setPositions(prev => ({
        ...prev,
        [d.id]: { ...prev[d.id], x: snappedX, y: snappedY },
      }));
    };

    const onUp = () => {
      interacting.current = null;
      setActiveId(null);
      setSnapGuides([]);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [positions, getAllRects]);

  // ── RESIZE ──
  const startResize = useCallback((e, trackerId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = positions[trackerId] || { x: 0, y: 0, w: DEFAULT_W, h: null };
    const el = cardRefs.current[trackerId];
    const startH = p.h || (el ? el.offsetHeight : 400);
    interacting.current = {
      type: "resize",
      id: trackerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: p.w,
      startH,
      posX: p.x,
      posY: p.y,
    };
    setActiveId(trackerId);

    const onMove = (ev) => {
      const d = interacting.current;
      if (!d || d.type !== "resize") return;
      const rawW = Math.max(MIN_W, d.startW + (ev.clientX - d.startMouseX));
      const rawH = Math.max(MIN_H, d.startH + (ev.clientY - d.startMouseY));
      const others = getAllRects(d.id);
      const { snappedW, snappedH, guides } = snapResize(
        d.id, { x: d.posX, y: d.posY }, rawW, rawH, others, containerW()
      );
      setSnapGuides(guides);
      setPositions(prev => ({
        ...prev,
        [d.id]: { ...prev[d.id], w: snappedW, h: snappedH },
      }));
    };

    const onUp = () => {
      interacting.current = null;
      setActiveId(null);
      setSnapGuides([]);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [positions, getAllRects]);

  const containerRect = containerRef.current?.getBoundingClientRect() || null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: canvasHeight }}>
      <SnapGuides guides={snapGuides} containerRect={containerRect} />

      {trackers.map(tracker => {
        const p = positions[tracker.id] || { x: 0, y: 0, w: DEFAULT_W, h: null };
        const isActive = activeId === tracker.id;
        return (
          <div
            key={tracker.id}
            ref={el => { cardRefs.current[tracker.id] = el; }}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h || "auto",
              minWidth: MIN_W,
              zIndex: isActive ? 20 : 10,
              overflow: p.h ? "auto" : "visible",
            }}
            className={`bg-white rounded-xl shadow-sm border ${isActive ? "border-blue-400 shadow-blue-100 shadow-md" : "border-gray-200"}`}
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

            {/* Resize handle */}
            <div
              onMouseDown={(e) => startResize(e, tracker.id)}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 18,
                height: 18,
                cursor: "nwse-resize",
                zIndex: 30,
              }}
              className="flex items-end justify-end pr-1 pb-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 8L8 2M5 8L8 5M8 8L8 8" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
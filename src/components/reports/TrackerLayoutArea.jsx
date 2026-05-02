import React, { useState, useRef, useEffect } from "react";
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
  // posRef is the single source of truth; posState drives re-renders
  const posRef = useRef({});
  const [posState, setPosState] = useState({});
  const [snapGuides, setSnapGuides] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const containerRef = useRef(null);
  const cardRefs = useRef({});

  // Keep posRef in sync
  useEffect(() => { posRef.current = posState; }, [posState]);

  // Initialize positions for new trackers
  useEffect(() => {
    setPosState(prev => {
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

  const getOtherRects = (excludeId) => {
    const rects = {};
    for (const [id, p] of Object.entries(posRef.current)) {
      if (id === excludeId) continue;
      const el = cardRefs.current[id];
      const h = p.h || (el ? el.offsetHeight : 400);
      rects[id] = { x: p.x, y: p.y, w: p.w || DEFAULT_W, h };
    }
    return rects;
  };

  const getContainerW = () => containerRef.current?.offsetWidth || 1000;

  const canvasHeight = Math.max(
    500,
    ...trackers.map(t => {
      const p = posState[t.id];
      const el = cardRefs.current[t.id];
      const h = p?.h || (el ? el.offsetHeight : 400);
      return p ? p.y + h + 60 : 500;
    })
  );

  // ── DRAG ──
  const startDrag = (e, trackerId) => {
    e.preventDefault();
    const p = posRef.current[trackerId] || { x: 0, y: 0, w: DEFAULT_W, h: null };
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = p.x;
    const startY = p.y;
    setActiveId(trackerId);

    const onMove = (ev) => {
      const cur = posRef.current[trackerId] || { w: DEFAULT_W, h: null };
      const el = cardRefs.current[trackerId];
      const h = cur.h || (el ? el.offsetHeight : 400);
      const rawX = startX + (ev.clientX - startMouseX);
      const rawY = startY + (ev.clientY - startMouseY);
      const { snappedX, snappedY, guides } = snapPosition(
        { x: rawX, y: rawY, w: cur.w || DEFAULT_W, h },
        getOtherRects(trackerId),
        getContainerW()
      );
      setSnapGuides(guides);
      const updated = { ...posRef.current[trackerId], x: snappedX, y: snappedY };
      posRef.current = { ...posRef.current, [trackerId]: updated };
      setPosState(prev => ({ ...prev, [trackerId]: updated }));
    };

    const onUp = () => {
      setActiveId(null);
      setSnapGuides([]);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── RESIZE ──
  const startResize = (e, trackerId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = posRef.current[trackerId] || { x: 0, y: 0, w: DEFAULT_W, h: null };
    const el = cardRefs.current[trackerId];
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = p.w || DEFAULT_W;
    const startH = p.h || (el ? el.offsetHeight : 400);
    const posX = p.x;
    const posY = p.y;
    setActiveId(trackerId);

    const onMove = (ev) => {
      const rawW = Math.max(MIN_W, startW + (ev.clientX - startMouseX));
      const rawH = Math.max(MIN_H, startH + (ev.clientY - startMouseY));
      const { snappedW, snappedH, guides } = snapResize(
        trackerId, { x: posX, y: posY }, rawW, rawH,
        getOtherRects(trackerId), getContainerW()
      );
      setSnapGuides(guides);
      const updated = { ...posRef.current[trackerId], w: snappedW, h: snappedH };
      posRef.current = { ...posRef.current, [trackerId]: updated };
      setPosState(prev => ({ ...prev, [trackerId]: updated }));
    };

    const onUp = () => {
      setActiveId(null);
      setSnapGuides([]);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: canvasHeight }}>
      <SnapGuides guides={snapGuides} />

      {trackers.map(tracker => {
        const p = posState[tracker.id] || { x: 0, y: 0, w: DEFAULT_W, h: null };
        const isActive = activeId === tracker.id;
        return (
          <div
            key={tracker.id}
            ref={el => { cardRefs.current[tracker.id] = el; }}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w || DEFAULT_W,
              height: p.h || "auto",
              minWidth: MIN_W,
              zIndex: isActive ? 20 : 10,
              overflow: p.h ? "auto" : "visible",
            }}
            className={`bg-white rounded-xl shadow-sm border ${isActive ? "border-blue-400 shadow-md" : "border-gray-200"}`}
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

            {/* Resize handle — bottom-right corner */}
            <div
              onMouseDown={(e) => startResize(e, tracker.id)}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 20,
                height: 20,
                cursor: "nwse-resize",
                zIndex: 30,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                padding: "3px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 11L11 1M5 11L11 5M9 11L11 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
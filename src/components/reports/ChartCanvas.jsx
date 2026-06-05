import React, { useState, useRef, useEffect } from "react";
import ChartDisplay from "./ChartDisplay";
import SnapGuides from "./SnapGuides";
import { snapPosition, snapResize } from "./snapEngine";

const DEFAULT_W = 420;
const DEFAULT_H = 340;
const HANDLE_H = 36;
const MIN_W = 280;
const MIN_H = 200;

export default function ChartCanvas({
  charts, workers, assignments, templateRows, allTemplates,
  trackers, trackerEntries,
  workerQualifications, qualifications,
  roleObjects, populationObjects,
  onEdit, onDelete,
}) {
  const STORAGE_KEY = "chart_canvas_positions";

  // posRef is the single source of truth; posState drives re-renders
  const posRef = useRef({});
  const [posState, setPosState] = useState({});
  const [snapGuides, setSnapGuides] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const containerRef = useRef(null);
  const cardRefs = useRef({});

  // Sync posRef when posState changes (so event handlers always read fresh data)
  useEffect(() => { posRef.current = posState; }, [posState]);

  // Save to localStorage whenever positions change
  useEffect(() => {
    if (Object.keys(posState).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posState));
    }
  }, [posState]);

  // Initialize positions for new charts (restoring from localStorage first)
  useEffect(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } })();
    setPosState(prev => {
      const next = { ...saved, ...prev };
      charts.forEach((chart, i) => {
        if (!next[chart.id]) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          next[chart.id] = {
            x: col * (DEFAULT_W + 24) + 12,
            y: row * (DEFAULT_H + 24) + 12,
            w: DEFAULT_W,
            h: DEFAULT_H,
          };
        }
      });
      Object.keys(next).forEach(id => {
        if (!charts.find(c => c.id === id)) delete next[id];
      });
      return next;
    });
  }, [charts]);

  const getOtherRects = (excludeId) => {
    const rects = {};
    for (const [id, p] of Object.entries(posRef.current)) {
      if (id === excludeId) continue;
      rects[id] = { x: p.x, y: p.y, w: p.w || DEFAULT_W, h: p.h || DEFAULT_H };
    }
    return rects;
  };

  const getContainerW = () => containerRef.current?.offsetWidth || 1000;

  const canvasHeight = Math.max(
    500,
    ...charts.map(c => {
      const p = posState[c.id];
      return p ? p.y + (p.h || DEFAULT_H) + 60 : 500;
    })
  );

  // ── DRAG ──
  const startDrag = (e, chartId) => {
    e.preventDefault();
    const p = posRef.current[chartId] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = p.x;
    const startY = p.y;
    setActiveId(chartId);

    const onMove = (ev) => {
      const cur = posRef.current[chartId] || { w: DEFAULT_W, h: DEFAULT_H };
      const rawX = startX + (ev.clientX - startMouseX);
      const rawY = startY + (ev.clientY - startMouseY);
      const { snappedX, snappedY, guides } = snapPosition(
        { x: rawX, y: rawY, w: cur.w, h: cur.h },
        getOtherRects(chartId),
        getContainerW()
      );
      setSnapGuides(guides);
      const updated = { ...posRef.current[chartId], x: snappedX, y: snappedY };
      posRef.current = { ...posRef.current, [chartId]: updated };
      setPosState(prev => ({ ...prev, [chartId]: updated }));
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
  const startResize = (e, chartId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = posRef.current[chartId] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = p.w || DEFAULT_W;
    const startH = p.h || DEFAULT_H;
    const posX = p.x;
    const posY = p.y;
    setActiveId(chartId);

    const onMove = (ev) => {
      const rawW = Math.max(MIN_W, startW + (ev.clientX - startMouseX));
      const rawH = Math.max(MIN_H, startH + (ev.clientY - startMouseY));
      const { snappedW, snappedH, guides } = snapResize(
        chartId, { x: posX, y: posY }, rawW, rawH,
        getOtherRects(chartId), getContainerW()
      );
      setSnapGuides(guides);
      const updated = { ...posRef.current[chartId], w: snappedW, h: snappedH };
      posRef.current = { ...posRef.current, [chartId]: updated };
      setPosState(prev => ({ ...prev, [chartId]: updated }));
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

      {charts.map(chart => {
        const p = posState[chart.id] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
        const isActive = activeId === chart.id;
        return (
          <div
            key={chart.id}
            ref={el => { cardRefs.current[chart.id] = el; }}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w || DEFAULT_W,
              height: p.h || DEFAULT_H,
              zIndex: isActive ? 20 : 10,
              overflow: "hidden",
            }}
            className={`rounded-xl bg-white shadow-md border ${isActive ? "border-blue-400 shadow-lg" : "border-gray-200"}`}
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-center bg-gray-100 rounded-t-xl border-b border-gray-200 cursor-grab active:cursor-grabbing select-none"
              style={{ height: HANDLE_H }}
              onMouseDown={(e) => startDrag(e, chart.id)}
            >
              <div className="flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-400" />
                ))}
              </div>
            </div>

            <div style={{ height: `calc(100% - ${HANDLE_H}px)`, overflow: "hidden" }}>
              <ChartDisplay
                chart={chart}
                workers={workers}
                assignments={assignments}
                templateRows={templateRows}
                allTemplates={allTemplates}
                trackers={trackers}
                trackerEntries={trackerEntries}
                workerQualifications={workerQualifications}
                qualifications={qualifications}
                roleObjects={roleObjects}
                populationObjects={populationObjects}
                onEdit={() => onEdit(chart)}
                onDelete={() => onDelete(chart.id)}
              />
            </div>

            {/* Resize handle — bottom-right corner */}
            <div
              onMouseDown={(e) => startResize(e, chart.id)}
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
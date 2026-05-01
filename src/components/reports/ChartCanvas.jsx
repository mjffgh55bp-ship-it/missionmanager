import React, { useState, useRef, useEffect, useCallback } from "react";
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
  onEdit, onDelete,
}) {
  const [positions, setPositions] = useState({}); // { [id]: { x, y, w, h } }
  const [snapGuides, setSnapGuides] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const containerRef = useRef(null);
  const cardRefs = useRef({});
  const interacting = useRef(null);

  // Initialize positions for new charts
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
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

  const getAllRects = useCallback((excludeId) => {
    const rects = {};
    for (const [id, p] of Object.entries(positions)) {
      if (id === excludeId) continue;
      const el = cardRefs.current[id];
      const h = p.h || (el ? el.offsetHeight : DEFAULT_H);
      rects[id] = { x: p.x, y: p.y, w: p.w || DEFAULT_W, h };
    }
    return rects;
  }, [positions]);

  const containerW = () => containerRef.current?.offsetWidth || 1000;

  const canvasHeight = Math.max(
    500,
    ...charts.map(c => {
      const p = positions[c.id];
      const h = p?.h || DEFAULT_H;
      return p ? p.y + h + 60 : 500;
    })
  );

  // ── DRAG ──
  const startDrag = useCallback((e, chartId) => {
    e.preventDefault();
    const p = positions[chartId] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
    interacting.current = {
      type: "drag",
      id: chartId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: p.x,
      startY: p.y,
    };
    setActiveId(chartId);

    const onMove = (ev) => {
      const d = interacting.current;
      if (!d || d.type !== "drag") return;
      const rawX = d.startX + (ev.clientX - d.startMouseX);
      const rawY = d.startY + (ev.clientY - d.startMouseY);
      const cur = positions[d.id] || { w: DEFAULT_W, h: DEFAULT_H };
      const others = getAllRects(d.id);
      const { snappedX, snappedY, guides } = snapPosition(
        { x: rawX, y: rawY, w: cur.w || DEFAULT_W, h: cur.h || DEFAULT_H },
        others, containerW()
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
  const startResize = useCallback((e, chartId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = positions[chartId] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
    interacting.current = {
      type: "resize",
      id: chartId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: p.w || DEFAULT_W,
      startH: p.h || DEFAULT_H,
      posX: p.x,
      posY: p.y,
    };
    setActiveId(chartId);

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

      {charts.map(chart => {
        const p = positions[chart.id] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
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
            className={`rounded-xl bg-white shadow-md border ${isActive ? "border-blue-400 shadow-blue-100 shadow-lg" : "border-gray-200"}`}
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-center bg-gray-100 rounded-t-xl border-b border-gray-200 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
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
                onEdit={() => onEdit(chart)}
                onDelete={() => onDelete(chart.id)}
              />
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={(e) => startResize(e, chart.id)}
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
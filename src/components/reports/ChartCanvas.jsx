import React, { useState, useRef, useCallback, useEffect } from "react";
import ChartDisplay from "./ChartDisplay";

const DEFAULT_W = 420;
const DEFAULT_H = 340;
const HEADER_H = 40; // drag handle height

export default function ChartCanvas({
  charts, workers, assignments, templateRows, allTemplates,
  trackers, trackerEntries,
  onEdit, onDelete,
}) {
  // positions: { [chartId]: { x, y, w, h } }
  const [positions, setPositions] = useState({});
  const containerRef = useRef(null);
  const dragging = useRef(null); // { id, startMouseX, startMouseY, startX, startY }

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
      // Remove stale positions
      Object.keys(next).forEach(id => {
        if (!charts.find(c => c.id === id)) delete next[id];
      });
      return next;
    });
  }, [charts]);

  // Canvas height: max bottom of all charts + padding
  const canvasHeight = Math.max(
    500,
    ...charts.map(c => {
      const p = positions[c.id];
      return p ? p.y + p.h + 40 : 500;
    })
  );

  const onDragStart = useCallback((e, chartId) => {
    e.preventDefault();
    const p = positions[chartId] || { x: 0, y: 0 };
    dragging.current = {
      id: chartId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: p.x,
      startY: p.y,
    };

    const onMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startMouseX;
      const dy = e.clientY - dragging.current.startMouseY;
      const newX = Math.max(0, dragging.current.startX + dx);
      const newY = Math.max(0, dragging.current.startY + dy);
      setPositions(prev => ({
        ...prev,
        [dragging.current.id]: {
          ...prev[dragging.current.id],
          x: newX,
          y: newY,
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
      style={{ minHeight: canvasHeight, background: "transparent" }}
    >
      {charts.map(chart => {
        const p = positions[chart.id] || { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
        return (
          <div
            key={chart.id}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              zIndex: 10,
            }}
            className="shadow-md rounded-xl"
          >
            {/* Drag handle bar */}
            <div
              className="flex items-center justify-center bg-gray-100 rounded-t-xl border-b border-gray-200 cursor-grab active:cursor-grabbing select-none"
              style={{ height: HEADER_H }}
              onMouseDown={(e) => onDragStart(e, chart.id)}
            >
              <div className="flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-400" />
                ))}
              </div>
            </div>

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
        );
      })}
    </div>
  );
}
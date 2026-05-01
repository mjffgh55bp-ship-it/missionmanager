import React, { useState, useRef, useEffect, useCallback } from "react";
import ChartDisplay from "./ChartDisplay";

const DEFAULT_W = 420;
const DEFAULT_H = 340;
const HANDLE_H = 36;

export default function ChartCanvas({
  charts, workers, assignments, templateRows, allTemplates,
  trackers, trackerEntries,
  onEdit, onDelete,
}) {
  const [positions, setPositions] = useState({});
  const containerRef = useRef(null);
  const dragging = useRef(null);
  const cardRefs = useRef({});

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
          };
        }
      });
      Object.keys(next).forEach(id => {
        if (!charts.find(c => c.id === id)) delete next[id];
      });
      return next;
    });
  }, [charts]);

  const canvasHeight = Math.max(
    500,
    ...charts.map(c => {
      const p = positions[c.id];
      const el = cardRefs.current[c.id];
      const h = el ? el.offsetHeight : DEFAULT_H;
      return p ? p.y + h + 40 : 500;
    })
  );

  const startDrag = useCallback((e, chartId) => {
    e.preventDefault();
    const container = containerRef.current;
    const p = positions[chartId] || { x: 0, y: 0 };

    // Capture scroll at drag start — this is the key fix
    const scrollTopAtStart = container ? container.scrollTop : 0;

    dragging.current = {
      id: chartId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: p.x,
      startY: p.y,
      scrollTopAtStart,
    };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const currentScrollTop = container ? container.scrollTop : 0;
      const scrollDelta = currentScrollTop - dragging.current.scrollTopAtStart;
      const dx = ev.clientX - dragging.current.startMouseX;
      const dy = ev.clientY - dragging.current.startMouseY;
      setPositions(prev => ({
        ...prev,
        [dragging.current.id]: {
          x: Math.max(0, dragging.current.startX + dx),
          y: Math.max(0, dragging.current.startY + dy + scrollDelta),
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
      {charts.map(chart => {
        const p = positions[chart.id] || { x: 0, y: 0 };
        return (
          <div
            key={chart.id}
            ref={el => { cardRefs.current[chart.id] = el; }}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: DEFAULT_W,
              zIndex: 10,
            }}
            className="shadow-md rounded-xl bg-white"
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
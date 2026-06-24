import React, { useState, useRef } from "react";
import { Plus } from "lucide-react";

/**
 * Draggable, resizable summary column headers.
 * Props:
 *   summaryColumns       – array of column objects
 *   columnWidths         – { [col.id]: number }
 *   onReorder            – (newColumns) => void
 *   onResize             – (colId, newWidth) => void
 *   setShowSummaryColumnsDialog – () => void
 */
export default function SummaryColumnsHeader({
  summaryColumns,
  columnWidths,
  onReorder,
  onResize,
  setShowSummaryColumnsDialog,
}) {
  const dragColIdRef = useRef(null);
  const dragOverColIdRef = useRef(null);
  const resizingRef = useRef(null); // { colId, startX, startWidth }
  const [dragOverId, setDragOverId] = useState(null);

  // ── Column drag-to-reorder ───────────────────────────────────────────────
  const handleDragStart = (e, colId) => {
    dragColIdRef.current = colId;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    dragOverColIdRef.current = colId;
    setDragOverId(colId);
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    const from = dragColIdRef.current;
    const to = colId;
    if (!from || from === to) { setDragOverId(null); return; }
    const cols = [...summaryColumns];
    const fromIdx = cols.findIndex(c => c.id === from);
    const toIdx = cols.findIndex(c => c.id === to);
    if (fromIdx < 0 || toIdx < 0) { setDragOverId(null); return; }
    cols.splice(toIdx, 0, cols.splice(fromIdx, 1)[0]);
    onReorder(cols);
    dragColIdRef.current = null;
    dragOverColIdRef.current = null;
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    dragColIdRef.current = null;
    dragOverColIdRef.current = null;
    setDragOverId(null);
  };

  // ── Column border resize ─────────────────────────────────────────────────
  const handleResizeMouseDown = (e, colId, currentWidth) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth: currentWidth };

    const onMove = (ev) => {
      const { colId, startX, startWidth } = resizingRef.current;
      const delta = startX - ev.clientX; // RTL: drag left = wider
      const newW = Math.max(36, startWidth + delta);
      onResize(colId, newW);
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {summaryColumns.map(col => {
        const w = columnWidths[col.id] || 60;
        const isOver = dragOverId === col.id;
        return (
          <div
            key={col.id}
            draggable
            onDragStart={e => handleDragStart(e, col.id)}
            onDragOver={e => handleDragOver(e, col.id)}
            onDrop={e => handleDrop(e, col.id)}
            onDragEnd={handleDragEnd}
            className={`relative border-r bg-gray-100 flex flex-col items-center justify-center text-center px-0.5 py-1 h-full select-none cursor-grab ${isOver ? 'bg-blue-50 border-blue-400' : ''}`}
            style={{ width: `${w}px`, minWidth: `${w}px` }}
            title={col.name}
          >
            <span className="text-[9px] font-semibold text-gray-600 leading-tight truncate w-full text-center">{col.name}</span>
            {/* Resize handle on the left border (RTL: left = visually start of next col) */}
            <div
              className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10 hover:bg-blue-300 hover:opacity-60"
              onMouseDown={e => handleResizeMouseDown(e, col.id, w)}
            />
          </div>
        );
      })}
      <div className="w-[28px] min-w-[28px] border-r bg-gray-100 flex items-center justify-center h-full">
        <button onClick={() => setShowSummaryColumnsDialog(true)} className="text-gray-400 hover:text-gray-600 p-1" title="נהל עמודות סיכום">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
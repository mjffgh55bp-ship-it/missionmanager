import { useRef, useState } from "react";

export function useColumnDrag(columns, onReorder) {
  const [dragState, setDragState] = useState({ dragging: null, dropIndex: null });
  const headerRefs = useRef({});

  const getDragHandleProps = (colName) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", colName);
      // Small timeout so the browser renders the drag image before we dim the element
      setTimeout(() => setDragState({ dragging: colName, dropIndex: null }), 0);
    },
    onDragEnd: () => {
      setDragState({ dragging: null, dropIndex: null });
    },
    style: { cursor: "grab" },
  });

  // Returns the insertion index (0..columns.length) based on pointer X position.
  // The indicator should render BETWEEN columns: before index N means a line on the left
  // edge of column N (or right edge of column N-1).
  const calcDropIndex = (draggingColName, clientX) => {
    const rects = columns.map((c) => {
      const el = headerRefs.current[c.name];
      return el ? el.getBoundingClientRect() : null;
    });

    // Find which gap the pointer is closest to
    // Gaps are: before col 0, between col i and i+1, after last col
    let bestIndex = 0;
    let bestDist = Infinity;

    for (let i = 0; i <= columns.length; i++) {
      let gapX;
      if (i === 0) {
        gapX = rects[0]?.left ?? 0;
      } else if (i === columns.length) {
        const last = rects[columns.length - 1];
        gapX = last ? last.right : 0;
      } else {
        const left = rects[i - 1];
        const right = rects[i];
        if (left && right) {
          gapX = (left.right + right.left) / 2;
        } else if (left) {
          gapX = left.right;
        } else if (right) {
          gapX = right.left;
        } else {
          continue;
        }
      }
      const dist = Math.abs(clientX - gapX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  const getHeaderProps = (colName, idx) => ({
    ref: (el) => { headerRefs.current[colName] = el; },
    onDragOver: (e) => {
      if (!dragState.dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const dropIndex = calcDropIndex(dragState.dragging, e.clientX);
      if (dropIndex !== dragState.dropIndex) {
        setDragState((prev) => ({ ...prev, dropIndex }));
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      const dragged = e.dataTransfer.getData("text/plain") || dragState.dragging;
      if (!dragged) return;
      const dropIndex = calcDropIndex(dragged, e.clientX);
      setDragState({ dragging: null, dropIndex: null });

      const fromIndex = columns.findIndex((c) => c.name === dragged);
      if (fromIndex === -1) return;

      // dropIndex is the insertion point in the original array (before removal).
      // A drop at fromIndex or fromIndex+1 is a no-op (same position).
      if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return;

      const next = [...columns];
      const [moved] = next.splice(fromIndex, 1);
      // After removing the item, the target index shifts by -1 if we removed before it
      const toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
      next.splice(toIndex, 0, moved);

      onReorder(next);
    },
  });

  return { dragState, getDragHandleProps, getHeaderProps };
}
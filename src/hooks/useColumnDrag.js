import { useRef, useState } from "react";

/**
 * Custom column drag-and-drop hook using native HTML5 drag events.
 * Works correctly in RTL table headers — calculates drop index from DOM midpoints.
 *
 * Usage:
 *   const { dragState, getDragHandleProps, getHeaderProps, dropIndicatorIndex } = useColumnDrag(columns, onReorder);
 *
 * getDragHandleProps(colName) → spread onto the drag handle element
 * getHeaderProps(colName, idx) → spread onto the <th> element
 * dropIndicatorIndex → index before which to render the drop indicator line
 */
export function useColumnDrag(columns, onReorder) {
  const [dragState, setDragState] = useState({ dragging: null, dropIndex: null });
  const headerRefs = useRef({}); // colName → DOM element

  const getDragHandleProps = (colName) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", colName);
      setDragState({ dragging: colName, dropIndex: null });
    },
    onDragEnd: () => {
      setDragState({ dragging: null, dropIndex: null });
    },
    style: { cursor: "grab" },
  });

  const calcDropIndex = (colName, clientX) => {
    // Build ordered list of rendered header rects (in DOM visual order)
    const rects = columns.map((c) => {
      const el = headerRefs.current[c.name];
      return el ? el.getBoundingClientRect() : null;
    });

    const fromIndex = columns.findIndex((c) => c.name === colName);

    // Find the target column being hovered
    let targetIndex = -1;
    for (let i = 0; i < columns.length; i++) {
      const rect = rects[i];
      if (!rect) continue;
      if (clientX >= rect.left && clientX <= rect.right) {
        // Determine if pointer is in the left or right half of this header
        const mid = rect.left + rect.width / 2;
        // RTL: visually "before" means higher array index for RTL columns rendered right-to-left,
        // but our array order IS the visual order (orderedColumns), so we treat it as LTR array order:
        // pointer left of midpoint → insert before this column (lower index)
        // pointer right of midpoint → insert after this column (higher index)
        if (clientX < mid) {
          targetIndex = i; // insert before column i
        } else {
          targetIndex = i + 1; // insert after column i
        }
        break;
      }
    }

    if (targetIndex === -1) return null;

    // Normalize: if dropping right before or right after the source position, that's a no-op
    const effectiveIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    if (effectiveIndex === fromIndex) return null;

    console.log("COLUMN DRAG DEBUG", {
      draggedColumnId: colName,
      fromIndex,
      targetIndex,
      effectiveIndex,
      pointerX: clientX,
      isRTL: true,
      currentOrder: columns.map((c) => c.name),
    });

    return targetIndex;
  };

  const getHeaderProps = (colName, idx) => ({
    ref: (el) => { headerRefs.current[colName] = el; },
    onDragOver: (e) => {
      if (!dragState.dragging || dragState.dragging === colName) return;
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
      if (dropIndex === null) return;

      const fromIndex = columns.findIndex((c) => c.name === dragged);
      if (fromIndex === -1) return;

      const next = [...columns];
      const [moved] = next.splice(fromIndex, 1);
      const toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
      next.splice(toIndex, 0, moved);

      console.log("COLUMN DROP RESULT", {
        movedColumn: moved.name,
        fromIndex,
        toIndex,
        newOrder: next.map((c) => c.name),
      });

      onReorder(next);
    },
  });

  return { dragState, getDragHandleProps, getHeaderProps };
}
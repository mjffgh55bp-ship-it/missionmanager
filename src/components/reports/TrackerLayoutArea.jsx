import React, { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TrackerTable from "./TrackerTable";
import SnapGuides from "./SnapGuides";

const SNAP_THRESHOLD = 8; // px

function computeSnap(activeId, activeSizeW, activeSizeH, allRects, containerWidth) {
  // activeId: tracker id being resized
  // activeSizeW/H: current (live) width/height of the active element
  // allRects: map of id -> { x, y, width, height } relative to container
  // Returns: { snappedW, snappedH, guides }

  const others = Object.entries(allRects).filter(([id]) => id !== activeId);
  const guides = [];
  let snappedW = activeSizeW;
  let snappedH = activeSizeH;

  const checkSnap = (val, targets, isWidth) => {
    for (const t of targets) {
      if (Math.abs(val - t.value) <= SNAP_THRESHOLD) {
        guides.push({ type: isWidth ? "v" : "h", pos: t.pos, matchType: t.matchType });
        return t.value;
      }
    }
    return val;
  };

  // Width snapping: snap right edge to others' right edges / widths
  const wTargets = [
    // Container right edge
    { value: containerWidth, pos: containerWidth, matchType: "edge" },
  ];
  for (const [, rect] of others) {
    // Match exact width
    wTargets.push({ value: rect.width, pos: rect.x + rect.width, matchType: "size" });
    // Match right edge alignment
    wTargets.push({ value: rect.x + rect.width, pos: rect.x + rect.width, matchType: "edge" });
  }
  snappedW = checkSnap(activeSizeW, wTargets, true);

  // Height snapping
  const hTargets = [];
  for (const [, rect] of others) {
    hTargets.push({ value: rect.height, pos: rect.y + rect.height, matchType: "size" });
  }
  snappedH = checkSnap(activeSizeH, hTargets, false);

  // Spacing: check if gap to neighbor equals gap between other pairs
  // (simplified: flag when width matches another)
  const activeRect = allRects[activeId];
  if (activeRect) {
    for (const [, rect] of others) {
      // Equal spacing between consecutive tables (vertical)
      const gapAbove = activeRect.y - (rect.y + rect.height);
      const gapBelow = rect.y - (activeRect.y + activeSizeH);
      for (const [, rect2] of others) {
        if (rect2 === rect) continue;
        const gap2 = rect2.y - (rect.y + rect.height);
        if (Math.abs(gapAbove - gap2) < SNAP_THRESHOLD && gapAbove > 0) {
          guides.push({ type: "h", pos: activeRect.y, matchType: "spacing" });
        }
        if (Math.abs(gapBelow - gap2) < SNAP_THRESHOLD && gapBelow > 0) {
          guides.push({ type: "h", pos: activeRect.y + activeSizeH, matchType: "spacing" });
        }
      }
    }
  }

  return { snappedW, snappedH, guides };
}

export default function TrackerLayoutArea({
  trackers,
  workers, assignments, templateRows, allTemplates,
  populations, workerRoles, scheduleColumns, qualifications,
  onDeleteTracker, onUpdatedTracker, onReorderTrackers,
}) {
  const [trackerSizes, setTrackerSizes] = useState({});
  const [snapGuides, setSnapGuides] = useState([]);
  const [activeResizeId, setActiveResizeId] = useState(null);
  const containerRef = useRef(null);
  const elRefs = useRef({}); // id -> DOM element

  // Collect rects relative to container scroll top
  const getAllRects = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return {};
    const containerRect = containerEl.getBoundingClientRect();
    const rects = {};
    for (const [id, el] of Object.entries(elRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rects[id] = {
        x: r.left - containerRect.left,
        y: r.top - containerRect.top + containerEl.scrollTop,
        width: r.width,
        height: r.height,
      };
    }
    return rects;
  }, []);

  const handleMouseMove = useCallback((e, trackerId) => {
    // Only active when resize handle is being dragged
    // We detect resize drag by watching if size changes during mousemove
    if (activeResizeId !== trackerId) return;
    const el = elRefs.current[trackerId];
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const allRects = getAllRects();
    const containerW = containerRef.current?.offsetWidth || 800;
    const { guides } = computeSnap(trackerId, w, h, allRects, containerW);
    setSnapGuides(guides);
  }, [activeResizeId, getAllRects]);

  const handleMouseDown = useCallback((e, trackerId) => {
    // Only trigger on resize corner (bottom-right ~20px area)
    const el = elRefs.current[trackerId];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fromRight = rect.right - e.clientX;
    const fromBottom = rect.bottom - e.clientY;
    if (fromRight <= 20 && fromBottom <= 20) {
      setActiveResizeId(trackerId);
    }
  }, []);

  const handleMouseUp = useCallback((e, trackerId) => {
    const el = elRefs.current[trackerId];
    if (!el) return;
    let w = el.offsetWidth;
    let h = el.offsetHeight;

    if (activeResizeId === trackerId) {
      // Apply snap
      const allRects = getAllRects();
      const containerW = containerRef.current?.offsetWidth || 800;
      const { snappedW, snappedH } = computeSnap(trackerId, w, h, allRects, containerW);
      w = snappedW;
      h = snappedH;
    }

    setTrackerSizes(prev => ({ ...prev, [trackerId]: { width: w, height: h } }));
    setActiveResizeId(null);
    setSnapGuides([]);

    // Apply snapped size to DOM element
    if (el) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }
  }, [activeResizeId, getAllRects]);

  // Global mousemove to track during resize even if cursor leaves element
  useEffect(() => {
    if (!activeResizeId) return;
    const onMove = (e) => {
      const el = elRefs.current[activeResizeId];
      if (!el) return;
      const allRects = getAllRects();
      const containerW = containerRef.current?.offsetWidth || 800;
      const { guides } = computeSnap(activeResizeId, el.offsetWidth, el.offsetHeight, allRects, containerW);
      setSnapGuides(guides);
    };
    const onUp = () => {
      setActiveResizeId(null);
      setSnapGuides([]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [activeResizeId, getAllRects]);

  const containerClientRect = containerRef.current?.getBoundingClientRect() || null;

  return (
    <div ref={containerRef} className="relative">
      {/* Snap guides rendered over everything */}
      <SnapGuides guides={snapGuides} containerRect={containerClientRect} />

      <DragDropContext onDragEnd={onReorderTrackers}>
        <Droppable droppableId="trackers">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={snapshot.isDraggingOver ? "bg-blue-50 rounded-lg" : ""}
            >
              {trackers.map((tracker, idx) => {
                const size = trackerSizes[tracker.id];
                const isActive = activeResizeId === tracker.id;
                return (
                  <Draggable key={tracker.id} draggableId={tracker.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={(el) => {
                          provided.innerRef(el);
                          elRefs.current[tracker.id] = el;
                        }}
                        {...provided.draggableProps}
                        className="relative mb-6 border rounded-lg bg-white"
                        style={{
                          ...provided.draggableProps.style,
                          resize: "both",
                          overflow: "auto",
                          minWidth: "320px",
                          minHeight: "150px",
                          width: size ? `${size.width}px` : "100%",
                          height: size ? `${size.height}px` : "auto",
                          borderColor: isActive ? "#3b82f6" : "#e5e7eb",
                          boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.3)" : undefined,
                          transition: "border-color 0.1s, box-shadow 0.1s",
                        }}
                        onMouseDown={(e) => handleMouseDown(e, tracker.id)}
                        onMouseUp={(e) => handleMouseUp(e, tracker.id)}
                        onMouseMove={(e) => handleMouseMove(e, tracker.id)}
                      >
                        {/* Drag handle header */}
                        <div className="sticky top-0 z-20 bg-white border-b flex items-center justify-between px-4 py-3">
                          <div className="text-sm font-semibold text-gray-700">{tracker.name}</div>
                          <div className="flex items-center gap-2">
                            {/* Size indicator when resizing */}
                            {isActive && size && (
                              <span className="text-xs text-blue-500 font-mono bg-blue-50 px-2 py-0.5 rounded">
                                {size.width}×{size.height}
                              </span>
                            )}
                            <div
                              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                              {...provided.dragHandleProps}
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
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
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
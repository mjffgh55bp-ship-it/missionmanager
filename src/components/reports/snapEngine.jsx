/**
 * Shared snap engine for free-canvas layout.
 * Works for both drag (position snapping) and resize (size snapping).
 */

const SNAP_THRESHOLD = 10; // px

/**
 * Given the active item's rect and all other rects,
 * returns snapped { x, y } and snap guides to render.
 *
 * allRects: { [id]: { x, y, w, h } }
 * activeRect: { x, y, w, h }
 * containerW: number
 */
export function snapPosition(activeRect, allRects, containerW) {
  const { x, y, w, h } = activeRect;

  // Candidate edges of the active item
  const activeLeft = x;
  const activeRight = x + w;
  const activeCenterX = x + w / 2;
  const activeTop = y;
  const activeBottom = y + h;
  const activeCenterY = y + h / 2;

  let snappedX = x;
  let snappedY = y;
  const guides = [];

  // Container boundaries
  const containerTargetsX = [
    { val: 0, label: "containerLeft", isEdge: true },
    { val: containerW - w, label: "containerRight", isEdge: true },
  ];

  // Build snap targets from other items
  const othersX = []; // { snapActiveLeft, snapActiveRight, pos, matchType }
  const othersY = [];

  for (const rect of Object.values(allRects)) {
    const { x: rx, y: ry, w: rw, h: rh } = rect;
    // X: align lefts, align rights, align left-to-right, align right-to-left, centers
    othersX.push(
      { snapActive: rx,           guidePos: rx,           type: "v", matchType: "edge" },        // left-left
      { snapActive: rx + rw - w,  guidePos: rx + rw,      type: "v", matchType: "edge" },        // right-right
      { snapActive: rx + rw,      guidePos: rx + rw,      type: "v", matchType: "edge" },        // active-left to other-right
      { snapActive: rx - w,       guidePos: rx,           type: "v", matchType: "edge" },        // active-right to other-left
      { snapActive: rx + rw/2 - w/2, guidePos: rx + rw/2, type: "v", matchType: "center" },     // center-center
    );
    othersY.push(
      { snapActive: ry,           guidePos: ry,           type: "h", matchType: "edge" },
      { snapActive: ry + rh - h,  guidePos: ry + rh,      type: "h", matchType: "edge" },
      { snapActive: ry + rh,      guidePos: ry + rh,      type: "h", matchType: "edge" },
      { snapActive: ry - h,       guidePos: ry,           type: "h", matchType: "edge" },
      { snapActive: ry + rh/2 - h/2, guidePos: ry + rh/2, type: "h", matchType: "center" },
    );

    // Spacing: equal gap snapping
    // horizontal spacing
    const gapRight = rx - (x + w); // gap if we're to the left of rect
    const gapLeft = x - (rx + rw); // gap if we're to the right of rect
    for (const rect2 of Object.values(allRects)) {
      if (rect2 === rect) continue;
      const gap2 = rect2.x - (rect.x + rect.w);
      if (gap2 > 0) {
        // snap so gap between active and rect equals gap2
        othersX.push({ snapActive: rx + rw + gap2, guidePos: rx + rw + gap2, type: "v", matchType: "spacing" });
        othersX.push({ snapActive: rx - gap2 - w, guidePos: rx - gap2, type: "v", matchType: "spacing" });
      }
      const gapY2 = rect2.y - (rect.y + rect.h);
      if (gapY2 > 0) {
        othersY.push({ snapActive: ry + rh + gapY2, guidePos: ry + rh + gapY2, type: "h", matchType: "spacing" });
        othersY.push({ snapActive: ry - gapY2 - h, guidePos: ry - gapY2, type: "h", matchType: "spacing" });
      }
    }
  }

  // Container left/right
  othersX.push({ snapActive: 0, guidePos: 0, type: "v", matchType: "edge" });
  othersX.push({ snapActive: containerW - w, guidePos: containerW, type: "v", matchType: "edge" });

  // Try snap X
  for (const t of othersX) {
    if (Math.abs(activeLeft - t.snapActive) <= SNAP_THRESHOLD) {
      snappedX = t.snapActive;
      guides.push({ type: t.type, pos: t.guidePos, matchType: t.matchType });
      break;
    }
  }

  // Try snap Y
  for (const t of othersY) {
    if (Math.abs(activeTop - t.snapActive) <= SNAP_THRESHOLD) {
      snappedY = t.snapActive;
      guides.push({ type: t.type, pos: t.guidePos, matchType: t.matchType });
      break;
    }
  }

  return { snappedX: Math.max(0, snappedX), snappedY: Math.max(0, snappedY), guides };
}

/**
 * Snap resize: given active item's current width/height,
 * snap to match other items' widths/heights or container edge.
 *
 * Returns { snappedW, snappedH, guides }
 */
export function snapResize(activeId, activePos, currentW, currentH, allRects, containerW) {
  let snappedW = currentW;
  let snappedH = currentH;
  const guides = [];

  const activeRight = activePos.x + currentW;
  const activeBottom = activePos.y + currentH;

  for (const [id, rect] of Object.entries(allRects)) {
    if (id === activeId) continue;

    // Match width
    if (Math.abs(currentW - rect.w) <= SNAP_THRESHOLD) {
      snappedW = rect.w;
      guides.push({ type: "v", pos: activePos.x + snappedW, matchType: "size" });
    }
    // Match height
    if (Math.abs(currentH - rect.h) <= SNAP_THRESHOLD) {
      snappedH = rect.h;
      guides.push({ type: "h", pos: activePos.y + snappedH, matchType: "size" });
    }
    // Snap right edge to other right edges
    if (Math.abs(activeRight - (rect.x + rect.w)) <= SNAP_THRESHOLD) {
      snappedW = rect.x + rect.w - activePos.x;
      guides.push({ type: "v", pos: rect.x + rect.w, matchType: "edge" });
    }
    // Snap bottom edge to other bottom edges
    if (Math.abs(activeBottom - (rect.y + rect.h)) <= SNAP_THRESHOLD) {
      snappedH = rect.y + rect.h - activePos.y;
      guides.push({ type: "h", pos: rect.y + rect.h, matchType: "edge" });
    }
  }

  // Snap right edge to container
  if (Math.abs(activeRight - containerW) <= SNAP_THRESHOLD) {
    snappedW = containerW - activePos.x;
    guides.push({ type: "v", pos: containerW, matchType: "edge" });
  }

  return { snappedW: Math.max(200, snappedW), snappedH: Math.max(100, snappedH), guides };
}
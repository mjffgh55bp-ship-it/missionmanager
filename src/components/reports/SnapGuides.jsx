import React from "react";

/**
 * Renders snap guide lines as absolute overlays in the container.
 * guides: array of { type: 'h'|'v', pos: number, matchType: 'edge'|'center'|'size'|'spacing' }
 * containerRect: DOMRect of the scroll container
 */
export default function SnapGuides({ guides, containerRect }) {
  if (!guides || guides.length === 0 || !containerRect) return null;

  return (
    <>
      {guides.map((g, i) => {
        const isSize = g.matchType === "size";
        const isSpacing = g.matchType === "spacing";
        const color = isSize ? "#f59e0b" : isSpacing ? "#10b981" : "#3b82f6";
        const opacity = isSize ? 0.9 : 0.75;

        if (g.type === "h") {
          return (
            <div
              key={i}
              style={{
                position: "fixed",
                left: containerRect.left,
                top: containerRect.top + g.pos,
                width: containerRect.width,
                height: isSize ? 2 : 1,
                background: color,
                opacity,
                pointerEvents: "none",
                zIndex: 9999,
                boxShadow: isSize ? `0 0 6px ${color}` : "none",
              }}
            />
          );
        } else {
          return (
            <div
              key={i}
              style={{
                position: "fixed",
                top: containerRect.top,
                left: containerRect.left + g.pos,
                height: containerRect.height,
                width: isSize ? 2 : 1,
                background: color,
                opacity,
                pointerEvents: "none",
                zIndex: 9999,
                boxShadow: isSize ? `0 0 6px ${color}` : "none",
              }}
            />
          );
        }
      })}
    </>
  );
}
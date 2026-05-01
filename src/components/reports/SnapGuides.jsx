import React from "react";

/**
 * Renders snap guide lines as absolute overlays within a relative container.
 * guides: array of { type: 'h'|'v', pos: number, matchType: 'edge'|'center'|'size'|'spacing' }
 * containerRect: used only for fixed-mode (unused now — we use absolute in-container positioning)
 */
export default function SnapGuides({ guides, containerRect }) {
  if (!guides || guides.length === 0) return null;

  return (
    <>
      {guides.map((g, i) => {
        const isSize = g.matchType === "size";
        const isSpacing = g.matchType === "spacing";
        const isCenter = g.matchType === "center";
        const color = isSize ? "#f59e0b" : isSpacing ? "#10b981" : isCenter ? "#8b5cf6" : "#3b82f6";

        if (g.type === "h") {
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: g.pos,
                height: isSize ? 2 : 1,
                background: color,
                opacity: 0.85,
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
                position: "absolute",
                top: 0,
                bottom: 0,
                left: g.pos,
                width: isSize ? 2 : 1,
                background: color,
                opacity: 0.85,
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
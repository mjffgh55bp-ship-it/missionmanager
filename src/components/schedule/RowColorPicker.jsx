import React, { useState, useRef, useEffect } from "react";

const PALETTE = [
  "#fef9c3", // yellow
  "#fde68a", // amber
  "#fed7aa", // orange
  "#fecaca", // red
  "#d1fae5", // green
  "#bfdbfe", // blue
  "#e9d5ff", // purple
  "#fbcfe8", // pink
  "#f3f4f6", // gray
  null,       // clear / no color
];

export default function RowColorPicker({ currentColor, onColorChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
      <button
        title="צבע שורה"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-4 h-4 rounded-sm border border-gray-300 hover:border-gray-500 transition-colors flex-shrink-0"
        style={{ background: currentColor || "#ffffff" }}
      />
      {open && (
        <div
          className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 flex flex-wrap gap-1"
          style={{ top: "calc(100% + 4px)", right: 0, width: 110 }}
          onClick={e => e.stopPropagation()}
        >
          {PALETTE.map((color, i) => (
            <button
              key={i}
              title={color || "ללא צבע"}
              onClick={() => { onColorChange(color); setOpen(false); }}
              className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
              style={{ background: color || "#ffffff" }}
            >
              {!color && <span className="text-gray-400 text-[10px] leading-none flex items-center justify-center w-full h-full">✕</span>}
              {currentColor === color && color && (
                <span className="text-[10px] flex items-center justify-center text-gray-600">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
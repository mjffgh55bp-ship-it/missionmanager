import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 00–24 same day, +1 00–24 next day, +2 00–24 two days later
const HOURS = [
  ...Array.from({ length: 25 }, (_, i) => String(i).padStart(2, "0")),
  ...Array.from({ length: 25 }, (_, i) => `+1 ${String(i).padStart(2, "0")}`),
  ...Array.from({ length: 25 }, (_, i) => `+2 ${String(i).padStart(2, "0")}`),
];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export default function TimeCell({ rowId, colName, value, defaultValue, rowValues, onSaved }) {
  const [localValue, setLocalValue] = useState(value || "");
  const [open, setOpen] = useState(false);
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  // Scroll selected item into view when popover opens
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (hourRef.current) {
        const sel = hourRef.current.querySelector("[data-selected=true]");
        if (sel) sel.scrollIntoView({ block: "center" });
      }
      if (minRef.current) {
        const sel = minRef.current.querySelector("[data-selected=true]");
        if (sel) sel.scrollIntoView({ block: "center" });
      }
    }, 50);
  }, [open]);

  const selectedHour = localValue ? localValue.split(":")[0] : null;
  const selectedMin = localValue ? localValue.split(":")[1] : null;

  const handleSelect = async (hour, min) => {
    const newVal = `${hour}:${min}`;
    setLocalValue(newVal);
    setOpen(false);
    const newValues = { ...rowValues, [colName]: newVal };
    await base44.entities.TemplateRow.update(rowId, { values: newValues });
    onSaved(newValues);
  };

  const handleHourClick = (h) => {
    const min = selectedMin || "00";
    handleSelect(h, min);
  };

  const handleMinClick = (m) => {
    const hour = selectedHour || "00";
    handleSelect(hour, m);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-full text-sm text-center py-2 px-1 hover:bg-blue-50 transition-colors">
          {localValue || <span className="text-gray-400">{defaultValue || "--:--"}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-44 p-2 z-50" align="center">
        <div className="flex gap-1 h-48" dir="ltr">
          {/* Hours */}
          <div ref={hourRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="text-center text-[10px] text-gray-400 mb-1 sticky top-0 bg-white">שעה</div>
            {HOURS.map(h => (
              <button
                key={h}
                data-selected={h === selectedHour}
                onClick={() => handleHourClick(h)}
                className={`w-full text-center py-1 rounded text-sm font-mono transition-colors ${
                  h === selectedHour
                    ? "bg-blue-600 text-white font-bold"
                    : "hover:bg-gray-100 text-gray-800"
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          <div className="w-px bg-gray-200" />

          {/* Minutes */}
          <div ref={minRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="text-center text-[10px] text-gray-400 mb-1 sticky top-0 bg-white">דקות</div>
            {MINUTES.map(m => (
              <button
                key={m}
                data-selected={m === selectedMin}
                onClick={() => handleMinClick(m)}
                className={`w-full text-center py-1 rounded text-sm font-mono transition-colors ${
                  m === selectedMin
                    ? "bg-blue-600 text-white font-bold"
                    : "hover:bg-gray-100 text-gray-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {localValue && (
          <button
            onClick={async () => {
              setLocalValue("");
              setOpen(false);
              const newValues = { ...rowValues, [colName]: "" };
              await base44.entities.TemplateRow.update(rowId, { values: newValues });
              onSaved(newValues);
            }}
            className="mt-2 w-full text-xs text-red-500 hover:text-red-700 text-center"
          >
            נקה
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
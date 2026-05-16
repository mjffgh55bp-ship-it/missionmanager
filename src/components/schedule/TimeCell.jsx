import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─── Operational day: 06:00 → next-day 06:00 ────────────────────────────────
// Roller structure:
//   [PREV DAY]  − 04:00 … − 05:00
//   ── תחילת יממה מבצעית 06:00 ──
//   [CUR DAY]   06:00 … 23:00, 00:00 … 05:00
//   ── סוף יממה מבצעית 06:00 ──
//   [NEXT DAY]  +1 06:00 … +1 23:00, +1 00:00 … +1 05:00
//   [NEXT+1 DAY]+2 06:00 … +2 05:00

// Hour entries: { display, value, zone }
// zone: "prev" | "cur" | "next1" | "next2"
const buildHourEntries = () => {
  const entries = [];

  // Previous-day hours that may appear before 06:00 (for briefings etc.)
  for (let h = 0; h <= 5; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: `-1 ${String(h).padStart(2, "0")}`, zone: "prev" });
  }

  entries.push({ type: "boundary", label: "תחילת יממה מבצעית  06:00" });

  // Current operational day: 06:00–23:00, then 00:00–05:00
  for (let h = 6; h <= 23; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: String(h).padStart(2, "0"), zone: "cur" });
  }
  for (let h = 0; h <= 5; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: String(h).padStart(2, "0"), zone: "cur" });
  }

  entries.push({ type: "boundary", label: "סוף יממה מבצעית  06:00" });

  // Next day (+1): 06:00–23:00, then 00:00–05:00
  for (let h = 6; h <= 23; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: `+1 ${String(h).padStart(2, "0")}`, zone: "next1" });
  }
  for (let h = 0; h <= 5; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: `+1 ${String(h).padStart(2, "0")}`, zone: "next1" });
  }

  // Next+1 day (+2): 06:00–23:00, then 00:00–05:00
  for (let h = 6; h <= 23; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: `+2 ${String(h).padStart(2, "0")}`, zone: "next2" });
  }
  for (let h = 0; h <= 5; h++) {
    entries.push({ display: String(h).padStart(2, "0"), value: `+2 ${String(h).padStart(2, "0")}`, zone: "next2" });
  }

  return entries;
};

const HOUR_ENTRIES = buildHourEntries();
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// ─── Value format ─────────────────────────────────────────────────────────────
// Stored: "HH:MM" | "+N HH:MM" | "-1 HH:MM"
// Display in trigger: "HH:MM" | "+N HH:MM" | "−HH:MM"

const parseValue = (v) => {
  if (!v) return { hourValue: null, min: null };

  // "-1 HH:MM" — prev day
  const prevMatch = v.match(/^-1\s+(\d{2}):(\d{2})$/);
  if (prevMatch) return { hourValue: `-1 ${prevMatch[1]}`, min: prevMatch[2] };

  // "+N HH:MM" — next day(s)
  const plusMatch = v.match(/^(\+\d+)\s+(\d{2}):(\d{2})$/);
  if (plusMatch) return { hourValue: `${plusMatch[1]} ${plusMatch[2]}`, min: plusMatch[3] };

  // "HH:MM" — current day
  const plain = v.match(/^(\d{2}):(\d{2})$/);
  if (plain) return { hourValue: plain[1], min: plain[2] };

  return { hourValue: null, min: null };
};

const buildStoredValue = (hourValue, min) => {
  if (!hourValue) return null;
  // "-1 HH" → "-1 HH:MM"
  if (hourValue.startsWith("-1 ")) return `${hourValue}:${min}`;
  // "+N HH" → "+N HH:MM"
  if (hourValue.startsWith("+")) return `${hourValue}:${min}`;
  // "HH" → "HH:MM"
  return `${hourValue}:${min}`;
};

const formatTriggerDisplay = (storedValue) => {
  if (!storedValue) return null;

  // "-1 HH:MM" → "− HH:MM" in purple
  const prevMatch = storedValue.match(/^-1\s+(\d{2}:\d{2})$/);
  if (prevMatch) {
    return <span className="text-purple-600 font-bold">− {prevMatch[1]}</span>;
  }

  // "+N HH:MM" → orange prefix
  const plusMatch = storedValue.match(/^(\+\d+)\s+(\d{2}:\d{2})$/);
  if (plusMatch) {
    return (
      <span>
        <span className="text-orange-600 font-bold text-[10px]">{plusMatch[1]} </span>
        {plusMatch[2]}
      </span>
    );
  }

  return storedValue;
};

export default function TimeCell({ rowId, colName, value, defaultValue, rowValues, onSaved }) {
  const [localValue, setLocalValue] = useState(value || "");
  const [open, setOpen] = useState(false);
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => { setLocalValue(value || ""); }, [value]);

  // Scroll selected hour into view when popover opens
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

  const parsed = parseValue(localValue);
  const selectedHourValue = parsed.hourValue;
  const selectedMin = parsed.min;

  const handleSelect = async (hourValue, min) => {
    const newVal = buildStoredValue(hourValue, min);
    if (!newVal) return;
    setLocalValue(newVal);
    setOpen(false);
    const newValues = { ...rowValues, [colName]: newVal };
    await base44.entities.TemplateRow.update(rowId, { values: newValues });
    onSaved(newValues);
  };

  const handleHourClick = (hourValue) => {
    const min = selectedMin || "00";
    handleSelect(hourValue, min);
  };

  const handleMinClick = (m) => {
    const hv = selectedHourValue || "06";
    handleSelect(hv, m);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-full text-sm text-center py-2 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap">
          {localValue ? formatTriggerDisplay(localValue) : (
            <span className="text-gray-400">{defaultValue || "--:--"}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-2 z-50" align="center">
        <div className="flex gap-1 h-56" dir="ltr">
          {/* Hours roller */}
          <div ref={hourRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="text-center text-[10px] text-gray-400 mb-1 sticky top-0 bg-white z-10">שעה</div>
            {HOUR_ENTRIES.map((entry, idx) => {
              // Boundary divider
              if (entry.type === "boundary") {
                return (
                  <div key={`boundary-${idx}`} className="flex items-center gap-1 py-1 px-1 my-0.5">
                    <div className="flex-1 h-px bg-gray-400" />
                    <span className="text-[8px] font-bold text-gray-500 whitespace-nowrap leading-tight text-center">{entry.label}</span>
                    <div className="flex-1 h-px bg-gray-400" />
                  </div>
                );
              }

              const isSelected = entry.value === selectedHourValue;
              const isPrev = entry.zone === "prev";
              const isNext = entry.zone === "next1" || entry.zone === "next2";

              let btnClass = "w-full text-center py-0.5 rounded text-sm font-mono transition-colors flex items-center justify-center gap-1 ";
              if (isSelected) {
                btnClass += "bg-blue-600 text-white font-bold";
              } else if (isPrev) {
                btnClass += "text-purple-600 hover:bg-purple-50";
              } else if (isNext) {
                btnClass += "text-orange-700 hover:bg-orange-50";
              } else {
                btnClass += "text-gray-800 hover:bg-gray-100";
              }

              return (
                <button
                  key={`${entry.value}-${idx}`}
                  data-selected={isSelected}
                  onClick={() => handleHourClick(entry.value)}
                  className={btnClass}
                >
                  {isPrev && <span className="text-[9px] font-bold leading-none">−</span>}
                  {isNext && <span className="text-[9px] font-bold leading-none">+</span>}
                  {entry.display}
                </button>
              );
            })}
          </div>

          <div className="w-px bg-gray-200" />

          {/* Minutes roller */}
          <div ref={minRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="text-center text-[10px] text-gray-400 mb-1 sticky top-0 bg-white z-10">דקות</div>
            {MINUTES.map(m => (
              <button
                key={m}
                data-selected={m === selectedMin}
                onClick={() => handleMinClick(m)}
                className={`w-full text-center py-0.5 rounded text-sm font-mono transition-colors ${
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
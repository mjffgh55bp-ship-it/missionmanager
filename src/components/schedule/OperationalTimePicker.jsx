import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─── Hour entries ──────────────────────────────────────────────────────────────
// Zones: "prev" (−1), "cur" (0), "next1" (+1), "next2" (+2)
const buildHourEntries = () => {
  const entries = [];

  // Previous-day hours 00–05 (for briefings before 06:00 of the current operational day)
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

// ─── Parse / build stored value ───────────────────────────────────────────────
// Stored formats: "HH:MM" | "-1 HH:MM" | "+1 HH:MM" | "+2 HH:MM"

export function parseTimeCellLocal(v) {
  if (!v) return { hourValue: null, min: null };
  const prevMatch = v.match(/^-1\s+(\d{2}):(\d{2})$/);
  if (prevMatch) return { hourValue: `-1 ${prevMatch[1]}`, min: prevMatch[2] };
  const plusMatch = v.match(/^(\+\d+)\s+(\d{2}):(\d{2})$/);
  if (plusMatch) return { hourValue: `${plusMatch[1]} ${plusMatch[2]}`, min: plusMatch[3] };
  const plain = v.match(/^(\d{2}):(\d{2})$/);
  if (plain) return { hourValue: plain[1], min: plain[2] };
  return { hourValue: null, min: null };
}

export function buildStoredValue(hourValue, min) {
  if (!hourValue) return null;
  if (hourValue.startsWith("-1 ")) return `${hourValue}:${min}`;
  if (hourValue.startsWith("+")) return `${hourValue}:${min}`;
  return `${hourValue}:${min}`;
}

// ─── Trigger display ──────────────────────────────────────────────────────────
export function formatTimeTrigger(storedValue) {
  if (!storedValue) return null;
  const prevMatch = storedValue.match(/^-1\s+(\d{2}:\d{2})$/);
  if (prevMatch) return <span className="text-purple-600 font-bold">− {prevMatch[1]}</span>;
  const plusMatch = storedValue.match(/^(\+\d+)\s+(\d{2}:\d{2})$/);
  if (plusMatch) return (
    <span>
      <span className="text-orange-600 font-bold text-[10px]">{plusMatch[1]} </span>
      {plusMatch[2]}
    </span>
  );
  return storedValue;
}

/**
 * OperationalTimePicker
 *
 * Props:
 *   value        — stored time string (plain "HH:MM", "-1 HH:MM", "+N HH:MM")
 *   onChange     — called with new stored value string (does NOT persist itself)
 *   placeholder  — text shown when no value (default "--:--")
 *   allowClear   — show "נקה" button (default true)
 *   compact      — smaller trigger button (default false)
 */
export default function OperationalTimePicker({
  value,
  onChange,
  placeholder = "--:--",
  allowClear = true,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [hourInput, setHourInput] = useState("");
  const [mode, setMode] = useState("hour"); // "hour" | "minute" – two-phase typing
  const inputRef = useRef(null);
  const hourRef = useRef(null);
  const minRef = useRef(null);

  const parsed = parseTimeCellLocal(value);
  // localHourValue tracks the currently highlighted hour inside the popover
  // (may differ from stored value until a minute is chosen or Enter is pressed)
  const [localHourValue, setLocalHourValue] = useState(parsed.hourValue);

  // Reset local selection & mode when popover opens, auto-focus input
  useEffect(() => {
    setLocalHourValue(parsed.hourValue);
    setHourInput("");
    setMode("hour");
  }, [open, parsed.hourValue]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

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

  const handleSelect = (hourValue, min) => {
    const newVal = buildStoredValue(hourValue, min);
    if (!newVal) return;
    setOpen(false);
    onChange(newVal);
  };

  // Hour click only highlights — does NOT close or save
  const handleHourClick = (hourValue) => {
    setLocalHourValue(hourValue);
  };

  // Minute click finalizes: close + save with selected hour
  const handleMinClick = (m) => {
    const hv = localHourValue || parsed.hourValue || "06";
    handleSelect(hv, m);
  };

  // Live hour matching as user types digits
  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHourInput(raw);
    if (raw.length >= 1) {
      const padded = raw.padStart(2, "0");
      const isMinuteMode = mode === "minute";
      if (isMinuteMode) {
        // In minute mode, only accept valid minute values
        if (padded.length === 2 && MINUTES.includes(padded)) {
          setHourInput(padded);
        }
        return;
      }
      // Hour mode: live highlight matching hour (current operational day only)
      const matched = HOUR_ENTRIES.find(
        entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === padded
      );
      if (matched) setLocalHourValue(matched.value);
    }
  };

  // Enter key: two-phase flow — hour first, then minute
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (mode === "hour") {
      let resolvedHour = localHourValue || parsed.hourValue;
      if (hourInput.trim()) {
        const padded = hourInput.trim().padStart(2, "0");
        const matched = HOUR_ENTRIES.find(
          entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === padded
        );
        if (matched) resolvedHour = matched.value;
      }
      if (!resolvedHour) return;
      setLocalHourValue(resolvedHour);
      setHourInput("");
      setMode("minute");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Minute mode — finalize
      if (hourInput.trim()) {
        const m = hourInput.trim().padStart(2, "0");
        if (MINUTES.includes(m)) {
          handleSelect(localHourValue || parsed.hourValue || "06", m);
        }
      }
    }
  };

  const handleClear = () => {
    setOpen(false);
    onChange("");
  };

  const triggerClass = compact
    ? "w-full h-full text-xs text-center py-1 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap"
    : "w-full h-full text-sm text-center py-2 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={triggerClass}>
          {value ? formatTimeTrigger(value) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-2 z-50" align="center">
        <div className="flex gap-1 h-56" dir="ltr" onKeyDown={handleKeyDown}>
          {/* Hours roller */}
          <div ref={hourRef} className="flex-1 overflow-y-auto scroll-smooth flex flex-col">
            <div className="text-center text-[10px] text-gray-400 mb-0.5 sticky top-0 bg-white z-10">שעה</div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={hourInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={mode === "hour" ? "הקלד שעה…" : "הקלד דקות…"}
              className="w-full text-center text-xs py-0.5 border border-gray-200 rounded mb-1 bg-gray-50 focus:bg-white focus:border-blue-400 outline-none"
              dir="ltr"
            />
            {HOUR_ENTRIES.map((entry, idx) => {
              if (entry.type === "boundary") {
                return (
                  <div key={`boundary-${idx}`} className="flex items-center gap-1 py-1 px-1 my-0.5">
                    <div className="flex-1 h-px bg-gray-400" />
                    <span className="text-[8px] font-bold text-gray-500 whitespace-nowrap leading-tight text-center">{entry.label}</span>
                    <div className="flex-1 h-px bg-gray-400" />
                  </div>
                );
              }

              const isSelected = entry.value === localHourValue;
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
                data-selected={m === parsed.min}
                onClick={() => handleMinClick(m)}
                className={`w-full text-center py-0.5 rounded text-sm font-mono transition-colors ${
                  m === parsed.min
                    ? "bg-blue-600 text-white font-bold"
                    : "hover:bg-gray-100 text-gray-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {allowClear && value && (
          <button
            onClick={handleClear}
            className="mt-2 w-full text-xs text-red-500 hover:text-red-700 text-center"
          >
            נקה
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
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
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const inputRef = useRef(null);
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const autoClosedRef = useRef(false); // prevents double-fire on auto-close

  const parsed = parseTimeCellLocal(value);
  // localHourValue: currently highlighted hour in the popover
  const [localHourValue, setLocalHourValue] = useState(parsed.hourValue);
  // liveMin: live-highlighted minute as user types
  const [liveMin, setLiveMin] = useState(null);

  // On popover open: reset, pre-fill existing hour digits for plain values
  useEffect(() => {
    if (!open) return;
    autoClosedRef.current = false;
    setHasStartedTyping(false);
    setLiveMin(null);
    setLocalHourValue(parsed.hourValue);
    if (parsed.hourValue && !parsed.hourValue.startsWith("-1") && !parsed.hourValue.startsWith("+")) {
      setHourInput(parsed.hourValue);
    } else {
      setHourInput("");
    }
  }, [open]);

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

  // Continuous HHMM typing — live highlight + auto-close on 4 valid digits
  const handleInputChange = (e) => {
    if (autoClosedRef.current) return;
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setHourInput(raw);
    setHasStartedTyping(true);

    const hhRaw = raw.slice(0, 2);
    const mmRaw = raw.slice(2, 4);
    const hh = hhRaw.padStart(2, "0");

    // Live hour matching (cur zone only)
    if (hhRaw.length >= 1) {
      const matched = HOUR_ENTRIES.find(
        entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === hh
      );
      if (matched) setLocalHourValue(matched.value);
    }

    // Live minute highlighting as 3rd/4th digits arrive
    if (mmRaw.length >= 1) {
      const padded = mmRaw.padStart(2, "0");
      setLiveMin(MINUTES.includes(padded) ? padded : null);
    } else {
      setLiveMin(null);
    }

    // Auto-close when 4 digits entered and both are valid
    if (raw.length === 4 && mmRaw.length === 2) {
      const hourMatched = HOUR_ENTRIES.find(
        entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === hh
      );
      if (hourMatched && MINUTES.includes(mmRaw)) {
        autoClosedRef.current = true;
        handleSelect(hourMatched.value, mmRaw);
      }
    }
  };

  // Enter key: resolve whatever is typed/selected, save
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (autoClosedRef.current) return;

    let resolvedHour = localHourValue || parsed.hourValue;
    let resolvedMin = parsed.min || "00";

    const raw = hourInput.replace(/\D/g, "");
    const hh = raw.slice(0, 2).padStart(2, "0");
    const mm = raw.slice(2, 4);

    // Try matching typed hour
    if (raw.length >= 1) {
      const matched = HOUR_ENTRIES.find(
        entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === hh
      );
      if (matched) resolvedHour = matched.value;
    }
    // Try using typed minute if 2 digits and valid
    if (mm.length === 2 && MINUTES.includes(mm)) {
      resolvedMin = mm;
    }

    if (resolvedHour) {
      handleSelect(resolvedHour, resolvedMin);
    }
  };

  const handleClear = () => {
    setOpen(false);
    onChange("");
  };

  const triggerClass = compact
    ? "w-full h-full text-xs text-center py-1 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap outline-none"
    : "w-full h-full text-sm text-center py-2 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap outline-none";

  // Input display: formatted value when closed, formatted value when open but hasn't started typing, raw digits once typing begins
  const inputDisplayValue = open
    ? (hasStartedTyping ? hourInput : (value || ""))
    : (value || "");

  const inputStyle = (open && !hasStartedTyping) || (!open && value)
    ? {}
    : !open && !value
      ? { color: "#9ca3af" }
      : {};

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputDisplayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={triggerClass + (open ? " bg-blue-50 ring-1 ring-blue-400" : "")}
          dir="ltr"
          style={inputStyle}
        />
      </PopoverTrigger>

      <PopoverContent className="w-52 p-2 z-[60]" align="center" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex gap-1 h-56" dir="ltr" onKeyDown={handleKeyDown}>
          {/* Hours roller */}
          <div ref={hourRef} className="flex-1 overflow-y-auto scroll-smooth flex flex-col">
            <div className="text-center text-[10px] text-gray-400 mb-0.5 sticky top-0 bg-white z-10">שעה</div>
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
            {MINUTES.map(m => {
              const isSelected = hasStartedTyping ? m === liveMin : m === parsed.min;
              return (
                <button
                  key={m}
                  data-selected={isSelected}
                  onClick={() => handleMinClick(m)}
                  className={`w-full text-center py-0.5 rounded text-sm font-mono transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold"
                      : "hover:bg-gray-100 text-gray-800"
                  }`}
                >
                  {m}
                </button>
              );
            })}
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
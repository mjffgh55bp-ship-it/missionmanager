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

// Round a 2-digit minute string to nearest valid MINUTE
const roundMinute = (mm) => {
  const val = parseInt(mm, 10);
  if (isNaN(val)) return null;
  let best = MINUTES[0];
  let bestDiff = Math.abs(val - parseInt(best, 10));
  for (const m of MINUTES) {
    const diff = Math.abs(val - parseInt(m, 10));
    if (diff < bestDiff) { bestDiff = diff; best = m; }
  }
  return best;
};

// ─── Resolve + commit helper ──────────────────────────────────────────────────
const resolveAndCommit = (slots, localHourValue, parsed, handleSelectFn, setOpenFn, onChangeFn) => {
  const hh = (slots[0] === " " ? "0" : slots[0]) + (slots[1] === " " ? "0" : slots[1]);
  const hh2 = hh.padStart(2, "0");
  const mm = (slots[2] === " " ? "0" : slots[2]) + (slots[3] === " " ? "0" : slots[3]);

  // Resolve hour — match in cur zone
  let resolvedHour = localHourValue || parsed.hourValue;
  const matched = HOUR_ENTRIES.find(
    entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === hh2
  );
  if (matched) resolvedHour = matched.value;
  if (!resolvedHour) resolvedHour = hh2;

  // Resolve minute — round to nearest valid
  const mm2 = mm.padStart(2, "0");
  let resolvedMin = MINUTES.includes(mm2) ? mm2 : roundMinute(mm2);
  if (!resolvedMin) resolvedMin = "00";

  const newVal = buildStoredValue(resolvedHour, resolvedMin);
  if (newVal) {
    setOpenFn(false);
    onChangeFn(newVal);
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function OperationalTimePicker({
  value,
  onChange,
  placeholder = "--:--",
  allowClear = true,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState([" ", " ", " ", " "]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const autoClosedRef = useRef(false);
  const clickSlotRef = useRef(0);

  const parsed = parseTimeCellLocal(value);
  const [localHourValue, setLocalHourValue] = useState(parsed.hourValue);
  const [liveMin, setLiveMin] = useState(null);

  // ── Initialize slots from existing value on open ───────────────────────────
  useEffect(() => {
    if (!open) return;
    autoClosedRef.current = false;
    setLiveMin(null);
    setLocalHourValue(parsed.hourValue);

    // Pre-fill slots if the stored value is a plain "HH:MM"
    if (parsed.hourValue && !parsed.hourValue.startsWith("-1") && !parsed.hourValue.startsWith("+") && parsed.min) {
      setSlots([parsed.hourValue[0] || " ", parsed.hourValue[1] || " ", parsed.min[0] || " ", parsed.min[1] || " "]);
      setCursor(clickSlotRef.current);
    } else {
      setSlots([" ", " ", " ", " "]);
      setCursor(clickSlotRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
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

  // ── Update hour highlight + liveMin from slots ─────────────────────────────
  const syncHighlightFromSlots = (s) => {
    const hhRaw = s[0] + s[1];
    if (hhRaw.trim().length >= 1) {
      const hh2 = hhRaw.replace(/\s/g, "0").padStart(2, "0").slice(0, 2);
      const matched = HOUR_ENTRIES.find(
        entry => entry.type !== "boundary" && entry.zone === "cur" && entry.display === hh2
      );
      if (matched) setLocalHourValue(matched.value);
    }

    const mmRaw = s[2] + s[3];
    if (mmRaw.trim().length >= 1) {
      const padded = mmRaw.replace(/\s/g, "0").padStart(2, "0").slice(0, 2);
      setLiveMin(MINUTES.includes(padded) ? padded : null);
    } else {
      setLiveMin(null);
    }
  };

  const handleSelect = (hourValue, min) => {
    const newVal = buildStoredValue(hourValue, min);
    if (!newVal) return;
    setOpen(false);
    onChange(newVal);
  };

  // Hour click: fill hour slots from the roller selection
  const handleHourClick = (hourValue) => {
    const parts = hourValue.split(" ");
    const numStr = parts.length > 1 ? parts[1] : parts[0];
    const next = [...slots];
    next[0] = numStr[0] || " ";
    next[1] = numStr[1] || " ";
    setSlots(next);
    setCursor(2); // advance to minutes
    setLocalHourValue(hourValue);
    syncHighlightFromSlots(next);
    // Refocus the slot input so user can keep typing minutes
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Minute click finalizes: close + save with selected hour
  const handleMinClick = (m) => {
    const hv = localHourValue || parsed.hourValue || "06";
    handleSelect(hv, m);
  };

  const handleKeyDown = (e) => {
    // ── Enter: commit ────────────────────────────────────────────────────
    if (e.key === "Enter") {
      e.preventDefault();
      if (autoClosedRef.current) return;
      autoClosedRef.current = true;
      resolveAndCommit(slots, localHourValue, parsed, handleSelect, setOpen, onChange);
      return;
    }

    // ── Digit: overwrite at cursor ───────────────────────────────────────
    if (/^\d$/.test(e.key)) {
      e.preventDefault();

      const next = [...slots];
      next[cursor] = e.key;
      setSlots(next);
      syncHighlightFromSlots(next);

      // If this was the 4th slot (index 3), auto-commit
      if (cursor === 3) {
        autoClosedRef.current = true;
        resolveAndCommit(next, localHourValue, parsed, handleSelect, setOpen, onChange);
        return;
      }

      const newCursor = cursor + 1;
      setCursor(newCursor);
      return;
    }

    // ── Backspace: clear slot left of cursor ─────────────────────────────
    if (e.key === "Backspace") {
      e.preventDefault();
      const target = cursor > 0 ? cursor - 1 : 0;
      const next = [...slots];
      next[target] = " ";
      setSlots(next);
      setCursor(target);
      syncHighlightFromSlots(next);
      return;
    }

    // ── Arrow keys: move cursor slot ─────────────────────────────────────
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const newCursor = Math.max(cursor - 1, 0);
      setCursor(newCursor);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const newCursor = Math.min(cursor + 1, 3);
      setCursor(newCursor);
      return;
    }
  };

  const handleClear = () => {
    setOpen(false);
    onChange("");
  };

  const triggerClass = compact
    ? "w-full h-full text-xs text-center py-1 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap outline-none"
    : "w-full h-full text-sm text-center py-2 px-1 hover:bg-blue-50 transition-colors whitespace-nowrap outline-none";

  const SlotSpan = ({ idx }) => {
    const ch = slots[idx] === " " ? "-" : slots[idx];
    const isActive = open && cursor === idx;
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setCursor(idx); }}
        className={
          "inline-flex items-center justify-center w-[1ch] text-center transition-colors " +
          (isActive ? "bg-blue-600 text-white rounded-sm" : "text-gray-900")
        }
      >
        {ch}
      </span>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={inputRef}
          tabIndex={0}
          dir="ltr"
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            // 4 slots + colon: 0-22% slot0, 22-45% slot1, 45-58% colon→slot1, 58-80% slot2, 80-100% slot3
            let s;
            if (relX < 0.22) s = 0;
            else if (relX < 0.45) s = 1;
            else if (relX < 0.58) s = 1;
            else if (relX < 0.80) s = 2;
            else s = 3;
            clickSlotRef.current = s;
            inputRef.current?.focus();
          }}
          className={triggerClass + " flex items-center justify-center gap-0 font-mono cursor-text outline-none" + (open ? " bg-blue-50 ring-1 ring-blue-400" : "")}
        >
          {open ? (
            <>
              <SlotSpan idx={0} /><SlotSpan idx={1} />
              <span className="mx-0.5">:</span>
              <SlotSpan idx={2} /><SlotSpan idx={3} />
            </>
          ) : (
            value ? formatTimeTrigger(value) : <span style={{ color: "#9ca3af" }}>{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-52 p-2 z-[60]" align="center" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex gap-1 h-56" dir="ltr">
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
              // Show minute as selected if it matches liveMin, OR if typed minutes match
              const typedMm = (slots[2] === " " ? "0" : slots[2]) + (slots[3] === " " ? "0" : slots[3]);
              const typedMm2 = typedMm.replace(/\s/g, "0").padStart(2, "0").slice(0, 2);
              const isSelected = liveMin !== null ? m === liveMin : m === parsed.min;
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
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Star, Check, Ban } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  buildUnifiedShiftDemand,
  getSignupsForShift,
  calculateRoleStatus,
  workerSignedForShift,
  filterDemandForWeek,
  buildSignupKey,
  normalizeSignupType,
} from "@/lib/shiftDemand";
import { filterVisibleScheduleRows } from "@/lib/scheduleVisibility";
import { getOperationalMinutes, getOperationalEndMinutes } from "@/lib/operationalDate";
import { formatHebrewDate } from "@/components/utils/HebrewDate";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function dateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dayName = HEBREW_DAYS[d.getDay()];
  const day = d.getDate();
  const month = HEBREW_MONTHS[d.getMonth()];
  const hebrewDate = formatHebrewDate(d);
  return { dayName, shortDate: `${day} ${month}`, hebrewDate };
}

// ── Shift chip — a single time-slot button ─────────────────────────────────────
function ShiftChip({ shift, allAvailabilities, workers, myRoles, selectedShifts, signupMode, onSignup, canEdit }) {
  // requiredCount = number of row instances (not worker columns)
  const requiredCount = shift.requiredCount || 1;

  // eligibleRoles = Set of worker-column names from the template
  const eligibleRoles = shift.eligibleRoles || new Set();
  const hasMyRole = myRoles.size === 0
    ? false  // no roles on worker record
    : eligibleRoles.size === 0
    ? true   // template has no worker columns — show to everyone
    : [...myRoles].some(r => eligibleRoles.has(r));

  const signed = getSignupsForShift(allAvailabilities, shift);
  const { isFull, isOver, blocked } = calculateRoleStatus(requiredCount, signed, signupMode);

  const operationalDate = shift.operational_date || shift.date;
  // Match by signupKey first (new records), then legacy fallback
  const currentEntry = selectedShifts.find(s => {
    const active = !!s.type;
    if (!active) return false;
    // Primary: exact signupKey match only
    if (s.signupKey) return s.signupKey === shift.signupKey;
    // Legacy: rebuild from sharedMokedKey
    if (s.sharedMokedKey) {
      const legacyKey = buildSignupKey(s.operational_date || s.date, s.sharedMokedKey, s.start_time, s.end_time);
      return legacyKey === shift.signupKey;
    }
    // Oldest records: no moked identity — match by date+time only
    return (s.operational_date || s.date) === operationalDate && s.start_time === shift.startTime && s.end_time === shift.endTime;
  });
  const currentType = currentEntry?.type || null;

  const isSignedWanted = currentType === "wanted";
  const isSignedAvailable = currentType === "available";
  const isSignedUnavailable = currentType === "unavailable";

  let chipClass = "border-2 rounded-md px-1 py-1 text-xs text-center transition-all select-none w-full ";
  if (isSignedWanted) {
    chipClass += "bg-green-50 border-green-400 text-green-800 cursor-pointer";
  } else if (isSignedAvailable) {
    chipClass += "bg-blue-50 border-blue-400 text-blue-800 cursor-pointer";
  } else if (isSignedUnavailable) {
    chipClass += "bg-red-50 border-red-400 text-red-800 cursor-pointer";
  } else if (!hasMyRole) {
    chipClass += "bg-gray-50 border-gray-200 text-gray-400 cursor-default";
  } else if (blocked) {
    chipClass += "bg-red-50 border-red-200 text-red-500 cursor-not-allowed";
  } else if (isOver) {
    chipClass += "bg-orange-50 border-orange-300 text-orange-700 cursor-pointer";
  } else {
    chipClass += "bg-white border-gray-200 text-gray-700 cursor-pointer";
  }

  const handleClick = () => {
    if (!canEdit || !hasMyRole) return;

    // If not yet signed up and capacity is full in limit mode → block
    if (currentType === null && blocked) return;

    // Use first eligible role name (or null) as the roleName passed to onSignup
    const roleName = eligibleRoles.size > 0 ? [...eligibleRoles][0] : null;

    if (currentType === null) {
      onSignup && onSignup(shift, roleName, "wanted");
    } else if (currentType === "wanted") {
      onSignup && onSignup(shift, roleName, "available");
    } else if (currentType === "available") {
      onSignup && onSignup(shift, roleName, "unavailable");
    } else if (currentType === "unavailable") {
      onSignup && onSignup(shift, roleName, "remove");
    }
  };

  // Fill indicator
  const fillPct = requiredCount > 0 ? Math.min(100, Math.round((signed / requiredCount) * 100)) : 0;
  const fillColor = isOver
    ? "bg-orange-400"
    : isFull
    ? "bg-red-400"
    : fillPct >= 70
    ? "bg-yellow-400"
    : "bg-green-400";

  const isSelected = isSignedWanted || isSignedAvailable || isSignedUnavailable;

  const statusIcon = isSignedWanted ? <Star className="w-3 h-3" /> :
    isSignedAvailable ? <Check className="w-3 h-3" /> :
    isSignedUnavailable ? <Ban className="w-3 h-3" /> :
    null;

  const statusText = isSignedWanted ? "רצוי" :
    isSignedAvailable ? "זמין" :
    isSignedUnavailable ? "לא זמין" :
    null;

  const countLabel = `${signed}/${requiredCount}`;

  // Bar track and fill colors — always visible, adapted for light selected backgrounds
  const barTrackColor = isOver ? "#fed7aa" : isFull ? "#fecaca" : "#e5e7eb";
  const barFillColor = isOver ? "#f97316" : isFull ? "#ef4444" : fillPct >= 70 ? "#facc15" : "#22c55e";

  // Status badge below count
  const statusBadge = isOver
    ? <span className="text-[9px] font-semibold text-orange-600">חריגה</span>
    : blocked && !isSelected
    ? <span className="text-[9px] font-semibold text-red-500">מלא</span>
    : null;

  return (
    <button
      className={chipClass}
      onClick={handleClick}
      title={!hasMyRole ? "אין תפקיד מתאים" : blocked && !isSelected ? "המשמרת מלאה" : "לחץ לבחירה"}
      disabled={!canEdit}
    >
      {/* Time range */}
      <div className="text-[10px] sm:text-[11px] text-gray-600">{shift.startTime}–{shift.endTime}</div>

      {/* Fill bar */}
      <div className="mt-1 h-2 w-full rounded-full overflow-hidden" style={{ background: barTrackColor }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${fillPct}%`,
            background: barFillColor,
            transition: "width 0.3s ease-out",
          }}
        />
      </div>

      {/* Count + status row */}
      <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
        {isSelected && statusIcon && (
          <span className="flex items-center gap-0.5 text-[10px]">{statusIcon}</span>
        )}
        <span className={`text-[10px] font-semibold ${isOver ? "text-orange-700" : blocked ? "text-red-600" : "text-gray-700"}`}>
          {countLabel}
        </span>
        {statusBadge}
        {isSelected && statusText && (
          <span className="text-[10px] font-medium">{statusText}</span>
        )}
      </div>
    </button>
  );
}

// ── Day column ─────────────────────────────────────────────────────────────────
function DayColumn({ dateStr, shifts, allAvailabilities, workers, myRoles, selectedShifts, signupMode, onSignup, canEdit }) {
  if (shifts.length === 0) return null;

  const { dayName, shortDate, hebrewDate } = dateLabel(dateStr);

  const byMoked = {};
  shifts.forEach(s => {
    if (!byMoked[s.mokedName]) byMoked[s.mokedName] = [];
    byMoked[s.mokedName].push(s);
  });

  // Sort each moked's shifts by operational start time (06:00 = 0, 02:00 = 1200, etc.)
  Object.values(byMoked).forEach(mokedShifts => {
    mokedShifts.sort((a, b) => {
      const aStart = getOperationalMinutes(a.startTime);
      const bStart = getOperationalMinutes(b.startTime);
      if (aStart !== bStart) return aStart - bStart;
      return getOperationalEndMinutes(a.startTime, a.endTime) - getOperationalEndMinutes(b.startTime, b.endTime);
    });
  });

  return (
    <div className="flex-shrink-0 w-[100px] sm:w-[130px]" dir="rtl">
      {/* Date header */}
      <div className="text-center mb-2 pb-2 border-b border-gray-200">
        <div className="font-bold text-sm text-gray-800">{dayName}</div>
        <div className="text-xs text-gray-500">{shortDate}</div>
        <div className="text-[10px] text-gray-400">{hebrewDate}</div>
      </div>
      <div className="space-y-3">
        {Object.entries(byMoked).map(([mokedName, mokedShifts]) => (
          <div key={mokedName}>
            <div className="text-[10px] font-semibold text-blue-700 mb-1 text-center bg-blue-50 rounded px-1 py-0.5">{mokedName}</div>
            <div className="flex flex-col gap-1.5">
              {mokedShifts.map(shift => (
                <ShiftChip
                  key={shift.key}
                  shift={shift}
                  allAvailabilities={allAvailabilities}
                  workers={workers}
                  myRoles={myRoles}
                  selectedShifts={selectedShifts}
                  signupMode={signupMode}
                  onSignup={onSignup}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tap hint icons — inline SVG, one per tap count ───────────────────────────
function TapIcon({ index }) {
  // index 0 = ×1 tap (single finger), index 1 = ×2 tap (double), index 2 = ×3 tap (triple)
  const colors = ["#16a34a", "#0891b2", "#dc2626"];
  const color = colors[index];
  const dots = index + 1; // 1, 2, or 3 dots representing tap count

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Finger silhouette */}
      <path
        d="M10 2C8.9 2 8 2.9 8 4v6.5l-1.2-1.2a1.1 1.1 0 0 0-1.6 1.6l3.3 3.3c.4.4.9.8 1.5.8h3c1.1 0 2-.9 2-2V8c0-.6-.4-1-1-1s-1 .4-1 1v1c0-.6-.4-1-1-1s-1 .4-1 1V4c0-1.1-.9-2-2-2z"
        fill={color}
        opacity="0.85"
      />
      {/* Tap count dots — top-right corner */}
      {Array.from({ length: dots }).map((_, i) => (
        <circle key={i} cx={17 - i * 3.5} cy={3} r="1.8" fill={color} />
      ))}
    </svg>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function ShiftDemandPanel({
  templateRows,
  allTemplates,
  allAvailabilities,
  workers,
  currentWorker,
  selectedShifts,
  signupMode,
  weekStart,
  onSignup,
  canEdit,
  isLocked,
  onAddConstraint,
}) {
  const weekTemplateRows = useMemo(() => {
    const dates = new Set();
    for (let i = 0; i < 7; i++) dates.add(format(addDays(weekStart, i), "yyyy-MM-dd"));
    return templateRows.filter(r => dates.has(r.date));
  }, [templateRows, weekStart]);

  const visibleWeekTemplateRows = useMemo(
    () => filterVisibleScheduleRows(weekTemplateRows, allTemplates),
    [weekTemplateRows, allTemplates]
  );

  const demandMap = useMemo(
    () => buildUnifiedShiftDemand(visibleWeekTemplateRows, allTemplates),
    [visibleWeekTemplateRows, allTemplates]
  );

  const weekDemand = useMemo(
    () => filterDemandForWeek(demandMap, weekStart),
    [demandMap, weekStart]
  );

  const myRoles = useMemo(() => {
    if (!currentWorker) return new Set();
    return new Set(Array.isArray(currentWorker.role) ? currentWorker.role : [currentWorker.role].filter(Boolean));
  }, [currentWorker]);

  const byDate = {};
  weekDemand.forEach(s => {
    // Skip Saturday (day 6)
    const dayOfWeek = new Date(s.date + "T00:00:00").getDay();
    if (dayOfWeek === 6) return;
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  const dates = Object.keys(byDate).sort();

  const wantedCount = selectedShifts.filter(s => s.type === "wanted").length;
  const availableCount = selectedShifts.filter(s => s.type === "available").length;

  const isLimitMode = signupMode === "limit_sign_up";

  return (
    <Card className={`border-none shadow-lg mb-4 ${isLocked ? "opacity-60" : ""}`}>
      <CardContent className="py-3 px-4" dir="rtl">
        {weekDemand.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">אין משמרות שהוגדרו בלוח לשבוע זה</p>
        ) : (
          <>
            {/* Text instructions */}
            <div className="flex items-center gap-3 mb-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-gray-600" dir="rtl">
              <span><span className="font-semibold text-green-700">רצוי</span> – לחיצה אחת</span>
              <span className="text-gray-300">|</span>
              <span><span className="font-semibold text-cyan-700">זמין</span> – שתי לחיצות</span>
              <span className="text-gray-300">|</span>
              <span><span className="font-semibold text-red-600">לא זמין</span> – 3 לחיצות</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {dates.map(date => (
                <DayColumn
                  key={date}
                  dateStr={date}
                  shifts={byDate[date]}
                  allAvailabilities={allAvailabilities}
                  workers={workers}
                  myRoles={myRoles}
                  selectedShifts={selectedShifts}
                  signupMode={signupMode || "allow_over_sign_up"}
                  onSignup={onSignup}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
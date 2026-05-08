import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ChevronDown, ChevronUp, Users, Star, Check, Ban, Lock } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  buildUnifiedShiftDemand,
  getSignupsForRole,
  calculateRoleStatus,
  workerSignedForShift,
  filterDemandForWeek,
} from "@/lib/shiftDemand";
import { filterVisibleScheduleRows } from "@/lib/scheduleVisibility";
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
  const iSignedUp = workerSignedForShift(selectedShifts, shift);

  const myRoleEntry = Object.entries(shift.roles).find(([rName]) => myRoles.has(rName));
  const [displayRole, displayRequired] = myRoleEntry || Object.entries(shift.roles)[0] || [null, 0];

  const signed = displayRole
    ? getSignupsForRole(allAvailabilities, workers, shift, displayRole)
    : 0;
  const { isFull, isOver, blocked } = displayRole
    ? calculateRoleStatus(displayRequired, signed, signupMode)
    : { isFull: false, isOver: false, blocked: false };

  const hasMyRole = !!myRoleEntry;

  const currentEntry = selectedShifts.find(
    s => s.date === shift.date && s.start_time === shift.startTime && s.end_time === shift.endTime
  );
  const currentType = currentEntry?.type || null;

  const isSignedWanted = currentType === "wanted";
  const isSignedAvailable = currentType === "available";
  const isSignedUnavailable = currentType === "unavailable";

  let chipClass = "border rounded-md px-1 py-1 text-xs text-center transition-all select-none w-full ";
  if (isSignedWanted) {
    chipClass += "bg-green-500 text-white border-green-600 cursor-pointer";
  } else if (isSignedAvailable) {
    chipClass += "bg-cyan-500 text-white border-cyan-600 cursor-pointer";
  } else if (isSignedUnavailable) {
    chipClass += "bg-red-500 text-white border-red-600 cursor-pointer";
  } else if (!hasMyRole) {
    chipClass += "bg-gray-50 border-gray-200 text-gray-400 cursor-default";
  } else if (blocked) {
    chipClass += "bg-red-50 border-red-200 text-red-400 cursor-default";
  } else {
    chipClass += "bg-white border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50 cursor-pointer";
  }

  const handleClick = () => {
    if (!canEdit || !hasMyRole) return;
    if (currentType === null) {
      onSignup && onSignup(shift, displayRole, "wanted");
    } else if (currentType === "wanted") {
      onSignup && onSignup(shift, displayRole, "available");
    } else if (currentType === "available") {
      if (!blocked) {
        onSignup && onSignup(shift, displayRole, "unavailable");
      } else {
        onSignup && onSignup(shift, displayRole, "remove");
      }
    } else if (currentType === "unavailable") {
      onSignup && onSignup(shift, displayRole, "remove");
    }
  };

  // Fill indicator
  const fillPct = displayRequired > 0 ? Math.min(100, Math.round((signed / displayRequired) * 100)) : 0;
  const fillColor = isOver
    ? "bg-orange-400"
    : isFull
    ? "bg-red-400"
    : fillPct >= 70
    ? "bg-yellow-400"
    : "bg-green-400";

  const statusIcon = isSignedWanted ? <Star className="w-3 h-3" /> :
    isSignedAvailable ? <Check className="w-3 h-3" /> :
    isSignedUnavailable ? <Ban className="w-3 h-3" /> :
    null;

  const statusText = isSignedWanted ? "רצוי" :
    isSignedAvailable ? "זמין" :
    isSignedUnavailable ? "לא זמין" :
    blocked ? "מלא" :
    null;

  return (
    <button className={chipClass} onClick={handleClick}
      title={!hasMyRole ? "אין תפקיד מתאים" : blocked ? "המשמרת מלאה" : "לחץ לבחירה"}
      disabled={!canEdit}
    >
      <div className="text-[10px] sm:text-[11px] text-gray-600">{shift.startTime}–{shift.endTime}</div>
      {displayRole && (
        <>
          {/* Fill bar */}
          {!isSignedWanted && !isSignedAvailable && !isSignedUnavailable && (
            <div className="mt-1 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${fillColor} transition-all`} style={{ width: `${fillPct}%` }} />
            </div>
          )}
          <div className="flex items-center justify-center gap-1 mt-1 text-[10px] opacity-90">
            {statusIcon}
            <span>
              {statusText || `${signed}/${displayRequired}`}
            </span>
          </div>
        </>
      )}
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

// ── Tap hint icon — uses the 3-icon sprite image ──────────────────────────────
const TAP_IMG = "https://media.base44.com/images/public/68e8a79f232bbd29be8a3e62/ad1520f82_image.png";
// Image is 3 icons side-by-side (each ~33.33% width). We use background-size/position to crop each.
function TapIcon({ index }) {
  // Container is 22x22px. background-size: 300% 100% means full image is 3x the container width.
  // background-position: 0%/50%/100% left for icon 0/1/2.
  const positions = ["0% 50%", "50% 50%", "100% 50%"];
  return (
    <div
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        backgroundImage: `url(${TAP_IMG})`,
        backgroundSize: "300% 100%",
        backgroundPosition: positions[index],
        backgroundRepeat: "no-repeat",
        imageRendering: "crisp-edges",
      }}
    />
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
  const [collapsed, setCollapsed] = useState(false);

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
      <CardHeader className="border-b bg-white py-2 px-4">
        <div className="flex items-center justify-between" dir="rtl">
          <button
            className="flex items-center gap-2 flex-1"
            onClick={() => setCollapsed(v => !v)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              בחר משמרות
            </CardTitle>
            {isLocked && <Lock className="w-3.5 h-3.5 text-red-500" />}
            {isLimitMode && (
              <span className="text-xs text-orange-600 font-medium">הגבלת הרשמה</span>
            )}
            {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
          </button>
          {onAddConstraint && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddConstraint(); }}
              title="הוסף אילוץ"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                <rect x="2" y="4" width="16" height="13" rx="2" stroke="#dc2626" strokeWidth="1.5"/>
                <line x1="2" y1="8" x2="18" y2="8" stroke="#dc2626" strokeWidth="1.5"/>
                <line x1="6" y1="2" x2="6" y2="6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="14" y1="2" x2="14" y2="6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="7.5" y1="11.5" x2="12.5" y2="16.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12.5" y1="11.5" x2="7.5" y2="16.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="py-3 px-4" dir="rtl">
          {weekDemand.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">אין משמרות שהוגדרו בלוח לשבוע זה</p>
          ) : (
            <>
              {/* Tap infographic */}
              <div className="flex items-center justify-center gap-5 mb-3 bg-gray-50 rounded-lg px-3 py-2" dir="ltr">
                {[
                  { index: 0, tap: "×1", label: "רצוי", color: "#16a34a" },
                  { index: 1, tap: "×2", label: "זמין", color: "#0891b2" },
                  { index: 2, tap: "×3", label: "לא זמין", color: "#dc2626" },
                ].map(({ index, tap, label, color }) => (
                  <div key={index} className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-0.5">
                      <TapIcon index={index} />
                      <span className="text-[9px] font-bold text-gray-500">{tap}</span>
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
                  </div>
                ))}
                {isLimitMode && <span className="text-[10px] text-orange-600 font-semibold">· מלאות חסומות</span>}
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
      )}
    </Card>
  );
}
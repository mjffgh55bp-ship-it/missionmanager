import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  buildUnifiedShiftDemand,
  getSignupsForRole,
  calculateRoleStatus,
  workerSignedForShift,
  filterDemandForWeek,
} from "@/lib/shiftDemand";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function dateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return HEBREW_DAYS[d.getDay()];
}

// ── Shift chip — a single time-slot button ─────────────────────────────────────
function ShiftChip({ shift, allAvailabilities, workers, myRoles, selectedShifts, signupMode, onSignup, canEdit }) {
  const iSignedUp = workerSignedForShift(selectedShifts, shift);

  // Find the first role that is "mine"
  const myRoleEntry = Object.entries(shift.roles).find(([rName]) => myRoles.has(rName));

  // Compute status for my role (or first role if none match)
  const [displayRole, displayRequired] = myRoleEntry || Object.entries(shift.roles)[0] || [null, 0];

  const signed = displayRole
    ? getSignupsForRole(allAvailabilities, workers, shift, displayRole)
    : 0;
  const { isFull, isOver, blocked } = displayRole
    ? calculateRoleStatus(displayRequired, signed, signupMode)
    : { isFull: false, isOver: false, blocked: false };

  const hasMyRole = !!myRoleEntry;
  const isSignedWanted = iSignedUp && selectedShifts.some(
    s => s.date === shift.date && s.start_time === shift.startTime && s.end_time === shift.endTime && s.type === "wanted"
  );
  const isSignedAvailable = iSignedUp && selectedShifts.some(
    s => s.date === shift.date && s.start_time === shift.startTime && s.end_time === shift.endTime && s.type === "available"
  );

  // Chip background logic
  let chipClass = "border rounded-lg px-3 py-2 text-xs text-center transition-all select-none ";
  if (isSignedWanted) {
    chipClass += "bg-green-500 text-white border-green-600 font-bold";
  } else if (isSignedAvailable) {
    chipClass += "bg-blue-500 text-white border-blue-600 font-semibold";
  } else if (!hasMyRole) {
    chipClass += "bg-gray-50 border-gray-200 text-gray-400 cursor-default";
  } else if (blocked) {
    chipClass += "bg-red-50 border-red-200 text-red-400 cursor-default";
  } else {
    chipClass += "bg-white border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50 cursor-pointer";
  }

  const handleClick = () => {
    if (!canEdit || !hasMyRole || blocked) return;
    if (!iSignedUp) {
      // First click = wanted
      onSignup && onSignup(shift, displayRole, "wanted");
    } else if (isSignedWanted) {
      // Second click = available
      onSignup && onSignup(shift, displayRole, "available");
    } else {
      // Third click = remove (toggle off via wanted again — parent handles dedup)
      onSignup && onSignup(shift, displayRole, "remove");
    }
  };

  const fillInfo = displayRole ? `${signed}/${displayRequired}` : "";

  return (
    <div className={chipClass} onClick={handleClick} title={hasMyRole ? (blocked ? "המשמרת מלאה" : "לחץ לבחירה") : "אין תפקיד מתאים"}>
      <div className="font-semibold">{shift.startTime}–{shift.endTime}</div>
      {displayRole && (
        <div className="text-[10px] mt-0.5 opacity-80">
          {isSignedWanted ? "✓ רצוי" : isSignedAvailable ? "✓ זמין" : fillInfo}
        </div>
      )}
    </div>
  );
}

// ── Day column ─────────────────────────────────────────────────────────────────
function DayColumn({ dateStr, shifts, allAvailabilities, workers, myRoles, selectedShifts, signupMode, onSignup, canEdit }) {
  if (shifts.length === 0) return null;
  // Group by mokedName
  const byMoked = {};
  shifts.forEach(s => {
    if (!byMoked[s.mokedName]) byMoked[s.mokedName] = [];
    byMoked[s.mokedName].push(s);
  });

  return (
    <div className="flex-1 min-w-[120px]" dir="rtl">
      <div className="text-xs font-semibold text-gray-600 mb-2 text-center border-b pb-1">{dateLabel(dateStr)}</div>
      <div className="space-y-3">
        {Object.entries(byMoked).map(([mokedName, mokedShifts]) => (
          <div key={mokedName}>
            <div className="text-[10px] text-gray-400 mb-1 text-center">{mokedName}</div>
            <div className="flex flex-col gap-1">
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
}) {
  const [collapsed, setCollapsed] = useState(false);

  const weekTemplateRows = useMemo(() => {
    const dates = new Set();
    for (let i = 0; i < 7; i++) dates.add(format(addDays(weekStart, i), "yyyy-MM-dd"));
    return templateRows.filter(r => dates.has(r.date));
  }, [templateRows, weekStart]);

  const demandMap = useMemo(
    () => buildUnifiedShiftDemand(weekTemplateRows, allTemplates),
    [weekTemplateRows, allTemplates]
  );

  const weekDemand = useMemo(
    () => filterDemandForWeek(demandMap, weekStart),
    [demandMap, weekStart]
  );

  const myRoles = useMemo(() => {
    if (!currentWorker) return new Set();
    return new Set(Array.isArray(currentWorker.role) ? currentWorker.role : [currentWorker.role].filter(Boolean));
  }, [currentWorker]);

  if (weekDemand.length === 0) return null;

  // Group shifts by date
  const byDate = {};
  weekDemand.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  const dates = Object.keys(byDate).sort();

  return (
    <Card className="border-none shadow-lg mb-4">
      <CardHeader className="border-b bg-white py-3 px-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setCollapsed(v => !v)}
        >
          <CardTitle className="text-base flex items-center gap-2" dir="rtl">
            <Users className="w-4 h-4 text-blue-600" />
            הרשמה למשמרות מהלוח
            <span className="text-xs font-normal text-gray-500">לחיצה אחת = רצוי · פעמיים = זמין</span>
          </CardTitle>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="py-4 px-4" dir="rtl">
          <div className="flex gap-3 overflow-x-auto pb-1">
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
        </CardContent>
      )}
    </Card>
  );
}
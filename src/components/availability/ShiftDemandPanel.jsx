import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  buildUnifiedShiftDemand,
  getSignupsForRole,
  calculateRoleStatus,
  workerSignedForShift,
  filterDemandForWeek,
} from "@/lib/shiftDemand";

const HEBREW_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${HEBREW_DAYS_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function StatusBadge({ label }) {
  const cls =
    label === "פתוח"         ? "bg-green-100 text-green-800" :
    label === "כמעט מלא"     ? "bg-yellow-100 text-yellow-800" :
    label === "מלא"          ? "bg-red-100 text-red-800" :
    label === "הרשמה עודפת"  ? "bg-purple-100 text-purple-800" :
                               "bg-gray-100 text-gray-700";
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>;
}

function FillBar({ pct }) {
  const color =
    pct >= 100 ? "bg-red-500" :
    pct >= 70  ? "bg-yellow-400" :
                 "bg-green-400";
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function ShiftDemandPanel({
  templateRows,
  allTemplates,
  allAvailabilities,  // all Availability records for the week
  workers,
  currentWorker,
  selectedShifts,
  signupMode,         // "limit_sign_up" | "allow_over_sign_up"
  weekStart,
  onSignup,           // (unifiedShift, roleName, type) => void
  canEdit,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Build demand only for the current week's template rows
  const weekTemplateRows = useMemo(() => {
    const dates = new Set();
    for (let i = 0; i < 7; i++) {
      dates.add(format(addDays(weekStart, i), "yyyy-MM-dd"));
    }
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

  // Roles the current worker has — must be before any early return
  const myRoles = useMemo(() => {
    if (!currentWorker) return new Set();
    return new Set(Array.isArray(currentWorker.role) ? currentWorker.role : [currentWorker.role].filter(Boolean));
  }, [currentWorker]);

  if (weekDemand.length === 0) return null;

  return (
    <Card className="border-none shadow-lg mb-4">
      <CardHeader className="border-b bg-white py-3 px-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setCollapsed(v => !v)}
        >
          <CardTitle className="text-base flex items-center gap-2" dir="rtl">
            <Users className="w-4 h-4 text-blue-600" />
            ביקוש משמרות מהלוח
            <Badge variant="outline" className="text-xs">{weekDemand.length} משמרות</Badge>
          </CardTitle>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="py-3 px-3">
          <p className="text-xs text-gray-500 mb-3" dir="rtl">
            משמרות מהמוקד השבוע — מספר נרשמים ביחס לצורך
          </p>
          <div className="space-y-3">
            {weekDemand.map(shift => (
              <ShiftDemandRow
                key={shift.key}
                shift={shift}
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

// ── Single shift row ───────────────────────────────────────────────────────────
function ShiftDemandRow({ shift, allAvailabilities, workers, myRoles, selectedShifts, signupMode, onSignup, canEdit }) {
  const iSignedUp = workerSignedForShift(selectedShifts, shift);

  return (
    <div className="border rounded-lg p-3 bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">{shift.mokedName}</span>
          <span className="text-xs text-gray-500">{dateLabel(shift.date)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock className="w-3 h-3" />
          {shift.startTime} – {shift.endTime}
        </div>
      </div>

      {/* Role rows */}
      <div className="space-y-2">
        {Object.entries(shift.roles).map(([roleName, required]) => (
          <RoleRow
            key={roleName}
            shift={shift}
            roleName={roleName}
            required={required}
            allAvailabilities={allAvailabilities}
            workers={workers}
            isMyRole={myRoles.has(roleName)}
            iSignedUp={iSignedUp}
            selectedShifts={selectedShifts}
            signupMode={signupMode}
            onSignup={onSignup}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single role row inside a shift ─────────────────────────────────────────────
function RoleRow({ shift, roleName, required, allAvailabilities, workers, isMyRole, iSignedUp, selectedShifts, signupMode, onSignup, canEdit }) {
  const signed = useMemo(
    () => getSignupsForRole(allAvailabilities, workers, shift, roleName),
    [allAvailabilities, workers, shift, roleName]
  );
  const { available, fullnessPct, isFull, isOver, chance, statusLabel, blocked } = useMemo(
    () => calculateRoleStatus(required, signed, signupMode),
    [required, signed, signupMode]
  );

  const handleSignup = (type) => {
    if (onSignup) onSignup(shift, roleName, type);
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap rounded-md px-2 py-1.5 ${isMyRole ? "bg-blue-50 border border-blue-200" : "bg-white border border-gray-100"}`}>
      {/* Role name */}
      <span className={`text-xs font-semibold min-w-[60px] ${isMyRole ? "text-blue-800" : "text-gray-600"}`}>
        {roleName}
      </span>

      {/* Count */}
      <span className="text-xs text-gray-700">
        נרשמו <strong>{signed}</strong>/{required}
      </span>

      {/* Fill bar */}
      <div className="flex-1 min-w-[60px]">
        <FillBar pct={fullnessPct} />
      </div>

      {/* Status */}
      <StatusBadge label={statusLabel} />

      {/* Chance */}
      {signupMode === "allow_over_sign_up" && signed > 0 && (
        <span className="text-xs text-gray-500">סיכוי {chance}%</span>
      )}

      {/* Available spots */}
      {!isFull && !isOver && (
        <span className="text-xs text-green-700">{available} מקומות פנויים</span>
      )}

      {/* Signup buttons — only for worker's own roles */}
      {isMyRole && canEdit && (
        <div className="flex gap-1 mr-auto">
          {iSignedUp ? (
            <span className="text-xs text-green-700 font-semibold px-2 py-1 bg-green-100 rounded">✓ נרשמת</span>
          ) : blocked ? (
            <span className="text-xs text-red-600 font-semibold px-2 py-1 bg-red-50 rounded">המשמרת מלאה</span>
          ) : (
            <>
              <Button
                size="sm"
                className="h-6 text-xs bg-green-600 hover:bg-green-700 px-2"
                onClick={() => handleSignup("wanted")}
              >
                רצוי
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2"
                onClick={() => handleSignup("available")}
              >
                זמין
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
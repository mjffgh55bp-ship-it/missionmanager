import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Star, Check, Ban, Calendar, CalendarDays } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, subDays, differenceInDays } from "date-fns";

const getCustomWeekNumber = (date) => {
  const year = date.getFullYear();
  const dec28PrevYear = new Date(year - 1, 11, 28);
  const weekStartDec28 = new Date(dec28PrevYear);
  weekStartDec28.setDate(dec28PrevYear.getDate() - dec28PrevYear.getDay());
  const diffDays = differenceInDays(date, weekStartDec28);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

export default function MatrixHeader({
  currentDate,
  setCurrentDate,
  viewMode,
  setViewMode,
  populationFilter,
  setPopulationFilter,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  populations,
  workerRoles,
  shiftStatuses,
  signupMode,
  saveSignupMode,
  savingSignupMode,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekNum = getCustomWeekNumber(weekStart);

  return (
    <div className="flex items-center gap-2 flex-wrap py-2 px-4 border-b bg-white" dir="rtl">

      {/* ===== RIGHT SIDE: Title + week num + date nav + היום ===== */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-bold text-base whitespace-nowrap">
          מטריצה {viewMode === "weekly" ? "שבועית" : "יומית"}
        </span>
        {viewMode === "weekly" && (
          <span className="text-sm font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            שב׳ {weekNum}
          </span>
        )}
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          className="h-7 text-xs px-2"
          onClick={() => setCurrentDate(new Date())}
        >
          היום
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentDate(subDays(currentDate, viewMode === "weekly" ? 7 : 1))}
        >
          <ChevronRight className="w-3 h-3" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <div className="px-3 py-1 bg-blue-900 text-white rounded font-semibold text-xs min-w-[120px] text-center cursor-pointer hover:bg-blue-800 transition-colors h-7 flex items-center justify-center">
              {viewMode === "weekly"
                ? `${format(weekStart, "d.M")} – ${format(weekEnd, "d.M")}`
                : format(currentDate, "d.M.yyyy")}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && setCurrentDate(date)}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentDate(addDays(currentDate, viewMode === "weekly" ? 7 : 1))}
        >
          <ChevronLeft className="w-3 h-3" />
        </Button>
      </div>

      {/* Legend badges */}
      <div className="flex gap-1 items-center shrink-0">
        <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">
          <Star className="w-2.5 h-2.5 ml-0.5 fill-current" />רצוי
        </Badge>
        <Badge className="bg-cyan-100 text-cyan-800 text-[10px] px-1.5 py-0">
          <Check className="w-2.5 h-2.5 ml-0.5" />זמין
        </Badge>

        <Badge className="bg-purple-400 text-white text-[10px] px-1.5 py-0">שיבוץ (לוח)</Badge>
      </div>

      {/* Spacer pushes filters to the left */}
      <div className="flex-1" />

      {/* ===== LEFT SIDE: Filters + view toggle + signup mode ===== */}

      {/* View toggle */}
      <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white h-7 shrink-0">
        <Calendar className="w-3 h-3 text-gray-500" />
        <span className="text-xs text-gray-600">יומי</span>
        <Switch
          checked={viewMode === "weekly"}
          onCheckedChange={(checked) => setViewMode(checked ? "weekly" : "daily")}
          className="scale-75"
        />
        <CalendarDays className="w-3 h-3 text-gray-500" />
        <span className="text-xs text-gray-600">שבועי</span>
      </div>

      {/* Population filter */}
      <Select value={populationFilter} onValueChange={setPopulationFilter}>
        <SelectTrigger className="h-7 text-xs w-[130px]">
          <SelectValue placeholder="אוכלוסייה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">כל האוכלוסיות</SelectItem>
          {populations.map((pop) => (
            <SelectItem key={pop} value={pop}>{pop}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Role filter */}
      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger className="h-7 text-xs w-[110px]">
          <SelectValue placeholder="תפקיד" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">כל התפקידים</SelectItem>
          {workerRoles.map((role) => (
            <SelectItem key={role} value={role}>{role}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-7 text-xs w-[110px]">
          <SelectValue placeholder="סטטוס" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">כל הסטטוסים</SelectItem>
          {shiftStatuses.map((status) => (
            <SelectItem key={status} value={status}>{status}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Signup mode toggle */}
      <button
        onClick={() =>
          saveSignupMode(
            signupMode === "allow_over_sign_up" ? "limit_sign_up" : "allow_over_sign_up"
          )
        }
        disabled={savingSignupMode}
        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium h-7 transition-colors shrink-0 ${
          signupMode === "allow_over_sign_up"
            ? "bg-green-50 border-green-300 text-green-800 hover:bg-green-100"
            : "bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100"
        } ${savingSignupMode ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
      >
        {signupMode === "allow_over_sign_up" ? "🟢 הרשמה חופשית" : "🔒 הגבלת הרשמה"}
      </button>
    </div>
  );
}
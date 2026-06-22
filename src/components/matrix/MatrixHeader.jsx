import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Star, Check, Calendar, CalendarDays, Plus, Pencil, X, Trash2 } from "lucide-react";
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
  signupMode,
  saveSignupMode,
  savingSignupMode,
  onToday,
  presets,
  activePresetId,
  activePreset,
  onTogglePreset,
  onAddPreset,
  onRenamePreset,
  onRemovePreset,
  onEditPreset,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekNum = getCustomWeekNumber(weekStart);
  const [editMode, setEditMode] = useState(false);
  const [editNames, setEditNames] = useState({});

  const enterEditMode = () => {
    const names = {};
    presets.forEach(p => { names[p.id] = p.name; });
    setEditNames(names);
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditNames({});
  };

  const handleSaveName = (presetId) => {
    if (editNames[presetId]?.trim()) {
      onRenamePreset(presetId, editNames[presetId].trim());
    }
  };

  const handleDeletePreset = (presetId) => {
    if (window.confirm("למחוק תצוגה זו?")) {
      onRemovePreset(presetId);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-2 px-4 border-b bg-white" dir="rtl">

      {/* ===== RIGHT SIDE: Title + date nav + היום ===== */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-bold text-base whitespace-nowrap">
          מטריצה {viewMode === "weekly" ? "שבועית" : "יומית"}
        </span>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          className="h-7 text-xs px-2"
          onClick={() => (onToday ? onToday() : setCurrentDate(new Date()))}
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
                ? `שבוע ${weekNum}`
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

      {/* ===== View presets: pills (normal mode) or edit list (edit mode) ===== */}
      {!editMode ? (
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {presets.map((p) => {
            const isActive = p.id === activePresetId;
            return (
              <div
                key={p.id}
                onClick={() => onTogglePreset(p.id)}
                className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-900 text-white border-blue-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {p.name}
              </div>
            );
          })}
          <button
            onClick={enterEditMode}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
            title="עריכת תצוגות"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {activePreset && (
            <button
              onClick={() => onTogglePreset(activePresetId)}
              className="text-[10px] text-blue-600 underline whitespace-nowrap shrink-0"
            >
              כל העובדים
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 bg-gray-50 rounded-lg border p-2 shrink-0 min-w-[200px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">עריכת תצוגות</span>
            <button onClick={exitEditMode} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <Input
                value={editNames[p.id] || ""}
                onChange={(e) => setEditNames(prev => ({ ...prev, [p.id]: e.target.value }))}
                className="h-7 text-xs"
                dir="rtl"
              />
              <button
                onClick={() => handleSaveName(p.id)}
                disabled={!editNames[p.id]?.trim()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                שמור
              </button>
              {onEditPreset && (
                <button
                  onClick={() => { onEditPreset(p); exitEditMode(); }}
                  className="text-gray-500 hover:text-blue-600 p-0.5 shrink-0"
                  title="ערוך עובדים"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => handleDeletePreset(p.id)}
                className="text-red-400 hover:text-red-600 p-0.5 shrink-0"
                title="מחק"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] gap-0.5"
            onClick={() => { onAddPreset(); exitEditMode(); }}
          >
            <Plus className="w-2.5 h-2.5" />תצוגה חדשה
          </Button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* ===== LEFT SIDE: View toggle + signup mode ===== */}

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
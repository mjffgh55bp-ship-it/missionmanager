import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * BriefingBar — renders a pre-normalized briefing marker.
 *
 * Props:
 *   visualTime            — plain "HH:MM" clock time already resolved for the visual operational day
 *   originalBriefingTime  — raw stored value (e.g. "-1 05:15") for tooltip display
 *   linkedShiftDate       — "yyyy-MM-dd" of the shift's operational date (for tooltip)
 *   shiftStartTime        — shift start time string
 *   shiftEndTime          — shift end time string
 *   dayIndex              — 0-based day index within the timeline (0 for daily, 0-6 for weekly)
 *   viewMode              — 'daily' | 'weekly'
 *   ppm                   — pixels per minute
 *   timeToPixels          — fn(timeStr, dayIndex, viewMode, ppm) → px from right
 */
export default function BriefingBar({
  visualTime,
  originalBriefingTime,
  linkedShiftDate,
  shiftStartTime,
  shiftEndTime,
  dayIndex,
  viewMode,
  ppm,
  timeToPixels,
}) {
  if (!visualTime) return null;

  // visualTime is always a plain "HH:MM" (never "-1 ..." — that's already resolved by Matrix).
  // dayIndex is pre-computed from marker.visual_operational_date, not the linked shift date.
  const pointPx = timeToPixels(visualTime, dayIndex, viewMode, ppm);
  if (pointPx === undefined || pointPx === null || isNaN(pointPx)) return null;

  // Detect offset for text prefix only — no color difference
  const isPrevDay = (originalBriefingTime || "").startsWith("-1 ");
  const isNextDay = /^\+\d/.test(originalBriefingTime || "");

  // Build display string: "− HH:MM", "+ HH:MM", or "HH:MM"
  let displayOriginal;
  if (isPrevDay) {
    displayOriginal = `− ${(originalBriefingTime || "").replace("-1 ", "").trim()}`;
  } else if (isNextDay) {
    displayOriginal = `+ ${(originalBriefingTime || "").replace(/^\+\d+\s*/, "").trim()}`;
  } else {
    displayOriginal = originalBriefingTime || visualTime;
  }

  // Single consistent color for all briefing markers
  const barColor = { bg: 'rgba(251, 191, 36, 0.3)', border: '#f59e0b', fill: 'bg-amber-400' };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute h-full rounded-sm z-20 flex items-center justify-center overflow-hidden"
            style={{
              right: `${pointPx}px`,
              width: '6px',
              backgroundColor: barColor.bg,
              border: `2px solid ${barColor.border}`,
            }}
          >
            <div className={`w-full h-full opacity-50 ${barColor.fill}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 text-white border-none" dir="rtl">
          <p className="font-bold">תדריך</p>
          <p>שעת תדריך: {displayOriginal}</p>
          {linkedShiftDate && <p>תאריך משמרת: {linkedShiftDate}</p>}
          <p>משמרת: {shiftStartTime} – {shiftEndTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
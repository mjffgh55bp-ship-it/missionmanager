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

  const pointPx = timeToPixels(visualTime, dayIndex, viewMode, ppm);
  if (pointPx < 0 || pointPx === undefined) return null;

  // Detect if this was a previous-day briefing for display purposes
  const isPrevDay = (originalBriefingTime || "").startsWith("-1 ");
  const isNextDay = (originalBriefingTime || "").startsWith("+");

  // Display original time in tooltip
  const displayOriginal = isPrevDay
    ? `− ${(originalBriefingTime || "").replace("-1 ", "")}`
    : originalBriefingTime || visualTime;

  const barColor = isPrevDay
    ? { bg: 'rgba(139, 92, 246, 0.3)', border: '#7c3aed', fill: 'bg-violet-500' }
    : isNextDay
    ? { bg: 'rgba(251, 191, 36, 0.25)', border: '#d97706', fill: 'bg-amber-400' }
    : { bg: 'rgba(251, 191, 36, 0.3)', border: '#f59e0b', fill: 'bg-amber-400' };

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
          <p className="font-bold">תדריך{isPrevDay ? " (יממה קודמת)" : ""}</p>
          <p>שעת תדריך: {displayOriginal}</p>
          {linkedShiftDate && <p>תאריך משמרת: {linkedShiftDate}</p>}
          <p>משמרת: {shiftStartTime} – {shiftEndTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
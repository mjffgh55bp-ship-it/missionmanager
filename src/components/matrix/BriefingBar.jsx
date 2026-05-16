import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseTimeCellValue } from "@/lib/operationalDate";

export default function BriefingBar({ briefingTime, shiftStartTime, shiftEndTime, dayIndex, viewMode, ppm, timeToPixels }) {
  if (!briefingTime) return null;

  const { dayOffset } = parseTimeCellValue(briefingTime);

  // Calculate pixel position from right edge of timeline
  const pointPx = timeToPixels(briefingTime, dayIndex, viewMode, ppm);

  // For prev-day briefings (dayOffset === -1), pointPx will be negative — they appear
  // visually to the RIGHT of the timeline start (06:00 boundary).
  // We render them but let overflow:visible handle clipping.
  const isPrevDay = dayOffset === -1;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute h-full rounded-sm z-25 flex items-center justify-center overflow-hidden"
            style={{
              right: `${pointPx}px`,
              width: '6px',
              backgroundColor: isPrevDay ? 'rgba(139, 92, 246, 0.3)' : 'rgba(251, 191, 36, 0.3)',
              border: `2px solid ${isPrevDay ? '#7c3aed' : '#f59e0b'}`,
            }}
          >
            <div className={`w-full h-full opacity-50 ${isPrevDay ? 'bg-violet-500' : 'bg-amber-400'}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 text-white border-none">
          <p className="font-bold">תדריך{isPrevDay ? " (יממה קודמת)" : ""}</p>
          <p>שעה: {isPrevDay ? `− ${parseTimeCellValue(briefingTime).clockTime}` : briefingTime}</p>
          <p>משמרת: {shiftStartTime} - {shiftEndTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
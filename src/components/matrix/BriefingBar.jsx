import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BriefingBar({ briefingTime, shiftStartTime, shiftEndTime, dayIndex, viewMode, ppm, timeToPixels }) {
  if (!briefingTime) return null;
  
  // Calculate the pixel position for the briefing time
  const pointPx = timeToPixels(briefingTime, dayIndex, viewMode, ppm);
  
  // Hide if position is invalid
  if (pointPx < 0 || pointPx === undefined) return null;
  
  const rightPx = pointPx;

  console.log("MATRIX BRIEFING POSITION", {
    briefingTime,
    dayIndex,
    pointPx,
    rightPx,
    expected: "rightPx should equal pointPx"
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute h-full rounded-sm z-15 flex items-center justify-center px-1 overflow-hidden"
            style={{
              right: `${rightPx}px`,
              width: '6px',
              backgroundColor: 'rgba(251, 191, 36, 0.3)',
              border: '2px solid #f59e0b',
            }}
          >
            <div className="w-full h-full bg-amber-400 opacity-50" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 text-white border-none">
          <p className="font-bold">תדריך</p>
          <p>שעה: {briefingTime}</p>
          <p>משמרת: {shiftStartTime} - {shiftEndTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
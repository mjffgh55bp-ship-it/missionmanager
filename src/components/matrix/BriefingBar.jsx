import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BriefingBar({ briefingTime, shiftStartTime, shiftEndTime, dayIndex, viewMode, zoomRange, timeToPercentage }) {
  if (!briefingTime) return null;
  
  // Calculate the percentage position for the briefing time
  const briefingPercent = timeToPercentage(briefingTime, dayIndex, viewMode, zoomRange);
  
  // Hide if outside zoom range
  if (briefingPercent < 0 || briefingPercent > 100) return null;
  
  const rightPercent = briefingPercent;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute h-full rounded-sm z-15 flex items-center justify-center px-1 overflow-hidden"
            style={{
              right: `${rightPercent}%`,
              width: '0.5%',
              minWidth: '2px',
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
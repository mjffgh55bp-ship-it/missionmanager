import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getOperationalMinutes, getOperationalEndMinutes } from "@/lib/operationalDate";

/**
 * MokedSignupBar — renders a candidate/availability window for a moked signup.
 *
 * Props:
 *   signups     — array of signup entries for this worker+time (may have different moked_names)
 *   startTime   — "HH:MM"
 *   endTime     — "HH:MM"
 *   dayIndex    — 0-based (0 for daily, 0-6 for weekly)
 *   viewMode    — 'daily' | 'weekly'
 *   ppm         — pixels per minute
 *   timelineWidth — total timeline width in px (for bounds check)
 */
export default function MokedSignupBar({ signups, startTime, endTime, dayIndex, viewMode, ppm, timelineWidth }) {
  if (!signups || signups.length === 0 || !startTime || !endTime) return null;

  const opStart = getOperationalMinutes(startTime);
  const opEnd = getOperationalEndMinutes(startTime, endTime);
  const startPx = (viewMode === 'weekly' ? dayIndex * 1440 + opStart : opStart) * ppm;
  const endPx = (viewMode === 'weekly' ? dayIndex * 1440 + opEnd : opEnd) * ppm;
  const widthPx = Math.max(endPx - startPx, 2);

  if (startPx < 0 || startPx > timelineWidth) return null;

  // Determine type for color (wanted = green, available = cyan)
  const hasWanted = signups.some(s => s.type === "wanted");
  const borderColor = hasWanted ? '#16a34a' : '#0891b2';
  const bgColor = hasWanted ? 'rgba(22, 163, 74, 0.12)' : 'rgba(8, 145, 178, 0.12)';

  // Extract moked name: prefer moked_name field, fall back to parsing signupKey
  const extractMokedName = (s) => {
    if (s.moked_name) return s.moked_name;
    if (s.signupKey) {
      // Format: "date__name:MokedName__startTime__endTime" or "date__group:id__..."
      const parts = s.signupKey.split('__');
      if (parts.length >= 2) {
        const keyPart = parts[1]; // "name:מוקד מלא 1" or "group:abc"
        if (keyPart.startsWith('name:')) return keyPart.slice(5);
        if (keyPart.startsWith('group:')) return `קבוצה: ${keyPart.slice(6)}`;
      }
    }
    return null;
  };

  const mokedNames = [...new Set(signups.map(extractMokedName).filter(Boolean))];

  // Determine signup type label
  const typeLabel = signups.some(s => s.type === "wanted") ? "רצוי" : "זמין";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute h-full rounded-sm z-10 pointer-events-auto"
            style={{
              right: `${startPx}px`,
              width: `${widthPx}px`,
              backgroundColor: bgColor,
              border: `2px dashed ${borderColor}`,
            }}
          />
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 text-white border-none" dir="rtl">
          <p className="font-bold text-xs mb-1">נרשם ל{typeLabel === "רצוי" ? " (רצוי)" : " (זמין)"}:</p>
          {mokedNames.length > 0
            ? mokedNames.map((n, i) => <p key={i} className="text-xs">• {n}</p>)
            : <p className="text-xs">מוקד לא ידוע</p>
          }
          <p className="text-xs text-gray-300 mt-1">{startTime}–{endTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
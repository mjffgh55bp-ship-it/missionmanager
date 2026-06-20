import React from "react";
import { addDays, startOfWeek, format } from "date-fns";

const DAYS_OF_WEEK_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function TimelineHeader({ viewMode, timelineWidth, ppm, dailySlots, weeklySlots, currentDate }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const DAY_WIDTH = 1440 * ppm;

  if (viewMode === 'daily') {
    const dayName = DAYS_OF_WEEK_HE[currentDate.getDay()];
    const dateStr = format(currentDate, 'd.M');
    return (
      <div dir="rtl">
        {/* Top row: day name + date */}
        <div className="text-center font-medium text-gray-600 text-xs py-0.5 border-b border-gray-300" style={{ width: `${timelineWidth}px` }}>
          {dateStr} {dayName}
        </div>
        {/* Bottom row: hours */}
        <div className="relative flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
          {dailySlots.map((hour) => (
            <div key={hour} className="shrink-0 text-[10px] text-gray-600 py-0.5 border-l text-center font-medium overflow-hidden" style={{ width: `${60 * ppm}px` }}>
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Weekly view ──────────────────────────────────────────────────
  return (
    <div dir="rtl">
      {/* Top row: day labels + dates */}
      <div className="flex border-b border-gray-300" dir="rtl">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const dayDate = format(addDays(weekStart, day), 'd.M');
          const dayName = DAYS_OF_WEEK_HE[day];
          return (
            <div
              key={day}
              className="shrink-0 text-center font-medium text-gray-600 text-xs py-0.5 border-l border-gray-200"
              style={{ width: `${DAY_WIDTH}px` }}
            >
              {dayName} {dayDate}
            </div>
          );
        })}
      </div>

      {/* Bottom row: individual hours */}
      <div className="relative flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
        {weeklySlots.map((slot, idx) => (
          <div key={idx} className="shrink-0 text-[10px] text-gray-600 py-0.5 text-center font-medium overflow-hidden border-l border-l-gray-200" style={{ width: `${60 * ppm}px` }}>
            <div className="text-gray-600" style={{ fontSize: '10px' }}>
              {String(slot.hour).padStart(2, '0')}
            </div>
          </div>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map(day => {
          const px = day * DAY_WIDTH;
          return <div key={`hdb-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '2px', backgroundColor: 'rgba(80,80,80,0.5)', zIndex: 5 }} />;
        })}
      </div>
    </div>
  );
}
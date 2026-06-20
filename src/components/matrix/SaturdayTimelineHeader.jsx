import React from "react";
import { format, addDays, startOfWeek } from "date-fns";

export default function SaturdayTimelineHeader({ currentDate, ppm }) {
  const satDate = addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), -1);
  const satDayWidth = 1440 * ppm;
  const satPPH = satDayWidth / 24;
  return (
    <div dir="rtl" style={{ width: `${satDayWidth}px`, minWidth: `${satDayWidth}px` }}>
      <div className="text-center font-semibold text-gray-800 text-xs py-0.5 border-b border-gray-300">
        ש׳ {format(satDate, 'd.M')}
      </div>
      <div className="relative flex" dir="rtl" style={{ width: `${satDayWidth}px` }}>
        {Array.from({ length: 24 }, (_, i) => {
          const hour = (i + 6) % 24;
          return (
            <div key={hour} className="shrink-0 text-[10px] text-gray-600 py-0.5 text-center font-medium overflow-hidden border-l border-l-gray-200" style={{ width: `${satPPH}px` }}>
              {String(hour).padStart(2, '0')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
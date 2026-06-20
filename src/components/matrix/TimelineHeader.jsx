import React from "react";
import { addDays, startOfWeek, format } from "date-fns";

export default function TimelineHeader({ viewMode, timelineWidth, ppm, dailySlots, weeklySlots, currentDate }) {
  return (
    <div className="relative flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>
      {viewMode === 'daily' ? (
        dailySlots.map((hour) => (
          <div key={hour} className="shrink-0 text-xs text-gray-600 py-3 border-l text-center font-medium overflow-hidden" style={{ width: `${60 * ppm}px` }}>
            {String(hour).padStart(2, '0')}:00
          </div>
        ))
      ) : (
        <>
          {weeklySlots.map((slot, idx) => (
            <div key={idx} className="shrink-0 text-xs text-gray-600 py-1 text-center font-medium overflow-hidden border-l border-l-gray-200" style={{ width: `${60 * ppm}px` }}>
              {slot.label && <div className="font-bold text-gray-800 text-[10px] leading-tight">{slot.label}</div>}
              {slot.dateLabel && <div className="text-[8px] text-gray-500 leading-tight">{slot.dateLabel}</div>}
              <div className={`text-[8px] leading-tight ${slot.opIndex === 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                {String(slot.hour).padStart(2, '0')}
              </div>
            </div>
          ))}
          {[0,1,2,3,4,5,6].map(day => {
            const px = day * 1440 * ppm;
            return <div key={`hdb-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '2px', backgroundColor: 'rgba(80,80,80,0.5)', zIndex: 5 }} />;
          })}
        </>
      )}
    </div>
  );
}
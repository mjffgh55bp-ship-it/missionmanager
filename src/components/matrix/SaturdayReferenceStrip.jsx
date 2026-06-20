import React from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Ban } from "lucide-react";

const STRIP_WIDTH = 96;

const calcOpMin = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

const stripTimeToPx = (timeStr, ppm) => {
  const opMin = calcOpMin(timeStr);
  const totalStripMin = 24 * 60;
  const scaledPPM = STRIP_WIDTH / totalStripMin;
  return opMin * scaledPPM;
};

const getOpEndMin = (start, end) => {
  const s = calcOpMin(start);
  const e = calcOpMin(end);
  return e <= s ? e + 24 * 60 : e;
};

export default function SaturdayReferenceStrip({
  currentDate,
  filteredWorkers,
  satAssigned,
  satAvail,
  satUnavail,
  allTemplates,
  ROW_H,
  ppm,
  timelineWidth,
  isStandbyStatus,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const prevSat = addDays(weekStart, -1);
  const dateStr = format(prevSat, "yyyy-MM-dd");

  if (filteredWorkers.length === 0) return null;

  const scaledPPM = STRIP_WIDTH / (24 * 60);

  return (
    <div
      className="flex-shrink-0 border-l border-gray-300 bg-gray-50/60"
      style={{ width: `${STRIP_WIDTH}px`, minWidth: `${STRIP_WIDTH}px` }}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="flex items-center justify-center bg-gray-100 border-b gap-1"
        style={{ height: '40px' }}
      >
        <span className="text-[10px] font-bold text-gray-600 whitespace-nowrap">
          ש׳ {format(prevSat, "d.M")}
        </span>
        <span className="text-[7px] text-gray-400 bg-gray-200 px-1 rounded whitespace-nowrap">
          תצוגה בלבד
        </span>
      </div>

      {/* Worker rows */}
      {filteredWorkers.map((worker, index) => {
        const rowBg = index % 2 === 0 ? 'bg-white/60' : 'bg-gray-50/60';

        // Assigned shifts from satAssigned
        const assignedBlocks = satAssigned
          .filter(row => row.date === dateStr && row.values)
          .reduce((acc, row) => {
            const tmpl = allTemplates.find(t => t.id === row.template_id);
            if (!tmpl) return acc;
            const workerCols = (tmpl.columns || []).filter(c => c.type === "worker");
            const assigned = workerCols.some(col => {
              const val = row.values[col.name];
              return val === worker.id || (Array.isArray(val) && val.includes(worker.id));
            });
            if (!assigned) return acc;
            const st = row.values?.["התחלה"] || row.values?.["שעת התחלה"];
            const et = row.values?.["סיום"] || row.values?.["שעת סיום"];
            if (!st || !et) return acc;
            acc.push({
              id: `sat_assigned_${row.id}_${worker.id}`,
              start_time: st,
              end_time: et,
              template_name: tmpl.name || row.template_name,
              status: row.values?.status || null,
              isTemplate: true,
            });
            return acc;
          }, []);

        // Availability blocks from satAvail (previous week)
        const availBlocks = (() => {
          const rec = satAvail.find(a =>
            a.worker_id === worker.id || a.worker_id === worker.user_id
          );
          if (!rec?.shifts) return [];
          return rec.shifts
            .filter(s => (s.operational_date || s.date) === dateStr)
            .map((s, i) => ({
              id: `sat_avail_${rec.id}_${i}`,
              start_time: s.start_time,
              end_time: s.end_time,
              type: s.type || 'available',
            }));
        })();

        // Unavailability blocks
        const unavailBlocks = satUnavail
          .filter(u => u.worker_id === worker.id && u.date === dateStr)
          .map(u => ({
            id: u.id,
            start_time: u.start_time,
            end_time: u.end_time,
            reason: u.reason || 'occupied',
          }));

        return (
          <div
            key={worker.id}
            className={`border-b relative overflow-hidden ${rowBg}`}
            style={{ height: `${ROW_H}px` }}
          >
            {/* Assigned shifts — purple */}
            {assignedBlocks.map(b => {
              const leftPx = stripTimeToPx(b.start_time, scaledPPM);
              const endMin = getOpEndMin(b.start_time, b.end_time);
              const startMin = calcOpMin(b.start_time);
              const wPx = Math.max(2, (endMin - startMin) * scaledPPM);
              const standby = isStandbyStatus(b.status);
              if (standby) {
                return (
                  <TooltipProvider key={b.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center overflow-hidden pointer-events-none"
                          style={{
                            right: `${leftPx}px`,
                            width: `${wPx}px`,
                            border: '2px dashed #a855f7',
                            backgroundColor: 'transparent',
                          }}
                        >
                          <span className="text-[7px] font-bold text-purple-500 truncate px-0.5">{b.status}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-gray-800 text-white border-none text-xs">
                        <p className="font-bold">{b.template_name}</p>
                        <p>זמן: {b.start_time} - {b.end_time}</p>
                        <p>סטטוס כוננות: {b.status}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return (
                <TooltipProvider key={b.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-sm bg-purple-300 border-r-2 border-purple-500 pointer-events-none"
                        style={{ right: `${leftPx}px`, width: `${wPx}px` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-800 text-white border-none text-xs">
                      <p className="font-bold">{b.template_name}</p>
                      <p>{b.start_time} - {b.end_time}</p>
                      {b.status && <p>סטטוס: {b.status}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}

            {/* Availability blocks — blue/green */}
            {availBlocks.map(b => {
              const leftPx = stripTimeToPx(b.start_time, scaledPPM);
              const endMin = getOpEndMin(b.start_time, b.end_time);
              const startMin = calcOpMin(b.start_time);
              const wPx = Math.max(2, (endMin - startMin) * scaledPPM);
              const borderColor = b.type === 'wanted' ? '#16a34a' : '#3b82f6';
              const bgColor = b.type === 'wanted' ? '#16a34a18' : '#3b82f618';
              return (
                <div
                  key={b.id}
                  className="absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center pointer-events-none"
                  style={{
                    right: `${leftPx}px`,
                    width: `${wPx}px`,
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                  }}
                >
                  <span className="text-[7px] font-bold" style={{ color: borderColor }}>
                    {b.type === 'wanted' ? 'W' : 'A'}
                  </span>
                </div>
              );
            })}

            {/* Unavailability blocks — red/gray */}
            {unavailBlocks.map(u => {
              const leftPx = stripTimeToPx(u.start_time, scaledPPM);
              const endMin = getOpEndMin(u.start_time, u.end_time);
              const startMin = calcOpMin(u.start_time);
              const wPx = Math.max(2, (endMin - startMin) * scaledPPM);
              const isOverseas = u.reason === 'overseas';
              return (
                <div
                  key={u.id}
                  className="absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center pointer-events-none"
                  style={{
                    right: `${leftPx}px`,
                    width: `${wPx}px`,
                    backgroundColor: isOverseas ? '#fecaca' : '#d1d5db',
                    borderRight: `2px solid ${isOverseas ? '#ef4444' : '#6b7280'}`,
                  }}
                >
                  <Ban className="w-2.5 h-2.5 text-gray-500" />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
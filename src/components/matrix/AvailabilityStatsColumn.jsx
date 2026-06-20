import React from "react";

const COL_WIDTH = 72; // 3 sub-columns of 24px each

export function AvailabilityStatsHeader() {
  return (
    <div
      className="border-r bg-gray-100 flex flex-col items-center justify-center h-full"
      style={{ width: `${COL_WIDTH}px`, minWidth: `${COL_WIDTH}px` }}
      title="זמינות"
    >
      <span className="text-[10px] font-semibold text-gray-700 leading-tight">זמינות</span>
      <div className="flex w-full mt-0.5">
        <div className="flex-1 text-center text-[8px] text-gray-400 font-medium">A</div>
        <div className="flex-1 text-center text-[8px] text-gray-400 font-medium border-r border-gray-300">W</div>
        <div className="flex-1 text-center text-[8px] text-gray-400 font-medium border-r border-gray-300">TW</div>
      </div>
    </div>
  );
}

export function AvailabilityStatsCell({ workerId, availabilities, weekStartDate }) {
  const workerAvail = availabilities
    .filter(a => a.worker_id === workerId && a.week_start_date === weekStartDate)
    .sort((a, b) => (b.shifts?.length || 0) - (a.shifts?.length || 0))[0] || null;

  const shifts = workerAvail?.shifts || [];
  const availableCount = shifts.filter(s => s.type === "available").length;
  const wantedCount = shifts.filter(s => s.type === "wanted").length;
  const totalDesired = workerAvail?.desired_shifts ?? 0;

  return (
    <div
      className="border-r flex items-center h-full"
      style={{ width: `${COL_WIDTH}px`, minWidth: `${COL_WIDTH}px` }}
    >
      <div className="flex-1 text-center">
        <span className="text-xs font-bold text-gray-800">{availableCount}</span>
      </div>
      <div className="flex-1 text-center border-r border-gray-200">
        <span className="text-xs font-bold text-gray-800">{wantedCount}</span>
      </div>
      <div className="flex-1 text-center border-r border-gray-200">
        <span className="text-xs font-bold text-gray-800">{totalDesired}</span>
      </div>
    </div>
  );
}

export { COL_WIDTH as AVAILABILITY_STATS_COL_WIDTH };
import React from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { Ban } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import BriefingBar from "./BriefingBar";
import MokedSignupBar from "./MokedSignupBar";

/**
 * Renders the timeline portion of a single worker row in the classic (unpinned) layout.
 * Extracted to keep Matrix.jsx under the size limit.
 */
function ClassicTimelineRow({
  worker,
  index,
  isSelected,
  rowBg,
  timelineWidth,
  ppm,
  viewMode,
  dateString,
  currentDate,
  dailySlots,
  weeklySlots,
  availabilityShifts,
  workerUnavailabilities,
  workerTemplateShifts,
  workerExtraTaskShifts,
  workerMokedSignups,
  workerBriefingMarkers,
  dragPreview,
  handleMouseDown,
  getDayIndexFromDate,
  timeToPixels,
  endTimeToPixels,
  getTimelineRangeStyle,
  getOperationalMinutes,
  getOperationalEndMinutes,
  isStandbyStatus,
  isWorkerAssignedToRow,
  allTemplates,
  templateRows,
  timesOverlap,
  handleTypeClick,
  handleShiftDoubleClick,
  canManage,
  onEditUnavail,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  // ── Bar sub-components (inlined here to keep them co-located with the row) ──
  const AssignmentBarLocal = ({ assignment }) => {
    const posDate = assignment.operational_date || assignment.schedule_date || assignment.date;
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(posDate) : 0;
    const startPx = timeToPixels(assignment.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(assignment.start_time, assignment.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 2);
    if (startPx < 0 || startPx > timelineWidth) return null;
    const isTemplate = assignment.isTemplateShift;
    const standby = isStandbyStatus(assignment.status);
    if (standby) {
      const borderColor = isTemplate ? '#a855f7' : '#3b82f6';
      return (
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <div className="absolute h-full rounded-sm z-20 flex items-center justify-center px-1 overflow-hidden" style={{ right: `${startPx}px`, width: `${widthPx}px`, backgroundColor: 'transparent', border: `2px dashed ${borderColor}` }}>
            <span className="text-[9px] font-bold truncate" style={{ color: borderColor }}>{assignment.status}</span>
          </div>
        </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
          <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p><p>סטטוס כוננות: {assignment.status}</p>
        </TooltipContent></Tooltip></TooltipProvider>
      );
    }
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div className={`absolute border-r-2 rounded-sm flex flex-col items-center justify-center px-2 overflow-hidden z-20 ${isTemplate ? "bg-purple-400 border-purple-600" : assignment.has_trainee ? "bg-orange-400 border-orange-600" : "bg-blue-400 border-blue-600"}`} style={{ right: `${startPx}px`, width: `${widthPx}px`, top: '15%', height: '70%' }}>
          {!isTemplate && <span className="text-white text-xs font-medium truncate">{assignment.hours}h</span>}
          {assignment.status && <span className="text-white text-[8px] truncate">{assignment.status}</span>}
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold">{assignment.food_cart_name}</p><p>זמן: {assignment.start_time} - {assignment.end_time}</p>{assignment.status && <p>סטטוס: {assignment.status}</p>}
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  const AvailabilityBarLocal = ({ shift, shiftIdx }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(shift.operational_date || shift.date) : 0;
    const startPx = timeToPixels(shift.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(shift.start_time, shift.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    if (startPx < 0 || startPx > timelineWidth) return null;
    const typeLabels = { wanted: "W", available: "A", unavailable: "U" };
    const borderColors = { wanted: '#16a34a', available: '#3b82f6', unavailable: '#dc2626' };
    const borderColor = borderColors[shift.type] || '#3b82f6';
    const overlappingAssignments = templateRows.filter(r => {
      if (r.date !== shift.date || !r.values) return false;
      const tmpl = allTemplates.find(t => t.id === r.template_id);
      if (!tmpl) return false;
      const { assigned } = isWorkerAssignedToRow(r, worker.id, tmpl);
      if (!assigned) return false;
      const st = r.values?.["התחלה"] || r.values?.["שעת התחלה"];
      const et = r.values?.["סיום"] || r.values?.["שעת סיום"];
      return st && et && timesOverlap(shift.start_time, shift.end_time, st, et);
    }).map(r => ({ start_time: r.values?.["התחלה"] || r.values?.["שעת התחלה"], end_time: r.values?.["סיום"] || r.values?.["שעת סיום"], status: r.values?.status || null }));

    const handleBarDblClick = (e) => { e.stopPropagation(); e.preventDefault(); setTimeout(() => handleShiftDoubleClick(e, worker, shift), 0); };
    const handleBarMouseDown = (action) => (e) => {
      if (e.detail >= 2) return; // let double-click fire instead
      e.stopPropagation();
      handleMouseDown(e, worker, shift, action, dayIndex);
    };

    return (
      <div
        data-matrix-existing-bar="true"
        data-matrix-avail-bar="true"
        data-shift-idx={shiftIdx}
        className="absolute h-full rounded-sm z-20 cursor-move overflow-visible"
        style={{ right: `${startPx}px`, width: `${widthPx}px`, backgroundColor: `${borderColor}18`, border: `2px solid ${borderColor}` }}
        onMouseDown={handleBarMouseDown('move')}
        onDoubleClick={handleBarDblClick}
      >
        {/* Left resize handle — extra-wide for easy grabbing, dblclick opens editor */}
        <div
          data-matrix-existing-bar="true"
          className="absolute left-0 top-0 h-full cursor-ew-resize z-30"
          style={{ width: '16px', marginLeft: '-6px' }}
          onMouseDown={handleBarMouseDown('resize-end')}
          onDoubleClick={handleBarDblClick}
        />
        {/* Right resize handle — extra-wide for easy grabbing, dblclick opens editor */}
        <div
          data-matrix-existing-bar="true"
          className="absolute right-0 top-0 h-full cursor-ew-resize z-30"
          style={{ width: '16px', marginRight: '-6px' }}
          onMouseDown={handleBarMouseDown('resize-start')}
          onDoubleClick={handleBarDblClick}
        />
        <button
          data-matrix-existing-bar="true"
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-[8px] font-bold z-30 hover:scale-110 transition-transform"
          style={{ borderColor }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleTypeClick(e, worker, shift); }}
          onDoubleClick={handleBarDblClick}
        >
          {typeLabels[shift.type] || "A"}
        </button>
        {overlappingAssignments.map((ass, i) => {
          const avS = getOperationalMinutes(shift.start_time);
          const avE = getOperationalEndMinutes(shift.start_time, shift.end_time);
          const assS = getOperationalMinutes(ass.start_time);
          const assE = getOperationalEndMinutes(ass.start_time, ass.end_time);
          const overS = Math.max(avS, assS), overE = Math.min(avE, assE);
          const totalM = avE - avS;
          return <div key={i} className="absolute top-0 h-full" style={{ left: `${((overS - avS) / totalM) * 100}%`, width: `${((overE - overS) / totalM) * 100}%`, backgroundColor: isStandbyStatus(ass.status) ? 'rgba(200,200,210,0.55)' : 'rgba(192,132,252,0.55)', pointerEvents: 'none' }} />;
        })}
      </div>
    );
  };

  const UnavailabilityBarLocal = ({ unavail }) => {
    const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(unavail.date) : 0;
    const startPx = timeToPixels(unavail.start_time, dayIndex, viewMode, ppm);
    const endPx = endTimeToPixels(unavail.start_time, unavail.end_time, viewMode, ppm, dayIndex);
    const widthPx = Math.max(endPx - startPx, 0);
    if (startPx < 0 || startPx > timelineWidth) return null;
    return (
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <div
          onClick={(e) => { e.stopPropagation(); if (canManage) onEditUnavail && onEditUnavail(unavail); }}
          className={`absolute h-full rounded-sm flex items-center justify-center z-15 ${canManage ? 'cursor-pointer' : ''} ${unavail.reason === 'overseas' ? 'bg-red-200 border-r-2 border-red-500' : 'bg-gray-300 border-r-2 border-gray-500'}`}
          style={{ right: `${startPx}px`, width: `${widthPx}px` }}
        >
          <Ban className="w-3 h-3 text-gray-600" />
        </div>
      </TooltipTrigger><TooltipContent className="bg-gray-800 text-white border-none">
        <p className="font-bold capitalize">{unavail.reason}</p><p>{unavail.start_time} - {unavail.end_time}</p>
      </TooltipContent></Tooltip></TooltipProvider>
    );
  };

  // DragPreview using shared getTimelineRangeStyle
  const DragPreviewLocal = ({ preview }) => {
    if (!preview || preview.workerId !== worker.id) return null;
    const dayIndex = preview.day || 0;
    const { style } = getTimelineRangeStyle(preview.start, preview.end, dayIndex, viewMode, ppm);
    return <div className="absolute h-full bg-yellow-300 border-2 border-yellow-500 rounded-sm flex items-center justify-center z-30 opacity-80 pointer-events-none" style={style}><span className="text-xs font-bold">{preview.start} - {preview.end}</span></div>;
  };

  return (
    <div
      data-worker-id={worker.id}
      className={`relative border-r cursor-crosshair h-full shrink-0 ${rowBg}`}
      dir="rtl"
      style={{ width: `${timelineWidth}px` }}
      onMouseDown={(e) => {
        // RULE 1: existing bars handle themselves — never start a create drag from them
        if (
          e.target.closest("[data-matrix-existing-bar='true']") ||
          e.target.closest("button") ||
          e.target.closest("[role='button']") ||
          e.target.closest("[data-no-drag='true']")
        ) {
          return;
        }
        if (e.detail === 2) return; // double-click on empty space — don't create
        handleMouseDown(e, worker, null, 'create');
      }}
      onDoubleClick={(e) => {
        // Safety net: if dblclick lands on bar but onDoubleClick on bar didn't fire, open editor
        const bar = e.target.closest("[data-matrix-avail-bar='true']");
        if (bar) {
          e.stopPropagation();
          const shiftIdx = parseInt(bar.dataset.shiftIdx);
          if (!isNaN(shiftIdx) && availabilityShifts[shiftIdx]) {
            handleShiftDoubleClick(e, worker, availabilityShifts[shiftIdx]);
          }
        }
      }}
    >
      {/* Grid lines with data attributes for slot-based drag */}
      <div className="absolute inset-0 flex h-full" dir="rtl">
        {viewMode === 'daily'
          ? dailySlots.map(hour => {
              const opMin = ((hour - 6 + 24) % 24) * 60;
              const timeStr = `${String(hour).padStart(2,'0')}:00`;
              return (
                <div
                  key={hour}
                  className="shrink-0 border-l time-slot h-full"
                  style={{ width: `${60 * ppm}px` }}
                  data-matrix-time-slot="true"
                  data-operational-date={dateString}
                  data-operational-minute={opMin}
                  data-time={timeStr}
                  data-day-index={0}
                />
              );
            })
          : weeklySlots.map((slot, idx) => {
              const opMin = ((slot.hour - 6 + 24) % 24) * 60;
              const timeStr = `${String(slot.hour).padStart(2,'0')}:00`;
              const slotDate = format(addDays(weekStart, slot.day), 'yyyy-MM-dd');
              return (
                <div
                  key={idx}
                  className="shrink-0 border-l time-slot h-full"
                  style={{ width: `${60 * ppm}px` }}
                  data-matrix-time-slot="true"
                  data-operational-date={slotDate}
                  data-operational-minute={opMin}
                  data-time={timeStr}
                  data-day-index={slot.day}
                />
              );
            })
        }
      </div>
      <div className="absolute inset-0">
        {viewMode === 'weekly' && [0,1,2,3,4,5,6].map(day => {
          // Day boundary at 06:00 = opMin 0, i.e. the RIGHT edge of each day's operational block
          const px = day * 1440 * ppm;
          return <div key={`db-${day}`} className="absolute top-0 h-full pointer-events-none" style={{ right: `${px}px`, width: '2px', backgroundColor: 'rgba(80,80,80,0.35)', zIndex: 15 }} />;
        })}
        {availabilityShifts.map((shift, idx) => <AvailabilityBarLocal key={`avail-${idx}`} shift={shift} shiftIdx={idx} />)}
        {workerUnavailabilities.map(unavail => <UnavailabilityBarLocal key={unavail.id} unavail={unavail} />)}
        {workerTemplateShifts.map(ts => <AssignmentBarLocal key={ts.id} assignment={ts} />)}
        {workerExtraTaskShifts.map(ets => <AssignmentBarLocal key={ets.id} assignment={ets} />)}
        {workerMokedSignups.map((sg, i) => {
          const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(sg.date) : 0;
          return (
            <MokedSignupBar
              key={`mokedsignup_${worker.id}_${i}`}
              signups={sg.signups}
              startTime={sg.startTime}
              endTime={sg.endTime}
              dayIndex={dayIndex}
              viewMode={viewMode}
              ppm={ppm}
              timelineWidth={timelineWidth}
            />
          );
        })}
        {workerBriefingMarkers.map(marker => {
          const dayIndex = viewMode === 'weekly' ? getDayIndexFromDate(marker.visual_operational_date) : 0;
          return (
            <BriefingBar
              key={marker.id}
              visualTime={marker.visual_time}
              originalBriefingTime={marker.original_briefing_time}
              linkedShiftDate={marker.linked_shift_operational_date}
              shiftStartTime={marker.shift_start_time}
              shiftEndTime={marker.shift_end_time}
              dayIndex={dayIndex}
              viewMode={viewMode}
              ppm={ppm}
              timeToPixels={timeToPixels}
            />
          );
        })}
        <DragPreviewLocal preview={dragPreview} />
      </div>
    </div>
  );
}

export default React.memo(ClassicTimelineRow);
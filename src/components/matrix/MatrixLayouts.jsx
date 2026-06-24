import React, { useState } from "react";
import { Plus, FileSpreadsheet, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MasterControls from "./MasterControls";
import SaturdayReferenceStrip from "./SaturdayReferenceStrip";
import SaturdayTimelineHeader from "./SaturdayTimelineHeader";
import { AvailabilityStatsHeader, AvailabilityStatsCell } from "./AvailabilityStatsColumn";

const PinIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5"/>
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>
  </svg>
);

export function PinnedLayout({
  togglePin, fixedColumnsWidth, WORKER_COL_WIDTH, viewMode, workers, sendingWhatsApp,
  getWorkerSendStatus, sendWhatsAppNotification, setSelectedWorkerForNotification,
  setNotificationNotes, setShowNotificationDialog, isCurrentWeekPublished, handleTogglePublish,
  togglingPublish, refreshWorkers, summaryColumns, setShowSummaryColumnsDialog, workerPanelRef,
  loading, initialLoaded, workersLoadFailed, loadStaticData, filteredWorkers, selectedWorkerIds,
  availabilities, weekStartDate, renderSummaryCell, ROW_H, renderWorkerCellContent, handleRowClick,
  timelineHeaderRef, timelineWidth, renderTimelineHeader, currentDate, ppm,
  timelineScrollRef, handlePointerDown, handlePointerMove, handlePointerUp,
  renderTimelineRow, satAssigned, satAvail, satUnavail, allTemplates, isStandbyStatus,
  summaryColWidths, handleSummaryColReorder, handleSummaryColResize,
  handleWorkerDragStart, handleWorkerDrop, SummaryColumnsHeaderComponent,
}) {
  const [dragOverWorkerId, setDragOverWorkerId] = useState(null);
  return (
    <div className="flex flex-1 min-h-0" dir="rtl">
      <div className="flex flex-col flex-shrink-0 bg-white z-20" style={{ width: `${fixedColumnsWidth}px`, boxShadow: '-4px 0 8px rgba(0,0,0,0.06)', borderLeft: '1px solid #e5e7eb' }}>
        <div className="flex-shrink-0 bg-gray-100 border-b z-10" style={{ height: '40px' }}>
          <div className="flex items-center h-full">
            <div className="px-2 flex items-center gap-1 h-full border-r relative" style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <button onClick={togglePin} className="absolute top-1 left-1 flex-shrink-0 text-green-600 hover:text-green-800 transition-colors p-0.5 rounded hover:bg-green-50 z-10"><PinIcon size={13} /></button>
              </TooltipTrigger><TooltipContent dir="rtl">בטל הקפאת עמודת עובדים</TooltipContent></Tooltip></TooltipProvider>
              <MasterControls workers={workers} getWorkerSendStatus={getWorkerSendStatus}
                onSendWhatsApp={async (vw) => { for (const w of vw) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
                onSendEmail={async (vw) => { for (const w of vw) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
                sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
                isWeekPublished={isCurrentWeekPublished} onTogglePublish={handleTogglePublish} togglingPublish={togglingPublish} />
            </div>
            {viewMode === 'weekly' && <AvailabilityStatsHeader />}
            {viewMode === 'weekly' && SummaryColumnsHeaderComponent && (
              <SummaryColumnsHeaderComponent
                summaryColumns={summaryColumns}
                columnWidths={summaryColWidths}
                onReorder={handleSummaryColReorder}
                onResize={handleSummaryColResize}
                setShowSummaryColumnsDialog={() => setShowSummaryColumnsDialog(true)}
              />
            )}
          </div>
        </div>
        <div ref={workerPanelRef} className="overflow-y-auto overflow-x-hidden flex-1 min-h-0" style={{ scrollbarWidth: 'none' }}>
          {loading && !initialLoaded ? <div className="text-center p-8" dir="rtl">טוען...</div>
            : workersLoadFailed ? <div className="text-center p-8 text-gray-500" dir="rtl">בעיית טעינה — <button className="underline" onClick={() => loadStaticData()}>נסה שוב</button></div>
            : filteredWorkers.length === 0 ? <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
            : filteredWorkers.map((worker, index) => {
              const isSelected = selectedWorkerIds.has(worker.id);
              const rowBg = isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
              const isDropTarget = dragOverWorkerId === worker.id;
              return (
                <div
                  key={worker.id}
                  draggable
                  onDragStart={() => handleWorkerDragStart(worker.id)}
                  onDragOver={e => { e.preventDefault(); setDragOverWorkerId(worker.id); }}
                  onDrop={() => { handleWorkerDrop(worker.id); setDragOverWorkerId(null); }}
                  onDragEnd={() => setDragOverWorkerId(null)}
                  className={`flex border-b cursor-pointer select-none ${rowBg} ${isDropTarget ? 'border-t-2 border-blue-400' : ''}`}
                  style={{ height: `${ROW_H}px` }}
                  onClick={e => handleRowClick(e, worker, index)}
                >
                  <div className={`px-1 font-medium text-gray-800 border-r flex items-center gap-1 h-full ${rowBg}`} style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
                    <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0 cursor-grab" />
                    {renderWorkerCellContent(worker, index)}
                  </div>
                  {viewMode === 'weekly' && <AvailabilityStatsCell workerId={worker.id} availabilities={availabilities} weekStartDate={weekStartDate} />}
                  {viewMode === 'weekly' && summaryColumns.map(col => renderSummaryCell(worker, col, index, isSelected))}
                  {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-full ${rowBg}`} />}
                </div>
              );
            })}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div ref={timelineHeaderRef} className="flex-shrink-0 bg-gray-100 border-b" style={{ height: '40px', overflowX: 'hidden', scrollbarWidth: 'none' }} dir="ltr">
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div style={{ width: `${timelineWidth}px` }}>{renderTimelineHeader()}</div>
            {viewMode === 'weekly' && <SaturdayTimelineHeader currentDate={currentDate} ppm={ppm} />}
          </div>
        </div>
        <div ref={timelineScrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto matrix-scroll-container matrix-timeline-pinned" dir="ltr" onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp}>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div dir="rtl" style={{ width: `${timelineWidth}px` }}>
              {loading && !initialLoaded ? null : filteredWorkers.map((worker, index) => renderTimelineRow(worker, index, selectedWorkerIds.has(worker.id)))}
            </div>
            {viewMode === 'weekly' && <SaturdayReferenceStrip currentDate={currentDate} filteredWorkers={filteredWorkers} satAssigned={satAssigned} satAvail={satAvail} satUnavail={satUnavail} allTemplates={allTemplates} ROW_H={ROW_H} ppm={ppm} timelineWidth={timelineWidth} isStandbyStatus={isStandbyStatus} showHeader={false} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClassicLayout({
  scrollContainerRef, handlePointerDown, handlePointerMove, handlePointerUp,
  timelineWidth, renderTimelineHeader, loading, initialLoaded, filteredWorkers, selectedWorkerIds,
  renderTimelineRow, viewMode, currentDate, ppm, satAssigned, satAvail, satUnavail, allTemplates,
  ROW_H, isStandbyStatus, fixedColumnsWidth, WORKER_COL_WIDTH, togglePin, workers, sendingWhatsApp,
  getWorkerSendStatus, sendWhatsAppNotification, setSelectedWorkerForNotification, setNotificationNotes,
  setShowNotificationDialog, isCurrentWeekPublished, handleTogglePublish, togglingPublish, refreshWorkers,
  summaryColumns, setShowSummaryColumnsDialog, workersLoadFailed, loadStaticData, availabilities,
  weekStartDate, renderSummaryCell, renderWorkerCellContent, handleRowClick,
  summaryColWidths, handleSummaryColReorder, handleSummaryColResize,
  handleWorkerDragStart, handleWorkerDrop, SummaryColumnsHeaderComponent,
}) {
  const [dragOverWorkerId, setDragOverWorkerId] = useState(null);
  return (
    <div ref={scrollContainerRef} dir="ltr" className="overflow-x-auto overflow-y-auto flex-1 min-h-0 matrix-scroll-container" onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp}>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div dir="rtl" className="flex-shrink-0" style={{ width: `${timelineWidth}px` }}>
          <div className="flex sticky top-0 bg-gray-100 z-30 border-b" style={{ width: `${timelineWidth}px` }}>
            <div className="flex" dir="rtl" style={{ width: `${timelineWidth}px` }}>{renderTimelineHeader()}</div>
          </div>
          {loading && !initialLoaded ? null : filteredWorkers.map((worker, index) => {
            const isSelected = selectedWorkerIds.has(worker.id);
            return renderTimelineRow(worker, index, isSelected);
          })}
        </div>

        {viewMode === 'weekly' && (
          <div className="flex-shrink-0">
            <div className="sticky top-0 z-30 bg-gray-100 border-b" style={{ height: '40px' }}>
              <SaturdayTimelineHeader currentDate={currentDate} ppm={ppm} />
            </div>
            <SaturdayReferenceStrip currentDate={currentDate} filteredWorkers={filteredWorkers} satAssigned={satAssigned} satAvail={satAvail} satUnavail={satUnavail} allTemplates={allTemplates} ROW_H={ROW_H} ppm={ppm} timelineWidth={timelineWidth} isStandbyStatus={isStandbyStatus} showHeader={false} />
          </div>
        )}

        <div className="flex-shrink-0 bg-white" dir="rtl" style={{ width: `${fixedColumnsWidth}px`, minWidth: `${fixedColumnsWidth}px`, boxShadow: '-4px 0 8px rgba(0,0,0,0.06)' }}>
          <div className="bg-gray-100 border-b z-10 sticky top-0" style={{ height: '40px' }}>
            <div className="flex items-center h-full">
              <div className="px-2 flex items-center gap-1 h-full border-r relative" style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <button onClick={togglePin} className="absolute top-1 left-1 flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors p-0.5 rounded hover:bg-green-50 z-10"><PinIcon size={13} /></button>
                </TooltipTrigger><TooltipContent dir="rtl">הקפא עמודת עובדים</TooltipContent></Tooltip></TooltipProvider>
                <MasterControls workers={workers} getWorkerSendStatus={getWorkerSendStatus}
                  onSendWhatsApp={async (vw) => { for (const w of vw) { await sendWhatsAppNotification(w); await new Promise(r => setTimeout(r, 500)); } }}
                  onSendEmail={async (vw) => { for (const w of vw) { setSelectedWorkerForNotification(w); setNotificationNotes(""); setShowNotificationDialog(true); await new Promise(r => setTimeout(r, 100)); } }}
                  sendingWhatsApp={sendingWhatsApp} onUpdate={refreshWorkers}
                  isWeekPublished={isCurrentWeekPublished} onTogglePublish={handleTogglePublish} togglingPublish={togglingPublish} />
              </div>
              {viewMode === 'weekly' && <AvailabilityStatsHeader />}
              {viewMode === 'weekly' && SummaryColumnsHeaderComponent && (
                <SummaryColumnsHeaderComponent
                  summaryColumns={summaryColumns}
                  columnWidths={summaryColWidths}
                  onReorder={handleSummaryColReorder}
                  onResize={handleSummaryColResize}
                  setShowSummaryColumnsDialog={() => setShowSummaryColumnsDialog(true)}
                />
              )}
            </div>
          </div>
          {loading && !initialLoaded ? <div className="text-center p-8" dir="rtl">טוען...</div>
            : workersLoadFailed ? <div className="text-center p-8 text-gray-500" dir="rtl">בעיית טעינה — <button className="underline" onClick={() => loadStaticData()}>נסה שוב</button></div>
            : filteredWorkers.length === 0 ? <div className="text-center p-8 text-gray-500" dir="rtl">לא נמצאו עובדים פעילים.</div>
            : filteredWorkers.map((worker, index) => {
              const isSelected = selectedWorkerIds.has(worker.id);
              const rowBg = isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
              const isDropTarget = dragOverWorkerId === worker.id;
              return (
                <div
                  key={worker.id}
                  draggable
                  onDragStart={() => handleWorkerDragStart(worker.id)}
                  onDragOver={e => { e.preventDefault(); setDragOverWorkerId(worker.id); }}
                  onDrop={() => { handleWorkerDrop(worker.id); setDragOverWorkerId(null); }}
                  onDragEnd={() => setDragOverWorkerId(null)}
                  className={`flex border-b cursor-pointer select-none ${rowBg} ${isDropTarget ? 'border-t-2 border-blue-400' : ''}`}
                  style={{ height: `${ROW_H}px` }}
                  onClick={e => handleRowClick(e, worker, index)}
                >
                  <div className={`px-1 font-medium text-gray-800 border-r flex items-center gap-1 h-full ${rowBg}`} style={{ width: `${WORKER_COL_WIDTH}px`, minWidth: `${WORKER_COL_WIDTH}px` }}>
                    <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0 cursor-grab" />
                    {renderWorkerCellContent(worker, index)}
                  </div>
                  {viewMode === 'weekly' && <AvailabilityStatsCell workerId={worker.id} availabilities={availabilities} weekStartDate={weekStartDate} />}
                  {viewMode === 'weekly' && summaryColumns.map(col => renderSummaryCell(worker, col, index, isSelected))}
                  {viewMode === 'weekly' && <div className={`w-[28px] min-w-[28px] border-r h-full ${rowBg}`} />}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
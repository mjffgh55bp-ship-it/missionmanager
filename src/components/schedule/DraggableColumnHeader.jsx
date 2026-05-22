import React from "react";
import { TableHead, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { useColumnDrag } from "@/hooks/useColumnDrag";

/**
 * Renders a draggable table header row for column reordering.
 * Uses native HTML5 drag events + DOM midpoint calculation for accurate drop-between-columns.
 */
export default function DraggableColumnHeader({
  groupKey,
  orderedColumns,
  editMode,
  dailyCustomColumns,
  templateId,
  template,
  dateString,
  onReorder,
  onDeleteColumn,
  onAddColumn,
  setDailyCustomColumns,
  setAllTemplates,
  setTemplates,
  base44,
}) {
  const { dragState, getDragHandleProps, getHeaderProps } = useColumnDrag(
    orderedColumns,
    onReorder
  );

  return (
    <TableRow>
      {editMode && <TableHead className="w-[60px] text-center" dir="rtl" />}
      {orderedColumns.map((col, idx) => {
        const isDragging = dragState.dragging === col.name;
        const isDropTarget = dragState.dragging && dragState.dragging !== col.name && dragState.dropIndex !== null;
        const showIndicatorBefore = dragState.dropIndex === idx;
        const showIndicatorAfter = dragState.dropIndex === idx + 1 && idx === orderedColumns.length - 1;

        return (
          <TableHead
            key={col.name}
            dir="rtl"
            className={`text-center select-none relative ${isDragging ? "opacity-40 bg-blue-50" : ""}`}
            style={{ width: `${col.width}px` }}
            {...(editMode ? getHeaderProps(col.name, idx) : {})}
          >
            {/* Drop indicator — vertical line before this column */}
            {editMode && showIndicatorBefore && (
              <span
                style={{
                  position: "absolute",
                  right: -2,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: "#3b82f6",
                  zIndex: 10,
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            )}

            {editMode ? (
              <div className="flex items-center gap-1 justify-center">
                <span
                  {...getDragHandleProps(col.name)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  title="גרור לשינוי סדר"
                >
                  <GripVertical className="w-3 h-3" />
                </span>
                <span>{col.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                  onClick={() => onDeleteColumn(col)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <span>{col.name}</span>
            )}
          </TableHead>
        );
      })}
      <TableHead className="w-[100px] text-center" dir="rtl">סטטוס</TableHead>
      {editMode && <TableHead className="w-[60px] text-center" dir="rtl" />}
      {editMode && (
        <TableHead className="w-[40px] p-0 text-center">
          <button
            onClick={onAddColumn}
            className="flex items-center justify-center w-full h-full px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
            title="הוסף עמודה"
          >
            <Plus className="w-4 h-4" />
          </button>
        </TableHead>
      )}
    </TableRow>
  );
}
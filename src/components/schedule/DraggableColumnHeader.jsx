import React from "react";
import { TableHead, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { useColumnDrag } from "@/hooks/useColumnDrag";

// In RTL layout, "before column N" visually = right edge of the cell
const DropIndicator = ({ side = "right" }) => (
  <span
    style={{
      position: "absolute",
      [side]: -2,
      top: 2,
      bottom: 2,
      width: 4,
      background: "#3b82f6",
      zIndex: 20,
      borderRadius: 2,
      pointerEvents: "none",
      boxShadow: "0 0 4px #3b82f6aa",
    }}
  />
);

export default function DraggableColumnHeader({
  groupKey,
  orderedColumns,
  scheduleColumnsById = {},
  editMode,
  templateId,
  onReorder,
  onDeleteColumn,
  onAddColumn,
}) {
  const { dragState, getDragHandleProps, getHeaderProps } = useColumnDrag(
    orderedColumns,
    onReorder
  );

  const { dragging, dropIndex } = dragState;

  return (
    <TableRow>
      {editMode && <TableHead className="w-[60px] text-center" dir="rtl" />}
      {orderedColumns.map((col, idx) => {
        const isDragging = dragging === col.name;
        // Show indicator on left edge of this column when dropIndex === idx
        const showBefore = editMode && dragging && dropIndex === idx;
        // Show indicator on right edge of last column when dropIndex === length
        const showAfter = editMode && dragging && idx === orderedColumns.length - 1 && dropIndex === orderedColumns.length;

        return (
          <TableHead
            key={col.name}
            dir="rtl"
            className={`text-center select-none relative transition-colors ${
              isDragging ? "opacity-30 bg-blue-50" : ""
            } ${
              !isDragging && dragging && dropIndex !== null && (dropIndex === idx || dropIndex === idx + 1)
                ? "bg-blue-50/40"
                : ""
            }`}
            style={{ width: `${col.width}px` }}
            {...(editMode ? getHeaderProps(col.name, idx) : {})}
          >
            {/* Drop indicator: RTL "before col N" = right edge */}
            {showBefore && <DropIndicator side="right" />}

            {(() => {
            const resolvedName = (col.column_id && scheduleColumnsById[col.column_id]?.name) || col.name;
            return editMode ? (
              <div className="flex items-center gap-1 justify-center">
                <span
                  {...getDragHandleProps(col.name)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  title="גרור לשינוי סדר"
                >
                  <GripVertical className="w-3 h-3" />
                </span>
                <span>{resolvedName}</span>
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
              <span>{resolvedName}</span>
            );
          })()}

            {/* Drop indicator: RTL "after last col" = left edge */}
            {showAfter && <DropIndicator side="left" />}
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
import React, { useState, useRef, useEffect } from "react";
import { GripVertical, ChevronDown, ChevronUp, Check, X, AlignLeft } from "lucide-react";

const DEFAULT_HEIGHT = 80;
const MIN_HEIGHT = 40;

export default function ScheduleNotes({ notes, height, editMode, onSave, onHeightChange, dragHandleProps }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes || "");
  const [expanded, setExpanded] = useState(false);
  const [resizing, setResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);
  const textareaRef = useRef(null);

  const displayHeight = height || DEFAULT_HEIGHT;

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(notes || "");
    setEditing(false);
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartY.current = e.clientY;
    resizeStartH.current = displayHeight;
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const delta = e.clientY - resizeStartY.current;
      const newH = Math.max(MIN_HEIGHT, resizeStartH.current + delta);
      onHeightChange(newH);
    };
    const onUp = () => setResizing(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [resizing]);

  const isEmpty = !notes || !notes.trim();

  return (
    <div
      className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
      style={{ cursor: resizing ? "ns-resize" : undefined }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 select-none">
        {/* drag handle — only shown in edit mode; has dragHandleProps attached by parent */}
        <div {...dragHandleProps} className="flex-shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        <AlignLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-600 flex-1" dir="rtl">הערות</span>

        <div className="flex items-center gap-1">
          {editing && (
            <>
              <button onClick={handleSave} className="p-1 rounded hover:bg-green-100 transition-colors" title="שמור">
                <Check className="w-3.5 h-3.5 text-green-600" />
              </button>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-red-100 transition-colors" title="ביטול">
                <X className="w-3.5 h-3.5 text-red-500" />
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            title={expanded ? "כווץ" : "הרחב"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        style={{ height: expanded ? undefined : displayHeight, minHeight: expanded ? 120 : undefined }}
        className={`relative overflow-hidden ${expanded ? "" : "overflow-y-auto"}`}
        onClick={() => { if (!editing && editMode && !expanded) { setDraft(notes || ""); setEditing(true); } }}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            dir="rtl"
            className="w-full h-full resize-none border-0 outline-none p-3 text-sm text-gray-700 bg-white"
            style={{ height: expanded ? 200 : displayHeight, minHeight: MIN_HEIGHT }}
            placeholder="הוסף הערות והנחיות למנהלים..."
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div
            dir="rtl"
            className={`p-3 text-sm whitespace-pre-wrap ${isEmpty ? "text-gray-400 italic" : "text-gray-700"} ${editMode ? "cursor-text" : ""}`}
          >
            {isEmpty ? (editMode ? "לחץ להוספת הערות..." : "") : notes}
          </div>
        )}
      </div>

      {/* Resize handle — always available, not expanded */}
      {!expanded && (
        <div
          className="h-2 bg-gray-100 border-t border-gray-200 cursor-ns-resize hover:bg-blue-100 transition-colors flex items-center justify-center"
          onMouseDown={handleResizeMouseDown}
          title="גרור לשינוי גובה"
        >
          <div className="w-8 h-0.5 bg-gray-300 rounded-full" />
        </div>
      )}
    </div>
  );
}
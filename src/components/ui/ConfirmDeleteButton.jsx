import React, { useState, useRef, useEffect } from "react";
import { X, Trash2 } from "lucide-react";

/**
 * Two-step inline delete confirmation button.
 * First click: shows "בטוח?" + cancel. Second click: calls onConfirm.
 * variant="icon" → small X icon (for badges/rows)
 * variant="button" → text button (for larger items)
 */
export default function ConfirmDeleteButton({ onConfirm, variant = "icon", label = "מחק", className = "" }) {
  const [pending, setPending] = useState(false);
  const timerRef = useRef(null);

  // Auto-cancel after 3 seconds
  useEffect(() => {
    if (pending) {
      timerRef.current = setTimeout(() => setPending(false), 3000);
    }
    return () => clearTimeout(timerRef.current);
  }, [pending]);

  if (!pending) {
    if (variant === "icon") {
      return (
        <button
          onClick={e => { e.stopPropagation(); setPending(true); }}
          className={`text-red-400 hover:text-red-600 transition-colors ${className}`}
          title="מחק"
        >
          <X className="w-4 h-4" />
        </button>
      );
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); setPending(true); }}
        className={`text-red-400 hover:text-red-600 text-sm flex items-center gap-1 transition-colors ${className}`}
      >
        <Trash2 className="w-3.5 h-3.5" />{label}
      </button>
    );
  }

  // Pending state — show confirm UI
  return (
    <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <span className="text-xs font-semibold text-red-600">בטוח?</span>
      <button
        onClick={() => { setPending(false); onConfirm(); }}
        className="text-xs bg-red-600 text-white rounded px-1.5 py-0.5 hover:bg-red-700 transition-colors"
      >
        מחק
      </button>
      <button
        onClick={() => setPending(false)}
        className="text-xs bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 hover:bg-gray-300 transition-colors"
      >
        ביטול
      </button>
    </span>
  );
}
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronUp, Check, X, Wand2 } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";

// Normalize: string → object
export function normalizeItem(item) {
  if (typeof item === "string") {
    return { name: item, mapping_id: "", export_name: "", is_importable: true, is_exportable: true };
  }
  return {
    name: item.name || "",
    mapping_id: item.mapping_id || "",
    export_name: item.export_name || "",
    is_importable: item.is_importable !== false,
    is_exportable: item.is_exportable !== false,
  };
}

// Generate a stable English-style mapping_id from a Hebrew/English name
export function suggestMappingId(name, prefix = "item") {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return cleaned ? `${prefix}_${cleaned}` : `${prefix}_${Date.now()}`;
}

/**
 * MappableItemRow
 * Props:
 *   item        – normalized object { name, mapping_id, export_name, is_importable, is_exportable }
 *   allItems    – all items (to detect duplicate mapping_id)
 *   prefix      – prefix for suggested mapping_id (e.g. "role", "pop", "task", "status")
 *   color       – tailwind color token (e.g. "indigo", "orange", "teal")
 *   onSave      – (updatedItem) => void
 *   onDelete    – () => void
 */
export default function MappableItemRow({ item, allItems, prefix, color = "indigo", onSave, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);

  // Sync draft when item prop changes (after parent saves)
  useEffect(() => { setDraft(item); }, [item.name, item.mapping_id, item.export_name]);

  const isDuplicate = draft.mapping_id &&
    allItems.filter(i => normalizeItem(i).mapping_id === draft.mapping_id).length > 1;

  const hasMappingId = !!item.mapping_id;

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setExpanded(false);
  };

  const handleCancel = () => {
    setDraft(item);
    setExpanded(false);
  };

  const colorMap = {
    indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", badge: "bg-indigo-100 text-indigo-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
    teal:   { bg: "bg-teal-50",   border: "border-teal-200",   text: "text-teal-700",   badge: "bg-teal-100 text-teal-700" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
    green:  { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className={`border rounded-lg overflow-hidden ${isDuplicate ? "border-orange-400" : c.border}`}>
      {/* Compact row */}
      <div className={`flex items-center justify-between px-3 py-2 ${c.bg}`} dir="rtl">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm truncate">{item.name}</span>
          {hasMappingId ? (
            <span className="text-[10px] font-mono bg-white border rounded px-1.5 text-gray-500 shrink-0">{item.mapping_id}</span>
          ) : (
            <span className="text-[10px] text-orange-500 flex items-center gap-0.5 shrink-0">
              <AlertTriangle className="w-3 h-3" />ללא מזהה
            </span>
          )}
          {isDuplicate && (
            <Badge className="bg-orange-100 text-orange-700 text-[10px] shrink-0">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />כפול
            </Badge>
          )}

        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setDraft(item); setExpanded(v => !v); }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-white/60"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <ConfirmDeleteButton onConfirm={onDelete} />
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="p-3 border-t bg-white space-y-3" dir="rtl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local display name */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">שם מקומי</label>
              <Input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onBlur={async e => {
                  const newName = e.target.value.trim();
                  if (newName && newName !== item.name) {
                    setSaving(true);
                    await onSave({ ...draft, name: newName });
                    setSaving(false);
                  }
                }}
                onKeyDown={async e => {
                  if (e.key === 'Enter') e.target.blur();
                }}
                className="h-7 text-sm"
                dir="rtl"
              />
              <p className="text-[10px] text-orange-500 mt-0.5">שינוי שם יעדכן את כל הנתונים הקשורים</p>
            </div>
            {/* mapping_id / ID */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">ID / מזהה</label>
              <div className="flex gap-1">
                <Input
                  value={draft.mapping_id}
                  onChange={e => setDraft(d => ({ ...d, mapping_id: e.target.value.trim().toLowerCase() }))}
                  placeholder={`${prefix}_...`}
                  className="h-7 text-xs font-mono flex-1"
                  dir="ltr"
                />
                <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0"
                  onClick={() => setDraft(d => ({ ...d, mapping_id: suggestMappingId(d.name, prefix) }))}
                  title="הצע מזהה">
                  <Wand2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">ה-ID משמש לזיהוי בין סביבות. השם המקומי הוא רק שם התצוגה בסביבה הזו.</p>
          {isDuplicate && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />מזהה כפול — שנה אותו לפני השמירה
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel}>
              <X className="w-3 h-3 mr-1" />ביטול
            </Button>
            <Button size="sm" className="h-7 text-xs bg-blue-900 hover:bg-blue-800"
              onClick={handleSave} disabled={saving || isDuplicate}>
              {saving ? "שומר..." : <><Check className="w-3 h-3 mr-1" />שמור</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
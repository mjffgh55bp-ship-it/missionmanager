import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ColumnCell({ assignmentId, colType, columnValues, availableSubTypes, freeText = false, onSaved, isTemplateRow = false, isQuantitative = false }) {
  const [open, setOpen] = useState(false);
  
  // Handle both template rows and assignments
  const colData = isTemplateRow ? columnValues : columnValues?.[colType];
  const savedRawValue = isTemplateRow ? (columnValues?.[colType] || "") : (colData?.value || "");
  
  // Parse quantitative counts from saved value
  const parseSavedCounts = () => {
    if (!isQuantitative) return {};
    try { return JSON.parse(savedRawValue || "{}"); } catch { return {}; }
  };

  const [localValue, setLocalValue] = useState("");
  const [localSubTypes, setLocalSubTypes] = useState([]);
  const [localCounts, setLocalCounts] = useState({});

  // Sync local state when popover opens
  useEffect(() => {
    if (open) {
      if (isQuantitative) {
        setLocalCounts(parseSavedCounts());
      } else if (isTemplateRow) {
        setLocalValue(columnValues?.[colType] || "");
        setLocalSubTypes(columnValues?.[`${colType}_subTypes`] || []);
      } else {
        const currentData = columnValues?.[colType];
        setLocalValue(currentData?.value || "");
        setLocalSubTypes(currentData?.subTypes || (currentData?.subType ? [currentData.subType] : []));
      }
    }
  }, [open, columnValues, colType, isTemplateRow, isQuantitative]);

  const handleSave = async () => {
    if (isQuantitative) {
      const jsonVal = JSON.stringify(localCounts);
      if (isTemplateRow) {
        const updatedValues = { ...(columnValues || {}), [colType]: jsonVal };
        setOpen(false);
        if (onSaved) onSaved(updatedValues);
      } else {
        const updatedValues = { ...(columnValues || {}), [colType]: { value: jsonVal, subTypes: [] } };
        await base44.entities.Assignment.update(assignmentId, { column_values: updatedValues });
        setOpen(false);
        if (onSaved) onSaved(updatedValues);
      }
      return;
    }

    const cleanedSubTypes = localSubTypes.filter(st => st && st !== "__none__");
    
    if (isTemplateRow) {
      const updatedValues = { 
        ...(columnValues || {}), 
        [colType]: localValue,
        [`${colType}_subTypes`]: cleanedSubTypes
      };
      setOpen(false);
      if (onSaved) onSaved(updatedValues);
    } else {
      const updatedValues = { 
        ...(columnValues || {}), 
        [colType]: { value: localValue, subTypes: cleanedSubTypes } 
      };
      await base44.entities.Assignment.update(assignmentId, { column_values: updatedValues });
      setOpen(false);
      if (onSaved) onSaved(updatedValues);
    }
  };

  const toggleSubType = (st) => {
    setLocalSubTypes(prev => {
      if (prev.includes(st)) {
        return prev.filter(s => s !== st);
      } else {
        return [...prev, st];
      }
    });
  };

  // Display value for quantitative
  const quantDisplay = () => {
    const counts = parseSavedCounts();
    const parts = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const savedValue = isTemplateRow ? (columnValues?.[colType] || "") : (colData?.value || "");
  const savedSubTypes = isTemplateRow
    ? (columnValues?.[`${colType}_subTypes`] || [])
    : (colData?.subTypes || (colData?.subType ? [colData.subType] : []));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full text-center p-1 rounded border border-gray-200 hover:bg-blue-50 min-h-[28px]">
          <span className="text-xs truncate block text-center">
            {isQuantitative ? quantDisplay() : (savedValue || savedSubTypes.join(", ") || "-")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" onOpenAutoFocus={(e) => e.preventDefault()} dir="rtl">
        <div className="space-y-2">
          {isQuantitative ? (
            <>
              <p className="text-xs font-semibold text-gray-600 mb-1">בחר כמות לכל פריט</p>
              {(availableSubTypes || []).map(st => (
                <div key={st} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700 flex-1">{st}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLocalCounts(prev => ({ ...prev, [st]: Math.max(0, (prev[st] || 0) - 1) }))} className="w-6 h-6 rounded border text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm">−</button>
                    <span className="w-7 text-center text-sm font-medium">{localCounts[st] || 0}</span>
                    <button onClick={() => setLocalCounts(prev => ({ ...prev, [st]: (prev[st] || 0) + 1 }))} className="w-6 h-6 rounded border text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm">+</button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {freeText && (
                <Input 
                  className="h-7 text-xs" 
                  type="text" 
                  value={localValue} 
                  onChange={(e) => setLocalValue(e.target.value)}
                  placeholder="הזן ערך..."
                  dir="rtl"
                />
              )}
              {availableSubTypes && availableSubTypes.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {availableSubTypes.map(st => (
                      <Badge 
                        key={st} 
                        variant={localSubTypes.includes(st) ? "default" : "outline"} 
                        className={`cursor-pointer text-xs ${localSubTypes.includes(st) ? 'bg-blue-600' : ''}`}
                        onClick={() => toggleSubType(st)}
                      >
                        {st}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <Button size="sm" className="w-full h-7 text-xs bg-blue-900 hover:bg-blue-800" onClick={handleSave}>שמור</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
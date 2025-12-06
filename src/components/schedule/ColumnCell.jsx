import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ColumnCell({ assignmentId, colType, columnValues, availableSubTypes, onSaved }) {
  const [open, setOpen] = useState(false);
  const colData = columnValues?.[colType];
  const savedValue = colData?.value || "";
  const savedSubTypes = colData?.subTypes || (colData?.subType ? [colData.subType] : []);
  
  const [localValue, setLocalValue] = useState("");
  const [localSubTypes, setLocalSubTypes] = useState([]);

  // Sync local state when popover opens
  useEffect(() => {
    if (open) {
      const currentData = columnValues?.[colType];
      setLocalValue(currentData?.value || "");
      setLocalSubTypes(currentData?.subTypes || (currentData?.subType ? [currentData.subType] : []));
    }
  }, [open, columnValues, colType]);

  const handleSave = async () => {
    const cleanedSubTypes = localSubTypes.filter(st => st && st !== "__none__");
    const updatedValues = { 
      ...(columnValues || {}), 
      [colType]: { value: localValue, subTypes: cleanedSubTypes } 
    };
    await base44.entities.Assignment.update(assignmentId, { column_values: updatedValues });
    setOpen(false);
    if (onSaved) onSaved(updatedValues);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full text-left p-1 rounded border border-gray-200 hover:bg-blue-50 min-h-[28px]">
          <span className="text-xs truncate block">{savedValue || "-"}</span>
          {savedSubTypes.length > 0 && <span className="text-[10px] text-gray-400">({savedSubTypes.join(", ")})</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Value</Label>
            <Input 
              className="h-7 text-xs" 
              type="number" 
              value={localValue} 
              onChange={(e) => setLocalValue(e.target.value)} 
            />
          </div>
          {availableSubTypes && availableSubTypes.length > 0 && (
            <div>
              <Label className="text-xs">Sub-types (multiple)</Label>
              <div className="flex flex-wrap gap-1 mt-1">
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
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
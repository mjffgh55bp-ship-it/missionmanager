import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function TimeCell({ rowId, colName, value, defaultValue, rowValues, onSaved }) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const newValues = { ...rowValues, [colName]: newVal };
      await base44.entities.TemplateRow.update(rowId, { values: newValues });
      onSaved(newValues);
    }, 600);
  };

  return (
    <Input
      type="time"
      value={localValue}
      onChange={handleChange}
      placeholder={defaultValue}
      dir="rtl"
      className="border-0 rounded-none h-full focus:ring-0 focus:ring-offset-0 text-sm text-center"
    />
  );
}
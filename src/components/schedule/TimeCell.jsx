import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import OperationalTimePicker from "./OperationalTimePicker";

export default function TimeCell({ rowId, colName, value, defaultValue, rowValues, onSaved }) {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => { setLocalValue(value || ""); }, [value]);

  const handleChange = async (newVal) => {
    setLocalValue(newVal);
    const newValues = { ...rowValues, [colName]: newVal };
    await base44.entities.TemplateRow.update(rowId, { values: newValues });
    onSaved(newValues);
  };

  return (
    <OperationalTimePicker
      value={localValue}
      onChange={handleChange}
      placeholder={defaultValue || "--:--"}
      allowClear={true}
    />
  );
}
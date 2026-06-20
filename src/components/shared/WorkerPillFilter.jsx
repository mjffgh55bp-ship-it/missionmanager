import React from "react";

// Pill-style worker filter — same pattern as Yearly participant filter
// options: array of strings OR array of {value, label} objects
export default function WorkerPillFilter({ label, options, selected, onChange, color }) {
  const colorMap = {
    orange: { active: "bg-orange-500 text-white border-orange-500", inactive: "bg-white text-gray-600 border-gray-300 hover:border-orange-400" },
    indigo: { active: "bg-indigo-600 text-white border-indigo-600", inactive: "bg-white text-gray-600 border-gray-300 hover:border-indigo-400" },
    teal: { active: "bg-teal-600 text-white border-teal-600", inactive: "bg-white text-gray-600 border-gray-300 hover:border-teal-400" },
  };
  const cls = colorMap[color] || colorMap.indigo;
  if (!options || options.length === 0) return null;
  // Normalize options to {value, label}
  const normalized = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {normalized.map(opt => (
          <button key={opt.value} type="button"
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selected.includes(opt.value) ? cls.active : cls.inactive}`}
            onClick={() => onChange(selected.includes(opt.value) ? selected.filter(v => v !== opt.value) : [...selected, opt.value])}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
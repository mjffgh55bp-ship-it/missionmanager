import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

function CriterionRow({ criterion, scheduleColumns, onUpdate, onRemove }) {
  const [showColPicker, setShowColPicker] = useState(!criterion.col_name);
  const sc = scheduleColumns.find(c => c.name === criterion.col_name);

  const availableOptions = sc
    ? [
        ...(sc.options || []),
        ...(sc.sub_options?.map(so => so.name) || []),
        ...(sc.quantitative_items || []),
      ]
    : [];

  const toggleInclude = (opt) => {
    const current = criterion.include || [];
    const next = current.includes(opt)
      ? current.filter(v => v !== opt)
      : [...current, opt];
    onUpdate({ ...criterion, include: next });
  };

  const selectCol = (col) => {
    onUpdate({ ...criterion, col_name: col.name, col_type: col.report_type, include: [], logic: "and" });
    setShowColPicker(false);
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden mb-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white">
        <span className="font-semibold text-sm flex-1 text-right">
          {criterion.col_name || "בחר עמודה"}
        </span>
        {criterion.col_name && (
          <button
            type="button"
            onClick={() => setShowColPicker(!showColPicker)}
            className="text-blue-200 hover:text-white text-xs underline"
          >שנה</button>
        )}
        <button type="button" onClick={onRemove} className="text-blue-200 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Column picker */}
      {showColPicker && (
        <div className="bg-blue-100 border-b border-blue-200 max-h-40 overflow-y-auto">
          {scheduleColumns.map(col => (
            <button
              key={col.name}
              type="button"
              onClick={() => selectCol(col)}
              className="w-full text-right px-4 py-1.5 text-sm text-blue-900 hover:bg-blue-200 transition-colors"
            >{col.name}</button>
          ))}
          {scheduleColumns.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-2">אין עמודות מוגדרות</p>
          )}
        </div>
      )}

      {/* Value selection + AND/OR */}
      {criterion.col_name && !showColPicker && (
        <div className="px-3 py-2">
          {availableOptions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mb-2">
                {availableOptions.map(opt => {
                  const isSelected = (criterion.include || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleInclude(opt)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-blue-700 text-white border-blue-700"
                          : "bg-white text-blue-800 border-blue-300 hover:border-blue-500"
                      }`}
                    >
                      {opt}
                      {isSelected && <X className="inline w-3 h-3 mr-1" />}
                    </button>
                  );
                })}
              </div>
              {(criterion.include || []).length > 1 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-blue-700 ml-2">שיטת ספירה:</span>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...criterion, logic: "and" })}
                    className={`px-2.5 py-0.5 rounded text-xs border transition-colors ${
                      criterion.logic === "and"
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white text-blue-700 border-blue-300 hover:border-blue-500"
                    }`}
                  >גם</button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...criterion, logic: "or" })}
                    className={`px-2.5 py-0.5 rounded text-xs border transition-colors ${
                      criterion.logic === "or"
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white text-blue-700 border-blue-300 hover:border-blue-500"
                    }`}
                  >או</button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 py-1">לעמודה זו אין ערכים להגדיר</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ColumnConfigDialog({ col, scheduleColumns, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...col });
  const [showCriteriaPicker, setShowCriteriaPicker] = useState(false);

  useEffect(() => { setDraft({ ...col }); }, [col.id]);

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  const addCriterion = (sc) => {
    const newC = {
      id: Date.now().toString(),
      col_name: sc.name,
      col_type: sc.report_type,
      include: [],
      logic: "and",
    };
    update("criteria", [...(draft.criteria || []), newC]);
    setShowCriteriaPicker(false);
  };

  const updateCriterion = (id, updated) => {
    update("criteria", (draft.criteria || []).map(c => c.id === id ? updated : c));
  };

  const removeCriterion = (id) => {
    update("criteria", (draft.criteria || []).filter(c => c.id !== id));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto p-0" dir="rtl">
        {/* Column name */}
        <div className="bg-blue-600 px-4 py-3">
          <input
            value={draft.name}
            onChange={e => update("name", e.target.value)}
            placeholder="שם העמודה"
            className="w-full bg-transparent text-white placeholder-blue-200 text-center font-semibold text-base outline-none border-none"
            dir="rtl"
          />
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Description */}
          <div className="bg-blue-500 rounded">
            <input
              value={draft.description || ""}
              onChange={e => update("description", e.target.value)}
              placeholder="תיאור"
              className="w-full bg-transparent text-white placeholder-blue-200 text-center text-sm outline-none border-none px-3 py-2"
              dir="rtl"
            />
          </div>

          {/* Criteria list */}
          {(draft.criteria || []).map(c => (
            <CriterionRow
              key={c.id}
              criterion={c}
              scheduleColumns={scheduleColumns}
              onUpdate={(updated) => updateCriterion(c.id, updated)}
              onRemove={() => removeCriterion(c.id)}
            />
          ))}

          {/* Add criterion */}
          <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCriteriaPicker(!showCriteriaPicker)}
              className="w-full text-center px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            >
              בחירת קריטריון לספירה ∨
            </button>
            {showCriteriaPicker && (
              <div className="border-t border-blue-200 bg-blue-100 max-h-40 overflow-y-auto">
                {scheduleColumns.map(sc => (
                  <button
                    key={sc.name}
                    type="button"
                    onClick={() => addCriterion(sc)}
                    className="w-full text-right px-4 py-1.5 text-sm text-blue-900 hover:bg-blue-200 transition-colors"
                  >{sc.name}</button>
                ))}
                {scheduleColumns.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-2">אין עמודות מוגדרות</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 pb-4 gap-2">
          <Button variant="outline" onClick={onClose} dir="rtl" className="flex-1">ביטול</Button>
          <Button
            onClick={() => { onSave(draft); onClose(); }}
            className="bg-blue-700 hover:bg-blue-800 flex-1"
            dir="rtl"
          >אישור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
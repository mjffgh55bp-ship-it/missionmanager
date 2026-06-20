import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

const TASK_COL_NAME = "__משימה__";
const TIME_RANGE_COL_NAME = "__טווח_שעות__";

function TimeRangeSelector({ criterion, onUpdate }) {
  const timeRanges = (criterion.include || []).map(str => {
    const match = str.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (match) return { start: match[1], end: match[2] };
    return { start: "00:00", end: "23:59" };
  });

  const addTimeRange = () => {
    onUpdate({ ...criterion, include: [...(criterion.include || []), "00:00-23:59"] });
  };

  const updateTimeRange = (idx, newStart, newEnd) => {
    const newInclude = (criterion.include || []).map((r, i) => i === idx ? `${newStart}-${newEnd}` : r);
    onUpdate({ ...criterion, include: newInclude });
  };

  const removeTimeRange = (idx) => {
    const newInclude = (criterion.include || []).filter((_, i) => i !== idx);
    onUpdate({ ...criterion, include: newInclude });
  };

  return (
    <div className="space-y-2">
      {timeRanges.map((range, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => removeTimeRange(idx)}
              className="text-red-600 hover:text-red-800 p-0.5" title="הסר טווח">
              <X className="w-3 h-3" />
            </button>
            <div className="flex flex-col flex-1">
              <span className="text-[10px] text-gray-400 text-center mb-0.5">התחלה</span>
              <Input type="time" value={range.start}
                onChange={(e) => updateTimeRange(idx, e.target.value, range.end)}
                className="h-7 text-xs" />
            </div>
            <span className="text-xs text-gray-600 mt-3">עד</span>
            <div className="flex flex-col flex-1">
              <span className="text-[10px] text-gray-400 text-center mb-0.5">סיום</span>
              <Input type="time" value={range.end}
                onChange={(e) => updateTimeRange(idx, range.start, e.target.value)}
                className="h-7 text-xs" />
            </div>
          </div>
          {range.start > range.end && (
            <p className="text-xs text-gray-600 text-right pr-6">⟳ טווח חוצה חצות ({range.start}–00:00–{range.end})</p>
          )}
        </div>
      ))}
      <button type="button" onClick={addTimeRange}
        className="text-xs text-gray-700 hover:text-gray-900 font-medium mt-2">
        + הוסף טווח שעות
      </button>
    </div>
  );
}

function CriterionRow({ criterion, scheduleColumns, qualifications, onUpdate, onRemove }) {
  const [showColPicker, setShowColPicker] = useState(!criterion.col_name);

  const isTaskCriterion = criterion.col_name === TASK_COL_NAME;
  const isTimeRangeCriterion = criterion.col_name === TIME_RANGE_COL_NAME;
  const sc = scheduleColumns.find(c => c.name === criterion.col_name);

  const availableOptions = isTaskCriterion
    ? qualifications.map(q => ({ value: q.id, label: q.name }))
    : isTimeRangeCriterion
    ? []
    : sc
      ? [
          ...(sc.options || []),
          ...(sc.sub_options?.map(so => so.name) || []),
          ...(sc.quantitative_items || []),
        ]
      : [];

  const validIds = isTaskCriterion ? qualifications.map(q => q.id) : null;
  const cleanInclude = isTaskCriterion
    ? (criterion.include || []).filter(v => validIds.includes(v))
    : isTimeRangeCriterion
    ? (criterion.include || [])
    : (criterion.include || []);

  const toggleInclude = (opt) => {
    const next = cleanInclude.includes(opt)
      ? cleanInclude.filter(v => v !== opt)
      : [...cleanInclude, opt];
    onUpdate({ ...criterion, include: next });
  };

  const selectCol = (col) => {
    onUpdate({ ...criterion, col_name: col.name, col_type: col.report_type || "task", include: [], logic: "or" });
    setShowColPicker(false);
  };

  const selectTaskCol = () => {
    onUpdate({ ...criterion, col_name: TASK_COL_NAME, col_type: "task", include: [], logic: "or" });
    setShowColPicker(false);
  };

  const displayName = isTaskCriterion ? "משימה" : isTimeRangeCriterion ? "טווח שעות" : (criterion.col_name || "בחר עמודה");

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden mb-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-800">
        <span className="font-semibold text-sm flex-1 text-right">{displayName}</span>
        {criterion.col_name && (
          <button type="button" onClick={() => setShowColPicker(!showColPicker)}
            className="text-gray-500 hover:text-gray-700 text-xs underline">שנה</button>
        )}
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {showColPicker && (
        <div className="bg-gray-100 border-b border-gray-200 max-h-40 overflow-y-auto">
          {qualifications.length > 0 && (
            <button type="button" onClick={selectTaskCol}
              className="w-full text-right px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors font-medium border-b border-gray-200">
              משימה
            </button>
          )}
          {scheduleColumns.map(col => (
            <button key={col.name} type="button" onClick={() => selectCol(col)}
              className="w-full text-right px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors">
              {col.name}
            </button>
          ))}
          {scheduleColumns.length === 0 && qualifications.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-2">אין עמודות מוגדרות</p>
          )}
        </div>
      )}

      {criterion.col_name && !showColPicker && (
        <div className="px-3 py-2">
          {isTimeRangeCriterion ? (
            <TimeRangeSelector criterion={criterion} onUpdate={onUpdate} />
          ) : availableOptions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mb-2">
                {availableOptions.map(opt => {
                  const optValue = typeof opt === "object" ? opt.value : opt;
                  const optLabel = typeof opt === "object" ? opt.label : opt;
                  const isSelected = cleanInclude.includes(optValue);
                  return (
                    <button key={optValue} type="button" onClick={() => toggleInclude(optValue)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                      }`}>
                      {optLabel}
                      {isSelected && <X className="inline w-3 h-3 mr-1" />}
                    </button>
                  );
                })}
              </div>
              {cleanInclude.length > 1 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-700 ml-2">שיטת ספירה:</span>
                  <button type="button" onClick={() => onUpdate({ ...criterion, logic: "and" })}
                    className={`px-2.5 py-0.5 rounded text-xs border transition-colors ${
                      criterion.logic === "and" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}>גם</button>
                  <button type="button" onClick={() => onUpdate({ ...criterion, logic: "or" })}
                    className={`px-2.5 py-0.5 rounded text-xs border transition-colors ${
                      criterion.logic === "or" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}>או</button>
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

export default function SummaryColumnsDialog({ open, onOpenChange, summaryColumns, saveSummaryColumns, shiftStatuses, scheduleParams, trackers, qualifications = [], allTemplates = [], templateRows = [] }) {
  const [editingColumn, setEditingColumn] = useState(null);
  const [draft, setDraft] = useState({ name: '', criteria: [], criteria_logic: 'or' });
  const [showCriteriaPicker, setShowCriteriaPicker] = useState(false);

  const resetForm = () => {
    setEditingColumn(null);
    setDraft({ name: '', criteria: [], criteria_logic: 'or' });
    setShowCriteriaPicker(false);
  };

  useEffect(() => {
    if (editingColumn) {
      // Convert old format to new if needed
      if (editingColumn.criteria) {
        setDraft({
          name: editingColumn.name,
          criteria: editingColumn.criteria || [],
          criteria_logic: editingColumn.criteria_logic || 'or',
        });
      } else if (editingColumn.criteria_type) {
        // Migrate old format to new
        const oldCriteria = migrateOldFormat(editingColumn);
        setDraft({
          name: editingColumn.name,
          criteria: oldCriteria,
          criteria_logic: 'or',
        });
      }
    } else {
      setDraft({ name: '', criteria: [], criteria_logic: 'or' });
    }
  }, [editingColumn]);

  const migrateOldFormat = (col) => {
    if (col.criteria_type === 'total_shifts') return [];
    if (col.criteria_type === 'status') return [{
      id: Date.now().toString(),
      col_name: col.criteria_value,
      col_type: 'task',
      include: [col.criteria_value],
      logic: 'or',
    }];
    if (col.criteria_type === 'food_cart') return [{
      id: Date.now().toString(),
      col_name: col.criteria_value,
      col_type: 'task',
      include: [col.criteria_value],
      logic: 'or',
    }];
    if (col.criteria_type === 'time_range') return [{
      id: Date.now().toString(),
      col_name: TIME_RANGE_COL_NAME,
      col_type: 'time_range',
      include: [col.criteria_value || '00:00-23:59'],
      logic: 'or',
    }];
    if (col.criteria_type === 'schedule_col') {
      const [colName, criterion] = (col.criteria_value || '').split('|||');
      return [{
        id: Date.now().toString(),
        col_name: colName,
        col_type: 'task',
        include: criterion ? [criterion] : [],
        logic: 'or',
      }];
    }
    return [];
  };

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  const addCriterion = (col) => {
    const newC = { id: Date.now().toString(), col_name: col.name, col_type: col.report_type || "task", include: [], logic: "or" };
    update("criteria", [...(draft.criteria || []), newC]);
    setShowCriteriaPicker(false);
  };

  const addTaskCriterion = () => {
    const newC = { id: Date.now().toString(), col_name: TASK_COL_NAME, col_type: "task", include: [], logic: "or" };
    update("criteria", [...(draft.criteria || []), newC]);
    setShowCriteriaPicker(false);
  };

  const addTimeRangeCriterion = () => {
    const newC = { id: Date.now().toString(), col_name: TIME_RANGE_COL_NAME, col_type: "time_range", include: ["00:00-23:59"], logic: "or" };
    update("criteria", [...(draft.criteria || []), newC]);
    setShowCriteriaPicker(false);
  };

  const updateCriterion = (id, updated) => {
    update("criteria", (draft.criteria || []).map(c => c.id === id ? updated : c));
  };

  const removeCriterion = (id) => {
    update("criteria", (draft.criteria || []).filter(c => c.id !== id));
  };

  const handleSave = () => {
    if (!draft.name) return;

    const validQualIds = qualifications.map(q => q.id);
    const cleaned = {
      ...draft,
      criteria: (draft.criteria || []).map(c => ({
        ...c,
        include: c.col_name === TASK_COL_NAME
          ? (c.include || []).filter(v => validQualIds.includes(v))
          : (c.include || [])
      }))
    };

    let updated;
    if (editingColumn) {
      updated = summaryColumns.map(c => c.id === editingColumn.id ? { ...c, name: cleaned.name, criteria: cleaned.criteria, criteria_logic: cleaned.criteria_logic } : c);
    } else {
      updated = [...summaryColumns, { id: Date.now().toString(), name: cleaned.name, criteria: cleaned.criteria, criteria_logic: cleaned.criteria_logic }];
    }
    saveSummaryColumns(updated);
    resetForm();
  };

  const criteriaDescription = (col) => {
    if (!col.criteria || col.criteria.length === 0) return 'סה"כ משמרות';
    return col.criteria.map(c => {
      if (c.col_name === TASK_COL_NAME) return `משימה`;
      if (c.col_name === TIME_RANGE_COL_NAME) return `טווח שעות`;
      const includeDesc = (c.include || []).length > 0 ? `: ${c.include.join(', ')}` : '';
      return `${c.col_name}${includeDesc}`;
    }).join(col.criteria_logic === 'and' ? ' וגם ' : ' או ');
  };

  // Also support legacy columns with criteria_type
  const legacyDescription = (col) => {
    if (col.criteria_type === 'total_shifts') return 'סה"כ משמרות';
    if (col.criteria_type === 'status') return `סטטוס: ${col.criteria_value}`;
    if (col.criteria_type === 'food_cart') return `עגלה: ${col.criteria_value}`;
    if (col.criteria_type === 'time_range') return `טווח: ${col.criteria_value}`;
    if (col.criteria_type === 'schedule_col') return col.criteria_value.split('|||').filter(Boolean).join(' → ');
    if (col.criteria_type === 'tracker_col') return col.criteria_value.split('|||')[1] || '';
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto p-0" dir="rtl">
        <div className="bg-gray-100 px-4 py-3 border-b">
          <input value={draft.name} onChange={e => update("name", e.target.value)}
            placeholder="שם העמודה"
            className="w-full bg-transparent text-gray-800 placeholder-gray-400 text-center font-semibold text-base outline-none border-none"
            dir="rtl" />
        </div>

        <div className="px-4 py-3 space-y-3">
          {(draft.criteria || []).map((c, idx) => (
            <div key={c.id}>
              <CriterionRow criterion={c}
                scheduleColumns={scheduleParams}
                qualifications={qualifications}
                onUpdate={(updated) => updateCriterion(c.id, updated)}
                onRemove={() => removeCriterion(c.id)} />
              {idx < (draft.criteria || []).length - 1 && (
                <div className="flex items-center justify-center gap-2 my-1">
                  <button type="button"
                    onClick={() => update("criteria_logic", "and")}
                    className={`px-3 py-0.5 rounded text-xs border transition-colors ${
                      (draft.criteria_logic || "or") === "and"
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}>
                    וגם
                  </button>
                  <button type="button"
                    onClick={() => update("criteria_logic", "or")}
                    className={`px-3 py-0.5 rounded text-xs border transition-colors ${
                      (draft.criteria_logic || "or") === "or"
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}>
                    או
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
            <button type="button" onClick={() => setShowCriteriaPicker(!showCriteriaPicker)}
              className="w-full text-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
              בחירת קריטריון לספירה ∨
            </button>
            {showCriteriaPicker && (
              <div className="border-t border-gray-200 bg-gray-100 max-h-40 overflow-y-auto">
                <button type="button" onClick={addTimeRangeCriterion}
                  className="w-full text-right px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors font-medium border-b border-gray-200">
                  טווח שעות
                </button>
                {qualifications.length > 0 && (
                  <button type="button" onClick={addTaskCriterion}
                    className="w-full text-right px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors font-medium border-b border-gray-200">
                    משימה
                  </button>
                )}
                {scheduleParams.map(sc => (
                  <button key={sc.name} type="button" onClick={() => addCriterion(sc)}
                    className="w-full text-right px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors">
                    {sc.name}
                  </button>
                ))}
                {scheduleParams.length === 0 && qualifications.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-2">אין עמודות מוגדרות</p>
                )}
              </div>
            )}
          </div>
        </div>

        {summaryColumns.length > 0 && (
          <div className="px-4 pb-2">
            <div className="border-t pt-3 space-y-1">
              {summaryColumns.map(col => (
                <div key={col.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <div className="flex-1 text-right">
                    <span className="font-medium text-sm text-gray-800">{col.name}</span>
                    <span className="text-xs text-gray-500 mr-2">
                      • {col.criteria ? criteriaDescription(col) : legacyDescription(col)}
                    </span>
                  </div>
                  <button onClick={() => setEditingColumn(col)}
                    className="text-gray-400 hover:text-gray-700 text-xs border border-gray-200 rounded px-2 py-0.5">ערוך</button>
                  <button onClick={() => saveSummaryColumns(summaryColumns.filter(c => c.id !== col.id))}
                    className="text-gray-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="px-4 pb-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl" className="flex-1">ביטול</Button>
          <Button onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 flex-1" dir="rtl">
            {editingColumn ? 'עדכן' : 'הוסף'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
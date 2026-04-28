import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ── helpers ──────────────────────────────────────────────────────────────────

function getColSummary(col) {
  const tags = [];
  if (col.criteria?.length) {
    col.criteria.forEach(c => {
      const vals = [...(c.include || [])];
      if (vals.length) tags.push(`${c.col_name}: ${vals.join(", ")}`);
    });
  } else {
    const cf = col.col_value_filter;
    if (cf?.include?.length) tags.push(`ערך: ${cf.include.join(", ")}`);
    if (col.quantitative_single_item) tags.push(col.quantitative_single_item);
    const tf = col.task_filter;
    if (tf?.include?.length) tags.push(`משימה: ${tf.include.join(", ")}`);
    const pf = col.population_filter;
    if (pf?.include?.length) tags.push(`אוכ׳: ${pf.include.join(", ")}`);
    const rf = col.role_filter;
    if (rf?.include?.length) tags.push(`תפקיד: ${rf.include.join(", ")}`);
    const trf = col.time_range_filter;
    if (trf?.start || trf?.end) tags.push(`שעות: ${trf.start || "?"}-${trf.end || "?"}`);
  }
  return tags;
}

// ── Criterion Row ─────────────────────────────────────────────────────────────
// Each criterion: { id, col_name, col_type, options (all), include:[], logic:"and"|"or" }

function CriterionRow({ criterion, scheduleColumns, onUpdate, onRemove }) {
  const [showColPicker, setShowColPicker] = useState(!criterion.col_name);
  const sc = scheduleColumns.find(c => c.name === criterion.col_name);

  // All selectable options for this column
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
      {/* Header row: column name + toggle + remove */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white">
        <span className="font-semibold text-sm flex-1 text-right">
          {criterion.col_name || "בחר עמודה"}
        </span>
        {criterion.col_name && (
          <button
            type="button"
            onClick={() => setShowColPicker(!showColPicker)}
            className="text-blue-200 hover:text-white text-xs underline"
          >
            שנה
          </button>
        )}
        <button type="button" onClick={onRemove} className="text-blue-200 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Column picker */}
      {showColPicker && (
        <div className="bg-blue-100 border-b border-blue-200">
          {scheduleColumns.map(col => (
            <button
              key={col.name}
              type="button"
              onClick={() => selectCol(col)}
              className="w-full text-right px-4 py-1.5 text-sm text-blue-900 hover:bg-blue-200 transition-colors"
            >
              {col.name}
            </button>
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
              {/* AND/OR toggle - only relevant when multiple values selected */}
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

// ── Column Config Dialog ──────────────────────────────────────────────────────

function ColumnConfigDialog({ col, scheduleColumns, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...col });
  const [showCriteriaPicker, setShowCriteriaPicker] = useState(false);

  useEffect(() => { setDraft({ ...col }); }, [col.id]);

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  const addCriterion = (sc) => {
    const newC = {
      id: Date.now().toString(),
      col_name: sc ? sc.name : "",
      col_type: sc ? sc.report_type : "",
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
        {/* Column name - blue header */}
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

          {/* Add criterion button / picker */}
          <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCriteriaPicker(!showCriteriaPicker)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <span>בחירת קריטריון לספירה ∨</span>
            </button>
            {showCriteriaPicker && (
              <div className="border-t border-blue-200 bg-blue-100">
                {scheduleColumns.map(sc => (
                  <button
                    key={sc.name}
                    type="button"
                    onClick={() => addCriterion(sc)}
                    className="w-full text-right px-4 py-1.5 text-sm text-blue-900 hover:bg-blue-200 transition-colors"
                  >
                    {sc.name}
                  </button>
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

// ── Main TrackerEditor ────────────────────────────────────────────────────────

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, scheduleColumns = [], populations = [], workerRoles = [] }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [configuringColId, setConfiguringColId] = useState(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState("");

  const prevOpenRef = useRef(false);
  const prevTrackerIdRef = useRef(null);

  useEffect(() => {
    const trackerId = tracker?.id ?? null;
    const justOpened = open && !prevOpenRef.current;
    const trackerChanged = open && trackerId !== prevTrackerIdRef.current;
    if (justOpened || trackerChanged) {
      setName(tracker ? tracker.name || "" : "");
      setColumns(tracker ? (tracker.columns || []).map(c => ({ ...c })) : []);
      setConfiguringColId(null);
      setShowAddColumn(false);
      setNewColName("");
      prevTrackerIdRef.current = trackerId;
    }
    prevOpenRef.current = open;
  }, [open, tracker]);

  const configuringCol = configuringColId ? columns.find(c => c.id === configuringColId) || null : null;

  const addNewColumn = () => {
    const n = newColName.trim() || "עמודה חדשה";
    const newCol = {
      id: Date.now().toString(),
      name: n,
      description: "",
      type: "schedule_col",
      schedule_col_name: "",
      criteria: [],
    };
    setColumns(prev => [...prev, newCol]);
    setConfiguringColId(newCol.id);
    setShowAddColumn(false);
    setNewColName("");
  };

  const saveColConfig = (updatedCol) => {
    setColumns(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    setConfiguringColId(null);
  };

  const removeColumn = (colId) => {
    setColumns(prev => prev.filter(c => c.id !== colId));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = { name: name.trim(), columns };
    let saved;
    if (tracker?.id) {
      saved = await base44.entities.Tracker.update(tracker.id, data);
    } else {
      saved = await base44.entities.Tracker.create({ ...data, order: Date.now() });
    }
    setSaving(false);
    onSaved(saved);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle dir="rtl">{tracker ? "ערוך מעקב" : "צור מעקב חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Table name */}
            <div>
              <Label dir="rtl">שם הטבלה</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="לדוגמה: מעקב שעות חודשי"
                dir="rtl"
                className="mt-1"
              />
            </div>

            {/* Columns list */}
            {columns.length > 0 && (
              <div>
                <Label dir="rtl" className="mb-2 block">עמודות ({columns.length})</Label>
                <div className="space-y-2">
                  {columns.map(col => {
                    const tags = getColSummary(col);
                    return (
                      <div key={col.id} className="flex items-start gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm text-gray-800">{col.name}</span>
                          {col.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{col.description}</p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.map((t, i) => (
                                <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setConfiguringColId(col.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors mt-0.5 text-xs border border-gray-200 rounded px-2 py-0.5"
                          title="הגדר קריטריונים"
                        >ערוך</button>
                        <button
                          onClick={() => removeColumn(col.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors mt-0.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add column section */}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3">
              {!showAddColumn ? (
                <button
                  type="button"
                  onClick={() => setShowAddColumn(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-700 transition-colors py-1"
                >
                  <Plus className="w-4 h-4" />הוסף עמודה
                </button>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    placeholder="שם העמודה החדשה..."
                    dir="rtl"
                    onKeyDown={e => { if (e.key === "Enter") addNewColumn(); if (e.key === "Escape") setShowAddColumn(false); }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addNewColumn} className="bg-blue-700 hover:bg-blue-800 flex-1">
                      הוסף והגדר
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddColumn(false); setNewColName(""); }}>
                      ביטול
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
              {saving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {configuringCol && (
        <ColumnConfigDialog
          col={configuringCol}
          scheduleColumns={scheduleColumns}
          onSave={saveColConfig}
          onClose={() => setConfiguringColId(null)}
        />
      )}
    </>
  );
}
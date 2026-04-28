import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ColumnConfigDialog from "./ColumnConfigDialog";

// ── helper ───────────────────────────────────────────────────────────────────

function getColSummary(col) {
  const tags = [];
  if (col.criteria?.length) {
    col.criteria.forEach(c => {
      if (c.include?.length) tags.push(`${c.col_name}: ${c.include.join(", ")}`);
    });
  }
  return tags;
}

// ── Main TrackerEditor ────────────────────────────────────────────────────────

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, scheduleColumns = [], populations = [], workerRoles = [], qualifications = [] }) {
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
          qualifications={qualifications}
          onSave={saveColConfig}
          onClose={() => setConfiguringColId(null)}
        />
      )}
    </>
  );
}
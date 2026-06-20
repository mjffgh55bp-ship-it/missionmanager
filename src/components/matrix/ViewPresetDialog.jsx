import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import WorkerPillFilter from "@/components/shared/WorkerPillFilter";

export default function ViewPresetDialog({
  open,
  onClose,
  workers,
  populationOptions,
  roleOptions,
  qualifications,
  workerQualifications,
  editingPreset,
  onSave,
}) {
  const [name, setName] = useState("");
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [selectedPopulations, setSelectedPopulations] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedQualifications, setSelectedQualifications] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");

  // Prefill when editing
  useEffect(() => {
    if (editingPreset) {
      setName(editingPreset.name || "");
      setCheckedIds(new Set(editingPreset.workerIds || []));
    } else {
      setName("");
      setCheckedIds(new Set());
    }
    setSelectedPopulations([]);
    setSelectedRoles([]);
    setSelectedQualifications([]);
    setWorkerSearch("");
  }, [editingPreset, open]);

  // Worker matching — same logic as reports tracker filter
  const preFilteredWorkers = useMemo(() => workers.filter(w => {
    if (selectedPopulations.length > 0 && !selectedPopulations.includes(w.population)) return false;
    if (selectedRoles.length > 0) {
      const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
      if (!selectedRoles.some(r => roles.includes(r))) return false;
    }
    if (selectedQualifications.length > 0) {
      const wqIds = (workerQualifications || []).filter(wq => wq.worker_id === w.id).map(wq => wq.qualification_id);
      if (!selectedQualifications.some(qid => wqIds.includes(qid))) return false;
    }
    return true;
  }), [workers, selectedPopulations, selectedRoles, selectedQualifications, workerQualifications]);

  const searchedWorkers = useMemo(() =>
    preFilteredWorkers.filter(w => !workerSearch || (w.nickname || "").includes(workerSearch)),
    [preFilteredWorkers, workerSearch]
  );

  const handleSelectAll = () => {
    setCheckedIds(new Set(searchedWorkers.map(w => w.id)));
  };

  const handleClearAll = () => {
    setCheckedIds(new Set());
  };

  const handleToggleWorker = (wid) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(wid)) next.delete(wid);
      else next.add(wid);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim() || checkedIds.size === 0) return;
    onSave(name.trim(), [...checkedIds]);
    onClose();
  };

  // Population and role pill options (normalized)
  const popOptions = useMemo(() =>
    (populationOptions || []).map(p => typeof p === "string" ? p : p.name).filter(Boolean),
    [populationOptions]
  );

  const roleOptionsNorm = useMemo(() =>
    (roleOptions || []).map(r => typeof r === "string" ? r : r.name).filter(Boolean),
    [roleOptions]
  );

  const qualOptions = useMemo(() =>
    (qualifications || []).map(q => ({ value: q.id, label: q.name })),
    [qualifications]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[92vw] max-w-md max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-base">
            {editingPreset ? "עריכת תצוגה" : "הגדרת תצוגה חדשה"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0">
          {/* Name */}
          <div>
            <Label className="text-sm">שם התצוגה</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: שפים בכירים"
              className="h-9 text-sm"
            />
          </div>

          {/* Filter pills — identical to reports tracker filter */}
          <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
            <WorkerPillFilter
              label="אוכלוסייה"
              options={popOptions}
              selected={selectedPopulations}
              onChange={setSelectedPopulations}
              color="orange"
            />
            <WorkerPillFilter
              label="תפקיד"
              options={roleOptionsNorm}
              selected={selectedRoles}
              onChange={setSelectedRoles}
              color="indigo"
            />
            <WorkerPillFilter
              label="כשירות"
              options={qualOptions}
              selected={selectedQualifications}
              onChange={setSelectedQualifications}
              color="teal"
            />

            {/* Worker checklist — identical pattern to reports */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                עובדים ({checkedIds.size > 0 ? `${checkedIds.size} נבחרו` : "כולם"})
              </p>
              <Input
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                placeholder="חיפוש עובד..."
                className="h-7 text-xs mb-1"
                dir="rtl"
              />
              <div className="flex gap-2 mb-1">
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  onClick={handleSelectAll}
                >
                  בחר הכל ({searchedWorkers.length})
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded bg-gray-400 text-white hover:bg-gray-500 transition-colors"
                  onClick={handleClearAll}
                >
                  נקה
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded bg-white space-y-0.5 p-1">
                {searchedWorkers.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(w.id)}
                      onChange={() => handleToggleWorker(w.id)}
                      className="rounded"
                    />
                    <span className="text-xs">{w.nickname}</span>
                  </label>
                ))}
                {searchedWorkers.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-1">אין תוצאות</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={onClose} className="h-9">ביטול</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || checkedIds.size === 0}
            className="h-9 bg-blue-900 hover:bg-blue-800"
          >
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
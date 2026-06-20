import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ViewPresetDialog({
  open,
  onClose,
  workers,
  populationOptions,
  roleOptions,
  editingPreset,
  onSave,
}) {
  const [name, setName] = useState("");
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [populationSelect, setPopulationSelect] = useState("");
  const [roleSelect, setRoleSelect] = useState("");

  // Prefill when editing
  useEffect(() => {
    if (editingPreset) {
      setName(editingPreset.name || "");
      setCheckedIds(new Set(editingPreset.workerIds || []));
    } else {
      setName("");
      setCheckedIds(new Set());
    }
    setPopulationSelect("");
    setRoleSelect("");
  }, [editingPreset, open]);

  const sortedWorkers = useMemo(
    () => [...workers].sort((a, b) => (a.nickname || "").localeCompare(b.nickname || "")),
    [workers]
  );

  const handleSelectAll = () => {
    setCheckedIds(new Set(sortedWorkers.map(w => w.id)));
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

  // When population dropdown changes, pre-check all matching workers
  useEffect(() => {
    if (!populationSelect) return;
    const matching = workers
      .filter(w => w.population === populationSelect)
      .map(w => w.id);
    if (matching.length === 0) return;
    setCheckedIds(prev => {
      const next = new Set(prev);
      matching.forEach(id => next.add(id));
      return next;
    });
  }, [populationSelect]);

  // When role dropdown changes, pre-check all matching workers
  useEffect(() => {
    if (!roleSelect) return;
    const matching = workers
      .filter(w => {
        const roles = Array.isArray(w.role) ? w.role : (w.role ? [w.role] : []);
        return roles.includes(roleSelect);
      })
      .map(w => w.id);
    if (matching.length === 0) return;
    setCheckedIds(prev => {
      const next = new Set(prev);
      matching.forEach(id => next.add(id));
      return next;
    });
  }, [roleSelect]);

  const handleSave = () => {
    if (!name.trim() || checkedIds.size === 0) return;
    onSave(name.trim(), [...checkedIds]);
    onClose();
  };

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

          {/* Quick-select dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-600">אוכלוסייה</Label>
              <Select value={populationSelect} onValueChange={setPopulationSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="בחר אוכלוסייה" />
                </SelectTrigger>
                <SelectContent>
                  {populationOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">תפקיד</Label>
              <Select value={roleSelect} onValueChange={setRoleSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Select all / clear all */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
              בחר הכל
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClearAll}>
              נקה הכל
            </Button>
            <span className="text-xs text-gray-500 self-center mr-auto">
              {checkedIds.size} עובדים
            </span>
          </div>

          {/* Worker checklist */}
          <ScrollArea className="h-48 border rounded-md">
            <div className="p-2 space-y-0.5">
              {sortedWorkers.map((w) => (
                <label
                  key={w.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <Checkbox
                    checked={checkedIds.has(w.id)}
                    onCheckedChange={() => handleToggleWorker(w.id)}
                  />
                  <span className="text-sm">{w.nickname}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
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
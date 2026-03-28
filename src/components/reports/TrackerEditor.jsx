import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";

const COLUMN_TYPES = [
  { value: "hours_assignments", label: "שעות (משימות)" },
  { value: "hours_templates", label: "שעות (תבניות)" },
  { value: "shifts_count", label: "מספר משמרות" },
  { value: "number", label: "מספר (ידני)" },
  { value: "text", label: "טקסט (ידני)" },
  { value: "checkbox", label: "סימון (ידני)" },
];

export default function TrackerEditor({ open, onOpenChange, tracker, onSaved, allTemplates }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [saving, setSaving] = useState(false);

  const allWorkerColumnNames = [...new Set(
    (allTemplates || []).flatMap(t =>
      (t.columns || []).filter(c => c.type === "worker").map(c => c.name)
    )
  )];

  useEffect(() => {
    if (tracker) {
      setName(tracker.name || "");
      setColumns(tracker.columns || []);
    } else {
      setName("");
      setColumns([]);
    }
  }, [tracker, open]);

  const addColumn = () => {
    setColumns([...columns, { id: Date.now().toString(), name: "", type: "hours_assignments", template_column: "" }]);
  };

  const updateColumn = (idx, field, value) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: value };
    setColumns(updated);
  };

  const removeColumn = (idx) => {
    setColumns(columns.filter((_, i) => i !== idx));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle dir="rtl">{tracker ? "ערוך מעקב" : "צור מעקב חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label dir="rtl">שם הטבלה</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="לדוגמה: מעקב שעות חודשי" dir="rtl" className="mt-1" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label dir="rtl">עמודות</Label>
              <Button size="sm" variant="outline" onClick={addColumn} dir="rtl">
                <Plus className="w-4 h-4 mr-1" />הוסף עמודה
              </Button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={col.id} className="flex gap-2 items-start p-2 border rounded-lg bg-gray-50">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs" dir="rtl">שם העמודה</Label>
                      <Input
                        value={col.name}
                        onChange={e => updateColumn(idx, "name", e.target.value)}
                        placeholder="שם..."
                        dir="rtl"
                        className="h-8 mt-0.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs" dir="rtl">סוג</Label>
                      <Select value={col.type} onValueChange={v => updateColumn(idx, "type", v)}>
                        <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {COLUMN_TYPES.map(ct => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {col.type === "hours_templates" && allWorkerColumnNames.length > 0 && (
                      <div className="col-span-2">
                        <Label className="text-xs" dir="rtl">עמודת עובד בתבנית</Label>
                        <Select value={col.template_column || ""} onValueChange={v => updateColumn(idx, "template_column", v)}>
                          <SelectTrigger className="h-8 mt-0.5 text-sm" dir="rtl">
                            <SelectValue placeholder="בחר עמודה..." />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="__all__">כל העמודות</SelectItem>
                            {allWorkerColumnNames.map(cn => (
                              <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 mt-5" onClick={() => removeColumn(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {columns.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4" dir="rtl">אין עמודות עדיין - לחץ "הוסף עמודה"</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} dir="rtl">ביטול</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
            {saving ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
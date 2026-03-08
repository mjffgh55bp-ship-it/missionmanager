import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, X, BookmarkPlus, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEFAULT_COLUMNS = [
  { name: "תדריך", type: "time", width: 100 },
  { name: "התחלה", type: "time", width: 100 },
  { name: "סיום", type: "time", width: 100 },
  { name: "שף", type: "worker", width: 150 },
  { name: "סו שף", type: "worker", width: 150 },
];

const COLUMN_TYPE_OPTIONS = [
  { value: "time", label: "זמן" },
  { value: "worker", label: "איש צוות" },
  { value: "text", label: "טקסט" },
];

export default function PresetsDialog({ open, onOpenChange, onAddPreset }) {
  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null); // null = list view, object = edit view
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadPresets();
  }, [open]);

  const loadPresets = async () => {
    setLoading(true);
    const data = await base44.entities.MokedPreset.list();
    setPresets(data);
    setLoading(false);
  };

  const handleNewPreset = () => {
    setEditingPreset({
      id: null,
      name: "מוקד חדש",
      template_config: {
        color: "#3b82f6",
        columns: JSON.parse(JSON.stringify(DEFAULT_COLUMNS)),
        default_rows: [],
      },
    });
  };

  const handleEditPreset = (preset) => {
    setEditingPreset({
      id: preset.id,
      name: preset.name,
      template_config: JSON.parse(JSON.stringify(preset.template_config)),
    });
  };

  const handleDeletePreset = async (presetId) => {
    if (!confirm("האם למחוק פריסט זה?")) return;
    await base44.entities.MokedPreset.delete(presetId);
    toast.success("פריסט נמחק");
    loadPresets();
  };

  const handleSavePreset = async () => {
    if (!editingPreset.name.trim()) return;
    if (editingPreset.id) {
      await base44.entities.MokedPreset.update(editingPreset.id, {
        name: editingPreset.name,
        template_config: editingPreset.template_config,
      });
      toast.success("פריסט עודכן");
    } else {
      await base44.entities.MokedPreset.create({
        name: editingPreset.name,
        template_config: editingPreset.template_config,
      });
      toast.success("פריסט נשמר");
    }
    setEditingPreset(null);
    loadPresets();
  };

  const updateColumn = (idx, field, value) => {
    const cols = [...editingPreset.template_config.columns];
    cols[idx] = { ...cols[idx], [field]: value };
    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
  };

  const addColumn = () => {
    const cols = [...editingPreset.template_config.columns, { name: "", type: "text", width: 120 }];
    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
  };

  const removeColumn = (idx) => {
    const cols = editingPreset.template_config.columns.filter((_, i) => i !== idx);
    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
  };

  const handleAddToSchedule = async (preset) => {
    await onAddPreset(preset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditingPreset(null); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle dir="rtl" className="text-xl">
            {editingPreset ? (editingPreset.id ? "עריכת פריסט" : "פריסט חדש") : "פריסטים"}
          </DialogTitle>
        </DialogHeader>

        {editingPreset ? (
          /* ── Edit / Create view ── */
          <div className="space-y-4 py-2" dir="rtl">
            <div>
              <Label>שם המוקד</Label>
              <Input
                value={editingPreset.name}
                onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                dir="rtl"
                className="mt-1"
              />
            </div>

            <div>
              <Label>צבע</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={editingPreset.template_config.color}
                  onChange={(e) =>
                    setEditingPreset({
                      ...editingPreset,
                      template_config: { ...editingPreset.template_config, color: e.target.value },
                    })
                  }
                  className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                />
                <span className="text-sm text-gray-500">{editingPreset.template_config.color}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>עמודות</Label>
                <Button size="sm" variant="outline" onClick={addColumn}>
                  <Plus className="w-3 h-3 ml-1" /> הוסף עמודה
                </Button>
              </div>
              <div className="space-y-2">
                {editingPreset.template_config.columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded p-2">
                    <Input
                      value={col.name}
                      onChange={(e) => updateColumn(idx, "name", e.target.value)}
                      placeholder="שם עמודה"
                      className="h-7 text-sm flex-1"
                      dir="rtl"
                    />
                    <Select value={col.type} onValueChange={(v) => updateColumn(idx, "type", v)}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={() => removeColumn(idx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditingPreset(null)}>ביטול</Button>
              <Button onClick={handleSavePreset} className="bg-blue-700 hover:bg-blue-800">
                <Check className="w-4 h-4 ml-1" /> שמור פריסט
              </Button>
            </div>
          </div>
        ) : (
          /* ── List view ── */
          <div className="py-2" dir="rtl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">{presets.length} פריסטים שמורים</span>
              <Button onClick={handleNewPreset} className="bg-blue-700 hover:bg-blue-800">
                <Plus className="w-4 h-4 ml-1" /> פריסט חדש
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">טוען...</div>
            ) : presets.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookmarkPlus className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>אין פריסטים עדיין</p>
                <p className="text-sm mt-1">צור פריסט חדש כדי לשמור קונפיגורציית מוקד לשימוש חוזר</p>
              </div>
            ) : (
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between border rounded-lg p-3 bg-white hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                        style={{ background: preset.template_config?.color || "#3b82f6" }}
                      />
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 flex gap-1 flex-wrap">
                          {(preset.template_config?.columns || []).map((c, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white h-8"
                        onClick={() => handleAddToSchedule(preset)}
                      >
                        <Plus className="w-3 h-3 ml-1" /> הוסף ללוח
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditPreset(preset)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
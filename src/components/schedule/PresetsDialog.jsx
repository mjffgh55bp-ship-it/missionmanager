import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const [editingPreset, setEditingPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnRole, setNewColumnRole] = useState("");
  const [workerRoles, setWorkerRoles] = useState([]);
  const [columnTypes, setColumnTypes] = useState([]);
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    if (open) { loadPresets(); loadSettings(); }
  }, [open]);

  const loadPresets = async () => {
    setLoading(true);
    const data = await base44.entities.MokedPreset.list();
    setPresets(data);
    setLoading(false);
  };

  const loadSettings = async () => {
    const [rolesSettings, colTypesSettings, workersData] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.Worker.filter({ active: true }),
    ]);
    if (rolesSettings.length > 0) setWorkerRoles(JSON.parse(rolesSettings[0].setting_value) || []);
    if (colTypesSettings.length > 0) {
      const customParams = JSON.parse(colTypesSettings[0].setting_value) || [];
      setColumnTypes(customParams.map(c => c.name));
    }
    setWorkers(workersData);
  };

  const updateRowCell = (rowIdx, colName, value) => {
    const rows = [...(editingPreset.template_config.default_rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], [colName]: value };
    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, default_rows: rows } });
  };

  const handleAddColumnConfirm = () => {
    let columnToAdd;
    if (newColumnName === "time") {
      columnToAdd = { name: "התחלה", type: "time", width: 100 };
    } else if (newColumnName === "time_end") {
      columnToAdd = { name: "סיום", type: "time", width: 100 };
    } else if (newColumnName === "worker_member") {
      columnToAdd = { name: newColumnRole, type: "worker", width: 150, role_filter: newColumnRole };
    } else {
      columnToAdd = { name: newColumnName, type: "text", width: 120 };
    }
    const cols = [...editingPreset.template_config.columns, columnToAdd];
    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
    setShowAddColumnDialog(false);
    setNewColumnName("");
    setNewColumnRole("");
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
    <>
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditingPreset(null); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle dir="rtl" className="text-xl">
            {editingPreset ? (editingPreset.id ? "עריכת פריסט" : "פריסט חדש") : "פריסטים"}
          </DialogTitle>
        </DialogHeader>

        {editingPreset ? (
          /* ── Edit / Create view ── */
          <div className="space-y-3 py-2" dir="rtl">
            {/* Moked card - exactly like Schedule page */}
            <div className="rounded-lg overflow-hidden border shadow-sm">
              {/* Header with editable name + color */}
              <div
                className="px-4 py-3 flex justify-between items-center"
                style={{ background: `linear-gradient(to left, ${editingPreset.template_config.color}, ${editingPreset.template_config.color}dd)` }}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={editingPreset.name}
                    onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                    dir="rtl"
                    className="text-base font-bold h-8 w-48 bg-white/20 border-white/50 text-black placeholder:text-black/50"
                    placeholder="שם המוקד"
                  />
                  <input
                    type="color"
                    value={editingPreset.template_config.color}
                    onChange={(e) => setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, color: e.target.value } })}
                    className="w-7 h-7 rounded cursor-pointer border border-white/50"
                    title="צבע"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setNewColumnName(""); setNewColumnRole(""); setShowAddColumnDialog(true); }} dir="rtl">
                    <Plus className="w-3 h-3 ml-1" />הוסף עמודה
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    const rows = [...(editingPreset.template_config.default_rows || []), {}];
                    setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, default_rows: rows } });
                  }} dir="rtl">
                    <Plus className="w-3 h-3 ml-1" />הוסף שורה
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {editingPreset.template_config.columns.map((col, idx) => (
                        <TableHead key={idx} className="text-center p-1" dir="rtl" style={{ minWidth: 90 }}>
                          <div className="flex flex-col items-center gap-1">
                            <Input
                              value={col.name}
                              onChange={(e) => updateColumn(idx, "name", e.target.value)}
                              placeholder={`עמודה ${idx + 1}`}
                              className="h-6 text-xs text-center px-1 border-dashed"
                              dir="rtl"
                            />
                            <div className="flex items-center gap-0.5">
                              <Select value={col.type} onValueChange={(v) => updateColumn(idx, "type", v)}>
                                <SelectTrigger className="h-5 w-20 text-[10px] px-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COLUMN_TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" className="h-5 w-5 p-0" disabled={idx === 0}
                                onClick={() => {
                                  const cols = [...editingPreset.template_config.columns];
                                  [cols[idx - 1], cols[idx]] = [cols[idx], cols[idx - 1]];
                                  setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
                                }}>
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-5 w-5 p-0" disabled={idx === editingPreset.template_config.columns.length - 1}
                                onClick={() => {
                                  const cols = [...editingPreset.template_config.columns];
                                  [cols[idx], cols[idx + 1]] = [cols[idx + 1], cols[idx]];
                                  setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, columns: cols } });
                                }}>
                                <ChevronLeft className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                onClick={() => removeColumn(idx)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center text-xs w-20" dir="rtl">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(editingPreset.template_config.default_rows || [{}]).map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {editingPreset.template_config.columns.map((col, idx) => (
                          <TableCell key={idx} className="text-center py-1 px-1" dir="rtl">
                            {col.type === "time" ? (
                              <input
                                type="time"
                                value={row[col.name] || ""}
                                onChange={(e) => updateRowCell(rowIdx, col.name, e.target.value)}
                                className="w-full text-xs border rounded px-1 py-0.5 text-center"
                              />
                            ) : col.type === "worker" ? (
                              <select
                                value={row[col.name] || ""}
                                onChange={(e) => updateRowCell(rowIdx, col.name, e.target.value)}
                                className="w-full text-xs border rounded px-1 py-0.5"
                                dir="rtl"
                              >
                                <option value="">— בחר —</option>
                                {workers
                                  .filter(w => !col.role_filter || w.role === col.role_filter)
                                  .map(w => (
                                    <option key={w.id} value={w.id}>{w.nickname}</option>
                                  ))}
                              </select>
                            ) : (
                              <Input
                                value={row[col.name] || ""}
                                onChange={(e) => updateRowCell(rowIdx, col.name, e.target.value)}
                                className="h-6 text-xs px-1"
                                dir="rtl"
                                placeholder="—"
                              />
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center py-2" dir="rtl">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs text-gray-400">—</span>
                            <Button size="icon" variant="ghost" className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                              onClick={() => {
                                const rows = (editingPreset.template_config.default_rows || []).filter((_, i) => i !== rowIdx);
                                setEditingPreset({ ...editingPreset, template_config: { ...editingPreset.template_config, default_rows: rows } });
                              }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
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

    {/* Add Column Dialog - same as Schedule page */}
    <Dialog open={showAddColumnDialog} onOpenChange={setShowAddColumnDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle dir="rtl">הוסף עמודה</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label dir="rtl">בחר סוג עמודה</Label>
            <Select value={newColumnName} onValueChange={(val) => { setNewColumnName(val); setNewColumnRole(""); }}>
              <SelectTrigger><SelectValue placeholder="בחר מסוגי העמודות..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="time">זמן התחלה</SelectItem>
                <SelectItem value="time_end">זמן סיום</SelectItem>
                {columnTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="worker_member">חבר צוות</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newColumnName === "worker_member" && (
            <div>
              <Label dir="rtl">תפקיד</Label>
              <Select value={newColumnRole} onValueChange={setNewColumnRole}>
                <SelectTrigger dir="rtl"><SelectValue placeholder="בחר תפקיד..." /></SelectTrigger>
                <SelectContent>
                  {workerRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddColumnDialog(false)} dir="rtl">ביטול</Button>
          <Button
            onClick={handleAddColumnConfirm}
            disabled={!newColumnName || (newColumnName === "worker_member" && !newColumnRole)}
            className="bg-blue-900 hover:bg-blue-800"
            dir="rtl"
          >
            הוסף עמודה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
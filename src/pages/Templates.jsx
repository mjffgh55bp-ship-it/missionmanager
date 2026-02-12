import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, GripVertical, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    columns: [],
    default_rows: []
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await base44.entities.Template.list("-created_date");
    setTemplates(data);
    setLoading(false);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      color: "#3b82f6",
      columns: [
        { name: "תדריך", type: "text", width: 120 },
        { name: "התחלה", type: "time", width: 120 },
        { name: "סיום", type: "time", width: 120 },
        { name: "מדריך", type: "worker", width: 120 },
        { name: "שף / שף 2", type: "worker", width: 120 },
        { name: "סו שף", type: "worker", width: 120 },
        { name: "נוסף", type: "worker", width: 120 },
        { name: "משימה", type: "text", width: 120 },
        { name: "הערות", type: "text", width: 120 }
      ],
      default_rows: []
    });
    setShowDialog(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      color: template.color || "#3b82f6",
      columns: template.columns || [],
      default_rows: template.default_rows || []
    });
    setShowDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (editingTemplate) {
      await base44.entities.Template.update(editingTemplate.id, formData);
    } else {
      await base44.entities.Template.create({ ...formData, active: true });
    }

    setShowDialog(false);
    loadTemplates();
  };

  const handleDeleteTemplate = async (id) => {
    if (confirm("האם למחוק תבנית זו?")) {
      await base44.entities.Template.delete(id);
      loadTemplates();
    }
  };

  const handleDuplicateTemplate = async (template) => {
    const duplicatedTemplate = {
      name: `${template.name} - עותק`,
      color: template.color || "#3b82f6",
      columns: template.columns || [],
      default_rows: template.default_rows || [],
      active: true
    };
    await base44.entities.Template.create(duplicatedTemplate);
    loadTemplates();
  };

  const handleAddColumn = () => {
    setFormData({
      ...formData,
      columns: [...formData.columns, { name: "", type: "text", width: 120 }]
    });
  };

  const handleRemoveColumn = (index) => {
    setFormData({
      ...formData,
      columns: formData.columns.filter((_, i) => i !== index)
    });
  };

  const handleUpdateColumn = (index, field, value) => {
    const updated = [...formData.columns];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, columns: updated });
  };

  const handleAddDefaultRow = () => {
    const newRow = {};
    formData.columns.forEach(col => {
      newRow[col.name] = col.default_value || "";
    });
    setFormData({
      ...formData,
      default_rows: [...formData.default_rows, newRow]
    });
  };

  const handleRemoveDefaultRow = (index) => {
    setFormData({
      ...formData,
      default_rows: formData.default_rows.filter((_, i) => i !== index)
    });
  };

  const handleUpdateDefaultRow = (rowIndex, colName, value) => {
    const updated = [...formData.default_rows];
    updated[rowIndex] = { ...updated[rowIndex], [colName]: value };
    setFormData({ ...formData, default_rows: updated });
  };

  const getColumnTypeLabel = (type) => {
    const types = {
      text: "טקסט",
      time: "שעה",
      select: "בחירה",
      worker: "עובד"
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-gray-600" dir="rtl">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl" dir="rtl">שלדיות</CardTitle>
              <Button onClick={handleAddTemplate} className="bg-green-600 hover:bg-green-700" dir="rtl">
                <Plus className="w-4 h-4 ml-2" />
                תבנית חדשה
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6">
          {templates.length === 0 ? (
            <Card className="border-none shadow-lg">
              <CardContent className="py-16 text-center" dir="rtl">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">אין תבניות</h3>
                <p className="text-gray-600 mb-4">צור תבנית ראשונה על ידי לחיצה על "תבנית חדשה"</p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className="border-none shadow-lg overflow-hidden">
                <CardHeader className="text-white py-3" style={{ background: `linear-gradient(to left, ${template.color || '#3b82f6'}, ${template.color || '#3b82f6'}dd)` }}>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg" dir="rtl">{template.name}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleDuplicateTemplate(template)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleEditTemplate(template)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="secondary" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-2" dir="rtl">עמודות:</div>
                      <div className="flex flex-wrap gap-2">
                        {template.columns?.map((col, idx) => (
                          <Badge key={idx} variant="outline" className="text-sm" dir="rtl">
                            {col.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {template.default_rows && template.default_rows.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2" dir="rtl">
                          שורות ברירת מחדל ({template.default_rows.length}):
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {template.columns?.map((col, idx) => (
                                  <th key={idx} className="px-2 py-1 text-right border-b text-gray-600" dir="rtl">
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {template.default_rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b last:border-b-0">
                                  {template.columns?.map((col, colIdx) => (
                                    <td key={colIdx} className="px-2 py-1 text-right" dir="rtl">
                                      {row[col.name] || "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Template Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle dir="rtl">{editingTemplate ? "ערוך תבנית" : "תבנית חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <Label dir="rtl">שם התבנית</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="לדוגמה: נחש בהריון"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label dir="rtl">צבע</Label>
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label dir="rtl">עמודות</Label>
                  <Button size="sm" variant="outline" onClick={handleAddColumn} dir="rtl">
                    <Plus className="w-3 h-3 ml-1" />
                    עמודה
                  </Button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {formData.columns.map((col, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                      <GripVertical className="w-4 h-4 text-gray-400 mt-2" />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs" dir="rtl">שם</Label>
                            <Input
                              value={col.name}
                              onChange={(e) => handleUpdateColumn(idx, "name", e.target.value)}
                              placeholder="שם העמודה"
                              dir="rtl"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs" dir="rtl">סוג</Label>
                            <Select value={col.type} onValueChange={(val) => handleUpdateColumn(idx, "type", val)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">טקסט</SelectItem>
                                <SelectItem value="time">שעה</SelectItem>
                                <SelectItem value="select">בחירה</SelectItem>
                                <SelectItem value="worker">עובד</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs" dir="rtl">רוחב</Label>
                            <Input
                              type="number"
                              value={col.width}
                              onChange={(e) => handleUpdateColumn(idx, "width", parseInt(e.target.value))}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs" dir="rtl">טקסט ברירת מחדל</Label>
                          <Input
                            value={col.default_value || ""}
                            onChange={(e) => handleUpdateColumn(idx, "default_value", e.target.value)}
                            placeholder="אופציונלי - טקסט שיופיע אוטומטית"
                            dir="rtl"
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 mt-6"
                        onClick={() => handleRemoveColumn(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label dir="rtl">שורות ברירת מחדל (אופציונלי)</Label>
                  <Button size="sm" variant="outline" onClick={handleAddDefaultRow} disabled={formData.columns.length === 0} dir="rtl">
                    <Plus className="w-3 h-3 ml-1" />
                    שורה
                  </Button>
                </div>
                {formData.columns.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4 border rounded-lg" dir="rtl">
                    יש להוסיף עמודות לפני הוספת שורות ברירת מחדל
                  </div>
                ) : formData.default_rows.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4 border rounded-lg" dir="rtl">
                    לחץ על "שורה" להוספת שורות ברירת מחדל
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {formData.columns.map((col, idx) => (
                            <th key={idx} className="px-2 py-2 text-right border-b" dir="rtl">{col.name}</th>
                          ))}
                          <th className="px-2 py-2 w-10 border-b"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.default_rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b">
                            {formData.columns.map((col, colIdx) => (
                              <td key={colIdx} className="p-0">
                                <Input
                                  type={col.type === "time" ? "time" : "text"}
                                  value={row[col.name] || ""}
                                  onChange={(e) => handleUpdateDefaultRow(rowIdx, col.name, e.target.value)}
                                  placeholder={col.default_value || ""}
                                  dir="rtl"
                                  className="border-0 rounded-none text-sm h-9"
                                />
                              </td>
                            ))}
                            <td className="p-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveDefaultRow(rowIdx)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveTemplate} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
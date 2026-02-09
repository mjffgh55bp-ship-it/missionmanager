import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Edit, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Skeletons() {
  const [templates, setTemplates] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState("");
  const [editingTemplateColor, setEditingTemplateColor] = useState("#fef3c7");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const templatesData = await base44.entities.WindowTemplate.list();
    setTemplates(templatesData);
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) return;
    
    const newTemplate = await base44.entities.WindowTemplate.create({
      name: templateName.trim(),
      windows: []
    });
    
    setTemplates([...templates, newTemplate]);
    setTemplateName("");
    setShowCreateDialog(false);
  };

  const handleDeleteTemplate = async (id) => {
    await base44.entities.WindowTemplate.delete(id);
    setTemplates(templates.filter(t => t.id !== id));
    if (activeTemplate?.id === id) {
      setActiveTemplate(null);
    }
  };

  const handleEditTemplate = (template) => {
    setActiveTemplate({
      ...template,
      windows: JSON.parse(JSON.stringify(template.windows || []))
    });
  };

  const handleOpenEditTemplateDialog = (template) => {
    setEditingTemplate(template);
    setEditingTemplateName(template.name);
    setEditingTemplateColor(template.color || "#fef3c7");
    setShowEditTemplateDialog(true);
  };

  const handleSaveTemplateSettings = async () => {
    if (!editingTemplate || !editingTemplateName.trim()) return;
    
    await base44.entities.WindowTemplate.update(editingTemplate.id, {
      name: editingTemplateName.trim(),
      color: editingTemplateColor
    });
    
    loadTemplates();
    setShowEditTemplateDialog(false);
    setEditingTemplate(null);
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    
    await base44.entities.WindowTemplate.update(activeTemplate.id, {
      name: activeTemplate.name,
      windows: activeTemplate.windows
    });
    
    loadTemplates();
    setActiveTemplate(null);
  };

  const addWindow = () => {
    setActiveTemplate({
      ...activeTemplate,
      windows: [
        ...(activeTemplate.windows || []),
        {
          time: "",
          rows: [{ hours: "-", guide_id: "", chef_id: "", sous_chef_id: "", additional_id: "", notes: "" }],
          color: "#fef3c7",
          header_color: "#fde68a"
        }
      ]
    });
  };

  const addRow = (windowIndex) => {
    const newWindows = [...activeTemplate.windows];
    newWindows[windowIndex].rows = [
      ...(newWindows[windowIndex].rows || []),
      { hours: "-", guide_id: "", chef_id: "", sous_chef_id: "", additional_id: "", notes: "" }
    ];
    setActiveTemplate({ ...activeTemplate, windows: newWindows });
  };

  const deleteWindow = (windowIndex) => {
    setActiveTemplate({
      ...activeTemplate,
      windows: activeTemplate.windows.filter((_, i) => i !== windowIndex)
    });
  };

  const deleteRow = (windowIndex, rowIndex) => {
    const newWindows = [...activeTemplate.windows];
    newWindows[windowIndex].rows = newWindows[windowIndex].rows.filter((_, i) => i !== rowIndex);
    setActiveTemplate({ ...activeTemplate, windows: newWindows });
  };

  const updateWindow = (windowIndex, field, value) => {
    const newWindows = [...activeTemplate.windows];
    newWindows[windowIndex] = { ...newWindows[windowIndex], [field]: value };
    setActiveTemplate({ ...activeTemplate, windows: newWindows });
  };

  const updateRow = (windowIndex, rowIndex, field, value) => {
    const newWindows = [...activeTemplate.windows];
    newWindows[windowIndex].rows[rowIndex] = {
      ...newWindows[windowIndex].rows[rowIndex],
      [field]: value
    };
    setActiveTemplate({ ...activeTemplate, windows: newWindows });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-4 border-black shadow-xl mb-6">
          <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-white">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl text-black" dir="rtl">שלדית - ניהול תבניות</CardTitle>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
                dir="rtl"
              >
                <Plus className="w-4 h-4 ml-2" />
                תבנית חדשה
              </Button>
            </div>
          </CardHeader>
        </Card>

        {!activeTemplate ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="border-4 border-black shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="bg-gradient-to-r from-green-100 to-white border-b-4 border-black">
                  <CardTitle className="text-lg text-black" dir="rtl">{template.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleOpenEditTemplateDialog(template)}
                      variant="outline"
                      className="w-8 h-8 p-0"
                      title="הגדרות תבנית"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button 
                      onClick={() => handleEditTemplate(template)}
                      variant="outline"
                      className="flex-1"
                      dir="rtl"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך
                    </Button>
                    <Button 
                      onClick={() => handleDeleteTemplate(template.id)}
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-none shadow-md mb-6 border border-green-100">
            <CardHeader className="py-3 px-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-white">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg text-green-800" dir="rtl">{activeTemplate.name}</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setActiveTemplate(null)}
                    variant="outline"
                    dir="rtl"
                  >
                    חזור
                  </Button>
                  <Button 
                    onClick={addWindow}
                    variant="outline"
                    dir="rtl"
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    הוסף חלון
                  </Button>
                  <Button 
                    onClick={handleSaveTemplate}
                    className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
                    dir="rtl"
                  >
                    <Save className="w-4 h-4 ml-2" />
                    שמור תבנית
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" dir="rtl">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-sm font-semibold text-right">תדריך</th>
                      <th className="p-2 text-sm font-semibold text-right">התחלה</th>
                      <th className="p-2 text-sm font-semibold text-right">סיום</th>
                      <th className="p-2 text-sm font-semibold text-right">מדריך</th>
                      <th className="p-2 text-sm font-semibold text-right">שף / שף 2</th>
                      <th className="p-2 text-sm font-semibold text-right">סו שף</th>
                      <th className="p-2 text-sm font-semibold text-right">נוסף</th>
                      <th className="p-2 text-sm font-semibold text-right">הערות</th>
                      <th className="p-2 text-sm font-semibold text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTemplate.windows?.map((window, wIdx) => (
                      <React.Fragment key={wIdx}>
                        <tr className="bg-green-50">
                          <td colSpan="9" className="p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-green-800" dir="rtl">חלון {wIdx + 1}</span>
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => addRow(wIdx)}
                                  className="h-7"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => deleteWindow(wIdx)}
                                  className="h-7 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {window.rows?.map((row, rIdx) => (
                          <tr key={`${wIdx}-${rIdx}`} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <Input 
                                value={window.time || ""} 
                                onChange={(e) => updateWindow(wIdx, "time", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl"
                                placeholder="זמן"
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.hours?.split('-')[0] || ""} 
                                onChange={(e) => {
                                  const end = row.hours?.split('-')[1] || "";
                                  updateRow(wIdx, rIdx, "hours", `${e.target.value}-${end}`);
                                }}
                                type="time"
                                className="h-8 text-sm" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.hours?.split('-')[1] || ""} 
                                onChange={(e) => {
                                  const start = row.hours?.split('-')[0] || "";
                                  updateRow(wIdx, rIdx, "hours", `${start}-${e.target.value}`);
                                }}
                                type="time"
                                className="h-8 text-sm" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.guide_id || ""} 
                                onChange={(e) => updateRow(wIdx, rIdx, "guide_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.chef_id || ""} 
                                onChange={(e) => updateRow(wIdx, rIdx, "chef_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.sous_chef_id || ""} 
                                onChange={(e) => updateRow(wIdx, rIdx, "sous_chef_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.additional_id || ""} 
                                onChange={(e) => updateRow(wIdx, rIdx, "additional_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.notes || ""} 
                                onChange={(e) => updateRow(wIdx, rIdx, "notes", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteRow(wIdx, rIdx)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">תבנית חדשה</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label dir="rtl">שם התבנית</Label>
            <Input 
              value={templateName} 
              onChange={(e) => setTemplateName(e.target.value)}
              className="mt-2"
              dir="rtl"
              placeholder="הכנס שם..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} dir="rtl">
              ביטול
            </Button>
            <Button 
              onClick={handleCreateTemplate} 
              className="bg-green-400 hover:bg-green-500 text-black border-2 border-black"
              disabled={!templateName.trim()}
              dir="rtl"
            >
              <Plus className="w-4 h-4 ml-2" />
              צור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
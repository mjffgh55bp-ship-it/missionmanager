import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Save, FileDown } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const DEFAULT_TEMPLATES = {
  "מאוב": {
    name: "מאוב",
    color: "#d1d5db",
    rows: []
  },
  "נהש בקרון": {
    name: "נהש בקרון",
    color: "#bbf7d0",
    rows: [
      { start: "05:15", end: "06:00", type: "10:00" },
      { start: "09:15", end: "10:00", type: "14:00" },
      { start: "13:15", end: "14:00", type: "18:00" },
      { start: "17:15", end: "18:00", type: "22:00" },
      { start: "21:15", end: "22:00", type: "02:00" },
      { start: "01:15", end: "02:00", type: "06:00" }
    ]
  },
  "ציפור בקרון": {
    name: "ציפור בקרון",
    color: "#fed7aa",
    rows: [
      { start: "05:15", end: "06:00", type: "10:00" },
      { start: "09:15", end: "10:00", type: "14:00" },
      { start: "13:15", end: "14:00", type: "18:00" },
      { start: "17:15", end: "18:00", type: "22:00" },
      { start: "21:15", end: "22:00", type: "02:00" },
      { start: "01:15", end: "02:00", type: "06:00" }
    ]
  },
  "הבשרה": {
    name: "הבשרה",
    color: "#dbeafe",
    rows: []
  }
};

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [templates, setTemplates] = useState([]);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const templatesData = await base44.entities.WindowTemplate.list();
    if (templatesData.length === 0) {
      // Create default templates
      for (const [key, template] of Object.entries(DEFAULT_TEMPLATES)) {
        await base44.entities.WindowTemplate.create({
          name: template.name,
          windows: template.rows.map(row => ({
            time: row.type,
            rows: [{ hours: `${row.start}-${row.end}`, guide_id: "", chef_id: "", sous_chef_id: "", additional_id: "", notes: "" }],
            color: template.color,
            header_color: template.color
          }))
        });
      }
      loadTemplates();
    } else {
      setTemplates(templatesData);
      // Initialize active templates with loaded data
      const initialActive = {};
      templatesData.forEach(t => {
        initialActive[t.id] = {
          name: t.name,
          windows: t.windows || []
        };
      });
      setActiveTemplates(initialActive);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !saveTemplateName.trim()) return;
    
    const templateData = activeTemplates[editingTemplate];
    await base44.entities.WindowTemplate.update(editingTemplate, {
      name: saveTemplateName.trim(),
      windows: templateData.windows
    });
    
    setShowSaveDialog(false);
    setSaveTemplateName("");
    setEditingTemplate(null);
    loadTemplates();
  };

  const updateTemplateWindow = (templateId, windowIndex, field, value) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: prev[templateId].windows.map((w, i) => 
          i === windowIndex ? { ...w, [field]: value } : w
        )
      }
    }));
  };

  const updateTemplateRow = (templateId, windowIndex, rowIndex, field, value) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: prev[templateId].windows.map((w, wIdx) => 
          wIdx === windowIndex ? {
            ...w,
            rows: w.rows.map((r, rIdx) => 
              rIdx === rowIndex ? { ...r, [field]: value } : r
            )
          } : w
        )
      }
    }));
  };

  const daySchedule = [
    { role: 'מנל"ח', start: '08:00', end: '18:00' },
    { role: 'מנהל', start: '08:00', end: '18:00' }
  ];

  const nightSchedule = [
    { role: 'מנל"ח', start: '18:00', end: '08:00' },
    { role: 'מנהל', start: '18:00', end: '08:00' }
  ];

  const onCallSchedule = [
    { type: '', start: '06:00', end: '10:00', commander: '', operator: '' },
    { type: '', start: '10:00', end: '14:00', commander: '', operator: '' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="border-b border-green-100 bg-gradient-to-r from-white to-green-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl" dir="rtl">דרום אאא צפון</CardTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-300 text-white rounded-lg font-semibold min-w-[200px] text-center shadow-md" dir="rtl">
                  <div>{format(currentDate, "EEEE", { locale: he })}</div>
                  <div className="text-sm opacity-90">{format(currentDate, "d MMMM yyyy", { locale: he })}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Day Managers */}
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
            <CardTitle className="text-lg text-green-800" dir="rtl">מנהלי מסעדה יום</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>תפקיד</div>
                <div>התחלה</div>
                <div>סיום</div>
              </div>
              {daySchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Night Managers */}
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
            <CardTitle className="text-lg text-green-800" dir="rtl">מנהלי מסעדה לילה</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>תפקיד</div>
                <div>התחלה</div>
                <div>סיום</div>
              </div>
              {nightSchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* On-Call */}
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
            <CardTitle className="text-lg text-green-800" dir="rtl">כוננויות</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>כוננות</div>
                <div>התחלה</div>
                <div>סיום</div>
                <div>מפקד</div>
                <div>מפעיל</div>
              </div>
              {onCallSchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-3" dir="rtl">
                  <Input value={item.type} className="h-9" dir="rtl" placeholder="סוג כוננות" />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                  <Input value={item.commander} className="h-9" dir="rtl" placeholder="שם" />
                  <Input value={item.operator} className="h-9" dir="rtl" placeholder="שם" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        {templates.map((template) => {
          const activeTemplate = activeTemplates[template.id];
          if (!activeTemplate) return null;
          
          return (
            <Card key={template.id} className="border-none shadow-md mb-6 border border-green-100">
              <CardHeader className="py-3 px-4 border-b border-green-100 flex flex-row items-center justify-between bg-gradient-to-r from-green-50 to-white">
                <CardTitle className="text-lg text-green-800" dir="rtl">{template.name}</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setEditingTemplate(template.id);
                    setSaveTemplateName(template.name);
                    setShowSaveDialog(true);
                  }}
                  className="bg-gradient-to-r from-green-400 to-green-300 hover:from-green-500 hover:to-green-400 text-white shadow-sm"
                  dir="rtl"
                >
                  <Save className="w-4 h-4 ml-2" />
                  שמור תבנית
                </Button>
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
                        <th className="p-2 text-sm font-semibold text-right">נפסה</th>
                        <th className="p-2 text-sm font-semibold text-right">נפסד</th>
                        <th className="p-2 text-sm font-semibold text-right">התרוע</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTemplate.windows?.map((window, wIdx) => (
                        window.rows?.map((row, rIdx) => (
                          <tr key={`${wIdx}-${rIdx}`} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <Input 
                                value={window.time || ""} 
                                onChange={(e) => updateTemplateWindow(template.id, wIdx, "time", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.hours?.split('-')[0] || ""} 
                                onChange={(e) => {
                                  const end = row.hours?.split('-')[1] || "";
                                  updateTemplateRow(template.id, wIdx, rIdx, "hours", `${e.target.value}-${end}`);
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
                                  updateTemplateRow(template.id, wIdx, rIdx, "hours", `${start}-${e.target.value}`);
                                }}
                                type="time"
                                className="h-8 text-sm" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.guide_id || ""} 
                                onChange={(e) => updateTemplateRow(template.id, wIdx, rIdx, "guide_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.chef_id || ""} 
                                onChange={(e) => updateTemplateRow(template.id, wIdx, rIdx, "chef_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.sous_chef_id || ""} 
                                onChange={(e) => updateTemplateRow(template.id, wIdx, rIdx, "sous_chef_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.additional_id || ""} 
                                onChange={(e) => updateTemplateRow(template.id, wIdx, rIdx, "additional_id", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                value={row.notes || ""} 
                                onChange={(e) => updateTemplateRow(template.id, wIdx, rIdx, "notes", e.target.value)}
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                            <td className="p-2">
                              <Input 
                                className="h-8 text-sm" 
                                dir="rtl" 
                              />
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">שמור תבנית</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label dir="rtl">שם התבנית</Label>
            <Input 
              value={saveTemplateName} 
              onChange={(e) => setSaveTemplateName(e.target.value)}
              className="mt-2"
              dir="rtl"
              placeholder="הכנס שם..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} dir="rtl">
              ביטול
            </Button>
            <Button 
              onClick={handleSaveTemplate} 
              className="bg-gradient-to-r from-green-400 to-green-300 hover:from-green-500 hover:to-green-400 text-white"
              disabled={!saveTemplateName.trim()}
              dir="rtl"
            >
              <Save className="w-4 h-4 ml-2" />
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
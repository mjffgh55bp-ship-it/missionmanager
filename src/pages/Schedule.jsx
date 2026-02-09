import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Save, FileDown, Plus, Trash2, Copy } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [showLoadTemplateDialog, setShowLoadTemplateDialog] = useState(false);
  const [showSaveDayDialog, setShowSaveDayDialog] = useState(false);
  const [dayManagers, setDayManagers] = useState([
    { role: 'מנל"ח', start: '08:00', end: '18:00', name: '' },
    { role: 'מנהל', start: '08:00', end: '18:00', name: '' }
  ]);
  const [nightManagers, setNightManagers] = useState([
    { role: 'מנל"ח', start: '18:00', end: '08:00', name: '' },
    { role: 'מנהל', start: '18:00', end: '08:00', name: '' }
  ]);
  const [onCallSchedule, setOnCallSchedule] = useState([
    { type: '', start: '06:00', end: '10:00', commander: '', operator: '' },
    { type: '', start: '10:00', end: '14:00', commander: '', operator: '' }
  ]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    loadDailySchedule();
  }, [currentDate]);

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
    }
  };

  const loadDailySchedule = async () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dailySchedules = await base44.entities.DailySchedule.filter({ date: dateStr });
    
    if (dailySchedules.length > 0) {
      const schedule = dailySchedules[0];
      if (schedule.day_managers) setDayManagers(schedule.day_managers);
      if (schedule.night_managers) setNightManagers(schedule.night_managers);
      if (schedule.on_call) setOnCallSchedule(schedule.on_call);
      if (schedule.templates_data) {
        const activeTemps = {};
        schedule.templates_data.forEach(t => {
          activeTemps[t.template_id] = {
            name: t.template_name,
            windows: t.windows
          };
        });
        setActiveTemplates(activeTemps);
      }
    } else {
      // Reset to defaults
      setDayManagers([
        { role: 'מנל"ח', start: '08:00', end: '18:00', name: '' },
        { role: 'מנהל', start: '08:00', end: '18:00', name: '' }
      ]);
      setNightManagers([
        { role: 'מנל"ח', start: '18:00', end: '08:00', name: '' },
        { role: 'מנהל', start: '18:00', end: '08:00', name: '' }
      ]);
      setOnCallSchedule([
        { type: '', start: '06:00', end: '10:00', commander: '', operator: '' },
        { type: '', start: '10:00', end: '14:00', commander: '', operator: '' }
      ]);
      
      // Load template structures (empty data)
      const templatesData = await base44.entities.WindowTemplate.list();
      const initialActive = {};
      templatesData.forEach(t => {
        initialActive[t.id] = {
          name: t.name,
          windows: JSON.parse(JSON.stringify(t.windows || []))
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

  const handleLoadTemplate = async (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        name: template.name,
        windows: JSON.parse(JSON.stringify(template.windows || []))
      }
    }));
    setShowLoadTemplateDialog(false);
  };

  const handleSaveDailySchedule = async () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const templatesData = Object.entries(activeTemplates).map(([id, data]) => ({
      template_id: id,
      template_name: data.name,
      windows: data.windows
    }));

    const existingSchedules = await base44.entities.DailySchedule.filter({ date: dateStr });
    
    const scheduleData = {
      date: dateStr,
      day_managers: dayManagers,
      night_managers: nightManagers,
      on_call: onCallSchedule,
      templates_data: templatesData
    };

    if (existingSchedules.length > 0) {
      await base44.entities.DailySchedule.update(existingSchedules[0].id, scheduleData);
    } else {
      await base44.entities.DailySchedule.create(scheduleData);
    }
    
    setShowSaveDayDialog(false);
  };

  const addWindow = (templateId) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: [
          ...(prev[templateId].windows || []),
          {
            time: "",
            rows: [{ hours: "-", guide_id: "", chef_id: "", sous_chef_id: "", additional_id: "", notes: "" }],
            color: "#fef3c7",
            header_color: "#fde68a"
          }
        ]
      }
    }));
  };

  const addRow = (templateId, windowIndex) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: prev[templateId].windows.map((w, i) => 
          i === windowIndex ? {
            ...w,
            rows: [...(w.rows || []), { hours: "-", guide_id: "", chef_id: "", sous_chef_id: "", additional_id: "", notes: "" }]
          } : w
        )
      }
    }));
  };

  const deleteWindow = (templateId, windowIndex) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: prev[templateId].windows.filter((_, i) => i !== windowIndex)
      }
    }));
  };

  const deleteRow = (templateId, windowIndex, rowIndex) => {
    setActiveTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        windows: prev[templateId].windows.map((w, wIdx) => 
          wIdx === windowIndex ? {
            ...w,
            rows: w.rows.filter((_, rIdx) => rIdx !== rowIndex)
          } : w
        )
      }
    }));
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



  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="border-b border-green-100 bg-gradient-to-r from-white to-green-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl" dir="rtl">דרום אאא צפון</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  onClick={() => setShowLoadTemplateDialog(true)} 
                  variant="outline"
                  size="sm"
                  dir="rtl"
                >
                  <Copy className="w-4 h-4 ml-2" />
                  טען תבנית
                </Button>
                <Button 
                  onClick={() => setShowSaveDayDialog(true)} 
                  className="bg-gradient-to-r from-green-400 to-green-300 hover:from-green-500 hover:to-green-400 text-white"
                  size="sm"
                  dir="rtl"
                >
                  <Save className="w-4 h-4 ml-2" />
                  שמור יום
                </Button>
                <div className="flex items-center gap-1">
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
              {dayManagers.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input 
                    value={item.start} 
                    type="time" 
                    className="h-9" 
                    onChange={(e) => {
                      const newManagers = [...dayManagers];
                      newManagers[index].start = e.target.value;
                      setDayManagers(newManagers);
                    }}
                  />
                  <Input 
                    value={item.end} 
                    type="time" 
                    className="h-9" 
                    onChange={(e) => {
                      const newManagers = [...dayManagers];
                      newManagers[index].end = e.target.value;
                      setDayManagers(newManagers);
                    }}
                  />
                  <Input 
                    value={item.name} 
                    className="h-9" 
                    dir="rtl"
                    placeholder="שם"
                    onChange={(e) => {
                      const newManagers = [...dayManagers];
                      newManagers[index].name = e.target.value;
                      setDayManagers(newManagers);
                    }}
                  />
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
              {nightManagers.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input 
                    value={item.start} 
                    type="time" 
                    className="h-9" 
                    onChange={(e) => {
                      const newManagers = [...nightManagers];
                      newManagers[index].start = e.target.value;
                      setNightManagers(newManagers);
                    }}
                  />
                  <Input 
                    value={item.end} 
                    type="time" 
                    className="h-9" 
                    onChange={(e) => {
                      const newManagers = [...nightManagers];
                      newManagers[index].end = e.target.value;
                      setNightManagers(newManagers);
                    }}
                  />
                  <Input 
                    value={item.name} 
                    className="h-9" 
                    dir="rtl"
                    placeholder="שם"
                    onChange={(e) => {
                      const newManagers = [...nightManagers];
                      newManagers[index].name = e.target.value;
                      setNightManagers(newManagers);
                    }}
                  />
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
                  <Input 
                    value={item.type} 
                    className="h-9" 
                    dir="rtl" 
                    placeholder="סוג כוננות"
                    onChange={(e) => {
                      const newSchedule = [...onCallSchedule];
                      newSchedule[index].type = e.target.value;
                      setOnCallSchedule(newSchedule);
                    }}
                  />
                  <Input 
                    value={item.start} 
                    type="time" 
                    className="h-9"
                    onChange={(e) => {
                      const newSchedule = [...onCallSchedule];
                      newSchedule[index].start = e.target.value;
                      setOnCallSchedule(newSchedule);
                    }}
                  />
                  <Input 
                    value={item.end} 
                    type="time" 
                    className="h-9"
                    onChange={(e) => {
                      const newSchedule = [...onCallSchedule];
                      newSchedule[index].end = e.target.value;
                      setOnCallSchedule(newSchedule);
                    }}
                  />
                  <Input 
                    value={item.commander} 
                    className="h-9" 
                    dir="rtl" 
                    placeholder="שם"
                    onChange={(e) => {
                      const newSchedule = [...onCallSchedule];
                      newSchedule[index].commander = e.target.value;
                      setOnCallSchedule(newSchedule);
                    }}
                  />
                  <Input 
                    value={item.operator} 
                    className="h-9" 
                    dir="rtl" 
                    placeholder="שם"
                    onChange={(e) => {
                      const newSchedule = [...onCallSchedule];
                      newSchedule[index].operator = e.target.value;
                      setOnCallSchedule(newSchedule);
                    }}
                  />
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
                <CardTitle className="text-lg text-green-800" dir="rtl">{activeTemplate.name}</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => addWindow(template.id)}
                    dir="rtl"
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    הוסף חלון
                  </Button>
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
                        <th className="p-2 text-sm font-semibold text-right">נפסה</th>
                        <th className="p-2 text-sm font-semibold text-right">נפסד</th>
                        <th className="p-2 text-sm font-semibold text-right">התרוע</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTemplate.windows?.map((window, wIdx) => (
                        <React.Fragment key={wIdx}>
                          <tr className="bg-green-50">
                            <td colSpan="9" className="p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-green-800" dir="rtl">חלון {wIdx + 1}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => addRow(template.id, wIdx)}
                                    className="h-7"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => deleteWindow(template.id, wIdx)}
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteRow(template.id, wIdx, rIdx)}
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

      {/* Load Template Dialog */}
      <Dialog open={showLoadTemplateDialog} onOpenChange={setShowLoadTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">טען תבנית</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {templates.map(template => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleLoadTemplate(template.id)}
                dir="rtl"
              >
                {template.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadTemplateDialog(false)} dir="rtl">
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Daily Schedule Dialog */}
      <Dialog open={showSaveDayDialog} onOpenChange={setShowSaveDayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">שמור נתוני יום</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600" dir="rtl">
              האם לשמור את כל הנתונים של היום {format(currentDate, "d MMMM yyyy", { locale: he })}?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDayDialog(false)} dir="rtl">
              ביטול
            </Button>
            <Button 
              onClick={handleSaveDailySchedule} 
              className="bg-gradient-to-r from-green-400 to-green-300 hover:from-green-500 hover:to-green-400 text-white"
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
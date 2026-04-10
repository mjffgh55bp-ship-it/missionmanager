import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Info, Users, X, Plus, Trash2, Columns, Settings as SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";


export default function Settings() {
  const [tipsMessage, setTipsMessage] = useState("");
  const [showTipsAsPopup, setShowTipsAsPopup] = useState(false);
  const [userRoles, setUserRoles] = useState({});
  const [workers, setWorkers] = useState([]);
  // Unified schedule columns
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [newColReportType, setNewColReportType] = useState("sum_numbers");
  const [newColOption, setNewColOption] = useState("");
  const [newSubOptionName, setNewSubOptionName] = useState("");
  const [newSubOptionCriterion, setNewSubOptionCriterion] = useState("");
  const [expandedSubOptions, setExpandedSubOptions] = useState(null);
  const [expandedCol, setExpandedCol] = useState(null);
  const [populations, setPopulations] = useState([]);
  const [newPopulation, setNewPopulation] = useState("");
  const [workerRoles, setWorkerRoles] = useState([]);
  const [newWorkerRole, setNewWorkerRole] = useState("");
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [newShiftStatus, setNewShiftStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const [tipsSettings, rolesSettings, workersData, scheduleColsSettings, populationsSettings, workerRolesSettings, shiftStatusesSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "availability_tips" }),
      base44.entities.AppSettings.filter({ setting_key: "user_roles" }),
      base44.entities.Worker.list(),
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "shift_statuses" })
    ]);
    
    if (tipsSettings.length > 0) {
      const tipsData = JSON.parse(tipsSettings[0].setting_value);
      setTipsMessage(tipsData.message || "");
      setShowTipsAsPopup(tipsData.showAsPopup || false);
    }
    if (rolesSettings.length > 0) setUserRoles(JSON.parse(rolesSettings[0].setting_value));
    if (scheduleColsSettings.length > 0) setScheduleColumns(JSON.parse(scheduleColsSettings[0].setting_value) || []);
    if (populationsSettings.length > 0) {
      setPopulations(JSON.parse(populationsSettings[0].setting_value) || []);
    } else {
      setPopulations(["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"]);
    }
    if (workerRolesSettings.length > 0) {
      setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    } else {
      setWorkerRoles(["שף", "סו-שף"]);
    }
    if (shiftStatusesSettings.length > 0) {
      setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    } else {
      setShiftStatuses(["מתוכנן", "מאושר", "בוצע", "בוטל"]);
    }
    setWorkers(workersData);
    setLoading(false);
  };

  const handleSaveTips = async () => {
    setSaving(true);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "availability_tips" });
    const data = { setting_key: "availability_tips", setting_value: JSON.stringify({ message: tipsMessage, showAsPopup: showTipsAsPopup }) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setSaving(false);
  };

  const handleSaveRoles = async () => {
    setSaving(true);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
    const data = { setting_key: "user_roles", setting_value: JSON.stringify(userRoles) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setSaving(false);
  };

  const handleRoleChange = (email, role) => {
    if (!email) return;
    setUserRoles({ ...userRoles, [email]: role });
  };

  const saveScheduleColumns = async (updated) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
    const data = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setScheduleColumns(updated);
  };

  const handleAddScheduleColumn = async () => {
    if (!newColName.trim()) return;
    const updated = [...scheduleColumns, { name: newColName.trim(), report_type: newColReportType, options: [] }];
    await saveScheduleColumns(updated);
    setNewColName("");
  };

  const handleRemoveScheduleColumn = async (idx) => {
    await saveScheduleColumns(scheduleColumns.filter((_, i) => i !== idx));
  };

  const handleAddOption = async (colIdx) => {
    if (!newColOption.trim()) return;
    const updated = scheduleColumns.map((c, i) => i === colIdx ? { ...c, options: [...(c.options || []), newColOption.trim()] } : c);
    await saveScheduleColumns(updated);
    setNewColOption("");
  };

  const handleRemoveOption = async (colIdx, opt) => {
    const updated = scheduleColumns.map((c, i) => i === colIdx ? { ...c, options: (c.options || []).filter(o => o !== opt) } : c);
    await saveScheduleColumns(updated);
  };

  const handleAddSubOption = async (colIdx) => {
    if (!newSubOptionName.trim()) return;
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, sub_options: [...(c.sub_options || []), { name: newSubOptionName.trim(), criterion: newSubOptionName.trim() }] } : c
    );
    await saveScheduleColumns(updated);
    setNewSubOptionName("");
  };

  const handleRemoveSubOption = async (colIdx, subIdx) => {
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, sub_options: (c.sub_options || []).filter((_, si) => si !== subIdx) } : c
    );
    await saveScheduleColumns(updated);
  };

  const handleAddPopulation = async () => {
    if (!newPopulation.trim()) return;
    const updated = [...populations, newPopulation.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "worker_populations" });
    const data = { setting_key: "worker_populations", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setPopulations(updated);
    setNewPopulation("");
  };

  const handleRemovePopulation = async (population) => {
    const updated = populations.filter(p => p !== population);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "worker_populations" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setPopulations(updated);
  };

  const handleAddWorkerRole = async () => {
    if (!newWorkerRole.trim()) return;
    const updated = [...workerRoles, newWorkerRole.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "worker_roles" });
    const data = { setting_key: "worker_roles", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setWorkerRoles(updated);
    setNewWorkerRole("");
  };

  const handleRemoveWorkerRole = async (role) => {
    const updated = workerRoles.filter(r => r !== role);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "worker_roles" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setWorkerRoles(updated);
  };

  const handleAddShiftStatus = async () => {
    if (!newShiftStatus.trim()) return;
    const updated = [...shiftStatuses, newShiftStatus.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "shift_statuses" });
    const data = { setting_key: "shift_statuses", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setShiftStatuses(updated);
    setNewShiftStatus("");
  };

  const handleRemoveShiftStatus = async (status) => {
    const updated = shiftStatuses.filter(s => s !== status);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "shift_statuses" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setShiftStatuses(updated);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">הגדרות</h1>
          <p className="text-gray-600" dir="rtl">הגדר הגדרות כלל מערכת</p>
        </div>

        {/* Unified Schedule Columns */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Columns className="w-5 h-5 text-green-600" />עמודות לוח ודוחות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4" dir="rtl">
              הגדר עמודות שיופיעו בלוח ובדוחות. לכל עמודה קבע כיצד לסכם את הנתונים בדוחות.
            </p>
            {/* Add new column */}
            <div className="flex gap-2 mb-4" dir="rtl">
              <Input value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="שם עמודה חדשה..." dir="rtl" className="flex-1" />
              <Select value={newColReportType} onValueChange={setNewColReportType}>
                <SelectTrigger className="w-56" dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="sum_numbers">
                    <div dir="rtl">
                      <div className="font-medium">סיכום מספרים</div>
                      <div className="text-xs text-gray-500">מסכם ערכים מספריים שהוזנו בתאים (כמויות, כמו מנות)</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="sum_hours">
                    <div dir="rtl">
                      <div className="font-medium">סיכום שעות לפי טקסט</div>
                      <div className="text-xs text-gray-500">סופר שעות עבודה של עובדים לפי ערך טקסטואלי מוגדר (למשל "נוכח")</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="count_by_text">
                    <div dir="rtl">
                      <div className="font-medium">סיכום פעמים לפי טקסט</div>
                      <div className="text-xs text-gray-500">סופר כמה פעמים עובד עשה משמרת עם טקסט מוגדר בעמודה (למשל ספירת מספר משמרות עם "ויש")</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddScheduleColumn}><Plus className="w-4 h-4" /></Button>
            </div>

            {/* Column list */}
            <div className="space-y-2">
              {scheduleColumns.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו עמודות</p>}
              {scheduleColumns.map((col, idx) => (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50" dir="rtl">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{col.name}</span>
                      <Badge variant="outline" className={`text-xs ${
                        col.report_type === "sum_hours" ? "border-purple-300 text-purple-700" :
                        col.report_type === "count_by_text" ? "border-green-300 text-green-700" :
                        "border-blue-300 text-blue-700"
                      }`}>
                        {col.report_type === "sum_hours" ? "סיכום שעות לפי טקסט" : col.report_type === "count_by_text" ? "סיכום פעמים לפי טקסט" : "סיכום מספרים"}
                      </Badge>
                      {(col.options || []).length > 0 && (
                        <span className="text-xs text-gray-500">{col.options.length} אפשרויות</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        {expandedCol === idx ? "סגור" : "אפשרויות"}
                      </button>
                      <button onClick={() => handleRemoveScheduleColumn(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {expandedCol === idx && (
                   <div className="p-3 border-t space-y-4" dir="rtl">
                     {/* Input mode toggle */}
                     <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                       <div>
                         <p className="text-xs font-semibold text-gray-700">מצב הזנה</p>
                         <p className="text-xs text-gray-500">{col.free_text ? "טקסט חופשי — כל ערך שיוזן ישמש לסינון" : "אפשרויות בלבד — חובה לבחור מהרשימה"}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-gray-500">{col.free_text ? "חופשי" : "מוגבל"}</span>
                         <Switch
                           checked={!!col.free_text}
                           onCheckedChange={async (val) => {
                             const updated = scheduleColumns.map((c, i) => i === idx ? { ...c, free_text: val } : c);
                             await saveScheduleColumns(updated);
                           }}
                         />
                       </div>
                     </div>
                     {/* Preset options */}
                     <div>
                       <p className="text-xs font-semibold text-gray-600 mb-1">{col.free_text ? "אפשרויות מוכנות מראש (לא חובה)" : "אפשרויות מוכנות מראש לבחירה בלוח"}</p>
                       <p className="text-xs text-gray-400 mb-2">כל אפשרות מגדירה ערך לבחירה בתא ואת הקריטריון לספירת שעות בדוחות</p>
                       <div className="flex gap-2 mb-2">
                         <Input
                           value={newSubOptionName}
                           onChange={e => setNewSubOptionName(e.target.value)}
                           placeholder="שם אפשרות..."
                           className="h-7 text-sm flex-1"
                           dir="rtl"
                         />
                         <Button size="sm" className="h-7" onClick={() => handleAddSubOption(idx)}><Plus className="w-3 h-3" /></Button>
                       </div>
                       <div className="space-y-1">
                         {(col.sub_options || []).map((so, si) => (
                          <div key={si} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1 text-xs">
                             <span className="font-medium">{so.name}</span>
                             <div className="flex items-center gap-2">
                               <Badge variant="outline" className="text-xs">{so.criterion}</Badge>
                               <button onClick={() => handleRemoveSubOption(idx, si)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                             </div>
                           </div>
                         ))}
                         {(col.sub_options || []).length === 0 && <p className="text-xs text-gray-400">לא הוגדרו אפשרויות</p>}
                       </div>
                     </div>
                   </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Worker Roles */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Users className="w-5 h-5 text-indigo-600" />תפקידי עובדים</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר תפקידים שניתן לבחור בהם בעת הוספת/עריכת עובדים</p>
            <div className="flex gap-2 mb-4">
              <Input value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} placeholder="שם תפקיד חדש..." dir="rtl" />
              <Button onClick={handleAddWorkerRole}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {workerRoles.map(role => (
                <Badge key={role} className="bg-indigo-100 text-indigo-800 pr-1">
                  {role}
                  <button onClick={() => handleRemoveWorkerRole(role)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {workerRoles.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו תפקידים</p>}
            </div>
          </CardContent>
        </Card>

        {/* Shift Statuses */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><SettingsIcon className="w-5 h-5 text-teal-600" />סטטוסי משמרות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר סטטוסים שניתן להקצות למשמרות בלוח</p>
            <div className="flex gap-2 mb-4">
              <Input value={newShiftStatus} onChange={(e) => setNewShiftStatus(e.target.value)} placeholder="שם סטטוס חדש..." dir="rtl" />
              <Button onClick={handleAddShiftStatus}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shiftStatuses.map(status => (
                <Badge key={status} className="bg-teal-100 text-teal-800 pr-1">
                  {status}
                  <button onClick={() => handleRemoveShiftStatus(status)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {shiftStatuses.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו סטטוסים</p>}
            </div>
          </CardContent>
        </Card>

        {/* Worker Populations */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Users className="w-5 h-5 text-orange-600" />אוכלוסיות עובדים</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר אוכלוסיות שניתן לבחור בהן בעת הוספת/עריכת עובדים</p>
            <div className="flex gap-2 mb-4">
              <Input value={newPopulation} onChange={(e) => setNewPopulation(e.target.value)} placeholder="שם אוכלוסייה חדשה..." dir="rtl" />
              <Button onClick={handleAddPopulation}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {populations.map(pop => (
                <Badge key={pop} className="bg-orange-100 text-orange-800 pr-1">
                  {pop}
                  <button onClick={() => handleRemovePopulation(pop)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {populations.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו אוכלוסיות</p>}
            </div>
          </CardContent>
        </Card>

        {/* User Roles */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Users className="w-5 h-5 text-blue-600" />ניהול תפקידי משתמש</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700" dir="rtl"><strong>מנהל:</strong> גישה מלאה<br /><strong>משתמש:</strong> זמינות בלבד</p>
              </div>
              <div className="space-y-3">
                {workers.filter(w => w.email).map((worker) => (
                  <div key={worker.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{worker.nickname}</p>
                      <p className="text-sm text-gray-600">{worker.email}</p>
                    </div>
                    <Select value={userRoles[worker.email] || "user"} onValueChange={(value) => handleRoleChange(worker.email, value)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user" dir="rtl">משתמש</SelectItem>
                        <SelectItem value="manager" dir="rtl">מנהל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveRoles} disabled={saving} className="bg-blue-900 hover:bg-blue-800" dir="rtl">
                <Save className="w-4 h-4 mr-2" />{saving ? "שומר..." : "שמור תפקידי משתמש"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Types Management - Removed as requested */}

        {/* Tips & Policy */}
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Info className="w-5 h-5 text-blue-600" />טיפים ומדיניות זמינות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div><Label dir="rtl">הצג כחלון קופץ לאישור</Label><p className="text-xs text-gray-600" dir="rtl">הצג טיפים בחלון קופץ</p></div>
                <Switch checked={showTipsAsPopup} onCheckedChange={setShowTipsAsPopup} />
              </div>
              <div><Label htmlFor="tips" dir="rtl">הודעה לעובדים</Label><Textarea id="tips" value={tipsMessage} onChange={(e) => setTipsMessage(e.target.value)} placeholder="הזן טיפים..." rows={10} className="font-mono text-sm mt-2" dir="rtl" /></div>
              <Button onClick={handleSaveTips} disabled={saving} className="bg-blue-900 hover:bg-blue-800" dir="rtl"><Save className="w-4 h-4 mr-2" />{saving ? "שומר..." : "שמור טיפים"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
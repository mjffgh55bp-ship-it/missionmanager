import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Info, Users, X, Plus, PartyPopper, Trash2, Clock, Hash, Columns } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
  const [tipsMessage, setTipsMessage] = useState("");
  const [showTipsAsPopup, setShowTipsAsPopup] = useState(false);
  const [userRoles, setUserRoles] = useState({});
  const [workers, setWorkers] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [timeParamTypes, setTimeParamTypes] = useState([]);
  const [countParamTypes, setCountParamTypes] = useState([]);
  const [newTimeType, setNewTimeType] = useState("");
  const [newCountType, setNewCountType] = useState("");
  const [paramSubTypes, setParamSubTypes] = useState({});
  const [selectedTypeForSubType, setSelectedTypeForSubType] = useState("");
  const [newSubType, setNewSubType] = useState("");
  // Schedule column types
  const [columnTypes, setColumnTypes] = useState([]);
  const [columnSubTypes, setColumnSubTypes] = useState({});
  const [newColumnType, setNewColumnType] = useState("");
  const [selectedColTypeForSubType, setSelectedColTypeForSubType] = useState("");
  const [newColSubType, setNewColSubType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const [tipsSettings, rolesSettings, workersData, eventsData, timeTypesSettings, countTypesSettings, subTypesSettings, colTypesSettings, colSubTypesSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "availability_tips" }),
      base44.entities.AppSettings.filter({ setting_key: "user_roles" }),
      base44.entities.Worker.list(),
      base44.entities.CompanyEvent.list("-date"),
      base44.entities.AppSettings.filter({ setting_key: "time_param_types" }),
      base44.entities.AppSettings.filter({ setting_key: "count_param_types" }),
      base44.entities.AppSettings.filter({ setting_key: "param_sub_types" }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_types" }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" })
    ]);
    
    if (tipsSettings.length > 0) {
      const tipsData = JSON.parse(tipsSettings[0].setting_value);
      setTipsMessage(tipsData.message || "");
      setShowTipsAsPopup(tipsData.showAsPopup || false);
    }
    if (rolesSettings.length > 0) setUserRoles(JSON.parse(rolesSettings[0].setting_value));
    if (timeTypesSettings.length > 0) setTimeParamTypes(JSON.parse(timeTypesSettings[0].setting_value) || []);
    if (countTypesSettings.length > 0) setCountParamTypes(JSON.parse(countTypesSettings[0].setting_value) || []);
    if (subTypesSettings.length > 0) setParamSubTypes(JSON.parse(subTypesSettings[0].setting_value) || {});
    if (colTypesSettings.length > 0) setColumnTypes(JSON.parse(colTypesSettings[0].setting_value) || []);
    if (colSubTypesSettings.length > 0) setColumnSubTypes(JSON.parse(colSubTypesSettings[0].setting_value) || {});
    setWorkers(workersData);
    setCompanyEvents(eventsData);
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

  // Time/Count param types handlers
  const handleAddTimeType = async () => {
    if (!newTimeType.trim()) return;
    const updated = [...timeParamTypes, newTimeType.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "time_param_types" });
    const data = { setting_key: "time_param_types", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTimeParamTypes(updated);
    setNewTimeType("");
  };

  const handleRemoveTimeType = async (type) => {
    const updated = timeParamTypes.filter(t => t !== type);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "time_param_types" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setTimeParamTypes(updated);
  };

  const handleAddCountType = async () => {
    if (!newCountType.trim()) return;
    const updated = [...countParamTypes, newCountType.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "count_param_types" });
    const data = { setting_key: "count_param_types", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setCountParamTypes(updated);
    setNewCountType("");
  };

  const handleRemoveCountType = async (type) => {
    const updated = countParamTypes.filter(t => t !== type);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "count_param_types" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setCountParamTypes(updated);
  };

  const handleAddSubType = async () => {
    if (!selectedTypeForSubType || !newSubType.trim()) return;
    const updated = { ...paramSubTypes, [selectedTypeForSubType]: [...(paramSubTypes[selectedTypeForSubType] || []), newSubType.trim()] };
    const settings = await base44.entities.AppSettings.filter({ setting_key: "param_sub_types" });
    const data = { setting_key: "param_sub_types", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setParamSubTypes(updated);
    setNewSubType("");
  };

  const handleRemoveSubType = async (type, subType) => {
    const updated = { ...paramSubTypes, [type]: (paramSubTypes[type] || []).filter(st => st !== subType) };
    const settings = await base44.entities.AppSettings.filter({ setting_key: "param_sub_types" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setParamSubTypes(updated);
  };

  // Schedule column types handlers
  const handleAddColumnType = async () => {
    if (!newColumnType.trim()) return;
    const updated = [...columnTypes, newColumnType.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "schedule_column_types" });
    const data = { setting_key: "schedule_column_types", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setColumnTypes(updated);
    setNewColumnType("");
  };

  const handleRemoveColumnType = async (type) => {
    const updated = columnTypes.filter(t => t !== type);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "schedule_column_types" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setColumnTypes(updated);
  };

  const handleAddColSubType = async () => {
    if (!selectedColTypeForSubType || !newColSubType.trim()) return;
    const updated = { ...columnSubTypes, [selectedColTypeForSubType]: [...(columnSubTypes[selectedColTypeForSubType] || []), newColSubType.trim()] };
    const settings = await base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" });
    const data = { setting_key: "schedule_column_subtypes", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setColumnSubTypes(updated);
    setNewColSubType("");
  };

  const handleRemoveColSubType = async (type, subType) => {
    const updated = { ...columnSubTypes, [type]: (columnSubTypes[type] || []).filter(st => st !== subType) };
    const settings = await base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    setColumnSubTypes(updated);
  };

  const handleDeleteEvent = async (eventId) => {
    await base44.entities.CompanyEvent.delete(eventId);
    loadSettings();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">הגדרות</h1>
          <p className="text-gray-600" dir="rtl">הגדר הגדרות כלל מערכת</p>
        </div>

        {/* Schedule Column Types */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Columns className="w-5 h-5 text-green-600" />סוגי עמודות בלוח התורים</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3" dir="rtl">הגדר סוגי עמודות שניתן להוסיף לעגלות בעמוד לוח התורים</p>
            <div className="flex gap-2 mb-4">
              <Input value={newColumnType} onChange={(e) => setNewColumnType(e.target.value)} placeholder="שם סוג עמודה חדש..." dir="rtl" />
              <Button onClick={handleAddColumnType}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {columnTypes.map(type => (
                <Badge key={type} className="bg-green-100 text-green-800 pr-1">
                  {type}
                  <button onClick={() => handleRemoveColumnType(type)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {columnTypes.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו סוגי עמודות</p>}
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm font-semibold mb-3" dir="rtl">תתי-סוגי עמודות (לכל סוג עמודה)</p>
              <div className="flex gap-2 mb-4">
                <Select value={selectedColTypeForSubType} onValueChange={setSelectedColTypeForSubType}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {columnTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={newColSubType} onChange={(e) => setNewColSubType(e.target.value)} placeholder="תת-סוג חדש..." className="flex-1" dir="rtl" />
                <Button onClick={handleAddColSubType} disabled={!selectedColTypeForSubType}><Plus className="w-4 h-4" /></Button>
              </div>
              {Object.entries(columnSubTypes).filter(([_, subs]) => subs.length > 0).map(([type, subs]) => (
                <div key={type} className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">{type}:</p>
                  <div className="flex flex-wrap gap-1">
                    {subs.map(sub => (
                      <Badge key={sub} variant="outline" className="text-xs pr-1">
                        {sub}
                        <button onClick={() => handleRemoveColSubType(type, sub)} className="ml-1 hover:text-red-600"><X className="w-2 h-2" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Parameter Types */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><Clock className="w-5 h-5 text-purple-600" />סוגי פרמטרים (דוחות)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="time" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="time" dir="rtl"><Clock className="w-3 h-3 mr-1" />סוגי זמן</TabsTrigger>
                <TabsTrigger value="count" dir="rtl"><Hash className="w-3 h-3 mr-1" />סוגי ספירה</TabsTrigger>
              </TabsList>
              <TabsContent value="time" className="mt-4">
                <p className="text-sm text-gray-600 mb-3" dir="rtl">פרמטרי זמן מסכמים שעות עבודה תחת כל סוג</p>
                <div className="flex gap-2 mb-4">
                  <Input value={newTimeType} onChange={(e) => setNewTimeType(e.target.value)} placeholder="שם סוג זמן חדש..." dir="rtl" />
                  <Button onClick={handleAddTimeType}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {timeParamTypes.map(type => (
                    <Badge key={type} className="bg-purple-100 text-purple-800 pr-1">
                      {type}
                      <button onClick={() => handleRemoveTimeType(type)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                  {timeParamTypes.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו סוגי זמן</p>}
                </div>
              </TabsContent>
              <TabsContent value="count" className="mt-4">
                <p className="text-sm text-gray-600 mb-3" dir="rtl">פרמטרי ספירה מסכמים ערכים מספריים תחת כל סוג</p>
                <div className="flex gap-2 mb-4">
                  <Input value={newCountType} onChange={(e) => setNewCountType(e.target.value)} placeholder="שם סוג ספירה חדש..." dir="rtl" />
                  <Button onClick={handleAddCountType}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {countParamTypes.map(type => (
                    <Badge key={type} className="bg-blue-100 text-blue-800 pr-1">
                      {type}
                      <button onClick={() => handleRemoveCountType(type)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                  {countParamTypes.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו סוגי ספירה</p>}
                </div>
              </TabsContent>
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-semibold mb-3" dir="rtl">תתי-סוגים (לכל סוג פרמטר)</p>
                <div className="flex gap-2 mb-4">
                  <Select value={selectedTypeForSubType} onValueChange={setSelectedTypeForSubType}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {[...timeParamTypes, ...countParamTypes].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={newSubType} onChange={(e) => setNewSubType(e.target.value)} placeholder="תת-סוג חדש..." className="flex-1" dir="rtl" />
                  <Button onClick={handleAddSubType} disabled={!selectedTypeForSubType}><Plus className="w-4 h-4" /></Button>
                </div>
                {Object.entries(paramSubTypes).filter(([_, subs]) => subs.length > 0).map(([type, subs]) => (
                  <div key={type} className="mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">{type}:</p>
                    <div className="flex flex-wrap gap-1">
                      {subs.map(sub => (
                        <Badge key={sub} variant="outline" className="text-xs pr-1">
                          {sub}
                          <button onClick={() => handleRemoveSubType(type, sub)} className="ml-1 hover:text-red-600"><X className="w-2 h-2" /></button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Tabs>
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
                      <p className="font-medium text-gray-900">{worker.full_name}</p>
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

        {/* Company Events (View Only) */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2" dir="rtl"><PartyPopper className="w-5 h-5 text-purple-600" />אירועי חברה</CardTitle>
              <p className="text-sm text-gray-500" dir="rtl">הוסף אירועים מהעמוד השנתי</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {companyEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4" dir="rtl">אין אירועים מתוכננים</p>
            ) : (
              <div className="space-y-3">
                {companyEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-600">{format(new Date(event.date), "EEEE, MMM d, yyyy")}{!event.all_day && ` • ${event.start_time} - ${event.end_time}`}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Save, Search, ChevronDown, Check, Camera, User, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [userRoles, setUserRoles] = useState({});
  const [savingRoles, setSavingRoles] = useState(false);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskQualifications, setTaskQualifications] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    nickname: "",
    birthday: "",
    role: [],
    phone: "",
    email: "",
    hire_date: format(new Date(), "yyyy-MM-dd"),
    active: true,
    population: "",
    training: "",
    photo_url: ""
  });

  const loadingRef = useRef(false);
  const taskQualSettingIdRef = useRef(null);

  useEffect(() => {
    // Small delay to avoid firing simultaneously with other pages on initial mount
    const timer = setTimeout(() => { loadData(); }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Reload workers when the tab regains focus (e.g., after editing roles in Settings)
  useEffect(() => {
    const handleFocus = () => { loadWorkers(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadWorkers = async () => {
    const [workersData, allSettings] = await Promise.all([
      base44.entities.Worker.list("-created_date"),
      base44.entities.AppSettings.list(),
    ]);
    setWorkers(workersData);

    const getSetting = (key) => allSettings.find(s => s.setting_key === key);
    const workerRolesSettings = getSetting("worker_roles");
    const tasksSettings = getSetting("tasks_list");
    const taskQualSettings = getSetting("task_qualifications");
    const rawRoles = workerRolesSettings ? (JSON.parse(workerRolesSettings.setting_value) || []) : ["שף", "סו-שף"];
    setWorkerRoles(rawRoles.map(r => (typeof r === "string" ? r : r.name)));
    if (tasksSettings) setTasks(JSON.parse(tasksSettings.setting_value) || []);
    if (taskQualSettings) setTaskQualifications(JSON.parse(taskQualSettings.setting_value) || {});
  };

  const loadData = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [workersData, allSettings] = await Promise.all([
        base44.entities.Worker.list("-created_date"),
        base44.entities.AppSettings.list(),
      ]);

      setWorkers(workersData);

      const getSetting = (key) => allSettings.find(s => s.setting_key === key);

      const rolesSettings = getSetting("user_roles");
      const populationsSettings = getSetting("worker_populations");
      const workerRolesSettings = getSetting("worker_roles");
      const tasksSettings = getSetting("tasks_list");
      const taskQualSettings = getSetting("task_qualifications");

      if (rolesSettings) setUserRoles(JSON.parse(rolesSettings.setting_value));
      const rawPops = populationsSettings ? (JSON.parse(populationsSettings.setting_value) || []) : ["מנהל", "קבוע בכיר", "קבוע", "קבלן בכיר", "קבלן", "קבלן מיוחד", "ותיק"];
      setPopulations(rawPops.map(p => (typeof p === "string" ? p : p.name)));
      const rawRoles = workerRolesSettings ? (JSON.parse(workerRolesSettings.setting_value) || []) : ["שף", "סו-שף"];
      setWorkerRoles(rawRoles.map(r => (typeof r === "string" ? r : r.name)));
      if (tasksSettings) setTasks(JSON.parse(tasksSettings.setting_value) || []);
      if (taskQualSettings) {
        taskQualSettingIdRef.current = taskQualSettings.id;
        setTaskQualifications(JSON.parse(taskQualSettings.setting_value) || {});
      }
    } finally {
      loadingRef.current = false;
    }
  };

  const handleToggleTaskQualification = async (taskName, role, workerId) => {
    const taskRoles = taskQualifications[taskName] || {};
    const current = taskRoles[role] || [];
    const updatedRole = current.includes(workerId)
      ? current.filter(id => id !== workerId)
      : [...current, workerId];
    const updated = { ...taskQualifications, [taskName]: { ...taskRoles, [role]: updatedRole } };
    setTaskQualifications(updated);
    const data = { setting_key: "task_qualifications", setting_value: JSON.stringify(updated) };
    if (taskQualSettingIdRef.current) {
      await base44.entities.AppSettings.update(taskQualSettingIdRef.current, data);
    } else {
      const created = await base44.entities.AppSettings.create(data);
      taskQualSettingIdRef.current = created.id;
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, photo_url: file_url }));
  };

  const handleSubmit = async () => {
    if (editingWorker) await base44.entities.Worker.update(editingWorker.id, formData);
    else await base44.entities.Worker.create(formData);
    setShowDialog(false);
    setEditingWorker(null);
    setFormData({ nickname: "", birthday: "", role: [], phone: "", email: "", hire_date: format(new Date(), "yyyy-MM-dd"), active: true, population: "", training: "", photo_url: "" });
    loadWorkers();
  };

  const handleEdit = (worker) => {
    setEditingWorker(worker);
    setFormData({
      nickname: worker.nickname || "",
      birthday: worker.birthday || "",
      role: Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : []),
      phone: worker.phone || "",
      email: worker.email || "",
      hire_date: worker.hire_date || format(new Date(), "yyyy-MM-dd"),
      active: worker.active,
      population: worker.population || "",
      training: worker.training || "",
      photo_url: worker.photo_url || ""
    });
    setShowDialog(true);
  };

  const toggleActive = async (worker) => {
    await base44.entities.Worker.update(worker.id, { 
      nickname: worker.nickname,
      role: worker.role,
      active: !worker.active 
    });
    loadWorkers();
  };



  const handleDeleteWorker = async (workerId) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק עובד זה?")) return;
    await base44.entities.Worker.delete(workerId);
    loadWorkers();
  };



  const handleRoleChange = (email, role) => {
    if (!email) return;
    setUserRoles({ ...userRoles, [email]: role });
  };

  const saveUserRoles = async () => {
    setSavingRoles(true);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
    const data = { setting_key: "user_roles", setting_value: JSON.stringify(userRoles) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setSavingRoles(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="חפש לפי שם, תפקיד, אוכלוסיה או כשירות..." 
                className="pr-10"
                dir="rtl" 
              />
            </div>
            <Button onClick={() => setShowDialog(true)} className="bg-blue-900 hover:bg-blue-800 text-white px-6" dir="rtl">
              <Plus className="w-4 h-4 mr-2" />הוסף עובד
            </Button>
          </div>
        </div>

        <Tabs defaultValue="workers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="workers" className="gap-2"><Users className="w-4 h-4" />עובדים</TabsTrigger>
            <TabsTrigger value="roles" className="gap-2"><Users className="w-4 h-4" />תפקידי משתמשים</TabsTrigger>
          </TabsList>

          <TabsContent value="workers">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workers.filter(worker => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return (
                  worker.nickname?.toLowerCase().includes(query) ||
                  (Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : [])).some(r => r?.toLowerCase().includes(query)) ||
                  worker.population?.toLowerCase().includes(query) ||
                  worker.training?.toLowerCase().includes(query) ||
                  worker.email?.toLowerCase().includes(query)
                );
              }).map((worker) => {
            return (
              <Card key={worker.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b bg-white">
                  <div className="flex items-center gap-3" dir="rtl">
                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 shrink-0">
                      {worker.photo_url
                        ? <img src={worker.photo_url} alt={worker.nickname} className="w-full h-full object-cover" />
                        : <User className="w-6 h-6 text-gray-500" />}
                    </div>
                    <div className="flex-1 text-right">
                      <CardTitle className="text-lg">{worker.nickname}</CardTitle>
                      <div className="flex gap-2 mt-1 flex-wrap justify-end">
                        {(Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : [])).map(r => (
                          <Badge key={r} className="bg-blue-100 text-blue-900">{r}</Badge>
                        ))}
                        {!(Array.isArray(worker.role) ? worker.role.length : worker.role) && <Badge className="bg-blue-100 text-blue-900">לא הוגדר</Badge>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* פרטים אישיים */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2" dir="rtl">פרטים אישיים</h4>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700" dir="rtl">👤 כינוי: {worker.nickname}</p>
                        {worker.birthday && <p className="text-sm text-gray-700" dir="rtl">🎂 יום הולדת: {format(new Date(worker.birthday), "dd/MM/yyyy")}</p>}
                        {worker.hire_date && <p className="text-sm text-gray-700" dir="rtl">📅 תאריך גיוס: {format(new Date(worker.hire_date), "dd/MM/yyyy")}</p>}
                        {worker.training && <p className="text-sm text-gray-700" dir="rtl">🎓 קורס: {worker.training}</p>}
                      </div>
                    </div>

                    {/* כשירות */}
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-sm font-semibold text-green-900 mb-2" dir="rtl">כשירות</h4>
                      <div className="space-y-1">
                        {worker.population && <p className="text-sm text-gray-700" dir="rtl">👥 אוכלוסיה: {worker.population}</p>}
                        <p className="text-sm text-gray-700" dir="rtl">👤 תפקיד: {(Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : [])).join(', ') || 'לא הוגדר'}</p>
                      </div>
                    </div>

                    {/* פרטי קשר */}
                    {(worker.email || worker.phone) && (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2" dir="rtl">פרטי קשר</h4>
                        <div className="space-y-1">
                          {worker.email && <p className="text-sm text-gray-700" dir="rtl">📧 {worker.email}</p>}
                          {worker.phone && <p className="text-sm text-gray-700" dir="rtl">📞 {worker.phone}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(worker)} dir="rtl"><Pencil className="w-3 h-3 mr-2" />ערוך</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
            </div>

            {workers.length === 0 && (
          <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2" dir="rtl">עדיין אין עובדים</h3>
              <p className="text-gray-600 mb-6" dir="rtl">התחל בהוספת חבר הצוות הראשון שלך</p>
              <Button onClick={() => setShowDialog(true)} className="bg-blue-900 hover:bg-blue-800" dir="rtl"><Plus className="w-4 h-4 mr-2" />הוסף עובד ראשון</Button>
            </CardContent>
          </Card>
            )}
          </TabsContent>

          <TabsContent value="roles">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" />ניהול תפקידי משתמש</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700" dir="rtl"><strong>מנהל:</strong> גישה מלאה לכל התכונות<br /><strong>משתמש:</strong> גישה לזמינות בלבד</p>
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
                  <Button onClick={saveUserRoles} disabled={savingRoles} className="bg-blue-900 hover:bg-blue-800 gap-2" dir="rtl">
                    <Save className="w-4 h-4" />{savingRoles ? "שומר..." : "שמור תפקידי משתמש"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Worker Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-right w-full" dir="rtl">{editingWorker ? "ערוך עובד" : "הוסף עובד חדש"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto" dir="rtl">

              {/* תמונה */}
              <div className="flex flex-col items-center gap-2">
                <label className="cursor-pointer group relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400 transition-colors">
                    {formData.photo_url
                      ? <img src={formData.photo_url} alt="תמונה" className="w-full h-full object-cover" />
                      : <User className="w-10 h-10 text-gray-400" />}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                {formData.photo_url && (
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, photo_url: "" }))}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1" dir="rtl">
                    <X className="w-3 h-3" />הסר תמונה
                  </button>
                )}
              </div>
              
              {/* פרטים אישיים */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-3 text-right" dir="rtl">פרטים אישיים</h4>
                <div className="space-y-2" dir="rtl">
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">כינוי *</Label>
                    <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="כינוי" dir="rtl" className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">יום הולדת</Label>
                    <Input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">תאריך גיוס</Label>
                    <Input type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">קורס</Label>
                    <Select value={formData.training} onValueChange={(value) => setFormData({ ...formData, training: value })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="בחר מספר קורס..." /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 100 }, (_, i) => String(i + 1)).map(num => (
                          <SelectItem key={num} value={num}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* כשירות */}
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-900 mb-3 text-right" dir="rtl">כשירות</h4>
                <div className="space-y-2" dir="rtl">
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">אוכלוסייה</Label>
                    <Select value={formData.population} onValueChange={(value) => setFormData({ ...formData, population: value })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="בחר אוכלוסייה..." /></SelectTrigger>
                      <SelectContent>
                        {populations.map(pop => (
                          <SelectItem key={pop} value={pop}>{pop}</SelectItem>
                        ))}
                        {populations.length === 0 && <SelectItem value="none" disabled>לא הוגדרו אוכלוסיות</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-start gap-2">
                    <Label className="w-28 text-right shrink-0 mt-2" dir="rtl">תפקיד *</Label>
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 transition-colors" dir="rtl">
                            <span className="text-gray-500">{formData.role.length === 0 ? "בחר תפקידים..." : "תפקידים נבחרו"}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="start">
                          {workerRoles.length === 0 && <p className="text-sm text-gray-500 px-2 py-1">לא הוגדרו תפקידים</p>}
                          {workerRoles.map(role => {
                            const selected = formData.role.includes(role);
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  const newRoles = selected
                                    ? formData.role.filter(r => r !== role)
                                    : [...formData.role, role];
                                  setFormData({ ...formData, role: newRoles });
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-right"
                                dir="rtl"
                              >
                                <Check className={`w-4 h-4 shrink-0 ${selected ? 'text-blue-600' : 'text-transparent'}`} />
                                {role}
                              </button>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                      {formData.role.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2" dir="rtl">
                          {formData.role.map(r => (
                            <Badge key={r} className="bg-blue-100 text-blue-800 text-xs">{r}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* כשירויות למשימות */}
              {editingWorker && tasks.length > 0 && formData.role.length > 0 && (
                <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                  <h4 className="text-sm font-semibold text-violet-900 mb-3 text-right" dir="rtl">כשירות למשימות</h4>
                  <div className="space-y-2" dir="rtl">
                    {formData.role.map(role => (
                      <div key={role} className="flex items-start gap-2">
                        <Label className="w-28 text-right shrink-0 mt-2 text-xs font-semibold text-gray-700" dir="rtl">{role}</Label>
                        <div className="flex-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 transition-colors" dir="rtl">
                                <span className="text-gray-500">בחר משימות...</span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="start">
                              {tasks.map(task => {
                                const qualified = ((taskQualifications[task] || {})[role] || []).includes(editingWorker.id);
                                return (
                                  <button
                                    key={task}
                                    type="button"
                                    onClick={() => handleToggleTaskQualification(task, role, editingWorker.id)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-right"
                                    dir="rtl"
                                  >
                                    <Check className={`w-4 h-4 shrink-0 ${qualified ? 'text-violet-600' : 'text-transparent'}`} />
                                    {task}
                                  </button>
                                );
                              })}
                            </PopoverContent>
                          </Popover>
                          {(() => {
                            const qualTasks = tasks.filter(task => ((taskQualifications[task] || {})[role] || []).includes(editingWorker.id));
                            return qualTasks.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-2" dir="rtl">
                                {qualTasks.map(t => (
                                  <Badge key={t} className="bg-violet-100 text-violet-800 text-xs">{t}</Badge>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* פרטי קשר */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3" dir="rtl">פרטי קשר</h4>
                <div className="space-y-2" dir="rtl">
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">אימייל</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@mail.com" dir="rtl" className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-28 text-right shrink-0" dir="rtl">טלפון</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="05x-xxxxxxx" dir="rtl" className="flex-1" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter dir="rtl" className="flex-row-reverse sm:flex-row-reverse gap-2">
              {editingWorker && (
                <Button variant="destructive" onClick={() => handleDeleteWorker(editingWorker.id)} dir="rtl">
                  <Trash2 className="w-3 h-3 ml-2" />מחק עובד
                </Button>
              )}
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingWorker(null); }} dir="rtl">ביטול</Button>
              <Button onClick={handleSubmit} disabled={!formData.nickname || formData.role.length === 0} className="bg-blue-900 hover:bg-blue-800" dir="rtl">{editingWorker ? "עדכן" : "הוסף"} עובד</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
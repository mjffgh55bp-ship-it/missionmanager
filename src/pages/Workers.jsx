import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserX, UserCheck, ChefHat, TrendingUp, Award, Trash2, Users, Save, Search } from "lucide-react";
import { format } from "date-fns";
import { getSeniorityInfo, calculateProgression } from "../components/utils/SeniorityUtils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
    is_guide: false,
    active: true,
    population: "",
    training: ""
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Batch 1: workers + settings (no heavy lists)
    const [workersData, rolesSettings, populationsSettings, workerRolesSettings, tasksSettings, taskQualSettings] = await Promise.all([
      base44.entities.Worker.list("-created_date"),
      base44.entities.AppSettings.filter({ setting_key: "user_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "tasks_list" }),
      base44.entities.AppSettings.filter({ setting_key: "task_qualifications" })
    ]);
    // Batch 2: assignments separately to avoid rate limit
    const assignmentsData = await base44.entities.Assignment.list();
    setWorkers(workersData);
    setAssignments(assignmentsData);
    if (rolesSettings.length > 0) {
      setUserRoles(JSON.parse(rolesSettings[0].setting_value));
    }
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
    if (tasksSettings.length > 0) setTasks(JSON.parse(tasksSettings[0].setting_value) || []);
    if (taskQualSettings.length > 0) setTaskQualifications(JSON.parse(taskQualSettings[0].setting_value) || {});
  };

  const handleToggleTaskQualification = async (taskName, role, workerId) => {
    const taskRoles = taskQualifications[taskName] || {};
    const current = taskRoles[role] || [];
    const updatedRole = current.includes(workerId)
      ? current.filter(id => id !== workerId)
      : [...current, workerId];
    const updated = { ...taskQualifications, [taskName]: { ...taskRoles, [role]: updatedRole } };
    setTaskQualifications(updated);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "task_qualifications" });
    const data = { setting_key: "task_qualifications", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
  };

  const getWorkerTotalHours = (workerId) => {
    return assignments.filter(a => a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId).reduce((sum, a) => sum + (a.hours || 0), 0);
  };

  const handleSubmit = async () => {
    if (editingWorker) await base44.entities.Worker.update(editingWorker.id, formData);
    else await base44.entities.Worker.create(formData);
    setShowDialog(false);
    setEditingWorker(null);
    setFormData({ nickname: "", birthday: "", role: [], phone: "", email: "", hire_date: format(new Date(), "yyyy-MM-dd"), is_guide: false, active: true, population: "", training: "" });
    loadData();
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
      is_guide: worker.is_guide || false,
      active: worker.active,
      population: worker.population || "",
      training: worker.training || ""
    });
    setShowDialog(true);
  };

  const toggleActive = async (worker) => {
    await base44.entities.Worker.update(worker.id, { 
      nickname: worker.nickname,
      role: worker.role,
      active: !worker.active 
    });
    loadData();
  };

  const toggleGuide = async (worker) => {
    await base44.entities.Worker.update(worker.id, { 
      nickname: worker.nickname,
      role: worker.role,
      is_guide: !worker.is_guide 
    });
    loadData();
  };

  const handleDeleteWorker = async (workerId) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק עובד זה?")) return;
    await base44.entities.Worker.delete(workerId);
    loadData();
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
            <TabsTrigger value="workers" className="gap-2"><ChefHat className="w-4 h-4" />עובדים</TabsTrigger>
            <TabsTrigger value="roles" className="gap-2"><Users className="w-4 h-4" />תפקידי משתמשים</TabsTrigger>
          </TabsList>

          <TabsContent value="workers">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workers.filter(worker => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                const seniorityInfo = getSeniorityInfo(worker.seniority);
                return (
                  worker.nickname?.toLowerCase().includes(query) ||
                  worker.role?.toLowerCase().includes(query) ||
                  worker.population?.toLowerCase().includes(query) ||
                  seniorityInfo.label.toLowerCase().includes(query) ||
                  worker.training?.toLowerCase().includes(query) ||
                  worker.email?.toLowerCase().includes(query)
                );
              }).map((worker) => {
            const totalHours = getWorkerTotalHours(worker.id);
            const seniorityInfo = getSeniorityInfo(worker.seniority);
            const progression = calculateProgression(totalHours, worker.seniority);

            return (
              <Card key={worker.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${worker.role === 'chef' ? 'bg-blue-900' : 'bg-amber-500'}`}>
                        <ChefHat className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-right" dir="rtl">{worker.nickname}</CardTitle>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : [])).map(r => (
                            <Badge key={r} className="bg-blue-100 text-blue-900" dir="rtl">{r}</Badge>
                          ))}
                          {!(Array.isArray(worker.role) ? worker.role.length : worker.role) && <Badge className="bg-blue-100 text-blue-900" dir="rtl">לא הוגדר</Badge>}
                          <Badge className={seniorityInfo.color}>{seniorityInfo.label}</Badge>
                          {worker.is_guide && <Badge className="bg-yellow-100 text-yellow-800" dir="rtl"><Award className="w-3 h-3 mr-1" />מדריך</Badge>}
                        </div>
                      </div>
                    </div>
                    <Badge variant={worker.active ? "default" : "secondary"} dir="rtl">{worker.active ? "פעיל" : "לא פעיל"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700" dir="rtl">התקדמות ל-{progression.nextLevel ? getSeniorityInfo(progression.nextLevel).label : 'דרגה מקסימלית'}</span>
                        <span className="text-xs text-gray-600" dir="rtl">{totalHours} שעות סה"כ</span>
                      </div>
                      {progression.nextLevel ? (
                        <>
                          <Progress value={progression.progress} className="h-2 mb-2" />
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <TrendingUp className="w-3 h-3" /><span dir="rtl">{progression.hoursRemaining} שעות עד הדרגה הבאה</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-purple-600 font-medium" dir="rtl">הושגה הוותק המקסימלי! 🎉</p>
                      )}
                    </div>

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
                        <p className="text-sm text-gray-700" dir="rtl">🍳 תפקיד: {(Array.isArray(worker.role) ? worker.role : (worker.role ? [worker.role] : [])).join(', ') || 'לא הוגדר'}</p>
                        <p className="text-sm text-gray-700" dir="rtl">⭐ כשירות: {seniorityInfo.label}</p>
                        <p className="text-sm text-gray-700" dir="rtl">🏆 מדריך: {worker.is_guide ? 'כן' : 'לא'}</p>
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
              <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
            <DialogHeader><DialogTitle dir="rtl">{editingWorker ? "ערוך עובד" : "הוסף עובד חדש"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              
              {/* פרטים אישיים */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-3" dir="rtl">פרטים אישיים</h4>
                <div className="space-y-3">
                  <div><Label htmlFor="nickname" className="block text-right" dir="rtl">כינוי *</Label><Input id="nickname" value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="כינוי" dir="rtl" /></div>
                  <div><Label htmlFor="birthday" className="block text-right" dir="rtl">תאריך יום הולדת</Label><Input id="birthday" type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} /></div>
                  <div><Label htmlFor="hire_date" className="block text-right" dir="rtl">תאריך גיוס</Label><Input id="hire_date" type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} /></div>
                  <div>
                    <Label className="block text-right" dir="rtl">קורס</Label>
                    <Select value={formData.training} onValueChange={(value) => setFormData({ ...formData, training: value })}>
                      <SelectTrigger><SelectValue placeholder="בחר קורס..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="שף">שף</SelectItem>
                        <SelectItem value="שף 2">שף 2</SelectItem>
                        <SelectItem value="סו שף">סו שף</SelectItem>
                        <SelectItem value="מארחת">מארחת</SelectItem>
                        <SelectItem value="מאיישת סידור עבודה">מאיישת סידור עבודה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* כשירות */}
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-900 mb-3" dir="rtl">כשירות</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="block text-right" dir="rtl">אוכלוסייה</Label>
                    <Select value={formData.population} onValueChange={(value) => setFormData({ ...formData, population: value })}>
                      <SelectTrigger><SelectValue placeholder="בחר אוכלוסייה..." /></SelectTrigger>
                      <SelectContent>
                        {populations.map(pop => (
                          <SelectItem key={pop} value={pop}>{pop}</SelectItem>
                        ))}
                        {populations.length === 0 && <SelectItem value={null} disabled>לא הוגדרו אוכלוסיות</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="block text-right" dir="rtl">תפקיד *</Label>
                    <div className="flex flex-wrap gap-2 mt-1" dir="rtl">
                      {workerRoles.map(role => {
                        const selected = formData.role.includes(role);
                        return (
                          <Badge
                            key={role}
                            onClick={() => {
                              const newRoles = selected
                                ? formData.role.filter(r => r !== role)
                                : [...formData.role, role];
                              setFormData({ ...formData, role: newRoles });
                            }}
                            className={`cursor-pointer select-none px-3 py-1 text-sm ${selected ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {role}
                          </Badge>
                        );
                      })}
                      {workerRoles.length === 0 && <span className="text-sm text-gray-500">לא הוגדרו תפקידים</span>}
                    </div>
                  </div>




                </div>
              </div>

              {/* כשירויות למשימות */}
              {editingWorker && tasks.length > 0 && (() => {
                const workerRoleList = Array.isArray(editingWorker.role) ? editingWorker.role : (editingWorker.role ? [editingWorker.role] : []);
                if (workerRoleList.length === 0) return null;
                return (
                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                    <h4 className="text-sm font-semibold text-violet-900 mb-3" dir="rtl">כשירות למשימות</h4>
                    <div className="space-y-3">
                      {workerRoleList.map(role => (
                        <div key={role}>
                          <p className="text-xs font-semibold text-gray-700 mb-1" dir="rtl">{role}</p>
                          <div className="flex flex-wrap gap-2" dir="rtl">
                            {tasks.map(task => {
                              const qualified = ((taskQualifications[task] || {})[role] || []).includes(editingWorker.id);
                              return (
                                <button
                                  key={task}
                                  type="button"
                                  onClick={() => handleToggleTaskQualification(task, role, editingWorker.id)}
                                  className={`px-3 py-1 rounded text-xs border transition-colors ${qualified ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}
                                >
                                  {task}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* פרטי קשר */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3" dir="rtl">פרטי קשר</h4>
                <div className="space-y-3">
                  <div><Label htmlFor="email" className="block text-right" dir="rtl">אימייל</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@mail.com" dir="rtl" /></div>
                  <div><Label htmlFor="phone" className="block text-right" dir="rtl">טלפון</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="05x-xxxxxxx" dir="rtl" /></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              {editingWorker && (
                <>
                  <Button variant="destructive" onClick={() => handleDeleteWorker(editingWorker.id)} dir="rtl">
                    <Trash2 className="w-3 h-3 mr-2" />מחק עובד
                  </Button>
                  <Button variant={editingWorker.active ? "destructive" : "default"} onClick={() => { toggleActive(editingWorker); setShowDialog(false); }} dir="rtl">
                    {editingWorker.active ? <><UserX className="w-3 h-3 mr-2" />השבת</> : <><UserCheck className="w-3 h-3 mr-2" />הפעל</>}
                  </Button>
                </>
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
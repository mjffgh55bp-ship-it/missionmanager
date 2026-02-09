import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserX, UserCheck, ChefHat, TrendingUp, Award, Trash2, Users, Save } from "lucide-react";
import { format } from "date-fns";
import { getSeniorityInfo, calculateProgression } from "../components/utils/SeniorityUtils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [categoryNames, setCategoryNames] = useState({ category_1: "קטגוריה 1", category_2: "קטגוריה 2", category_3: "קטגוריה 3" });
  const [showDialog, setShowDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [userRoles, setUserRoles] = useState({});
  const [savingRoles, setSavingRoles] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    population: "",
    training: "",
    additional_training: "",
    birth_date: "",
    active: true,
    user_role: "user"
  });
  const [tempCategoryNames, setTempCategoryNames] = useState({ category_1: "", category_2: "", category_3: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [workersData, assignmentsData, catSettings, rolesSettings] = await Promise.all([
      base44.entities.Worker.list("-created_date"),
      base44.entities.Assignment.list(),
      base44.entities.AppSettings.filter({ setting_key: "worker_category_names" }),
      base44.entities.AppSettings.filter({ setting_key: "user_roles" })
    ]);
    setWorkers(workersData);
    setAssignments(assignmentsData);
    if (catSettings.length > 0) {
      const names = JSON.parse(catSettings[0].setting_value);
      setCategoryNames(names);
      setTempCategoryNames(names);
    }
    if (rolesSettings.length > 0) {
      setUserRoles(JSON.parse(rolesSettings[0].setting_value));
    }
  };

  const getWorkerTotalHours = (workerId) => {
    return assignments.filter(a => a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId).reduce((sum, a) => sum + (a.hours || 0), 0);
  };

  const handleSubmit = async () => {
    if (editingWorker) {
      await base44.entities.Worker.update(editingWorker.id, formData);
      
      // Update user role
      if (formData.email) {
        const newUserRoles = { ...userRoles, [formData.email]: formData.user_role };
        setUserRoles(newUserRoles);
        const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
        const data = { setting_key: "user_roles", setting_value: JSON.stringify(newUserRoles) };
        if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
        else await base44.entities.AppSettings.create(data);
      }
    } else {
      const newWorker = await base44.entities.Worker.create(formData);
      
      // Set user role
      if (formData.email) {
        const newUserRoles = { ...userRoles, [formData.email]: formData.user_role };
        setUserRoles(newUserRoles);
        const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
        const data = { setting_key: "user_roles", setting_value: JSON.stringify(newUserRoles) };
        if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
        else await base44.entities.AppSettings.create(data);
      }
      
      // Create/Update birthday event if birth_date is provided
      if (formData.birth_date && formData.nickname) {
        const yearlyRows = await base44.entities.YearlyRow.list();
        let birthdayRow = yearlyRows.find(r => r.name === "ימי הולדת");
        
        if (!birthdayRow) {
          birthdayRow = await base44.entities.YearlyRow.create({
            name: "ימי הולדת",
            order: yearlyRows.length,
            color: "#ec4899"
          });
        }
        
        // Get month and day from birth_date
        const birthDate = new Date(formData.birth_date);
        const currentYear = new Date().getFullYear();
        const thisYearBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
        const birthdayStr = format(thisYearBirthday, "yyyy-MM-dd");
        
        await base44.entities.YearlyEvent.create({
          row_id: birthdayRow.id,
          start_date: birthdayStr,
          end_date: birthdayStr,
          title: `יום הולדת ל: ${formData.nickname}`,
          worker_id: newWorker.id,
          worker_name: formData.nickname
        });
      }
    }
    
    setShowDialog(false);
    setEditingWorker(null);
    setFormData({ nickname: "", email: "", population: "", training: "", additional_training: "", birth_date: "", active: true, user_role: "user" });
    loadData();
  };

  const handleEdit = (worker) => {
    setEditingWorker(worker);
    setFormData({
      nickname: worker.nickname || "",
      email: worker.email || "",
      population: worker.population || "",
      training: worker.training || "",
      additional_training: worker.additional_training || "",
      birth_date: worker.birth_date || "",
      active: worker.active,
      user_role: worker.email ? (userRoles[worker.email] || "user") : "user"
    });
    setShowDialog(true);
  };

  const toggleActive = async (worker) => {
    await base44.entities.Worker.update(worker.id, { active: !worker.active });
    loadData();
  };

  const toggleGuide = async (worker) => {
    await base44.entities.Worker.update(worker.id, { is_guide: !worker.is_guide });
    loadData();
  };

  const handleDeleteWorker = async (workerId) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק עובד זה?")) return;
    await base44.entities.Worker.delete(workerId);
    loadData();
  };

  const handleSaveCategoryNames = async () => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "worker_category_names" });
    const data = { setting_key: "worker_category_names", setting_value: JSON.stringify(tempCategoryNames) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setCategoryNames(tempCategoryNames);
    setShowCategoryDialog(false);
  };

  const getCategoryColor = (cat) => {
    if (cat === "category_1") return "bg-blue-100 text-blue-800";
    if (cat === "category_2") return "bg-green-100 text-green-800";
    if (cat === "category_3") return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setTempCategoryNames(categoryNames); setShowCategoryDialog(true); }} dir="rtl">
              ערוך קטגוריות
            </Button>
            <Button onClick={() => setShowDialog(true)} className="bg-blue-900 hover:bg-blue-800 text-white px-6" dir="rtl">
              <Plus className="w-4 h-4 mr-2" />הוסף עובד
            </Button>
          </div>
        </div>

        <div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workers.map((worker) => (
              <Card key={worker.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-900">
                        <ChefHat className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{worker.nickname || 'ללא כינוי'}</CardTitle>
                      </div>
                    </div>
                    <Badge variant={worker.active ? "default" : "secondary"} dir="rtl">{worker.active ? "פעיל" : "לא פעיל"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {worker.email && <p className="text-sm text-gray-600">📧 {worker.email}</p>}
                    {worker.population && <p className="text-sm text-gray-600" dir="rtl">👥 {worker.population}</p>}
                    {worker.training && <p className="text-sm text-gray-600" dir="rtl">🎓 {worker.training}</p>}
                    {worker.additional_training && <p className="text-sm text-gray-600" dir="rtl">⭐ {worker.additional_training}</p>}
                    {worker.birth_date && <p className="text-sm text-gray-600" dir="rtl">🎂 {format(new Date(worker.birth_date), "MMM d, yyyy")}</p>}
                    {worker.email && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700" dir="rtl">הגדרות משתמש:</span>
                        <Badge variant={userRoles[worker.email] === "manager" ? "default" : "secondary"} dir="rtl">
                          {userRoles[worker.email] === "manager" ? "מנהל" : "משתמש רגיל"}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(worker)} dir="rtl"><Pencil className="w-3 h-3 mr-2" />ערוך</Button>
                    <Button variant={worker.active ? "destructive" : "default"} size="sm" className="flex-1" onClick={() => toggleActive(worker)} dir="rtl">
                      {worker.active ? <><UserX className="w-3 h-3 mr-2" />השבת</> : <><UserCheck className="w-3 h-3 mr-2" />הפעל</>}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteWorker(worker.id)} dir="rtl"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
        </div>

        {/* Worker Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">{editingWorker ? "ערוך עובד" : "הוסף עובד חדש"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div><Label htmlFor="nickname" dir="rtl">כינוי</Label><Input id="nickname" value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="כינוי" dir="rtl" /></div>
              
              <div><Label htmlFor="email" dir="rtl">אימייל</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@mail.com" dir="rtl" /></div>
              
              <div>
                <Label dir="rtl">אוכלוסייה</Label>
                <Select value={formData.population} onValueChange={(value) => setFormData({ ...formData, population: value })}>
                  <SelectTrigger><SelectValue placeholder="בחר אוכלוסייה..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="מנהל">מנהל</SelectItem>
                    <SelectItem value="קבוע בכיר">קבוע בכיר</SelectItem>
                    <SelectItem value="קבוע">קבוע</SelectItem>
                    <SelectItem value="קבלן בכיר">קבלן בכיר</SelectItem>
                    <SelectItem value="קבלן">קבלן</SelectItem>
                    <SelectItem value="קבלן מיוחד">קבלן מיוחד</SelectItem>
                    <SelectItem value="ותיק">ותיק</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label dir="rtl">הכשרה</Label>
                <Select value={formData.training} onValueChange={(value) => setFormData({ ...formData, training: value })}>
                  <SelectTrigger><SelectValue placeholder="בחר הכשרה..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="שף">שף</SelectItem>
                    <SelectItem value="שף 2">שף 2</SelectItem>
                    <SelectItem value="סו שף">סו שף</SelectItem>
                    <SelectItem value="מארחת">מארחת</SelectItem>
                    <SelectItem value="מאיישת סידור עבודה">מאיישת סידור עבודה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label dir="rtl">הכשרה נוספת</Label>
                <Select value={formData.additional_training} onValueChange={(value) => setFormData({ ...formData, additional_training: value })}>
                  <SelectTrigger><SelectValue placeholder="בחר הכשרה נוספת..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>ללא</SelectItem>
                    <SelectItem value="מדריך">מדריך</SelectItem>
                    <SelectItem value="בוחן">בוחן</SelectItem>
                    <SelectItem value="מתלמד">מתלמד</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div><Label htmlFor="birth_date" dir="rtl">תאריך יום הולדת</Label><Input id="birth_date" type="date" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} /></div>
              
              {formData.email && (
                <div>
                  <Label dir="rtl">הגדרות משתמש באפליקציה</Label>
                  <Select value={formData.user_role} onValueChange={(value) => setFormData({ ...formData, user_role: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user" dir="rtl">משתמש רגיל</SelectItem>
                      <SelectItem value="manager" dir="rtl">משתמש מנהל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingWorker(null); }} dir="rtl">ביטול</Button>
              <Button onClick={handleSubmit} className="bg-blue-900 hover:bg-blue-800" dir="rtl">{editingWorker ? "עדכן" : "הוסף"} עובד</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Names Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">ערוך שמות קטגוריות</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label dir="rtl">שם קטגוריה 1</Label><Input value={tempCategoryNames.category_1} onChange={(e) => setTempCategoryNames({ ...tempCategoryNames, category_1: e.target.value })} dir="rtl" /></div>
              <div><Label dir="rtl">שם קטגוריה 2</Label><Input value={tempCategoryNames.category_2} onChange={(e) => setTempCategoryNames({ ...tempCategoryNames, category_2: e.target.value })} dir="rtl" /></div>
              <div><Label dir="rtl">שם קטגוריה 3</Label><Input value={tempCategoryNames.category_3} onChange={(e) => setTempCategoryNames({ ...tempCategoryNames, category_3: e.target.value })} dir="rtl" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveCategoryNames} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
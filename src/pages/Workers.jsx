import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserX, UserCheck, ChefHat, TrendingUp, Award } from "lucide-react";
import { format } from "date-fns";
import { getSeniorityInfo, calculateProgression } from "../components/utils/SeniorityUtils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [categoryNames, setCategoryNames] = useState({ category_1: "קטגוריה 1", category_2: "קטגוריה 2", category_3: "קטגוריה 3" });
  const [showDialog, setShowDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    role: "chef",
    category: "category_1",
    phone: "",
    email: "",
    hire_date: format(new Date(), "yyyy-MM-dd"),
    is_guide: false,
    active: true
  });
  const [tempCategoryNames, setTempCategoryNames] = useState({ category_1: "", category_2: "", category_3: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [workersData, assignmentsData, catSettings] = await Promise.all([
      base44.entities.Worker.list("-created_date"),
      base44.entities.Assignment.list(),
      base44.entities.AppSettings.filter({ setting_key: "worker_category_names" })
    ]);
    setWorkers(workersData);
    setAssignments(assignmentsData);
    if (catSettings.length > 0) {
      const names = JSON.parse(catSettings[0].setting_value);
      setCategoryNames(names);
      setTempCategoryNames(names);
    }
  };

  const getWorkerTotalHours = (workerId) => {
    return assignments.filter(a => a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId).reduce((sum, a) => sum + (a.hours || 0), 0);
  };

  const handleSubmit = async () => {
    if (editingWorker) await base44.entities.Worker.update(editingWorker.id, formData);
    else await base44.entities.Worker.create(formData);
    setShowDialog(false);
    setEditingWorker(null);
    setFormData({ full_name: "", role: "chef", category: "category_1", phone: "", email: "", hire_date: format(new Date(), "yyyy-MM-dd"), is_guide: false, active: true });
    loadData();
  };

  const handleEdit = (worker) => {
    setEditingWorker(worker);
    setFormData({
      full_name: worker.full_name,
      role: worker.role,
      category: worker.category || "category_1",
      phone: worker.phone || "",
      email: worker.email || "",
      hire_date: worker.hire_date || format(new Date(), "yyyy-MM-dd"),
      is_guide: worker.is_guide || false,
      active: worker.active
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">חברי צוות</h1>
            <p className="text-gray-600" dir="rtl">נהל את הטבחים והעוזרים שלך</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setTempCategoryNames(categoryNames); setShowCategoryDialog(true); }} dir="rtl">
              ערוך קטגוריות
            </Button>
            <Button onClick={() => setShowDialog(true)} className="bg-blue-900 hover:bg-blue-800 text-white px-6" dir="rtl">
              <Plus className="w-4 h-4 mr-2" />הוסף עובד
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => {
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
                        <CardTitle className="text-lg">{worker.full_name}</CardTitle>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge className={worker.role === 'chef' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-700'} dir="rtl">
                           {worker.role === 'chef' ? 'טבח ראשי' : 'עוזר טבח'}
                          </Badge>
                          <Badge className={seniorityInfo.color}>{seniorityInfo.label}</Badge>
                          <Badge className={getCategoryColor(worker.category)}>
                            {categoryNames[worker.category] || worker.category}
                          </Badge>
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

                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2"><Award className="w-4 h-4 text-yellow-600" /><span className="text-sm font-medium text-gray-900" dir="rtl">סטטוס מדריך</span></div>
                      <Switch checked={worker.is_guide} onCheckedChange={() => toggleGuide(worker)} />
                    </div>

                    {worker.email && <p className="text-sm text-gray-600">📧 {worker.email}</p>}
                    {worker.phone && <p className="text-sm text-gray-600">📞 {worker.phone}</p>}
                    {worker.hire_date && <p className="text-sm text-gray-600" dir="rtl">📅 גויס: {format(new Date(worker.hire_date), "MMM d, yyyy")}</p>}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(worker)} dir="rtl"><Pencil className="w-3 h-3 mr-2" />ערוך</Button>
                    <Button variant={worker.active ? "destructive" : "default"} size="sm" className="flex-1" onClick={() => toggleActive(worker)} dir="rtl">
                      {worker.active ? <><UserX className="w-3 h-3 mr-2" />השבת</> : <><UserCheck className="w-3 h-3 mr-2" />הפעל</>}
                    </Button>
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

        {/* Worker Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">{editingWorker ? "ערוך עובד" : "הוסף עובד חדש"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label htmlFor="full_name" dir="rtl">שם מלא *</Label><Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="שם מלא" dir="rtl" /></div>
              <div><Label htmlFor="role" dir="rtl">תפקיד *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chef" dir="rtl">טבח ראשי</SelectItem>
                    <SelectItem value="sous_chef" dir="rtl">עוזר טבח</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label dir="rtl">קטגוריה</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category_1">{categoryNames.category_1}</SelectItem>
                    <SelectItem value="category_2">{categoryNames.category_2}</SelectItem>
                    <SelectItem value="category_3">{categoryNames.category_3}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Label htmlFor="is_guide" className="cursor-pointer flex items-center gap-2"><Award className="w-4 h-4 text-yellow-600" /><span>Qualified Guide</span></Label>
                <Switch id="is_guide" checked={formData.is_guide} onCheckedChange={(checked) => setFormData({ ...formData, is_guide: checked })} />
              </div>
              <div><Label htmlFor="email" dir="rtl">אימייל</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@mail.com" dir="rtl" /></div>
              <div><Label htmlFor="phone" dir="rtl">טלפון</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="05x-xxxxxxx" dir="rtl" /></div>
              <div><Label htmlFor="hire_date" dir="rtl">תאריך גיוס</Label><Input id="hire_date" type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingWorker(null); }} dir="rtl">ביטול</Button>
              <Button onClick={handleSubmit} disabled={!formData.full_name} className="bg-blue-900 hover:bg-blue-800" dir="rtl">{editingWorker ? "עדכן" : "הוסף"} עובד</Button>
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
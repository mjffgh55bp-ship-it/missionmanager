import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Users, X, Plus, Columns, Settings as SettingsIcon, ClipboardList, Pencil, Check } from "lucide-react";
import ConfirmDeleteButton from "@/components/ui/ConfirmDeleteButton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";


export default function Settings() {

  const [userRoles, setUserRoles] = useState({});
  const [workers, setWorkers] = useState([]);
  // Unified schedule columns
  const [scheduleColumns, setScheduleColumns] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [newColReportType, setNewColReportType] = useState("sum_numbers");
  const [newColQuantPreset, setNewColQuantPreset] = useState("");
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
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [taskQualifications, setTaskQualifications] = useState({}); // { taskName: [workerId, ...] }
  const [expandedTask, setExpandedTask] = useState(null);
  const [newQuantItem, setNewQuantItem] = useState(""); // for new column quant item
  const [renamingQuantItem, setRenamingQuantItem] = useState(null); // { colIdx, itemIdx, value }
  const [renamingSubOption, setRenamingSubOption] = useState(null); // { colIdx, subIdx, field, value }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    // Batch 1
    const [rolesSettings, workersData, scheduleColsSettings, populationsSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "user_roles" }),
      base44.entities.Worker.list(),
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
    ]);
    // Batch 2
    const [workerRolesSettings, shiftStatusesSettings, tasksSettings, taskQualSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.AppSettings.filter({ setting_key: "shift_statuses" }),
      base44.entities.AppSettings.filter({ setting_key: "tasks_list" }),
      base44.entities.AppSettings.filter({ setting_key: "task_qualifications" })
    ]);
    

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
    if (tasksSettings.length > 0) setTasks(JSON.parse(tasksSettings[0].setting_value) || []);
    if (taskQualSettings.length > 0) setTaskQualifications(JSON.parse(taskQualSettings[0].setting_value) || {});
    setWorkers(workersData);
    setLoading(false);
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
    const col = { name: newColName.trim(), report_type: newColReportType, options: [], quantitative_items: [] };
    const updated = [...scheduleColumns, col];
    await saveScheduleColumns(updated);
    setNewColName("");
    // Auto-expand the new column if quantitative
    if (newColReportType === "count_quantitative") setExpandedCol(updated.length - 1);
  };

  const handleAddQuantItem = async (colIdx, item) => {
    if (!item.trim()) return;
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, quantitative_items: [...(c.quantitative_items || []), item.trim()] } : c
    );
    await saveScheduleColumns(updated);
    setNewQuantItem("");
  };

  const handleRemoveQuantItem = async (colIdx, itemIdx) => {
    const updated = scheduleColumns.map((c, i) =>
      i === colIdx ? { ...c, quantitative_items: (c.quantitative_items || []).filter((_, ii) => ii !== itemIdx) } : c
    );
    await saveScheduleColumns(updated);
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

  // Rename sub_option criterion globally — updates all Assignments and TemplateRows
  const handleRenameSubOptionCriterion = async (colIdx, subIdx, oldCriterion, newCriterion) => {
    if (!newCriterion.trim() || newCriterion.trim() === oldCriterion) return;
    const colName = scheduleColumns[colIdx].name;
    const trimmed = newCriterion.trim();

    // 1. Update the setting
    const updated = scheduleColumns.map((c, i) => i === colIdx ? {
      ...c,
      sub_options: (c.sub_options || []).map((s, j) => j === subIdx ? { ...s, criterion: trimmed } : s)
    } : c);
    await saveScheduleColumns(updated);

    // 2. Update Assignments
    const assignments = await base44.entities.Assignment.list();
    for (const a of assignments) {
      const val = a.column_values?.[colName];
      if (val === oldCriterion) {
        await base44.entities.Assignment.update(a.id, { column_values: { ...a.column_values, [colName]: trimmed } });
      }
    }

    // 3. Update TemplateRows
    const rows = await base44.entities.TemplateRow.list();
    for (const r of rows) {
      const val = r.values?.[colName];
      if (val === oldCriterion) {
        await base44.entities.TemplateRow.update(r.id, { values: { ...r.values, [colName]: trimmed } });
      }
    }
  };

  // Rename quant item globally — updates all Assignments and TemplateRows
  const handleRenameQuantItem = async (colIdx, itemIdx, oldName, newName) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    const colName = scheduleColumns[colIdx].name;
    const trimmed = newName.trim();

    // 1. Update the setting
    const updated = scheduleColumns.map((c, i) => i === colIdx ? {
      ...c,
      quantitative_items: (c.quantitative_items || []).map((it, j) => j === itemIdx ? trimmed : it)
    } : c);
    await saveScheduleColumns(updated);

    // 2. Update all Assignments that have this column
    const assignments = await base44.entities.Assignment.list();
    for (const a of assignments) {
      const raw = a.column_values?.[colName];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (oldName in parsed) {
          const renamed = {};
          for (const [k, v] of Object.entries(parsed)) {
            renamed[k === oldName ? trimmed : k] = v;
          }
          const newColVals = { ...a.column_values, [colName]: JSON.stringify(renamed) };
          await base44.entities.Assignment.update(a.id, { column_values: newColVals });
        }
      } catch {}
    }

    // 3. Update all TemplateRows that have this column
    const rows = await base44.entities.TemplateRow.list();
    for (const r of rows) {
      const raw = r.values?.[colName];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (oldName in parsed) {
          const renamed = {};
          for (const [k, v] of Object.entries(parsed)) {
            renamed[k === oldName ? trimmed : k] = v;
          }
          const newVals = { ...r.values, [colName]: JSON.stringify(renamed) };
          await base44.entities.TemplateRow.update(r.id, { values: newVals });
        }
      } catch {}
    }
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



  const saveTaskQualifications = async (updated) => {
    const settings = await base44.entities.AppSettings.filter({ setting_key: "task_qualifications" });
    const data = { setting_key: "task_qualifications", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTaskQualifications(updated);
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim() || tasks.includes(newTaskName.trim())) return;
    const updated = [...tasks, newTaskName.trim()];
    const settings = await base44.entities.AppSettings.filter({ setting_key: "tasks_list" });
    const data = { setting_key: "tasks_list", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setTasks(updated);
    setNewTaskName("");
  };

  const handleRemoveTask = async (task) => {
    const updated = tasks.filter(t => t !== task);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "tasks_list" });
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    const updatedQuals = { ...taskQualifications };
    delete updatedQuals[task];
    await saveTaskQualifications(updatedQuals);
    setTasks(updated);
  };

  const handleToggleWorkerQualification = async (taskName, role, workerId) => {
    const taskRoles = taskQualifications[taskName] || {};
    const current = taskRoles[role] || [];
    const updatedRole = current.includes(workerId)
      ? current.filter(id => id !== workerId)
      : [...current, workerId];
    const updated = { ...taskQualifications, [taskName]: { ...taskRoles, [role]: updatedRole } };
    await saveTaskQualifications(updated);
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
            <div className="space-y-2 mb-4" dir="rtl">
              <div className="flex gap-2">
                <Input value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="שם עמודה חדשה..." dir="rtl" className="flex-1" />
                <Select value={newColReportType} onValueChange={v => { setNewColReportType(v); setNewColQuantPreset(""); }}>
                  <SelectTrigger className="w-56" dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="sum_numbers">
                      <div dir="rtl">
                        <div className="font-medium">סיכום מספרים</div>
                        <div className="text-xs text-gray-500">מסכם ערכים מספריים שהוזנו בתאים</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="sum_hours">
                      <div dir="rtl">
                        <div className="font-medium">סיכום שעות לפי טקסט</div>
                        <div className="text-xs text-gray-500">סופר שעות עבודה לפי ערך טקסטואלי מוגדר</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="count_by_text">
                      <div dir="rtl">
                        <div className="font-medium">סיכום פעמים לפי טקסט</div>
                        <div className="text-xs text-gray-500">סופר כמה פעמים הופיע ערך מסוים בעמודה</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="count_quantitative">
                      <div dir="rtl">
                        <div className="font-medium">ספירה כמותית</div>
                        <div className="text-xs text-gray-500">עמודת ספירה לפי רשימת פריטים מוגדרת מראש</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddScheduleColumn}><Plus className="w-4 h-4" /></Button>
              </div>
              {newColReportType === "count_quantitative" && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2" dir="rtl">
                  לאחר יצירת העמודה, פתח אותה כדי להוסיף פריטים לספירה
                </p>
              )}
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
                        col.report_type === "count_quantitative" ? "border-emerald-300 text-emerald-700" :
                        "border-blue-300 text-blue-700"
                      }`}>
                        {col.report_type === "sum_hours" ? "סיכום שעות לפי טקסט" : col.report_type === "count_by_text" ? "סיכום פעמים לפי טקסט" : col.report_type === "count_quantitative" ? `ספירה כמותית${col.quantitative_preset_name ? ` — ${col.quantitative_preset_name}` : ""}` : "סיכום מספרים"}
                      </Badge>
                      {(col.options || []).length > 0 && (
                        <span className="text-xs text-gray-500">{col.options.length} אפשרויות</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        {expandedCol === idx ? "סגור" : "אפשרויות"}
                      </button>
                      <ConfirmDeleteButton onConfirm={() => handleRemoveScheduleColumn(idx)} />
                    </div>
                  </div>
                  {expandedCol === idx && (
                   <div className="p-3 border-t space-y-4" dir="rtl">
                     {col.report_type === "count_quantitative" ? (
                       /* Quantitative items editor */
                       <div>
                         <p className="text-xs font-semibold text-gray-600 mb-1">פריטים לספירה</p>
                         <p className="text-xs text-gray-400 mb-2">כל פריט יספר בנפרד בדוחות (לדוגמה: A, B, C)</p>
                         <div className="flex gap-2 mb-2">
                           <Input
                             value={newQuantItem}
                             onChange={e => setNewQuantItem(e.target.value)}
                             placeholder="שם פריט... (לדוגמה: A)"
                             className="h-7 text-sm flex-1"
                             dir="rtl"
                             onKeyDown={e => e.key === 'Enter' && handleAddQuantItem(idx, newQuantItem)}
                           />
                           <Button size="sm" className="h-7" onClick={() => handleAddQuantItem(idx, newQuantItem)}><Plus className="w-3 h-3" /></Button>
                         </div>
                         <div className="space-y-1">
                           {(col.quantitative_items || []).map((item, ii) => {
                             const isRenaming = renamingQuantItem?.colIdx === idx && renamingQuantItem?.itemIdx === ii;
                             return (
                               <div key={ii} className="flex items-center gap-2">
                                 <button onClick={() => handleRemoveQuantItem(idx, ii)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                 {isRenaming ? (
                                   <>
                                     <Input
                                       autoFocus
                                       value={renamingQuantItem.value}
                                       onChange={e => setRenamingQuantItem(prev => ({ ...prev, value: e.target.value }))}
                                       onKeyDown={async e => {
                                         if (e.key === 'Enter') {
                                           await handleRenameQuantItem(idx, ii, item, renamingQuantItem.value);
                                           setRenamingQuantItem(null);
                                         }
                                         if (e.key === 'Escape') setRenamingQuantItem(null);
                                       }}
                                       className="h-6 text-xs flex-1"
                                       dir="rtl"
                                     />
                                     <button
                                       onClick={async () => {
                                         await handleRenameQuantItem(idx, ii, item, renamingQuantItem.value);
                                         setRenamingQuantItem(null);
                                       }}
                                       className="text-green-600 hover:text-green-700 flex-shrink-0"
                                       title="שמור שינוי שם (גורפי)"
                                     >
                                       <Check className="w-3 h-3" />
                                     </button>
                                     <button onClick={() => setRenamingQuantItem(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                   </>
                                 ) : (
                                   <>
                                     <span className="text-xs flex-1 px-1">{item}</span>
                                     <button
                                       onClick={() => setRenamingQuantItem({ colIdx: idx, itemIdx: ii, value: item })}
                                       className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                       title="שנה שם (יעדכן נתונים קיימים)"
                                     >
                                       <Pencil className="w-3 h-3" />
                                     </button>
                                   </>
                                 )}
                               </div>
                             );
                           })}
                           {(col.quantitative_items || []).length === 0 && <p className="text-xs text-gray-400">לא הוגדרו פריטים</p>}
                         </div>
                       </div>
                     ) : (
                       <>
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
                         {/* Sub options */}
                         <div>
                           <p className="text-xs font-semibold text-gray-600 mb-1">{col.free_text ? "אפשרויות מוכנות מראש (לא חובה)" : "אפשרויות מוכנות מראש לבחירה בלוח"}</p>
                           <p className="text-xs text-gray-400 mb-2">כל אפשרות מגדירה ערך לבחירה בתא ואת הקריטריון לספירת שעות בדוחות</p>
                           <div className="flex gap-2 mb-2">
                             <Input value={newSubOptionName} onChange={e => setNewSubOptionName(e.target.value)} placeholder="שם אפשרות..." className="h-7 text-sm flex-1" dir="rtl" />
                             <Button size="sm" className="h-7" onClick={() => handleAddSubOption(idx)}><Plus className="w-3 h-3" /></Button>
                           </div>
                           <div className="space-y-1">
                             {(col.sub_options || []).map((so, si) => {
                               const isRenamingCrit = renamingSubOption?.colIdx === idx && renamingSubOption?.subIdx === si && renamingSubOption?.field === 'criterion';
                               return (
                                 <div key={si} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 text-xs">
                                   <button onClick={() => handleRemoveSubOption(idx, si)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                   {/* Name — plain editable, no data impact */}
                                   <Input
                                     value={so.name}
                                     onChange={async e => {
                                       const updated = scheduleColumns.map((c, i) => i === idx ? {
                                         ...c,
                                         sub_options: (c.sub_options || []).map((s, j) => j === si ? { ...s, name: e.target.value } : s)
                                       } : c);
                                       await saveScheduleColumns(updated);
                                     }}
                                     className="h-6 text-xs flex-1 min-w-0"
                                     dir="rtl"
                                     placeholder="שם"
                                   />
                                   {/* Criterion — rename gloablly */}
                                   {isRenamingCrit ? (
                                     <>
                                       <Input
                                         autoFocus
                                         value={renamingSubOption.value}
                                         onChange={e => setRenamingSubOption(prev => ({ ...prev, value: e.target.value }))}
                                         onKeyDown={async e => {
                                           if (e.key === 'Enter') {
                                             await handleRenameSubOptionCriterion(idx, si, so.criterion, renamingSubOption.value);
                                             setRenamingSubOption(null);
                                           }
                                           if (e.key === 'Escape') setRenamingSubOption(null);
                                         }}
                                         className="h-6 text-xs flex-1 min-w-0"
                                         dir="rtl"
                                       />
                                       <button
                                         onClick={async () => {
                                           await handleRenameSubOptionCriterion(idx, si, so.criterion, renamingSubOption.value);
                                           setRenamingSubOption(null);
                                         }}
                                         className="text-green-600 hover:text-green-700 flex-shrink-0" title="שמור שם גורפי"
                                       ><Check className="w-3 h-3" /></button>
                                       <button onClick={() => setRenamingSubOption(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-3 h-3" /></button>
                                     </>
                                   ) : (
                                     <>
                                       <span className="text-xs text-gray-500 flex-1 px-1">{so.criterion}</span>
                                       <button
                                         onClick={() => setRenamingSubOption({ colIdx: idx, subIdx: si, field: 'criterion', value: so.criterion })}
                                         className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                         title="שנה קריטריון (יעדכן נתונים קיימים)"
                                       ><Pencil className="w-3 h-3" /></button>
                                     </>
                                   )}
                                 </div>
                               );
                             })}
                             {(col.sub_options || []).length === 0 && <p className="text-xs text-gray-400">לא הוגדרו אפשרויות</p>}
                           </div>
                         </div>
                       </>
                     )}
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
                <Badge key={role} className="bg-indigo-100 text-indigo-800 pr-1 flex items-center gap-1">
                  {role}
                  <ConfirmDeleteButton onConfirm={() => handleRemoveWorkerRole(role)} className="ml-1" />
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
                <Badge key={status} className="bg-teal-100 text-teal-800 pr-1 flex items-center gap-1">
                  {status}
                  <ConfirmDeleteButton onConfirm={() => handleRemoveShiftStatus(status)} className="ml-1" />
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
                <Badge key={pop} className="bg-orange-100 text-orange-800 pr-1 flex items-center gap-1">
                  {pop}
                  <ConfirmDeleteButton onConfirm={() => handleRemovePopulation(pop)} className="ml-1" />
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

        {/* Tasks & Qualifications */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2" dir="rtl"><ClipboardList className="w-5 h-5 text-violet-600" />משימות וכשירויות</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4" dir="rtl">
              הגדר משימות וקבע אילו עובדים כשירים לכל משימה. בעמודת הלוח, עובדים לא כשירים יצובעו בכתום ויוצגו אחרונים.
            </p>
            <div className="flex gap-2 mb-4" dir="rtl">
              <Input value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="שם משימה חדשה..." dir="rtl" className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
              <Button onClick={handleAddTask}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-sm text-gray-400" dir="rtl">לא הוגדרו משימות</p>}
              {tasks.map(task => (
                <div key={task} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50" dir="rtl">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{task}</span>
                      <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">
                        {Object.values(taskQualifications[task] || {}).flat().length} כשירים
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setExpandedTask(expandedTask === task ? null : task)} className="text-gray-400 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-200">
                        {expandedTask === task ? "סגור" : "נהל כשירויות"}
                      </button>
                      <ConfirmDeleteButton onConfirm={() => handleRemoveTask(task)} />
                    </div>
                  </div>
                  {expandedTask === task && (
                    <div className="p-3 border-t space-y-3" dir="rtl">
                      <p className="text-xs text-gray-500">סמן עובדים כשירים למשימה לפי תפקיד:</p>
                      {workerRoles.map(role => {
                        const roleWorkers = workers.filter(w => w.active !== false && (Array.isArray(w.role) ? w.role.includes(role) : w.role === role));
                        if (roleWorkers.length === 0) return null;
                        const taskRoleQuals = (taskQualifications[task] || {})[role] || [];
                        return (
                          <div key={role}>
                            <p className="text-xs font-semibold text-gray-700 mb-1">{role}</p>
                            <div className="flex flex-wrap gap-2">
                              {roleWorkers.map(worker => {
                                const qualified = taskRoleQuals.includes(worker.id);
                                return (
                                  <button
                                    key={worker.id}
                                    onClick={() => handleToggleWorkerQualification(task, role, worker.id)}
                                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                                      qualified
                                        ? 'bg-violet-100 border-violet-400 text-violet-800 font-semibold'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                                    }`}
                                  >
                                    {worker.nickname}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {workerRoles.length === 0 && <p className="text-xs text-gray-400">הגדר תפקידי עובדים תחילה</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
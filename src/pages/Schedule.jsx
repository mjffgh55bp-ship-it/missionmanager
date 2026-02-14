import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, Plus, Trash2, Pencil } from "lucide-react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Star, Download, ChevronUp, ChevronDown, Save } from "lucide-react";
import toast from 'react-hot-toast';

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const formatDateHebrew = (date) => {
  const d = new Date(date);
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${day} ${monthName}, ${year}`;
};
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ColumnCell from "../components/schedule/ColumnCell";


const SHIFT_WINDOWS = [
  { start: "06:00", end: "10:00" },
  { start: "10:00", end: "14:00" },
  { start: "14:00", end: "18:00" },
  { start: "18:00", end: "22:00" },
  { start: "22:00", end: "02:00" }
];

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [carts, setCarts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [columnTypes, setColumnTypes] = useState([]);
  const [columnSubTypes, setColumnSubTypes] = useState({});
  const [cartColumns, setCartColumns] = useState({});
  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [templateRows, setTemplateRows] = useState([]);

  
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddShiftDialog, setShowAddShiftDialog] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [showAddTemplateRowDialog, setShowAddTemplateRowDialog] = useState(false);
  const [showEditTemplateRowDialog, setShowEditTemplateRowDialog] = useState(false);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [showAddFromTemplatesDialog, setShowAddFromTemplatesDialog] = useState(false);
  const [showAddTemplateColumnDialog, setShowAddTemplateColumnDialog] = useState(false);
  const [showAddCategoryToTemplateDialog, setShowAddCategoryToTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [newTemplateColumnName, setNewTemplateColumnName] = useState("");
  const [newTemplateColumnType, setNewTemplateColumnType] = useState("text");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [newSubCategoryColor, setNewSubCategoryColor] = useState("#3b82f6");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [newColumnType, setNewColumnType] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [currentTemplateRow, setCurrentTemplateRow] = useState(null);
  const [templateRowValues, setTemplateRowValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [customColumnOrders, setCustomColumnOrders] = useState({});
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [editFormData, setEditFormData] = useState({
    start_time: "",
    end_time: "",
    hours: 4,
    notes: "",
    status: "",
    column_values: {}
  });

  const [newShiftData, setNewShiftData] = useState({
    start_time: "06:00",
    end_time: "10:00"
  });

  useEffect(() => { loadData(); }, [currentDate]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleSave(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (isAutoSave = false) => {
    setIsSaving(true);
    try {
      await loadData();
      setLastSaved(new Date());
      if (!isAutoSave) {
        toast.success('הלוח נשמר בהצלחה!');
      }
    } catch (error) {
      if (!isAutoSave) {
        toast.error('שגיאה בשמירת הלוח');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    
    // Split API calls into smaller groups to avoid rate limits
    const [workersData, cartsData, assignmentsData, availabilitiesData, unavailabilitiesData] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.FoodCart.filter({ active: true }),
      base44.entities.Assignment.filter({ date: dateString }),
      base44.entities.Availability.filter({ week_start_date: weekStartStr }),
      base44.entities.Unavailability.filter({ date: dateString })
    ]);
    
    const [colTypesSettings, colSubTypesSettings, cartColsSettings, allTemplatesData, templateRowsData, shiftStatusesSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_types" }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" }),
      base44.entities.AppSettings.filter({ setting_key: "cart_columns" }),
      base44.entities.Template.filter({ active: true }),
      base44.entities.TemplateRow.filter({ date: dateString }),
      base44.entities.AppSettings.filter({ setting_key: "shift_statuses" })
    ]);
    setWorkers(workersData);
    setCarts(cartsData);
    setAssignments(assignmentsData);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    setTemplateRows(templateRowsData);
    setAllTemplates(allTemplatesData);
    
    // טען רק תבניות שיש להן שורות בתאריך הנוכחי
    const uniqueTemplateIds = [...new Set(templateRowsData.map(row => row.template_id))];
    const templatesInUse = allTemplatesData.filter(t => uniqueTemplateIds.includes(t.id));
    setTemplates(templatesInUse);
    if (colTypesSettings.length > 0) setColumnTypes(JSON.parse(colTypesSettings[0].setting_value) || []);
    if (colSubTypesSettings.length > 0) setColumnSubTypes(JSON.parse(colSubTypesSettings[0].setting_value) || {});
    if (cartColsSettings.length > 0) setCartColumns(JSON.parse(cartColsSettings[0].setting_value) || {});
    if (shiftStatusesSettings.length > 0) setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    
    // Load custom column orders for this date
    const columnOrderSettings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
    if (columnOrderSettings.length > 0) {
      setCustomColumnOrders(JSON.parse(columnOrderSettings[0].setting_value) || {});
    } else {
      setCustomColumnOrders({});
    }
    
    // Auto-add default templates if no rows exist for this date
    if (templateRowsData.length === 0) {
      const defaultTemplates = allTemplatesData.filter(t => t.is_default && t.active);
      for (const template of defaultTemplates) {
        const groupId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const rowsToCreate = template.default_rows && template.default_rows.length > 0
          ? template.default_rows
          : [{}];
        
        for (const rowValues of rowsToCreate) {
          await base44.entities.TemplateRow.create({
            template_id: template.id,
            template_name: template.name,
            date: dateString,
            values: rowValues,
            group_id: groupId
          });
        }
      }
      
      // Reload template rows after adding defaults
      if (defaultTemplates.length > 0) {
        const updatedTemplateRows = await base44.entities.TemplateRow.filter({ date: dateString });
        setTemplateRows(updatedTemplateRows);
        const uniqueTemplateIds = [...new Set(updatedTemplateRows.map(row => row.template_id))];
        const templatesInUse = allTemplatesData.filter(t => uniqueTemplateIds.includes(t.id));
        setTemplates(templatesInUse);
      }
    }
    
    setLoading(false);
  };

  const dateString = format(currentDate, "yyyy-MM-dd");
  
  const filteredWorkers = workers.filter(w => 
    w.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCartAssignments = (cartId) => {
    return assignments.filter(a => a.food_cart_id === cartId).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  };

  const getNextShiftWindow = (cartId) => {
    const cartAssignments = getCartAssignments(cartId);
    if (cartAssignments.length === 0) return SHIFT_WINDOWS[0];
    const lastShift = cartAssignments[cartAssignments.length - 1];
    const currentIndex = SHIFT_WINDOWS.findIndex(w => w.start === lastShift.start_time);
    return SHIFT_WINDOWS[(currentIndex + 1) % SHIFT_WINDOWS.length];
  };

  const isWorkerUnavailable = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return false;
    const workerUnavail = unavailabilities.filter(u => u.worker_id === workerId);
    return workerUnavail.some(u => {
      return (startTime >= u.start_time && startTime < u.end_time) ||
             (endTime > u.start_time && endTime <= u.end_time) ||
             (startTime <= u.start_time && endTime >= u.end_time);
    });
  };

  const getWorkerAvailabilityPriority = (workerId, startTime, endTime) => {
    if (!workerId || !startTime || !endTime) return null;
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.status === "approved");
    if (!workerAvail || !workerAvail.shifts) return null;
    const shift = workerAvail.shifts.find(s => s.date === dateString && s.type !== "unavailable" && startTime >= s.start_time && endTime <= s.end_time);
    return shift ? { priority: shift.priority, type: shift.type } : null;
  };

  const handlePositionClick = (assignment, position) => {
    setSelectedPosition({ assignment, position });
    setCurrentAssignment(assignment);
    setShowWorkerDialog(true);
  };

  const handleWorkerSelect = async (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || !currentAssignment) return;
    
    let updateData = {};
    if (selectedPosition.position === 'chef') {
      updateData = { chef_id: workerId, chef_name: worker.nickname, chef_seniority: worker.seniority };
    } else if (selectedPosition.position === 'sous_chef') {
      updateData = { sous_chef_id: workerId, sous_chef_name: worker.nickname, sous_chef_seniority: worker.seniority };
    } else if (selectedPosition.position === 'additional') {
      updateData = { additional_chef_id: workerId, additional_chef_name: worker.nickname, additional_chef_role: worker.role };
    }

    await base44.entities.Assignment.update(currentAssignment.id, updateData);
    setShowWorkerDialog(false);
    setCurrentAssignment(null);
    setSelectedPosition(null);
    loadData();
  };

  const handleRemoveWorker = async () => {
    if (!currentAssignment || !selectedPosition) return;
    
    let updateData = {};
    if (selectedPosition.position === 'chef') {
      updateData = { chef_id: null, chef_name: null, chef_seniority: null };
    } else if (selectedPosition.position === 'sous_chef') {
      updateData = { sous_chef_id: null, sous_chef_name: null, sous_chef_seniority: null };
    } else if (selectedPosition.position === 'additional') {
      updateData = { additional_chef_id: null, additional_chef_name: null, additional_chef_role: null };
    }

    await base44.entities.Assignment.update(currentAssignment.id, updateData);
    setShowWorkerDialog(false);
    setCurrentAssignment(null);
    setSelectedPosition(null);
    loadData();
  };

  const handleEditAssignment = (assignment) => {
    setCurrentAssignment(assignment);
    setEditFormData({
      start_time: assignment.start_time || "",
      end_time: assignment.end_time || "",
      hours: assignment.hours || 4,
      notes: assignment.notes || "",
      status: assignment.status || "",
      column_values: assignment.column_values || {}
    });
    setShowEditDialog(true);
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return 4;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    let hours = endHour - startHour;
    if (endHour < startHour) hours += 24;
    hours += (endMin - startMin) / 60;
    return Math.max(0, hours);
  };

  const handleSaveEdit = async () => {
    if (!currentAssignment) return;
    const hours = calculateHours(editFormData.start_time, editFormData.end_time);
    await base44.entities.Assignment.update(currentAssignment.id, {
      start_time: editFormData.start_time,
      end_time: editFormData.end_time,
      hours,
      notes: editFormData.notes,
      status: editFormData.status,
      column_values: editFormData.column_values
    });
    setShowEditDialog(false);
    setCurrentAssignment(null);
    loadData();
  };

  const handleDeleteAssignment = async (assignmentId) => {
    await base44.entities.Assignment.delete(assignmentId);
    loadData();
  };

  const handleAddShift = async () => {
    const cart = carts.find(c => c.id === selectedCartId);
    if (!cart) return;
    const hours = calculateHours(newShiftData.start_time, newShiftData.end_time);
    await base44.entities.Assignment.create({
      date: dateString,
      food_cart_id: selectedCartId,
      food_cart_name: cart.name,
      start_time: newShiftData.start_time,
      end_time: newShiftData.end_time,
      hours,
      notes: "",
      has_trainee: false,
      column_values: {}
    });
    setShowAddShiftDialog(false);
    setNewShiftData({ start_time: "06:00", end_time: "10:00" });
    loadData();
  };

  const openAddShiftDialog = (cartId) => {
    setSelectedCartId(cartId);
    const nextWindow = getNextShiftWindow(cartId);
    setNewShiftData({ start_time: nextWindow.start, end_time: nextWindow.end });
    setShowAddShiftDialog(true);
  };

  const openAddColumnDialog = (cartId) => {
    setSelectedCartId(cartId);
    setNewColumnType("");
    setShowAddColumnDialog(true);
  };

  const handleAddColumn = async () => {
    if (!newColumnType) return;
    const updated = { ...cartColumns, [selectedCartId]: [...(cartColumns[selectedCartId] || []), newColumnType] };
    setCartColumns(updated);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "cart_columns" });
    const data = { setting_key: "cart_columns", setting_value: JSON.stringify(updated) };
    if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
    else await base44.entities.AppSettings.create(data);
    setShowAddColumnDialog(false);
    setNewColumnType("");
  };

  const handleRemoveColumn = async (cartId, colType) => {
    const updated = { ...cartColumns, [cartId]: (cartColumns[cartId] || []).filter(c => c !== colType) };
    setCartColumns(updated);
    const settings = await base44.entities.AppSettings.filter({ setting_key: "cart_columns" });
    await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
  };

  const handleAddTemplateRow = () => {
    setSelectedTemplateId("");
    setTemplateRowValues({});
    setCurrentTemplateRow(null);
    setShowAddTemplateRowDialog(true);
  };

  const handleAddTemplateRowForTemplate = async (templateId, useDefaults = false) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;

    // צור group_id ייחודי למופע הזה של התבנית
    const groupId = Date.now().toString();

    // אם useDefaults=true (הוספה מהשלדיות) ויש שורות ברירת מחדל, צור אותן
    // אחרת, תמיד צור שורה ריקה אחת בלבד
    const rowsToCreate = useDefaults && template.default_rows && template.default_rows.length > 0
      ? template.default_rows
      : [{}];

    for (const rowValues of rowsToCreate) {
      await base44.entities.TemplateRow.create({
        template_id: templateId,
        template_name: template.name,
        date: dateString,
        values: rowValues,
        group_id: groupId
      });
    }

    await loadData();
  };

  const handleEditTemplateRow = (row) => {
    setCurrentTemplateRow(row);
    setSelectedTemplateId(row.template_id);
    setTemplateRowValues(row.values || {});
    setShowEditTemplateRowDialog(true);
  };

  const handleSaveTemplateRow = async () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const data = {
      template_id: selectedTemplateId,
      template_name: template.name,
      date: dateString,
      values: templateRowValues,
      group_id: currentTemplateRow?.group_id || Date.now().toString()
    };

    if (currentTemplateRow) {
      await base44.entities.TemplateRow.update(currentTemplateRow.id, data);
    } else {
      await base44.entities.TemplateRow.create(data);
    }

    setShowAddTemplateRowDialog(false);
    setShowEditTemplateRowDialog(false);
    setSelectedTemplateId("");
    setTemplateRowValues({});
    setCurrentTemplateRow(null);
    loadData();
  };

  const handleDeleteTemplateRow = async (rowId) => {
    if (confirm("האם למחוק שורה זו?")) {
      await base44.entities.TemplateRow.delete(rowId);
      loadData();
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const initialValues = {};
      template.columns.forEach(col => {
        if (col.default_value) {
          initialValues[col.name] = col.default_value;
        }
      });
      setTemplateRowValues(initialValues);
    }
  };

  const handleUpdateColumnValue = async (assignmentId, colType, value, subType) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    const updatedValues = { ...(assignment.column_values || {}), [colType]: { value, subType } };
    await base44.entities.Assignment.update(assignmentId, { column_values: updatedValues });
    loadData();
  };

  const getSeniorityColor = (seniority) => {
    if (seniority === "newbie") return "text-blue-600";
    if (seniority === "trainee") return "text-orange-600";
    return "text-gray-900";
  };

  const handleExportToExcel = () => {
    const exportData = [];
    
    carts.forEach(cart => {
      const cartAssignments = getCartAssignments(cart.id);
      const columns = cartColumns[cart.id] || [];
      
      cartAssignments.forEach(assignment => {
        const row = {
          "Food Cart": cart.name,
          "Location": cart.location,
          "Date": dateString,
          "Time": `${assignment.start_time || "?"}-${assignment.end_time || "?"}`,
          "Hours": assignment.hours || 0,
          "Chef": assignment.chef_name || "",
          "Sous-Chef": assignment.sous_chef_name || "",
          "Additional": assignment.additional_chef_name || "",
        };
        
        columns.forEach(col => {
          const colValue = assignment.column_values?.[col];
          if (colValue) {
            row[col] = colValue.value || "";
            if (colValue.subType) {
              row[`${col} Type`] = colValue.subType;
            }
          } else {
            row[col] = "";
          }
        });
        
        if (assignment.notes) {
          row["Notes"] = assignment.notes;
        }
        
        exportData.push(row);
      });
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    
    const fileName = `schedule_${dateString}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-gray-600" dir="rtl">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-2xl" dir="rtl">לוח</CardTitle>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
                  <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center" dir="rtl">{formatDateHebrew(currentDate)}</div>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <Button 
                  variant={isEditMode ? "default" : "outline"}
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="gap-2"
                  dir="rtl"
                >
                  <Pencil className="w-4 h-4" />
                  {isEditMode ? 'מצב עריכה מופעל' : 'מצב עריכה'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSave(false)} 
                  disabled={isSaving}
                  className="gap-2"
                  dir="rtl"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'שומר...' : 'שמור לוח'}
                </Button>
                {lastSaved && (
                  <span className="text-xs text-gray-500" dir="rtl">
                    נשמר לאחרונה: {format(lastSaved, 'HH:mm')}
                  </span>
                )}
                {isEditMode && (
                  <>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowAddFromTemplatesDialog(true)} dir="rtl">
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף תבנית מהשלדיות
                    </Button>

                    {templateRows.length > 0 && (
                      <Button 
                        variant="destructive" 
                        onClick={async () => {
                          if (confirm(`האם למחוק את כל ${templateRows.length} השורות מכל הקטגוריות?`)) {
                            for (const row of templateRows) {
                              await base44.entities.TemplateRow.delete(row.id);
                            }
                            loadData();
                          }
                        }}
                        dir="rtl"
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        מחק הכל
                      </Button>
                    )}
                  </>
                )}
                <Button variant="outline" onClick={handleExportToExcel} className="gap-2" dir="rtl">
                  <Download className="w-4 h-4" />
                  ייצא
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {templates.length > 0 && (
          <div className="space-y-4 mb-6">
            {(() => {
              // קבץ שורות לפי template_id ו-group_id
              const groupedRows = {};
              templateRows.forEach(row => {
                const key = `${row.template_id}_${row.group_id || 'default'}`;
                if (!groupedRows[key]) {
                  groupedRows[key] = [];
                }
                groupedRows[key].push(row);
              });

              // המר לרשימת קבוצות
              const groups = Object.entries(groupedRows).map(([key, rows]) => ({
                key,
                template_id: rows[0].template_id,
                group_id: rows[0].group_id,
                rows: rows.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
              }));

              return groups.map((group, groupIndex) => {
                const template = allTemplates.find(t => t.id === group.template_id);
                if (!template) return null;
                const templateRowsForTemplate = group.rows;
                
                // Get custom column order for this template and date, or use default
                const customOrder = customColumnOrders[template.id];
                const orderedColumns = customOrder 
                  ? customOrder.map(name => template.columns.find(col => col.name === name)).filter(Boolean)
                  : template.columns;
              
              return (
                <Card key={group.key} className="border-none shadow-lg overflow-hidden">
                  <CardHeader className="text-black py-3" style={{ background: `linear-gradient(to left, ${template.color || '#3b82f6'}, ${template.color || '#3b82f6'}dd)` }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {isEditMode && (
                          <div className="flex flex-col gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 text-black hover:bg-black/10"
                              disabled={groupIndex === 0}
                              onClick={async () => {
                                const currentGroup = groups[groupIndex];
                                const prevGroup = groups[groupIndex - 1];
                                
                                // החלף את created_date של השורה הראשונה בכל קבוצה
                                const currentFirstRow = currentGroup.rows[0];
                                const prevFirstRow = prevGroup.rows[0];
                                
                                await base44.entities.TemplateRow.update(currentFirstRow.id, { 
                                  created_date: prevFirstRow.created_date 
                                });
                                await base44.entities.TemplateRow.update(prevFirstRow.id, { 
                                  created_date: currentFirstRow.created_date 
                                });
                                
                                loadData();
                              }}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 text-black hover:bg-black/10"
                              disabled={groupIndex === groups.length - 1}
                              onClick={async () => {
                                const currentGroup = groups[groupIndex];
                                const nextGroup = groups[groupIndex + 1];
                                
                                // החלף את created_date של השורה הראשונה בכל קבוצה
                                const currentFirstRow = currentGroup.rows[0];
                                const nextFirstRow = nextGroup.rows[0];
                                
                                await base44.entities.TemplateRow.update(currentFirstRow.id, { 
                                  created_date: nextFirstRow.created_date 
                                });
                                await base44.entities.TemplateRow.update(nextFirstRow.id, { 
                                  created_date: currentFirstRow.created_date 
                                });
                                
                                loadData();
                              }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <CardTitle className="text-lg" dir="rtl">{template.name}</CardTitle>
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleAddTemplateRowForTemplate(template.id)} dir="rtl">
                          <Plus className="w-3 h-3 ml-1" />
                          הוסף שורה
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowAddTemplateColumnDialog(true);
                          }} 
                          dir="rtl"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          הוסף עמודה
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowAddCategoryToTemplateDialog(true);
                          }} 
                          dir="rtl"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          הוסף קטגוריה
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={async () => {
                            if (confirm(`האם למחוק את השלדית "${template.name}" מהלוח (רק ליום ${formatDateHebrew(currentDate)})?`)) {
                              // מחק רק את השורות של התבנית לתאריך הנוכחי
                              for (const row of templateRowsForTemplate) {
                                await base44.entities.TemplateRow.delete(row.id);
                              }
                              loadData();
                            }
                          }}
                          dir="rtl"
                        >
                          <Trash2 className="w-3 h-3 ml-1" />
                          מחק מהלוח
                        </Button>
                      </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]" dir="rtl"></TableHead>
                            {orderedColumns.map((col, idx) => (
                              <TableHead key={idx} style={{ width: `${col.width}px` }} dir="rtl">
                                <div className="flex items-center gap-1 justify-center">
                                  <span>{col.name}</span>
                                  {isEditMode && (
                                    <div className="flex gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-4 w-4 p-0"
                                      disabled={idx === 0}
                                      onClick={async () => {
                                        const newOrder = [...orderedColumns];
                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                        const newCustomOrders = { ...customColumnOrders, [template.id]: newOrder.map(c => c.name) };
                                        setCustomColumnOrders(newCustomOrders);
                                        
                                        const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
                                        const data = { setting_key: `schedule_column_order_${dateString}`, setting_value: JSON.stringify(newCustomOrders) };
                                        if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
                                        else await base44.entities.AppSettings.create(data);
                                      }}
                                    >
                                      <ChevronRight className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-4 w-4 p-0"
                                      disabled={idx === orderedColumns.length - 1}
                                      onClick={async () => {
                                        const newOrder = [...orderedColumns];
                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                        const newCustomOrders = { ...customColumnOrders, [template.id]: newOrder.map(c => c.name) };
                                        setCustomColumnOrders(newCustomOrders);
                                        
                                        const settings = await base44.entities.AppSettings.filter({ setting_key: `schedule_column_order_${dateString}` });
                                        const data = { setting_key: `schedule_column_order_${dateString}`, setting_value: JSON.stringify(newCustomOrders) };
                                        if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
                                        else await base44.entities.AppSettings.create(data);
                                      }}
                                    >
                                      <ChevronLeft className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  )}
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="w-[100px]" dir="rtl">סטטוס</TableHead>
                            {isEditMode && <TableHead className="w-[60px]" dir="rtl"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templateRowsForTemplate.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={template.columns.length + 3} className="text-center text-gray-500 py-8" dir="rtl">
                                אין שורות. לחץ "הוסף שורה" להוספה.
                              </TableCell>
                            </TableRow>
                          ) : (
                            templateRowsForTemplate.map((row, rowIndex) => {
                              return (
                              <TableRow key={row.id}>
                                <TableCell className="w-[60px]">
                                  {isEditMode && (
                                    <div className="flex flex-col gap-1 items-center">
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        disabled={rowIndex === 0}
                                        onClick={async () => {
                                          const currentRow = templateRowsForTemplate[rowIndex];
                                          const prevRow = templateRowsForTemplate[rowIndex - 1];
                                          
                                          // החלף את created_date
                                          await base44.entities.TemplateRow.update(currentRow.id, { 
                                            created_date: prevRow.created_date 
                                          });
                                          await base44.entities.TemplateRow.update(prevRow.id, { 
                                            created_date: currentRow.created_date 
                                          });
                                          
                                          loadData();
                                        }}
                                      >
                                        <ChevronUp className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        disabled={rowIndex === templateRowsForTemplate.length - 1}
                                        onClick={async () => {
                                          const currentRow = templateRowsForTemplate[rowIndex];
                                          const nextRow = templateRowsForTemplate[rowIndex + 1];
                                          
                                          // החלף את created_date
                                          await base44.entities.TemplateRow.update(currentRow.id, { 
                                            created_date: nextRow.created_date 
                                          });
                                          await base44.entities.TemplateRow.update(nextRow.id, { 
                                            created_date: currentRow.created_date 
                                          });
                                          
                                          loadData();
                                        }}
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                  </TableCell>
                                  {orderedColumns.map((col, idx) => (
                                  <TableCell key={idx} dir="rtl" className="p-0">
                                   {col.type === "time" ? (
                                     <Input
                                       type="time"
                                       value={row.values?.[col.name] || ""}
                                       onChange={(e) => {
                                         const newValues = { ...row.values, [col.name]: e.target.value };
                                         base44.entities.TemplateRow.update(row.id, { values: newValues });
                                         setTemplateRows(prev => prev.map(r => r.id === row.id ? { ...r, values: newValues } : r));
                                       }}
                                       placeholder={col.default_value || ""}
                                       dir="rtl"
                                       className="border-0 rounded-none h-full focus:ring-0 focus:ring-offset-0 text-sm"
                                     />
                                   ) : (
                                     <Input
                                       type="text"
                                       value={row.values?.[col.name] || ""}
                                       onChange={(e) => {
                                         const newValues = { ...row.values, [col.name]: e.target.value };
                                         base44.entities.TemplateRow.update(row.id, { values: newValues });
                                         setTemplateRows(prev => prev.map(r => r.id === row.id ? { ...r, values: newValues } : r));
                                       }}
                                       placeholder={col.default_value || "-"}
                                       dir="rtl"
                                       className="border-0 rounded-none h-full focus:ring-0 focus:ring-offset-0 text-sm"
                                     />
                                   )}
                                  </TableCell>
                                  ))}
                                  <TableCell className="p-0">
                                  <Select 
                                   value={row.values?.status || ""} 
                                   onValueChange={async (value) => {
                                     const newValues = { ...row.values, status: value };
                                     await base44.entities.TemplateRow.update(row.id, { values: newValues });
                                     setTemplateRows(prev => prev.map(r => r.id === row.id ? { ...r, values: newValues } : r));
                                   }}
                                  >
                                   <SelectTrigger className="h-full border-0 rounded-none text-xs">
                                     <SelectValue placeholder="-" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value={null}>ללא</SelectItem>
                                     {shiftStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                   </SelectContent>
                                   </Select>
                                   </TableCell>
                                   {isEditMode && (
                                     <TableCell className="p-1">
                                       <Button 
                                         variant="ghost" 
                                         size="icon" 
                                         className="h-7 w-7 text-red-500 hover:text-red-700" 
                                         onClick={() => handleDeleteTemplateRow(row.id)}
                                       >
                                         <Trash2 className="w-3 h-3" />
                                       </Button>
                                     </TableCell>
                                   )}
                                   </TableRow>
                                   );
                                   })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
              });
            })()}
          </div>
        )}

        {carts.length === 0 && templateRows.length === 0 ? (
          <Card className="border-none shadow-lg"><CardContent className="py-16 text-center" dir="rtl"><h3 className="text-xl font-semibold text-gray-900 mb-2">נדרשת הגדרה</h3><p className="text-gray-600">אנא הוסף עגלות מזון תחילה.</p></CardContent></Card>
        ) : carts.length > 0 ? (
          <div className="space-y-6">
            {carts.map((cart) => {
              const cartAssignments = getCartAssignments(cart.id);
              const columns = cartColumns[cart.id] || [];
              
              return (
                <Card key={cart.id} className="border-none shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-lg">🚚 {cart.name}<span className="text-sm font-normal opacity-90">• {cart.location}</span></CardTitle>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openAddColumnDialog(cart.id)}><Plus className="w-3 h-3" /></Button>
                          <Button size="sm" variant="secondary" onClick={() => openAddShiftDialog(cart.id)} dir="rtl"><Plus className="w-4 h-4 mr-1" />משמרת</Button>
                          {cartAssignments.length > 0 && (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={async () => {
                                if (confirm(`האם למחוק את כל ${cartAssignments.length} המשמרות של ${cart.name}?`)) {
                                  for (const assignment of cartAssignments) {
                                    await base44.entities.Assignment.delete(assignment.id);
                                  }
                                  loadData();
                                }
                              }}
                              dir="rtl"
                            >
                              <Trash2 className="w-3 h-3 ml-1" />
                              מחק הכל
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]" dir="rtl">שעה</TableHead>
                            <TableHead className="w-[120px]" dir="rtl">טבח ראשי</TableHead>
                            <TableHead className="w-[120px]" dir="rtl">עוזר טבח</TableHead>
                            <TableHead className="w-[120px]" dir="rtl">נוסף</TableHead>
                            <TableHead className="w-[100px]" dir="rtl">סטטוס</TableHead>
                            {columns.map(col => (
                              <TableHead key={col} className="w-[100px]">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{col}</span>
                                  {isEditMode && (
                                    <button onClick={() => handleRemoveColumn(cart.id, col)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                  )}
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="w-[80px]" dir="rtl">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cartAssignments.length === 0 ? (
                            <TableRow><TableCell colSpan={6 + columns.length} className="text-center text-gray-500 py-8" dir="rtl">אין משמרות. לחץ "משמרת" להוספה.</TableCell></TableRow>
                          ) : (
                            cartAssignments.map((assignment) => (
                              <TableRow key={assignment.id} className={assignment.has_trainee ? "bg-orange-50" : ""}>
                                <TableCell className="font-medium">
                                  <div className="text-sm">{assignment.start_time || "?"}-{assignment.end_time || "?"}</div>
                                  <div className="text-xs text-gray-500">{assignment.hours || 0}h</div>
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => handlePositionClick(assignment, 'chef')} className={`w-full text-right p-1 rounded border hover:bg-blue-50 ${assignment.chef_id && isWorkerUnavailable(assignment.chef_id, assignment.start_time, assignment.end_time) ? "border-red-300 bg-red-50" : "border-gray-200"}`} dir="rtl">
                                    {assignment.chef_name ? (
                                      <span className={`text-xs font-medium truncate ${getSeniorityColor(assignment.chef_seniority)}`}>{assignment.chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">+ טבח</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => handlePositionClick(assignment, 'sous_chef')} className={`w-full text-right p-1 rounded border hover:bg-blue-50 ${assignment.sous_chef_id && isWorkerUnavailable(assignment.sous_chef_id, assignment.start_time, assignment.end_time) ? "border-red-300 bg-red-50" : "border-gray-200"}`} dir="rtl">
                                    {assignment.sous_chef_name ? (
                                      <span className={`text-xs font-medium truncate ${getSeniorityColor(assignment.sous_chef_seniority)}`}>{assignment.sous_chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">+ עוזר</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => handlePositionClick(assignment, 'additional')} className="w-full text-right p-1 rounded border border-gray-200 hover:bg-blue-50" dir="rtl">
                                    {assignment.additional_chef_name ? (
                                      <span className="text-xs font-medium truncate text-gray-900">{assignment.additional_chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">+ נוסף</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={assignment.status || ""} 
                                    onValueChange={async (value) => {
                                      await base44.entities.Assignment.update(assignment.id, { status: value });
                                      loadData();
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="בחר..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={null}>ללא</SelectItem>
                                      {shiftStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    </TableCell>
                                {columns.map(col => (
                                  <TableCell key={col}>
                                    <ColumnCell 
                                      assignmentId={assignment.id} 
                                      colType={col} 
                                      columnValues={assignment.column_values} 
                                      availableSubTypes={columnSubTypes[col] || []} 
                                      onSaved={(updatedColumnValues) => {
                                        setAssignments(prev => prev.map(a => 
                                          a.id === assignment.id 
                                            ? { ...a, column_values: updatedColumnValues }
                                            : a
                                        ));
                                      }} 
                                    />
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAssignment(assignment)}><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteAssignment(assignment.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {/* Worker Dialog */}
        <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle dir="rtl">בחר {selectedPosition?.position === 'chef' ? 'טבח ראשי' : selectedPosition?.position === 'sous_chef' ? 'עוזר טבח' : 'נוסף'}</DialogTitle></DialogHeader>
            <div className="py-4">
              <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" dir="rtl" /></div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedPosition && (() => {
                  // Filter by role
                  const roleFiltered = filteredWorkers.filter(w => 
                    selectedPosition.position === 'additional' || 
                    (selectedPosition.position === 'chef' ? w.role === 'chef' : w.role === 'sous_chef')
                  );
                  
                  // Sort by availability priority
                  const sorted = roleFiltered.sort((a, b) => {
                    const aAvail = currentAssignment ? getWorkerAvailabilityPriority(a.id, currentAssignment.start_time, currentAssignment.end_time) : null;
                    const bAvail = currentAssignment ? getWorkerAvailabilityPriority(b.id, currentAssignment.start_time, currentAssignment.end_time) : null;
                    
                    // Unavailable workers go to the bottom
                    const aUnavailable = currentAssignment ? isWorkerUnavailable(a.id, currentAssignment.start_time, currentAssignment.end_time) : false;
                    const bUnavailable = currentAssignment ? isWorkerUnavailable(b.id, currentAssignment.start_time, currentAssignment.end_time) : false;
                    if (aUnavailable && !bUnavailable) return 1;
                    if (!aUnavailable && bUnavailable) return -1;
                    
                    // Sort by availability type: wanted > available > no availability
                    const aType = aAvail?.type;
                    const bType = bAvail?.type;
                    if (aType === 'wanted' && bType !== 'wanted') return -1;
                    if (aType !== 'wanted' && bType === 'wanted') return 1;
                    if (aType === 'available' && !bType) return -1;
                    if (!aType && bType === 'available') return 1;
                    
                    // Sort by priority within the same type
                    if (aAvail?.priority && bAvail?.priority) {
                      return aAvail.priority - bAvail.priority;
                    }
                    
                    return 0;
                  });
                  
                  return sorted.map((worker) => {
                    const availInfo = currentAssignment ? getWorkerAvailabilityPriority(worker.id, currentAssignment.start_time, currentAssignment.end_time) : null;
                    const isUnavailable = currentAssignment ? isWorkerUnavailable(worker.id, currentAssignment.start_time, currentAssignment.end_time) : false;
                    return (
                      <button key={worker.id} onClick={() => handleWorkerSelect(worker.id)} className={`w-full p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-left ${isUnavailable ? "border-red-300 bg-red-50" : availInfo?.type === 'wanted' ? "border-green-300 bg-green-50" : ""}`}>
                        <div className="flex items-center gap-3">
                          {isUnavailable && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          {availInfo?.type === "wanted" && <Star className="w-4 h-4 text-green-600 fill-green-600" />}
                          {availInfo?.type === "available" && <Check className="w-4 h-4 text-blue-600" />}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{worker.nickname}</div>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs" dir="rtl">{worker.seniority || 'לא ידוע'}</Badge>
                              {worker.is_guide && <Badge className="text-xs bg-yellow-100 text-yellow-800" dir="rtl">מדריך</Badge>}
                              {availInfo && <Badge variant="outline" className="text-xs capitalize" dir="rtl">{availInfo.type === 'wanted' ? 'רצוי' : availInfo.type === 'available' ? 'זמין' : 'לא זמין'} #{availInfo.priority}</Badge>}
                              {isUnavailable && <Badge className="text-xs bg-red-100 text-red-800" dir="rtl">לא זמין</Badge>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
            <DialogFooter>
              {currentAssignment && selectedPosition && ((selectedPosition.position === 'chef' && currentAssignment.chef_id) || (selectedPosition.position === 'sous_chef' && currentAssignment.sous_chef_id) || (selectedPosition.position === 'additional' && currentAssignment.additional_chef_id)) && (
                <Button variant="destructive" onClick={handleRemoveWorker} dir="rtl">הסר עובד</Button>
              )}
              <Button variant="outline" onClick={() => setShowWorkerDialog(false)} dir="rtl">ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">ערוך משמרת</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label dir="rtl">שעת התחלה</Label><Input type="time" value={editFormData.start_time} onChange={(e) => setEditFormData({ ...editFormData, start_time: e.target.value })} /></div>
                <div><Label dir="rtl">שעת סיום</Label><Input type="time" value={editFormData.end_time} onChange={(e) => setEditFormData({ ...editFormData, end_time: e.target.value })} /></div>
              </div>
              <div>
                <Label dir="rtl">סטטוס</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                  <SelectTrigger><SelectValue placeholder="בחר סטטוס..." /></SelectTrigger>
                  <SelectContent>
                    {shiftStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label dir="rtl">הערות</Label><Textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={2} dir="rtl" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveEdit} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Shift Dialog */}
        <Dialog open={showAddShiftDialog} onOpenChange={setShowAddShiftDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף משמרת חדשה</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label dir="rtl">שעת התחלה</Label><Input type="time" value={newShiftData.start_time} onChange={(e) => setNewShiftData({ ...newShiftData, start_time: e.target.value })} /></div>
                <div><Label dir="rtl">שעת סיום</Label><Input type="time" value={newShiftData.end_time} onChange={(e) => setNewShiftData({ ...newShiftData, end_time: e.target.value })} /></div>
              </div>
              <div className="flex flex-wrap gap-2"><p className="text-sm text-gray-600 w-full" dir="rtl">בחירה מהירה:</p>
                {SHIFT_WINDOWS.map(w => (<Button key={w.start} variant="outline" size="sm" onClick={() => setNewShiftData({ start_time: w.start, end_time: w.end })} className={newShiftData.start_time === w.start ? "border-blue-500 bg-blue-50" : ""}>{w.start}-{w.end}</Button>))}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddShiftDialog(false)} dir="rtl">ביטול</Button><Button onClick={handleAddShift} className="bg-blue-900 hover:bg-blue-800" dir="rtl">הוסף משמרת</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Column Dialog */}
        <Dialog open={showAddColumnDialog} onOpenChange={setShowAddColumnDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף עמודה</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">סוג עמודה</Label>
                <Select value={newColumnType} onValueChange={setNewColumnType}>
                  <SelectTrigger><SelectValue placeholder="בחר סוג..." /></SelectTrigger>
                  <SelectContent>
                    {columnTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    {columnTypes.length === 0 && <div className="p-2 text-xs text-gray-500" dir="rtl">לא הוגדרו סוגים. הוסף אותם בהגדרות.</div>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddColumnDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleAddColumn} disabled={!newColumnType} className="bg-blue-900 hover:bg-blue-800" dir="rtl">הוסף</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Template Row Dialog */}
        <Dialog open={showAddTemplateRowDialog} onOpenChange={setShowAddTemplateRowDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle dir="rtl">הוסף שורה מתבנית</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">בחר תבנית</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תבנית..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedTemplateId && templates.find(t => t.id === selectedTemplateId) && (
                <div className="space-y-3 border-t pt-4">
                  {templates.find(t => t.id === selectedTemplateId).columns.map((col, idx) => (
                    <div key={idx}>
                      <Label className="text-sm" dir="rtl">{col.name}</Label>
                      {col.type === "time" ? (
                        <Input
                          type="time"
                          value={templateRowValues[col.name] || ""}
                          onChange={(e) => setTemplateRowValues({ ...templateRowValues, [col.name]: e.target.value })}
                        />
                      ) : (
                        <Input
                          value={templateRowValues[col.name] || ""}
                          onChange={(e) => setTemplateRowValues({ ...templateRowValues, [col.name]: e.target.value })}
                          placeholder={col.default_value || ""}
                          dir="rtl"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddTemplateRowDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveTemplateRow} disabled={!selectedTemplateId} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Category Dialog */}
        <Dialog open={showCreateCategoryDialog} onOpenChange={setShowCreateCategoryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">צור קטגוריה חדשה</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">שם הקטגוריה</Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="לדוגמה: מתכונים, משימות..."
                  dir="rtl"
                />
              </div>
              <div>
                <Label dir="rtl">צבע</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <div className="text-sm text-gray-600" dir="rtl">{newCategoryColor}</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateCategoryDialog(false);
                setNewCategoryName("");
                setNewCategoryColor("#3b82f6");
              }} dir="rtl">ביטול</Button>
              <Button 
                onClick={async () => {
                  if (!newCategoryName) return;
                  const newTemplate = await base44.entities.Template.create({
                    name: newCategoryName,
                    color: newCategoryColor,
                    columns: [
                      { name: "עמודה 1", type: "text", width: 120 }
                    ],
                    default_rows: [],
                    active: true
                  });
                  setShowCreateCategoryDialog(false);
                  setNewCategoryName("");
                  setNewCategoryColor("#3b82f6");
                  loadData();
                }}
                disabled={!newCategoryName}
                className="bg-purple-600 hover:bg-purple-700"
                dir="rtl"
              >
                צור קטגוריה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add From Templates Dialog */}
        <Dialog open={showAddFromTemplatesDialog} onOpenChange={setShowAddFromTemplatesDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף תבנית מהשלדיות</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {allTemplates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4" dir="rtl">אין שלדיות זמינות</p>
              ) : (
                allTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={async () => {
                      await handleAddTemplateRowForTemplate(template.id, true);
                      setShowAddFromTemplatesDialog(false);
                      await loadData();
                    }}
                    className="w-full p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-right"
                    dir="rtl"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: template.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-500">{template.columns.length} עמודות</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddFromTemplatesDialog(false)} dir="rtl">ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Template Column Dialog */}
        <Dialog open={showAddTemplateColumnDialog} onOpenChange={setShowAddTemplateColumnDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף עמודה ל{selectedTemplate?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">שם העמודה</Label>
                <Input
                  value={newTemplateColumnName}
                  onChange={(e) => setNewTemplateColumnName(e.target.value)}
                  placeholder="לדוגמה: שעה, שם..."
                  dir="rtl"
                />
              </div>
              <div>
                <Label dir="rtl">סוג</Label>
                <Select value={newTemplateColumnType} onValueChange={setNewTemplateColumnType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">טקסט</SelectItem>
                    <SelectItem value="time">שעה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddTemplateColumnDialog(false);
                setNewTemplateColumnName("");
                setNewTemplateColumnType("text");
              }} dir="rtl">ביטול</Button>
              <Button 
                onClick={async () => {
                  if (!newTemplateColumnName || !selectedTemplate) return;
                  const updatedColumns = [...selectedTemplate.columns, {
                    name: newTemplateColumnName,
                    type: newTemplateColumnType,
                    width: 120
                  }];
                  await base44.entities.Template.update(selectedTemplate.id, { columns: updatedColumns });
                  setShowAddTemplateColumnDialog(false);
                  setNewTemplateColumnName("");
                  setNewTemplateColumnType("text");
                  setSelectedTemplate(null);
                  loadData();
                }}
                disabled={!newTemplateColumnName}
                className="bg-blue-900 hover:bg-blue-800"
                dir="rtl"
              >
                הוסף עמודה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Category to Template Dialog */}
        <Dialog open={showAddCategoryToTemplateDialog} onOpenChange={setShowAddCategoryToTemplateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle dir="rtl">הוסף תת-קטגוריה חדשה</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label dir="rtl">שם התת-קטגוריה</Label>
                <Input
                  value={newSubCategoryName}
                  onChange={(e) => setNewSubCategoryName(e.target.value)}
                  placeholder="לדוגמה: כלי עזר, מרכיבים..."
                  dir="rtl"
                />
              </div>
              <div>
                <Label dir="rtl">צבע</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={newSubCategoryColor}
                    onChange={(e) => setNewSubCategoryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <div className="text-sm text-gray-600" dir="rtl">{newSubCategoryColor}</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddCategoryToTemplateDialog(false);
                setNewSubCategoryName("");
                setNewSubCategoryColor("#3b82f6");
              }} dir="rtl">ביטול</Button>
              <Button 
                onClick={async () => {
                  if (!newSubCategoryName) return;
                  const newTemplate = await base44.entities.Template.create({
                    name: `${selectedTemplate?.name} - ${newSubCategoryName}`,
                    color: newSubCategoryColor,
                    columns: selectedTemplate?.columns || [{ name: "עמודה 1", type: "text", width: 120 }],
                    default_rows: [],
                    active: true
                  });
                  setShowAddCategoryToTemplateDialog(false);
                  setNewSubCategoryName("");
                  setNewSubCategoryColor("#3b82f6");
                  setSelectedTemplate(null);
                  loadData();
                }}
                disabled={!newSubCategoryName}
                className="bg-purple-600 hover:bg-purple-700"
                dir="rtl"
              >
                צור תת-קטגוריה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Template Row Dialog */}
        <Dialog open={showEditTemplateRowDialog} onOpenChange={setShowEditTemplateRowDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle dir="rtl">ערוך שורה</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {selectedTemplateId && templates.find(t => t.id === selectedTemplateId) && (
                <div className="space-y-3">
                  <div className="font-semibold text-lg mb-3" dir="rtl">{templates.find(t => t.id === selectedTemplateId).name}</div>
                  {templates.find(t => t.id === selectedTemplateId).columns.map((col, idx) => (
                    <div key={idx}>
                      <Label className="text-sm" dir="rtl">{col.name}</Label>
                      {col.type === "time" ? (
                        <Input
                          type="time"
                          value={templateRowValues[col.name] || ""}
                          onChange={(e) => setTemplateRowValues({ ...templateRowValues, [col.name]: e.target.value })}
                        />
                      ) : (
                        <Input
                          value={templateRowValues[col.name] || ""}
                          onChange={(e) => setTemplateRowValues({ ...templateRowValues, [col.name]: e.target.value })}
                          placeholder={col.default_value || ""}
                          dir="rtl"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditTemplateRowDialog(false)} dir="rtl">ביטול</Button>
              <Button onClick={handleSaveTemplateRow} className="bg-blue-900 hover:bg-blue-800" dir="rtl">שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
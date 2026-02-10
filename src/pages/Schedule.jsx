import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, Plus, Trash2, Pencil } from "lucide-react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Star, Download } from "lucide-react";
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
  
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddShiftDialog, setShowAddShiftDialog] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [newColumnType, setNewColumnType] = useState("");
  
  const [editFormData, setEditFormData] = useState({
    start_time: "",
    end_time: "",
    hours: 4,
    notes: "",
    column_values: {}
  });

  const [newShiftData, setNewShiftData] = useState({
    start_time: "06:00",
    end_time: "10:00"
  });

  useEffect(() => { loadData(); }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    
    const [workersData, cartsData, assignmentsData, availabilitiesData, unavailabilitiesData, colTypesSettings, colSubTypesSettings, cartColsSettings] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.FoodCart.filter({ active: true }),
      base44.entities.Assignment.filter({ date: dateString }),
      base44.entities.Availability.filter({ week_start_date: weekStartStr }),
      base44.entities.Unavailability.filter({ date: dateString }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_types" }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" }),
      base44.entities.AppSettings.filter({ setting_key: "cart_columns" })
    ]);
    setWorkers(workersData);
    setCarts(cartsData);
    setAssignments(assignmentsData);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
    if (colTypesSettings.length > 0) setColumnTypes(JSON.parse(colTypesSettings[0].setting_value) || []);
    if (colSubTypesSettings.length > 0) setColumnSubTypes(JSON.parse(colSubTypesSettings[0].setting_value) || {});
    if (cartColsSettings.length > 0) setCartColumns(JSON.parse(cartColsSettings[0].setting_value) || {});
    setLoading(false);
  };

  const dateString = format(currentDate, "yyyy-MM-dd");
  
  const filteredWorkers = workers.filter(w => 
    w.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      updateData = { chef_id: workerId, chef_name: worker.full_name, chef_seniority: worker.seniority };
    } else if (selectedPosition.position === 'sous_chef') {
      updateData = { sous_chef_id: workerId, sous_chef_name: worker.full_name, sous_chef_seniority: worker.seniority };
    } else if (selectedPosition.position === 'additional') {
      updateData = { additional_chef_id: workerId, additional_chef_name: worker.full_name, additional_chef_role: worker.role };
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl" dir="rtl">לוח</CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center">{format(currentDate, "MMM d, yyyy")}</div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
                <Button variant="outline" onClick={handleExportToExcel} className="gap-2" dir="rtl">
                  <Download className="w-4 h-4" />
                  ייצא
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {carts.length === 0 ? (
          <Card className="border-none shadow-lg"><CardContent className="py-16 text-center" dir="rtl"><h3 className="text-xl font-semibold text-gray-900 mb-2">נדרשת הגדרה</h3><p className="text-gray-600">אנא הוסף עגלות מזון תחילה.</p></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {carts.map((cart) => {
              const cartAssignments = getCartAssignments(cart.id);
              const columns = cartColumns[cart.id] || [];
              
              return (
                <Card key={cart.id} className="border-none shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-lg">🚚 {cart.name}<span className="text-sm font-normal opacity-90">• {cart.location}</span></CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openAddColumnDialog(cart.id)}><Plus className="w-3 h-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => openAddShiftDialog(cart.id)} dir="rtl"><Plus className="w-4 h-4 mr-1" />משמרת</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]" dir="rtl">פעולות</TableHead>
                            {columns.map(col => (
                              <TableHead key={col} className="w-[100px]">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{col}</span>
                                  <button onClick={() => handleRemoveColumn(cart.id, col)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="w-[120px]" dir="rtl">נוסף</TableHead>
                            <TableHead className="w-[120px]" dir="rtl">עוזר טבח</TableHead>
                            <TableHead className="w-[120px]" dir="rtl">טבח ראשי</TableHead>
                            <TableHead className="w-[100px]" dir="rtl">שעה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cartAssignments.length === 0 ? (
                            <TableRow><TableCell colSpan={5 + columns.length} className="text-center text-gray-500 py-8" dir="rtl">אין משמרות. לחץ "משמרת" להוספה.</TableCell></TableRow>
                          ) : (
                            cartAssignments.map((assignment) => (
                              <TableRow key={assignment.id} className={assignment.has_trainee ? "bg-orange-50" : ""}>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAssignment(assignment)}><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteAssignment(assignment.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
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
                                  <button onClick={() => handlePositionClick(assignment, 'additional')} className="w-full text-left p-1 rounded border border-gray-200 hover:bg-blue-50">
                                    {assignment.additional_chef_name ? (
                                      <span className="text-xs font-medium truncate text-gray-900">{assignment.additional_chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400" dir="rtl">+ נוסף</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => handlePositionClick(assignment, 'sous_chef')} className={`w-full text-left p-1 rounded border hover:bg-blue-50 ${assignment.sous_chef_id && isWorkerUnavailable(assignment.sous_chef_id, assignment.start_time, assignment.end_time) ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                                    {assignment.sous_chef_name ? (
                                      <span className={`text-xs font-medium truncate ${getSeniorityColor(assignment.sous_chef_seniority)}`}>{assignment.sous_chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400" dir="rtl">+ עוזר</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => handlePositionClick(assignment, 'chef')} className={`w-full text-left p-1 rounded border hover:bg-blue-50 ${assignment.chef_id && isWorkerUnavailable(assignment.chef_id, assignment.start_time, assignment.end_time) ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                                    {assignment.chef_name ? (
                                      <span className={`text-xs font-medium truncate ${getSeniorityColor(assignment.chef_seniority)}`}>{assignment.chef_name}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400" dir="rtl">+ טבח</span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div className="text-sm">{assignment.start_time || "?"}-{assignment.end_time || "?"}</div>
                                  <div className="text-xs text-gray-500">{assignment.hours || 0}h</div>
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
        )}

        {/* Worker Dialog */}
        <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle dir="rtl">בחר {selectedPosition?.position === 'chef' ? 'טבח ראשי' : selectedPosition?.position === 'sous_chef' ? 'עוזר טבח' : 'נוסף'}</DialogTitle></DialogHeader>
            <div className="py-4">
              <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" dir="rtl" /></div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedPosition && filteredWorkers.filter(w => selectedPosition.position === 'additional' || (selectedPosition.position === 'chef' ? w.role === 'chef' : w.role === 'sous_chef')).map((worker) => {
                  const availInfo = currentAssignment ? getWorkerAvailabilityPriority(worker.id, currentAssignment.start_time, currentAssignment.end_time) : null;
                  const isUnavailable = currentAssignment ? isWorkerUnavailable(worker.id, currentAssignment.start_time, currentAssignment.end_time) : false;
                  return (
                    <button key={worker.id} onClick={() => handleWorkerSelect(worker.id)} className={`w-full p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-left ${isUnavailable ? "border-red-300 bg-red-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        {isUnavailable && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {availInfo?.type === "wanted" && <Star className="w-4 h-4 text-green-600 fill-green-600" />}
                        {availInfo?.type === "available" && <Check className="w-4 h-4 text-blue-600" />}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{worker.full_name}</div>
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
                })}
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
      </div>
    </div>
  );
}
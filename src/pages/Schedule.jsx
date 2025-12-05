import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChefHat, AlertTriangle, Plus, Trash2, Pencil, Clock, Hash } from "lucide-react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [globalParams, setGlobalParams] = useState([]);
  const [cartParams, setCartParams] = useState({});
  const [timeParamTypes, setTimeParamTypes] = useState([]);
  const [countParamTypes, setCountParamTypes] = useState([]);
  const [paramSubTypes, setParamSubTypes] = useState({});
  
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddShiftDialog, setShowAddShiftDialog] = useState(false);
  const [showAddParamDialog, setShowAddParamDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [paramDialogCartId, setParamDialogCartId] = useState(null);
  const [newParam, setNewParam] = useState({ category: "time", type: "" });
  
  const [editFormData, setEditFormData] = useState({
    start_time: "",
    end_time: "",
    hours: 4,
    notes: "",
    custom_params: {}
  });

  const [newShiftData, setNewShiftData] = useState({
    start_time: "06:00",
    end_time: "10:00"
  });

  useEffect(() => {
    loadData();
  }, [currentDate]);

  useEffect(() => {
    loadParamSettings();
  }, []);

  const loadParamSettings = async () => {
    const [globalSettings, cartParamsSettings, timeTypes, countTypes, subTypesSettings] = await Promise.all([
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.AppSettings.filter({ setting_key: "cart_specific_params" }),
      base44.entities.AppSettings.filter({ setting_key: "time_param_types" }),
      base44.entities.AppSettings.filter({ setting_key: "count_param_types" }),
      base44.entities.AppSettings.filter({ setting_key: "param_sub_types" })
    ]);
    if (globalSettings.length > 0) setGlobalParams(JSON.parse(globalSettings[0].setting_value) || []);
    if (cartParamsSettings.length > 0) setCartParams(JSON.parse(cartParamsSettings[0].setting_value) || {});
    if (timeTypes.length > 0) setTimeParamTypes(JSON.parse(timeTypes[0].setting_value) || []);
    if (countTypes.length > 0) setCountParamTypes(JSON.parse(countTypes[0].setting_value) || []);
    if (subTypesSettings.length > 0) setParamSubTypes(JSON.parse(subTypesSettings[0].setting_value) || {});
  };

  const loadData = async () => {
    const dateString = format(currentDate, "yyyy-MM-dd");
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    
    const [workersData, cartsData, assignmentsData, availabilitiesData, unavailabilitiesData] = await Promise.all([
      base44.entities.Worker.filter({ active: true }),
      base44.entities.FoodCart.filter({ active: true }),
      base44.entities.Assignment.filter({ date: dateString }),
      base44.entities.Availability.filter({ week_start_date: weekStartStr }),
      base44.entities.Unavailability.filter({ date: dateString })
    ]);
    setWorkers(workersData);
    setCarts(cartsData);
    setAssignments(assignmentsData);
    setAvailabilities(availabilitiesData);
    setUnavailabilities(unavailabilitiesData);
  };

  const dateString = format(currentDate, "yyyy-MM-dd");
  const filteredWorkers = workers.filter(w => 
    w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCartAssignments = (cartId) => {
    return assignments.filter(a => a.food_cart_id === cartId).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getCartParams = (cartId) => {
    const specific = cartParams[cartId] || [];
    return [...globalParams, ...specific];
  };

  const getNextShiftWindow = (cartId) => {
    const cartAssignments = getCartAssignments(cartId);
    if (cartAssignments.length === 0) return SHIFT_WINDOWS[0];
    const lastShift = cartAssignments[cartAssignments.length - 1];
    const currentIndex = SHIFT_WINDOWS.findIndex(w => w.start === lastShift.start_time);
    return SHIFT_WINDOWS[(currentIndex + 1) % SHIFT_WINDOWS.length];
  };

  const isWorkerUnavailable = (workerId, startTime, endTime) => {
    const workerUnavail = unavailabilities.filter(u => u.worker_id === workerId);
    const workerAvail = availabilities.find(a => a.worker_id === workerId && a.status === "approved");
    
    const hasUnavail = workerUnavail.some(u => {
      return (startTime >= u.start_time && startTime < u.end_time) ||
             (endTime > u.start_time && endTime <= u.end_time) ||
             (startTime <= u.start_time && endTime >= u.end_time);
    });
    
    if (hasUnavail) return true;
    
    if (workerAvail && workerAvail.shifts) {
      const shift = workerAvail.shifts.find(s => s.date === dateString && s.start_time === startTime && s.end_time === endTime);
      if (shift && shift.type === "unavailable") return true;
    }
    
    return false;
  };

  const getWorkerAvailabilityPriority = (workerId, startTime, endTime) => {
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
    let assignmentData = { ...currentAssignment };

    if (selectedPosition.position === 'chef') {
      assignmentData.chef_id = workerId;
      assignmentData.chef_name = worker.full_name;
      assignmentData.chef_seniority = worker.seniority;
    } else if (selectedPosition.position === 'sous_chef') {
      assignmentData.sous_chef_id = workerId;
      assignmentData.sous_chef_name = worker.full_name;
      assignmentData.sous_chef_seniority = worker.seniority;
    } else if (selectedPosition.position === 'additional') {
      assignmentData.additional_chef_id = workerId;
      assignmentData.additional_chef_name = worker.full_name;
      assignmentData.additional_chef_role = worker.role;
    }

    const allWorkers = [
      assignmentData.chef_id ? workers.find(w => w.id === assignmentData.chef_id) : null,
      assignmentData.sous_chef_id ? workers.find(w => w.id === assignmentData.sous_chef_id) : null,
      assignmentData.additional_chef_id ? workers.find(w => w.id === assignmentData.additional_chef_id) : null
    ].filter(Boolean);
    
    assignmentData.has_trainee = allWorkers.some(w => w.seniority === "trainee");

    await base44.entities.Assignment.update(currentAssignment.id, assignmentData);
    setShowWorkerDialog(false);
    setCurrentAssignment(null);
    setSelectedPosition(null);
    loadData();
  };

  const handleRemoveWorker = async () => {
    if (!currentAssignment) return;
    let assignmentData = { ...currentAssignment };

    if (selectedPosition.position === 'chef') {
      assignmentData.chef_id = null; assignmentData.chef_name = null; assignmentData.chef_seniority = null;
    } else if (selectedPosition.position === 'sous_chef') {
      assignmentData.sous_chef_id = null; assignmentData.sous_chef_name = null; assignmentData.sous_chef_seniority = null;
    } else if (selectedPosition.position === 'additional') {
      assignmentData.additional_chef_id = null; assignmentData.additional_chef_name = null; assignmentData.additional_chef_role = null;
    }

    const allWorkers = [
      assignmentData.chef_id ? workers.find(w => w.id === assignmentData.chef_id) : null,
      assignmentData.sous_chef_id ? workers.find(w => w.id === assignmentData.sous_chef_id) : null,
      assignmentData.additional_chef_id ? workers.find(w => w.id === assignmentData.additional_chef_id) : null
    ].filter(Boolean);
    
    assignmentData.has_trainee = allWorkers.some(w => w.seniority === "trainee");
    await base44.entities.Assignment.update(currentAssignment.id, assignmentData);
    setShowWorkerDialog(false);
    setCurrentAssignment(null);
    setSelectedPosition(null);
    loadData();
  };

  const handleEditAssignment = (assignment) => {
    setCurrentAssignment(assignment);
    setEditFormData({
      start_time: assignment.start_time,
      end_time: assignment.end_time,
      hours: assignment.hours,
      notes: assignment.notes || "",
      custom_params: assignment.custom_params || {}
    });
    setShowEditDialog(true);
  };

  const calculateHours = (start, end) => {
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
      custom_params: editFormData.custom_params
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
    const hours = calculateHours(newShiftData.start_time, newShiftData.end_time);
    await base44.entities.Assignment.create({
      date: dateString,
      food_cart_id: selectedCartId,
      food_cart_name: cart.name,
      start_time: newShiftData.start_time,
      end_time: newShiftData.end_time,
      hours,
      chef_id: null, chef_name: null, sous_chef_id: null, sous_chef_name: null,
      additional_chef_id: null, additional_chef_name: null,
      notes: "", has_trainee: false, custom_params: {}
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

  const openAddParamDialog = (cartId) => {
    setParamDialogCartId(cartId);
    setNewParam({ category: "time", type: "" });
    setShowAddParamDialog(true);
  };

  const handleAddParam = async () => {
    if (!newParam.type) return;
    
    const paramObj = { name: newParam.type, category: newParam.category };
    
    if (paramDialogCartId === "global") {
      const updated = [...globalParams, paramObj];
      setGlobalParams(updated);
      const settings = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
      const data = { setting_key: "custom_schedule_params", setting_value: JSON.stringify(updated) };
      if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
      else await base44.entities.AppSettings.create(data);
    } else {
      const updated = { ...cartParams, [paramDialogCartId]: [...(cartParams[paramDialogCartId] || []), paramObj] };
      setCartParams(updated);
      const settings = await base44.entities.AppSettings.filter({ setting_key: "cart_specific_params" });
      const data = { setting_key: "cart_specific_params", setting_value: JSON.stringify(updated) };
      if (settings.length > 0) await base44.entities.AppSettings.update(settings[0].id, data);
      else await base44.entities.AppSettings.create(data);
    }
    
    setShowAddParamDialog(false);
    setNewParam({ category: "time", type: "" });
  };

  const handleRemoveParam = async (cartId, paramName) => {
    if (cartId === "global") {
      const updated = globalParams.filter(p => p.name !== paramName);
      setGlobalParams(updated);
      const settings = await base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" });
      await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    } else {
      const updated = { ...cartParams, [cartId]: (cartParams[cartId] || []).filter(p => p.name !== paramName) };
      setCartParams(updated);
      const settings = await base44.entities.AppSettings.filter({ setting_key: "cart_specific_params" });
      await base44.entities.AppSettings.update(settings[0].id, { setting_value: JSON.stringify(updated) });
    }
  };

  const handleUpdateParamValue = async (assignmentId, paramName, value, subType) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    const updatedParams = { ...assignment.custom_params, [paramName]: { value, subType } };
    await base44.entities.Assignment.update(assignmentId, { custom_params: updatedParams });
    loadData();
  };

  const getParamIcon = (param) => {
    if (param.category === "time") return <Clock className="w-3 h-3" />;
    return <Hash className="w-3 h-3" />;
  };

  const allTypes = [...timeParamTypes, ...countParamTypes];

  const WorkerCell = ({ workerId, workerName, seniority, position, assignment }) => {
    const isUnavailable = workerId && isWorkerUnavailable(workerId, assignment.start_time, assignment.end_time);
    return (
      <button onClick={() => handlePositionClick(assignment, position)} className={`w-full text-left p-1 rounded border hover:bg-blue-50 transition-all ${isUnavailable ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
        <div className="flex items-center gap-1">
          {isUnavailable && <TooltipProvider><Tooltip><TooltipTrigger><AlertTriangle className="w-3 h-3 text-red-500" /></TooltipTrigger><TooltipContent><p className="text-xs">Worker unavailable</p></TooltipContent></Tooltip></TooltipProvider>}
          {workerName ? (
            <span className={`text-xs font-medium truncate ${seniority === "newbie" ? "text-blue-600" : seniority === "trainee" ? "text-orange-600" : "text-gray-900"}`}>{workerName}</span>
          ) : (
            <span className="text-xs text-gray-400">+ {position === 'chef' ? 'Chef' : position === 'sous_chef' ? 'S.Chef' : 'Add'}</span>
          )}
        </div>
      </button>
    );
  };

  const ParamCell = ({ assignment, param }) => {
    const [open, setOpen] = useState(false);
    const paramData = assignment.custom_params?.[param.name];
    const initialValue = typeof paramData === 'object' ? (paramData?.value || "") : (paramData || "");
    const [value, setValue] = useState(initialValue);
    const initialSubType = typeof paramData === 'object' ? (paramData?.subType || "") : "";
    const [subType, setSubType] = useState(initialSubType);
    
    const subTypes = paramSubTypes[param.name] || [];
    
    const handleSave = async () => {
      await handleUpdateParamValue(assignment.id, param.name, value, subType);
      setOpen(false);
    };

    const displayValue = typeof assignment.custom_params?.[param.name] === 'object' 
      ? assignment.custom_params?.[param.name]?.value 
      : assignment.custom_params?.[param.name];
    const displaySubType = assignment.custom_params?.[param.name]?.subType;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-full text-left p-1 rounded border border-gray-200 hover:bg-blue-50 min-h-[28px]">
            <span className="text-xs">{displayValue || "-"}</span>
            {displaySubType && <span className="text-[10px] text-gray-400 ml-1">({displaySubType})</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Value</Label>
              <Input className="h-7 text-xs" type={param.category === "time" ? "number" : "text"} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            {subTypes.length > 0 && (
              <div>
                <Label className="text-xs">Sub-type</Label>
                <Select value={subType} onValueChange={setSubType}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {subTypes.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave}>Save</Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl">Daily Schedule</CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[160px] text-center">{format(currentDate, "MMM d, yyyy")}</div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => openAddParamDialog("global")} title="Add Global Parameter"><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {carts.length === 0 ? (
          <Card className="border-none shadow-lg"><CardContent className="py-16 text-center"><h3 className="text-xl font-semibold text-gray-900 mb-2">Setup Required</h3><p className="text-gray-600">Please add food carts first.</p></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {carts.map((cart) => {
              const cartAssignments = getCartAssignments(cart.id);
              const params = getCartParams(cart.id);
              
              return (
                <Card key={cart.id} className="border-none shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2 text-lg">🚚 {cart.name}<span className="text-sm font-normal opacity-90">• {cart.location}</span></CardTitle>
                      <Button size="sm" variant="secondary" onClick={() => openAddShiftDialog(cart.id)}><Plus className="w-4 h-4 mr-1" />Add Shift</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Time</TableHead>
                            <TableHead className="w-[120px]">Chef</TableHead>
                            <TableHead className="w-[120px]">Sous-Chef</TableHead>
                            <TableHead className="w-[120px]">Additional</TableHead>
                            {params.map(param => (
                              <TableHead key={param.name} className="w-[100px]">
                                <div className="flex items-center gap-1">
                                  {getParamIcon(param)}<span className="truncate">{param.name}</span>
                                  <button onClick={() => handleRemoveParam(globalParams.find(p => p.name === param.name) ? "global" : cart.id, param.name)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </TableHead>
                            ))}
                            <TableHead className="w-[80px]">
                              <div className="flex items-center gap-1">
                                Actions
                                <button onClick={() => openAddParamDialog(cart.id)} className="text-gray-400 hover:text-blue-600"><Plus className="w-3 h-3" /></button>
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cartAssignments.length === 0 ? (
                            <TableRow><TableCell colSpan={5 + params.length} className="text-center text-gray-500 py-8">No shifts. Click "Add Shift".</TableCell></TableRow>
                          ) : (
                            cartAssignments.map((assignment) => (
                              <TableRow key={assignment.id} className={assignment.has_trainee ? "bg-orange-50" : ""}>
                                <TableCell className="font-medium"><div className="text-sm">{assignment.start_time}-{assignment.end_time}</div><div className="text-xs text-gray-500">{assignment.hours}h</div></TableCell>
                                <TableCell><WorkerCell workerId={assignment.chef_id} workerName={assignment.chef_name} seniority={assignment.chef_seniority} position="chef" assignment={assignment} /></TableCell>
                                <TableCell><WorkerCell workerId={assignment.sous_chef_id} workerName={assignment.sous_chef_name} seniority={assignment.sous_chef_seniority} position="sous_chef" assignment={assignment} /></TableCell>
                                <TableCell><WorkerCell workerId={assignment.additional_chef_id} workerName={assignment.additional_chef_name} seniority={null} position="additional" assignment={assignment} /></TableCell>
                                {params.map(param => (<TableCell key={param.name}><ParamCell assignment={assignment} param={param} /></TableCell>))}
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
        )}

        {/* Worker Dialog */}
        <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Select {selectedPosition?.position === 'chef' ? 'Chef' : selectedPosition?.position === 'sous_chef' ? 'Sous-Chef' : 'Additional'}</DialogTitle></DialogHeader>
            <div className="py-4">
              <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedPosition && filteredWorkers.filter(w => selectedPosition.position === 'additional' || (selectedPosition.position === 'chef' ? w.role === 'chef' : w.role === 'sous_chef')).sort((a, b) => {
                  const aInfo = getWorkerAvailabilityPriority(a.id, currentAssignment?.start_time, currentAssignment?.end_time);
                  const bInfo = getWorkerAvailabilityPriority(b.id, currentAssignment?.start_time, currentAssignment?.end_time);
                  if (aInfo?.type === "wanted" && bInfo?.type !== "wanted") return -1;
                  if (bInfo?.type === "wanted" && aInfo?.type !== "wanted") return 1;
                  if (aInfo?.type === "available" && !bInfo) return -1;
                  if (bInfo?.type === "available" && !aInfo) return 1;
                  if (!aInfo && !bInfo) return 0;
                  if (!aInfo) return 1;
                  if (!bInfo) return -1;
                  return aInfo.priority - bInfo.priority;
                }).map((worker) => {
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
                            <Badge variant="outline" className="text-xs">{worker.seniority}</Badge>
                            {worker.is_guide && <Badge className="text-xs bg-yellow-100 text-yellow-800">Guide</Badge>}
                            {availInfo && <Badge variant="outline" className="text-xs capitalize">{availInfo.type} #{availInfo.priority}</Badge>}
                            {isUnavailable && <Badge className="text-xs bg-red-100 text-red-800">Unavailable</Badge>}
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
                <Button variant="destructive" onClick={handleRemoveWorker}>Remove Worker</Button>
              )}
              <Button variant="outline" onClick={() => setShowWorkerDialog(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Shift</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Time</Label><Input type="time" value={editFormData.start_time} onChange={(e) => setEditFormData({ ...editFormData, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={editFormData.end_time} onChange={(e) => setEditFormData({ ...editFormData, end_time: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} className="bg-blue-900 hover:bg-blue-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Shift Dialog */}
        <Dialog open={showAddShiftDialog} onOpenChange={setShowAddShiftDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add New Shift</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Time</Label><Input type="time" value={newShiftData.start_time} onChange={(e) => setNewShiftData({ ...newShiftData, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={newShiftData.end_time} onChange={(e) => setNewShiftData({ ...newShiftData, end_time: e.target.value })} /></div>
              </div>
              <div className="flex flex-wrap gap-2"><p className="text-sm text-gray-600 w-full">Quick select:</p>
                {SHIFT_WINDOWS.map(w => (<Button key={w.start} variant="outline" size="sm" onClick={() => setNewShiftData({ start_time: w.start, end_time: w.end })} className={newShiftData.start_time === w.start ? "border-blue-500 bg-blue-50" : ""}>{w.start}-{w.end}</Button>))}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddShiftDialog(false)}>Cancel</Button><Button onClick={handleAddShift} className="bg-blue-900 hover:bg-blue-800">Add Shift</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Param Dialog */}
        <Dialog open={showAddParamDialog} onOpenChange={setShowAddParamDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Parameter {paramDialogCartId === "global" ? "(Global)" : "(Cart Specific)"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Category</Label>
                <Select value={newParam.category} onValueChange={(v) => setNewParam({ ...newParam, category: v, type: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time"><Clock className="w-3 h-3 inline mr-1" />Time (sums hours)</SelectItem>
                    <SelectItem value="count"><Hash className="w-3 h-3 inline mr-1" />Count (sums values)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type (from Settings)</Label>
                <Select value={newParam.type} onValueChange={(v) => setNewParam({ ...newParam, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {(newParam.category === "time" ? timeParamTypes : countParamTypes).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    {(newParam.category === "time" ? timeParamTypes : countParamTypes).length === 0 && (
                      <div className="p-2 text-xs text-gray-500">No types defined. Add them in Settings.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddParamDialog(false)}>Cancel</Button><Button onClick={handleAddParam} disabled={!newParam.type} className="bg-blue-900 hover:bg-blue-800">Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
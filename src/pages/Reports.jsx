import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Users, Calendar, ChefHat, ArrowUpDown, Calculator, Settings, Hash } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { getSeniorityInfo } from "../components/utils/SeniorityUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ['#1e3a5f', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function Reports() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [carts, setCarts] = useState([]);
  const [globalParams, setGlobalParams] = useState([]);
  const [cartParams, setCartParams] = useState({});
  const [loading, setLoading] = useState(true);

  const [sortConfig, setSortConfig] = useState({ key: 'totalHours', direction: 'desc' });
  const [fullTimeHours, setFullTimeHours] = useState(0);
  const [fullTimeShifts, setFullTimeShifts] = useState(0);
  const [columnSubTypes, setColumnSubTypes] = useState({});
  const [dateFilterMode, setDateFilterMode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workerFilters, setWorkerFilters] = useState({
    guide: '__all__',
    role: '__all__',
    status: '__all__',
    population: '__all__'
  });
  const [shiftStatuses, setShiftStatuses] = useState([]);
  const [populations, setPopulations] = useState([]);
  const [workerRoles, setWorkerRoles] = useState([]);
  const [allTemplateRows, setAllTemplateRows] = useState([]);
  const [allTemplatesForReport, setAllTemplatesForReport] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(null); // null = all visible
  const [manualWorkerIds, setManualWorkerIds] = useState(null); // null = show all
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [workersData, assignmentsData, cartsData, globalSettings, cartParamsSettings, colSubTypesSettings, shiftStatusesSettings, populationsSettings, workerRolesSettings, templateRowsData, templatesData] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Assignment.list("-date"),
      base44.entities.FoodCart.list(),
      base44.entities.AppSettings.filter({ setting_key: "custom_schedule_params" }),
      base44.entities.AppSettings.filter({ setting_key: "cart_specific_params" }),
      base44.entities.AppSettings.filter({ setting_key: "schedule_column_subtypes" }),
      base44.entities.AppSettings.filter({ setting_key: "shift_statuses" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_populations" }),
      base44.entities.AppSettings.filter({ setting_key: "worker_roles" }),
      base44.entities.TemplateRow.list(),
      base44.entities.Template.filter({ active: true })
    ]);
    setWorkers(workersData);
    setAssignments(assignmentsData);
    setCarts(cartsData);
    setAllTemplateRows(templateRowsData);
    setAllTemplatesForReport(templatesData);
    if (globalSettings.length > 0) setGlobalParams(JSON.parse(globalSettings[0].setting_value) || []);
    if (cartParamsSettings.length > 0) setCartParams(JSON.parse(cartParamsSettings[0].setting_value) || {});
    if (colSubTypesSettings.length > 0) setColumnSubTypes(JSON.parse(colSubTypesSettings[0].setting_value) || {});
    if (shiftStatusesSettings.length > 0) setShiftStatuses(JSON.parse(shiftStatusesSettings[0].setting_value) || []);
    if (populationsSettings.length > 0) setPopulations(JSON.parse(populationsSettings[0].setting_value) || []);
    if (workerRolesSettings.length > 0) setWorkerRoles(JSON.parse(workerRolesSettings[0].setting_value) || []);
    setLoading(false);
  };

  const getAllParams = () => {
    const all = [...globalParams];
    Object.values(cartParams).forEach(params => {
      params.forEach(p => {
        if (!all.find(a => a.name === p.name)) all.push(p);
      });
    });
    return all;
  };

  const getLastShiftDate = (workerId) => {
    const workerAssignments = assignments.filter(a => a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId);
    if (workerAssignments.length === 0) return null;
    return workerAssignments.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
  };

  const workerHours = workers.map(worker => {
    const workerAssignments = assignments.filter(a => a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id);
    const totalHours = workerAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
    const totalShifts = workerAssignments.length;
    return {
      id: worker.id,
      name: worker.nickname,
      role: worker.role,
      seniority: worker.seniority,
      population: worker.population,
      totalHours,
      shifts: totalShifts,
      lastShift: getLastShiftDate(worker.id),
      active: worker.active,
      avgHoursPerShift: totalShifts > 0 ? totalHours / totalShifts : 0
    };
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedWorkerHours = [...workerHours].sort((a, b) => {
    if (sortConfig.direction === 'asc') return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1;
    return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1;
  });

  const chartData = workerHours.sort((a, b) => b.totalHours - a.totalHours).slice(0, 10).map(w => ({ name: w.name, hours: w.totalHours }));

  const roleData = workerRoles.map(role => ({
    name: role,
    value: workers.filter(w => w.role === role && w.active).length
  })).filter(item => item.value > 0);

  const totalHours = assignments.reduce((sum, a) => sum + (a.hours || 0), 0);
  const totalShiftsNeeded = assignments.length;
  const mannedShifts = assignments.filter(a => a.chef_id && a.sous_chef_id).length;
  const coveragePercentage = totalShiftsNeeded > 0 ? ((mannedShifts / totalShiftsNeeded) * 100).toFixed(1) : 0;
  const totalHoursNeeded = totalHours;
  const mannedHours = assignments.filter(a => a.chef_id && a.sous_chef_id).reduce((sum, a) => sum + (a.hours || 0), 0);
  const hoursCoveragePercentage = totalHoursNeeded > 0 ? ((mannedHours / totalHoursNeeded) * 100).toFixed(1) : 0;

  const fullTimeWorkers = workers.filter(w => w.is_full_time && w.active);
  const fullTimeWorkerCount = fullTimeWorkers.length;
  const fullTimeHoursTotal = workerHours.filter(w => w.isFullTime).reduce((sum, w) => sum + w.totalHours, 0);
  const fullTimeShiftsTotal = workerHours.filter(w => w.isFullTime).reduce((sum, w) => sum + w.shifts, 0);
  const partTimeHoursNeeded = totalHoursNeeded - fullTimeHoursTotal;
  const partTimeShiftsNeeded = totalShiftsNeeded - fullTimeShiftsTotal;
  const manualPartTimeHours = totalHoursNeeded - (fullTimeHours || 0);
  const manualPartTimeShifts = totalShiftsNeeded - (fullTimeShifts || 0);

  // Get param summary by worker
  const getParamSummaryByWorker = (param) => {
        const summary = {};
        workers.forEach(worker => {
          const workerAssignments = assignments.filter(a => a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id);
          const values = workerAssignments.filter(a => a.custom_params?.[param.name]).map(a => {
            const val = a.custom_params[param.name];
            return typeof val === 'object' ? val.value : val;
          });

          const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
          summary[worker.id] = numericValues.reduce((a, b) => a + b, 0);
        });
        return summary;
      };

  const allParams = getAllParams();

  // Helper: parse hours from start/end time strings
  const calcHoursFromTimes = (start, end) => {
    if (!start || !end) return 0;
    const endMatch = end.match(/^\+(\d+)\s+(\d{2}):(\d{2})$/);
    const [startH, startM] = start.split(':').map(Number);
    if (endMatch) {
      const extraDays = parseInt(endMatch[1]);
      const endH = parseInt(endMatch[2]);
      const endMin = parseInt(endMatch[3]);
      return extraDays * 24 + endH + endMin / 60 - startH - startM / 60;
    }
    const [endH, endM] = end.split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff < 0) diff += 24;
    return Math.round(diff * 10) / 10;
  };

  // All unique worker column names across templates
  const allWorkerColumnNames = [...new Set(
    allTemplatesForReport.flatMap(t =>
      (t.columns || []).filter(c => c.type === 'worker').map(c => c.name)
    )
  )];

  const effectiveVisibleColumns = visibleColumns || allWorkerColumnNames;

  // Compute hours per worker per column from TemplateRows
  const getWorkerColumnHoursMap = () => {
    const dateRange = getDateRange();
    const result = {};
    allTemplateRows.forEach(row => {
      if (dateRange && (row.date < dateRange.start || row.date > dateRange.end)) return;
      const template = allTemplatesForReport.find(t => t.id === row.template_id);
      if (!template) return;
      const startTime = row.values?.['התחלה'] || row.values?.['שעת התחלה'] || '';
      const endTime = row.values?.['סיום'] || row.values?.['שעת סיום'] || '';
      const hours = calcHoursFromTimes(startTime, endTime);
      (template.columns || []).forEach(col => {
        if (col.type !== 'worker') return;
        const workerId = row.values?.[col.name];
        if (!workerId) return;
        if (!result[workerId]) result[workerId] = {};
        result[workerId][col.name] = (result[workerId][col.name] || 0) + hours;
      });
    });
    return result;
  };

  const workerColumnHoursMap = getWorkerColumnHoursMap();

  const getDateRange = () => {
    const today = new Date();
    let start, end;
    
    if (dateFilterMode === 'daily') {
      start = end = format(today, 'yyyy-MM-dd');
    } else if (dateFilterMode === 'week') {
      const wStart = startOfWeek(today, { weekStartsOn: 0 });
      const wEnd = endOfWeek(today, { weekStartsOn: 0 });
      start = format(wStart, 'yyyy-MM-dd');
      end = format(wEnd, 'yyyy-MM-dd');
    } else if (dateFilterMode === 'month') {
      const mStart = startOfMonth(today);
      const mEnd = endOfMonth(today);
      start = format(mStart, 'yyyy-MM-dd');
      end = format(mEnd, 'yyyy-MM-dd');
    } else if (dateFilterMode === 'half_year') {
      const halfStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 6) * 6, 1);
      const halfEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 6) * 6 + 6, 0);
      start = format(halfStart, 'yyyy-MM-dd');
      end = format(halfEnd, 'yyyy-MM-dd');
    } else if (dateFilterMode === 'custom') {
      if (!startDate || !endDate) return null;
      start = startDate;
      end = endDate;
    } else {
      return null;
    }
    
    return { start, end };
  };

  // Calculate hours per subtype per worker
  const getWorkerHoursBySubType = (workerId, subType) => {
    const dateRange = getDateRange();
    const workerAssignments = assignments.filter(a => {
      if (!(a.chef_id === workerId || a.sous_chef_id === workerId || a.additional_chef_id === workerId)) return false;
      if (dateRange && (a.date < dateRange.start || a.date > dateRange.end)) return false;
      if (workerFilters.status !== '__all__' && a.status !== workerFilters.status) return false;
      return true;
    });
    let totalHours = 0;
    workerAssignments.forEach(a => {
      if (a.column_values) {
        Object.values(a.column_values).forEach(col => {
          const subs = col.subTypes || (col.subType ? [col.subType] : []);
          if (subs.includes(subType)) {
            totalHours += (a.hours || 0);
          }
        });
      }
    });
    return totalHours;
  };

  const filteredWorkersForTable = workers.filter(w => {
    if (!w.active) return false;
    if (manualWorkerIds !== null && !manualWorkerIds.includes(w.id)) return false;
    if (workerFilters.guide !== '__all__' && (workerFilters.guide === 'yes' ? !w.is_guide : w.is_guide)) return false;
    if (workerFilters.role !== '__all__' && w.role !== workerFilters.role) return false;
    if (workerFilters.population !== '__all__' && w.population !== workerFilters.population) return false;
    return true;
  });

  const SortButton = ({ column, label }) => (
    <Button variant="ghost" size="sm" className="h-8 hover:bg-gray-100" onClick={() => handleSort(column)} dir="rtl">
      {label}<ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">דוחות וניתוחים</h1>
          <p className="text-gray-600" dir="rtl">שעות עבודה ומדדי ביצוע הצוות</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div><p className="text-sm text-gray-600" dir="rtl">סה"כ שעות עבודה</p><p className="text-3xl font-bold text-gray-900 mt-1">{totalHours}</p></div>
                <div className="p-3 rounded-xl bg-blue-900 bg-opacity-15"><Clock className="w-6 h-6 text-blue-900" /></div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div><p className="text-sm text-gray-600" dir="rtl">כיסוי משמרות</p><p className="text-3xl font-bold text-gray-900 mt-1">{coveragePercentage}%</p><p className="text-xs text-gray-500 mt-1" dir="rtl">{mannedShifts}/{totalShiftsNeeded} משמרות</p></div>
                <div className="p-3 rounded-xl bg-green-600 bg-opacity-15"><TrendingUp className="w-6 h-6 text-green-600" /></div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div><p className="text-sm text-gray-600" dir="rtl">כיסוי שעות</p><p className="text-3xl font-bold text-gray-900 mt-1">{hoursCoveragePercentage}%</p><p className="text-xs text-gray-500 mt-1" dir="rtl">{mannedHours}/{totalHoursNeeded} שעות</p></div>
                <div className="p-3 rounded-xl bg-amber-500 bg-opacity-15"><Clock className="w-6 h-6 text-amber-600" /></div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div><p className="text-sm text-gray-600" dir="rtl">עובדים במשרה מלאה</p><p className="text-3xl font-bold text-gray-900 mt-1">{fullTimeWorkerCount}</p></div>
                <div className="p-3 rounded-xl bg-purple-600 bg-opacity-15"><Users className="w-6 h-6 text-purple-600" /></div>
              </div>
            </CardHeader>
          </Card>
        </div>



        {/* Hours by Worker Column */}
        {allWorkerColumnNames.length > 0 && (
          <Card className="border-none shadow-lg mb-8">
            <CardHeader className="border-b">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2" dir="rtl"><Clock className="w-5 h-5 text-green-600" />שעות לפי תפקיד במשמרת</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {['all','daily','week','month','half_year','custom'].map(mode => (
                    <Button key={mode} variant={dateFilterMode === mode ? 'default' : 'outline'} size="sm" onClick={() => setDateFilterMode(mode)} dir="rtl">
                      {mode === 'all' ? 'כל הזמן' : mode === 'daily' ? 'היום' : mode === 'week' ? 'השבוע' : mode === 'month' ? 'החודש' : mode === 'half_year' ? 'חצי שנה' : 'מותאם אישית'}
                    </Button>
                  ))}
                </div>
              </div>

              {dateFilterMode === 'custom' && (
                <div className="flex gap-2 mt-3">
                  <div><Label className="text-xs" dir="rtl">תאריך התחלה</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8" /></div>
                  <div><Label className="text-xs" dir="rtl">תאריך סיום</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8" /></div>
                </div>
              )}

              {/* Filters row */}
              <div className="flex gap-2 mt-3 flex-wrap items-center">
                <Select value={workerFilters.population} onValueChange={(v) => setWorkerFilters({...workerFilters, population: v})}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" dir="rtl">כל האוכלוסיות</SelectItem>
                    {populations.map(p => <SelectItem key={p} value={p} dir="rtl">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={workerFilters.role} onValueChange={(v) => setWorkerFilters({...workerFilters, role: v})}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" dir="rtl">כל התפקידים</SelectItem>
                    {workerRoles.map(r => <SelectItem key={r} value={r} dir="rtl">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={workerFilters.guide} onValueChange={(v) => setWorkerFilters({...workerFilters, guide: v})}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" dir="rtl">כל המדריכים</SelectItem>
                    <SelectItem value="yes" dir="rtl">מדריכים בלבד</SelectItem>
                    <SelectItem value="no" dir="rtl">לא מדריכים</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant={manualWorkerIds !== null ? 'default' : 'outline'} size="sm" onClick={() => setShowWorkerPicker(!showWorkerPicker)} dir="rtl">
                  {manualWorkerIds !== null ? `${manualWorkerIds.length} עובדים נבחרו` : 'בחר עובדים ידנית'}
                </Button>
                {manualWorkerIds !== null && (
                  <Button variant="ghost" size="sm" onClick={() => setManualWorkerIds(null)} dir="rtl">נקה בחירה</Button>
                )}
              </div>

              {/* Manual worker picker */}
              {showWorkerPicker && (
                <div className="mt-3 p-3 border rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {workers.filter(w => w.active).map(w => {
                      const selected = manualWorkerIds === null || manualWorkerIds.includes(w.id);
                      return (
                        <button key={w.id}
                          onClick={() => {
                            const current = manualWorkerIds || workers.filter(x => x.active).map(x => x.id);
                            if (current.includes(w.id)) {
                              setManualWorkerIds(current.filter(id => id !== w.id));
                            } else {
                              setManualWorkerIds([...current, w.id]);
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${selected ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-300'}`}
                        >{w.nickname}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Column toggle */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1" dir="rtl">הצג/הסתר עמודות:</p>
                <div className="flex flex-wrap gap-2">
                  {allWorkerColumnNames.map(col => {
                    const visible = effectiveVisibleColumns.includes(col);
                    return (
                      <button key={col}
                        onClick={() => {
                          const current = effectiveVisibleColumns;
                          if (visible) {
                            setVisibleColumns(current.filter(c => c !== col));
                          } else {
                            setVisibleColumns([...current, col]);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${visible ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-400 border-gray-200'}`}
                      >{col}</button>
                    );
                  })}
                  <button onClick={() => setVisibleColumns(null)} className="px-2 py-1 rounded text-xs border bg-gray-100 text-gray-600 border-gray-300">הצג הכל</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead dir="rtl">עובד</TableHead>
                      {effectiveVisibleColumns.map(col => <TableHead key={col} dir="rtl">{col}</TableHead>)}
                      <TableHead dir="rtl">סה"כ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkersForTable.map(worker => {
                      const colData = workerColumnHoursMap[worker.id] || {};
                      const total = effectiveVisibleColumns.reduce((sum, col) => sum + (colData[col] || 0), 0);
                      if (total === 0 && Object.keys(colData).length === 0) return null;
                      return (
                        <TableRow key={worker.id}>
                          <TableCell className="font-medium">{worker.nickname}</TableCell>
                          {effectiveVisibleColumns.map(col => (
                            <TableCell key={col}>{colData[col] ? `${colData[col]}h` : '-'}</TableCell>
                          ))}
                          <TableCell className="font-semibold text-blue-900">{total > 0 ? `${Math.round(total * 10) / 10}h` : '-'}</TableCell>
                        </TableRow>
                      );
                    }).filter(Boolean)}
                    <TableRow className="bg-gray-100 font-semibold">
                      <TableCell dir="rtl">סה"כ</TableCell>
                      {effectiveVisibleColumns.map(col => {
                        const total = filteredWorkersForTable.reduce((sum, w) => sum + (workerColumnHoursMap[w.id]?.[col] || 0), 0);
                        return <TableCell key={col}>{total > 0 ? `${Math.round(total * 10) / 10}h` : '-'}</TableCell>;
                      })}
                      <TableCell>{Math.round(filteredWorkersForTable.reduce((sum, w) => sum + effectiveVisibleColumns.reduce((s2, col) => s2 + (workerColumnHoursMap[w.id]?.[col] || 0), 0), 0) * 10) / 10}h</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b"><CardTitle dir="rtl">שעות לפי עובד</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#1e3a5f" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b"><CardTitle dir="rtl">הרכב צוות</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={100} dataKey="value">
                    {roleData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="border-b"><CardTitle className="flex items-center gap-2" dir="rtl"><Calendar className="w-5 h-5 text-blue-900" />מטריצת שעות - כל העובדים</CardTitle></CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead><SortButton column="name" label='שם עובד' /></TableHead>
                    <TableHead><SortButton column="role" label='תפקיד' /></TableHead>
                    <TableHead><SortButton column="seniority" label='וותק' /></TableHead>
                    <TableHead><SortButton column="population" label='אוכלוסיה' /></TableHead>
                    <TableHead><SortButton column="totalHours" label='סה"כ שעות' /></TableHead>
                    <TableHead><SortButton column="shifts" label='סה"כ משמרות' /></TableHead>
                    <TableHead><SortButton column="avgHoursPerShift" label='ממוצע שעות/משמרת' /></TableHead>
                    <TableHead><SortButton column="lastShift" label='משמרת אחרונה' /></TableHead>
                    <TableHead><SortButton column="active" label='סטטוס' /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedWorkerHours.map((worker) => (
                    <TableRow key={worker.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-900" dir="rtl">{worker.role || '-'}</Badge></TableCell>
                      <TableCell><Badge className={getSeniorityInfo(worker.seniority).color}>{getSeniorityInfo(worker.seniority).label}</Badge></TableCell>
                      <TableCell><Badge className="bg-orange-100 text-orange-800" dir="rtl">{worker.population || '-'}</Badge></TableCell>
                      <TableCell className="font-semibold text-blue-900">{worker.totalHours}h</TableCell>
                      <TableCell>{worker.shifts}</TableCell>
                      <TableCell>{worker.avgHoursPerShift.toFixed(1)}h</TableCell>
                      <TableCell>{worker.lastShift ? <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-gray-400" /><span className="text-sm">{format(parseISO(worker.lastShift), "MMM d, yyyy")}</span></div> : <span className="text-sm text-gray-400" dir="rtl">אין משמרות</span>}</TableCell>
                      <TableCell><Badge variant={worker.active ? "default" : "secondary"} dir="rtl">{worker.active ? "פעיל" : "לא פעיל"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
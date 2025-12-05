import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, TrendingUp } from "lucide-react";
import { format, startOfYear, endOfYear, eachMonthOfInterval, isWithinInterval, parseISO } from "date-fns";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Yearly() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    setLoading(true);
    const [workersData, assignmentsData, cartsData] = await Promise.all([
      base44.entities.Worker.list(),
      base44.entities.Assignment.list("-date"),
      base44.entities.FoodCart.list()
    ]);
    
    // Filter assignments for current year
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const yearAssignments = assignmentsData.filter(a => a.date >= yearStart && a.date <= yearEnd);
    
    setWorkers(workersData);
    setAssignments(yearAssignments);
    setCarts(cartsData);
    setLoading(false);
  };

  const getMonthlyHours = () => {
    const monthlyData = MONTHS.map((month, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const monthAssignments = assignments.filter(a => a.date.startsWith(`${currentYear}-${monthNum}`));
      const totalHours = monthAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
      const totalShifts = monthAssignments.length;
      return { month, hours: totalHours, shifts: totalShifts };
    });
    return monthlyData;
  };

  const getWorkerYearlyStats = () => {
    return workers.map(worker => {
      const workerAssignments = assignments.filter(a => 
        a.chef_id === worker.id || a.sous_chef_id === worker.id || a.additional_chef_id === worker.id
      );
      
      const monthlyHours = MONTHS.map((_, idx) => {
        const monthNum = String(idx + 1).padStart(2, '0');
        const monthAssignments = workerAssignments.filter(a => a.date.startsWith(`${currentYear}-${monthNum}`));
        return monthAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
      });
      
      const totalHours = monthlyHours.reduce((sum, h) => sum + h, 0);
      const totalShifts = workerAssignments.length;
      
      return {
        id: worker.id,
        name: worker.full_name,
        role: worker.role,
        isFullTime: worker.is_full_time,
        active: worker.active,
        monthlyHours,
        totalHours,
        totalShifts
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  };

  const monthlyData = getMonthlyHours();
  const workerStats = getWorkerYearlyStats();
  const totalYearHours = monthlyData.reduce((sum, m) => sum + m.hours, 0);
  const totalYearShifts = monthlyData.reduce((sum, m) => sum + m.shifts, 0);
  const avgMonthlyHours = totalYearHours / 12;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Yearly Overview</h1>
          <p className="text-gray-600">Annual hours and shift statistics</p>
        </div>

        {/* Year Selector */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-900" />
                Year View
              </CardTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold min-w-[100px] text-center">
                  {currentYear}
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setCurrentYear(new Date().getFullYear())}>
                  This Year
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalYearHours.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-900 bg-opacity-15">
                  <Clock className="w-6 h-6 text-blue-900" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Total Shifts</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalYearShifts.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-600 bg-opacity-15">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Avg Monthly Hours</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{avgMonthlyHours.toFixed(0)}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500 bg-opacity-15">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Active Workers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{workers.filter(w => w.active).length}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-600 bg-opacity-15">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Monthly Chart */}
        <Card className="border-none shadow-lg mb-8">
          <CardHeader className="border-b">
            <CardTitle>Monthly Hours Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'hours' ? 'Hours' : 'Shifts']}
                  labelFormatter={(label) => `${label} ${currentYear}`}
                />
                <Bar dataKey="hours" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Worker Yearly Matrix */}
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b">
            <CardTitle>Worker Hours by Month</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="sticky left-0 bg-gray-50 z-10">Worker</TableHead>
                    <TableHead>Type</TableHead>
                    {MONTHS.map(month => (
                      <TableHead key={month} className="text-center min-w-[60px]">{month}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total</TableHead>
                    <TableHead className="text-center">Shifts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : workerStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-gray-500">No data for {currentYear}</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {workerStats.map((worker) => (
                        <TableRow key={worker.id} className={!worker.active ? "opacity-50" : ""}>
                          <TableCell className="sticky left-0 bg-white font-medium">
                            {worker.name}
                            {!worker.active && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={worker.isFullTime ? "default" : "outline"} className={worker.isFullTime ? "bg-green-600" : ""}>
                              {worker.isFullTime ? "FT" : "PT"}
                            </Badge>
                          </TableCell>
                          {worker.monthlyHours.map((hours, idx) => (
                            <TableCell key={idx} className={`text-center ${hours > 0 ? "text-gray-900" : "text-gray-300"}`}>
                              {hours > 0 ? hours : "-"}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold text-blue-900">{worker.totalHours}</TableCell>
                          <TableCell className="text-center text-gray-600">{worker.totalShifts}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-100 font-semibold">
                        <TableCell className="sticky left-0 bg-gray-100">Total</TableCell>
                        <TableCell></TableCell>
                        {monthlyData.map((m, idx) => (
                          <TableCell key={idx} className="text-center">{m.hours}</TableCell>
                        ))}
                        <TableCell className="text-center text-blue-900">{totalYearHours}</TableCell>
                        <TableCell className="text-center">{totalYearShifts}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Worker } from "@/entities/Worker";
import { FoodCart } from "@/entities/FoodCart";
import { Assignment } from "@/entities/Assignment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, Clock, TrendingUp, ChefHat, UserCheck } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [workers, setWorkers] = useState([]);
  const [carts, setCarts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [workersData, cartsData, assignmentsData] = await Promise.all([
      Worker.list(),
      FoodCart.list(),
      Assignment.list("-date")
    ]);
    setWorkers(workersData);
    setCarts(cartsData);
    setAssignments(assignmentsData);
    setLoading(false);
  };

  const activeWorkers = workers.filter(w => w.active);
  const activeCarts = carts.filter(c => c.active);
  
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const thisWeekAssignments = assignments.filter(a => {
    const assignmentDate = new Date(a.date);
    return assignmentDate >= weekStart && assignmentDate <= weekEnd;
  });
  
  const totalHoursThisWeek = thisWeekAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
  const chefs = activeWorkers.filter(w => w.role === "chef").length;
  const sousChefs = activeWorkers.filter(w => w.role === "sous_chef").length;

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300">
      <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 ${color} rounded-full opacity-10`} />
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <CardTitle className="text-3xl font-bold text-gray-900">{value}</CardTitle>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color} bg-opacity-15`}>
            <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Overview of your food cart operations</p>
          </div>
          <Link to={createPageUrl("Schedule")}>
            <Button className="bg-blue-900 hover:bg-blue-800 text-white px-6">
              View Schedule
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Active Workers"
            value={activeWorkers.length}
            icon={Users}
            color="bg-blue-900"
            subtitle={`${chefs} chefs, ${sousChefs} sous-chefs`}
          />
          <StatCard
            title="Food Carts"
            value={activeCarts.length}
            icon={Truck}
            color="bg-amber-500"
            subtitle="Currently operational"
          />
          <StatCard
            title="Hours This Week"
            value={totalHoursThisWeek}
            icon={Clock}
            color="bg-green-600"
            subtitle={`${thisWeekAssignments.length} shifts`}
          />
          <StatCard
            title="Avg Hours/Worker"
            value={activeWorkers.length > 0 ? Math.round(totalHoursThisWeek / activeWorkers.length) : 0}
            icon={TrendingUp}
            color="bg-purple-600"
            subtitle="This week"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-lg border-none">
            <CardHeader className="border-b bg-white">
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-blue-900" />
                Active Team Members
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {activeWorkers.length > 0 ? (
                <div className="space-y-3">
                  {activeWorkers.slice(0, 5).map((worker) => (
                    <div key={worker.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          worker.role === 'chef' ? 'bg-blue-100' : 'bg-amber-100'
                        }`}>
                          <span className={`text-sm font-semibold ${
                            worker.role === 'chef' ? 'text-blue-900' : 'text-amber-700'
                          }`}>
                            {worker.full_name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{worker.full_name}</p>
                          <p className="text-sm text-gray-500 capitalize">{worker.role.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <UserCheck className="w-4 h-4 text-green-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No active workers</p>
              )}
              {activeWorkers.length > 5 && (
                <Link to={createPageUrl("Workers")}>
                  <Button variant="ghost" className="w-full mt-4">
                    View All Workers
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="border-b bg-white">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-500" />
                Food Carts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {activeCarts.length > 0 ? (
                <div className="space-y-3">
                  {activeCarts.slice(0, 5).map((cart) => (
                    <div key={cart.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{cart.name}</p>
                        <p className="text-sm text-gray-500">{cart.location}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No food carts configured</p>
              )}
              {activeCarts.length > 5 && (
                <Link to={createPageUrl("FoodCarts")}>
                  <Button variant="ghost" className="w-full mt-4">
                    View All Carts
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
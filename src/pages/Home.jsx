import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, BarChart3, CheckCircle } from 'lucide-react';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Home() {
  const [user, setUser] = useState(null);
  const [worker, setWorker] = useState(null);
  const [upcomingAssignments, setUpcomingAssignments] = useState([]);
  const [thisWeekAvailability, setThisWeekAvailability] = useState(null);
  const [stats, setStats] = useState({ totalHours: 0, totalShifts: 0, lastShift: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const workers = await base44.entities.Worker.filter({ email: currentUser.email });
      if (workers.length === 0) {
        setLoading(false);
        return;
      }

      const workerData = workers[0];
      setWorker(workerData);

      // Load upcoming assignments
      const allAssignments = await base44.entities.Assignment.list('-date');
      const today = format(new Date(), 'yyyy-MM-dd');
      const upcoming = allAssignments.filter(a => 
        (a.chef_id === workerData.id || a.sous_chef_id === workerData.id || a.additional_chef_id === workerData.id) &&
        a.date >= today
      ).slice(0, 5);
      setUpcomingAssignments(upcoming);

      // Load this week's availability
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const availabilities = await base44.entities.Availability.filter({
        worker_id: workerData.id,
        week_start_date: weekStartStr
      });
      if (availabilities.length > 0) {
        setThisWeekAvailability(availabilities[0]);
      }

      // Calculate stats
      const workerAssignments = allAssignments.filter(a => 
        a.chef_id === workerData.id || a.sous_chef_id === workerData.id || a.additional_chef_id === workerData.id
      );
      const totalHours = workerAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
      const totalShifts = workerAssignments.length;
      const lastShift = workerAssignments.length > 0 ? workerAssignments[0].date : null;
      setStats({ totalHours, totalShifts, lastShift });

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-green-50 flex items-center justify-center">
        <div className="text-green-600 text-xl font-bold" dir="rtl">טוען...</div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-4 border-black shadow-2xl">
            <CardContent className="p-12 text-center">
              <User className="w-24 h-24 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-black mb-2" dir="rtl">ברוך הבא!</h2>
              <p className="text-gray-600" dir="rtl">לא נמצא פרופיל עובד משויך לחשבון שלך.</p>
              <p className="text-gray-500 text-sm mt-2" dir="rtl">אנא פנה למנהל המערכת.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getAvailabilityStatusColor = (status) => {
    if (status === 'submitted') return 'bg-blue-400 text-black';
    if (status === 'approved') return 'bg-green-400 text-black';
    if (status === 'pending_change') return 'bg-yellow-400 text-black';
    return 'bg-gray-400 text-black';
  };

  const getAvailabilityStatusText = (status) => {
    if (status === 'submitted') return 'נשלחה';
    if (status === 'approved') return 'אושרה';
    if (status === 'pending_change') return 'ממתינה לשינוי';
    return 'טיוטה';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-4 border-black bg-gradient-to-r from-green-300 to-green-400 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white border-4 border-black rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-black" dir="rtl">שלום, {worker.nickname || user.full_name}!</h1>
                <p className="text-black/80 text-sm mt-1" dir="rtl">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-4 border-black bg-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600" dir="rtl">סה"כ שעות</p>
                  <p className="text-4xl font-bold text-black mt-2">{stats.totalHours}</p>
                </div>
                <div className="w-16 h-16 bg-green-400 border-2 border-black rounded-xl flex items-center justify-center">
                  <Clock className="w-8 h-8 text-black" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-4 border-black bg-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600" dir="rtl">סה"כ משמרות</p>
                  <p className="text-4xl font-bold text-black mt-2">{stats.totalShifts}</p>
                </div>
                <div className="w-16 h-16 bg-blue-400 border-2 border-black rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-black" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-4 border-black bg-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600" dir="rtl">משמרת אחרונה</p>
                  <p className="text-xl font-bold text-black mt-2">
                    {stats.lastShift ? format(parseISO(stats.lastShift), 'd/M/yy', { locale: he }) : '-'}
                  </p>
                </div>
                <div className="w-16 h-16 bg-yellow-400 border-2 border-black rounded-xl flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-black" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Availability Status */}
        {thisWeekAvailability && (
          <Card className="border-4 border-black bg-white shadow-xl">
            <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-green-200">
              <CardTitle className="text-xl font-bold text-black" dir="rtl">זמינות השבוע</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-bold text-black" dir="rtl">
                      {format(parseISO(thisWeekAvailability.week_start_date), 'd MMMM', { locale: he })} - 
                      {format(addDays(parseISO(thisWeekAvailability.week_start_date), 6), 'd MMMM yyyy', { locale: he })}
                    </p>
                    <p className="text-sm text-gray-600 mt-1" dir="rtl">
                      {thisWeekAvailability.shifts?.filter(s => s.type === 'wanted').length || 0} משמרות רצויות | 
                      {' '}{thisWeekAvailability.shifts?.filter(s => s.type === 'available').length || 0} משמרות זמינות
                    </p>
                  </div>
                </div>
                <Badge className={`${getAvailabilityStatusColor(thisWeekAvailability.status)} border-2 border-black text-base px-4 py-2`} dir="rtl">
                  {getAvailabilityStatusText(thisWeekAvailability.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Assignments */}
        <Card className="border-4 border-black bg-white shadow-xl">
          <CardHeader className="border-b-4 border-black bg-gradient-to-r from-green-100 to-green-200">
            <CardTitle className="text-xl font-bold text-black" dir="rtl">משמרות קרובות</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {upcomingAssignments.length === 0 ? (
              <p className="text-center text-gray-500 py-8" dir="rtl">אין משמרות קרובות</p>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((assignment, idx) => (
                  <div key={idx} className="p-4 border-2 border-black rounded-lg bg-gradient-to-r from-green-50 to-white hover:from-green-100 hover:to-green-50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-black text-lg">{assignment.food_cart_name}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          {format(parseISO(assignment.date), 'EEEE, d MMMM yyyy', { locale: he })}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {assignment.start_time} - {assignment.end_time} ({assignment.hours} שעות)
                        </p>
                        {assignment.menu && (
                          <p className="text-sm text-green-700 mt-1 font-medium">תפריט: {assignment.menu}</p>
                        )}
                      </div>
                      <div className="w-12 h-12 bg-green-400 border-2 border-black rounded-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-black" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
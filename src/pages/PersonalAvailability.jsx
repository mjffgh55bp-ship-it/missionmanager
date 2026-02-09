import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

const TIME_SLOTS = [
  '06:00-10:00',
  '10:00-14:00',
  '14:00-18:00',
  '18:00-22:00',
  '22:00-02:00',
  '02:00-06:00',
];

const DAYS_IN_WEEK = 7; // Sunday to Saturday

export default function PersonalAvailability() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [worker, setWorker] = useState(null);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const workers = await base44.entities.Worker.filter({ email: user.email });
      
      if (workers.length === 0) {
        setLoading(false);
        return;
      }

      const workerData = workers[0];
      setWorker(workerData);

      // Load availability for this week
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      const availabilities = await base44.entities.Availability.filter({
        worker_id: workerData.id,
        week_start_date: weekStartStr
      });

      if (availabilities.length > 0) {
        const avail = availabilities[0];
        const availMap = {};
        avail.shifts?.forEach(shift => {
          const key = `${shift.date}_${shift.start_time}-${shift.end_time}`;
          availMap[key] = shift.type;
        });
        setAvailability(availMap);
      } else {
        setAvailability({});
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, -1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleAvailabilityChange = (date, timeSlot, value) => {
    const key = `${date}_${timeSlot}`;
    setAvailability(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    if (!worker) return;

    const shifts = [];
    Object.entries(availability).forEach(([key, type]) => {
      if (type && type !== 'none') {
        const [date, timeRange] = key.split('_');
        const [start_time, end_time] = timeRange.split('-');
        shifts.push({ date, start_time, end_time, type, priority: 1 });
      }
    });

    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const existingAvail = await base44.entities.Availability.filter({
      worker_id: worker.id,
      week_start_date: weekStartStr
    });

    if (existingAvail.length > 0) {
      await base44.entities.Availability.update(existingAvail[0].id, {
        shifts,
        status: 'submitted'
      });
    } else {
      await base44.entities.Availability.create({
        worker_id: worker.id,
        worker_name: worker.nickname || worker.email,
        week_start_date: weekStartStr,
        shifts,
        status: 'submitted'
      });
    }

    alert('הזמינות נשמרה בהצלחה!');
  };

  const getSummary = () => {
    const counts = { wanted: 0, available: 0, unavailable: 0 };
    const byDay = {};
    
    Object.entries(availability).forEach(([key, type]) => {
      if (type && counts.hasOwnProperty(type)) {
        counts[type]++;
        const [date, timeSlot] = key.split('_');
        if (!byDay[date]) byDay[date] = [];
        byDay[date].push({ timeSlot, type });
      }
    });
    
    return { counts, byDay };
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
          <Card className="border-4 border-black">
            <CardContent className="p-12 text-center">
              <p className="text-gray-600" dir="rtl">לא נמצא פרופיל עובד.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { counts, byDay } = getSummary();
  const weekEnd = addDays(currentWeekStart, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Summary Cards */}
        <div className="bg-gradient-to-r from-green-100 to-white border-4 border-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-black text-center mb-4" dir="rtl">סיכום זמינות השבוע</h2>
          
          {/* Total Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border-4 border-black rounded-xl p-4 flex items-center justify-between" dir="rtl">
              <div>
                <p className="text-black font-bold">יכול</p>
                <p className="text-sm text-gray-600">משמרות</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 border-2 border-black rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-black">{counts.available}</span>
              </div>
            </div>

            <div className="bg-white border-4 border-black rounded-xl p-4 flex items-center justify-between" dir="rtl">
              <div>
                <p className="text-black font-bold">לא יכול</p>
                <p className="text-sm text-gray-600">משמרות</p>
              </div>
              <div className="w-12 h-12 bg-red-100 border-2 border-black rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-black">{counts.unavailable}</span>
              </div>
            </div>

            <div className="bg-white border-4 border-black rounded-xl p-4 flex items-center justify-between" dir="rtl">
              <div>
                <p className="text-black font-bold">רוצה</p>
                <p className="text-sm text-gray-600">משמרות</p>
              </div>
              <div className="w-12 h-12 bg-green-100 border-2 border-black rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-black">{counts.wanted}</span>
              </div>
            </div>
          </div>

          {/* Daily Summary */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-black text-center mb-3" dir="rtl">פירוט לפי ימים</h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => {
                const currentDay = addDays(currentWeekStart, dayIndex);
                const dateStr = format(currentDay, 'yyyy-MM-dd');
                const dayName = format(currentDay, 'EEE', { locale: he });
                const dayShifts = byDay[dateStr] || [];
                
                return (
                  <div key={dayIndex} className="bg-white border-2 border-black rounded-lg p-2" dir="rtl">
                    <p className="text-sm font-bold text-center text-black mb-2">{dayName}</p>
                    <div className="space-y-1">
                      {dayShifts.map((shift, i) => {
                        const bgColor = shift.type === 'wanted' ? 'bg-green-100' : 
                                       shift.type === 'available' ? 'bg-yellow-100' : 'bg-red-100';
                        const text = shift.type === 'wanted' ? 'רוצה' : 
                                    shift.type === 'available' ? 'יכול' : 'לא יכול';
                        return (
                          <div key={i} className={`text-xs p-1 rounded ${bgColor} border border-black text-center`}>
                            {text}
                          </div>
                        );
                      })}
                      {dayShifts.length === 0 && (
                        <p className="text-xs text-gray-400 text-center">-</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-gradient-to-r from-green-100 to-white border-4 border-black rounded-xl p-4 flex items-center justify-between">
          <Button 
            onClick={handleNextWeek}
            variant="ghost" 
            size="icon"
            className="hover:bg-green-100"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h3 className="text-xl font-bold text-black" dir="rtl">
            {format(currentWeekStart, 'd MMM', { locale: he })} - {format(weekEnd, 'd MMM yyyy', { locale: he })}
          </h3>
          <Button 
            onClick={handlePreviousWeek}
            variant="ghost" 
            size="icon"
            className="hover:bg-green-100"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        {/* Availability Table */}
        <div className="bg-gradient-to-r from-green-100 to-white border-4 border-black rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" dir="rtl">
              <thead>
                <tr className="bg-gradient-to-r from-green-300 to-green-400 border-b-4 border-black">
                  <th className="border-l-2 border-black p-3 text-black font-bold text-right">יום</th>
                  {TIME_SLOTS.map(slot => (
                    <th key={slot} className="border-l-2 border-black p-3 text-black font-bold text-center">
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => {
                  const currentDay = addDays(currentWeekStart, dayIndex);
                  const dateStr = format(currentDay, 'yyyy-MM-dd');
                  const dayName = format(currentDay, 'EEEE', { locale: he });
                  const dateDisplay = format(currentDay, 'd/M/yyyy');

                  return (
                    <tr key={dayIndex} className="border-b-2 border-black hover:bg-green-50">
                      <td className="border-l-2 border-black p-3 bg-gradient-to-r from-green-200 to-green-100">
                        <div className="font-bold text-black">{dayName}</div>
                        <div className="text-sm text-gray-700">{dateDisplay}</div>
                      </td>
                      {TIME_SLOTS.map(slot => {
                        const key = `${dateStr}_${slot}`;
                        const currentValue = availability[key] || 'none';
                        const bgColor = currentValue === 'wanted' ? 'bg-green-100' : 
                                       currentValue === 'available' ? 'bg-yellow-100' : 
                                       currentValue === 'unavailable' ? 'bg-red-100' : 'bg-white';
                        return (
                          <td key={slot} className={`border-l-2 border-black p-2 ${bgColor}`}>
                            <Select
                              value={currentValue}
                              onValueChange={(value) => handleAvailabilityChange(dateStr, slot, value)}
                            >
                              <SelectTrigger className="w-full border-2 border-black bg-white">
                                <SelectValue placeholder="→" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="inline-flex items-center gap-2">
                                    בחר...
                                  </span>
                                </SelectItem>
                                <SelectItem value="wanted">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-green-100 border border-black"></span>
                                    רוצה
                                  </span>
                                </SelectItem>
                                <SelectItem value="available">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-yellow-100 border border-black"></span>
                                    יכול
                                  </span>
                                </SelectItem>
                                <SelectItem value="unavailable">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-100 border border-black"></span>
                                    לא יכול
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleSave}
            className="bg-green-400 hover:bg-green-500 text-black font-bold border-4 border-black px-8 py-6 text-lg"
          >
            שמור זמינות
          </Button>
        </div>
      </div>
    </div>
  );
}
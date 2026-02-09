import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { he } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHIFTS = [
  { start: '06:00', end: '10:00' },
  { start: '10:00', end: '14:00' },
  { start: '14:00', end: '18:00' },
  { start: '18:00', end: '22:00' },
  { start: '22:00', end: '02:00' },
  { start: '02:00', end: '06:00' },
];

const getAvailabilityKey = (date, shiftIndex) => `${format(date, 'yyyy-MM-dd')}-${shiftIndex}`;

export default function PersonalAvailability() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [availability, setAvailability] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);

    if (user?.email) {
      const profiles = await base44.entities.Worker.filter({ email: user.email });
      if (profiles.length > 0) {
        setUserProfile(profiles[0]);
      }
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [currentWeekStart, userProfile]);

  const loadAvailability = async () => {
    if (!userProfile) return;
    
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const availabilityRecords = await base44.entities.Availability.filter({
      worker_id: userProfile.id,
      week_start_date: weekStartStr
    });

    if (availabilityRecords.length > 0) {
      const record = availabilityRecords[0];
      const availabilityMap = {};
      
      if (record.shifts && Array.isArray(record.shifts)) {
        record.shifts.forEach(shift => {
          const shiftIndex = SHIFTS.findIndex(s => s.start === shift.start_time && s.end === shift.end_time);
          if (shiftIndex !== -1) {
            const key = `${shift.date}-${shiftIndex}`;
            availabilityMap[key] = shift.type;
          }
        });
      }
      
      setAvailability(availabilityMap);
    } else {
      setAvailability({});
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));

  const setStatus = (date, shiftIndex, status) => {
    const key = getAvailabilityKey(date, shiftIndex);
    
    setAvailability(prev => {
      const newAvailability = { ...prev };
      if (status === null || status === '') {
        delete newAvailability[key];
      } else {
        newAvailability[key] = status;
      }
      return newAvailability;
    });
  };

  const saveAvailability = async () => {
    if (!userProfile) {
      toast.error('לא נמצא פרופיל משתמש');
      return;
    }

    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    
    const shifts = [];
    Object.keys(availability).forEach(key => {
      const [dateStr, shiftIndexStr] = key.split('-');
      const shiftIndex = parseInt(shiftIndexStr);
      const shift = SHIFTS[shiftIndex];
      
      shifts.push({
        date: dateStr,
        start_time: shift.start,
        end_time: shift.end,
        type: availability[key]
      });
    });

    const existingRecords = await base44.entities.Availability.filter({
      worker_id: userProfile.id,
      week_start_date: weekStartStr
    });

    const data = {
      worker_id: userProfile.id,
      worker_name: userProfile.nickname,
      week_start_date: weekStartStr,
      shifts: shifts,
      status: 'submitted'
    };

    if (existingRecords.length > 0) {
      await base44.entities.Availability.update(existingRecords[0].id, data);
    } else {
      await base44.entities.Availability.create(data);
    }

    toast.success('הזמינות נשמרה בהצלחה');
  };

  // Calculate summary counts
  const canCount = Object.values(availability).filter(v => v === 'available').length;
  const cannotCount = Object.values(availability).filter(v => v === 'unavailable').length;
  const wantCount = Object.values(availability).filter(v => v === 'wanted').length;

  if (!currentUser) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-green-50 to-green-100">
        <p className="text-xl font-bold">טוען נתוני משתמש...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-green-50 to-green-100">
        <p className="text-xl font-bold">פרופיל משתמש לא נמצא. אנא פנה למנהל המערכת.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Summary Header */}
        <Card className="border-4 border-black bg-gradient-to-r from-green-200 to-green-300 shadow-2xl">
          <CardContent className="p-4">
            <h1 className="text-2xl font-bold text-black text-right mb-4" dir="rtl">סיכום זמינות השבוע</h1>
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-2 border-black bg-white shadow-lg">
                <CardContent className="p-4 flex items-center justify-between" dir="rtl">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">משמרות</div>
                    <div className="font-bold text-black">יכול</div>
                  </div>
                  <div className="w-12 h-12 bg-green-400 border-2 border-black rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-black">{canCount}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-black bg-white shadow-lg">
                <CardContent className="p-4 flex items-center justify-between" dir="rtl">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">משמרות</div>
                    <div className="font-bold text-black">לא יכול</div>
                  </div>
                  <div className="w-12 h-12 bg-red-400 border-2 border-black rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-black">{cannotCount}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-black bg-white shadow-lg">
                <CardContent className="p-4 flex items-center justify-between" dir="rtl">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">משמרות</div>
                    <div className="font-bold text-black">חפץ</div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-400 border-2 border-black rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-black">{wantCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Week Navigation */}
        <Card className="border-4 border-black bg-white shadow-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button onClick={handlePrevWeek} variant="ghost" size="icon" className="text-black hover:bg-green-100">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="text-center">
                <h2 className="text-xl font-bold text-black">
                  {format(weekDays[0], 'd MMMM', { locale: he })} - {format(weekDays[6], 'd MMMM yyyy', { locale: he })}
                </h2>
              </div>
              <Button onClick={handleNextWeek} variant="ghost" size="icon" className="text-black hover:bg-green-100">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Table */}
        <Card className="border-4 border-black bg-white shadow-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-green-300 to-green-400 border-b-4 border-black">
                    <th className="p-3 text-center font-bold text-black border-l-4 border-black w-32 sticky right-0 bg-gradient-to-r from-green-300 to-green-400 z-10" dir="rtl">
                      יום
                    </th>
                    {[...SHIFTS].reverse().map((shift, idx) => (
                      <th key={idx} className="p-3 text-center font-bold text-black border-l-2 border-black min-w-[140px]">
                        {shift.start}-{shift.end}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day, dayIdx) => (
                    <tr key={dayIdx} className="border-b-2 border-black hover:bg-green-50">
                      <td className="p-3 border-l-4 border-black bg-gradient-to-r from-green-100 to-green-200 sticky right-0 z-10">
                        <div className="font-bold text-black text-sm text-right" dir="rtl">{format(day, 'EEEE', { locale: he })}</div>
                        <div className="text-xs text-gray-700 text-right">{format(day, 'd/M/yyyy', { locale: he })}</div>
                      </td>
                      {[...SHIFTS].reverse().map((shift, shiftIdx) => {
                        const actualShiftIdx = SHIFTS.length - 1 - shiftIdx;
                        const key = getAvailabilityKey(day, actualShiftIdx);
                        const currentStatus = availability[key];

                        return (
                          <td key={shiftIdx} className="border-l-2 border-black p-2">
                            <Select value={currentStatus || ''} onValueChange={(value) => setStatus(day, actualShiftIdx, value)}>
                              <SelectTrigger className="w-full border-2 border-black bg-white hover:bg-green-50" dir="rtl">
                                <SelectValue placeholder="בחר..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null} dir="rtl">ריק</SelectItem>
                                <SelectItem value="available" dir="rtl">יכול</SelectItem>
                                <SelectItem value="wanted" dir="rtl">חפץ</SelectItem>
                                <SelectItem value="unavailable" dir="rtl">לא יכול</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-center pb-8">
          <Button
            onClick={saveAvailability}
            className="bg-gradient-to-r from-green-400 to-green-500 text-black hover:from-green-500 hover:to-green-600 font-bold text-lg px-12 py-6 shadow-2xl border-4 border-black"
            dir="rtl"
          >
            שמור זמינות
          </Button>
        </div>
      </div>
    </div>
  );
}
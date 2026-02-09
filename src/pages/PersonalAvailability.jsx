import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from "@/lib/utils";

const SHIFTS = [
  { start: '06:00', end: '10:00' },
  { start: '10:00', end: '14:00' },
  { start: '14:00', end: '18:00' },
  { start: '18:00', end: '22:00' },
  { start: '22:00', end: '02:00' },
  { start: '02:00', end: '06:00' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'פנוי', color: 'bg-green-200', borderColor: 'border-green-500', textColor: 'text-green-800' },
  { value: 'wanted', label: 'רוצה', color: 'bg-yellow-200', borderColor: 'border-yellow-500', textColor: 'text-yellow-800' },
  { value: 'unavailable', label: 'לא פנוי', color: 'bg-red-200', borderColor: 'border-red-500', textColor: 'text-red-800' },
];

const getAvailabilityKey = (date, shiftIndex) => `${format(date, 'yyyy-MM-dd')}-${shiftIndex}`;

export default function PersonalAvailability() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [availability, setAvailability] = useState({});
  const [weeklyNote, setWeeklyNote] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);
    setIsAdmin(user?.role === 'admin');

    if (user?.email) {
      const profiles = await base44.entities.UserProfile.filter({ email: user.email });
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

  const handlePrevWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

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

  if (!currentUser) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-xl font-bold">טוען נתוני משתמש...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-xl font-bold">פרופיל משתמש לא נמצא. אנא פנה למנהל המערכת.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-5xl font-bold text-black mb-2">זמינות אישית</h1>
          <p className="text-xl text-gray-700">נהלי רישום שבועיים</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={saveAvailability}
            className="bg-lime-400 text-black hover:bg-lime-500 font-bold text-lg px-6 py-3 shadow-xl border-2 border-black"
          >
            <Save className="w-5 h-5 ml-2" />
            שמור זמינות
          </Button>
          <Button
            onClick={handleToday}
            variant="outline"
            className="border-2 border-black text-black hover:bg-lime-300 font-bold"
          >
            השבוע הנוכחי
          </Button>
        </div>
      </div>

      <Card className="border-4 border-black bg-white shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button onClick={handlePrevWeek} variant="ghost" size="icon" className="text-black hover:bg-lime-300">
              <ChevronRight className="w-6 h-6" />
            </Button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-black">
                {format(weekDays[0], 'd MMM', { locale: he })} - {format(weekDays[6], 'd MMM yyyy', { locale: he })}
              </h2>
              <p className="text-sm text-gray-600">שבוע {format(currentWeekStart, 'w', { locale: he })}</p>
            </div>
            <Button onClick={handleNextWeek} variant="ghost" size="icon" className="text-black hover:bg-lime-300">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-4 border-black bg-white shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-lime-300 border-b-4 border-black">
                  <th className="p-2 text-center font-bold text-black border-l-4 border-black w-32 sticky right-0 bg-lime-300 z-10">
                    יום / משמרת
                  </th>
                  {SHIFTS.map((shift, idx) => (
                    <th key={idx} className="p-2 text-center font-bold text-black border-l-4 border-black">
                      {shift.start}-{shift.end}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day, dayIdx) => (
                  <tr key={dayIdx} className="border-b-2 border-black hover:bg-lime-50">
                    <td className="p-2 border-l-4 border-black bg-lime-100 sticky right-0 z-10">
                      <div className="font-bold text-black text-sm">{format(day, 'EEEE', { locale: he })}</div>
                      <div className="text-xs text-gray-600">{format(day, 'd/M', { locale: he })}</div>
                    </td>
                    {SHIFTS.map((shift, shiftIdx) => {
                      const key = getAvailabilityKey(day, shiftIdx);
                      const currentStatus = availability[key];

                      return (
                        <td key={shiftIdx} className="border-l border-black p-1">
                          <div className="flex flex-col gap-1">
                            {STATUS_OPTIONS.map((option) => (
                              <Button
                                key={option.value}
                                variant="outline"
                                size="sm"
                                onClick={() => setStatus(day, shiftIdx, currentStatus === option.value ? '' : option.value)}
                                className={cn(
                                  "w-full text-xs font-semibold py-1 px-2 h-auto",
                                  option.color,
                                  currentStatus === option.value && `border-2 ${option.borderColor} ${option.textColor} shadow-md`,
                                  currentStatus !== option.value && "opacity-50 hover:opacity-100",
                                )}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
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

      {isAdmin && (
        <Card className="border-4 border-black bg-yellow-50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-black">הערות מנהל</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full p-2 border-2 border-black rounded-lg min-h-[100px]"
              value={weeklyNote}
              onChange={(e) => setWeeklyNote(e.target.value)}
              placeholder="הערות שבועיות למנהל..."
              disabled
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
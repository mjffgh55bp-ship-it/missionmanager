import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";
import MenuButton from "../components/MenuButton";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daySchedule = [
    { role: 'מנל"ח', start: '08:00', end: '18:00' },
    { role: 'מנהל', start: '08:00', end: '18:00' }
  ];

  const nightSchedule = [
    { role: 'מנל"ח', start: '18:00', end: '08:00' },
    { role: 'מנהל', start: '18:00', end: '08:00' }
  ];

  const onCallSchedule = [
    { type: '', start: '06:00', end: '10:00', commander: '', operator: '' },
    { type: '', start: '10:00', end: '14:00', commander: '', operator: '' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <MenuButton />
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl" dir="rtl">דרום אאא צפון</CardTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-2 bg-green-300 text-gray-800 rounded-lg font-semibold min-w-[200px] text-center" dir="rtl">
                  <div>{format(currentDate, "EEEE", { locale: he })}</div>
                  <div className="text-sm">{format(currentDate, "d MMMM yyyy", { locale: he })}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Day Managers */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="py-3 px-4 bg-blue-50 border-b">
            <CardTitle className="text-lg" dir="rtl">מנהלי מסעדה יום</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>תפקיד</div>
                <div>התחלה</div>
                <div>סיום</div>
              </div>
              {daySchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Night Managers */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="py-3 px-4 bg-indigo-50 border-b">
            <CardTitle className="text-lg" dir="rtl">מנהלי מסעדה לילה</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>תפקיד</div>
                <div>התחלה</div>
                <div>סיום</div>
              </div>
              {nightSchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-3" dir="rtl">
                  <Input value={item.role} className="h-9" dir="rtl" readOnly />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* On-Call */}
        <Card className="border-none shadow-lg mb-6">
          <CardHeader className="py-3 px-4 bg-amber-50 border-b">
            <CardTitle className="text-lg" dir="rtl">כוננויות</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3 font-semibold text-sm text-gray-700 pb-2 border-b" dir="rtl">
                <div>כוננות</div>
                <div>התחלה</div>
                <div>סיום</div>
                <div>מפקד</div>
                <div>מפעיל</div>
              </div>
              {onCallSchedule.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-3" dir="rtl">
                  <Input value={item.type} className="h-9" dir="rtl" placeholder="סוג כוננות" />
                  <Input value={item.start} type="time" className="h-9" />
                  <Input value={item.end} type="time" className="h-9" />
                  <Input value={item.commander} className="h-9" dir="rtl" placeholder="שם" />
                  <Input value={item.operator} className="h-9" dir="rtl" placeholder="שם" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
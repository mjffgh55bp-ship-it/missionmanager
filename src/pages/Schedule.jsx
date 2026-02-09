import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-md mb-6 border border-green-100">
          <CardHeader className="border-b border-green-100 bg-gradient-to-r from-white to-green-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl" dir="rtl">לוח</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-300 text-white rounded-lg font-semibold min-w-[200px] text-center shadow-md" dir="rtl">
                  <div>{format(currentDate, "EEEE", { locale: he })}</div>
                  <div className="text-sm opacity-90">{format(currentDate, "d MMMM yyyy", { locale: he })}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} dir="rtl">היום</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500" dir="rtl">תוכן הלוח יתווסף בקרוב</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
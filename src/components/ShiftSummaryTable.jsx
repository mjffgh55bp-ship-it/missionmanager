import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ShiftSummaryTable({ isOpen, onClose, title, data }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto print:max-w-full">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center justify-between">
            <span>סיכום משמרות - {title}</span>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Download className="h-4 w-4 ml-2" />
                הדפס / שמור PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* משמרות נדרשות */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b-2 border-gray-200 pb-2">
              משמרות נדרשות שבועית
            </h3>
            <div className="grid grid-cols-4 gap-4 bg-gradient-to-l from-orange-50 to-amber-50 p-4 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">משמרות יום</div>
                <div className="text-2xl font-bold text-gray-800">{data.totalDayShifts}</div>
                <div className="text-xs text-gray-500">06:00-22:00</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">משמרות ערב</div>
                <div className="text-2xl font-bold text-indigo-600">{data.totalEveningShifts}</div>
                <div className="text-xs text-gray-500">22:00-02:00</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">משמרות לילה</div>
                <div className="text-2xl font-bold text-purple-600">{data.totalNightShifts}</div>
                <div className="text-xs text-gray-500">02:00-06:00</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">סה״כ</div>
                <div className="text-3xl font-bold text-orange-600">{data.totalWeeklyShifts}</div>
                <div className="text-xs text-gray-500">משמרות</div>
              </div>
            </div>
          </div>

          {/* טבלת עובדים */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b-2 border-gray-200 pb-2">
              פילוח לפי סוג עובד
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">סוג עובד</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">כמות</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">משמרות שבועי<br/><span className="text-xs font-normal">(ממוצע)</span></th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">משמרות ערב חודשי<br/><span className="text-xs font-normal">(22:00-02:00)</span></th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">משמרות לילה חודשי<br/><span className="text-xs font-normal">(02:00-06:00)</span></th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">יכולת כיסוי<br/><span className="text-xs font-normal">(שבועי)</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-blue-50">
                    <td className="border border-gray-300 px-4 py-3 font-medium text-blue-700">עובדים סדירים</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.newEmployees}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.newAvgShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.newMonthlyEveningShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.newMonthlyNightShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold text-blue-600">{data.newCapacity}</td>
                  </tr>
                  <tr className="hover:bg-amber-50">
                    <td className="border border-gray-300 px-4 py-3 font-medium text-amber-700">עובדי הצ״חים</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.veteranEmployees}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.veteranAvgShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.veteranMonthlyEveningShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.veteranMonthlyNightShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold text-amber-600">{data.veteranCapacity}</td>
                  </tr>
                  <tr className="hover:bg-emerald-50">
                    <td className="border border-gray-300 px-4 py-3 font-medium text-emerald-700">עובדי מיל</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.seniorEmployees}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.seniorAvgShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.seniorMonthlyEveningShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.seniorMonthlyNightShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold text-emerald-600">{data.seniorCapacity}</td>
                  </tr>
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-300 px-4 py-3 text-gray-800">סה״כ</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-800">{data.totalEmployees}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-800">-</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-800">-</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-800">-</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-orange-600 text-lg">{data.totalCapacity.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* יכולת כיסוי לפי סוג משמרת */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3 border-b-2 border-gray-200 pb-2">
              יכולת כיסוי לפי סוג משמרת
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">סוג משמרת</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">נדרש שבועי</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">יכולת כיסוי</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">פער</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 font-medium">משמרות יום (06:00-22:00)</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalDayShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalDayCapacity.toFixed(1)}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold">{data.dayGap}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        parseFloat(data.dayGap) > 0 ? 'bg-emerald-100 text-emerald-700' : 
                        parseFloat(data.dayGap) < 0 ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {parseFloat(data.dayGap) > 0 ? '✓ עודף' : parseFloat(data.dayGap) < 0 ? '✗ חוסר' : '⚖ מאוזן'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 font-medium">משמרות ערב (22:00-02:00)</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalEveningShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalEveningCapacity.toFixed(1)}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold">{data.eveningGap}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        parseFloat(data.eveningGap) > 0 ? 'bg-emerald-100 text-emerald-700' : 
                        parseFloat(data.eveningGap) < 0 ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {parseFloat(data.eveningGap) > 0 ? '✓ עודף' : parseFloat(data.eveningGap) < 0 ? '✗ חוסר' : '⚖ מאוזן'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 font-medium">משמרות לילה (02:00-06:00)</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalNightShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{data.totalNightCapacity.toFixed(1)}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center font-bold">{data.nightGap}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        parseFloat(data.nightGap) > 0 ? 'bg-emerald-100 text-emerald-700' : 
                        parseFloat(data.nightGap) < 0 ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {parseFloat(data.nightGap) > 0 ? '✓ עודף' : parseFloat(data.nightGap) < 0 ? '✗ חוסר' : '⚖ מאוזן'}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-gray-100 font-bold text-lg">
                    <td className="border border-gray-300 px-4 py-3">סה״כ כללי</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-orange-600">{data.totalWeeklyShifts}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-orange-600">{data.totalCapacity.toFixed(1)}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-orange-600">{data.gap}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        parseFloat(data.gap) > 0 ? 'bg-emerald-100 text-emerald-700' : 
                        parseFloat(data.gap) < 0 ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {parseFloat(data.gap) > 0 ? '✓ עודף' : parseFloat(data.gap) < 0 ? '✗ חוסר' : '⚖ מאוזן'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ממוצע סופ"ש */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-lg font-bold text-purple-700 mb-2">ממוצע משמרות בסופ״ש לעובד</h4>
            <p className="text-sm text-gray-600 mb-3">סופ״ש מוגדר כיום A אחד + יום B אחד (יומיים בשבוע)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-sm text-gray-600 mb-1">ממוצע שבועי</div>
                <div className="text-3xl font-bold text-purple-600">{data.avgWeeklyWeekendShiftsPerEmployee.toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-sm text-gray-600 mb-1">ממוצע חודשי</div>
                <div className="text-3xl font-bold text-purple-600">{data.avgMonthlyWeekendShiftsPerEmployee.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
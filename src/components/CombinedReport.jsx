import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function CombinedReport({ isOpen, onClose, chefsData, sousData }) {
  const handlePrint = () => {
    window.print();
  };

  if (!chefsData || !sousData) return null;

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 5mm;
          }
          @page {
            size: A4;
            margin: 5mm;
          }
        }
      `}</style>
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:overflow-visible">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center justify-between">
              <span>דו״ח מאוחד - מטבח</span>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Download className="h-4 w-4 ml-2" />
                הדפס / שמור PDF
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="print-content print:text-[9px]" dir="rtl">
            {/* כותרת להדפסה */}
            <h1 className="hidden print:block text-center text-base font-bold mb-2">דו״ח מאוחד - מטבח</h1>
            
            {/* טבלה משולבת */}
            <table className="w-full border-collapse text-[10px] print:text-[8px] mb-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold">צוות</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold" colSpan="3">משמרות נדרשות (שבועי)</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold">סה״כ</th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-1 py-0.5"></th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center text-[9px] print:text-[7px]">יום</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center text-[9px] print:text-[7px]">ערב</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center text-[9px] print:text-[7px]">לילה</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center text-[9px] print:text-[7px]">משמרות</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-semibold text-orange-600 text-center">שפים</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalDayShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalEveningShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalNightShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center font-bold">{chefsData.totalWeeklyShifts}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-semibold text-blue-600 text-center">סו-שפים</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.totalDayShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.totalEveningShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.totalNightShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center font-bold">{sousData.totalWeeklyShifts}</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-1 py-0.5 text-center">סה״כ</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalDayShifts + sousData.totalDayShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalEveningShifts + sousData.totalEveningShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalNightShifts + sousData.totalNightShifts}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center text-orange-600">{chefsData.totalWeeklyShifts + sousData.totalWeeklyShifts}</td>
                </tr>
              </tbody>
            </table>

            {/* פירוט עובדים */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* שפים */}
              <div>
                <h3 className="text-sm font-bold text-orange-600 mb-1 print:text-[10px]">שפים - פירוט עובדים</h3>
                <table className="w-full border-collapse text-[9px] print:text-[7px]">
                  <thead>
                    <tr className="bg-orange-50">
                      <th className="border border-gray-300 px-1 py-0.5 text-center">סוג</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">כמות</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">שבועי</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">לילה/חודש</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">יכולת</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">סדירים</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.newEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.newAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.newMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{chefsData.newCapacity}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">הצ״חים</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.veteranEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.veteranAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.veteranMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{chefsData.veteranCapacity}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">מיל</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.seniorEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.seniorAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.seniorMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{chefsData.seniorCapacity}</td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td className="border border-gray-300 px-1 py-0.5 text-center">סה״כ</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{chefsData.totalEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{((chefsData.totalNightCapacity / chefsData.totalEmployees) * 4.3).toFixed(1)}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-orange-600">{chefsData.totalCapacity.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* סו-שפים */}
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-1 print:text-[10px]">סו-שפים - פירוט עובדים</h3>
                <table className="w-full border-collapse text-[9px] print:text-[7px]">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-gray-300 px-1 py-0.5 text-center">סוג</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">כמות</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">שבועי</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">לילה/חודש</th>
                      <th className="border border-gray-300 px-1 py-0.5 text-center">יכולת</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">סדירים</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.newEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.newAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.newMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{sousData.newCapacity}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">הצ״חים</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.veteranEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.veteranAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.veteranMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{sousData.veteranCapacity}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">מיל</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.seniorEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.seniorAvgShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.seniorMonthlyNightShifts}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{sousData.seniorCapacity}</td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td className="border border-gray-300 px-1 py-0.5 text-center">סה״כ</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{sousData.totalEmployees}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center">{((sousData.totalNightCapacity / sousData.totalEmployees) * 4.3).toFixed(1)}</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-blue-600">{sousData.totalCapacity.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* כמות משמרות שבועית לאוכלוסייה */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: "שפים", data: chefsData, color: "orange" },
                { label: "סו-שפים", data: sousData, color: "blue" }
              ].map(({ label, data, color }) => {
                const populations = [
                  {
                    name: "סדירים",
                    count: data.newEmployees,
                    avgShifts: data.newAvgShifts,
                    monthlyEvening: data.newMonthlyEveningShifts,
                    monthlyNight: data.newMonthlyNightShifts
                  },
                  {
                    name: 'הצ״חים',
                    count: data.veteranEmployees,
                    avgShifts: data.veteranAvgShifts,
                    monthlyEvening: data.veteranMonthlyEveningShifts,
                    monthlyNight: data.veteranMonthlyNightShifts
                  },
                  {
                    name: "מיל",
                    count: data.seniorEmployees,
                    avgShifts: data.seniorAvgShifts,
                    monthlyEvening: data.seniorMonthlyEveningShifts,
                    monthlyNight: data.seniorMonthlyNightShifts
                  }
                ].map(p => {
                  const wEvening = p.monthlyEvening / 4.3;
                  const wNight = p.monthlyNight / 4.3;
                  const wDay = Math.max(0, p.avgShifts - wEvening - wNight);
                  return {
                    ...p,
                    totalDay: wDay.toFixed(1),
                    totalEvening: wEvening.toFixed(1),
                    totalNight: wNight.toFixed(1),
                    totalAll: p.avgShifts.toFixed(1)
                  };
                });
                return (
                  <div key={label}>
                    <h3 className={`text-sm font-bold text-${color}-600 mb-1 print:text-[10px]`}>{label} - משמרות שבועיות לאוכלוסייה</h3>
                    <table className="w-full border-collapse text-[9px] print:text-[7px]">
                      <thead>
                        <tr className={`bg-${color}-50`}>
                          <th className="border border-gray-300 px-1 py-0.5 text-center">אוכלוסייה</th>
                          <th className="border border-gray-300 px-1 py-0.5 text-center">יום</th>
                          <th className="border border-gray-300 px-1 py-0.5 text-center">ערב</th>
                          <th className="border border-gray-300 px-1 py-0.5 text-center">לילה</th>
                          <th className="border border-gray-300 px-1 py-0.5 text-center">סה״כ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {populations.map(p => (
                          <tr key={p.name}>
                            <td className="border border-gray-300 px-1 py-0.5 text-center">{p.name}</td>
                            <td className="border border-gray-300 px-1 py-0.5 text-center">{p.totalDay}</td>
                            <td className="border border-gray-300 px-1 py-0.5 text-center">{p.totalEvening}</td>
                            <td className="border border-gray-300 px-1 py-0.5 text-center">{p.totalNight}</td>
                            <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{p.totalAll}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold">
                          <td className="border border-gray-300 px-1 py-0.5 text-center">סה״כ</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-center">{populations.reduce((s, p) => s + parseFloat(p.totalDay), 0).toFixed(1)}</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-center">{populations.reduce((s, p) => s + parseFloat(p.totalEvening), 0).toFixed(1)}</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-center">{populations.reduce((s, p) => s + parseFloat(p.totalNight), 0).toFixed(1)}</td>
                          <td className={`border border-gray-300 px-1 py-0.5 text-center text-${color}-600`}>{populations.reduce((s, p) => s + parseFloat(p.totalAll), 0).toFixed(1)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* פערים */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-orange-600 mb-1 print:text-[10px]">שפים - פערים</h3>
                <div className="grid grid-cols-4 gap-1">
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">יום</div>
                    <div className={`text-xs font-bold ${parseFloat(chefsData.dayGap) > 0 ? 'text-emerald-600' : parseFloat(chefsData.dayGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(chefsData.dayGap) > 0 ? `+${chefsData.dayGap}` : chefsData.dayGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">ערב</div>
                    <div className={`text-xs font-bold ${parseFloat(chefsData.eveningGap) > 0 ? 'text-emerald-600' : parseFloat(chefsData.eveningGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(chefsData.eveningGap) > 0 ? `+${chefsData.eveningGap}` : chefsData.eveningGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">לילה</div>
                    <div className={`text-xs font-bold ${parseFloat(chefsData.nightGap) > 0 ? 'text-emerald-600' : parseFloat(chefsData.nightGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(chefsData.nightGap) > 0 ? `+${chefsData.nightGap}` : chefsData.nightGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">כללי</div>
                    <div className={`text-sm font-bold ${parseFloat(chefsData.gap) > 0 ? 'text-emerald-600' : parseFloat(chefsData.gap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(chefsData.gap) > 0 ? `+${chefsData.gap}` : chefsData.gap}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-1 print:text-[10px]">סו-שפים - פערים</h3>
                <div className="grid grid-cols-4 gap-1">
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">יום</div>
                    <div className={`text-xs font-bold ${parseFloat(sousData.dayGap) > 0 ? 'text-emerald-600' : parseFloat(sousData.dayGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(sousData.dayGap) > 0 ? `+${sousData.dayGap}` : sousData.dayGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">ערב</div>
                    <div className={`text-xs font-bold ${parseFloat(sousData.eveningGap) > 0 ? 'text-emerald-600' : parseFloat(sousData.eveningGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(sousData.eveningGap) > 0 ? `+${sousData.eveningGap}` : sousData.eveningGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">לילה</div>
                    <div className={`text-xs font-bold ${parseFloat(sousData.nightGap) > 0 ? 'text-emerald-600' : parseFloat(sousData.nightGap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(sousData.nightGap) > 0 ? `+${sousData.nightGap}` : sousData.nightGap}
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-1 text-center">
                    <div className="text-[8px] text-gray-500">כללי</div>
                    <div className={`text-sm font-bold ${parseFloat(sousData.gap) > 0 ? 'text-emerald-600' : parseFloat(sousData.gap) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {parseFloat(sousData.gap) > 0 ? `+${sousData.gap}` : sousData.gap}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* סיכום כללי */}
            <div className="bg-gradient-to-l from-orange-100 to-amber-100 rounded p-2 print:break-inside-avoid">
              <h3 className="text-sm font-bold text-gray-700 mb-2 text-center print:text-[10px]">סיכום כללי - כל המטבח</h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded p-2 text-center">
                  <div className="text-[9px] text-gray-600 print:text-[7px]">סה״כ עובדים</div>
                  <div className="text-lg font-bold text-gray-800 print:text-sm">
                    {chefsData.totalEmployees + sousData.totalEmployees}
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center">
                  <div className="text-[9px] text-gray-600 print:text-[7px]">משמרות נדרשות</div>
                  <div className="text-lg font-bold text-orange-600 print:text-sm">
                    {chefsData.totalWeeklyShifts + sousData.totalWeeklyShifts}
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center">
                  <div className="text-[9px] text-gray-600 print:text-[7px]">יכולת כיסוי</div>
                  <div className="text-lg font-bold text-blue-600 print:text-sm">
                    {(chefsData.totalCapacity + sousData.totalCapacity).toFixed(1)}
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center">
                  <div className="text-[9px] text-gray-600 print:text-[7px]">פער כללי</div>
                  <div className={`text-xl font-bold print:text-base ${
                    (parseFloat(chefsData.gap) + parseFloat(sousData.gap)) > 0 ? 'text-emerald-600' : 
                    (parseFloat(chefsData.gap) + parseFloat(sousData.gap)) < 0 ? 'text-red-600' : 
                    'text-amber-600'
                  }`}>
                    {((parseFloat(chefsData.gap) + parseFloat(sousData.gap)) > 0 ? '+' : '') + 
                     (parseFloat(chefsData.gap) + parseFloat(sousData.gap)).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
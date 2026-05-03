import React from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, ClipboardList } from "lucide-react";

export default function AuditLogTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-10" dir="rtl">
        <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
        אין רשומות ביומן עדיין
      </div>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base" dir="rtl">יומן פעולות</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-right font-medium text-gray-600">פעולה</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">קובץ</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">תאריך ושעה</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">משתמש</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">שורות</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">פרטים</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {log.action_type === "export" ? (
                      <Badge className="bg-blue-100 text-blue-800 gap-1">
                        <Download className="w-3 h-3" />ייצוא
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 gap-1">
                        <Upload className="w-3 h-3" />ייבוא
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={log.file_name}>
                    {log.file_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm") : "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{log.user_name || log.user_email || "-"}</td>
                  <td className="px-3 py-2 text-gray-700">{log.row_count ?? "-"}</td>
                  <td className="px-3 py-2">
                    {log.action_type === "import" && log.row_count != null ? (
                      <div className="flex gap-1 flex-wrap">
                        {log.imported_count > 0 && <span className="text-emerald-700">יובא: {log.imported_count}</span>}
                        {log.updated_count  > 0 && <span className="text-blue-700">עודכן: {log.updated_count}</span>}
                        {log.skipped_count  > 0 && <span className="text-yellow-700">דולג: {log.skipped_count}</span>}
                        {log.error_count    > 0 && <span className="text-red-700">שגיאה: {log.error_count}</span>}
                      </div>
                    ) : log.date_range_start ? (
                      <span className="text-gray-500">{log.date_range_start} – {log.date_range_end}</span>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
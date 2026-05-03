import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, ClipboardList, ShieldCheck } from "lucide-react";
import ExportPanel from "@/components/dataTransfer/ExportPanel";
import ImportPanel from "@/components/dataTransfer/ImportPanel";
import AuditLogTable from "@/components/dataTransfer/AuditLogTable";

export default function DataTransfer() {
  const [currentUser, setCurrentUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tab, setTab] = useState("export");
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadData();
  }, []);

  const loadData = async () => {
    const [user, logs] = await Promise.all([
      base44.auth.me(),
      base44.entities.AuditLog.list("-created_date", 50),
    ]);
    setCurrentUser(user);
    setAuditLogs(logs);
  };

  const refreshLogs = async () => {
    const logs = await base44.entities.AuditLog.list("-created_date", 50);
    setAuditLogs(logs);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">העברת נתונים מאובטחת</h1>
          </div>
          <p className="text-sm text-gray-500 mr-13">
            ייצוא וייבוא נתוני לו״ז וזמינות — ממשק מבוקר לעבודה עם מערכות סגורות
          </p>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <strong>חוקי אבטחה:</strong> ייצוא מוציא שדות מאושרים בלבד. ייבוא מתעלם מכל שדה שאינו בסכמה המאושרת. לא ניתן ליצור עובדים חדשים דרך הייבוא.
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 w-full grid grid-cols-3">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="w-4 h-4" />ייצוא נתונים
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />ייבוא נתונים
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />יומן ביקורת
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export">
            <ExportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="import">
            <ImportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogTable logs={auditLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
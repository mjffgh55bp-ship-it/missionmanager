import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, ClipboardList, ShieldCheck, CalendarDays } from "lucide-react";
import ExportPanel from "@/components/dataTransfer/ExportPanel";
import ImportPanel from "@/components/dataTransfer/ImportPanel";
import AuditLogTable from "@/components/dataTransfer/AuditLogTable";
import AvailabilityExportPanel from "@/components/dataTransfer/AvailabilityExportPanel";
import AvailabilityImportPanel from "@/components/dataTransfer/AvailabilityImportPanel";

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
    const user = await base44.auth.me();
    setCurrentUser(user);
    // AuditLog is loaded lazily when the audit tab is opened — don't fetch on mount
  };

  const refreshLogs = async () => {
    const logs = await base44.entities.AuditLog.list("-created_date", 50);
    setAuditLogs(logs);
  };

  const handleTabChange = async (newTab) => {
    setTab(newTab);
    if (newTab === "audit" && auditLogs.length === 0) {
      await refreshLogs();
    }
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

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 w-full grid grid-cols-5">
            <TabsTrigger value="export" className="flex items-center gap-1 text-xs">
              <Download className="w-4 h-4" />ייצוא איושים
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-1 text-xs">
              <Upload className="w-4 h-4" />ייבוא איושים
            </TabsTrigger>
            <TabsTrigger value="avail-export" className="flex items-center gap-1 text-xs">
              <CalendarDays className="w-4 h-4" />ייצוא זמינות
            </TabsTrigger>
            <TabsTrigger value="avail-import" className="flex items-center gap-1 text-xs">
              <CalendarDays className="w-4 h-4" />ייבוא זמינות
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1 text-xs">
              <ClipboardList className="w-4 h-4" />יומן
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export">
            <ExportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="import">
            <ImportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="avail-export">
            <AvailabilityExportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="avail-import">
            <AvailabilityImportPanel currentUser={currentUser} onAuditLog={refreshLogs} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogTable logs={auditLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
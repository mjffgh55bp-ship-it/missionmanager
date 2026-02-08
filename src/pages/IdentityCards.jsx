import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Users as UsersIcon, GraduationCap, BookOpen, Search } from "lucide-react";

export default function IdentityCards() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await base44.entities.Worker.filter({ active: true }, "-created_date");
      setWorkers(data);
    } catch (error) {
      console.error("Error loading workers:", error);
    }
    setLoading(false);
  };

  const filteredWorkers = workers.filter(worker => 
    worker.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worker.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worker.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const roleLabels = {
      chef: "שף",
      sous_chef: "סו שף"
    };
    return roleLabels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6" dir="rtl">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-600">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">תעודות זהות</h1>
          <p className="text-gray-600">כרטיסי זיהוי של כל העובדים</p>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="חפש עובד לפי שם, כינוי או אימייל..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map((worker) => (
            <Card key={worker.id} className="hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {worker.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-1">{worker.full_name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {getRoleBadge(worker.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {worker.nickname && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">כינוי</div>
                      <div className="text-sm font-medium text-gray-900">{worker.nickname}</div>
                    </div>
                  </div>
                )}

                {worker.email && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">אימייל</div>
                      <div className="text-sm font-medium text-gray-900 break-all">{worker.email}</div>
                    </div>
                  </div>
                )}

                {worker.population && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <UsersIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">אוכלוסייה</div>
                      <div className="text-sm font-medium text-gray-900">{worker.population}</div>
                    </div>
                  </div>
                )}

                {worker.training && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <GraduationCap className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">הכשרה</div>
                      <div className="text-sm font-medium text-gray-900">{worker.training}</div>
                    </div>
                  </div>
                )}

                {worker.additional_training && (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <BookOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">הכשרה נוספת</div>
                      <div className="text-sm font-medium text-gray-900">{worker.additional_training}</div>
                    </div>
                  </div>
                )}

                {!worker.nickname && !worker.email && !worker.population && !worker.training && !worker.additional_training && (
                  <div className="text-center text-sm text-gray-500 py-4">
                    לא הוזן מידע נוסף
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredWorkers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">לא נמצאו עובדים</p>
          </div>
        )}
      </div>
    </div>
  );
}
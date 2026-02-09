import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Calendar, Users, Truck, BarChart3, ChefHat, Grid, Clock, Award, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const managerNavigationItems = [
  { title: "לוח", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "שלדית", url: createPageUrl("Skeletons"), icon: Grid },
  { title: "מטריצה", url: createPageUrl("Matrix"), icon: Grid },
  { title: "זמינות אישית", url: createPageUrl("Availability"), icon: Clock },
  { title: "עובדים", url: createPageUrl("Workers"), icon: Users },
  { title: "דוחות", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "תקופתית", url: createPageUrl("Yearly"), icon: BarChart3 },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings },
];

const userNavigationItems = [
  { title: "זמינות אישית", url: createPageUrl("PersonalAvailability"), icon: Clock },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);



  const checkUserRole = async () => {
    try {
      const user = await base44.auth.me();
      
      // Check if user is admin in the system
      if (user.role === "admin") {
        setUserRole("manager");
        setLoading(false);
        return;
      }
      
      const settings = await base44.entities.AppSettings.filter({ setting_key: "user_roles" });
      
      if (settings.length > 0) {
        const rolesData = JSON.parse(settings[0].setting_value);
        const role = rolesData[user.email] || "user";
        setUserRole(role);
      }
    } catch (error) {
      setUserRole("user");
    }
    setLoading(false);
  };

  const navigationItems = userRole === "manager" ? managerNavigationItems : userNavigationItems;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-green-50">
        <div className="text-green-600" dir="rtl">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white to-green-50 relative">
      {/* Floating Sidebar */}
      {sidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div 
            className="fixed top-0 left-0 h-full w-56 bg-white border-r border-green-100 shadow-xl z-50 transform transition-transform duration-300"
          >
            <div className="border-b border-green-100 p-4 bg-gradient-to-br from-green-50 to-white">
              <div className="flex flex-col items-end gap-2" dir="rtl">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-green-800 text-lg">מנהל משימות</h2>
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-300 rounded-xl flex items-center justify-center shadow-md">
                    <ChefHat className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-xs text-green-600">ניהול עגלות מזון</p>
              </div>
            </div>
            
            <div className="p-2">
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wider px-2 py-2 text-right" dir="rtl">
                ניווט
              </div>
              <div className="space-y-1">
                {navigationItems.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-200 flex-row-reverse justify-end ${
                      location.pathname === item.url 
                        ? 'bg-gradient-to-r from-green-400 to-green-300 text-white shadow-sm hover:shadow-md' 
                        : 'hover:bg-green-50 hover:text-green-700 text-gray-700'
                    }`}
                    dir="rtl"
                  >
                    <span className="font-medium">{item.title}</span>
                    <item.icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="min-h-screen flex flex-col w-full">
        <header className="bg-gradient-to-r from-white to-green-50 border-b border-green-100 px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-green-100 p-2 rounded-lg transition-colors duration-200 text-green-700"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </button>
            <h1 className="text-xl font-bold text-green-800 flex-1 text-right" dir="rtl">מנהל משימות</h1>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
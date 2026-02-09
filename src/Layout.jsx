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
  { title: "מטריצה", url: createPageUrl("Matrix"), icon: Grid },
  { title: "זמינות אישית", url: createPageUrl("Availability"), icon: Clock },
  { title: "עובדים", url: createPageUrl("Workers"), icon: Users },
  { title: "דוחות", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "תקופתית", url: createPageUrl("Yearly"), icon: BarChart3 },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings },
];

const userNavigationItems = [
  { title: "זמינות אישית", url: createPageUrl("Availability"), icon: Clock },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const threshold = 50; // pixels from the right edge
      const isNearRightEdge = window.innerWidth - e.clientX < threshold;
      
      if (isNearRightEdge) {
        setSidebarOpen(true);
      }
    };

    const handleMouseLeave = () => {
      setSidebarOpen(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600" dir="rtl">טוען...</div>
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="min-h-screen w-full bg-gray-50 relative">
        <Sidebar 
          side="right" 
          collapsible="offcanvas" 
          className="border-l border-gray-200 z-50 fixed w-56"
          onMouseLeave={() => setSidebarOpen(false)}
        >
          <SidebarHeader className="border-b border-gray-200 p-4">
            <div className="flex flex-col items-end gap-2" dir="rtl">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 text-lg">מנהל משימות</h2>
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-400 rounded-xl flex items-center justify-center shadow-lg">
                  <ChefHat className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-gray-500">ניהול עגלות מזון</p>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-2 text-right" dir="rtl">
                ניווט
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-green-50 hover:text-green-700 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-green-500 text-white hover:bg-green-600 hover:text-white' : ''
                        }`}
                      >
                        <Link to={item.url} onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 px-2 py-2 flex-row-reverse justify-end" dir="rtl">
                          <span className="font-medium">{item.title}</span>
                          <item.icon className="w-4 h-4" />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="min-h-screen flex flex-col w-full relative z-0">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-4 justify-end">
              <h1 className="text-xl font-bold text-gray-900 flex-1 text-right" dir="rtl">מנהל משימות</h1>
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
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
  { title: "לוח בקרה", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "לוח תורים", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "מטריצה", url: createPageUrl("Matrix"), icon: Grid },
  { title: "האיזור האישי", url: createPageUrl("Availability"), icon: Clock },
  { title: "תעודות זהות", url: createPageUrl("IdentityCards"), icon: Users },
  { title: "עובדים", url: createPageUrl("Workers"), icon: Users },
  { title: "עגלות", url: createPageUrl("FoodCarts"), icon: Truck },
  { title: "כשירויות", url: createPageUrl("Qualifications"), icon: Award },
  { title: "דוחות", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "תצוגה תקופתית", url: createPageUrl("Yearly"), icon: BarChart3 },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings },
];

const userNavigationItems = [
  { title: "האיזור האישי", url: createPageUrl("Availability"), icon: Clock },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const user = await base44.auth.me();
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
    <SidebarProvider defaultOpen={false}>
      <style>{`
        * {
          font-family: Calibri, sans-serif !important;
        }
        body {
          background-color: #d9f99d !important;
        }
        .bg-gray-50, .bg-gray-100 {
          background-color: #d9f99d !important;
        }
        .bg-white {
          background-color: white !important;
        }
        /* Card styling */
        [class*="rounded-xl"], [class*="rounded-lg"] {
          border: 3px solid black !important;
          background-color: white !important;
        }
        /* Button styling */
        button[class*="bg-blue"], button[class*="bg-primary"], .bg-blue-900, .bg-blue-600 {
          background-color: #84cc16 !important;
          color: black !important;
          border: 2px solid black !important;
        }
        button[class*="bg-blue"]:hover, button[class*="bg-primary"]:hover {
          background-color: #65a30d !important;
        }
        /* Sidebar styling */
        [data-sidebar] {
          background-color: #d9f99d !important;
          border-right: 3px solid black !important;
        }
        [data-sidebar] button[data-active="true"], [data-sidebar] a[class*="bg-blue"] {
          background-color: #84cc16 !important;
          color: black !important;
        }
        /* Header styling */
        header {
          background-color: #d9f99d !important;
          border-bottom: 3px solid black !important;
        }
      `}</style>
      <div className="min-h-screen flex w-full" style={{backgroundColor: '#d9f99d'}}>
        <Sidebar collapsible="offcanvas" className="z-50" style={{backgroundColor: '#d9f99d', borderRight: '3px solid black'}}>
          <SidebarHeader className="p-6" style={{borderBottom: '3px solid black'}}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor: '#84cc16', border: '2px solid black'}}>
                <ChefHat className="w-6 h-6 text-black" />
              </div>
              <div dir="rtl">
                <h2 className="font-bold text-black text-lg">מנהל משימות</h2>
                <p className="text-xs text-black">ניהול עגלות מזון</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-black uppercase tracking-wider px-3 py-2" dir="rtl">
                תפריט
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className="hover:opacity-80 transition-all duration-200 rounded-lg mb-1"
                        style={{
                          backgroundColor: location.pathname === item.url ? '#84cc16' : 'transparent',
                          color: 'black',
                          border: location.pathname === item.url ? '2px solid black' : '2px solid transparent'
                        }}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col relative z-0">
          <header className="px-6 py-4 flex items-center justify-between" style={{backgroundColor: '#d9f99d', borderBottom: '3px solid black'}}>
            <SidebarTrigger 
              className="p-2 rounded-lg transition-colors duration-200" 
              style={{backgroundColor: '#84cc16', border: '2px solid black', color: 'black'}}
            />
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-black" dir="rtl">מערכת ניהול משמרות</h1>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: 'black'}}>
                <Users className="w-5 h-5 text-white" />
              </div>
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
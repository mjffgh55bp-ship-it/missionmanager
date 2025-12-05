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
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Matrix", url: createPageUrl("Matrix"), icon: Grid },
  { title: "Availability", url: createPageUrl("Availability"), icon: Clock },
  { title: "Workers", url: createPageUrl("Workers"), icon: Users },
  { title: "Food Carts", url: createPageUrl("FoodCarts"), icon: Truck },
  { title: "Qualifications", url: createPageUrl("Qualifications"), icon: Award },
  { title: "Reports", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "Yearly", url: createPageUrl("Yearly"), icon: BarChart3 },
  { title: "Settings", url: createPageUrl("Settings"), icon: Settings },
];

const userNavigationItems = [
  { title: "Availability", url: createPageUrl("Availability"), icon: Clock },
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
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-900 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Mission Manager</h2>
                <p className="text-xs text-gray-500">Food Cart Operations</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-900 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-blue-900 text-white hover:bg-blue-800 hover:text-white' : ''
                        }`}
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

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900">Mission Manager</h1>
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
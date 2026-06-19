import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Calendar, Users, Truck, BarChart3, Grid, Clock, Award, Settings, ExternalLink, CalendarDays, Calculator, ShieldCheck } from "lucide-react";


const managerNavigationItems = [
  { title: "לוח", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "מטריצה", url: createPageUrl("Matrix"), icon: Grid },
  { title: "זמינות אישית", url: createPageUrl("Availability"), icon: Clock },
  { title: "עובדים", url: createPageUrl("Workers"), icon: Users },
  { title: "דוחות", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "תקופתית", url: createPageUrl("Yearly"), icon: CalendarDays },
  { title: "מחשבון משמרות", url: createPageUrl("ShiftMaster"), icon: Calculator },
  { title: "העברת נתונים", url: createPageUrl("DataTransfer"), icon: ShieldCheck },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings },
];

const userNavigationItems = [
  { title: "זמינות אישית", url: createPageUrl("Availability"), icon: Clock },
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

  // For non-manager users, show only content without navigation
  if (userRole !== "manager") {
    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          @font-face {
            font-family: 'Calibri';
            src: local('Calibri'), local('Calibri Regular');
          }
          
          * {
            font-family: 'Calibri', sans-serif !important;
          }
          
          *::before, *::after {
            font-family: 'Calibri', sans-serif !important;
          }
          
          html, body, div, span, p, a, label, input, textarea, select, button, 
          h1, h2, h3, h4, h5, h6, td, th, tr, table, li, ul, ol,
          header, footer, section, article, nav, form, fieldset, legend,
          main, aside, figure, figcaption, svg, text {
            font-family: 'Calibri', sans-serif !important;
          }
        `}} />
        <div className="min-h-screen w-full bg-gray-50" dir="rtl">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @font-face {
          font-family: 'Calibri';
          src: local('Calibri'), local('Calibri Regular');
        }
        * { font-family: 'Calibri', sans-serif !important; }
        *::before, *::after { font-family: 'Calibri', sans-serif !important; }
        html, body, div, span, p, a, label, input, textarea, select, button, 
        h1, h2, h3, h4, h5, h6, td, th, tr, table, li, ul, ol,
        header, footer, section, article, nav, form, fieldset, legend,
        main, aside, figure, figcaption, svg, text {
          font-family: 'Calibri', sans-serif !important;
        }
        .nav-item-label {
          opacity: 0;
          pointer-events: none;
          transform: translateX(8px);
          transition: opacity 0.15s ease, transform 0.15s ease;
          white-space: nowrap;
          position: absolute;
          right: 48px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 13px;
          font-weight: 500;
          color: #1f2937;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          z-index: 200;
        }
        .nav-icon-btn:hover .nav-item-label {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(0);
        }
      `}} />
      <div className="min-h-screen w-full bg-gray-50 relative" dir="rtl">

        {/* Sidebar: bottom bar on mobile, right column on desktop */}
        <nav
          className="fixed z-[100] flex items-center gap-1
                     bottom-0 left-0 right-0 h-12 flex-row justify-center overflow-hidden overscroll-none
                     border-t border-gray-200
                     md:top-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:w-12
                     md:flex-col md:justify-start md:overflow-hidden md:overscroll-none
                     md:border-t-0 md:border-l md:border-gray-200"
          style={{ background: '#ffffff', boxShadow: '-2px 0 6px rgba(0,0,0,0.08)' }}
        >

          {navigationItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <div key={item.title} className="nav-icon-btn relative flex items-center" style={{ width: 40 }}>
                <Link
                  to={item.url}
                  title={item.title}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0 ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : 'text-gray-500 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                </Link>
                <span className="nav-item-label hidden md:block">{item.title}</span>
              </div>
            );
          })}

          {/* Open in new window — desktop only */}
          <div className="nav-icon-btn hidden md:flex relative items-center md:mt-auto" style={{ width: 40 }}>
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-700 transition-all duration-150"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <span className="nav-item-label hidden md:block">פתח בחלון חדש</span>
          </div>
        </nav>

        {/* Main content — right margin on desktop, bottom padding on mobile */}
        <main className="min-h-screen flex flex-col pb-12 md:pb-0 md:mr-12 overflow-x-hidden">
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
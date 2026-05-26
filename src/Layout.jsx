import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Calendar, Users, Truck, BarChart3, Grid, Clock, Award, Settings, ExternalLink, CalendarDays, Calculator, Briefcase, ShieldCheck } from "lucide-react";


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

        {/* Fixed icon-only sidebar: right on desktop, bottom on mobile */}
        <nav
          className="fixed z-[100] flex items-center gap-1 py-4 px-2 md:flex-col md:top-0 md:right-0 md:h-full md:py-4 md:px-0 bottom-0 right-0 left-0 md:left-auto justify-center md:justify-start overflow-x-auto md:overflow-x-visible"
          style={{ background: '#f9fafb', borderTop: '1px solid #d1d5db', borderLeft: '1px solid #d1d5db', boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.5), 0 2px 8px rgba(0,0,0,0.12)', width: 'auto', height: 48, mdHeight: '100vh', mdWidth: 48 }}
        >
          {/* Logo icon — hidden on mobile */}
          <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-green-500 to-green-400 rounded-xl flex-col items-center justify-center shadow mb-3 flex-shrink-0">
            <Briefcase className="w-4 h-4 text-white" />
          </div>

          {navigationItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <div key={item.title} className="nav-icon-btn relative flex items-center md:flex-col" style={{ width: 40 }}>
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

          {/* Open in new window — hidden on mobile */}
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

        {/* Main Content — offset for sidebar on desktop, bottom padding on mobile */}
        <main className="min-h-screen flex flex-col md:min-h-[calc(100vh-48px)]" style={{ marginRight: 'auto', marginBottom: 48, md: { marginRight: 48, marginBottom: 0 } }}>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
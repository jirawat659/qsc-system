import AssignedAuditPlanScreen from "../screens/schedule/AssignedAuditPlanScreen";
import ConsolidatedReportsScreen from "../screens/admin/ConsolidatedReportsScreen";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, List, ClipboardList, ClipboardCheck,
  Scale, Store, MapPin, ChevronLeft, ChevronRight, Camera, Bell,
  CheckCircle2, XCircle, Banknote, Users, Settings, MoreHorizontal,
  Navigation, Phone, PenTool, Check, FileText, Copy, Plus, ShieldCheck,
  MessageSquare, ImagePlus, Send, Clock, Trash2, GripVertical, Edit3,
  Megaphone, Eye, EyeOff, Zap, X, ChevronDown, ChevronUp, History as HistoryIcon,
  Maximize2, Minimize2, CheckCheck, RefreshCw, Key, ShieldAlert,
  Laptop, Smartphone, Search, Filter, ArrowUpRight, ExternalLink,
  Award, TrendingUp, AlertTriangle, Sparkles, SlidersHorizontal,
  BarChart3, CheckSquare, Layers, UserCheck, Download, FileSpreadsheet,
  Wrench, Square, Minus, Building2, ArrowUpDown, LogOut, History, Shield, Info, HelpCircle
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../config/theme";
import { ROLES, NAV_BY_ROLE, ROLE_USER_MAP } from "../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP } from "../config/constants";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";
import { AUDITORS_DATA, AUDITORS_LIST } from "../mocks/auditors";
import api from "../config/api";

import ErrorBoundary from "../shared/ErrorBoundary";
import ProfileModal from "../modals/ProfileModal";

// Screens
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import ScheduleScreen from "../screens/schedule/ScheduleScreen";
import LiveAuditScreen from "../screens/audit/LiveAuditScreen";
import AllAuditHistoryScreen from "../screens/dashboard/AllAuditHistoryScreen";
import FormsScreen from "../screens/forms/FormsScreen";
import CapScreen from "../screens/cap/CapScreen";
import AdminMoreScreen from "../screens/admin/AdminMoreScreen";

export default function MainDashboard({ onLogout }) {

  const [locations, setLocations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [forms, setForms] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [capTasks, setCapTasks] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);

  const refreshData = async () => {
    try {
      const [locRes, schedRes, formRes, draftRes, capRes, auditRes] = await Promise.allSettled([
        api.get('/location'),
        api.get('/schedule'),
        api.get('/form'),
        api.get('/audit/draft'),
        api.get('/cap'),
        api.get('/audit')
      ]);

      if (locRes.status === 'fulfilled' && locRes.value.data) setLocations(locRes.value.data);
      if (schedRes.status === 'fulfilled' && schedRes.value.data) setSchedules(schedRes.value.data);
      if (formRes.status === 'fulfilled' && formRes.value.data) setForms(formRes.value.data);
      if (draftRes.status === 'fulfilled' && draftRes.value.data) {
        setActiveDraft(draftRes.value.data);
      } else {
        setActiveDraft(null);
      }
      if (capRes.status === 'fulfilled' && capRes.value.data) setCapTasks(capRes.value.data);
      if (auditRes.status === 'fulfilled' && auditRes.value.data) setAuditRecords(auditRes.value.data);
    } catch (err) {
      console.warn("Error refreshing backend data:", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        window.location.reload();
      }
    }
  };

  const storedUser = useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);

  const [role, setRole] = useState(() => storedUser?.role || localStorage.getItem('role') || "AUDITOR");
  const [toastText, setToastText] = useState(null);
  const [subHeader, setSubHeader] = useState(null);
  
  const nav = NAV_BY_ROLE[role] || NAV_BY_ROLE.AUDITOR;
  const [screen, setScreen] = useState(nav[0]?.key || "dashboard");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [preselectedPlan, setPreselectedPlan] = useState(null);
  const [isLiveAuditActive, setIsLiveAuditActive] = useState(false);
  const [activeAuditDraft, setActiveAuditDraft] = useState(null);

  const currentUser = useMemo(() => {
    if (storedUser) {
      return {
        id: storedUser.id,
        name: storedUser.fullName || storedUser.username,
        username: storedUser.username,
        title: storedUser.roleName || storedUser.role,
        role: storedUser.role,
        branchScope: storedUser.branchScope,
        allowedLocationIds: storedUser.allowedLocationIds || [],
        avatar: (storedUser.fullName || storedUser.username || "US").substring(0, 2)
      };
    }
    return {
      id: 1,
      name: "ผู้ใช้งานระบบ",
      username: "user",
      title: "ผู้ใช้งาน",
      role: role,
      branchScope: "ALL",
      allowedLocationIds: [],
      avatar: "US"
    };
  }, [storedUser, role]);

  const handleRoleChange = (r) => {
    setRole(r);
    localStorage.setItem('role', r);
    const newNav = NAV_BY_ROLE[r] || NAV_BY_ROLE.AUDITOR;
    setScreen(newNav[0]?.key || "dashboard");
    setRoleMenuOpen(false);
  };

  const [navResetKey, setNavResetKey] = useState(0);

  const handleNavClick = (key) => {
    if (key === "audit") {
      setPreselectedPlan(null); // When user clicks "ตรวจหน้างาน", always start fresh at Step 1
    }
    setNavResetKey(prev => prev + 1);
    setScreen(key);
  };

  const handleStartAuditDirect = (scheduleItem) => {
    if (role !== "AUDITOR" && role !== "ADMIN" && role !== "STANDARD") {
      alert("บทบาทผู้รับการตรวจไม่สามารถบันทึกผลการตรวจประเมินได้");
      return;
    }
    setPreselectedPlan(scheduleItem);
    setScreen("audit");
  };

  const renderCurrentScreen = () => {
    return (
      <ErrorBoundary>
        {screen === "history" && (
          <ConsolidatedReportsScreen
            onBack={undefined}
            currentAuditorName={currentUser.name}
            title="ประวัติการตรวจของฉัน"
          />
        )}
        {screen === "audit" && role === "AUDITOR" && !preselectedPlan && !activeAuditDraft && (
          <AssignedAuditPlanScreen
            auditorName={currentUser.name}
            onStart={(plan) => setPreselectedPlan(plan)}
            activeDraft={activeAuditDraft}
            onResumeDraft={() => setPreselectedPlan(activeAuditDraft.unit ? { unit: activeAuditDraft.unit.name, ...activeAuditDraft } : { unit: "สาขาสยาม" })}
          />
        )}
        {screen === "audit" && (role !== "AUDITOR" || preselectedPlan || activeAuditDraft) && (
          <LiveAuditScreen
            preselectedPlan={preselectedPlan}
            initialDraft={activeAuditDraft}
            onClearPlan={() => setPreselectedPlan(null)}
            defaultAuditorName={currentUser.name || "สมชาย ใจดี"}
            onActiveStateChange={(isActive) => setIsLiveAuditActive(isActive)}
            onSaveDraft={(draft) => {
              setActiveAuditDraft(draft);
              setToastText("✓ บันทึกฉบับร่างเรียบร้อยแล้ว สถานะเปลี่ยนเป็น 'กำลังดำเนินการตรวจ'");
              setTimeout(() => setToastText(null), 3000);
            }}
            onCompleteAudit={() => {
              setActiveAuditDraft(null);
              setToastText("✓ บันทึกผลการตรวจสาขาสำเร็จ และออกใบรายงานผลอัตโนมัติเรียบร้อย");
              setTimeout(() => setToastText(null), 3000);
            }}
          />
        )}
        {screen === "forms" && <FormsScreen isDesktop={true} role={role} onBack={() => setScreen("more")} />}
        {screen === "cap" && <CapScreen isDesktop={true} role={role} onBack={role !== "AUDITEE" ? () => setScreen("more") : undefined} />}
        {screen === "more" && <AdminMoreScreen isDesktop={true} role={role} onNavigate={handleNavClick} />}
        {screen === "schedule" && (
          <ScheduleScreen
            role={role}
            isDesktop={true}
            onStartAuditDirect={handleStartAuditDirect}
            currentAuditorName={role === "AUDITOR" ? currentUser.name : null}
            onBack={role === "STANDARD" || role === "ADMIN" ? () => setScreen("more") : undefined}
          />
        )}
        {screen === "dashboard" && <DashboardScreen role={role} isDesktop={true} />}
      </ErrorBoundary>
    );
  };

  const topBarContextValue = React.useMemo(() => ({ subHeader, setSubHeader }), [subHeader]);

  return (
    <DataContext.Provider value={{ locations, setLocations, schedules, setSchedules, forms, setForms, activeDraft, setActiveDraft, capTasks, setCapTasks, auditRecords, setAuditRecords, refreshData }}>
    <TopBarContext.Provider value={topBarContextValue}>
    <div className="w-full min-h-screen" style={{ background: "#EBEAE5", fontFamily: sans }}>
      
      {/* Toast Notification Banner */}
      {toastText && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1C2129] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 border border-emerald-500">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastText}</span>
        </div>
      )}

      {/* UNIFIED FULLY RESPONSIVE APPLICATION LAYOUT */}
      <div className="w-full min-h-screen flex flex-col lg:flex-row" style={{ background: c.bg }}>
        
        {/* DESKTOP SIDEBAR (Visible on Desktop lg: >= 1024px, Hidden on Mobile) */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 bg-white border-r flex-col justify-between shadow-2xs h-screen sticky top-0" style={{ borderColor: c.border }}>
          <div className="p-5 space-y-5">
            {/* Brand Header */}
            <div className="flex items-center gap-3 pb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                Q
              </div>
              <div>
                <div className="text-base font-bold leading-tight text-slate-900">Q.S.C. System</div>
                <div className="text-xs font-normal text-slate-400 mt-0.5">Quality Compliance</div>
              </div>
            </div>

            

            {/* Sidebar Navigation */}
            <nav className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider px-3.5 mb-2 text-slate-400">เมนูการทำงาน</div>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = screen === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavClick(item.key)}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold text-left transition-all cursor-pointer ${
                      active 
                        ? 'bg-[#E3F0ED] text-[#0F6659] shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={20} className={active ? 'text-[#0F6659]' : 'text-slate-400'} />
                    <span className="tracking-tight">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User footer profile */}
          <div className="p-4 border-t bg-slate-50/50" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 text-white bg-[#0F6659]">
                  {currentUser.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-slate-800">{currentUser.name}</div>
                  <div className="text-xs font-normal truncate text-slate-500 mt-0.5">{currentUser.title}</div>
                </div>
              </div>

              {/* 🚪 Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 border border-slate-200 hover:border-red-200 flex items-center justify-center cursor-pointer transition-all active:scale-90 shrink-0 shadow-2xs group"
                title="ออกจากระบบ (Log Out)"
              >
                <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </aside>

        {/* 🌟 MOBILE & DESKTOP INTEGRATED TOP HEADER WITH DYNAMIC SUB-HEADER */}
        <header className="flex lg:hidden shrink-0 px-3.5 pt-3.5 pb-3 items-center justify-between shadow-xs sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b gap-2.5" style={{ borderColor: c.border }}>
          {subHeader ? (
            /* 🌟 SUB-SCREEN TOP BAR: Elevated Back Button + Title + Subtitle at the Very Top! */
            <div className="flex items-center gap-3 min-w-0 flex-1 animate-in fade-in slide-in-from-left-2 duration-150">
              {subHeader.onBack && (
                <button
                  type="button"
                  onClick={subHeader.onBack}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-center cursor-pointer shadow-2xs active:scale-90 transition-all border border-slate-200/90 shrink-0"
                  title="ย้อนกลับ"
                >
                  <ChevronLeft size={22} className="text-[#0F6659]" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  {subHeader.title}
                </div>
                {subHeader.subtitle && (
                  <div className="text-xs font-normal text-slate-500 truncate mt-0.5">
                    {subHeader.subtitle}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 🌟 ROOT TAB TOP BAR: Brand Logo + Screen Pill */
            <>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 cursor-pointer group text-left shrink-0"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs text-white bg-gradient-to-tr from-[#0F6659] to-[#15806e] group-hover:scale-105 transition-transform">
                  Q
                </div>
                <div>
                  <div className="text-sm font-extrabold leading-none text-slate-900">Q.S.C.</div>
                  <div className="text-xs font-medium text-emerald-700 mt-0.5 truncate max-w-[140px]">
                    {currentUser.name}
                  </div>
                </div>
              </button>
            </>
          )}

          {/* Right Side: Clickable Profile Avatar (Opens Profile Modal) */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-1.5 p-1 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0"
            title="ดูโปรไฟล์และบัญชีผู้ใช้"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs text-white bg-[#0F6659]">
              {currentUser.avatar}
            </div>
          </button>
        </header>

        {/* MAIN CONTENT WORKSPACE (Fluid 100% Percentage Width) */}
        <main className="flex-1 flex flex-col overflow-y-auto min-h-screen pb-16 lg:pb-8">
          <div key={`${role}_${screen}_${navResetKey}`} className="page-transition flex-1 flex flex-col">
            {renderCurrentScreen()}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION: ซ่อนอัตโนมัติระหว่างที่กำลังทำการตรวจหน้างาน (Live Audit) */}
        {!isLiveAuditActive && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-2 pt-0 pointer-events-none flex justify-center animate-in slide-in-from-bottom-2 duration-200">
          <div className="pointer-events-auto w-full max-w-[420px] sm:max-w-md mx-auto relative h-[60px] flex items-center justify-around px-2">
            
            {/* 🌟 1. ELEVATED CONTINUOUS SEAMLESS VECTOR PATH (ยอดโค้งสูงขึ้นและสมูท) */}
            <svg
              className="absolute inset-0 w-full h-[86px] pointer-events-none -top-6.5 drop-shadow-[0_-4px_18px_rgba(0,0,0,0.08)]"
              viewBox="0 0 380 86"
              preserveAspectRatio="none"
            >
              <path
                d="M 18 26 
                   L 138 26 
                   C 156 26, 166 0, 190 0 
                   C 214 0, 224 26, 242 26 
                   L 362 26 
                   A 16 16 0 0 1 378 42 
                   L 378 70 
                   A 16 16 0 0 1 362 86 
                   L 18 86 
                   A 16 16 0 0 1 2 70 
                   L 2 42 
                   A 16 16 0 0 1 18 26 
                   Z"
                fill="#FFFFFF"
                stroke="#E2E8F0"
                strokeWidth="1.3"
              />
            </svg>

            {/* 🌟 2. NAVIGATION BUTTONS */}
            {nav.map((item) => {
              const Icon = item.icon;
              const active = screen === item.key;

              if (item.isPrimary) {
                return (
                  <div key={item.key} className="flex-1 flex flex-col items-center relative -top-4.5 z-20">
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.key)}
                      aria-label={item.label}
                      title={item.label}
                      className={`w-[50px] h-[50px] rounded-full flex items-center justify-center text-white cursor-pointer bg-gradient-to-tr from-[#075A4E] via-[#0F6659] to-emerald-500 shadow-md shadow-emerald-950/25 active:scale-90 transition-all duration-200 ${active ? "ring-2 ring-emerald-500 shadow-lg" : "hover:scale-105"}`}
                    >
                      <Icon size={23} strokeWidth={2.5} />
                    </button>
                    <span className={`text-[10px] tracking-tight text-center whitespace-nowrap mt-0.5 ${active ? "font-extrabold text-[#0F6659]" : "font-bold text-slate-700"}`}>
                      {item.label}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavClick(item.key)}
                  aria-label={item.label}
                  className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl cursor-pointer transition-all duration-200 active:scale-90 group relative z-20 ${active ? "bg-emerald-50 text-[#0F6659]" : "text-slate-400 hover:text-slate-700"}`}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-[10px] tracking-tight text-center whitespace-nowrap mt-0.5 ${active ? "font-extrabold text-[#0F6659]" : "font-bold text-slate-600"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
        )}
      </div>

      {/* 👤 User Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
    </TopBarContext.Provider>
    </DataContext.Provider>
  );
}

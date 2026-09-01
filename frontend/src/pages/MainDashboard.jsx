import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  Wrench, Square, Minus, Building2, ArrowUpDown, LogOut, History, Shield, Info, HelpCircle, AlertCircle, Loader2
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../config/theme";
import { ROLES, NAV_BY_ROLE, getRoleNavConfig, NAV_MODULES_DICT } from "../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP } from "../config/constants";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";
import authStorage from "../config/storage";
import api from "../config/api";

import ErrorBoundary from "../shared/ErrorBoundary";
import ProfileModal from "../modals/ProfileModal";

// 🌟 Lazy-loaded Screens for Code Splitting & Performance Optimization
const DashboardScreen = React.lazy(() => import("../screens/dashboard/DashboardScreen"));
const ScheduleScreen = React.lazy(() => import("../screens/schedule/ScheduleScreen"));
const LiveAuditScreen = React.lazy(() => import("../screens/audit/LiveAuditScreen"));
const AllAuditHistoryScreen = React.lazy(() => import("../screens/dashboard/AllAuditHistoryScreen"));
const FormsScreen = React.lazy(() => import("../screens/forms/FormsScreen"));
const CapScreen = React.lazy(() => import("../screens/cap/CapScreen"));
const AdminMoreScreen = React.lazy(() => import("../screens/admin/AdminMoreScreen"));
const AssignedAuditPlanScreen = React.lazy(() => import("../screens/schedule/AssignedAuditPlanScreen"));
const ConsolidatedReportsScreen = React.lazy(() => import("../screens/admin/ConsolidatedReportsScreen"));

const ScreenLoader = () => (
  <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center p-8">
    <div className="w-10 h-10 border-4 border-emerald-200 border-t-[#0F6659] rounded-full animate-spin"></div>
    <span className="text-xs font-bold text-slate-400 mt-3 animate-pulse">กำลังโหลดข้อมูลหน้าจอ...</span>
  </div>
);

export default function MainDashboard({ onLogout }) {

  const [locations, setLocations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [forms, setForms] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeDrafts, setActiveDrafts] = useState([]);
  const [capTasks, setCapTasks] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataFetchError, setDataFetchError] = useState(null);

  const refreshData = async () => {
    setIsLoadingData(true);
    setDataFetchError(null);
    try {
      const [locRes, schedRes, formRes, draftsRes, capRes, auditRes] = await Promise.allSettled([
        api.get('/location'),
        api.get('/schedule'),
        api.get('/form'),
        api.get('/audit/drafts'),
        api.get('/cap'),
        api.get('/audit/records')
      ]);

      const rejectedCount = [locRes, schedRes, formRes, capRes, auditRes].filter(r => r.status === 'rejected').length;
      if (rejectedCount > 0) {
        setDataFetchError(`ไม่สามารถเชื่อมต่อดึงข้อมูลบางส่วนได้ (${rejectedCount} รายการ)`);
      }

      if (locRes.status === 'fulfilled' && locRes.value.data) setLocations(locRes.value.data);
      if (schedRes.status === 'fulfilled' && schedRes.value.data) setSchedules(schedRes.value.data);
      if (formRes.status === 'fulfilled' && formRes.value.data) setForms(formRes.value.data);
      if (draftsRes.status === 'fulfilled' && Array.isArray(draftsRes.value.data)) {
        const drafts = draftsRes.value.data;
        setActiveDrafts(drafts);
        setActiveDraft(drafts.length > 0 ? drafts[0] : null);
      } else {
        setActiveDrafts([]);
        setActiveDraft(null);
      }
      if (capRes.status === 'fulfilled' && capRes.value.data) setCapTasks(capRes.value.data);
      if (auditRes.status === 'fulfilled' && auditRes.value.data) setAuditRecords(auditRes.value.data);
    } catch (err) {
      console.warn("Error refreshing backend data:", err);
      setDataFetchError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      authStorage.clearSession();
      window.location.reload();
    }
  };

  const storedUser = useMemo(() => {
    return authStorage.getUser();
  }, []);

  const [role, setRole] = useState(() => storedUser?.role || authStorage.getRole() || "AUDITOR");
  const [toastText, setToastText] = useState(null);
  const [subHeader, setSubHeader] = useState(null);
  
  // 🌟 Dynamic 3-slot navigation configuration per role
  const nav = useMemo(() => {
    const userNavConfig = storedUser?.navConfig || storedUser?.navConfigJson;
    return getRoleNavConfig(role, userNavConfig);
  }, [role, storedUser]);

  const [screen, setScreen] = useState(() => nav[0]?.key || "dashboard");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [preselectedPlan, setPreselectedPlan] = useState(null);
  const [isLiveAuditActive, setIsLiveAuditActive] = useState(false);
  const [activeAuditDraft, setActiveAuditDraft] = useState(null);
  const [auditSyncStatus, setAuditSyncStatus] = useState("idle");

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
        avatar: (storedUser.fullName || storedUser.username || "US").substring(0, 2),
        permissions: storedUser.permissions || [],
        navConfig: storedUser.navConfig,
        navConfigJson: storedUser.navConfigJson
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
      avatar: "US",
      permissions: []
    };
  }, [storedUser, role]);

  const handleRoleChange = (r) => {
    setRole(r);
    authStorage.setRole(r);
    const newNav = getRoleNavConfig(r, storedUser?.navConfig || storedUser?.navConfigJson);
    setScreen(newNav[0]?.key || "dashboard");
  };

  const [moreResetKey, setMoreResetKey] = useState(0);
  const mainContentRef = useRef(null);

  // 🌟 Native GPU-Accelerated Smooth Scroll (Buttery smooth 120Hz/60Hz without JS-CSS fighting)
  const smoothScrollToTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      if (document.documentElement && document.documentElement.scrollTop > 0) {
        document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
      if (document.body && document.body.scrollTop > 0) {
        document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
      if (mainContentRef.current && mainContentRef.current.scrollTop > 0) {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
    } catch (e) {
      window.scrollTo(0, 0);
    }
  };

  const handleNavClick = (key) => {
    if (key === "more") {
      setMoreResetKey(prev => prev + 1);
    }
    if (key === "audit") {
      setPreselectedPlan(null); // When user clicks "ตรวจหน้างาน", always start fresh at Step 1
    }
    if (screen === key) {
      // 🌟 ถ้าอยู่ที่แท็บเดิม เช่น "ระบบ" ให้รีเซ็ตกลับหน้าเมนูหลักของระบบ + เลื่อนขึ้นบนอย่างนุ่มนวล
      if (key === "more") {
        setMoreResetKey(prev => prev + 1);
      }
      smoothScrollToTop();
      return;
    }
    setScreen(key);
    smoothScrollToTop();
  };

  // Scroll to top automatically whenever screen changes
  useEffect(() => {
    smoothScrollToTop();
  }, [screen]);

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3500);
  };

  const handleStartAuditDirect = (scheduleItem) => {
    if (role !== "AUDITOR" && role !== "ADMIN" && role !== "STANDARD") {
      showToast("บทบาทผู้รับการตรวจไม่สามารถบันทึกผลการตรวจประเมินได้");
      return;
    }
    setPreselectedPlan(scheduleItem);
    setScreen("audit");
  };

  useEffect(() => {
    const handleCustomStartAudit = (e) => {
      if (e.detail) {
        handleStartAuditDirect(e.detail);
      }
    };
    window.addEventListener('app:start-audit', handleCustomStartAudit);
    return () => window.removeEventListener('app:start-audit', handleCustomStartAudit);
  }, [role]);

  const renderCurrentScreen = () => {
    return (
      <ErrorBoundary>
        <React.Suspense fallback={<ScreenLoader />}>
          {(screen === "reports" || screen === "history") && (
            <ConsolidatedReportsScreen
              onBack={undefined}
              currentAuditorName={null}
              title="รายงานผลการตรวจประเมิน"
              onStartAudit={(plan) => handleStartAuditDirect(plan)}
              onResumeDraft={(draft) => {
                setActiveAuditDraft(draft);
                handleStartAuditDirect({ ...draft, isResume: true });
              }}
              onStartNewAudit={() => {
                setPreselectedPlan(null);
                setActiveAuditDraft(null);
                setScreen("audit");
              }}
            />
          )}
          {screen === "audit" && (
            <LiveAuditScreen
              preselectedPlan={preselectedPlan}
              initialDraft={activeAuditDraft}
              currentUser={currentUser}
              onClearPlan={() => setPreselectedPlan(null)}
              onBack={() => {
                if (preselectedPlan) {
                  setPreselectedPlan(null);
                } else {
                  setScreen("dashboard");
                }
              }}
              defaultAuditorName={currentUser.name || "-"}
              onActiveStateChange={(isActive) => setIsLiveAuditActive(isActive)}
              onSyncStatusChange={(status) => setAuditSyncStatus(status)}
              onSaveDraft={(draft) => {
                setActiveAuditDraft(draft);
                setActiveDrafts(prev => {
                  const list = prev || [];
                  const existingIdx = list.findIndex(d => 
                    (d.id && draft.id && d.id === draft.id) || 
                    (d.locationId === draft.locationId && (d.surveyFormId === draft.formId || d.formId === draft.formId))
                  );
                  if (existingIdx >= 0) {
                    const next = [...list];
                    next[existingIdx] = { ...next[existingIdx], ...draft };
                    return next;
                  }
                  return [draft, ...list];
                });
              }}
              onCompleteAudit={() => {
                setActiveAuditDraft(null);
                setPreselectedPlan(null);
                refreshData();
                setScreen("reports");
              }}
            />
          )}
          {screen === "forms" && <FormsScreen isDesktop={true} role={role} onBack={() => setScreen("more")} />}
          {screen === "cap" && <CapScreen isDesktop={true} role={role} currentUser={currentUser} onBack={role !== "AUDITEE" ? () => setScreen("more") : undefined} />}
          {screen === "more" && (
            <AdminMoreScreen
              resetKey={moreResetKey}
              isDesktop={true}
              role={role}
              currentUser={currentUser}
              onNavigate={handleNavClick}
              onStartAuditDirect={handleStartAuditDirect}
            />
          )}
          {screen === "schedule" && (
            <ScheduleScreen
              role={role}
              currentUser={currentUser}
              isDesktop={true}
              onStartAuditDirect={handleStartAuditDirect}
              currentAuditorName={role === "AUDITOR" ? currentUser.name : null}
              onBack={role === "STANDARD" || role === "ADMIN" ? () => setScreen("more") : undefined}
            />
          )}
          {screen === "dashboard" && <DashboardScreen role={role} isDesktop={true} />}
        </React.Suspense>
      </ErrorBoundary>
    );
  };

  const topBarContextValue = React.useMemo(() => ({ subHeader, setSubHeader }), [subHeader]);

  const dataContextValue = React.useMemo(() => ({
    currentUser,
    locations, setLocations,
    schedules, setSchedules,
    forms, setForms,
    activeDraft, setActiveDraft,
    activeDrafts, setActiveDrafts,
    capTasks, setCapTasks,
    auditRecords, setAuditRecords,
    refreshData,
    isLoadingData,
    dataFetchError
  }), [
    currentUser, locations, schedules, forms,
    activeDraft, activeDrafts, capTasks, auditRecords,
    refreshData, isLoadingData, dataFetchError
  ]);

  return (
    <DataContext.Provider value={dataContextValue}>
    <TopBarContext.Provider value={topBarContextValue}>
    <div className="w-full min-h-screen" style={{ background: "#EBEAE5", fontFamily: sans }}>
      
      {/* ⚠️ API Fetch Warning Banner */}
      {dataFetchError && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-rose-900/90 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 border border-rose-500/50 backdrop-blur-xs">
          <AlertCircle size={15} className="text-rose-300 shrink-0" />
          <span>{dataFetchError}</span>
          <button
            type="button"
            onClick={() => setDataFetchError(null)}
            className="ml-2 text-rose-200 hover:text-white p-0.5"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Toast Notification Banner (Floating Top Screen Edge Banner via Portal) */}
      {toastText && typeof document !== "undefined" && createPortal(
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-[99999] bg-white/95 text-slate-800 px-4.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-3 border border-slate-200 ring-1 ring-emerald-500/20 backdrop-blur-md pointer-events-none">
          <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
          <span>{toastText}</span>
        </div>,
        document.body
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
              <div 
                onClick={() => setShowProfileModal(true)} 
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group/user"
                title="คลิกเพื่อดูโปรไฟล์ผู้ใช้งาน"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 text-white bg-[#0F6659] group-hover/user:scale-105 transition-transform">
                  {currentUser.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-slate-800 group-hover/user:text-[#0F6659] transition-colors">{currentUser.name}</div>
                  <div className="text-xs font-normal truncate text-slate-500 mt-0.5">{currentUser.title}</div>
                </div>
              </div>

              {/* 🚪 Logout Button */}
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(true)}
                className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 border border-slate-200 hover:border-rose-200 flex items-center justify-center cursor-pointer transition-all active:scale-90 shrink-0 shadow-2xs group"
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
            /* 🌟 DRILL-DOWN / LIVE AUDIT SUB-HEADER: Back Button + Title + Subtitle */
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {subHeader.onBack && (
                  <button
                    type="button"
                    onClick={subHeader.onBack}
                    className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-center cursor-pointer shadow-2xs active:scale-90 transition-all border border-slate-200/90 shrink-0"
                    title="ย้อนกลับ"
                  >
                    <ChevronLeft size={20} className="text-[#0F6659]" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 leading-tight truncate">
                    {subHeader.title}
                  </div>
                  {subHeader.subtitle && (
                    <div className="text-[11px] font-normal text-slate-500 leading-tight truncate mt-0.5 whitespace-pre-line">
                      {subHeader.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {/* 🌟 Top-Right Action (Auto-Sync Badge) */}
              {subHeader.action && (
                <div className="shrink-0 flex items-center">
                  {subHeader.action}
                </div>
              )}
            </div>
          ) : (
            /* 🌟 ROOT TAB TOP BAR: Brand Logo + Screen Pill + Live Audit Sync Indicator */
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  <div className="text-xs font-medium text-emerald-700 mt-0.5 truncate max-w-[130px] sm:max-w-[180px]">
                    {currentUser.name}
                  </div>
                </div>
              </button>

              {/* 🌟 Live Audit Auto-Sync Status Badge in Global TopBar */}
              {screen === "audit" && isLiveAuditActive && auditSyncStatus && auditSyncStatus !== "idle" && (
                <div className="flex items-center ml-auto mr-1 animate-in fade-in zoom-in-95">
                  {auditSyncStatus === "saving" ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 shadow-2xs animate-pulse">
                      <Loader2 size={13} className="animate-spin text-amber-600" />
                      <span>Syncing...</span>
                    </div>
                  ) : auditSyncStatus === "error" ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 shadow-2xs">
                      <AlertCircle size={13} className="text-rose-600" />
                      <span>Sync Failed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#0F6659] shadow-2xs">
                      <CheckCircle2 size={13} className="text-[#0F6659]" />
                      <span>Synced</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
        <main ref={mainContentRef} className="flex-1 flex flex-col overflow-y-auto min-h-screen pb-16 lg:pb-8">
          <div key={`${role}_${screen}`} className="page-transition flex-1 flex flex-col">
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

            {/* 🌟 2. NAVIGATION BUTTONS (3 SLOTS) */}
            {nav.map((item, index) => {
              const Icon = item.icon;
              const active = screen === item.key;
              const isCenter = item.isPrimary || item.slot === "center" || index === 1;

              if (isCenter) {
                return (
                  <div key={item.key} className="flex-1 flex flex-col items-center relative -top-4.5 z-20">
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.key)}
                      aria-label={item.label}
                      title={item.label}
                      className={`w-[50px] h-[50px] rounded-full flex items-center justify-center text-white cursor-pointer bg-gradient-to-tr from-[#075A4E] via-[#0F6659] to-emerald-500 shadow-md shadow-emerald-950/25 active:scale-90 transition-all duration-200 ${active ? "ring-2 ring-emerald-500 shadow-lg scale-105" : "hover:scale-105"}`}
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

      {/* 🚪 Custom In-App Logout Confirmation Modal (Desktop & Quick Trigger) */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <LogOut size={30} strokeWidth={2.2} />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">ยืนยันการออกจากระบบ?</h4>
              <p className="text-xs text-slate-500 font-medium px-2">
                คุณต้องการออกจากระบบ QSC บัญชี <br/>
                <span className="font-bold text-slate-800">{currentUser.name || currentUser.username}</span> ใช่หรือไม่?
              </p>
            </div>

            <div className="pt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  handleLogout();
                }}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-600/20"
              >
                ยืนยันออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TopBarContext.Provider>
    </DataContext.Provider>
  );
}

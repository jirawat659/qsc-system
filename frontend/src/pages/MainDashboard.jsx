import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Menu, ChevronLeft, CheckCircle2, Navigation, X, LogOut, AlertCircle, ChevronDown } from "lucide-react";

import { c, sans, mono, cardStyle } from "../config/theme";
import { ROLES, NAV_BY_ROLE, getRoleNavConfig, NAV_MODULES_DICT, getDesktopNavGroups } from "../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP } from "../config/constants";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";
import authStorage from "../config/storage";
import api from "../config/api";
import signalRService from "../services/signalrService";

import ErrorBoundary from "../shared/ErrorBoundary";
import Breadcrumbs from "../shared/Breadcrumbs";
import ProfileModal from "../modals/ProfileModal";
import ModalWrapper from "../shared/ModalWrapper";
import { forceUnlockBodyScroll } from "../utils/scrollLock";

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

// 🌟 เนื้อหาของแถบบนสุด (ชื่อ/หมวดหมู่) แยกออกมาเพื่อให้ของเก่า-ของใหม่ render พร้อมกันตอนดันสลับกัน
function HeaderTitleContent({ subHeader }) {
  if (subHeader?.sectionBadgeNumber) {
    return (
      <div
        className="flex items-center justify-between gap-2 min-w-0 w-full cursor-pointer group"
        onClick={subHeader.onMenuClick}
        title="แตะเพื่อเลือกหมวดการตรวจ"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-6 h-6 rounded-lg bg-[#0F6659] text-white flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-emerald-700 transition-colors shadow-2xs">
            {subHeader.sectionBadgeNumber}
          </span>
          <span className="text-sm font-black text-slate-900 truncate leading-tight min-w-0 group-hover:text-[#0F6659] transition-colors">
            {subHeader.title}
          </span>
        </div>
        {subHeader?.subtitle && (
          <span className="text-[10px] font-bold text-[#0F6659] bg-white px-2.5 py-1 rounded-lg border border-[#CCE3DC] shadow-2xs shrink-0 ml-auto">
            {subHeader.subtitle}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="min-w-0 w-full">
      <div className="text-sm font-extrabold text-slate-900 truncate leading-tight">
        {subHeader?.title || "รายละเอียด"}
      </div>
      {subHeader?.subtitle && (
        <div className="text-[11px] font-medium text-slate-400 truncate leading-none mt-0.5">
          {subHeader.subtitle}
        </div>
      )}
    </div>
  );
}

// 🌟 ตัวดันจริง: ของเก่าเลื่อนขึ้นหายไปด้านบน + ของใหม่เลื่อนขึ้นมาแทนที่ พร้อมกันในจังหวะเดียว
// ใช้ @keyframes ที่เตรียมไว้แล้วใน index.css (animate-push-up-out / animate-push-up-in)
function PushingHeaderTitle({ subHeader }) {
  const titleKey = subHeader?.title || "รายละเอียด";
  const [current, setCurrent] = useState({ key: titleKey, subHeader });
  const [previous, setPrevious] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (titleKey === current.key) {
      // หัวข้อเดิม แค่รายละเอียดย่อยเปลี่ยน (เช่นจำนวนข้อที่ตอบ) ไม่ต้องเล่นแอนิเมชันดัน
      setCurrent({ key: titleKey, subHeader });
      return;
    }

    setPrevious(current);
    setCurrent({ key: titleKey, subHeader });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPrevious(null);
    }, 280);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleKey]);

  return (
    <div className="relative h-9 overflow-hidden w-full">
      {previous && (
        <div className="absolute inset-0 flex items-center w-full animate-push-up-out">
          <HeaderTitleContent subHeader={previous.subHeader} />
        </div>
      )}
      <div
        className={`${previous ? "absolute inset-0" : "relative h-full"} flex items-center w-full ${
          previous ? "animate-push-up-in" : ""
        }`}
      >
        <HeaderTitleContent subHeader={current.subHeader} />
      </div>
    </div>
  );
}

// 🌟 แถบ TopBar ย่อยสำหรับหน้ารายละเอียด และหน้าตรวจประเมิน (Live Audit)
function TopBarHeader({ subHeader, currentUser, setShowProfileModal }) {
  const isCategoryMode = Boolean(subHeader?.sectionBadgeNumber);

  return (
    <div className="flex items-center justify-between gap-2 min-w-0 w-full">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {(subHeader?.onBack || subHeader?.onMenuClick) && (
          <button
            type="button"
            onClick={subHeader.leftActionType === "menu" ? subHeader.onMenuClick : subHeader.onBack}
            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-2xs active:scale-90 transition-all border shrink-0 group ${
              isCategoryMode
                ? "bg-white/95 text-[#0F6659] border-[#CCE3DC] hover:bg-emerald-50"
                : "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border-slate-200"
            }`}
            title={subHeader.leftActionType === "menu" ? "เปิดหมวดหมู่" : "ย้อนกลับ"}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              {subHeader.leftActionType === "menu" ? (
                <Menu size={18} strokeWidth={2.4} className="text-[#0F6659] animate-in zoom-in-75 duration-200" />
              ) : (
                <ChevronLeft size={20} strokeWidth={2.5} className="text-slate-700 group-hover:text-[#0F6659] transition-colors -ml-0.5 animate-in zoom-in-75 duration-200" />
              )}
            </div>
          </button>
        )}

        {/* ส่วนแสดงชื่อ/หัวข้อในแถบบนมือถือ พร้อม Effect ดันขึ้นเปลี่ยนหัวข้อหมวดหมู่ */}
        <div className="min-w-0 flex-1">
          <PushingHeaderTitle subHeader={subHeader} />
        </div>
      </div>

      {/* 🌟 แสดง action (ปุ่มแก้ไข) และปุ่มโปรไฟล์ เฉพาะตอนที่ไม่ได้อยู่ในหน้ารายการข้อหมวดหมู่ */}
      {!isCategoryMode && (
        <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
          {subHeader?.action}
          {currentUser && setShowProfileModal && (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center p-1 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0"
              title="ดูโปรไฟล์และบัญชีผู้ใช้"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs text-white bg-[#0F6659]">
                {currentUser?.avatar || "ผ"}
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MainDashboard({ onLogout }) {

  const [locations, setLocations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [forms, setForms] = useState([]);
  // 🌟 forms ที่โหลดตอนเริ่มแอปเป็นแบบ summary (ไม่มี sections/items เพื่อความเร็ว)
  // hydratingFormIdsRef กันไม่ให้ยิง /api/form/{id} ซ้ำถ้ามีคนเรียก getFormDetail
  // สำหรับฟอร์มเดียวกันพร้อมกันหลายจุด (เช่น component เดียวกัน render ซ้ำ)
  const hydratingFormIdsRef = useRef(new Set());
  const getFormDetail = useCallback(async (formId) => {
    if (!formId) return null;
    const idNum = Number(formId);

    const existing = forms.find(f => Number(f.id) === idNum);
    // Array.isArray(sections) เป็นสัญญาณว่าฟอร์มนี้ hydrate เต็มแล้ว (summary mode ส่ง sections: null มา)
    if (existing && Array.isArray(existing.sections)) {
      return existing;
    }

    if (hydratingFormIdsRef.current.has(idNum)) {
      return existing || null; // กำลังโหลดอยู่แล้วจากที่อื่น รอรอบ re-render ถัดไป
    }

    hydratingFormIdsRef.current.add(idNum);
    try {
      const res = await api.get(`/form/${idNum}`);
      const full = res.data;
      setForms(prev => {
        const idx = prev.findIndex(f => Number(f.id) === idNum);
        if (idx === -1) return [...prev, full];
        const next = [...prev];
        next[idx] = { ...next[idx], ...full };
        return next;
      });
      return full;
    } catch (err) {
      console.warn(`Failed to load full detail for form ${idNum}:`, err);
      return existing || null;
    } finally {
      hydratingFormIdsRef.current.delete(idNum);
    }
  }, [forms]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeDrafts, setActiveDrafts] = useState([]);
  const [capTasks, setCapTasks] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataFetchError, setDataFetchError] = useState(null);

  // 🌟 Phase 3.3: Buffer pagination state for /audit/records and /cap.
  // These two collections were removed from the initial Promise.allSettled (Phase 3.2)
  // to keep first paint fast, so they're loaded here separately in the background,
  // 50 records at a time, with more pages fetchable on demand via loadMore*.
  const [auditRecordsTotalCount, setAuditRecordsTotalCount] = useState(0);
  const [capTasksTotalCount, setCapTasksTotalCount] = useState(0);
  const [isLoadingAuditRecords, setIsLoadingAuditRecords] = useState(false);
  const [isLoadingCapTasks, setIsLoadingCapTasks] = useState(false);
  const auditRecordsPageRef = useRef(0);
  const capTasksPageRef = useRef(0);
  const hasReachedAuditRecordsEndRef = useRef(false);
  const hasReachedCapTasksEndRef = useRef(false);
  const BUFFER_PAGE_SIZE = 100;

  const [selectedBrandId, setSelectedBrandIdState] = useState(() => {
    const saved = localStorage.getItem('qsc_selected_brand_id');
    return saved ? Number(saved) : null;
  });
  const setSelectedBrandId = (id) => {
    setSelectedBrandIdState(id);
    if (id) localStorage.setItem('qsc_selected_brand_id', String(id));
    else localStorage.removeItem('qsc_selected_brand_id');
  };

  const activeBrands = useMemo(() => brands.filter(b => b.isActive !== false), [brands]);

  // 🌟 Auto-select brand if user only has access to 1 brand (e.g. After You)
  useEffect(() => {
    if (activeBrands.length === 1 && selectedBrandId !== activeBrands[0].id) {
      setSelectedBrandId(activeBrands[0].id);
    } else if (activeBrands.length > 1 && selectedBrandId && !activeBrands.some(b => b.id === selectedBrandId)) {
      setSelectedBrandId(null);
    }
  }, [activeBrands, selectedBrandId]);

  const visibleLocations = useMemo(() => {
    if (!selectedBrandId) return locations;
    return locations.filter(l => l.locationBrands?.some(lb => lb.brandId === selectedBrandId));
  }, [locations, selectedBrandId]);

  const visibleLocationIds = useMemo(() => {
    return new Set(visibleLocations.map(l => l.id));
  }, [visibleLocations]);

  const visibleAuditRecords = useMemo(() => {
    if (!selectedBrandId) return auditRecords;
    return auditRecords.filter(r => visibleLocationIds.has(r.locationId));
  }, [auditRecords, selectedBrandId, visibleLocationIds]);

  const visibleSchedules = useMemo(() => {
    if (!selectedBrandId) return schedules;
    return schedules.filter(s => visibleLocationIds.has(s.locationId));
  }, [schedules, selectedBrandId, visibleLocationIds]);

  const visibleCapTasks = useMemo(() => {
    if (!selectedBrandId) return capTasks;
    return capTasks.filter(c => visibleLocationIds.has(c.locationId));
  }, [capTasks, selectedBrandId, visibleLocationIds]);

  const lastRefreshTimeRef = useRef(Date.now());
  const isRefreshingRef = useRef(false);

  const refreshData = async (isSilent = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!isSilent) setIsLoadingData(true);
    if (!isSilent) setDataFetchError(null);
    try {
      // 🌟 ตัด /cap และ /audit/records ออกจากโหลดเริ่มต้น
      // 🌟 /form?detail=summary: ไม่โหลด Sections/Items เต็ม (หนักและไม่ได้ใช้ตอนนี้)
      // หน้าที่ต้องใช้คำถามจริง (ตรวจสด/แก้ไขฟอร์ม/ประวัติ) จะ hydrate เพิ่มเองผ่าน
      // getFormDetail() ตอนต้องใช้จริง ดู DataContext.jsx
      const [locRes, schedRes, formRes, draftsRes, brandRes] = await Promise.allSettled([
        api.get('/location'),
        api.get('/schedule'),
        api.get('/form?detail=summary'),
        api.get('/audit/drafts'),
        api.get('/brand')
      ]);

      const rejectedCount = [locRes, schedRes, formRes, brandRes].filter(r => r.status === 'rejected').length;
      if (rejectedCount > 0 && !isSilent) {
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
      if (brandRes.status === 'fulfilled' && brandRes.value.data) setBrands(brandRes.value.data);
      lastRefreshTimeRef.current = Date.now();
    } catch (err) {
      if (!isSilent) {
        setDataFetchError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
      }
    } finally {
      if (!isSilent) setIsLoadingData(false);
      isRefreshingRef.current = false;
    }
  };

  // 🌟 Phase 3.3: Load a buffer page of /audit/records into context.
  // `reset = true` starts back at page 1 (used on first load / refresh);
  // otherwise it fetches the next page after whatever was already loaded.
  // 🌟 ห่อด้วย useCallback: ถ้าไม่ห่อ ฟังก์ชันนี้จะได้ reference ใหม่ทุกครั้งที่ MainDashboard
  // re-render (เช่น จาก state อื่นที่ไม่เกี่ยวข้อง, polling, SignalR) แล้วส่งต่อผ่าน Context
  // ไปให้หน้าจอลูก (เช่น AllAuditHistoryScreen) ที่ใส่ฟังก์ชันนี้ไว้ใน useEffect dependency —
  // ทำให้ effect ที่นั่นทำงานซ้ำโดยไม่จำเป็น อาจยิง API ซ้ำเกินความจำเป็น
  const loadMoreAuditRecords = useCallback(async (reset = false) => {
    if (isLoadingAuditRecords) return;
    if (reset) {
      hasReachedAuditRecordsEndRef.current = false;
    } else if (hasReachedAuditRecordsEndRef.current) {
      return;
    }
    const nextPage = reset ? 1 : auditRecordsPageRef.current + 1;
    setIsLoadingAuditRecords(true);
    try {
      const res = await api.get('/audit/records', { params: { page: nextPage, pageSize: BUFFER_PAGE_SIZE } });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      const totalCount = Array.isArray(data) ? items.length : (data?.totalCount ?? items.length);

      if (items.length === 0) {
        hasReachedAuditRecordsEndRef.current = true;
        if (reset) {
          setAuditRecords([]);
          setAuditRecordsTotalCount(0);
          auditRecordsPageRef.current = 1;
        }
        return;
      }

      auditRecordsPageRef.current = nextPage;
      setAuditRecordsTotalCount(totalCount);
      setAuditRecords(prev => (reset ? items : [...prev, ...items]));

      if (items.length < BUFFER_PAGE_SIZE) {
        hasReachedAuditRecordsEndRef.current = true;
      }
    } catch (err) {
      // เงียบไว้: หน้าจอที่ใช้ auditRecords จะยังคงแสดงข้อมูลเท่าที่โหลดได้ก่อนหน้า
    } finally {
      setIsLoadingAuditRecords(false);
    }
  }, [isLoadingAuditRecords]);

  // 🌟 Bugfix: background refresh (focus / interval / SignalR) เดิมเรียก
  // loadMoreAuditRecords(true) ซึ่งรีเซ็ต buffer กลับไปหน้า 1 (50 รายการล่าสุด)
  // ทุกครั้ง — ทำให้ข้อมูลหน้าเพิ่มเติมที่หน้ารายงานเคยโหลดไว้ก่อนหน้านั้นหายไป
  // ฟังก์ชันนี้โหลดคืนให้ครบเท่าจำนวนหน้าที่เคยโหลดไว้แล้วแทน จะได้ไม่เห็นข้อมูลลดลง
  // ระหว่างที่หน้ารายงานเปิดค้างอยู่
    const resyncAuditRecords = useCallback(async () => {
    if (isLoadingAuditRecords) return;
    const pagesToRestore = Math.max(1, auditRecordsPageRef.current);
    setIsLoadingAuditRecords(true);
    try {
      let combined = [];
      let totalCount = 0;
      for (let p = 1; p <= pagesToRestore; p++) {
        const res = await api.get('/audit/records', { params: { page: p, pageSize: BUFFER_PAGE_SIZE } });
        const data = res.data;
        const items = Array.isArray(data) ? data : (data?.items || []);
        totalCount = Array.isArray(data) ? items.length : (data?.totalCount ?? totalCount);
        combined = combined.concat(items);
        if (items.length < BUFFER_PAGE_SIZE) {
          hasReachedAuditRecordsEndRef.current = true;
          break;
        }
      }
      auditRecordsPageRef.current = pagesToRestore;
      setAuditRecordsTotalCount(totalCount);
      setAuditRecords(combined);
    } catch (err) {
    } finally {
      setIsLoadingAuditRecords(false);
    }
  }, [isLoadingAuditRecords]);

  // 🌟 Phase 3.3: Same buffer pattern for /cap.
  const loadMoreCapTasks = useCallback(async (reset = false) => {
    if (isLoadingCapTasks) return;
    if (reset) {
      hasReachedCapTasksEndRef.current = false;
    } else if (hasReachedCapTasksEndRef.current) {
      return;
    }
    const nextPage = reset ? 1 : capTasksPageRef.current + 1;
    setIsLoadingCapTasks(true);
    try {
      const res = await api.get('/cap', { params: { page: nextPage, pageSize: BUFFER_PAGE_SIZE } });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      const totalCount = Array.isArray(data) ? items.length : (data?.totalCount ?? items.length);
      if (items.length === 0) {
        hasReachedCapTasksEndRef.current = true;
        if (reset) {
          setCapTasks([]);
          setCapTasksTotalCount(0);
          capTasksPageRef.current = 1;
        }
        return;
      }
      capTasksPageRef.current = nextPage;
      setCapTasksTotalCount(totalCount);
      setCapTasks(prev => (reset ? items : [...prev, ...items]));
      if (items.length < BUFFER_PAGE_SIZE) {
        hasReachedCapTasksEndRef.current = true;
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoadingCapTasks(false);
    }
  }, [isLoadingCapTasks]);

  // 🌟 Lazy buffer (revert eager-load-all): ไม่โหลดทุกหน้าอัตโนมัติอีกต่อไป
  // โหลดแค่หน้าแรก (BUFFER_PAGE_SIZE รายการ) ตอนเริ่มต้น แล้วให้หน้าจอที่ใช้งาน
  // (เช่น AllAuditHistoryScreen) เรียก loadMoreAuditRecords(false) เองเมื่อผู้ใช้เลื่อน/พลิกหน้าใกล้ขอบข้อมูลที่โหลดไว้
  useEffect(() => {
    refreshData();

    // 🌟 Background-load the first buffer page of audit records / CAP tasks.
    // Not part of the critical Promise.allSettled batch above (Phase 3.2), so it
    // never blocks first paint — screens relying on these show a local loading
    // state (isLoadingAuditRecords / isLoadingCapTasks) until this resolves.
    loadMoreAuditRecords(true);
    loadMoreCapTasks(true);

    // 🔄 Auto-sync on Window Focus (ดึงข้อมูลล่าสุดอัตโนมัติเมื่อสลับกลับมาที่แท็บ หากเกิน 60 วินาที)
    const handleFocus = () => {
      if (Date.now() - lastRefreshTimeRef.current > 60000) {
        refreshData(true);
        resyncAuditRecords();
        loadMoreCapTasks(true);
      }
    };

    // 🔄 Background periodic sync ทุก 3 นาที (180,000 ms) แบบเงียบๆ เพื่อประหยัดทรัพยากรเซิร์ฟเวอร์
    const interval = setInterval(() => {
      refreshData(true);
      resyncAuditRecords();
      loadMoreCapTasks(true);
    }, 180000);

    // 📡 Real-time SignalR Event: รีเฟรชข้อมูลอัตโนมัติเฉพาะเมื่อมีผลตรวจใหม่เข้ามาจริงๆ
    let isMounted = true;
    let unsubscribeAudit = null;
    signalRService.getConnection()
      .then(() => {
        if (!isMounted) return;
        unsubscribeAudit = signalRService.onAuditCreated(() => {
          if (!isMounted) return;
          refreshData(true);
          resyncAuditRecords();
          loadMoreCapTasks(true);
        });
      })
      .catch(() => {});

    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
      if (unsubscribeAudit) unsubscribeAudit();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('qsc_selected_brand_id');
    signalRService.disconnect();
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

  // 🌟 ดึงข้อมูล Session การตรวจที่ค้างไว้จาก sessionStorage (สำหรับกรณีกดรีเฟรชหน้าจอ F5)
  const savedAuditSession = (() => {
    try {
      const raw = sessionStorage.getItem("qsc_active_audit_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [screen, setScreen] = useState(() => {
    if (savedAuditSession?.screen === "audit") return "audit";
    return nav[0]?.key || "dashboard";
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [preselectedPlan, setPreselectedPlan] = useState(() => {
    return savedAuditSession?.plan || null;
  });
  const [auditReturnScreen, setAuditReturnScreen] = useState(() => {
    return savedAuditSession?.returnScreen || "dashboard";
  });
  const [isLiveAuditActive, setIsLiveAuditActive] = useState(false);
  const [isMoreSubScreen, setIsMoreSubScreen] = useState(false);
  const [isAuditFromReportList, setIsAuditFromReportList] = useState(false);
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

  // 🌟 Desktop sidebar navigation groups (Core workflows + System tools, replaces 'more')
  const desktopNav = useMemo(() => {
    const userNavConfig = storedUser?.navConfig || storedUser?.navConfigJson;
    const permissions = currentUser?.permissions || storedUser?.permissions || [];
    return getDesktopNavGroups(role, permissions, userNavConfig);
  }, [role, storedUser, currentUser]);

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (screen === key) {
      if (key === "more") {
        setMoreResetKey(prev => prev + 1);
      }
      smoothScrollToTop();
      return;
    }

    // 🌟 หากผู้ใช้กดเปลี่ยนไปเมนูอื่นด้วยตนเอง ให้ล้าง session การตรวจค้างทิ้ง
    if (key !== "audit") {
      try {
        sessionStorage.removeItem("qsc_active_audit_session");
      } catch (e) {}
    }

    if (key === "more") {
      setMoreResetKey(prev => prev + 1);
    }
    if (key === "audit") {
      setPreselectedPlan(null);
      setIsAuditFromReportList(false);
      setAuditReturnScreen("dashboard");
    }
    setScreen(key);
    smoothScrollToTop();
  };

  const headerRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [auditHeaderOffset, setAuditHeaderOffset] = useState(0);

  // Scroll to top automatically whenever screen changes
  useEffect(() => {
    smoothScrollToTop();
    setIsScrolled(false);
    setAuditHeaderOffset(0);
  }, [screen]);

  // 🌟 แถบส่วนหัวจะยุบเฉพาะตอนอยู่ในขั้นตอนตรวจข้อคำถามจริง (step === "audit" / isLiveAuditActive) เท่านั้น
  // หากอยู่ในหน้าเลือกสาขา (select-unit) หรือเลือกฟอร์ม (select-form) จะไม่ยุบหรือเลื่อนลบ -58px
  const isLiveAuditScreen = (screen === "audit" && isLiveAuditActive) || Boolean(subHeader?.isAudit);

  // 🌟 Dynamic Scroll Listener: แถบหลักจะไม่ยุบจนกว่าจุดมาร์คของหมวดแรก (Section 1) จะเลื่อนขึ้นมาชน
  useEffect(() => {
    const handleScroll = () => {
      const mainEl = mainContentRef.current;
      const scrollY = window.scrollY || document.documentElement.scrollTop || (mainEl?.scrollTop || 0);
      setIsScrolled(scrollY > 12);

      if (isLiveAuditScreen) {
        // หาจุดมาร์คของหมวดแรก
        const marker0 = document.getElementById("audit-section-header-0") || 
                        document.getElementById("audit-section-0") ||
                        document.querySelector(".audit-section-anchor");
        const topBarH = headerRef.current?.offsetHeight || 58;
        if (marker0) {
          const rect = marker0.getBoundingClientRect();
          // เมื่อจุดมาร์คของหมวดแรกยังอยู่ต่ำกว่าแถบบนสุด (rect.top >= topBarH) -> ไม่ต้องยุบแถบหลัก (offset = 0)
          // เมื่อจุดมาร์คเลื่อนขึ้นมาชนแถบบนสุด (rect.top < topBarH) -> แถบหลักจะค่อยๆ เลื่อนขึ้นไป 1:1 ตามการเลื่อนของจุดมาร์ค
          if (rect.top < topBarH) {
            const offset = Math.min(topBarH, Math.max(0, topBarH - rect.top));
            setAuditHeaderOffset(offset);
          } else {
            setAuditHeaderOffset(0);
          }
        } else if (scrollY > 80) {
          // Fallback หากยังไม่ได้ render marker0 แต่หน้าจอเลื่อนลงมาแล้ว
          setAuditHeaderOffset(topBarH);
        } else {
          setAuditHeaderOffset(0);
        }
      } else {
        setAuditHeaderOffset(0);
      }
    };

    // 🌟 เรียกทันทีเมื่อ mount หรือเมื่อ isLiveAuditScreen เปลี่ยน เพื่อคำนวณ offset ทันทีหากหน้าเลื่อนอยู่แล้ว
    handleScroll();
    const t = setTimeout(handleScroll, 60);

    window.addEventListener("scroll", handleScroll, { passive: true });
    const mainEl = mainContentRef.current;
    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", handleScroll);
      if (mainEl) {
        mainEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, [isLiveAuditScreen]);

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3500);
  };

  const handleStartAuditDirect = (scheduleItem) => {
    if (role !== "AUDITOR" && role !== "ADMIN" && role !== "STANDARD") {
      showToast("บทบาทผู้รับการตรวจไม่สามารถบันทึกผลการตรวจประเมินได้");
      return;
    }
    setAuditReturnScreen(screen); // 🌟 จำหน้าปัจจุบัน (เช่น รายงานผลการตรวจ) ไว้ กด "ย้อนกลับ" จาก Live Audit แล้วจะกลับมาที่นี่
    setIsAuditFromReportList(screen === "reports" || screen === "history");
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
    const adminMoreSubScreens = ["master_management", "branch_info", "contact_qa", "auditor_profile", "settings", "integrations"];

    return (
      <ErrorBoundary>
        <React.Suspense fallback={<ScreenLoader />}>
          {(screen === "reports" || screen === "history") && (
            <ConsolidatedReportsScreen
              onBack={isDesktop ? undefined : () => setScreen("more")}
              currentAuditorName={null}
              title="รายงานผลการตรวจประเมิน"
              onStartAudit={(plan) => handleStartAuditDirect(plan)}
              onResumeDraft={(draft) => {
                setActiveAuditDraft(draft);
                handleStartAuditDirect({ ...draft, isResume: true });
              }}
              onStartNewAudit={() => {
                setAuditReturnScreen(screen); // 🌟 จำหน้าปัจจุบันไว้เหมือนกัน
                setIsAuditFromReportList(false);
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
              onClearPlan={() => {
                try { sessionStorage.removeItem("qsc_active_audit_session"); } catch (e) {}
                setPreselectedPlan(null);
                setIsAuditFromReportList(false);
                setScreen(auditReturnScreen || "reports");
              }}
              onBack={() => {
                try { sessionStorage.removeItem("qsc_active_audit_session"); } catch (e) {}
                setPreselectedPlan(null);
                setIsAuditFromReportList(false);
                setScreen(auditReturnScreen || "reports");
              }}
              defaultAuditorName={currentUser.name || "-"}
              onActiveStateChange={(isActive) => setIsLiveAuditActive(prev => (prev === isActive ? prev : isActive))}
              onSyncStatusChange={(status) => setAuditSyncStatus(prev => (prev === status ? prev : status))}
              onSaveDraft={(draft) => {
                setActiveAuditDraft(draft);
                if (!draft) {
                  setActiveDraft(null);
                  setActiveDrafts([]);
                  refreshData();
                  return;
                }
                setActiveDrafts(prev => {
                  const list = (prev || []).filter(Boolean);
                  const existingIdx = list.findIndex(d => 
                    d && (
                      (d.id && draft.id && d.id === draft.id) || 
                      (d.auditScheduleId && draft.auditScheduleId && d.auditScheduleId === draft.auditScheduleId) ||
                      (!d.id && !draft.id && !d.auditScheduleId && !draft.auditScheduleId && d.locationId === draft.locationId && 
                        (d.surveyFormId === draft.formId || d.formId === draft.formId || d.surveyFormId === draft.surveyFormId))
                    )
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
                try { sessionStorage.removeItem("qsc_active_audit_session"); } catch (e) {}
                setIsAuditFromReportList(false);
                setActiveAuditDraft(null);
                setPreselectedPlan(null);
                refreshData();
                loadMoreAuditRecords(true);
                loadMoreCapTasks(true);
                setScreen("reports");
              }}
            />
          )}
          {screen === "forms" && <FormsScreen isDesktop={true} role={role} onBack={isDesktop ? undefined : () => setScreen("more")} />}
          {screen === "cap" && <CapScreen isDesktop={true} role={role} currentUser={currentUser} onBack={(!isDesktop && role !== "AUDITEE") ? () => setScreen("more") : undefined} />}
          {(screen === "more" || adminMoreSubScreens.includes(screen)) && (
            <AdminMoreScreen
              resetKey={moreResetKey}
              isDesktop={isDesktop}
              role={role}
              currentUser={currentUser}
              onNavigate={handleNavClick}
              onStartAuditDirect={handleStartAuditDirect}
              activeNavKeys={nav.map(n => n.key)}
              activeSubScreen={screen !== "more" ? screen : null}
              onSubScreenChange={setIsMoreSubScreen}
            />
          )}
          {screen === "schedule" && (
            <ScheduleScreen
              role={role}
              currentUser={currentUser}
              isDesktop={true}
              onStartAuditDirect={handleStartAuditDirect}
              currentAuditorName={role === "AUDITOR" ? currentUser.name : null}
              onBack={(!isDesktop && !nav.some(n => n.key === "schedule")) ? () => setScreen("more") : undefined}
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
    allLocations: locations,
    locations: visibleLocations,
    visibleLocations,
    brands, selectedBrandId, setSelectedBrandId,
    allSchedules: schedules,
    schedules: visibleSchedules,
    visibleSchedules,
    forms, setForms, getFormDetail,
    activeDraft, setActiveDraft,
    activeDrafts, setActiveDrafts,
    allCapTasks: capTasks,
    capTasks: visibleCapTasks,
    visibleCapTasks,
    allAuditRecords: auditRecords,
    auditRecords: visibleAuditRecords,
    visibleAuditRecords,
    setLocations, setSchedules, setCapTasks, setAuditRecords,
    refreshData,
    isLoadingData,
    dataFetchError,
    // 🌟 Phase 3.3: buffer pagination metadata + loaders for /audit/records and /cap
    auditRecordsTotalCount,
    capTasksTotalCount,
    isLoadingAuditRecords,
    isLoadingCapTasks,
    loadMoreAuditRecords,
    loadMoreCapTasks
  }), [
    currentUser, locations, schedules, forms, getFormDetail,
    activeDraft, activeDrafts, capTasks, auditRecords,
    refreshData, isLoadingData, dataFetchError,
    visibleLocations, visibleAuditRecords, visibleSchedules, visibleCapTasks,
    brands, selectedBrandId,
    auditRecordsTotalCount, capTasksTotalCount, isLoadingAuditRecords, isLoadingCapTasks,
    loadMoreAuditRecords, loadMoreCapTasks
  ]);

  return (
    <DataContext.Provider value={dataContextValue}>
    <TopBarContext.Provider value={topBarContextValue}>
    <div className="w-full min-h-screen lg:h-screen lg:overflow-hidden" style={{ background: "#EBEAE5", fontFamily: sans }}>
      
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
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-[99999] bg-emerald-50/95 text-emerald-950 px-4.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-3 border border-emerald-300 ring-1 ring-emerald-400/20 backdrop-blur-md pointer-events-none">
          <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
          <span>{toastText}</span>
        </div>,
        document.body
      )}

      {/* UNIFIED FULLY RESPONSIVE APPLICATION LAYOUT */}
      <div className="w-full min-h-screen lg:min-h-0 lg:h-full flex flex-col lg:flex-row" style={{ background: c.bg }}>
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 bg-white border-r flex-col justify-between shadow-2xs h-screen lg:h-full" style={{ borderColor: c.border }}>
            <div className="p-5 space-y-4 flex-1 flex flex-col min-h-0">
              {/* Brand Header */}
              <div className="flex items-center gap-3 pb-1 shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                  Q
                </div>
                <div>
                  <div className="text-base font-bold leading-tight text-slate-900">Q.S.C. System</div>
                  <div className="text-xs font-normal text-slate-400 mt-0.5">Quality Compliance</div>
                </div>
              </div>

              {activeBrands.length > 1 ? (
                <div className="shrink-0">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 px-1">แบรนด์ที่แสดง</label>
                  <div className="relative">
                    <select
                      value={selectedBrandId || ''}
                      onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="">ทุกแบรนด์</option>
                      {activeBrands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              ) : activeBrands.length === 1 ? (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200 text-xs font-bold flex items-center gap-2 shrink-0">
                  <span className="truncate">🏪 {activeBrands[0].name}</span>
                </div>
              ) : null}

              {/* Sidebar Navigation */}
              <nav className="space-y-4 overflow-y-auto flex-1 pr-1.5 -mr-1.5 custom-scrollbar">
                {/* Group 1: เมนูการทำงาน */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider px-3.5 mb-2 text-slate-400">เมนูการทำงาน</div>
                  <div className="space-y-1">
                    {desktopNav.workflows.map((item) => {
                      const Icon = item.icon;
                      const targetRoute = item.route || item.defaultRoute || item.key;
                      const active = screen === item.key || (item.route && screen === item.route);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleNavClick(targetRoute)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all cursor-pointer ${
                            active 
                              ? 'bg-[#E3F0ED] text-[#0F6659] shadow-2xs font-bold' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon size={19} className={active ? 'text-[#0F6659]' : 'text-slate-400'} />
                          <span className="tracking-tight truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 2: ระบบและการจัดการ / ข้อมูลและบริการ */}
                {desktopNav.systemTools && desktopNav.systemTools.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-bold uppercase tracking-wider px-3.5 mb-2 text-slate-400">
                      {desktopNav.systemGroupTitle}
                    </div>
                    <div className="space-y-1">
                      {desktopNav.systemTools.map((item) => {
                        const Icon = item.icon;
                        const targetRoute = item.route || item.key;
                        const active = screen === item.key || (item.route && screen === item.route);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleNavClick(targetRoute)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all cursor-pointer ${
                              active 
                                ? 'bg-[#E3F0ED] text-[#0F6659] shadow-2xs font-bold' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <Icon size={19} className={active ? 'text-[#0F6659]' : 'text-slate-400'} />
                            <span className="tracking-tight truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
          
          {/* 🌟 MOBILE & AUDIT HEADER: แถบบนสุด (จะโดนจุดมาร์คของหมวดแรกดันเลื่อนเก็บขึ้นไป 1:1 ตามนิ้ว) */}
          <header
            ref={headerRef}
            style={
              isLiveAuditScreen
                ? {
                    transform: `translateY(-${auditHeaderOffset}px)`,
                    marginBottom: `-58px`,
                    opacity: auditHeaderOffset >= 54 ? 0 : 1 - auditHeaderOffset / 65,
                    pointerEvents: auditHeaderOffset >= 54 ? "none" : "auto",
                  }
                : undefined
            }
            className={`flex lg:hidden flex-col shrink-0 sticky top-0 z-40 px-3.5 pt-3.5 pb-3 border-b ${
              (isScrolled || subHeader)
                ? "bg-white/90 backdrop-blur-md border-slate-200/60 shadow-xs"
                : "bg-transparent border-transparent shadow-none"
            }`}
          >
            {/* กรณีเปิดหน้ารายละเอียด/ผลตรวจที่มีปุ่มย้อนกลับ: ใช้แถบเดี่ยวที่มีปุ่มย้อนกลับแทนแถบโลโก้ */}
            {(subHeader?.isAudit || subHeader?.onBack || subHeader?.hasBack) ? (
              <TopBarHeader
                subHeader={subHeader}
                currentUser={currentUser}
                setShowProfileModal={setShowProfileModal}
              />
            ) : (
              /* หน้าจอทั่วไป: แสดงแถบ Logo ปกติ */
              <>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-2 cursor-pointer group text-left shrink-0 min-w-0"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs text-white bg-gradient-to-tr from-[#0F6659] to-[#15806e] group-hover:scale-105 transition-transform shrink-0">
                      Q
                    </div>
                    <div className="text-left min-w-0 max-w-[120px] sm:max-w-[170px]">
                      <div className="text-xs font-black truncate text-slate-800">Q.S.C.</div>
                      <div className="text-[10px] font-bold truncate text-[#0F6659]">{currentUser.name}</div>
                    </div>
                  </button>

                  {/* Right Group: Brand Selector + Profile Badge */}
                  <div className="flex items-center gap-2 shrink-0 min-w-0 ml-auto">
                    {activeBrands.length > 1 ? (
                      <div className="flex items-center min-w-0 max-w-[140px] sm:max-w-[190px] scale-[0.85] origin-right">
                        <div className="relative w-full">
                          <select
                            value={selectedBrandId || ''}
                            onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full pl-3 pr-7 py-1.5 sm:py-2 rounded-xl border border-slate-300 bg-slate-50 text-base sm:text-sm font-extrabold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none cursor-pointer truncate shadow-xs min-h-[36px] sm:min-h-[40px] appearance-none"
                            title="เลือกแบรนด์ที่ต้องการแสดง"
                          >
                            <option value="">ทุกแบรนด์</option>
                            {activeBrands.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    ) : activeBrands.length === 1 ? (
                      <div className="flex items-center px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold shrink-0 max-w-[130px] scale-[0.85] origin-right">
                        <span className="truncate">{activeBrands[0].name}</span>
                      </div>
                    ) : null}

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
                  </div>
                </div>
              </>
            )}
          </header>

          {/* MAIN CONTENT WORKSPACE (Fluid 100% Percentage Width) */}
          <main 
            ref={mainContentRef} 
            className={`flex-1 flex flex-col min-h-screen pb-16 lg:pb-8 w-full max-w-full ${
              isLiveAuditScreen 
                ? 'overflow-visible lg:overflow-y-auto lg:h-full lg:min-h-0' 
                : 'overflow-y-auto lg:min-h-0 lg:h-full'
            }`}
          >
  <div key={`${role}_${screen}`} className={`${isLiveAuditScreen ? '' : 'page-transition'} flex-1 flex flex-col w-full max-w-full`}>
    {renderCurrentScreen()}
  </div>
</main>

          {/* MOBILE BOTTOM NAVIGATION: ซ่อนอัตโนมัติเมื่ออยู่ในหน้าย่อย หรือระหว่างที่กำลังทำการตรวจหน้างาน (Live Audit) */}
          {!isLiveAuditActive && !isMoreSubScreen && !isAuditFromReportList && !subHeader?.onBack && !subHeader?.hasBack && (
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
        <ModalWrapper onClose={() => setShowLogoutConfirmModal(false)} maxWidth="max-w-sm">
          <div className="p-6 space-y-4 text-center">
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
        </ModalWrapper>
      )}
    </div>
    </TopBarContext.Provider>
    </DataContext.Provider>
  );
}
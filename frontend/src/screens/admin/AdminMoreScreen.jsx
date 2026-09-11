import FormsScreen from "../forms/FormsScreen";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ClipboardList, Store, ChevronRight, Settings, MessageSquare, Key, Layers, UserCheck, FileSpreadsheet, Wrench, Building2, Monitor, ShieldCheck, Clock } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE, SYSTEM_TOOLS, hasToolAccess } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import AdminSubScreen from "./AdminSubScreen";
import ConsolidatedReportsScreen from "./ConsolidatedReportsScreen";
import MasterManagementScreen from "./MasterManagementScreen";
import ChangePasswordModal from "../../modals/ChangePasswordModal";


export default function AdminMoreScreen({ 
  role = "STANDARD", 
  onNavigate, 
  currentUser, 
  onStartAuditDirect, 
  resetKey, 
  onSubScreenChange, 
  activeNavKeys = [],
  activeSubScreen = null,
  isDesktop = false
}) {
  const { locations: allLocations = [] } = React.useContext(DataContext);
  const [open, setOpen] = useState(() => activeSubScreen || null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  useEffect(() => {
    if (activeSubScreen !== undefined) {
      setOpen(activeSubScreen || null);
    }
  }, [activeSubScreen]);

  useEffect(() => {
    setOpen(activeSubScreen || null);
  }, [resetKey]);

  useEffect(() => {
    onSubScreenChange?.(open !== null);
    // 🌟 Scroll to top immediately when opening or closing sub-screens
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.body?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return () => onSubScreenChange?.(false);
  }, [open, onSubScreenChange]);

  const userPerms = useMemo(() => {
    return currentUser?.permissions || [];
  }, [currentUser]);

  const tools = useMemo(() => {
    return SYSTEM_TOOLS.filter((tool) => {
      if (activeNavKeys.includes(tool.key) || (tool.route && activeNavKeys.includes(tool.route))) {
        return false;
      }
      return hasToolAccess(tool, role, userPerms);
    });
  }, [activeNavKeys, role, userPerms]);

  const isDesktopMode = isDesktop || !!activeSubScreen;
  const backHandler = isDesktopMode ? undefined : () => setOpen(null);

  if (open === "master_management") {
    return <MasterManagementScreen onBack={backHandler} />;
  }

  if (open === "reports") {
    return (
      <ConsolidatedReportsScreen
        onBack={backHandler}
        currentAuditorName={null}
        onStartAudit={(plan) => {
          setOpen(null);
          if (onStartAuditDirect) onStartAuditDirect(plan);
          else if (onNavigate) onNavigate("audit", { plan });
          else window.dispatchEvent(new CustomEvent('app:start-audit', { detail: plan }));
        }}
        onResumeDraft={(draft) => {
          setOpen(null);
          if (onStartAuditDirect) onStartAuditDirect({ ...draft, isResume: true });
          else if (onNavigate) onNavigate("audit", { plan: { ...draft, isResume: true } });
          else window.dispatchEvent(new CustomEvent('app:start-audit', { detail: { ...draft, isResume: true } }));
        }}
      />
    );
  }

  if (open === "auditor_profile") {
    const displayName = currentUser?.fullName || currentUser?.name || "คุณสมชาย ใจดี";
    const initialLetter = displayName.charAt(0) || "ส";
    return (
      <AdminSubScreen title="ข้อมูลผู้ตรวจประเมิน" onBack={backHandler}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#0F6659] flex items-center justify-center text-xl font-bold">
              {initialLetter}
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500 font-medium">ตำแหน่ง: {currentUser?.title || "เจ้าหน้าที่ตรวจสอบคุณภาพ (QC Lead)"}</div>
              <div className="text-xs text-emerald-700 font-semibold mt-0.5">สถานะ: ปฏิบัติหน้าที่หน้าร้าน (Active)</div>
            </div>
          </div>
          <div className="border-t pt-4 space-y-2 text-xs sm:text-sm text-slate-700">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400">สังกัดฝ่าย:</span>
              <span className="font-semibold">{currentUser?.department || "Quality Control (QC)"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400">พื้นที่รับผิดชอบ:</span>
              <span className="font-semibold">{currentUser?.regionScope || "กรุงเทพฯ ตอนกลาง & เหนือ"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">สิทธิ์การใช้งาน:</span>
              <span className="font-semibold text-emerald-800">ตรวจหน้างานตามแผนที่ได้รับมอบหมาย</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs sm:text-sm border border-slate-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 hover:border-[#0F6659] hover:text-[#0F6659]"
            >
              <Key size={17} className="text-[#0F6659]" />
              <span>เปลี่ยนรหัสผ่าน (Change Password)</span>
            </button>
          </div>
        </div>

        {showChangePassword && (
          <ChangePasswordModal
            user={currentUser}
            onClose={() => setShowChangePassword(false)}
          />
        )}
      </AdminSubScreen>
    );
  }

  if (open === "branch_info") {
    const branchName = currentUser?.locationName || (allLocations && allLocations.length > 0 ? allLocations[0].name : "ทุกสาขา");
    const matchedLoc = allLocations && allLocations.find(l => l.name === branchName || l.fullName === branchName);
    const branchAddress = matchedLoc?.address || "-";
    return (
      <AdminSubScreen title="ข้อมูลสาขาและคู่มือ SOP" onBack={backHandler}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="text-base font-bold text-slate-900">🏬 {branchName}</div>
          <p className="text-xs text-slate-500 font-medium">{branchAddress}</p>
          <div className="border-t pt-3 space-y-2 text-xs sm:text-sm">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-800">📘 คู่มือมาตรฐานสุขอนามัยและความปลอดภัย (Q.S.C. SOP)</div>
              <div className="text-xs text-slate-500 mt-1">อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "contact_qa") {
    return (
      <AdminSubScreen title="ติดต่อฝ่ายมาตรฐาน (QA Support)" onBack={backHandler}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4 text-center py-10">
          <MessageSquare size={40} className="mx-auto text-[#0F6659]" />
          <div className="text-base font-bold text-slate-900">ฝ่ายประกันคุณภาพ (Quality Assurance)</div>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            หากมีข้อสงสัยเกี่ยวกับเกณฑ์คะแนนหรือต้องการคำแนะนำในการแก้ไขข้อบกพร่อง สามารถติดต่อได้ที่
          </p>
          <a className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 text-[#0F6659] text-xs font-bold border border-emerald-200" href="tel:029999999">
            📞 02-999-9999 ต่อ 102 (ทีม QA)
          </a>
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "forms") {
    return <FormsScreen isDesktop={true} onBack={backHandler} />;
  }



  if (open === "integrations") {
    const integrations = [
      { 
        id: "erp",
        name: "ERP Enterprise", 
        desc: "เชื่อมต่อข้อมูลสาขาและสต็อกวัตถุดิบ", 
        status: "ยังไม่เชื่อมต่อ",
        substatus: "Coming Soon",
        icon: Building2,
        iconBg: "bg-emerald-50 text-[#0F6659] border-emerald-100",
        details: "เชื่อมต่อระบบ ERP เพื่อซิงค์ข้อมูลรายชื่อสาขา ข้อมูลคลังสินค้า และสต็อกวัตถุดิบอัตโนมัติผ่าน REST API / Webhook"
      },
      { 
        id: "pos",
        name: "POS Transaction", 
        desc: "ดึงข้อมูลยอดขายและเวลาที่บริการหน้าร้าน", 
        status: "ยังไม่เชื่อมต่อ",
        substatus: "Coming Soon",
        icon: Monitor,
        iconBg: "bg-blue-50 text-blue-600 border-blue-100",
        details: "ดึงข้อมูลบิลขาย เวลาทำรายการ และสถิติการให้บริการหน้าร้าน เพื่อนำมาวิเคราะห์ร่วมกับคะแนนมาตรฐาน QSC"
      },
      { 
        id: "line",
        name: "LINE Notify", 
        desc: "แจ้งเตือนงานตรวจและงานแก้ไข CAP ไปยัง LINE", 
        status: "ยังไม่เชื่อมต่อ",
        substatus: "Coming Soon",
        isLine: true,
        details: "ระบบส่งข้อความแจ้งเตือนอัตโนมัติเมื่อมีการตรวจประเมินเสร็จสิ้น หรือมีงาน CAP ที่ต้องเร่งแก้ไขไปยังกลุ่ม LINE ของแต่ละสาขา"
      }
    ];

    return (
      <AdminSubScreen title="การเชื่อมต่อ API & Webhook" onBack={backHandler}>
        <div className="space-y-2.5">
          {integrations.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedIntegration(a)}
              className="rounded-2xl p-3.5 sm:p-4 bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group active:scale-[0.99]"
            >
              {/* Left: Icon / Service Logo Placeholder */}
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                {a.isLine ? (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#06C755] text-white flex items-center justify-center font-black text-[9px] sm:text-[10px] tracking-tighter shadow-2xs">
                      LINE
                    </div>
                  </div>
                ) : (
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${a.iconBg} shadow-2xs`}>
                    <a.icon size={22} strokeWidth={2.2} />
                  </div>
                )}

                {/* Middle: Title & Description */}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors tracking-tight">
                    {a.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 leading-snug line-clamp-2">
                    {a.desc}
                  </p>
                </div>
              </div>

              {/* Right: Status Pill, Subtext & Arrow */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-center">
                  <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                    {a.status}
                  </span>
                  <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                    {a.substatus}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Integration Details Modal */}
        {selectedIntegration && (
          <ModalWrapper onClose={() => setSelectedIntegration(null)} maxWidth="max-w-md">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedIntegration.isLine ? (
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <div className="w-7 h-7 rounded-full bg-[#06C755] text-white flex items-center justify-center font-black text-[9px] tracking-tighter">
                        LINE
                      </div>
                    </div>
                  ) : (
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${selectedIntegration.iconBg}`}>
                      <selectedIntegration.icon size={22} strokeWidth={2.2} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {selectedIntegration.name}
                    </h3>
                    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                      {selectedIntegration.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIntegration(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-all shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {selectedIntegration.details}
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium flex items-center gap-2">
                <span>⏳</span>
                <span>ฟังก์ชันนี้กำลังอยู่ระหว่างการพัฒนา กำหนดเปิดให้เชื่อมต่อ API ในเวอร์ชันถัดไป</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIntegration(null)}
                  className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all active:scale-95"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </ModalWrapper>
        )}
      </AdminSubScreen>
    );
  }

  if (open === "settings") {
    return (
      <AdminSubScreen title="ตั้งค่านโยบายและเกณฑ์มาตรฐาน" onBack={backHandler}>
        <div className="space-y-2.5">
          {/* Card 1: เกณฑ์คะแนนผ่านขั้นต่ำ (Passing Threshold) */}
          <div className="rounded-2xl p-4 sm:p-4.5 bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 border border-emerald-100/90 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                  เกณฑ์คะแนนผ่านขั้นต่ำ
                  <span className="block sm:inline sm:ml-1.5 text-slate-700 font-bold">(Passing Threshold)</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                  กำหนดคะแนนร้อยละขั้นต่ำเพื่อให้ถือว่าผ่านการตรวจ
                </p>
              </div>
            </div>

            {/* Right Metric */}
            <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
              <div className="h-8 w-px bg-slate-100 hidden sm:block" />
              <div className="text-center min-w-[65px] sm:min-w-[75px]">
                <div className="text-2xl sm:text-3xl font-black text-[#0F6659] font-mono tracking-tight">
                  85%
                </div>
                <span className="inline-block mt-0.5 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F6659] border border-emerald-200/60">
                  ค่าเริ่มต้น
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: กำหนดเวลาส่งแผนแก้ไข (CAP SLA) */}
          <div className="rounded-2xl p-4 sm:p-4.5 bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-50 border border-amber-100/90 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Clock size={22} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                  กำหนดเวลาส่งแผนแก้ไข
                  <span className="block sm:inline sm:ml-1.5 text-slate-700 font-bold">(CAP SLA)</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                  จำนวนวันที่สาขาต้องส่งหลักฐานหลังพบข้อบกพร่อง
                </p>
              </div>
            </div>

            {/* Right Metric */}
            <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
              <div className="h-8 w-px bg-slate-100 hidden sm:block" />
              <div className="text-center min-w-[65px] sm:min-w-[75px]">
                <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tracking-tight">
                  3 วัน
                </div>
                <span className="inline-block mt-0.5 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60">
                  ค่าเริ่มต้น
                </span>
              </div>
            </div>
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          {role === "STANDARD" ? "เครื่องมือ QA" : role === "EXEC" ? "ศูนย์ข้อมูลผู้บริหาร" : role === "ADMIN" ? "เครื่องมือผู้ดูแลระบบ" : "ระบบของฉัน"}
        </h2>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          รวมเครื่องมือที่เกี่ยวข้องกับบทบาทและสิทธิ์การใช้งานของคุณ
        </p>
      </div>

      {/* 🌟 LONG VERTICAL LIST (ลิสต์ยาวเต็มแถว ตัวหนังสือใหญ่ อ่านง่ายมาก) */}
      <div className="flex flex-col gap-3.5">
        {tools.map((tItem) => (
          <button 
            key={tItem.key} 
            onClick={() => tItem.route && onNavigate ? onNavigate(tItem.route) : setOpen(tItem.key)} 
            className={`w-full rounded-3xl p-5 sm:p-6 flex items-center gap-4 text-left shadow-2xs transition-all cursor-pointer group active:scale-98 border ${
              tItem.featured
                ? 'bg-gradient-to-r from-emerald-50/70 via-white to-white border-emerald-300 hover:border-[#0F6659] shadow-xs ring-1 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xs'
            }`}
          >
            {/* Large Icon Box */}
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
              tItem.featured
                ? 'bg-[#0F6659] text-white border-emerald-600 shadow-2xs'
                : 'bg-emerald-50 text-[#0F6659] border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white'
            }`}>
              <tItem.icon size={26} />
            </div>

            {/* Label & Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 block group-hover:text-[#0F6659] transition-colors leading-snug">
                  {tItem.label}
                </h3>
                {tItem.featured && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-[#0F6659] border border-emerald-300">
                    เมนูหลัก
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                {tItem.desc}
              </p>
            </div>

            {/* Large Right Arrow */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 text-slate-400 group-hover:text-[#0F6659] group-hover:bg-emerald-50 transition-all shrink-0">
              <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

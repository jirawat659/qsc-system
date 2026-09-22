import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { List, ChevronRight, Plus, X, Search, Filter, Wrench, Info } from "lucide-react";
import { Bar } from "recharts";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapDetailScreen from "./CapDetailScreen";
import NewRemediationModal from "./NewRemediationModal";
import api from "../../config/api";
import signalrService from "../../services/signalrService";

export default function CapScreen({ isDesktop, onBack, role = "STANDARD", currentUser }) {
  const {
    capTasks, locations: visibleLocations, refreshData,
    capTasksTotalCount, isLoadingCapTasks, loadMoreCapTasks
  } = React.useContext(DataContext);
  const [selected, setSelected] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    // 🌟 Subscribe to global SignalR status updates to refresh task list
    const unsub = signalrService.onCapStatusUpdated(() => {
      if (refreshData) refreshData();
    });
    return () => {
      unsub();
    };
  }, [refreshData]);

  const capList = useMemo(() => {
    let tasks = capTasks || [];

    if (role === "AUDITEE" || (currentUser?.branchScope === "SPECIFIC" && currentUser?.allowedLocationIds?.length > 0)) {
      const allowedIds = currentUser?.allowedLocationIds || [];
      tasks = tasks.filter(t => allowedIds.includes(t.locationId || t.location?.id) || t.assignedTo === currentUser?.id);
    }

    const mapped = tasks.map(t => {
      const isCancelled = (t.status === "CANCELLED" || t.status === "cancelled");
      const isDone = (t.status === "CLOSED" || t.status === "approved" || t.status === "done" || t.status === "closed");
      const deadlineDate = t.submissionDeadline ? new Date(t.submissionDeadline) : null;
      const deadlineTime = deadlineDate && !isNaN(deadlineDate.getTime()) ? deadlineDate.getTime() : Infinity;
      const createdDate = t.createdAt ? new Date(t.createdAt) : null;
      const createdTime = createdDate && !isNaN(createdDate.getTime()) ? createdDate.getTime() : 0;

      return {
        id: t.id,
        title: t.issueItem || "ข้อบกพร่องจากการตรวจ",
        unit: t.location?.name || t.locationName || t.unit || "สาขามาตรฐาน",
        locationId: t.locationId || t.location?.id,
        issueItem: t.issueItem || t.description,
        desc: t.description || t.desc || "ต้องดำเนินการแก้ไขตามมาตรฐาน Q.S.C.",
        status: isCancelled ? "cancelled" : (isDone ? "done" : "pending"),
        statusRaw: t.status,
        deadline: deadlineDate && !isNaN(deadlineDate.getTime()) ? deadlineDate.toLocaleDateString('th-TH') : "-",
        createdAt: createdDate && !isNaN(createdDate.getTime()) ? createdDate.toLocaleDateString('th-TH') : "-",
        auditor: t.auditorName || t.verifierName || "-",
        auditorName: t.auditorName || t.verifierName || "-",
        auditScore: t.auditScore,
        deadlineTime,
        createdTime,
        raw: t
      };
    });

    // 🌟 จัดเรียง: สถานะกำลังแก้ไขงาน (pending) อยู่บนสุด เรียงตามวันครบกำหนดที่ถึงก่อน (Ascending)
    // จากนั้นสถานะอนุมัติปิดงานแล้ว (done) อยู่ทีหลัง เรียงตามวันที่ล่าสุด (Descending)
    return mapped.sort((a, b) => {
      const aIsDoneOrCancelled = a.status === "done" || a.status === "cancelled";
      const bIsDoneOrCancelled = b.status === "done" || b.status === "cancelled";
      if (aIsDoneOrCancelled !== bIsDoneOrCancelled) {
        return aIsDoneOrCancelled ? 1 : -1;
      }
      if (!aIsDoneOrCancelled) {
        return a.deadlineTime - b.deadlineTime;
      }
      return b.createdTime - a.createdTime;
    });
  }, [capTasks, role, currentUser]);

  const LIST_PAGE_SIZE = 10;
  const [listPage, setListPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const filteredCapList = useMemo(() => {
    return capList.filter(item => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter || (statusFilter === "done" && (item.status === "done" || item.status === "cancelled"));
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm.trim() ||
        item.title.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q) ||
        (item.issueItem && item.issueItem.toLowerCase().includes(q)) ||
        item.desc.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [capList, statusFilter, searchTerm]);

  // Reset page on search or filter change
  useEffect(() => {
    setListPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setPageInput(String(listPage));
  }, [listPage]);

  const totalListPages = Math.max(1, Math.ceil(filteredCapList.length / LIST_PAGE_SIZE));
  const paginatedCapList = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return filteredCapList.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredCapList, listPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= totalListPages) {
      setListPage(val);
    } else {
      setPageInput(String(listPage));
    }
  };

  // 🌟 Phase 3.3: capTasks is a growing buffer (50 at a time) from the API.
  // When the visible page (10/page) approaches the edge of what's currently
  // buffered — and more exists on the server — fetch the next buffer page.
  useEffect(() => {
    if (!capTasks || isLoadingCapTasks) return;
    if (capTasksTotalCount <= capTasks.length) return;
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    const nearEndOfBuffer = start + LIST_PAGE_SIZE >= capTasks.length - LIST_PAGE_SIZE;
    if (nearEndOfBuffer) {
      loadMoreCapTasks();
    }
  }, [listPage, capTasks, capTasksTotalCount, isLoadingCapTasks]);

  if (selected) return (
    <CapDetailScreen
      item={selected}
      role={role}
      currentUser={currentUser}
      refreshData={refreshData}
      onBack={() => {
        setSelected(null);
        if (refreshData) refreshData();
      }}
    />
  );

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title={role === "AUDITEE" ? "แชทติดตามงานแก้ไข (CAP Threads)" : "ส่งมอบงานแก้ไขข้อบกพร่อง (CAP)"}
        subtitle={role === "AUDITEE" ? "รายการงานแก้ไขที่ยื่นเรื่องแล้ว และประวัติการพูดคุยกับ QA/QC" : "ติดตามและส่งมอบหลักฐานการแก้ไขข้อบกพร่องจากการตรวจประเมิน"}
        onBack={onBack}
      />

      {/* 🌟 ปุ่มสร้างงานแก้ไขใหม่ (มอบหมายให้ผู้จัดการร้าน/สาขา) */}
      <div className="flex justify-end sm:justify-start">
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer shadow-sm hover:bg-emerald-800 active:scale-[0.98] transition-all text-white bg-[#0F6659]"
        >
          <Plus size={18} /> {role === "AUDITEE" ? "แจ้งรายการแก้ไขใหม่" : "สร้างงานแก้ไขใหม่ (มอบหมายสาขา)"}
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่องานแก้ไข, สาขา หรือข้อคำถาม..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-8.5 pr-8 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs outline-none font-medium text-slate-800 focus:border-[#0F6659] transition-colors placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-md transition-colors"
              title="ล้างข้อความค้นหา"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {<div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {[
            { key: "all", label: "ทั้งหมด" },
            { key: "pending", label: "กำลังแก้ไขงาน" },
            { key: "done", label: "ปิดงาน/ยกเลิกแล้ว" },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                statusFilter === tab.key
                  ? 'bg-[#0F6659] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>}
      </div>

      {/* Long Vertical List (ปุ่มหัวข้อใหญ่ ชัดเจน เน้นๆ ทีละ 10 รายการ) */}
      <div className="flex flex-col gap-3">
        {paginatedCapList.map((item, i) => {
          const st = CAP_STATUS_MAP[item.status] || CAP_STATUS_MAP.pending;
          return (
            <button
              key={i}
              onClick={() => setSelected(item)}
              className="w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group"
            >
              {/* Left Info */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
                  style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}33` }}
                >
                  <Wrench size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors break-words [overflow-wrap:anywhere]">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {item.unit}
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      ครบกำหนด {item.deadline}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Status Badge & Arrow */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-lg border"
                  style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: st.fg }} />
                  {st.label}
                </span>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
            </button>
          );
        })}

        {filteredCapList.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-sm text-slate-400 font-medium">
            ไม่พบรายการส่งมอบงานแก้ไขที่ตรงกับคำค้นหา
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredCapList.length > 0 && (
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs text-xs font-medium text-slate-500 bg-white mt-2 mb-8">
          <span>
            หน้า {listPage} จาก {totalListPages} ({filteredCapList.length} รายการ)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setListPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={listPage === 1}
              className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
            >
              ก่อนหน้า
            </button>

            {/* ช่องเล็กสำหรับพิมพ์เลขหน้า (กด Enter หรือคลิกออกนอกช่องเพื่อเปลี่ยนหน้า) */}
            <input
              type="number"
              min="1"
              max={totalListPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePageSubmit();
                  e.target.blur();
                }
              }}
              className="w-10 h-8 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            <button
              type="button"
              onClick={() => {
                setListPage((p) => Math.min(totalListPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={listPage >= totalListPages}
              className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewRemediationModal
          locations={visibleLocations}
          currentUser={currentUser}
          onClose={() => setShowNewModal(false)}
          onSuccess={async () => {
            if (refreshData) await refreshData();
          }}
        />
      )}
    </div>
  );
}

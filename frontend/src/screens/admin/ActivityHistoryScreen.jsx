import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock, Search, Filter, RotateCcw, ChevronLeft, ChevronRight,
  Shield, UserCheck, AlertCircle, Loader2, LogIn, LogOut,
  FileEdit, ClipboardCheck, PlusCircle, CheckCircle2,
  Calendar, Layers, MapPin, Building2, Eye, Save
} from "lucide-react";
import api from "../../config/api";
import AdminSubScreen from "./AdminSubScreen";
import { formatActivityLogDetails } from "../../utils/formatters";

export default function ActivityHistoryScreen({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [actionCategory, setActionCategory] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL"); // ALL, TODAY, 7DAYS, 30DAYS

  const fetchLogs = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        pageSize,
        actionType: actionCategory !== "ALL" ? actionCategory : undefined,
        search: searchTerm.trim() || undefined
      };

      const now = new Date();
      if (dateFilter === "TODAY") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        params.startDate = todayStart.toISOString();
      } else if (dateFilter === "7DAYS") {
        const d7 = new Date();
        d7.setDate(now.getDate() - 7);
        params.startDate = d7.toISOString();
      } else if (dateFilter === "30DAYS") {
        const d30 = new Date();
        d30.setDate(now.getDate() - 30);
        params.startDate = d30.toISOString();
      }

      const res = await api.get("/activity/logs", { params });
      setLogs(res.data?.items || []);
      setTotalCount(res.data?.totalCount || 0);
      setTotalPages(res.data?.totalPages || 1);
      setPage(res.data?.page || 1);
    } catch (err) {
      console.error("Failed to load activity logs", err);
      setError(err.response?.data?.message || "ไม่สามารถดึงข้อมูลประวัติกิจกรรมได้");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, actionCategory, dateFilter, searchTerm]);

  useEffect(() => {
    fetchLogs(1);
  }, [actionCategory, dateFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      fetchLogs(newPage);
    }
  };

  // จัดรูปแบบวันเวลาภาษาไทย (เวลาไว้บรรทัดบน วันที่ไว้บรรทัดล่าง ละเอียดถึงวินาที)
  const formatDateTimeParts = (isoString) => {
    if (!isoString) return { date: "-", time: "-" };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { date: "-", time: "-" };
      const date = d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      const time = d.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }) + " น.";
      return { date, time };
    } catch {
      return { date: "-", time: "-" };
    }
  };

  // แม็ปปิ้ง Action เป็นชื่อภาษาไทย และสี Badge ที่เข้าใจง่าย
  const getActionBadge = (action) => {
    const act = (action || "").toUpperCase();

    if (act === "LOGIN") {
      return {
        label: "เข้าสู่ระบบ",
        icon: LogIn,
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80"
      };
    }
    if (act === "LOGOUT") {
      return {
        label: "ออกจากระบบ",
        icon: LogOut,
        bg: "bg-slate-100 text-slate-600 border-slate-200"
      };
    }
    if (act === "AUDIT_START") {
      return {
        label: "เริ่มตรวจประเมิน",
        icon: Clock,
        bg: "bg-teal-50 text-[#0F6659] border-teal-200/80"
      };
    }
    if (act === "AUDIT_DRAFT_SAVE") {
      return {
        label: "บันทึกแบบร่าง",
        icon: Save,
        bg: "bg-blue-50 text-blue-700 border-blue-200"
      };
    }
    if (act === "AUDIT_SUBMIT") {
      return {
        label: "ส่งผลการตรวจ",
        icon: CheckCircle2,
        bg: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
      };
    }
    if (act === "AUDIT_EDIT") {
      return {
        label: "แก้ไขผลตรวจ",
        icon: FileEdit,
        bg: "bg-amber-50 text-amber-800 border-amber-200"
      };
    }
    if (act === "AUDIT_REOPEN") {
      return {
        label: "ย้อนสถานะผลตรวจ",
        icon: AlertCircle,
        bg: "bg-rose-50 text-rose-700 border-rose-200 font-bold"
      };
    }
    if (act === "AUDIT_DELETE") {
      return {
        label: "ลบผลตรวจ",
        icon: AlertCircle,
        bg: "bg-rose-100 text-rose-800 border-rose-300 font-bold"
      };
    }
    if (act.startsWith("FORM_")) {
      const type = act.replace("FORM_", "");
      const map = { CREATE: "สร้างฟอร์ม", EDIT: "แก้ไขฟอร์ม", DELETE: "ลบฟอร์ม", DUPLICATE: "คัดลอกฟอร์ม" };
      return {
        label: map[type] || "จัดการฟอร์ม",
        icon: Layers,
        bg: "bg-purple-50 text-purple-700 border-purple-200"
      };
    }
    if (act.startsWith("USER_")) {
      const type = act.replace("USER_", "");
      const map = { CREATE: "สร้างผู้ใช้", EDIT: "แก้ไขผู้ใช้", DISABLE: "ระงับผู้ใช้" };
      return {
        label: map[type] || "จัดการผู้ใช้",
        icon: UserCheck,
        bg: "bg-blue-50 text-blue-700 border-blue-200"
      };
    }
    if (act.startsWith("ROLE_")) {
      return {
        label: "จัดการบทบาท/สิทธิ์",
        icon: Shield,
        bg: "bg-indigo-50 text-indigo-700 border-indigo-200"
      };
    }
    if (act.startsWith("LOCATION_")) {
      return {
        label: "จัดการสาขา",
        icon: Building2,
        bg: "bg-cyan-50 text-cyan-700 border-cyan-200"
      };
    }
    if (act.startsWith("SCHEDULE_")) {
      return {
        label: "จัดการนัดหมาย",
        icon: Calendar,
        bg: "bg-sky-50 text-sky-700 border-sky-200"
      };
    }
    if (act.startsWith("EXPORT_")) {
      return {
        label: "ส่งออกรายงาน",
        icon: CheckCircle2,
        bg: "bg-teal-50 text-teal-800 border-teal-200"
      };
    }

    return {
      label: action || "กิจกรรม",
      icon: Clock,
      bg: "bg-slate-100 text-slate-700 border-slate-200"
    };
  };

  // จัดรูปแบบ "ทำกับอะไร & ที่ไหน" (ใช้ DocumentId / DocumentNo แทน ID ตัวเลขตรงๆ)
  const formatTarget = (item) => {
    const hasLoc = !!item.locationName;
    const entMap = {
      AuditRecord: "ผลตรวจรอบ",
      AuditDraft: "แบบร่างตรวจ",
      SurveyForm: "แบบฟอร์ม",
      User: "บัญชีผู้ใช้",
      Role: "บทบาท",
      Location: "สาขา",
      AuditSchedule: "แผนการตรวจ"
    };
    const typeName = item.entityType ? (entMap[item.entityType] || item.entityType) : null;
    const docIdentifier = item.documentNo || item.documentId;

    if (!hasLoc && !typeName) {
      return <span className="text-slate-400 font-medium">ระบบส่วนกลาง</span>;
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-xs leading-snug">
        {hasLoc && (
          <span className="font-semibold text-slate-800 whitespace-nowrap">
            สาขา {item.locationName}
          </span>
        )}
        {hasLoc && typeName && (
          <span className="hidden sm:inline text-slate-300">·</span>
        )}
        {typeName && (
          <span className="text-slate-600 flex items-center gap-1.5 flex-wrap">
            <span className="whitespace-nowrap">{typeName}</span>
            {docIdentifier && (
              <span className="font-mono font-bold text-slate-800 whitespace-nowrap">
                {docIdentifier}
              </span>
            )}
            {item.details && (
              <span 
                className="text-[11px] font-sans text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/80 max-w-[280px] sm:max-w-[450px] truncate inline-block"
                title={formatActivityLogDetails(item.details)}
              >
                ({formatActivityLogDetails(item.details)})
              </span>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <AdminSubScreen 
      title="ประวัติการใช้งานระบบ" 
      maxWidth="max-w-[100%] sm:max-w-[96%] md:max-w-[92%]"
      onBack={onBack}
    >
      <div className="space-y-4">
        {/* Controls Bar: Search & Filters */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5">
          {/* แถบค้นหา */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ใช้, กิจกรรม, หรือสาขา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[#0F6659] bg-slate-50/50"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0F6659] hover:bg-[#0C5247] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              ค้นหา
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setActionCategory("ALL");
                setDateFilter("ALL");
                fetchLogs(1);
              }}
              title="รีเซ็ตตัวกรอง"
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer transition-all active:scale-95"
            >
              <RotateCcw size={16} />
            </button>
          </form>

          {/* แถวตัวกรองหมวดหมู่ & วันที่ */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            {/* หมวดหมู่กิจกรรม */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "ALL", label: "ทั้งหมด" },
                { key: "AUTH", label: "เข้า/ออกระบบ" },
                { key: "AUDIT", label: "งานตรวจ" },
                { key: "SYSTEM", label: "จัดการระบบ" }
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActionCategory(cat.key)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    actionCategory === cat.key
                      ? "bg-[#0F6659] text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1" />

            {/* ตัวกรองช่วงวันที่ */}
            {/*<div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {[
                { key: "ALL", label: "ทุกวัน" },
                { key: "TODAY", label: "วันนี้" },
                { key: "7DAYS", label: "7 วันล่าสุด" },
                { key: "30DAYS", label: "30 วันล่าสุด" }
              ].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDateFilter(d.key)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    dateFilter === d.key
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>*/}
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={28} className="animate-spin text-[#0F6659]" />
              <span className="text-xs font-semibold">กำลังโหลดประวัติการใช้งานระบบ...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 text-xs font-semibold flex flex-col items-center gap-2">
              <AlertCircle size={24} />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2 p-4">
              <Clock size={36} className="text-slate-300" />
              <div className="text-sm font-bold text-slate-700">ไม่พบประวัติกิจกรรมในช่วงเวลาที่เลือก</div>
              <div className="text-xs text-slate-500 max-w-sm">
                ลองปรับเปลี่ยนคำค้นหา หรือเลือกช่วงเวลาอื่น
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-4 w-[150px] lg:w-[165px] whitespace-nowrap">วันและเวลา</th>
                    <th className="py-3 px-4 w-[240px] lg:w-[280px]">ผู้ใช้งาน</th>
                    <th className="py-3 px-4 w-[160px] lg:w-[175px] whitespace-nowrap">เหตุการณ์</th>
                    <th className="py-3 px-4 min-w-[260px]">กิจกรรม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const badge = getActionBadge(log.action);
                    const ActionIcon = badge.icon;
                    const dt = formatDateTimeParts(log.occurredAt);
                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* 1. วันและเวลา (เวลาไว้บรรทัดบน วันที่ไว้บรรทัดล่าง) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-xs font-mono">
                            {dt.time}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {dt.date}
                          </div>
                        </td>

                        {/* 2. ผู้ใช้งาน (ตัดคำ truncate หากชื่อยาวเกิน) */}
                        <td className="py-3 px-4 max-w-[240px] lg:max-w-[280px]">
                          <div 
                            className="font-bold text-slate-800 leading-tight truncate"
                            title={log.fullName || "ไม่ระบุชื่อ"}
                          >
                            {log.fullName || "ไม่ระบุชื่อ"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="truncate" title={`@${log.username}`}>@{log.username}</span>
                            {log.roleName && (
                              <span className="shrink-0 px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                {log.roleName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. เหตุการณ์ */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold shadow-2xs ${badge.bg}`}>
                            <ActionIcon size={13} className="shrink-0" />
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        {/* 4. ที่ไหน & กับอะไร (ใช้ DocumentId แทน ID ตรงๆ) */}
                        <td className="py-3 px-4 text-xs">
                          {formatTarget(log)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && logs.length > 0 && (
            <div className="p-3 sm:p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                ทั้งหมด <span className="font-bold text-slate-800">{totalCount.toLocaleString()}</span> รายการ
                (หน้า {page} จาก {totalPages})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 font-bold text-slate-700">{page}</span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminSubScreen>
  );
}


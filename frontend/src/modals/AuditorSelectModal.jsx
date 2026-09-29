import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { List, Users, Check, X, Search, Filter } from "lucide-react";


import { c, sans, mono, cardStyle } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";
import api from "../config/api";


import { DataContext } from "../context/DataContext";

let cachedAuditorsData = null;

export default function AuditorSelectModal({ currentAuditor, onSelect, onClose }) {
  const { schedules } = React.useContext(DataContext);
  const [search, setSearch] = useState("");
  const [teamTab, setTeamTab] = useState("all");
  const [dbUsers, setDbUsers] = useState(() => cachedAuditorsData || []);

  useEffect(() => {
    let isMounted = true;
    api.get('/user')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          // แสดงเฉพาะผู้ที่มีสิทธิ์ตรวจ (Role AUDITOR เท่านั้น)
          const auditorsOnly = res.data.filter(u => 
            u.roleCode === 'AUDITOR' || 
            u.role === 'AUDITOR' || 
            (u.roleName && (u.roleName.includes('ผู้ตรวจ') || u.roleName.includes('Auditor')))
          );
          cachedAuditorsData = auditorsOnly;
          setDbUsers(auditorsOnly);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const auditorsList = useMemo(() => {
    if (dbUsers.length > 0) {
      return dbUsers.map(u => {
        const uName = u.fullName || u.username;
        // Compute real active audit tasks for this auditor from live schedules (strictly exact match)
        const activeCount = (schedules || []).filter(s => {
          if (s.status === "completed" || s.status === "done") return false;

          // 1. Match by exact user/auditor ID
          const hasId = (s.auditors || []).some(a => (a.id === u.id || a.auditorId === u.id)) ||
                        (s.auditorIds || []).includes(u.id) ||
                        s.auditorId === u.id;
          if (hasId) return true;

          // 2. Match by exact name token
          const target = uName.toLowerCase().trim();
          const rawList = [
            s.auditor,
            s.auditorName,
            ...(Array.isArray(s.auditorNames) ? s.auditorNames : []),
            ...(Array.isArray(s.auditors) ? s.auditors.map(a => a?.fullName || a?.name || a?.username) : [])
          ];
          const tokens = [];
          rawList.filter(Boolean).forEach(item => {
            if (typeof item === "string") {
              tokens.push(item.trim().toLowerCase());
              item.split(/[,;/|\n]|\s+และ\s+|\s+&\s+/).forEach(p => {
                const cleaned = p.trim().toLowerCase();
                if (cleaned) tokens.push(cleaned);
              });
            }
          });
          return tokens.includes(target);
        }).length;

        return {
          id: u.id,
          name: uName,
          role: u.roleName || "ผู้ตรวจประเมิน (QA Auditor)",
          team: u.roleCode === 'AUDITOR' ? 'qa' : 'ops',
          teamLabel: u.roleName || 'ทีมผู้ตรวจประเมิน (QA)',
          phone: u.phoneNumber || u.phone || "-",
          avatar: (u.fullName || u.username || "AU").substring(0, 2),
          rating: null,
          auditsCount: activeCount,
          activeCount: activeCount
        };
      });
    }
    return [];
  }, [dbUsers, schedules]);

  const filteredAuditors = useMemo(() => {
    let list = [...auditorsList];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.role.toLowerCase().includes(q) || 
        a.teamLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [auditorsList, search]);

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
      <div className="w-full max-w-full overflow-hidden flex flex-col min-h-0 flex-1">
        {/* Modal Header */}
        <div className="shrink-0 p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: c.ink }}>เลือกผู้ตรวจประเมิน</h3>
              <p className="text-xs" style={{ color: c.faint }}>จัดกลุ่มตามทีมและค้นหารายชื่อ</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b bg-white shrink-0" style={{ borderColor: c.border }}>
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ตรวจ, บทบาท, หรือทีม..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 min-h-[48px] text-sm sm:text-sm rounded-2xl border border-slate-200 outline-none focus:border-[#0F6659] font-semibold text-slate-800 bg-slate-50 focus:bg-white transition-colors appearance-none"
            />
          </div>
        </div>

        {/* List of Auditors - Clean, spacious cards without divide-y clashing */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain max-h-[60dvh] sm:max-h-[68dvh] p-3 pb-12 space-y-2" style={{ background: "#FAF9F5" }}>
          {/* Quick Option: All Auditors Card */}
          <button
            type="button"
            onClick={() => { onSelect("ทั้งหมด", null); onClose(); }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left cursor-pointer transition-all ${
              currentAuditor === "ทั้งหมด"
                ? 'bg-emerald-50/90 border-2 border-emerald-600 shadow-xs'
                : 'bg-white border border-slate-200/80 hover:border-emerald-300 hover:bg-slate-50/80 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                currentAuditor === "ทั้งหมด" ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
              }`}>
                All
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-xs sm:text-sm font-bold" style={{ color: c.ink }}>ผู้ตรวจทุกคน (ทั้งหมดในระบบ)</div>
                <div className="text-xs font-medium" style={{ color: c.faint }}>แสดงตารางงานของทุกคนพร้อมกัน</div>
              </div>
            </div>
            {currentAuditor === "ทั้งหมด" && (
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check size={13} strokeWidth={3} />
              </div>
            )}
          </button>
          {/* Individual Auditor Cards */}
          {filteredAuditors.map((auditor) => {
            const isSelected = currentAuditor === auditor.name;
            return (
              <button
                key={auditor.id}
                type="button"
                onClick={() => { onSelect(auditor.name, auditor.id); onClose(); }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-50/90 border-2 border-emerald-600 shadow-xs'
                    : 'bg-white border border-slate-200/80 hover:border-emerald-300 hover:bg-slate-50/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-100/80 text-emerald-800'
                  }`}>
                    {auditor.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-xs sm:text-sm font-bold truncate" style={{ color: c.ink }}>{auditor.name}</div>
                    <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {auditor.teamLabel} · {auditor.role}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                    {auditor.activeCount} งานตรวจ
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {filteredAuditors.length === 0 && (
            <div className="text-center text-xs py-10 text-slate-400 font-medium bg-white rounded-2xl border border-slate-200">
              ไม่พบรายชื่อผู้ตรวจตามคำค้นหา
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

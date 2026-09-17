import React, { useState, useMemo, useEffect } from "react";
import { Search, ArrowUpDown, ChevronDown, Download, X, Filter, ClipboardCheck, CalendarDays, Plus, Calendar, ChevronRight } from "lucide-react";


import { c, sans, mono } from "../../config/theme";
import { DataContext } from "../../context/DataContext";
import ScoreRing from "../../shared/ScoreRing";
import Header from "../../shared/Header";
import ExcelExportModal from "../../modals/ExcelExportModal";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";
import BranchProfile from "./BranchProfile";
import LiveAuditScreen from "../audit/LiveAuditScreen";
import api from "../../config/api";
import { parseAuditTimestamp, parseThaiMonthYearQuery } from "../../utils/formatters";

// 🌟 ฟังก์ชันช่วยระดับโมดูล (เดิมเคยประกาศซ้ำในหลายจุดของ allLogs useMemo) — รับ forms/activeLocations
// เป็นพารามิเตอร์ตรงๆ เพื่อให้เรียกใช้ซ้ำได้ทั้งใน allLogs useMemo และใน buildCompletedLog (โหมดค้นหาเดือน/ปี)
function resolveFormTitle(formId, directTitle, forms) {
  if (directTitle && directTitle !== "-" && typeof directTitle === 'string' && directTitle.trim()) {
    return directTitle.trim();
  }
  if (formId && forms && forms.length > 0) {
    const found = forms.find(f => Number(f.id) === Number(formId));
    if (found && (found.title || found.name)) return (found.title || found.name).trim();
  }
  if (forms && forms.length > 0 && (forms[0].title || forms[0].name)) {
    return (forms[0].title || forms[0].name).trim();
  }
  return "แบบฟอร์มมาตรฐานใหม่";
}

function getBrandsForLoc(locId, directLoc, activeLocations) {
  const loc = (directLoc && (directLoc.locationBrands || directLoc.brand)) ? directLoc : (activeLocations || []).find(al => al.id === locId);
  if (!loc) return "";
  const brands = (loc.locationBrands || []).map(lb => lb.brand?.name || lb.brandName).filter(Boolean);
  if (brands.length === 0 && (loc.brand?.name || loc.brandName)) brands.push(loc.brand?.name || loc.brandName);
  return brands.join(" ");
}

// 🌟 ฟังก์ชันแปลงวันที่ให้ล็อกเป็น Timezone ประเทศไทย (+07:00 Asia/Bangkok) เสมอ (L1)
export function formatThaiAuditDate(rawDate) {
  if (!rawDate) return "-";
  try {
    return new Date(rawDate).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  } catch {
    return String(rawDate).split('T')[0] || "-";
  }
}

// 🌟 แปลง audit record ดิบ (จาก /audit/records ไม่ว่าจะมาจาก buffer หรือ fetch ตรงด้วย startDate/endDate)
// ให้เป็น log object ที่หน้านี้ใช้แสดงผล — แยกออกมาเป็นฟังก์ชันระดับโมดูลเพื่อใช้ซ้ำได้ทั้งสองทาง
function buildCompletedLog(r, forms, activeLocations) {
  const score = Math.round(r.percentageScore || 0);
  const branchName = r.locationName || r.location?.name || "-";
  const branchFullName = r.locationName || r.location?.fullName || r.location?.name || "-";
  const rawDate = r.auditDate || r.createdAt;
  const dateFormatted = formatThaiAuditDate(rawDate);
  const timestamp = parseAuditTimestamp(rawDate, r.id);
  const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
  const formId = r.surveyFormId || r.formId || r.surveyForm?.id;
  const directForm = r.surveyFormTitle || r.surveyForm?.title || r.formTitle || r.formName || r.form;
  const formVal = resolveFormTitle(formId, directForm, forms);
  const formVersion = r.surveyFormVersion || r.surveyForm?.version || "";
  const brandNames = getBrandsForLoc(r.locationId, r.location, activeLocations);

  return {
    id: `completed-${r.id}`,
    originalId: r.id,
    type: 'completed',
    unitName: branchName,
    unitFullName: branchFullName,
    brandNames: brandNames,
    region: r.locationRegion || r.location?.region || "-",
    date: dateFormatted,
    rawDate: rawDate,
    timestamp: timestamp,
    score: score,
    auditor: auditorVal,
    formName: formVal,
    formVersion: formVersion,
    auditType: (r.auditType === 'unannounced' || r.auditType === 'spot') ? "นอกกำหนดการ" : (r.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
    status: r.isPassed ? "pass" : "fail",
    record: {
      ...r,
      unitName: branchName,
      unitFullName: branchFullName,
      score: score,
      percentageScore: score,
      date: dateFormatted,
      auditDate: r.auditDate,
      auditor: auditorVal,
      auditorName: auditorVal,
      form: formVal,
      formName: formVal,
      surveyFormTitle: formVal,
      surveyFormVersion: formVersion,
      status: r.isPassed ? "pass" : "fail",
      isPassed: r.isPassed,
      hasCriticalDefect: r.hasCriticalDefect
    }
  };
}

export default function AllAuditHistoryScreen({ onBack, onSelectLog, onExportExcel, currentAuditorName = null, title = "รายงานผลการตรวจ", onStartAudit, onResumeDraft, onStartNewAudit }) {
  const {
    locations: visibleLocations, auditRecords, capTasks, schedules, activeDrafts, forms, refreshData,
    auditRecordsTotalCount, isLoadingAuditRecords, loadMoreAuditRecords
  } = React.useContext(DataContext);
  const activeLocations = visibleLocations || [];
  const [trendsData, setTrendsData] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/dashboard/trends')
      .then(res => {
        if (isMounted && res.data?.monthlyTrends) {
          setTrendsData(res.data.monthlyTrends.map(t => ({
            label: t.month,
            score: t.score
          })));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'completed' | 'draft' | 'pending'
  const [sortBy, setSortBy] = useState("date-desc"); // 'date-desc' | 'date-asc' | 'branch-asc' | 'branch-desc' | 'score-desc' | 'score-asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [activeDirectPlan, setActiveDirectPlan] = useState(null);
  const pageSize = 10;

  // 🌟 โหมดค้นหาด้วยเดือน/ปีภาษาไทย (เช่น "มี.ค 2568"): ยิง request ตรงไป backend
  // ด้วย startDate/endDate แทนการกรอง buffer — คนละ path กับการ browse ปกติ
  const [monthQuery, setMonthQuery] = useState(null); // { startDate, endDate, label } | null
  const [monthSearchLogs, setMonthSearchLogs] = useState([]);
  const [isMonthSearching, setIsMonthSearching] = useState(false);

  useEffect(() => {
    const parsed = parseThaiMonthYearQuery(searchTerm);
    setMonthQuery(parsed);

    if (!parsed) {
      setMonthSearchLogs([]);
      return;
    }

    let isCancelled = false;
    setIsMonthSearching(true);
    api.get('/audit/records', {
      params: {
        startDate: parsed.startDate.toISOString(),
        endDate: parsed.endDate.toISOString()
      }
    })
      .then(res => {
        if (isCancelled) return;
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setMonthSearchLogs(items.map(r => buildCompletedLog(r, forms, activeLocations)));
      })
      .catch(() => {
        if (!isCancelled) setMonthSearchLogs([]);
      })
      .finally(() => {
        if (!isCancelled) setIsMonthSearching(false);
      });

    return () => { isCancelled = true; };
  }, [searchTerm, forms, activeLocations]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, statusFilter, sortBy]);

  // Sync input text with currentPage when navigating via buttons
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 🌟 Dynamic Real-time Calculations from Database & Audit Records
  const totalBranches = activeLocations.length;
  const auditedCount = (auditRecords && auditRecords.length > 0) ? auditRecords.length : 0;

  // คำนวณคะแนนและสถานะผ่านของแต่ละสาขาจาก auditRecords จริง (fallback ไปยัง loc.lastScore)
  const branchLatestScores = useMemo(() => {
    return activeLocations.map(loc => {
      // หาผลตรวจของสาขานี้จาก auditRecords
      const locAudits = (auditRecords || []).filter(r =>
        (r.locationId && r.locationId === loc.id) ||
        (r.locationName && (r.locationName === loc.name || r.locationName === loc.fullName)) ||
        (r.location?.id && r.location.id === loc.id) ||
        (r.location?.name && (r.location.name === loc.name || r.location.name === loc.fullName))
      );

      let latestScore = null;
      let isPassed = false;

      if (locAudits.length > 0) {
        const sorted = [...locAudits].sort((a, b) => {
          const tA = new Date(a.auditDate || a.createdAt || a.date || 0).getTime();
          const tB = new Date(b.auditDate || b.createdAt || b.date || 0).getTime();
          return tB - tA || (b.id || 0) - (a.id || 0);
        });
        const latest = sorted[0];
        const sc = latest.percentageScore !== undefined ? latest.percentageScore : latest.score;
        if (sc !== undefined && sc !== null) {
          latestScore = Math.round(sc);
          isPassed = latest.isPassed !== undefined ? latest.isPassed : (latestScore >= 85);
        }
      }

      // ถ้ายังไม่มีใน auditRecords ลองดู loc.lastScore
      if (latestScore === null && typeof loc.lastScore === 'number' && loc.lastScore > 0) {
        latestScore = Math.round(loc.lastScore);
        isPassed = latestScore >= 85;
      }

      return {
        ...loc,
        latestScore,
        isPassed,
        hasAudit: latestScore !== null
      };
    });
  }, [activeLocations, auditRecords]);

  const auditedBranches = useMemo(() => branchLatestScores.filter(b => b.hasAudit), [branchLatestScores]);
  const auditedBranchCount = auditedBranches.length;
  const passedBranches = useMemo(() => auditedBranches.filter(b => b.isPassed), [auditedBranches]);
  const passedCount = passedBranches.length;

  // คะแนนเฉลี่ยภาพรวม:
  // 1. ถ้ามีสาขาที่ตรวจแล้ว -> เฉลี่ยจากคะแนนล่าสุดของแต่ละสาขาที่ตรวจแล้ว
  // 2. ถ้าไม่มีข้อมูลแบ่งสาขา แต่มี auditRecords -> เฉลี่ยจาก percentageScore ทั้งหมด
  // 3. ถ้าไม่มีเลย -> 0
  const avgScore = useMemo(() => {
    if (auditedBranches.length > 0) {
      return Math.round(auditedBranches.reduce((acc, b) => acc + b.latestScore, 0) / auditedBranches.length);
    }
    if (auditRecords && auditRecords.length > 0) {
      const validRecords = auditRecords.filter(r => (r.percentageScore !== undefined && r.percentageScore !== null) || (r.score !== undefined && r.score !== null));
      if (validRecords.length > 0) {
        return Math.round(validRecords.reduce((acc, r) => acc + (r.percentageScore !== undefined ? r.percentageScore : r.score), 0) / validRecords.length);
      }
    }
    return 0;
  }, [auditedBranches, auditRecords]);

  const pendingCapCount = (capTasks && capTasks.length > 0) 
    ? capTasks.filter(c => {
        const s = (c.status || '').toUpperCase();
        return s !== 'APPROVED' && s !== 'CLOSED' && s !== 'DONE';
      }).length 
    : 0;

  // 🌟 Map logs from Live Database if available, otherwise from mocks
  const allLogs = useMemo(() => {
    const logs = [];

    // 1. Completed Records
    if (auditRecords && auditRecords.length > 0) {
      auditRecords.forEach((r) => {
        logs.push(buildCompletedLog(r, forms, activeLocations));
      });
    }

    // 2. Drafts (ฉบับร่างค้างตรวจ)
    if (activeDrafts && activeDrafts.length > 0) {
      const sortedDrafts = [...activeDrafts].sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || a.startedAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || b.startedAt || 0).getTime();
        return (timeB - timeA) || ((b.id || 0) - (a.id || 0));
      });

      sortedDrafts.forEach((d) => {
        const branchName = d.locationName || d.location?.name || "-";
        const branchFullName = d.locationFullName || d.locationName || d.location?.fullName || d.location?.name || "-";
        const rawDate = d.updatedAt || d.createdAt || d.startedAt || null;
        const dateFormatted = formatThaiAuditDate(rawDate);
        const timestamp = parseAuditTimestamp(rawDate, d.id) + 1000000000; // prioritize drafts slightly higher
        
        const formId = d.surveyFormId || d.formId || d.form?.id || d.surveyForm?.id;
        const directForm = d.surveyFormTitle || d.formTitle || d.surveyForm?.title || d.formName || d.form?.title || d.form?.name;
        const formVal = resolveFormTitle(formId, directForm, forms);
        
        let parsedPayload = null;
        if (d.draftPayloadJson) {
          try {
            parsedPayload = typeof d.draftPayloadJson === 'string' ? JSON.parse(d.draftPayloadJson) : d.draftPayloadJson;
          } catch (e) {}
        }

        const auditorVal = parsedPayload?.auditorName || d.auditorName || d.primaryAuditor?.fullName || d.auditor?.fullName || "-";

        // Calculate answeredCount accurately
        let answeredCount = 0;
        if (parsedPayload?.answers && typeof parsedPayload.answers === 'object') {
          answeredCount = Object.keys(parsedPayload.answers).length;
        } else if (d.answers && typeof d.answers === 'object') {
          answeredCount = Object.keys(d.answers).length;
        } else if (d.totalAnswered !== undefined && d.totalAnswered !== null) {
          answeredCount = Number(d.totalAnswered) || 0;
        } else if (d.TotalAnswered !== undefined && d.TotalAnswered !== null) {
          answeredCount = Number(d.TotalAnswered) || 0;
        }

        // Calculate totalCount accurately
        let totalCount = 0;
        const matchedForm = (forms || []).find(f => f.id === formId || String(f.id) === String(formId));
        if (typeof matchedForm?.itemCount === 'number') {
          totalCount = matchedForm.itemCount;
        } else if (matchedForm?.sections && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
          totalCount = matchedForm.sections.reduce((acc, sec) => acc + (sec.items?.length || 0), 0);
        } else if (d.surveyForm?.sections && Array.isArray(d.surveyForm.sections) && d.surveyForm.sections.length > 0) {
          totalCount = d.surveyForm.sections.reduce((acc, sec) => acc + (sec.items?.length || 0), 0);
        } else if (d.totalQuestions || d.TotalQuestions) {
          totalCount = Number(d.totalQuestions || d.TotalQuestions) || 0;
        }
        
        // Check if this draft's schedule has already been audited or completed
        if (d.auditScheduleId) {
          const schedCompleted = (schedules || []).some(s => Number(s.id) === Number(d.auditScheduleId) && (s.status === 'completed' || s.status === 'done'));
          const alreadyAudited = (auditRecords || []).some(ar => Number(ar.auditScheduleId) === Number(d.auditScheduleId));
          if (schedCompleted || alreadyAudited) return;
        }

        const brandNames = getBrandsForLoc(d.locationId, d.location, activeLocations);

        logs.push({
          id: `draft-${d.id}`,
          originalId: d.id,
          type: 'draft',
          unitName: branchName,
          unitFullName: branchFullName,
          brandNames: brandNames,
          region: d.locationRegion || d.location?.region || "-",
          date: dateFormatted,
          rawDate: rawDate,
          timestamp: timestamp,
          score: null, // '-'
          auditor: auditorVal,
          formName: formVal,
          auditType: (d.auditType === 'unannounced' || d.auditType === 'spot') ? "นอกกำหนดการ" : (d.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
          status: "draft",
          progressText: `ตอบแล้ว ${answeredCount}${totalCount ? `/${totalCount}` : ''} ข้อ`,
          record: {
            ...d,
            id: d.id,
            auditScheduleId: d.auditScheduleId || d.scheduleId || null,
            scheduleId: d.auditScheduleId || d.scheduleId || null,
            locationId: d.locationId,
            surveyFormId: formId,
            unit: d.location || { id: d.locationId, name: branchName, fullName: branchFullName },
            answers: parsedPayload?.answers || d.answers || {},
            photos: parsedPayload?.photos || d.photos || {},
            comments: parsedPayload?.comments || d.comments || {},
            metadataValues: parsedPayload?.metadataValues || d.metadataValues || {},
            staffCount: parsedPayload?.staffCount || d.staffCount || "",
            auditorName: auditorVal,
            auditType: parsedPayload?.auditType || d.auditType || "announced",
            auditeeSignature: parsedPayload?.auditeeSignature || d.auditeeSignature || null,
            auditorSignature: parsedPayload?.auditorSignature || d.auditorSignature || null,
            auditeeSignName: parsedPayload?.auditeeSignName || d.auditeeSignName || "",
            draftPayloadJson: d.draftPayloadJson
          }
        });
      });
    }

    // 3. Schedules
    if (schedules && schedules.length > 0) {
      schedules.forEach((s) => {
        const dateObj = new Date(s.scheduledDate);
        const isCompleted = s.status === 'completed' || s.status === 'done' || s.isCompleted ||
          (auditRecords || []).some(ar => {
            if (ar.auditScheduleId && Number(ar.auditScheduleId) === Number(s.id)) return true;
            if (Number(ar.locationId) === Number(s.locationId)) {
              const ad = new Date(ar.auditDate || ar.submittedAt || ar.createdAt);
              const diffDays = Math.abs((ad.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays <= 2 && (!s.surveyFormId || !ar.surveyFormId || Number(ar.surveyFormId) === Number(s.surveyFormId))) {
                return true;
              }
            }
            return false;
          });
        if (isCompleted) return; // skip completed schedules

        const branchName = s.locationName || s.location?.name || "-";
        const branchFullName = s.locationName || s.location?.fullName || s.location?.name || "-";
        const rawDate = s.scheduledDate || null;
        let dateFormatted = formatThaiAuditDate(rawDate);
        
        // Add time if available
        if (s.scheduledTime || s.time) {
          dateFormatted += ` ${s.scheduledTime || s.time}`;
        }
        
        const timestamp = parseAuditTimestamp(rawDate, s.id) + 2000000000; // prioritize schedules (future)
        const auditorVal = s.auditorName || s.primaryAuditor?.fullName || (s.auditors?.[0]?.fullName) || "-";
        const formId = s.surveyFormId || s.formId || s.surveyForm?.id;
        const directForm = s.surveyFormTitle || s.formTitle || s.surveyForm?.title || s.formName || s.form;
        const formVal = resolveFormTitle(formId, directForm, forms);

        // Check if there is already an active draft for this schedule
        const existingDraft = (activeDrafts || []).find(d => 
          (d.auditScheduleId && Number(d.auditScheduleId) === Number(s.id)) ||
          (d.scheduleId && Number(d.scheduleId) === Number(s.id))
        );
        if (existingDraft) return; // already represented in activeDrafts

        const brandNames = getBrandsForLoc(s.locationId, s.location, activeLocations);

        // If s.status is in_progress (ongoing audit from schedule without a separate draft entry)
        if (s.status === 'in_progress') {
          logs.push({
            id: `schedule-progress-${s.id}`,
            originalId: s.id,
            type: 'draft',
            unitName: branchName,
            unitFullName: branchFullName,
            brandNames: brandNames,
            region: s.locationRegion || s.location?.region || s.region || "-",
            date: dateFormatted,
            rawDate: rawDate,
            timestamp: timestamp,
            score: null,
            auditor: auditorVal,
            formName: formVal,
            auditType: (s.auditType === 'unannounced' || s.auditType === 'spot') ? "นอกกำหนดการ" : (s.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
            status: "draft",
            progressText: "กำลังดำเนินการตรวจ",
            record: {
              ...s,
              id: s.id,
              scheduleId: s.id,
              auditScheduleId: s.id,
              locationId: s.locationId,
              locationName: branchName,
              locationFullName: branchFullName,
              unit: branchName,
              surveyFormId: formId || s.surveyFormId || s.formId,
              surveyFormTitle: formVal,
              formTitle: formVal,
              formName: formVal,
              auditType: s.auditType || "announced",
              auditorName: auditorVal,
              scheduledDate: s.scheduledDate,
              notes: s.notes
            }
          });
          return;
        }

        logs.push({
          id: `schedule-${s.id}`,
          originalId: s.id,
          type: 'schedule',
          unitName: branchName,
          unitFullName: branchFullName,
          brandNames: brandNames,
          region: s.locationRegion || s.location?.region || "-",
          date: dateFormatted, // scheduled date
          rawDate: rawDate,
          timestamp: timestamp,
          score: null,
          auditor: auditorVal,
          formName: formVal,
          auditType: (s.auditType === 'unannounced' || s.auditType === 'spot') ? "นอกกำหนดการ" : (s.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
          status: "pending",
          record: {
            ...s,
            id: s.id,
            locationId: s.locationId,
            locationName: branchName,
            locationFullName: branchFullName,
            unit: branchName,
            surveyFormId: formId || s.surveyFormId || s.formId,
            surveyFormTitle: formVal,
            formTitle: formVal,
            formName: formVal,
            auditType: s.auditType || "announced",
            auditorName: auditorVal,
            scheduledDate: s.scheduledDate
          }
        });
      });
    }

    // If no data, use mocks
    if (logs.length === 0) {
      activeLocations.forEach(u => {
        const uBrandNames = getBrandsForLoc(u.id, u, activeLocations);
        (u.history || []).forEach((h, hIdx) => {
          const timestamp = parseAuditTimestamp(h.date, h.id || hIdx);
          logs.push({
            id: h.id || `hist-${u.id || u.name}-${hIdx}`,
            originalId: h.id || `hist-${u.id || u.name}-${hIdx}`,
            type: 'completed',
            unitName: u.name,
            unitFullName: u.fullName || u.name,
            brandNames: uBrandNames,
            region: u.region || "-",
            date: h.date,
            rawDate: h.date,
            timestamp: timestamp,
            score: h.score,
            auditor: h.auditor || "-",
            formName: h.form || "-",
            auditType: (h.auditType === 'unannounced' || h.auditType === 'spot') ? "นอกกำหนดการ" : (h.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
            status: h.status,
            record: h
          });
        });
      });
    }
    
    return logs;
  }, [auditRecords, activeDrafts, schedules, forms, activeLocations]);

  const baseLogs = useMemo(() => {
    return currentAuditorName ? allLogs.filter((log) => log.auditor.includes(currentAuditorName) || currentAuditorName.includes(log.auditor)) : allLogs;
  }, [allLogs, currentAuditorName]);

  const filteredAndSortedLogs = useMemo(() => {
    // 🌟 โหมดค้นหาเดือน/ปี: ใช้ผลลัพธ์จาก request ตรงไป backend แทน buffer ปกติ
    // และไม่ต้องกรองด้วย searchTerm ซ้ำ เพราะ backend กรองตามช่วงวันที่ให้แล้ว
    let list;
    if (monthQuery) {
      const completedList = [...monthSearchLogs];
      // ค้นหาฉบับร่าง (draft) หรือรายการตามแผน (schedule) ที่อยู่ในช่วงวันที่นี้ด้วย
      const otherLogsInRange = baseLogs.filter(l => {
        if (l.type === 'completed') return false;
        if (!l.rawDate && !l.date) return false;
        const d = new Date(l.rawDate || l.date);
        const logTime = d.getTime();
        if (isNaN(logTime)) return false;
        return logTime >= monthQuery.startDate.getTime() && logTime < monthQuery.endDate.getTime();
      });
      list = [...completedList, ...otherLogsInRange];
    } else {
      list = [...baseLogs];
    }

    if (statusFilter === "completed") {
      list = list.filter(l => l.type === "completed");
    } else if (statusFilter === "draft") {
      list = list.filter(l => l.type === "draft");
    } else if (statusFilter === "pending") {
      list = list.filter(l => l.type === "schedule");
    }

    if (!monthQuery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(l => {
        const isCompleted = l.type === 'completed';
        const isDraft = l.type === 'draft';
        const isPending = l.type === 'schedule';

        const statusKeywords = [];
        if (isCompleted) {
          statusKeywords.push('ตรวจแล้ว', 'completed', 'เสร็จสิ้น', 'pass', 'ผ่าน');
          if (l.status === 'pass' || (l.score !== null && l.score >= 85)) statusKeywords.push('ผ่านเกณฑ์', 'ผ่าน');
          if (l.status === 'fail' || (l.score !== null && l.score < 85)) statusKeywords.push('ไม่ผ่าน', 'ตกเกณฑ์', 'ปรับปรุง', 'fail');
        } else if (isDraft) {
          statusKeywords.push('กำลังตรวจ', 'draft', 'ฉบับร่าง', 'ค้างตรวจ', 'ร่าง');
        } else if (isPending) {
          statusKeywords.push('ยังไม่ตรวจ', 'pending', 'schedule', 'รอดำเนินการ', 'ตามกำหนดการ', 'นัดหมาย');
        }

        const matchStatus = statusKeywords.some(k => k.includes(q) || q.includes(k));

        // ค้นหาปี (ทั้ง ค.ศ. และ พ.ศ.) ใน client buffer เผื่อไว้
        let matchYear = false;
        if (l.rawDate || l.date) {
          const d = new Date(l.rawDate || l.date);
          if (!isNaN(d.getTime())) {
            const rawYearAD = d.getFullYear().toString();
            const rawYearBE = (d.getFullYear() + 543).toString();
            matchYear = rawYearAD.includes(q) || rawYearBE.includes(q);
          }
        }

        return (
          (l.unitName && l.unitName.toLowerCase().includes(q)) ||
          (l.unitFullName && l.unitFullName.toLowerCase().includes(q)) ||
          (l.brandNames && l.brandNames.toLowerCase().includes(q)) ||
          (l.region && l.region.toLowerCase().includes(q)) ||
          (l.date && l.date.toLowerCase().includes(q)) ||
          (l.auditor && l.auditor.toLowerCase().includes(q)) ||
          (l.formName && l.formName.toLowerCase().includes(q)) ||
          (l.auditType && l.auditType.toLowerCase().includes(q)) ||
          (l.progressText && l.progressText.toLowerCase().includes(q)) ||
          matchStatus ||
          matchYear
        );
      });
    }

    if (filterCategory === "passed") {
      list = list.filter(l => l.score >= 85);
    } else if (filterCategory === "improve") {
      list = list.filter(l => l.score < 85);
    } else if (filterCategory === "bkk") {
      list = list.filter(l => (l.region || '').includes("กรุงเทพ"));
    } else if (filterCategory === "north") {
      list = list.filter(l => (l.region || '').includes("เหนือ"));
    } else if (filterCategory === "east") {
      list = list.filter(l => (l.region || '').includes("ตะวันออก") && !(l.region || '').includes("เฉียงเหนือ"));
    } else if (filterCategory === "northeast") {
      list = list.filter(l => (l.region || '').includes("ตะวันออกเฉียงเหนือ") || (l.region || '').includes("อีสาน"));
    } else if (filterCategory === "south") {
      list = list.filter(l => (l.region || '').includes("ใต้"));
    }

    // 🌟 Sorting Logic:
    if (sortBy === "date-desc") {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    } else if (sortBy === "date-asc") {
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || (a.id || 0) - (b.id || 0));
    } else if (sortBy === "branch-asc" || sortBy === "branch") {
      list.sort((a, b) => (a.unitName || "").localeCompare(b.unitName || "", "th"));
    } else if (sortBy === "branch-desc") {
      list.sort((a, b) => (b.unitName || "").localeCompare(a.unitName || "", "th"));
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [baseLogs, monthQuery, monthSearchLogs, searchTerm, filterCategory, statusFilter, sortBy]);

  // 🌟 Map branches list with real last score, date, and complete history across all rounds
  const allBranches = useMemo(() => {
    return activeLocations.map(u => {
      // Filter ALL audit records for this branch from live database
      const branchAudits = (auditRecords || []).filter(r => 
        (r.locationId && r.locationId === u.id) || 
        (r.locationName && (r.locationName === u.name || r.locationName === u.fullName)) ||
        (r.location?.name && (r.location.name === u.name || r.location.name === u.fullName))
      );

      const mappedHistory = branchAudits.map(r => {
        const score = Math.round(r.percentageScore || 0);
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = formatThaiAuditDate(rawDate);
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";
        return {
          id: r.id,
          date: dateFormatted,
          auditDate: rawDate,
          score: score,
          percentageScore: score,
          auditor: auditorVal,
          auditorName: auditorVal,
          form: formVal,
          formName: formVal,
          auditType: r.auditType === 'followup' ? "ตรวจติดตามผล (Follow-up)" : "ตรวจมาตรฐานรอบปกติ (Announced)",
          status: r.isPassed ? "pass" : "fail",
          isPassed: r.isPassed,
          hasCriticalDefect: r.hasCriticalDefect,
          ...r
        };
      });

      const finalHistory = mappedHistory.length > 0 ? mappedHistory : (u.history || []);
      const lastAudit = mappedHistory[0] || (u.history && u.history[0]) || null;
      const rawDate = lastAudit?.auditDate || lastAudit?.date || u.lastAuditDate || null;
      const timestamp = parseAuditTimestamp(rawDate, u.id);
      const lastScore = lastAudit ? lastAudit.score : (u.lastScore !== undefined ? u.lastScore : 0);
      const dateFormatted = rawDate ? (lastAudit?.date || formatThaiAuditDate(rawDate)) : "-";
      const locTypeName = u.locationType?.name || (typeof u.locationType === 'string' ? u.locationType : null) || u.type || "-";

      return {
        ...u,
        id: u.id,
        name: u.name,
        fullName: u.fullName || u.name,
        code: u.code,
        region: u.region || "-",
        address: u.address || "-",
        phone: u.phone || "-",
        locationType: locTypeName,
        lastScore: lastScore,
        score: lastScore,
        lastAuditDate: rawDate,
        dateFormatted: dateFormatted,
        timestamp: timestamp,
        history: finalHistory,
        latestRecord: lastAudit,
        rawLocation: u
      };
    });
  }, [activeLocations, auditRecords]);

  const filteredAndSortedBranches = useMemo(() => {
    let list = [...allBranches];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(l => {
        let matchYear = false;
        if (l.lastAuditDate) {
          const d = new Date(l.lastAuditDate);
          if (!isNaN(d.getTime())) {
            const rawYearAD = d.getFullYear().toString();
            const rawYearBE = (d.getFullYear() + 543).toString();
            matchYear = rawYearAD.includes(q) || rawYearBE.includes(q);
          }
        }
        return (
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.fullName && l.fullName.toLowerCase().includes(q)) ||
          (l.code && l.code.toLowerCase().includes(q)) ||
          (l.region && l.region.toLowerCase().includes(q)) ||
          (l.locationType && l.locationType.toLowerCase().includes(q)) ||
          (l.dateFormatted && l.dateFormatted.toLowerCase().includes(q)) ||
          (l.locationBrands || l.rawLocation?.locationBrands || []).some(lb =>
            (lb.brand?.name || lb.brandName || "").toLowerCase().includes(q) ||
            (lb.brand?.code || lb.brandCode || "").toLowerCase().includes(q)
          ) ||
          (l.brand?.name || l.brandName || l.rawLocation?.brand?.name || "").toLowerCase().includes(q) ||
          matchYear
        );
      });
    }

    if (filterCategory === "passed") {
      list = list.filter(l => l.lastScore >= 85);
    } else if (filterCategory === "improve") {
      list = list.filter(l => l.lastScore < 85);
    } else if (filterCategory === "bkk") {
      list = list.filter(l => (l.region || '').includes("กรุงเทพ"));
    } else if (filterCategory === "north") {
      list = list.filter(l => (l.region || '').includes("เหนือ"));
    } else if (filterCategory === "east") {
      list = list.filter(l => (l.region || '').includes("ตะวันออก") && !(l.region || '').includes("เฉียงเหนือ"));
    } else if (filterCategory === "northeast") {
      list = list.filter(l => (l.region || '').includes("ตะวันออกเฉียงเหนือ") || (l.region || '').includes("อีสาน"));
    } else if (filterCategory === "south") {
      list = list.filter(l => (l.region || '').includes("ใต้"));
    }

    // 🌟 Sorting for branches:
    if (sortBy === "date-desc") {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    } else if (sortBy === "date-asc") {
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || (a.id || 0) - (b.id || 0));
    } else if (sortBy === "branch-asc" || sortBy === "branch") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    } else if (sortBy === "branch-desc") {
      list.sort((a, b) => (b.name || "").localeCompare(a.name || "", "th"));
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0));
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => (a.lastScore || 0) - (b.lastScore || 0));
    } else {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [allBranches, searchTerm, filterCategory, sortBy]);

  // Pagination calculation
  const activeList = filteredAndSortedLogs;
  const totalCount = activeList.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, startIndex + pageSize);
  const startItem = totalCount === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalCount);

  // 🌟 โหลดเพิ่มเมื่อเลื่อน/พลิกหน้าใกล้ขอบข้อมูลที่โหลดไว้ใน buffer (lazy load)
  // ใช้เฉพาะตอน browse ดูรายการที่รวมผลตรวจแล้ว (all หรือ completed)
  // ไม่โหลดเมื่อกรองดูเฉพาะ "กำลังตรวจ (draft)" หรือ "ยังไม่ตรวจ (pending)" เพื่อป้องกันลูปดึงข้อมูลไม่รู้จบ
  useEffect(() => {
    if (monthQuery) return;
    if (isLoadingAuditRecords) return;
    if (statusFilter === "draft" || statusFilter === "pending") return;
    if (auditRecords.length >= auditRecordsTotalCount) return;

    // คำนวณหน้าของ completed records ใน buffer โดยตรง
    const completedBufferPages = Math.ceil(auditRecords.length / pageSize) || 1;
    const nearEdge = completedBufferPages - currentPage <= 2;
    if (nearEdge) {
      loadMoreAuditRecords(false);
    }
  }, [currentPage, statusFilter, pageSize, monthQuery, auditRecords.length, auditRecordsTotalCount, isLoadingAuditRecords, loadMoreAuditRecords]);

  // Submit typed page number only on Enter or Blur
  const handlePageSubmit = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val)) {
      const targetPage = Math.max(1, Math.min(totalPages, val));
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleTriggerResume = (record) => {
  setActiveDirectPlan({ ...record, isResume: true });
};

const handleTriggerAudit = (record) => {
  setActiveDirectPlan(record);
};

  if (activeDirectPlan) {
    return (
      <LiveAuditScreen
        preselectedPlan={activeDirectPlan}
        onClearPlan={() => {
          if (refreshData) refreshData();
          setActiveDirectPlan(null);
        }}
        onBack={() => {
          if (refreshData) refreshData();
          setActiveDirectPlan(null);
        }}
        onCompleteAudit={() => {
          if (refreshData) refreshData();
          setActiveDirectPlan(null);
        }}
      />
    );
  }

  if (selectedBranch) {
    return (
      <BranchProfile
        unit={selectedBranch}
        onBack={() => setSelectedBranch(null)}
      />
    );
  }

  if (selectedAuditLog) {
    return (
      <AuditHistoryDetail
        unitName={selectedAuditLog.unitName}
        record={selectedAuditLog.record}
        onBack={() => setSelectedAuditLog(null)}
      />
    );
  }

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-28 lg:pb-12 font-sans">

      {onBack ? (
        <Header
          title={title}
          subtitle={`${currentAuditorName ? `ประวัติที่ ${currentAuditorName} ตรวจ · ` : ""}บันทึกผลการตรวจทั้งหมด ${baseLogs.length}`}
          onBack={onBack}
          isAudit={true}
          action={
            <div className="flex items-center gap-2">
              {onStartNewAudit && (
                <button
                  type="button"
                  onClick={onStartNewAudit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F6659] text-white rounded-2xl text-xs font-bold hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer active:scale-95"
                >
                  <Plus size={14} />
                  <span>ตรวจงานใหม่</span>
                </button>
              )}
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-between pb-1 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">{title}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {`${currentAuditorName ? `ประวัติที่ ${currentAuditorName} ตรวจ · ` : ""}บันทึกผลการตรวจทั้งหมด ${baseLogs.length} รอบตรวจ`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onStartNewAudit && (
              <button
                type="button"
                onClick={onStartNewAudit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F6659] text-white rounded-2xl text-xs font-bold hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>ตรวจงานใหม่</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 🌟 1. UNIFIED DASHBOARD SUMMARY HERO CARDS (ตรงตามหน้า Dashboard เป๊ะๆ) ── */}
      <div className="space-y-2.5">
        {/* 📱 Card 1 (บน): วงแหวนคะแนนซ้าย + ข้อความสรุปขวา */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <ScoreRing score={avgScore} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-slate-400">คะแนนเฉลี่ยภาพรวม</span>
              <span className="text-xs font-black text-slate-900 font-mono">{avgScore}%</span>
            </div>
            {totalBranches === 0 ? (
              <div className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                ยังไม่มีข้อมูลสาขา
              </div>
            ) : auditedCount === 0 ? (
              <div className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                ยังไม่มีการตรวจประเมิน (0 จาก {totalBranches} สาขา)
              </div>
            ) : avgScore >= 85 ? (
              <div className="text-xs font-bold text-emerald-800 mt-0.5 truncate">
                ✓ ผ่านเกณฑ์มาตรฐาน ({passedCount} จาก {totalBranches} สาขา)
              </div>
            ) : (
              <div className="text-xs font-bold text-rose-600 mt-0.5 truncate">
                ✕ ไม่ผ่านเกณฑ์มาตรฐาน ({passedCount} จาก {totalBranches} สาขา)
              </div>
            )}
          </div>
        </div>

        {/* 📱 Card 2 (ล่าง): ไอคอนสถิติตรวจแล้ว & งานค้าง CAP */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] border border-emerald-200 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} />
          </div>
          <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] font-bold text-slate-400">ตรวจแล้ว</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 font-mono">
                {auditedCount} รายการ
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400">งานค้างส่ง CAP</div>
              <div className="text-xs sm:text-sm font-extrabold text-rose-700 mt-0.5 font-mono">
                {pendingCapCount} รายการ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 🌟 2. SEARCH & ACTION CONTROLS (สไตล์เดียวกับหน้าจัดการฟอร์ม) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, แบรนด์, วันที่, ผู้ตรวจ, สถานะ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-medium text-slate-800 focus:border-[#0F6659] transition-colors placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-md transition-colors"
              title="ล้างข้อความค้นหา"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2">
          {/* สาขา Dropdown Filter */}
          <div className="relative flex-1 sm:flex-initial flex items-center">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F6659] pointer-events-none" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-auto text-xs sm:text-sm font-semibold pl-8 pr-8 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none text-slate-700 hover:border-slate-300 focus:border-[#0F6659] transition-all cursor-pointer appearance-none"
            >
              <option value="all">ทุกสาขา</option>
              <option value="passed">ผ่านเกณฑ์ (≥85%)</option>
              <option value="improve">ต้องปรับปรุง (&lt;85%)</option>
              <option value="bkk">เขตกรุงเทพฯ</option>
              <option value="north">เขตภาคเหนือ</option>
              <option value="east">เขตภาคตะวันออก</option>
              <option value="northeast">เขตภาคอีสาน</option>
              <option value="south">เขตภาคใต้</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Excel Export Button */}
          <button
            type="button"
            onClick={() => {
              if (onExportExcel) {
                onExportExcel();
              } else {
                setShowExportModal(true);
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-[#0F6659] hover:bg-emerald-50 text-xs font-bold text-slate-700 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
            title="ส่งออกรายงานเป็น Excel"
          >
            <Download size={13} className="text-[#0F6659]" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* ตรวจงานใหม่ Button */}
          <button
            type="button"
            onClick={() => {
              if (onStartNewAudit) {
                onStartNewAudit();
              } else {
                handleTriggerAudit({ isNewAudit: true });
              }
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Plus size={15} />
            <span>ตรวจงานใหม่</span>
          </button>
        </div>
      </div>

      {/* 🌟 Chip แสดงโหมดค้นหาเดือน/ปี (แยกเป็นแถวอิสระตรงกลาง ไม่เบียดกับฟีลเตอร์สถานะ) */}
      {monthQuery && (
        <div className="flex items-center gap-2 px-1 animate-in fade-in duration-200">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F6659]/10 text-[#0F6659] text-xs font-bold border border-[#0F6659]/20 shadow-2xs">
            <CalendarDays size={13} className="text-[#0F6659]" />
            <span>{isMonthSearching ? "กำลังค้นหา..." : `กรอง: ${monthQuery.label}`}</span>
          </span>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer transition-colors"
          >
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {/* ── 🌟 3. STATUS FILTER PILLS (เม็ดแคปซูลแบบเดียวกับหน้าจัดการฟอร์ม) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-tab-scrollbar pb-0.5">
        {[
          { key: "all", label: "ทั้งหมด (All)" },
          { key: "completed", label: "ตรวจแล้ว" },
          { key: "draft", label: "กำลังตรวจ" },
          { key: "pending", label: "ยังไม่ตรวจ" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95 ${
              statusFilter === key
                ? "bg-[#0F6659] text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 🌟 4. AUDIT LIST / TABLE SECTION ── */}
      {/* 📱 1. Mobile View (<768px): การ์ดเดี่ยวๆ ลอยบนพื้นหลัง สไตล์เดียวกับ FormsScreen */}
      <div className="block md:hidden space-y-3">
        {paginatedLogs.map((log, idx) => {
          const isPassed = log.score >= 85;
          const isCritical = log.score < 70;

          let circleColor = "border-slate-200 text-slate-400 bg-slate-50";
          let scoreDisplay = "-";
          let statusBadge = "bg-slate-100 text-slate-800";
          let statusText = "-";

          if (log.type === 'completed') {
            circleColor = isCritical
              ? "border-rose-600 text-rose-700 bg-white"
              : isPassed
              ? "border-emerald-600 text-emerald-800 bg-white"
              : "border-amber-600 text-amber-800 bg-white";
            
            scoreDisplay = log.score;
            
            statusBadge = isCritical
              ? "bg-rose-100 text-rose-800"
              : isPassed
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900";
            
            statusText = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";
          } else if (log.type === 'draft') {
            circleColor = "border-slate-200 text-slate-400 bg-slate-50";
            scoreDisplay = "-";
            statusBadge = "bg-amber-100 text-amber-800 border border-amber-200";
            statusText = "กำลังตรวจ";
          } else if (log.type === 'schedule') {
            circleColor = "border-slate-200 text-slate-400 bg-slate-50";
            scoreDisplay = "-";
            statusBadge = "bg-slate-100 text-slate-600 border border-slate-200";
            statusText = "ยังไม่ตรวจ";
          }

          return (
            <div
              key={log.id || idx}
              onClick={() => {
                if (log.type === 'completed') {
                  if (onSelectLog) {
                    onSelectLog({ unitName: log.unitFullName, record: log.record });
                  } else {
                    setSelectedAuditLog({ unitName: log.unitFullName, record: log.record });
                  }
                } else if (log.type === 'draft') {
                  handleTriggerResume(log.record);
                } else if (log.type === 'schedule') {
                  handleTriggerAudit(log.record);
                }
              }}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-[#0F6659] active:scale-[0.99] transition-all cursor-pointer space-y-2.5 group"
            >
              {/* บรรทัดที่ 1: วงกลมคะแนน (ซ้าย) + ป้ายสถานะ (ขวา) */}
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs font-mono shadow-2xs shrink-0 ${circleColor}`}>
                  {scoreDisplay}
                </div>
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${statusBadge}`}>
                  {statusText}
                </span>
              </div>

              {/* บรรทัดที่ 2: ชื่อสาขา (ตัวหนา) + แบบฟอร์มการตรวจ & เขต */}
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 leading-snug break-words group-hover:text-[#0F6659] transition-colors">
                  {log.unitName}
                </h3>
                {log.formName && (
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {log.formName}
                    {log.auditType && (
                      <span className="text-slate-400 font-normal text-[11px] ml-1">
                        ({log.auditType})
                      </span>
                    )}
                  </p>
                )}
                {log.region && log.region !== '-' && (
                  <p className="text-[11px] text-slate-400 font-normal truncate">
                    {log.region}
                  </p>
                )}
              </div>

              {/* บรรทัดที่ 3: สถานะคืบหน้า (ถ้ามี) + วันที่ / ผู้ตรวจ */}
              <div className="space-y-1 text-xs">
                {log.type === 'draft' && log.progressText && (
                  <div className="text-xs text-amber-600 font-bold">
                    {log.progressText}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-slate-400 font-normal">
                  <Calendar size={12} className="text-slate-400 shrink-0" />
                  <span>{log.date}</span>
                  {log.auditor && log.auditor !== '-' && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">{log.auditor}</span>
                    </>
                  )}
                </div>
              </div>

              {/* บรรทัดที่ 4: ลิงก์ Action ตัวเล็ก ไม่แย่งสายตา */}
              <div className="pt-2 border-t border-slate-100/80 flex items-center justify-end">
                <span className="text-xs text-slate-400 group-hover:text-[#0F6659] font-medium flex items-center gap-0.5 transition-colors">
                  <span>
                    {log.type === 'completed'
                      ? 'ดูรายงาน'
                      : log.type === 'draft'
                      ? 'ตรวจต่อ'
                      : 'เริ่มตรวจ'}
                  </span>
                  <ChevronRight size={13} />
                </span>
              </div>
            </div>
          );
        })}

        {filteredAndSortedLogs.length === 0 && (
          <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white rounded-2xl border border-slate-200 shadow-2xs">
            ไม่พบข้อมูลผลการตรวจที่ตรงกับคำค้นหา
          </div>
        )}

        {/* 📱 Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs text-xs font-medium text-slate-500">
            <span>หน้า {currentPage} / {totalPages} ({totalCount} รายการ)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              >
                ก่อนหน้า
              </button>
              <input
                type="number"
                min="1"
                max={totalPages}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 💻 2. Tablet & Desktop View (>=768px): ตารางเต็มรูปแบบใน Card สวยงาม */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto custom-tab-scrollbar">
          <table className="w-full text-left border-collapse min-w-full lg:min-w-[1100px] table-fixed">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#FAF9F5] text-slate-700 text-xs font-bold select-none">
                <th className="py-3 px-4 w-[42%] lg:w-[25%]">
                  <button 
                    type="button" 
                    onClick={() => setSortBy(prev => prev === 'branch-asc' ? 'branch-desc' : 'branch-asc')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      sortBy.startsWith('branch') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                    }`}
                    title="เรียงตามชื่อสาขา (ก-ฮ / ฮ-ก)"
                  >
                    <span className="truncate">รอบตรวจ & สาขา</span>
                    {sortBy === 'branch-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲ ก-ฮ</span>}
                    {sortBy === 'branch-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼ ฮ-ก</span>}
                    {!sortBy.startsWith('branch') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                  </button>
                </th>
                <th className="py-3 px-2 w-[14%] lg:w-[8%] text-center">
                  <button
                    type="button"
                    onClick={() => setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border shadow-2xs text-xs font-bold transition-all cursor-pointer ${
                      sortBy.startsWith('score')
                        ? 'bg-emerald-50 border-emerald-400 text-[#0F6659] font-black ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#0F6659] hover:text-[#0F6659]'
                    }`}
                    title="เรียงตามคะแนน (มากไปน้อย / น้อยไปมาก)"
                  >
                    <span>คะแนน</span>
                    {sortBy === 'score-desc' && <span className="text-[10px] text-[#0F6659] font-black">▼</span>}
                    {sortBy === 'score-asc' && <span className="text-[10px] text-[#0F6659] font-black">▲</span>}
                    {!sortBy.startsWith('score') && <ArrowUpDown size={11} className="text-slate-400" />}
                  </button>
                </th>
                <th className="hidden lg:table-cell py-3 px-4 w-[20%]">
                  <span className="truncate">แบบฟอร์มการตรวจ</span>
                </th>
                <th className="py-3 px-4 w-[30%] lg:w-[21%]">
                  <button 
                    type="button" 
                    onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      sortBy.startsWith('date') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                    }`}
                    title="เรียงตามวันที่ตรวจ (ล่าสุด / เก่าสุด)"
                  >
                    <span className="truncate">วันที่ตรวจ</span>
                    {sortBy === 'date-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼</span>}
                    {sortBy === 'date-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲</span>}
                    {!sortBy.startsWith('date') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                  </button>
                </th>
                <th className="hidden lg:table-cell py-3 px-4 w-[16%]">
                  <span className="truncate">ผู้ตรวจประเมิน</span>
                </th>
                <th className="py-3 px-4 w-[14%] lg:w-[10%] text-center">
                  <span className="truncate">สถานะ</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedLogs.map((log, idx) => {
                const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                const isPassed = log.score >= 85;
                const isCritical = log.score < 70;

                let circleColor = "border-slate-200 text-slate-400 bg-slate-50";
                let scoreDisplay = "-";
                let scorePill = "bg-slate-50 text-slate-500 border border-slate-200/60";
                let statusBadge = "bg-slate-100 text-slate-800";
                let statusText = "-";

                if (log.type === 'completed') {
                  circleColor = isCritical
                    ? "border-rose-600 text-rose-700 bg-white"
                    : isPassed
                    ? "border-emerald-600 text-emerald-800 bg-white"
                    : "border-amber-600 text-amber-800 bg-white";
                  
                  scoreDisplay = log.score;
                  
                  scorePill = isCritical
                    ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                    : isPassed
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : "bg-amber-50 text-amber-700 border border-amber-200/60";
                  
                  statusBadge = isCritical
                    ? "bg-rose-100 text-rose-800"
                    : isPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900";
                  
                  statusText = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";
                } else if (log.type === 'draft') {
                  statusBadge = "bg-amber-100 text-amber-800 border border-amber-200";
                  statusText = "กำลังตรวจ";
                } else if (log.type === 'schedule') {
                  statusBadge = "bg-slate-100 text-slate-600 border border-slate-200";
                  statusText = "ยังไม่ตรวจ";
                }

                return (
                  <tr
                    key={log.id || idx}
                    onClick={() => {
                      if (log.type === 'completed') {
                        if (onSelectLog) {
                          onSelectLog({ unitName: log.unitFullName, record: log.record });
                        } else {
                          setSelectedAuditLog({ unitName: log.unitFullName, record: log.record });
                        }
                      } else if (log.type === 'draft') {
                        handleTriggerResume(log.record);
                      } else if (log.type === 'schedule') {
                        handleTriggerAudit(log.record);
                      }
                    }}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* 1. รอบตรวจ & สาขา */}
                    <td className="py-3.5 px-4 overflow-hidden">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0 font-mono">
                          {rowNumber}
                        </span>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-2xs ${circleColor}`}>
                          {scoreDisplay}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate" title={log.unitName}>
                            {log.unitName}
                          </div>
                          <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={log.region}>
                            {log.region}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. คะแนน */}
                    <td className="py-3.5 px-2 text-center overflow-hidden">
                      {log.type === 'completed' ? (
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold font-mono ${scorePill}`}>
                          {log.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>

                    {/* 3. แบบฟอร์มการตรวจ (ซ่อนบนแท็บเล็ต) */}
                    <td className="hidden lg:table-cell py-3.5 px-4 overflow-hidden">
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate" title={log.formName}>
                          {log.formName}
                        </div>
                        <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={log.auditType}>
                          {log.auditType}
                        </div>
                      </div>
                    </td>

                    {/* 4. วันที่ตรวจ */}
                    <td className="py-3.5 px-4 text-xs sm:text-sm font-normal text-slate-700 overflow-hidden">
                      <div className="whitespace-nowrap font-medium text-slate-800" title={log.date}>
                        {log.date}
                      </div>
                      {log.type === 'draft' && log.progressText && (
                        <div className="text-[10px] text-amber-600 font-semibold mt-0.5 whitespace-nowrap">
                          {log.progressText}
                        </div>
                      )}
                    </td>

                    {/* 5. ผู้ตรวจประเมิน (ซ่อนบนแท็บเล็ต) */}
                    <td className="hidden lg:table-cell py-3.5 px-4 text-xs sm:text-sm font-normal text-slate-700 overflow-hidden">
                      <div className="truncate" title={log.auditor}>
                        {log.auditor}
                      </div>
                    </td>

                    {/* 6. สถานะ */}
                    <td className="py-3.5 px-4 text-center overflow-hidden">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${statusBadge}`}>
                          {statusText}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredAndSortedLogs.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white">
              ไม่พบข้อมูลผลการตรวจที่ตรงกับคำค้นหา
            </div>
          )}
        </div>

        {/* 💻 Desktop Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs font-medium text-slate-500 bg-white">
            <span>หน้า {currentPage} จาก {totalPages} ({totalCount} รายการ)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              >
                ก่อนหน้า
              </button>
              
              {/* ช่องเล็กสำหรับพิมพ์เลขหน้า (กด Enter หรือคลิกออกนอกช่องเพื่อเปลี่ยนหน้า) */}
              <input
                type="number"
                min="1"
                max={totalPages}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <ExcelExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}

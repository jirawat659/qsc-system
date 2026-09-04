import React, { useState, useEffect, useMemo } from "react";
import { CalendarDays, Clock, FileText, Play, Plus, ArrowRight, Navigation, ExternalLink } from "lucide-react";
import { DataContext } from "../../context/DataContext";
import { getDistanceInMeters, formatDistance, DEFAULT_USER_COORDS } from "../../utils/geo";

export default function AssignedAuditPlanScreen({ auditorName, onStart, activeDraft: propDraft, onResumeDraft }) {
  const { schedules, locations: allLocations, activeDraft: ctxDraft, activeDrafts, refreshData } = React.useContext(DataContext);
  const activeDraft = propDraft || ctxDraft;
  const [userCoords, setUserCoords] = useState(DEFAULT_USER_COORDS);

  // 📍 Sync with latest database AuditDrafts on mount
  useEffect(() => {
    if (refreshData) {
      refreshData();
    }
  }, []);

  // 📍 GPS location tracking on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // Filter plans assigned to this auditor & Sort by distance from nearest to farthest (น้อยไปมาก)
  const plans = useMemo(() => {
    if (!schedules || schedules.length === 0) return [];

    const allDrafts = activeDrafts && activeDrafts.length > 0 ? activeDrafts : (activeDraft ? [activeDraft] : []);

    // 1. Filter by auditor & exclude completed/already audited plans
    const filtered = schedules.filter(plan => {
      const st = (plan.status || "").toLowerCase();
      if (st === "completed" || st === "เสร็จสิ้น" || st === "ตรวจแล้ว" || plan.isCompleted) {
        return false;
      }
      if (!auditorName) return true;
      const target = auditorName.toLowerCase();
      const audName = (plan.auditorName || plan.auditor || "").toLowerCase();
      const leadName = (plan.auditors?.[0]?.fullName || "").toLowerCase();
      const creatorName = (plan.creatorName || "").toLowerCase();
      return (
        audName.includes(target) ||
        target.includes(audName) ||
        leadName.includes(target) ||
        target.includes(leadName) ||
        creatorName.includes(target) ||
        (plan.auditors && plan.auditors.some(a => a.fullName && (a.fullName.toLowerCase().includes(target) || target.includes(a.fullName.toLowerCase()))))
      );
    });

    // 2. Attach location & distance to each plan, and check specific matching draft per plan
    const withDistance = filtered.map(plan => {
      const loc = allLocations.find(l => 
        l.id === plan.locationId || 
        l.name === plan.locationName || 
        l.name === plan.unit || 
        (l.fullName && (l.fullName === plan.locationFullName || l.fullName.includes(plan.locationName || plan.unit)))
      );

      const lat = loc?.latitude || (plan.latitude || 13.7460);
      const lng = loc?.longitude || (plan.longitude || 100.5340);
      const distance = getDistanceInMeters(userCoords.latitude, userCoords.longitude, lat, lng);

      const matchedDraft = allDrafts.find(d => 
        (plan.locationId && (d.locationId === plan.locationId || d.location?.id === plan.locationId || d.unit?.id === plan.locationId)) ||
        (plan.locationName && (d.locationName === plan.locationName || d.unit?.name === plan.locationName || (d.locationFullName && d.locationFullName.includes(plan.locationName)))) ||
        (plan.unit && (d.locationName === plan.unit || d.unit?.name === plan.unit || (d.locationFullName && d.locationFullName.includes(plan.unit))))
      );

      return {
        ...plan,
        matchedLocation: loc,
        targetLat: lat,
        targetLng: lng,
        distanceMeters: distance,
        isPlanInDraft: Boolean(matchedDraft),
        matchedDraft
      };
    });

    // 🌟 Sort: แผนที่มีการตรวจค้างอยู่ (Draft) ขึ้นบนสุดก่อนเสมอ ➔ ตามด้วยระยะทาง GPS จากใกล้ไปไกล
    return withDistance.sort((a, b) => {
      const aDraft = a.isPlanInDraft ? 0 : 1;
      const bDraft = b.isPlanInDraft ? 0 : 1;
      if (aDraft !== bDraft) return aDraft - bDraft;
      return a.distanceMeters - b.distanceMeters;
    });
  }, [schedules, auditorName, allLocations, userCoords, activeDrafts, activeDraft]);

  const getAuditTypeMeta = (type) => {
    const t = (type || "").toLowerCase();
    if (t === "spot" || t === "unannounced") return { label: "นอกกำหนดการ", badge: "bg-amber-50 text-amber-900 border-amber-200" };
    if (t === "undercover") return { label: "ปลอมตัว", badge: "bg-purple-50 text-purple-900 border-purple-200" };
    return { label: "ตามกำหนดการ", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  };

  return (
    <div className="page-transition p-3.5 sm:p-5 space-y-3 w-full max-w-xl mx-auto pb-20">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2.5">
        <div>
          <div className="text-xs font-bold text-[#0F6659] flex items-center gap-1.5">
            <CalendarDays size={14} />
            <span>แผนงานตรวจที่ได้รับมอบหมาย</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-1 leading-snug">
            ตารางงานของ {auditorName || "ผู้ตรวจประเมิน"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            รายการที่ต้องตรวจประเมิน <span className="font-bold text-[#0F6659]">{plans.length}</span> รายการ
          </p>
        </div>

        {/* Full-width pill button placed at the bottom inside the top card */}
        <button
          type="button"
          onClick={() => onStart({ isNewAudit: true })}
          className="w-full py-2.5 px-4 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200/90 text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99] mt-1"
        >
          <Plus size={16} />
          <span>ตรวจงานใหม่</span>
        </button>
      </div>

      {/* 📋 Assigned Plans List */}
      <div className="space-y-3">
        {plans.map((plan) => {
          const isThisPlanInDraft = plan.isPlanInDraft;

          const branchName = plan.locationFullName || plan.locationName || plan.unitFullName || plan.unit || "สาขาเป้าหมาย";
          const formTitle = plan.surveyFormTitle || plan.formTitle || plan.form || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Checklist)";
          
          let dateStr = "";
          if (plan.scheduledDate) {
            const d = new Date(plan.scheduledDate);
            if (!isNaN(d.getTime())) {
              dateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
            }
          }
          if (!dateStr) {
            dateStr = plan.date || (plan.day ? `${plan.day} ส.ค. 2569` : "27 ส.ค. 2569");
          }

          const timeStr = plan.time || "10:00 - 12:00 น.";
          const typeMeta = getAuditTypeMeta(plan.auditType);
          const isCompleted = plan.status === "completed" || plan.status === "done";

          return (
            <div
              key={plan.id || `${plan.day}-${branchName}`}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5 shadow-2xs ${
                isThisPlanInDraft
                  ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                  : isCompleted
                  ? 'bg-slate-50/60 border-slate-200 opacity-80'
                  : 'bg-white border-slate-200/80 hover:border-emerald-500 hover:shadow-xs'
              }`}
            >
              {/* Header: Badges & Status */}
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${typeMeta.badge}`}>
                  {typeMeta.label}
                </span>

                <div className="shrink-0">
                  {isThisPlanInDraft ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                      🟡 กำลังดำเนินการตรวจ
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                      ✓ ตรวจเสร็จแล้ว
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Clock size={11} />
                      <span>รอนัดตรวจ</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Main Info: Branch & Form */}
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">
                  {branchName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal mt-0.5">
                  <FileText size={13} className="text-[#0F6659] shrink-0" />
                  <span className="truncate">{formTitle}</span>
                </div>
              </div>

              {/* Date & Time Box + Distance & Google Maps Navigation */}
              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2.5">
                <div className="space-y-1.5 text-xs text-slate-600 font-medium min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <CalendarDays size={13} className="text-[#0F6659] shrink-0" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Clock size={13} className="text-amber-600 shrink-0" />
                    <span>{timeStr}</span>
                  </div>
                </div>

                {/* GPS Distance & Google Maps Navigation Button (แนวยาว) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${plan.targetLat},${plan.targetLng}`;
                    window.open(mapUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-[#0F6659] border border-emerald-200/90 shadow-2xs hover:border-[#0F6659] active:scale-95 cursor-pointer transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 group"
                  title="เปิด Google Maps เพื่อดูเส้นทางและระยะทาง"
                >
                  <Navigation size={13} className="text-[#0F6659] fill-[#0F6659]/20 group-hover:rotate-12 transition-transform shrink-0" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F6659] whitespace-nowrap">
                    {formatDistance(plan.distanceMeters)}
                  </span>
                  <span className="text-slate-300 font-light hidden sm:inline">|</span>
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-700 flex items-center gap-0.5 whitespace-nowrap">
                    <span>นำทาง</span>
                    <ExternalLink size={10} />
                  </span>
                </button>
              </div>

              {plan.notes && (
                <div className="text-[11px] sm:text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50 leading-relaxed">
                  <span className="font-bold text-amber-900">หมายเหตุ: </span>
                  {plan.notes}
                </div>
              )}

              {/* Action Button */}
              <div className="pt-0.5">
                {isThisPlanInDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      const resumeData = { ...plan, ...(plan.matchedDraft || {}), id: plan.id, auditScheduleId: plan.id, isResume: true };
                      if (onResumeDraft) {
                        onResumeDraft(resumeData);
                      } else {
                        onStart(resumeData);
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>ดำเนินการตรวจต่อ (เปิดฉบับร่าง)</span>
                    <ArrowRight size={14} />
                  </button>
                ) : isCompleted ? (
                  <div className="text-center py-1.5 text-xs font-semibold text-slate-400">
                    ตรวจสาขานี้เรียบร้อยแล้ว
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStart({ ...plan, isResume: false, isNewAudit: false })}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0F6659] hover:bg-[#0c5248] text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>เริ่มตรวจตามแผนงาน</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {plans.length === 0 && (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 bg-white space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CalendarDays size={22} />
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-700">ยังไม่มีแผนตรวจที่ได้รับมอบหมายในขณะนี้</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              คุณสามารถกดปุ่ม "ตรวจงานใหม่" ด้านบน เพื่อเลือกสาขาและเริ่มทำการตรวจประเมินได้ทันที
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

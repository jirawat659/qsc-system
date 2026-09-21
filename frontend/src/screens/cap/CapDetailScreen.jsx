import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  MessageSquare, Camera, Send, X, AlertTriangle, Info, CheckCircle2, 
  Sparkles, FileText, Loader2, RotateCcw, Image, Check, Plus, AlertCircle 
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { CAP_STATUS_MAP, getCategoryDisplay } from "../../config/constants";
import Header from "../../shared/Header";
import ModalWrapper from "../../shared/ModalWrapper";
import api, { getFullImageUrl } from "../../config/api";
import { compressImageFile, validateImageFile } from "../../utils/imageCompressor";
import AiCapAdvisorModal from "../../modals/AiCapAdvisorModal";
import signalrService from "../../services/signalrService";

// 🇹🇭 Helper to correctly parse UTC timestamps into Thailand Local Time (UTC+7)
const formatThaiTime = (dateInput) => {
  if (!dateInput) return "เมื่อสักครู่";
  try {
    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string') {
      let s = dateInput.trim();
      if (!s.endsWith('Z') && !s.includes('+') && !/[-+]\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
      }
      d = new Date(s);
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return "เมื่อสักครู่";
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + " น.";
  } catch (e) {
    return "เมื่อสักครู่";
  }
};

export default function CapDetailScreen({ item, onBack, role = "STANDARD", currentUser, refreshData }) {
  const [reply, setReply] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [capDetail, setCapDetail] = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, title: '', message: '' });
  const [showAiCapModal, setShowAiCapModal] = useState(false);

  // 🌟 Approval Request & Rejection Modals State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitPhotos, setSubmitPhotos] = useState([]);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const submitFileInputRef = useRef(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);
  
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const loadCapDetail = async () => {
    try {
      const parsedId = typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id;
      if (!parsedId) return;
      const res = await api.get(`/cap/${parsedId}`);
      if (res.data) {
        setCapDetail(res.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    loadCapDetail();

    const parsedId = typeof item?.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item?.id;
    if (!parsedId) return;

    // 🌟 Join defect-isolated SignalR room (cap_{capTaskId})
    signalrService.joinCapRoom(parsedId);

    // 🌟 Listen for live incoming messages
    const unsubMessage = signalrService.onReceiveCapMessage((comment) => {
      if (comment.capTaskId === parsedId) {
        setTimeline((prev) => {
          if (prev.some((m) => m.id === comment.id || (m.timestamp && comment.createdAt && m.timestamp === new Date(comment.createdAt).getTime()))) {
            return prev;
          }

          const newEntry = {
            id: comment.id,
            senderId: comment.userId,
            senderRole: comment.userRole,
            senderName: comment.userName || "ผู้ใช้งาน",
            who: comment.userName || "ผู้ใช้งาน",
            text: comment.comment || comment.message || "",
            time: formatThaiTime(comment.createdAt),
            photo: comment.imageUrl ? getFullImageUrl(comment.imageUrl) : null,
            timestamp: comment.createdAt ? new Date(comment.createdAt).getTime() : Date.now()
          };

          return [...prev, newEntry];
        });

        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 50);
      }
    });

    // 🌟 Listen for live status updates
    const unsubStatus = signalrService.onCapStatusUpdated((statusUpdate) => {
      if (statusUpdate.capTaskId === parsedId) {
        const newStatus = (statusUpdate.status || "").toUpperCase();
        setLocalStatus(newStatus);
        setCapDetail((prev) => prev ? { ...prev, status: newStatus } : prev);
        loadCapDetail();
        if (refreshData) refreshData();
      }
    });

    return () => {
      unsubMessage();
      unsubStatus();
      signalrService.leaveCapRoom(parsedId);
    };
  }, [item?.id]);

  // Initial timeline from item
  const [timeline, setTimeline] = useState(() => [
    {
      id: "init_system_notice",
      isSystem: true,
      text: item.issueItem || item.title || item.desc || "ตรวจพบข้อบกพร่องตามเกณฑ์มาตรฐาน Q.S.C. ระบบได้เปิดรายการแก้ไข (CAP) ให้อัตโนมัติ",
      time: item.createdAt || "วันนี้",
      photo: null,
      timestamp: 0
    }
  ]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateImageFile(file);
    if (!check.valid) {
      alert(check.message);
      e.target.value = "";
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      setPhotoBase64(compressed);
      setHasPhoto(true);
    } catch (err) {
      console.error("Compression error:", err);
      alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
    }
    e.target.value = "";
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.type) return;
    setIsActionProcessing(true);
    setActionError(null);
    try {
      const parsedId = typeof item?.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item?.id;
      if (parsedId) {
        if (confirmModal.type === 'approve') {
          await api.post(`/cap/${parsedId}/close`, {
            note: "อนุมัติและปิดงานแก้ไขสมบูรณ์"
          });
          setLocalStatus("CLOSED");
          if (refreshData) refreshData();
          await loadCapDetail();
        }
      }
      setConfirmModal({ isOpen: false, type: null, title: '', message: '' });
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || "เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setIsActionProcessing(false);
    }
  };

  // 🌟 Handle Store Manager Submitting Remediation for Approval (Requires at least 1 photo)
  const handleSubmitApproval = async (e) => {
    if (e) e.preventDefault();
    if (submitPhotos.length === 0) {
      setSubmitError("กรุณาแนบรูปภาพหลักฐานหลังการแก้ไขอย่างน้อย 1 รูป เพื่อขออนุมัติ");
      return;
    }

    setIsSubmittingApproval(true);
    setSubmitError(null);

    try {
      const parsedId = typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id;
      if (parsedId) {
        await api.post(`/cap/${parsedId}/submit`, {
          message: submitMessage.trim() || "ส่งมอบหลักฐานและขออนุมัติการแก้ไข",
          imageUrls: submitPhotos
        });
        setLocalStatus("SUBMITTED");
        setShowSubmitModal(false);
        setSubmitMessage("");
        setSubmitPhotos([]);
        if (refreshData) refreshData();
        await loadCapDetail();
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการส่งขออนุมัติ");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // 🌟 Handle Auditor Rejecting & Requesting Re-do
  const handleRejectRemediation = async (e) => {
    if (e) e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError("กรุณาระบุเหตุผลและสิ่งที่สาขาต้องแก้ไขเพิ่มเติม");
      return;
    }

    setIsRejecting(true);
    setRejectError(null);

    try {
      const parsedId = typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id;
      if (parsedId) {
        await api.post(`/cap/${parsedId}/reject`, {
          reason: rejectReason.trim()
        });
        setLocalStatus("REJECTED");
        setShowRejectModal(false);
        setRejectReason("");
        if (refreshData) refreshData();
        await loadCapDetail();
      }
    } catch (err) {
      setRejectError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการส่งกลับแก้ไข");
    } finally {
      setIsRejecting(false);
    }
  };

  // Sync API comments and photos into timeline when capDetail arrives
  useEffect(() => {
    if (capDetail) {
      const apiTimeline = [];

      const initialTime = new Date(capDetail.createdAt).getTime() || 0;
      apiTimeline.push({
        id: "init_system_notice",
        isSystem: true,
        text: capDetail.issueItem || capDetail.description || item.desc || "ตรวจพบข้อบกพร่องตามเกณฑ์มาตรฐาน Q.S.C. ระบบได้เปิดรายการแก้ไข (CAP) ให้อัตโนมัติ",
        time: formatThaiTime(capDetail.createdAt),
        photo: null,
        timestamp: initialTime
      });

      // Comments from API
      if (capDetail.comments && Array.isArray(capDetail.comments)) {
        capDetail.comments.forEach((c) => {
          const cTime = new Date(c.createdAt).getTime() || Date.now();
          const attachedPhoto = c.imageUrl ? getFullImageUrl(c.imageUrl) : null;

          apiTimeline.push({
            id: c.id,
            senderId: c.senderId,
            senderRole: c.senderRole,
            senderName: c.senderName,
            who: c.senderName || "ผู้ใช้งาน",
            text: c.message,
            time: formatThaiTime(c.createdAt),
            photo: attachedPhoto,
            timestamp: cTime
          });
        });
      }

      apiTimeline.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      if (apiTimeline.length > 1 || (apiTimeline.length === 1 && timeline.length <= 1)) {
        setTimeline(apiTimeline);
      }
    }
  }, [capDetail]);

  const currentStatus = (capDetail?.status || localStatus || item.statusRaw || item.status || "OPEN").toUpperCase();
  const isCancelled = currentStatus === "CANCELLED";
  const isClosed = currentStatus === "CLOSED" || currentStatus === "APPROVED" || currentStatus === "DONE" || isCancelled;
  const isSubmitted = currentStatus === "SUBMITTED";
  const isRejected = currentStatus === "REJECTED";
  const isAuditeeUser = (role === "AUDITEE" || currentUser?.role === "AUDITEE" || currentUser?.roleCode === "AUDITEE");
  const st = CAP_STATUS_MAP[currentStatus.toLowerCase()] || (isCancelled ? CAP_STATUS_MAP.cancelled : (isClosed ? CAP_STATUS_MAP.done : CAP_STATUS_MAP.pending));

  const send = async () => {
    if (isClosed || (!reply.trim() && !hasPhoto)) return;
    setIsSending(true);

    const sentReply = reply.trim();
    const sentPhoto = hasPhoto ? photoBase64 : null;

    setReply("");
    setHasPhoto(false);
    setPhotoBase64(null);

    try {
      const parsedId = typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id;
      if (parsedId) {
        try {
          await signalrService.sendCapMessage(parsedId, sentReply, sentPhoto);
        } catch (sigErr) {
          await api.post(`/cap/${parsedId}/comments`, {
            senderId: currentUser?.id || 1,
            senderRole: role,
            message: sentReply || "",
            imageUrl: sentPhoto || null
          });
        }
        await loadCapDetail();
      }
    } catch (err) {} finally {
      setIsSending(false);
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [timeline]);

  const questionNo = capDetail?.questionNumber ?? item.orderIndex ?? item.questionNumber;
  const locationDisplayName = capDetail?.locationName || item.unit || item.locationName || "-";
  const headerSubtitle = questionNo 
    ? `ข้อที่ ${questionNo} · ${locationDisplayName}`
    : `${locationDisplayName}`;

  // Extract Before & After Photos
  const beforePhotoList = useMemo(() => {
    const rawList = Array.isArray(capDetail?.beforeImages) && capDetail.beforeImages.length > 0
      ? capDetail.beforeImages
      : Array.isArray(item.beforeImages) && item.beforeImages.length > 0
        ? item.beforeImages
        : (capDetail?.beforeImages?.[0] || item.beforeImageUrl || item.imageUrl)
          ? [capDetail?.beforeImages?.[0] || item.beforeImageUrl || item.imageUrl]
          : [];

    return rawList
      .map(b => (typeof b === 'string' ? b : b?.imageUrl || b?.url))
      .filter(Boolean);
  }, [capDetail, item]);

  const afterPhotoList = useMemo(() => {
    if (Array.isArray(capDetail?.afterImages) && capDetail.afterImages.length > 0) {
      return capDetail.afterImages.map(img => typeof img === 'string' ? img : img.imageUrl).filter(Boolean);
    }
    if (Array.isArray(item.afterImages) && item.afterImages.length > 0) {
      return item.afterImages.map(img => typeof img === 'string' ? img : img.imageUrl).filter(Boolean);
    }
    return [];
  }, [capDetail, item]);

  // 🖼️ Reusable Visual Before vs After Component
  const renderBeforeAfterComparison = () => (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Image size={14} className="text-[#0F6659]" />
          <span>เปรียบเทียบรูปภาพ ก่อน - หลังแก้ไข</span>
        </span>
        {isSubmitted && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            รอตรวจสอบหลักฐาน
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 🔴 ก่อนแก้ไข (Before / Audit Finding) */}
        <div className="space-y-1.5 p-2.5 rounded-xl bg-rose-50/50 border border-rose-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-rose-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>ก่อนแก้ไข (ตอนตรวจพบ)</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
              {beforePhotoList.length} รูป
            </span>
          </div>

          {beforePhotoList.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {beforePhotoList.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setViewingPhoto(url)}
                  className="aspect-square rounded-xl overflow-hidden border border-rose-200/80 bg-white cursor-pointer group relative shadow-2xs"
                >
                  <img
                    src={getFullImageUrl(url)}
                    alt={`Before #${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    ขยายรูป
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="aspect-video rounded-xl border border-dashed border-rose-200 bg-white/70 flex flex-col items-center justify-center p-3 text-center text-rose-400">
              <Camera size={18} className="text-rose-300 mb-1" />
              <span className="text-[11px] font-bold">ไม่มีรูปตอนตรวจพบ</span>
            </div>
          )}
        </div>

        {/* 🟢 หลังแก้ไข (After / Remediation Evidence) */}
        <div className="space-y-1.5 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-[#0F6659] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>หลังแก้ไข (หลักฐานจากสาขา)</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 text-[#0F6659]">
              {afterPhotoList.length} รูป
            </span>
          </div>

          {afterPhotoList.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {afterPhotoList.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setViewingPhoto(url)}
                    className="aspect-square rounded-xl overflow-hidden border border-emerald-300 bg-white cursor-pointer group relative shadow-2xs"
                  >
                    <img
                      src={getFullImageUrl(url)}
                      alt={`After #${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                      ขยายรูป
                    </div>
                  </div>
                ))}
              </div>
              {isAuditeeUser && !isClosed && (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="w-full py-1.5 px-2 rounded-xl bg-emerald-100/80 hover:bg-emerald-200 text-[#0F6659] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-emerald-300/80"
                >
                  <Plus size={13} />
                  <span>ส่งมอบงานแก้ไขใหม่ / ปรับปรุงรูป</span>
                </button>
              )}
            </div>
          ) : (
            isAuditeeUser && !isClosed ? (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full aspect-video rounded-xl border-2 border-dashed border-emerald-400 bg-white hover:bg-emerald-50 active:scale-[0.98] transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0F6659] group-hover:bg-[#0F6659] group-hover:text-white flex items-center justify-center mb-1.5 transition-all shadow-xs">
                  <Plus size={16} />
                </div>
                <span className="text-xs font-extrabold text-[#0F6659] group-hover:underline">
                  + กดเพื่อแนบรูปส่งมอบงานแก้ไข
                </span>
              </button>
            ) : (
              <div className="aspect-video rounded-xl border border-dashed border-slate-200 bg-white/70 flex flex-col items-center justify-center p-3 text-center text-slate-400">
                <Camera size={18} className="text-slate-300 mb-1" />
                <span className="text-[11px] font-bold text-slate-600">ยังไม่ส่งรูปหลังแก้ไข</span>
                <span className="text-[10px] text-slate-400 mt-0.5">รอสาขาแนบรูปขออนุมัติ</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  // Reusable Defect Summary Panel Content
  const renderDefectDetails = () => (
    <div className="space-y-4">
      {/* Status & ID Badge */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <span className="text-xs font-mono font-bold text-slate-500">
          ข้อที่ {questionNo || "-"}
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full border shadow-2xs"
          style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}40` }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: st.fg }} />
          {st.label}
        </span>
      </div>

      {/* Defect Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-amber-900">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>หัวข้อข้อบกพร่องที่ต้องแก้ไข</span>
          </div>
          {(capDetail?.categoryName || item.categoryName) && (
            <span className="px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 text-[10px] font-bold">
              {getCategoryDisplay(capDetail?.categoryName || item.categoryName)}
            </span>
          )}
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
          <h4 className="text-sm font-extrabold text-slate-900 leading-snug break-words [overflow-wrap:anywhere]">
            {capDetail?.issueItem || item.issueItem || item.title || "ข้อบกพร่องที่ตรวจพบ"}
          </h4>
          {(() => {
            const descText = (capDetail?.description || item.desc || item.notes || item.actionPlan || "").trim();
            const issueTitle = (capDetail?.issueItem || item.issueItem || item.title || "").trim();
            if (!descText || descText === "-" || descText === issueTitle) return null;
            
            if (descText.startsWith("ไม่ผ่านเกณฑ์การประเมิน:") && descText.replace("ไม่ผ่านเกณฑ์การประเมิน:", "").trim() === issueTitle) {
              return null;
            }

            return (
              <p className="text-xs text-slate-700 font-medium leading-relaxed pt-1.5 border-t border-amber-200/60">
                <span className="font-bold text-amber-900">💬 บันทึกคำแนะนำ:</span> {descText}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">สาขาที่ตรวจ</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate" title={locationDisplayName}>
            {locationDisplayName}
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">กำหนดส่งงาน</div>
          <div className="text-xs sm:text-sm font-extrabold text-rose-700 mt-0.5 truncate">
            {(() => {
              const dl = capDetail?.submissionDeadline || item.dueDate || item.submissionDeadline;
              return dl ? new Date(dl).toLocaleDateString('th-TH') : (item.deadline || "-");
            })()}
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">ผู้ตรวจประเมิน</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate" title={capDetail?.auditorName || item.auditor || item.auditorName || item.verifierName || "-"}>
            {capDetail?.auditorName || item.auditor || item.auditorName || item.verifierName || "-"}
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">คะแนนข้อ</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">
            {(() => {
              const sc = capDetail?.scoreGiven !== undefined && capDetail?.scoreGiven !== null
                ? capDetail.scoreGiven
                : item.scoreGiven;
              const full = capDetail?.fullScore || item.fullScore || 10;
              return sc !== undefined && sc !== null ? `${sc}/${full}` : "-";
            })()}
          </div>
        </div>
      </div>

      {/* 🖼️ Visual Before/After Comparison */}
      {renderBeforeAfterComparison()}
    </div>
  );

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[94%] mx-auto pb-28 lg:pb-12">
      {/* 🌟 1. TOP HEADER BAR */}
      <Header 
        title={item.title || item.issueItem || "งานแก้ไข CAP"} 
        subtitle={headerSubtitle} 
        onBack={onBack} 
      />

      {/* 🌟 2. SPLIT LAYOUT (DESKTOP 2-COLUMN / MOBILE FULL CHAT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* 👈 LEFT / MAIN: FULL-HEIGHT CHAT ROOM (lg:col-span-7 xl:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3 flex flex-col min-h-[560px] lg:min-h-[620px]">
          
          {/* 🌟 CHAT STREAM HEADER */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 px-1 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#0F6659] flex items-center justify-center font-bold shrink-0">
                <MessageSquare size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                  ห้องสนทนาส่งหลักฐานและการแก้ไข
                </h3>
                <p className="text-xs text-slate-400 font-medium truncate">
                  สนทนาระหว่างผู้ตรวจและผู้จัดการสาขา
                </p>
              </div>
            </div>

            {/* Top Right Corner: Details Button with Evidence Count */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowInfoDrawer(true)}
                className={`lg:hidden px-3 py-1.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs border ${
                  afterPhotoList.length > 0
                    ? "bg-emerald-100/90 hover:bg-emerald-100 text-[#0F6659] border-emerald-300"
                    : "bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border-emerald-200"
                }`}
                title="ดูรายละเอียดข้อบกพร่องและรูปเปรียบเทียบ Before/After"
              >
                <Info size={14} className="shrink-0" />
                <span>รายละเอียด ({afterPhotoList.length})</span>
              </button>
            </div>
          </div>

          {/* Chat Stream Messages (Scrollable) */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-4 p-3 sm:p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 custom-tab-scrollbar min-h-[340px] max-h-[440px] lg:max-h-[480px]"
          >
            {timeline.map((tl, i) => {
              if (tl.isSystem) {
                return (
                  <div key={tl.id || i} className="flex flex-col items-center my-2 w-full animate-in fade-in">
                    <div className="w-full max-w-[96%] sm:max-w-[90%] rounded-2xl bg-amber-50/90 border border-amber-200/90 p-3 sm:p-3.5 text-center space-y-1.5 shadow-2xs">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-extrabold">
                        <Sparkles size={12} className="text-amber-700" />
                        <span>ระบบ Q.S.C. · แจ้งเตือนบันทึกงานแก้ไข</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {tl.text}
                      </p>
                      <div className="flex items-center justify-center flex-wrap gap-2 text-[10.5px] text-amber-800 font-semibold pt-1 border-t border-amber-200/60">
                        <span>🕒 บันทึกเมื่อ: {tl.time}</span>
                        {capDetail?.submissionDeadline && (
                          <span>· 📅 กำหนดส่ง: {new Date(capDetail.submissionDeadline).toLocaleDateString('th-TH')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // 🌟 Render System Action Events as dedicated center cards
              const msgText = (tl.text || "").trim();
              const isSubmitEvent = msgText.includes("[ส่งมอบงานแก้ไข]") || msgText.includes("[ขออนุมัติการแก้ไข]");
              const isRejectEvent = msgText.includes("[ส่งกลับแก้ไข]");
              const isApproveEvent = msgText.includes("[อนุมัติปิดงาน]");

              if (isSubmitEvent || isRejectEvent || isApproveEvent) {
                return (
                  <div key={tl.id || i} className="flex flex-col items-center my-3 w-full animate-in fade-in">
                    <div className={`w-full max-w-[94%] sm:max-w-[85%] rounded-2xl p-3.5 text-center space-y-2 border shadow-2xs ${
                      isSubmitEvent
                        ? "bg-emerald-50/95 border-emerald-300 text-emerald-950"
                        : isRejectEvent
                        ? "bg-rose-50/95 border-rose-300 text-rose-950"
                        : "bg-teal-50/95 border-teal-300 text-teal-950"
                    }`}>
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                          isSubmitEvent
                            ? "bg-emerald-100 text-[#0F6659] border-emerald-300"
                            : isRejectEvent
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-teal-100 text-teal-800 border-teal-300"
                        }`}>
                          {isSubmitEvent && <Camera size={13} />}
                          {isRejectEvent && <RotateCcw size={13} />}
                          {isApproveEvent && <CheckCircle2 size={13} />}
                          <span>
                            {isSubmitEvent && "สาขาส่งมอบงานแก้ไขแล้ว"}
                            {isRejectEvent && "ผู้ตรวจส่งกลับให้แก้ไขใหม่"}
                            {isApproveEvent && "อนุมัติและปิดงานแก้ไขแล้ว"}
                          </span>
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-wrap px-2">
                        {msgText.replace(/^📸\s*\[ส่งมอบงานแก้ไข\]\s*/, '')
                                .replace(/^⚠️\s*\[ส่งกลับแก้ไข\]\s*/, '')
                                .replace(/^✅\s*\[อนุมัติปิดงาน\]\s*/, '')}
                      </p>

                      {isSubmitEvent && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F6659] bg-white/80 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <span>✨ รูปหลักฐานถูกจัดเก็บและแสดงในส่วนเปรียบเทียบ Before / After เรียบร้อยแล้ว</span>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-2 text-[10.5px] text-slate-400 font-medium pt-1 border-t border-slate-200/60">
                        <span>โดย: {tl.senderName || tl.who || "ผู้ใช้งาน"}</span>
                        <span>·</span>
                        <span>{tl.time}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              const currentUserId = currentUser?.id;
              const currentFullName = (currentUser?.fullName || currentUser?.name || "").trim();
              const currentUsername = (currentUser?.username || "").trim();

              const isMe = Boolean(
                (tl.senderId && currentUserId && Number(tl.senderId) === Number(currentUserId)) ||
                (tl.userId && currentUserId && Number(tl.userId) === Number(currentUserId)) ||
                (tl.senderName && currentFullName && tl.senderName.trim() === currentFullName) ||
                (tl.who && currentFullName && tl.who.trim() === currentFullName) ||
                (tl.senderName && currentUsername && tl.senderName.trim() === currentUsername) ||
                tl.isMe === true
              );

              const isAuditee = (tl.senderRole === 'AUDITEE' || tl.role === 'AUDITEE' || tl.userRole === 'AUDITEE');
              const senderRoleText = isAuditee ? 'สาขา' : 'ผู้ตรวจ/QA';

              let cleanSenderName = (isMe 
                ? (currentFullName || tl.senderName || "คุณ")
                : (tl.senderName || tl.who || "ผู้ใช้งาน")
              );
              cleanSenderName = cleanSenderName.replace(/\s*\([^)]*\)/g, '').trim();

              const myRoleText = isAuditeeUser ? "สาขา" : "ผู้ตรวจ/QA";
              const senderDisplayName = `${cleanSenderName} (${isMe ? myRoleText : senderRoleText})`;

              return (
                <div 
                  key={tl.id || i} 
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in`}
                >
                  {/* Sender Name & Time */}
                  <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`text-xs font-extrabold ${isMe ? 'text-[#0F6659]' : 'text-slate-700'}`}>
                      {senderDisplayName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{tl.time}</span>
                  </div>

                  {/* Chat Bubble */}
                  <div 
                    className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-2xs max-w-[90%] sm:max-w-[85%] space-y-2 leading-relaxed ${
                      isMe
                        ? 'bg-[#0F6659] text-white rounded-tr-xs shadow-emerald-900/10'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                    }`}
                  >
                    {tl.text ? (
                      <p className="whitespace-pre-wrap">{tl.text}</p>
                    ) : null}

                    {/* Attached Photo inside Bubble */}
                    {tl.photo && (
                      <div 
                        onClick={() => setViewingPhoto(tl.photo)}
                        className={`rounded-xl overflow-hidden border cursor-pointer hover:opacity-95 transition-opacity relative group ${
                          isMe ? 'border-white/20 bg-black/20' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="max-h-72 sm:max-h-80 flex items-center justify-center bg-black/5 overflow-hidden p-1">
                          <img 
                            src={getFullImageUrl(tl.photo)} 
                            alt="รูปภาพประกอบการสนทนา" 
                            className="w-full max-h-72 sm:max-h-80 object-contain rounded-lg group-hover:scale-102 transition-transform duration-200" 
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Camera size={16} /> แตะเพื่อขยายรูปภาพ
                        </div>
                        <div className={`p-2 text-[11px] font-bold flex items-center justify-between border-t ${
                          isMe ? 'border-white/10 text-emerald-100' : 'border-slate-200/80 text-slate-600'
                        }`}>
                          <span className="flex items-center gap-1.5">
                            <Camera size={13} />
                            <span>รูปภาพประกอบการสนทนา</span>
                          </span>
                          <span className="text-[10px] opacity-75 font-normal">แตะเพื่อขยาย</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden File Input for regular chat attachment */}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Photo Attachment Preview Banner */}
          {hasPhoto && photoBase64 && (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-extrabold text-emerald-950 animate-in fade-in shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={photoBase64}
                  alt="Chat Attachment Preview"
                  className="w-11 h-11 rounded-xl object-cover border border-emerald-400 shrink-0 shadow-2xs cursor-pointer"
                  onClick={() => setViewingPhoto(photoBase64)}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-900 truncate">แนบรูปภาพประกอบการสนทนาแล้ว</div>
                  <div className="text-[11px] text-emerald-700 font-medium truncate">รูปนี้จะแสดงในบทสนทนา (ไม่ใช่รูปส่งมอบงาน)</div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setHasPhoto(false); setPhotoBase64(null); }}
                className="px-2.5 py-1 text-xs text-red-600 font-bold hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isClosed}
              onClick={() => !isClosed && fileInputRef.current?.click()}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all border shadow-2xs ${
                isClosed
                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                  : hasPhoto 
                  ? 'bg-emerald-100 text-[#0F6659] border-emerald-400 shadow-xs cursor-pointer active:scale-95' 
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800 cursor-pointer active:scale-95'
              }`}
              title={isClosed ? "รายการนี้อนุมัติและปิดงานแล้ว" : "แนบรูปภาพประกอบการสนทนาในแชท"}
            >
              <Camera size={20} />
            </button>

            <input
              value={reply}
              disabled={isClosed}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isClosed) send(); }}
              placeholder={isCancelled ? "งานแก้ไขนี้ถูกยกเลิกแล้ว" : (isClosed ? "รายการนี้ได้รับการอนุมัติและปิดงานเรียบร้อยแล้ว" : "พิมพ์ข้อความสนทนาหรือสอบถามแนวทางแก้ไข...")}
              className={`flex-1 text-xs sm:text-sm px-4 py-3.5 rounded-2xl outline-none font-bold border shadow-2xs transition-all ${
                isClosed
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed placeholder:text-slate-400"
                  : "bg-slate-50/70 border-slate-200 focus:bg-white focus:border-[#0F6659] text-slate-900 placeholder:text-slate-400"
              }`}
            />

            {!isClosed && (
              <button 
                type="button" 
                onClick={send} 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer shadow-md bg-[#0F6659] hover:bg-[#0B4E44] text-white active:scale-95 transition-all"
                title="ส่งข้อความ"
              >
                <Send size={18} />
              </button>
            )}
          </div>

          {/* 🌟 AUDITOR REVIEW ACTIONS BAR: (Approve OR Reject Decision) */}
          {!isAuditeeUser && !isClosed && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                {isSubmitted && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    🟡 สาขาส่งขออนุมัติแล้ว
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* 1. 🟢 Approve & Close Button (Left) */}
                <button 
                  type="button"
                  onClick={() => setConfirmModal({
                    isOpen: true,
                    type: 'approve',
                    title: 'ยืนยันการอนุมัติและปิดงาน (Approve & Close)',
                    message: 'คุณได้ตรวจสอบรูปถ่ายหลักฐานเปรียบเทียบก่อน-หลัง และต้องการอนุมัติปิดงานแก้ไขนี้ใช่หรือไม่?'
                  })}
                  className="w-full py-2.5 sm:py-3 px-2 sm:px-4 rounded-2xl text-[11px] sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer text-white active:scale-98 bg-[#0F6659] hover:bg-[#0B4E44] transition-all shadow-md truncate"
                >
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="truncate">อนุมัติและปิดงาน</span>
                </button>

                {/* 2. 🔴 Reject & Request Re-do Button (Right) */}
                <button 
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="w-full py-2.5 sm:py-3 px-2 sm:px-4 rounded-2xl text-[11px] sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-98 transition-all shadow-2xs truncate"
                >
                  <RotateCcw size={16} className="shrink-0" />
                  <span className="truncate">ส่งกลับแก้ไข</span>
                </button>
              </div>
            </div>
          )}

          {/* 🌟 BANNER: WHEN CAP IS CANCELLED OR CLOSED */}
          {isCancelled ? (
            <div className="pt-2 border-t border-slate-100">
              <div className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                <CheckCircle2 size={18} className="text-slate-500" />
                <span>งานแก้ไขนี้ถูกยกเลิกเนื่องจากมีการแก้ไขผลการตรวจเป็นผ่านแล้ว</span>
              </div>
            </div>
          ) : isClosed ? (
            <div className="pt-2 border-t border-slate-100">
              <div className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>รายการนี้ได้รับการอนุมัติและปิดงานเรียบร้อยแล้ว</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* 👉 RIGHT COLUMN: PERMANENT DEFECT SUMMARY & BEFORE/AFTER (lg:col-span-5 xl:col-span-4) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs sticky top-20">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                <FileText size={16} />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 truncate">ข้อมูลและสถานะงานแก้ไข</h3>
            </div>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0F6659] border border-emerald-200 shrink-0">
              รูปแก้ไข ({afterPhotoList.length})
            </span>
          </div>

          {renderDefectDetails()}
        </div>
      </div>

      {/* 📱 MOBILE SLIDE DRAWER / MODAL FOR DEFECT DETAILS & BEFORE/AFTER */}
      {showInfoDrawer && (
        <ModalWrapper onClose={() => setShowInfoDrawer(false)} maxWidth="max-w-lg">
          <div className="flex flex-col max-h-[85dvh] overflow-hidden">
            {/* 📌 Pinned Header (ไม่เลื่อนตาม) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                  <Info size={16} />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                  รายละเอียดและการเปรียบเทียบรูปภาพ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X size={16} />
              </button>
            </div>

            {/* 📜 Scrollable Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 custom-tab-scrollbar">
              {renderDefectDetails()}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 📸 MODAL FOR STORE MANAGER TO SUBMIT REMEDIATION FOR APPROVAL (Mandatory Photos) */}
      {showSubmitModal && (
        <ModalWrapper onClose={() => !isSubmittingApproval && setShowSubmitModal(false)} maxWidth="max-w-lg">
          <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50 border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#0F6659] shrink-0 font-bold">
                <Camera size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">ส่งหลักฐานและขออนุมัติการแก้ไข</h3>
                <p className="text-[11px] text-slate-500">แนบรูปถ่ายหลังปรับปรุงเพื่อให้ผู้ตรวจพิจารณาอนุมัติ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmitApproval} className="p-4 sm:p-5 space-y-4 max-h-[75dvh] overflow-y-auto custom-tab-scrollbar">
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* 1. Mandatory Photos Upload */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera size={14} className="text-[#0F6659]" />
                  <span>รูปภาพหลักฐานหลังการแก้ไข (After Photos) <span className="text-rose-500 font-black">*</span></span>
                </label>
                {submitPhotos.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    แนบแล้ว {submitPhotos.length} รูป
                  </span>
                )}
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                ref={submitFileInputRef}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;

                  const rawFileList = Array.from(files);
                  const validFiles = [];
                  const validationErrors = [];

                  for (const f of rawFileList) {
                    const check = validateImageFile(f);
                    if (!check.valid) {
                      validationErrors.push(`${f.name || "ไฟล์"}: ${check.message}`);
                    } else {
                      validFiles.push(f);
                    }
                  }

                  if (validationErrors.length > 0) {
                    setSubmitError(validationErrors.join(" | "));
                    if (validFiles.length === 0) {
                      e.target.value = "";
                      return;
                    }
                  }

                  try {
                    const compressedUrls = await Promise.all(validFiles.map(f => compressImageFile(f)));
                    setSubmitPhotos(prev => [...prev, ...compressedUrls]);
                    if (submitError && validationErrors.length === 0) setSubmitError(null);
                  } catch (err) {
                    console.error("Compression error:", err);
                    setSubmitError("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
                  }
                  e.target.value = "";
                }}
                className="hidden"
              />

              {submitPhotos.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {submitPhotos.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group"
                      >
                        <img
                          src={img}
                          alt={`Evidence ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold font-mono">
                          #{idx + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSubmitPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-90"
                          title="ลบรูปนี้"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}

                    {/* Add More Tile */}
                    <button
                      type="button"
                      onClick={() => submitFileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50/40 bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#0F6659] cursor-pointer transition-all active:scale-95 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 transition-colors shadow-2xs">
                        <Plus size={16} className="text-slate-500 group-hover:text-[#0F6659]" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#0F6659]">เพิ่มรูป</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                    <span>รูปถ่ายนี้จะแสดงในฝั่งหลังแก้ไข (After) ให้ผู้ตรวจเปรียบเทียบ</span>
                    <button
                      type="button"
                      onClick={() => setSubmitPhotos([])}
                      className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => submitFileInputRef.current?.click()}
                  className="w-full p-5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-[#0F6659] bg-emerald-50/40 hover:bg-emerald-50/70 flex flex-col items-center justify-center gap-2 text-emerald-800 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-300 flex items-center justify-center group-hover:scale-105 transition-all shadow-2xs text-[#0F6659]">
                    <Camera size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm font-bold text-[#0F6659]">
                      แตะเพื่อถ่ายรูปหรือเลือกรูปภาพหลักฐานหลังแก้ไข *
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      บังคับต้องแนบรูปภาพอย่างน้อย 1 รูป เพื่อยืนยันการแก้ไข
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* 2. Action / Remediation Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                รายละเอียดการดำเนินการแก้ไข (Action Description)
              </label>
              <textarea
                value={submitMessage}
                rows={3}
                onChange={(e) => setSubmitMessage(e.target.value)}
                placeholder="ระบุสิ่งที่สาขาได้ปรับปรุงแก้ไข เช่น ได้ทำการขัดล้างทำความสะอาดและตรวจสอบความเรียบร้อยตามมาตรฐานแล้ว..."
                className="w-full p-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-medium bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#0F6659] outline-none shadow-2xs leading-relaxed"
              />
            </div>

            {/* Modal Submit Footer */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSubmittingApproval || submitPhotos.length === 0}
                onClick={handleSubmitApproval}
                className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md bg-[#0F6659] hover:bg-emerald-800 text-white transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmittingApproval ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังส่งข้อมูลและรูปภาพ...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>ยืนยันส่งหลักฐานและขออนุมัติ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* 🔴 MODAL FOR AUDITOR TO REJECT AND REQUEST RE-DO */}
      {showRejectModal && (
        <ModalWrapper onClose={() => !isRejecting && setShowRejectModal(false)} maxWidth="max-w-md">
          <div className="p-4 border-b flex items-center justify-between shrink-0 bg-rose-50/70 border-rose-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 font-bold">
                <RotateCcw size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">ส่งกลับให้สาขาแก้ไขใหม่ (Reject)</h3>
                <p className="text-[11px] text-slate-500">ระบุเหตุผลและสิ่งที่สาขาต้องปรับปรุงเพิ่มเติม</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleRejectRemediation} className="p-4 sm:p-5 space-y-4">
            {rejectError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{rejectError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                เหตุผลและสิ่งที่ต้องแก้ไขเพิ่มเติม <span className="text-rose-500 font-black">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="เช่น รูปถ่ายยังไม่ชัดเจน หรือยังมีคราบไขมันตกค้าง ให้ขัดล้างเพิ่มเติมและถ่ายรูปส่งใหม่..."
                className="w-full p-3 rounded-2xl border border-rose-300 focus:border-rose-500 text-xs sm:text-sm font-medium bg-white text-slate-800 placeholder:text-slate-400 outline-none shadow-2xs leading-relaxed"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isRejecting || !rejectReason.trim()}
                onClick={handleRejectRemediation}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>ส่งกลับให้แก้ไขใหม่</span>
                )}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* 🖼️ PHOTO EXPAND MODAL */}
      {viewingPhoto && (
        <ModalWrapper onClose={() => setViewingPhoto(null)} maxWidth="max-w-2xl">
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Camera size={16} className="text-[#0F6659]" />
                <span>รูปถ่ายหลักฐาน (Photo Evidence)</span>
              </span>
              <button 
                type="button" 
                onClick={() => setViewingPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            <img src={getFullImageUrl(viewingPhoto)} alt="ขยายรูปภาพ" className="w-full max-h-[75dvh] object-contain rounded-2xl border bg-black/5" />
          </div>
        </ModalWrapper>
      )}

      {/* ⚠️ CUSTOM ACTION CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <ModalWrapper onClose={() => !isActionProcessing && setConfirmModal({ isOpen: false, type: null, title: '', message: '' })} maxWidth="max-w-md">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                confirmModal.type === 'reject' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {confirmModal.type === 'reject' ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 font-medium">กรุณาตรวจสอบก่อนยืนยันรายการ</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {confirmModal.message}
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isActionProcessing}
                onClick={() => setConfirmModal({ isOpen: false, type: null, title: '', message: '' })}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isActionProcessing}
                onClick={handleConfirmAction}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 bg-[#0F6659] hover:bg-emerald-800"
              >
                {isActionProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>ยืนยันอนุมัติและปิดงาน</span>
                )}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 🌟 FIXED FLOATING AI ACTION BUTTON (PORTAL TO BODY) */}
      {typeof document !== "undefined" && createPortal(
        <div className="fixed right-4 bottom-20 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowAiCapModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0F6659] hover:bg-emerald-800 text-white font-bold text-xs shadow-xl shadow-emerald-950/25 active:scale-95 transition-all cursor-pointer border border-emerald-500/30"
            title="AI ผู้ช่วยวิเคราะห์งานแก้ไข"
          >
            <Sparkles size={15} className="animate-pulse text-emerald-200" />
            <span>AI</span>
          </button>
        </div>,
        document.body
      )}

      {/* AI CAP Analysis Modal */}
      {showAiCapModal && (
        <AiCapAdvisorModal
          taskId={typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id}
          onClose={() => setShowAiCapModal(false)}
        />
      )}
    </div>
  );
}

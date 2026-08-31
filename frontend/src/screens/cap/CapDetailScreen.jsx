import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare, Camera, Send, Check, X, AlertTriangle, Clock,
  ChevronLeft, ChevronRight, Info, ShieldAlert, Store, Calendar,
  CheckCircle2, Sparkles, ImagePlus, User, FileText, ArrowLeft, Loader2
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { CAP_STATUS_MAP } from "../../config/constants";
import Header from "../../shared/Header";
import ModalWrapper from "../../shared/ModalWrapper";
import api, { getFullImageUrl } from "../../config/api";
import { compressImageFile } from "../../utils/imageCompressor";
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
    } catch (err) {
      console.warn("Could not load cap detail:", err);
    }
  };

  useEffect(() => {
    loadCapDetail();

    const parsedId = typeof item?.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item?.id;
    if (!parsedId) return;

    // 🌟 Join defect-isolated SignalR room (cap_{capTaskId})
    signalrService.joinCapRoom(parsedId);

    // 🌟 Listen for live incoming messages (SILENT MODE: Zero audio alerts, live visual UI stream only)
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

        // Silent scroll to bottom on new message
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 50);
      }
    });

    // 🌟 Listen for live status updates (Instant UI lock on CLOSED status without page reload)
    const unsubStatus = signalrService.onCapStatusUpdated((statusUpdate) => {
      if (statusUpdate.capTaskId === parsedId) {
        const newStatus = (statusUpdate.status || "").toUpperCase();
        setLocalStatus(newStatus);
        setCapDetail((prev) => prev ? { ...prev, status: newStatus } : prev);
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
      who: `${item.unit || "ผู้ตรวจ"} (ผู้ตรวจ)`,
      senderRole: "AUDITOR",
      text: item.issueItem || item.title || item.desc || "ตรวจพบข้อบกพร่องตามมาตรฐาน Q.S.C. กรุณาดำเนินการแก้ไขและส่งหลักฐาน",
      time: item.createdAt || "วันนี้",
      photo: null
    }
  ]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhotoBase64(compressed);
      setHasPhoto(true);
    } catch (err) {
      console.warn("Compression failed:", err);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoBase64(ev.target.result);
        setHasPhoto(true);
      };
      reader.readAsDataURL(file);
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
      console.warn(e);
      setActionError(e.response?.data?.message || e.message || "เกิดข้อผิดพลาดในการดำเนินการ");
    } finally {
      setIsActionProcessing(false);
    }
  };

  // Sync API comments and photos into timeline when capDetail arrives
  useEffect(() => {
    if (capDetail) {
      const apiTimeline = [];

      const initialTime = new Date(capDetail.createdAt).getTime() || 0;
      // Initial task issue item as first message (Pure defect notice, NO evidence photo)
      apiTimeline.push({
        who: `${capDetail.verifierName || capDetail.assigneeName || "ผู้ตรวจ/ระบบ"} (ผู้ตรวจ)`,
        text: capDetail.issueItem || capDetail.description || item.desc || "ตรวจพบข้อบกพร่องตามมาตรฐาน Q.S.C. กรุณาดำเนินการแก้ไขและส่งหลักฐาน",
        time: formatThaiTime(capDetail.createdAt),
        isMe: false,
        photo: null,
        timestamp: initialTime
      });

      const afterImgs = Array.isArray(capDetail.afterImages) ? [...capDetail.afterImages] : [];
      const usedImgUrls = new Set();

      // Comments from API
      if (capDetail.comments && Array.isArray(capDetail.comments)) {
        capDetail.comments.forEach((c) => {
          const isSenderMe = c.senderId === currentUser?.id || 
            (c.senderName && (c.senderName === currentUser?.fullName || c.senderName === currentUser?.name));

          const cTime = new Date(c.createdAt).getTime() || Date.now();

          // Look for attached photo directly from comment or from afterImgs
          let attachedPhoto = c.imageUrl ? getFullImageUrl(c.imageUrl) : null;
          if (!attachedPhoto) {
            const matchingImg = afterImgs.find(img => {
              if (usedImgUrls.has(img.imageUrl)) return false;
              const imgTime = new Date(img.uploadedAt).getTime() || 0;
              const isUploader = (img.uploadedBy === c.senderId) || isSenderMe;
              return isUploader && Math.abs(imgTime - cTime) < 20000;
            });

            if (matchingImg) {
              attachedPhoto = getFullImageUrl(matchingImg.imageUrl);
              usedImgUrls.add(matchingImg.imageUrl);
            }
          } else if (c.imageUrl) {
            usedImgUrls.add(c.imageUrl);
          }

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

      // Remaining after images from API (if not already merged with a comment)
      afterImgs.forEach((img) => {
        if (!usedImgUrls.has(img.imageUrl)) {
          const imgTime = new Date(img.uploadedAt).getTime() || Date.now();

          apiTimeline.push({
            id: `img_${img.id || imgTime}`,
            senderId: img.uploadedBy,
            senderRole: img.uploaderRole,
            senderName: img.uploaderName,
            who: img.uploaderName || "ผู้ใช้งาน",
            text: "",
            time: formatThaiTime(img.uploadedAt),
            photo: getFullImageUrl(img.imageUrl),
            timestamp: imgTime
          });
          usedImgUrls.add(img.imageUrl);
        }
      });

      // Sort timeline chronologically by timestamp
      apiTimeline.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      if (apiTimeline.length > 1 || (apiTimeline.length === 1 && timeline.length <= 1)) {
        setTimeline(apiTimeline);
      }
    }
  }, [capDetail]);

  const currentStatus = (capDetail?.status || localStatus || item.statusRaw || item.status || "OPEN").toLowerCase();
  const isClosed = currentStatus === "closed" || currentStatus === "approved" || currentStatus === "done";
  const st = CAP_STATUS_MAP[currentStatus] || (isClosed ? CAP_STATUS_MAP.done : CAP_STATUS_MAP.pending);

  const send = async () => {
    if (isClosed || (!reply.trim() && !hasPhoto)) return;
    setIsSending(true);

    const senderName = currentUser?.fullName || currentUser?.name || (role === "AUDITEE" ? "ผู้จัดการสาขา" : "ผู้ตรวจ/QA");
    const sentReply = reply.trim();
    const sentPhoto = hasPhoto ? photoBase64 : null;

    setReply("");
    setHasPhoto(false);
    setPhotoBase64(null);

    try {
      const parsedId = typeof item.id === 'string' ? parseInt(item.id.replace(/\D/g, '')) : item.id;
      if (parsedId) {
        // Try real-time SignalR hub first
        try {
          await signalrService.sendCapMessage(parsedId, sentReply, sentPhoto);
        } catch (sigErr) {
          console.warn("SignalR send failed, using REST API fallback:", sigErr);
          if (sentPhoto) {
            await api.post(`/cap/${parsedId}/submit`, {
              userId: currentUser?.id || 1,
              message: sentReply,
              imageUrls: [sentPhoto]
            });
          } else if (sentReply) {
            await api.post(`/cap/${parsedId}/comments`, {
              senderId: currentUser?.id || 1,
              senderRole: role,
              message: sentReply
            });
          }
        }
        await loadCapDetail();
      }
    } catch (err) {
      console.warn("Could not post comment/evidence to API:", err);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  // Ensure page stays at top on load, and scroll ONLY inside the chat container
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

  // Reusable Defect Summary Panel Content
  const renderDefectDetails = () => (
    <div className="space-y-4">
      {/* Status & ID Badge */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <span className="text-xs font-mono font-bold text-slate-400">
          {item.id} · {item.unit}
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
        <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <span>หัวข้อข้อบกพร่องที่ต้องแก้ไข</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1">
          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
            {item.issueItem || item.title}
          </h4>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            {item.desc || item.notes || item.actionPlan || "-"}
          </p>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">สาขาที่ตรวจ</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">{item.unit || "-"}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">กำหนดส่งงาน</div>
          <div className="text-xs sm:text-sm font-extrabold text-rose-700 mt-0.5 truncate">{item.deadline || (item.dueDate ? new Date(item.dueDate).toLocaleDateString('th-TH') : "-")}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">ผู้ตรวจประเมิน</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">{item.auditor || item.auditorName || item.createdBy || "-"}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">คะแนนรอบตรวจ</div>
          <div className="text-xs sm:text-sm font-extrabold text-amber-800 mt-0.5">{item.auditScore !== undefined ? `${item.auditScore}%` : "-"}</div>
        </div>
      </div>

      {/* Defect Photo Found during Audit */}
      {(() => {
        const findingPhoto = capDetail?.beforeImages?.[0]?.imageUrl || item.beforeImageUrl || item.imageUrl || null;
        return (
          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <Camera size={14} className="text-slate-400" />
              <span>รูปถ่ายตอนตรวจพบปัญหา (Audit Finding)</span>
            </div>
            {findingPhoto ? (
              <div 
                onClick={() => setViewingPhoto(findingPhoto)}
                className="rounded-2xl overflow-hidden border border-slate-200 cursor-pointer relative group aspect-video bg-slate-100"
              >
                <img 
                  src={getFullImageUrl(findingPhoto)} 
                  alt="ภาพตอนตรวจพบปัญหา" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                  <Camera size={15} /> แตะเพื่อดูรูปขยาย
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 font-medium">
                ไม่มีรูปถ่ายตอนตรวจพบปัญหา
              </div>
            )}
          </div>
        );
      })()}


    </div>
  );

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[94%] mx-auto pb-28 lg:pb-12">
      {/* 🌟 1. REGISTER TOPBAR HEADER (REPLACES LOGO IN TOP APP BAR ON MOBILE) */}
      <Header 
        title={item.title || item.issueItem || "งานแก้ไข CAP"} 
        subtitle={`${item.id} · ${item.unit}`} 
        onBack={onBack} 
      />

      {/* 🌟 2. DESKTOP TOP HEADER BAR */}
      <div className="hidden lg:flex bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-90"
            title="ย้อนกลับ"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-[#0F6659]">
              {item.id} · {item.unit}
            </div>
            <h2 className="text-base font-black text-slate-800 truncate">
              {item.title || item.issueItem || "ห้องแชทติดตามงานแก้ไข CAP"}
            </h2>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-1.5 rounded-full border shadow-2xs"
          style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}40` }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: st.fg }} />
          {st.label}
        </span>
      </div>

      {/* 🌟 3. SPLIT LAYOUT (DESKTOP 2-COLUMN / MOBILE FULL CHAT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* 👈 LEFT / MAIN: FULL-HEIGHT CHAT ROOM (lg:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3 flex flex-col min-h-[560px] lg:min-h-[620px]">
          
          {/* 🌟 CHAT STREAM HEADER (WITH DETAILS BUTTON AT TOP RIGHT) */}
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

            {/* 🌟 Top Right Corner: Details Button & Message Count */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowInfoDrawer(true)}
                className="lg:hidden px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
              >
                <Info size={15} />
                <span>รายละเอียด</span>
              </button>

              <span className="hidden sm:inline-block text-xs font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {timeline.length} ข้อความ
              </span>
            </div>
          </div>

          {/* Chat Stream Messages (Scrollable) */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-4 p-3 sm:p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 custom-tab-scrollbar min-h-[360px] max-h-[440px] lg:max-h-[500px]"
          >
            {timeline.map((tl, i) => {
              const isMe = (tl.senderId && currentUser?.id && tl.senderId === currentUser.id) ||
                (tl.senderRole && role && tl.senderRole.toUpperCase() === role.toUpperCase()) ||
                (tl.senderName && currentUser?.fullName && tl.senderName === currentUser.fullName) ||
                (tl.senderName && currentUser?.name && tl.senderName === currentUser.name) ||
                (tl.isMe === true);

              const senderRoleText = (tl.senderRole === 'AUDITEE' || tl.role === 'AUDITEE') ? 'สาขา' : 'ผู้ตรวจ/QA';
              const senderDisplayName = isMe 
                ? `${currentUser?.fullName || currentUser?.name || tl.senderName || tl.who || "คุณ"} (${role === "AUDITEE" ? "สาขา" : "ผู้ตรวจ/QA"})`
                : `${tl.senderName || tl.who || "ผู้ใช้งาน"} (${senderRoleText})`;

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

                    {/* Attached Photo inside Bubble (Preserves natural aspect ratio without cropping) */}
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
                            alt="หลักฐานประกอบ" 
                            className="w-full max-h-72 sm:max-h-80 object-contain rounded-lg group-hover:scale-102 transition-transform duration-200" 
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Camera size={16} /> แตะเพื่อขยายรูปภาพ
                        </div>
                        <div className={`p-2 text-[11px] font-bold flex items-center gap-1.5 border-t ${
                          isMe ? 'border-white/10 text-emerald-100' : 'border-slate-200/80 text-slate-600'
                        }`}>
                          <Camera size={13} />
                          <span>รูปถ่ายหลักฐานการดำเนินการ</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
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
                  alt="Evidence Preview"
                  className="w-11 h-11 rounded-xl object-cover border border-emerald-400 shrink-0 shadow-2xs cursor-pointer"
                  onClick={() => setViewingPhoto(photoBase64)}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-900 truncate">แนบรูปถ่ายหลักฐานแล้ว</div>
                  <div className="text-[11px] text-emerald-700 font-medium truncate">แตะรูปเพื่อขยาย / พร้อมส่ง</div>
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
              title={isClosed ? "ตั๋วงานนี้ปิดแล้ว ไม่สามารถแนบรูปถ่ายได้" : "ถ่ายรูปหรือเลือกรูปจากเครื่อง"}
            >
              <Camera size={20} />
            </button>

            <input
              value={reply}
              disabled={isClosed}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isClosed) send(); }}
              placeholder={isClosed ? "ตั๋วงานนี้ได้รับการอนุมัติและปิดงานเรียบร้อยแล้ว (ไม่สามารถส่งข้อความได้)" : "พิมพ์ข้อความตอบกลับหรือรายงานผล..."}
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

          {/* 🌟 ONLY 1 BUTTON: APPROVE & CLOSE CAP (Visible only for QA / Admin / Standard when NOT closed) */}
          {role !== "AUDITEE" && !isClosed && (
            <div className="pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setConfirmModal({
                  isOpen: true,
                  type: 'approve',
                  title: 'ยืนยันการอนุมัติและปิดงาน (Approve & Close)',
                  message: 'คุณต้องการอนุมัติและปิดงานแก้ไข (CAP) นี้ให้สมบูรณ์ใช่หรือไม่? เมื่ออนุมัติแล้ว งานนี้จะเปลี่ยนสถานะเป็นเสร็จสมบูรณ์ทันที'
                })}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer text-white active:scale-98 bg-[#0F6659] hover:bg-[#0B4E44] transition-all shadow-md"
              >
                <CheckCircle2 size={18} />
                <span>อนุมัติและปิดงาน (Approve & Close)</span>
              </button>
            </div>
          )}

          {/* 🌟 SUCCESS BANNER: WHEN CAP IS CLOSED */}
          {isClosed && (
            <div className="pt-2 border-t border-slate-100">
              <div className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>ตั๋วงานนี้ได้รับการอนุมัติและปิดงานเรียบร้อยแล้ว</span>
              </div>
            </div>
          )}
        </div>

        {/* 👉 RIGHT COLUMN: PERMANENT DEFECT SUMMARY (lg:col-span-4 / Hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs sticky top-20">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <FileText size={16} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">ข้อมูลและสถานะตั๋วงาน</h3>
          </div>

          {renderDefectDetails()}
        </div>
      </div>

      {/* 📱 MOBILE SLIDE DRAWER / MODAL FOR DEFECT DETAILS */}
      {showInfoDrawer && (
        <ModalWrapper onClose={() => setShowInfoDrawer(false)} maxWidth="max-w-lg">
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Info size={16} />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">รายละเอียดข้อบกพร่อง</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {renderDefectDetails()}
          </div>
        </ModalWrapper>
      )}

      {/* 🖼️ PHOTO EXPAND MODAL */}
      {viewingPhoto && (
        <ModalWrapper onClose={() => setViewingPhoto(null)} maxWidth="max-w-2xl">
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Camera size={16} className="text-[#0F6659]" />
                <span>รูปถ่ายหลักฐานการแก้ไข (Evidence Photo)</span>
              </span>
              <button 
                type="button" 
                onClick={() => setViewingPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            <img src={getFullImageUrl(viewingPhoto)} alt="ขยายรูปภาพ" className="w-full h-80 sm:h-96 object-cover rounded-2xl border" />
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
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                  confirmModal.type === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#0F6659] hover:bg-emerald-800'
                }`}
              >
                {isActionProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>ยืนยันดำเนินการ</span>
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

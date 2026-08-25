import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  MessageSquare, Camera, Send, Check, X, AlertTriangle, Clock,
  ChevronLeft, ChevronRight, Info, ShieldAlert, Store, Calendar,
  CheckCircle2, Sparkles, ImagePlus, User, FileText, ArrowLeft
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { CAP_STATUS_MAP } from "../../config/constants";
import Header from "../../shared/Header";
import ModalWrapper from "../../shared/ModalWrapper";

export default function CapDetailScreen({ item, onBack }) {
  const [reply, setReply] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const chatContainerRef = useRef(null);

  const [timeline, setTimeline] = useState(() => {
    if (item.timeline && item.timeline.length > 0) {
      return item.timeline.map((t, idx) => ({
        ...t,
        isMe: idx % 2 !== 0 || t.who?.includes("สาขา") || t.who?.includes("คุณ"),
        photo: idx === 0 ? "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=60" : null
      }));
    }
    return [
      {
        who: "สมชาย ใจดี (ผู้ตรวจ)",
        text: "ตรวจพบคราบไขมันสะสมหลังเตาปรุงอาหาร ไม่ผ่านเกณฑ์มาตรฐาน SOP ข้อ 1 กรุณาขัดล้างทำความสะอาดและส่งหลักฐาน",
        time: "18 ส.ค. 09:30 น.",
        isMe: false,
        photo: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=60"
      },
      {
        who: "ผู้จัดการสาขา (สาขาสยาม)",
        text: "รับทราบปัญหาและแนวทาง SOP กำลังจัดทีมทำความสะอาดกะค่ำวันนี้ครับ",
        time: "18 ส.ค. 11:15 น.",
        isMe: true,
        photo: null
      },
    ];
  });

  const st = CAP_STATUS_MAP[item.status] || CAP_STATUS_MAP.pending;

  const send = () => {
    if (!reply.trim() && !hasPhoto) return;
    const newMsg = {
      who: "คุณ (ผู้จัดการสาขา)",
      text: reply.trim() || "ส่งรูปภาพหลักฐานการดำเนินการแก้ไขเรียบร้อยแล้วครับ",
      time: "เมื่อสักครู่",
      isMe: true,
      photo: hasPhoto ? "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=60" : null
    };
    setTimeline(prev => [...prev, newMsg]);
    setReply("");
    setHasPhoto(false);
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
            {item.desc || "พบคราบไขมันสะสมบริเวณพื้นหลังเตาปรุงอาหาร ไม่ผ่านเกณฑ์มาตรฐานความสะอาด ต้องทำความสะอาดและแนบรูปภาพหลังแก้ไข"}
          </p>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">สาขาที่ตรวจ</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">{item.unit}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">กำหนดส่งงาน</div>
          <div className="text-xs sm:text-sm font-extrabold text-rose-700 mt-0.5 truncate">{item.deadline || "ภายใน 24 ส.ค."}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">ผู้ตรวจประเมิน</div>
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">{item.auditor || "สมชาย ใจดี"}</div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-400">คะแนนรอบตรวจ</div>
          <div className="text-xs sm:text-sm font-extrabold text-amber-800 mt-0.5">{item.auditScore || 76}% (ตกเกณฑ์)</div>
        </div>
      </div>

      {/* Defect Photo Found during Audit */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
          <Camera size={14} className="text-slate-400" />
          <span>รูปถ่ายตอนตรวจพบปัญหา (Audit Finding)</span>
        </div>
        <div 
          onClick={() => setViewingPhoto("https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=60")}
          className="rounded-2xl overflow-hidden border border-slate-200 cursor-pointer relative group aspect-video bg-slate-100"
        >
          <img 
            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=60" 
            alt="ภาพตอนตรวจพบปัญหา" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
            <Camera size={15} /> แตะเพื่อดูรูปขยาย
          </div>
        </div>
      </div>


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
            onClick={handleApproveAndClose}
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
              const isMe = tl.isMe;
              return (
                <div 
                  key={i} 
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in`}
                >
                  {/* Sender Name & Time */}
                  <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`text-xs font-extrabold ${isMe ? 'text-[#0F6659]' : 'text-slate-700'}`}>
                      {tl.who}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{tl.time}</span>
                  </div>

                  {/* Chat Bubble */}
                  <div 
                    className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-semibold shadow-2xs max-w-[90%] sm:max-w-[82%] space-y-2.5 leading-relaxed ${
                      isMe
                        ? 'bg-[#0F6659] text-white rounded-tr-xs shadow-emerald-900/10'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{tl.text}</p>

                    {/* Attached Photo inside Bubble */}
                    {tl.photo && (
                      <div 
                        onClick={() => setViewingPhoto(tl.photo)}
                        className={`rounded-xl overflow-hidden border cursor-pointer hover:opacity-95 transition-opacity relative group ${
                          isMe ? 'border-white/20 bg-black/20' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <img 
                          src={tl.photo} 
                          alt="หลักฐานประกอบ" 
                          className="w-full h-40 sm:h-48 object-cover group-hover:scale-102 transition-transform duration-200" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Camera size={16} /> แตะเพื่อขยายรูปภาพ
                        </div>
                        <div className="p-2 text-[11px] font-bold flex items-center gap-1.5">
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

          {/* Photo Attachment Preview Banner */}
          {hasPhoto && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-extrabold text-emerald-950 animate-in fade-in shadow-2xs">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-[#0F6659]" />
                <span>แนบรูปถ่ายหลักฐานพร้อมส่ง (1 รูป)</span>
              </div>
              <button 
                type="button" 
                onClick={() => setHasPhoto(false)}
                className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setHasPhoto(!hasPhoto)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition-all border shadow-2xs active:scale-95 ${
                hasPhoto 
                  ? 'bg-emerald-100 text-[#0F6659] border-emerald-400 shadow-xs' 
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
              title="แนบรูปถ่ายหลักฐาน"
            >
              <Camera size={20} />
            </button>

            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="พิมพ์ข้อความตอบกลับหรือรายงานผล..."
              className="flex-1 text-xs sm:text-sm px-4 py-3.5 rounded-2xl outline-none font-bold bg-slate-50/70 border border-slate-200 shadow-2xs focus:bg-white focus:border-[#0F6659] transition-all text-slate-900 placeholder:text-slate-400"
            />

            <button 
              type="button"
              onClick={send} 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer shadow-md bg-[#0F6659] hover:bg-[#0B4E44] text-white active:scale-95 transition-all"
              title="ส่งข้อความ"
            >
              <Send size={18} />
            </button>
          </div>

          {/* 🌟 APPROVE & CLOSE CAP BUTTON UNDER CHAT */}
          {item.status !== "done" && (
            <div className="pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={onBack}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white active:scale-95 bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 transition-all"
              >
                <Check size={18} />
                <span>อนุมัติและปิดงานแก้ไข (Approve CAP)</span>
              </button>
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
            <img src={viewingPhoto} alt="ขยายรูปภาพ" className="w-full h-80 sm:h-96 object-cover rounded-2xl border" />
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}

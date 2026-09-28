import React, { useState, useMemo } from "react";
import { Check, AlertTriangle, RotateCcw, X, Smartphone, ArrowRightLeft, Eye, ChevronDown } from "lucide-react";
import api from "../../config/api";
import ModalWrapper from "../../shared/ModalWrapper";
import {
  NAV_MODULES_DICT,
  DEFAULT_ROLE_NAV_CONFIGS,
  validateNavSlots,
  getDefaultNavKeysForRole
} from "../../config/roles";

export default function RoleNavCustomizerModal({ role, onClose, onSaveSuccess }) {
  // Parse initial config
  const initialConfig = useMemo(() => {
    if (role?.navConfig && typeof role.navConfig === "object") {
      return {
        left: role.navConfig.left || "dashboard",
        center: role.navConfig.center || "audit",
        right: role.navConfig.right || "more"
      };
    }
    if (role?.navConfigJson) {
      try {
        const parsed = JSON.parse(role.navConfigJson);
        if (parsed && parsed.left && parsed.center && parsed.right) {
          return {
            left: parsed.left,
            center: parsed.center,
            right: parsed.right
          };
        }
      } catch (e) {}
    }
    const defaultForRole = getDefaultNavKeysForRole(role?.code);
    return { ...defaultForRole };
  }, [role]);

  const [slotConfig, setSlotConfig] = useState(initialConfig);
  const [activePreviewSlot, setActivePreviewSlot] = useState("center");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Validation Logic
  const validation = useMemo(() => {
    const { left, center, right } = slotConfig;
    const errors = {};
    const duplicates = [];

    if (!left) errors.left = "กรุณาเลือกโมดูลสำหรับปุ่มซ้าย";
    if (!center) errors.center = "กรุณาเลือกโมดูลสำหรับปุ่มหลักตรงกลาง";
    if (!right) errors.right = "กรุณาเลือกโมดูลสำหรับปุ่มขวา";

    if (left && center && left === center) duplicates.push({ slots: ["left", "center"], module: left });
    if (left && right && left === right) duplicates.push({ slots: ["left", "right"], module: left });
    if (center && right && center === right) duplicates.push({ slots: ["center", "right"], module: center });

    if (duplicates.length > 0) {
      duplicates.forEach(d => {
        d.slots.forEach(s => {
          const modName = NAV_MODULES_DICT[d.module]?.label || d.module;
          errors[s] = `โมดูล "${modName}" ถูกเลือกซ้ำกัน`;
        });
      });
    }

    const { isValid: basicValid, error: basicError } = validateNavSlots(left, center, right);
    const isValid = basicValid && Object.keys(errors).length === 0;
    return { isValid, errors, duplicates, basicError };
  }, [slotConfig]);

  // Handle slot change
  const handleSlotChange = (slotKey, newModuleKey) => {
    setSlotConfig(prev => ({
      ...prev,
      [slotKey]: newModuleKey
    }));
  };

  // Smart Auto-Swap for duplicates
  const handleAutoSwap = (slotA, slotB) => {
    setSlotConfig(prev => ({
      ...prev,
      [slotA]: prev[slotB],
      [slotB]: prev[slotA]
    }));
  };

  // Reset to default role preset
  const handleResetToDefault = () => {
    const defaultPreset = getDefaultNavKeysForRole(role?.code);
    setSlotConfig({ ...defaultPreset });
    setToastMessage({ type: "info", text: "รีเซ็ตค่าเป็นค่าเริ่มต้นของบทบาทเรียบร้อย" });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Save handler
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!validation.isValid) {
      setToastMessage({ type: "error", text: "กรุณาแก้ไขข้อผิดพลาดในการเลือกโมดูลก่อนบันทึก (ต้องไม่ซ้ำกันทั้ง 3 ช่อง)" });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        left: slotConfig.left,
        center: slotConfig.center,
        right: slotConfig.right
      };

      const response = await api.put(`/role/${role.id}/nav-config`, payload);
      
      setToastMessage({ type: "success", text: `✓ บันทึกการกำหนดแถบเมนูของ "${role.name}" สำเร็จ` });
      
      if (onSaveSuccess) {
        onSaveSuccess(response.data?.role || { ...role, navConfig: payload, navConfigJson: JSON.stringify(payload) }, payload);
      }
      
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error("Error saving role nav config:", err);
      const serverMsg = err.response?.data?.message || "บันทึกการกำหนดแถบเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
      setToastMessage({ type: "error", text: serverMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeModuleKey = slotConfig[activePreviewSlot] || slotConfig.center;
  const activeModule = NAV_MODULES_DICT[activeModuleKey] || NAV_MODULES_DICT.dashboard;

  const renderPhoneMockup = (isModal = false) => (
    <div className={`${
      isModal 
        ? "w-full max-w-[320px] sm:max-w-[340px] h-[550px] sm:h-[590px]" 
        : "w-[280px] sm:w-[290px] h-[500px] sm:h-[530px]"
    } rounded-[42px] border-[8px] border-slate-800 bg-slate-800 shadow-2xl relative flex flex-col overflow-hidden select-none shrink-0 ${isModal ? "my-auto" : ""}`}>
      
      {/* INSIDE MOCK APP SCREEN (Full Edge-to-Edge Canvas) */}
      <div className="flex-1 bg-[#F6F6F3] overflow-hidden flex flex-col relative">
        
        {/* Floating Top Dynamic Island / Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-center shadow-xs">
          <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-800 mr-2"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-950"></div>
        </div>

        {/* Top App Header with Status Bar (Seamless White going all the way to the top border) */}
        <div className="bg-white border-b border-slate-200 shrink-0 pt-2 pb-2.5 px-3 z-20 space-y-1.5">
          {/* Status Bar */}
          <div className="flex items-center justify-between text-[10px] text-slate-700 font-mono font-bold px-1">
            <span>09:00</span>
            <div className="flex items-center gap-1 text-slate-700">
              <span className="text-[9px]">5G</span>
              <div className="w-4 h-2 rounded-xs border border-slate-700 flex items-center p-0.5">
                <div className="w-full h-full bg-emerald-500 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Mini Top Bar */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#0F6659] text-white flex items-center justify-center text-[10px] font-black">
                Q
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-slate-900 leading-none">Q.S.C.</div>
                <div className="text-[9px] font-bold text-emerald-700 mt-0.5">{role?.name}</div>
              </div>
            </div>
            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[9px] font-bold">
              AU
            </div>
          </div>
        </div>

        {/* Mock Screen Content Reactive to Active Slot */}
        <div className="flex-1 p-2.5 overflow-y-auto space-y-2 pb-16">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                หน้าปัจจุบัน (Active View)
              </span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${activeModule.bgColor} ${activeModule.textColor}`}>
                {activeModule.label}
              </span>
            </div>
            <h4 className="text-xs font-black text-slate-900">{activeModule.label} ({activeModule.englishLabel})</h4>
            <p className="text-[10px] text-slate-500 leading-snug">{activeModule.desc}</p>
          </div>

          {/* Contextual mini mock cards */}
          {activeModuleKey === "dashboard" && (
            <div className="space-y-1.5">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[9px] font-bold text-emerald-800">คะแนนเฉลี่ยรวม</div>
                <div className="text-sm font-black text-[#0F6659]">94.8% (ผ่านเกณฑ์)</div>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-[10px] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>สาขาที่ตรวจแล้ว</span>
                  <span className="text-[#0F6659]">18/20 สาขา</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="w-[90%] h-full bg-[#0F6659]"></div>
                </div>
              </div>
            </div>
          )}

          {activeModuleKey === "audit" && (
            <div className="space-y-1.5">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[9px] font-bold text-emerald-800">งานตรวจหน้างานที่มอบหมาย</div>
                <div className="text-[11px] font-extrabold text-emerald-950">สาขา CTW - Central World</div>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-[10px] text-slate-600">
                ✓ 1. ความสะอาดบริเวณจุดบริการ<br />
                ✓ 2. อุณหภูมิตู้แช่วัตถุดิบ (&lt; 4°C)
              </div>
            </div>
          )}

          {activeModuleKey === "cap" && (
            <div className="space-y-1.5">
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-[9px] text-slate-700">
                <span className="font-bold text-slate-900">Auditor:</span> รบกวนส่งรูปแก้งานจุดที่ 3 ครับ
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-900 ml-3">
                <span className="font-bold">สาขา:</span> อัปโหลดรูปภาพแก้ไขเรียบร้อยแล้วครับ
              </div>
            </div>
          )}

          {activeModuleKey === "schedule" && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] space-y-1 text-emerald-900">
              <div className="font-bold">📅 แผนงานสัปดาห์นี้</div>
              <div>• จันทร์: สาขาพระราม 9</div>
              <div>• พุธ: สาขาสยามพารากอน</div>
            </div>
          )}

          {activeModuleKey === "forms" && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] space-y-1 text-emerald-900">
              <div className="font-bold">📋 แบบฟอร์มมาตรฐาน</div>
              <div>• เกณฑ์ตรวจ QSC ปี 2026 (50 ข้อ)</div>
            </div>
          )}

          {activeModuleKey === "reports" && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] space-y-1 text-emerald-900">
              <div className="font-bold">📊 รายงานวิเคราะห์</div>
              <div>• ส่งออกคะแนนรายสาขา (Excel)</div>
            </div>
          )}

          {activeModuleKey === "more" && (
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-[10px] space-y-1 text-slate-700">
              <div className="font-bold">⚙️ เมนูตั้งค่าระบบ</div>
              <div>• จัดการผู้ใช้งานและสิทธิ์</div>
            </div>
          )}
        </div>

        {/* 🌟 CURVED DYNAMIC BOTTOM NAVIGATION BAR */}
        <div className="absolute bottom-0 left-0 right-0 h-[56px] flex items-center justify-around px-2 z-20">
          {/* Elevated Curved Vector Background Path */}
          <svg
            className="absolute inset-0 w-full h-[76px] pointer-events-none -top-5 drop-shadow-[0_-3px_12px_rgba(0,0,0,0.08)]"
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

          {/* 1. Left Slot Item */}
          {(() => {
            const mod = NAV_MODULES_DICT[slotConfig.left] || NAV_MODULES_DICT.dashboard;
            const Icon = mod.icon;
            const active = activePreviewSlot === "left";
            return (
              <button
                type="button"
                onClick={() => setActivePreviewSlot("left")}
                className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer relative z-20 transition-all ${
                  active ? "text-[#0F6659] font-black" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[8.5px] mt-0.5 truncate max-w-[70px]">{mod.label}</span>
              </button>
            );
          })()}

          {/* 2. Center Slot Item (Primary Floating Action Button) */}
          {(() => {
            const mod = NAV_MODULES_DICT[slotConfig.center] || NAV_MODULES_DICT.audit;
            const Icon = mod.icon;
            const active = activePreviewSlot === "center";
            return (
              <div className="flex-1 flex flex-col items-center relative -top-3.5 z-20">
                <button
                  type="button"
                  onClick={() => setActivePreviewSlot("center")}
                  className={`w-[42px] h-[42px] rounded-full flex items-center justify-center text-white cursor-pointer bg-gradient-to-tr from-[#075A4E] via-[#0F6659] to-emerald-500 shadow-md shadow-emerald-950/30 active:scale-90 transition-all ${
                    active ? "ring-2 ring-emerald-400 shadow-lg scale-105" : "hover:scale-105"
                  }`}
                >
                  <Icon size={19} strokeWidth={2.5} />
                </button>
                <span className={`text-[8.5px] mt-0.5 truncate max-w-[70px] ${active ? "font-black text-[#0F6659]" : "font-bold text-slate-700"}`}>
                  {mod.label}
                </span>
              </div>
            );
          })()}

          {/* 3. Right Slot Item */}
          {(() => {
            const mod = NAV_MODULES_DICT[slotConfig.right] || NAV_MODULES_DICT.more;
            const Icon = mod.icon;
            const active = activePreviewSlot === "right";
            return (
              <button
                type="button"
                onClick={() => setActivePreviewSlot("right")}
                className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer relative z-20 transition-all ${
                  active ? "text-[#0F6659] font-black" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[8.5px] mt-0.5 truncate max-w-[70px]">{mod.label}</span>
              </button>
            );
          })()}
        </div>

      </div>
    </div>
  );

  return (
    <>
      <ModalWrapper onClose={onClose} maxWidth="max-w-5xl" closeOnBackdrop={false}>
        <div className="flex flex-col flex-1 min-h-0 bg-white rounded-3xl overflow-hidden shadow-2xl">
          
          {/* MODAL HEADER */}
          <div className="px-5 sm:px-6 pt-3 pb-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
            {/* แถวบน: ไอคอนมือถืออยู่ซ้ายสุด บรรทัดเดียวกับ preview และไอคอนปิด */}
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shadow-2xs">
                <Smartphone size={18} strokeWidth={2.2} />
              </div>

              <div className="flex items-center gap-2">
                {/* 📱 Mobile Preview Button (Visible ONLY on Small / Tablet Screens < lg) */}
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="กดเพื่อดูตัวอย่างหน้าจอมือถือจำลอง"
                >
                  <Eye size={14} className="text-[#0F6659]" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="ปิดหน้าต่าง"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* บรรทัดต่อมาเป็นชื่อ */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              ปรับแต่งแถบเมนูนำทาง (Dynamic Navigation)
            </h3>

            {/* บรรทัดต่อมาเป็น สำหรับบทบาท:{Code Role} */}
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              สำหรับบทบาท: <span className="font-bold text-slate-800">{role?.code}</span>{role?.name ? <span className="text-slate-500 font-normal"> ({role.name})</span> : null}
            </p>
          </div>

          {/* TOAST ALERT NOTIFICATION BANNER */}
          {toastMessage && (
            <div
              className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between transition-all shrink-0 ${
                toastMessage.type === "success"
                  ? "bg-emerald-600 text-white"
                  : toastMessage.type === "error"
                  ? "bg-rose-600 text-white"
                  : "bg-[#0F6659] text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                {toastMessage.type === "success" && <Check size={16} />}
                {toastMessage.type === "error" && <AlertTriangle size={16} />}
                <span>{toastMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-white/80 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* MODAL BODY (INDEPENDENT 2-COLUMN LAYOUT WITH PHONE PREVIEW PRIORITY) */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            
            {/* 👈 LEFT COLUMN: CONFIGURATION CONTROLS (Flex-1, shrinks first, independently scrollable) */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5 space-y-4 custom-tab-scrollbar">
              
              {/* Slot Configuration Form (3 SLOTS IN 1 HORIZONTAL ROW) */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    ตำแหน่งเมนู 3 ช่อง
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F6659] hover:underline cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>รีเซ็ตตามบทบาท</span>
                  </button>
                </div>

                {/* 3 SLOTS IN 1 ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
                  
                  {/* 1. LEFT SLOT SELECTOR */}
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/90 space-y-1.5 flex flex-col justify-between shadow-2xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ปุ่มซ้าย
                      </label>
                      <div className="relative">
                        <select
                          value={slotConfig.left}
                          onChange={(e) => handleSlotChange("left", e.target.value)}
                          className={`w-full text-xs sm:text-sm pl-3 pr-8 py-2.5 min-h-[48px] rounded-2xl border outline-none font-semibold text-slate-700 cursor-pointer appearance-none truncate transition-all shadow-xs ${
                            validation.errors.left
                              ? "border-rose-400 text-rose-800 bg-rose-50 ring-1 ring-rose-300"
                              : "border-slate-200 bg-slate-50 focus:border-[#0F6659] focus:bg-white"
                          }`}
                        >
                          {Object.values(NAV_MODULES_DICT).map((mod) => (
                            <option key={mod.key} value={mod.key}>
                              {mod.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    {validation.errors.left && (
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                        <AlertTriangle size={11} />
                        {validation.errors.left}
                      </p>
                    )}
                  </div>

                  {/* 2. CENTER SLOT SELECTOR (PRIMARY FAB HIGHLIGHT) */}
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border-2 border-emerald-500/60 space-y-1.5 flex flex-col justify-between shadow-xs relative overflow-hidden">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-black text-emerald-900 flex items-center gap-1">
                          ตรงกลาง
                        </label>
                      </div>
                      <div className="relative">
                        <select
                          value={slotConfig.center}
                          onChange={(e) => handleSlotChange("center", e.target.value)}
                          className={`w-full text-xs sm:text-sm pl-3 pr-8 py-2.5 min-h-[48px] rounded-2xl border outline-none font-semibold cursor-pointer appearance-none truncate transition-all shadow-xs ${
                            validation.errors.center
                              ? "border-rose-400 text-rose-800 bg-rose-50 ring-1 ring-rose-300"
                              : "border-emerald-400 text-[#0F6659] bg-white focus:border-[#0F6659] focus:ring-1 focus:ring-emerald-500"
                          }`}
                        >
                          {Object.values(NAV_MODULES_DICT).map((mod) => (
                            <option key={mod.key} value={mod.key}>
                              {mod.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
                      </div>
                    </div>
                    {validation.errors.center && (
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                        <AlertTriangle size={11} />
                        {validation.errors.center}
                      </p>
                    )}
                  </div>

                  {/* 3. RIGHT SLOT SELECTOR */}
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/90 space-y-1.5 flex flex-col justify-between shadow-2xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ปุ่มขวา
                      </label>
                      <div className="relative">
                        <select
                          value={slotConfig.right}
                          onChange={(e) => handleSlotChange("right", e.target.value)}
                          className={`w-full text-xs sm:text-sm pl-3 pr-8 py-2.5 min-h-[48px] rounded-2xl border outline-none font-semibold text-slate-700 cursor-pointer appearance-none truncate transition-all shadow-xs ${
                            validation.errors.right
                              ? "border-rose-400 text-rose-800 bg-rose-50 ring-1 ring-rose-300"
                              : "border-slate-200 bg-slate-50 focus:border-[#0F6659] focus:bg-white"
                          }`}
                        >
                          {Object.values(NAV_MODULES_DICT).map((mod) => (
                            <option key={mod.key} value={mod.key}>
                              {mod.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    {validation.errors.right && (
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                        <AlertTriangle size={11} />
                        {validation.errors.right}
                      </p>
                    )}
                  </div>

                </div>

                {/* DUPLICATE WARNING & AUTO-SWAP BANNER */}
                {validation.duplicates.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 mt-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-rose-900">ตรวจพบการเลือกโมดูลซ้ำกัน</h5>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          แถบเมนูต้องมีโมดูลไม่ซ้ำกันครบทั้ง 3 ช่อง
                        </p>
                      </div>
                    </div>
                    {validation.duplicates.map((dup, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAutoSwap(dup.slots[0], dup.slots[1])}
                        className="w-full py-1.5 px-3 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft size={13} />
                        <span>สลับตำแหน่ง ({dup.slots[0]} ⇄ {dup.slots[1]}) อัตโนมัติ</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Presets Recommendation */}
              {/*<div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-2xs">
                <span className="text-xs font-bold text-slate-700">แนะนำชุดเมนูตามบทบาทสากล (Best Practices):</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSlotConfig({ left: "dashboard", center: "audit", right: "more" })}
                    className="p-2 rounded-xl text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] transition-all cursor-pointer"
                  >
                    <div className="font-bold text-slate-800">สำหรับผู้ตรวจ (Auditor)</div>
                    <div className="text-slate-500 font-mono mt-0.5">ภาพรวม · ตรวจหน้างาน ★ · ระบบ</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotConfig({ left: "dashboard", center: "cap", right: "more" })}
                    className="p-2 rounded-xl text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] transition-all cursor-pointer"
                  >
                    <div className="font-bold text-slate-800">สำหรับสาขา (Store Manager)</div>
                    <div className="text-slate-500 font-mono mt-0.5">ภาพรวม · แชทแก้งาน ★ · ระบบ</div>
                  </button>
                </div>
              </div>*/}

              {/* Actions: Cancel & Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!validation.isValid || isSubmitting}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 ${
                    !validation.isValid || isSubmitting
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-[#0F6659] hover:bg-emerald-800 cursor-pointer shadow-emerald-900/20"
                  }`}
                >
                  {isSubmitting ? (
                    <span>กำลังบันทึก...</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>บันทึกการตั้งค่า</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 👉 RIGHT COLUMN: LOCKED / PINNED SMARTPHONE MINI-PREVIEW (Visible on Desktop >= lg) */}
            <div className="hidden lg:flex lg:w-[340px] xl:w-[360px] shrink-0 p-4 sm:p-5 bg-slate-50/70 border-l border-slate-200/90 flex-col items-center justify-center overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2.5">
                <Eye size={14} className="text-[#0F6659]" />
                <span>ภาพจำลองหน้าจอมือถือ (Live Preview)</span>
              </div>
              {renderPhoneMockup(false)}
            </div>

          </div>

        </div>
      </ModalWrapper>

      {/* 📱 POPUP MODAL FOR MOBILE PREVIEW (On Small Screens) */}
      {showPreviewModal && (
        <ModalWrapper onClose={() => setShowPreviewModal(false)} maxWidth="max-w-sm">
          <div className="flex flex-col items-center p-4 bg-slate-900 rounded-3xl relative overflow-hidden">
            <div className="w-full flex items-center justify-between pb-2 text-white mb-1 shrink-0">
              <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                <Smartphone size={15} />
                <span>Live Preview</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {renderPhoneMockup(true)}
          </div>
        </ModalWrapper>
      )}
    </>
  );
}

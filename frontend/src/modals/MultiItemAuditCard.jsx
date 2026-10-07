import React, { useState } from "react";
import { CheckCircle2, XCircle, Camera, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { getFullImageUrl } from "../config/api";

export default function MultiItemAuditCard({ 
  question, 
  value = {},
  onChange,
  onPhotoUpload,
  onPhotoDelete,
  readOnly = false,
  onViewPhoto
}) {
  // ควบคุมว่ากำลังคลี่ดูเมนูไหนอยู่ (default เปิดข้อแรก)
  const [expandedId, setExpandedId] = useState(question?.fieldConfig?.items?.[0]?.id || null);
  
  // รายการเมนู (สามารถกด + เพิ่มรายการ ต่อท้ายได้)
  const [itemList, setItemList] = useState(question?.fieldConfig?.items || []);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const criteria = question?.fieldConfig?.criteria || [
    { id: "decor", label: "การตกแต่ง" },
    { id: "taste", label: "รสชาติ" }
  ];

  // ฟังก์ชันอัปเดตคำตอบของแต่ละเมนู
  const handleItemChange = (itemId, field, val) => {
    if (readOnly) return;
    const currentItemVal = value[itemId] || { answers: {}, note: "", photos: [] };
    const nextItemVal = {
      ...currentItemVal,
      [field]: field === "answers" ? { ...currentItemVal.answers, ...val } : val
    };

    const nextValue = {
      ...value,
      [itemId]: nextItemVal
    };

    if (onChange) onChange(nextValue);
  };

  // ฟังก์ชันกดเพิ่มเมนูใหม่ (+ เพิ่มรายการ)
  const handleConfirmAddItem = () => {
    if (!newItemName?.trim()) {
      setIsAddingItem(false);
      return;
    }

    const newItemId = `item_${Date.now()}`;
    const nextList = [...itemList, { id: newItemId, name: newItemName.trim() }];
    setItemList(nextList);
    setExpandedId(newItemId);
    setNewItemName("");
    setIsAddingItem(false);
  };

  return (
    <div className="space-y-3 w-full">
      {itemList.map((item, index) => {
        const isExpanded = expandedId === item.id;
        const itemData = value[item.id] || { answers: {}, note: "", photos: [] };
        const answers = itemData.answers || {};

        // เช็คว่าเมนูนี้ตรวจไปบ้างหรือยัง
        const answeredCount = Object.keys(answers).length;
        const isUntested = answeredCount === 0;

        return (
          <div
            key={item.id}
            className={`rounded-3xl border transition-all duration-200 overflow-hidden bg-white ${
              isExpanded
                ? "border-[#0F6659] shadow-sm ring-1 ring-[#0F6659]/20"
                : "border-slate-200/90 shadow-2xs hover:border-slate-300"
            }`}
          >
            {/* Header เมนู: กดเพื่อ ยุบ / คลี่ */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="p-4 sm:p-4.5 flex items-start justify-between gap-3 cursor-pointer select-none"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </span>

                <div className="min-w-0 space-y-1.5">
                  <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                    {item.name}
                  </h4>

                  {/* Badge สรุปเกณฑ์ย่อยตอนพับ/คลี่ */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isUntested ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        ยังไม่ได้ตรวจ
                      </span>
                    ) : (
                      criteria.map((crit) => {
                        const ans = answers[crit.id];
                        if (ans === undefined) return null;
                        const isPass = ans === true || ans === "yes";
                        return (
                          <span
                            key={crit.id}
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                              isPass
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {crit.label} {isPass ? "ผ่าน" : "ไม่ผ่าน"}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="text-slate-400 shrink-0 mt-1">
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {/* ส่วนขยายเนื้อหาตรวจด้านใน (คลี่ออกมาเมื่อ isExpanded) */}
            {isExpanded && (
              <div className="px-4 pb-5 pt-1 space-y-4 border-t border-slate-100 animate-in fade-in duration-150">
                {/* 1. รายการเกณฑ์ตรวจย่อย (การตกแต่ง, รสชาติ) */}
                <div className="space-y-3 pt-2">
                  {criteria.map((crit) => {
                    const currentAns = answers[crit.id];
                    const isPass = currentAns === true;
                    const isFail = currentAns === false;

                    return (
                      <div key={crit.id} className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          {crit.label}
                        </label>

                        <div className="grid grid-cols-2 gap-2.5">
                          {/* ปุ่ม ผ่าน */}
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => handleItemChange(item.id, "answers", { [crit.id]: true })}
                            className={`py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-1.5 ${readOnly ? "cursor-default" : "cursor-pointer active:scale-95"} ${
                              isPass
                                ? "bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-400/20 shadow-2xs font-extrabold"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <CheckCircle2 size={16} className={isPass ? "text-emerald-700" : "text-slate-400"} />
                            <span>ผ่าน</span>
                          </button>

                          {/* ปุ่ม ไม่ผ่าน */}
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => handleItemChange(item.id, "answers", { [crit.id]: false })}
                            className={`py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-1.5 ${readOnly ? "cursor-default" : "cursor-pointer active:scale-95"} ${
                              isFail
                                ? "bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-400/20 shadow-2xs font-extrabold"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <XCircle size={16} className={isFail ? "text-rose-700" : "text-slate-400"} />
                            <span>ไม่ผ่าน</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. ช่องหมายเหตุ / ความคิดเห็น */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    หมายเหตุ / ความคิดเห็น
                  </label>
                  <textarea
                    rows={2}
                    readOnly={readOnly}
                    value={itemData.note || ""}
                    onChange={(e) => handleItemChange(item.id, "note", e.target.value)}
                    placeholder={readOnly ? "ไม่มีหมายเหตุเพิ่มเติม" : "ระบุข้อบกพร่อง หรือข้อคิดเห็นเพิ่มเติม..."}
                    className="w-full text-xs sm:text-sm p-3 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-[#0F6659] shadow-2xs resize-none"
                  />
                </div>

                {/* 3. รูปถ่ายหลักฐาน */}
                <div className="space-y-2">
                  {(() => {
                    const photosList = Array.isArray(itemData.photos) ? itemData.photos : (Array.isArray(itemData.imageUrls) ? itemData.imageUrls : []);
                    return (
                      <>
                        {photosList.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {photosList.map((pUrl, pIdx) => (
                              <div key={pIdx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                                <img
                                  src={getFullImageUrl ? getFullImageUrl(pUrl) : pUrl}
                                  alt={`หลักฐาน ${pIdx + 1}`}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => onViewPhoto && onViewPhoto(getFullImageUrl ? getFullImageUrl(pUrl) : pUrl)}
                                />
                                {!readOnly && onPhotoDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onPhotoDelete(item.id, pIdx); }}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!readOnly && (
                          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer active:scale-95 transition-all shadow-2xs">
                            <Camera size={15} className="text-slate-500" />
                            <span>แนบรูป (ถ้ามี)</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                if (onPhotoUpload) onPhotoUpload(item.id, e.target.files);
                              }}
                            />
                          </label>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ปุ่ม + เพิ่มรายการ ด้านล่างสุด */}
      {!readOnly && (
        isAddingItem ? (
          <div className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/40 space-y-2.5 animate-in fade-in duration-150">
            <label className="text-xs font-extrabold text-[#0F6659] block">
              ระบุชื่อเมนู / รายการตรวจใหม่
            </label>
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmAddItem();
                if (e.key === "Escape") { setIsAddingItem(false); setNewItemName(""); }
              }}
              placeholder="เช่น ชาไทยเย็น, ข้าวผัดกะเพรา..."
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#0F6659] text-slate-800"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsAddingItem(false); setNewItemName(""); }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmAddItem}
                className="px-3.5 py-1.5 rounded-xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold cursor-pointer"
              >
                เพิ่มรายการ
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingItem(true)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-[#0F6659] bg-emerald-50/40 hover:bg-emerald-50 text-xs sm:text-sm font-black text-[#0F6659] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
          >
            <Plus size={16} />
            <span>เพิ่มรายการ</span>
          </button>
        )
      )}
    </div>
  );
}
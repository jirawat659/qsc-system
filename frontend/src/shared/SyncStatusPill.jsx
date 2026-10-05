import React from "react";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";

/**
 * 🌟 SyncStatusPill - คอมโพเนนต์แสดงสถานะการบันทึกข้อมูลแบบ Animated Pill
 * รองรับการกดสลับแสดงผลระหว่างคำว่า 'Synced' กับเวลา 'HH:mm'
 *
 * @param {string} syncStatus - สถานะปัจจุบัน: "idle" | "saving" | "synced" | "error"
 * @param {boolean} showSaveTime - สลับโหมดแสดงเวลา (true = แสดงเวลา, false = แสดง Synced)
 * @param {string} lastSavedTime - ข้อความเวลา เช่น "14:05"
 * @param {function} onToggle - ฟังก์ชันเมื่อคลิกปุ่ม
 * @param {string} className - คลาส Tailwind เพิ่มเติมสำหรับปรับแต่งตำแหน่ง/ขนาด
 */
const SyncStatusPill = React.memo(function SyncStatusPill({
    syncStatus = "idle",
    showSaveTime = false,
    lastSavedTime = "",
    onToggle,
    className = ""
}) {
    if (syncStatus === "idle") return null;

    return (
        <button
            type="button"
            onClick={onToggle}
            title={showSaveTime ? "แตะเพื่อดูสถานะ Synced" : "แตะเพื่อดูเวลาที่บันทึกล่าสุด"}
            className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold shrink-0 select-none cursor-pointer transition-all duration-200 active:scale-95 shadow-2xs hover:shadow-sm ${syncStatus === "saving"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : syncStatus === "error"
                        ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        : "bg-emerald-50 text-[#0F6659] border-emerald-200 hover:bg-emerald-100"
                } ${className}`}
        >
            {/* 1. จุดแสดงไอคอนแบบหมุนสลับ */}
            <span className="relative w-3.5 h-3.5 inline-grid place-items-center shrink-0">
                {syncStatus === "saving" ? (
                    <Loader2 size={13} className="animate-spin text-amber-600" />
                ) : syncStatus === "error" ? (
                    <AlertCircle size={13} className="text-rose-600" />
                ) : (
                    <>
                        <CheckCircle2
                            size={13}
                            className={`col-start-1 row-start-1 text-[#0F6659] transition-all duration-200 ease-out ${!showSaveTime
                                    ? "opacity-100 scale-100 rotate-0"
                                    : "opacity-0 scale-50 rotate-45 pointer-events-none"
                                }`}
                        />
                        <Clock
                            size={13}
                            className={`col-start-1 row-start-1 text-[#0F6659] transition-all duration-200 ease-out ${showSaveTime
                                    ? "opacity-100 scale-100 rotate-0"
                                    : "opacity-0 scale-50 -rotate-45 pointer-events-none"
                                }`}
                        />
                    </>
                )}
            </span>

            {/* 2. จุดแสดงข้อความ Crossfade แบบ Dual-face พร้อมฟิลเตอร์ Blur */}
            <span className="relative inline-grid grid-cols-[max-content] items-center leading-none">
                {syncStatus === "saving" ? (
                    <span>กำลังบันทึก...</span>
                ) : syncStatus === "error" ? (
                    <span>บันทึกไม่สำเร็จ</span>
                ) : (
                    <>
                        <span
                            className={`col-start-1 row-start-1 tracking-tight transition-all duration-200 ease-out ${!showSaveTime
                                    ? "opacity-100 blur-0 scale-100 translate-y-0"
                                    : "opacity-0 blur-[2px] scale-95 translate-y-1 pointer-events-none"
                                }`}
                        >
                            Synced
                        </span>

                        <span
                            className={`col-start-1 row-start-1 font-mono tracking-tight transition-all duration-200 ease-out ${showSaveTime
                                    ? "opacity-100 blur-0 scale-100 translate-y-0"
                                    : "opacity-0 blur-[2px] scale-95 -translate-y-1 pointer-events-none"
                                }`}
                        >
                            {lastSavedTime || "บันทึกแล้ว"}
                        </span>
                    </>
                )}
            </span>
        </button>
    );
});

export default SyncStatusPill;
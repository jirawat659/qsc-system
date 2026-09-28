import React from "react";
import {
  X, FileText, Hash, Table, ChevronDownSquare, CircleDot, CheckSquare, Calendar, Clock, UserCheck, Sparkles, CheckCircle2, Sliders
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";

export const ALL_FIELD_TYPES = [
  {
    type: "yesno",
    label: "ผ่าน / ไม่ผ่าน (Yes / No)",
    desc: "คำถามตรวจประเมินมาตรฐาน",
    icon: CheckCircle2,
    color: "emerald",
    isScoredDefault: true
  },
  {
    type: "scale",
    label: "คะแนน 1-5 (Scale)",
    desc: "คำถามประเมินคะแนนตามอัตราส่วน",
    icon: Sliders,
    color: "teal",
    isScoredDefault: true
  },
  {
    type: "grid",
    label: "ตารางข้อมูล (Grid)",
    desc: "ตารางแถวและคอลัมน์ การรวมยอดอัตโนมัติ",
    icon: Table,
    color: "emerald"
  },
  {
    type: "number",
    label: "ตัวเลข (Number)",
    desc: "กรอกตัวเลข ระบุหน่วย",
    icon: Hash,
    color: "teal"
  },
  {
    type: "text",
    label: "ข้อความ (Text)",
    desc: "ช่องกรอกรายละเอียด หรือหมายเหตุทั่วไป",
    icon: FileText,
    color: "slate"
  },
  {
    type: "select",
    label: "รายการเลือก (Dropdown)",
    desc: "เมนูแบบ Dropdown",
    icon: ChevronDownSquare,
    color: "sky"
  },
  {
    type: "radio",
    label: "ตัวเลือกเดียว (Radio)",
    desc: "ปุ่มวงกลมเลือกเพียง 1 ข้อในกลุ่ม",
    icon: CircleDot,
    color: "indigo"
  },
  {
    type: "checkbox",
    label: "หลายตัวเลือก (Checkbox)",
    desc: "กล่องสี่เหลี่ยมเลือกได้หลายตัวเลือกพร้อมกัน",
    icon: CheckSquare,
    color: "violet"
  },
  {
    type: "date",
    label: "วันที่ (Date)",
    desc: "ปฏิทินเลือก วัน/เดือน/ปี",
    icon: Calendar,
    color: "amber"
  },
  {
    type: "time",
    label: "เวลา (Time)",
    desc: "นาฬิการะบุเวลา",
    icon: Clock,
    color: "orange"
  },
  {
    type: "auditor",
    label: "ผู้ตรวจประเมิน (Auditor)",
    desc: "เลือกระบุรายชื่อผู้ตรวจประเมินจากระบบ",
    icon: UserCheck,
    color: "emerald"
  }
];

export const NON_SCORED_FIELD_TYPES = ALL_FIELD_TYPES;

export default function FieldTypeSelectModal({ isOpen, onClose, onSelectType }) {
  if (!isOpen) return null;

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl" closeOnBackdrop={true}>
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                เลือกประเภทคำถาม
              </h3>
              <p className="text-xs text-slate-500">
                เลือกรูปแบบข้อคำถามสำหรับการตรวจ หรือประเภทข้อมูลที่ต้องการบันทึก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - Grid of Field Types */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NON_SCORED_FIELD_TYPES.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.type}
                  type="button"
                  onClick={() => {
                    onSelectType(f.type);
                    onClose();
                  }}
                  className="group relative p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 text-left transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-sm active:scale-[0.99] flex items-start gap-3"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    f.type === "grid"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-[#0F6659]"
                  }`}>
                    <Icon size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#0F6659] transition-colors truncate">
                        {f.label}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
                      {f.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}


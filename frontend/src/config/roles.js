import {
  LayoutDashboard, Plus, MoreHorizontal, History as HistoryIcon,
  MessageSquare, ClipboardCheck, CalendarDays, Settings, ClipboardList
} from "lucide-react";

export const ROLES = [
  { id: "STANDARD", label: "ผู้ดูแลมาตรฐาน (QA)", desc: "จัดการเกณฑ์ ตาราง และฟอร์ม" },
  { id: "AUDITOR", label: "ผู้ตรวจ (QC, Area)", desc: "ตรวจหน้างาน บันทึกผลตามขั้นตอน" },
  { id: "AUDITEE", label: "ผู้รับการตรวจ (Store)", desc: "ดูผลคะแนนสาขาตนเองและส่งหลักฐานแก้งาน" },
  { id: "EXEC", label: "ผู้บริหาร", desc: "ดูภาพรวมวิเคราะห์ความเสี่ยงระดับองค์กร" },
  { id: "ADMIN", label: "ผู้ดูแลระบบ", desc: "จัดการสิทธิ์ โครงสร้าง และระบบเชื่อมต่อ" },
];

export const NAV_BY_ROLE = {
  // Navigation is unified: "ภาพรวม" (Dashboard) is consistently the first tab across all roles.
  STANDARD: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "audit", label: "ตรวจหน้างาน", icon: Plus, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  AUDITOR: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "audit", label: "ตรวจหน้างาน", icon: Plus, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  AUDITEE: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "cap", label: "แชทแก้งาน", icon: MessageSquare, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  EXEC: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "schedule", label: "ตารางตรวจ", icon: CalendarDays, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  ADMIN: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "more", label: "จัดการระบบ", icon: Settings, isPrimary: true },
    { key: "forms", label: "ฟอร์ม", icon: ClipboardList },
  ],
};

export const ROLE_USER_MAP = {
  STANDARD: { name: "กานดา มาตรฐาน", title: "Lead Standards & QA Director", avatar: "กาน" },
  AUDITOR: { name: "สมชาย ใจดี", title: "QA Field Auditor", avatar: "สม" },
  AUDITEE: { name: "สมศักดิ์ ผู้จัดการสาขา", title: "Store Manager (สาขาสยาม)", avatar: "ศักดิ์" },
  EXEC: { name: "David Chen", title: "Chief Operations Officer (COO)", avatar: "DC" },
  ADMIN: { name: "Alex Rivera", title: "System Administrator & IT Head", avatar: "AR" },
};

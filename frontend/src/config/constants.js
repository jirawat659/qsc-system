import { Eye, Zap, EyeOff } from "lucide-react";
import { c } from "./theme";

export const TODAY = 18;

export const AUDIT_TYPES = [
  { id: "announced", label: "แจ้งล่วงหน้า", icon: Eye },
  { id: "spot", label: "กระทันหัน", icon: Zap },
  { id: "undercover", label: "ปลอมตัวเข้าตรวจ", icon: EyeOff },
];

export const AUDIT_TYPE_META = {
  announced: { label: "แจ้งล่วงหน้า", fg: c.accent, bg: c.accentSoft },
  spot: { label: "ตรวจกระทันหัน", fg: c.warn, bg: c.warnSoft },
  undercover: { label: "ปลอมตัวเข้าตรวจ", fg: c.risk, bg: c.riskSoft },
};

export const CAP_STATUS_MAP = {
  pending: { label: "รอส่งมอบงานแก้ไข", fg: c.warn, bg: c.warnSoft },
  submitted: { label: "ส่งมอบหลักฐานแล้ว (รอตรวจ)", fg: c.accent, bg: c.accentSoft },
  done: { label: "ตรวจสอบผ่าน/ปิดงานแล้ว", fg: c.accent, bg: c.accentSoft },
};

export const REGION_LINES = [
  { key: "BKK",   label: "กทม.",       color: "#0F6659" },
  { key: "North", label: "ภาคเหนือ",   color: "#2563EB" },
  { key: "East",  label: "ตะวันออก",   color: "#D97706" },
  { key: "NE",    label: "อีสาน",      color: "#7C3AED" },
  { key: "South", label: "ภาคใต้",     color: "#DB2777" },
];

export const BRAND_LINES = [
  { key: "Brand A", label: "แบรนด์ A", color: "#0F6659" },
  { key: "Brand B", label: "แบรนด์ B", color: "#2563EB" },
  { key: "Brand C", label: "แบรนด์ C", color: "#D97706" },
];

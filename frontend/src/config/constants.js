import { Eye, Zap, EyeOff } from "lucide-react";
import { c } from "./theme";

export const TODAY = new Date().getDate();

export const AUDIT_TYPES = [
  { id: "announced", key: "announced", label: "ตามกำหนดการ", icon: Eye },
  { id: "unannounced", key: "unannounced", label: "นอกกำหนดการ", icon: Zap },
  { id: "undercover", key: "undercover", label: "ปลอมตัว", icon: EyeOff },
];

export const AUDIT_TYPE_META = {
  announced: { label: "ตามกำหนดการ", fg: c.accent, bg: c.accentSoft },
  unannounced: { label: "นอกกำหนดการ", fg: c.warn, bg: c.warnSoft },
  spot: { label: "นอกกำหนดการ", fg: c.warn, bg: c.warnSoft },
  undercover: { label: "ปลอมตัว", fg: c.risk, bg: c.riskSoft },
};

export const CAP_STATUS_MAP = {
  pending: { label: "กำลังแก้ไขงาน (แชทติดตามผล)", fg: "#D97706", bg: "#FFFBEB" },
  in_progress: { label: "กำลังแก้ไขงาน (แชทติดตามผล)", fg: "#D97706", bg: "#FFFBEB" },
  submitted: { label: "กำลังแก้ไขงาน (แชทติดตามผล)", fg: "#059669", bg: "#ECFDF5" },
  rejected: { label: "กำลังแก้ไขงาน (แชทติดตามผล)", fg: "#E11D48", bg: "#FFF1F2" },
  done: { label: "อนุมัติและปิดงานแล้ว", fg: "#059669", bg: "#D1FAE5" },
  approved: { label: "อนุมัติและปิดงานแล้ว", fg: "#059669", bg: "#D1FAE5" },
  closed: { label: "อนุมัติและปิดงานแล้ว", fg: "#059669", bg: "#D1FAE5" },
  cancelled: { label: "ยกเลิกงาน (แก้ไขเป็นผ่าน)", fg: "#64748B", bg: "#F1F5F9" },
  CANCELLED: { label: "ยกเลิกงาน (แก้ไขเป็นผ่าน)", fg: "#64748B", bg: "#F1F5F9" },
};

// Color Palette for dynamic Brands & Regions in Charts
export const CHART_PALETTE = [
  "#0F6659", // Deep Emerald
  "#2563EB", // Royal Blue
  "#D97706", // Warm Amber
  "#7C3AED", // Vivid Purple
  "#DB2777", // Pink Rose
  "#059669", // Vibrant Emerald
  "#EA580C", // Rich Orange
  "#0284C7", // Sky Blue
  "#4F46E5", // Indigo
  "#E11D48", // Crimson
];

export const DEFAULT_REGION_LINES = [
  { key: "กรุงเทพฯ และปริมณฑล", label: "กทม. & ปริมณฑล", color: "#0F6659" },
  { key: "ภาคเหนือ", label: "ภาคเหนือ", color: "#2563EB" },
  { key: "ภาคตะวันออก", label: "ภาคตะวันออก", color: "#D97706" },
  { key: "ภาคตะวันออกเฉียงเหนือ", label: "ภาคอีสาน", color: "#7C3AED" },
  { key: "ภาคใต้", label: "ภาคใต้", color: "#DB2777" },
  { key: "ภาคกลาง", label: "ภาคกลาง", color: "#059669" },
];

export const DEFAULT_BRAND_LINES = [
  { key: "Urban Burger", label: "Urban Burger", color: "#0F6659" },
  { key: "Cafe Luna", label: "Cafe Luna", color: "#2563EB" },
  { key: "Artisan Bakery", label: "Artisan Bakery", color: "#D97706" },
  { key: "Central Supply", label: "Central Supply", color: "#7C3AED" },
  { key: "QSC Holding", label: "QSC Holding", color: "#059669" },
];

export const REGION_LINES = DEFAULT_REGION_LINES;
export const BRAND_LINES = DEFAULT_BRAND_LINES;

/**
 * 🌟 Dynamically extract distinct Brand lines from database locations list
 * If new brands are added in database, they will automatically appear with auto-assigned palette colors.
 */
export const getDynamicBrandLines = (locations = []) => {
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return DEFAULT_BRAND_LINES;
  }
  const brandNames = [];
  locations.forEach(l => {
    if (l.locationBrands && Array.isArray(l.locationBrands)) {
      l.locationBrands.forEach(lb => {
        const name = lb.brand?.name || lb.brandName;
        if (name) brandNames.push(name);
      });
    } else if (l.brand) {
      brandNames.push(typeof l.brand === 'object' ? l.brand.name : l.brand);
    }
  });
  const distinctBrands = [...new Set(brandNames.filter(Boolean))];
  if (distinctBrands.length === 0) return DEFAULT_BRAND_LINES;

  return distinctBrands.map((brand, idx) => {
    // Preserve default known colors if available
    const existing = DEFAULT_BRAND_LINES.find(b => b.key.toLowerCase() === brand.toLowerCase());
    return {
      key: brand,
      label: brand,
      color: existing ? existing.color : CHART_PALETTE[idx % CHART_PALETTE.length]
    };
  });
};

/**
 * 🌟 Dynamically extract distinct Region lines from database locations list
 */
export const getDynamicRegionLines = (locations = []) => {
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return DEFAULT_REGION_LINES;
  }
  const distinctRegions = [...new Set(locations.map(l => l.region).filter(Boolean))];
  if (distinctRegions.length === 0) return DEFAULT_REGION_LINES;

  return distinctRegions.map((region, idx) => {
    const existing = DEFAULT_REGION_LINES.find(r => r.key.toLowerCase() === region.toLowerCase());
    let label = region;
    if (region.includes("กรุงเทพ")) label = "กทม.";
    else if (region.includes("เฉียงเหนือ") || region.includes("อีสาน")) label = "อีสาน";
    else if (region.includes("กลาง")) label = "ภาคกลาง";
    else if (region.includes("เหนือ")) label = "ภาคเหนือ";
    else if (region.includes("ตะวันออก")) label = "ตะวันออก";
    else if (region.includes("ใต้")) label = "ภาคใต้";

    return {
      key: region,
      label: label,
      color: existing ? existing.color : CHART_PALETTE[idx % CHART_PALETTE.length]
    };
  });
};

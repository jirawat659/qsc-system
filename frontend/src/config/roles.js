import { 
  LayoutDashboard, 
  ClipboardCheck, 
  CalendarDays, 
  FileText, 
  AlertCircle, 
  BarChart3, 
  MoreHorizontal, 
  Plus, 
  Settings, 
  MessageSquare,
  Layers,
  Store,
  UserCheck,
  Key
} from "lucide-react";

export const ROLES = [
  { id: "STANDARD", label: "ผู้ดูแลมาตรฐาน", desc: "จัดการเกณฑ์ ตาราง และฟอร์ม" },
  { id: "AUDITOR", label: "ผู้ตรวจประเมิน", desc: "ตรวจหน้างาน บันทึกผลตามขั้นตอน" },
  { id: "AUDITEE", label: "ผู้จัดการสาขา", desc: "ดูผลคะแนนสาขาตนเองและส่งหลักฐานแก้งาน" },
  { id: "EXEC", label: "ผู้บริหาร", desc: "ดูภาพรวมวิเคราะห์ความเสี่ยงระดับองค์กร" },
  { id: "ADMIN", label: "ผู้ดูแลระบบ", desc: "จัดการสิทธิ์ โครงสร้าง และระบบเชื่อมต่อ" },
];

// 🌟 MASTER DICTIONARY: 7 CORE MODULES
export const NAV_MODULES_DICT = {
  dashboard: {
    key: "dashboard",
    label: "ภาพรวม",
    labelEn: "Overview & KPI Metrics",
    englishLabel: "Dashboard",
    desc: "สรุปภาพรวมและสถิติ KPI ระดับองค์กร",
    icon: LayoutDashboard,
    defaultRoute: "dashboard",
    color: "#0F6659",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    category: "core",
  },
  audit: {
    key: "audit",
    label: "ตรวจหน้างาน",
    labelEn: "QSC Audit Checklists",
    englishLabel: "Audit",
    desc: "ตรวจประเมินและบันทึกผลตามรายการมาตรฐาน",
    icon: ClipboardCheck,
    primaryIcon: Plus,
    defaultRoute: "audit",
    color: "#0F6659",
    bgColor: "bg-teal-50",
    textColor: "text-teal-700",
    category: "core",
  },
  schedule: {
    key: "schedule",
    label: "ตารางตรวจ",
    labelEn: "Inspection Schedules & Calendar",
    englishLabel: "Schedule",
    desc: "แผนนัดหมายและปฏิทินการตรวจสาขา",
    icon: CalendarDays,
    defaultRoute: "schedule",
    color: "#0284C7",
    bgColor: "bg-sky-50",
    textColor: "text-sky-700",
    category: "core",
  },
  forms: {
    key: "forms",
    label: "แบบฟอร์ม",
    labelEn: "Checklist Templates & Forms",
    englishLabel: "Forms",
    desc: "จัดการแม่แบบและเกณฑ์การตรวจประเมิน",
    icon: FileText,
    defaultRoute: "forms",
    color: "#7C3AED",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    category: "core",
  },
  cap: {
    key: "cap",
    label: "แชทแก้งาน",
    labelEn: "Corrective Action Plans & Defect Tracking",
    englishLabel: "CAP Chat",
    desc: "ติดตามจุดบกพร่องและแผนงานแก้ไข CAP",
    icon: AlertCircle,
    chatIcon: MessageSquare,
    defaultRoute: "cap",
    color: "#EA580C",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    category: "core",
  },
  reports: {
    key: "reports",
    label: "รายงานผล",
    labelEn: "Executive & Consolidated Reports",
    englishLabel: "Reports",
    desc: "รายงานผลการตรวจสรุปและวิเคราะห์เชิงลึก",
    icon: BarChart3,
    defaultRoute: "reports",
    color: "#2563EB",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    category: "core",
  },
  more: {
    key: "more",
    label: "ระบบ",
    labelEn: "Settings & Master Management",
    englishLabel: "System",
    desc: "การตั้งค่าระบบและการจัดการข้อมูลหลัก",
    icon: MoreHorizontal,
    settingsIcon: Settings,
    defaultRoute: "more",
    color: "#475569",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
    category: "core",
  },
};

export const DEFAULT_ROLE_NAV_KEYS = {
  ADMIN: { left: "dashboard", center: "more", right: "audit" },
  AUDITOR: { left: "dashboard", center: "audit", right: "more" },
  AUDITEE: { left: "dashboard", center: "cap", right: "more" },
  STORE_MANAGER: { left: "dashboard", center: "cap", right: "more" },
  STANDARD: { left: "dashboard", center: "audit", right: "more" },
  AREA_MANAGER: { left: "dashboard", center: "audit", right: "more" },
  EXEC: { left: "dashboard", center: "schedule", right: "more" },
  EXECUTIVE: { left: "dashboard", center: "schedule", right: "more" },
};

export const DEFAULT_ROLE_NAV_CONFIGS = DEFAULT_ROLE_NAV_KEYS;

/**
 * Validates 3 navigation slots
 * @param {string} left
 * @param {string} center
 * @param {string} right
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateNavSlots(left, center, right) {
  if (!left || !center || !right) {
    return {
      isValid: false,
      error: "กรุณาระบุตำแหน่งเมนูให้ครบทั้ง 3 ช่อง (left, center, right)",
    };
  }

  const l = String(left).trim().toLowerCase();
  const c = String(center).trim().toLowerCase();
  const r = String(right).trim().toLowerCase();

  if (!NAV_MODULES_DICT[l] || !NAV_MODULES_DICT[c] || !NAV_MODULES_DICT[r]) {
    return {
      isValid: false,
      error: "โมดูลที่เลือกไม่ถูกต้อง ต้องเป็นหนึ่งใน 7 โมดูลหลัก",
    };
  }

  if (l === c || l === r || c === r) {
    return {
      isValid: false,
      error: "ตำแหน่งแถบเมนูต้องไม่ซ้ำกัน (Slots must contain distinct valid modules)",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Gets default 3-slot keys for role code
 * @param {string} roleCode
 * @returns {{ left: string, center: string, right: string }}
 */
export function getDefaultNavKeysForRole(roleCode) {
  const normalized = (roleCode || "AUDITOR").trim().toUpperCase();
  return (
    DEFAULT_ROLE_NAV_KEYS[normalized] || {
      left: "dashboard",
      center: "audit",
      right: "more",
    }
  );
}

/**
 * Resolves full 3-item navigation array with slot metadata and automatic center primary FAB styling
 * @param {string} role
 * @param {object|string} userNavConfig
 * @returns {Array<object>}
 */
export function getRoleNavConfig(role, userNavConfig) {
  let activeKeys = null;

  if (userNavConfig) {
    let parsedConfig = userNavConfig;
    if (typeof userNavConfig === "string") {
      try {
        parsedConfig = JSON.parse(userNavConfig);
      } catch {
        parsedConfig = null;
      }
    }

    if (
      parsedConfig &&
      typeof parsedConfig === "object" &&
      validateNavSlots(parsedConfig.left, parsedConfig.center, parsedConfig.right).isValid
    ) {
      activeKeys = {
        left: String(parsedConfig.left).trim().toLowerCase(),
        center: String(parsedConfig.center).trim().toLowerCase(),
        right: String(parsedConfig.right).trim().toLowerCase(),
      };
    }
  }

  if (!activeKeys) {
    activeKeys = getDefaultNavKeysForRole(role);
  }

  const leftItem = NAV_MODULES_DICT[activeKeys.left] || NAV_MODULES_DICT.dashboard;
  const centerItem = NAV_MODULES_DICT[activeKeys.center] || NAV_MODULES_DICT.audit;
  const rightItem = NAV_MODULES_DICT[activeKeys.right] || NAV_MODULES_DICT.more;

  return [
    {
      ...leftItem,
      slot: "left",
      isPrimary: false,
    },
    {
      ...centerItem,
      slot: "center",
      isPrimary: true, // Center slot is automatically Primary Floating Action Button
    },
    {
      ...rightItem,
      slot: "right",
      isPrimary: false,
    },
  ];
}

/**
 * Gets default nav array for a role
 * @param {string} roleCode
 * @returns {Array<object>}
 */
export function getDefaultNavForRole(roleCode) {
  const keys = getDefaultNavKeysForRole(roleCode);
  return getRoleNavConfig(roleCode, keys);
}

// Backward compatibility export
export const NAV_BY_ROLE = {
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
    { key: "cap", label: "แชทแก้งาน", icon: AlertCircle, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  EXEC: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "schedule", label: "ตารางตรวจ", icon: CalendarDays, isPrimary: true },
    { key: "more", label: "ระบบ", icon: MoreHorizontal },
  ],
  ADMIN: [
    { key: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { key: "more", label: "ระบบ", icon: MoreHorizontal, isPrimary: true },
    { key: "audit", label: "ตรวจหน้างาน", icon: ClipboardCheck },
  ],
};

// 🌟 MASTER SYSTEM TOOLS DICTIONARY
export const SYSTEM_TOOLS = [
  {
    key: "master_management",
    icon: Layers,
    label: "การจัดการข้อมูลหลัก",
    fullLabel: "การจัดการระบบและข้อมูลหลัก",
    desc: "จัดการข้อมูลผู้ใช้งาน, เพิ่มสถานที่/สาขา และประเภทสถานที่",
    perm: "menu.admin",
    roles: ["ADMIN"],
    group: "system"
  },
  {
    key: "reports",
    icon: BarChart3,
    label: "รายงานผลการตรวจ",
    desc: "ดูผลตรวจรายครั้งในตาราง กรองข้อมูล และส่งออก Excel",
    route: "reports",
    perm: "menu.analytics",
    roles: ["STANDARD", "EXEC", "ADMIN"],
    group: "workflow"
  },
  {
    key: "schedule",
    icon: CalendarDays,
    label: "แผนการตรวจ",
    desc: "ดูแผนตรวจและสาขาที่ถูกมอบหมายให้ผู้ตรวจ",
    route: "schedule",
    perm: "menu.schedules",
    roles: ["STANDARD", "ADMIN", "AUDITOR", "EXEC"],
    group: "workflow"
  },
  {
    key: "forms",
    icon: FileText,
    label: "จัดการแบบฟอร์ม",
    fullLabel: "จัดการแบบฟอร์มการตรวจ",
    desc: "สร้าง แก้ไข และกำหนดเกณฑ์สำหรับแบบฟอร์มตรวจประเมิน",
    route: "forms",
    perm: "menu.forms",
    roles: ["STANDARD", "ADMIN", "EXEC"],
    group: "workflow"
  },
  { 
    key: "cap",
    icon: AlertCircle,
    label: "แชทแก้งาน (CAP)",
    fullLabel: "ติดตามและพิจารณางานแก้ไข (CAP)",
    desc: "ตรวจสอบหลักฐานการแก้ไขข้อบกพร่องและอนุมัติปิดงาน",
    route: "cap",
    perm: "menu.cap",
    roles: ["STANDARD", "ADMIN", "AUDITOR"],
    group: "workflow"
  },
  { 
    key: "settings", 
    icon: Settings, 
    label: "ตั้งค่านโยบายและเกณฑ์", 
    fullLabel: "ตั้งค่านโยบายและเกณฑ์มาตรฐาน",
    desc: "เกณฑ์คะแนนผ่าน ≥85% และกำหนดเวลาส่งงาน SLA",
    perm: "menu.admin",
    roles: ["STANDARD", "ADMIN"],
    group: "system"
  },
  { 
    key: "integrations", 
    icon: Key, 
    label: "การเชื่อมต่อ API", 
    fullLabel: "การเชื่อมต่อ API & Webhook",
    desc: "ระบบเชื่อมต่อ ERP, POS และ LINE Notify",
    perm: "menu.admin",
    roles: ["ADMIN"],
    group: "system"
  },
  {
    key: "auditor_profile",
    icon: UserCheck,
    label: "ข้อมูลผู้ตรวจและสังกัด",
    desc: "ดูข้อมูลโปรไฟล์และพื้นที่ความรับผิดชอบ",
    roles: ["AUDITOR"],
    group: "info"
  },
  {
    key: "branch_info",
    icon: Store,
    label: "ข้อมูลสาขาและคู่มือ SOP",
    desc: "ดูข้อมูลประจำสาขาและเอกสารเกณฑ์มาตรฐานร้าน",
    roles: ["AUDITEE"],
    group: "info"
  },
  {
    key: "contact_qa",
    icon: MessageSquare,
    label: "ติดต่อฝ่ายมาตรฐาน",
    fullLabel: "ติดต่อฝ่ายมาตรฐาน (QA Support)",
    desc: "สอบถามข้อสงสัยเกี่ยวกับเกณฑ์การตรวจประเมิน",
    roles: ["AUDITEE"],
    group: "info"
  }
];

/**
 * Checks if a user has access to a tool based on role and permissions
 */
export function hasToolAccess(tool, role, permissions = []) {
  const normRole = String(role || "").trim().toUpperCase();
  if (normRole === "ADMIN") return true;
  if (tool.perm && Array.isArray(permissions) && permissions.includes(tool.perm)) return true;
  if (tool.roles && tool.roles.map(r => r.toUpperCase()).includes(normRole)) return true;
  return false;
}

/**
 * Generates desktop sidebar navigation groups based on role, permissions, and mobile nav config.
 * Replaces 'more' with individual tool items grouped into operational workflows and system/info tools.
 */
export function getDesktopNavGroups(role, permissions = [], userNavConfig = null) {
  const mobileNav = getRoleNavConfig(role, userNavConfig);
  // Filter out the 'more' slot on desktop
  const coreNavItems = mobileNav.filter(item => item.key !== "more" && item.slot !== "right");
  
  // Track keys and routes already present in core nav to avoid duplication
  const existingKeys = new Set();
  coreNavItems.forEach(item => {
    if (item.key) existingKeys.add(item.key);
    if (item.defaultRoute) existingKeys.add(item.defaultRoute);
  });
  
  // Filter available system tools that are not already present in core nav
  const availableTools = SYSTEM_TOOLS.filter(tool => {
    if (existingKeys.has(tool.key) || (tool.route && existingKeys.has(tool.route))) {
      return false;
    }
    return hasToolAccess(tool, role, permissions);
  });

  // Group 1: เมนูการทำงาน (Core Workflows)
  const workflowTools = availableTools.filter(t => t.group === "workflow");
  const workflows = [
    ...coreNavItems.map(item => ({
      ...item,
      group: "workflow"
    })),
    ...workflowTools
  ];

  // Group 2: ระบบและการจัดการ / ข้อมูลและบริการ (System / Info / Admin)
  const normRole = String(role || "").trim().toUpperCase();
  const systemTools = availableTools.filter(t => t.group === "system" || t.group === "info");

  let systemGroupTitle = "ระบบและการตั้งค่า";
  if (normRole === "AUDITEE") {
    systemGroupTitle = "ข้อมูลและบริการ";
  } else if (normRole === "AUDITOR") {
    systemGroupTitle = "ข้อมูลและสังกัด";
  } else if (normRole === "ADMIN") {
    systemGroupTitle = "การจัดการระบบ";
  }

  return {
    workflows,
    systemTools,
    systemGroupTitle
  };
}


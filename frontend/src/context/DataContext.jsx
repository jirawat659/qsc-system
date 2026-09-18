import React from "react";

export const DataContext = React.createContext({
  currentUser: null,
  locations: [], // สาขาทั่วไปไม่กรอก Brand
  setLocations: () => {},
  visibleLocations: [], // สาขาหลังกรองตาม selectedBrandId
  brands: [],
  selectedBrandId: null,  // null = แสดงทุกแบรนด์
  setSelectedBrandId: () => {},
  schedules: [],
  setSchedules: () => {},
  forms: [], // 🌟 โหลดแบบ summary (ไม่มี sections/items) — ใช้ getFormDetail() เพื่อดึงข้อมูลเต็ม
  setForms: () => {},
  getFormDetail: async () => null, // (formId) => Promise<full form with sections> — lazy hydrate + cache in `forms`
  activeDraft: null,
  setActiveDraft: () => {},
  activeDrafts: [],
  setActiveDrafts: () => {},
  capTasks: [],
  setCapTasks: () => {},
  auditRecords: [],
  setAuditRecords: () => {},
  refreshData: () => {},
  auditRecordsTotalCount: 0,
  capTasksTotalCount: 0,
  isLoadingAuditRecords: false,
  isLoadingCapTasks: false,
  loadMoreAuditRecords: () => {},
  loadMoreCapTasks: () => {}
});
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
  forms: [],
  setForms: () => {},
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
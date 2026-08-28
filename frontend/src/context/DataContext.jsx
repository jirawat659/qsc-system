import React from "react";

export const DataContext = React.createContext({
  currentUser: null,
  locations: [],
  setLocations: () => {},
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
  refreshData: () => {}
});

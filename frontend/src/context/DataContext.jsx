import React from "react";

export const DataContext = React.createContext({
  locations: [],
  setLocations: () => {},
  schedules: [],
  setSchedules: () => {},
  forms: [],
  setForms: () => {},
  activeDraft: null,
  setActiveDraft: () => {},
  capTasks: [],
  setCapTasks: () => {},
  auditRecords: [],
  setAuditRecords: () => {},
  refreshData: () => {}
});

// 📊 ข้อมูลสถิติ KPI และการวิเคราะห์ภาพรวมสำหรับหน้า Dashboard

export const KPI_DATA = {
  month: { audited: 128, passRate: "82%", overdue: 3, label: "ภาพรวมเดือนนี้", avgScore: 84.5, totalUnits: 145 },
  last_month: { audited: 135, passRate: "84%", overdue: 2, label: "ภาพรวมเดือนก่อน", avgScore: 85.2, totalUnits: 145 },
  "3m": { audited: 390, passRate: "81%", overdue: 5, label: "ภาพรวม 3 เดือน", avgScore: 83.8, totalUnits: 145 },
  "6m": { audited: 760, passRate: "80%", overdue: 8, label: "ภาพรวม 6 เดือน", avgScore: 82.9, totalUnits: 145 },
  ytd: { audited: 1480, passRate: "83%", overdue: 4, label: "ภาพรวมทั้งปี (YTD)", avgScore: 84.1, totalUnits: 145 }
};

export const DASHBOARD_ANALYTICS = {
  totalAuditsTarget: 150,
  riskBranchesCount: 14,
  excellentBranchesCount: 89,
  criticalIssuesCount: 3
};


import React, { useState } from "react";
import AllAuditHistoryScreen from "../dashboard/AllAuditHistoryScreen";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";

export default function ConsolidatedReportsScreen({ onBack, currentAuditorName = null, title = "รายงานผลการตรวจ", onStartAudit, onResumeDraft, onStartNewAudit }) {
  const [selectedLog, setSelectedLog] = useState(null);

  if (selectedLog) {
    return (
      <AuditHistoryDetail
        unitName={selectedLog.unitName}
        record={selectedLog.record}
        onBack={() => setSelectedLog(null)}
      />
    );
  }

  return (
    <AllAuditHistoryScreen
      onBack={onBack}
      onSelectLog={(log) => setSelectedLog(log)}
      currentAuditorName={currentAuditorName}
      title={title}
      onStartAudit={onStartAudit}
      onResumeDraft={onResumeDraft}
      onStartNewAudit={onStartNewAudit}
    />
  );
}

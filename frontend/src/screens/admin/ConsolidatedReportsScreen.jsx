import AllAuditHistoryScreen from "../dashboard/AllAuditHistoryScreen";
import ExcelExportModal from "../../modals/ExcelExportModal";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";



import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";


export default function ConsolidatedReportsScreen({ onBack, currentAuditorName = null, title = "รายงานผลการตรวจ", onStartAudit, onResumeDraft, onStartNewAudit }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

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
    <>
      <AllAuditHistoryScreen
        onBack={onBack}
        onSelectLog={(log) => setSelectedLog(log)}
        onExportExcel={() => setShowExportModal(true)}
        currentAuditorName={currentAuditorName}
        title={title}
        onStartAudit={onStartAudit}
        onResumeDraft={onResumeDraft}
        onStartNewAudit={onStartNewAudit}
      />
      {showExportModal && <ExcelExportModal onClose={() => setShowExportModal(false)} />}
    </>
  );
}

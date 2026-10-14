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


export default function AdminSubScreen({ 
  title, 
  onBack, 
  children, 
  maxWidth = "max-w-4xl",
  subtitle = "เครื่องมือผู้ดูแลระบบ (Admin Suite)"
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.body?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return (
    <div className={`page-transition px-3.5 sm:px-6 pt-6 sm:pt-8 pb-28 lg:pb-12 space-y-4 w-full mx-auto font-sans ${maxWidth}`}>
      <Header title={title} subtitle={subtitle} onBack={onBack} />
      {children}
    </div>
  );
}

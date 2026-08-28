import AllAuditHistoryScreen from "../dashboard/AllAuditHistoryScreen";
import ExcelExportModal from "../../modals/ExcelExportModal";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, CalendarDays, List, ClipboardList, ClipboardCheck,
  Scale, Store, MapPin, ChevronLeft, ChevronRight, Camera, Bell,
  CheckCircle2, XCircle, Banknote, Users, Settings, MoreHorizontal,
  Navigation, Phone, PenTool, Check, FileText, Copy, Plus, ShieldCheck,
  MessageSquare, ImagePlus, Send, Clock, Trash2, GripVertical, Edit3,
  Megaphone, Eye, EyeOff, Zap, X, ChevronDown, ChevronUp, History as HistoryIcon,
  Maximize2, Minimize2, CheckCheck, RefreshCw, Key, ShieldAlert,
  Laptop, Smartphone, Search, Filter, ArrowUpRight, ExternalLink,
  Award, TrendingUp, AlertTriangle, Sparkles, SlidersHorizontal,
  BarChart3, CheckSquare, Layers, UserCheck, Download, FileSpreadsheet,
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts";

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


export default function ConsolidatedReportsScreen({ onBack, currentAuditorName = null, title = "รายงานผลการตรวจ" }) {
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
      />
      {showExportModal && <ExcelExportModal onClose={() => setShowExportModal(false)} />}
    </>
  );
}

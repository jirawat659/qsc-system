import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { c, sans, mono, cardStyle } from "../config/theme";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <AlertTriangle size={32} className="text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">เกิดข้อผิดพลาดในการแสดงผล</h3>
          <p className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-xl text-left overflow-auto max-h-36 border">
            {this.state.error?.toString()}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 bg-[#0F6659] text-white text-xs font-bold rounded-2xl cursor-pointer"
          >
            โหลดหน้านี้ใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

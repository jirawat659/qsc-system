import React, { useState, useMemo } from "react";
import {
  Search, MapPin, Store, Building2, Utensils, Warehouse,
  Check, X, ChevronRight, Filter, Phone, Sparkles, Award, Tag, ChevronDown
} from "lucide-react";
import { c, sans, mono } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";

export default function LocationSelectModal({
  currentLocationId,
  currentLocationName,
  locations = [],
  onSelect,
  onClose
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  // Extract unique regions dynamically from locations
  const availableRegions = useMemo(() => {
    const set = new Set();
    locations.forEach(loc => {
      if (loc.region && loc.region.trim()) {
        set.add(loc.region.trim());
      }
    });
    return Array.from(set);
  }, [locations]);

  // Extract unique location types dynamically from locations
  const availableTypes = useMemo(() => {
    const map = new Map();
    locations.forEach(loc => {
      let tName = "";
      if (loc.locationType) {
        tName = typeof loc.locationType === 'object'
          ? (loc.locationType.name || loc.locationType.code || "")
          : String(loc.locationType);
      } else if (loc.type) {
        tName = String(loc.type);
      }
      if (tName && tName.trim()) {
        const clean = tName.trim();
        map.set(clean, clean);
      }
    });
    return Array.from(map.values());
  }, [locations]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      // 1. Region filter
      if (selectedRegion !== "all" && loc.region !== selectedRegion) {
        return false;
      }

      // 2. Location Type filter
      if (selectedType !== "all") {
        let locType = "";
        if (loc.locationType) {
          locType = typeof loc.locationType === 'object'
            ? (loc.locationType.name || loc.locationType.code || "")
            : String(loc.locationType);
        } else if (loc.type) {
          locType = String(loc.type);
        }
        if (!locType || locType !== selectedType) {
          return false;
        }
      }

      // 3. Search term query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = (loc.name || "").toLowerCase().includes(query);
        const matchFullName = (loc.fullName || "").toLowerCase().includes(query);
        const matchCode = (loc.code || "").toLowerCase().includes(query);
        const matchRegion = (loc.region || "").toLowerCase().includes(query);
        const matchAddress = (loc.address || "").toLowerCase().includes(query);
        const matchBrand = (loc.brandName || "").toLowerCase().includes(query);
        let matchType = false;
        if (loc.locationType) {
          const t = typeof loc.locationType === 'object' ? (loc.locationType.name || loc.locationType.code || '') : loc.locationType;
          matchType = String(t).toLowerCase().includes(query);
        }
        return matchName || matchFullName || matchCode || matchRegion || matchAddress || matchBrand || matchType;
      }

      return true;
    });
  }, [locations, selectedRegion, selectedType, searchTerm]);

  const getLocationTypeIcon = (loc, isSelected) => {
    const typeCode = typeof loc.locationType === 'object'
      ? (loc.locationType?.code || loc.locationType?.name || '')
      : (loc.locationType || loc.type || '');
    if (typeCode.toLowerCase().includes('plant') || typeCode.toLowerCase().includes('warehouse')) {
      return <Warehouse size={18} className={isSelected ? "text-white" : "text-purple-600 group-hover:text-white transition-colors"} />;
    }
    if (typeCode.toLowerCase().includes('cloud') || typeCode.toLowerCase().includes('kitchen')) {
      return <Utensils size={18} className={isSelected ? "text-white" : "text-amber-600 group-hover:text-white transition-colors"} />;
    }
    if (typeCode.toLowerCase().includes('office')) {
      return <Building2 size={18} className={isSelected ? "text-white" : "text-blue-600 group-hover:text-white transition-colors"} />;
    }
    return <Store size={18} className={isSelected ? "text-white" : "text-[#0F6659] group-hover:text-white transition-colors"} />;
  };

  const handleSelectLocation = (loc) => {
    onSelect(loc);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">เลือกสาขาเป้าหมาย</h3>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0F6659]">
                  {filteredLocations.length} จาก {locations.length} แห่ง
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ค้นหาด้วยชื่อสาขา, รหัสสาขา, ประเภท หรือภูมิภาค
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Side-by-Side Dropdown Filters */}
        <div className="p-4 border-b space-y-2.5 bg-white shrink-0 border-slate-100">
          {/* Search Box - NO autoFocus so mobile virtual keyboard doesn't pop up unexpectedly */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสาขา, รหัสสาขา หรือที่อยู่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:border-[#0F6659] bg-slate-50 text-slate-800 font-medium placeholder-slate-400 transition-all focus:bg-white focus:ring-1 focus:ring-emerald-500/20 ios-zoom-fix-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-md transition-colors"
                title="ล้างข้อความค้นหา"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* 🔽 2 Dropdowns Side-by-Side (ภูมิภาค & ประเภทสาขา) */}
          {/* 🔽 2 Dropdowns Side-by-Side: ประเภท (ซ้าย) & ภูมิภาค (ขวา) */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Dropdown 1 (ซ้าย): ประเภทสาขา (Location Type) */}
            <div className="relative flex items-center bg-slate-50 hover:bg-white border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all min-w-0">
              <Tag size={14} className="text-amber-600 shrink-0 mr-1.5 sm:mr-2" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-6 truncate ios-zoom-fix-xs"
              >
                <option value="all">ทุกประเภทสาขา ({locations.length})</option>
                {availableTypes.map(t => {
                  const count = locations.filter(l => {
                    const locT = typeof l.locationType === 'object'
                      ? (l.locationType?.name || l.locationType?.code || '')
                      : (l.locationType || l.type || '');
                    return locT === t;
                  }).length;
                  return (
                    <option key={t} value={t}>
                      {t} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={13} className="text-slate-400 pointer-events-none absolute right-2.5 shrink-0" />
            </div>

            {/* Dropdown 2 (ขวา): ภูมิภาค (Region) */}
            <div className="relative flex items-center bg-slate-50 hover:bg-white border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 focus-within:border-[#0F6659] focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all min-w-0">
              <MapPin size={14} className="text-[#0F6659] shrink-0 mr-1.5 sm:mr-2" />
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-6 truncate ios-zoom-fix-xs"
              >
                <option value="all">ทุกภูมิภาค ({locations.length})</option>
                {availableRegions.map(reg => {
                  const count = locations.filter(l => l.region === reg).length;
                  return (
                    <option key={reg} value={reg}>
                      {reg} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={13} className="text-slate-400 pointer-events-none absolute right-2.5 shrink-0" />
            </div>
          </div>
        </div>

        {/* Location List View */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y-0 max-h-[50vh] sm:max-h-[55vh]">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Store size={26} />
              </div>
              <div className="text-sm font-bold text-slate-700">ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                ลองค้นหาด้วยคำสำคัญอื่น หรือเลือกตัวกรองภูมิภาคและประเภท "ทั้งหมด"
              </p>
              {(searchTerm || selectedRegion !== "all" || selectedType !== "all") && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(""); setSelectedRegion("all"); setSelectedType("all"); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-all"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            filteredLocations.map((loc) => {
              const isSelected = loc.id === currentLocationId || loc.name === currentLocationName || loc.fullName === currentLocationName;
              const typeLabel = typeof loc.locationType === 'object'
                ? (loc.locationType?.name || loc.locationType?.code)
                : (loc.locationType || loc.type);

              return (
                <div
                  key={loc.id || loc.code || loc.name}
                  onClick={() => handleSelectLocation(loc)}
                  className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 group active:scale-[0.99] ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                      : "bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50/80"
                  }`}
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5 transition-colors ${
                      isSelected
                        ? "bg-[#0F6659] text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-100 text-slate-700 border-slate-200 group-hover:bg-[#0F6659] group-hover:text-white"
                    }`}>
                      {getLocationTypeIcon(loc, isSelected)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Top Badges: Row 1 (รหัสร้าน, แบรนด์) & Row 2 (ประเภท, ภูมิภาค) */}
                      <div className="space-y-1 mb-1.5">
                        {/* แถวที่ 1: รหัสร้าน + แบรนด์ */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {loc.code && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200">
                              {loc.code}
                            </span>
                          )}
                          {loc.brandName && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                              {loc.brandName}
                            </span>
                          )}
                        </div>

                        {/* แถวที่ 2: ประเภท + ภูมิภาค */}
                        {(typeLabel || loc.region) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {typeLabel && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                                {typeLabel}
                              </span>
                            )}
                            {loc.region && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F6659] border border-emerald-200">
                                {loc.region}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Main Title */}
                      <h4 className={`text-xs sm:text-sm font-extrabold truncate transition-colors ${
                        isSelected ? "text-emerald-950 font-black" : "text-slate-900 group-hover:text-[#0F6659]"
                      }`}>
                        {loc.name || loc.fullName}
                      </h4>

                      {loc.fullName && loc.fullName !== loc.name && (
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          {loc.fullName}
                        </p>
                      )}

                      {/* Address / Details */}
                      {loc.address && (
                        <p className="text-[11px] text-slate-400 font-normal truncate mt-1 flex items-center gap-1">
                          <MapPin size={11} className="shrink-0 text-slate-400" />
                          <span>{loc.address}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Score & Select Indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    {loc.lastScore !== undefined && loc.lastScore !== null && (
                      <div className="hidden sm:block text-right">
                        <div className="text-[10px] font-extrabold text-slate-400">คะแนนล่าสุด</div>
                        <div className={`text-xs sm:text-sm font-black font-mono ${
                          loc.lastScore >= 85 ? "text-[#0F6659]" : "text-amber-600"
                        }`}>
                          {loc.lastScore}%
                        </div>
                      </div>
                    )}

                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-[#0F6659] text-white shadow-2xs"
                        : "bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200"
                    }`}>
                      {isSelected ? <Check size={16} strokeWidth={3} /> : <ChevronRight size={16} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 border-t bg-slate-50/80 text-center text-xs font-semibold text-slate-500 shrink-0 flex items-center justify-between border-slate-200">
          <span>แตะสาขาที่ต้องการเพื่อเลือกทันที</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
          >
            ปิด
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

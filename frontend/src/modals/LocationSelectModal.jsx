import React, { useState, useMemo, useContext } from "react";
import { Search, MapPin, Store, Building2, Utensils, Warehouse, Check, X, ChevronRight, Tag, ChevronDown, Layers } from "lucide-react";
import { c, sans, mono } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import { DataContext } from "../context/DataContext";

export default function LocationSelectModal({
  currentLocationId,
  currentLocationName,
  locations: propLocations,
  brands: propBrands,
  initialBrand = "all",
  onSelect,
  onClose
}) {
  const dataContext = useContext(DataContext);
  const locations = propLocations || dataContext?.allLocations || dataContext?.locations || [];
  const brands = propBrands || dataContext?.brands || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(() => initialBrand ? String(initialBrand) : "all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  // Helper matching functions for faceted filtering
  // Match brand across both relational locationBrands array AND fallback brand properties
  const matchBrand = (loc, brandFilter) => {
    if (!brandFilter || brandFilter === "all") return true;
    const filterStr = String(brandFilter).toLowerCase().trim();

    // 1. Check relational locationBrands array (many-to-many)
    if (loc.locationBrands && Array.isArray(loc.locationBrands) && loc.locationBrands.length > 0) {
      const match = loc.locationBrands.some(lb => {
        const bId = String(lb.brandId || lb.brand?.id || '').toLowerCase().trim();
        const bName = String(lb.brand?.name || lb.brandName || '').toLowerCase().trim();
        const bCode = String(lb.brand?.code || '').toLowerCase().trim();
        return bId === filterStr || bName === filterStr || bCode === filterStr;
      });
      if (match) return true;
    }

    // 2. Fallback check for single brand object properties if any
    const locBrandId = String(loc.brandId || '').toLowerCase().trim();
    const locBrandObjId = String(loc.brand?.id || '').toLowerCase().trim();
    const locBrandObjName = String(loc.brand?.name || '').toLowerCase().trim();

    return locBrandId === filterStr || locBrandObjId === filterStr || locBrandObjName === filterStr;
  };

  const matchRegion = (loc, regionFilter) => {
    if (!regionFilter || regionFilter === "all") return true;
    return loc.region === regionFilter;
  };

  const getLocTypeString = (loc) => {
    if (loc.locationType) {
      return typeof loc.locationType === 'object'
        ? (loc.locationType.name || loc.locationType.code || "")
        : String(loc.locationType);
    }
    if (loc.type) {
      return String(loc.type);
    }
    return "";
  };

  const matchType = (loc, typeFilter) => {
    if (!typeFilter || typeFilter === "all") return true;
    const locType = getLocTypeString(loc);
    return locType && locType === typeFilter;
  };

  // 1. Locations matching other filters (for faceted counts)
  // For Brand dropdown: filtered by Region & Type
  const locationsForBrandDropdown = useMemo(() => {
    return locations.filter(loc => matchRegion(loc, selectedRegion) && matchType(loc, selectedType));
  }, [locations, selectedRegion, selectedType]);

  // For Type dropdown: filtered by Brand & Region
  const locationsForTypeDropdown = useMemo(() => {
    return locations.filter(loc => matchBrand(loc, selectedBrand) && matchRegion(loc, selectedRegion));
  }, [locations, selectedBrand, selectedRegion]);

  // For Region dropdown: filtered by Brand & Type
  const locationsForRegionDropdown = useMemo(() => {
    return locations.filter(loc => matchBrand(loc, selectedBrand) && matchType(loc, selectedType));
  }, [locations, selectedBrand, selectedType]);

  // Extract unique brands dynamically from locations and brands master
  const availableBrands = useMemo(() => {
    const brandMap = new Map();
    // 1. From brands list
    if (brands && Array.isArray(brands)) {
      brands.filter(b => b.isActive !== false).forEach(b => {
        brandMap.set(String(b.id), { id: String(b.id), name: b.name, code: b.code });
      });
    }
    // 2. Discover from locations
    locations.forEach(loc => {
      if (loc.locationBrands && Array.isArray(loc.locationBrands)) {
        loc.locationBrands.forEach(lb => {
          const bId = String(lb.brandId || lb.brand?.id || '');
          const bName = lb.brand?.name || lb.brandName;
          const bCode = lb.brand?.code;
          if (bId && bName && !brandMap.has(bId)) {
            brandMap.set(bId, { id: bId, name: bName, code: bCode });
          }
        });
      } else if (loc.brand && loc.brand.name) {
        const bId = String(loc.brand.id || loc.brand.name);
        if (!brandMap.has(bId)) {
          brandMap.set(bId, { id: bId, name: loc.brand.name, code: loc.brand.code });
        }
      }
    });
    return Array.from(brandMap.values());
  }, [brands, locations]);

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
      const clean = getLocTypeString(loc).trim();
      if (clean) {
        map.set(clean, clean);
      }
    });
    return Array.from(map.values());
  }, [locations]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      // 1. Brand filter
      if (!matchBrand(loc, selectedBrand)) return false;

      // 2. Region filter
      if (!matchRegion(loc, selectedRegion)) return false;

      // 3. Location Type filter
      if (!matchType(loc, selectedType)) return false;

      // 4. Search term query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = (loc.name || "").toLowerCase().includes(query);
        const matchFullName = (loc.fullName || "").toLowerCase().includes(query);
        const matchCode = (loc.code || "").toLowerCase().includes(query);
        const matchReg = (loc.region || "").toLowerCase().includes(query);
        const matchAddress = (loc.address || "").toLowerCase().includes(query);
        const matchB = (loc.locationBrands || []).some(lb => (lb.brand?.name || lb.brandName || "").toLowerCase().includes(query) || (lb.brand?.code || lb.brandCode || "").toLowerCase().includes(query)) || ((loc.brand?.name || loc.brandName || "").toLowerCase().includes(query)) || ((loc.brand?.code || "").toLowerCase().includes(query));
        const matchT = getLocTypeString(loc).toLowerCase().includes(query);
        return matchName || matchFullName || matchCode || matchReg || matchAddress || matchB || matchT;
      }

      return true;
    });
  }, [locations, selectedBrand, selectedRegion, selectedType, searchTerm]);

  const getLocationTypeIcon = (loc, isSelected) => {
    const typeCode = typeof loc.locationType === 'object'
      ? (loc.locationType?.code || loc.locationType?.name || '')
      : (loc.locationType || loc.type || '');
    if (typeCode.toLowerCase().includes('plant') || typeCode.toLowerCase().includes('warehouse')) {
      return <Warehouse size={18} className={isSelected ? "text-white" : "text-emerald-700 group-hover:text-white transition-colors"} />;
    }
    if (typeCode.toLowerCase().includes('cloud') || typeCode.toLowerCase().includes('kitchen')) {
      return <Utensils size={18} className={isSelected ? "text-white" : "text-amber-600 group-hover:text-white transition-colors"} />;
    }
    if (typeCode.toLowerCase().includes('office')) {
      return <Building2 size={18} className={isSelected ? "text-white" : "text-slate-600 group-hover:text-white transition-colors"} />;
    }
    return <Store size={18} className={isSelected ? "text-white" : "text-[#0F6659] group-hover:text-white transition-colors"} />;
  };

  const handleSelectLocation = (loc) => {
    onSelect(loc);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[85dvh] bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">เลือกสาขาเป้าหมาย</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                เลือกสถานที่กาารตรวจ
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
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสาขา, แบรนด์, รหัสสาขา หรือที่อยู่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 min-h-[46px] text-sm sm:text-base rounded-2xl border border-slate-200 outline-none focus:border-[#0F6659] bg-slate-50 text-slate-800 font-semibold placeholder-slate-400 transition-all focus:bg-white focus:ring-1 focus:ring-emerald-500/20"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg transition-colors"
                title="ล้างข้อความค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 🔽 3 Dropdowns: แบรนด์ (Brand), ประเภท (Type), ภูมิภาค (Region) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
            {/* Dropdown 1: แบรนด์ (Brand) - เต็ม 2 คอลัมันบนมือถือ / 1 คอลัมน์บนจอใหญ่ */}
            <div className="col-span-2 sm:col-span-1 relative flex items-center bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 min-h-[46px] sm:min-h-[50px] focus-within:border-[#0F6659] focus-within:bg-white transition-all shadow-xs min-w-0">
              <Store size={16} className="text-[#0F6659] shrink-0 mr-1.5 sm:mr-2" />
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 outline-none cursor-pointer appearance-none pr-6 truncate"
                title="กรองตามแบรนด์"
              >
                <option value="all">ทุกแบรนด์ ({locationsForBrandDropdown.length})</option>
                {availableBrands.map(b => {
                  const count = locationsForBrandDropdown.filter(l => matchBrand(l, b.id || b.name)).length;
                  return (
                    <option key={b.id || b.name} value={b.id || b.name}>
                      {b.name} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={16} className="text-slate-400 pointer-events-none absolute right-3 shrink-0" />
            </div>

            {/* Dropdown 2: ประเภทสาขา (Location Type) */}
            <div className="col-span-1 relative flex items-center bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 min-h-[46px] sm:min-h-[50px] focus-within:border-[#0F6659] focus-within:bg-white transition-all shadow-xs min-w-0">
              <Tag size={16} className="text-amber-600 shrink-0 mr-1.5 sm:mr-2" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 outline-none cursor-pointer appearance-none pr-6 truncate"
                title="กรองตามประเภทสถานที่"
              >
                <option value="all">ทุกประเภท ({locationsForTypeDropdown.length})</option>
                {availableTypes.map(t => {
                  const count = locationsForTypeDropdown.filter(l => matchType(l, t)).length;
                  return (
                    <option key={t} value={t}>
                      {t} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={16} className="text-slate-400 pointer-events-none absolute right-3 shrink-0" />
            </div>

            {/* Dropdown 3: ภูมิภาค (Region) */}
            <div className="col-span-1 relative flex items-center bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 min-h-[46px] sm:min-h-[50px] focus-within:border-[#0F6659] focus-within:bg-white transition-all shadow-xs min-w-0">
              <MapPin size={16} className="text-rose-600 shrink-0 mr-1.5 sm:mr-2" />
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 outline-none cursor-pointer appearance-none pr-6 truncate"
                title="กรองตามภูมิภาค"
              >
                <option value="all">ทุกภูมิภาค ({locationsForRegionDropdown.length})</option>
                {availableRegions.map(reg => {
                  const count = locationsForRegionDropdown.filter(l => matchRegion(l, reg)).length;
                  return (
                    <option key={reg} value={reg}>
                      {reg} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={16} className="text-slate-400 pointer-events-none absolute right-3 shrink-0" />
            </div>
          </div>
        </div>

        {/* Location List View */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 divide-y-0 max-h-[50dvh] sm:max-h-[55dvh]">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Store size={26} />
              </div>
              <div className="text-sm font-bold text-slate-700">ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                ลองค้นหาด้วยคำสำคัญอื่น หรือเลือกตัวกรองแบรนด์ ภูมิภาค และประเภท "ทั้งหมด"
              </p>
              {(searchTerm || selectedBrand !== "all" || selectedRegion !== "all" || selectedType !== "all") && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(""); setSelectedBrand("all"); setSelectedRegion("all"); setSelectedType("all"); }}
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

              // รวมรายชื่อแบรนด์ของสาขา
              const locBrandNames = (loc.locationBrands && loc.locationBrands.length > 0)
                ? loc.locationBrands.map(lb => lb.brand?.name || lb.brand?.code).filter(Boolean)
                : (loc.brand?.name ? [loc.brand.name] : []);

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
                          {locBrandNames.length > 0 && locBrandNames.map((bn, idx) => (
                            <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                              <Store size={10} className="text-[#0F6659]" />
                              {bn}
                            </span>
                          ))}
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
                          {parseFloat(Number(loc.lastScore).toFixed(2))}%
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
      </div>
    </ModalWrapper>
  );
}

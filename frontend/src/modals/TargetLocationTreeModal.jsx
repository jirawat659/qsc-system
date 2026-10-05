import React, { useState, useMemo, useEffect } from "react";
import { Search, ChevronDown, ChevronRight, Check, Minus, X, Store, Building2, Factory, Globe, CheckSquare, Layers } from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";

/**
 * TargetLocationTreeModal
 * ป๊อบอัพเลือกสาขาเป้าหมายที่แบบฟอร์มจะใช้งานได้
 * รองรับการแสดงผลแบบโครงสร้างต้นไม้ (Tree View): บริษัท > แบรนด์/โรงงาน > สาขา
 * ออกแบบตาม UI รูปแบบขอบเขตข้อมูลที่มองเห็นขององค์กร
 */
export default function TargetLocationTreeModal({
  isOpen,
  onClose,
  targetingMode = "ALL_LOCATIONS",
  targetLocationIds = [],
  brandIds = [],
  onSave,
  locations = [],
  brands = [],
  locationTypes = []
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Track expanded state for tree nodes
  const [expandedNodes, setExpandedNodes] = useState({
    company: true
  });

  const toggleExpand = (nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  const expandAll = () => {
    const all = { company: true };
    brands.forEach(b => { all[`brand_${b.id}`] = true; });
    all["unbranded"] = true;
    all["factories"] = true;
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({ company: true });
  };

  // Group locations by Brand and Location Type
  const { brandGroups, allValidLocationIds, brandLocationIdMap } = useMemo(() => {
    const brandMap = new Map();
    const idMap = new Map();
    const validIds = [];

    // Initialize map for each active brand
    const activeBrands = (brands || []).filter(b => b.isActive !== false);
    activeBrands.forEach(b => {
      brandMap.set(Number(b.id), {
        id: Number(b.id),
        name: b.name,
        code: b.code,
        type: "brand",
        locations: []
      });
      idMap.set(Number(b.id), []);
    });

    const unbrandedLocs = [];

    (locations || []).forEach(loc => {
      const locId = Number(loc.id);
      if (!locId) return;
      validIds.push(locId);

      let matchedBrand = false;
      const seenBrandIds = new Set();

      // 1. Check relational LocationBrands
      if (Array.isArray(loc.locationBrands) && loc.locationBrands.length > 0) {
        loc.locationBrands.forEach(lb => {
          const bId = Number(lb.brandId || lb.brand?.id);
          if (bId && brandMap.has(bId) && !seenBrandIds.has(bId)) {
            seenBrandIds.add(bId);
            brandMap.get(bId).locations.push(loc);
            idMap.get(bId).push(locId);
            matchedBrand = true;
          }
        });
      }

      // 2. Check direct BrandId
      if (!matchedBrand && loc.brandId) {
        const bId = Number(loc.brandId);
        if (brandMap.has(bId) && !seenBrandIds.has(bId)) {
          seenBrandIds.add(bId);
          brandMap.get(bId).locations.push(loc);
          idMap.get(bId).push(locId);
          matchedBrand = true;
        }
      }

      // 3. Fallback unbranded
      if (!matchedBrand) {
        unbrandedLocs.push(loc);
      }
    });

    // Convert map to sorted array (exclude empty brands from list, but keep standard ones)
    const groups = Array.from(brandMap.values())
      .filter(g => g.locations.length > 0)
      .sort((a, b) => b.locations.length - a.locations.length);

    if (unbrandedLocs.length > 0) {
      groups.push({
        id: "unbranded",
        name: "สาขาทั่วไป / อื่นๆ (Unbranded)",
        code: "OTHER",
        type: "other",
        locations: unbrandedLocs
      });
      idMap.set("unbranded", unbrandedLocs.map(l => Number(l.id)));
    }

    return {
      brandGroups: groups,
      allValidLocationIds: validIds,
      brandLocationIdMap: idMap
    };
  }, [locations, brands]);

  // Sync selectedIds when targetLocationIds or brandIds prop changes
  useEffect(() => {
    if (!isOpen) return;

    if (targetingMode === "SPECIFIC_LOCATIONS" && Array.isArray(targetLocationIds) && targetLocationIds.length > 0) {
      setSelectedIds(new Set(targetLocationIds.map(Number)));
    } else if (targetingMode === "ALL_LOCATIONS" && Array.isArray(brandIds) && brandIds.length > 0) {
      // Pre-select all branches of these brands
      const ids = new Set();
      brandIds.forEach(bId => {
        const locIds = brandLocationIdMap.get(Number(bId)) || [];
        locIds.forEach(id => ids.add(id));
      });
      setSelectedIds(ids);
    } else {
      setSelectedIds(new Set());
    }
  }, [targetingMode, targetLocationIds, brandIds, isOpen, brandLocationIdMap]);

  // Auto-expand all when user types search term
  useEffect(() => {
    if (searchTerm.trim()) {
      expandAll();
    }
  }, [searchTerm]);

  // Filtered view based on search
  const filteredBrandGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return brandGroups;

    return brandGroups
      .map(group => {
        const matchGroupName = group.name?.toLowerCase().includes(q) || group.code?.toLowerCase().includes(q);
        const matchedLocations = group.locations.filter(loc => {
          const name = (loc.name || loc.fullName || "").toLowerCase();
          const code = (loc.code || "").toLowerCase();
          const region = (loc.region || "").toLowerCase();
          const typeName = (loc.locationType?.name || loc.locationTypeName || "").toLowerCase();
          return name.includes(q) || code.includes(q) || region.includes(q) || typeName.includes(q);
        });

        if (matchGroupName) {
          return group; // Keep all locations if brand name matches
        }
        if (matchedLocations.length > 0) {
          return {
            ...group,
            locations: matchedLocations
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [brandGroups, searchTerm]);

  // Selection handlers
  const handleToggleLocation = (locId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(locId)) {
        next.delete(locId);
      } else {
        next.add(locId);
      }
      return next;
    });
  };

  const handleToggleBrand = (brandKey) => {
    const targetLocIds = brandLocationIdMap.get(brandKey) || [];
    if (targetLocIds.length === 0) return;

    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = targetLocIds.every(id => next.has(id));
      if (allSelected) {
        // Deselect all in this brand
        targetLocIds.forEach(id => next.delete(id));
      } else {
        // Select all in this brand
        targetLocIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleToggleAllCompany = () => {
    setSelectedIds(prev => {
      const allSelected = allValidLocationIds.length > 0 && allValidLocationIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(allValidLocationIds);
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(allValidLocationIds));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  // Compute checkbox states
  const totalSelectedCount = selectedIds.size;
  const isAllCompanySelected = allValidLocationIds.length > 0 && allValidLocationIds.every(id => selectedIds.has(id));
  const isCompanyIndeterminate = !isAllCompanySelected && allValidLocationIds.some(id => selectedIds.has(id));

  const getBrandCheckState = (brandKey) => {
    const locIds = brandLocationIdMap.get(brandKey) || [];
    if (locIds.length === 0) return { checked: false, indeterminate: false, count: 0, total: 0 };
    const selCount = locIds.filter(id => selectedIds.has(id)).length;
    const isChecked = selCount === locIds.length;
    const isIndeterminate = selCount > 0 && selCount < locIds.length;
    return { checked: isChecked, indeterminate: isIndeterminate, count: selCount, total: locIds.length };
  };

  const handleSave = () => {
    // 🌟 คำนวณแบรนด์ที่เกี่ยวข้องจากสาขาที่ถูกเลือก
    const derivedBrandIds = [];
    const derivedBrandNames = [];

    brandGroups.forEach(group => {
      if (group.id === "unbranded") return;
      const bKey = group.id;
      const locIds = brandLocationIdMap.get(bKey) || [];
      const hasAnySelected = locIds.some(id => selectedIds.has(id));
      if (hasAnySelected) {
        derivedBrandIds.push(Number(group.id));
        derivedBrandNames.push(group.name);
      }
    });

    // ตรวจสอบว่าสาขาที่เลือกครอบคลุม "ทุกสาขา" ของแบรนด์เหล่านั้นหรือไม่
    const allSelectedBelongToCompleteBrands = derivedBrandIds.length > 0 && derivedBrandIds.every(bId => {
      const locIds = brandLocationIdMap.get(bId) || [];
      return locIds.length > 0 && locIds.every(id => selectedIds.has(id));
    });

    const isOnlyThoseCompleteBrands = allSelectedBelongToCompleteBrands && 
      selectedIds.size === derivedBrandIds.reduce((sum, bId) => sum + (brandLocationIdMap.get(bId) || []).length, 0);

    if (selectedIds.size === 0 || isAllCompanySelected) {
      // 0 locations selected or all company selected = ALL_LOCATIONS (Global)
      onSave({
        targetingMode: "ALL_LOCATIONS",
        targetLocationIds: [],
        brandIds: [],
        brandNames: []
      });
    } else if (isOnlyThoseCompleteBrands) {
      // ผู้ใช้เลือกทั้งแบรนด์แบบครบทุกสาขา (เช่น ติ๊กที่หัวแบรนด์ Mikka)
      // ให้ถือว่าฟอร์มนี้เป็นของแบรนด์ Mikka และเปิดให้ใช้กับทุกสาขาของ Mikka
      onSave({
        targetingMode: "ALL_LOCATIONS",
        targetLocationIds: [],
        brandIds: derivedBrandIds,
        brandNames: derivedBrandNames
      });
    } else {
      // ผู้ใช้เลือกเจาะจงเฉพาะบางสาขา
      // ระบบจะผูกแบรนด์ของสาขานั้นให้ด้วยอัตโนมัติ
      onSave({
        targetingMode: "SPECIFIC_LOCATIONS",
        targetLocationIds: Array.from(selectedIds),
        brandIds: derivedBrandIds,
        brandNames: derivedBrandNames
      });
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-3xl" zIndex={99999}>
      <div className="flex flex-col max-h-[90dvh] sm:max-h-[88dvh] bg-white text-slate-800" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
        {/* 🌟 1. HEADER */}
        <div className="p-5 sm:p-6 pb-3 border-b border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              เลือกเป้าหมายการใช้งาน (Target)
            </h3>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs sm:text-sm font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
            เลือกสาขา/คลัง/แบรนด์/บริษัทที่แบบฟอร์มนี้จะเปิดให้ใช้งานได้
          </p>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาสาขา / คลัง / แบรนด์"
              className="w-full pl-10 pr-9 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#0F6659] rounded-2xl outline-none font-medium transition-all shadow-2xs placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* 🌟 2. TREE VIEW CONTENT */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 pt-3 space-y-3">
          <div className="border border-slate-200 rounded-3xl p-3 sm:p-4 bg-white shadow-2xs divide-y divide-slate-100">
            {/* Top Level: Company */}
            <div className="pb-2">
              <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50/80 transition-colors select-none">
                <button
                  type="button"
                  onClick={() => toggleExpand("company")}
                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                >
                  {expandedNodes.company ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>

                {/* Company Checkbox */}
                <div
                  role="checkbox"
                  aria-checked={isAllCompanySelected ? "true" : isCompanyIndeterminate ? "mixed" : "false"}
                  tabIndex={0}
                  onClick={handleToggleAllCompany}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer shrink-0 transition-all ${
                    isAllCompanySelected || isCompanyIndeterminate
                      ? "bg-[#0F6659] border-[#0F6659] text-white"
                      : "bg-white border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {isAllCompanySelected ? (
                    <Check size={12} strokeWidth={3} />
                  ) : isCompanyIndeterminate ? (
                    <Minus size={12} strokeWidth={3} />
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => toggleExpand("company")}>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate cursor-pointer">
                    บริษัท อาฟเตอร์ ยู จำกัด (มหาชน)
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 shrink-0">
                    บริษัท
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-auto">
                    ({allValidLocationIds.length} สาขา)
                  </span>
                </div>
              </div>

              {/* Sub Level: Brands & Facilities under Company */}
              {expandedNodes.company && (
                <div className="pl-6 sm:pl-7 pt-1.5 space-y-1">
                  {filteredBrandGroups.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      ไม่พบสาขาหรือแบรนด์ที่ตรงกับคำค้นหา "{searchTerm}"
                    </div>
                  ) : (
                    filteredBrandGroups.map(group => {
                      const brandKey = `brand_${group.id}`;
                      const isExpanded = Boolean(expandedNodes[brandKey]);
                      const { checked, indeterminate, count, total } = getBrandCheckState(group.id);

                      return (
                        <div key={group.id} className="space-y-0.5">
                          {/* Brand Node Row */}
                          <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50/80 transition-colors select-none group">
                            <button
                              type="button"
                              onClick={() => toggleExpand(brandKey)}
                              className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-slate-700 cursor-pointer shrink-0"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {/* Brand Checkbox */}
                            <div
                              role="checkbox"
                              aria-checked={checked ? "true" : indeterminate ? "mixed" : "false"}
                              tabIndex={0}
                              onClick={() => handleToggleBrand(group.id)}
                              className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer shrink-0 transition-all ${
                                checked || indeterminate
                                  ? "bg-[#0F6659] border-[#0F6659] text-white"
                                  : "bg-white border-slate-300 hover:border-slate-400"
                              }`}
                            >
                              {checked ? (
                                <Check size={12} strokeWidth={3} />
                              ) : indeterminate ? (
                                <Minus size={12} strokeWidth={3} />
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => toggleExpand(brandKey)}>
                              <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate cursor-pointer">
                                {group.name}
                              </span>
                              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                                {group.type === "brand" ? "แบรนด์" : "กลุ่มสาขา"}
                              </span>
                              <span className="text-[11px] font-medium text-slate-400 shrink-0 ml-auto">
                                ({count > 0 ? `${count}/` : ''}{total} สาขา)
                              </span>
                            </div>
                          </div>

                          {/* Branch Nodes under Brand */}
                          {isExpanded && (
                            <div className="pl-7 sm:pl-8 space-y-0.5 pt-0.5 pb-1">
                              {group.locations.map(loc => {
                                const locId = Number(loc.id);
                                const isSelected = selectedIds.has(locId);
                                const typeName = typeof loc.locationType === 'object'
                                  ? (loc.locationType?.name || loc.locationType?.code)
                                  : (loc.locationType || "หน้าร้าน");

                                return (
                                  <div
                                    key={loc.id}
                                    onClick={() => handleToggleLocation(locId)}
                                    className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-emerald-50/40 transition-colors select-none cursor-pointer"
                                  >
                                    <div className="w-5 shrink-0" />
                                    <div
                                      role="checkbox"
                                      aria-checked={isSelected}
                                      tabIndex={0}
                                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                        isSelected
                                          ? "bg-[#0F6659] border-[#0F6659] text-white"
                                          : "bg-white border-slate-300 hover:border-slate-400"
                                      }`}
                                    >
                                      {isSelected && <Check size={11} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-xs sm:text-sm truncate ${isSelected ? "font-bold text-emerald-950" : "font-normal text-slate-700"}`}>
                                      {loc.name || loc.fullName}
                                      {loc.code ? <span className="text-slate-400 font-mono text-[11px] ml-1.5">({loc.code})</span> : null}
                                    </span>
                                    {typeName && (
                                      <span className="text-[10.5px] font-normal text-slate-400 shrink-0 ml-auto">
                                        {typeName.includes("หน้าร้าน") ? "หน้าร้าน" : (typeName.includes("โรงงาน") ? "โรงงาน" : typeName)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🌟 3. FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {totalSelectedCount === 0 || isAllCompanySelected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200 text-xs font-bold shadow-2xs">
                <Globe size={14} />
                <span>ใช้งานได้ทุกสาขา (All Locations)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
                <Store size={14} />
                <span>จำกัดเฉพาะ {totalSelectedCount} สาขา</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-[#0c5449] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>
                {totalSelectedCount === 0 || isAllCompanySelected
                  ? "ยืนยัน (ใช้ได้ทุกสาขา)"
                  : `บันทึกสาขาเป้าหมาย (${totalSelectedCount} สาขา)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}

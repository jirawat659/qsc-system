import React from 'react';
import { Search, Plus, Store, MapPin, UserCheck, ChevronRight, Edit3, Phone } from 'lucide-react';

export default function LocationManagementTab({
  searchTerm, setSearchTerm,
  setShowAddLocationModal,
  locations, locationStatusFilter, setLocationStatusFilter,
  loading, filteredLocations, paginatedLocations,
  handleOpenEditLocation,
  pageSize, locationPage, setLocationPage, totalLocationPages
}) {
  return (
<div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารหัสสาขา, ชื่อสาขา, หรือภูมิภาค..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddLocationModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มสถานที่/สาขาใหม่</span>
            </button>
          </div>

          {/* Quick Status Filter Pills for Locations */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'ALL', label: `ทั้งหมด (${locations.length})` },
              { id: 'ACTIVE', label: `🟢 เปิดให้บริการ (${locations.filter(l => l.isActive).length})` },
              { id: 'INACTIVE', label: `🔴 ปิดปรับปรุง/ระงับ (${locations.filter(l => !l.isActive).length})` },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setLocationStatusFilter(pill.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  locationStatusFilter === pill.id
                    ? 'bg-[#0F6659] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Loading Skeleton */}
          {loading && locations.length === 0 ? (
            <div className="space-y-3 py-4 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-2xl w-full" />
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Store size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">ไม่พบข้อมูลสาขาที่ตรงกับเงื่อนไข</p>
                <p className="text-xs text-slate-400 mt-0.5">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองสถานะ</p>
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 cursor-pointer transition-all"
                >
                  ล้างการค้นหา
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 🖥️ Desktop Table View (>= 768px) */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">รหัส / ชื่อสาขา</th>
                      <th className="py-3.5 px-4">ภูมิภาค</th>
                      <th className="py-3.5 px-4">ประเภท</th>
                      <th className="py-3.5 px-4">ผู้จัดการสาขา</th>
                      <th className="py-3.5 px-4">คะแนนล่าสุด</th>
                      <th className="py-3.5 px-4">สถานะ</th>
                      <th className="py-3.5 px-4 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm bg-white">
                    {paginatedLocations.map(loc => {
                      const isActive = loc.isActive !== false;
                      return (
                        <tr key={loc.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="text-xs font-mono font-bold text-slate-400">{loc.code}</span>
                              <div className="font-bold text-slate-800">{loc.name}</div>
                              <div className="text-xs text-slate-400">{loc.brandName || "Urban Burger"}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-slate-400 shrink-0" />
                              <span>{loc.region}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {loc.locationType?.name || loc.locationType?.code || "STORE"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                            {loc.managerUser ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck size={13} className="text-emerald-600 shrink-0" />
                                <span>{loc.managerUser.fullName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-emerald-800 font-mono font-black text-sm">
                              {loc.lastScore ? `${loc.lastScore}%` : "-"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              {isActive ? 'เปิดบริการ' : 'ปิดปรับปรุง'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditLocation(loc)}
                              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-[#0F6659] hover:bg-[#0F6659]/5 text-xs font-bold text-slate-700 hover:text-[#0F6659] transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 shadow-2xs"
                            >
                              <Edit3 size={13} />
                              <span>แก้ไข</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 📱 Mobile Cards View (< 768px) */}
              <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {paginatedLocations.map((loc) => {
                  const isActive = loc.isActive !== false;
                  return (
                    <div
                      key={loc.id}
                      onClick={() => handleOpenEditLocation(loc)}
                      className={`p-4.5 rounded-2xl border transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 space-y-3.5 flex flex-col justify-between group ${
                        isActive
                          ? 'border-slate-200 hover:border-[#0F6659] bg-white'
                          : 'border-slate-300/80 bg-slate-50/70 hover:border-[#0F6659] hover:bg-white'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-mono font-bold text-slate-400 block">{loc.code}</span>
                            <h4 className={`text-base font-black group-hover:text-[#0F6659] transition-colors ${
                              isActive ? 'text-slate-900' : 'text-slate-600'
                            }`}>{loc.name}</h4>
                            <p className="text-xs text-slate-500 font-medium">{loc.brandName || "Urban Burger"}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                              {loc.locationType?.name || loc.locationType?.code || "STORE"}
                            </span>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-2 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{loc.region} · {loc.address || "กรุงเทพฯ"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-slate-400 shrink-0" />
                            <span>{loc.phone || "02-999-9999"}</span>
                          </div>
                          {loc.managerUser && (
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} className="text-emerald-600 shrink-0" />
                              <span className="font-semibold">ผู้จัดการ: {loc.managerUser.fullName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400 font-semibold">คะแนน: </span>
                          <span className="text-emerald-800 font-mono font-black text-sm">{loc.lastScore ? `${loc.lastScore}%` : "ยังไม่ตรวจ"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 group-hover:text-[#0F6659] font-extrabold transition-colors">
                            {isActive ? 'แตะเพื่อแก้ไข' : 'แตะเพื่อเปิดใช้งาน'}
                          </span>
                          {!isActive && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ ระงับ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {filteredLocations.length > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div>
                    แสดง {(locationPage - 1) * pageSize + 1} - {Math.min(locationPage * pageSize, filteredLocations.length)} จากทั้งหมด {filteredLocations.length} รายการ
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={locationPage === 1}
                      onClick={() => setLocationPage(p => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-all shadow-2xs"
                    >
                      ก่อนหน้า
                    </button>
                    <span className="px-2.5 font-bold font-mono text-slate-700">
                      หน้า {locationPage} / {totalLocationPages}
                    </span>
                    <button
                      type="button"
                      disabled={locationPage >= totalLocationPages}
                      onClick={() => setLocationPage(p => Math.min(totalLocationPages, p + 1))}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-all shadow-2xs"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
  );
}

import React from 'react';
import { Search, Plus, Users, Store, Globe, Edit3 } from "lucide-react";

export default function UserManagementTab({
  searchTerm, setSearchTerm,
  setShowAddUserModal,
  userRoleFilter, setUserRoleFilter,
  users, roleOptions, getRoleUserCount,
  loading, filteredUsers, paginatedUsers,
  handleOpenEditUser,
  pageSize, userPage, setUserPage, totalUserPages,
  renderUserCard
}) {
  return (
<div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-นามสกุล, หรือบทบาท..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มผู้ใช้งานใหม่</span>
            </button>
          </div>

          {/* Role Filter Selector Pills (เลือกตามบทบาท) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setUserRoleFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                userRoleFilter === 'ALL'
                  ? 'bg-[#0F6659] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>

            {roleOptions.map((r) => {
              const count = getRoleUserCount(r);
              const isSelected = String(userRoleFilter) === String(r.id) || userRoleFilter === r.code;
              return (
                <button
                  key={r.id || r.code}
                  type="button"
                  onClick={() => setUserRoleFilter(r.id || r.code)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    isSelected
                      ? 'bg-[#0F6659] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r.code || r.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Loading Skeleton */}
          {loading && users.length === 0 ? (
            <div className="space-y-3 py-4 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-2xl w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Users size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไข</p>
                <p className="text-xs text-slate-400 mt-0.5">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองบทบาท</p>
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
                      <th className="py-3.5 px-4">ผู้ใช้งาน</th>
                      <th className="py-3.5 px-4">บทบาท (Role)</th>
                      <th className="py-3.5 px-4">ขอบเขตสาขา (Scope)</th>
                      <th className="py-3.5 px-4">สถานะ</th>
                      <th className="py-3.5 px-4 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm bg-white">
                    {paginatedUsers.map(u => {
                      const isActive = u.isActive !== false;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                                isActive ? 'bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {(u.fullName || u.username).substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate">{u.fullName}</div>
                                <div className="text-xs font-mono text-slate-400">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {u.roleName || u.role?.name || u.roleCode || u.role?.code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {u.branchScope === 'SPECIFIC' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Store size={13} />
                                <span>เฉพาะสาขา ({u.locationIds?.length || 0})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Globe size={13} />
                                <span>ทุกสาขา (ALL)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              {isActive ? 'ใช้งานอยู่' : 'ระงับการใช้งาน'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
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
              <div className="md:hidden space-y-3">
                {paginatedUsers.map(renderUserCard)}
              </div>

              {/* Pagination Controls */}
              {filteredUsers.length > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div>
                    แสดง {(userPage - 1) * pageSize + 1} - {Math.min(userPage * pageSize, filteredUsers.length)} จากทั้งหมด {filteredUsers.length} รายการ
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={userPage === 1}
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-all shadow-2xs"
                    >
                      ก่อนหน้า
                    </button>
                    <span className="px-2.5 font-bold font-mono text-slate-700">
                      หน้า {userPage} / {totalUserPages}
                    </span>
                    <button
                      type="button"
                      disabled={userPage >= totalUserPages}
                      onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
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

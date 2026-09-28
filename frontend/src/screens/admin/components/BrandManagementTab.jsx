import React, { useState, useMemo } from 'react';
import { Search, Plus, Tag, Edit3, Trash2, X, Check, AlertTriangle, ChevronRight } from "lucide-react";
import api from '../../../config/api';
import ModalWrapper from '../../../shared/ModalWrapper';

const EMPTY_FORM = { code: '', name: '', description: '', isActive: true };

export default function BrandManagementTab({ brands = [], loading, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [showAdd, setShowAdd] = useState(false);
  const [editBrand, setEditBrand] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = brands;
    if (statusFilter === 'ACTIVE') list = list.filter(b => b.isActive);
    if (statusFilter === 'INACTIVE') list = list.filter(b => !b.isActive);
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(b =>
      b.name?.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q)
    );
  }, [brands, searchTerm, statusFilter]);

  const openEdit = (b) => {
    setEditBrand(b);
    setForm({ code: b.code || '', name: b.name || '', description: b.description || '', isActive: b.isActive });
  };

  const closeModals = () => {
    setShowAdd(false);
    setEditBrand(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast?.('กรุณาระบุชื่อแบรนด์', true);
      return;
    }
    setSaving(true);
    try {
      if (editBrand) {
        await api.put(`/brand/${editBrand.id}`, form);
        showToast?.(`✓ บันทึกแบรนด์ "${form.name}" สำเร็จ`);
      } else {
        await api.post('/brand', form);
        showToast?.(`✓ เพิ่มแบรนด์ "${form.name}" สำเร็จ`);
      }
      closeModals();
      onRefresh?.();
    } catch (err) {
      showToast?.(err.response?.data?.message || 'บันทึกแบรนด์ไม่สำเร็จ', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (b) => {
    setDeleteTarget(b);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/brand/${deleteTarget.id}`);
      showToast?.(`✓ ลบแบรนด์ "${deleteTarget.name}" สำเร็จ`);
      onRefresh?.();
      setDeleteTarget(null);
    } catch (err) {
      showToast?.(err.response?.data?.message || 'ลบแบรนด์ไม่สำเร็จ (อาจมีสาขาผูกอยู่)', true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส หรือ ชื่อแบรนด์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <Plus size={16} />
          <span>เพิ่มแบรนด์ใหม่</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'ALL', label: `ทั้งหมด (${brands.length})` },
          { id: 'ACTIVE', label: `ใช้งาน (${brands.filter(b => b.isActive).length})` },
          { id: 'INACTIVE', label: `ปิดใช้งาน (${brands.filter(b => !b.isActive).length})` },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setStatusFilter(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              statusFilter === pill.id ? 'bg-[#0F6659] text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {loading && brands.length === 0 ? (
        <div className="space-y-3 py-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-2xl w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Tag size={28} />
          </div>
          <p className="text-sm font-bold text-slate-700">ไม่พบแบรนด์ที่ตรงกับเงื่อนไข</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((b) => (
            <div
              key={b.id}
              onClick={() => openEdit(b)}
              className="p-4.5 rounded-2xl border border-slate-200 hover:border-[#0F6659] bg-white transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 space-y-2.5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    {b.code || '-'}
                  </span>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                </div>
                <h4 className="text-base font-black text-slate-850 group-hover:text-[#0F6659] transition-colors mt-2.5">{b.name}</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">{b.description || "แบรนด์ในเครือมาตรฐาน Q.S.C."}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="group-hover:text-[#0F6659] font-extrabold transition-colors">แตะเพื่อแก้ไข</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  b.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {b.isActive ? 'ใช้งาน' : 'ปิด'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editBrand) && (
        <ModalWrapper onClose={closeModals} maxWidth="max-w-md">
          <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-800">{editBrand ? 'แก้ไขแบรนด์' : 'เพิ่มแบรนด์ใหม่'}</h3>
            <button type="button" onClick={closeModals} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสแบรนด์ (Code)</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-4.5 py-3 rounded-2xl border border-slate-200 text-sm focus:border-[#0F6659] outline-none shadow-xs font-mono"
                placeholder="เช่น UB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อแบรนด์ *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4.5 py-3 rounded-2xl border border-slate-200 text-sm focus:border-[#0F6659] outline-none shadow-xs"
                placeholder="เช่น Urban Burger"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">คำอธิบาย</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-4.5 py-3 rounded-2xl border border-slate-200 text-sm focus:border-[#0F6659] outline-none shadow-xs resize-none"
                placeholder="ระบุรายละเอียดของแบรนด์นี้..."
              />
            </div>
            <div 
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
            >
              <div>
                <div className="text-sm font-semibold text-slate-700">เปิดใช้งานแบรนด์นี้</div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">
                  {form.isActive ? 'เปิดใช้งาน (แสดงในตัวเลือกและระบบ)' : 'ปิดใช้งาน (ซ่อนจากระบบ)'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  setForm(prev => ({ ...prev, isActive: !prev.isActive }));
                }}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#0F6659]/20 ${
                  form.isActive ? 'bg-[#0F6659]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    form.isActive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-2.5 pt-2">
              {editBrand && (
                <button
                  type="button"
                  onClick={() => {
                    const bToDelete = editBrand;
                    closeModals();
                    setDeleteTarget(bToDelete);
                  }}
                  className="px-4 py-3.5 rounded-2xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-98"
                  title="ลบแบรนด์นี้"
                >
                  <Trash2 size={16} />
                  <span>ลบ</span>
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-sm font-bold shadow-md cursor-pointer active:scale-98 transition-all disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : editBrand ? 'บันทึกการแก้ไข' : 'เพิ่มแบรนด์'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ⚠️ In-app delete confirmation (replaces window.confirm) */}
      {deleteTarget && (
        <ModalWrapper onClose={() => !deleting && setDeleteTarget(null)} maxWidth="max-w-md">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 bg-rose-100 text-rose-600">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ลบแบรนด์</h3>
                <p className="text-xs text-slate-500 font-medium">กรุณาตรวจสอบก่อนยืนยันรายการ</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              ลบแบรนด์ "{deleteTarget.name}" ใช่หรือไม่? (สาขาที่ผูกแบรนด์นี้จะถูกถอนออกอัตโนมัติ)
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
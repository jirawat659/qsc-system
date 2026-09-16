import React, { useState } from 'react';
import { Key, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, X, Loader2, ShieldCheck } from "lucide-react";
import ModalWrapper from '../shared/ModalWrapper';
import api from '../config/api';

export default function ChangePasswordModal({ user, onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validation
    if (!oldPassword.trim()) {
      setErrorMsg('กรุณาระบุรหัสผ่านเดิม');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (oldPassword === newPassword) {
      setErrorMsg('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        userId: user?.id || 0,
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim()
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={() => !isSubmitting && onClose()} maxWidth="max-w-md">
      <div className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F6659] border border-emerald-200/80 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Key size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">เปลี่ยนรหัสผ่าน</h3>
              <p className="text-xs text-slate-400 font-medium">
                บัญชี: <strong className="text-slate-700">{user?.fullName || user?.name || user?.username || 'ผู้ใช้งาน'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center mx-auto shadow-md">
              <ShieldCheck size={36} strokeWidth={2.2} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">เปลี่ยนรหัสผ่านสำเร็จ!</h4>
              <p className="text-xs text-slate-500 font-medium">
                บันทึกรหัสผ่านใหม่เข้าสู่ระบบฐานข้อมูลเรียบร้อยแล้ว
              </p>
            </div>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* 1. Old Password */}
            <div>
              <label htmlFor="change-old-password" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Lock size={13} className="text-[#0F6659]" />
                <span>รหัสผ่านเดิม</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="change-old-password"
                  name="oldPassword"
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านเดิมที่ใช้งานอยู่"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] focus:bg-white transition-all shadow-2xs"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showOld ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {/* 2. New Password */}
            <div>
              <label htmlFor="change-new-password" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Key size={13} className="text-[#0F6659]" />
                <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="change-new-password"
                  name="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] focus:bg-white transition-all shadow-2xs"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNew ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {/* 3. Confirm New Password */}
            <div>
              <label htmlFor="change-confirm-password" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-[#0F6659]" />
                <span>ยืนยันรหัสผ่านใหม่อีกครั้ง</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="change-confirm-password"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] focus:bg-white transition-all shadow-2xs"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirm ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-3 px-4 rounded-2xl bg-[#0F6659] hover:bg-[#0B4E44] text-white font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-900/10 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>บันทึกรหัสผ่านใหม่</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalWrapper>
  );
}


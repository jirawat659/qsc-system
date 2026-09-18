import React, { useState } from 'react';
import { User, Shield, Key, LogOut, X, CheckCircle2 } from "lucide-react";
import { ROLES } from '../config/roles';
import ModalWrapper from '../shared/ModalWrapper';
import ChangePasswordModal from './ChangePasswordModal';

export default function ProfileModal({ user, onClose, onLogout }) {
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  if (!user) return null;

  const roleMeta = ROLES.find(r => r.id === user.role) || { label: user.title || user.role, desc: 'ผู้ใช้งานระบบ' };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-sm">
      <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-tab-scrollbar flex-1 max-h-full">
        {showConfirmLogout ? (
          /* ── 🌟 CUSTOM IN-APP CONFIRM LOGOUT POPUP ── */
          <div className="text-center space-y-4 py-1">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <LogOut size={30} strokeWidth={2.2} />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">ยืนยันการออกจากระบบ?</h4>
              <p className="text-xs text-slate-500 font-medium px-2">
                คุณต้องการออกจากระบบ QSC บัญชี <br/>
                <span className="font-bold text-slate-800">{user.name || user.fullName || user.username}</span> ใช่หรือไม่?
              </p>
            </div>

            <div className="pt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmLogout(false)}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onLogout) onLogout();
                }}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-600/20"
              >
                ยืนยันออกจากระบบ
              </button>
            </div>
          </div>
        ) : (
          /* ── 🌟 NORMAL PROFILE VIEW ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <User size={18} className="text-[#0F6659]" />
                <h3 className="text-base font-extrabold text-slate-800">โปรไฟล์ผู้ใช้งาน</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Avatar & Identity */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center text-xl sm:text-2xl font-black mx-auto shadow-md">
                {user.avatar || (user.name ? user.name.substring(0, 2) : "US")}
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug px-1">{user.name || user.fullName || user.username}</h4>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{user.username}</p>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Shield size={12} />
                  <span>{roleMeta.label}</span>
                </span>
              </div>
            </div>

            {/* User Details Box */}
            <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">บทบาทระบบ:</span>
                <span className="font-extrabold text-slate-800 truncate">{user.role}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">ขอบเขตสาขา:</span>
                <span className="font-extrabold text-slate-800 text-right truncate">
                  {user.branchScope === 'SPECIFIC' ? 'เฉพาะสาขาที่กำหนด' : 'เข้าถึงทุกสาขา (องค์กร)'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">สถานะบัญชี:</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 shrink-0">
                  <CheckCircle2 size={12} />
                  <span>เปิดใช้งานปกติ</span>
                </span>
              </div>
            </div>

            {/* Actions: Change Password & Logout */}
            <div className="pt-1 sm:pt-2 space-y-2 pb-1">
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="w-full py-2.5 sm:py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-2xs hover:border-[#0F6659] hover:text-[#0F6659]"
              >
                <Key size={16} className="text-[#0F6659]" />
                <span>เปลี่ยนรหัสผ่าน (Change Password)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmLogout(true)}
                className="w-full py-2.5 sm:py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-2xs"
              >
                <LogOut size={16} />
                <span>ออกจากระบบ (Log Out)</span>
              </button>
            </div>
          </>
        )}

        {showChangePassword && (
          <ChangePasswordModal
            user={user}
            onClose={() => setShowChangePassword(false)}
          />
        )}
      </div>
    </ModalWrapper>
  );
}


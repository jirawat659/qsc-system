import { useState, useEffect } from 'react';
import api from '../config/api';
import authStorage from '../config/storage';
import { LogIn, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // โหลดเวลา Lockout ที่ค้างไว้จาก localStorage (ถ้ามี เพื่อไม่ให้เวลารีเซ็ตเมื่อรีเฟรชหน้าเว็บ)
  const [lockoutSeconds, setLockoutSeconds] = useState(() => {
    try {
      const storedUntil = localStorage.getItem('qsc_login_lockout_until');
      if (storedUntil) {
        const remaining = Math.ceil((Number(storedUntil) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  // ระบบนับเวลาถอยหลังเมื่อติด Lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      try {
        localStorage.removeItem('qsc_login_lockout_until');
      } catch {}
      return;
    }

    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          try {
            localStorage.removeItem('qsc_login_lockout_until');
          } catch {}
          setError(''); // เคลียร์ข้อความระงับเมื่อครบกำหนด
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    if (!username.trim() || !password.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password: password
      });

      const { token, user } = response.data;
      authStorage.saveSession({
        token,
        role: user?.role,
        username: user?.username,
        user
      });
      if (user?.fullName) {
        localStorage.setItem('fullName', user.fullName);
      }
      
      // ล้างข้อมูล lockout เมื่อล็อกอินสำเร็จ
      try {
        localStorage.removeItem('qsc_login_lockout_until');
      } catch {}

      if (onLoginSuccess) {
        onLoginSuccess(token);
      } else {
        window.location.reload();
      }
    } catch (err) {
      const data = err.response?.data;
      const isRateLimited = data?.isLocked || err.response?.status === 429;
      const retrySecs = Number(data?.retryAfterSeconds) || (isRateLimited ? 60 : 0);

      if (isRateLimited && retrySecs > 0) {
        setLockoutSeconds(retrySecs);
        try {
          localStorage.setItem('qsc_login_lockout_until', String(Date.now() + retrySecs * 1000));
        } catch {}
        setError(data?.message || `บัญชีถูกระงับชั่วคราว กรุณารอ ${formatTimer(retrySecs)}`);
      } else {
        setError(data?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-md">
            Q
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Q.S.C. System</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Quality Standard & Compliance Portal</p>
        </div>

        {/* Error Alert (แสดงเฉพาะข้อผิดพลาดทั่วไป ไม่แสดงเมื่อติด Lockout เนื่องจากแสดงที่ปุ่มกดแล้ว) */}
        {lockoutSeconds <= 0 && error ? (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </div>
              <input
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || lockoutSeconds > 0}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6659] transition-all bg-slate-50/50 text-slate-800 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="กรอกชื่อผู้ใช้ของคุณ..."
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </div>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || lockoutSeconds > 0}
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6659] transition-all bg-slate-50/50 text-slate-800 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="กรอกรหัสผ่าน..."
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                disabled={lockoutSeconds > 0}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 disabled:opacity-40"
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutSeconds > 0}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-3 ${
              lockoutSeconds > 0
                ? 'bg-[#73A8A3] text-white cursor-not-allowed shadow-none'
                : loading
                ? 'bg-[#0F6659]/80 text-white cursor-wait shadow-sm'
                : 'bg-gradient-to-tr from-[#0F6659] to-[#15806e] hover:from-[#0d594e] hover:to-[#127060] text-white shadow-md hover:shadow-lg active:scale-98 cursor-pointer'
            }`}
          >
            {lockoutSeconds > 0 ? (
              <>
                <Lock size={17} className="text-white shrink-0" />
                <span>กรุณารอ ({formatTimer(lockoutSeconds)})</span>
              </>
            ) : loading ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0" />
                <span>กำลังตรวจสอบสิทธิ์...</span>
              </>
            ) : (
              <>
                <LogIn size={16} className="shrink-0" />
                <span>เข้าสู่ระบบ</span>
              </>
            )}
          </button>
        </form>

        {/* SSO Option Divider */}
        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-400 font-medium">หรือเข้าสู่ระบบด้วย</span>
          </div>
        </div>

        {/* Microsoft Entra ID Button */}
        <button
          type="button"
          onClick={() => {
            const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
            const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
            const redirectUri = encodeURIComponent(`${window.location.origin}/sso/callback`);
            const scope = encodeURIComponent('openid profile email');
            const responseType = 'id_token';
            const nonce = Math.random().toString(36).substring(2);
            const state = Math.random().toString(36).substring(2);

            window.location.href = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=${responseType}&redirect_uri=${redirectUri}&scope=${scope}&response_mode=fragment&nonce=${nonce}&state=${state}`;
          }}
          className="w-full py-3 px-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-700 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-98 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span>เข้าสู่ระบบด้วย Microsoft Entra ID</span>
        </button>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            ระบบตรวจสอบและควบคุมคุณภาพมาตรฐานองค์กร
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
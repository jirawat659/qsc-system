import { useState } from 'react';
import api from '../config/api';
import authStorage from '../config/storage';
import { LogIn, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
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
      
      if (onLoginSuccess) {
        onLoginSuccess(token);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน');
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

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6659] transition-all bg-slate-50/50 text-slate-800 font-medium"
                placeholder="กรอกชื่อผู้ใช้ของคุณ..."
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผ่าน (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6659] transition-all bg-slate-50/50 text-slate-800 font-medium"
                placeholder="กรอกรหัสผ่าน..."
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-tr from-[#0F6659] to-[#15806e] hover:from-[#0d594e] hover:to-[#127060] text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังตรวจสอบสิทธิ์...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>เข้าสู่ระบบ</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            ระบบตรวจสอบและควบคุมคุณภาพมาตรฐานองค์กร
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
import { useEffect, useState, useRef } from 'react';
import api from '../config/api';
import authStorage from '../config/storage';
import { Loader2, AlertCircle } from 'lucide-react';

export const SSO_CALLBACK_PATH = '/sso/callback';

export default function SsoCallback() {
  const [error, setError] = useState('');
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let token = null;
    let isEntra = false;
    let oauthError = null;

    // 1. ตรวจสอบจาก Query String (?token=... หรือ ?id_token=...)
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('error')) {
      oauthError = searchParams.get('error_description') || searchParams.get('error');
    } else if (searchParams.has('id_token')) {
      token = searchParams.get('id_token');
      isEntra = true;
    } else if (searchParams.has('token')) {
      token = searchParams.get('token');
      isEntra = false;
    }

    // 2. ตรวจสอบจาก Hash Fragment (#id_token=... หรือ #token=...) ซึ่ง Microsoft ส่งมา
    if (!token && window.location.hash) {
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);

      if (hashParams.has('error')) {
        oauthError = hashParams.get('error_description') || hashParams.get('error');
      } else if (hashParams.has('id_token')) {
        token = hashParams.get('id_token');
        isEntra = true;
      } else if (hashParams.has('token')) {
        token = hashParams.get('token');
        isEntra = false;
      }
    }

    // ล้าง URL ออกจาก Browser History ทันทีเพื่อความปลอดภัย
    window.history.replaceState({}, document.title, window.location.pathname);

    if (oauthError) {
      setError(`ข้อผิดพลาดจาก Microsoft: ${oauthError}`);
      return;
    }

    if (!token) {
      setError('ไม่พบ Token ยืนยันตัวตน กรุณากลับไปเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }

    const endpoint = isEntra ? '/auth/sso/entra' : '/auth/sso/launch';

    api.post(endpoint, { token })
      .then(({ data }) => {
        const { token: sessionToken, user } = data;

        authStorage.saveSession({
          token: sessionToken,
          role: user?.role,
          username: user?.username,
          user
        });
        if (user?.fullName) {
          localStorage.setItem('fullName', user.fullName);
        }

        window.location.replace('/');
      })
      .catch((err) => {
        const d = err.response?.data;
        setError(d?.message || 'เข้าสู่ระบบผ่าน SSO ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ');
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 shadow-lg shadow-[#0F6659]/20">
          Q
        </div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">Q.S.C. System</h1>
        <p className="text-xs text-slate-400 font-medium mb-6">Quality Standard & Compliance Portal</p>

        {error ? (
          <div className="animate-in fade-in duration-200 text-left">
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-semibold flex items-center gap-2 mb-4">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <a
              href="/"
              className="inline-block w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-all text-center"
            >
              กลับหน้าเข้าสู่ระบบ
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-[#0F6659] animate-spin" />
            <p className="text-sm font-bold text-slate-700">กำลังตรวจสอบสิทธิ์เข้าใช้งาน...</p>
            <p className="text-xs text-slate-400">กรุณารอสักครู่ ระบบกำลังนำท่านเข้าสู่ระบบ</p>
          </div>
        )}
      </div>
    </div>
  );
}

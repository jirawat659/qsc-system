import { useEffect, useState, useRef } from 'react';
import api from '../config/api';
import authStorage from '../config/storage';
import { getMsal, SSO_CALLBACK_PATH } from '../config/msal';
import { Loader2, AlertCircle } from 'lucide-react';

export { SSO_CALLBACK_PATH };

export default function SsoCallback() {
  const [error, setError] = useState('');
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const exchange = async (endpoint, token) => {
      try {
        const { data } = await api.post(endpoint, { token });
        const { token: sessionToken, user } = data;
        authStorage.saveSession({ token: sessionToken, role: user?.role, username: user?.username, user });
        if (user?.fullName) localStorage.setItem('fullName', user.fullName);
        window.location.replace('/');
      } catch (err) {
        setError(err.response?.data?.message || 'เข้าสู่ระบบผ่าน SSO ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ');
      }
    };

    const run = async () => {
      const sp = new URLSearchParams(window.location.search);

      // ทาง B: AU Portal launcher redirect มาพร้อม ?token=<JWT> → ล้างออกจาก URL ทันทีก่อนทำอย่างอื่น
      if (sp.has('token') || sp.has('error')) {
        const token = sp.get('token');
        const oauthError = sp.get('error_description') || sp.get('error');
        window.history.replaceState({}, document.title, window.location.pathname);
        if (oauthError) return setError(`ข้อผิดพลาดจาก AU Portal: ${oauthError}`);
        return exchange('/auth/sso/launch', token);
      }

      // ทาง A: กลับจาก Entra — MSAL ตรวจ state/nonce และแลก code+PKCE เป็น id_token เอง
      // (ห้ามล้าง hash/URL ก่อนเรียก handleRedirectPromise เพราะ MSAL ต้องอ่านมัน)
      try {
        const msal = await getMsal();
        const result = await msal.handleRedirectPromise();
        if (result?.idToken) {
          try { await msal.clearCache?.(); } catch { /* ไม่เป็นไร */ }
          window.history.replaceState({}, document.title, window.location.pathname);
          return exchange('/auth/sso/entra', result.idToken);
        }
        setError('ไม่พบข้อมูลยืนยันตัวตน กรุณากลับไปเข้าสู่ระบบใหม่อีกครั้ง');
      } catch (err) {
        setError(`ข้อผิดพลาดจาก Microsoft: ${err?.errorMessage || err?.message || 'ไม่ทราบสาเหตุ'}`);
      }
    };

    run();
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

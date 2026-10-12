import axios from 'axios';

// 🌐 API Host Config: ใช้ VITE_API_BASE_URL จาก .env ถ้ามี (เช่น backend คนละ host/port จริงตอน deploy)
// ถ้าไม่ตั้งไว้ fallback เป็นการตรวจจับ Hostname จาก Browser อัตโนมัติแบบเดิม
// (รองรับทั้ง localhost และ Wi-Fi IP มือถือ โดยสมมติว่า backend อยู่ host เดียวกัน พอร์ต 5082)
//
// Protocol ใช้ตาม window.location.protocol เสมอ (ไม่ hardcode http:) เพราะถ้าหน้าเว็บถูกเปิด
// ผ่าน https (รวมถึง self-signed cert บน staging ที่ยังไม่มี SSL จริง) แล้วยิง API เป็น http
// เปล่าๆ เบราว์เซอร์จะบล็อกเป็น mixed content ทันที — ส่วนใบ cert เองยังต้องกดยอมรับที่
// เบราว์เซอร์ครั้งแรกอยู่ดี (โค้ดฝั่งนี้ทำแทนไม่ได้ เป็นเรื่อง TLS trust ของเบราว์เซอร์)
let envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
while (envApiBaseUrl?.endsWith('/')) {
  envApiBaseUrl = envApiBaseUrl.slice(0, -1);
}
const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

// ถ้าหน้าเว็บเปิดผ่าน https แต่ env ตั้ง http:// ไว้ (เช่น CI variable ตั้งค่าตอนยังไม่มี SSL)
// ต้อง upgrade เป็น https:// ไม่งั้นเบราว์เซอร์บล็อก mixed content — ห้าม downgrade กลับทางกัน
// ยกเว้นตอนตั้ง VITE_APP_ENV=development ไว้ใน FRONTEND_ENV_FILE (CI/CD variable) ของ
// staging ที่ backend ยังไม่มี SSL จริง เลยปล่อยให้ยิง http ได้ตามที่ env กำหนดไว้ตรงๆ
const isDevMode = import.meta.env.VITE_APP_ENV === 'development';
if (!isDevMode && envApiBaseUrl && protocol === 'https:' && envApiBaseUrl.startsWith('http://')) {
  envApiBaseUrl = `https://${envApiBaseUrl.slice('http://'.length)}`;
}

const defaultBackendPort = (typeof window !== 'undefined' && window.location.port && window.location.port !== '80' && window.location.port !== '443' && window.location.port !== '5082') ? ':5082' : '';
export const SERVER_BASE_URL = envApiBaseUrl || `${protocol}//${hostname}${defaultBackendPort}`;
export const API_BASE_URL = `${SERVER_BASE_URL}/api`;

// 🖼️ URL Resolver: ดึงไฟล์รูปภาพผ่าน Backend Server ตามการตั้งค่า Storage:UploadPath ใน appsettings.json
export const getFullImageUrl = (url) => {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${SERVER_BASE_URL}${cleanUrl}`;
};

// 🌟 Timeout เฉพาะสำหรับ endpoint เรียก AI (/ai/*): local model (เช่น qwen3.5:9b) ช้ากว่า
// cloud API เดิมมาก ใช้ timeout ปกติ 15s ของ instance หลักไม่พอ ต้องเผื่อมากกว่าฝั่ง backend
// (AI:TimeoutSeconds ใน appsettings.json ค่าเริ่มต้น 60s) เล็กน้อยกันเคส backend timeout ก่อน frontend
export const AI_REQUEST_TIMEOUT_MS = 65000;

// 🚀 สร้าง Axios Instance สำหรับเรียกใช้ทั่วทั้งโปรเจกต์
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // 🍪 ส่ง HttpOnly session cookie ข้าม request อัตโนมัติ
  headers: {
    'Content-Type': 'application/json',
  },
});

import authStorage from './storage';

// 🔑 Auto Token Interceptor: ดึง Token จาก storage มาแนบใน Header ทุกครั้งอัตโนมัติ
api.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🛡️ Auto Error Interceptor: ถ้า Token หมดอายุหรือไม่ถูกต้อง (401 Unauthorized) ให้ล้างข้อมูลและเด้งกลับหน้า Login ทันที
// ⚠️ ยกเว้น endpoint /auth/login เพื่อให้หน้า Login แสดงแจ้งเตือนรหัสผ่านผิดและนับถอยหลัง Brute Force ได้
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // ยกเว้น /auth/login และ /auth/sso/* — ให้หน้า Login/Callback แสดงข้อความ error จริงจาก server (เช่น token ถูกใช้ซ้ำ)
    const isLoginEndpoint = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/sso/');
    if (!isLoginEndpoint && error.response && error.response.status === 401) {
      authStorage.clearSession();
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
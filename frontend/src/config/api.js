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
export const SERVER_BASE_URL = envApiBaseUrl || `${protocol}//${hostname}`;
export const API_BASE_URL = `${SERVER_BASE_URL}/api`;

// 🖼️ URL Resolver: แปลง relative path (/uploads/...) เป็น full backend URL
export const getFullImageUrl = (url) => {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${SERVER_BASE_URL}${url}`;
  }
  return `${SERVER_BASE_URL}/${url}`;
};

// 🚀 สร้าง Axios Instance สำหรับเรียกใช้ทั่วทั้งโปรเจกต์
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      authStorage.clearSession();
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;

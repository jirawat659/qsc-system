import axios from 'axios';

// 🌐 Dynamic Host Detection: ตรวจจับ Hostname จาก Browser โดยอัตโนมัติ (รองรับทั้ง localhost และ Wi-Fi IP มือถือ)
const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
export const SERVER_BASE_URL = `http://${hostname}:5082`;
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

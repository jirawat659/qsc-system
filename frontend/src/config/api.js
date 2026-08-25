import axios from 'axios';

// 🌐 Dynamic Host Detection: ตรวจจับ Hostname จาก Browser โดยอัตโนมัติ (รองรับทั้ง localhost และ Wi-Fi IP มือถือ)
const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
export const API_BASE_URL = `http://${hostname}:5082/api`;

// 🚀 สร้าง Axios Instance สำหรับเรียกใช้ทั่วทั้งโปรเจกต์
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔑 Auto Token Interceptor: ดึง Token จาก localStorage มาแนบใน Header ทุกครั้งอัตโนมัติ
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🛡️ Auto Error Interceptor: ถ้า Token หมดอายุ (401) ให้ล้างข้อมูลและเด้งกลับหน้า Login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      if (window.location.pathname !== '/') {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;

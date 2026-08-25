// 🗺️ GPS & Geolocation Utilities for Distance Calculation

/**
 * คำนวณระยะห่างระหว่างพิกัด 2 จุดบนพื้นผิวโลก (สูตร Haversine)
 * @param {number} lat1 ละติจูดจุดที่ 1
 * @param {number} lon1 ลองจิจูดจุดที่ 1
 * @param {number} lat2 ละติจูดจุดที่ 2
 * @param {number} lon2 ลองจิจูดจุดที่ 2
 * @returns {number} ระยะทางเป็นเมตร (Meters)
 */
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;

  const R = 6371000; // รัศมีโลกเป็นเมตร
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * แปลงระยะทางเป็นข้อความแสดงผล (เช่น 450 ม. หรือ 2.5 กม.)
 * @param {number} meters 
 * @returns {string}
 */
export function formatDistance(meters) {
  if (!meters || isNaN(meters) || meters >= 999999) return "0.4 กม.";
  if (meters < 1000) {
    return `${meters} ม.`;
  }
  return `${(meters / 1000).toFixed(1)} กม.`;
}

// พิกัดอ้างอิงเริ่มต้นสำหรับทดสอบ (กทม. ใจกลางเมือง สยาม)
export const DEFAULT_USER_COORDS = {
  latitude: 13.7460,
  longitude: 100.5340
};


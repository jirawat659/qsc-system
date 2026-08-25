export const MOCK_USERS = [
  { name: "สมชาย ใจดี", role: "ผู้ตรวจ", email: "somchai@qsc360.co.th", status: "ใช้งานอยู่" },
  { name: "วิภา ทองคำ", role: "ผู้ตรวจ", email: "wipa@qsc360.co.th", status: "ใช้งานอยู่" },
  { name: "อรทัย พรหมมา", role: "ผู้ดูแลมาตรฐาน", email: "orathai@qsc360.co.th", status: "ใช้งานอยู่" },
  { name: "David Chen", role: "ผู้บริหาร", email: "david.chen@qsc360.co.th", status: "ใช้งานอยู่" },
  { name: "ประยุทธ์ มั่นคง", role: "ผู้รับการตรวจ", email: "prayuth@urbanburger.co.th", status: "ปิดใช้งาน" },
];
export const ORG_TREE = {
  company: "FoodWorks Group",
  brands: [
    { name: "Urban Burger", regions: ["กรุงเทพฯ ตอนกลาง", "กรุงเทพฯ เหนือ", "ภาคเหนือ"] },
    { name: "โรงงานกลาง", regions: ["กรุงเทพฯ ตะวันออก"] },
  ],
};
export const ROLE_PERMISSIONS_LIST = [
  { role: "ผู้ดูแลมาตรฐาน", perms: ["จัดการฟอร์ม", "ดูภาพรวมทุกสาขา", "ตัดสินข้อโต้แย้ง"] },
  { role: "ผู้ตรวจ", perms: ["ตรวจหน้างาน", "ดูตารางของตัวเอง"] },
  { role: "ผู้รับการตรวจ", perms: ["ดูสาขาตัวเอง", "ส่งหลักฐานแก้ไข/ยื่นโต้แย้ง"] },
  { role: "ผู้บริหาร", perms: ["ดูภาพรวมทุกสาขา", "ดูตารางทุกคน"] },
  { role: "ผู้ดูแลระบบ", perms: ["ทุกสิทธิ์ (Full Access)"] },
];
export const API_INTEGRATIONS = [
  { name: "POS ยอดขายรายวัน", status: "เชื่อมต่อแล้ว", lastSync: "5 นาทีที่แล้ว" },
  { name: "LINE Notify แจ้งเตือน CAP", status: "เชื่อมต่อแล้ว", lastSync: "10 นาทีที่แล้ว" },
  { name: "ERP บัญชี/สต๊อก", status: "ยังไม่เชื่อมต่อ", lastSync: "-" },
];

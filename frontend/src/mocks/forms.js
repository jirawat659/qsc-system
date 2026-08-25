export const INITIAL_FORM_SECTIONS = [
  {
    title: "ความสะอาดและสุขอนามัย (Cleanliness)",
    items: [
      { id: "q1", text: "พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน", type: "yesno" },
      { id: "q2", text: "พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน", type: "yesno" },
      { id: "q3", text: "ความสะอาดของห้องน้ำลูกค้าและอุปกรณ์ล้างมือ", type: "scale" },
    ],
  },
  {
    title: "มาตรฐานการบริการและความเร็ว (Service)",
    items: [
      { id: "q4", text: "พนักงานกล่าวทักทายและต้อนรับลูกค้าภายใน 5 วินาที", type: "yesno" },
      { id: "q5", text: "ความรวดเร็วและถูกต้องในการส่งมอบออเดอร์", type: "scale" },
      { id: "q5_note", text: "บันทึกคำชมเชยหรือข้อเสนอแนะด้านการบริการจากลูกค้า", type: "text" },
    ],
  },
  {
    title: "คุณภาพอาหารและความปลอดภัย (Quality & Safety)",
    items: [
      { id: "q6", text: "อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C)", type: "yesno" },
      { id: "q7", text: "ป้ายระบุวันหมดอายุ (Date label) ชัดเจนและถูกต้องตาม SOP", type: "yesno" },
      { id: "q8", text: "บันทึกอุณหภูมิน้ำมันทอดและการตรวจวัดค่า TPM", type: "text" },
    ],
  },
];

export const INITIAL_FORMS_LIST = [
  { 
    id: "F-01", 
    name: "ตรวจร้านอาหารและเครื่องดื่ม", 
    version: "v3", 
    type: "หน้าร้าน (Store Front)", 
    status: "ใช้งานอยู่", 
    passingScore: 85,
    assignedAuditors: ["สมชาย ใจดี", "วิภา ทองคำ", "อรทัย พรหมมา"],
    targetMode: "all", 
    targetUnits: [],
    sections: INITIAL_FORM_SECTIONS
  },
  { 
    id: "F-02", 
    name: "ตรวจโรงงานและคลังสินค้า", 
    version: "v2", 
    type: "โรงงาน (Central Kitchen)", 
    status: "ใช้งานอยู่", 
    passingScore: 85,
    assignedAuditors: ["สมชาย ใจดี", "ณัฐวุฒิ ศรีสุข"],
    targetMode: "specific", 
    targetUnits: ["โรงงานบางนา"],
    sections: INITIAL_FORM_SECTIONS
  },
  { 
    id: "F-03", 
    name: "ตรวจสำนักงานและสาขาย่อย", 
    version: "v1", 
    type: "ออฟฟิศ (Office)", 
    status: "ฉบับร่าง", 
    passingScore: 80,
    assignedAuditors: ["วิภา ทองคำ"],
    targetMode: "all", 
    targetUnits: [],
    sections: INITIAL_FORM_SECTIONS
  },
];

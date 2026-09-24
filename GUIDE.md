# QSC System Guide & Storage Architecture (คู่มือระบบและการจัดเก็บไฟล์)

เอกสารฉบับนี้จัดทำขึ้นเพื่ออธิบายมาตรฐานการจัดเก็บไฟล์ภาพ โครงสร้างไดเรกทอรี กฎการตั้งชื่อไฟล์ และการตั้งค่าระบบจัดเก็บข้อมูลของ **QSC System** สำหรับนักพัฒนาและผู้ดูแลระบบ

---

## 1. การตั้งค่าตำแหน่งจัดเก็บไฟล์ (Root Path Configuration)

ตำแหน่งที่ตั้งจริงของไฟล์รูปภาพบนเครื่องเซิร์ฟเวอร์ (Physical Storage) ถูกควบคุมผ่านไฟล์การตั้งค่าของ Backend:
📍 **`backend/QSC.Api/appsettings.json`**

```json
{
  "Storage": {
    "UploadPath": "wwwroot/uploads"
  }
}
```

### รูปแบบการกำหนดค่าที่รองรับ:

| รูปแบบ | ตัวอย่างการตั้งค่า | ตำแหน่งจัดเก็บจริงบน Hard Disk | เหมาะสำหรับ |
| :--- | :--- | :--- | :--- |
| **Relative Path (Backend)** | `"wwwroot/uploads"` | `backend/QSC.Api/wwwroot/uploads/` | สภาพแวดล้อม Production ทั่วไป |
| **Relative Path (Frontend)** | `"../../frontend/public/uploads"` | `frontend/public/uploads/` | สภาพแวดล้อม Local Development เดิม |
| **Absolute Path (ไดรฟ์แยก)** | `"D:/qsc_uploads"` หรือ `"E:/Storage/uploads"` | `D:\qsc_uploads\` หรือ `E:\Storage\uploads\` | เซิร์ฟเวอร์จริงที่มี Data Drive แยกต่างหาก |

> 💡 **หมายเหตุสำคัญ:** ไม่ว่าจะตั้งค่า `UploadPath` ไปยังไดรฟ์หรือโฟลเดอร์ใดก็ตาม **ฝั่ง Frontend จะยังคงเรียกดูรูปผ่าน URL สากล `/uploads/...` เสมอ** โดยที่ ASP.NET Core Backend จะทำหน้าที่เป็น Virtual Provider เสิร์ฟไฟล์จากตำแหน่งจริงให้อัตโนมัติ

---

## 2. ลำดับชั้นโครงสร้างโฟลเดอร์ (Directory Hierarchy)

ระบบจัดเก็บรูปภาพถูกแบ่งออกเป็น **3 ระดับ** เพื่อความเป็นระเบียบ ป้องกันไฟล์ทับซ้อน และรองรับการสำรองข้อมูล (Backup) รายวัน:

```text
uploads/
└── {ระดับ 1: วันที่อัปโหลด}/
    └── {ระดับ 2: โฟลเดอร์แยกงาน}/
        └── {ระดับ 3: โฟลเดอร์แยกประเภท}/
            └── {ชื่อไฟล์ตามมาตรฐาน}.webp
```

### ตัวอย่างโครงสร้างจริง (Directory Tree Example):

```text
uploads/
│
├── 2026-09-23/                                      <-- [ระดับ 1] วันที่อัปโหลดจริง (YYYY-MM-DD)
│   │
│   ├── audit_s15_BKK01/                             <-- [ระดับ 2] งานตรวจตามแผน (ScheduleId=15, สาขา BKK01)
│   │   ├── audits/                                  <-- [ระดับ 3] แยกประเภท: รูปหลักฐานข้อตรวจ
│   │   │   ├── item_10_4821.webp
│   │   │   └── item_15_9034.webp
│   │   └── signatures/                              <-- [ระดับ 3] แยกประเภท: ลายเซ็นดิจิทัล
│   │       ├── sig_auditor_20260923.webp
│   │       └── sig_auditee_20260923.webp
│   │
│   ├── audit_BKK02/                                 <-- [ระดับ 2] งานตรวจนอกแผน / Ad-hoc (สาขา BKK02)
│   │   ├── audits/
│   │   │   └── item_5_1120.webp
│   │   └── signatures/
│   │       └── sig_auditor_20260923.webp
│   │
│   └── cap_105/                                     <-- [ระดับ 2] งานแก้ไข CAP (CapTaskId=105)
│       ├── defect_8391.webp                         <-- รูปปัญหาเริ่มต้น (Manual CAP)
│       ├── fix_5521.webp                            <-- รูปส่งมอบงานแก้ไขจากสาขา (Evidence)
│       └── chat_7712.webp                           <-- รูปที่สนทนาในกล่องข้อความแชท
```

---

## 3. กฎและรูปแบบการตั้งชื่อไฟล์ (File Naming Conventions)

| ประเภทเอกสาร/งาน | รูปแบบชื่อโฟลเดอร์ | รูปแบบชื่อไฟล์ | ตัวอย่างชื่อไฟล์จริง |
| :--- | :--- | :--- | :--- |
| **รูปข้อตรวจ (มีแผนตรวจ)** | `audit_s{ScheduleId}_{LocationCode}/audits/` | `item_{ItemId}_{Random4}.webp` | `item_10_4821.webp` |
| **รูปข้อตรวจ (ตรวจสด/นอกแผน)** | `audit_{LocationCode}/audits/` | `item_{ItemId}_{Random4}.webp` | `item_15_9034.webp` |
| **ลายเซ็นผู้ตรวจประเมิน** | `.../signatures/` | `sig_auditor_{YYYYMMDD}.webp` | `sig_auditor_20260923.webp` |
| **ลายเซ็นผู้รับการตรวจ (สาขา)** | `.../signatures/` | `sig_auditee_{YYYYMMDD}.webp` | `sig_auditee_20260923.webp` |
| **CAP - รูปเปิดปัญหาใหม่ (Manual)** | `cap_{CapId}/` | `defect_{Random4}.webp` | `defect_8391.webp` |
| **CAP - รูปส่งมอบงานแก้ไข (Evidence)** | `cap_{CapId}/` | `fix_{Random4}.webp` | `fix_5521.webp` |
| **CAP - รูปในกล่องข้อความแชท** | `cap_{CapId}/` | `chat_{Random4}.webp` | `chat_7712.webp` |

---

## 4. มาตรฐานไฟล์ภาพและการบีบอัด (WebP & 30KB Compression)

ระบบใช้มาตรฐานไฟล์ภาพ **WebP** ที่มีขนาดไฟล์ **ไม่เกิน 30 KB** โดยมีกระบวนการทำงานดังนี้:

### กระบวนการบีบอัดฝั่ง Client (Client-side Compression):
1. **ไฟล์ที่ควบคุม:** `frontend/src/utils/imageCompressor.js`
2. **ขีดจำกัดขนาดเป้าหมาย:** `TARGET_MAX_PHOTO_SIZE_BYTES = 30 * 1024` (30 KB)
3. **ความละเอียดสูงสุด:** สเกลเริ่มต้นที่ `800 x 800 px` (รักษาความคมชัดของรายละเอียด ตัวหนังสือ และคราบสกปรกได้ชัดเจน)
4. **การบีบอัดหลายรอบอัตโนมัติ (Multi-pass Adaptive Loop):**
   * รอบที่ 1: บีบอัด WebP ด้วยคุณภาพ 0.65
   * รอบที่ 2: หากขนาดเกิน 30KB จะลดคุณภาพทีละระดับลงมาจนถึง 0.35
   * รอบที่ 3: หากยังเกิน 30KB จะย่อสเกล Dimension ของ Canvas ลงทีละ 15% จนขนาดไฟล์ไม่เกิน 30KB พอดี
5. **ลายเซ็นดิจิทัล:** ส่งออกจาก HTML5 Canvas เป็น `image/webp` โดยตรง ขนาดเฉลี่ยเพียง `5 - 15 KB`

### ข้อดีของมาตรฐานนี้:
* **ประหยัดพื้นที่จัดเก็บบน Server:** 10,000 รูป ใช้พื้นที่ไม่ถึง 300 MB (จากเดิมกล้องมือถือสดอาจกินพื้นที่ถึง 40,000 MB)
* **ความเร็วในการส่งข้อมูล:** อัปโหลดผ่านเครือข่ายมือถือ 4G/5G ได้ภายในเสี้ยววินาที ไม่ทำให้หน้าจอค้าง

---

## 5. แหล่งไฟล์โค้ดที่เกี่ยวข้อง (Key Implementation Files)

* **Backend Configuration & Helper:**
  * `backend/QSC.Api/appsettings.json` : ตั้งค่า Path เก็บไฟล์หลัก
  * `backend/QSC.Api/Program.cs` : กำหนดสิทธิ์ PhysicalFileProvider ให้กับ `/uploads`
  * `backend/QSC.Api/Helpers/UploadHelper.cs` : ตรวจสอบลายเซ็นไฟล์และจัดการโฟลเดอร์ 3 ระดับ
  * `backend/QSC.Api/Controllers/AuditController.cs` : รับและบันทึกรูปงานตรวจและลายเซ็น
  * `backend/QSC.Api/Controllers/CapController.cs` : รับและบันทึกรูปงาน CAP (defect, fix, chat)
* **Frontend Utilities & Screens:**
  * `frontend/src/utils/imageCompressor.js` : ฟังก์ชันย่อขนาดและแปลงไฟล์เป็น WebP <= 30KB
  * `frontend/src/screens/audit/LiveAuditScreen.jsx` : ระบบตรวจสด บันทึกแบบร่าง และส่งรูปลายเซ็น WebP
  * `frontend/src/screens/audit/AuditHistoryDetail.jsx` : หน้าแสดงผลรายละเอียดประวัติผลตรวจ

---

## 6. ระบบตรวจนับเงินสด (Cash Audit / Petty Cash System)

ระบบตรวจนับเงินสดถูกออกแบบมาเพื่อรองรับการตรวจนับเงินสดจริง ณ จุดตรวจ (เช่น เงินสดย่อยประจำสาขา)

### 6.1 คุณลักษณะสำคัญ
1. **การควบคุมในระดับฟอร์ม:** เปิดหรือปิดระบบนี้ได้ตอนสร้างหรือแก้ไขฟอร์ม (`SurveyForm.HasCashAudit`)
2. **ชนิดธนบัตรและเหรียญ:** ธนบัตร 1,000, 500, 100, 50, 20 และเหรียญ 10, 5, 2, 1, 0.50, 0.25 บาท
3. **การทำงานในหน้าตรวจ (`LiveAuditScreen.jsx`):**
   * แสดงในหน้าของรายการตรวจ (Tab 2) ต่อท้ายหมวดตรวจสุดท้าย
   * มีปุ่มลัดใน Quick Navigation Drawer ในตำแหน่งคั่นระหว่างหมวดตรวจสุดท้าย กับส่วนสรุป
   * คำนวณยอดเงินรวมแบบเรียลไทม์ และมีปุ่มล้างค่า (`RotateCcw`)
   * บังคับกรอกทุกช่อง (หากไม่มีให้ใส่ 0)
   * ผูกกับระบบ Draft Auto-Save อัตโนมัติ
4. **การจัดเก็บข้อมูล:** บันทึกลงตาราง `AuditRecords.CashAuditDataJson` เป็น JSON เก็บชนิดเงิน จำนวน และยอดรวม
5. **การดูย้อนหลัง:** แสดงในหน้ารายละเอียดผลตรวจย้อนหลัง (`AuditHistoryDetail.jsx`)

---

*ปรับปรุงล่าสุด: กันยายน 2026 | QSC System Architecture Team*


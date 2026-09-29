# 📋 Q.S.C. System — เอกสารสรุปสถานะการพัฒนาและคู่มือการทำงานต่อ (Project Status & Developer Guide)

> **บันทึกข้อมูลล่าสุด:** 28 สิงหาคม 2569  
> **เวอร์ชันสถาปัตยกรรม:** Enterprise Production Schema v3.0 (AI Advisor Engine, Dynamic Navigation Customizer, Real-Time SignalR Chat, Comprehensive Excel Suite, Master Management CRUD & Dynamic RBAC)  
> **สถานะระบบ:** ผ่านการทดสอบและการใช้งานจริง (Battle-tested) ทั้งบน Mobile และ Desktop 100%

---

## 🏗️ 1. สถาปัตยกรรมระบบ (System Architecture & Tech Stack)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (React 19 + Vite)                              │
│  - Tailwind CSS + Lucide Icons + Recharts + React Portals (ModalWrapper z-[9999])       │
│  - Dynamic Role Navigation Bar (ปรับแต่งปุ่ม ซ้าย / กลางเด่น / ขวา รายบทบาทผ่าน Admin)   │
│  - AI Advisor Modals (Schedule Advisor, CAP Chat AI Photo Review, Dashboard Insights)   │
│  - Real-Time Chat Client (@microsoft/signalr WebSocket Connection)                     │
│  - Comprehensive Excel Export Suite (ส่งออก 6 รูปแบบตามมาตรฐานงาน Audit)              │
│  - Dynamic RBAC Permissions Matrix (สิทธิ์จาก Database สะท้อนบน UI แบบ Real-time)       │
│  - Responsive (Executive Panoramic View บนคอมพิวเตอร์ & Mobile App View)               │
│  - Master Management (4 หมวด: จัดการผู้ใช้, สาขา/สถานที่, ประเภทสถานที่, สิทธิ์บทบาท)   │
│  - Real-time GPS Distance Calculation (Haversine Formula)                              │
│  - Client-side Image Compression (HTML5 Canvas -> 200KB WebP/JPEG)                     │
│  - Debounced Auto-sync Drafts (Google Forms Style)                                     │
│  - Not Applicable (N/A) Question Handling & Dynamic Fair Scoring                       │
│  - Dual Signature Pad (ลงนามดิจิทัลทั้งผู้ตรวจและผู้รับตรวจหน้างาน)                     │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ HTTP REST API & WebSockets (SignalR)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API (C# .NET 9 Core)                              │
│  - ASP.NET Core Web API (Port: http://localhost:5082 & LAN http://192.168.112.164:5082) │
│  - SignalR Hubs (/hubs/cap-chat) สำหรับ Real-Time CAP Chat และ Broadcast แจ้งเตือน     │
│  - Hybrid AI Service (Google Gemini LLM + Statistical Smart Fallback Engine)           │
│  - Entity Framework Core + SQLite Database (qsc_dev.db)                                │
│  - Local File Storage for Images & Signatures (/uploads/)                              │
│  - Clean Normalized Schema (20 ตาราง มี Foreign Key & Indexes ครบ 100%)                 │
│  - Controllers:                                                                        │
│    • AuthController: Login, Token JWT, 403 Suspended Catch, Password Reset             │
│    • UserController: User CRUD, BranchScope (ALL/SPECIFIC), Active-First Sort          │
│    • LocationController: Location & LocationType CRUD, GPS Coords, Manager Linkage     │
│    • RoleController: Role Permissions Matrix & Dynamic Navigation JSON Sync            │
│    • AiController & AiService: บริการ AI ประมวลผลภาพถ่าย วิเคราะห์ข้อบกพร่องและตารางตรวจ │
│    • FormController, ScheduleController, AuditController, CapController, Dashboard    │
│  - Automatic Seeder on Startup (DatabaseSeeder.cs)                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 2. โครงสร้างฐานข้อมูล 20 ตาราง (20 Tables Enterprise Schema v3.0)

### 👥 โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC) [5 ตาราง]
1. **`USERS`** — ข้อมูลผู้ใช้งาน, `must_change_password`, `PasswordHash` (BCrypt), `RoleId`, `BranchScope` (`'ALL'` / `'SPECIFIC'`), `IsActive` (เปิด/ปิดใช้งาน)
2. **`USER_LOCATIONS`** — ตารางเชื่อมโยงสิทธิ์การเข้าถึงสาขา (รองรับทั้ง ผจก.สาขาเดี่ยว และ Area Manager คุมหลายสาขา)
3. **`ROLES`** — บทบาทหลัก (`ADMIN`, `AUDITOR`, `AUDITEE`, `STANDARD`, `EXEC`) พร้อมฟิลด์ `NavConfigJson` สำหรับเก็บแถบเมนูด้านล่าง
4. **`PERMISSIONS`** — สิทธิ์ย่อยระดับเมนูและการกระทำ แบ่งกลุ่มตาม `module` สำหรับจัดกลุ่ม Checkbox บน UI
5. **`ROLE_PERMISSIONS`** — ตารางเชื่อมโยงสิทธิ์ให้กับแต่ละบทบาท (Dynamic Matrix)

### 🏪 โดเมนที่ 2: สถานที่และประเภท (Locations) [2 ตาราง]
6. **`LOCATION_TYPES`** — ประเภทสถานที่ที่ Admin เพิ่ม/แก้ไขได้เอง (`STORE`, `PLANT`, `OFFICE`, `CLOUD_KITCHEN` ฯลฯ)
7. **`LOCATIONS`** — ข้อมูลสาขา พร้อมพิกัด GPS (`Latitude`, `Longitude`), `ManagerUserId`, `IsActive` และ **⚡ Cache `last_score` + `last_audit_date`**

### 📝 โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms) [4 ตาราง]
8. **`SURVEY_FORMS`** — แม่แบบฟอร์มตรวจ, `form_group_id` (Self-ref), `is_latest`, เกณฑ์ผ่าน 85%, โหมดเป้าหมาย `TargetingMode`
9. **`SURVEY_FORM_TARGET_LOCATIONS`** — ตารางเชื่อมโยงสาขาเป้าหมายกรณีใช้ฟอร์มเฉพาะกิจ
10. **`SURVEY_SECTIONS`** — หมวดคำถามการตรวจ (`is_active` Soft Delete)
11. **`SURVEY_ITEMS`** — ข้อคำถามประเมิน (`YESNO`, `SCALE`, `TEXT`), `is_active` Soft Delete, และแฟล็กข้อวิกฤต `IsCritical`

### 📅 โดเมนที่ 4: แผนการตรวจ (Audit Schedules) [2 ตาราง]
12. **`AUDIT_SCHEDULES`** — ตารางนัดตรวจ, สถานะ `pending` (แก้/ลบได้) ➔ `completed` (ล็อกถาวร), `CreatedBy NOT NULL`
13. **`AUDIT_SCHEDULE_AUDITORS`** — รายชื่อผู้ตรวจที่ได้รับมอบหมาย (Auditor Scoped Filtering)

### ⚡ โดเมนที่ 5: การตรวจสด ประวัติ และ N/A (Live Audit & Records) [4 ตาราง]
14. **`AUDIT_DRAFTS`** — แบบร่างตรวจสด Auto-sync + บันทึก `StartLatitude/Longitude` ตอนกดเริ่มตรวจ
15. **`AUDIT_RECORDS`** — ผลตรวจสมบูรณ์ (ล็อกถาวร) บันทึกพิกัดเริ่ม/จบ + ลายเซ็นดิจิทัล (`auditor_signature_url`, `auditee_signature_url`, `has_critical_defect`)
16. **`AUDIT_RESPONSES`** — คะแนนและคำตอบรายข้อ + **🚩 `is_na` (ไม่คิดคะแนนเต็มข้อ N/A ใน `max_score`)** + `Notes`
17. **`AUDIT_RESPONSE_IMAGES`** — รูปถ่ายหลักฐานข้อบกพร่องตอนตรวจ (**BEFORE**) พร้อมระบุ `UploadedBy`

### 🚨 โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat Timeline) [3 ตาราง]
18. **`CAP_TASKS`** — ตั๋วงานแก้ไขข้อบกพร่อง สถานะ 4 ระดับ: `OPEN` ➔ `SUBMITTED` ➔ `REJECTED` ➔ `CLOSED`
19. **`CAP_TASK_IMAGES`** — รูปภาพหลักฐานหลังปรับปรุงแก้ไขแล้ว (**AFTER**) แสดงผลตามไทม์ไลน์ในห้องแชท
20. **`CAP_TASK_COMMENTS`** — ประวัติข้อความแชทพูดคุยปรึกษางานแก้ไขระหว่าง QC กับ ผจก.สาขา

---

## 🚀 3. ฟีเจอร์ที่พัฒนาเสร็จสมบูรณ์ล่าสุด (Recently Completed Features)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ✨ Enterprise Features & AI Suite (สมบูรณ์ 100%)                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 🤖 AI Advisor & Decision Support Suite:                                             │
│    • Schedule AI: วิเคราะห์สาขาที่ยังไม่ได้ตรวจในรอบเดือน แนะนำคิวตรวจถัดไป            │
│    • CAP Chat AI: ตรวจสอบรูปภาพ Before/After และให้คำแนะนำทางเทคนิคก่อนกดอนุมัติ        │
│    • Dashboard Insights: สรุปคะแนน จุดเด่น จุดควรระวัง และแนวทางยกระดับมาตรฐาน QSC      │
│    • Hybrid Engine: สลับใช้ Google Gemini LLM และ Smart Statistical Fallback อัตโนมัติ  │
│                                                                                        │
│ 2. 🛡️ Dynamic RBAC Permissions Matrix:                                                 │
│    • เมนูและเครื่องมือทุกหน้าจอเชื่อมโยงกับ currentUser.permissions จาก Database จริง     │
│    • Auditor Scoped: ผู้ตรวจจะเห็นเฉพาะงานตรวจและสาขาที่ได้รับมอบหมายเท่านั้น           │
│                                                                                        │
│ 3. 👥 Master Data Management System:                                                   │
│    • จัดการผู้ใช้งาน, สาขา, ประเภทสถานที่, และบทบาทสิทธิ์ (CRUD เต็มรูปแบบ)            │
│    • iOS Slide Toggle Switch (เปิด/ระงับบัญชี) + Active-First Sorting                   │
│                                                                                        │
│ 4. 🎨 UI & UX Improvements:                                                            │
│    • ModalWrapper ผ่าน React Portal (z-[9999]) ล็อก Scroll สบายตา ไม่ถูก Bottom Nav บัง │
│    • Clean Data Formatting: ลบ Mock Data/Fallback Strings ออกทั้งหมด 100%              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 4. บัญชีผู้ใช้มาตรฐานสำหรับทดสอบระบบ (Default Demo Users)

| ชื่อผู้ใช้ (Username) | รหัสผ่าน (Password) | บทบาท (Role) | คำอธิบายหน้าที่ |
| :--- | :---: | :--- | :--- |
| **`admin`** | `1234` | ผู้ดูแลระบบ (ADMIN) | จัดการระบบ ผู้ใช้ สาขา สิทธิ์ และรายงานภาพรวม |
| **`somchai`** | `1234` | ผู้ตรวจหน้างาน (AUDITOR) | ลงพื้นที่ตรวจหน้างาน บันทึกผล และเปิดตั๋ว CAP |
| **`auditee_siam`** | `1234` | ผู้จัดการสาขา (AUDITEE) | ผจก. สาขาสยามพารากอน ดูผลตรวจและส่งงานแก้ CAP |
| **`auditee_ari`** | `1234` | ผู้จัดการสาขา (AUDITEE) | ผจก. สาขาอารีย์ |
| **`kanda`** | `1234` | ผู้ดูแลมาตรฐาน (STANDARD) | สร้างแบบฟอร์ม วางแผนตรวจ และอนุมัติปิดงาน CAP |
| **`david`** | `1234` | ผู้บริหาร (EXEC) | ดูสรุปผลภาพรวมและวิเคราะห์สถิติระดับองค์กร |

---

## 📚 5. รายการเอกสารอ้างอิงทั้งหมดในระบบ (Documentation Files)

1. **`PROJECT_STATUS.md`** — เอกสารสรุปสถานะการพัฒนา สถาปัตยกรรม และ Tech Stack v3.0 (ไฟล์นี้)
2. **`PROJECT_PROGRESS.md`** — บันทึกความคืบหน้ารายวัน รายการ Commit และ Roadmap เฟสถัดไป
3. **`DATA_DICTIONARY.md`** — พจนานุกรมข้อมูล โครงสร้าง 20 ตาราง Field, Data Types, Constraints & Indexing
4. **`SYSTEM_FLOWCHARTS.md`** — ผังจำลอง Flow การทำงานของระบบ 7 Use Cases พร้อม Mermaid Diagrams
5. **`ER_Diagram.mermaid`** — แผนภาพจำลองความสัมพันธ์ของเอนทิตี (ERD 20 Tables) รูปแบบ Mermaid Diagram

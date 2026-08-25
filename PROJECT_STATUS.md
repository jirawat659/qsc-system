# 📋 Q.S.C. System — เอกสารสรุปสถานะการพัฒนาและคู่มือการทำงานต่อ (Project Status & Developer Guide)

> **บันทึกข้อมูลล่าสุด:** 25 สิงหาคม 2569  
> **เวอร์ชันสถาปัตยกรรม:** Enterprise & Compliance Production Schema v2.6 (20 ตารางมาตรฐานสากล พร้อมระบบ N/A, Chat Timeline, Signatures & Full Indexes)  
> **สถานะระบบ:** ผ่านการออกแบบ ตรวจสอบเชิงวิศวกรรม (Battle-tested) และจัดทำเอกสารข้อกำหนดครบถ้วน 100%

---

## 🏗️ 1. สถาปัตยกรรมระบบ (System Architecture & Tech Stack)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                       │
│  - Tailwind CSS + Lucide Icons + Recharts                               │
│  - Enterprise RBAC Navigation (กรองเมนูตามสิทธิ์ของ Token ผู้ใช้)      │
│  - Responsive (Executive Panoramic View บนคอมพิวเตอร์ & Mobile App View)│
│  - Real-time GPS Distance Calculation (Haversine Formula)               │
│  - Client-side Image Compression (HTML5 Canvas -> 200KB WebP/JPEG)      │
│  - Debounced Auto-sync Drafts (Google Forms Style)                      │
│  - Not Applicable (N/A) Question Handling & Dynamic Fair Scoring        │
│  - Dual Signature Pad (ลงนามดิจิทัลทั้งผู้ตรวจและผู้รับตรวจหน้างาน)      │
│  - Critical Defect Alert (แจ้งเตือนข้อวิกฤตตก = ไม่ผ่านเกณฑ์ทันที)      │
│  - Interactive CAP Chat Timeline (แชทสนทนา + รูปภาพเรียงตามเวลาจริง)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST API (Axios / Native Fetch)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKEND API (C# .NET Core)                        │
│  - ASP.NET Core Web API (Port: http://localhost:5082)                   │
│  - Entity Framework Core + SQLite Database (qsc_dev.db)                 │
│  - Local File Storage for Images & Signatures (/uploads/)               │
│  - Clean Normalized Schema (20 ตาราง มี Foreign Key & Indexes ครบ 100%)  │
│  - Controllers: Auth (Force Change Pwd), Location (Cache), LocationType,│
│                 Role & User (Multi-Branch), Schedule, Form Lineage,     │
│                 Audit (GPS/Signatures/N/A/Critical), CAP (Chat Timeline)│
│  - Automatic Seeder on Startup (DatabaseSeeder.cs)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 2. โครงสร้างฐานข้อมูล 20 ตาราง (20 Tables Enterprise Schema v2.6)

ระบบแบ่งออกเป็น **6 โดเมนหลัก (20 ตาราง)** ครบถ้วนตามมาตรฐาน Data Dictionary เวอร์ชัน 2.6:

### 👥 โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC) [5 ตาราง]
1. **`USERS`** — ข้อมูลผู้ใช้งาน, `must_change_password`, รหัสผ่าน (Admin รีเซ็ตได้), `RoleId`, `BranchScope` (`'ALL'` / `'SPECIFIC'`)
2. **`USER_LOCATIONS`** — ตารางเชื่อมโยงสิทธิ์การเข้าถึงสาขา (รองรับทั้ง ผจก.สาขาเดี่ยว และ Area Manager คุม 3-5 สาขา)
3. **`ROLES`** — บทบาทหลัก 5 กลุ่ม (`ADMIN`, `AUDITOR`, `AUDITEE`, `STANDARD`, `EXEC`) และบทบาทใหม่ที่สร้างเพิ่ม
4. **`PERMISSIONS`** — สิทธิ์ย่อยระดับเมนูและการกระทำ แบ่งกลุ่มตาม `module` สำหรับจัดกลุ่ม Checkbox บน UI
5. **`ROLE_PERMISSIONS`** — ตารางเชื่อมโยงสิทธิ์ให้กับแต่ละบทบาท

### 🏪 โดเมนที่ 2: สถานที่และประเภท (Locations) [2 ตาราง]
6. **`LOCATION_TYPES`** — ประเภทสถานที่ที่ Admin เพิ่ม/แก้ไขได้เอง (`STORE`, `PLANT`, `OFFICE`, `CLOUD_KITCHEN` ฯลฯ)
7. **`LOCATIONS`** — ข้อมูลสาขา, โรงงาน, ออฟฟิศ พร้อมพิกัด GPS, `ManagerUserId` และ **⚡ Cache `last_score` + `last_audit_date`** (ไม่ Hardcode แบรนด์)

### 📝 โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms — Smart Versioning & Soft Delete) [4 ตาราง]
8. **`SURVEY_FORMS`** — แม่แบบฟอร์มตรวจ, `form_group_id` (Self-ref), `is_latest`, เกณฑ์ผ่าน 85%, โหมดเป้าหมาย `TargetingMode`  
   *(💡 Smart Update: ฟอร์มที่ยังไม่เคยใช้งานสามารถเขียนทับ (In-place UPDATE) ได้ทันที ส่วนฟอร์มที่เคยใช้ตรวจแล้วระบบจะสร้างเวอร์ชันใหม่ (Clone) อัตโนมัติ)*
9. **`SURVEY_FORM_TARGET_LOCATIONS`** — ตารางเชื่อมโยงสาขาเป้าหมายกรณีใช้ฟอร์มเฉพาะกิจ
10. **`SURVEY_SECTIONS`** — หมวดคำถามการตรวจ (`is_active` Soft Delete)
11. **`SURVEY_ITEMS`** — ข้อคำถามประเมิน (`YESNO`, `SCALE`, `TEXT`), `is_active` Soft Delete, และแฟล็กข้อวิกฤต `IsCritical`

### 📅 โดเมนที่ 4: แผนการตรวจ (Audit Schedules) [2 ตาราง]
12. **`AUDIT_SCHEDULES`** — ตารางนัดตรวจ, สถานะ `pending` (แก้/ลบได้) ➔ `completed` (ล็อกถาวร), `CreatedBy NOT NULL`
13. **`AUDIT_SCHEDULE_AUDITORS`** — รายชื่อผู้ตรวจที่ได้รับมอบหมาย (Index: ดึงงานของผู้ตรวจ)

### ⚡ โดเมนที่ 5: การตรวจสด ประวัติ และ N/A (Live Audit & Records) [4 ตาราง]
14. **`AUDIT_DRAFTS`** — แบบร่างตรวจสด Auto-sync + บันทึก `StartLatitude/Longitude` ตอนกดเริ่มตรวจข้อประเมิน
15. **`AUDIT_RECORDS`** — ผลตรวจสมบูรณ์ **(ล็อกถาวร)** บันทึกพิกัดเริ่ม/จบ + ลายเซ็นดิจิทัล (`auditor_signature_url`, `auditee_signature_url`, `signed_at`, `auditee_user_id`, `auditee_name_text`, `has_critical_defect`)
16. **`AUDIT_RESPONSES`** — คะแนนและคำตอบรายข้อ + **🚩 `is_na` (ไม่คิดคะแนนเต็มข้อ N/A ใน `max_score`)** + `Notes`
17. **`AUDIT_RESPONSE_IMAGES`** — รูปถ่ายหลักฐานข้อบกพร่องตอนตรวจ (**BEFORE**) พร้อมระบุ `UploadedBy` (เก็บ Relative File Path)

### 🚨 โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat Timeline) [3 ตาราง]
18. **`CAP_TASKS`** — ตั๋วงานแก้ไขข้อบกพร่อง (รองรับทั้งเปิดจากข้อที่ตก และเปิดแบบ Manual นอกฟอร์ม) สถานะ 4 ระดับ: `OPEN` ➔ `SUBMITTED` ➔ `REJECTED` ➔ `CLOSED`
19. **`CAP_TASK_IMAGES`** — รูปภาพหลักฐานหลังปรับปรุงแก้ไขแล้ว (**AFTER**) แสดงผลตามไทม์ไลน์ในห้องแชท
20. **`CAP_TASK_COMMENTS`** — ประวัติข้อความแชทพูดคุยปรึกษางานแก้ไขระหว่าง QC กับ ผจก.สาขา

---

## ⚡ 3. กลยุทธ์การสร้าง Database Indexes (High Performance 10 ชุด)

```sql
CREATE UNIQUE INDEX IX_Users_Username ON USERS(username);
CREATE INDEX IX_UserLocations_User ON USER_LOCATIONS(user_id);
CREATE INDEX IX_AuditRecords_Location_Date ON AUDIT_RECORDS(location_id, audit_date DESC);
CREATE INDEX IX_AuditRecords_AuditDate ON AUDIT_RECORDS(audit_date);
CREATE INDEX IX_ScheduleAuditors_Auditor ON AUDIT_SCHEDULE_AUDITORS(auditor_id);
CREATE INDEX IX_CapTasks_Location_Status ON CAP_TASKS(location_id, status);
CREATE INDEX IX_CapTasks_AssignedTo_Status ON CAP_TASKS(assigned_to, status);
CREATE INDEX IX_AuditResponses_Item_Passed ON AUDIT_RESPONSES(survey_item_id, is_passed);
CREATE INDEX IX_SurveyItems_SectionId ON SURVEY_ITEMS(survey_section_id);
CREATE INDEX IX_AuditResponses_RecordId ON AUDIT_RESPONSES(audit_record_id);
CREATE INDEX IX_CapTaskComments_TaskId ON CAP_TASK_COMMENTS(cap_task_id);
```

---

## 📚 4. รายการเอกสารอ้างอิงทั้งหมดในระบบ (Documentation Files)

| ชื่อไฟล์เอกสาร | ลิงก์ไฟล์ | คำอธิบายเนื้อหา |
| :--- | :--- | :--- |
| **`PROJECT_STATUS.md`** | [`PROJECT_STATUS.md`](file:///c:/Users/itintern/Desktop/qsc-System/PROJECT_STATUS.md) | เอกสารสรุปภาพรวม สถาปัตยกรรม และสถานะระบบล่าสุด v2.6 |
| **`DATA_DICTIONARY.md`** | [`DATA_DICTIONARY.md`](file:///c:/Users/itintern/Desktop/qsc-System/DATA_DICTIONARY.md) | พจนานุกรมข้อมูล 20 ตาราง ระบุ Type, Constraints, Nullability, N/A, และ Indexes |
| **`SYSTEM_FLOWCHARTS.md`**| [`SYSTEM_FLOWCHARTS.md`](file:///c:/Users/itintern/Desktop/qsc-System/SYSTEM_FLOWCHARTS.md) | ผังกระบวนการทำงาน Mermaid แยกตาม 5 เคสการใช้งานจริง |
| **`ER_Diagram.mermaid`** | [`ER_Diagram.mermaid`](file:///c:/Users/itintern/Desktop/qsc-System/ER_Diagram.mermaid) | แผนภาพความสัมพันธ์ฐานข้อมูล 20 ตาราง (Mermaid ER Diagram) |

---
*เอกสารนี้ถูกจัดทำขึ้นเพื่อให้ทีมพัฒนาสามารถอ่านและทำงานต่อได้ทันทีโดยไม่มีสะดุด*

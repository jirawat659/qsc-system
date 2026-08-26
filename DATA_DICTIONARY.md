# 📖 Q.S.C. System — พจนานุกรมข้อมูล (Data Dictionary)
> **เวอร์ชัน:** 2.8 (Enterprise Production Schema — 20 ตารางสมบูรณ์แบบ รองรับ Master Management CRUD & Dynamic RBAC)  
> **อัปเดตล่าสุด:** 26 สิงหาคม 2569  
> **ฐานข้อมูลเป้าหมาย:** SQLite / PostgreSQL / SQL Server

---

## 📑 สารบัญโดเมนข้อมูล (Table of Contents)

1. [โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC)](#-โดเมนที่-1-ผู้ใช้งานและสิทธิ์-users--permissions---rbac)
   - [1.1 `USERS`](#11-ตาราง-users-ข้อมูลผู้ใช้งานระบบ)
   - [1.2 `USER_LOCATIONS`](#12-ตาราง-user_locations-การกำหนดสิทธิ์ดูแลหลายสาขา)
   - [1.3 `ROLES`](#13-ตาราง-roles-บทบาทการทำงาน)
   - [1.4 `PERMISSIONS`](#14-ตาราง-permissions-รายการสิทธิ์การใช้งาน)
   - [1.5 `ROLE_PERMISSIONS`](#15-ตาราง-role_permissions-การจับคู่สิทธิ์ให้บทบาท)
2. [โดเมนที่ 2: สถานที่และประเภท (Locations)](#-โดเมนที่-2-สถานที่และประเภท-locations)
   - [2.1 `LOCATION_TYPES`](#21-ตาราง-location_types-ประเภทสถานที่)
   - [2.2 `LOCATIONS`](#22-ตาราง-locations-สถานที่และสาขา)
3. [โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms)](#-โดเมนที่-3-แบบฟอร์มการตรวจ-survey-forms)
   - [3.1 `SURVEY_FORMS`](#31-ตาราง-survey_forms-แบบฟอร์มการตรวจ-immutable-versioning)
   - [3.2 `SURVEY_FORM_TARGET_LOCATIONS`](#32-ตาราง-survey_form_target_locations-การกำหนดสาขาเป้าหมายของฟอร์ม)
   - [3.3 `SURVEY_SECTIONS`](#33-ตาราง-survey_sections-หมวดคำถาม)
   - [3.4 `SURVEY_ITEMS`](#34-ตาราง-survey_items-ข้อคำถามประเมิน)
4. [โดเมนที่ 4: แผนการตรวจ (Audit Schedules)](#-โดเมนที่-4-แผนการตรวจ-audit-schedules)
   - [4.1 `AUDIT_SCHEDULES`](#41-ตาราง-audit_schedules-ตารางนัดหมายการตรวจ)
   - [4.2 `AUDIT_SCHEDULE_AUDITORS`](#42-ตาราง-audit_schedule_auditors-ผู้ตรวจที่ได้รับมอบหมาย)
5. [โดเมนที่ 5: การตรวจสดและประวัติผลตรวจ (Live Audit & Records)](#-โดเมนที่-5-การตรวจสดและประวัติผลตรวจ-live-audit--records)
   - [5.1 `AUDIT_DRAFTS`](#51-ตาราง-audit_drafts-แบบร่างงานตรวจ-auto-sync)
   - [5.2 `AUDIT_RECORDS`](#52-ตาราง-audit_records-ผลการตรวจสมบูรณ์และลายเซ็น)
   - [5.3 `AUDIT_RESPONSES`](#53-ตาราง-audit_responses-คำตอบรายข้อและระบบ-na)
   - [5.4 `AUDIT_RESPONSE_IMAGES`](#54-ตาราง-audit_response_images-รูปถ่ายหลักฐานการตรวจ)
6. [โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat)](#-โดเมนที่-6-งานแก้ไขข้อบกพร่องและแชท-cap-remediation--chat)
   - [6.1 `CAP_TASKS`](#61-ตาราง-cap_tasks-ตั๋วงานแก้ไขข้อบกพร่อง)
   - [6.2 `CAP_TASK_IMAGES`](#62-ตาราง-cap_task_images-รูปภาพหลักฐานงานแก้ไข)
   - [6.3 `CAP_TASK_COMMENTS`](#63-ตาราง-cap_task_comments-ข้อความแชทพูดคุยในงานแก้ไข)
7. [⚡ กลยุทธ์การสร้าง Index (Database Indexing Strategy)](#-7-กลยุทธ์การสร้าง-index-database-indexing-strategy)

---

## 👥 โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC)

### 1.1 ตาราง `USERS` (ข้อมูลผู้ใช้งานระบบ)
* **หน้าที่:** เก็บข้อมูลบัญชีผู้ใช้งานทุกคนในระบบ สร้างและรีเซ็ตรหัสผ่านได้โดย Admin

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสผู้ใช้งาน |
| `username` | `VARCHAR(100)` | `UNIQUE INDEX` | ❌ No | ชื่อบัญชีล็อกอิน เช่น `admin`, `somchai`, `auditee_siam` |
| `password_hash` | `VARCHAR(255)` | - | ❌ No | รหัสผ่าน (Admin สามารถรีเซ็ตได้) |
| `full_name` | `VARCHAR(150)` | - | ❌ No | ชื่อ-นามสกุลจริง เช่น `นายสมชาย ใจดี` |
| `role_id` | `INTEGER` | `FOREIGN KEY` -> `ROLES(id)` | ❌ No | รหัสบทบาทหลักของผู้ใช้ |
| `branch_scope` | `VARCHAR(20)` | Default `'ALL'` | ❌ No | ขอบเขตการมองเห็นสาขา: `'ALL'` (ทุกสาขา), `'SPECIFIC'` (เฉพาะสาขาที่ผูกใน `USER_LOCATIONS`) |
| `must_change_password`| `BOOLEAN`| Default `TRUE` | ❌ No | **บังคับเปลี่ยนรหัสผ่านตอนล็อกอินครั้งแรก** |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะบัญชี: `TRUE` (เปิดใช้งาน), `FALSE` (ปิดใช้งาน/พนักงานลาออก) |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่สร้างบัญชี |

---

### 1.2 ตาราง `USER_LOCATIONS` (การกำหนดสิทธิ์ดูแลหลายสาขา)
* **หน้าที่:** ตารางเชื่อม Many-to-Many เมื่อ `branch_scope = 'SPECIFIC'` รองรับทั้ง ผจก.สาขาเดี่ยว และ Area Manager ดูแล 3-5 สาขา

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการ |
| `user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` (`INDEX`) | ❌ No | รหัสผู้ใช้งาน |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | รหัสสาขาที่ได้รับอนุญาตให้เข้าถึง |

---

### 1.3 ตาราง `ROLES` (บทบาทการทำงาน)
* **หน้าที่:** เก็บบทบาทหลักทั้ง 5 และบทบาทใหม่ที่ Admin สร้างขึ้น

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสบทบาท |
| `code` | `VARCHAR(50)` | `UNIQUE` | ❌ No | รหัสอ้างอิง: `ADMIN`, `AUDITOR`, `AUDITEE`, `STANDARD`, `EXEC` |
| `name` | `VARCHAR(100)` | - | ❌ No | ชื่อบทบาทภาษาไทย เช่น `ผู้ตรวจประเมินหน้างาน`, `ผู้ดูแลมาตรฐาน (QA)` |
| `description` | `TEXT` | - | ✅ Yes | คำอธิบายหน้าที่และความรับผิดชอบของบทบาท |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่สร้างบทบาท |

---

### 1.4 ตาราง `PERMISSIONS` (รายการสิทธิ์การใช้งาน)
* **หน้าที่:** เก็บสิทธิ์ย่อยระดับเมนูและการกระทำ (ระบบสร้างไว้ล่วงหน้า)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสสิทธิ์ |
| `code` | `VARCHAR(100)` | `UNIQUE` | ❌ No | รหัสสิทธิ์: `menu.dashboard`, `menu.audit`, `forms.manage`, `cap.approve` |
| `name` | `VARCHAR(150)` | - | ❌ No | ชื่อสิทธิ์ภาษาไทย เช่น `เข้าเมนูตรวจหน้างานสด`, `อนุมัติปิดงานแก้ไข CAP` |
| `module` | `VARCHAR(50)` | - | ❌ No | หมวดหมู่สิทธิ์สำหรับจัดกลุ่มบน UI: `Dashboard`, `Audit`, `Schedule`, `Form`, `CAP`, `System` |
| `description` | `TEXT` | - | ✅ Yes | รายละเอียดของสิทธิ์การใช้งาน |

---

### 1.5 ตาราง `ROLE_PERMISSIONS` (การจับคู่สิทธิ์ให้บทบาท)
* **หน้าที่:** ตารางเชื่อม Many-to-Many จับคู่ว่า Role ใด มีสิทธิ์ Permissions ใดบ้าง

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการผูกสิทธิ์ |
| `role_id` | `INTEGER` | `FOREIGN KEY` -> `ROLES(id)` | ❌ No | รหัสบทบาท |
| `permission_id` | `INTEGER` | `FOREIGN KEY` -> `PERMISSIONS(id)` | ❌ No | รหัสสิทธิ์ที่อนุญาต |

---

## 🏪 โดเมนที่ 2: สถานที่และประเภท (Locations)

### 2.1 ตาราง `LOCATION_TYPES` (ประเภทสถานที่)
* **หน้าที่:** เก็บประเภทของสถานที่ เพื่อให้ Admin เพิ่ม/แก้ไขประเภทใหม่ได้เองผ่านหน้าเว็บ

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสประเภทสถานที่ |
| `code` | `VARCHAR(50)` | `UNIQUE` | ❌ No | รหัสประเภท: `STORE`, `PLANT`, `OFFICE`, `CLOUD_KITCHEN` |
| `name` | `VARCHAR(100)` | - | ❌ No | ชื่อประเภท: `สาขาหน้าร้าน`, `โรงงานผลิตและคลังสินค้า`, `สำนักงานใหญ่` |
| `description` | `TEXT` | - | ✅ Yes | คำอธิบายประเภทสถานที่ |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะการเปิดใช้งาน |

---

### 2.2 ตาราง `LOCATIONS` (สถานที่และสาขา)
* **หน้าที่:** เก็บข้อมูลกายภาพ พิกัด GPS พร้อมแคชคะแนนและวันที่ตรวจล่าสุดเพื่อ Dashboard ที่รวดเร็ว

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสสถานที่ |
| `code` | `VARCHAR(50)` | `UNIQUE` | ❌ No | รหัสสาขา เช่น `BKK-001`, `PLANT-01`, `HQ-01` |
| `name` | `VARCHAR(150)` | - | ❌ No | ชื่อสาขา เช่น `สาขาสยามพารากอน`, `โรงงานผลิตบางนา` |
| `location_type_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATION_TYPES(id)` | ❌ No | ประเภทสถานที่ |
| `manager_user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้จัดการสาขาหลัก (เชื่อมกับตาราง Users) |
| `latitude` | `DOUBLE` | - | ❌ No | พิกัดละติจูดของสาขา (GPS Latitude) เช่น `13.7466` |
| `longitude` | `DOUBLE` | - | ❌ No | พิกัดลองติจูดของสาขา (GPS Longitude) เช่น `100.5347` |
| `region` | `VARCHAR(100)` | - | ❌ No | ภูมิภาค เช่น `กรุงเทพฯ และปริมณฑล`, `ภาคตะวันออก` |
| `brand_name` | `VARCHAR(100)` | - | ❌ No | ชื่อแบรนด์ เช่น `QSC Restaurant`, `Cafe Plus` (ไม่มี Hardcode Default) |
| `address` | `TEXT` | - | ❌ No | ที่อยู่สถานที่ตั้ง |
| `phone` | `VARCHAR(50)` | - | ❌ No | เบอร์โทรศัพท์ติดต่อประจำสาขา |
| `last_score` | `DOUBLE` | Default `0.0` | ❌ No | **⚡ Cache คะแนนผลตรวจล่าสุด** (อัปเดตอัตโนมัติเมื่อส่งผลตรวจ) |
| `last_audit_date` | `DATETIME` | - | ✅ Yes | **⚡ Cache วันที่ตรวจล่าสุด** (อัปเดตอัตโนมัติเมื่อส่งผลตรวจ) |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดดำเนินงาน |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่เพิ่มข้อมูลสาขา |

---

## 📝 โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms)

### 3.1 ตาราง `SURVEY_FORMS` (แบบฟอร์มการตรวจ — Immutable Versioning)
* **หน้าที่:** เก็บแม่แบบฟอร์มตรวจ มี `form_group_id` และ `is_latest` เพื่อล็อกผลตรวจในอดีตไม่ให้กระทบเมื่อมีการแก้ไขข้อคำถาม
* **💡 กฎการแก้ไขฟอร์ม (Smart Update Logic):**
  * **กรณีฟอร์มยังไม่เคยถูกใช้ตรวจ (`AuditRecords.Count == 0`):** อนุญาตให้ **เขียนทับของเดิมได้เลย (In-place UPDATE)** เพื่อความสะดวกและไม่สร้างเวอร์ชันขยะในฐานข้อมูล
  * **กรณีฟอร์มเคยถูกใช้ตรวจจริงแล้ว (`AuditRecords.Count > 0`):** ระบบจะบังคับ **สร้างเวอร์ชันใหม่ (Lineage Version Clone)** โดยปรับฟอร์มเดิมเป็น `is_latest = FALSE` และ `INSERT` ฟอร์มใหม่ (เช่น v1.1) ภายใต้ `form_group_id` เดียวกัน เพื่อล็อกผลตรวจในอดีตให้คงเดิม 100%

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสแบบฟอร์ม |
| `form_group_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ✅ Yes | **กลุ่มฟอร์มสายเลือดเดียวกัน (Self-ref)** |
| `title` | `VARCHAR(200)` | - | ❌ No | ชื่อแบบฟอร์ม เช่น `แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Checklist)` |
| `location_type_id`| `INTEGER` | `FOREIGN KEY` -> `LOCATION_TYPES(id)` | ✅ Yes | ผูกฟอร์มกับประเภทสถานที่ (ถ้ามี) |
| `passing_score` | `DOUBLE` | Default `85.0` | ❌ No | เกณฑ์คะแนนผ่านการประเมิน (ค่าเริ่มต้น 85.0%) |
| `targeting_mode` | `VARCHAR(30)` | Default `'ALL_LOCATIONS'` | ❌ No | โหมดเป้าหมาย: `'ALL_LOCATIONS'` (ใช้ทุกสาขา), `'SPECIFIC_LOCATIONS'` (เฉพาะสาขา) |
| `version` | `VARCHAR(20)` | Default `'v1.0'` | ❌ No | เวอร์ชันของแบบฟอร์ม เช่น `v1.0`, `v2.1` |
| `is_latest` | `BOOLEAN` | Default `TRUE` | ❌ No | **ระบุว่าเป็นเวอร์ชันล่าสุดที่เปิดให้ใช้งานหรือไม่** |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดใช้งานฟอร์ม |
| `created_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้สร้างแบบฟอร์ม |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่สร้างฟอร์ม |

---

### 3.2 ตาราง `SURVEY_FORM_TARGET_LOCATIONS` (การกำหนดสาขาเป้าหมายของฟอร์ม)
* **หน้าที่:** ใช้เมื่อแบบฟอร์มตั้งค่า `targeting_mode = 'SPECIFIC_LOCATIONS'` (1 แถวต่อ 1 สาขาที่เลือก)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการผูกสาขา |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | รหัสแบบฟอร์ม |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | รหัสสาขาที่ต้องใช้ฟอร์มนี้ |

---

### 3.3 ตาราง `SURVEY_SECTIONS` (หมวดคำถาม)
* **หน้าที่:** เก็บหมวดหมู่คำถามหลักในแบบฟอร์ม (แยกตารางจริง พร้อม Soft Delete)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสหมวด |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | รหัสแบบฟอร์มแม่ |
| `title` | `VARCHAR(200)` | - | ❌ No | ชื่อหมวด เช่น `1. การควบคุมอุณหภูมิตู้แช่และวัตถุดิบ` |
| `order_index` | `INTEGER` | Default `0` | ❌ No | ลำดับการแสดงผลหมวด |
| `weight_percent` | `DOUBLE` | Default `0.0` | ❌ No | ค่าน้ำหนักหมวด (สำหรับคำนวณคะแนนถ่วงน้ำหนัก) |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | **Soft Delete: สถานะเปิดใช้งานหมวด** |

---

### 3.4 ตาราง `SURVEY_ITEMS` (ข้อคำถามประเมิน)
* **หน้าที่:** เก็บข้อคำถามรายข้อ เกณฑ์คะแนนเต็ม การตั้งค่าข้อวิกฤต (Critical Defect) และ Soft Delete

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสข้อคำถาม |
| `survey_section_id`| `INTEGER` | `FOREIGN KEY` -> `SURVEY_SECTIONS(id)` (`INDEX`) | ❌ No | รหัสหมวดคำถามแม่ |
| `question_text` | `TEXT` | - | ❌ No | ข้อความคำถาม เช่น `อุณหภูมิตู้แช่แข็งต่ำกว่า -18°C และตู้แช่เย็น 0-4°C` |
| `question_type` | `VARCHAR(20)` | Default `'YESNO'` | ❌ No | ประเภทคำถาม: `'YESNO'` (ผ่าน/ไม่ผ่าน), `'SCALE'` (1-5 ดาว), `'TEXT'` (ข้อความ) |
| `full_score` | `DOUBLE` | Default `10.0` | ❌ No | คะแนนเต็มประจำข้อ |
| `is_critical` | `BOOLEAN` | Default `FALSE` | ❌ No | **ข้อวิกฤต Critical Defect (ถ้าไม่ผ่าน = ปรับตกทั้งฉบับ + ออก CAP ทันที)** |
| `order_index` | `INTEGER` | Default `0` | ❌ No | ลำดับการแสดงผลข้อคำถาม |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | **Soft Delete: สถานะเปิดใช้งานข้อคำถาม** |

---

## 📅 โดเมนที่ 4: แผนการตรวจ (Audit Schedules)

### 4.1 ตาราง `AUDIT_SCHEDULES` (ตารางนัดหมายการตรวจ)
* **หน้าที่:** เก็บนัดหมายการลงตรวจสาขา วันที่ เวลา และประเภทการตรวจ

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสนัดหมาย |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาเป้าหมายที่ต้องเข้าตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่ต้องใช้ในการตรวจ |
| `scheduled_date` | `DATETIME` | - | ❌ No | วันเวลาตามแผนงานที่นัดหมาย |
| `audit_type` | `VARCHAR(30)` | Default `'announced'` | ❌ No | ประเภทการตรวจ: `'announced'` (ตามแผน), `'spot'` (สุ่มตรวจ), `'undercover'` (ลึกลับ) |
| `status` | `VARCHAR(20)` | Default `'pending'` | ❌ No | สถานะ: `'pending'` (รอนัดตรวจ), `'in_progress'` (กำลังตรวจ), `'completed'` (ตรวจเสร็จแล้ว) |
| `notes` | `TEXT` | - | ✅ Yes | หมายเหตุหรือข้อความเน้นย้ำถึงผู้ตรวจ |
| `created_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้สร้างนัดหมาย (ห้ามเว้นว่าง NOT NULL) |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่สร้างนัดหมาย |

---

### 4.2 ตาราง `AUDIT_SCHEDULE_AUDITORS` (ผู้ตรวจที่ได้รับมอบหมาย)
* **หน้าที่:** เชื่อมโยงผู้ตรวจ (รองรับ 1 หรือมากกว่า 1 คนต่อนัดหมาย)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการมอบหมาย |
| `audit_schedule_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_SCHEDULES(id)` | ❌ No | รหัสนัดหมาย |
| `auditor_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` (`INDEX`) | ❌ No | **รหัสผู้ตรวจที่ได้รับมอบหมาย (Index: ดึงงานตรวจของฉัน)** |
| `is_lead` | `BOOLEAN` | Default `TRUE` | ❌ No | เป็นหัวหน้าทีมผู้ตรวจหลักหรือไม่ |

---

## ⚡ โดเมนที่ 5: การตรวจสดและประวัติผลตรวจ (Live Audit & Records)

### 5.1 ตาราง `AUDIT_DRAFTS` (แบบร่างงานตรวจ Auto-Sync)
* **หน้าที่:** พักข้อมูลคำตอบและรูปภาพระหว่างตรวจสด พร้อมบันทึกพิกัด GPS ผู้ตรวจ **ตอนกดปุ่มเริ่มตรวจข้อประเมิน (รอบใหม่)**

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสแบบร่าง |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาที่กำลังตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่กำลังใช้ |
| `auditor_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ตรวจที่กำลังบันทึก |
| `draft_payload_json`| `TEXT` | - | ❌ No | ข้อมูลคำตอบ, รูปภาพย่อ, คอมเมนต์ ในรูปแบบ JSON |
| `current_section_idx`| `INTEGER`| Default `0` | ❌ No | ดัชนีหมวดที่ทำค้างอยู่ |
| `total_answered` | `INTEGER` | Default `0` | ❌ No | จำนวนข้อที่ตอบไปแล้ว |
| `total_questions` | `INTEGER` | Default `0` | ❌ No | จำนวนข้อทั้งหมดในฟอร์ม |
| `start_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดผู้ตรวจตอนกดเริ่มตรวจข้อประเมิน (รอบใหม่) |
| `start_longitude`| `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดผู้ตรวจตอนกดเริ่มตรวจข้อประเมิน (รอบใหม่) |
| `started_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่กดปุ่มเริ่มตรวจข้อประเมิน |
| `updated_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่ Auto-synced ล่าสุด |

---

### 5.2 ตาราง `AUDIT_RECORDS` (ผลการตรวจสมบูรณ์และลายเซ็น)
* **หน้าที่:** เก็บผลตรวจสมบูรณ์ที่กดยืนยันส่งแล้ว **ล็อกถาวร ห้ามแก้ไข/ลบ** บันทึกลายเซ็นดิจิทัล พิกัดเริ่ม/จบ และการตัดสิน Critical Breach (เก็บเฉพาะ Relative Path รูปภาพ/ลายเซ็น ไม่เก็บ Base64 ใน DB)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสประวัติการตรวจ |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` (`INDEX`) | ❌ No | สาขาที่ถูกตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่ใช้ตรวจ |
| `primary_auditor_id`| `INTEGER`| `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ตรวจหลักที่ส่งผล |
| `auditee_user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | **ผู้รับตรวจที่ลงนาม (ถ้ามีบัญชีในระบบ)** |
| `auditee_name_text` | `VARCHAR(150)`| - | ✅ Yes | **ชื่อผู้รับตรวจที่ลงนาม (Fallback ถ้าไม่มีบัญชี)** |
| `audit_schedule_id`| `INTEGER`| `FOREIGN KEY` -> `AUDIT_SCHEDULES(id)` | ✅ Yes | รหัสนัดหมายตามแผนงาน (ถ้ามี) |
| `audit_date` | `DATETIME` | `INDEX` | ❌ No | วันเวลาที่ทำการตรวจหน้างาน |
| `total_score` | `DOUBLE` | - | ❌ No | คะแนนรวมที่ได้ (ไม่รวมข้อ N/A) |
| `max_score` | `DOUBLE` | - | ❌ No | **คะแนนเต็มรวมที่คำนวณจริง (หักคะแนนเต็มของข้อ N/A ออก)** |
| `percentage_score` | `DOUBLE` | - | ❌ No | คะแนนคิดเป็นเปอร์เซ็นต์ เช่น `88.0` |
| `is_passed` | `BOOLEAN` | - | ❌ No | **ผ่านเกณฑ์หรือไม่ (>=85% และต้องไม่มีข้อวิกฤตตก)** |
| `has_critical_defect`| `BOOLEAN`| Default `FALSE` | ❌ No | **มีข้อวิกฤตตกหรือไม่ (ถ้าตกจะบังคับ `is_passed=FALSE` ทันที)** |
| `staff_count` | `INTEGER` | Default `0` | ❌ No | จำนวนพนักงานที่ปฏิบัติงานขณะตรวจ |
| `audit_type` | `VARCHAR(30)` | Default `'announced'` | ❌ No | ประเภทการตรวจ |
| `notes` | `TEXT` | - | ✅ Yes | สรุปภาพรวมและข้อเสนอแนะของผู้ตรวจ |
| `auditor_signature_url`| `TEXT` | - | ✅ Yes | **Relative Path ไฟล์ภาพลายเซ็นผู้ตรวจ เช่น `/uploads/signatures/auditor_1.webp`** |
| `auditee_signature_url`| `TEXT` | - | ✅ Yes | **Relative Path ไฟล์ภาพลายเซ็นผู้รับตรวจ เช่น `/uploads/signatures/auditee_1.webp`** |
| `signed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่ลงนามเสร็จสมบูรณ์ |
| `start_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดตอนเริ่มตรวจ (ดึงมาจาก Draft) |
| `start_longitude`| `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดตอนเริ่มตรวจ (ดึงมาจาก Draft) |
| `end_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดตอนกดยืนยันส่งผลตรวจ (ตรวจจบ) |
| `end_longitude` | `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดตอนกดยืนยันส่งผลตรวจ (ตรวจจบ) |
| `started_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่เริ่มตรวจ (ดึงมาจาก Draft) |
| `submitted_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่กดยืนยันส่งผลตรวจจริง (ล็อกถาวร) |

---

### 5.3 ตาราง `AUDIT_RESPONSES` (คำตอบรายข้อและระบบ N/A)
* **หน้าที่:** เก็บผลการให้คะแนน สถานะผ่าน/ไม่ผ่าน และ **ระบบข้อไม่เกี่ยวข้อง (N/A)**

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสคำตอบ |
| `audit_record_id` | `INTEGER` | `FOREIGN KEY` -> `AUDIT_RECORDS(id)` (`INDEX`) | ❌ No | รหัสผลตรวจหลัก |
| `survey_item_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_ITEMS(id)` (`INDEX`) | ❌ No | รหัสข้อคำถามที่ตอบ |
| `score_given` | `DOUBLE` | - | ❌ No | คะแนนที่ได้ในข้อนี้ |
| `is_passed` | `BOOLEAN` | `INDEX` | ❌ No | ผ่านหรือไม่ผ่าน (สำหรับ Query วิเคราะห์ข้อที่ตกบ่อย) |
| `is_na` | `BOOLEAN` | Default `FALSE` | ❌ No | **🚩 ข้อไม่เกี่ยวข้อง (N/A): ไม่นำคะแนนเต็มข้อนี้ไปนับรวมใน `max_score`** |
| `notes` | `TEXT` | - | ✅ Yes | ข้อคิดเห็น หรือข้อบกพร่องที่พบ (Notes จากปุ่มคอมเมนต์) |

---

### 5.4 ตาราง `AUDIT_RESPONSE_IMAGES` (รูปถ่ายหลักฐานการตรวจ — BEFORE)
* **หน้าที่:** เก็บ Path ไฟล์รูปภาพหลักฐานข้อบกพร่องตอนตรวจ (**BEFORE**) ระบุผู้ตรวจที่เป็นคนถ่ายรูป

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรูปภาพหลักฐาน |
| `audit_response_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_RESPONSES(id)` | ❌ No | รหัสคำตอบข้อคำถามที่แนบรูป |
| `image_url` | `TEXT` | - | ❌ No | **Relative Path ไฟล์รูปภาพ เช่น `/uploads/audit_images/img_1.webp`** |
| `uploaded_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | **👤 ผู้ตรวจที่อัปโหลดรูปภาพหลักฐาน** |
| `uploaded_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่อัปโหลดรูป |

---

## 🚨 โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat)

### 6.1 ตาราง `CAP_TASKS` (ตั๋วงานแก้ไขข้อบกพร่อง)
* **หน้าที่:** เก็บลูปการติดตามงานแก้ไขข้อบกพร่อง (แสดงผลประวัติการสื่อสารเป็น Chat Timeline)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสตั๋วงาน CAP |
| `audit_record_id` | `INTEGER` | `FOREIGN KEY` -> `AUDIT_RECORDS(id)` | ❌ No | รหัสผลตรวจที่ตรวจพบ |
| `audit_response_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_RESPONSES(id)` | ✅ Yes | **รหัสข้อที่ตก (เป็น NULL ได้หากเปิดตั๋ว Manual นอกฟอร์ม)** |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` (`INDEX`) | ❌ No | สาขาที่ต้องดำเนินการแก้ไข |
| `issue_item` | `VARCHAR(255)` | - | ❌ No | หัวข้อข้อบกพร่อง |
| `description` | `TEXT` | - | ❌ No | รายละเอียดข้อบกพร่อง (ดึงจาก Notes ผู้ตรวจ/เกณฑ์) |
| `submission_deadline`| `DATETIME` | - | ❌ No | กำหนดส่งงานแก้ไข (SLA Deadline) |
| `status` | `VARCHAR(30)` | Default `'OPEN'` (`INDEX`) | ❌ No | สถานะตั๋ว: `'OPEN'`, `'SUBMITTED'`, `'REJECTED'`, `'CLOSED'` |
| `assigned_to` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` (`INDEX`) | ✅ Yes | **ผู้รับผิดชอบแก้ไข (Index: ดึงงานค้างของฉัน)** |
| `verified_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้ตรวจสอบและอนุมัติปิดงาน (QA/QC) |
| `completed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่สาขาส่งงานแก้ไข |
| `closed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่ QA อนุมัติและปิดงานแก้ไข |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่เปิดตั๋วงาน CAP |

---

### 6.2 ตาราง `CAP_TASK_IMAGES` (รูปภาพหลักฐานงานแก้ไข — AFTER)
* **หน้าที่:** เก็บเฉพาะรูปภาพหลักฐานหลังปรับปรุงแก้ไขแล้ว (**AFTER**) แสดงผลตามลำดับเวลาในห้องแชท

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรูปภาพ CAP |
| `cap_task_id` | `INTEGER` | `FOREIGN KEY` -> `CAP_TASKS(id)` | ❌ No | รหัสตั๋วงาน CAP แม่ |
| `phase` | `VARCHAR(20)` | Default `'AFTER'` | ❌ No | ระยะของรูปภาพ: `'AFTER'` (หลังปรับปรุงแก้ไขเสร็จ) |
| `image_url` | `TEXT` | - | ❌ No | **Relative Path ไฟล์รูปถ่าย เช่น `/uploads/cap_images/after_1.webp`** |
| `uploaded_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ใช้ที่อัปโหลดรูปภาพ (ผู้จัดการสาขา) |
| `uploaded_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่อัปโหลด |

---

### 6.3 ตาราง `CAP_TASK_COMMENTS` (ข้อความแชทพูดคุยในงานแก้ไข)
* **หน้าที่:** เก็บข้อความประวัติการสื่อสารระหว่าง ผู้จัดการสาขา กับ QA/QC ในแต่ละงานแก้ไข

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสข้อความแชท |
| `cap_task_id` | `INTEGER` | `FOREIGN KEY` -> `CAP_TASKS(id)` (`INDEX`) | ❌ No | รหัสตั๋วงาน CAP แม่ |
| `sender_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | รหัสผู้ส่งข้อความ |
| `sender_role` | `VARCHAR(50)` | - | ❌ No | บทบาทผู้ส่ง: `'AUDITEE'`, `'QA'`, `'ADMIN'` |
| `message` | `TEXT` | - | ❌ No | เนื้อหาข้อความพูดคุย/ชี้แจง |
| `created_at` | `DATETIME` | Default `CURRENT_TIMESTAMP` | ❌ No | วันเวลาที่ส่งข้อความ |

---

## ⚡ 7. กลยุทธ์การสร้าง Index (Database Indexing Strategy)

สร้าง Index ครอบคลุมทุก Query ที่ใช้งานจริงเพื่อประสิทธิภาพสูงสุด:

```sql
-- 1. Index ค้นหาผู้ใช้ตอน Login รวดเร็ว
CREATE UNIQUE INDEX IX_Users_Username ON USERS(username);

-- 2. Index กรองสิทธิ์ขอบเขตสาขาของผู้ใช้
CREATE INDEX IX_UserLocations_User ON USER_LOCATIONS(user_id);

-- 3. Index ดึงประวัติผลตรวจของสาขาเรียงตามวันที่ล่าสุด
CREATE INDEX IX_AuditRecords_Location_Date ON AUDIT_RECORDS(location_id, audit_date DESC);
CREATE INDEX IX_AuditRecords_AuditDate ON AUDIT_RECORDS(audit_date);

-- 4. Index ดึงงานตรวจที่ได้รับมอบหมายของผู้ตรวจ (Auditor Task List)
CREATE INDEX IX_ScheduleAuditors_Auditor ON AUDIT_SCHEDULE_AUDITORS(auditor_id);

-- 5. Index ดึงตั๋วงาน CAP ของสาขา และของตัวผู้รับผิดชอบ
CREATE INDEX IX_CapTasks_Location_Status ON CAP_TASKS(location_id, status);
CREATE INDEX IX_CapTasks_AssignedTo_Status ON CAP_TASKS(assigned_to, status);

-- 6. Index วิเคราะห์สถิติ "ข้อคำถามที่ตกบ่อยที่สุดในองค์กร"
CREATE INDEX IX_AuditResponses_Item_Passed ON AUDIT_RESPONSES(survey_item_id, is_passed);

-- 7. Index ดึงข้อคำถามในหมวด และดึงคำตอบของผลตรวจ (Foreign Key Joins)
CREATE INDEX IX_SurveyItems_SectionId ON SURVEY_ITEMS(survey_section_id);
CREATE INDEX IX_AuditResponses_RecordId ON AUDIT_RESPONSES(audit_record_id);
CREATE INDEX IX_CapTaskComments_TaskId ON CAP_TASK_COMMENTS(cap_task_id);
```

---
*เอกสาร Data Dictionary นี้จัดทำขึ้นเพื่อใช้เป็นข้อกำหนดมาตรฐานในการพัฒนาระบบและฐานข้อมูล Q.S.C. System*

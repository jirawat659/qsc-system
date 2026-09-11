# 📖 Q.S.C. System — พจนานุกรมข้อมูล (Data Dictionary)
> **เวอร์ชัน:** 4.0 (Enterprise Production Schema — 25 ตารางสมบูรณ์แบบ รองรับ Multi-Brand, Audit Trail, Dynamic Navigation JSON & RBAC Matrix)  
> **อัปเดตล่าสุด:** 11 กันยายน 2569  
> **ฐานข้อมูลเป้าหมาย:** SQL Server / SQLite / PostgreSQL

---

## 📑 สารบัญโดเมนข้อมูล (Table of Contents)

1. [โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC & Brand Scope)](#-โดเมนที่-1-ผู้ใช้งานและสิทธิ์-users--permissions---rbac--brand-scope)
   - [1.1 `USERS`](#11-ตาราง-users-ข้อมูลผู้ใช้งานระบบ)
   - [1.2 `USER_LOCATIONS`](#12-ตาราง-user_locations-การกำหนดสิทธิ์ดูแลหลายสาขา)
   - [1.3 `USER_BRANDS`](#13-ตาราง-user_brands-การกำหนดสิทธิ์ดูแลหลายแบรนด์)
   - [1.4 `ROLES`](#14-ตาราง-roles-บทบาทการทำงาน)
   - [1.5 `PERMISSIONS`](#15-ตาราง-permissions-รายการสิทธิ์การใช้งาน)
   - [1.6 `ROLE_PERMISSIONS`](#16-ตาราง-role_permissions-การจับคู่สิทธิ์ให้บทบาท)
2. [โดเมนที่ 2: สถานที่ แบรนด์ และประเภท (Locations & Brands)](#-โดเมนที่-2-สถานที่-แบรนด์-และประเภท-locations--brands)
   - [2.1 `LOCATION_TYPES`](#21-ตาราง-location_types-ประเภทสถานที่)
   - [2.2 `LOCATIONS`](#22-ตาราง-locations-สถานที่และสาขา)
   - [2.3 `BRANDS`](#23-ตาราง-brands-แบรนด์ธุรกิจในเครือ)
   - [2.4 `LOCATION_BRANDS`](#24-ตาราง-location_brands-การผูกสาขากับแบรนด์-multi-brand)
3. [โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms)](#-โดเมนที่-3-แบบฟอร์มการตรวจ-survey-forms)
   - [3.1 `SURVEY_FORMS`](#31-ตาราง-survey_forms-แบบฟอร์มการตรวจ-immutable-versioning)
   - [3.2 `SURVEY_FORM_TARGET_LOCATIONS`](#32-ตาราง-survey_form_target_locations-การกำหนดสาขาเป้าหมายของฟอร์ม)
   - [3.3 `SURVEY_FORM_BRANDS`](#33-ตาราง-survey_form_brands-การกำหนดแบรนด์เป้าหมายของฟอร์ม)
   - [3.4 `SURVEY_SECTIONS`](#34-ตาราง-survey_sections-หมวดคำถาม)
   - [3.5 `SURVEY_ITEMS`](#35-ตาราง-survey_items-ข้อคำถามประเมิน)
4. [โดเมนที่ 4: แผนการตรวจ (Audit Schedules)](#-โดเมนที่-4-แผนการตรวจ-audit-schedules)
   - [4.1 `AUDIT_SCHEDULES`](#41-ตาราง-audit_schedules-ตารางนัดหมายการตรวจ)
   - [4.2 `AUDIT_SCHEDULE_AUDITORS`](#42-ตาราง-audit_schedule_auditors-ผู้ตรวจที่ได้รับมอบหมาย)
5. [โดเมนที่ 5: การตรวจสด ประวัติผลตรวจ และบันทึกแก้ไข (Live Audit, Records & Audit Trail)](#-โดเมนที่-5-การตรวจสด-ประวัติผลตรวจ-และบันทึกแก้ไข-live-audit-records--audit-trail)
   - [5.1 `AUDIT_DRAFTS`](#51-ตาราง-audit_drafts-แบบร่างงานตรวจ-auto-sync)
   - [5.2 `AUDIT_RECORDS`](#52-ตาราง-audit_records-ผลการตรวจสมบูรณ์และลายเซ็น)
   - [5.3 `AUDIT_RESPONSES`](#53-ตาราง-audit_responses-คำตอบรายข้อและระบบ-na)
   - [5.4 `AUDIT_RESPONSE_IMAGES`](#54-ตาราง-audit_response_images-รูปถ่ายหลักฐานการตรวจ)
   - [5.5 `AUDIT_RECORD_EDIT_LOGS`](#55-ตาราง-audit_record_edit_logs-ประวัติการแก้ไขบันทึกผลตรวจ)
6. [โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat)](#-โดเมนที่-6-งานแก้ไขข้อบกพร่องและแชท-cap-remediation--chat)
   - [6.1 `CAP_TASKS`](#61-ตาราง-cap_tasks-ตั๋วงานแก้ไขข้อบกพร่อง)
   - [6.2 `CAP_TASK_IMAGES`](#62-ตาราง-cap_task_images-รูปภาพหลักฐานงานแก้ไข)
   - [6.3 `CAP_TASK_COMMENTS`](#63-ตาราง-cap_task_comments-ข้อความแชทพูดคุยในงานแก้ไข)
7. [🛡️ คอลัมน์มาตรฐานระบบ (Standard Audit Shadow Properties)](#%EF%B8%8F-7-คอลัมน์มาตรฐานระบบ-standard-audit-shadow-properties)
8. [⚡ กลยุทธ์การสร้าง Index (Database Indexing Strategy)](#-8-กลยุทธ์การสร้าง-index-database-indexing-strategy)

---

## 👥 โดเมนที่ 1: ผู้ใช้งานและสิทธิ์ (Users & Permissions - RBAC & Brand Scope)

### 1.1 ตาราง `USERS` (ข้อมูลผู้ใช้งานระบบ)
* **หน้าที่:** เก็บข้อมูลบัญชีผู้ใช้งานทุกคนในระบบ กำหนดระดับสิทธิ์ (Role), ขอบเขตสาขา (`branch_scope`), และขอบเขตแบรนด์ (`brand_scope`)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสผู้ใช้งาน |
| `username` | `VARCHAR(100)` | `UNIQUE INDEX` | ❌ No | ชื่อบัญชีล็อกอิน เช่น `admin`, `somchai`, `auditee_siam` |
| `password_hash` | `VARCHAR(200)` | - | ❌ No | รหัสผ่านแฮช (PBKDF2/BCrypt) |
| `full_name` | `VARCHAR(200)` | - | ❌ No | ชื่อ-นามสกุลจริง เช่น `นายสมชาย ใจดี` |
| `role_id` | `INTEGER` | `FOREIGN KEY` -> `ROLES(id)` | ❌ No | รหัสบทบาทหลักของผู้ใช้ |
| `branch_scope` | `VARCHAR(20)` | Default `'ALL'` | ❌ No | ขอบเขตสาขา: `'ALL'` (ทุกสาขา), `'SPECIFIC'` (เฉพาะสาขาใน `USER_LOCATIONS`) |
| `brand_scope` | `VARCHAR(20)` | Default `'ALL'` | ❌ No | ขอบเขตแบรนด์: `'ALL'` (ทุกแบรนด์), `'SPECIFIC'` (เฉพาะแบรนด์ใน `USER_BRANDS`) |
| `must_change_password`| `BOOLEAN`| Default `TRUE` | ❌ No | บังคับเปลี่ยนรหัสผ่านตอนล็อกอินครั้งแรก |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะบัญชี: `TRUE` (เปิดใช้งาน), `FALSE` (ปิดใช้งาน) |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่สร้างบัญชี |

---

### 1.2 ตาราง `USER_LOCATIONS` (การกำหนดสิทธิ์ดูแลหลายสาขา)
* **หน้าที่:** ตารางเชื่อม Many-to-Many เมื่อ `branch_scope = 'SPECIFIC'` รองรับ ผจก.สาขาเดี่ยว และ Area Manager ดูแลหลายสาขา

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการ |
| `user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | รหัสผู้ใช้งาน |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | รหัสสาขาที่ได้รับอนุญาตให้เข้าถึง |

*Composite Unique Index:* `(user_id, location_id)`

---

### 1.3 ตาราง `USER_BRANDS` (การกำหนดสิทธิ์ดูแลหลายแบรนด์)
* **หน้าที่:** ตารางเชื่อม Many-to-Many เมื่อ `brand_scope = 'SPECIFIC'` กำหนดว่าผู้ใช้งานเข้าถึงข้อมูลของแบรนด์ใดได้บ้าง (เช่น ผู้จัดการแบรนด์ หรือ QA ประจำแบรนด์)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการ |
| `user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | รหัสผู้ใช้งาน |
| `brand_id` | `INTEGER` | `FOREIGN KEY` -> `BRANDS(id)` | ❌ No | รหัสแบรนด์ที่ได้รับอนุญาตให้เข้าถึง |

*Composite Unique Index:* `(user_id, brand_id)`

---

### 1.4 ตาราง `ROLES` (บทบาทการทำงาน)
* **หน้าที่:** เก็บบทบาทหลักในระบบ เช่น `ADMIN`, `AUDITOR`, `AUDITEE`, `STANDARD`, `EXEC` พร้อมการตั้งค่าแถบเมนูล่าง (Bottom Nav)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสบทบาท |
| `code` | `VARCHAR(50)` | `UNIQUE INDEX` | ❌ No | รหัสอ้างอิง: `ADMIN`, `AUDITOR`, `AUDITEE`, `STANDARD`, `EXEC` |
| `name` | `VARCHAR(200)` | - | ❌ No | ชื่อบทบาทภาษาไทย เช่น `ผู้ตรวจประเมินหน้างาน`, `ผู้ดูแลมาตรฐาน (QA)` |
| `description` | `TEXT` | - | ✅ Yes | คำอธิบายหน้าที่และความรับผิดชอบของบทบาท |
| `nav_config_json` | `TEXT` | - | ✅ Yes | โครงสร้าง JSON ของแถบเมนู 3 ตำแหน่ง เช่น `{"left":"dashboard","center":"audit","right":"more"}` |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่สร้างบทบาท |

---

### 1.5 ตาราง `PERMISSIONS` (รายการสิทธิ์การใช้งาน)
* **หน้าที่:** เก็บสิทธิ์ย่อยระดับเมนูและการกระทำ (System Pre-seeded)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสสิทธิ์ |
| `code` | `VARCHAR(100)` | `UNIQUE INDEX` | ❌ No | รหัสสิทธิ์: `menu.dashboard`, `menu.audit`, `forms.manage`, `cap.approve` |
| `name` | `VARCHAR(200)` | - | ❌ No | ชื่อสิทธิ์ภาษาไทย เช่น `เข้าเมนูตรวจหน้างานสด`, `อนุมัติปิดงานแก้ไข CAP` |
| `module` | `VARCHAR(50)` | - | ❌ No | หมวดหมู่สิทธิ์: `Dashboard`, `Audit`, `Schedule`, `Form`, `CAP`, `System` |
| `description` | `TEXT` | - | ✅ Yes | รายละเอียดของสิทธิ์การใช้งาน |

---

### 1.6 ตาราง `ROLE_PERMISSIONS` (การจับคู่สิทธิ์ให้บทบาท)
* **หน้าที่:** ตารางเชื่อม Many-to-Many จับคู่ว่า Role ใด มีสิทธิ์ Permissions ใดบ้าง

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการผูกสิทธิ์ |
| `role_id` | `INTEGER` | `FOREIGN KEY` -> `ROLES(id)` | ❌ No | รหัสบทบาท |
| `permission_id` | `INTEGER` | `FOREIGN KEY` -> `PERMISSIONS(id)` | ❌ No | รหัสสิทธิ์ที่อนุญาต |

*Index:* `(role_id, permission_id)`

---

## 🏪 โดเมนที่ 2: สถานที่ แบรนด์ และประเภท (Locations & Brands)

### 2.1 ตาราง `LOCATION_TYPES` (ประเภทสถานที่)
* **หน้าที่:** เก็บประเภทของสถานที่ เช่น หน้าร้าน, โรงงาน, สำนักงานใหญ่

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสประเภทสถานที่ |
| `code` | `VARCHAR(50)` | `UNIQUE INDEX` | ❌ No | รหัสประเภท: `STORE`, `PLANT`, `OFFICE`, `CLOUD_KITCHEN` |
| `name` | `VARCHAR(200)` | - | ❌ No | ชื่อประเภท: `สาขาหน้าร้าน`, `โรงงานผลิตและคลังสินค้า`, `สำนักงานใหญ่` |
| `description` | `TEXT` | - | ✅ Yes | คำอธิบายประเภทสถานที่ |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะการเปิดใช้งาน |

---

### 2.2 ตาราง `LOCATIONS` (สถานที่และสาขา)
* **หน้าที่:** เก็บข้อมูลกายภาพ พิกัด GPS ภูมิภาค แคชคะแนนและวันที่ตรวจล่าสุดเพื่อ Dashboard ที่รวดเร็ว (การผูกแบรนด์เปลี่ยนไปใช้ตาราง `LOCATION_BRANDS`)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสสถานที่ |
| `code` | `VARCHAR(50)` | `INDEX` | ❌ No | รหัสสาขา เช่น `BKK-001`, `PLANT-01`, `HQ-01` |
| `name` | `VARCHAR(200)` | - | ❌ No | ชื่อสาขา เช่น `สาขาสยามพารากอน`, `โรงงานผลิตบางนา` |
| `location_type_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATION_TYPES(id)` | ❌ No | ประเภทสถานที่ |
| `manager_user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้จัดการสาขาหลัก |
| `latitude` | `DOUBLE` | - | ❌ No | พิกัดละติจูด (GPS Latitude) เช่น `13.7466` |
| `longitude` | `DOUBLE` | - | ❌ No | พิกัดลองติจูด (GPS Longitude) เช่น `100.5347` |
| `region` | `VARCHAR(100)` | - | ❌ No | ภูมิภาค เช่น `กรุงเทพฯ และปริมณฑล`, `ภาคตะวันออก` |
| `address` | `TEXT` | - | ❌ No | ที่อยู่สถานที่ตั้ง |
| `phone` | `VARCHAR(50)` | - | ❌ No | เบอร์โทรศัพท์ติดต่อประจำสาขา |
| `last_score` | `DOUBLE` | Default `0.0` | ❌ No | **⚡ Cache คะแนนผลตรวจล่าสุด** (อัปเดตอัตโนมัติเมื่อส่งผลตรวจ) |
| `last_audit_date` | `DATETIME` | - | ✅ Yes | **⚡ Cache วันที่ตรวจล่าสุด** (อัปเดตอัตโนมัติเมื่อส่งผลตรวจ) |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดดำเนินงาน |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่เพิ่มข้อมูลสาขา |

*Indexes:* `(is_active, code)`, `(is_active, last_score)`

---

### 2.3 ตาราง `BRANDS` (แบรนด์ธุรกิจในเครือ)
* **หน้าที่:** เก็บข้อมูลแบรนด์ในเครือองค์กร รองรับระบบ Multi-Brand เช่น After You, Mikazuki

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสแบรนด์ |
| `code` | `VARCHAR(50)` | `UNIQUE INDEX` | ❌ No | รหัสแบรนด์ เช่น `AY`, `MKZ` |
| `name` | `VARCHAR(200)` | `UNIQUE INDEX` | ❌ No | ชื่อแบรนด์ เช่น `After You`, `Mikazuki` |
| `description` | `TEXT` | - | ✅ Yes | รายละเอียดแบรนด์ |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดใช้งาน |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่สร้างข้อมูลแบรนด์ |

---

### 2.4 ตาราง `LOCATION_BRANDS` (การผูกสาขากับแบรนด์ Multi-Brand)
* **หน้าที่:** ตารางเชื่อม Many-to-Many ระหว่าง สาขา กับ แบรนด์ (1 สาขาสามารถรองรับได้มากกว่า 1 แบรนด์ เช่น สาขาที่เป็น Dual-Brand Store)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการ |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | รหัสสาขา |
| `brand_id` | `INTEGER` | `FOREIGN KEY` -> `BRANDS(id)` | ❌ No | รหัสแบรนด์ |

*Composite Unique Index:* `(location_id, brand_id)`  
*Index:* `brand_id`

---

## 📝 โดเมนที่ 3: แบบฟอร์มการตรวจ (Survey Forms)

### 3.1 ตาราง `SURVEY_FORMS` (แบบฟอร์มการตรวจ — Immutable Versioning)
* **หน้าที่:** เก็บแม่แบบฟอร์มตรวจ มี `form_group_id` และ `is_latest` เพื่อล็อกผลตรวจในอดีตไม่ให้กระทบเมื่อมีการแก้ไขข้อคำถาม
* **💡 กฎการแก้ไขฟอร์ม (Smart Update Logic):**
  * **กรณีฟอร์มยังไม่เคยถูกใช้ตรวจ (`AuditRecords.Count == 0`):** In-place UPDATE ทับของเดิมได้
  * **กรณีฟอร์มเคยถูกใช้ตรวจแล้ว (`AuditRecords.Count > 0`):** ระบบจะสร้างเวอร์ชันใหม่ (Lineage Version Clone) ปรับฟอร์มเดิมเป็น `is_latest = FALSE` และ `INSERT` เวอร์ชันใหม่ภายใต้ `form_group_id` เดียวกัน

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสแบบฟอร์ม |
| `form_group_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ✅ Yes | กลุ่มฟอร์มสายเลือดเดียวกัน (Self-ref) |
| `title` | `VARCHAR(300)` | - | ❌ No | ชื่อแบบฟอร์ม เช่น `แบบฟอร์มมาตรฐาน QSC Core Checklist` |
| `location_type_id`| `INTEGER` | `FOREIGN KEY` -> `LOCATION_TYPES(id)` | ✅ Yes | ผูกฟอร์มกับประเภทสถานที่ |
| `brand_id` | `INTEGER` | `FOREIGN KEY` -> `BRANDS(id)` | ✅ Yes | ผูกกับแบรนด์หลัก (ถ้ามี) |
| `passing_score` | `DOUBLE` | Default `85.0` | ❌ No | เกณฑ์คะแนนผ่านการประเมิน (ค่าเริ่มต้น 85.0%) |
| `targeting_mode` | `VARCHAR(30)` | Default `'ALL_LOCATIONS'` | ❌ No | โหมดเป้าหมาย: `'ALL_LOCATIONS'`, `'SPECIFIC_LOCATIONS'` |
| `version` | `VARCHAR(20)` | Default `'v1.0'` | ❌ No | เวอร์ชันของแบบฟอร์ม เช่น `v1.0`, `v2.1` |
| `is_latest` | `BOOLEAN` | Default `TRUE` | ❌ No | ระบุว่าเป็นเวอร์ชันล่าสุดที่เปิดใช้งานหรือไม่ |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดใช้งานฟอร์ม |
| `created_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้สร้างแบบฟอร์ม |
| `metadata_config_json` | `TEXT` | - | ✅ Yes | การตั้งค่าฟิลด์พิเศษเพิ่มเติมของฟอร์ม (JSON) |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่สร้างฟอร์ม |

*Index:* `(is_active, is_latest)`

---

### 3.2 ตาราง `SURVEY_FORM_TARGET_LOCATIONS` (การกำหนดสาขาเป้าหมายของฟอร์ม)
* **หน้าที่:** ใช้เมื่อแบบฟอร์มตั้งค่า `targeting_mode = 'SPECIFIC_LOCATIONS'`

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการผูกสาขา |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | รหัสแบบฟอร์ม |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | รหัสสาขาที่ต้องใช้ฟอร์มนี้ |

*Composite Unique Index:* `(survey_form_id, location_id)`  
*Index:* `location_id`

---

### 3.3 ตาราง `SURVEY_FORM_BRANDS` (การกำหนดแบรนด์เป้าหมายของฟอร์ม)
* **หน้าที่:** กำหนดแบรนด์ที่แบบฟอร์มนี้ครอบคลุม (Many-to-Many รองรับฟอร์มที่ใช้ร่วมหลายแบรนด์)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการผูกแบรนด์ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | รหัสแบบฟอร์ม |
| `brand_id` | `INTEGER` | `FOREIGN KEY` -> `BRANDS(id)` | ❌ No | รหัสแบรนด์ที่ใช้ฟอร์มนี้ |

*Index:* `(survey_form_id, brand_id)`

---

### 3.4 ตาราง `SURVEY_SECTIONS` (หมวดคำถาม)
* **หน้าที่:** เก็บหมวดหมู่คำถามหลักในแบบฟอร์ม พร้อม Soft Delete

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสหมวด |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | รหัสแบบฟอร์มแม่ |
| `title` | `VARCHAR(300)` | - | ❌ No | ชื่อหมวด เช่น `1. การควบคุมอุณหภูมิตู้แช่และวัตถุดิบ` |
| `order_index` | `INTEGER` | Default `0` | ❌ No | ลำดับการแสดงผลหมวด |
| `weight_percent` | `DOUBLE` | Default `0.0` | ❌ No | ค่าน้ำหนักหมวด (สำหรับคำนวณคะแนนถ่วงน้ำหนัก) |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดใช้งานหมวด (Soft Delete) |

*Index:* `survey_form_id`

---

### 3.5 ตาราง `SURVEY_ITEMS` (ข้อคำถามประเมิน)
* **หน้าที่:** เก็บข้อคำถามรายข้อ เกณฑ์คะแนนเต็ม การตั้งค่าข้อวิกฤต (Critical Defect) รหัสหมวดหมู่มาตรฐาน และ Soft Delete

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสข้อคำถาม |
| `survey_section_id`| `INTEGER` | `FOREIGN KEY` -> `SURVEY_SECTIONS(id)` | ❌ No | รหัสหมวดคำถามแม่ |
| `question_text` | `TEXT` | - | ❌ No | ข้อความคำถาม |
| `question_type` | `VARCHAR(20)` | Default `'YESNO'` | ❌ No | ประเภทคำถาม: `'YESNO'` (ผ่าน/ไม่ผ่าน), `'SCALE'` (1-5), `'TEXT'` |
| `full_score` | `DOUBLE` | Default `10.0` | ❌ No | คะแนนเต็มประจำข้อ |
| `is_critical` | `BOOLEAN` | Default `FALSE` | ❌ No | **ข้อวิกฤต (Critical Defect): ถ้าตก = ปรับตกทั้งฉบับ + ออก CAP ทันที** |
| `category_code` | `VARCHAR(20)` | - | ✅ Yes | รหัสหมวดมาตรฐาน: `CLN`, `DOC`, `OPS`, `QLT`, `SVC` |
| `category_name` | `VARCHAR(100)` | - | ✅ Yes | ชื่อหมวดมาตรฐาน: `ความสะอาด`, `เอกสาร`, `กระบวนการทำงาน`, `คุณภาพสินค้า-วัตถุดิบ`, `การบริการ` |
| `order_index` | `INTEGER` | Default `0` | ❌ No | ลำดับการแสดงผลข้อคำถาม |
| `is_active` | `BOOLEAN` | Default `TRUE` | ❌ No | สถานะเปิดใช้งานข้อคำถาม (Soft Delete) |

*Index:* `survey_section_id`

---

## 📅 โดเมนที่ 4: แผนการตรวจ (Audit Schedules)

### 4.1 ตาราง `AUDIT_SCHEDULES` (ตารางนัดหมายการตรวจ)
* **หน้าที่:** เก็บนัดหมายการลงตรวจสาขา วันที่ เวลา และประเภทการตรวจ

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสนัดหมาย |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาเป้าหมายที่ต้องเข้าตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่ต้องใช้ในการตรวจ |
| `scheduled_date` | `DATETIME` | - | ❌ No | วันที่ตามแผนงานที่นัดหมาย |
| `time` | `VARCHAR(20)` | - | ✅ Yes | เวลาที่นัดหมาย เช่น `10:00`, `14:30` |
| `audit_type` | `VARCHAR(20)` | Default `'announced'` | ❌ No | ประเภท: `'announced'` (ตามแผน), `'spot'` (สุ่มตรวจ), `'undercover'` (ตรวจลับ) |
| `status` | `VARCHAR(20)` | Default `'pending'` | ❌ No | สถานะ: `'pending'`, `'in_progress'`, `'completed'` |
| `notes` | `TEXT` | - | ✅ Yes | หมายเหตุหรือข้อความเน้นย้ำถึงผู้ตรวจ |
| `created_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้สร้างนัดหมาย |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่สร้างนัดหมาย |

*Indexes:* `(location_id, scheduled_date)`, `scheduled_date`, `(status, scheduled_date)`

---

### 4.2 ตาราง `AUDIT_SCHEDULE_AUDITORS` (ผู้ตรวจที่ได้รับมอบหมาย)
* **หน้าที่:** เชื่อมโยงผู้ตรวจกับนัดหมาย (รองรับทีมผู้ตรวจ 1 คนขึ้นไป พร้อมระบุหัวหน้าทีม)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการมอบหมาย |
| `audit_schedule_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_SCHEDULES(id)` | ❌ No | รหัสนัดหมาย |
| `auditor_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | รหัสผู้ตรวจที่ได้รับมอบหมาย |
| `is_lead` | `BOOLEAN` | Default `TRUE` | ❌ No | เป็นหัวหน้าทีมผู้ตรวจหลักหรือไม่ |

*Composite Unique Index:* `(audit_schedule_id, auditor_id)`  
*Index:* `auditor_id`

---

## ⚡ โดเมนที่ 5: การตรวจสด ประวัติผลตรวจ และบันทึกแก้ไข (Live Audit, Records & Audit Trail)

### 5.1 ตาราง `AUDIT_DRAFTS` (แบบร่างงานตรวจ Auto-Sync)
* **หน้าที่:** พักข้อมูลคำตอบและรูประหว่างตรวจสด ป้องกันข้อมูลสูญหาย บันทึกพิกัด GPS ผู้ตรวจตอนเริ่มตรวจ และผูกกับ `audit_schedule_id` (ถ้าตรวจตามแผน)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสแบบร่าง |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาที่กำลังตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่กำลังใช้ |
| `auditor_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ตรวจที่กำลังบันทึก |
| `audit_schedule_id`| `INTEGER`| `FOREIGN KEY` -> `AUDIT_SCHEDULES(id)` | ✅ Yes | รหัสนัดหมายตามแผนงาน (ป้องกัน Draft ชนกัน) |
| `draft_payload_json`| `TEXT` | - | ❌ No | ข้อมูลคำตอบ รูปภาพย่อ คอมเมนต์ ในรูปแบบ JSON |
| `current_section_idx`| `INTEGER`| Default `0` | ❌ No | ดัชนีหมวดที่ทำค้างอยู่ |
| `total_answered` | `INTEGER` | Default `0` | ❌ No | จำนวนข้อที่ตอบไปแล้ว |
| `total_questions` | `INTEGER` | Default `0` | ❌ No | จำนวนข้อทั้งหมดในฟอร์ม |
| `start_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดผู้ตรวจตอนกดเริ่มตรวจ |
| `start_longitude`| `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดผู้ตรวจตอนกดเริ่มตรวจ |
| `started_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่เริ่มตรวจ |
| `updated_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่ Auto-synced ล่าสุด |

*Index:* `(auditor_id, location_id, survey_form_id)`

---

### 5.2 ตาราง `AUDIT_RECORDS` (ผลการตรวจสมบูรณ์และลายเซ็น)
* **หน้าที่:** เก็บผลตรวจสมบูรณ์ที่กดยืนยันส่งแล้ว บันทึกลายเซ็นดิจิทัล พิกัดเริ่ม/จบ การตรวจย้อนหลัง (`is_backdated`) และค่าฟิลด์พิเศษ (`metadata_values_json`)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสประวัติการตรวจ |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาที่ถูกตรวจ |
| `survey_form_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_FORMS(id)` | ❌ No | แบบฟอร์มที่ใช้ตรวจ |
| `primary_auditor_id`| `INTEGER`| `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ตรวจหลักที่ส่งผล |
| `auditee_user_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้รับตรวจที่ลงนาม (ถ้ามีบัญชีในระบบ) |
| `auditee_name_text` | `VARCHAR(200)`| - | ✅ Yes | ชื่อผู้รับตรวจที่ลงนาม (Fallback ถ้าไม่มีบัญชี) |
| `audit_schedule_id`| `INTEGER`| `FOREIGN KEY` -> `AUDIT_SCHEDULES(id)` | ✅ Yes | รหัสนัดหมายตามแผนงาน |
| `audit_date` | `DATETIME` | `INDEX` | ❌ No | วันเวลาที่ทำการตรวจหน้างาน |
| `total_score` | `DOUBLE` | - | ❌ No | คะแนนรวมที่ได้ (ไม่รวมข้อ N/A) |
| `max_score` | `DOUBLE` | - | ❌ No | **คะแนนเต็มรวมจริง (หักคะแนนเต็มของข้อ N/A ออกแล้ว)** |
| `percentage_score` | `DOUBLE` | - | ❌ No | คะแนนคิดเป็นเปอร์เซ็นต์ เช่น `88.5` |
| `is_passed` | `BOOLEAN` | - | ❌ No | **ผ่านเกณฑ์หรือไม่ (>=85% และต้องไม่มี Critical ตก)** |
| `has_critical_defect`| `BOOLEAN`| Default `FALSE` | ❌ No | มีข้อวิกฤตตกหรือไม่ (ถ้าตกจะปรับ `is_passed=FALSE`) |
| `staff_count` | `INTEGER` | Default `0` | ❌ No | จำนวนพนักงานที่ปฏิบัติงานขณะตรวจ |
| `audit_type` | `VARCHAR(20)` | Default `'announced'` | ❌ No | ประเภทการตรวจ |
| `notes` | `TEXT` | - | ✅ Yes | สรุปภาพรวมและข้อเสนอแนะของผู้ตรวจ |
| `metadata_values_json`| `TEXT` | - | ✅ Yes | ค่าฟิลด์พิเศษเพิ่มเติมของผลตรวจ (JSON) |
| `auditor_signature_url`| `VARCHAR(500)`| - | ✅ Yes | Relative Path ภาพลายเซ็นผู้ตรวจ เช่น `/uploads/signatures/auditor_1.webp` |
| `auditee_signature_url`| `VARCHAR(500)`| - | ✅ Yes | Relative Path ภาพลายเซ็นผู้รับตรวจ เช่น `/uploads/signatures/auditee_1.webp` |
| `signed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่ลงนามเสร็จสมบูรณ์ |
| `start_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดตอนเริ่มตรวจ |
| `start_longitude`| `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดตอนเริ่มตรวจ |
| `end_latitude` | `DOUBLE` | - | ✅ Yes | พิกัดละติจูดตอนยืนยันส่งผลตรวจ |
| `end_longitude` | `DOUBLE` | - | ✅ Yes | พิกัดลองติจูดตอนยืนยันส่งผลตรวจ |
| `is_backdated` | `BOOLEAN` | Default `FALSE` | ❌ No | ตรวจย้อนหลังหรือไม่ |
| `started_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่เริ่มตรวจ |
| `submitted_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่ส่งผลตรวจจริง |

*Indexes:* `(location_id, audit_date)`, `audit_date`, `survey_form_id`, `(primary_auditor_id, audit_date)`

---

### 5.3 ตาราง `AUDIT_RESPONSES` (คำตอบรายข้อและระบบ N/A)
* **หน้าที่:** เก็บผลการให้คะแนน สถานะผ่าน/ไม่ผ่าน หมวดหมู่มาตรฐาน และระบบข้อไม่เกี่ยวข้อง (N/A)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสคำตอบ |
| `audit_record_id` | `INTEGER` | `FOREIGN KEY` -> `AUDIT_RECORDS(id)` | ❌ No | รหัสผลตรวจหลัก |
| `survey_item_id` | `INTEGER` | `FOREIGN KEY` -> `SURVEY_ITEMS(id)` | ❌ No | รหัสข้อคำถามที่ตอบ |
| `score_given` | `DOUBLE` | - | ❌ No | คะแนนที่ได้ในข้อนี้ |
| `is_passed` | `BOOLEAN` | - | ❌ No | ผ่านหรือไม่ผ่าน |
| `is_na` | `BOOLEAN` | Default `FALSE` | ❌ No | **ข้อไม่เกี่ยวข้อง (N/A): ไม่นำคะแนนเต็มข้อนี้ไปนับรวมใน `max_score`** |
| `category_name` | `VARCHAR(100)` | - | ✅ Yes | ชื่อหมวดมาตรฐานประจำข้อคำตอบ |
| `notes` | `TEXT` | - | ✅ Yes | ข้อคิดเห็น หรือข้อบกพร่องที่พบ |

*Indexes:* `audit_record_id`, `(survey_item_id, is_passed)`

---

### 5.4 ตาราง `AUDIT_RESPONSE_IMAGES` (รูปถ่ายหลักฐานการตรวจ — BEFORE)
* **หน้าที่:** เก็บ Path ไฟล์รูปภาพหลักฐานข้อบกพร่องตอนตรวจ (**BEFORE**) ระบุผู้ตรวจที่ถ่ายรูป

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรูปภาพหลักฐาน |
| `audit_response_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_RESPONSES(id)` | ❌ No | รหัสคำตอบข้อคำถามที่แนบรูป |
| `image_url` | `VARCHAR(500)`| - | ❌ No | Relative Path รูปภาพ เช่น `/uploads/audit_images/img_1.webp` |
| `uploaded_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ตรวจที่อัปโหลดรูปภาพ |
| `uploaded_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่อัปโหลดรูป |

---

### 5.5 ตาราง `AUDIT_RECORD_EDIT_LOGS` (ประวัติการแก้ไขบันทึกผลตรวจ)
* **หน้าที่:** เก็บ Audit Trail การแก้ไขบันทึกผลตรวจที่ส่งแล้ว (1 แถวต่อ 1 ครั้งที่แก้ไข) บังคับระบุเหตุผลเสมอ

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรายการบันทึกประวัติแก้ไข |
| `audit_record_id` | `INTEGER` | `FOREIGN KEY` -> `AUDIT_RECORDS(id)` | ❌ No | รหัสผลตรวจที่ถูกแก้ไข |
| `edited_by_user_id`| `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ดำเนินการแก้ไข (Admin/Auditor) |
| `edited_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่ทำการแก้ไข |
| `reason` | `TEXT` | - | ❌ No | **เหตุผลในการแก้ไข (บังคับกรอกเสมอ ห้ามเว้นว่าง)** |
| `changes_summary_json`| `TEXT` | - | ✅ Yes | ข้อมูลสรุปค่าก่อน/หลังการแก้ไข (JSON diff) |

*Index:* `audit_record_id`

---

## 🚨 โดเมนที่ 6: งานแก้ไขข้อบกพร่องและแชท (CAP Remediation & Chat)

### 6.1 ตาราง `CAP_TASKS` (ตั๋วงานแก้ไขข้อบกพร่อง)
* **หน้าที่:** เก็บลูปงานแก้ไขข้อบกพร่อง พร้อมหมวดหมู่ (`category_name`) และระบบการแนะนำตรวจซ้ำรอบถัดไป (`next_audit_note`, `follow_up_status`, `follow_up_schedule_id`)

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสตั๋วงาน CAP |
| `audit_record_id` | `INTEGER` | `FOREIGN KEY` -> `AUDIT_RECORDS(id)` | ✅ Yes | รหัสผลตรวจที่พบ (Nullable: รองรับการเปิด Manual CAP) |
| `audit_response_id`| `INTEGER` | `FOREIGN KEY` -> `AUDIT_RESPONSES(id)` | ✅ Yes | รหัสข้อที่ตก (Nullable: สำหรับงานนอกฟอร์ม) |
| `location_id` | `INTEGER` | `FOREIGN KEY` -> `LOCATIONS(id)` | ❌ No | สาขาที่ต้องดำเนินการแก้ไข |
| `category_name` | `VARCHAR(100)`| - | ✅ Yes | หมวดหมู่ข้อบกพร่อง เช่น `ความสะอาด`, `เอกสาร`, `การบริการ` |
| `issue_item` | `VARCHAR(300)`| - | ❌ No | หัวข้อข้อบกพร่อง |
| `description` | `TEXT` | - | ❌ No | รายละเอียดข้อบกพร่อง |
| `submission_deadline`| `DATETIME` | - | ❌ No | กำหนดส่งงานแก้ไข (SLA Deadline) |
| `status` | `VARCHAR(30)` | Default `'OPEN'` | ❌ No | สถานะตั๋ว: `'OPEN'`, `'SUBMITTED'`, `'REJECTED'`, `'CLOSED'` |
| `assigned_to` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้รับผิดชอบแก้ไข (ผู้จัดการสาขา) |
| `verified_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ✅ Yes | ผู้ตรวจสอบและอนุมัติปิดงาน (QA/QC) |
| `completed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่สาขาส่งงานแก้ไข |
| `closed_at` | `DATETIME` | - | ✅ Yes | วันเวลาที่ QA อนุมัติและปิดงานแก้ไข |
| `next_audit_note` | `TEXT` | - | ✅ Yes | คำแนะนำเน้นย้ำสำหรับการตรวจสาขานี้ในรอบถัดไป |
| `follow_up_status`| `VARCHAR(20)` | Default `'NONE'` | ❌ No | สถานะติดตามรอบถัดไป: `'NONE'`, `'PENDING'`, `'USED'` |
| `follow_up_schedule_id`| `INTEGER`| - | ✅ Yes | รหัสนัดหมายตรวจรอบถัดไปที่นำข้อนี้ไปติดตามผล |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่เปิดตั๋วงาน CAP |

*Indexes:* `audit_record_id`, `(location_id, status)`, `(assigned_to, status)`, `(location_id, created_at)`, `(status, submission_deadline)`

---

### 6.2 ตาราง `CAP_TASK_IMAGES` (รูปภาพหลักฐานงานแก้ไข — AFTER)
* **หน้าที่:** เก็บรูปภาพหลักฐานหลังปรับปรุงแก้ไขแล้ว (**AFTER**) แสดงผลในห้องแชท

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสรูปภาพ CAP |
| `cap_task_id` | `INTEGER` | `FOREIGN KEY` -> `CAP_TASKS(id)` | ❌ No | รหัสตั๋วงาน CAP แม่ |
| `phase` | `VARCHAR(20)` | Default `'AFTER'` | ❌ No | ระยะของรูปภาพ: `'AFTER'` |
| `image_url` | `VARCHAR(500)`| - | ❌ No | Relative Path ไฟล์รูปภาพ เช่น `/uploads/cap_images/after_1.webp` |
| `uploaded_by` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | ผู้ใช้ที่อัปโหลดรูปภาพ |
| `uploaded_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่อัปโหลดรูป |

---

### 6.3 ตาราง `CAP_TASK_COMMENTS` (ข้อความแชทพูดคุยในงานแก้ไข)
* **หน้าที่:** เก็บข้อความประวัติการสื่อสารระหว่าง ผู้จัดการสาขา กับ QA/QC พร้อมรูปภาพแนบในแชท

| ชื่อฟิลด์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraints | ค่าว่าง (Null) | คำอธิบายและตัวอย่างข้อมูล |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` (Auto Increment) | ❌ No | รหัสข้อความแชท |
| `cap_task_id` | `INTEGER` | `FOREIGN KEY` -> `CAP_TASKS(id)` | ❌ No | รหัสตั๋วงาน CAP แม่ |
| `sender_id` | `INTEGER` | `FOREIGN KEY` -> `USERS(id)` | ❌ No | รหัสผู้ส่งข้อความ |
| `sender_role` | `VARCHAR(20)` | - | ❌ No | บทบาทผู้ส่ง: `'AUDITEE'`, `'QA'`, `'ADMIN'` |
| `message` | `TEXT` | - | ❌ No | เนื้อหาข้อความพูดคุย/ชี้แจง |
| `image_url` | `VARCHAR(500)`| - | ✅ Yes | Relative Path รูปภาพแนบในแชท (ถ้ามี) |
| `created_at` | `DATETIME` | Default `GETUTCDATE()` | ❌ No | วันเวลาที่ส่งข้อความ |

*Index:* `cap_task_id`

---

## 🛡️ 7. คอลัมน์มาตรฐานระบบ (Standard Audit Shadow Properties)

ทุกตารางในระบบได้รับการกำหนดคอลัมน์มาตรฐานระดับ Entity Framework Core (Shadow Properties) เพื่อการตรวจสอบย้อนหลัง (Auditability) และการป้องกันการเขียนทับพร้อมกัน (Concurrency Control):

| คอลัมน์ (Column) | ชนิดข้อมูล | การทำงาน |
| :--- | :--- | :--- |
| `CreatedBy` | `INT` (Nullable) | รหัสผู้ใช้ที่บันทึกข้อมูล (เซ็ตอัตโนมัติผ่าน `AuditStampInterceptor`) |
| `CreatedAt` | `DATETIME` | วันเวลาที่สร้างข้อมูล (Default `GETUTCDATE()`) |
| `UpdatedBy` | `INT` (Nullable) | รหัสผู้ใช้ที่แก้ไขข้อมูลล่าสุด (เซ็ตอัตโนมัติผ่าน `AuditStampInterceptor`) |
| `UpdatedAt` | `DATETIME` (Nullable) | วันเวลาที่แก้ไขข้อมูลล่าสุด |
| `VersionNumber` | `ROWVERSION` / `TIMESTAMP` | Concurrency Token สำหรับตรวจจับ Optimistic Concurrency Conflicts |

---

## ⚡ 8. กลยุทธ์การสร้าง Index (Database Indexing Strategy)

สร้าง Index ครอบคลุมทุก Query ที่ใช้งานจริงเพื่อประสิทธิภาพสูงสุด (ตรงตาม `AppDbContext.cs`):

```sql
-- =============================================
-- โดเมน 1: ผู้ใช้และสิทธิ์
-- =============================================
CREATE UNIQUE INDEX IX_Users_Username ON Users(Username);
CREATE UNIQUE INDEX IX_UserLocations_UserId_LocationId ON UserLocations(UserId, LocationId);
CREATE UNIQUE INDEX IX_UserBrands_UserId_BrandId ON UserBrands(UserId, BrandId);
CREATE INDEX IX_Roles_Code ON Roles(Code);
CREATE INDEX IX_Permissions_Code ON Permissions(Code);
CREATE INDEX IX_RolePermissions_RoleId_PermissionId ON RolePermissions(RoleId, PermissionId);

-- =============================================
-- โดเมน 2: สถานที่และแบรนด์
-- =============================================
CREATE INDEX IX_LocationTypes_Code ON LocationTypes(Code);
CREATE INDEX IX_Locations_Code ON Locations(Code);
CREATE INDEX IX_Locations_IsActive_Code ON Locations(IsActive, Code);
CREATE INDEX IX_Locations_IsActive_LastScore ON Locations(IsActive, LastScore);
CREATE UNIQUE INDEX IX_Brands_Code ON Brands(Code);
CREATE UNIQUE INDEX IX_Brands_Name ON Brands(Name);
CREATE UNIQUE INDEX IX_LocationBrands_LocationId_BrandId ON LocationBrands(LocationId, BrandId);
CREATE INDEX IX_LocationBrands_BrandId ON LocationBrands(BrandId);

-- =============================================
-- โดเมน 3: แบบฟอร์มการตรวจ
-- =============================================
CREATE INDEX IX_SurveyForms_IsActive_IsLatest ON SurveyForms(IsActive, IsLatest);
CREATE UNIQUE INDEX IX_SurveyFormTargetLocations_Form_Loc ON SurveyFormTargetLocations(SurveyFormId, LocationId);
CREATE INDEX IX_SurveyFormTargetLocations_LocationId ON SurveyFormTargetLocations(LocationId);
CREATE INDEX IX_SurveyFormBrands_Form_Brand ON SurveyFormBrands(SurveyFormId, BrandId);
CREATE INDEX IX_SurveySections_SurveyFormId ON SurveySections(SurveyFormId);
CREATE INDEX IX_SurveyItems_SurveySectionId ON SurveyItems(SurveySectionId);

-- =============================================
-- โดเมน 4: แผนการตรวจ
-- =============================================
CREATE INDEX IX_AuditSchedules_Location_Date ON AuditSchedules(LocationId, ScheduledDate);
CREATE INDEX IX_AuditSchedules_ScheduledDate ON AuditSchedules(ScheduledDate);
CREATE INDEX IX_AuditSchedules_Status_Date ON AuditSchedules(Status, ScheduledDate);
CREATE UNIQUE INDEX IX_AuditScheduleAuditors_Schedule_Auditor ON AuditScheduleAuditors(AuditScheduleId, AuditorId);
CREATE INDEX IX_AuditScheduleAuditors_AuditorId ON AuditScheduleAuditors(AuditorId);

-- =============================================
-- โดเมน 5: การตรวจสดและประวัติผลตรวจ
-- =============================================
CREATE INDEX IX_AuditDrafts_Auditor_Loc_Form ON AuditDrafts(AuditorId, LocationId, SurveyFormId);
CREATE INDEX IX_AuditRecords_Location_Date ON AuditRecords(LocationId, AuditDate DESC);
CREATE INDEX IX_AuditRecords_AuditDate ON AuditRecords(AuditDate);
CREATE INDEX IX_AuditRecords_SurveyFormId ON AuditRecords(SurveyFormId);
CREATE INDEX IX_AuditRecords_Auditor_Date ON AuditRecords(PrimaryAuditorId, AuditDate DESC);
CREATE INDEX IX_AuditResponses_RecordId ON AuditResponses(AuditRecordId);
CREATE INDEX IX_AuditResponses_Item_Passed ON AuditResponses(SurveyItemId, IsPassed);
CREATE INDEX IX_AuditRecordEditLogs_RecordId ON AuditRecordEditLogs(AuditRecordId);

-- =============================================
-- โดเมน 6: CAP และการติดตามงาน
-- =============================================
CREATE INDEX IX_CapTasks_AuditRecordId ON CapTasks(AuditRecordId);
CREATE INDEX IX_CapTasks_Location_Status ON CapTasks(LocationId, Status);
CREATE INDEX IX_CapTasks_AssignedTo_Status ON CapTasks(AssignedTo, Status);
CREATE INDEX IX_CapTasks_Location_CreatedAt ON CapTasks(LocationId, CreatedAt);
CREATE INDEX IX_CapTasks_Status_Deadline ON CapTasks(Status, SubmissionDeadline);
CREATE INDEX IX_CapTaskComments_CapTaskId ON CapTaskComments(CapTaskId);
```

---
*เอกสาร Data Dictionary ฉบับนี้จัดทำขึ้นเป็นข้อกำหนดมาตรฐานฐานข้อมูลของระบบ Q.S.C. System ครอบคลุมการทำงานทั้งบน SQLite (Local Development) และ Microsoft SQL Server (Production)*

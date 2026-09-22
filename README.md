# 🏆 Q.S.C. Management System
### ระบบบริหารจัดการและประเมินมาตรฐานคุณภาพ บริการ และสุขอนามัย (Quality, Service, Cleanliness)
**บริษัท อาฟเตอร์ ยู จำกัด (มหาชน) — After You Public Company Limited**

---

<p align="left">
  <img src="https://img.shields.io/badge/.NET-10.0%20Web%20API-512BD4?style=flat-square&logo=dotnet&logoColor=white" alt=".NET 10" />
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/SQL%20Server-2022-CC292B?style=flat-square&logo=microsoftsqlserver&logoColor=white" alt="Microsoft SQL Server" />
  <img src="https://img.shields.io/badge/SignalR-Realtime%20Chat-0F6659?style=flat-square" alt="SignalR" />
  <img src="https://img.shields.io/badge/Local%20AI-Ollama%20%2F%20Qwen%202.5-black?style=flat-square" alt="Ollama AI" />
  <img src="https://img.shields.io/badge/License-Proprietary%20%2F%20Internal-slate?style=flat-square" alt="License" />
</p>

---

## 📖 1. ภาพรวมระบบ (System Overview)

**Q.S.C. Management System** เป็นระบบ Enterprise Web Application ที่พัฒนาขึ้นสำหรับฝ่ายควบคุมคุณภาพ (QA/QC) และฝ่ายปฏิบัติการหน้าร้านของเครือ **After You** เพื่อควบคุม ติดตาม และยกระดับมาตรฐานการปฏิบัติงานให้เป็นเลิศและสม่ำเสมอในทุกสาขา ครอบคลุมทั้ง 3 เสาหลัก:
1. **Quality (คุณภาพสินค้า):** มาตรฐานวัตถุดิบ รสชาติ อุณหภูมิ และกระบวนการจัดเตรียม
2. **Service (การบริการ):** ความสุภาพ ความรวดเร็ว การต้อนรับ และความประทับใจของลูกค้า
3. **Cleanliness (ความสะอาดสุขอนามัย):** สุขอนามัยพื้นที่บริการ ครัว อุปกรณ์ และการจัดเก็บตามมาตรฐานสากล

> [!NOTE]
> **Multi-Device & Responsive Design:**
> * **บนสมาร์ตโฟน / แท็บเล็ต (Mobile PWA):** ออกแบบเพื่อความคล่องตัวของผู้ตรวจ (Auditor) หน้างาน พร้อมระบบบันทึกแบบร่างอัตโนมัติ (Auto-save Draft), ตรวจสอบพิกัด GPS หน้าร้าน, ถ่ายภาพหลักฐานพร้อมบีบอัดบนเครื่อง, และระบบลงนามดิจิทัล (Digital Signature Pad)
> * **บนคอมพิวเตอร์ (Desktop Panoramic View):** ออกแบบเพื่อการวิเคราะห์ระดับบริหาร (Executive Dashboard), การจัดอันดับสาขา, ค้นหาประวัติการตรวจย้อนหลัง, ศูนย์จัดการข้อมูลหลัก (Master Data), และระบบห้องแชทติดตามงานแก้ไข (CAP) แบบ Real-Time

---

## 🏗️ 2. สถาปัตยกรรมและเทคโนโลยี (Architecture & Tech Stack)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER (Single Page Application)                       │
│  • Core: React 19 + Vite 8 (Ultra-fast build & Hot Module Replacement)                 │
│  • Styling: Tailwind CSS v4 + Emerald Corporate Design System (#0F6659)                │
│  • Visualizations: Recharts (Trend & Category Benchmark Charts)                        │
│  • Maps & Geolocation: Leaflet + OpenStreetMap + HTML5 Geolocation API                 │
│  • Real-Time Client: @microsoft/signalr (WebSocket Client for CAP Live Chat)           │
│  • Reporting Suite: xlsx-js-style (Excel Export with Styled Tables)                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP REST APIs & WebSocket (SignalR)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND LAYER (RESTful API & Real-Time)                       │
│  • Core: ASP.NET Core 10 Web API (C# .NET 10)                                          │
│  • ORM: Entity Framework Core 10 (Code-First with Fluent API)                          │
│  • Real-Time Hub: SignalR Hubs (/hubs/cap-chat)                                        │
│  • Security & Auth: JWT Bearer Token + Role & Granular Permission Authorization         │
│  • Concurrency & Audit Trail: Shadow Properties + VersionNumber Concurrency Token      │
│  • Local AI Engine: Ollama Local Client (Qwen 2.5:9b) + Smart Analytics Fallback       │
│  • Hosting: Kestrel / Microsoft IIS 10 with ASP.NET Core Hosting Bundle                │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ ADO.NET / TCP 1433
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE LAYER (Relational Database)                    │
│  • RDBMS: Microsoft SQL Server (QSCDB)                                                 │
│  • Schema: 25 Normalized Tables across 6 Enterprise Domains                            │
│  • Features: Multi-Brand, Multi-Branch Scope, Composite Indexes, Audit Trail           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 3. ฟังก์ชันหลักของระบบ (Core Modules & Features)

### 📊 3.1 แดชบอร์ดผู้บริหาร (Executive Dashboard & Analytics)
- **KPI Metrics สรุปผล:** คะแนนเฉลี่ยภาพรวม, อัตราผ่านเกณฑ์มาตรฐาน (Pass Rate), จำนวนสาขาที่ตรวจแล้ว, และงาน CAP ค้างแก้ไข
- **Latest Audit per Location:** คำนวณคะแนนภาพรวมและอัตราการผ่านเกณฑ์จาก **รอบล่าสุดของแต่ละสถานที่** ในช่วงเวลาที่เลือก ป้องกันการนำคะแนนตรวจซ้ำมาเฉลี่ยดึงค่าภาพรวมลง
- **Visual Gauge & Benchmarks:** มาตรวัดความสำเร็จทรงครึ่งวงกลมเทียบเป้าหมายมาตรฐานองค์กร ($\ge 85\%$)
- **Monthly Performance Trend:** กราฟวิเคราะห์แนวโน้มคะแนนเฉลี่ยรายเดือนย้อนหลัง พร้อมเส้นเกณฑ์มาตรฐาน
- **Dynamic Category Breakdown:** แสดงคะแนนจำแนกตาม 5 หมวดหมู่หลัก (ความสะอาด, เอกสาร, กระบวนการทำงาน, คุณภาพสินค้า, การบริการ)
- **Branch Rankings:** ตารางจัดอันดับสาขาคะแนนสูงสุดและต่ำสุด พร้อมสถานะผ่าน/ไม่ผ่าน

### 📱 3.2 ระบบตรวจประเมินสดหน้างาน (Live Audit Engine)
- **Workflow 3 ขั้นตอน:** ข้อมูลการตรวจ $\rightarrow$ รายการตรวจ $\rightarrow$ สรุปผลและลงนาม
- **Fair Scoring System:** 
  - รองรับข้อคำถามแบบ Yes/No, ข้อความ และสเกลคะแนน 1-5 (คะแนน $\ge 3$ ถือเป็นผ่านเกณฑ์มาตรฐาน)
  - รองรับระบบ **N/A (Not Applicable)** โดยหักคะแนนเต็มของข้อนั้นออกจากคะแนนเต็มสุทธิอย่างยุติธรรม
- **Critical Defect (Zero Tolerance):** หากมีข้อตรวจระดับวิกฤตไม่ผ่าน ระบบจะปรับผลการตรวจเป็นตกทันที พร้อมเปิดตั๋ว CAP ด่วน
- **GPS Distance Validation:** ตรวจสอบระยะห่างระหว่างพิกัดผู้ตรวจกับพิกัดจริงของสาขา เพื่อป้องกันการลงตรวจนอกสถานที่
- **Canvas-based Image Compression:** บีบอัดภาพถ่ายหลักฐานหน้างานบน Canvas ก่อนอัปโหลด ช่วยประหยัดแบนด์วิดท์และพื้นที่จัดเก็บ
- **Dual Digital Signatures:** กระดานลงนามดิจิทัลสำหรับผู้ตรวจประเมิน (Auditor) และผู้จัดการสาขา (Store Manager)
- **Auto-save Drafts:** บันทึกฉบับร่างอัตโนมัติลงเซิร์ฟเวอร์แบบ Real-Time สามารถเปิดทำงานต่อได้จากทุกอุปกรณ์

### 📅 3.3 แผนงานและการนัดหมายตรวจ (Audit Scheduling)
- วางแผนการตรวจล่วงหน้า พร้อมระบุประเภทการตรวจ: **ตามกำหนดการ (Announced)**, **สุ่มตรวจ (Spot)**, หรือ **ปลอมตัว (Undercover)**
- มอบหมายผู้ตรวจประเมินรายบุคคลหรือเป็นทีม (Lead Auditor & Co-Auditors)
- ระบบ Scoped Schedule ช่วยให้ผู้ตรวจแต่ละคนมองเห็นเฉพาะแผนงานที่ตนเองรับผิดชอบ

### 🛠️ 3.4 แผนปฏิบัติการแก้ไขและห้องแชทสด (CAP Remediation & Live Chat)
- ระบบสร้างตั๋วงาน CAP (Corrective Action Plan) อัตโนมัติทันทีที่พบข้อบกพร่อง พร้อมกำหนดส่งมอบ (SLA 3 วัน)
- ผู้จัดการสาขาส่งภาพถ่ายหลักฐานหลังแก้ไข (AFTER Evidence) และบันทึกมาตรการป้องกันการเกิดซ้ำ
- **Real-Time Chat (SignalR):** ห้องสนทนาสื่อสารสองทางระหว่างฝ่ายสาขาและฝ่าย QA พร้อมแนบรูปภาพได้แบบสดๆ
- กระบวนการตรวจสอบและอนุมัติปิดงาน (Review & Approval Workflow)

### 🔐 3.5 การจัดการข้อมูลหลักและสิทธิ์การเข้าถึง (Master Management & RBAC)
- บริหารจัดการข้อมูลผู้ใช้งาน, สาขา, แบรนด์, ประเภทสถานที่, และบทบาท
- **Multi-Brand & Co-Brand Architecture:** รองรับสาขาที่มีหลายแบรนด์เปิดให้บริการร่วมกัน (เช่น Cloud Kitchen หรือ Co-Brand Stores)
- **Data Scoping:** 
  - `BranchScope`: กำหนดให้ผู้จัดการสาขาเข้าถึงเฉพาะสาขาตนเอง (`SPECIFIC`) หรือเข้าถึงทุกสาขา (`ALL`)
  - `BrandScope`: กำหนดขอบเขตการเข้าถึงตามแบรนด์ที่ดูแล
- **Dynamic Mobile Role Navigation:** ผู้ดูแลระบบสามารถปรับเปลี่ยนเมนูแถบล่างบนมือถือของแต่ละบทบาทได้แบบ Real-Time

### 📑 3.6 รายงานและการส่งออกข้อมูล (Consolidated Reporting & Excel Suite)
- ระบบค้นหาประวัติการตรวจอัจฉริยะ รองรับการค้นหาด้วย **ชื่อเดือนและปีภาษาไทย** (เช่น "มีนาคม", "มี.ค. 2568", "ก.ย. 2569")
- ส่งออกรายงานเป็นไฟล์ Excel สวยงามพร้อมจัดรูปแบบ (Audit Summary, Full Inspection Report, CAP Tracking List, Monthly Meeting Report)

### 🤖 3.7 ระบบผู้ช่วยปัญญาประดิษฐ์ (AI Assistant & Smart Analytics)
- **Ollama Local AI Integration:** ประมวลผลผ่าน Local LLM (โมเดล Qwen 2.5:9b) ปลอดภัยภายในเครือข่ายองค์กร 100%
- **AI Dashboard Insights:** สรุปจุดเด่น จุดเฝ้าระวัง และข้อเสนอแนะเชิงกลยุทธ์ตามรอบเวลาที่เลือก พร้อม In-Memory Cache
- **AI CAP Advisor:** วิเคราะห์ข้อบกพร่องและแนะนำแนวทางแก้ไขเชิงปฏิบัติการตามมาตรฐาน QSC
- **AI Schedule Advisor:** วิเคราะห์ความเสี่ยงของสาขาและจัดลำดับความเร่งด่วนในการเข้าตรวจ
- **Smart Analytics Engine Fallback:** ระบบวิเคราะห์เชิงสถิติอัตโนมัติที่ทำงานได้ทันทีแม้ไม่ได้เชื่อมต่อ AI หรืออยู่ในโหมดออฟไลน์

---

## 📂 4. โครงสร้างโฟลเดอร์ของโปรเจกต์ (Project Structure)

```
qsc-System/
├── backend/
│   └── QSC.Api/
│       ├── Controllers/          # RESTful API Controllers (Audit, Cap, Dashboard, Form, etc.)
│       ├── Data/                 # AppDbContext, DatabaseSeeder, Interceptors
│       ├── Helpers/              # UserScopeHelper, LocationStatsHelper, TimezoneHelper
│       ├── Hubs/                 # SignalR Real-Time WebSocket Hub (CapChatHub.cs)
│       ├── Migrations/           # EF Core Database Migrations
│       ├── Models/               # C# Entity Data Models (25 Normalized Models)
│       ├── Services/             # Business Logic & AiService (Ollama Integration)
│       ├── Program.cs            # Dependency Injection, Middleware, JWT, CORS
│       └── web.config            # IIS Server Hosting Configuration
├── frontend/
│   ├── public/                   # Static assets, icons, manifest
│   └── src/
│       ├── config/               # api.js, roles.js, constants.js, theme.js
│       ├── context/              # DataContext.jsx, TopBarContext.jsx
│       ├── modals/               # Modal Dialogs (ExcelExport, ChangePassword, NewSchedule, etc.)
│       ├── pages/                # MainDashboard.jsx, Login.jsx
│       ├── screens/              # หน้าจอหลักแยกตามโมดูล (admin, audit, cap, dashboard, forms, schedule)
│       ├── shared/               # Reusable Components (Header, ScoreRing, BrandChipSelector)
│       └── utils/                # exportToExcel.js, formatters.js, imageCompressor.js
├── DATA_DICTIONARY.md            # 📚 พจนานุกรมข้อมูลฐานข้อมูล 25 ตารางฉบับสมบูรณ์
├── DATABASE_ERD.md               # 🗺️ แผนผังความสัมพันธ์ฐานข้อมูล (Mermaid ER Diagram)
├── SYSTEM_FLOWCHARTS.md          # 📊 ผังกระบวนการทำงานของระบบ 7 Use Cases
└── README.md                     # 📖 คู่มือและเอกสารแนะนำโครงการฉบับนี้
```

---

## 🔐 5. ระบบความปลอดภัยและสิทธิ์การใช้งาน (Security & Access Control)

ระบบใช้มาตรฐานความปลอดภัยระดับ Enterprise เพื่อปกป้องข้อมูลขององค์กร:

### 🛡️ นโยบายความปลอดภัย (Security Standards)
* **Authentication:** ยืนยันตัวตนด้วย **JSON Web Token (JWT)** ที่มีอายุการใช้งานจำกัด และเข้ารหัสลับด้วย Symmetric Security Key
* **Password Hashing:** จัดเก็บรหัสผ่านด้วยอัลกอริทึม **BCrypt** ที่มีความปลอดภัยสูง
* **Granular Permission Matrix:** ควบคุมการเข้าถึงในระดับ Controller และ Action Method ผ่าน Attribute `[Authorize(Roles = "...")]`
* **Data Isolation:** บังคับใช้ขอบเขตข้อมูล (User Data Scoping) ทั้งในระดับสาขา (`BranchScope`) และระดับแบรนด์ (`BrandScope`) ทำให้ผู้ใช้แต่ละคนมองเห็นเฉพาะข้อมูลที่ตนเองมีสิทธิ์เท่านั้น

### 👥 โครงสร้างบทบาทผู้ใช้งาน (User Roles Hierarchy)

| รหัสบทบาท (Role) | ชื่อบทบาท (Title) | ขอบเขตหน้าที่และความรับผิดชอบ |
|---|---|---|
| **ADMIN** | ผู้ดูแลระบบสูงสุด | เข้าถึงได้ทุกฟังก์ชัน บริหารจัดการข้อมูลหลัก (Master Data), จัดการบัญชีผู้ใช้, และกำหนดสิทธิ์ระบบ |
| **AUDITOR** | ผู้ตรวจประเมินคุณภาพ | บันทึกผลการตรวจหน้างานสด (Live Audit), จัดการแบบร่าง, ตรวจรับรองงานแก้ไข CAP, ดูแผนตรวจของตนเอง |
| **AUDITEE** | ผู้จัดการสาขา / ร้านค้า | ตรวจสอบผลการตรวจของสาขาตนเอง, ส่งมอบหลักฐานแก้ไขข้อบกพร่อง (CAP), สื่อสารผ่านห้องแชทกับฝ่าย QA |
| **STANDARD** | ผู้ดูแลมาตรฐานและ QA Lead | สร้างและปรับปรุงแบบฟอร์มการตรวจ, วางแผนกำหนดการตรวจ, ตรวจสอบและวิเคราะห์ภาพรวมมาตรฐาน |
| **EXEC** | ผู้บริหารระดับสูง | เรียกดูรายงานสถิติภาพรวม แดชบอร์ดแนวโน้ม และรายงานผลการดำเนินงานเชิงลึก |

---

## 🚀 6. วิธีการติดตั้งและเริ่มต้นใช้งาน (Installation & Quick Start)

### ความต้องการของระบบ (Prerequisites)
* **.NET SDK:** เวอร์ชัน 10.0 ขึ้นไป
* **Node.js:** เวอร์ชัน 18.0 ขึ้นไป (แนะนำเวอร์ชัน LTS)
* **Database:** Microsoft SQL Server (2019 / 2022 / Express / Enterprise)
* **Local AI (ทางเลือก):** Ollama พร้อมโมเดล `qwen2.5:9b` (หากต้องการเปิดใช้ฟีเจอร์ AI)

---

### ขั้นตอนที่ 1: ติดตั้งและเปิดใช้งาน Backend API
```bash
# 1. เข้าสู่โฟลเดอร์ Backend
cd backend/QSC.Api

# 2. คืนค่า Dependencies
dotnet restore

# 3. อัปเดตโครงสร้างฐานข้อมูล (Database Migrations)
dotnet ef database update

# 4. รันเซอร์วิส Backend API (พอร์ตเริ่มต้น http://localhost:5082)
dotnet run --launch-profile http
```

---

### ขั้นตอนที่ 2: ติดตั้งและเปิดใช้งาน Frontend
```bash
# 1. เข้าสู่โฟลเดอร์ Frontend
cd frontend

# 2. ติดตั้ง Dependencies
npm install

# 3. เริ่มต้นรันเว็บในโหมด Development
npm run dev
```

> [!TIP]
> **การกำหนดค่าการเชื่อมต่อ (Configuration):**
> * กำหนด Connection String ของฐานข้อมูลในไฟล์ `backend/QSC.Api/appsettings.json` หรือ `appsettings.Development.json`
> * กำหนด URL ของ Backend API สำหรับ Frontend ในไฟล์ `frontend/src/config/api.js`

---

## 📚 7. เอกสารอ้างอิงทางเทคนิคเพิ่มเติม (Technical Documentation)

- 📘 **[`DATA_DICTIONARY.md`](DATA_DICTIONARY.md)** — รายละเอียดโครงสร้างตารางทั้ง 25 ตาราง, ชนิดข้อมูล, Nullable, Default Values, Constraints, และคำอธิบายฟิลด์อย่างละเอียด
- 🗺️ **[`DATABASE_ERD.md`](DATABASE_ERD.md)** — ไดอะแกรมความสัมพันธ์ฐานข้อมูลฉบับสมบูรณ์ (Mermaid Entity Relationship Diagram) พร้อมระบุกฎ Cascade Delete และ Indexing
- 📊 **[`SYSTEM_FLOWCHARTS.md`](SYSTEM_FLOWCHARTS.md)** — แผนภาพผังงาน (Flowcharts) แสดงวงจรการทำงานของระบบ 7 Use Cases หลัก

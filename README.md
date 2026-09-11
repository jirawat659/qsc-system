# 🏆 Q.S.C. Management System
### ระบบบริหารจัดการมาตรฐานคุณภาพ บริการ และความสะอาด (Quality, Service, Cleanliness)
**After You Public Company Limited**

---

## 📖 1. ภาพรวมระบบ (System Overview)

**Q.S.C. System** เป็นระบบ Enterprise Web Application ที่ออกแบบและพัฒนาขึ้นเพื่อควบคุม ติดตาม และยกระดับมาตรฐานการปฏิบัติงานหน้าร้านของสาขาในเครือทั้งหมด ครอบคลุมทั้งมิติด้าน **คุณภาพสินค้า (Quality)**, **การบริการ (Service)** และ **ความสะอาดสุขอนามัย (Cleanliness)**

ระบบถูกออกแบบให้รองรับการทำงานแบบ **Multi-Device & Responsive** 100%:
- **บนสมาร์ตโฟน / แท็บเล็ต (Mobile PWA):** มุ่งเน้นความคล่องตัวสำหรับผู้ตรวจประเมิน (Auditor) หน้าร้าน พร้อมระบบบันทึกแบบร่างอัตโนมัติ (Auto-save Draft), ตรวจสอบพิกัด GPS หน้าร้าน, ถ่ายภาพหลักฐาน, และลงลายเซ็นดิจิทัล (Digital Signature) ร่วมกับผู้จัดการสาขา
- **บนคอมพิวเตอร์ (Desktop Panoramic View):** มุ่งเน้นการวิเคราะห์ข้อมูลภาพรวมระดับบริหาร (Executive Dashboard), การจัดอันดับสาขา, รายงานผลการตรวจย้อนหลัง, ศูนย์จัดการข้อมูลหลัก (Master Data), และระบบแชทติดตามงานแก้ไขข้อบกพร่อง (CAP) แบบ Real-Time

---

## 🏗️ 2. สถาปัตยกรรมและเทคโนโลยี (Architecture & Tech Stack)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND (Single Page Application)                       │
│  • Core: React 19 + Vite 8 (Ultra-fast build & HMR)                                   │
│  • Styling: Tailwind CSS v4 + Signature Emerald Corporate Theme (#0F6659)             │
│  • Visualizations: Recharts (Trend & Performance Charts)                             │
│  • Maps & Geolocation: Leaflet + OpenStreetMap + HTML5 Geolocation API                │
│  • Icons: Lucide React                                                               │
│  • Real-Time Client: @microsoft/signalr (WebSocket Connection)                        │
│  • Export Suite: xlsx-js-style (Multi-format Excel Reporting)                         │
└──────────────────────────────────────────┬────────────────────────────────────────────┘
                                           │ HTTP REST APIs & WebSocket (SignalR)
                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND API (RESTful & Real-Time)                       │
│  • Core: ASP.NET Core 9 Web API (C# .NET 9)                                           │
│  • ORM: Entity Framework Core 9 (Code-First with Fluent API)                          │
│  • Real-Time Hub: SignalR Hubs (/hubs/cap-chat)                                       │
│  • Authentication: JWT Bearer Token + Role & Granular Permission Authorization        │
│  • Concurrency & Audit: Shadow Properties + VersionNumber Concurrency Token          │
│  • Media Storage: Optimized Local Static File Provider (/uploads/)                    │
│  • Web Server: Microsoft IIS 10 + ASP.NET Core Hosting Bundle (web.config)            │
└──────────────────────────────────────────┬────────────────────────────────────────────┘
                                           │ ADO.NET / TCP 1433
                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (Relational Database)                           │
│  • RDBMS: Microsoft SQL Server                                                        │
│  • Schema: 25 ตารางแบบ Normalized ครอบคลุม 6 โดเมน                                    │
│  • Features: Multi-Brand, Multi-Location Scope, Audit Trail, High-Performance Indexes │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 3. ฟังก์ชันหลักของระบบ (Core Modules & Features)

### 📊 3.1 แดชบอร์ดผู้บริหาร (Executive Dashboard)
- **KPI Metrics:** คะแนนเฉลี่ยรวม, อัตราผ่านเกณฑ์มาตรฐาน, จำนวนสาขาที่ตรวจแล้ว, และงาน CAP ค้างแก้ไข
- **Visual Gauge & Benchmarks:** มาตรวัดความสำเร็จเทียบเป้าหมายองค์กร ($\ge 85\%$)
- **Monthly Trend:** กราฟวิเคราะห์แนวโน้มคะแนนเฉลี่ยย้อนหลัง พร้อมเส้นเกณฑ์มาตรฐาน
- **Dynamic Category Breakdown:** แสดงคะแนนจำแนกตามหมวดหมู่ (ความสะอาด, เอกสาร, กระบวนการ, วัตถุดิบ, บริการ)
- **Branch Rankings:** ตารางจัดอันดับสาขาคะแนนสูงสุด-ต่ำสุด พร้อมสถานะผ่าน/ไม่ผ่าน

### 📱 3.2 ตรวจประเมินหน้างานสด (Live Audit Engine)
- **Workflow 3 แท็บ:** ข้อมูลการตรวจ $\rightarrow$ รายการตรวจ $\rightarrow$ สรุปผลและลงลายเซ็น
- **Scoring System:** รองรับข้อคำถามแบบ Yes/No, สเกลคะแนน, และระบบ **N/A (Not Applicable)** โดยคำนวณคะแนนเต็มสุทธิใหม่อย่างยุติธรรม
- **Critical Defect (Zero Tolerance):** หากข้อตรวจระดับวิกฤตไม่ผ่าน ระบบจะปรับผลเป็นตกการตรวจทันที
- **GPS Distance Validation:** ตรวจจับระยะห่างระหว่างตำแหน่งผู้ตรวจกับพิกัดจริงของสาขา
- **Media Upload:** บีบอัดรูปถ่ายหลักฐานหน้างานบน Canvas ก่อนอัปโหลดเป็นภาพ WebP
- **Dual Signatures:** กระดานลงลายเซ็นดิจิทัลสำหรับผู้ตรวจ (Auditor) และผู้จัดการสาขา (Store Manager)
- **Auto-save Drafts:** บันทึกฉบับร่างอัตโนมัติป้องกันข้อมูลสูญหาย และเปิดทำต่อได้จากทุกอุปกรณ์

### 📅 3.3 แผนงานและตารางตรวจ (Schedule Management)
- กำหนดแผนงานตรวจล่วงหน้า พร้อมระบุประเภท: **ตามแผน (Announced)**, **สุ่มตรวจ (Spot)**, หรือ **ปลอมตัว (Undercover)**
- มอบหมายผู้ตรวจเดี่ยวหรือทีม (Lead Auditor & Co-Auditors)
- ระบบ Scoped Schedule ให้ผู้ตรวจแต่ละคนมองเห็นเฉพาะงานที่ตนเองรับผิดชอบ

### 🛠️ 3.4 แผนแก้ไขข้อบกพร่องและห้องแชทสด (CAP Remediation & Real-Time Chat)
- เมื่อพบข้อบกพร่องในการตรวจ ระบบจะเปิดตั๋วงาน CAP พร้อมกำหนดเวลาส่งมอบ (SLA 3 วัน) อัตโนมัติ
- ผู้จัดการสาขาส่งภาพถ่ายหลักฐานหลังแก้ไข (After-Evidence)
- **ห้องแชทสื่อสารสองทาง (SignalR WebSocket):** พูดคุยสอบถามและแนบรูปภาพระหว่างสาขาและฝ่าย QA ได้แบบเรียลไทม์
- กระบวนการอนุมัติและปิดงาน (Approval & Closure Workflow)

### 🔐 3.5 การจัดการข้อมูลหลักและสิทธิ์ (Master Management & RBAC)
- จัดการผู้ใช้งาน, สาขา, แบรนด์, ประเภทสถานที่, และบทบาท
- **Multi-Brand Support:** รองรับสาขาที่มีหลายแบรนด์ในที่เดียว (Co-Brand / Cloud Kitchen)
- **Data Scoping:** 
  - `BranchScope`: กำหนดให้ผู้จัดการสาขาเข้าถึงเฉพาะสาขาตนเอง (`SPECIFIC`) หรือดูได้ทั้งหมด (`ALL`)
  - `BrandScope`: กำหนดให้ดูแลเฉพาะแบรนด์ที่ได้รับมอบหมาย
- **Dynamic Role Navigation:** ปรับแต่งเมนูด้านล่างบนมือถือ 3 ช่องตามบทบาทได้จากหน้า Admin

### 📑 3.6 รายงานและการส่งออกข้อมูล (Consolidated Reports & Excel Suite)
- ค้นหาประวัติการตรวจย้อนหลังแบบอัจฉริยะ รองรับการค้นหาด้วย **เดือนและปีภาษาไทย** (เช่น "มีนาคม", "มี.ค. 2568", "ก.ย. 2569") โดยดึงข้อมูลตรงจากฐานข้อมูล
- ระบบส่งออกรายงานเป็น Excel สวยงามพร้อมจัดรูปแบบ (Summary, Full Audit Report, CAP List, Monthly Meeting Report)

---

## 📂 4. โครงสร้างโฟลเดอร์ของโปรเจกต์ (Directory Structure)

```
qsc-System/
├── backend/
│   └── QSC.Api/
│       ├── Controllers/          # REST API Controllers (Audit, Cap, Dashboard, Form, etc.)
│       ├── Data/                 # AppDbContext, DatabaseSeeder, AuditStampInterceptor
│       ├── Helpers/              # UserScopeHelper, LocationStatsHelper, RoleNavHelper
│       ├── Hubs/                 # SignalR Real-Time Chat Hub (CapChatHub.cs)
│       ├── Migrations/           # EF Core Database Migrations
│       ├── Models/               # C# Entity Data Models (25 Models)
│       ├── Services/             # Business Logic & AiService
│       ├── Program.cs            # Dependency Injection, Middleware, JWT, CORS
│       └── web.config            # IIS Server Hosting Configuration
├── frontend/
│   ├── public/                   # Static assets & icons
│   └── src/
│       ├── config/               # api.js, roles.js, constants.js, theme.js
│       ├── context/              # DataContext.jsx, TopBarContext.jsx
│       ├── modals/               # Modal Dialogs (ExcelExport, ChangePassword, etc.)
│       ├── pages/                # MainDashboard.jsx, Login.jsx
│       ├── screens/              # หน้าจอหลักแบ่งตามโมดูล (admin, audit, cap, dashboard, forms, schedule)
│       ├── shared/               # Reusable Components (Header, ScoreRing, BrandChipSelector)
│       └── utils/                # exportToExcel.js, formatters.js
├── DATA_DICTIONARY.md            # 📚 พจนานุกรมข้อมูลฐานข้อมูล 25 ตารางฉบับสมบูรณ์
├── DATABASE_ERD.md               # 🗺️ แผนผังความสัมพันธ์ฐานข้อมูล (Mermaid ER Diagram)
├── SYSTEM_FLOWCHARTS.md          # 📊 ผังกระบวนการทำงานของระบบ 7 Use Cases
└── README.md                     # 📖 คู่มือและเอกสารแนะนำโครงการฉบับนี้
```

---

## 🚀 5. วิธีการติดตั้งและเริ่มต้นใช้งาน (Installation & Quick Start)

### ความต้องการของระบบ (Prerequisites)
- **.NET SDK:** เวอร์ชัน 9.0 ขึ้นไป
- **Node.js:** เวอร์ชัน 18.0 ขึ้นไป (แนะนำ LTS)
- **Database:** Microsoft SQL Server (LocalDB / Express / Enterprise)

---

### ขั้นตอนที่ 1: ติดตั้งและรัน Backend API
```bash
# 1. เข้าสู่โฟลเดอร์ Backend
cd backend/QSC.Api

# 2. คืนค่า Dependencies
dotnet restore

# 3. อัปเดตฐานข้อมูล (Migrate & Seed Initial Data)
dotnet ef database update

# 4. เริ่มรัน Backend API (รันบนพอร์ต http://localhost:5082)
dotnet run
```

---

### ขั้นตอนที่ 2: ติดตั้งและรัน Frontend
```bash
# 1. เข้าสู่โฟลเดอร์ Frontend
cd frontend

# 2. ติดตั้ง Dependencies
npm install

# 3. เริ่มต้นโหมด Development (รันบนพอร์ต http://localhost:2000)
npm run dev
```

---

## 👥 6. บัญชีผู้ใช้สำหรับการทดสอบ (Default Test Accounts)

ระบบมี Seeder ข้อมูลผู้ใช้เริ่มต้น (`DatabaseSeeder.cs`) ดังนี้:

| ชื่อผู้ใช้งาน (Username) | รหัสผ่าน (Password) | บทบาท (Role) | สิทธิ์และหน้าที่ |
|---|---|---|---|
| `admin` | `admin123` | **ADMIN** | ผู้ดูแลระบบ เข้าถึงได้ทุกฟังก์ชัน จัดการข้อมูลหลัก และตั้งค่าสิทธิ์ |
| `auditor` | `auditor123` | **AUDITOR** | ผู้ตรวจประเมิน (QC Lead) ตรวจหน้างานสด ดูแผนงานตนเอง และตรวจรับรอง CAP |
| `auditee` | `auditee123` | **AUDITEE** | ผู้จัดการสาขา (Store Manager) ดูผลตรวจสาขาตนเอง ส่งงานแก้ไข CAP ในห้องแชท |
| `standard` | `standard123` | **STANDARD** | ผู้ดูแลมาตรฐาน (QA Team) วางแผนตรวจ สร้างแบบฟอร์ม วิเคราะห์ผลตรวจ |
| `exec` | `exec123` | **EXEC** | ผู้บริหารระดับสูง ดูรายงานสถิติภาพรวม แดชบอร์ด และแนวโน้มรายแบรนด์ |

---

## 📚 7. เอกสารอ้างอิงทางเทคนิคเพิ่มเติม (Technical Documentation)

- 📘 **[`DATA_DICTIONARY.md`](DATA_DICTIONARY.md)** — รายละเอียดโครงสร้างตารางทั้ง 25 ตาราง, ชนิดข้อมูล, Nullable, Default Values, Constraints, และคำอธิบายฟิลด์อย่างละเอียด
- 🗺️ **[`DATABASE_ERD.md`](DATABASE_ERD.md)** — ไดอะแกรมความสัมพันธ์ฐานข้อมูลฉบับสมบูรณ์ (Mermaid Entity Relationship Diagram) พร้อมระบุกฎ Cascade Delete และ Indexing
- 📊 **[`SYSTEM_FLOWCHARTS.md`](SYSTEM_FLOWCHARTS.md)** — แผนภาพผังงาน (Flowcharts) แสดงวงจรการทำงานของระบบ 7 Use Cases หลัก

# 📊 Q.S.C. System — ผังกระบวนการทำงานแยกตามเคส (System Flowcharts by Use Case)

> **เวอร์ชัน:** 2.8 (รองรับ Master Data Management 4 หมวด, สวิตช์เลื่อนเปิด/ระงับ, จัดเรียง Active-First, ตัวกรองบทบาท, N/A, ลายเซ็นดิจิทัล, แชท CAP และ กฎข้อวิกฤต)  
> **อัปเดตล่าสุด:** 26 สิงหาคม 2569

---

## 📑 สารบัญแผนภาพผังงาน (Flowcharts)

1. [Case 1: การวางแผนและนัดหมายตรวจ (Audit Scheduling Workflow)](#case-1-การวางแผนและนัดหมายตรวจ-audit-scheduling-workflow)
2. [Case 2: การตรวจสดหน้างาน การลงนาม N/A และ Auto-Sync (Live Audit & Signature Workflow)](#case-2-การตรวจสดหน้างาน-การลงนาม-na-และ-auto-sync-live-audit--signature-workflow)
3. [Case 3: การประเมินคะแนนแบบ Dynamic หัก N/A กฎข้อวิกฤต และเปิดตั๋ว CAP (Fair Scoring & CAP Workflow)](#case-3-การประเมินคะแนนแบบ-dynamic-หัก-na-กฎข้อวิกฤต-และเปิดตั๋ว-cap-fair-scoring--cap-workflow)
4. [Case 4: ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ CAP (CAP Chat Remediation Workflow)](#case-4-ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ-cap-cap-chat-remediation-workflow)
5. [Case 5: ศูนย์การจัดการข้อมูลหลักระบบ (Master Data Management & RBAC Workflow)](#case-5-ศูนย์การจัดการข้อมูลหลักระบบ-master-data-management--rbac-workflow)

---

## Case 1: การวางแผนและนัดหมายตรวจ (Audit Scheduling Workflow)
> **ผู้ใช้งาน:** QA Director / Admin / ผู้จัดการทีมตรวจ  
> **ตารางที่เกี่ยวข้อง:** `AUDIT_SCHEDULES`, `AUDIT_SCHEDULE_AUDITORS`, `LOCATIONS`, `SURVEY_FORMS`

```mermaid
flowchart TD
    Start(["เริ่มต้น: กำหนดแผนตรวจ"]) --> CreateSched["Admin / QA สร้างนัดหมายใหม่ (created_by NOT NULL)"]
    CreateSched --> SelectLoc["เลือกสาขาเป้าหมายจาก LOCATIONS"]
    SelectLoc --> SelectForm["เลือกแบบฟอร์มจาก SURVEY_FORMS (กรองเฉพาะ is_latest = TRUE)"]
    SelectForm --> SetDate["ระบุวันที่ เวลา และประเภท Announced / Spot / Undercover"]
    SetDate --> AssignAuditors["มอบหมายผู้ตรวจ 1 หรือหลายคนลง AUDIT_SCHEDULE_AUDITORS"]
    AssignAuditors --> SaveSched[("บันทึกนัดหมาย: Status = 'pending'")]

    SaveSched --> DecisionPending{"สถานะงานตรวจ?"}
    
    DecisionPending -->|"ยังไม่เริ่มตรวจ ('pending')"| CanEdit["✏️ อนุญาตแก้ไขวัน/เวลา/ผู้ตรวจ หรือ 🗑️ ลบนัดหมายได้"]
    CanEdit --> WaitDate["รอถึงกำหนดวันตรวจหน้างาน"]
    
    WaitDate --> StartAudit["ผู้ตรวจกดเริ่มตรวจหน้างาน"]
    StartAudit --> StatusInProgress[("อัปเดต Status = 'in_progress'")]
    
    StatusInProgress --> CompleteAudit["ผู้ตรวจส่งผลตรวจจริงเรียบร้อย"]
    CompleteAudit --> StatusCompleted[("อัปเดต Status = 'completed'")]
    StatusCompleted --> LockPermanently["🔒 ล็อกถาวร: ห้ามแก้ไขหรือลบทุกกรณี"]
    LockPermanently --> EndSched(["สิ้นสุดกระบวนการนัดหมาย"])

    style Start fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style SaveSched fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style LockPermanently fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style EndSched fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 2: การตรวจสดหน้างาน การลงนาม N/A และ Auto-Sync (Live Audit & Signature Workflow)
> **ผู้ใช้งาน:** ผู้ตรวจประเมินหน้างาน (Auditor) + ผู้รับการตรวจ (Auditee / Store Manager)  
> **ตารางที่เกี่ยวข้อง:** `AUDIT_DRAFTS`, `AUDIT_RECORDS`, `AUDIT_RESPONSES`, `AUDIT_RESPONSE_IMAGES`

```mermaid
flowchart TD
    StartAudit(["เริ่มต้น: ผู้ตรวจเปิดแอปตรวจหน้างาน"]) --> GPSDistance["อ่านพิกัด GPS บนเครื่องผู้ตรวจเพื่อคำนวณระยะทาง (แสดงสาขาใกล้สุด)"]
    GPSDistance --> BranchList["แสดงรายการสาขา: สาขาตรวจค้างอยู่บนสุด + สาขาอื่นเรียงตามระยะทางใกล้ไปไกล"]
    
    BranchList --> PickBranch["ผู้ตรวจเลือกสาขาที่จะเข้าตรวจ"]
    PickBranch --> LoadDraft{"มีแบบร่างตรวจค้าง (AUDIT_DRAFTS) หรือไม่?"}
    
    LoadDraft -->|"มี"| ResumeDraft["โหลดคำตอบเดิม + รูปภาพ มาทำต่อทันที"]
    LoadDraft -->|"ไม่มี"| CreateDraft["สร้างร่างใหม่: บันทึก StartLatitude, StartLongitude, StartTime"]
    
    ResumeDraft --> Answering["ทำข้อประเมิน (YES/NO, SCALE, TEXT)"]
    CreateDraft --> Answering
    
    Answering --> CheckNA{"ข้อนี้ใช้บังคับกับสาขานี้หรือไม่?"}
    CheckNA -->|"ไม่เกี่ยวข้อง"| MarkNA["🚩 ติ๊ก 'N/A' ➔ ไม่นำข้อนี้ไปคิดเป็นคะแนนเต็ม (Max Score)"]
    CheckNA -->|"ประเมินปกติ"| GradeItem["ให้คะแนนตามความเป็นจริง"]
    
    GradeItem --> CheckFail{"ข้อนี้ได้คะแนนตกหรือไม่?"}
    CheckFail -->|"ตก (Failed)"| UploadPhoto["📸 ถ่ายภาพหลักฐานข้อบกพร่อง (BEFORE Image)"]
    UploadPhoto --> AutoSaveDraft["⚡ Auto-sync บันทึกร่างลง AUDIT_DRAFTS อัตโนมัติ"]
    CheckFail -->|"ผ่าน (Passed)"| AutoSaveDraft
    MarkNA --> AutoSaveDraft
    
    AutoSaveDraft --> CheckFinish{"ตรวจครบทุกข้อหรือยัง?"}
    CheckFinish -->|"ยังไม่ครบ"| Answering
    CheckFinish -->|"ครบแล้ว"| SignPage["เข้าสู่หน้าสรุปผลและลงนามดิจิทัล (Signatures)"]
    
    SignPage --> AuditorSign["ผู้ตรวจลงนามดิจิทัล (Auditor Signature)"]
    AuditorSign --> AuditeeSign["ผู้จัดการสาขาตรวจสอบและลงนามรับทราบ (Auditee Signature)"]
    AuditeeSign --> FinalSubmit["กดยืนยันส่งผลตรวจขั้นสุดท้าย (Final Submit)"]
    
    FinalSubmit --> DBCommit[("บันทึก AUDIT_RECORDS + AUDIT_RESPONSES + AUDIT_RESPONSE_IMAGES")]
    DBCommit --> DelDraft["🗑️ ลบร่างตรวจใน AUDIT_DRAFTS ออก"]
    DelDraft --> UpdateCache["⚡ อัปเดต Cache: last_score และ last_audit_date ในตาราง LOCATIONS"]
    UpdateCache --> EndAudit(["สิ้นสุดกระบวนการตรวจหน้างาน"])

    style StartAudit fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style AutoSaveDraft fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style DBCommit fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndAudit fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 3: การประเมินคะแนนแบบ Dynamic หัก N/A กฎข้อวิกฤต และเปิดตั๋ว CAP (Fair Scoring & CAP Workflow)
> **ผู้ใช้งาน:** ระบบคำนวณอัตโนมัติ (Business Engine)  
> **ตารางที่เกี่ยวข้อง:** `SURVEY_ITEMS`, `AUDIT_RESPONSES`, `AUDIT_RECORDS`, `CAP_TASKS`

```mermaid
flowchart TD
    CalculateStart(["เริ่มคำนวณคะแนนและตัดเกรด"]) --> LoopItems["อ่านผลคะแนน AUDIT_RESPONSES ทีละข้อ"]
    
    LoopItems --> CheckItemNA{"ข้อนี้เป็น is_na == TRUE หรือไม่?"}
    CheckItemNA -->|"ใช่ (N/A)"| ExcludeNA["ตัดคะแนนเต็มข้อนี้ออกจาก max_score รวม"]
    CheckItemNA -->|"ไม่ใช่ (ตรวจจริง)"| AddScore["บวก score_earned เข้าคะแนนได้รวม และบวก max_score รวม"]
    
    ExcludeNA --> CheckCritical{"ข้อนี้ตก และเป็น is_critical == TRUE หรือไม่?"}
    AddScore --> CheckCritical
    
    CheckCritical -->|"ใช่ (ข้อวิกฤตตก)"| FlagCritical["🚨 ตั้งค่า has_critical_defect = TRUE (ตกทันทีไม่สนคะแนนรวม)"]
    CheckCritical -->|"ไม่ใช่"| CheckNext{"มีข้อถัดไปหรือไม่?"}
    FlagCritical --> CheckNext
    
    CheckNext -->|"มี"| LoopItems
    CheckNext -->|"ครบทุกข้อแล้ว"| CalcPercent["คำนวณเปอร์เซ็นต์: total_score = (score_earned / max_score) * 100"]
    
    CalcPercent --> EvaluatePassing{"has_critical_defect == TRUE หรือ total_score < 85% ?"}
    
    EvaluatePassing -->|"ใช่"| ResultFailed["❌ ผลการตรวจ: 'ไม่ผ่านเกณฑ์ (FAILED)'"]
    EvaluatePassing -->|"ไม่ใช่"| ResultPassed["✅ ผลการตรวจ: 'ผ่านเกณฑ์มาตรฐาน (PASSED)'"]
    
    ResultFailed --> AutoCAP["⚡ สร้างตั๋วงานแก้ไขข้อบกพร่อง (CAP_TASKS) อัตโนมัติสำหรับข้อที่ตก"]
    AutoCAP --> SaveRecord[("บันทึก total_score, is_passed, has_critical_defect ลง AUDIT_RECORDS")]
    ResultPassed --> SaveRecord
    
    SaveRecord --> EndCalc(["สิ้นสุดการประเมินผล"])

    style CalculateStart fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style FlagCritical fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style ResultFailed fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style ResultPassed fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndCalc fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 4: ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ CAP (CAP Chat Remediation Workflow)
> **ผู้ใช้งาน:** ผู้จัดการสาขา (Auditee) + ผู้ตรวจสอบมาตรฐาน (QA/QC / Auditor)  
> **ตารางที่เกี่ยวข้อง:** `CAP_TASKS`, `CAP_TASK_IMAGES`, `CAP_TASK_COMMENTS`

```mermaid
flowchart TD
    CAPStart(["เริ่มต้น: ตั๋วงาน CAP ถูกสร้าง (Status = 'OPEN')"]) --> AuditeeNotify["ผจก. สาขา ได้รับแจ้งเตือนข้อบกพร่อง (แสดงรูป BEFORE)"]
    
    AuditeeNotify --> AuditeeAction["สาขาดำเนินการแก้ไขข้อบกพร่องในพื้นที่จริง"]
    AuditeeAction --> AuditeeSubmit["ผจก. สาขา ถ่ายภาพหลักฐานหลังแก้ไข (AFTER Image) + พิมพ์ชี้แจง"]
    
    AuditeeSubmit --> SaveSubmitted[("อัปเดต CAP_TASKS: Status = 'SUBMITTED', บันทึก CAP_TASK_IMAGES")]
    
    SaveSubmitted --> QAReview["QA / ผู้ตรวจ เปิดห้องแชทตรวจสอบหลักฐาน"]
    QAReview --> ChatMessage["QA และ สาขา สามารถพิมพ์แชทตอบโต้ผ่าน CAP_TASK_COMMENTS ได้ตลอดเวลา"]
    
    ChatMessage --> QAApproveChoice{"QA ตรวจสอบผลงานแก้ไข"}
    
    QAApproveChoice -->|"ไม่ผ่านเกณฑ์ / หลักฐานไม่ชัด"| StatusRejected[("อัปเดต Status = 'REJECTED'")]
    StatusRejected --> NotifyFixAgain["ส่งกลับให้สาขาแก้ไขใหม่ พร้อมข้อความระบุจุดที่ต้องปรับปรุง"]
    NotifyFixAgain --> AuditeeAction
    
    QAApproveChoice -->|"ผ่านเกณฑ์มาตรฐานสมบูรณ์"| StatusClosed[("อัปเดต Status = 'CLOSED', บันทึก resolved_at")]
    StatusClosed --> EndCAP(["🔒 ปิดตั๋ว CAP สมบูรณ์ 100%"])

    style CAPStart fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style SaveSubmitted fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style StatusRejected fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style StatusClosed fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndCAP fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 5: ศูนย์การจัดการข้อมูลหลักระบบ (Master Data Management & RBAC Workflow)
> **ผู้ใช้งาน:** ผู้ดูแลระบบ (Admin)  
> **ตารางที่เกี่ยวข้อง:** `ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `USERS`, `USER_LOCATIONS`, `LOCATIONS`, `LOCATION_TYPES`

```mermaid
flowchart TD
    AdminLogin(["Admin เข้าสู่เมนูการจัดการระบบ (Master Management)"]) --> MasterCategory{"เลือกหมวดหมู่ข้อมูลหลัก 4 หมวด"}
    
    %% 👥 หมวด 1: จัดการผู้ใช้งาน
    MasterCategory -->|"1. ผู้ใช้งาน (Users)"| UserTab["หน้าจัดการ USERS พร้อม Role Filter & Status Filter"]
    UserTab --> UserAction{"เลือกการทำงาน"}
    UserAction -->|"เพิ่มผู้ใช้ใหม่"| OpenAddUserModal["เปิด Pop-up เพิ่มผู้ใช้ (Username, FullName, Password, Role, Scope)"]
    UserAction -->|"แตะการ์ดผู้ใช้"| OpenEditUserModal["เปิด Pop-up แก้ไขข้อมูลผู้ใช้ + รีเซ็ตรหัสผ่านในตัว + สวิตช์เปิด/ระงับ"]
    OpenAddUserModal --> SaveUserAPI[("POST /api/user ➔ บันทึกลง USERS & USER_LOCATIONS")]
    OpenEditUserModal --> SaveEditUserAPI[("PUT /api/user/{id} + POST /api/user/{id}/reset-password")]
    
    %% 🏬 หมวด 2: จัดการสถานที่ / สาขา
    MasterCategory -->|"2. สถานที่/สาขา (Locations)"| LocTab["หน้าจัดการ LOCATIONS พร้อม Status Filter"]
    LocTab --> LocAction{"เลือกการทำงาน"}
    LocAction -->|"เพิ่มสาขาใหม่"| OpenAddLocModal["เปิด Pop-up เพิ่มสาขา (Code, Name, Type, Region, GPS, Manager)"]
    LocAction -->|"แตะการ์ดสาขา"| OpenEditLocModal["เปิด Pop-up แก้ไขสาขา + สวิตช์เปิดให้บริการ/ปิดปรับปรุง"]
    OpenAddLocModal --> SaveLocAPI[("POST /api/location ➔ บันทึกลง LOCATIONS")]
    OpenEditLocModal --> SaveEditLocAPI[("PUT /api/location/{id}")]
    
    %% 🏷️ หมวด 3: จัดการประเภทสถานที่
    MasterCategory -->|"3. ประเภทสถานที่ (Location Types)"| TypeTab["หน้าจัดการ LOCATION_TYPES"]
    TypeTab --> TypeAction{"เลือกการทำงาน"}
    TypeAction -->|"เพิ่มประเภทใหม่"| OpenAddTypeModal["เปิด Pop-up เพิ่มประเภท (Code, Name, Description)"]
    TypeAction -->|"แตะการ์ดประเภท"| OpenEditTypeModal["เปิด Pop-up แก้ไขประเภทสถานที่"]
    OpenAddTypeModal --> SaveTypeAPI[("POST /api/location-type ➔ บันทึกลง LOCATION_TYPES")]
    OpenEditTypeModal --> SaveEditTypeAPI[("PUT /api/location-type/{id}")]
    
    %% 🛡️ หมวด 4: จัดการบทบาทและสิทธิ์
    MasterCategory -->|"4. บทบาทและสิทธิ์ (Roles)"| RoleTab["หน้าจัดการ ROLES & Permissions Matrix"]
    RoleTab --> RoleAction{"เลือกการทำงาน"}
    RoleAction -->|"เพิ่มบทบาทใหม่"| OpenAddRoleModal["เปิด Pop-up เพิ่ม Role (Code, Name, Description)"]
    RoleAction -->|"แตะการ์ดบทบาท"| OpenEditRoleModal["เปิด Pop-up กำหนดสิทธิ์ Checkbox Permissions Matrix"]
    OpenAddRoleModal --> SaveRoleAPI[("POST /api/role ➔ บันทึกลง ROLES")]
    OpenEditRoleModal --> SaveEditRoleAPI[("PUT /api/role/{id} ➔ Sync ลง ROLE_PERMISSIONS")]
    
    %% การจัดเรียงและการแสดงผล
    SaveUserAPI --> SortUsers["⚡ จัดเรียงอัตโนมัติ: บัญชีใช้งานอยู่บนสุด ➔ บัญชีระงับอยู่ล่างสุด"]
    SaveEditUserAPI --> SortUsers
    SortUsers --> EndMaster(["ข้อมูลอัปเดตและพร้อมใช้งานทั่วทั้งระบบทันที 100%"])
    SaveLocAPI --> EndMaster
    SaveEditLocAPI --> EndMaster
    SaveTypeAPI --> EndMaster
    SaveEditTypeAPI --> EndMaster
    SaveRoleAPI --> EndMaster
    SaveEditRoleAPI --> EndMaster

    style AdminLogin fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style OpenAddUserModal fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style OpenEditUserModal fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style SortUsers fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndMaster fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---
*เอกสารผังงานกระบวนการนี้จัดทำขึ้นเพื่อใช้อ้างอิงการทำงานของทุกเคสในระบบ Q.S.C. System*
